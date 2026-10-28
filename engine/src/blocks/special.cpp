// Special-purpose effects: acoustic simulator / acoustic preamp, guitar synth, spectral freeze, lo-fi,
// auto-swell and rhythmic slicer.
#include <random>

#include "../dsp/pitch.h"
#include "common.h"

namespace tz
{
namespace
{
// ============================================================================ acoustic
// mode 0: electric -> acoustic simulator, 1: piezo enhancer (body / air restored, quack removed), 2: preamp only
// body types (sim): 0 standard dread, 1 jumbo, 2 parlor, 3 nylon, 4 12-string
class AcousticBlock : public Block
{
public:
  int pMode, pBody, pType, pTop, pBass, pMid, pMidF, pTreble, pPres, pNotch, pNotchD, pComp, pSat, pLevel, pInv, pFb, pMix, pReverb;
  float sr = 48000;
  struct Ch
  {
    Biquad hp, bodyA, bodyB, scoop, air, quack, pickupFix, bass, mid, treble, pres, notch, fbN[3];
    DelayLine comb1, comb2;
    OnePole combLp1, combLp2, transLp;
    float compEnv = 0, prevEnv = 0;
    DelayLine rv;
    OnePole rvLp;
  } ch[2];
  WsolaShifter oct[2];
  LFO chor;
  DelayLine chDl[2];
  // anti-feedback analysis
  std::vector<float> fbBuf;
  int fbPos = 0;
  FFT fft;
  std::vector<std::complex<float>> fbSpec;
  float fbF[3] = {0, 0, 0};
  int fbHold[3] = {0, 0, 0};
  int fbCand = 0, fbCandCount = 0;
  float last[16];
  AcousticBlock(const json& o)
  {
    pMode = addParam("mode", o.value("mode", 0.f), 0, 2);
    pBody = addParam("body", 0.6f);
    pType = addParam("type", o.value("type", 0.f), 0, 4);
    pTop = addParam("top", 0.5f);
    pBass = addParam("bass", 0.5f);
    pMid = addParam("mid", 0.5f);
    pMidF = addParam("midfreq", 0.5f);
    pTreble = addParam("treble", 0.5f);
    pPres = addParam("presence", 0.5f);
    pNotch = addParam("notch", 0, 0, 1);     // 0 = off, else 40..400 Hz
    pNotchD = addParam("notchdepth", 0.6f);
    pComp = addParam("comp", 0.f);
    pSat = addParam("saturate", 0.f);
    pLevel = addParam("level", 0, -24, 12);
    pInv = addParam("phase", 0, 0, 1);
    pFb = addParam("antifb", 0, 0, 1);
    pMix = addParam("mix", 1.f);
    pReverb = addParam("reverb", 0.f);
    finalizeParams();
    for (auto& v : last) v = -99;
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    for (auto& h : ch)
    {
      h.comb1.allocate(int(0.01f * sr));
      h.comb2.allocate(int(0.01f * sr));
      h.combLp1.lp(2500, sr);
      h.combLp2.lp(1800, sr);
      h.transLp.lp(30, sr);
      h.rv.allocate(int(0.08f * sr));
      h.rvLp.lp(4000, sr);
    }
    for (auto& s : oct) s.prepare(sr, 2.5f, 18.f, 6.f);
    for (auto& d : chDl) d.allocate(int(0.03f * sr));
    chor.setRate(0.6f, sr);
    fbBuf.assign(4096, 0.f);
    fbSpec.assign(4096, 0);
    fft.init(4096);
  }
  void updateFilters()
  {
    const float cur[16] = {p(pMode), p(pBody), p(pType), p(pTop), p(pBass), p(pMid), p(pMidF), p(pTreble), p(pPres), p(pNotch), p(pNotchD), fbF[0], fbF[1], fbF[2], 0, 0};
    bool same = true;
    for (int i = 0; i < 14; ++i) if (cur[i] != last[i]) same = false;
    if (same) return;
    for (int i = 0; i < 16; ++i) last[i] = cur[i];
    const int mode = int(std::round(p(pMode))), type = int(std::round(p(pType)));
    const float body = p(pBody);
    // body resonances per guitar type
    const float fA[5] = {105, 92, 135, 115, 100}, fB[5] = {215, 190, 260, 230, 205};
    const float bodyGain = mode == 2 ? 0.f : (mode == 0 ? 9.f : 5.f) * body;
    for (auto& h : ch)
    {
      h.hp.set(Biquad::HP, mode == 0 ? 75 : 45, 0.7, 0, sr);
      h.bodyA.set(Biquad::Peak, fA[type], 1.4, bodyGain, sr);
      h.bodyB.set(Biquad::Peak, fB[type], 1.8, bodyGain * 0.6f, sr);
      h.scoop.set(Biquad::Peak, mode == 0 ? 700 : 900, 0.8, mode == 2 ? 0.f : -6.f * body, sr);
      h.air.set(Biquad::HighShelf, type == 3 ? 3500 : 5500, 0.7, mode == 2 ? 0.f : (type == 3 ? 3.f : 8.f) * p(pTop) - (type == 3 ? 3.f : 0.f), sr);
      // magnetic pickups: remove the resonant hump; piezo: tame the 1.5 kHz "quack"
      h.pickupFix.set(Biquad::Peak, 3200, 1.2, mode == 0 ? -7.f : 0.f, sr);
      h.quack.set(Biquad::Peak, 1600, 1.4, mode == 1 ? -6.f * body : 0.f, sr);
      h.bass.set(Biquad::LowShelf, 110, 0.7, (p(pBass) - 0.5f) * 24.f, sr);
      h.mid.set(Biquad::Peak, logMap(p(pMidF), 200, 5000), 0.9, (p(pMid) - 0.5f) * 24.f, sr);
      h.treble.set(Biquad::HighShelf, 4000, 0.7, (p(pTreble) - 0.5f) * 24.f, sr);
      h.pres.set(Biquad::Peak, 6500, 1.0, (p(pPres) - 0.5f) * 16.f, sr);
      const float nf = 40.f * std::pow(10.f, p(pNotch));
      h.notch.set(Biquad::Notch, nf, 2.f + 18.f * p(pNotchD), 0, sr);
      for (int k = 0; k < 3; ++k) h.fbN[k].set(Biquad::Notch, fbF[k] > 0 ? fbF[k] : 1000, 30, 0, sr);
    }
  }
  void analyseFeedback(const float* x, int n)
  {
    for (int i = 0; i < n; ++i)
    {
      fbBuf[fbPos++] = x[i];
      if (fbPos < 4096) continue;
      fbPos = 0;
      for (int k = 0; k < 4096; ++k) fbSpec[k] = fbBuf[k] * (0.5f - 0.5f * std::cos(float(kTwoPi) * k / 4096));
      fft.transform(fbSpec.data(), false);
      // strongest bin 60..1200 Hz vs. the median level around it
      const int lo = int(60 * 4096 / sr), hi = int(1200 * 4096 / sr);
      int best = lo;
      float bm = 0, sum = 0;
      for (int k = lo; k < hi; ++k) { const float m = std::abs(fbSpec[k]); sum += m; if (m > bm) { bm = m; best = k; } }
      const float avg = sum / float(hi - lo);
      if (bm > avg * 14.f && bm > 2.f)
      {
        if (std::abs(best - fbCand) <= 1) ++fbCandCount;
        else { fbCand = best; fbCandCount = 1; }
        if (fbCandCount >= 3)
        {
          const float f = best * sr / 4096.f;
          int slot = 0;
          for (int s = 0; s < 3; ++s) if (fbHold[s] < fbHold[slot]) slot = s;
          bool dup = false;
          for (int s = 0; s < 3; ++s) if (fbF[s] > 0 && std::fabs(fbF[s] - f) < 12) dup = true;
          if (!dup) { fbF[slot] = f; fbHold[slot] = 200; }
          fbCandCount = 0;
        }
      }
      for (auto& h : fbHold) if (h > 0) --h;
    }
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    updateFilters();
    const int mode = int(std::round(p(pMode))), type = int(std::round(p(pType)));
    const float body = p(pBody), comp = p(pComp), sat = p(pSat), mix = p(pMix), rvAmt = p(pReverb);
    const float g = dbToGain(p(pLevel)) * (p(pInv) > 0.5f ? -1.f : 1.f);
    const bool notchOn = p(pNotch) > 0.001f, fb = p(pFb) > 0.5f;
    const float compA = 1.f - std::exp(-1.f / (0.003f * sr)), compR = 1.f - std::exp(-1.f / (0.12f * sr));
    const int nc = procChannels(nIn, nOut);
    for (int c = 0; c < nc && c < 2; ++c)
    {
      Ch& h = ch[c];
      const float* x = nIn ? in[std::min(c, nIn - 1)] : nullptr;
      float* y = out[std::min(c, nOut - 1)];
      for (int i = 0; i < n; ++i)
      {
        const float dry = x ? x[i] : 0.f;
        float v = h.hp.process(dry);
        if (mode != 2)
        {
          v = h.pickupFix.process(v);
          v = h.quack.process(v);
          // short body ring (two lossy combs ~ the top / back plates)
          const float d1 = (type == 1 ? 2.1f : type == 2 ? 1.4f : 1.8f) * 0.001f * sr, d2 = (type == 1 ? 3.3f : type == 2 ? 2.2f : 2.9f) * 0.001f * sr;
          const float c1 = h.comb1.readLinear(d1), c2 = h.comb2.readLinear(d2);
          h.comb1.push(flushDenorm(v + h.combLp1.processLP(c1) * 0.45f * body));
          h.comb2.push(flushDenorm(v + h.combLp2.processLP(c2) * 0.4f * body));
          v = v + (c1 + c2) * 0.35f * body;
          v = h.bodyB.process(h.bodyA.process(v));
          v = h.scoop.process(v);
          v = h.air.process(v);
          // pick attack: an acoustic's transient is sharper than a magnetic pickup's
          const float env = h.transLp.processLP(std::fabs(v));
          const float tr = std::max(0.f, env - h.prevEnv) * 40.f;
          h.prevEnv = env;
          v *= 1.f + std::min(1.5f, tr) * (mode == 0 ? 0.6f : 0.3f);
          if (type == 4 && c == 0) v += oct[0].process(v, 2.f) * 0.35f; // 12-string octave course
        }
        v = h.bass.process(v);
        v = h.mid.process(v);
        v = h.treble.process(v);
        v = h.pres.process(v);
        if (notchOn) v = h.notch.process(v);
        if (fb) for (int k = 0; k < 3; ++k) if (fbF[k] > 0) v = h.fbN[k].process(v);
        if (comp > 0.001f)
        {
          const float a = std::fabs(v);
          h.compEnv += (a > h.compEnv ? compA : compR) * (a - h.compEnv);
          const float thr = dbToGain(-6.f - 30.f * comp);
          const float gr = h.compEnv > thr ? std::pow(thr / h.compEnv, 0.66f) : 1.f;
          v *= gr * (1.f + comp * 2.f);
        }
        if (sat > 0.001f) v = v * (1.f - sat) + shape::tube(v * (1.f + 4.f * sat), 0.1f) * sat * 0.8f;
        if (rvAmt > 0.001f)
        {
          // small room "air" for a mic'd acoustic feel
          const float r1 = h.rv.readLinear(0.023f * sr + c * 37), r2 = h.rv.readLinear(0.041f * sr + c * 23);
          h.rv.push(flushDenorm(v + h.rvLp.processLP(r1 + r2) * 0.42f));
          v += (r1 + r2) * 0.5f * rvAmt;
        }
        y[i] = (v * mix + dry * (1.f - mix)) * g;
      }
    }
    for (int c = nc; c < nOut; ++c) std::memcpy(out[c], out[0], sizeof(float) * n);
    if (fb) analyseFeedback(out[0], n);
  }
  void status(json& j) override
  {
    json f = json::array();
    for (float v : fbF) if (v > 0) f.push_back(int(v));
    j["fbNotches"] = f;
  }
};

// ============================================================================ guitar synth
// modes: 0 square lead, 1 saw lead, 2 organ, 3 strings, 4 brass, 5 sub bass, 6 pad swell, 7 filter sweep (auto-wah synth)
class SynthBlock : public Block
{
public:
  int pMode, pAttack, pFilter, pReso, pSens, pOct, pDry, pWet, pLevel, pMod, pDecay;
  float sr = 48000;
  WsolaShifter shDown, shDown2, shUp, shUp2;
  SVF f1, f2;
  EnvFollower env, envSlow;
  float vca = 0;
  LFO lfo[3];
  DelayLine ens;
  OnePole pre;
  bool gate = false;
  float decayEnv = 1;
  SynthBlock(const json& o)
  {
    pMode = addParam("mode", o.value("mode", 0.f), 0, 7);
    pAttack = addParam("attack", 0.2f);
    pFilter = addParam("filter", 0.5f);
    pReso = addParam("reso", 0.4f);
    pSens = addParam("sens", 0.5f);
    pOct = addParam("octave", 0, -2, 1);
    pDry = addParam("dry", 0.f);
    pWet = addParam("wet", 0.8f);
    pLevel = addParam("level", 0, -24, 12);
    pMod = addParam("mod", 0.3f);
    pDecay = addParam("decay", 0.6f);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    for (auto* s : {&shDown, &shDown2, &shUp, &shUp2}) s->prepare(sr, 2.5f, 22.f, 7.f);
    env.setup(2, 60, sr);
    envSlow.setup(20, 300, sr);
    ens.allocate(int(0.04f * sr));
    lfo[0].setRate(0.7f, sr); lfo[1].setRate(0.93f, sr); lfo[2].setRate(1.21f, sr);
    lfo[1].phase = 0.33; lfo[2].phase = 0.66;
    pre.lp(1200, sr);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int mode = int(std::round(p(pMode)));
    const int octv = int(std::round(p(pOct)));
    const float baseF = logMap(p(pFilter), 120, 9000), q = 0.6f + 9.f * p(pReso), sens = p(pSens);
    const float atk = 1.f - std::exp(-1.f / (std::max(0.002f, 0.002f + 2.5f * p(pAttack) * p(pAttack)) * sr));
    const float rel = 1.f - std::exp(-1.f / ((0.03f + 0.6f * p(pDecay)) * sr));
    const float wet = p(pWet), dry = p(pDry), g = dbToGain(p(pLevel));
    const float modAmt = p(pMod);
    const float ratioMain = std::pow(2.f, float(octv));
    for (int i = 0; i < n; ++i)
    {
      const float x = nIn ? in[0][i] : 0.f;
      const float e = env.process(x), es = envSlow.process(x);
      // gate for VCA: opens on playing, closes as the note dies
      const float thr = 0.004f;
      if (!gate && e > thr * 2.f) { gate = true; decayEnv = 1.f; }
      else if (gate && es < thr) gate = false;
      vca += ((gate ? 1.f : 0.f) - vca) * (gate ? atk : rel);
      float src = 0;
      const float base = ratioMain == 1.f ? x : (ratioMain < 0.6f ? (ratioMain < 0.3f ? shDown2.process(x, 0.25f) : shDown.process(x, 0.5f)) : shUp.process(x, 2.f));
      switch (mode)
      {
        case 0: { const float s = fastTanh(base * 60.f); src = s * 0.06f; break; }                         // square lead (hard-clipped)
        case 1: { const float s = shape::asym(base * 25.f, 0.6f); src = s * 0.09f; break; }                   // saw-ish (asymmetric)
        case 2: { const float d = shDown.process(x, 0.5f), u = shUp.process(x, 2.f), u2 = shUp2.process(x, 4.f); // organ drawbars
          src = 0.6f * x + 0.7f * d + 0.45f * u + 0.25f * u2; break; }
        case 3: { const float d = shDown.process(x, 0.5f); src = 0.6f * x + 0.5f * d; break; }               // strings (slow attack + ensemble)
        case 4: { src = fastTanh(base * 18.f) * 0.08f; break; }                                              // brass
        case 5: { const float d = shDown.process(x, 0.5f), d2 = shDown2.process(x, 0.25f); src = fastTanh((d + d2 * 0.8f) * 30.f) * 0.08f; break; } // sub bass
        case 6: { const float d = shDown.process(x, 0.5f), u = shUp.process(x, 2.f); src = 0.7f * x + 0.5f * d + 0.3f * u; break; } // pad
        default: src = fastTanh(base * 30.f) * 0.07f;                                                         // filter sweep
      }
      // envelope-swept resonant low-pass
      float fc = baseF;
      if (mode == 0 || mode == 1 || mode == 4 || mode == 5 || mode == 7) fc = baseF * (1.f + sens * 14.f * std::min(1.f, e * 8.f));
      f1.set(fc, q, sr);
      f1.process(src);
      float v = f1.lp;
      if (mode == 2 || mode == 3 || mode == 6)
      {
        // ensemble / leslie-ish movement
        ens.push(v);
        float m = 0;
        for (int k = 0; k < 3; ++k) m += ens.readLinear(0.007f * sr + lfo[k].next(0) * (0.002f + 0.004f * modAmt) * sr);
        v = v * 0.5f + m * 0.35f;
      }
      const float shaped = v * vca * (mode == 3 || mode == 6 ? 1.0f : 1.f);
      out[0][i] = (shaped * wet * 2.f + x * dry) * g;
    }
    for (int c = 1; c < nOut; ++c) std::memcpy(out[c], out[0], sizeof(float) * n);
  }
};

// ============================================================================ spectral freeze
// mode 0 latch (event 1 toggles), 1 momentary (event 1 down / 2 up), 2 auto (freezes each new note)
class FreezeBlock : public Block
{
public:
  static constexpr int N = 4096, H = 1024;
  int pMode, pDecay, pMix, pLevel, pLayer, pSpeed, pTone, pDry;
  float sr = 48000;
  FFT fft;
  std::vector<float> win, inRing, outAcc, mags, curMags;
  std::vector<std::complex<float>> spec;
  std::vector<double> phase;
  int inPos = 0, hopCount = 0, outPos = 0;
  bool frozen = false, wantFreeze = false, wantRelease = false;
  float fade = 0, amp = 0;
  std::mt19937 rng{1234};
  EnvFollower env;
  float lastEnv = 0;
  int autoHold = 0;
  OnePole toneLp[2];
  FreezeBlock(const json& o)
  {
    pMode = addParam("mode", o.value("mode", 0.f), 0, 2);
    pDecay = addParam("decay", 1.f);   // 1 = infinite
    pMix = addParam("mix", 0.7f);
    pLevel = addParam("level", 0, -24, 12);
    pLayer = addParam("layer", 0, 0, 1);
    pSpeed = addParam("speed", 0.3f);  // fade-in time
    pTone = addParam("tone", 1.f);
    pDry = addParam("dry", 1.f);
    finalizeParams();
  }
  bool hasTrails() const override { return true; }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    fft.init(N);
    win.resize(N);
    for (int i = 0; i < N; ++i) win[i] = 0.5f - 0.5f * std::cos(float(kTwoPi) * i / N);
    inRing.assign(N, 0.f);
    outAcc.assign(N * 2, 0.f);
    mags.assign(N / 2 + 1, 0.f);
    curMags.assign(N / 2 + 1, 0.f);
    phase.assign(N / 2 + 1, 0.0);
    spec.assign(N, 0);
    env.setup(1, 120, sr);
  }
  void onEvent(const BlockEvent& e) override
  {
    if (e.type == 1) { if (int(std::round(p(pMode))) == 1) wantFreeze = true; else { if (frozen) wantRelease = true; else wantFreeze = true; } }
    else if (e.type == 2) wantRelease = true;
  }
  void analyse()
  {
    for (int i = 0; i < N; ++i) spec[i] = inRing[(inPos + i) % N] * win[i];
    fft.transform(spec.data(), false);
    for (int k = 0; k <= N / 2; ++k) curMags[k] = std::abs(spec[k]);
  }
  void synth()
  {
    std::uniform_real_distribution<double> u(0.0, kTwoPi);
    for (int k = 0; k <= N / 2; ++k)
    {
      // advance each bin at its own frequency plus a random jitter -> smooth, non-repeating drone
      phase[k] += kTwoPi * k * H / N + (u(rng) - kPi) * 0.6;
      spec[k] = std::polar(mags[k], float(phase[k]));
      if (k > 0 && k < N / 2) spec[N - k] = std::conj(spec[k]);
    }
    fft.transform(spec.data(), true);
    for (int i = 0; i < N; ++i) outAcc[(outPos + i) % (N * 2)] += spec[i].real() * win[i] * (2.f / 3.f);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int mode = int(std::round(p(pMode)));
    const float mix = p(pMix), g = dbToGain(p(pLevel)), dryG = p(pDry);
    const float decay = p(pDecay);
    const float fadeStep = 1.f / ((0.02f + 2.f * p(pSpeed)) * sr);
    const float decayMul = decay >= 0.999f ? 1.f : std::exp(-1.f / ((0.3f + 12.f * decay) * sr / H));
    toneLp[0].lp(logMap(p(pTone), 800, 20000), sr);
    for (int i = 0; i < n; ++i)
    {
      const float x = nIn ? (nIn > 1 ? 0.5f * (in[0][i] + in[1][i]) : in[0][i]) : 0.f;
      inRing[inPos] = x;
      inPos = (inPos + 1) % N;
      // auto mode: capture shortly after each new attack
      if (mode == 2)
      {
        const float e = env.process(x);
        if (e > 0.02f && e > lastEnv * 1.8f && autoHold <= 0) autoHold = int(0.12f * sr);
        lastEnv = lastEnv * 0.999f + e * 0.001f;
        if (autoHold > 0 && --autoHold == 0) wantFreeze = true;
      }
      if (++hopCount >= H)
      {
        hopCount = 0;
        if (wantFreeze)
        {
          analyse();
          const bool layer = p(pLayer) > 0.5f && frozen;
          for (int k = 0; k <= N / 2; ++k) mags[k] = layer ? std::sqrt(mags[k] * mags[k] + curMags[k] * curMags[k]) : curMags[k];
          frozen = true;
          wantFreeze = false;
        }
        if (wantRelease) { frozen = false; wantRelease = false; }
        if (frozen && decayMul < 1.f) for (auto& m : mags) m *= decayMul;
        if (frozen || fade > 0) synth();
      }
      // fade in / out
      fade = frozen ? std::min(1.f, fade + fadeStep) : std::max(0.f, fade - fadeStep * 2.f);
      const int rp = (outPos + i % 1) % (N * 2);
      float w = outAcc[outPos];
      outAcc[outPos] = 0.f;
      outPos = (outPos + 1) % (N * 2);
      (void)rp;
      w = toneLp[0].processLP(w) * fade;
      const float dl = nIn ? in[0][i] : 0.f;
      out[0][i] = (dl * dryG + w * mix * 2.f) * g;
      if (nOut > 1) out[1][i] = ((nIn > 1 ? in[1][i] : dl) * dryG + w * mix * 2.f) * g;
    }
  }
  void status(json& j) override { j["frozen"] = frozen; }
};

// ============================================================================ lo-fi
// modes: 0 cassette, 1 vinyl, 2 AM radio, 3 telephone, 4 sampler (bits / rate)
class LofiBlock : public Block
{
public:
  int pMode, pWow, pFlutter, pAge, pNoise, pMix, pLevel, pSat, pBits, pRate;
  float sr = 48000;
  DelayLine dl[2];
  LFO wow;
  OnePole flutLp, lp1[2], lp2[2], hp[2], noiseLp;
  Biquad bp1[2], bp2[2];
  std::mt19937 rng{77};
  float flutT = 0, hold[2] = {0, 0}, holdCnt = 0, crackle = 0;
  float lastAge = -1;
  int lastMode = -1;
  LofiBlock(const json& o)
  {
    pMode = addParam("mode", o.value("mode", 0.f), 0, 4);
    pWow = addParam("wow", 0.3f);
    pFlutter = addParam("flutter", 0.3f);
    pAge = addParam("age", 0.4f);
    pNoise = addParam("noise", 0.2f);
    pMix = addParam("mix", 1.f);
    pLevel = addParam("level", 0, -24, 12);
    pSat = addParam("saturate", 0.3f);
    pBits = addParam("bits", 0.7f);
    pRate = addParam("rate", 0.7f);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    for (auto& d : dl) d.allocate(int(0.05f * sr));
    wow.setRate(0.6f, sr);
    flutLp.lp(12, sr);
    noiseLp.lp(3000, sr);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int mode = int(std::round(p(pMode)));
    if (p(pAge) != lastAge || mode != lastMode)
    {
      lastAge = p(pAge); lastMode = mode;
      const float lpF = mode == 2 ? 3500 : mode == 3 ? 3200 : logMap(1.f - lastAge, 2500, 18000);
      for (int c = 0; c < 2; ++c)
      {
        lp1[c].lp(lpF, sr); lp2[c].lp(lpF * 1.3f, sr);
        hp[c].lp(mode == 3 ? 350 : mode == 2 ? 250 : 30 + 120 * lastAge, sr);
        bp1[c].set(Biquad::Peak, mode == 2 ? 1200 : 1800, 1.0, mode >= 2 && mode <= 3 ? 6 : 0, sr);
        bp2[c].set(Biquad::HP, mode == 3 ? 400 : 20, 0.7, 0, sr);
      }
    }
    std::uniform_real_distribution<float> u(-1.f, 1.f);
    const float wowD = p(pWow) * (mode == 1 ? 0.6f : 1.f), flD = p(pFlutter), noise = p(pNoise), mix = p(pMix), sat = p(pSat);
    const float g = dbToGain(p(pLevel));
    const int bits = 4 + int(p(pBits) * 12.f);
    const float q = float(1 << (bits - 1));
    const float rateHold = mode == 4 ? std::max(1.f, (1.f - p(pRate)) * 16.f) : 1.f;
    wow.setRate(mode == 1 ? 0.55f : 0.35f + 0.5f * p(pWow), sr);
    for (int i = 0; i < n; ++i)
    {
      flutT = flutLp.processLP(u(rng) * 40.f);
      const float mod = (wow.next(0) * wowD * 0.0035f + flutT * flD * 0.0004f) * sr;
      float nz = noiseLp.processLP(u(rng)) * noise * 0.02f;
      if (mode == 1)
      {
        // vinyl crackle: sparse filtered clicks
        if (u(rng) > 0.9993f - noise * 0.0008f) crackle = u(rng) * 0.25f * noise;
        nz += crackle;
        crackle *= 0.6f;
      }
      if (++holdCnt >= rateHold) holdCnt = 0;
      for (int c = 0; c < nOut && c < 2; ++c)
      {
        const float x = nIn ? in[std::min(c, nIn - 1)][i] : 0.f;
        dl[c].push(x);
        float v = mode == 4 ? x : dl[c].readLinear(0.012f * sr + mod);
        v = lp2[c].processLP(lp1[c].processLP(v));
        v = hp[c].processHP(v);
        v = bp2[c].process(bp1[c].process(v));
        if (sat > 0.001f) v = fastTanh(v * (1.f + 6.f * sat)) / (1.f + 2.f * sat);
        if (mode == 4)
        {
          if (holdCnt == 0) hold[c] = std::round(v * q) / q;
          v = hold[c];
        }
        v += nz;
        out[c][i] = (v * mix + x * (1.f - mix)) * g;
      }
    }
  }
};

// ============================================================================ auto swell (slow gear)
class SwellBlock : public Block
{
public:
  int pSens, pAttack, pLevel, pMode;
  float sr = 48000;
  EnvFollower env;
  float gain = 0, lastEnv = 0;
  bool armed = true;
  SwellBlock(const json&)
  {
    pSens = addParam("sens", 0.5f);
    pAttack = addParam("attack", 0.4f);
    pLevel = addParam("level", 0, -24, 12);
    pMode = addParam("mode", 0, 0, 1); // 0 every note, 1 only after silence
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { sr = float(c.sr); env.setup(1, 40, sr); }
  void process(const float* const* in, float* const* out, int n) override
  {
    const float thr = dbToGain(-24.f - 36.f * p(pSens));
    const float rise = 1.f / ((0.04f + 3.f * p(pAttack) * p(pAttack)) * sr);
    const float g = dbToGain(p(pLevel));
    const bool afterSilence = p(pMode) > 0.5f;
    for (int i = 0; i < n; ++i)
    {
      const float x = nIn ? in[0][i] : 0.f;
      const float e = env.process(x);
      // new pick attack -> restart the swell
      const bool onset = e > thr && e > lastEnv * 1.5f + thr * 0.5f;
      if (onset && armed) { gain = 0; armed = false; }
      if (e < thr * 0.5f) armed = true;
      else if (!afterSilence && e > lastEnv * 2.f + thr) armed = true;
      lastEnv = lastEnv * 0.995f + e * 0.005f;
      gain = std::min(1.f, gain + rise);
      const float shaped = gain * gain * (3.f - 2.f * gain);
      for (int c = 0; c < nOut; ++c) out[c][i] = (nIn ? in[std::min(c, nIn - 1)][i] : 0.f) * shaped * g;
    }
  }
};

// ============================================================================ slicer / stutter
class SlicerBlock : public Block
{
public:
  int pTime, pPattern, pDepth, pSmooth, pMix, pMode, pLevel, pSteps;
  float sr = 48000;
  double phase = 0;
  TapTempo tap;
  float tapMs = -1, gs = 0;
  DelayLine buf[2];
  int sliceStart = 0;
  long long writePos = 0;
  static constexpr uint16_t patterns[16] = {0xFFFF, 0xAAAA, 0xEEEE, 0xDDDD, 0xB6B6, 0x9249, 0xF0F0, 0xCCCC, 0xA5A5, 0x8888, 0xEAEA, 0xB5AD, 0xFAFA, 0x9999, 0xDB6D, 0xC3C3};
  SlicerBlock(const json&)
  {
    pTime = addParam("time", 125, 30, 1000); // ms per step
    pPattern = addParam("pattern", 1, 0, 15);
    pDepth = addParam("depth", 1.f);
    pSmooth = addParam("smooth", 0.2f);
    pMix = addParam("mix", 1.f);
    pMode = addParam("mode", 0, 0, 1); // 0 gate, 1 stutter (repeats the first step of each beat)
    pLevel = addParam("level", 0, -24, 12);
    pSteps = addParam("steps", 16, 2, 16);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { sr = float(c.sr); for (auto& b : buf) b.allocate(int(2.f * sr)); }
  void onEvent(const BlockEvent& e) override { if (e.type == 1 && tap.tap()) tapMs = tap.ms; }
  void process(const float* const* in, float* const* out, int n) override
  {
    tap.advance(n, sr);
    const float ms = tapMs > 0 ? tapMs / 4.f : p(pTime);
    const double inc = 1.0 / (ms * 0.001 * sr);
    const uint16_t pat = patterns[int(std::round(p(pPattern))) & 15];
    const int steps = int(std::round(p(pSteps)));
    const float depth = p(pDepth), mix = p(pMix), g = dbToGain(p(pLevel));
    const float sm = 1.f - std::exp(-1.f / ((0.0005f + 0.01f * p(pSmooth)) * sr));
    const bool stutter = p(pMode) > 0.5f;
    for (int i = 0; i < n; ++i)
    {
      phase += inc;
      if (phase >= steps) phase -= steps;
      const int step = int(phase);
      const bool on = (pat >> (15 - (step % 16))) & 1;
      gs += ((on ? 1.f : 1.f - depth) - gs) * sm;
      const int stepLen = int(ms * 0.001f * sr);
      for (int c = 0; c < nOut; ++c)
      {
        const float x = nIn ? in[std::min(c, nIn - 1)][i] : 0.f;
        float v = x;
        if (stutter && c < 2)
        {
          buf[c].push(x);
          // repeat the first step of every 4 steps
          const int within = int((phase - std::floor(phase / 4.0) * 4.0) * stepLen);
          v = within >= stepLen ? buf[c].tap(std::min(buf[c].size() - 8, within - (within % stepLen) + 1)) : x;
        }
        out[c][i] = (v * gs * mix + x * (1.f - mix)) * g;
      }
    }
  }
  void status(json& j) override { j["step"] = int(phase); j["timeMs"] = tapMs > 0 ? tapMs : p(pTime) * 4; }
};
constexpr uint16_t SlicerBlock::patterns[16];

RegisterBlock r1("acoustic", [](const json& o, int, int) { return std::make_unique<AcousticBlock>(o); });
RegisterBlock r2("synth", [](const json& o, int, int) { return std::make_unique<SynthBlock>(o); });
RegisterBlock r3("freeze", [](const json& o, int, int) { return std::make_unique<FreezeBlock>(o); });
RegisterBlock r4("lofi", [](const json& o, int, int) { return std::make_unique<LofiBlock>(o); });
RegisterBlock r5("swell", [](const json& o, int, int) { return std::make_unique<SwellBlock>(o); });
RegisterBlock r6("slicer", [](const json& o, int, int) { return std::make_unique<SlicerBlock>(o); });
} // namespace
} // namespace tz
