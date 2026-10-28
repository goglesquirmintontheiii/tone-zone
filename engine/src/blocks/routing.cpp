// Routing & utility blocks: thru (placeholder), splitters / mergers (hard-wired boxes), audio meter,
// stereo tool (width / Haas / pan / mono-bass ...), DI box (instrument -> mic level, XLR) and re-amp box.
#include "common.h"

namespace tz
{
namespace
{
// plain pass-through (used for blocks whose plugin is unavailable)
class ThruBlock : public Block
{
public:
  ThruBlock(const json&) { finalizeParams(); }
  void prepare(const PrepareCtx&) override {}
  void process(const float* const* in, float* const* out, int n) override
  {
    for (int c = 0; c < nOut; ++c)
    {
      if (nIn == 0) { std::memset(out[c], 0, sizeof(float) * n); continue; }
      std::memcpy(out[c], in[std::min(c, nIn - 1)], sizeof(float) * n);
    }
  }
};

// 1 -> N splitter: per-output level (dB), mute, polarity. "buffered" adds nothing but a tiny HF-safe gain stage.
class SplitBlock : public Block
{
public:
  int pg[8], pm[8], pinv[8], pMaster;
  Smoother sm[8];
  SplitBlock(const json&)
  {
    for (int i = 0; i < 8; ++i)
    {
      pg[i] = addParam("g" + std::to_string(i + 1), 0, -60, 12);
      pm[i] = addParam("m" + std::to_string(i + 1), 0, 0, 1);
      pinv[i] = addParam("inv" + std::to_string(i + 1), 0, 0, 1);
    }
    pMaster = addParam("level", 0, -60, 12);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { for (auto& s : sm) s.setTime(20, c.sr); }
  void process(const float* const* in, float* const* out, int n) override
  {
    const float mg = dbToGain(p(pMaster));
    for (int c = 0; c < nOut; ++c)
    {
      const int k = std::min(c, 7);
      const float tgt = p(pm[k]) > 0.5f ? 0.f : dbToGain(p(pg[k])) * mg * (p(pinv[k]) > 0.5f ? -1.f : 1.f);
      const float* x = nIn ? in[nIn == 1 ? 0 : std::min(c, nIn - 1)] : nullptr;
      for (int i = 0; i < n; ++i) out[c][i] = x ? x[i] * sm[k].next(tgt) : 0.f;
    }
  }
};

// N -> 1 (or 2) merger: per-input level, mute, polarity, pan (stereo out)
class MergeBlock : public Block
{
public:
  int pg[8], pm[8], pinv[8], ppan[8], pMaster;
  Smoother sl[8], sr_[8];
  MergeBlock(const json&)
  {
    for (int i = 0; i < 8; ++i)
    {
      pg[i] = addParam("g" + std::to_string(i + 1), 0, -60, 12);
      pm[i] = addParam("m" + std::to_string(i + 1), 0, 0, 1);
      pinv[i] = addParam("inv" + std::to_string(i + 1), 0, 0, 1);
      ppan[i] = addParam("pan" + std::to_string(i + 1), 0, -1, 1);
    }
    pMaster = addParam("level", 0, -60, 12);
    finalizeParams();
  }
  bool normalInputs() const override { return false; }
  void prepare(const PrepareCtx& c) override { for (int i = 0; i < 8; ++i) { sl[i].setTime(20, c.sr); sr_[i].setTime(20, c.sr); } }
  void process(const float* const* in, float* const* out, int n) override
  {
    for (int c = 0; c < nOut; ++c) std::memset(out[c], 0, sizeof(float) * n);
    const float mg = dbToGain(p(pMaster));
    for (int k = 0; k < nIn && k < 8; ++k)
    {
      if (!(inConnected & (1u << k))) continue;
      const float g = p(pm[k]) > 0.5f ? 0.f : dbToGain(p(pg[k])) * mg * (p(pinv[k]) > 0.5f ? -1.f : 1.f);
      const float pan = p(ppan[k]);
      const float gl = nOut > 1 ? g * std::cos((pan + 1.f) * 0.25f * float(kPi)) * 1.41421f : g;
      const float gr = nOut > 1 ? g * std::sin((pan + 1.f) * 0.25f * float(kPi)) * 1.41421f : 0.f;
      for (int i = 0; i < n; ++i)
      {
        const float x = in[k][i];
        out[0][i] += x * sl[k].next(gl);
        if (nOut > 1) out[1][i] += x * sr_[k].next(gr);
      }
    }
  }
};

// level meter: passes audio, reports peak / RMS / peak-hold / clip per channel
class MeterBlock : public Block
{
public:
  int pRelease;
  std::atomic<float> pk[2], rms[2], clip[2];
  float accPk[2] = {0, 0}, accSq[2] = {0, 0};
  int accN = 0;
  MeterBlock(const json&)
  {
    pRelease = addParam("release", 0.5f);
    finalizeParams();
    for (int c = 0; c < 2; ++c) { pk[c] = 0; rms[c] = 0; clip[c] = 0; }
  }
  bool alwaysProcess() const override { return true; }
  void prepare(const PrepareCtx&) override {}
  void process(const float* const* in, float* const* out, int n) override
  {
    for (int c = 0; c < nOut; ++c)
    {
      const float* x = nIn ? in[std::min(c, nIn - 1)] : nullptr;
      if (!x) { std::memset(out[c], 0, sizeof(float) * n); continue; }
      std::memcpy(out[c], x, sizeof(float) * n);
      if (c > 1) continue;
      float m = accPk[c];
      double s = accSq[c];
      for (int i = 0; i < n; ++i) { const float a = std::fabs(x[i]); if (a > m) m = a; s += double(x[i]) * x[i]; }
      accPk[c] = m;
      accSq[c] = float(s);
      if (m >= 0.999f) clip[c] = 1.f;
    }
    accN += n;
    // publish ~ every 10 ms worth of samples
    if (accN >= 480)
    {
      for (int c = 0; c < 2; ++c)
      {
        if (accPk[c] > pk[c].load()) pk[c].store(accPk[c]);
        const float r = std::sqrt(accSq[c] / float(accN));
        if (r > rms[c].load()) rms[c].store(r);
        accPk[c] = 0; accSq[c] = 0;
      }
      accN = 0;
    }
  }
  void status(json& j) override
  {
    json m = json::array();
    for (int c = 0; c < std::min(2, std::max(1, nOut)); ++c)
    {
      m.push_back({pk[c].exchange(0.f), rms[c].exchange(0.f), clip[c].exchange(0.f)});
    }
    j["meter"] = m;
  }
};

// stereo tool: 0 width (M/S), 1 Haas widener, 2 dual-voice widener, 3 auto-pan, 4 mono sum, 5 swap L/R, 6 balance/pan
class StereoBlock : public Block
{
public:
  int pMode, pWidth, pTime, pPan, pRate, pDepth, pMonoBass, pLevel, pInvR;
  DelayLine dl[2];
  LFO lfo[2];
  Biquad lpM[2], hpS[2];
  float sr = 48000, lastMB = -1;
  Smoother sW, sP;
  StereoBlock(const json& o)
  {
    pMode = addParam("mode", o.value("mode", 0.f), 0, 6);
    pWidth = addParam("width", 0.6f);
    pTime = addParam("time", 12, 1, 40);
    pPan = addParam("pan", 0, -1, 1);
    pRate = addParam("rate", 0.3f);
    pDepth = addParam("depth", 0.5f);
    pMonoBass = addParam("monobass", 20, 20, 400);
    pLevel = addParam("level", 0, -24, 12);
    pInvR = addParam("invR", 0, 0, 1);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    for (auto& d : dl) d.allocate(int(0.06f * sr));
    lfo[0].setRate(0.31f, sr); lfo[1].setRate(0.23f, sr); lfo[1].phase = 0.37;
    sW.setTime(30, sr); sP.setTime(30, sr);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int mode = int(std::round(p(pMode)));
    if (p(pMonoBass) != lastMB)
    {
      lastMB = p(pMonoBass);
      for (int c = 0; c < 2; ++c) { lpM[c].set(Biquad::LP, lastMB, 0.707, 0, sr); hpS[c].set(Biquad::HP, lastMB, 0.707, 0, sr); }
    }
    const float g = dbToGain(p(pLevel));
    const float tSamp = p(pTime) * 0.001f * sr;
    const float rate = 0.05f * std::pow(160.f, p(pRate));
    lfo[0].setRate(rate, sr); lfo[1].setRate(rate * 0.73f, sr);
    const bool monoBass = p(pMonoBass) > 21.f;
    const float invR = p(pInvR) > 0.5f ? -1.f : 1.f;
    float* L = out[0];
    float* R = nOut > 1 ? out[1] : nullptr;
    for (int i = 0; i < n; ++i)
    {
      const float xl = nIn ? in[0][i] : 0.f;
      const float xr = nIn > 1 ? in[1][i] : xl;
      float l = xl, r = xr;
      const float w = sW.next(p(pWidth));
      switch (mode)
      {
        case 0: { // M/S width (0 = mono, 0.5 = unchanged, 1 = extra wide)
          const float m = 0.5f * (xl + xr), s = 0.5f * (xl - xr) * (w * 2.f);
          l = m + s; r = m - s;
          break;
        }
        case 1: { // Haas: delay one side a few ms
          const float m = 0.5f * (xl + xr);
          dl[0].push(m);
          const float d = dl[0].readLinear(std::max(1.f, tSamp));
          l = m; r = m * (1.f - w) + d * w;
          break;
        }
        case 2: { // dual-voice widener: two slowly modulated short delays, one per side
          const float m = 0.5f * (xl + xr);
          dl[0].push(m);
          const float a = dl[0].readLinear(std::max(1.f, tSamp * 0.5f + 4.f + lfo[0].next(0) * p(pDepth) * 0.0025f * sr));
          const float b = dl[0].readLinear(std::max(1.f, tSamp * 0.7f + 6.f + lfo[1].next(0) * p(pDepth) * 0.0025f * sr));
          l = m + a * w * 0.7f; r = m + b * w * 0.7f;
          break;
        }
        case 3: { // auto-pan
          const float m = 0.5f * (xl + xr);
          const float pos = std::max(-1.f, std::min(1.f, sP.next(p(pPan)) + lfo[0].next(0) * p(pDepth)));
          l = m * std::cos((pos + 1.f) * 0.25f * float(kPi)) * 1.41421f;
          r = m * std::sin((pos + 1.f) * 0.25f * float(kPi)) * 1.41421f;
          break;
        }
        case 4: l = r = 0.5f * (xl + xr); break;
        case 5: l = xr; r = xl; break;
        default: { // balance / pan
          const float pos = sP.next(p(pPan));
          const float m = nIn > 1 ? 0.f : xl;
          if (nIn > 1) { l = xl * std::min(1.f, 1.f - pos); r = xr * std::min(1.f, 1.f + pos); }
          else { l = m * std::cos((pos + 1.f) * 0.25f * float(kPi)) * 1.41421f; r = m * std::sin((pos + 1.f) * 0.25f * float(kPi)) * 1.41421f; }
        }
      }
      if (monoBass && mode != 4)
      {
        const float lowM = 0.5f * (lpM[0].process(l) + lpM[1].process(r));
        l = hpS[0].process(l) + lowM;
        r = hpS[1].process(r) + lowM;
      }
      if (R) { L[i] = l * g; R[i] = r * invR * g; }
      else L[i] = 0.5f * (l + r) * g;
    }
  }
};

// DI box: instrument level in -> balanced mic level out (XLR) + thru. pad, ground lift (noise), polarity, low cut.
class DIBlock : public Block
{
public:
  int pPad, pLift, pInv, pLowCut, pLevel, pSpk;
  Biquad hp, spk1, spk2, spk3;
  float sr = 48000, lastLc = -1;
  bool reamp = false;
  DIBlock(const json& o)
  {
    reamp = o.value("reamp", false);
    pPad = addParam("pad", 0, 0, 2);       // 0, -20, -40 dB
    pLift = addParam("lift", 0, 0, 1);
    pInv = addParam("invert", 0, 0, 1);
    pLowCut = addParam("lowcut", 20, 20, 300);
    pLevel = addParam("level", 0, -24, 24);
    pSpk = addParam("speaker", 0, 0, 1);   // optional speaker-emulation filter on the XLR out
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    spk1.set(Biquad::HP, 90, 0.8, 0, sr);
    spk2.set(Biquad::LP, 4800, 0.9, 0, sr);
    spk3.set(Biquad::Peak, 1800, 1.2, 3, sr);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    if (p(pLowCut) != lastLc) { lastLc = p(pLowCut); hp.set(Biquad::HP, lastLc, 0.707, 0, sr); }
    const int pad = int(std::round(p(pPad)));
    // DI: instrument -> mic level is roughly -20 dB; a re-amp box brings line/mic level back up to instrument level
    const float conv = reamp ? dbToGain(6.f) : dbToGain(-6.f);
    const float g = conv * dbToGain(p(pLevel) - 20.f * pad) * (p(pInv) > 0.5f ? -1.f : 1.f);
    const bool spk = p(pSpk) > 0.5f;
    const bool lowcut = p(pLowCut) > 21.f;
    for (int i = 0; i < n; ++i)
    {
      const float x = nIn ? in[0][i] : 0.f;
      float y = lowcut ? hp.process(x) : x;
      if (spk) y = spk3.process(spk2.process(spk1.process(y)));
      out[0][i] = y * g;
      if (nOut > 1) out[1][i] = x; // THRU (to amp)
    }
  }
};

// output selector: stereo in -> one of N stereo output pairs (outs 2k, 2k+1); event 1 arg = index selects.
// "mode" 0 = exclusive (A/B/C...), 1 = additive toggles (each output can be on independently, mask param).
class SelectBlock : public Block
{
public:
  int pSel, pMode, pMask, pFade;
  float g[8] = {1, 0, 0, 0, 0, 0, 0, 0};
  float sr = 48000;
  SelectBlock(const json&)
  {
    pSel = addParam("sel", 0, 0, 7);
    pMode = addParam("mode", 0, 0, 1);
    pMask = addParam("mask", 1, 0, 255);
    pFade = addParam("fade", 12, 1, 200); // ms crossfade (no clicks / trails cut-off)
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { sr = float(c.sr); }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int pairs = std::max(1, nOut / 2);
    const int sel = int(std::round(p(pSel)));
    const int mask = int(std::round(p(pMask)));
    const bool additive = p(pMode) > 0.5f;
    const float step = 1.f / (p(pFade) * 0.001f * sr);
    for (int k = 0; k < pairs && k < 8; ++k)
    {
      const float tgt = additive ? ((mask >> k) & 1 ? 1.f : 0.f) : (k == sel ? 1.f : 0.f);
      for (int c = 0; c < 2; ++c)
      {
        const int oi = k * 2 + c;
        if (oi >= nOut) break;
        const float* x = nIn ? in[std::min(c, nIn - 1)] : nullptr;
        float gg = g[k];
        for (int i = 0; i < n; ++i)
        {
          gg += std::max(-step, std::min(step, tgt - gg));
          out[oi][i] = x ? x[i] * gg : 0.f;
        }
        if (c == 1 || oi + 1 >= nOut) g[k] = gg;
      }
    }
  }
  void status(json& j) override { j["sel"] = int(std::round(p(pSel))); }
};

RegisterBlock r7("select", [](const json& o, int, int) { return std::make_unique<SelectBlock>(o); });
RegisterBlock r1("thru", [](const json& o, int, int) { return std::make_unique<ThruBlock>(o); });
RegisterBlock r2("split", [](const json& o, int, int) { return std::make_unique<SplitBlock>(o); });
RegisterBlock r3("merge", [](const json& o, int, int) { return std::make_unique<MergeBlock>(o); });
RegisterBlock r4("meter", [](const json& o, int, int) { return std::make_unique<MeterBlock>(o); });
RegisterBlock r5("stereo", [](const json& o, int, int) { return std::make_unique<StereoBlock>(o); });
RegisterBlock r6("di", [](const json& o, int, int) { return std::make_unique<DIBlock>(o); });
} // namespace
} // namespace tz
