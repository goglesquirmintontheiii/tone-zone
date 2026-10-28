// Algorithmic reverbs: room, hall, plate, spring, shimmer, cloud/ambient, modulated, dynamic, +delay, swell.
#include "../dsp/pitch.h"
#include "common.h"

namespace tz
{
namespace
{
enum RMode { RRoom, RHall, RPlate, RSpring, RShimmer, RCloud, RMod, RDynamic, RDelay, RSwell, RCount };

struct ShiftLite
{
  DelayLine dl;
  float ph = 0, win = 2400;
  void prepare(float sr) { dl.allocate(int(0.12f * sr)); win = 0.07f * sr; }
  inline float process(float x, float ratio)
  {
    dl.push(x);
    ph += (1.f - ratio) / win;
    if (ph >= 1) ph -= 1;
    if (ph < 0) ph += 1;
    const float p2 = ph + 0.5f >= 1 ? ph - 0.5f : ph + 0.5f;
    const float wa = std::sin(float(kPi) * ph), wb = std::sin(float(kPi) * p2);
    return dl.read(2 + ph * win) * wa * wa + dl.read(2 + p2 * win) * wb * wb;
  }
};

struct AP
{
  DelayLine d;
  int len = 1;
  float g = 0.6f;
  void prepare(int l) { len = std::max(1, l); d.allocate(len + 64); }
  inline float process(float x, float modOff = 0)
  {
    const float delayed = modOff == 0 ? d.tap(len - 1) : d.read(float(len - 1) + modOff);
    const float v = x + g * delayed;
    d.push(flushDenorm(v));
    return delayed - g * v;
  }
};

class ReverbBlock : public Block
{
public:
  int pDecay, pMix, pTone, pLowCut, pPre, pMod, pMode, pLevel, pShimmer, pSize, pDiffusion, pHighDamp, pLowDamp, pEnsemble;
  float sr = 48000;
  static constexpr int N = 8;
  DelayLine line[N];
  float baseLen[N];
  OnePole damp[N], lowDamp[N];
  float g[N];
  LFO lfo[N];
  AP inAp[2][4];
  AP spring[2][24];
  DelayLine springDl[2];
  OnePole springLp[2], springHp[2];
  DelayLine pre[2];
  DelayLine echo;
  OnePole outLp[2], outHp[2];
  WsolaShifter shift[2];
  LFO ens[3];
  DelayLine ensDl;
  EnvFollower duck;
  float fbS[2] = {0, 0};
  Smoother sPre;
  int curMode = -1;
  float lastDecay = -1, lastTone = -1, lastLow = -1, lastSize = -1, lastHD = -1, lastLD = -1;
  bool freeze = false;
  int fixedMode;
  ReverbBlock(const json& o)
  {
    pDecay = addParam("decay", 0.5f);
    pMix = addParam("mix", 0.35f);
    pTone = addParam("tone", 0.6f);
    pLowCut = addParam("lowcut", 0.15f);
    pPre = addParam("predelay", 20, 0, 500);
    pMod = addParam("mod", 0.3f);
    pMode = addParam("mode", o.value("mode", 1.f), 0, RCount - 1);
    pLevel = addParam("level", 0.5f);
    pShimmer = addParam("shimmer", 0.5f);
    pSize = addParam("size", 0.5f);
    pDiffusion = addParam("diffusion", 0.7f);
    pHighDamp = addParam("highdamp", 0.5f);
    pLowDamp = addParam("lowdamp", 0.5f);
    pEnsemble = addParam("ensemble", 0.0f);
    fixedMode = o.value("fixedMode", -1);
    finalizeParams();
  }
  bool hasTrails() const override { return true; }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    const float ms[N] = {29.7f, 37.1f, 41.1f, 43.7f, 53.3f, 59.9f, 67.7f, 73.1f};
    for (int i = 0; i < N; ++i)
    {
      baseLen[i] = ms[i] * 0.001f * sr;
      line[i].allocate(int(baseLen[i] * 3.2f) + 64);
      lfo[i].setRate(0.3f + 0.13f * i, sr);
      lfo[i].phase = 0.11 * i;
    }
    const float apMs[4] = {4.3f, 3.1f, 7.7f, 5.9f};
    for (int c = 0; c < 2; ++c)
    {
      for (int k = 0; k < 4; ++k) inAp[c][k].prepare(int(apMs[k] * (c ? 1.13f : 1.f) * 0.001f * sr));
      for (int k = 0; k < 24; ++k) { spring[c][k].prepare(2 + (k % 3)); spring[c][k].g = 0.62f; }
      springDl[c].allocate(int(0.08f * sr));
      springLp[c].lp(4300, sr);
      springHp[c].lp(180, sr);
      pre[c].allocate(int(0.55f * sr));
      shift[c].prepare(sr, 3.f, 50.f, 8.f);
    }
    echo.allocate(int(0.9f * sr));
    ensDl.allocate(int(0.05f * sr));
    for (int k = 0; k < 3; ++k) { ens[k].setRate(0.7f + 0.9f * k, sr); ens[k].phase = 0.33 * k; }
    duck.setup(5, 250, sr);
    sPre.setTime(100, sr);
    curMode = -1;
  }
  void onEvent(const BlockEvent& e) override
  {
    if (e.type == 2) freeze = e.value > 0.5f;
  }
  void updateCoefs(int mode)
  {
    const float decay = p(pDecay), size = p(pSize), hd = p(pHighDamp), ld = p(pLowDamp);
    if (mode == curMode && decay == lastDecay && size == lastSize && hd == lastHD && ld == lastLD && p(pTone) == lastTone &&
        p(pLowCut) == lastLow)
      return;
    curMode = mode;
    lastDecay = decay; lastSize = size; lastHD = hd; lastLD = ld; lastTone = p(pTone); lastLow = p(pLowCut);
    float tLo = 0.3f, tHi = 6.f, scale = 1.f, dampF = 7000;
    switch (mode)
    {
      case RRoom: tLo = 0.2f; tHi = 2.5f; scale = 0.45f; dampF = 6000; break;
      case RHall: tLo = 0.8f; tHi = 9.f; scale = 1.25f; dampF = 7000; break;
      case RPlate: tLo = 0.6f; tHi = 7.f; scale = 0.8f; dampF = 11000; break;
      case RSpring: tLo = 0.6f; tHi = 4.f; scale = 0.6f; dampF = 4500; break;
      case RShimmer: tLo = 2.f; tHi = 18.f; scale = 1.4f; dampF = 9000; break;
      case RCloud: tLo = 3.f; tHi = 25.f; scale = 1.9f; dampF = 8000; break;
      case RMod: tLo = 1.f; tHi = 10.f; scale = 1.1f; dampF = 7000; break;
      case RDynamic: tLo = 0.8f; tHi = 8.f; scale = 1.1f; dampF = 7500; break;
      case RDelay: tLo = 0.8f; tHi = 6.f; scale = 1.f; dampF = 7000; break;
      case RSwell: tLo = 1.5f; tHi = 12.f; scale = 1.3f; dampF = 8000; break;
    }
    scale *= 0.6f + 0.8f * size;
    scale = std::min(scale, 3.0f);
    const float t60 = logMap(decay, tLo, tHi);
    dampF *= logMap(1.f - hd, 0.25f, 2.0f);
    for (int i = 0; i < N; ++i)
    {
      const float len = baseLen[i] * scale;
      g[i] = std::pow(10.f, -3.f * len / (t60 * sr));
      damp[i].lp(std::min(dampF, sr * 0.45f), sr);
      lowDamp[i].lp(logMap(ld, 40.f, 400.f), sr);
    }
    for (int c = 0; c < 2; ++c)
    {
      outLp[c].lp(logMap(p(pTone), 1800, 18000), sr);
      outHp[c].lp(logMap(p(pLowCut), 20, 600), sr);
    }
    sizeScale = scale;
  }
  float sizeScale = 1.f;

  void process(const float* const* in, float* const* out, int n) override
  {
    const int mode = fixedMode >= 0 ? fixedMode : std::max(0, std::min(RCount - 1, int(std::round(p(pMode)))));
    updateCoefs(mode);
    const float mix = p(pMix), lvl = dbToGain((p(pLevel) - 0.5f) * 12.f);
    float modD = p(pMod) * (mode == RMod ? 18.f : mode == RCloud ? 10.f : 4.f);
    const float diffG = 0.35f + 0.4f * p(pDiffusion);
    for (int c = 0; c < 2; ++c)
      for (int k = 0; k < 4; ++k) inAp[c][k].g = (mode == RPlate ? 0.72f : diffG);
    const float shim = p(pShimmer), ensAmt = p(pEnsemble) + (mode == RCloud ? 0.25f : 0.f);
    const float er = mode == RRoom ? 0.6f : mode == RHall ? 0.3f : 0.f;
    for (int i = 0; i < n; ++i)
    {
      const float xl = in[0][i];
      const float xr = nIn > 1 ? in[1][i] : xl;
      float il = freeze ? 0.f : xl, ir = freeze ? 0.f : xr;
      // ensemble (string-machine-like) chorus on reverb input
      if (ensAmt > 0.01f)
      {
        ensDl.push(0.5f * (il + ir));
        float e = 0;
        for (int k = 0; k < 3; ++k) e += ensDl.read(0.008f * sr + ens[k].next(0) * 0.004f * sr * ensAmt + 4);
        il = il * (1 - ensAmt * 0.6f) + e * 0.33f * ensAmt;
        ir = ir * (1 - ensAmt * 0.6f) + e * 0.33f * ensAmt;
      }
      const float preS = sPre.next(p(pPre)) * 0.001f * sr;
      pre[0].push(il);
      pre[1].push(ir);
      il = pre[0].read(std::max(1.f, preS));
      ir = pre[1].read(std::max(1.f, preS));
      if (mode == RDelay)
      {
        const float e = echo.read(0.38f * sr);
        echo.push(0.5f * (il + ir) + e * 0.45f);
        il += e;
        ir += e;
      }
      float wl = 0, wr = 0;
      if (mode == RSpring)
      {
        for (int c = 0; c < 2; ++c)
        {
          float x = (c ? ir : il) + fbS[c] * 0.75f * g[0] / std::max(0.01f, g[0]) * (0.5f + 0.48f * p(pDecay));
          for (int k = 0; k < 24; ++k) x = spring[c][k].process(x);
          x = springLp[c].processLP(springHp[c].processHP(x));
          springDl[c].push(x);
          const float y = springDl[c].read((c ? 0.037f : 0.031f) * sr * (0.7f + 0.6f * p(pSize)));
          fbS[c] = y;
          (c ? wr : wl) = y * 1.3f;
        }
      }
      else
      {
        for (int c = 0; c < 2; ++c)
        {
          float x = c ? ir : il;
          for (int k = 0; k < 4; ++k) x = inAp[c][k].process(x);
          (c ? ir : il) = x;
        }
        // read FDN lines
        float v[N];
        for (int k = 0; k < N; ++k)
        {
          const float len = baseLen[k] * sizeScale + lfo[k].next(0) * modD;
          v[k] = line[k].read(std::max(4.f, len));
        }
        wl = (v[0] + v[2] + v[4] + v[6]) * 0.35f;
        wr = (v[1] + v[3] + v[5] + v[7]) * 0.35f;
        if (er > 0) { wl += er * line[2].read(0.011f * sr) * 0.3f; wr += er * line[5].read(0.013f * sr) * 0.3f; }
        // Hadamard mixing
        for (int len = 1; len < N; len <<= 1)
          for (int a = 0; a < N; a += 2 * len)
            for (int b = a; b < a + len; ++b)
            {
              const float s = v[b], d = v[b + len];
              v[b] = s + d;
              v[b + len] = s - d;
            }
        const float norm = 1.f / std::sqrt(float(N));
        float shimIn = 0;
        if (mode == RShimmer)
        {
          shimIn = std::tanh(shift[0].process(wl + wr, 2.0f) * shim * 0.6f) * 0.55f;
        }
        for (int k = 0; k < N; ++k)
        {
          float y = v[k] * norm;
          y = damp[k].processLP(y);
          y = y - lowDamp[k].processLP(y) * 0.5f * (1.f - p(pLowDamp));
          const float gg = freeze ? 1.0f : g[k];
          const float inj = (k & 1) ? ir : il;
          line[k].push(flushDenorm(y * gg + inj * 0.5f + shimIn * 0.22f));
        }
      }
      wl = outHp[0].processHP(outLp[0].processLP(wl));
      wr = outHp[1].processHP(outLp[1].processLP(wr));
      float wetG = mix;
      if (mode == RDynamic)
      {
        const float e = duck.process(0.5f * (xl + xr));
        wetG *= 1.f / (1.f + 12.f * e);
      }
      if (mode == RSwell)
      {
        const float e = duck.process(0.5f * (xl + xr));
        wetG *= clampf(1.f - e * 8.f, 0.15f, 1.f);
      }
      if (nOut == 1) out[0][i] = (xl + 0.5f * (wl + wr) * wetG * 1.5f) * lvl;
      else
      {
        out[0][i] = (xl + wl * wetG * 1.5f) * lvl;
        out[1][i] = (xr + wr * wetG * 1.5f) * lvl;
      }
    }
  }
  void reset() override { for (auto& l : line) l.clear(); }
  void status(json& j) override { j["freeze"] = freeze; }
};

RegisterBlock r1("reverb", [](const json& o, int, int) { return std::make_unique<ReverbBlock>(o); });
} // namespace
} // namespace tz
