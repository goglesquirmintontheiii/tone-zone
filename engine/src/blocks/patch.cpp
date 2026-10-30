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
// Script audio (screen scripts make and read audio, docs/engine-blocks.md):
// * parts 'osc', 'noise', 'adsr', 'sampler' and 'sgain', wired like any other and smoothed per sample, so values
//   set once per screen frame do not step; a 'param' node with sm (ms) glides to its value;
// * a pool of voices (oscillators, noise, sample players with an envelope) and processors (gain, filters, drive)
//   that the 'voice' and 'fx' commands start, change and stop without a rebuild. A voice is added to a jack (an
//   'ain' or 'aout' node with that jack key jk) or to a 'scriptin' part by name; a processor works on a jack;
// * sample buffers (setSample: slot 1..32, made on the control thread, swapped in with an atomic pointer and freed
//   once the audio thread has moved on) for samplers and voices;
// * jack analysis: 'ain' / 'aout' nodes with a jk are tapped while a 'scope' command asks, and the status reports
//   scope: {<jk>: {rms, peak, db, onset, spec: [bands, dB], wave: [...], hz, conf}}.
// Nothing of it runs while nobody asks (no voice, no processor, no scope), and the audio thread never allocates.
//
// opts: { params: [{name, def, min, max}],            exposed params (the pedal's circuit inputs)
//         nodes:  [{k, algo?, opts?, idx?, pi?, tap?, jk?, sm?, slots: [{p, def, lo, hi, log, int, tab, raw, xlo, xhi}]}],
//         edges:  [[fromNode, fromPort, toNode, toPort, isControl]],
//         outs:   [[aoutIdx, ch]] per engine output (ch 0 = L, 1 = R, -1 = mono sum), mix, mixDef,
//         ch:     internal channels (1 or 2, default from the block's inputs and outputs) }
#include "common.h"
#include "../dsp/yin.h"

namespace tz
{
namespace
{
constexpr int kChunk = 64;
constexpr float kLim = 255.f;     // control values stay within -255..255
constexpr float kMaxDelay = 10.f; // seconds a control delay can hold
constexpr int kSlots = 32;         // sample buffers per block (circuit samplers use 1..8)
constexpr int kVoices = 32, kFxs = 32; // script voices and processors per block
constexpr int kRing = 4096;        // analysis ring per tapped jack
constexpr int kFft = 2048, kMaxBands = 64, kMaxWave = 1024;

enum Kind
{
  K_ALGO, K_SUM, K_AIN, K_AOUT, K_VCA, K_FILTER, K_SHAPER, K_MIXER, K_XFADE, K_SWITCH, K_POL, K_FB, K_BYPASS,
  K_PARAM, K_CONST, K_LFO, K_ENV, K_SEQ, K_SCALE, K_MATH, K_SMOOTH, K_SH, K_AND, K_OR, K_XOR, K_NOT, K_TOGGLE,
  K_CMP, K_WINDOW, K_ADD, K_SUB, K_MUL, K_DIV, K_CDELAY, K_COUT, K_CVSEND, K_CVRECV, K_OSC, K_NOISE, K_ADSR, K_SAMPLER,
  K_SGAIN, K_SIN, K_UNKNOWN
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
    {"osc", K_OSC, 0, 1, 0, {"freq", "amp", "shape", "pw", "glide", "note"}},
    {"noise", K_NOISE, 0, 1, 0, {"amp", "color"}},
    {"adsr", K_ADSR, 1, 1, 1, {"gate", "attack", "decay", "sustain", "release"}},
    {"sampler", K_SAMPLER, 0, 1, 2, {"slot", "gate", "mode", "rate", "level", "start"}},
    {"sgain", K_SGAIN, 1, 1, 0, {"gain", "lp", "hp", "smooth"}},
    {"scriptin", K_SIN, 0, 1, 0, {"level"}},
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
  // script audio
  std::string jk;  // ain / aout: the jack it stands for (analysis, voices, processors)
  std::string sn[2]; // scriptin: its names (part label, circuit name), lower case
  float sm = 0.f;  // param: glide time (ms)
  float gF = -1.f, gA = 0.f, gW = 0.5f, gL = -1.f, gH = -1.f; // smoothed values
  float pk[3] = {0, 0, 0}; // pink noise
  int stage = 0;           // adsr: 0 idle, 1 attack, 2 decay / sustain, 3 release
  double spos = 0;         // sampler
  bool playing = false, restart = false;
  float fade = 0.f;
  const Block::SampleData* sd = nullptr;
};

inline float polyBlep(float t, float dt)
{
  if (t < dt)
  {
    t /= dt;
    return t + t - t * t - 1.f;
  }
  if (t > 1.f - dt)
  {
    t = (t - 1.f) / dt;
    return t * t + t + t + 1.f;
  }
  return 0.f;
}
// per sample one-pole coefficient for a glide of ms
inline float glideK(float ms, double sr) { return ms <= 0.f ? 1.f : 1.f - std::exp(-1.f / std::max(1.f, ms * 0.001f * float(sr))); }

struct Tap
{
  std::string jk;
  int node = -1;
  std::vector<float> ring;
  std::atomic<int> wpos{0};
  std::atomic<float> peak{0.f};
  std::atomic<int> onsets{0};
  float fast = 0.f, slow = 0.f; // onset detector (audio thread)
  bool armed = true;
  int hold = 0;
  std::vector<float> spec; // smoothed band levels (control thread)
};

// control thread -> audio thread: one voice or processor, all of its values
struct ScriptMsg
{
  bool fx = false, stop = false, env = false, gate = true, loop = false;
  int idx = 0, type = 0, trig = 0, slot = 0, target = -1;
  float freq = 220, amp = 0.5f, pw = 0.5f, att = 0.005f, dec = 0.1f, sus = 1.f, rel = 0.05f;
  float rate = 1, start = 0, pan = 0, gain = 1, q = 0.7f, amount = 0.5f, mix = 1;
};
struct Voice
{
  ScriptMsg m;
  bool on = false, dying = false, silent = true, playing = false;
  float ph = 0, gF = 0, gA = 0, gW = 0.5f, e = 0, pk[3] = {0, 0, 0};
  int stage = 0, lastTrig = 0;
  bool lastGate = false;
  double spos = 0;
  uint32_t rng = 0x2545f491u;
  float buf[kChunk];
};
struct Fx
{
  ScriptMsg m;
  bool on = false, dying = false;
  float fade = 0, gG[2] = {1, 1}, fz = 0;
  SVF svf[2];
};
// voice types and processor types, as the commands name them
const char* const kVoiceTypes[] = {"sine", "square", "saw", "tri", "pulse", "noise", "sample"};
const char* const kFxTypes[] = {"gain", "lowpass", "highpass", "bandpass", "drive"};

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
  // script audio: sample slots (RT reads cur), analysis taps
  struct SlotBuf
  {
    std::atomic<const SampleData*> cur{nullptr};
    std::shared_ptr<const SampleData> hold; // control thread
  };
  std::array<SlotBuf, kSlots + 1> sbuf;
  std::vector<std::pair<std::shared_ptr<const SampleData>, uint64_t>> retired;
  std::atomic<uint64_t> epoch{0};
  std::vector<std::unique_ptr<Tap>> taps;
  std::atomic<bool> scopeOn{false};
  bool wantLevel = false, wantSpec = false, wantWave = false, wantPitch = false, waveSync = true;
  int nBands = 32, nWave = 128, waveSpan = 2048;
  std::vector<std::string> scopeJacks; // empty = all
  std::vector<int> tapOf;     // node -> tap index or -1
  std::vector<int> tapChunk;  // aout taps: the chunk they were last written in
  int chunkNo = 0;
  // voices and processors (audio thread state; set through smsg)
  std::array<Voice, kVoices> voices;
  std::array<Fx, kFxs> fxs;
  SpscQueue<ScriptMsg, 256> smsg;
  std::vector<ScriptMsg> pend; // control thread: what did not fit in the queue yet
  std::vector<char> nodeScript; // node has a voice or processor on it (audio thread)
  bool anyScript = false, recount = false;
  FFT fft;
  std::vector<std::complex<float>> fbuf;
  std::vector<float> win, work, dec, yinBuf;

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
      n.jk = nj.value("jk", "");
      for (int q = 0; q < 2; ++q)
      {
        std::string v = nj.value(q ? "sni" : "sn", "");
        for (auto& ch : v) ch = char(std::tolower((unsigned char)ch));
        n.sn[q] = v;
      }
      n.sm = nj.value("sm", 0.f);
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
      if ((nodes[i].kind == K_AIN || nodes[i].kind == K_AOUT) && !nodes[i].jk.empty())
      {
        bool dup = false;
        for (auto& t : taps) dup = dup || t->jk == nodes[i].jk;
        if (dup) continue;
        auto t = std::make_unique<Tap>();
        t->jk = nodes[i].jk;
        t->node = i;
        taps.push_back(std::move(t));
      }
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
    for (auto& t : taps)
    {
      t->ring.assign(kRing, 0.f);
      t->spec.assign(kMaxBands, -120.f);
    }
    tapOf.assign(nodes.size(), -1);
    tapChunk.assign(taps.size(), -1);
    for (size_t q = 0; q < taps.size(); ++q) tapOf[taps[q]->node] = int(q);
    nodeScript.assign(nodes.size(), 0);
    if (!taps.empty())
    {
      fft.init(kFft);
      fbuf.assign(kFft, 0.f);
      win.resize(kFft);
      for (int i = 0; i < kFft; ++i) win[i] = 0.5f - 0.5f * std::cos(float(kTwoPi) * i / kFft);
      work.assign(kRing, 0.f);
      dec.assign(kRing / 4, 0.f);
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
        if (n.sm > 0.f)
        {
          // set by a script once per frame: glide there
          if (n.first) n.last = n.cv[0], n.first = false;
          n.last += (n.cv[0] - n.last) * (1.f - std::exp(-dt * 1000.f / n.sm));
          n.cv[0] = n.last;
        }
        break;
      }
      case K_OSC:
      {
        // sine, triangle, saw, square, pulse (band limited with polyBLEP)
        // pitch from `note` (MIDI note number, fractions allowed) when it is there, else `freq` in Hz
        const float hz = n.nat[5] >= 0 ? 440.f * std::exp2((clampf(nat(n, 5), -24.f, 160.f) - 69.f) / 12.f) : natIn(n, 0, 220.f);
        const float f = clampf(hz, 0.f, float(sr) * 0.45f), amp = clampf(natIn(n, 1, 0.5f), 0.f, 4.f);
        const int shape = int(natIn(n, 2, 0.f) + 0.5f);
        const float pw = clampf(shape == 3 ? 0.5f : natIn(n, 3, 0.5f), 0.02f, 0.98f);
        const float kf = glideK(natIn(n, 4, 10.f), sr), ka = glideK(8.f, sr);
        if (n.gF < 0.f) n.gF = f, n.gW = pw;
        float* y = output(n, 0, 0);
        for (int i = 0; i < len; ++i)
        {
          n.gF += (f - n.gF) * kf;
          n.gA += (amp - n.gA) * ka;
          n.gW += (pw - n.gW) * ka;
          const float dt1 = n.gF / float(sr), t = n.ph;
          float w;
          switch (shape)
          {
            default:
            case 0: w = std::sin(float(kTwoPi) * t); break;
            case 1: w = 1.f - 4.f * std::fabs(t - 0.5f); break;
            case 2: w = 2.f * t - 1.f - polyBlep(t, dt1); break;
            case 3:
            case 4:
            {
              float t2 = t - n.gW;
              if (t2 < 0.f) t2 += 1.f;
              w = (t < n.gW ? 1.f : -1.f) + polyBlep(t, dt1) - polyBlep(t2, dt1);
              break;
            }
          }
          y[i] = w * n.gA;
          n.ph += dt1;
          if (n.ph >= 1.f) n.ph -= 1.f;
        }
        for (int c = 1; c < C; ++c) std::memcpy(output(n, 0, c), y, sizeof(float) * len);
        break;
      }
      case K_NOISE:
      {
        const float amp = clampf(natIn(n, 0, 0.5f), 0.f, 4.f), ka = glideK(8.f, sr);
        const bool pink = natIn(n, 1, 0.f) > 0.5f;
        float* y = output(n, 0, 0);
        for (int i = 0; i < len; ++i)
        {
          n.rng ^= n.rng << 13, n.rng ^= n.rng >> 17, n.rng ^= n.rng << 5;
          float w = float(n.rng & 0xffffff) / float(0xffffff) * 2.f - 1.f;
          if (pink)
          {
            // Paul Kellet's economy pink filter
            n.pk[0] = 0.99765f * n.pk[0] + w * 0.0990460f;
            n.pk[1] = 0.96300f * n.pk[1] + w * 0.2965164f;
            n.pk[2] = 0.57000f * n.pk[2] + w * 1.0526913f;
            w = (n.pk[0] + n.pk[1] + n.pk[2] + w * 0.1848f) * 0.22f;
          }
          n.gA += (amp - n.gA) * ka;
          y[i] = w * n.gA;
        }
        for (int c = 1; c < C; ++c) std::memcpy(output(n, 0, c), y, sizeof(float) * len);
        break;
      }
      case K_ADSR:
      {
        // gate opens the envelope: linear attack, exponential decay to sustain and release; the input goes through it
        const bool gate = natIn(n, 0, 0.f) > 0.5f;
        const float fsr = float(sr);
        const float att = 1.f / std::max(1.f, clampf(natIn(n, 1, 5.f), 0.f, 20000.f) * 0.001f * fsr);
        const float dk = 1.f - std::exp(-4.6f / std::max(1.f, clampf(natIn(n, 2, 120.f), 0.f, 20000.f) * 0.001f * fsr));
        const float sus = clampf(natIn(n, 3, 0.7f), 0.f, 1.f);
        const float rk = 1.f - std::exp(-4.6f / std::max(1.f, clampf(natIn(n, 4, 200.f), 0.f, 20000.f) * 0.001f * fsr));
        if (gate && (!n.prevTrig || n.stage == 3 || n.stage == 0)) n.stage = 1;
        if (!gate && n.stage && n.stage != 3) n.stage = 3;
        n.prevTrig = gate;
        const float* x[2] = {input(n, 0, 0, len), C > 1 ? input(n, 0, 1, len) : nullptr};
        float* y[2] = {output(n, 0, 0), C > 1 ? output(n, 0, 1) : nullptr};
        float e = n.g;
        for (int i = 0; i < len; ++i)
        {
          if (n.stage == 1)
          {
            e += att;
            if (e >= 1.f) e = 1.f, n.stage = 2;
          }
          else if (n.stage == 2) e += (sus - e) * dk;
          else if (n.stage == 3)
          {
            e -= e * rk;
            if (e < 1e-5f) e = 0.f, n.stage = 0;
          }
          y[0][i] = x[0][i] * e;
          if (y[1]) y[1][i] = x[1][i] * e;
        }
        n.g = e;
        n.cv[0] = e;
        break;
      }
      case K_SAMPLER:
      {
        // plays sample slot `slot`: mode 0 one shot (gate starts it), 1 while the gate is on, 2 loops while it is on
        const int slot = std::max(1, std::min(kSlots, int(natIn(n, 0, 1.f) + 0.5f)));
        const bool gate = natIn(n, 1, 0.f) > 0.5f;
        const int mode = int(natIn(n, 2, 0.f) + 0.5f);
        const float rate = clampf(natIn(n, 3, 1.f), 0.f, 8.f), lvl = clampf(natIn(n, 4, 1.f), 0.f, 4.f);
        const SampleData* sd = sbuf[slot].cur.load(std::memory_order_acquire);
        if (sd != n.sd)
        {
          n.sd = sd;
          if (!sd) n.playing = false;
        }
        const int L = sd ? int(sd->x.size()) : 0;
        const double startAt = double(clampf(natIn(n, 5, 0.f), 0.f, 1.f)) * L;
        if (gate && !n.prevTrig && L)
        {
          if (n.playing && n.fade > 0.f) n.restart = true; // fade out first, then start again
          else n.playing = true, n.spos = startAt, n.fade = 0.f;
        }
        n.prevTrig = gate;
        const bool hold = mode == 0 || gate;
        const float fstep = 1.f / (0.002f * float(sr)), ka = glideK(10.f, sr);
        const double ratio = sd ? double(sd->sr) / sr : 1.0;
        if (n.gF < 0.f) n.gF = rate;
        float* y = output(n, 0, 0);
        for (int i = 0; i < len; ++i)
        {
          n.gF += (rate - n.gF) * ka;
          n.gA += (lvl - n.gA) * ka;
          float v = 0.f;
          if (n.playing && L)
          {
            const float tgt = n.restart || !hold ? 0.f : 1.f;
            n.fade = tgt > n.fade ? std::min(tgt, n.fade + fstep) : std::max(tgt, n.fade - fstep);
            if (n.fade <= 0.f && tgt == 0.f)
            {
              if (n.restart) n.restart = false, n.spos = startAt;
              else n.playing = false;
            }
            const int k = int(n.spos);
            if (k >= 0 && k < L)
            {
              const float fr = float(n.spos - k);
              const float a = sd->x[k], b = k + 1 < L ? sd->x[k + 1] : (mode == 2 ? sd->x[int(startAt) < L ? int(startAt) : 0] : 0.f);
              v = (a + (b - a) * fr) * n.fade;
            }
            n.spos += n.gF * ratio;
            if (n.spos >= L)
            {
              if (mode == 2 && L - startAt >= 1.0) n.spos = startAt + std::fmod(n.spos - startAt, double(L) - startAt);
              else n.playing = false;
            }
          }
          y[i] = v * n.gA;
        }
        for (int c = 1; c < C; ++c) std::memcpy(output(n, 0, c), y, sizeof(float) * len);
        n.cv[0] = n.playing ? 1.f : 0.f;
        n.cv[1] = L ? clampf(float(n.spos / L), 0.f, 1.f) : 0.f;
        break;
      }
      case K_SIN:
      {
        // a script audio input: the voices sent to this part (by name), times its level
        const float lvl = clampf(natIn(n, 0, 1.f), 0.f, 4.f);
        for (int c = 0; c < C; ++c)
        {
          float* y = output(n, 0, c);
          std::fill(y, y + len, 0.f);
          if (anyScript && nodeScript[&n - nodes.data()])
          {
            scriptOn(int(&n - nodes.data()), y, c, C == 2 ? c : -1, len);
            for (int i = 0; i < len; ++i) y[i] *= lvl;
          }
        }
        break;
      }
      case K_SGAIN:
      {
        // gain plus a low and high cut, every value glides over `smooth` ms
        const float g = clampf(natIn(n, 0, 1.f), 0.f, 8.f), lpf = clampf(natIn(n, 1, 20000.f), 20.f, 20000.f), hpf = clampf(natIn(n, 2, 20.f), 20.f, 20000.f);
        const float ms = clampf(natIn(n, 3, 20.f), 0.f, 2000.f), k = glideK(ms, sr);
        const float kc = ms <= 0.f ? 1.f : std::min(1.f, 1.f - std::exp(-dt * 1000.f / std::max(1.f, ms)));
        const float l2 = std::log2(lpf), h2 = std::log2(hpf);
        if (n.gL < 0.f) n.gL = l2, n.gH = h2, n.gA = g;
        n.gL += (l2 - n.gL) * kc;
        n.gH += (h2 - n.gH) * kc;
        const bool lpOn = n.gL < 14.25f, hpOn = n.gH > 4.4f; // under ~19.5 kHz, over ~21 Hz
        float g0 = n.gA;
        for (int c = 0; c < C; ++c)
        {
          if (lpOn) n.lp[c].lp(std::exp2(n.gL), float(sr));
          if (hpOn) n.svf[c].set(std::exp2(n.gH), 0.7071f, float(sr));
          const float* x = input(n, 0, c, len);
          float* y = output(n, 0, c);
          float gg = g0;
          for (int i = 0; i < len; ++i)
          {
            gg += (g - gg) * k;
            float v = x[i];
            if (hpOn)
            {
              n.svf[c].process(v);
              v = n.svf[c].hp;
            }
            if (lpOn) v = n.lp[c].processLP(v);
            y[i] = v * gg;
          }
          n.gA = gg;
        }
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
    drainScript();
    for (int off = 0; off < n; off += kChunk)
    {
      const int len = std::min(kChunk, n - off);
      ++chunkNo;
      if (anyScript)
        for (auto& v : voices)
          if (v.on) renderVoice(v, len);
      const bool scope = scopeOn.load(std::memory_order_relaxed);
      for (int i : order)
      {
        runNode(nodes[i], in, nIn, off, len);
        if (nodes[i].kind != K_AIN) continue;
        if (anyScript && nodeScript[i])
          for (int c = 0; c < C; ++c) scriptOn(i, output(nodes[i], 0, c), c, C == 2 ? c : -1, len);
        if (scope && tapOf[i] >= 0)
        {
          const float* b = C > 1 ? output(nodes[i], 0, 1) : nullptr;
          capture(*taps[tapOf[i]], output(nodes[i], 0, 0), b, len);
        }
      }
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
        // script voices and processors on this output jack, then what the jack puts out is analysed
        if (anyScript && nodeScript[ni]) scriptOn(ni, y, ch == 1 ? 1 : 0, ch, len);
        const int ti = tapOf[ni];
        if (scope && ti >= 0 && tapChunk[ti] != chunkNo)
        {
          tapChunk[ti] = chunkNo;
          capture(*taps[ti], y, nullptr, len);
        }
      }
    }
    epoch.fetch_add(1, std::memory_order_release);
  }

  // ---- script voices and processors (audio thread) ----
  // new values from the control thread
  void drainScript()
  {
    ScriptMsg m;
    bool changed = false;
    while (smsg.pop(m))
    {
      changed = true;
      if (m.fx)
      {
        if (m.idx < 0 || m.idx >= kFxs) continue;
        Fx& f = fxs[m.idx];
        if (m.stop || m.target < 0)
        {
          if (f.on) f.dying = true;
          continue;
        }
        if (!f.on || f.m.target != m.target || f.m.type != m.type)
        {
          f.svf[0].reset(), f.svf[1].reset();
          f.fade = 0.f, f.fz = 0.f, f.gG[0] = f.gG[1] = m.gain;
        }
        f.m = m, f.on = true, f.dying = false;
        continue;
      }
      if (m.idx < 0 || m.idx >= kVoices) continue;
      Voice& v = voices[m.idx];
      if (m.stop || m.target < 0)
      {
        if (v.on) v.dying = true;
        continue;
      }
      const bool fresh = !v.on || v.dying;
      v.m = m;
      if (fresh)
      {
        v.on = true, v.dying = false, v.ph = 0, v.gF = m.freq, v.gA = 0, v.gW = m.pw;
        v.e = m.env ? 0.f : 1.f;
        v.stage = 0, v.lastGate = false, v.lastTrig = m.trig, v.playing = false;
        if (!m.env || m.gate) start(v);
      }
      else
      {
        if (m.trig != v.lastTrig) start(v);
        else if (m.env && m.gate && !v.lastGate) start(v);
        else if (m.env && !m.gate && v.lastGate && v.stage) v.stage = 3;
      }
      v.lastTrig = m.trig, v.lastGate = m.gate;
    }
    if (!changed && !recount) return;
    recount = false;
    // where they are
    std::fill(nodeScript.begin(), nodeScript.end(), 0);
    anyScript = false;
    for (auto& v : voices)
      if (v.on && v.m.target >= 0 && v.m.target < int(nodeScript.size())) nodeScript[v.m.target] = 1, anyScript = true;
    for (auto& f : fxs)
      if (f.on && f.m.target >= 0 && f.m.target < int(nodeScript.size())) nodeScript[f.m.target] = 1, anyScript = true;
  }
  void start(Voice& v)
  {
    v.stage = v.m.env ? 1 : 2;
    if (!v.m.env) v.e = 1.f;
    v.lastGate = v.m.gate;
    const SampleData* sd = v.m.type == 6 ? sbuf[std::max(1, std::min(kSlots, v.m.slot))].cur.load(std::memory_order_acquire) : nullptr;
    v.spos = sd ? double(clampf(v.m.start, 0.f, 1.f)) * double(sd->x.size()) : 0.0;
    v.playing = true;
  }
  void renderVoice(Voice& v, int len)
  {
    const ScriptMsg& m = v.m;
    const float fsr = float(sr);
    // an envelope (or a 5 ms fade when it has none or is stopping)
    const float att = 1.f / std::max(1.f, std::max(0.f, m.att) * fsr);
    const float dk = 1.f - std::exp(-4.6f / std::max(1.f, std::max(0.f, m.dec) * fsr));
    const float rk = 1.f - std::exp(-4.6f / std::max(1.f, (v.dying || !m.env ? 0.005f : std::max(0.f, m.rel)) * fsr));
    const float sus = clampf(m.sus, 0.f, 1.f);
    if (v.dying) v.stage = 3;
    if (v.stage == 0 || (!v.playing && m.type == 6))
    {
      v.silent = true;
      if (v.dying) v.on = v.dying = false, recount = true;
      return;
    }
    v.silent = false;
    const float f = clampf(m.freq, 0.f, fsr * 0.45f), amp = clampf(m.amp, 0.f, 4.f), pw = clampf(m.pw, 0.02f, 0.98f);
    const float kf = glideK(8.f, sr), ka = glideK(8.f, sr);
    const SampleData* sd = m.type == 6 ? sbuf[std::max(1, std::min(kSlots, m.slot))].cur.load(std::memory_order_acquire) : nullptr;
    const int L = sd ? int(sd->x.size()) : 0;
    const double step = sd ? double(clampf(m.rate, 0.f, 8.f)) * sd->sr / sr : 0.0;
    const double s0 = double(clampf(m.start, 0.f, 1.f)) * L;
    float e = v.e;
    for (int i = 0; i < len; ++i)
    {
      if (v.stage == 1)
      {
        e += att;
        if (e >= 1.f) e = 1.f, v.stage = 2;
      }
      else if (v.stage == 2) e += ((m.env ? sus : 1.f) - e) * dk;
      else if (v.stage == 3)
      {
        e -= e * rk;
        if (e < 1e-5f) e = 0.f, v.stage = 0;
      }
      v.gF += (f - v.gF) * kf;
      v.gA += (amp - v.gA) * ka;
      v.gW += ((m.type == 1 ? 0.5f : pw) - v.gW) * ka;
      const float dt1 = v.gF / fsr, t = v.ph;
      float w = 0.f;
      switch (m.type)
      {
        default:
        case 0: w = std::sin(float(kTwoPi) * t); break;
        case 3: w = 1.f - 4.f * std::fabs(t - 0.5f); break;
        case 2: w = 2.f * t - 1.f - polyBlep(t, dt1); break;
        case 1:
        case 4:
        {
          float t2 = t - v.gW;
          if (t2 < 0.f) t2 += 1.f;
          w = (t < v.gW ? 1.f : -1.f) + polyBlep(t, dt1) - polyBlep(t2, dt1);
          break;
        }
        case 5:
          v.rng ^= v.rng << 13, v.rng ^= v.rng >> 17, v.rng ^= v.rng << 5;
          w = float(v.rng & 0xffffff) / float(0xffffff) * 2.f - 1.f;
          break;
        case 6:
          if (v.playing && L)
          {
            const int k = int(v.spos);
            if (k >= 0 && k < L)
            {
              const float a = sd->x[k], b = k + 1 < L ? sd->x[k + 1] : (m.loop ? sd->x[std::min(L - 1, int(s0))] : 0.f);
              w = a + (b - a) * float(v.spos - k);
            }
            v.spos += step;
            if (v.spos >= L)
            {
              if (m.loop && L - s0 >= 1.0) v.spos = s0 + std::fmod(v.spos - s0, double(L) - s0);
              else v.playing = false;
            }
          }
          break;
      }
      if (m.type != 5 && m.type != 6)
      {
        v.ph += dt1;
        if (v.ph >= 1.f) v.ph -= 1.f;
      }
      v.buf[i] = w * v.gA * e;
    }
    v.e = e;
    if (v.stage == 0 && v.dying) v.on = v.dying = false, v.silent = true, recount = true;
  }
  // voices and processors on node ni, into one channel of its signal (ch: 0 left, 1 right, -1 mono)
  void scriptOn(int ni, float* y, int fc, int ch, int len)
  {
    for (auto& v : voices)
    {
      if (!v.on || v.silent || v.m.target != ni) continue;
      const float pan = clampf(v.m.pan, -1.f, 1.f), g = ch == 0 ? std::min(1.f, 1.f - pan) : ch == 1 ? std::min(1.f, 1.f + pan) : 1.f;
      for (int i = 0; i < len; ++i) y[i] += v.buf[i] * g;
    }
    for (auto& f : fxs)
      if (f.on && f.m.target == ni) runFx(f, y, fc, len);
  }
  void runFx(Fx& f, float* y, int c, int len)
  {
    const ScriptMsg& m = f.m;
    const float k = glideK(10.f, sr);
    const float gT = clampf(m.gain, 0.f, 8.f), mix = clampf(m.mix, 0.f, 1.f);
    const float fT = f.dying ? 0.f : 1.f, fstep = 1.f / (0.005f * float(sr));
    const bool filt = m.type >= 1 && m.type <= 3;
    if (filt && c == 0)
    {
      // the cutoff glides in octaves, once per chunk
      const float lf = std::log2(clampf(m.freq, 20.f, 20000.f));
      f.fz = f.fz == 0.f ? lf : f.fz + (lf - f.fz) * std::min(1.f, len / (0.01f * float(sr)));
    }
    if (filt) f.svf[c].set(std::exp2(f.fz == 0.f ? std::log2(clampf(m.freq, 20.f, 20000.f)) : f.fz), clampf(m.q, 0.1f, 20.f), float(sr));
    const float drive = 1.f + 30.f * clampf(m.amount, 0.f, 1.f) * clampf(m.amount, 0.f, 1.f);
    const float comp = 1.f / fastTanh(drive);
    float g = f.gG[c], fade = f.fade;
    for (int i = 0; i < len; ++i)
    {
      g += (gT - g) * k;
      fade = fT > fade ? std::min(fT, fade + fstep) : std::max(fT, fade - fstep);
      const float x = y[i];
      float w;
      switch (m.type)
      {
        default:
        case 0: w = x; break;
        case 1: f.svf[c].process(x), w = f.svf[c].lp; break;
        case 2: f.svf[c].process(x), w = f.svf[c].hp; break;
        case 3: f.svf[c].process(x), w = f.svf[c].bp; break;
        case 4: w = fastTanh(x * drive) * comp; break;
      }
      w *= g;
      const float wet = x + (w - x) * mix; // mix 0 = untouched
      y[i] = x + (wet - x) * fade;
    }
    f.gG[c] = g;
    if (c == 0 || C == 1) f.fade = fade;
    if (f.dying && fade <= 0.f) f.on = f.dying = false, recount = true;
  }
  // analysis taps: the mono signal at a jack into its ring, its peak and note starts (audio thread)
  void capture(Tap& tp, const float* a, const float* b, int len)
  {
    int w = tp.wpos.load(std::memory_order_relaxed);
    float pk = 0.f, s2 = 0.f;
    for (int i = 0; i < len; ++i)
    {
      const float v = b ? 0.5f * (a[i] + b[i]) : a[i];
      tp.ring[w] = v;
      w = (w + 1) & (kRing - 1);
      pk = std::max(pk, std::fabs(v));
      s2 += v * v;
    }
    tp.wpos.store(w, std::memory_order_release);
    if (pk > tp.peak.load(std::memory_order_relaxed)) tp.peak.store(pk, std::memory_order_relaxed);
    // onsets: the chunk's energy jumps well over its slow average
    const float ms = s2 / float(std::max(1, len)), dt = float(len / sr);
    tp.fast = std::max(ms, tp.fast * std::exp(-dt / 0.02f));
    tp.slow += (ms - tp.slow) * (1.f - std::exp(-dt / 0.25f));
    if (tp.hold > 0) --tp.hold;
    if (tp.armed && tp.hold == 0 && tp.fast > 1e-4f && tp.fast > 4.f * tp.slow + 1e-7f)
    {
      tp.onsets.fetch_add(1, std::memory_order_relaxed);
      tp.armed = false;
      tp.hold = int(0.06 * sr / kChunk) + 1;
    }
    else if (!tp.armed && tp.fast < 2.f * tp.slow) tp.armed = true;
  }
  // ---- script audio, control thread ----
  void setSample(int slot, std::shared_ptr<const SampleData> sd) override
  {
    if (slot < 1 || slot > kSlots) return;
    auto& sb = sbuf[slot];
    if (sb.hold) retired.push_back({sb.hold, epoch.load(std::memory_order_acquire)});
    sb.hold = std::move(sd);
    sb.cur.store(sb.hold.get(), std::memory_order_release);
    freeRetired();
  }
  void freeRetired()
  {
    // a buffer can go once a whole process call has started after it was swapped out
    const uint64_t e = epoch.load(std::memory_order_acquire);
    retired.erase(std::remove_if(retired.begin(), retired.end(), [&](auto& r) { return e >= r.second + 2; }), retired.end());
  }
  static int typeIndex(const json& v, const char* const* names, int n, int def)
  {
    if (v.is_number()) return std::max(0, std::min(n - 1, v.get<int>()));
    if (v.is_string())
      for (int i = 0; i < n; ++i)
        if (v.get<std::string>() == names[i]) return i;
    return def;
  }
  // a jack key or a scriptin part name to a node
  int targetNode(const json& to, bool jackOnly)
  {
    if (to.is_string())
    {
      for (size_t i = 0; i < nodes.size(); ++i)
        if ((nodes[i].kind == K_AIN || nodes[i].kind == K_AOUT) && nodes[i].jk == to.get<std::string>()) return int(i);
      return -1;
    }
    if (!to.is_object()) return -1;
    if (to.contains("jack")) return targetNode(to["jack"], true);
    if (jackOnly || !to.contains("part") || !to["part"].is_string()) return -1;
    std::string nm = to["part"].get<std::string>();
    for (auto& ch : nm) ch = char(std::tolower((unsigned char)ch));
    for (int q = 0; q < 2; ++q)
      for (size_t i = 0; i < nodes.size(); ++i)
        if (nodes[i].kind == K_SIN && (nm.empty() || nodes[i].sn[q] == nm)) return int(i);
    return -1;
  }
  void scriptCmd(const json& c) override
  {
    const std::string cmd = c.value("cmd", "");
    if (cmd == "scope") return setScope(c);
    if (cmd != "voice" && cmd != "fx") return;
    ScriptMsg m;
    m.fx = cmd == "fx";
    m.idx = c.value(m.fx ? "f" : "v", 0);
    m.stop = c.value("stop", false);
    if (!m.stop)
    {
      m.target = targetNode(m.fx ? c.value("jack", json()) : c.value("to", json()), m.fx);
      m.type = m.fx ? typeIndex(c.value("type", json()), kFxTypes, 5, 0) : typeIndex(c.value("type", json()), kVoiceTypes, 7, 0);
      auto num = [&](const char* k, float d) { return c.contains(k) && c[k].is_number() ? c[k].get<float>() : d; };
      m.freq = num("freq", m.fx ? 1000.f : 220.f), m.amp = num("amp", 0.5f), m.pw = num("pw", 0.5f);
      m.env = c.value("env", false);
      m.att = num("attack", 0.005f), m.dec = num("decay", 0.1f), m.sus = num("sustain", 1.f), m.rel = num("release", 0.05f);
      m.gate = c.contains("gate") ? (c["gate"].is_boolean() ? c["gate"].get<bool>() : num("gate", 1.f) > 0.5f) : true;
      m.trig = int(num("trig", 0.f));
      m.slot = int(num("slot", 0.f));
      m.loop = c.value("loop", false);
      m.rate = num("rate", 1.f), m.start = num("start", 0.f), m.pan = num("pan", 0.f);
      m.gain = num("gain", 1.f), m.q = num("q", 0.7f), m.amount = num("amount", 0.5f), m.mix = num("mix", 1.f);
    }
    pend.push_back(m);
    flushScript();
  }
  void flushScript()
  {
    size_t k = 0;
    while (k < pend.size() && smsg.push(pend[k])) ++k;
    pend.erase(pend.begin(), pend.begin() + long(k));
  }
  void setScope(const json& c)
  {
    wantLevel = wantSpec = wantWave = wantPitch = false;
    const json what = c.value("what", json::array({"level"}));
    for (auto& w : what)
      if (w.is_string())
      {
        const std::string s = w.get<std::string>();
        wantLevel = wantLevel || s == "level" || s == "all";
        wantSpec = wantSpec || s == "spec" || s == "all";
        wantWave = wantWave || s == "wave" || s == "all";
        wantPitch = wantPitch || s == "pitch" || s == "all";
      }
    nBands = std::max(4, std::min(kMaxBands, c.value("bands", 32)));
    nWave = std::max(16, std::min(kMaxWave, c.value("wave", 128)));
    waveSync = c.value("sync", true);
    waveSpan = std::max(nWave, std::min(waveSync ? kFft : kRing, c.value("span", std::max(nWave, kFft))));
    scopeJacks.clear();
    for (auto& j : c.value("jacks", json::array()))
      if (j.is_string()) scopeJacks.push_back(j.get<std::string>());
    const bool on = c.value("on", true) && (wantLevel || wantSpec || wantWave || wantPitch) && !taps.empty();
    if (on && !scopeOn.load())
      for (auto& t : taps) t->peak.store(0.f);
    scopeOn.store(on);
  }
  void scopeStatus(json& j)
  {
    json out = json::object();
    const double r4 = 10000.0;
    for (auto& tp : taps)
    {
      if (!scopeJacks.empty() && std::find(scopeJacks.begin(), scopeJacks.end(), tp->jk) == scopeJacks.end()) continue;
      const int w = tp->wpos.load(std::memory_order_acquire);
      for (int i = 0; i < kRing; ++i) work[i] = tp->ring[(w + i) & (kRing - 1)]; // oldest first
      json t = json::object();
      if (wantLevel)
      {
        double s2 = 0;
        for (int i = kRing - kFft; i < kRing; ++i) s2 += double(work[i]) * work[i];
        const float rms = float(std::sqrt(s2 / kFft)), pk = tp->peak.exchange(0.f);
        t["rms"] = std::round(double(rms) * r4) / r4;
        t["peak"] = std::round(double(pk) * r4) / r4;
        t["db"] = std::round(std::max(-120.0, 20.0 * std::log10(std::max(1e-9, double(rms)))) * 10.0) / 10.0;
        t["onset"] = tp->onsets.load(std::memory_order_relaxed);
      }
      if (wantSpec)
      {
        // nBands bands with log spaced centres from 40 Hz to 16 kHz, dBFS (a full scale sine reads 0), fast up, slow down
        for (int i = 0; i < kFft; ++i) fbuf[i] = work[kRing - kFft + i] * win[i];
        fft.transform(fbuf.data(), false);
        json a = json::array();
        const double r = std::pow(400.0, 1.0 / (nBands - 1));
        for (int b = 0; b < nBands; ++b)
        {
          const double fc = 40.0 * std::pow(r, b), f0 = fc / std::sqrt(r), f1 = fc * std::sqrt(r);
          int k0 = int(std::round(f0 * kFft / sr)), k1 = std::max(k0 + 1, int(std::round(f1 * kFft / sr)));
          k1 = std::min(k1, kFft / 2);
          float m = 0;
          for (int k = k0; k < k1; ++k) m = std::max(m, std::abs(fbuf[k]));
          const float db = 20.f * std::log10(std::max(1e-9f, m * 4.f / kFft));
          float& sm = tp->spec[b];
          sm = db > sm ? db : sm * 0.75f + db * 0.25f;
          a.push_back(int(std::round(std::max(-120.f, sm))));
        }
        t["spec"] = a;
      }
      if (wantWave)
      {
        // nWave points over the last waveSpan samples, newest last; with sync it starts at a rising zero crossing so
        // a steady note stands still (then it ends up to waveSpan samples before the newest)
        int s0 = kRing - waveSpan;
        if (waveSync)
          for (int i = kRing - waveSpan; i > kRing - 2 * waveSpan && i > 0; --i)
            if (work[i - 1] <= 0.f && work[i] > 0.f)
            {
              s0 = i;
              break;
            }
        json a = json::array();
        for (int q = 0; q < nWave; ++q)
        {
          const int i0 = s0 + int(int64_t(q) * waveSpan / nWave), i1 = std::max(i0 + 1, s0 + int(int64_t(q + 1) * waveSpan / nWave));
          float v = 0.f;
          for (int i = i0; i < i1 && i < kRing; ++i)
            if (std::fabs(work[i]) > std::fabs(v)) v = work[i];
          a.push_back(std::round(double(v) * 1000.0) / 1000.0);
        }
        t["wave"] = a;
      }
      if (wantPitch)
      {
        // the tuner's YIN on the ring decimated by 4
        const int D = 4, n = kRing / D;
        double s2 = 0;
        for (int i = 0; i < n; ++i)
        {
          float a = 0.f;
          for (int k = 0; k < D; ++k) a += work[i * D + k];
          dec[i] = a / D;
          s2 += double(dec[i]) * dec[i];
        }
        PitchResult r;
        if (std::sqrt(s2 / n) > 0.002) r = yinDetect(dec.data(), n, sr / D, 50.0, 1500.0, yinBuf);
        const bool ok = r.freq > 0 && r.conf > 0.5;
        t["hz"] = ok ? std::round(r.freq * 10.0) / 10.0 : 0.0;
        t["conf"] = std::round(r.conf * 100.0) / 100.0;
      }
      out[tp->jk] = t;
    }
    j["scope"] = out;
  }
  void controlTick() override
  {
    for (auto& nd : nodes)
      if (nd.b) nd.b->controlTick();
    if (!retired.empty()) freeRetired();
    if (!pend.empty()) flushScript();
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
    if (scopeOn.load()) scopeStatus(j);
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
      nd.playing = nd.restart = false;
      nd.stage = 0;
      nd.fade = 0.f;
      if (nd.kind == K_ADSR) nd.g = 0.f;
    }
  }
};

RegisterBlock r1("patch", [](const json& o, int nIn, int nOut) { return std::make_unique<PatchBlock>(o, nIn, nOut); });
} // namespace
} // namespace tz
