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
  int pSemis1, pLevel1, pSemis2, pLevel2, pSemis3, pLevel3, pDeg3, pDry, pCents, pQuality, pExpr, pGlide, pVintage, pTone, pRangeLo;
  int pKey, pScale, pDeg1, pDeg2;
  // intelligent (diatonic) harmony: light-weight YIN on a decimated copy of the input
  std::vector<float> dRing, yinD;
  int dPos = 0, dCount = 0, decim = 6, sinceYin = 0;
  OnePole decLp;
  int curNote = -1;
  float semiH1 = 0, semiH2 = 0, semiH3 = 0;
  WsolaShifter sh[3][2]; // [voice][quality-set A/B]
  int curQ = -1;
  float sr = 48000;
  Smoother sR1, sR2, sR3, sDry, sL1, sL2, sL3;
  OnePole toneLp[2], preLp, envLp;
  // vintage divider
  float flip = 1.f, lastSign = 0, divEnv = 0;
  int flip2State = 0;
  float flip2 = 1.f;
  std::atomic<int> latencyMs{0};
  PitchBlock(const json& o)
  {
    pKey = addParam("key", 0, 0, 11);
    pScale = addParam("scale", o.value("scale", 0.f), 0, 7); // 0 chromatic (semis), 1 major, 2 minor, 3 dorian, 4 mixolydian, 5 harm. minor, 6 maj pent, 7 min pent
    pDeg1 = addParam("deg1", o.value("deg1", 2.f), -14, 14);   // scale steps (2 = a third above, 4 = a fifth, -2 = third below)
    pDeg2 = addParam("deg2", o.value("deg2", 4.f), -14, 14);
    pSemis1 = addParam("semis1", o.value("semis1", -2.f), -24, 24);
    pLevel1 = addParam("level1", o.value("level1", 1.f));
    pSemis2 = addParam("semis2", o.value("semis2", -12.f), -24, 24);
    pLevel2 = addParam("level2", o.value("level2", 0.f));
    pSemis3 = addParam("semis3", o.value("semis3", 12.f), -24, 24); // optional third voice (POG / Hedra style)
    pLevel3 = addParam("level3", o.value("level3", 0.f));
    pDeg3 = addParam("deg3", o.value("deg3", 7.f), -14, 14);
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
    for (auto* s : {&sR1, &sR2, &sR3, &sDry, &sL1, &sL2, &sL3}) s->setTime(20, sr);
    preLp.lp(900, sr);
    envLp.lp(30, sr);
    decim = std::max(1, int(std::round(sr / 8000.f)));
    decLp.lp(1100, sr);
    dRing.assign(1024, 0.f);
    yinD.assign(160, 0.f);
  }
  // returns MIDI note (float) or -1
  float detect()
  {
    const float dsr = sr / decim;
    const int W = 512, tMin = int(dsr / 1000.f), tMax = std::min(150, int(dsr / 70.f));
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
      if (best < 0 && t > tMin + 1 && yinD[t - 1] < 0.18f && yinD[t - 1] <= yinD[t] && yinD[t - 1] <= yinD[t - 2]) best = t - 1;
    }
    if (best < 0) return -1;
    const float a = yinD[best - 1], b = yinD[best], c = yinD[best + 1];
    const float off = (a - 2 * b + c) != 0 ? 0.5f * (a - c) / (a - 2 * b + c) : 0.f;
    const float f = dsr / (best + off);
    return 69.f + 12.f * std::log2(f / 440.f);
  }
  float diatonicShift(int note, int deg)
  {
    static const int scales[8][8] = {{0}, {0, 2, 4, 5, 7, 9, 11}, {0, 2, 3, 5, 7, 8, 10}, {0, 2, 3, 5, 7, 9, 10}, {0, 2, 4, 5, 7, 9, 10}, {0, 2, 3, 5, 7, 8, 11}, {0, 2, 4, 7, 9}, {0, 3, 5, 7, 10}};
    static const int len[8] = {1, 7, 7, 7, 7, 7, 5, 5};
    const int sc = int(std::round(p(pScale)));
    const int key = int(std::round(p(pKey)));
    const int L = len[sc];
    // nearest scale degree for the played note
    const int rel = ((note - key) % 12 + 12) % 12;
    int bestI = 0, bestD = 99;
    for (int i = 0; i < L; ++i) { const int d = std::abs(scales[sc][i] - rel); if (d < bestD) { bestD = d; bestI = i; } }
    const int oct = (note - key - rel) / 12;
    const int idx = bestI + deg;
    const int o2 = int(std::floor(float(idx) / L));
    const int target = key + 12 * (oct + o2) + scales[sc][((idx % L) + L) % L];
    const int played = key + 12 * oct + scales[sc][bestI];
    return float(target - played) + float(played - note);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const int q = int(std::round(p(pQuality)));
    if (q != curQ) configure(q);
    const float glideMs = 2.f + 400.f * p(pGlide) * p(pGlide);
    sR1.setTime(glideMs, sr);
    sR2.setTime(glideMs, sr);
    sR3.setTime(glideMs, sr);
    const float expr = p(pExpr);
    const float cents = p(pCents) / 100.f;
    const bool smart = p(pScale) > 0.5f;
    if (smart)
    {
      for (int i = 0; i < n; ++i)
      {
        const float xi = nIn > 1 ? 0.5f * (in[0][i] + in[1][i]) : in[0][i];
        const float d = decLp.processLP(xi);
        if (++dCount >= decim) { dCount = 0; dRing[dPos] = d; dPos = (dPos + 1) & 1023; ++sinceYin; }
      }
      if (sinceYin >= 256)
      {
        sinceYin = 0;
        const float m = detect();
        if (m > 0) curNote = int(std::round(m));
        if (curNote >= 0)
        {
          semiH1 = diatonicShift(curNote, int(std::round(p(pDeg1))));
          semiH2 = diatonicShift(curNote, int(std::round(p(pDeg2))));
          semiH3 = diatonicShift(curNote, int(std::round(p(pDeg3))));
        }
      }
    }
    const float r1t = std::pow(2.f, ((smart ? semiH1 : p(pSemis1)) * expr + cents) / 12.f);
    const float r2t = std::pow(2.f, ((smart ? semiH2 : p(pSemis2)) * expr + cents) / 12.f);
    const float r3t = std::pow(2.f, ((smart ? semiH3 : p(pSemis3)) * expr + cents) / 12.f);
    const bool v3on = p(pLevel3) > 0.0001f || sL3.y > 0.0001f;
    const bool vintage = p(pVintage) > 0.5f;
    const float tone = p(pTone);
    for (auto& t : toneLp) t.lp(logMap(tone, 400, 20000), sr);
    for (int i = 0; i < n; ++i)
    {
      const float x = nIn > 1 ? 0.5f * (in[0][i] + in[1][i]) : in[0][i];
      const float r1 = sR1.next(r1t), r2 = sR2.next(r2t);
      const float l1 = sL1.next(p(pLevel1)), l2 = sL2.next(p(pLevel2)), dry = sDry.next(p(pDry));
      const float r3 = sR3.next(r3t), l3 = sL3.next(p(pLevel3));
      float v1 = 0, v2 = 0, v3 = 0;
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
        if (v3on)
        {
          v3 = sh[2][r3 > 1.001f ? 1 : 0].process(x, r3);
          sh[2][r3 > 1.001f ? 0 : 1].process(x, 1.f);
        }
      }
      const float wet = toneLp[0].processLP(v1 * l1 + v2 * l2 + v3 * l3);
      const float y = wet + x * dry;
      for (int c = 0; c < std::max(1, nOut); ++c) out[c][i] = y;
    }
  }
  void status(json& j) override
  {
    j["latencyMs"] = latencyMs.load();
    if (p(pScale) > 0.5f) { j["note"] = curNote; j["h1"] = semiH1; j["h2"] = semiH2; j["h3"] = semiH3; }
  }
};

RegisterBlock r1("pitch", [](const json& o, int, int) { return std::make_unique<PitchBlock>(o); });
} // namespace
} // namespace tz
