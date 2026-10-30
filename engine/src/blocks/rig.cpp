// Rig block: the engine side of big floor multi-FX units (Nautica XL). Sub-blocks (any algorithm, made with
// createBlock like 'chain') run in four lanes: pre (tuner, gate, volume pedal), path A, path B and post (looper).
// The paths run in series, in parallel or as two separate rigs (A from the guitar input, B from the aux input).
// An FX loop sub sends the signal at that point out of a send output and takes it back from a return input. When
// the loop goes through other blocks of the same graph, the return reads the previous engine cycle; with nothing
// plugged into the return, the send comes straight back (like the switching jack of a real loop).
// Logical outputs (a stereo pair or a mono jack) each pick a source (main, path A, path B, dry, off) and a level.
// The status has peak levels for every input and output channel ("io": {in, out}) plus each sub's status.
//
// opts:   { subs: [{prefix, algo, opts, params, on, loop: [sendL, sendR]}], pre, a, b, post: [sub indices],
//           ins: {gtr, aux: [l, r], ret: [input per send]}, outs: [{o, ch} | {o, mono: true} | {send}], nOuts }
// params: route (0 serial, 1 parallel, 2 dual), aLvl, bLvl (0..2), aPan, bPan, gtr, aux (dB), auxTo (0 off,
//         1 input, 2 path A, 3 path B, 4 main), o<j>.src (0 main, 1 A, 2 B, 3 dry, 4 off), o<j>.lvl (dB),
//         o<j>.mono (0 sum, 1 L, 2 R); loop subs: <prefix>.send, <prefix>.ret (dB), <prefix>.mix, <prefix>.on
#include "common.h"

namespace tz
{
namespace
{
class RigBlock : public Block
{
public:
  struct Sub
  {
    std::string prefix;
    std::unique_ptr<Block> b; // null for an FX loop
    std::vector<std::pair<int, int>> map;
    int onParam = -1;
    float onMix = 1.f;
    int sendL = -1, sendR = -1;            // FX loop: send indices (equal = mono loop)
    int sendP = -1, retP = -1, mixP = -1;  // FX loop params
    float gSend = 0.f, gRet = 0.f, gMix = 0.f;
  };
  struct Out
  {
    int o = -1, ch = 0, send = -1;
    bool mono = false;
  };
  std::vector<Sub> subs;
  std::vector<int> lanes[4]; // pre, a, b, post
  std::vector<Out> outs;
  int nOuts = 0;
  int gtrIn = 0, auxIn[2] = {-1, -1};
  std::vector<int> retIn;
  int pRoute, pALvl, pBLvl, pAPan, pBPan, pGtr, pAux, pAuxTo;
  std::vector<int> pSrc, pLvl, pMono;
  std::vector<float> gOut;
  float gGtr = 1.f, gAux = 1.f, gA = 1.f, gB = 1.f, gAL = 1.f, gAR = 1.f, gBL = 1.f, gBR = 1.f, byp = 1.f;
  using Buf = std::vector<float>;
  Buf work[2], tmp[2], sc[2], aOut[2], bOut[2], dry[2], aux[2], silent;
  std::vector<Buf> sendBuf;
  std::unique_ptr<std::atomic<float>[]> pkIn, pkOut;

  RigBlock(const json& o, int nIn_, int nOut_)
  {
    nIn = nIn_;
    nOut = nOut_;
    for (auto& sj : o.value("subs", json::array()))
    {
      Sub s;
      s.prefix = sj.value("prefix", "fx");
      if (sj.contains("loop") && sj["loop"].is_array() && !sj["loop"].empty())
      {
        s.sendL = sj["loop"][0].get<int>();
        s.sendR = sj["loop"].size() > 1 ? sj["loop"][1].get<int>() : s.sendL;
        s.sendP = addParam(s.prefix + ".send", 0.f, -40.f, 12.f);
        s.retP = addParam(s.prefix + ".ret", 0.f, -40.f, 12.f);
        s.mixP = addParam(s.prefix + ".mix", 1.f, 0.f, 1.f);
      }
      else
      {
        s.b = createBlock(sj.value("algo", "utility"), sj.value("opts", json::object()), 2, 2);
        if (!s.b) s.b = createBlock("utility", json::object(), 2, 2);
        for (size_t i = 0; i < s.b->defs.size(); ++i)
        {
          const auto& d = s.b->defs[i];
          float def = d.def;
          if (sj.contains("params") && sj["params"].contains(d.name)) def = sj["params"][d.name].get<float>();
          s.map.push_back({addParam(s.prefix + "." + d.name, def, d.min, d.max), int(i)});
        }
      }
      const bool on = sj.value("on", true);
      s.onParam = addParam(s.prefix + ".on", on ? 1.f : 0.f, 0, 1);
      s.onMix = on ? 1.f : 0.f;
      subs.push_back(std::move(s));
    }
    const char* names[4] = {"pre", "a", "b", "post"};
    for (int l = 0; l < 4; ++l)
      for (auto& v : o.value(names[l], json::array()))
        if (v.is_number_integer() && v.get<int>() >= 0 && v.get<int>() < int(subs.size())) lanes[l].push_back(v.get<int>());
    const json ins = o.value("ins", json::object());
    gtrIn = ins.value("gtr", 0);
    if (ins.contains("aux") && ins["aux"].is_array() && ins["aux"].size() == 2)
    {
      auxIn[0] = ins["aux"][0].get<int>();
      auxIn[1] = ins["aux"][1].get<int>();
    }
    for (auto& v : ins.value("ret", json::array())) retIn.push_back(v.get<int>());
    for (auto& e : o.value("outs", json::array()))
    {
      Out x;
      x.o = e.value("o", -1);
      x.ch = e.value("ch", 0);
      x.mono = e.value("mono", false);
      x.send = e.value("send", -1);
      outs.push_back(x);
    }
    nOuts = o.value("nOuts", 0);
    pRoute = addParam("route", 0, 0, 2);
    pALvl = addParam("aLvl", 1, 0, 2);
    pBLvl = addParam("bLvl", 1, 0, 2);
    pAPan = addParam("aPan", 0, -1, 1);
    pBPan = addParam("bPan", 0, -1, 1);
    pGtr = addParam("gtr", 0, -60, 12);
    pAux = addParam("aux", 0, -60, 12);
    pAuxTo = addParam("auxTo", 0, 0, 4);
    for (int j = 0; j < nOuts; ++j)
    {
      const std::string k = "o" + std::to_string(j) + ".";
      pSrc.push_back(addParam(k + "src", 0, 0, 4));
      pLvl.push_back(addParam(k + "lvl", 0, -60, 12));
      pMono.push_back(addParam(k + "mono", 0, 0, 2));
    }
    gOut.assign(nOuts, 0.f);
    finalizeParams();
    pkIn.reset(new std::atomic<float>[std::max(1, nIn)]);
    pkOut.reset(new std::atomic<float>[std::max(1, nOut)]);
    for (int i = 0; i < nIn; ++i) pkIn[i].store(0.f);
    for (int i = 0; i < nOut; ++i) pkOut[i].store(0.f);
  }
  bool hasTrails() const override { return true; }
  bool alwaysProcess() const override { return true; } // bypass, tuner and looper are handled here
  bool normalInputs() const override { return false; }
  void prepare(const PrepareCtx& c) override
  {
    for (auto& s : subs)
      if (s.b)
      {
        s.b->nIn = 2;
        s.b->nOut = 2;
        s.b->inConnected = 3u;
        s.b->prepare(c);
      }
    for (Buf* b : {work, tmp, sc, aOut, bOut, dry, aux})
      for (int k = 0; k < 2; ++k) b[k].assign(c.maxBlock, 0.f);
    silent.assign(c.maxBlock, 0.f);
    int ns = 0;
    for (auto& s : subs) ns = std::max(ns, std::max(s.sendL, s.sendR) + 1);
    for (auto& o : outs) ns = std::max(ns, o.send + 1);
    sendBuf.assign(ns, Buf(c.maxBlock, 0.f));
  }
  void onEvent(const BlockEvent& e) override
  {
    // events go to the sub at index arg / 100 (inner arg = arg % 100), like 'chain'
    const int si = e.arg / 100;
    if (si >= 0 && si < int(subs.size()) && subs[si].b)
    {
      BlockEvent inner = e;
      inner.arg = e.arg % 100;
      subs[si].b->onEvent(inner);
    }
  }
  static float ramp(float a, float b, int i, int n) { return a + (b - a) * float(i) / float(n); }
  float stepMix(Sub& s, int n, float& m0)
  {
    const float step = float(n) / 480.f;
    const float target = p(s.onParam) > 0.5f ? 1.f : 0.f;
    m0 = s.onMix;
    s.onMix = m0 < target ? std::min(target, m0 + step) : std::max(target, m0 - step);
    return s.onMix;
  }
  bool connected(int ch) const { return ch >= 0 && ch < nIn && ch < 32 && (inConnected & (1u << ch)); }
  void runSub(Sub& s, Buf* x, const float* const* in, int n)
  {
    float m0;
    const float m1 = stepMix(s, n, m0);
    if (!s.b)
    {
      runLoop(s, x, in, n, m0, m1);
      return;
    }
    if (m0 == 0.f && m1 == 0.f && !s.b->hasTrails()) return;
    for (auto& [mine, theirs] : s.map) s.b->vals[theirs].store(p(mine), std::memory_order_relaxed);
    const bool trails = s.b->hasTrails() && (m0 < 1.f || m1 < 1.f);
    const float* src[2] = {x[0].data(), x[1].data()};
    if (trails)
    {
      for (int c = 0; c < 2; ++c)
        for (int i = 0; i < n; ++i) sc[c][i] = x[c][i] * ramp(m0, m1, i, n);
      src[0] = sc[0].data();
      src[1] = sc[1].data();
    }
    float* op[2] = {tmp[0].data(), tmp[1].data()};
    s.b->process(src, op, n);
    for (int c = 0; c < 2; ++c)
      for (int i = 0; i < n; ++i)
      {
        const float m = ramp(m0, m1, i, n);
        x[c][i] = trails ? tmp[c][i] + x[c][i] * (1.f - m) : tmp[c][i] * m + x[c][i] * (1.f - m);
      }
  }
  void runLoop(Sub& s, Buf* x, const float* const* in, int n, float m0, float m1)
  {
    const float tS = dbToGain(p(s.sendP)), tR = dbToGain(p(s.retP)), tM = p(s.mixP);
    const float s0 = s.gSend, r0 = s.gRet, x0 = s.gMix;
    s.gSend = tS * m1;
    s.gRet = tR;
    s.gMix = tM * m1;
    if (m0 == 0.f && m1 == 0.f && s0 == 0.f) return;
    const bool mono = s.sendL == s.sendR;
    const int rl = s.sendL < int(retIn.size()) ? retIn[s.sendL] : -1, rr = s.sendR < int(retIn.size()) ? retIn[s.sendR] : -1;
    const bool cl = connected(rl), cr = connected(rr);
    float* sl = s.sendL >= 0 && s.sendL < int(sendBuf.size()) ? sendBuf[s.sendL].data() : nullptr;
    float* sr = s.sendR >= 0 && s.sendR < int(sendBuf.size()) ? sendBuf[s.sendR].data() : nullptr;
    for (int i = 0; i < n; ++i)
    {
      const float gs = ramp(s0, s.gSend, i, n), gr = ramp(r0, s.gRet, i, n), gm = ramp(x0, s.gMix, i, n);
      const float L = x[0][i], R = x[1][i];
      float oL, oR, rL, rR;
      if (mono)
      {
        oL = oR = 0.5f * (L + R) * gs;
        if (sl) sl[i] += oL;
        rL = rR = (cl ? in[rl][i] : oL) * gr;
      }
      else
      {
        oL = L * gs;
        oR = R * gs;
        if (sl) sl[i] += oL;
        if (sr) sr[i] += oR;
        rL = (cl ? in[rl][i] : oL) * gr;
        rR = (cr ? in[rr][i] : oR) * gr;
      }
      x[0][i] = L * (1.f - gm) + rL * gm;
      x[1][i] = R * (1.f - gm) + rR * gm;
    }
  }
  void runLane(int l, Buf* x, const float* const* in, int n)
  {
    for (int si : lanes[l]) runSub(subs[si], x, in, n);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    for (int i = 0; i < nIn; ++i)
    {
      float pk = 0.f;
      for (int k = 0; k < n; ++k) pk = std::max(pk, std::fabs(in[i][k]));
      if (pk > pkIn[i].load(std::memory_order_relaxed)) pkIn[i].store(pk, std::memory_order_relaxed);
    }
    for (auto& b : sendBuf) std::fill(b.begin(), b.begin() + n, 0.f);
    const int route = int(std::lround(p(pRoute))), auxTo = int(std::lround(p(pAuxTo)));
    const float g0 = gGtr, a0 = gAux;
    gGtr = p(pGtr) <= -59.f ? 0.f : dbToGain(p(pGtr));
    gAux = p(pAux) <= -59.f ? 0.f : dbToGain(p(pAux));
    const float* gi = gtrIn >= 0 && gtrIn < nIn ? in[gtrIn] : silent.data();
    const bool hasAuxL = connected(auxIn[0]), hasAuxR = connected(auxIn[1]);
    const float* al = hasAuxL ? in[auxIn[0]] : hasAuxR ? in[auxIn[1]] : silent.data();
    const float* ar = hasAuxR ? in[auxIn[1]] : al;
    for (int i = 0; i < n; ++i)
    {
      const float g = ramp(g0, gGtr, i, n), ga = ramp(a0, gAux, i, n);
      dry[0][i] = dry[1][i] = gi[i] * g;
      aux[0][i] = al[i] * ga;
      aux[1][i] = ar[i] * ga;
      work[0][i] = dry[0][i] + (auxTo == 1 ? aux[0][i] : 0.f);
      work[1][i] = dry[1][i] + (auxTo == 1 ? aux[1][i] : 0.f);
    }
    runLane(0, work, in, n);
    const size_t bytes = sizeof(float) * n;
    auto addAux = [&](Buf* x) {
      for (int c = 0; c < 2; ++c)
        for (int i = 0; i < n; ++i) x[c][i] += aux[c][i];
    };
    // balance gains for the path mix
    const float ga0 = gAL, ga1 = gAR, gb0 = gBL, gb1 = gBR;
    const float aL = p(pALvl), bL = p(pBLvl), ap = p(pAPan), bp = p(pBPan);
    if (route == 0)
    {
      if (auxTo == 2) addAux(work);
      runLane(1, work, in, n);
      for (int c = 0; c < 2; ++c) std::memcpy(aOut[c].data(), work[c].data(), bytes);
      if (auxTo == 3) addAux(work);
      runLane(2, work, in, n);
      for (int c = 0; c < 2; ++c) std::memcpy(bOut[c].data(), work[c].data(), bytes);
    }
    else
    {
      for (int c = 0; c < 2; ++c)
      {
        std::memcpy(aOut[c].data(), work[c].data(), bytes);
        if (route == 1) std::memcpy(bOut[c].data(), work[c].data(), bytes);
        else std::memcpy(bOut[c].data(), aux[c].data(), bytes);
      }
      if (auxTo == 2) addAux(aOut);
      if (auxTo == 3 && route == 1) addAux(bOut);
      runLane(1, aOut, in, n);
      runLane(2, bOut, in, n);
      const float k = route == 1 ? 0.5f : 1.f;
      gAL = k * aL * std::min(1.f, 1.f - ap);
      gAR = k * aL * std::min(1.f, 1.f + ap);
      gBL = k * bL * std::min(1.f, 1.f - bp);
      gBR = k * bL * std::min(1.f, 1.f + bp);
      for (int i = 0; i < n; ++i)
      {
        work[0][i] = aOut[0][i] * ramp(ga0, gAL, i, n) + bOut[0][i] * ramp(gb0, gBL, i, n);
        work[1][i] = aOut[1][i] * ramp(ga1, gAR, i, n) + bOut[1][i] * ramp(gb1, gBR, i, n);
      }
    }
    if (auxTo == 4) addAux(work);
    runLane(3, work, in, n);
    // whole-unit bypass: the guitar goes straight to the outputs
    const float b0 = byp;
    byp = bypass.load(std::memory_order_relaxed) ? std::max(0.f, byp - float(n) / 576.f) : std::min(1.f, byp + float(n) / 576.f);
    if (b0 < 1.f || byp < 1.f)
      for (int c = 0; c < 2; ++c)
        for (int i = 0; i < n; ++i)
        {
          const float m = ramp(b0, byp, i, n);
          work[c][i] = work[c][i] * m + dry[c][i] * (1.f - m);
        }
    // logical outputs
    float gPrev[32];
    for (int j = 0; j < nOuts && j < 32; ++j) gPrev[j] = gOut[j];
    for (int j = 0; j < nOuts; ++j)
    {
      const float t = int(std::lround(p(pSrc[j]))) == 4 || p(pLvl[j]) <= -59.f ? 0.f : dbToGain(p(pLvl[j]));
      gOut[j] = t;
    }
    for (int c = 0; c < nOut && c < int(outs.size()); ++c)
    {
      const Out& e = outs[c];
      float* o = out[c];
      if (e.send >= 0)
      {
        if (e.send < int(sendBuf.size()) && byp > 0.f) for (int i = 0; i < n; ++i) o[i] = sendBuf[e.send][i] * byp;
        else std::memset(o, 0, bytes);
      }
      else if (e.o >= 0 && e.o < nOuts && e.o < 32)
      {
        const int src = int(std::lround(p(pSrc[e.o])));
        const Buf* b = src == 1 ? aOut : src == 2 ? bOut : src == 3 ? dry : work;
        const float ga = gPrev[e.o], gb = gOut[e.o];
        if (e.mono)
        {
          const int m = int(std::lround(p(pMono[e.o])));
          for (int i = 0; i < n; ++i)
          {
            const float v = m == 1 ? b[0][i] : m == 2 ? b[1][i] : 0.5f * (b[0][i] + b[1][i]);
            o[i] = v * ramp(ga, gb, i, n);
          }
        }
        else
        {
          const float* s = b[std::min(1, std::max(0, e.ch))].data();
          for (int i = 0; i < n; ++i) o[i] = s[i] * ramp(ga, gb, i, n);
        }
      }
      else std::memset(o, 0, bytes);
      float pk = 0.f;
      for (int i = 0; i < n; ++i) pk = std::max(pk, std::fabs(o[i]));
      if (pk > pkOut[c].load(std::memory_order_relaxed)) pkOut[c].store(pk, std::memory_order_relaxed);
    }
    for (int c = int(outs.size()); c < nOut; ++c) std::memset(out[c], 0, bytes);
  }
  void controlTick() override
  {
    for (auto& s : subs)
      if (s.b) s.b->controlTick();
  }
  void status(json& j) override
  {
    for (auto& s : subs)
    {
      if (!s.b) continue;
      json sj = json::object();
      s.b->status(sj);
      if (!sj.empty()) j[s.prefix] = sj;
    }
    json a = json::array(), b = json::array();
    for (int i = 0; i < nIn; ++i) a.push_back(std::round(pkIn[i].exchange(0.f) * 1000.f) / 1000.f);
    for (int i = 0; i < nOut; ++i) b.push_back(std::round(pkOut[i].exchange(0.f) * 1000.f) / 1000.f);
    j["io"] = {{"in", a}, {"out", b}};
  }
  void reset() override
  {
    for (auto& s : subs)
      if (s.b) s.b->reset();
  }
};

RegisterBlock r1("rig", [](const json& o, int nIn, int nOut) { return std::make_unique<RigBlock>(o, nIn, nOut); });
} // namespace
} // namespace tz
