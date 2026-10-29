// Composite block: several sub-blocks in series inside one pedal (multi-effects like the POD Express,
// dual pedals like tremolo+reverb). Sub-block params are exposed as "<prefix>.<param>", and each
// sub-block gets an "<prefix>.on" switch.
#include "common.h"

namespace tz
{
namespace
{
class ChainBlock : public Block
{
public:
  struct Sub
  {
    std::string prefix;
    std::unique_ptr<Block> b;
    std::vector<std::pair<int, int>> map; // (my param index, sub param index)
    int onParam = -1;
    std::vector<std::string> selectModels; // optional: "<prefix>.sel" chooses between alternatives
    float onMix = 1.f;
    int group = 0;   // >0: consecutive subs with the same group run in parallel from the same input
    int ch = -1;     // 0 / 1: the sub only processes that input channel (per-channel lanes)
    int lvlParam = -1;
  };
  int mixParam = -1;
  std::vector<std::vector<float>> dry, acc, lane;
  std::vector<Sub> subs;
  std::vector<std::vector<float>> bufA, bufB;
  std::vector<float> sc[2];
  int C = 1;
  float fadeStep = 0.01f;
  ChainBlock(const json& o, int nIn, int nOut)
  {
    C = std::min(2, std::max(nIn, nOut));
    for (auto& sj : o.value("chain", json::array()))
    {
      Sub s;
      s.prefix = sj.value("prefix", "fx");
      s.b = createBlock(sj.value("algo", "utility"), sj.value("opts", json::object()), C, C);
      if (!s.b) continue;
      for (size_t i = 0; i < s.b->defs.size(); ++i)
      {
        const auto& d = s.b->defs[i];
        float def = d.def;
        if (sj.contains("params") && sj["params"].contains(d.name)) def = sj["params"][d.name].get<float>();
        const int mine = addParam(s.prefix + "." + d.name, def, d.min, d.max);
        s.map.push_back({mine, int(i)});
      }
      s.onParam = addParam(s.prefix + ".on", sj.value("on", true) ? 1.f : 0.f, 0, 1);
      s.onMix = sj.value("on", true) ? 1.f : 0.f; // start silent if the sub starts off
      s.group = sj.value("group", 0);
      s.ch = sj.value("ch", -1);
      if (s.ch >= C) s.ch = -1;
      if (sj.value("lvl", false) || s.group > 0) s.lvlParam = addParam(s.prefix + ".lvl", sj.value("lvlDef", 1.f), 0.f, 2.f);
      subs.push_back(std::move(s));
    }
    if (o.value("mix", false)) mixParam = addParam("mix", o.value("mixDef", 1.f), 0.f, 1.f);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    for (auto& s : subs)
    {
      s.b->nIn = C;
      s.b->nOut = C;
      s.b->inConnected = C == 2 ? 3u : 1u;
      s.b->prepare(c);
    }
    bufA.assign(C, std::vector<float>(c.maxBlock, 0.f));
    bufB.assign(C, std::vector<float>(c.maxBlock, 0.f));
    sc[0].assign(c.maxBlock, 0.f);
    sc[1].assign(c.maxBlock, 0.f);
    dry.assign(C, std::vector<float>(c.maxBlock, 0.f));
    acc.assign(C, std::vector<float>(c.maxBlock, 0.f));
    lane.assign(C, std::vector<float>(c.maxBlock, 0.f));
    fadeStep = 1.f;
  }
  bool hasTrails() const override { return true; }
  void onEvent(const BlockEvent& e) override
  {
    // events are routed to the sub-block at index e.arg / 100, inner arg e.arg % 100
    const int si = e.arg / 100;
    if (si >= 0 && si < int(subs.size()))
    {
      BlockEvent inner = e;
      inner.arg = e.arg % 100;
      subs[si].b->onEvent(inner);
    }
  }
  float stepMix(Sub& s, int n, float& m0)
  {
    const float step = float(n) / 480.f;
    const float target = p(s.onParam) > 0.5f ? 1.f : 0.f;
    m0 = s.onMix;
    const float m1 = m0 < target ? std::min(target, m0 + step) : std::max(target, m0 - step);
    s.onMix = m1;
    return m1;
  }
  void syncParams(Sub& s)
  {
    for (auto& [mine, theirs] : s.map) s.b->vals[theirs].store(p(mine), std::memory_order_relaxed);
  }
  // one sub in series (optionally on a single channel)
  void runSeries(Sub& s, int n)
  {
    syncParams(s);
    float m0;
    const float m1 = stepMix(s, n, m0);
    if (m0 == 0.f && m1 == 0.f && !s.b->hasTrails()) return;
    const float g = s.lvlParam >= 0 ? p(s.lvlParam) : 1.f;
    const bool trails = s.b->hasTrails() && (m0 < 1.f || m1 < 1.f);
    const int c0 = s.ch >= 0 ? s.ch : 0, c1 = s.ch >= 0 ? s.ch : C - 1;
    const float* src[2] = {bufA[c0].data(), bufA[c1].data()};
    if (trails)
    {
      for (int c = 0; c < 2 && c < C; ++c)
        for (int i = 0; i < n; ++i) sc[c][i] = src[c][i] * (m0 + (m1 - m0) * float(i) / n);
      src[0] = sc[0].data();
      src[1] = sc[C > 1 ? 1 : 0].data();
    }
    float* op[2] = {bufB[0].data(), bufB[C - 1].data()};
    s.b->process(src, op, n);
    for (int c = 0; c < C; ++c)
    {
      if (s.ch >= 0 && c != s.ch) continue;
      const float* w = s.ch >= 0 ? bufB[0].data() : bufB[c].data();
      for (int i = 0; i < n; ++i)
      {
        const float m = m0 + (m1 - m0) * float(i) / n;
        bufA[c][i] = trails ? w[i] * g + bufA[c][i] * (1.f - m) : w[i] * g * m + bufA[c][i] * (1.f - m);
      }
    }
  }
  // subs [a, b) run in parallel from the same input; outputs summed (normalised by the number of active lanes)
  void runParallel(size_t a, size_t b, int n)
  {
    for (int c = 0; c < C; ++c) std::fill(acc[c].begin(), acc[c].begin() + n, 0.f);
    float mSum0 = 0.f, mSum1 = 0.f;
    for (size_t k = a; k < b; ++k)
    {
      Sub& s = subs[k];
      syncParams(s);
      float m0;
      const float m1 = stepMix(s, n, m0);
      mSum0 += m0;
      mSum1 += m1;
      if (m0 == 0.f && m1 == 0.f && !s.b->hasTrails()) continue;
      const float g = s.lvlParam >= 0 ? p(s.lvlParam) : 1.f;
      for (int c = 0; c < C; ++c)
        for (int i = 0; i < n; ++i) lane[c][i] = bufA[c][i] * (m0 + (m1 - m0) * float(i) / n);
      const float* ip[2] = {lane[0].data(), lane[C - 1].data()};
      float* op[2] = {bufB[0].data(), bufB[C - 1].data()};
      s.b->process(ip, op, n);
      for (int c = 0; c < C; ++c)
        for (int i = 0; i < n; ++i) acc[c][i] += bufB[c][i] * g;
    }
    for (int i = 0; i < n; ++i)
    {
      const float t = float(i) / n;
      const float ms = mSum0 + (mSum1 - mSum0) * t;
      const float norm = 1.f / std::max(1.f, ms);
      const float dryAmt = std::max(0.f, 1.f - ms);
      for (int c = 0; c < C; ++c) bufA[c][i] = acc[c][i] * norm + bufA[c][i] * dryAmt;
    }
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    for (int c = 0; c < C; ++c) std::memcpy(bufA[c].data(), in[std::min(c, nIn - 1)], sizeof(float) * n);
    if (mixParam >= 0)
      for (int c = 0; c < C; ++c) std::memcpy(dry[c].data(), bufA[c].data(), sizeof(float) * n);
    for (size_t i = 0; i < subs.size();)
    {
      if (subs[i].group > 0)
      {
        size_t j = i + 1;
        while (j < subs.size() && subs[j].group == subs[i].group) ++j;
        runParallel(i, j, n);
        i = j;
      }
      else
        runSeries(subs[i++], n);
    }
    if (mixParam >= 0)
    {
      const float m = p(mixParam);
      for (int c = 0; c < C; ++c)
        for (int i = 0; i < n; ++i) bufA[c][i] = dry[c][i] * (1.f - m) + bufA[c][i] * m;
    }
    // extra outputs (XLR, phones, second pair) repeat the L/R pattern
    for (int c = 0; c < nOut; ++c) std::memcpy(out[c], bufA[c % C].data(), sizeof(float) * n);
  }
  void controlTick() override
  {
    for (auto& s : subs) s.b->controlTick();
  }
  void status(json& j) override
  {
    for (size_t i = 0; i < subs.size(); ++i)
    {
      json sj = json::object();
      subs[i].b->status(sj);
      if (!sj.empty()) j[subs[i].prefix] = sj;
    }
  }
  void reset() override
  {
    for (auto& s : subs) s.b->reset();
  }
};

RegisterBlock r1("chain", [](const json& o, int nIn, int nOut) { return std::make_unique<ChainBlock>(o, nIn, nOut); });
} // namespace
} // namespace tz
