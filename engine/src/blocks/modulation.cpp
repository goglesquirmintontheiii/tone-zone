// Modulation: chorus, flanger, phaser, tremolo, vibe, rotary, ring mod, bitcrusher.
#include "common.h"

namespace tz
{
namespace
{
inline float rateHz(float t, float lo = 0.05f, float hi = 10.f) { return logMap(t, lo, hi); }

// ------------------------------------------------------------ Chorus / vibrato / ensemble
class ChorusBlock : public Block
{
public:
  int pRate, pDepth, pMix, pTone, pDelay, pMode, pFb, pWave, pLevel;
  std::string style;
  DelayLine dl[2];
  LFO lfo[3];
  OnePole wetLp[2], hpf[2];
  Biquad tone[2];
  float sr = 48000, lastTone = -1;
  Smoother sDepth, sDelay;
  bool invertR;
  float baseMs, depthMs;
  float fbState[2] = {0, 0};
  ChorusBlock(const json& o)
  {
    pRate = addParam("rate", 0.35f);
    pDepth = addParam("depth", 0.5f);
    pMix = addParam("mix", 0.5f);
    pTone = addParam("tone", 0.5f);
    pDelay = addParam("delay", 0.5f);
    pMode = addParam("mode", 0, 0, 3); // 0 chorus, 1 vibrato, 2 ensemble(3 voice), 3 dimension
    pFb = addParam("feedback", 0.f);
    pWave = addParam("wave", 0, 0, 1);
    pLevel = addParam("level", 0.5f);
    style = o.value("style", "bbd");
    invertR = o.value("invertR", true);
    baseMs = o.value("baseMs", 7.f);
    depthMs = o.value("depthMs", 4.5f);
    finalizeParams();
  }
  bool hasTrails() const override { return false; }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    for (auto& d : dl) d.allocate(int(0.06f * sr));
    for (int i = 0; i < 2; ++i)
    {
      wetLp[i].lp(style == "bbd" ? 7000.f : 14000.f, sr);
      hpf[i].lp(60.f, sr);
    }
    lfo[1].phase = 0.25;
    lfo[2].phase = 0.5;
    sDepth.setTime(50, sr);
    sDelay.setTime(80, sr);
    lastTone = -1;
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    if (p(pTone) != lastTone)
    {
      lastTone = p(pTone);
      for (auto& t : tone) t.set(Biquad::HighShelf, 2000, 0.7, (lastTone - 0.5f) * 14.f, sr);
    }
    const int mode = int(std::round(p(pMode)));
    const float rate = rateHz(p(pRate), 0.06f, 9.f);
    for (auto& l : lfo) l.setRate(rate, sr);
    const float depth = p(pDepth);
    const float mix = mode == 1 ? 1.f : p(pMix);
    const float dryG = mode == 1 ? 0.f : 1.f;
    const float fb = p(pFb) * 0.7f;
    const int shape = p(pWave) > 0.5f ? 1 : 0;
    const float lvl = dbToGain((p(pLevel) - 0.5f) * 12.f);
    for (int i = 0; i < n; ++i)
    {
      const float xl = in[0][i];
      const float xr = nIn > 1 ? in[1][i] : xl;
      const float d = sDepth.next(depth);
      const float base = sDelay.next(baseMs * (0.4f + 1.2f * p(pDelay))) * 0.001f * sr;
      const float span = depthMs * 0.001f * sr * d;
      const float m0 = lfo[0].next(shape), m1 = lfo[1].next(shape), m2 = lfo[2].next(shape);
      dl[0].push(hpf[0].processHP(xl) + fbState[0] * fb);
      dl[1].push(hpf[1].processHP(xr) + fbState[1] * fb);
      float wl, wr;
      if (mode == 2)
      {
        wl = (dl[0].read(base + span * m0) + dl[0].read(base * 1.3f + span * m1) + dl[0].read(base * 0.8f + span * m2)) * 0.45f;
        wr = (dl[1].read(base + span * m2) + dl[1].read(base * 1.25f + span * m0) + dl[1].read(base * 0.85f - span * m1)) * 0.45f;
      }
      else if (mode == 3)
      {
        wl = dl[0].read(base + span * m0 * 0.5f);
        wr = dl[1].read(base - span * m0 * 0.5f);
      }
      else
      {
        wl = dl[0].read(base + span * m0);
        wr = invertR ? wl : dl[1].read(base + span * m1);
      }
      wl = wetLp[0].processLP(wl);
      wr = wetLp[1].processLP(wr);
      fbState[0] = wl;
      fbState[1] = wr;
      const float ol = tone[0].process(xl * dryG + wl * mix) * lvl;
      out[0][i] = ol;
      if (nOut > 1)
      {
        // classic stereo chorus: right output carries the phase-inverted wet signal
        const float orr = (invertR && mode == 0) ? xr * dryG - wl * mix : xr * dryG + wr * mix;
        out[1][i] = tone[1].process(orr) * lvl;
      }
    }
  }
};

// ------------------------------------------------------------ Flanger
class FlangerBlock : public Block
{
public:
  int pManual, pWidth, pSpeed, pRegen, pMix, pMode;
  DelayLine dl[2];
  LFO lfo[2];
  float sr = 48000, fbs[2] = {0, 0};
  Smoother sMan;
  OnePole lp[2];
  FlangerBlock(const json&)
  {
    pManual = addParam("manual", 0.5f);
    pWidth = addParam("width", 0.6f);
    pSpeed = addParam("speed", 0.3f);
    pRegen = addParam("regen", 0.6f);
    pMix = addParam("mix", 0.5f);
    pMode = addParam("mode", 0, 0, 3); // 0 standard, 1 ultra (more fb), 2 gate(fast square), 3 through-zero
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    for (auto& d : dl) d.allocate(int(0.03f * sr));
    lfo[1].phase = 0.25;
    sMan.setTime(40, sr);
    for (auto& l : lp) l.lp(9000, sr);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int mode = int(std::round(p(pMode)));
    const float rate = rateHz(p(pSpeed), 0.03f, 8.f);
    for (auto& l : lfo) l.setRate(rate, sr);
    float regen = (p(pRegen) - 0.0f) * (mode == 1 ? 0.97f : 0.88f);
    const float mix = p(pMix);
    for (int i = 0; i < n; ++i)
    {
      const float man = sMan.next(p(pManual));
      const float baseMs = 0.25f + 6.f * man * man;
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        const float x = in[std::min(c, nIn - 1)][i];
        float m = lfo[c].next(mode == 2 ? 2 : 1);
        const float dMs = baseMs * (1.f + p(pWidth) * 0.95f * m);
        const float d = std::max(0.05f, dMs) * 0.001f * sr;
        dl[c].push(x + fbs[c] * regen);
        float w = dl[c].read(d + 1.f);
        if (mode == 3) w = -w;
        fbs[c] = lp[c].processLP(w);
        out[c][i] = (x * (1.f - mix * 0.5f) + w * mix) * 0.85f;
      }
    }
  }
};

// ------------------------------------------------------------ Phaser
class PhaserBlock : public Block
{
public:
  int pRate, pDepth, pFb, pMix, pStages, pCenter, pScript;
  Allpass1 ap[2][12];
  LFO lfo[2];
  float sr = 48000, last[2] = {0, 0};
  PhaserBlock(const json& o)
  {
    pRate = addParam("rate", 0.35f);
    pDepth = addParam("depth", 0.8f);
    pFb = addParam("feedback", 0.4f);
    pMix = addParam("mix", 0.5f);
    pStages = addParam("stages", o.value("stages", 4.f), 2, 12);
    pCenter = addParam("center", 0.5f);
    pScript = addParam("script", 0, 0, 1);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { sr = float(c.sr); lfo[1].phase = 0.5; }
  void process(const float* const* in, float* const* out, int n) override
  {
    const float rate = rateHz(p(pRate), 0.04f, 10.f);
    for (auto& l : lfo) l.setRate(rate, sr);
    const int st = std::max(2, std::min(12, int(std::round(p(pStages)) / 2 * 2)));
    const float fb = p(pScript) > 0.5f ? 0.05f : p(pFb) * 0.85f;
    const float depth = p(pDepth);
    const float lo = logMap(p(pCenter), 80, 600), hi = lo * (4.f + 10.f * depth);
    const float mix = p(pMix);
    for (int i = 0; i < n; i += 16)
    {
      const int m = std::min(16, n - i);
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        float lv = 0;
        for (int k = 0; k < m; ++k) lv = lfo[c].next(1);
        const float f = logMap(0.5f + 0.5f * lv * depth, lo, hi);
        for (int s = 0; s < st; ++s) ap[c][s].setFreq(f * (1.f + 0.07f * s), sr);
        for (int k = 0; k < m; ++k)
        {
          const float x = in[std::min(c, nIn - 1)][i + k];
          float y = x + last[c] * fb;
          for (int s = 0; s < st; ++s) y = ap[c][s].process(y);
          last[c] = y;
          out[c][i + k] = x * (1.f - mix) + y * mix;
        }
      }
    }
  }
};

// ------------------------------------------------------------ Tremolo (amp / harmonic / bias) with stereo pan
class TremoloBlock : public Block
{
public:
  int pRate, pDepth, pWave, pMode, pLevel, pStereo;
  LFO lfo;
  OnePole split[2];
  Smoother sm;
  float sr = 48000;
  TremoloBlock(const json&)
  {
    pRate = addParam("rate", 0.4f);
    pDepth = addParam("depth", 0.6f);
    pWave = addParam("wave", 0.3f); // 0 triangle ... 1 square
    pMode = addParam("mode", 0, 0, 2); // 0 amp/opto, 1 harmonic, 2 bias (tube)
    pLevel = addParam("level", 0.5f);
    pStereo = addParam("stereo", 0, 0, 1); // 1 = auto-pan between outputs
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { sr = float(c.sr); for (auto& s : split) s.lp(750, sr); sm.setTime(2, sr); }
  void process(const float* const* in, float* const* out, int n) override
  {
    lfo.setRate(rateHz(p(pRate), 0.4f, 14.f), sr);
    const float depth = p(pDepth), wave = p(pWave);
    const int mode = int(std::round(p(pMode)));
    const float lvl = dbToGain((p(pLevel) - 0.5f) * 12.f);
    const bool pan = p(pStereo) > 0.5f && nOut > 1;
    for (int i = 0; i < n; ++i)
    {
      const float ph = float(lfo.phase);
      lfo.next(0);
      const float tri = LFO::value(ph, 1);
      const float sq = fastTanh(tri * (1.f + 30.f * wave)) / fastTanh(1.f + 30.f * wave);
      float m = sm.next(lerp(tri, sq, wave)); // -1..1
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        const float x = in[std::min(c, nIn - 1)][i];
        float mm = (pan && c == 1) ? -m : m;
        float y;
        if (mode == 1)
        {
          const float lo = split[c].processLP(x), hi = x - lo;
          y = lo * (1.f - depth * 0.5f * (1 + mm)) + hi * (1.f - depth * 0.5f * (1 - mm));
          y *= 1.2f;
        }
        else
        {
          float g = 1.f - depth * 0.5f * (1.f + mm);
          if (mode == 2) g = std::pow(std::max(0.f, g), 1.6f); // bias trem: more "throb"
          y = x * g;
          if (mode == 2) y = fastTanh(y * 1.4f) / 1.2f;
        }
        out[c][i] = y * lvl;
      }
    }
  }
};

// ------------------------------------------------------------ Uni-Vibe style
class VibeBlock : public Block
{
public:
  int pSpeed, pIntensity, pMode, pLevel, pTone, pDrive;
  Allpass1 ap[2][4];
  LFO lfo;
  float sr = 48000, lamp = 0;
  OnePole tone[2];
  VibeBlock(const json&)
  {
    pSpeed = addParam("speed", 0.4f);
    pIntensity = addParam("intensity", 0.7f);
    pMode = addParam("mode", 0, 0, 1); // 0 chorus, 1 vibrato
    pLevel = addParam("level", 0.5f);
    pTone = addParam("tone", 0.6f);
    pDrive = addParam("drive", 0.2f);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { sr = float(c.sr); }
  void process(const float* const* in, float* const* out, int n) override
  {
    lfo.setRate(rateHz(p(pSpeed), 0.5f, 12.f), sr);
    const float inten = p(pIntensity);
    const bool vib = p(pMode) > 0.5f;
    const float lvl = dbToGain((p(pLevel) - 0.5f) * 12.f);
    for (auto& t : tone) t.lp(logMap(p(pTone), 1500, 16000), sr);
    const float drive = 1.f + 4.f * p(pDrive);
    const float base[4] = {60.f, 220.f, 520.f, 1200.f};
    for (int i = 0; i < n; i += 8)
    {
      const int m = std::min(8, n - i);
      float lv = 0;
      for (int k = 0; k < m; ++k) lv = lfo.next(0);
      // incandescent lamp + LDR: asymmetric, slow-ish response
      const float target = std::pow(0.5f + 0.5f * lv, 1.7f);
      lamp += (target - lamp) * (target > lamp ? 0.5f : 0.25f);
      const float sweep = 1.f + inten * 5.f * lamp;
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        for (int s = 0; s < 4; ++s) ap[c][s].setFreq(base[s] * sweep, sr);
        for (int k = 0; k < m; ++k)
        {
          const float x = fastTanh(in[std::min(c, nIn - 1)][i + k] * drive) / drive;
          float y = x;
          for (int s = 0; s < 4; ++s) y = ap[c][s].process(y);
          float o = vib ? y : 0.5f * (x + y) * 1.3f;
          out[c][i + k] = tone[c].processLP(o) * lvl;
        }
      }
    }
  }
};

// ------------------------------------------------------------ Rotary speaker
class RotaryBlock : public Block
{
public:
  int pSpeed, pDrive, pBalance, pMix, pAccel, pHornLevel;
  DelayLine hornDl[2], drumDl[2];
  OnePole xover[2];
  Biquad hornHp[2];
  double hornPh = 0, drumPh = 0;
  float hornRate = 0.8f, drumRate = 0.7f, sr = 48000;
  RotaryBlock(const json&)
  {
    pSpeed = addParam("speed", 0, 0, 1); // 0 slow, 1 fast
    pDrive = addParam("drive", 0.2f);
    pBalance = addParam("balance", 0.5f);
    pMix = addParam("mix", 1.0f);
    pAccel = addParam("accel", 0.5f);
    pHornLevel = addParam("level", 0.5f);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    for (int i = 0; i < 2; ++i)
    {
      hornDl[i].allocate(int(0.01f * sr));
      drumDl[i].allocate(int(0.02f * sr));
      xover[i].lp(800, sr);
      hornHp[i].set(Biquad::HP, 700, 0.7, 0, sr);
    }
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const bool fast = p(pSpeed) > 0.5f;
    const float hornT = fast ? 6.7f : 0.83f, drumT = fast ? 5.9f : 0.67f;
    const float acc = 0.0002f + 0.002f * (1.f - p(pAccel));
    const float drive = 1.f + 6.f * p(pDrive);
    const float bal = p(pBalance), mix = p(pMix);
    const float lvl = dbToGain((p(pHornLevel) - 0.5f) * 12.f);
    for (int i = 0; i < n; ++i)
    {
      hornRate += (hornT - hornRate) * acc * 1.4f;
      drumRate += (drumT - drumRate) * acc * 0.6f;
      hornPh += hornRate / sr;
      drumPh += drumRate / sr;
      if (hornPh > 1) hornPh -= 1;
      if (drumPh > 1) drumPh -= 1;
      const float x0 = nIn > 1 ? 0.5f * (in[0][i] + in[1][i]) : in[0][i];
      const float x = fastTanh(x0 * drive) / std::sqrt(drive);
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        const float off = c == 0 ? 0.f : 0.25f; // mics at 90 degrees
        const float hs = std::sin(float(kTwoPi) * float(hornPh + off));
        const float ds = std::sin(float(kTwoPi) * float(drumPh + off));
        const float lo = xover[c].processLP(x);
        const float hi = hornHp[c].process(x);
        hornDl[c].push(hi);
        drumDl[c].push(lo);
        const float h = hornDl[c].read(0.0015f * sr * (1.f + 0.9f * hs) + 2) * (1.f + 0.45f * hs);
        const float d = drumDl[c].read(0.002f * sr * (1.f + 0.4f * ds) + 2) * (1.f + 0.2f * ds);
        const float wet = h * (0.4f + bal) + d * (1.4f - bal);
        out[c][i] = (wet * mix + x0 * (1.f - mix)) * lvl;
      }
    }
  }
};

// ------------------------------------------------------------ Ring modulator / bitcrusher
class RingBlock : public Block
{
public:
  int pFreq, pMix, pFine;
  double ph = 0;
  float sr = 48000;
  RingBlock(const json&)
  {
    pFreq = addParam("freq", 0.4f);
    pMix = addParam("mix", 0.5f);
    pFine = addParam("fine", 0.5f);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { sr = float(c.sr); }
  void process(const float* const* in, float* const* out, int n) override
  {
    const float f = logMap(p(pFreq), 20, 3000) * (0.9f + 0.2f * p(pFine));
    const float mix = p(pMix);
    for (int i = 0; i < n; ++i)
    {
      ph += f / sr;
      if (ph > 1) ph -= 1;
      const float car = std::sin(float(kTwoPi * ph));
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        const float x = in[std::min(c, nIn - 1)][i];
        out[c][i] = x * (1.f - mix) + x * car * mix;
      }
    }
  }
};

class CrushBlock : public Block
{
public:
  int pBits, pRate, pMix;
  float hold[2] = {0, 0}, cnt = 0;
  CrushBlock(const json&)
  {
    pBits = addParam("bits", 0.5f);
    pRate = addParam("rate", 0.3f);
    pMix = addParam("mix", 1.0f);
    finalizeParams();
  }
  void prepare(const PrepareCtx&) override {}
  void process(const float* const* in, float* const* out, int n) override
  {
    const float bits = 2.f + (1.f - p(pBits)) * 14.f;
    const float q = std::pow(2.f, bits - 1);
    const float step = 1.f + p(pRate) * p(pRate) * 40.f;
    const float mix = p(pMix);
    for (int i = 0; i < n; ++i)
    {
      cnt += 1.f;
      const bool take = cnt >= step;
      if (take) cnt -= step;
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        const float x = in[std::min(c, nIn - 1)][i];
        if (take) hold[c] = std::round(x * q) / q;
        out[c][i] = x * (1.f - mix) + hold[c] * mix;
      }
    }
  }
};

RegisterBlock r1("chorus", [](const json& o, int, int) { return std::make_unique<ChorusBlock>(o); });
RegisterBlock r2("flanger", [](const json& o, int, int) { return std::make_unique<FlangerBlock>(o); });
RegisterBlock r3("phaser", [](const json& o, int, int) { return std::make_unique<PhaserBlock>(o); });
RegisterBlock r4("tremolo", [](const json& o, int, int) { return std::make_unique<TremoloBlock>(o); });
RegisterBlock r5("vibe", [](const json& o, int, int) { return std::make_unique<VibeBlock>(o); });
RegisterBlock r6("rotary", [](const json& o, int, int) { return std::make_unique<RotaryBlock>(o); });
RegisterBlock r7("ringmod", [](const json& o, int, int) { return std::make_unique<RingBlock>(o); });
RegisterBlock r8("crusher", [](const json& o, int, int) { return std::make_unique<CrushBlock>(o); });
} // namespace
} // namespace tz
