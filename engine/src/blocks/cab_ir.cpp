// Speaker cabinets (synthesised IRs with mic / position / distance) and user IR loader (multi-IR packs).
#include <random>

#include "../wavio.h"
#include "common.h"

namespace tz
{
namespace
{
// Hot-swappable convolver holder: control thread prepares, RT thread crossfades.
struct ConvSlot
{
  std::unique_ptr<Convolver> active, fading;
  std::atomic<Convolver*> pending{nullptr};
  std::atomic<Convolver*> retired{nullptr};
  int fadePos = -1, fadeLen = 960;
  std::vector<float> tmpA, tmpB;
  void prepare(int maxBlock, float sr)
  {
    tmpA.assign(maxBlock, 0.f);
    tmpB.assign(maxBlock, 0.f);
    fadeLen = int(0.03f * sr);
  }
  // control thread
  bool offer(std::unique_ptr<Convolver> c)
  {
    if (Convolver* r = retired.exchange(nullptr)) delete r;
    if (pending.load()) return false;
    pending.store(c.release());
    return true;
  }
  void collect()
  {
    if (Convolver* r = retired.exchange(nullptr)) delete r;
  }
  // RT
  void process(const float* in, float* out, int n)
  {
    if (Convolver* p = pending.exchange(nullptr))
    {
      if (fading)
      {
        Convolver* old = fading.release();
        if (Convolver* prevRet = retired.exchange(old)) delete prevRet; // (rare) — still RT-safe-ish fallback
      }
      fading = std::move(active);
      active.reset(p);
      fadePos = fading ? 0 : -1;
    }
    if (!active)
    {
      std::memcpy(out, in, sizeof(float) * n);
      return;
    }
    active->process(in, out, n);
    if (fadePos >= 0 && fading)
    {
      fading->process(in, tmpB.data(), n);
      for (int i = 0; i < n; ++i)
      {
        const float t = std::min(1.f, float(fadePos + i) / float(fadeLen));
        out[i] = out[i] * t + tmpB[i] * (1.f - t);
      }
      fadePos += n;
      if (fadePos >= fadeLen)
      {
        fadePos = -1;
        Convolver* old = fading.release();
        Convolver* expected = nullptr;
        if (!retired.compare_exchange_strong(expected, old)) fading.reset(old); // try again next block
      }
    }
  }
};

struct CabModel
{
  float hp = 80, hpQ = 1.2f, resDb = 3.f, lp = 5500, lpQ = 0.8f, lowShelfDb = 0;
  std::vector<EqBand> peaks;
  bool open = false;
  int seed = 1;
  float detail = 2.5f;
};

CabModel cabModel(const std::string& id)
{
  CabModel m;
  auto P = [](float f, float q, float db) { EqBand b; b.type = Biquad::Peak; b.f = f; b.q = q; b.db = db; return b; };
  if (id == "1x12us") { m.hp = 95; m.hpQ = 0.9f; m.resDb = 2; m.lp = 6000; m.open = true; m.peaks = {P(180, 1, 1), P(1200, 1.2f, -2), P(2600, 1.5f, 4), P(4300, 2, 2)}; m.seed = 11; }
  else if (id == "2x12twin") { m.hp = 85; m.hpQ = 1.0f; m.resDb = 2; m.lp = 6800; m.open = true; m.peaks = {P(400, 1, -1.5f), P(2800, 1.4f, 3.5f), P(5000, 2, 2.5f)}; m.seed = 12; }
  else if (id == "4x10tweed") { m.hp = 100; m.hpQ = 1.0f; m.resDb = 2; m.lp = 5200; m.open = true; m.peaks = {P(700, 1, 1.5f), P(2000, 1.4f, 3), P(3800, 2, 1.5f)}; m.seed = 13; }
  else if (id == "2x12blue") { m.hp = 100; m.hpQ = 1.1f; m.resDb = 3; m.lp = 6500; m.open = true; m.peaks = {P(900, 1, 1), P(2500, 1.2f, 5), P(4500, 2, 3)}; m.seed = 14; }
  else if (id == "4x12gb") { m.hp = 75; m.hpQ = 1.6f; m.resDb = 5; m.lp = 5000; m.peaks = {P(120, 1, 2), P(800, 0.9f, 1.5f), P(1900, 1.3f, 3), P(3200, 1.8f, 2)}; m.seed = 15; }
  else if (id == "4x12v30") { m.hp = 70; m.hpQ = 1.8f; m.resDb = 5.5f; m.lp = 5600; m.peaks = {P(110, 1, 2), P(1500, 1.2f, 2.5f), P(2900, 1.6f, 5), P(4600, 2.5f, 3)}; m.seed = 16; }
  else if (id == "4x12t75") { m.hp = 80; m.hpQ = 1.5f; m.resDb = 4; m.lp = 6000; m.peaks = {P(500, 1, -2), P(2200, 1.5f, 4), P(4000, 2, 4)}; m.seed = 17; }
  else if (id == "4x12uber") { m.hp = 65; m.hpQ = 1.9f; m.resDb = 6; m.lp = 5200; m.peaks = {P(100, 1, 3), P(1400, 1.2f, 2), P(2700, 1.5f, 4)}; m.seed = 18; }
  else if (id == "2x12cream") { m.hp = 80; m.hpQ = 1.4f; m.resDb = 4; m.lp = 5400; m.peaks = {P(700, 1, 1), P(2100, 1.3f, 2.5f), P(3500, 2, 1.5f)}; m.seed = 19; }
  else if (id == "1x12open") { m.hp = 110; m.hpQ = 0.8f; m.resDb = 1.5f; m.lp = 6200; m.open = true; m.peaks = {P(1100, 1, 1), P(2700, 1.4f, 4), P(4800, 2, 2.5f)}; m.seed = 20; }
  else if (id == "4x12orange") { m.hp = 70; m.hpQ = 1.7f; m.resDb = 5; m.lp = 5000; m.peaks = {P(250, 1, 2), P(1000, 1, 2), P(2400, 1.5f, 3)}; m.seed = 21; }
  else if (id == "2x12jc") { m.hp = 90; m.hpQ = 1.0f; m.resDb = 2; m.lp = 7500; m.open = true; m.peaks = {P(3000, 1.4f, 3), P(6000, 2, 3)}; m.seed = 22; }
  else if (id == "8x10svt") { m.hp = 45; m.hpQ = 1.3f; m.resDb = 4; m.lp = 4200; m.peaks = {P(80, 1, 3), P(500, 1, 2), P(1600, 1.3f, 2.5f), P(3000, 2, -3)}; m.seed = 23; m.detail = 1.5f; }
  else if (id == "4x10bass") { m.hp = 50; m.hpQ = 1.2f; m.resDb = 3; m.lp = 5000; m.peaks = {P(100, 1, 2), P(800, 1, 1), P(2500, 1.5f, 2)}; m.seed = 24; m.detail = 1.5f; }
  else if (id == "1x15bass") { m.hp = 40; m.hpQ = 1.1f; m.resDb = 3; m.lp = 3200; m.peaks = {P(70, 1, 3), P(400, 1, 2), P(1200, 1.2f, -2)}; m.seed = 25; m.detail = 1.2f; }
  else if (id == "2x10horn") { m.hp = 45; m.hpQ = 1.0f; m.resDb = 2; m.lp = 9000; m.peaks = {P(90, 1, 2), P(700, 1, 1), P(4500, 1.0f, 4)}; m.seed = 26; m.detail = 1.0f; }
  else if (id == "4x12bass") { m.hp = 55; m.hpQ = 1.2f; m.resDb = 3; m.lp = 4500; m.peaks = {P(90, 1, 2), P(1000, 1, 1.5f)}; m.seed = 27; }
  return m;
}

std::vector<float> synthCabIR(const CabModel& m, int micType, float pos, float dist, float sr, int len)
{
  const int N = 16384;
  std::vector<float> mag(N / 2 + 1, 1.f);
  std::vector<Biquad> f;
  Biquad b;
  b.set(Biquad::HP, m.hp, m.hpQ, 0, sr); f.push_back(b);
  b.set(Biquad::HP, m.hp * 0.7f, 0.6, 0, sr); f.push_back(b);
  b.set(Biquad::Peak, m.hp * 1.15f, 1.6, m.resDb, sr); f.push_back(b);
  // cone break-up roll-off, steeper towards the edge of the speaker
  const float lpF = m.lp * (1.25f - 0.55f * pos) * (1.f - 0.15f * dist);
  b.set(Biquad::LP, lpF, m.lpQ, 0, sr); f.push_back(b);
  b.set(Biquad::LP, lpF * 1.35f, 0.6, 0, sr); f.push_back(b);
  b.set(Biquad::LP, std::min(lpF * 2.2f, sr * 0.45f), 0.7, 0, sr); f.push_back(b);
  b.set(Biquad::Notch, std::min(lpF * 1.7f, sr * 0.45f), 3.0, 0, sr); f.push_back(b);
  for (auto& pk : m.peaks) { b.set(pk.type, pk.f, pk.q, pk.db, sr); f.push_back(b); }
  // position: centre (dust cap) is brighter / more "presence"; edge is darker and fatter
  b.set(Biquad::HighShelf, 2500, 0.7, 4.f - 10.f * pos, sr); f.push_back(b);
  b.set(Biquad::Peak, 400, 0.8, 2.5f * pos, sr); f.push_back(b);
  // proximity effect: close mic = more low end
  b.set(Biquad::LowShelf, 180, 0.7, 5.f * (1.f - dist) - 1.f, sr); f.push_back(b);
  // microphone colour
  if (micType == 0) { b.set(Biquad::Peak, 5500, 1.0, 5, sr); f.push_back(b); b.set(Biquad::HP, 90, 0.7, 0, sr); f.push_back(b); }   // dynamic '57'
  else if (micType == 1) { b.set(Biquad::HighShelf, 9000, 0.7, 2.5, sr); f.push_back(b); b.set(Biquad::Peak, 3000, 1, 1, sr); f.push_back(b); } // condenser
  else if (micType == 2) { b.set(Biquad::HighShelf, 4500, 0.6, -5, sr); f.push_back(b); b.set(Biquad::LowShelf, 150, 0.7, 2, sr); f.push_back(b); } // ribbon
  else { b.set(Biquad::Peak, 4000, 0.9, 3, sr); f.push_back(b); b.set(Biquad::Peak, 200, 1, -2, sr); f.push_back(b); }  // '421' style
  // speaker "detail": many narrow resonances / dips like a measured cab
  std::mt19937 rng(m.seed);
  std::uniform_real_distribution<float> uf(0.f, 1.f);
  for (int i = 0; i < 18; ++i)
  {
    const float fr = logMap(uf(rng), 600, std::min(lpF * 1.8f, sr * 0.45f));
    const float db = (uf(rng) * 2.f - 1.f) * m.detail * (1.f + pos);
    b.set(Biquad::Peak, fr, 3 + uf(rng) * 6, db, sr);
    f.push_back(b);
  }
  for (int k = 0; k <= N / 2; ++k)
  {
    const double fr = double(k) * sr / N;
    double g = 1;
    for (auto& q : f) g *= q.mag(std::max(fr, 1.0), sr);
    mag[k] = float(g);
  }
  auto ir = minimumPhaseFromMagnitude(mag, N, len);
  // room / distance: a couple of early reflections
  if (dist > 0.02f)
  {
    const int d1 = int((0.9f + 2.5f * dist) * 0.001f * sr), d2 = int((2.1f + 4.f * dist) * 0.001f * sr);
    std::vector<float> add(ir.size(), 0.f);
    for (size_t i = 0; i < ir.size(); ++i)
    {
      if (i + d1 < ir.size()) add[i + d1] += ir[i] * 0.35f * dist;
      if (i + d2 < ir.size()) add[i + d2] -= ir[i] * 0.22f * dist;
    }
    for (size_t i = 0; i < ir.size(); ++i) ir[i] += add[i];
  }
  // normalise to roughly unity loudness for a guitar-band signal
  double e = 0;
  for (float v : ir) e += v * v;
  const float s = e > 0 ? float(0.55 / std::sqrt(e)) : 1.f;
  for (auto& v : ir) v *= s;
  return ir;
}

class CabBlock : public Block
{
public:
  int pMic, pPos, pDist, pMic2, pPos2, pMix, pLowCut, pHighCut, pLevel, pModel;
  std::vector<std::string> models;
  ConvSlot slot[2];
  float sr = 48000;
  int part = 64;
  float last[8] = {-1, -1, -1, -1, -1, -1, -1, -1};
  Biquad lc[2], hc[2];
  float lastLc = -1, lastHc = -1;
  std::vector<float> m1, m2;
  bool dual = false;
  CabBlock(const json& o)
  {
    pMic = addParam("mic", o.value("mic", 0.f), 0, 3);
    pPos = addParam("position", 0.3f);
    pDist = addParam("distance", 0.15f);
    pMic2 = addParam("mic2", 2, 0, 3);
    pPos2 = addParam("position2", 0.5f);
    pMix = addParam("mix", 0.5f);
    pLowCut = addParam("lowcut", 30, 20, 500);
    pHighCut = addParam("highcut", 14000, 2000, 20000);
    pLevel = addParam("level", 0, -24, 12);
    if (o.contains("models")) for (auto& m : o["models"]) models.push_back(m.get<std::string>());
    else models.push_back(o.value("model", "4x12gb"));
    pModel = addParam("model", 0, 0, float(std::max<size_t>(1, models.size()) - 1));
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    part = c.hostBlock;
    dual = nOut > 1;
    for (auto& s : slot) s.prepare(c.maxBlock, sr);
    m1.assign(c.maxBlock, 0.f);
    m2.assign(c.maxBlock, 0.f);
    regen(true);
    // install synchronously before audio starts
    for (auto& s : slot)
      if (Convolver* p = s.pending.exchange(nullptr)) s.active.reset(p);
  }
  int irLen() const { return int(0.06f * sr); }
  void regen(bool force)
  {
    const float cur[6] = {p(pMic), p(pPos), p(pDist), p(pMic2), p(pPos2), p(pModel)};
    bool ch1 = force, ch2 = force;
    for (int i = 0; i < 3; ++i) if (cur[i] != last[i]) ch1 = true;
    for (int i = 3; i < 5; ++i) if (cur[i] != last[i]) ch2 = true;
    if (cur[5] != last[5]) ch1 = ch2 = true;
    const auto& model = cabModel(models[std::max(0, std::min(int(models.size()) - 1, int(std::round(cur[5]))))]);
    if (ch1)
    {
      auto ir = synthCabIR(model, int(std::round(cur[0])), cur[1], cur[2], sr, irLen());
      auto cv = std::make_unique<Convolver>();
      cv->prepare(part);
      cv->setIR(ir.data(), int(ir.size()));
      if (slot[0].offer(std::move(cv))) for (int i = 0; i < 3; ++i) last[i] = cur[i];
    }
    if (ch2 && dual)
    {
      auto ir = synthCabIR(model, int(std::round(cur[3])), cur[4], cur[2], sr, irLen());
      auto cv = std::make_unique<Convolver>();
      cv->prepare(part);
      cv->setIR(ir.data(), int(ir.size()));
      if (slot[1].offer(std::move(cv))) for (int i = 3; i < 5; ++i) last[i] = cur[i];
    }
    last[5] = cur[5];
  }
  void controlTick() override
  {
    for (auto& s : slot) s.collect();
    regen(false);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    if (p(pLowCut) != lastLc || p(pHighCut) != lastHc)
    {
      lastLc = p(pLowCut); lastHc = p(pHighCut);
      for (int c = 0; c < 2; ++c) { lc[c].set(Biquad::HP, lastLc, 0.707, 0, sr); hc[c].set(Biquad::LP, lastHc, 0.707, 0, sr); }
    }
    const float g = dbToGain(p(pLevel));
    const float* x = in[0];
    if (nIn > 1)
    {
      for (int i = 0; i < n; ++i) m2[i] = 0.5f * (in[0][i] + in[1][i]);
      x = m2.data();
    }
    slot[0].process(x, m1.data(), n);
    if (dual)
    {
      slot[1].process(x, out[1], n);
      const float mix = p(pMix);
      // stereo: L = mic 1, R = mic 2 (mix knob blends towards mono)
      for (int i = 0; i < n; ++i)
      {
        const float a = m1[i], b = out[1][i];
        const float l = a * (1.f - mix * 0.5f) + b * mix * 0.5f;
        const float r = b * (1.f - mix * 0.5f) + a * mix * 0.5f;
        out[0][i] = hc[0].process(lc[0].process(l)) * g;
        out[1][i] = hc[1].process(lc[1].process(r)) * g;
      }
    }
    else
      for (int i = 0; i < n; ++i) out[0][i] = hc[0].process(lc[0].process(m1[i])) * g;
  }
};

// ---------------- User IR loader (multi-IR packs) ----------------
class IRBlock : public Block
{
public:
  int pModel, pMix, pLowCut, pHighCut, pLevel;
  struct IR { std::vector<std::unique_ptr<Convolver>> conv; std::string name; };
  std::vector<IR> irs;
  int cur = -1, prev = -1, fadePos = -1, fadeLen = 1440;
  std::vector<float> tA[2], tB[2], dry;
  Biquad lc[2], hc[2];
  float lastLc = -1, lastHc = -1, sr = 48000;
  IRBlock(const json& o)
  {
    int count = o.contains("files") ? int(o["files"].size()) : 1;
    pModel = addParam("model", 0, 0, float(std::max(1, count) - 1));
    pMix = addParam("mix", 1.f);
    pLowCut = addParam("lowcut", 20, 20, 500);
    pHighCut = addParam("highcut", 20000, 2000, 20000);
    pLevel = addParam("level", 0, -24, 12);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    fadeLen = int(0.03f * sr);
    for (int k = 0; k < 2; ++k) { tA[k].assign(c.maxBlock, 0.f); tB[k].assign(c.maxBlock, 0.f); }
    dry.assign(c.maxBlock, 0.f);
    const float maxSec = c.quality == 0 ? 0.12f : c.quality == 1 ? 0.25f : c.quality == 2 ? 0.6f : 1.5f;
    irs.clear();
    json info = json::array();
    if (opts.contains("files"))
      for (auto& fj : opts["files"])
      {
        const std::string path = fj.get<std::string>();
        std::vector<std::vector<float>> ch;
        double fsr = 0;
        IR ir;
        ir.name = path.substr(path.find_last_of('/') + 1);
        if (!readWav(path, ch, fsr))
        {
          loadError += "Could not read IR " + path + ". ";
          irs.push_back(std::move(ir));
          continue;
        }
        const int outCh = std::min<int>(nOut, int(ch.size()));
        for (int k = 0; k < std::max(1, outCh); ++k)
        {
          auto data = resampleSinc(ch[k], fsr, sr);
          if (int(data.size()) > int(maxSec * sr)) data.resize(int(maxSec * sr));
          // trim trailing silence
          int last = int(data.size()) - 1;
          while (last > 64 && std::fabs(data[last]) < 1e-5f) --last;
          data.resize(last + 1);
          auto cv = std::make_unique<Convolver>();
          cv->prepare(c.hostBlock);
          cv->setIR(data.data(), int(data.size()));
          ir.conv.push_back(std::move(cv));
        }
        info.push_back({{"name", ir.name}, {"channels", ch.size()}, {"sr", fsr}, {"len", ch.empty() ? 0 : ch[0].size()}});
        irs.push_back(std::move(ir));
      }
    this->info = {{"irs", info}};
    cur = -1;
  }
  void runIR(int idx, const float* x, float** o, int n)
  {
    auto& ir = irs[idx];
    if (ir.conv.empty())
    {
      for (int c = 0; c < std::max(1, nOut); ++c) std::memcpy(o[c], x, sizeof(float) * n);
      return;
    }
    for (int c = 0; c < std::max(1, nOut); ++c)
    {
      if (c < int(ir.conv.size())) ir.conv[c]->process(x, o[c], n);
      else std::memcpy(o[c], o[0], sizeof(float) * n);
    }
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    if (irs.empty())
    {
      for (int c = 0; c < nOut; ++c) std::memcpy(out[c], in[std::min(c, nIn - 1)], sizeof(float) * n);
      return;
    }
    if (p(pLowCut) != lastLc || p(pHighCut) != lastHc)
    {
      lastLc = p(pLowCut); lastHc = p(pHighCut);
      for (int c = 0; c < 2; ++c) { lc[c].set(Biquad::HP, lastLc, 0.707, 0, sr); hc[c].set(Biquad::LP, lastHc, 0.707, 0, sr); }
    }
    const int want = std::max(0, std::min(int(irs.size()) - 1, int(std::round(p(pModel)))));
    if (cur < 0) cur = want;
    if (want != cur && fadePos < 0) { prev = cur; cur = want; fadePos = 0; }
    const float* x = in[0];
    if (nIn > 1) { for (int i = 0; i < n; ++i) dry[i] = 0.5f * (in[0][i] + in[1][i]); x = dry.data(); }
    float* oa[2] = {tA[0].data(), tA[1].data()};
    runIR(cur, x, oa, n);
    if (fadePos >= 0)
    {
      float* ob[2] = {tB[0].data(), tB[1].data()};
      runIR(prev, x, ob, n);
      for (int c = 0; c < std::max(1, nOut); ++c)
        for (int i = 0; i < n; ++i)
        {
          const float t = std::min(1.f, float(fadePos + i) / fadeLen);
          oa[c][i] = oa[c][i] * t + ob[c][i] * (1 - t);
        }
      fadePos += n;
      if (fadePos >= fadeLen) fadePos = -1;
    }
    const float g = dbToGain(p(pLevel)), mix = p(pMix);
    for (int c = 0; c < std::max(1, nOut); ++c)
      for (int i = 0; i < n; ++i)
      {
        const float w = hc[c].process(lc[c].process(oa[c][i]));
        out[c][i] = (w * mix + in[std::min(c, nIn - 1)][i] * (1 - mix)) * g;
      }
  }
};

RegisterBlock r1("cab", [](const json& o, int, int) { return std::make_unique<CabBlock>(o); });
RegisterBlock r2("ir", [](const json& o, int, int) { return std::make_unique<IRBlock>(o); });
} // namespace
} // namespace tz
