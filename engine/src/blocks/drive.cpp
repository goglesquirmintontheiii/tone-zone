// Drive / distortion / fuzz / boost circuit models.
#include "common.h"

namespace tz
{
namespace
{
enum Clip { CTs, CDiode, CAsym, COpamp, CGe, CSi, CMuff, CLed, CJfet, CTube, CMosfet, CClean };
enum Tone { TNone, TLp, TTs, TBlend, TRat, TEq3, TTilt, THm2, TMt2 };

Clip parseClip(const std::string& s)
{
  static const std::map<std::string, Clip> m = {{"ts", CTs}, {"diode", CDiode}, {"asym", CAsym}, {"opamp", COpamp},
                                               {"ge", CGe}, {"si", CSi}, {"muff", CMuff}, {"led", CLed}, {"jfet", CJfet},
                                               {"tube", CTube}, {"mosfet", CMosfet}, {"clean", CClean}};
  auto it = m.find(s);
  return it == m.end() ? CDiode : it->second;
}
Tone parseTone(const std::string& s)
{
  static const std::map<std::string, Tone> m = {{"none", TNone}, {"lp", TLp}, {"ts", TTs}, {"blend", TBlend},
                                               {"rat", TRat}, {"eq3", TEq3}, {"tilt", TTilt}, {"hm2", THm2}, {"mt2", TMt2}};
  auto it = m.find(s);
  return it == m.end() ? TLp : it->second;
}

struct Voicing
{
  Clip clip = CDiode;
  Tone tone = TLp;
  float gainMinDb = 0, gainMaxDb = 40;
  float preHp = 30, clipHp = 0, clipLp = 12000, postLp = 9000;
  bool cleanSum = false;
  float cleanMix = 1.f;
  float toneLo = 500, toneHi = 8000;
  float blendLp = 400, blendHp = 1200;
  float levelMaxDb = 6, levelMinDb = -30;
  float bias = 0.15f;
  int stages = 1;
  float stage2Db = 12;
  float slew = 0; // op-amp slew limit (V/us scaled); 0 = off
  float eqRangeDb = 15;
  float bassF = 120, trebleF = 3000, midF = 700, midQ = 0.7f;
  float midMin = 200, midMax = 5000, hiMidF = 1600;
  bool useHiMid = false;
  float outTrim = 1.f;
  std::vector<EqBand> preEq, postEq;
  void parse(const json& j)
  {
    if (j.contains("clip")) clip = parseClip(j["clip"]);
    if (j.contains("tone")) tone = parseTone(j["tone"]);
    gainMinDb = j.value("gainMinDb", gainMinDb);
    gainMaxDb = j.value("gainMaxDb", gainMaxDb);
    preHp = j.value("preHp", preHp);
    clipHp = j.value("clipHp", clipHp);
    clipLp = j.value("clipLp", clipLp);
    postLp = j.value("postLp", postLp);
    cleanSum = j.value("cleanSum", cleanSum);
    cleanMix = j.value("cleanMix", cleanMix);
    toneLo = j.value("toneLo", toneLo);
    toneHi = j.value("toneHi", toneHi);
    blendLp = j.value("blendLp", blendLp);
    blendHp = j.value("blendHp", blendHp);
    levelMaxDb = j.value("levelMaxDb", levelMaxDb);
    levelMinDb = j.value("levelMinDb", levelMinDb);
    bias = j.value("bias", bias);
    stages = j.value("stages", stages);
    stage2Db = j.value("stage2Db", stage2Db);
    slew = j.value("slew", slew);
    eqRangeDb = j.value("eqRangeDb", eqRangeDb);
    bassF = j.value("bassF", bassF);
    trebleF = j.value("trebleF", trebleF);
    midF = j.value("midF", midF);
    midQ = j.value("midQ", midQ);
    midMin = j.value("midMin", midMin);
    midMax = j.value("midMax", midMax);
    hiMidF = j.value("hiMidF", hiMidF);
    useHiMid = j.value("useHiMid", useHiMid);
    outTrim = j.value("outTrim", outTrim);
    if (j.contains("preEq")) preEq = parseBands(j["preEq"]);
    if (j.contains("postEq")) postEq = parseBands(j["postEq"]);
  }
};

struct ChanState
{
  OnePole preHp, clipHp, toneLp1, toneLp2, blendLp, blendHp, ratLp, postLp1, postLp2;
  Biquad clipLp, clipLp2, preEq[6], postEq[6], bass, mid, treble, himid;
  DCBlocker dc;
  float slewY = 0;
  float env = 0, sagEnv = 0;
};

class DriveBlock : public Block
{
public:
  int pGain, pTone, pLevel, pBass, pMid, pTreble, pMidFreq, pBlend, pMode, pBright, pHiMid, pSag;
  std::vector<Voicing> modes;
  ChanState ch[2];
  Oversampler os[2];
  PrepareCtx ctx;
  int curMode = -1;
  Smoother sGain, sLevel, sBlend;
  std::vector<float> tmp, clean, gB, lB, bB;
  float lastHm = -1, lastTone = -1, lastBass = -1, lastMid = -1, lastTreble = -1, lastMf = -1, lastBright = -1;

  DriveBlock(const json& o)
  {
    pGain = addParam("gain", 0.5f);
    pTone = addParam("tone", 0.5f);
    pLevel = addParam("level", 0.5f);
    pBass = addParam("bass", 0.5f);
    pMid = addParam("mid", 0.5f);
    pTreble = addParam("treble", 0.5f);
    pMidFreq = addParam("midfreq", 0.5f);
    pBlend = addParam("blend", 1.0f);
    pMode = addParam("mode", 0, 0, 7);
    pBright = addParam("bright", 0, 0, 1);
    pHiMid = addParam("himid", 0.5f);
    pSag = addParam("sag", 0.f);
    Voicing base;
    base.parse(o);
    modes.push_back(base);
    if (o.contains("modes"))
    {
      modes.clear();
      for (auto& m : o["modes"])
      {
        Voicing v = base;
        v.parse(m);
        modes.push_back(v);
      }
    }
    finalizeParams();
  }

  void prepare(const PrepareCtx& c) override
  {
    ctx = c;
    const int osf = std::max(2, c.oversample); // distortion always at least 2x
    for (auto& o : os) o.prepare(osf, c.maxBlock);
    tmp.assign(c.maxBlock * 8, 0.f);
    clean.assign(c.maxBlock, 0.f);
    gB.assign(c.maxBlock, 0.f); lB.assign(c.maxBlock, 0.f); bB.assign(c.maxBlock, 0.f);
    sGain.setTime(30, float(c.sr));
    sLevel.setTime(30, float(c.sr));
    sBlend.setTime(30, float(c.sr));
    curMode = -1;
  }

  void setupFilters(const Voicing& v)
  {
    const float sr = float(ctx.sr);
    const float osr = sr * float(os[0].factor);
    for (auto& s : ch)
    {
      s.preHp.lp(v.preHp, sr);
      s.clipHp.lp(std::max(1.f, v.clipHp), osr);
      s.clipLp.set(Biquad::LP, std::min(v.clipLp, osr * 0.45f), 0.6, 0, osr);
      s.clipLp2.set(Biquad::LP, std::min(v.postLp * 1.5f, osr * 0.45f), 0.6, 0, osr);
      s.postLp1.lp(v.postLp, sr);
      s.postLp2.lp(v.postLp * 1.3f, sr);
      s.blendLp.lp(v.blendLp, sr);
      s.blendHp.lp(v.blendHp, sr);
      for (size_t i = 0; i < v.preEq.size() && i < 6; ++i) s.preEq[i].set(v.preEq[i].type, v.preEq[i].f, v.preEq[i].q, v.preEq[i].db, sr);
      for (size_t i = 0; i < v.postEq.size() && i < 6; ++i) s.postEq[i].set(v.postEq[i].type, v.postEq[i].f, v.postEq[i].q, v.postEq[i].db, sr);
      s.dc.setup(8, sr);
    }
    lastTone = -1;
  }

  void updateTone(const Voicing& v)
  {
    const float t = p(pTone), b = p(pBass), m = p(pMid), tr = p(pTreble), mf = p(pMidFreq), br = p(pBright), hm = p(pHiMid);
    if (t == lastTone && b == lastBass && m == lastMid && tr == lastTreble && mf == lastMf && br == lastBright && hm == lastHm) return;
    lastHm = hm;
    lastTone = t; lastBass = b; lastMid = m; lastTreble = tr; lastMf = mf; lastBright = br;
    const float sr = float(ctx.sr);
    for (auto& s : ch)
    {
      switch (v.tone)
      {
        case TLp: s.toneLp1.lp(logMap(t, v.toneLo, v.toneHi), sr); break;
        case TTs: s.toneLp1.lp(v.toneLo, sr); break;
        case TRat: s.ratLp.lp(logMap(1.f - t, v.toneLo, v.toneHi), sr); break;
        case TTilt:
          s.treble.set(Biquad::HighShelf, v.trebleF, 0.6, (t - 0.5f) * 2.f * v.eqRangeDb, sr);
          s.bass.set(Biquad::LowShelf, v.bassF, 0.6, -(t - 0.5f) * v.eqRangeDb, sr);
          break;
        case TEq3:
        case TMt2:
        {
          s.bass.set(Biquad::LowShelf, v.bassF, 0.7, (b - 0.5f) * 2.f * v.eqRangeDb, sr);
          const float midF = v.tone == TMt2 ? logMap(mf, v.midMin, v.midMax) : v.midF;
          s.mid.set(Biquad::Peak, midF, v.tone == TMt2 ? 1.2f : v.midQ, (m - 0.5f) * 2.f * v.eqRangeDb, sr);
          s.treble.set(Biquad::HighShelf, v.trebleF, 0.7, (tr - 0.5f) * 2.f * v.eqRangeDb, sr);
          s.himid.set(Biquad::Peak, v.hiMidF, 1.0, (hm - 0.5f) * 2.f * v.eqRangeDb, sr);
          s.toneLp1.lp(logMap(t, v.toneLo, v.toneHi), sr);
          break;
        }
        case THm2:
          s.bass.set(Biquad::Peak, 95, 0.9, b * 18.f - 3.f, sr);
          s.mid.set(Biquad::Peak, 1250, 1.1, m * 14.f - 2.f, sr);
          s.treble.set(Biquad::Peak, 2800, 1.0, tr * 16.f - 3.f, sr);
          break;
        default: break;
      }
      if (br > 0.5f) s.postEq[5].set(Biquad::HighShelf, 2500, 0.7, 4.0, sr);
    }
  }

  inline float clipSample(const Voicing& v, ChanState& s, float x, float slewMax)
  {
    switch (v.clip)
    {
      case CTs: return std::tanh(x * 0.9f) * 0.9f;
      case CDiode: return shape::diode(x * 0.8f);
      case CAsym: return shape::asym(x, v.bias) * 0.95f;
      case COpamp:
      {
        // op-amp rail clip with slew-rate limiting, then hard diodes to ground
        float y = 4.5f * std::tanh(x / 4.5f);
        if (slewMax > 0)
        {
          const float d = clampf(y - s.slewY, -slewMax, slewMax);
          y = s.slewY + d;
          s.slewY = y;
        }
        return shape::hard(y * 1.2f, 3.0f) * 0.85f;
      }
      case CGe:
      {
        // germanium fuzz: asymmetric, softens and sputters with lower input level
        s.env = s.env * 0.9995f + std::fabs(x) * 0.0005f;
        const float b = v.bias - 0.25f * clampf(s.env * 2.f, 0.f, 1.f);
        return shape::fuzzGe(x, b);
      }
      case CSi: return std::tanh(x * 1.5f + 0.12f) - std::tanh(0.12f);
      case CMuff: return shape::hard(x, 2.0f);
      case CLed: return std::tanh(x * 0.55f) * 1.6f;
      case CJfet: return shape::tube(x * 0.8f, v.bias) * 1.1f;
      case CTube: return shape::tube(x, v.bias);
      case CMosfet: return shape::asym(x * 0.9f, v.bias * 0.5f);
      case CClean: return x / (1.f + std::fabs(x) * 0.1f);
    }
    return x;
  }

  void process(const float* const* in, float* const* out, int n) override
  {
    const int m = int(std::round(p(pMode)));
    const int mi = std::max(0, std::min(int(modes.size()) - 1, m));
    const Voicing& v = modes[mi];
    if (mi != curMode)
    {
      curMode = mi;
      setupFilters(v);
    }
    updateTone(v);
    const float sr = float(ctx.sr);
    const int osf = os[0].factor;
    const float osr = sr * float(osf);
    const float gTarget = dbToGain(v.gainMinDb + (v.gainMaxDb - v.gainMinDb) * p(pGain));
    const float lv = p(pLevel);
    const float lvTarget = lv < 0.01f ? 0.f : dbToGain(v.levelMinDb + (v.levelMaxDb - v.levelMinDb) * lv) * v.outTrim;
    const float blTarget = p(pBlend);
    const float stage2 = dbToGain(v.stage2Db);
    // slew limit in units/sample at OS rate (≈0.5V/us on a ±4.5V scale)
    const float slewMax = v.slew > 0 ? v.slew * 1e6f / osr / 4.5f * 0.5f : 0.f;
    const float tsTone = p(pTone);
    const float tsHiGain = 0.06f + 1.9f * tsTone * tsTone;
    const float sagAmt = p(pSag) * 0.6f;
    const float sagAtt = 1.f - std::exp(-1.f / (0.004f * osr)), sagRel = 1.f - std::exp(-1.f / (0.12f * osr));
    const int C = std::min(2, procChannels(nIn, nOut));
    // the smoothers are shared; compute per-sample gain arrays once
    float* gBuf = gB.data();
    float* lBuf = lB.data();
    float* bBuf = bB.data();
    const int nn = std::min(n, kMaxBlockLocal);
    for (int i = 0; i < nn; ++i)
    {
      gBuf[i] = sGain.next(gTarget);
      lBuf[i] = sLevel.next(lvTarget);
      bBuf[i] = sBlend.next(blTarget);
    }
    for (int c = 0; c < C; ++c)
    {
      ChanState& s = ch[c];
      const float* x = in[std::min(c, nIn - 1)];
      float* y = out[std::min(c, nOut - 1)];
      for (int i = 0; i < nn; ++i)
      {
        float u = s.preHp.processHP(x[i]);
        for (size_t k = 0; k < v.preEq.size() && k < 6; ++k) u = s.preEq[k].process(u);
        if (v.tone == THm2) u = s.mid.process(u); // HM-2 style pre-clip mid emphasis
        clean[i] = u;
        tmp[i] = u;
      }
      float* o = os[c].up(tmp.data(), nn);
      const int on = nn * osf;
      for (int i = 0; i < on; ++i)
      {
        float g = gBuf[i / osf];
        float u = o[i];
        if (sagAmt > 0)
        {
          s.sagEnv += (std::fabs(u) * g - s.sagEnv) * (std::fabs(u) * g > s.sagEnv ? sagAtt : sagRel);
          g /= 1.f + sagAmt * s.sagEnv;
        }
        float d = v.clipHp > 0 ? s.clipHp.processHP(u) : u;
        d = s.clipLp.process(d * g);
        float yv = clipSample(v, s, d, slewMax);
        if (v.stages > 1)
        {
          yv = s.clipLp2.process(yv * stage2);
          yv = clipSample(v, s, yv, slewMax);
        }
        o[i] = yv;
      }
      os[c].down(o, tmp.data(), nn);
      for (int i = 0; i < nn; ++i)
      {
        float d = tmp[i];
        if (v.cleanSum) d = d + clean[i] * v.cleanMix;
        d = s.dc.process(d);
        d = s.postLp1.processLP(d);
        if (v.postLp < 6000) d = s.postLp2.processLP(d);
        switch (v.tone)
        {
          case TLp: d = s.toneLp1.processLP(d); break;
          case TTs:
          {
            const float lp = s.toneLp1.processLP(d);
            d = lp + (d - lp) * tsHiGain;
            break;
          }
          case TBlend:
          {
            const float lp = s.blendLp.processLP(d);
            const float hp = s.blendHp.processHP(d);
            d = (lp * (1.f - tsTone) + hp * tsTone) * 1.6f;
            break;
          }
          case TRat: d = s.ratLp.processLP(d); break;
          case TTilt: d = s.treble.process(s.bass.process(d)); break;
          case TEq3:
          case TMt2: d = s.treble.process(s.mid.process(s.bass.process(d))); if (v.useHiMid) d = s.himid.process(d); if (v.toneHi > v.toneLo) d = s.toneLp1.processLP(d); break;
          case THm2: d = s.treble.process(s.bass.process(d)); break;
          default: break;
        }
        for (size_t k = 0; k < v.postEq.size() && k < 5; ++k) d = s.postEq[k].process(d);
        if (p(pBright) > 0.5f) d = s.postEq[5].process(d);
        const float bl = bBuf[i];
        y[i] = (d * bl + clean[i] * (1.f - bl) * 0.9f) * lBuf[i];
      }
    }
    if (nOut == 2 && C == 1) std::memcpy(out[1], out[0], sizeof(float) * nn);
  }
  void reset() override
  {
    for (auto& s : ch) s = ChanState();
    for (auto& o : os) o.reset();
    curMode = -1;
  }
  static constexpr int kMaxBlockLocal = 4096;
};

// Clean boost / buffer (MXR Micro Amp, EP-style boosts, bass/treble boosters)
class BoostBlock : public Block
{
public:
  int pGain, pBass, pTreble, pLevel, pMode;
  float maxDb, minDb, bassF, trebleF;
  Biquad bass[2], treble[2];
  OnePole hp[2];
  Smoother sg;
  float sr = 48000, lb = -1, lt = -1;
  bool colored;
  BoostBlock(const json& o)
  {
    pGain = addParam("gain", 0.5f);
    pBass = addParam("bass", 0.5f);
    pTreble = addParam("treble", 0.5f);
    pLevel = addParam("level", 1.0f);
    pMode = addParam("mode", 0, 0, 3);
    maxDb = o.value("gainMaxDb", 20.f);
    minDb = o.value("gainMinDb", 0.f);
    bassF = o.value("bassF", 120.f);
    trebleF = o.value("trebleF", 3000.f);
    colored = o.value("colored", false);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    sg.setTime(30, sr);
    for (auto& h : hp) h.lp(colored ? 80.f : 15.f, sr);
    lb = lt = -1;
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    if (p(pBass) != lb || p(pTreble) != lt)
    {
      lb = p(pBass); lt = p(pTreble);
      for (int c = 0; c < 2; ++c)
      {
        bass[c].set(Biquad::LowShelf, bassF, 0.7, (lb - 0.5f) * 30.f, sr);
        treble[c].set(Biquad::HighShelf, trebleF, 0.7, (lt - 0.5f) * 30.f, sr);
      }
    }
    const float g = dbToGain(minDb + (maxDb - minDb) * p(pGain)) * p(pLevel);
    const int C = std::min(2, procChannels(nIn, nOut));
    for (int c = 0; c < C; ++c)
    {
      const float* x = in[std::min(c, nIn - 1)];
      float* y = out[std::min(c, nOut - 1)];
      Smoother s = sg;
      for (int i = 0; i < n; ++i)
      {
        float v = hp[c].processHP(x[i]) * s.next(g);
        v = treble[c].process(bass[c].process(v));
        // JFET-ish headroom: soft only when really pushed
        y[i] = colored ? shape::tube(v * 0.7f, 0.1f) * 1.43f : v / (1.f + 0.05f * v * v);
      }
      if (c == C - 1) sg = s;
    }
    if (nOut == 2 && C == 1) std::memcpy(out[1], out[0], sizeof(float) * n);
  }
};

RegisterBlock regDrive("drive", [](const json& o, int, int) { return std::make_unique<DriveBlock>(o); });
RegisterBlock regBoost("boost", [](const json& o, int, int) { return std::make_unique<BoostBlock>(o); });
} // namespace
} // namespace tz
