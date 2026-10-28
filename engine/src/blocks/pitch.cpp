// Polyphonic pitch shifting (drop tune, octaver, whammy, harmony) built on the correlation-aligned WSOLA shifter,
// plus an optional "vintage" analog-style octave divider.
#include "../dsp/pitch.h"
#include "common.h"

namespace tz
{
namespace
{
class PitchBlock : public Block
{
public:
  int pSemis1, pLevel1, pSemis2, pLevel2, pDry, pCents, pQuality, pExpr, pGlide, pVintage, pTone, pRangeLo;
  WsolaShifter sh[2][2]; // [voice][quality-set A/B]
  int curQ = -1;
  float sr = 48000;
  Smoother sR1, sR2, sDry, sL1, sL2;
  OnePole toneLp[2], preLp, envLp;
  // vintage divider
  float flip = 1.f, lastSign = 0, divEnv = 0;
  int flip2State = 0;
  float flip2 = 1.f;
  std::atomic<int> latencyMs{0};
  PitchBlock(const json& o)
  {
    pSemis1 = addParam("semis1", o.value("semis1", -2.f), -24, 24);
    pLevel1 = addParam("level1", o.value("level1", 1.f));
    pSemis2 = addParam("semis2", o.value("semis2", -12.f), -24, 24);
    pLevel2 = addParam("level2", o.value("level2", 0.f));
    pDry = addParam("dry", o.value("dry", 0.f));
    pCents = addParam("cents", 0, -50, 50);
    pQuality = addParam("quality", 1, 0, 2); // 0 tight (10ms), 1 balanced (16ms), 2 studio (21ms)
    pExpr = addParam("expr", 1.f);         // whammy treadle: scales the shift amount
    pGlide = addParam("glide", 0.1f);
    pVintage = addParam("vintage", 0, 0, 1);
    pTone = addParam("tone", 1.f);
    pRangeLo = addParam("range", 0, 0, 1); // OC-5 range: 0 = all strings, 1 = only low notes below ~ 220Hz
    finalizeParams();
  }
  void configure(int q)
  {
    curQ = q;
    for (auto& v : sh)
    {
      if (q == 0) { v[0].prepare(sr, 2.f, 18.f, 6.f); v[1].prepare(sr, 2.5f, 30.f, 8.f); }
      else if (q == 1) { v[0].prepare(sr, 2.5f, 30.f, 15.f); v[1].prepare(sr, 3.f, 45.f, 8.f); }
      else { v[0].prepare(sr, 2.5f, 40.f, 12.f); v[1].prepare(sr, 3.f, 50.f, 8.f); }
    }
    latencyMs.store(sh[0][0].latency() * 1000 / int(sr));
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    configure(1);
    for (auto* s : {&sR1, &sR2, &sDry, &sL1, &sL2}) s->setTime(20, sr);
    preLp.lp(900, sr);
    envLp.lp(30, sr);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int q = int(std::round(p(pQuality)));
    if (q != curQ) configure(q);
    const float glideMs = 2.f + 400.f * p(pGlide) * p(pGlide);
    sR1.setTime(glideMs, sr);
    sR2.setTime(glideMs, sr);
    const float expr = p(pExpr);
    const float cents = p(pCents) / 100.f;
    const float r1t = std::pow(2.f, (p(pSemis1) * expr + cents) / 12.f);
    const float r2t = std::pow(2.f, (p(pSemis2) * expr + cents) / 12.f);
    const bool vintage = p(pVintage) > 0.5f;
    const float tone = p(pTone);
    for (auto& t : toneLp) t.lp(logMap(tone, 400, 20000), sr);
    for (int i = 0; i < n; ++i)
    {
      const float x = nIn > 1 ? 0.5f * (in[0][i] + in[1][i]) : in[0][i];
      const float r1 = sR1.next(r1t), r2 = sR2.next(r2t);
      const float l1 = sL1.next(p(pLevel1)), l2 = sL2.next(p(pLevel2)), dry = sDry.next(p(pDry));
      float v1 = 0, v2 = 0;
      if (vintage)
      {
        // analog flip-flop octave divider driven by a low-passed version of the input
        const float lpx = preLp.processLP(x);
        const float s = lpx > 0.002f ? 1.f : (lpx < -0.002f ? -1.f : lastSign);
        if (s > 0 && lastSign <= 0)
        {
          flip = -flip;
          if (++flip2State >= 2) { flip2State = 0; flip2 = -flip2; }
        }
        lastSign = s;
        divEnv = envLp.processLP(std::fabs(x));
        v1 = flip * divEnv * 2.2f;
        v2 = flip2 * divEnv * 2.0f;
      }
      else
      {
        // pick the shifter configuration best suited to the direction of the shift
        v1 = sh[0][r1 > 1.001f ? 1 : 0].process(x, r1);
        v2 = l2 > 0.0001f || p(pLevel2) > 0 ? sh[1][r2 > 1.001f ? 1 : 0].process(x, r2) : (sh[1][r2 > 1.001f ? 1 : 0].process(x, 1.f), 0.f);
        // keep the idle shifter of each voice fed so switching direction is seamless
        sh[0][r1 > 1.001f ? 0 : 1].process(x, 1.f);
        sh[1][r2 > 1.001f ? 0 : 1].process(x, 1.f);
      }
      const float wet = toneLp[0].processLP(v1 * l1 + v2 * l2);
      const float y = wet + x * dry;
      for (int c = 0; c < std::max(1, nOut); ++c) out[c][i] = y;
    }
  }
  void status(json& j) override { j["latencyMs"] = latencyMs.load(); }
};

RegisterBlock r1("pitch", [](const json& o, int, int) { return std::make_unique<PitchBlock>(o); });
} // namespace
} // namespace tz
