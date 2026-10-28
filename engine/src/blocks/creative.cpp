// Creative / novelty effects:
//   vocal     – formant "singing" voice that follows your playing (talk box, sing, meow, fart, robot, choir)
//   lossy     – spectral codec damage (bit-starved streaming audio, packet loss, band limiting)
//   microloop – a short-term memory sampler: captures the last moments of your playing and loops / stretches /
//               reverses them (MOOD / Blooper / Onward-style)
#include <random>

#include "common.h"

namespace tz
{
namespace
{
// ---------------------------------------------------------------------------- formant tables
// F1, F2, F3 (Hz) and relative gains of an average adult voice
struct Vowel { float f[3]; float g[3]; };
static const Vowel kVowels[] = {
  {{730, 1090, 2440}, {1.0f, 0.50f, 0.25f}},  // 0 a
  {{530, 1840, 2480}, {1.0f, 0.45f, 0.30f}},  // 1 e
  {{300, 2290, 3010}, {1.0f, 0.35f, 0.28f}},  // 2 i
  {{570, 840, 2410}, {1.0f, 0.60f, 0.15f}},   // 3 o
  {{320, 800, 2240}, {1.0f, 0.40f, 0.10f}},   // 4 u
  {{260, 1200, 2300}, {0.8f, 0.12f, 0.06f}},  // 5 m (nasal hum)
  {{450, 1300, 2500}, {0.7f, 0.35f, 0.25f}},  // 6 neutral schwa
  {{200, 600, 1800}, {1.0f, 0.25f, 0.05f}},   // 7 "brr" (low, closed lips)
};
// a syllable = vowel index + duration in ms (0 = hold until the note ends); up to 4 per syllable sequence
struct Syl { int v; float ms; int cons; }; // cons: 0 none, 1 noise burst (k/t/s), 2 nasal onset (m/n)
struct Phrase { int n; Syl s[4]; };
static const Phrase kPhrases[] = {
  {1, {{0, 0, 0}}},                                        // 0 "aaa"
  {2, {{5, 70, 2}, {2, 0, 0}}},                            // 1 "mi"
  {2, {{4, 40, 1}, {4, 0, 0}}},                            // 2 "ku"
  {3, {{5, 60, 2}, {2, 90, 0}, {0, 0, 0}}},                // 3 "mia"
  {4, {{5, 60, 2}, {2, 80, 0}, {0, 170, 0}, {4, 0, 0}}},   // 4 "meow"
  {2, {{6, 40, 1}, {3, 0, 0}}},                            // 5 "to"
  {2, {{5, 50, 2}, {3, 0, 0}}},                            // 6 "no"
  {3, {{4, 60, 0}, {0, 120, 0}, {2, 0, 0}}},               // 7 "wai"
};
// note-by-note lyric rotations (each new note sings the next syllable)
static const int kLyrics[][8] = {
  {0, 0, 0, 0, 0, 0, 0, 0},     // 0 single vowel (vowel knob)
  {1, 2, 1, 2, 1, 2, 1, 2},     // 1 "mi-ku mi-ku"
  {0, 1 + 100, 2 + 100, 3 + 100, 4 + 100, 0, 0, 0}, // 2 a-e-i-o-u (plain vowels, +100 = vowel index)
  {4, 4, 4, 4, 4, 4, 4, 4},     // 3 meow
  {5, 6, 7, 1, 5, 6, 7, 2},     // 4 la-la gibberish
};

// polyBLEP saw for the singing oscillator
inline float blep(float t, float dt)
{
  if (t < dt) { t /= dt; return t + t - t * t - 1.f; }
  if (t > 1.f - dt) { t = (t - 1.f) / dt; return t * t + t + t + 1.f; }
  return 0.f;
}

// ============================================================================ vocal
// mode: 0 talk box (formants on your signal), 1 sing (pitch-tracked voice), 2 meow, 3 fart, 4 robot, 5 choir
class VocalBlock : public Block
{
public:
  int pMode, pVowel, pLyric, pShift, pOct, pGlide, pVib, pSens, pAttack, pRelease, pTone, pMix, pDry, pLevel, pDrive, pBreath;
  float sr = 48000;
  SVF form[3], form2[3];
  float curF[3] = {700, 1100, 2400}, curG[3] = {1, 0.5f, 0.25f};
  EnvFollower env, envSlow;
  OnePole hp, toneLp, decLp;
  bool gate = false;
  float vca = 0;
  // pitch tracking (decimated YIN)
  std::vector<float> dRing, yinD;
  int dPos = 0, dCount = 0, decim = 6, sinceYin = 0;
  float noteHz = 110.f, oscHz = 110.f;
  float ph = 0, ph2 = 0.33f, ph3 = 0.66f;
  LFO vib, flut;
  std::mt19937 rng{777};
  std::uniform_real_distribution<float> uni{-1.f, 1.f};
  // syllable sequencing
  int lyricPos = 0, phraseIdx = 0, sylIdx = 0;
  float sylT = 0, noteT = 0;
  float consEnv = 0;
  int consType = 0;
  VocalBlock(const json& o)
  {
    pMode = addParam("mode", o.value("mode", 1.f), 0, 5);
    pVowel = addParam("vowel", o.value("vowel", 0.f), 0, 7);
    pLyric = addParam("lyric", o.value("lyric", 0.f), 0, 4);
    pShift = addParam("shift", 0.5f);      // formant shift: 0 = deep, 0.5 = adult, 1 = small / cartoon
    pOct = addParam("octave", o.value("octave", 0.f), -2, 2);
    pGlide = addParam("glide", 0.2f);
    pVib = addParam("vibrato", 0.3f);
    pSens = addParam("sens", 0.5f);
    pAttack = addParam("attack", 0.15f);
    pRelease = addParam("release", 0.4f);
    pTone = addParam("tone", 0.6f);
    pMix = addParam("mix", 1.f);
    pDry = addParam("dry", 0.f);
    pLevel = addParam("level", 0, -24, 12);
    pDrive = addParam("drive", 0.3f);
    pBreath = addParam("breath", 0.15f);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    env.setup(2, 50, sr);
    envSlow.setup(15, 250, sr);
    hp.lp(80, sr); // processHP = x - lowpass
    decim = std::max(1, int(std::round(sr / 8000.f)));
    decLp.lp(1100, sr);
    dRing.assign(1024, 0.f);
    yinD.assign(160, 0.f);
    vib.setRate(5.3f, sr);
    flut.setRate(27.f, sr);
  }
  float detect()
  {
    const float dsr = sr / decim;
    const int W = 384, tMin = int(dsr / 1000.f), tMax = std::min(150, int(dsr / 60.f));
    float buf[1024];
    for (int i = 0; i < 1024; ++i) buf[i] = dRing[(dPos + i) & 1023];
    const float* x = buf + 1024 - W - tMax - 1;
    double run = 0;
    yinD[0] = 1;
    int best = -1;
    for (int t = 1; t <= tMax; ++t)
    {
      double d = 0;
      for (int i = 0; i < W; ++i) { const float v = x[i] - x[i + t]; d += v * v; }
      run += d;
      yinD[t] = run > 0 ? float(d * t / run) : 1.f;
      if (best < 0 && t > tMin + 1 && yinD[t - 1] < 0.2f && yinD[t - 1] <= yinD[t] && yinD[t - 1] <= yinD[t - 2]) best = t - 1;
    }
    if (best < 1) return -1;
    const float a = yinD[best - 1], b = yinD[best], c = yinD[best + 1];
    const float off = (a - 2 * b + c) != 0 ? 0.5f * (a - c) / (a - 2 * b + c) : 0.f;
    return dsr / (best + off);
  }
  void startNote(int mode)
  {
    noteT = 0;
    sylT = 0;
    sylIdx = 0;
    const int lyric = int(std::round(p(pLyric)));
    if (mode == 2) phraseIdx = 4;            // meow
    else if (mode == 3) phraseIdx = 1000 + 7; // fart: plain "brr"
    else
    {
      const int v = kLyrics[lyric][lyricPos & 7];
      lyricPos++;
      phraseIdx = lyric == 0 ? 1000 + int(std::round(p(pVowel))) : v >= 100 ? 1000 + (v - 100) : v;
    }
    const Syl* s = currentSyl();
    consType = s ? s->cons : 0;
    consEnv = consType ? 1.f : 0.f;
  }
  const Syl* currentSyl() const
  {
    if (phraseIdx >= 1000) return nullptr;
    const Phrase& ph = kPhrases[phraseIdx];
    return &ph.s[std::min(sylIdx, ph.n - 1)];
  }
  int currentVowel() const
  {
    if (phraseIdx >= 1000) return phraseIdx - 1000;
    const Syl* s = currentSyl();
    return s ? s->v : 0;
  }
  void advanceSyllable(float dtMs)
  {
    sylT += dtMs;
    noteT += dtMs;
    if (phraseIdx >= 1000) return;
    const Phrase& ph = kPhrases[phraseIdx];
    const Syl& s = ph.s[std::min(sylIdx, ph.n - 1)];
    if (s.ms > 0 && sylT >= s.ms && sylIdx < ph.n - 1)
    {
      sylIdx++;
      sylT = 0;
      const Syl& n2 = ph.s[sylIdx];
      if (n2.cons) { consType = n2.cons; consEnv = 1.f; }
    }
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int mode = int(std::round(p(pMode)));
    const float shift = std::pow(2.f, (p(pShift) - 0.5f) * 1.2f) * (mode == 3 ? 0.55f : mode == 2 ? 1.25f : 1.f);
    const float octMul = std::pow(2.f, std::round(p(pOct))) * (mode == 3 ? 0.5f : 1.f);
    const float glideK = 1.f - std::exp(-1.f / ((0.002f + 0.25f * p(pGlide) * p(pGlide)) * sr));
    const float atk = 1.f - std::exp(-1.f / ((0.002f + 0.4f * p(pAttack) * p(pAttack)) * sr));
    const float rel = 1.f - std::exp(-1.f / ((0.02f + 1.2f * p(pRelease) * p(pRelease)) * sr));
    const float vibAmt = p(pVib) * 0.012f, sens = p(pSens);
    const float mix = p(pMix), dry = p(pDry), g = dbToGain(p(pLevel)), drive = 1.f + 30.f * p(pDrive) * p(pDrive), breath = p(pBreath);
    toneLp.lp(logMap(p(pTone), 1500, 16000), sr);
    const float thr = 0.003f + 0.02f * (1.f - sens);
    // formant targets for this block
    const int vi = currentVowel();
    const Vowel& V = kVowels[std::max(0, std::min(7, vi))];
    const float fK = 1.f - std::exp(-1.f / (0.025f * sr / std::max(1, n))); // per-block smoothing (~25 ms)
    for (int k = 0; k < 3; ++k)
    {
      float tf = V.f[k] * shift;
      if (mode == 4) tf *= 1.f; // robot keeps the vowel but flattens the pitch (below)
      curF[k] += (tf - curF[k]) * fK;
      curG[k] += (V.g[k] - curG[k]) * fK;
      const float q = mode == 4 ? 14.f : 6.f + 4.f * k;
      form[k].set(curF[k], q, sr);
      form2[k].set(curF[k] * 1.03f, q, sr);
    }
    const float dtMs = 1000.f * n / sr;
    for (int i = 0; i < n; ++i)
    {
      const float x = nIn ? (nIn > 1 ? 0.5f * (in[0][i] + in[1][i]) : in[0][i]) : 0.f;
      const float e = env.process(x), es = envSlow.process(x);
      if (!gate && e > thr * 2.f) { gate = true; startNote(mode); }
      else if (gate && es < thr * 0.7f) gate = false;
      vca += ((gate ? 1.f : 0.f) - vca) * (gate ? atk : rel);
      // pitch tracking
      const float d = decLp.processLP(x);
      if (++dCount >= decim)
      {
        dCount = 0;
        dRing[dPos] = d;
        dPos = (dPos + 1) & 1023;
        if (++sinceYin >= 192)
        {
          sinceYin = 0;
          const float f = gate ? detect() : -1.f;
          if (f > 50.f && f < 1400.f) noteHz = f;
        }
      }
      // pitch contour per mode
      float target = noteHz * octMul;
      const float tSec = noteT * 0.001f;
      if (mode == 2) target *= std::pow(2.f, (tSec < 0.12f ? tSec / 0.12f * 0.25f : 0.25f - std::min(0.6f, (tSec - 0.12f) * 1.4f)) ); // meow: up then down
      if (mode == 3) target *= std::pow(2.f, -std::min(0.5f, tSec * 0.7f));                                                     // fart: sagging
      if (mode == 4) target = 110.f * octMul;                                                                                     // robot: monotone
      oscHz += (target - oscHz) * glideK;
      float hz = oscHz * (1.f + vibAmt * vib.next(0) * std::min(1.f, tSec * 2.f));
      if (mode == 3) hz *= 1.f + 0.25f * flut.next(5) + 0.06f * uni(rng); // the flappy part
      // source
      float src;
      if (mode == 0)
        src = fastTanh(hp.processHP(x) * drive) * 0.5f; // talk box: your (driven) signal
      else
      {
        const float dt = std::min(0.45f, hz / sr);
        ph += dt; if (ph >= 1.f) ph -= 1.f;
        float s = 2.f * ph - 1.f - blep(ph, dt);
        if (mode == 5) // choir: 3 detuned voices
        {
          const float d2 = dt * 1.006f, d3 = dt * 0.994f;
          ph2 += d2; if (ph2 >= 1.f) ph2 -= 1.f;
          ph3 += d3; if (ph3 >= 1.f) ph3 -= 1.f;
          s = (s + (2.f * ph2 - 1.f - blep(ph2, d2)) + (2.f * ph3 - 1.f - blep(ph3, d3))) * 0.45f;
        }
        if (mode == 3) s = fastTanh(s * 3.f + 0.4f * uni(rng)); // raspy
        src = s * 0.35f + uni(rng) * 0.04f * breath;
      }
      // consonants: a short noise burst (k/t/s) or a nasal hum onset (m/n)
      float cons = 0.f;
      if (consEnv > 0.f)
      {
        cons = consType == 1 ? uni(rng) * consEnv * 0.5f : 0.f;
        consEnv = std::max(0.f, consEnv - 1.f / (0.035f * sr));
      }
      // formant filter bank
      float y = 0.f;
      for (int k = 0; k < 3; ++k)
      {
        form[k].process(src + cons * (k == 2 ? 1.f : 0.3f));
        y += form[k].bp * curG[k];
        if (mode == 5) { form2[k].process(src); y += form2[k].bp * curG[k] * 0.6f; }
      }
      y = toneLp.processLP(y) * (mode == 0 ? 2.5f : 3.0f);
      const float wet = y * vca * es * (mode == 3 ? 0.45f : 0.8f); // follow the playing dynamics
      const float o = (wet * mix + x * dry) * g;
      for (int c = 0; c < nOut; ++c) out[c][i] = o;
    }
    if (gate) advanceSyllable(dtMs);
  }
  void status(json& j) override
  {
    j["vowel"] = currentVowel();
    j["gate"] = gate;
    j["hz"] = int(oscHz);
  }
};

// ============================================================================ lossy (spectral codec damage)
// mode 0 standard, 1 inverse (only what the codec throws away), 2 phase jitter (warbly streaming)
class LossyBlock : public Block
{
public:
  static constexpr int N = 1024, H = 256;
  int pLoss, pBand, pPackets, pMode, pMix, pLevel, pFreeze, pGate, pVerb;
  float sr = 48000;
  FFT fft;
  std::vector<float> win, inRing, outAcc, mag, lastMag;
  std::vector<std::complex<float>> spec, lastSpec;
  int inPos = 0, hopCount = 0, outPos = 0;
  std::mt19937 rng{4242};
  std::uniform_real_distribution<float> u01{0.f, 1.f};
  int dropRun = 0;
  std::vector<float> dryDelay;
  int dPos = 0;
  LossyBlock(const json& o)
  {
    pLoss = addParam("loss", 0.5f);       // how many weak bins get thrown away
    pBand = addParam("filter", 0.7f);     // bandwidth limit
    pPackets = addParam("packets", 0.f);  // dropped / repeated frames
    pMode = addParam("mode", o.value("mode", 0.f), 0, 2);
    pMix = addParam("mix", 1.f);
    pLevel = addParam("level", 0, -24, 12);
    pFreeze = addParam("freeze", 0, 0, 1);
    pGate = addParam("gate", 0.f);
    pVerb = addParam("verb", 0.f);        // smeared spectral "reverb" (frame averaging)
    finalizeParams();
  }
  bool hasTrails() const override { return true; }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    fft.init(N);
    win.resize(N);
    for (int i = 0; i < N; ++i) win[i] = std::sqrt(0.5f - 0.5f * std::cos(float(kTwoPi) * i / N));
    inRing.assign(N, 0.f);
    outAcc.assign(N * 2, 0.f);
    mag.assign(N / 2 + 1, 0.f);
    lastMag.assign(N / 2 + 1, 0.f);
    spec.assign(N, 0);
    lastSpec.assign(N, 0);
    dryDelay.assign(N, 0.f);
  }
  void frame()
  {
    for (int i = 0; i < N; ++i) spec[i] = inRing[(inPos + i) % N] * win[i];
    fft.transform(spec.data(), false);
    const int mode = int(std::round(p(pMode)));
    const float loss = p(pLoss), band = p(pBand), packets = p(pPackets), gate = p(pGate), verb = p(pVerb);
    const bool freeze = p(pFreeze) > 0.5f;
    const int K = N / 2;
    if (freeze) { spec = lastSpec; }
    else
    {
      // packet loss: drop or repeat whole frames in short bursts
      if (dropRun > 0) { dropRun--; for (int k = 0; k <= K; ++k) spec[k] = mode == 2 ? lastSpec[k] : spec[k] * 0.f; }
      else if (u01(rng) < packets * packets * 0.35f) dropRun = 1 + int(u01(rng) * 6.f * packets);
      float maxM = 1e-9f;
      for (int k = 1; k <= K; ++k) { mag[k] = std::abs(spec[k]); maxM = std::max(maxM, mag[k]); }
      const int cut = std::max(4, int(K * (0.03f + 0.97f * band * band)));
      const float th = maxM * (0.0005f + 0.25f * loss * loss * loss);
      for (int k = 0; k <= K; ++k)
      {
        const bool keep = k <= cut && mag[k] >= th && mag[k] > maxM * gate * 0.05f;
        std::complex<float> v = spec[k];
        if (mode == 1) v = keep ? std::complex<float>(0, 0) : v; // inverse: the residue
        else if (!keep) v = 0;
        else if (loss > 0.4f) // coarse magnitude quantisation ("bit starved")
        {
          const float q = 1.f + 14.f * (1.f - (loss - 0.4f) / 0.6f);
          const float m = std::abs(v), mq = std::round(m / maxM * q) / q * maxM;
          v = m > 0 ? v * (mq / m) : v;
        }
        if (mode == 2) v *= std::polar(1.f, (u01(rng) - 0.5f) * 3.f * loss); // warble
        if (verb > 0.f) v = v * (1.f - verb) + lastSpec[k] * verb * 0.98f;
        spec[k] = v;
      }
    }
    for (int k = 0; k <= K; ++k) lastSpec[k] = spec[k];
    for (int k = 1; k < K; ++k) spec[N - k] = std::conj(spec[k]);
    fft.transform(spec.data(), true);
    for (int i = 0; i < N; ++i) outAcc[(outPos + i) % (N * 2)] += spec[i].real() * win[i] * 0.5f; // sqrt-Hann in+out at 75 % overlap sums to 2
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const float mix = p(pMix), g = dbToGain(p(pLevel));
    for (int i = 0; i < n; ++i)
    {
      const float x = nIn ? (nIn > 1 ? 0.5f * (in[0][i] + in[1][i]) : in[0][i]) : 0.f;
      inRing[inPos] = x;
      inPos = (inPos + 1) % N;
      if (++hopCount >= H) { hopCount = 0; frame(); }
      const float w = outAcc[outPos];
      outAcc[outPos] = 0.f;
      outPos = (outPos + 1) % (N * 2);
      // dry signal delayed by the frame length so the blend stays phase coherent
      const float dd = dryDelay[dPos];
      dryDelay[dPos] = x;
      dPos = (dPos + 1) % N;
      const float o = (w * mix + dd * (1.f - mix)) * g;
      for (int c = 0; c < nOut; ++c) out[c][i] = o;
    }
  }
};

// ============================================================================ micro looper
// Records continuously. Capture (event 1, or automatically) loops the last `length` seconds; the loop plays with
// `speed` (negative = reverse), `stretch` (repeat each grain) and blends with the input.
// mode: 0 latch (event 1 = capture / release), 1 momentary (event 1 down, event 2 up), 2 auto (every new note),
//       3 stutter (re-captures every `length`)
class MicroLoopBlock : public Block
{
public:
  int pLength, pSpeed, pMix, pLevel, pMode, pFade, pStretch, pTone, pDecay, pDry;
  float sr = 48000;
  std::vector<float> buf[2];
  int wPos = 0, bufLen = 0;
  bool looping = false, wantCap = false, wantRel = false;
  double rPos = 0;
  int loopStart = 0, loopLen = 1;
  float amp = 0, loopGain = 1;
  EnvFollower env;
  float lastE = 0;
  int sinceCap = 0, autoHold = 0;
  OnePole tone[2];
  MicroLoopBlock(const json& o)
  {
    pLength = addParam("length", 0.6f, 0.03f, 4.f); // seconds
    pSpeed = addParam("speed", 1.f, -2.f, 2.f);
    pMix = addParam("mix", 0.7f);
    pLevel = addParam("level", 0, -24, 12);
    pMode = addParam("mode", o.value("mode", 0.f), 0, 3);
    pFade = addParam("fade", 0.2f);
    pStretch = addParam("stretch", 0.f);   // 0..1: grain repeats (time stretch without pitch change)
    pTone = addParam("tone", 1.f);
    pDecay = addParam("decay", 1.f);       // 1 = loop forever, lower = loop fades out
    pDry = addParam("dry", 1.f);
    finalizeParams();
  }
  bool hasTrails() const override { return true; }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    bufLen = int(sr * 6);
    buf[0].assign(bufLen, 0.f);
    buf[1].assign(bufLen, 0.f);
    env.setup(1, 150, sr);
  }
  void onEvent(const BlockEvent& e) override
  {
    const int mode = int(std::round(p(pMode)));
    if (e.type == 1) { if (mode == 0 && looping) wantRel = true; else wantCap = true; }
    else if (e.type == 2 && mode == 1) wantRel = true;
  }
  void capture()
  {
    loopLen = std::max(64, int(p(pLength) * sr));
    loopStart = (wPos - loopLen + bufLen) % bufLen;
    const float sp = p(pSpeed);
    rPos = sp >= 0 ? 0.0 : double(loopLen - 1);
    looping = true;
    loopGain = 1.f;
    sinceCap = 0;
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int mode = int(std::round(p(pMode)));
    const float mix = p(pMix), g = dbToGain(p(pLevel)), dryG = p(pDry), fadeT = 0.002f + 0.05f * p(pFade);
    const float sp = std::abs(p(pSpeed)) < 0.05f ? 0.05f : p(pSpeed);
    const float stretch = p(pStretch);
    const float decayMul = p(pDecay) >= 0.999f ? 1.f : std::exp(-1.f / ((0.3f + 8.f * p(pDecay)) * sr));
    for (int c = 0; c < 2; ++c) tone[c].lp(logMap(p(pTone), 700, 20000), sr);
    const float ampStep = 1.f / (0.01f * sr);
    for (int i = 0; i < n; ++i)
    {
      const float xl = nIn ? in[0][i] : 0.f, xr = nIn > 1 ? in[1][i] : xl;
      // recording never stops while not looping (so a capture always has fresh audio)
      if (!looping) { buf[0][wPos] = xl; buf[1][wPos] = xr; wPos = (wPos + 1) % bufLen; }
      if (mode == 2)
      {
        const float e = env.process(xl);
        if (e > 0.02f && e > lastE * 1.8f && autoHold <= 0) autoHold = int(p(pLength) * sr * 0.9f) + 1;
        lastE = lastE * 0.999f + e * 0.001f;
        if (autoHold > 0 && --autoHold == 0) wantCap = true;
      }
      if (mode == 3 && looping && ++sinceCap > loopLen * 2) { looping = false; wantCap = true; }
      if (wantCap) { wantCap = false; capture(); }
      if (wantRel) { wantRel = false; looping = false; }
      amp = looping ? std::min(1.f, amp + ampStep) : std::max(0.f, amp - ampStep);
      float wl = 0, wr = 0;
      if (amp > 0.f)
      {
        // read with grain repetition (stretch) and boundary crossfade
        const double grain = 0.06 * sr;
        double rp = rPos;
        if (stretch > 0.01f) rp = std::floor(rPos / grain) * grain + std::fmod(rPos, grain) ; // grains keep pitch
        const int i0 = int(rp);
        const float fr = float(rp - i0);
        const int a = (loopStart + ((i0 % loopLen) + loopLen) % loopLen) % bufLen, b = (a + 1) % bufLen;
        wl = buf[0][a] + (buf[0][b] - buf[0][a]) * fr;
        wr = buf[1][a] + (buf[1][b] - buf[1][a]) * fr;
        const float edge = float(std::min<double>(rp, loopLen - rp)) / (fadeT * sr);
        const float w = std::min(1.f, std::max(0.f, edge)) * amp * loopGain;
        wl = tone[0].processLP(wl * w);
        wr = tone[1].processLP(wr * w);
        rPos += sp / (1.0 + 3.0 * stretch);
        if (rPos >= loopLen) rPos -= loopLen;
        if (rPos < 0) rPos += loopLen;
        loopGain *= decayMul;
        if (looping && loopGain < 0.001f) looping = false;
      }
      const float ol = (xl * dryG + wl * mix * 1.4f) * g, orr = (xr * dryG + wr * mix * 1.4f) * g;
      out[0][i] = ol;
      if (nOut > 1) out[1][i] = orr;
    }
  }
  void status(json& j) override
  {
    j["looping"] = looping;
    j["pos"] = loopLen > 0 ? float(rPos / loopLen) : 0.f;
  }
};

RegisterBlock r1("vocal", [](const json& o, int, int) { return std::make_unique<VocalBlock>(o); });
RegisterBlock r2("lossy", [](const json& o, int, int) { return std::make_unique<LossyBlock>(o); });
RegisterBlock r3("microloop", [](const json& o, int, int) { return std::make_unique<MicroLoopBlock>(o); });
} // namespace
} // namespace tz
