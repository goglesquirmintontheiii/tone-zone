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
  };
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
      subs.push_back(std::move(s));
    }
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
  void process(const float* const* in, float* const* out, int n) override
  {
    for (int c = 0; c < C; ++c) std::memcpy(bufA[c].data(), in[std::min(c, nIn - 1)], sizeof(float) * n);
    const float step = float(n) / 480.f;
    for (auto& s : subs)
    {
      for (auto& [mine, theirs] : s.map) s.b->vals[theirs].store(p(mine), std::memory_order_relaxed);
      const float target = p(s.onParam) > 0.5f ? 1.f : 0.f;
      const float m0 = s.onMix;
      float m1 = m0 < target ? std::min(target, m0 + step) : std::max(target, m0 - step);
      s.onMix = m1;
      if (m0 == 0.f && m1 == 0.f && !s.b->hasTrails()) continue;
      const float* ip[2] = {bufA[0].data(), bufA[C - 1].data()};
      float* op[2] = {bufB[0].data(), bufB[C - 1].data()};
      // trails: fade the sub-block's input, keep processing so tails ring out
      if (s.b->hasTrails() && (m0 < 1.f || m1 < 1.f))
      {
        auto& scaled = sc;
        for (int c = 0; c < C; ++c)
        {
          for (int i = 0; i < n; ++i) scaled[c][i] = bufA[c][i] * (m0 + (m1 - m0) * float(i) / n);
        }
        const float* sp[2] = {scaled[0].data(), scaled[C - 1].data()};
        s.b->process(sp, op, n);
        for (int c = 0; c < C; ++c)
          for (int i = 0; i < n; ++i) bufA[c][i] = bufB[c][i] + bufA[c][i] * (1.f - (m0 + (m1 - m0) * float(i) / n));
      }
      else
      {
        s.b->process(ip, op, n);
        for (int c = 0; c < C; ++c)
          for (int i = 0; i < n; ++i)
          {
            const float m = m0 + (m1 - m0) * float(i) / n;
            bufA[c][i] = bufB[c][i] * m + bufA[c][i] * (1.f - m);
          }
      }
    }
    for (int c = 0; c < nOut; ++c) std::memcpy(out[c], bufA[std::min(c, C - 1)].data(), sizeof(float) * n);
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
