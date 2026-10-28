// Delays: digital, analog (BBD), tape, lo-fi, modulated, reverse, shimmer, ping-pong, dual, warp; plus Deco-style
// tape saturation + doubletracker.
#include "common.h"

namespace tz
{
namespace
{
enum DMode { DStd, DAnalog, DTape, DLofi, DMod, DReverse, DShimmer, DPingPong, DDual, DWarp, DVerb, DCount };

// Simple two-tap delay-line pitch shifter used inside feedback paths (artifacts are masked by repeats).
struct FbShifter
{
  DelayLine dl;
  float ph = 0, win = 2048;
  void prepare(float sr) { dl.allocate(int(0.1f * sr)); win = 0.05f * sr; }
  inline float process(float x, float ratio)
  {
    dl.push(x);
    ph += (1.f - ratio) / win;
    if (ph >= 1) ph -= 1;
    if (ph < 0) ph += 1;
    const float p2 = ph + 0.5f >= 1 ? ph - 0.5f : ph + 0.5f;
    const float a = dl.read(2 + ph * win), b = dl.read(2 + p2 * win);
    const float wa = std::sin(float(kPi) * ph), wb = std::sin(float(kPi) * p2);
    return a * wa * wa + b * wb * wb;
  }
};

struct SmallDiffuser
{
  DelayLine d[4];
  float g = 0.6f;
  int len[4] = {0, 0, 0, 0};
  void prepare(float sr)
  {
    const float ms[4] = {4.7f, 7.3f, 11.1f, 17.9f};
    for (int i = 0; i < 4; ++i) { len[i] = int(ms[i] * 0.001f * sr); d[i].allocate(len[i] + 4); }
  }
  inline float process(float x)
  {
    for (int i = 0; i < 4; ++i)
    {
      const float delayed = d[i].tap(len[i]);
      const float v = x + g * delayed;
      d[i].push(v);
      x = delayed - g * v;
    }
    return x;
  }
};

class DelayBlock : public Block
{
public:
  int pTime, pFb, pMix, pTone, pMode, pModRate, pModDepth, pAge, pSat, pSub, pLevel, pHeads, pSpread, pLowCut;
  float maxMs;
  DelayLine dl[2];
  float sr = 48000;
  Smoother sTime;
  OnePole lpf[2], hpf[2], ageLp[2];
  Biquad bbdLp[2];
  LFO wow, flutter, mod;
  FbShifter shift[2];
  SmallDiffuser diff[2];
  TapTempo tap;
  std::atomic<float> curMs{0};
  float fbs[2] = {0, 0};
  float revCount = 0;
  bool hold = false;
  float lastTone = -1, lastAge = -1;
  uint32_t rng = 12345;
  int fixedMode = -1;
  DelayBlock(const json& o)
  {
    maxMs = o.value("maxMs", 3000.f);
    pTime = addParam("time", o.value("defaultMs", 400.f), 10, maxMs);
    pFb = addParam("feedback", 0.35f, 0, 1.1f);
    pMix = addParam("mix", 0.35f);
    pTone = addParam("tone", 0.6f);
    pMode = addParam("mode", o.value("mode", 0.f), 0, DCount - 1);
    pModRate = addParam("modrate", 0.3f);
    pModDepth = addParam("moddepth", 0.f);
    pAge = addParam("age", 0.3f);
    pSat = addParam("sat", 0.3f);
    pSub = addParam("subdiv", 0, 0, 4); // 0 quarter, 1 dotted 8th, 2 8th, 3 triplet, 4 16th
    pLevel = addParam("level", 0.5f);
    pHeads = addParam("heads", 4, 1, 7); // tape head bitmask (1: d/3, 2: 2d/3, 4: d)
    pSpread = addParam("spread", 0.5f);
    pLowCut = addParam("lowcut", 0.f);
    fixedMode = o.value("fixedMode", -1);
    finalizeParams();
  }
  bool hasTrails() const override { return true; }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    for (auto& d : dl) d.allocate(int((maxMs * 1.05f + 200) * 0.001f * sr));
    sTime.setTime(220, sr);
    for (int i = 0; i < 2; ++i)
    {
      hpf[i].lp(60, sr);
      shift[i].prepare(sr);
      diff[i].prepare(sr);
    }
    wow.setRate(0.55f, sr);
    flutter.setRate(6.3f, sr);
    lastTone = -1;
  }
  void onEvent(const BlockEvent& e) override
  {
    if (e.type == 1 && tap.tap())
    {
      static const float sub[5] = {1.f, 0.75f, 0.5f, 1.f / 3.f, 0.25f};
      const int s = int(std::round(p(pSub)));
      vals[pTime].store(clampf(tap.ms * sub[std::max(0, std::min(4, s))], 10, maxMs));
    }
    else if (e.type == 2)
      hold = e.value > 0.5f;
  }
  inline float noise()
  {
    rng = rng * 1664525u + 1013904223u;
    return (float(rng >> 9) / float(1 << 23)) * 2.f - 1.f;
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    tap.advance(n, sr);
    const int mode = fixedMode >= 0 ? fixedMode : int(std::round(p(pMode)));
    const float tone = p(pTone), age = p(pAge);
    if (tone != lastTone || age != lastAge)
    {
      lastTone = tone; lastAge = age;
      float fc = logMap(tone, 1200, 16000);
      if (mode == DAnalog) fc = logMap(tone, 900, 5500);
      if (mode == DTape) fc = logMap(tone * (1.f - 0.6f * age), 1500, 11000);
      if (mode == DLofi) fc = logMap(tone, 1500, 6000);
      for (int i = 0; i < 2; ++i)
      {
        lpf[i].lp(fc, sr);
        bbdLp[i].set(Biquad::LP, fc * 1.2f, 0.9, 0, sr);
        ageLp[i].lp(logMap(1.f - age, 2500, 14000), sr);
        hpf[i].lp(mode == DTape ? 80.f + 120.f * age : 40.f + 300.f * p(pLowCut), sr);
      }
    }
    mod.setRate(logMap(p(pModRate), 0.1f, 6.f), sr);
    const float modDepth = p(pModDepth) + (mode == DMod ? 0.35f : 0.f);
    float fb = p(pFb);
    if (mode == DStd || mode == DLofi || mode == DMod || mode == DReverse || mode == DPingPong || mode == DDual) fb = std::min(fb, 0.98f);
    if (hold) fb = 1.0f;
    const float mix = p(pMix);
    const float dryLevel = 1.f;
    const float lvl = dbToGain((p(pLevel) - 0.5f) * 12.f);
    const float sat = 1.f + 3.f * p(pSat);
    const int heads = int(std::round(p(pHeads)));
    const float inG = hold ? 0.f : 1.f;
    const float spread = p(pSpread);
    for (int i = 0; i < n; ++i)
    {
      const float tMs = sTime.next(p(pTime));
      float d = tMs * 0.001f * sr;
      float wobble = 0;
      if (mode == DTape)
      {
        wobble = (wow.next(0) * 0.004f * (0.3f + age) + flutter.next(0) * 0.0009f) * d * 0.5f + noise() * 0.02f * age;
      }
      const float m = mod.next(0) * modDepth * 0.003f * sr;
      d = std::max(2.f, std::min(d + wobble + m, float(dl[0].size() - 8)));
      curMs.store(tMs, std::memory_order_relaxed);
      const float xl = in[0][i];
      const float xr = nIn > 1 ? in[1][i] : xl;
      float wl = 0, wr = 0;
      if (mode == DReverse)
      {
        const float L = d;
        revCount += 1.f;
        if (revCount >= L) revCount -= L;
        const float c2 = revCount + L * 0.5f >= L ? revCount - L * 0.5f : revCount + L * 0.5f;
        const float wa = std::sin(float(kPi) * revCount / L), wb = std::sin(float(kPi) * c2 / L);
        wl = dl[0].read(2.f * revCount + 2.f) * wa * wa + dl[0].read(2.f * c2 + 2.f) * wb * wb;
        wr = wl;
      }
      else if (mode == DTape && heads != 4 && heads > 0)
      {
        float acc = 0;
        int cnt = 0;
        for (int h = 0; h < 3; ++h)
          if (heads & (1 << h)) { acc += dl[0].read(std::max(2.f, d * float(h + 1) / 3.f)); ++cnt; }
        wl = wr = acc / std::sqrt(float(std::max(1, cnt)));
      }
      else if (mode == DDual)
      {
        wl = dl[0].read(d);
        wr = dl[1].read(d * (0.5f + 0.25f * spread));
      }
      else if (mode == DPingPong)
      {
        wl = dl[0].read(d);
        wr = dl[1].read(d);
      }
      else
      {
        wl = dl[0].read(d);
        wr = nIn > 1 ? dl[1].read(d) : wl;
        if (nOut > 1 && spread > 0.01f && nIn > 1) wr = dl[1].read(d * (1.f + 0.03f * spread));
      }
      // repeat coloration
      auto color = [&](float w, int c) {
        w = hpf[c].processHP(w);
        switch (mode)
        {
          case DAnalog: w = bbdLp[c].process(w); w = std::tanh(w * 1.3f) / 1.3f; break;
          case DTape: w = ageLp[c].processLP(lpf[c].processLP(w)); w = std::tanh(w * sat) / sat; break;
          case DLofi: { w = lpf[c].processLP(w); const float q = 256.f; w = std::round(w * q) / q; break; }
          case DShimmer: w = lpf[c].processLP(shift[c].process(w, 2.0f)) * 0.8f; break;
          case DWarp: w = diff[c].process(lpf[c].processLP(w)); break;
          case DVerb: w = diff[c].process(lpf[c].processLP(w)); break;
          default: w = lpf[c].processLP(w); break;
        }
        return w;
      };
      const float cl = color(wl, 0);
      const float cr = (mode == DPingPong || mode == DDual || nIn > 1) ? color(wr, 1) : cl;
      if (mode == DPingPong)
      {
        dl[0].push(flushDenorm(0.5f * (xl + xr) * inG + cr * fb));
        dl[1].push(flushDenorm(cl * fb));
      }
      else
      {
        const float fbMul = mode == DWarp ? std::min(1.05f, fb * 1.08f) : fb;
        dl[0].push(flushDenorm(xl * inG + cl * fbMul));
        dl[1].push(flushDenorm((nIn > 1 ? xr : xl) * inG + cr * fbMul));
      }
      const float outWetL = cl;
      const float outWetR = (mode == DPingPong || mode == DDual || nIn > 1) ? cr : cl;
      if (nOut == 1)
        out[0][i] = (xl * dryLevel + 0.5f * (outWetL + outWetR) * mix * 1.4f) * lvl;
      else
      {
        out[0][i] = (xl * dryLevel + outWetL * mix * 1.4f) * lvl;
        out[1][i] = (xr * dryLevel + outWetR * mix * 1.4f) * lvl;
      }
    }
  }
  void status(json& j) override { j["timeMs"] = curMs.load(); j["hold"] = hold; }
  void reset() override { for (auto& d : dl) d.clear(); }
};

// ------------------------------------------------------------ Deco-style tape saturation + doubletracker
class DecoBlock : public Block
{
public:
  int pSat, pVolume, pTone, pLag, pBlend, pWobble, pType, pSatOn, pDtOn;
  DelayLine dl[2];
  LFO wob, wob2;
  OnePole emph[2], lp[2], hp[2];
  Smoother sLag;
  float sr = 48000;
  DecoBlock(const json&)
  {
    pSat = addParam("saturation", 0.4f);
    pVolume = addParam("volume", 0.5f);
    pTone = addParam("tone", 0.5f);
    pLag = addParam("lag", 0.3f);
    pBlend = addParam("blend", 0.5f);
    pWobble = addParam("wobble", 0.3f);
    pType = addParam("type", 0, 0, 2); // 0 sum, 1 invert, 2 bounce
    pSatOn = addParam("satOn", 1, 0, 1);
    pDtOn = addParam("dtOn", 1, 0, 1);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    for (int i = 0; i < 2; ++i) { dl[i].allocate(int(0.6f * sr)); emph[i].lp(2500, sr); hp[i].lp(30, sr); }
    wob.setRate(0.6f, sr);
    wob2.setRate(1.7f, sr);
    sLag.setTime(120, sr);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const bool satOn = p(pSatOn) > 0.5f, dtOn = p(pDtOn) > 0.5f;
    const float drive = 1.f + 9.f * p(pSat) * p(pSat);
    const float vol = dbToGain((p(pVolume) - 0.5f) * 20.f);
    for (auto& l : lp) l.lp(logMap(p(pTone), 3000, 18000), sr);
    const float blend = p(pBlend);
    const int type = int(std::round(p(pType)));
    const float wd = p(pWobble);
    for (int i = 0; i < n; ++i)
    {
      // lag: -50ms .. +500ms is simulated as 0..500 ms; first half of the knob is the "flange/chorus" zone
      const float lagMs = sLag.next(p(pLag) < 0.5f ? 0.2f + 20.f * p(pLag) * p(pLag) * 4.f : 20.f + (p(pLag) - 0.5f) * 2.f * 480.f);
      const float w = (wob.next(0) * 0.6f + wob2.next(0) * 0.4f) * wd * 0.0015f * sr;
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        float x = in[std::min(c, nIn - 1)][i];
        if (satOn)
        {
          // pre-emphasis -> tape curve -> de-emphasis
          const float lo = emph[c].processLP(x);
          float e = lo + (x - lo) * 1.6f;
          e = std::tanh(e * drive) / std::sqrt(drive) * 1.15f;
          x = lp[c].processLP(hp[c].processHP(e));
          x *= vol;
        }
        float y = x;
        if (dtOn)
        {
          dl[c].push(x);
          const float d = std::max(2.f, lagMs * 0.001f * sr + (c == 1 ? -w : w) + 2.f);
          float t = dl[c].read(d);
          if (type == 1) t = -t;
          if (type == 2 && nOut > 1)
            y = c == 0 ? x * (1.f - blend * 0.5f) : t * blend + x * (1.f - blend);
          else
            y = x * (1.f - blend * 0.5f) + t * blend * 0.8f;
        }
        out[c][i] = y;
      }
    }
  }
};

RegisterBlock r1("delay", [](const json& o, int, int) { return std::make_unique<DelayBlock>(o); });
RegisterBlock r2("deco", [](const json& o, int, int) { return std::make_unique<DecoBlock>(o); });
} // namespace
} // namespace tz
