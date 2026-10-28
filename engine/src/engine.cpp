#if defined(__x86_64__) || defined(__i386__)
#include <xmmintrin.h>
#endif
#include "engine.h"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <iostream>
#include <map>
#include <set>
#include <time.h>

#include "dsp/core.h"
#include "wavio.h"

namespace tz
{
std::map<std::string, BlockFactory>& blockRegistry()
{
  static std::map<std::string, BlockFactory> r;
  return r;
}

std::unique_ptr<Block> createBlock(const std::string& algo, const json& opts, int nIn, int nOut)
{
  auto& r = blockRegistry();
  auto it = r.find(algo);
  if (it == r.end()) return nullptr;
  auto b = it->second(opts, nIn, nOut);
  if (b)
  {
    b->algo = algo;
    b->nIn = nIn;
    b->nOut = nOut;
    b->opts = opts;
    if (!b->vals) b->finalizeParams();
  }
  return b;
}

static inline double nowNs()
{
  timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return double(ts.tv_sec) * 1e9 + double(ts.tv_nsec);
}

Engine::Engine()
{
  for (auto& p : inPeak) p.store(0);
  for (auto& p : outPeak) p.store(0);
  jack = &jackApi();
}

Engine::~Engine() { stopJack(); }

void Engine::send(const json& ev)
{
  std::string s = ev.dump(-1, ' ', false, json::error_handler_t::replace);
  std::lock_guard<std::mutex> lk(outMutex);
  fwrite(s.data(), 1, s.size(), stdout);
  fputc('\n', stdout);
  fflush(stdout);
}

int Engine::oversampleFor(int q) const
{
  switch (q)
  {
    case 0: return 1;
    case 1: return 2;
    case 2: return 4;
    default: return 8;
  }
}

// ------------------------------------------------------------------ JACK
static int jackProcess(jack_nframes_t n, void* arg) { return static_cast<Engine*>(arg)->process(n); }

bool Engine::startJack(std::string& err)
{
  if (!jack->load(err)) return false;
  int status = 0;
  client = jack->client_open("Tone Zone", JackNoStartServer, &status);
  if (!client)
  {
    err = "Could not connect to the PipeWire/JACK audio server (status " + std::to_string(status) + ").";
    return false;
  }
  sr = jack->get_sample_rate(client);
  bufSize = int(jack->get_buffer_size(client));
  const char* inNames[kNumSysIn] = {"in_1", "in_2", "return_1", "return_2"};
  const char* inAlias[kNumSysIn] = {"Guitar In 1", "Guitar In 2", "Return L", "Return R"};
  const char* outNames[kNumSysOut] = {"out_L", "out_R", "send_1", "send_2"};
  const char* outAlias[kNumSysOut] = {"Main Out L", "Main Out R", "Send L", "Send R"};
  for (int i = 0; i < kNumSysIn; ++i)
  {
    inPorts[i] = jack->port_register(client, inNames[i], JACK_DEFAULT_AUDIO_TYPE, JackPortIsInput | JackPortIsTerminal, 0);
    if (jack->port_set_alias && inPorts[i]) jack->port_set_alias(inPorts[i], inAlias[i]);
  }
  for (int i = 0; i < kNumSysOut; ++i)
  {
    outPorts[i] = jack->port_register(client, outNames[i], JACK_DEFAULT_AUDIO_TYPE, JackPortIsOutput | JackPortIsTerminal, 0);
    if (jack->port_set_alias && outPorts[i]) jack->port_set_alias(outPorts[i], outAlias[i]);
  }
  jack->set_process_callback(client, jackProcess, this);
  jack->set_xrun_callback(client, [](void* a) -> int { static_cast<Engine*>(a)->xruns.fetch_add(1); return 0; }, this);
  jack->set_buffer_size_callback(client, [](jack_nframes_t n, void* a) -> int {
    auto* e = static_cast<Engine*>(a);
    if (int(n) != e->bufSize) { e->bufSize = int(n); e->needRebuild.store(true); }
    return 0; }, this);
  jack->set_sample_rate_callback(client, [](jack_nframes_t n, void* a) -> int {
    auto* e = static_cast<Engine*>(a);
    if (double(n) != e->sr) { e->sr = double(n); e->needRebuild.store(true); }
    return 0; }, this);
  jack->on_shutdown(client, [](void* a) { static_cast<Engine*>(a)->jackActive.store(false); }, this);
  if (settings.requestedBuffer > 0 && jack->set_buffer_size) jack->set_buffer_size(client, settings.requestedBuffer);
  if (jack->activate(client) != 0)
  {
    err = "Failed to activate audio client.";
    return false;
  }
  jackActive.store(true);
  bufSize = int(jack->get_buffer_size(client));
  return true;
}

void Engine::stopJack()
{
  if (client)
  {
    jack->deactivate(client);
    jack->client_close(client);
    client = nullptr;
  }
  jackActive.store(false);
}

void Engine::autoConnect()
{
  if (!client) return;
  const char** caps = jack->get_ports(client, nullptr, JACK_DEFAULT_AUDIO_TYPE, JackPortIsPhysical | JackPortIsOutput);
  if (caps)
  {
    if (caps[0]) jack->connect(client, caps[0], jack->port_name(inPorts[0]));
    jack->free(caps);
  }
  const char** pb = jack->get_ports(client, nullptr, JACK_DEFAULT_AUDIO_TYPE, JackPortIsPhysical | JackPortIsInput);
  if (pb)
  {
    if (pb[0]) jack->connect(client, jack->port_name(outPorts[0]), pb[0]);
    if (pb[0] && pb[1]) jack->connect(client, jack->port_name(outPorts[1]), pb[1]);
    else if (pb[0]) jack->connect(client, jack->port_name(outPorts[1]), pb[0]);
    jack->free(pb);
  }
}

void Engine::listPorts()
{
  json ev = {{"ev", "ports"}};
  if (!client)
  {
    send(ev);
    return;
  }
  auto collect = [&](unsigned long flags) {
    json arr = json::array();
    const char** ports = jack->get_ports(client, nullptr, JACK_DEFAULT_AUDIO_TYPE, flags);
    if (ports)
    {
      for (int i = 0; ports[i]; ++i)
      {
        jack_port_t* p = jack->port_by_name(client, ports[i]);
        json conns = json::array();
        if (p)
        {
          const char** c = jack->port_get_all_connections(client, p);
          if (c)
          {
            for (int k = 0; c[k]; ++k) conns.push_back(c[k]);
            jack->free(c);
          }
        }
        const int fl = p ? jack->port_flags(p) : 0;
        arr.push_back({{"name", ports[i]}, {"physical", bool(fl & JackPortIsPhysical)}, {"connections", conns}});
      }
      jack->free(ports);
    }
    return arr;
  };
  ev["sources"] = collect(JackPortIsOutput);
  ev["sinks"] = collect(JackPortIsInput);
  std::string me = jack->get_client_name ? jack->get_client_name(client) : "Tone Zone";
  ev["self"] = me;
  send(ev);
}

// ------------------------------------------------------------------ RT process
static inline void flushDenormals()
{
#if defined(__x86_64__) || defined(__i386__)
  // FTZ + DAZ: decaying filter / reverb / feedback states otherwise fall into denormals and stall the CPU
  _mm_setcsr(_mm_getcsr() | 0x8040);
#endif
}

int Engine::process(jack_nframes_t nframes)
{
  flushDenormals();
  const int n = int(nframes);
  const double t0 = nowNs();
  if (CompiledGraph* p = pending.exchange(nullptr, std::memory_order_acq_rel)) inUse.store(p, std::memory_order_release);
  CompiledGraph* g = inUse.load(std::memory_order_acquire);
  const float* ins[kNumSysIn];
  float* outs[kNumSysOut];
  for (int i = 0; i < kNumSysIn; ++i) ins[i] = static_cast<const float*>(jack->port_get_buffer(inPorts[i], nframes));
  for (int i = 0; i < kNumSysOut; ++i) outs[i] = static_cast<float*>(jack->port_get_buffer(outPorts[i], nframes));
  if (!g || n > kMaxBlock)
  {
    for (int i = 0; i < kNumSysOut; ++i) std::memset(outs[i], 0, sizeof(float) * n);
    return 0;
  }
  processGraph(g, ins, outs, n);
  const double dt = nowNs() - t0;
  cycleNsAccum.store(cycleNsAccum.load(std::memory_order_relaxed) + dt, std::memory_order_relaxed);
  if (dt > cycleNsPeak.load(std::memory_order_relaxed)) cycleNsPeak.store(dt, std::memory_order_relaxed);
  cycleCount.fetch_add(1, std::memory_order_relaxed);
  return 0;
}

void Engine::processGraph(CompiledGraph* g, const float* const* sysIn, float* const* sysOut, int n)
{
  const float ig = inGain.load(std::memory_order_relaxed);
  const float og = outGain.load(std::memory_order_relaxed);
  // system inputs -> buffers 0..3
  for (int c = 0; c < kNumSysIn; ++c)
  {
    float* b = g->buffers[c].data();
    float pk = 0;
    for (int i = 0; i < n; ++i)
    {
      const float v = sysIn[c][i] * ig;
      b[i] = v;
      pk = std::max(pk, std::fabs(v));
    }
    if (pk > inPeak[c].load(std::memory_order_relaxed)) inPeak[c].store(pk, std::memory_order_relaxed);
  }
  const float bypStep = float(n) / float(0.012 * sr);
  for (auto& node : g->nodes)
  {
    Block* b = node.b;
    const double t0 = nowNs();
    // sum multi-cable inputs
    for (size_t i = 0; i < node.inSum.size(); ++i)
    {
      if (node.inSum[i].empty()) continue;
      float* dst = g->buffers[node.in[i]].data();
      std::memset(dst, 0, sizeof(float) * n);
      for (int src : node.inSum[i])
      {
        const float* s = g->buffers[src].data();
        for (int k = 0; k < n; ++k) dst[k] += s[k];
      }
    }
    for (size_t i = 0; i < node.in.size(); ++i) g->inPtrs[i] = g->buffers[node.in[i]].data();
    for (size_t i = 0; i < node.out.size(); ++i) g->outPtrs[i] = g->buffers[node.out[i]].data();
    const bool byp = b->bypass.load(std::memory_order_relaxed);
    const float target = byp ? 0.f : 1.f;
    const float m0 = b->bypassMix;
    float m1 = m0;
    if (m1 < target) m1 = std::min(target, m1 + bypStep);
    else if (m1 > target) m1 = std::max(target, m1 - bypStep);
    b->bypassMix = m1;
    BlockEvent ev;
    while (b->events.pop(ev)) b->onEvent(ev);
    const int nIn = int(node.in.size()), nOut = int(node.out.size());
    auto dryOf = [&](int c) -> const float* {
      if (nIn == 0) return g->buffers[g->silentBuf].data();
      return g->inPtrs[std::min(c, nIn - 1)];
    };
    if (b->alwaysProcess())
    {
      b->process(g->inPtrs.data(), g->outPtrs.data(), n); // block handles its own bypass
    }
    else if (m0 == 0.f && m1 == 0.f && !b->hasTrails())
    {
      for (int c = 0; c < nOut; ++c) std::memcpy(g->outPtrs[c], dryOf(c), sizeof(float) * n);
    }
    else if (m0 == 1.f && m1 == 1.f)
    {
      b->process(g->inPtrs.data(), g->outPtrs.data(), n);
    }
    else if (b->hasTrails())
    {
      // fade the block's input, add dry in parallel: tails ring out naturally
      float* scratch = g->dryScratch.data();
      const float* origIn[8];
      for (int c = 0; c < nIn && c < 8; ++c)
      {
        origIn[c] = g->inPtrs[c];
        float* s = scratch + c * kMaxBlock;
        for (int k = 0; k < n; ++k) s[k] = origIn[c][k] * (m0 + (m1 - m0) * float(k) / float(n));
        g->inPtrs[c] = s;
      }
      b->process(g->inPtrs.data(), g->outPtrs.data(), n);
      for (int c = 0; c < nOut; ++c)
      {
        const float* d = (nIn == 0) ? g->buffers[g->silentBuf].data() : origIn[std::min(c, nIn - 1)];
        float* o = g->outPtrs[c];
        for (int k = 0; k < n; ++k) o[k] += d[k] * (1.f - (m0 + (m1 - m0) * float(k) / float(n)));
      }
    }
    else
    {
      b->process(g->inPtrs.data(), g->outPtrs.data(), n);
      for (int c = 0; c < nOut; ++c)
      {
        const float* d = dryOf(c);
        float* o = g->outPtrs[c];
        for (int k = 0; k < n; ++k)
        {
          const float m = m0 + (m1 - m0) * float(k) / float(n);
          o[k] = o[k] * m + d[k] * (1.f - m);
        }
      }
    }
    // guard against NaN/inf blowups from any block
    for (int c = 0; c < nOut; ++c)
    {
      float* o = g->outPtrs[c];
      for (int k = 0; k < n; ++k)
        if (!std::isfinite(o[k])) { std::memset(o, 0, sizeof(float) * n); b->reset(); break; }
    }
    const double dt = nowNs() - t0;
    b->nsAccum.store(b->nsAccum.load(std::memory_order_relaxed) + dt, std::memory_order_relaxed);
    if (dt > b->nsPeak.load(std::memory_order_relaxed)) b->nsPeak.store(dt, std::memory_order_relaxed);
    b->cycles.fetch_add(1, std::memory_order_relaxed);
  }
  for (int c = 0; c < kNumSysOut; ++c)
  {
    float* o = sysOut[c];
    std::memset(o, 0, sizeof(float) * n);
    for (int src : g->sysOut[c])
    {
      const float* s = g->buffers[src].data();
      for (int k = 0; k < n; ++k) o[k] += s[k];
    }
    float pk = 0;
    for (int k = 0; k < n; ++k)
    {
      // soft safety limiter above 0 dBFS so a runaway preset cannot blast ears/speakers
      float v = o[k] * og;
      const float a = std::fabs(v);
      if (a > 0.95f) v = std::copysign(0.95f + 0.05f * std::tanh((a - 0.95f) / 0.05f), v);
      o[k] = v;
      pk = std::max(pk, a);
    }
    if (pk > outPeak[c].load(std::memory_order_relaxed)) outPeak[c].store(pk, std::memory_order_relaxed);
  }
}

// ------------------------------------------------------------------ graph building
std::shared_ptr<CompiledGraph> Engine::compile(const json& gj, std::map<std::string, std::shared_ptr<Block>>& blks,
                                               bool forceNew)
{
  auto g = std::make_shared<CompiledGraph>();
  PrepareCtx ctx;
  ctx.sr = sr;
  ctx.maxBlock = kMaxBlock;
  ctx.hostBlock = std::max(16, std::min(bufSize, 1024));
  ctx.quality = settings.quality;
  ctx.oversample = oversampleFor(settings.quality);
  ctx.dataDir = dataDir;

  std::map<std::string, std::shared_ptr<Block>> next;
  std::vector<std::shared_ptr<Block>> order;
  const json nodes = gj.value("nodes", json::array());
  for (const auto& nj : nodes)
  {
    const std::string id = nj.value("id", "");
    const std::string algo = nj.value("algo", "");
    if (id.empty() || id == "__in" || id == "__out") continue;
    const int nIn = nj.value("nIn", 1), nOut = nj.value("nOut", 1);
    const json opts = nj.value("opts", json::object());
    std::shared_ptr<Block> b;
    auto it = blks.find(id);
    if (!forceNew && it != blks.end() && it->second->algo == algo && it->second->nIn == nIn && it->second->nOut == nOut &&
        it->second->opts == opts)
      b = it->second;
    else
    {
      try
      {
        auto nb = createBlock(algo, opts, nIn, nOut);
        if (!nb)
        {
          send({{"ev", "blockError"}, {"id", id}, {"error", "Unknown block type: " + algo}});
          continue;
        }
        nb->id = id;
        // carry over params from the previous instance
        if (it != blks.end())
          for (size_t i = 0; i < it->second->defs.size(); ++i)
            nb->setParam(it->second->defs[i].name, it->second->p(int(i)));
        nb->prepare(ctx);
        if (!nb->loadError.empty()) send({{"ev", "blockError"}, {"id", id}, {"error", nb->loadError}});
        if (!nb->info.is_null()) send({{"ev", "blockInfo"}, {"id", id}, {"info", nb->info}});
        b = std::shared_ptr<Block>(std::move(nb));
      }
      catch (const std::exception& e)
      {
        send({{"ev", "blockError"}, {"id", id}, {"error", e.what()}});
        continue;
      }
    }
    if (nj.contains("params"))
      for (auto& [k, v] : nj["params"].items())
        if (v.is_number()) b->setParam(k, v.get<float>());
        else if (v.is_boolean()) b->setParam(k, v.get<bool>() ? 1.f : 0.f);
    b->bypass.store(nj.value("bypass", false));
    if (b.get() != (it != blks.end() ? it->second.get() : nullptr)) b->bypassMix = b->bypass.load() ? 0.f : 1.f;
    next[id] = b;
    order.push_back(b);
  }

  // buffers: 0..3 sys in, 4 silent, then node outputs
  int nb = kNumSysIn;
  g->silentBuf = nb++;
  std::map<std::pair<std::string, int>, int> outBuf;
  for (int i = 0; i < kNumSysIn; ++i) outBuf[{"__in", i}] = i;
  for (auto& b : order)
    for (int o = 0; o < b->nOut; ++o) outBuf[{b->id, o}] = nb++;

  // edges
  std::map<std::pair<std::string, int>, std::vector<int>> inSources; // (node,inPort) -> buffers
  std::map<std::string, std::set<std::string>> deps;
  for (const auto& c : gj.value("cables", json::array()))
  {
    const std::string fn = c["from"].value("node", ""), tn = c["to"].value("node", "");
    const int fp = c["from"].value("port", 0), tp = c["to"].value("port", 0);
    auto ob = outBuf.find({fn, fp});
    if (ob == outBuf.end()) continue;
    if (tn != "__out" && !next.count(tn)) continue;
    inSources[{tn, tp}].push_back(ob->second);
    if (fn != "__in" && tn != "__out") deps[tn].insert(fn);
  }

  // topological order (Kahn); leftover cycles appended (they read previous-cycle data)
  std::vector<std::shared_ptr<Block>> sorted;
  std::set<std::string> done;
  bool progress = true;
  while (progress && sorted.size() < order.size())
  {
    progress = false;
    for (auto& b : order)
    {
      if (done.count(b->id)) continue;
      bool ready = true;
      for (auto& d : deps[b->id])
        if (!done.count(d) && next.count(d)) { ready = false; break; }
      if (ready)
      {
        sorted.push_back(b);
        done.insert(b->id);
        progress = true;
      }
    }
  }
  for (auto& b : order)
    if (!done.count(b->id)) sorted.push_back(b);

  // only blocks that feed a system output (or that must always run, e.g. tuners / loopers) are processed
  std::set<std::string> live;
  {
    std::map<std::string, std::set<std::string>> rev; // to -> froms
    for (const auto& c : gj.value("cables", json::array()))
      rev[c["to"].value("node", "")].insert(c["from"].value("node", ""));
    std::vector<std::string> stack = {"__out"};
    for (auto& b : order)
      if (b->alwaysProcess()) stack.push_back(b->id);
    while (!stack.empty())
    {
      const std::string n = stack.back();
      stack.pop_back();
      if (live.count(n)) continue;
      live.insert(n);
      for (auto& f : rev[n]) stack.push_back(f);
    }
  }
  for (auto& b : sorted)
  {
    if (!live.count(b->id)) continue;
    CompiledGraph::Node node;
    node.b = b.get();
    node.inSum.resize(b->nIn);
    uint32_t mask = 0;
    for (int i = 0; i < b->nIn; ++i)
    {
      auto it = inSources.find({b->id, i});
      if (it == inSources.end() || it->second.empty())
        node.in.push_back(-1);
      else if (it->second.size() == 1)
      {
        node.in.push_back(it->second[0]);
        mask |= 1u << i;
      }
      else
      {
        node.in.push_back(nb);
        node.inSum[i] = it->second;
        nb++;
        mask |= 1u << i;
      }
    }
    // normalling: unconnected input -> previous connected input (stereo pedals fed mono)
    for (int i = 0; i < b->nIn; ++i)
      if (node.in[i] < 0)
      {
        if (b->normalInputs() && i > 0 && node.in[i - 1] >= 0 && !(i >= 2))
          node.in[i] = node.in[i - 1];
        else
          node.in[i] = g->silentBuf;
      }
    b->inConnected = mask;
    for (int o = 0; o < b->nOut; ++o) node.out.push_back(outBuf[{b->id, o}]);
    g->nodes.push_back(node);
  }
  g->sysOut.resize(kNumSysOut);
  for (int c = 0; c < kNumSysOut; ++c)
  {
    auto it = inSources.find({"__out", c});
    if (it != inSources.end()) g->sysOut[c] = it->second;
  }
  // output connected masks
  for (auto& b : sorted)
  {
    uint32_t m = 0;
    for (int o = 0; o < b->nOut; ++o)
    {
      const int buf = outBuf[{b->id, o}];
      bool used = false;
      for (auto& [k, v] : inSources)
        for (int s : v)
          if (s == buf) used = true;
      if (used) m |= 1u << o;
    }
    b->outConnected = m;
  }
  g->buffers.assign(nb, std::vector<float>(kMaxBlock, 0.f));
  g->inPtrs.resize(64);
  g->outPtrs.resize(64);
  g->dryScratch.assign(8 * kMaxBlock, 0.f);
  g->owned = sorted;
  blks = next;
  return g;
}

void Engine::swapGraph(std::shared_ptr<CompiledGraph> g)
{
  CompiledGraph* raw = g.get();
  if (jackActive.load())
  {
    pending.store(raw, std::memory_order_release);
    const auto t0 = std::chrono::steady_clock::now();
    while (inUse.load(std::memory_order_acquire) != raw)
    {
      std::this_thread::sleep_for(std::chrono::microseconds(500));
      if (std::chrono::steady_clock::now() - t0 > std::chrono::milliseconds(1500))
      {
        // audio thread not running; take over directly
        CompiledGraph* expected = raw;
        pending.compare_exchange_strong(expected, nullptr);
        inUse.store(raw);
        break;
      }
    }
  }
  else
  {
    inUse.store(raw);
  }
  if (current) retired.push_back(current);
  current = g;
  // safe now: RT thread no longer references retired graphs
  retired.clear();
}

void Engine::setGraph(const json& g)
{
  lastGraph = g;
  auto cg = compile(g, blocks, false);
  swapGraph(cg);
  send({{"ev", "graphApplied"}, {"nodes", int(cg->nodes.size())}});
}

void Engine::rebuild()
{
  if (lastGraph.is_null()) return;
  auto cg = compile(lastGraph, blocks, true);
  swapGraph(cg);
}

// ------------------------------------------------------------------ commands / status
void Engine::handleCommand(const json& cmd)
{
  const std::string c = cmd.value("cmd", "");
  if (c == "setGraph")
    setGraph(cmd["graph"]);
  else if (c == "param")
  {
    auto it = blocks.find(cmd.value("id", ""));
    if (it != blocks.end()) it->second->setParam(cmd.value("name", ""), cmd.value("value", 0.f));
  }
  else if (c == "params")
  {
    auto it = blocks.find(cmd.value("id", ""));
    if (it != blocks.end())
      for (auto& [k, v] : cmd["values"].items())
        if (v.is_number()) it->second->setParam(k, v.get<float>());
  }
  else if (c == "bypass")
  {
    auto it = blocks.find(cmd.value("id", ""));
    if (it != blocks.end()) it->second->bypass.store(cmd.value("on", false));
  }
  else if (c == "event")
  {
    auto it = blocks.find(cmd.value("id", ""));
    if (it != blocks.end())
    {
      BlockEvent e;
      e.type = cmd.value("type", 0);
      e.value = cmd.value("value", 0.f);
      e.arg = cmd.value("arg", 0);
      it->second->events.push(e);
    }
  }
  else if (c == "settings")
  {
    const int oldQ = settings.quality;
    settings.quality = cmd.value("quality", settings.quality);
    settings.budget = cmd.value("budget", settings.budget);
    settings.autoQuality = cmd.value("autoQuality", settings.autoQuality);
    settings.inGainDb = cmd.value("inGainDb", settings.inGainDb);
    settings.outGainDb = cmd.value("outGainDb", settings.outGainDb);
    inGain.store(dbToGain(settings.inGainDb));
    outGain.store(dbToGain(settings.outGainDb));
    if (cmd.contains("buffer") && client && jack->set_buffer_size)
    {
      const int b = cmd.value("buffer", 64);
      if (b != bufSize) jack->set_buffer_size(client, b);
    }
    if (oldQ != settings.quality) rebuild();
  }
  else if (c == "ports")
    listPorts();
  else if (c == "connect")
  {
    if (client)
    {
      const std::string s = cmd.value("src", ""), d = cmd.value("dst", "");
      if (cmd.value("on", true)) jack->connect(client, s.c_str(), d.c_str());
      else jack->disconnect(client, s.c_str(), d.c_str());
      listPorts();
    }
  }
  else if (c == "autoConnect")
  {
    autoConnect();
    listPorts();
  }
  else if (c == "hello")
    send({{"ev", "ready"}, {"sr", sr}, {"buffer", bufSize}, {"lib", jack->libPath}, {"running", jackActive.load()}});
  else if (c == "reconnect")
  {
    stopJack();
    std::string err;
    if (!startJack(err)) send({{"ev", "audioError"}, {"error", err}});
    else
    {
      rebuild();
      send({{"ev", "ready"}, {"sr", sr}, {"buffer", bufSize}, {"lib", jack->libPath}, {"running", true}});
    }
  }
  else if (c == "quit")
    running.store(false);
}

void Engine::statusTick()
{
  json st = {{"ev", "status"}};
  const int cyc = cycleCount.exchange(0);
  const double acc = cycleNsAccum.exchange(0);
  const double pk = cycleNsPeak.exchange(0);
  const double periodNs = 1e9 * double(bufSize) / sr;
  if (cyc > 0)
  {
    lastLoad = float(acc / cyc / periodNs);
    lastPeakLoad = float(pk / periodNs);
  }
  st["load"] = lastLoad;
  st["peakLoad"] = lastPeakLoad;
  st["xruns"] = xruns.load();
  st["sr"] = sr;
  st["buffer"] = bufSize;
  st["running"] = jackActive.load();
  // round trip latency estimate
  double lat = 2.0 * bufSize;
  if (client && jack->port_get_latency_range)
  {
    jack_latency_range_t a{0, 0}, b{0, 0};
    jack->port_get_latency_range(inPorts[0], JackCaptureLatency, &a);
    jack->port_get_latency_range(outPorts[0], JackPlaybackLatency, &b);
    if (a.max + b.max > 0) lat = double(a.max + b.max) + 0.0;
    if (lat < bufSize) lat = 2.0 * bufSize;
  }
  st["latencyMs"] = 1000.0 * lat / sr;
  json im = json::array(), om = json::array();
  for (auto& p : inPeak) im.push_back(p.exchange(0));
  for (auto& p : outPeak) om.push_back(p.exchange(0));
  st["inPeak"] = im;
  st["outPeak"] = om;
  json bl = json::object();
  for (auto& [id, b] : blocks)
  {
    b->controlTick();
    json bj = json::object();
    const int c = b->cycles.exchange(0);
    const double a = b->nsAccum.exchange(0);
    b->nsPeak.store(0);
    if (c > 0) bj["load"] = a / c / periodNs;
    b->status(bj);
    bl[id] = bj;
  }
  st["blocks"] = bl;
  send(st);
}

void Engine::runControlLoop()
{
  running.store(true);
  stdinThread = std::thread([this] {
    std::string line;
    while (std::getline(std::cin, line))
    {
      if (line.empty()) continue;
      try
      {
        auto j = json::parse(line);
        std::lock_guard<std::mutex> lk(qMutex);
        queue.push_back(std::move(j));
      }
      catch (...)
      {
      }
      qCv.notify_one();
    }
    // stdin closed: parent gone
    std::lock_guard<std::mutex> lk(qMutex);
    queue.push_back(json{{"cmd", "quit"}});
    qCv.notify_one();
  });
  stdinThread.detach();
  auto nextStatus = std::chrono::steady_clock::now();
  while (running.load())
  {
    std::deque<json> cmds;
    {
      std::unique_lock<std::mutex> lk(qMutex);
      qCv.wait_until(lk, nextStatus, [&] { return !queue.empty(); });
      cmds.swap(queue);
    }
    for (auto& c : cmds)
    {
      try
      {
        handleCommand(c);
      }
      catch (const std::exception& e)
      {
        send({{"ev", "error"}, {"error", e.what()}});
      }
    }
    if (needRebuild.exchange(false)) rebuild();
    if (std::chrono::steady_clock::now() >= nextStatus)
    {
      statusTick();
      nextStatus = std::chrono::steady_clock::now() + std::chrono::milliseconds(33);
    }
  }
}

// ------------------------------------------------------------------ offline render (tests)
int Engine::runOffline(const std::string& graphPath, const std::string& inWav, const std::string& outWav, double rate,
                       int block)
{
  std::vector<std::vector<float>> input;
  double fileSr = rate;
  if (!readWav(inWav, input, fileSr))
  {
    std::cerr << "cannot read " << inWav << "\n";
    return 1;
  }
  sr = fileSr;
  bufSize = block;
  json g;
  {
    FILE* f = fopen(graphPath.c_str(), "rb");
    if (!f) return 1;
    std::string s;
    char buf[4096];
    size_t r;
    while ((r = fread(buf, 1, sizeof buf, f)) > 0) s.append(buf, r);
    fclose(f);
    g = json::parse(s);
  }
  if (g.contains("settings"))
  {
    json s = g["settings"];
    s["cmd"] = "settings";
    handleCommand(s);
  }
  flushDenormals();
  setGraph(g.contains("graph") ? g["graph"] : g);
  const size_t len = input[0].size();
  std::vector<std::vector<float>> out(2, std::vector<float>(len, 0.f));
  std::vector<float> zeros(block, 0.f);
  std::vector<std::vector<float>> inb(kNumSysIn, std::vector<float>(block)), outb(kNumSysOut, std::vector<float>(block));
  const float* ins[kNumSysIn];
  float* outs[kNumSysOut];
  double totalNs = 0;
  // events timeline: [{t: seconds, cmd:{...}}]
  json timeline = g.value("timeline", json::array());
  size_t tlIdx = 0;
  for (size_t pos = 0; pos < len; pos += block)
  {
    const int n = int(std::min<size_t>(block, len - pos));
    while (tlIdx < timeline.size() && timeline[tlIdx].value("t", 0.0) * sr <= double(pos))
      handleCommand(timeline[tlIdx++]["cmd"]);
    for (int c = 0; c < kNumSysIn; ++c)
    {
      for (int i = 0; i < n; ++i) inb[c][i] = (c < int(input.size())) ? input[c][pos + i] : (c == 1 && input.size() == 1 ? 0.f : 0.f);
      ins[c] = inb[c].data();
    }
    for (int c = 0; c < kNumSysOut; ++c) outs[c] = outb[c].data();
    const double t0 = nowNs();
    processGraph(current.get(), ins, outs, n);
    totalNs += nowNs() - t0;
    for (int i = 0; i < n; ++i)
    {
      out[0][pos + i] = outb[0][i];
      out[1][pos + i] = outb[1][i];
    }
    if ((pos / block) % 15 == 0)
    {
      for (auto& [id, b] : blocks) b->controlTick();
    }
  }
  const double audioNs = 1e9 * double(len) / sr;
  std::cerr << "offline: realtime factor load = " << (100.0 * totalNs / audioNs) << " %\n";
  json st = json::object();
  for (auto& [id, b] : blocks)
  {
    json bj;
    b->status(bj);
    st[id] = bj;
  }
  std::cerr << "status: " << st.dump() << "\n";
  writeWav(outWav, out, sr);
  return 0;
}

} // namespace tz
