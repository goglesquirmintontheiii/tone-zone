// Wah, envelope filter, talk box (formant) and volume / expression.
#include "common.h"

namespace tz
{
namespace
{
class WahBlock : public Block
{
public:
  int pPos, pQ, pMode, pRate, pSens, pLevel, pRange, pFilter, pDir;
  float fLo, fHi, qBase;
  SVF svf[2];
  Smoother sPos;
  LFO lfo;
  EnvFollower env;
  float sr = 48000;
  std::atomic<float> posOut{0};
  WahBlock(const json& o)
  {
    pPos = addParam("pos", 0.5f);
    pQ = addParam("q", 0.5f);
    pMode = addParam("mode", o.value("mode", 0.f), 0, 2); // 0 pedal, 1 auto (LFO), 2 envelope
    pRate = addParam("rate", 0.4f);
    pSens = addParam("sens", 0.5f);
    pLevel = addParam("level", 0.5f);
    pRange = addParam("range", 0.5f);
    pFilter = addParam("filter", o.value("filter", 1.f), 0, 2); // 0 LP, 1 BP, 2 HP
    pDir = addParam("direction", 0, 0, 1); // envelope up/down
    fLo = o.value("fLo", 380.f);
    fHi = o.value("fHi", 2200.f);
    qBase = o.value("q", 4.5f);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    sPos.setTime(15, sr);
    env.setup(4, 120, sr);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int mode = int(std::round(p(pMode)));
    lfo.setRate(logMap(p(pRate), 0.1f, 8.f), sr);
    const float q = qBase * logMap(p(pQ), 0.35f, 2.2f);
    const float lo = fLo * logMap(p(pRange), 0.6f, 1.5f), hi = fHi * logMap(p(pRange), 0.6f, 1.5f);
    const float sens = logMap(p(pSens), 1.f, 60.f);
    const int filt = int(std::round(p(pFilter)));
    const float lvl = dbToGain((p(pLevel) - 0.5f) * 12.f);
    const bool down = p(pDir) > 0.5f;
    float lastPos = 0;
    for (int i = 0; i < n; i += 8)
    {
      const int m = std::min(8, n - i);
      float pos;
      if (mode == 1)
      {
        float l = 0;
        for (int k = 0; k < m; ++k) l = lfo.next(1);
        pos = 0.5f + 0.5f * l;
      }
      else if (mode == 2)
      {
        float e = 0;
        for (int k = 0; k < m; ++k) e = env.process(in[0][i + k]);
        pos = clampf(e * sens, 0.f, 1.f);
        if (down) pos = 1.f - pos;
      }
      else
        pos = p(pPos);
      float sp = 0;
      for (int k = 0; k < m; ++k) sp = sPos.next(pos);
      lastPos = sp;
      // GCB95 taper: most of the sweep happens in the upper half of the treadle
      const float f = logMap(std::pow(sp, 0.8f), lo, hi);
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        svf[c].set(f, q, sr);
        for (int k = 0; k < m; ++k)
        {
          const float x = in[std::min(c, nIn - 1)][i + k];
          svf[c].process(x);
          float y;
          if (filt == 0) y = svf[c].lp;
          else if (filt == 2) y = svf[c].hp;
          else y = svf[c].bp * 1.25f + svf[c].lp * 0.12f; // wah: resonant band + a little low end
          out[c][i + k] = fastTanh(y * lvl * 1.1f) / 1.1f;
        }
      }
    }
    posOut.store(lastPos);
  }
  void status(json& j) override { j["pos"] = posOut.load(); }
};

// Formant filter talk-box (vowel morph via pedal position / envelope)
class TalkBlock : public Block
{
public:
  int pPos, pTone, pVolume, pMode, pSens;
  Biquad f[2][3];
  EnvFollower env;
  Smoother sPos;
  float sr = 48000;
  TalkBlock(const json&)
  {
    pPos = addParam("pos", 0.5f);
    pTone = addParam("tone", 0.5f);
    pVolume = addParam("volume", 0.5f);
    pMode = addParam("mode", 0, 0, 1); // 0 pedal, 1 envelope ("mouth" opens with picking)
    pSens = addParam("sens", 0.5f);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { sr = float(c.sr); env.setup(8, 180, sr); sPos.setTime(20, sr); }
  void process(const float* const* in, float* const* out, int n) override
  {
    // vowel formants: U O A E I
    static const float F[5][3] = {{300, 870, 2240}, {450, 800, 2830}, {730, 1090, 2440}, {530, 1840, 2480}, {270, 2290, 3010}};
    static const float G[5][3] = {{0, -8, -20}, {0, -6, -16}, {0, -4, -12}, {0, -6, -10}, {0, -12, -8}};
    const bool envMode = p(pMode) > 0.5f;
    const float lvl = dbToGain((p(pVolume) - 0.5f) * 18.f);
    const float bright = (p(pTone) - 0.5f) * 8.f;
    for (int i = 0; i < n; i += 16)
    {
      const int m = std::min(16, n - i);
      float pos = p(pPos);
      if (envMode)
      {
        float e = 0;
        for (int k = 0; k < m; ++k) e = env.process(in[0][i + k]);
        pos = clampf(e * logMap(p(pSens), 2.f, 40.f), 0.f, 1.f);
      }
      float sp = 0;
      for (int k = 0; k < m; ++k) sp = sPos.next(pos);
      const float fi = sp * 3.999f;
      const int a = int(fi);
      const float t = fi - float(a);
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        for (int k = 0; k < 3; ++k)
        {
          const float fr = lerp(F[a][k], F[a + 1][k], t), gd = lerp(G[a][k], G[a + 1][k], t) + (k == 2 ? bright : 0.f);
          f[c][k].set(Biquad::BP, fr, 6.0 + k * 2, 0, sr);
          f[c][k].b0 *= dbToGain(gd); f[c][k].b2 *= dbToGain(gd);
        }
        for (int k = 0; k < m; ++k)
        {
          const float x = fastTanh(in[std::min(c, nIn - 1)][i + k] * 3.f) * 0.5f; // talk boxes are driven hard
          const float y = f[c][0].process(x) + f[c][1].process(x) + f[c][2].process(x);
          out[c][i + k] = y * 3.0f * lvl;
        }
      }
    }
  }
};

class VolumeBlock : public Block
{
public:
  int pPos, pMin, pTaper;
  Smoother s;
  VolumeBlock(const json&)
  {
    pPos = addParam("pos", 1.0f);
    pMin = addParam("min", 0.0f);
    pTaper = addParam("taper", 1, 0, 1); // 0 linear, 1 audio
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { s.setTime(10, float(c.sr)); }
  void process(const float* const* in, float* const* out, int n) override
  {
    float v = lerp(p(pMin), 1.f, p(pPos));
    if (p(pTaper) > 0.5f) v = audioTaper(v) * 1.f;
    for (int i = 0; i < n; ++i)
    {
      const float g = s.next(v);
      for (int c = 0; c < std::max(1, nOut); ++c) out[c][i] = in[std::min(c, nIn - 1)][i] * g;
    }
  }
};

RegisterBlock r1("wah", [](const json& o, int, int) { return std::make_unique<WahBlock>(o); });
RegisterBlock r2("talkbox", [](const json& o, int, int) { return std::make_unique<TalkBlock>(o); });
RegisterBlock r3("volume", [](const json& o, int, int) { return std::make_unique<VolumeBlock>(o); });
} // namespace
} // namespace tz
