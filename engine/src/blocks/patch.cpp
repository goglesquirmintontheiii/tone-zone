// Patch block: a Pedal Factory circuit. Sub-blocks (any engine algorithm, made with createBlock like 'chain')
// and small native parts (filters, VCAs, mixers, envelope followers, LFOs, logic, comparators...) wired as a
// graph. Audio runs in chunks of up to 64 samples in topological order; control wires carry values (floats in
// -255..255) that are evaluated once per chunk. A normal slot reads its input span (xlo..xhi, default 0..1) as
// 0..1 and scales that into its own range lo..hi; a raw slot takes the value as it is (clamped to lo..hi).
// Audio loops are only allowed through 'fb' parts (a delay of at least one chunk); control loops read the
// previous chunk's value. 'cout' parts are circuit outputs: their values are reported in the status as cv[idx]
// (null for outputs this patch does not have).
// A pedal with an effects loop runs as two patches (before the sends, after the returns) wired on the board:
// 'cvsend' turns a control value into an audio channel and 'cvrecv' reads it back, so control wires can cross
// from one half to the other in the same cycle; an 'ain' with idx2 reads its right channel from another input.
//
// opts: { params: [{name, def, min, max}],            exposed params (the pedal's circuit inputs)
//         nodes:  [{k, algo?, opts?, idx?, pi?, tap?, slots: [{p, def, lo, hi, log, int, tab, raw, xlo, xhi}]}],
//         edges:  [[fromNode, fromPort, toNode, toPort, isControl]],
//         outs:   [[aoutIdx, ch]] per engine output (ch 0 = L, 1 = R, -1 = mono sum), mix, mixDef,
//         ch:     internal channels (1 or 2, default from the block's inputs and outputs) }
#include "common.h"

namespace tz
{
namespace
{
constexpr int kChunk = 64;
constexpr float kLim = 255.f;     // control values stay within -255..255
constexpr float kMaxDelay = 10.f; // seconds a control delay can hold

enum Kind
{
  K_ALGO, K_SUM, K_AIN, K_AOUT, K_VCA, K_FILTER, K_SHAPER, K_MIXER, K_XFADE, K_SWITCH, K_POL, K_FB, K_BYPASS,
  K_PARAM, K_CONST, K_LFO, K_ENV, K_SEQ, K_SCALE, K_MATH, K_SMOOTH, K_SH, K_AND, K_OR, K_XOR, K_NOT, K_TOGGLE,
  K_CMP, K_WINDOW, K_ADD, K_SUB, K_MUL, K_DIV, K_CDELAY, K_COUT, K_CVSEND, K_CVRECV, K_UNKNOWN
};
struct KindInfo
{
  const char* name;
  Kind k;
  int ain, aout, cout;
  std::vector<const char*> slots; // native slot names, in the order the code reads them
};
const std::vector<KindInfo>& kinds()
{
  static const std::vector<KindInfo> v = {
    {"sum", K_SUM, 1, 1, 0, {}},
    {"ain", K_AIN, 0, 1, 0, {}},
    {"aout", K_AOUT, 1, 0, 0, {}},
    {"vca", K_VCA, 1, 1, 0, {"gain"}},
    {"filter", K_FILTER, 1, 1, 0, {"freq", "res", "mode"}},
    {"shaper", K_SHAPER, 1, 1, 0, {"drive", "mode", "mix", "level"}},
    {"mixer", K_MIXER, 4, 1, 0, {"g1", "g2", "g3", "g4"}},
    {"xfade", K_XFADE, 2, 1, 0, {"mix"}},
    {"switch", K_SWITCH, 2, 1, 0, {"sel"}},
    {"pol", K_POL, 1, 1, 0, {"on"}},
    {"fb", K_FB, 1, 1, 0, {"amount", "time", "tone"}},
    {"bypass", K_BYPASS, 2, 1, 0, {"on"}},
    {"param", K_PARAM, 0, 0, 1, {"in"}},
    {"const", K_CONST, 0, 0, 1, {"value"}},
    {"lfo", K_LFO, 0, 0, 1, {"rate", "shape", "lo", "hi", "sync"}},
    {"env", K_ENV, 1, 0, 1, {"sens", "attack", "release"}},
    {"seq", K_SEQ, 0, 0, 1, {"rate", "steps", "glide", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"}},
    {"scale", K_SCALE, 0, 0, 1, {"in", "lo", "hi", "curve", "invert"}},
    {"math", K_MATH, 0, 0, 1, {"a", "b", "op"}},
    {"smooth", K_SMOOTH, 0, 0, 1, {"in", "time"}},
    {"sh", K_SH, 0, 0, 1, {"in", "trig"}},
    {"and", K_AND, 0, 0, 1, {"a", "b"}},
    {"or", K_OR, 0, 0, 1, {"a", "b"}},
    {"xor", K_XOR, 0, 0, 1, {"a", "b"}},
    {"not", K_NOT, 0, 0, 1, {"a"}},
    {"toggle", K_TOGGLE, 0, 0, 1, {"trig", "reset"}},
    {"cmp", K_CMP, 0, 0, 1, {"in", "thr", "hyst"}},
    {"window", K_WINDOW, 0, 0, 1, {"in", "lo", "hi"}},
    {"add", K_ADD, 0, 0, 1, {"a", "b"}},
    {"sub", K_SUB, 0, 0, 1, {"a", "b"}},
    {"mul", K_MUL, 0, 0, 1, {"a", "b"}},
    {"div", K_DIV, 0, 0, 1, {"a", "b"}},
    {"cdelay", K_CDELAY, 0, 0, 1, {"in", "time"}},
    {"cout", K_COUT, 0, 0, 1, {"in"}},
    {"cvsend", K_CVSEND, 0, 1, 0, {"in"}},
    {"cvrecv", K_CVRECV, 1, 0, 1, {}},
  };
  return v;
}

struct Slot
{
  std::string name;
  float def = 0, lo = 0, hi = 1;
  bool log = false, isInt = false, raw = false;
  float xlo = 0, xhi = 1;   // input span read as 0..1 (normal slots)
  std::vector<float> tab; // optional lookup: 0..1 picks an entry
  int sub = -1;          // algo nodes: sub-block param index (-1 = the 'on' switch)
  std::vector<std::pair<int, int>> src; // (node, control out port)
  float v = 0;           // current value
};

struct Node
{
  Kind kind = K_UNKNOWN;
  std::unique_ptr<Block> b;
  int ain = 1, aout = 1, cout = 0;
  std::vector<Slot> slots;
  std::vector<int> nat;  // native slot name index -> my slot index (-1 = not sent, use default)
  std::vector<float> natDef;
  std::vector<std::vector<int>> inSrc; // per audio input: source buffer ids
  std::vector<int> inBuf;              // per audio input: buffer id to read (-1 silent, -2 summed into scratch)
  std::vector<int> outBuf;             // per audio output: buffer id
  std::vector<float> cv;               // control outputs
  int idx = 0, idx2 = -1, pi = -1, tap = -1;
  bool late = false;                   // fb: its input is read at the end of the chunk
  // state
  float on = 1.f, m = 1.f, g = 0.f, fz = 0.f, x1 = 0.f, ph = 0.f, last = 0.f;
  int step = 0, prevTrig = 0;
  uint32_t rng = 0x9e3779b9u;
  bool latch = false, first = true;
  std::vector<float> hist; // cdelay: one value per chunk
  int hpos = 0;
  SVF svf[2];
  OnePole lp[2];
  EnvFollower env;
  DelayLine dl[2];
  TapTempo tt;
  float tapHz = 0.f;
};

class PatchBlock : public Block
{
public:
  int C = 1;
  double sr = 48000;
  std::vector<Node> nodes;
  std::vector<int> order;
  std::vector<std::vector<float>> bufs; // C channels per buffer: buffer id * C + c
  std::vector<float> silent, scratch[2][4];
  std::vector<std::array<int, 2>> outs;
  std::vector<int> aoutNode;
  std::vector<float> dryBuf[2];
  int mixParam = -1, ain0 = -1;
  int nBufs = 0;

  int buf(int id, int c) const { return id * C + c; }

  PatchBlock(const json& o, int nIn, int nOut)
  {
    C = std::min(2, std::max(1, o.value("ch", std::max(nIn, nOut))));
    for (auto& pj : o.value("params", json::array()))
      addParam(pj.value("name", "p"), pj.value("def", 0.f), pj.value("min", 0.f), pj.value("max", 1.f));
    if (o.value("mix", false)) mixParam = addParam("mix", o.value("mixDef", 1.f), 0.f, 1.f);
    finalizeParams();
    const auto& K = kinds();
    for (auto& nj : o.value("nodes", json::array()))
    {
      Node n;
      const std::string k = nj.value("k", "sum");
      n.idx = nj.value("idx", 0);
      n.idx2 = nj.value("idx2", -1);
      n.pi = nj.value("pi", -1);
      n.tap = nj.value("tap", -1);
      if (k == "algo")
      {
        n.kind = K_ALGO;
        n.b = createBlock(nj.value("algo", "utility"), nj.value("opts", json::object()), C, C);
        if (!n.b) n.kind = K_SUM; // unknown algorithm: pass through
        n.ain = n.aout = 1;
      }
      else
      {
        for (auto& ki : K)
          if (k == ki.name)
          {
            n.kind = ki.k;
            n.ain = ki.ain;
            n.aout = ki.aout;
            n.cout = ki.cout;
            n.nat.assign(ki.slots.size(), -1);
            n.natDef.assign(ki.slots.size(), 0.f);
          }
        if (n.kind == K_UNKNOWN) n.kind = K_SUM, n.ain = n.aout = 1;
      }
      for (auto& sj : nj.value("slots", json::array()))
      {
        Slot s;
        s.name = sj.value("p", "");
        s.def = sj.value("def", 0.f);
        s.lo = sj.value("lo", 0.f);
        s.hi = sj.value("hi", 1.f);
        s.log = sj.value("log", false) && s.lo > 0 && s.hi > 0;
        s.isInt = sj.value("int", false);
        s.raw = sj.value("raw", false);
        s.xlo = sj.value("xlo", 0.f);
        s.xhi = sj.value("xhi", 1.f);
        for (auto& tv : sj.value("tab", json::array()))
          if (tv.is_number()) s.tab.push_back(tv.get<float>());
        s.v = s.def;
        if (n.kind == K_ALGO && n.b)
        {
          s.sub = -2;
          if (s.name == "on") s.sub = -1;
          else if (n.b->index.count(s.name)) s.sub = n.b->index[s.name];
          if (s.sub >= 0) n.b->setParam(s.name, s.def);
        }
        n.slots.push_back(s);
      }
      if (n.kind == K_ALGO && n.b && nj.contains("params"))
        for (auto& [pk, pv] : nj["params"].items())
          if (pv.is_number()) n.b->setParam(pk, pv.get<float>());
      // native slots by name
      for (auto& ki : K)
        if (ki.k == n.kind && n.kind != K_ALGO)
          for (size_t a = 0; a < ki.slots.size(); ++a)
            for (size_t b = 0; b < n.slots.size(); ++b)
              if (n.slots[b].name == ki.slots[a]) n.nat[a] = int(b);
      n.cv.assign(std::max(1, n.cout), 0.f);
      n.inSrc.assign(n.ain, {});
      n.inBuf.assign(n.ain, -1);
      n.late = n.kind == K_FB;
      nodes.push_back(std::move(n));
    }
    // buffers: one per audio output port
    for (auto& n : nodes)
      for (int a = 0; a < n.aout; ++a) n.outBuf.push_back(nBufs++);
    // edges
    const int N = int(nodes.size());
    std::vector<std::vector<int>> deps(N);
    for (auto& e : o.value("edges", json::array()))
    {
      if (!e.is_array() || e.size() < 5) continue;
      const int f = e[0], fp = e[1], t = e[2], tp = e[3];
      const bool ctl = e[4].get<int>() != 0;
      if (f < 0 || f >= N || t < 0 || t >= N || f == t) continue;
      Node& a = nodes[f];
      Node& b = nodes[t];
      if (ctl)
      {
        if (fp < 0 || fp >= a.cout || tp < 0 || tp >= int(b.slots.size())) continue;
        b.slots[tp].src.push_back({f, fp});
        deps[t].push_back(f);
      }
      else
      {
        if (fp < 0 || fp >= a.aout || tp < 0 || tp >= b.ain) continue;
        b.inSrc[tp].push_back(a.outBuf[fp]);
        if (!b.late) deps[t].push_back(f);
      }
    }
    sortNodes(deps);
    for (auto& oj : o.value("outs", json::array()))
      if (oj.is_array() && oj.size() >= 2) outs.push_back({oj[0].get<int>(), oj[1].get<int>()});
    for (int i = 0; i < N; ++i)
    {
      if (nodes[i].kind == K_AOUT)
      {
        if (int(aoutNode.size()) <= nodes[i].idx) aoutNode.resize(nodes[i].idx + 1, -1);
        aoutNode[nodes[i].idx] = i;
      }
      if (nodes[i].kind == K_AIN && nodes[i].idx == 0 && ain0 < 0) ain0 = i;
    }
  }
  // Kahn's sort; nodes left in a loop go in anyway (their unresolved inputs read the last chunk)
  void sortNodes(std::vector<std::vector<int>>& deps)
  {
    const int N = int(nodes.size());
    std::vector<int> indeg(N, 0);
    std::vector<std::vector<int>> outs2(N);
    for (int t = 0; t < N; ++t)
      for (int f : deps[t])
      {
        indeg[t]++;
        outs2[f].push_back(t);
      }
    std::vector<char> done(N, 0);
    std::vector<int> q;
    for (int i = 0; i < N; ++i)
      if (!indeg[i]) q.push_back(i);
    while ((int)order.size() < N)
    {
      if (q.empty())
      {
        int best = -1;
        for (int i = 0; i < N; ++i)
          if (!done[i] && (best < 0 || indeg[i] < indeg[best])) best = i;
        q.push_back(best);
      }
      const int n = q.back();
      q.pop_back();
      if (done[n]) continue;
      done[n] = 1;
      order.push_back(n);
      for (int t : outs2[n])
        if (--indeg[t] == 0 && !done[t]) q.push_back(t);
    }
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = c.sr;
    PrepareCtx sub = c;
    sub.maxBlock = std::max(kChunk, std::min(c.maxBlock, kChunk));
    bufs.assign(size_t(nBufs) * C, std::vector<float>(kChunk, 0.f));
    silent.assign(kChunk, 0.f);
    for (int c2 = 0; c2 < 2; ++c2)
    {
      dryBuf[c2].assign(kChunk, 0.f);
      for (int k = 0; k < 4; ++k) scratch[c2][k].assign(kChunk, 0.f);
    }
    for (auto& n : nodes)
    {
      if (n.kind == K_ALGO && n.b)
      {
        n.b->nIn = C;
        n.b->nOut = C;
        n.b->inConnected = C == 2 ? 3u : 1u;
        n.b->prepare(sub);
      }
      if (n.kind == K_FB)
        for (int c2 = 0; c2 < C; ++c2) n.dl[c2].allocate(int(sr * 2.1) + kChunk * 4);
      if (n.kind == K_CDELAY)
      {
        n.hist.assign(size_t(kMaxDelay * sr / kChunk) + 4, 0.f);
        n.hpos = 0;
      }
      // per input: read the single source directly, sum several into the node's own buffer
      for (int a = 0; a < n.ain; ++a) n.inBuf[a] = n.inSrc[a].empty() ? -1 : n.inSrc[a].size() == 1 ? n.inSrc[a][0] : -2;
    }
    // node scratch for summed inputs: a buffer per input port of each node that needs one
    for (auto& n : nodes)
      for (int a = 0; a < n.ain; ++a)
        if (n.inBuf[a] == -2) n.inBuf[a] = -3 - a; // marker: summed at run time into scratch[c][a]
  }
  bool hasTrails() const override { return true; }
  void onEvent(const BlockEvent& e) override
  {
    // events go to tap group e.arg / 100 (the circuit), inner arg e.arg % 100
    const int grp = e.arg / 100;
    BlockEvent inner = e;
    inner.arg = e.arg % 100;
    for (auto& n : nodes)
    {
      if (n.tap != grp) continue;
      if (n.kind == K_ALGO && n.b) n.b->onEvent(inner);
      else if ((n.kind == K_LFO || n.kind == K_SEQ) && e.type == 1 && n.tt.tap()) n.tapHz = 1000.f / std::max(20.f, n.tt.ms);
    }
  }
  // value of control slot s for this chunk
  inline float slotVal(Slot& s)
  {
    if (s.src.empty()) return s.v = s.def;
    float x = 0.f;
    for (auto& [f, p] : s.src) x += nodes[f].cv[p];
    if (s.raw) return s.v = clampf(x, std::min(s.lo, s.hi), std::max(s.lo, s.hi));
    const float span = s.xhi - s.xlo;
    x = clampf(std::fabs(span) < 1e-9f ? (x >= s.xhi ? 1.f : 0.f) : (x - s.xlo) / span, 0.f, 1.f);
    if (!s.tab.empty()) return s.v = s.tab[std::min(s.tab.size() - 1, size_t(x * float(s.tab.size() - 1) + 0.5f))];
    float v = s.log ? s.lo * std::pow(s.hi / s.lo, x) : s.lo + (s.hi - s.lo) * x;
    if (s.isInt) v = std::round(v);
    return s.v = v;
  }
  inline float nat(Node& n, int i)
  {
    const int s = n.nat[i];
    return s < 0 ? n.natDef[i] : n.slots[s].v;
  }
  inline float natIn(Node& n, int i, float def)
  {
    const int s = n.nat[i];
    return s < 0 ? def : n.slots[s].v;
  }
  // audio input a of node n, channel c
  const float* input(Node& n, int a, int c, int len)
  {
    const int b = n.inBuf[a];
    if (b == -1) return silent.data();
    if (b >= 0) return bufs[buf(b, c)].data();
    float* s = scratch[c][std::min(a, 3)].data();
    std::fill(s, s + len, 0.f);
    for (int id : n.inSrc[a])
    {
      const float* x = bufs[buf(id, c)].data();
      for (int i = 0; i < len; ++i) s[i] += x[i];
    }
    return s;
  }
  float* output(Node& n, int a, int c) { return bufs[buf(n.outBuf[a], c)].data(); }

  void runNode(Node& n, const float* const* in, int nIn, int off, int len)
  {
    for (auto& s : n.slots) slotVal(s);
    const float dt = float(len / sr);
    switch (n.kind)
    {
      case K_ALGO:
      {
        if (!n.b) break;
        float onT = 1.f;
        for (auto& s : n.slots)
          if (s.sub >= 0 && !s.src.empty()) n.b->vals[s.sub].store(s.v, std::memory_order_relaxed);
          else if (s.sub == -1) onT = s.v > 0.5f ? 1.f : 0.f;
        if (n.first) n.m = onT, n.first = false;
        const float m0 = n.m, m1 = m0 < onT ? std::min(onT, m0 + len / 480.f) : std::max(onT, m0 - len / 480.f);
        n.m = m1;
        const float* src[2];
        float* dst[2];
        for (int c = 0; c < C; ++c) src[c] = input(n, 0, c, len);
        for (int c = 0; c < C; ++c) dst[c] = output(n, 0, c);
        const bool trails = n.b->hasTrails();
        if (m0 == 0.f && m1 == 0.f && !trails)
        {
          for (int c = 0; c < C; ++c) std::memcpy(dst[c], src[c], sizeof(float) * len);
          break;
        }
        if (m0 == 1.f && m1 == 1.f)
        {
          n.b->process(src, dst, len);
          break;
        }
        // fading: trails blocks get the faded input and keep ringing, others are crossfaded
        float* tmp[2] = {scratch[0][3].data(), scratch[C > 1 ? 1 : 0][3].data()};
        const float* fin[2] = {src[0], src[C > 1 ? 1 : 0]};
        if (trails)
        {
          for (int c = 0; c < C; ++c)
            for (int i = 0; i < len; ++i) tmp[c][i] = src[c][i] * (m0 + (m1 - m0) * float(i) / len);
          fin[0] = tmp[0];
          if (C > 1) fin[1] = tmp[1];
        }
        n.b->process(fin, dst, len);
        for (int c = 0; c < C; ++c)
          for (int i = 0; i < len; ++i)
          {
            const float m = m0 + (m1 - m0) * float(i) / len;
            dst[c][i] = trails ? dst[c][i] + src[c][i] * (1.f - m) : dst[c][i] * m + src[c][i] * (1.f - m);
          }
        break;
      }
      case K_SUM:
        for (int c = 0; c < C; ++c) std::memcpy(output(n, 0, c), input(n, 0, c, len), sizeof(float) * len);
        break;
      case K_AIN:
        for (int c = 0; c < C; ++c)
        {
          const int src = c == 1 && n.idx2 >= 0 ? n.idx2 : n.idx;
          const float* x = nIn > 0 ? in[std::min(src, nIn - 1)] + off : silent.data();
          std::memcpy(output(n, 0, c), x, sizeof(float) * len);
        }
        break;
      case K_AOUT:
        break; // read at the end
      case K_VCA:
      {
        const float g1 = std::max(0.f, natIn(n, 0, 1.f));
        const float g0 = n.g;
        for (int c = 0; c < C; ++c)
        {
          const float* x = input(n, 0, c, len);
          float* y = output(n, 0, c);
          for (int i = 0; i < len; ++i) y[i] = x[i] * (g0 + (g1 - g0) * float(i + 1) / len);
        }
        n.g = g1;
        break;
      }
      case K_FILTER:
      {
        const float f = natIn(n, 0, 1000.f), q = 0.5f + 11.5f * clampf(natIn(n, 1, 0.3f), 0.f, 1.f);
        const int mode = int(natIn(n, 2, 0.f) + 0.5f);
        // smooth the cutoff per chunk (in octaves) so swept filters do not step
        const float lf = std::log2(std::max(10.f, f));
        n.fz = n.fz == 0.f ? lf : n.fz + (lf - n.fz) * std::min(1.f, len / (0.004f * float(sr)));
        for (int c = 0; c < C; ++c)
        {
          n.svf[c].set(std::exp2(n.fz), q, float(sr));
          const float* x = input(n, 0, c, len);
          float* y = output(n, 0, c);
          for (int i = 0; i < len; ++i)
          {
            n.svf[c].process(x[i]);
            y[i] = mode == 1 ? n.svf[c].bp : mode == 2 ? n.svf[c].hp : mode == 3 ? x[i] - n.svf[c].bp * (1.f / q) : n.svf[c].lp;
          }
        }
        break;
      }
      case K_SHAPER:
      {
        const float drive = 1.f + 49.f * clampf(natIn(n, 0, 0.5f), 0.f, 1.f) * clampf(natIn(n, 0, 0.5f), 0.f, 1.f);
        const int mode = int(natIn(n, 1, 0.f) + 0.5f);
        const float mix = clampf(natIn(n, 2, 1.f), 0.f, 1.f), lvl = clampf(natIn(n, 3, 0.5f), 0.f, 1.f) * 2.f;
        const float comp = 1.f / std::sqrt(drive);
        for (int c = 0; c < C; ++c)
        {
          const float* x = input(n, 0, c, len);
          float* y = output(n, 0, c);
          for (int i = 0; i < len; ++i)
          {
            const float u = x[i] * drive;
            float w;
            switch (mode)
            {
              default:
              case 0: w = fastTanh(u); break;
              case 1: w = clampf(u, -1.f, 1.f); break;
              case 2: w = std::sin(clampf(u, -40.f, 40.f) * 0.5f * float(kPi)) ; break; // wavefolder
              case 3: w = u > 0 ? fastTanh(u) : 0.6f * fastTanh(u * 0.6f); break;      // asymmetric
            }
            if (mode == 0 || mode == 1) w *= std::max(comp, 0.35f);
            y[i] = (x[i] * (1.f - mix) + w * mix) * lvl;
          }
        }
        break;
      }
      case K_MIXER:
        for (int c = 0; c < C; ++c)
        {
          float* y = output(n, 0, c);
          std::fill(y, y + len, 0.f);
          for (int a = 0; a < 4; ++a)
          {
            if (n.inBuf[a] == -1) continue;
            const float g = natIn(n, a, 1.f);
            const float* x = input(n, a, c, len);
            for (int i = 0; i < len; ++i) y[i] += x[i] * g;
          }
        }
        break;
      case K_XFADE:
      {
        const float mx = clampf(natIn(n, 0, 0.5f), 0.f, 1.f);
        const float a = std::cos(mx * 0.5f * float(kPi)), b = std::sin(mx * 0.5f * float(kPi));
        for (int c = 0; c < C; ++c)
        {
          const float* x0 = input(n, 0, c, len);
          const float* x1b = input(n, 1, c, len);
          float* y = output(n, 0, c);
          for (int i = 0; i < len; ++i) y[i] = x0[i] * a + x1b[i] * b;
        }
        break;
      }
      case K_SWITCH:
      case K_BYPASS:
      {
        // switch: sel 0 = A, 1 = B. bypass: on = wet (A), off = dry (B). 10 ms crossfade
        const float t = n.kind == K_SWITCH ? (natIn(n, 0, 0.f) > 0.5f ? 1.f : 0.f) : (natIn(n, 0, 1.f) > 0.5f ? 0.f : 1.f);
        if (n.first) n.m = t, n.first = false;
        const float m0 = n.m;
        const float step = len / (0.01f * float(sr));
        const float m1 = m0 < t ? std::min(t, m0 + step) : std::max(t, m0 - step);
        n.m = m1;
        for (int c = 0; c < C; ++c)
        {
          const float* x0 = input(n, 0, c, len);
          const float* x1b = input(n, 1, c, len);
          float* y = output(n, 0, c);
          for (int i = 0; i < len; ++i)
          {
            const float m = m0 + (m1 - m0) * float(i + 1) / len;
            y[i] = x0[i] * (1.f - m) + x1b[i] * m;
          }
        }
        break;
      }
      case K_POL:
      {
        const float s = natIn(n, 0, 1.f) > 0.5f ? -1.f : 1.f;
        for (int c = 0; c < C; ++c)
        {
          const float* x = input(n, 0, c, len);
          float* y = output(n, 0, c);
          for (int i = 0; i < len; ++i) y[i] = x[i] * s;
        }
        break;
      }
      case K_FB:
      {
        // the return: what went in at least one chunk ago, scaled and soft limited so the loop stays bounded
        const float amt = clampf(natIn(n, 0, 0.5f), 0.f, 0.95f);
        const float ms = clampf(natIn(n, 1, 0.f), 0.f, 2000.f);
        const float d = std::max(float(kChunk + 2), ms * 0.001f * float(sr));
        const float tone = natIn(n, 2, 8000.f);
        for (int c = 0; c < C; ++c)
        {
          n.lp[c].lp(std::max(200.f, tone), float(sr));
          float* y = output(n, 0, c);
          for (int i = 0; i < len; ++i) y[i] = fastTanh(n.lp[c].processLP(n.dl[c].read(d - 1.f - float(i))) * amt);
        }
        break;
      }
      case K_PARAM:
      {
        // a circuit input: its param, or what another circuit's output wired to it says
        const int si = n.nat.empty() ? -1 : n.nat[0];
        if (si >= 0 && !n.slots[si].src.empty()) n.cv[0] = clampf(n.slots[si].v, -kLim, kLim);
        else n.cv[0] = n.pi >= 0 && n.pi < int(defs.size()) ? clampf(p(n.pi), -kLim, kLim) : 0.f;
        break;
      }
      case K_ADD: n.cv[0] = clampf(natIn(n, 0, 0.f) + natIn(n, 1, 0.f), -kLim, kLim); break;
      case K_SUB: n.cv[0] = clampf(natIn(n, 0, 0.f) - natIn(n, 1, 0.f), -kLim, kLim); break;
      case K_MUL: n.cv[0] = clampf(natIn(n, 0, 0.f) * natIn(n, 1, 1.f), -kLim, kLim); break;
      case K_DIV:
      {
        const float b = natIn(n, 1, 1.f);
        n.cv[0] = std::fabs(b) < 1e-9f ? 0.f : clampf(natIn(n, 0, 0.f) / b, -kLim, kLim); // divide by zero gives 0
        break;
      }
      case K_CDELAY:
      {
        // what came in `time` seconds ago (one value per chunk)
        const float x = natIn(n, 0, 0.f);
        const int N = int(n.hist.size());
        if (!N)
        {
          n.cv[0] = x;
          break;
        }
        n.hist[n.hpos] = x;
        const int d = std::min(N - 1, int(clampf(natIn(n, 1, 0.5f), 0.f, kMaxDelay) * float(sr) / float(kChunk) + 0.5f));
        n.cv[0] = n.hist[(n.hpos - d + N) % N];
        n.hpos = (n.hpos + 1) % N;
        break;
      }
      case K_COUT: n.cv[0] = clampf(natIn(n, 0, 0.f), -kLim, kLim); break;
      case K_CVSEND:
      {
        const float v = natIn(n, 0, 0.f);
        for (int c = 0; c < C; ++c) std::fill(output(n, 0, c), output(n, 0, c) + len, v);
        break;
      }
      case K_CVRECV: n.cv[0] = input(n, 0, 0, len)[len - 1]; break;
      case K_CONST: n.cv[0] = clampf(natIn(n, 0, 0.f), 0.f, 1.f); break;
      case K_LFO:
      {
        float hz = natIn(n, 0, 1.f);
        if (n.tapHz > 0.f && natIn(n, 4, 0.f) > 0.5f) hz = n.tapHz;
        n.tt.advance(len, sr);
        n.ph += hz * dt;
        n.ph -= std::floor(n.ph);
        const int shape = int(natIn(n, 1, 0.f) + 0.5f);
        float w;
        if (shape == 5)
        {
          if (n.ph < n.x1)
          {
            n.rng ^= n.rng << 13, n.rng ^= n.rng >> 17, n.rng ^= n.rng << 5; // xorshift: no locks on the audio thread
            n.last = float(n.rng & 0xffffff) / float(0xffffff) * 2.f - 1.f;
          }
          w = n.last;
        }
        else w = LFO::value(n.ph, shape);
        n.x1 = n.ph;
        const float lo = natIn(n, 2, 0.f), hi = natIn(n, 3, 1.f);
        n.cv[0] = clampf(lo + (hi - lo) * (0.5f + 0.5f * w), 0.f, 1.f);
        break;
      }
      case K_ENV:
      {
        const float sens = 1.f + 39.f * clampf(natIn(n, 0, 0.5f), 0.f, 1.f);
        n.env.setup(std::max(0.5f, natIn(n, 1, 5.f)), std::max(1.f, natIn(n, 2, 120.f)), float(sr));
        const float* x = input(n, 0, 0, len);
        for (int i = 0; i < len; ++i) n.env.process(x[i]);
        n.cv[0] = clampf(n.env.env * sens, 0.f, 1.f);
        break;
      }
      case K_SEQ:
      {
        float hz = natIn(n, 0, 2.f);
        if (n.tapHz > 0.f) hz = n.tapHz;
        n.tt.advance(len, sr);
        const int steps = std::max(1, std::min(8, int(natIn(n, 1, 8.f) + 0.5f)));
        n.ph += hz * dt;
        if (n.ph >= 1.f)
        {
          n.ph -= std::floor(n.ph);
          n.step = (n.step + 1) % steps;
        }
        if (n.step >= steps) n.step = 0;
        const float target = clampf(natIn(n, 3 + n.step, 0.f), 0.f, 1.f);
        const float glide = clampf(natIn(n, 2, 0.f), 0.f, 1.f);
        const float k = glide <= 0.f ? 1.f : std::min(1.f, dt / (glide * 0.3f));
        n.last += (target - n.last) * k;
        n.cv[0] = n.last;
        break;
      }
      case K_SCALE:
      {
        float x = clampf(natIn(n, 0, 0.f), 0.f, 1.f);
        if (natIn(n, 4, 0.f) > 0.5f) x = 1.f - x;
        const int cv = int(natIn(n, 3, 0.f) + 0.5f);
        if (cv == 1) x = x * x;
        else if (cv == 2) x = std::sqrt(x);
        else if (cv == 3) x = x * x * (3.f - 2.f * x);
        const float lo = natIn(n, 1, 0.f), hi = natIn(n, 2, 1.f);
        n.cv[0] = clampf(lo + (hi - lo) * x, 0.f, 1.f);
        break;
      }
      case K_MATH:
      {
        const float a = natIn(n, 0, 0.f), b = natIn(n, 1, 0.f);
        const int op = int(natIn(n, 2, 0.f) + 0.5f);
        float r = a + b;
        if (op == 1) r = a * b;
        else if (op == 2) r = std::min(a, b);
        else if (op == 3) r = std::max(a, b);
        else if (op == 4) r = std::fabs(a - b);
        else if (op == 5) r = a - b;
        n.cv[0] = clampf(r, 0.f, 1.f);
        break;
      }
      case K_SMOOTH:
      {
        const float x = natIn(n, 0, 0.f), ms = std::max(1.f, natIn(n, 1, 50.f));
        n.last += (x - n.last) * (1.f - std::exp(-dt * 1000.f / ms));
        n.cv[0] = n.last;
        break;
      }
      case K_SH:
      {
        const int t = natIn(n, 1, 0.f) > 0.5f;
        if (t && !n.prevTrig) n.last = natIn(n, 0, 0.f);
        n.prevTrig = t;
        n.cv[0] = clampf(n.last, 0.f, 1.f);
        break;
      }
      case K_AND: n.cv[0] = (natIn(n, 0, 0.f) > 0.5f && natIn(n, 1, 0.f) > 0.5f) ? 1.f : 0.f; break;
      case K_OR: n.cv[0] = (natIn(n, 0, 0.f) > 0.5f || natIn(n, 1, 0.f) > 0.5f) ? 1.f : 0.f; break;
      case K_XOR: n.cv[0] = ((natIn(n, 0, 0.f) > 0.5f) != (natIn(n, 1, 0.f) > 0.5f)) ? 1.f : 0.f; break;
      case K_NOT: n.cv[0] = natIn(n, 0, 0.f) > 0.5f ? 0.f : 1.f; break;
      case K_TOGGLE:
      {
        const int t = natIn(n, 0, 0.f) > 0.5f;
        if (t && !n.prevTrig) n.latch = !n.latch;
        if (natIn(n, 1, 0.f) > 0.5f) n.latch = false;
        n.prevTrig = t;
        n.cv[0] = n.latch ? 1.f : 0.f;
        break;
      }
      case K_CMP:
      {
        const float x = natIn(n, 0, 0.f), thr = natIn(n, 1, 0.5f), h = std::max(0.f, natIn(n, 2, 0.05f)) * 0.5f;
        if (x > thr + h) n.latch = true;
        else if (x < thr - h) n.latch = false;
        n.cv[0] = n.latch ? 1.f : 0.f;
        break;
      }
      case K_WINDOW:
      {
        const float x = natIn(n, 0, 0.f);
        n.cv[0] = x >= natIn(n, 1, 0.25f) && x <= natIn(n, 2, 0.75f) ? 1.f : 0.f;
        break;
      }
      default: break;
    }
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    for (int off = 0; off < n; off += kChunk)
    {
      const int len = std::min(kChunk, n - off);
      for (int i : order) runNode(nodes[i], in, nIn, off, len);
      // feedback parts take their input last, so the loop closes one chunk later
      for (auto& nd : nodes)
        if (nd.kind == K_FB)
          for (int c = 0; c < C; ++c)
          {
            const float* x = input(nd, 0, c, len);
            for (int i = 0; i < len; ++i) nd.dl[c].push(x[i]);
          }
      // outputs
      const float mix = mixParam >= 0 ? p(mixParam) : 1.f;
      for (int c = 0; c < nOut; ++c)
      {
        float* y = out[c] + off;
        const int oi = c < int(outs.size()) ? outs[c][0] : 0;
        const int ch = c < int(outs.size()) ? outs[c][1] : (C == 2 ? c % 2 : 0);
        const int ni = oi >= 0 && oi < int(aoutNode.size()) ? aoutNode[oi] : -1;
        if (ni < 0)
        {
          std::fill(y, y + len, 0.f);
          continue;
        }
        Node& on = nodes[ni];
        if (ch < 0 && C == 2)
        {
          const float* l = input(on, 0, 0, len);
          for (int i = 0; i < len; ++i) y[i] = 0.5f * l[i];
          const float* r = input(on, 0, 1, len);
          for (int i = 0; i < len; ++i) y[i] += 0.5f * r[i];
        }
        else std::memcpy(y, input(on, 0, std::max(0, std::min(ch, C - 1)), len), sizeof(float) * len);
        if (mixParam >= 0 && ain0 >= 0)
        {
          const float* d = output(nodes[ain0], 0, 0);
          for (int i = 0; i < len; ++i) y[i] = d[i] * (1.f - mix) + y[i] * mix;
        }
      }
    }
  }
  void controlTick() override
  {
    for (auto& nd : nodes)
      if (nd.b) nd.b->controlTick();
  }
  void status(json& j) override
  {
    // circuit outputs, by output index
    int nc = 0;
    for (auto& nd : nodes)
      if (nd.kind == K_COUT) nc = std::max(nc, nd.idx + 1);
    if (nc)
    {
      json cv = json::array();
      for (int k = 0; k < nc; ++k) cv.push_back(nullptr);
      for (auto& nd : nodes)
        if (nd.kind == K_COUT && nd.idx >= 0) cv[nd.idx] = std::round(nd.cv[0] * 1000.f) / 1000.f;
      j["cv"] = cv;
    }
    for (size_t i = 0; i < nodes.size(); ++i)
      if (nodes[i].b)
      {
        json sj = json::object();
        nodes[i].b->status(sj);
        if (!sj.empty()) j["n" + std::to_string(i)] = sj;
      }
  }
  void reset() override
  {
    for (auto& nd : nodes)
    {
      if (nd.b) nd.b->reset();
      for (int c = 0; c < 2; ++c)
      {
        nd.svf[c].reset();
        nd.lp[c].reset();
        nd.dl[c].clear();
      }
      std::fill(nd.hist.begin(), nd.hist.end(), 0.f);
    }
  }
};

RegisterBlock r1("patch", [](const json& o, int nIn, int nOut) { return std::make_unique<PatchBlock>(o, nIn, nOut); });
} // namespace
} // namespace tz
