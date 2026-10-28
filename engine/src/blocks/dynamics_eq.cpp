// Compressors, gates, EQs and utility blocks.
#include "common.h"

namespace tz
{
namespace
{
// ------------------------------------------------------------ Compressor
class CompBlock : public Block
{
public:
  int pSustain, pAttack, pRelease, pLevel, pTone, pBlend, pRatio, pKnee;
  std::string type;
  float sr = 48000;
  float envDb = -120, grDb = 0;
  std::atomic<float> grOut{0};
  Biquad toneHs[2], scHp;
  float lastTone = -1;
  CompBlock(const json& o)
  {
    pSustain = addParam("sustain", 0.5f);
    pAttack = addParam("attack", 0.3f);
    pRelease = addParam("release", 0.4f);
    pLevel = addParam("level", 0.5f);
    pTone = addParam("tone", 0.5f);
    pBlend = addParam("blend", 1.0f);
    pRatio = addParam("ratio", 0.5f);
    pKnee = addParam("knee", 0.5f);
    type = o.value("type", "vca");
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    scHp.set(Biquad::HP, type == "bass" ? 40 : 90, 0.7, 0, sr);
    lastTone = -1;
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    if (p(pTone) != lastTone)
    {
      lastTone = p(pTone);
      for (auto& t : toneHs) t.set(Biquad::HighShelf, 2500, 0.7, (lastTone - 0.5f) * 18.f, sr);
    }
    const float sus = p(pSustain);
    float thr, ratio;
    float attMs = 0.3f + 60.f * p(pAttack) * p(pAttack);
    float relMs = 30.f + 1200.f * p(pRelease) * p(pRelease);
    if (type == "ota") { thr = -8.f - sus * 42.f; ratio = 12.f; attMs = 3.f + attMs * 0.2f; relMs = 120.f + relMs * 0.3f; }
    else if (type == "opto") { thr = -6.f - sus * 40.f; ratio = 3.f + p(pRatio) * 4.f; attMs = 8.f + attMs * 0.5f; relMs = 250.f + relMs; }
    else { thr = -6.f - sus * 44.f; ratio = 1.5f + p(pRatio) * 18.5f; }
    const float knee = 2.f + 10.f * p(pKnee);
    const float aA = std::exp(-1.f / (attMs * 0.001f * sr));
    const float aR = std::exp(-1.f / (relMs * 0.001f * sr));
    const float makeup = -(thr * (1.f - 1.f / ratio)) * 0.38f + (p(pLevel) - 0.5f) * 24.f;
    const float mk = dbToGain(makeup);
    const float blend = p(pBlend);
    const int C = std::min(2, procChannels(nIn, nOut));
    float grMax = 0;
    for (int i = 0; i < n; ++i)
    {
      float det = 0;
      for (int c = 0; c < C; ++c) det = std::max(det, std::fabs(in[std::min(c, nIn - 1)][i]));
      det = std::fabs(scHp.process(det)) * 0.5f + det * 0.5f;
      const float xDb = gainToDb(det + 1e-9f);
      // soft-knee static curve
      float over = xDb - thr;
      float gr;
      if (over <= -knee * 0.5f) gr = 0;
      else if (over >= knee * 0.5f) gr = over * (1.f - 1.f / ratio);
      else { const float t = over + knee * 0.5f; gr = (1.f - 1.f / ratio) * t * t / (2.f * knee); }
      grDb = gr > grDb ? aA * grDb + (1 - aA) * gr : aR * grDb + (1 - aR) * gr;
      grMax = std::max(grMax, grDb);
      const float g = dbToGain(-grDb) * mk;
      for (int c = 0; c < C; ++c)
      {
        const float x = in[std::min(c, nIn - 1)][i];
        float y = x * g;
        if (type == "ota") y = std::tanh(y * 1.2f) / 1.2f;
        y = toneHs[c].process(y);
        out[std::min(c, nOut - 1)][i] = y * blend + x * (1.f - blend);
      }
    }
    if (nOut == 2 && C == 1) std::memcpy(out[1], out[0], sizeof(float) * n);
    grOut.store(grMax);
  }
  void status(json& j) override { j["gr"] = grOut.load(); }
};

// ------------------------------------------------------------ Noise gate (with send/return like the NS-2)
class GateBlock : public Block
{
public:
  int pThresh, pDecay, pMode, pAttack, pRange;
  float sr = 48000, env = 0, gain = 0, hold = 0;
  std::atomic<float> openOut{0};
  GateBlock(const json&)
  {
    pThresh = addParam("threshold", 0.4f);
    pDecay = addParam("decay", 0.4f);
    pMode = addParam("mode", 0, 0, 1); // 0 reduction, 1 mute
    pAttack = addParam("attack", 0.1f);
    pRange = addParam("range", 1.0f);
    finalizeParams();
  }
  bool normalInputs() const override { return false; }
  void prepare(const PrepareCtx& c) override { sr = float(c.sr); }
  void process(const float* const* in, float* const* out, int n) override
  {
    const float thrDb = -86.f + 66.f * p(pThresh);
    const float openT = dbToGain(thrDb), closeT = dbToGain(thrDb - 6.f);
    const float relMs = 5.f + 1995.f * p(pDecay) * p(pDecay);
    const float aR = std::exp(-1.f / (relMs * 0.001f * sr));
    const float aA = std::exp(-1.f / ((0.2f + p(pAttack) * 20.f) * 0.001f * sr));
    const float envA = std::exp(-1.f / (0.002f * sr)), envR = std::exp(-1.f / (0.04f * sr));
    const bool mute = p(pMode) > 0.5f;
    const float floorG = mute ? 0.f : dbToGain(-12.f - 70.f * p(pRange));
    const bool hasReturn = nIn >= 2 && (inConnected & 2u);
    const float* key = in[0];
    const float* src = hasReturn ? in[1] : in[0];
    float openSum = 0;
    for (int i = 0; i < n; ++i)
    {
      const float a = std::fabs(key[i]);
      env = a > env ? envA * env + (1 - envA) * a : envR * env + (1 - envR) * a;
      if (env > openT) hold = 0.02f * sr;
      const bool open = env > closeT && (env > openT || hold > 0);
      if (hold > 0) hold -= 1;
      const float target = open ? 1.f : floorG;
      gain = target > gain ? aA * gain + (1 - aA) * target : aR * gain + (1 - aR) * target;
      openSum += gain;
      out[0][i] = src[i] * gain;
      if (nOut >= 2) out[1][i] = key[i]; // SEND = buffered input
    }
    openOut.store(openSum / std::max(1, n));
  }
  void status(json& j) override { j["open"] = openOut.load(); }
};

// ------------------------------------------------------------ Graphic EQ
class GraphicEqBlock : public Block
{
public:
  std::vector<float> freqs;
  float q = 1.4f;
  std::vector<int> pBand;
  int pLevel, pGain;
  std::vector<Biquad> bq[2];
  std::vector<float> last;
  float sr = 48000;
  GraphicEqBlock(const json& o)
  {
    if (o.contains("freqs")) for (auto& f : o["freqs"]) freqs.push_back(f.get<float>());
    else freqs = {100, 200, 400, 800, 1600, 3200, 6400};
    q = o.value("q", freqs.size() >= 10 ? 1.8f : 1.2f);
    for (size_t i = 0; i < freqs.size(); ++i) pBand.push_back(addParam("b" + std::to_string(i), 0, -15, 15));
    pLevel = addParam("level", 0, -15, 15);
    pGain = addParam("gain", 0, -15, 15);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    for (auto& v : bq) v.assign(freqs.size(), Biquad());
    last.assign(freqs.size(), 999);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    for (size_t b = 0; b < freqs.size(); ++b)
      if (p(pBand[b]) != last[b])
      {
        last[b] = p(pBand[b]);
        for (auto& v : bq) v[b].set(Biquad::Peak, freqs[b], q, last[b], sr);
      }
    const float g = dbToGain(p(pLevel) + p(pGain));
    const int C = std::min(2, procChannels(nIn, nOut));
    for (int c = 0; c < C; ++c)
    {
      const float* x = in[std::min(c, nIn - 1)];
      float* y = out[std::min(c, nOut - 1)];
      for (int i = 0; i < n; ++i)
      {
        float v = x[i] * g;
        for (auto& f : bq[c]) v = f.process(v);
        y[i] = v;
      }
    }
    if (nOut == 2 && C == 1) std::memcpy(out[1], out[0], sizeof(float) * n);
  }
};

// ------------------------------------------------------------ Parametric EQ
class ParamEqBlock : public Block
{
public:
  int pLowCut, pHighCut, pLsF, pLsG, pM1F, pM1G, pM1Q, pM2F, pM2G, pM2Q, pHsF, pHsG, pLevel;
  Biquad f[2][8];
  float sr = 48000;
  std::vector<float> last;
  ParamEqBlock(const json&)
  {
    pLowCut = addParam("lowcut", 20, 20, 1000);
    pHighCut = addParam("highcut", 20000, 1000, 20000);
    pLsF = addParam("lowfreq", 100, 30, 500);
    pLsG = addParam("lowgain", 0, -18, 18);
    pM1F = addParam("mid1freq", 500, 100, 4000);
    pM1G = addParam("mid1gain", 0, -18, 18);
    pM1Q = addParam("mid1q", 1, 0.2f, 8);
    pM2F = addParam("mid2freq", 2000, 300, 10000);
    pM2G = addParam("mid2gain", 0, -18, 18);
    pM2Q = addParam("mid2q", 1, 0.2f, 8);
    pHsF = addParam("highfreq", 5000, 1000, 16000);
    pHsG = addParam("highgain", 0, -18, 18);
    pLevel = addParam("level", 0, -18, 18);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { sr = float(c.sr); last.assign(defs.size(), -12345); }
  void process(const float* const* in, float* const* out, int n) override
  {
    bool dirty = false;
    for (size_t i = 0; i < defs.size(); ++i)
      if (p(int(i)) != last[i]) { last[i] = p(int(i)); dirty = true; }
    if (dirty)
      for (auto& s : f)
      {
        s[0].set(Biquad::HP, p(pLowCut), 0.707, 0, sr);
        s[1].set(Biquad::LP, p(pHighCut), 0.707, 0, sr);
        s[2].set(Biquad::LowShelf, p(pLsF), 0.7, p(pLsG), sr);
        s[3].set(Biquad::Peak, p(pM1F), p(pM1Q), p(pM1G), sr);
        s[4].set(Biquad::Peak, p(pM2F), p(pM2Q), p(pM2G), sr);
        s[5].set(Biquad::HighShelf, p(pHsF), 0.7, p(pHsG), sr);
      }
    const float g = dbToGain(p(pLevel));
    const int C = std::min(2, procChannels(nIn, nOut));
    for (int c = 0; c < C; ++c)
    {
      const float* x = in[std::min(c, nIn - 1)];
      float* y = out[std::min(c, nOut - 1)];
      for (int i = 0; i < n; ++i)
      {
        float v = x[i];
        for (int k = 0; k < 6; ++k) v = f[c][k].process(v);
        y[i] = v * g;
      }
    }
    if (nOut == 2 && C == 1) std::memcpy(out[1], out[0], sizeof(float) * n);
  }
};

// ------------------------------------------------------------ Utility: gain / pan / width / phase
class UtilityBlock : public Block
{
public:
  std::string kind;
  int pLevel, pPan, pWidth, pInvert, pSel, pLevelB;
  Smoother sA, sB;
  UtilityBlock(const json& o)
  {
    kind = o.value("kind", "gain");
    pLevel = addParam("level", 0, -60, 24);
    pPan = addParam("pan", 0, -1, 1);
    pWidth = addParam("width", 1, 0, 2);
    pInvert = addParam("invert", 0, 0, 1);
    pSel = addParam("select", 2, 0, 2);
    pLevelB = addParam("levelB", 0, -60, 24);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override { sA.setTime(20, float(c.sr)); sB.setTime(20, float(c.sr)); }
  void process(const float* const* in, float* const* out, int n) override
  {
    const float g = dbToGain(p(pLevel)) * (p(pInvert) > 0.5f ? -1.f : 1.f);
    if (kind == "split" || kind == "aby")
    {
      // 1 -> 2: A/B/Y
      const int sel = int(std::round(p(pSel)));
      const float ga = (sel == 0 || sel == 2) ? dbToGain(p(pLevel)) : 0.f;
      const float gb = (sel == 1 || sel == 2) ? dbToGain(p(pLevelB)) : 0.f;
      for (int i = 0; i < n; ++i)
      {
        const float a = sA.next(ga), b = sB.next(gb);
        const float x = in[0][i];
        out[0][i] = x * a;
        if (nOut > 1) out[1][i] = x * b;
      }
      return;
    }
    if (kind == "merge")
    {
      // N -> 1 or 2 mixer: levels per input via level/levelB, pan for stereo
      const float ga = dbToGain(p(pLevel)), gb = dbToGain(p(pLevelB));
      for (int i = 0; i < n; ++i)
      {
        const float a = in[0][i] * sA.next(ga);
        const float b = (nIn > 1 ? in[1][i] : 0.f) * sB.next(gb);
        if (nOut == 1) out[0][i] = a + b;
        else
        {
          out[0][i] = a;
          out[1][i] = nIn > 1 ? b : a;
        }
      }
      return;
    }
    if (nIn == 1 && nOut == 2)
    {
      const float pan = p(pPan);
      const float l = std::cos((pan + 1) * 0.25f * float(kPi)) * 1.41421f, r = std::sin((pan + 1) * 0.25f * float(kPi)) * 1.41421f;
      for (int i = 0; i < n; ++i)
      {
        const float x = in[0][i] * sA.next(g);
        out[0][i] = x * l;
        out[1][i] = x * r;
      }
      return;
    }
    if (nIn == 2 && nOut == 1)
    {
      for (int i = 0; i < n; ++i) out[0][i] = 0.5f * (in[0][i] + in[1][i]) * sA.next(g);
      return;
    }
    if (nIn == 2 && nOut == 2)
    {
      const float w = p(pWidth), pan = p(pPan);
      for (int i = 0; i < n; ++i)
      {
        const float gg = sA.next(g);
        const float m = 0.5f * (in[0][i] + in[1][i]), s = 0.5f * (in[0][i] - in[1][i]) * w;
        out[0][i] = (m + s) * gg * std::min(1.f, 1.f - pan);
        out[1][i] = (m - s) * gg * std::min(1.f, 1.f + pan);
      }
      return;
    }
    for (int i = 0; i < n; ++i) out[0][i] = in[0][i] * sA.next(g);
  }
};

RegisterBlock r1("comp", [](const json& o, int, int) { return std::make_unique<CompBlock>(o); });
RegisterBlock r2("gate", [](const json& o, int, int) { return std::make_unique<GateBlock>(o); });
RegisterBlock r3("geq", [](const json& o, int, int) { return std::make_unique<GraphicEqBlock>(o); });
RegisterBlock r4("peq", [](const json& o, int, int) { return std::make_unique<ParamEqBlock>(o); });
RegisterBlock r5("utility", [](const json& o, int, int) { return std::make_unique<UtilityBlock>(o); });
} // namespace
} // namespace tz
