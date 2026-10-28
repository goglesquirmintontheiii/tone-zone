// Block: the unit of processing in a Tone Zone preset graph.
#pragma once
#include <array>
#include <atomic>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

#include "json.hpp"

namespace tz
{
using json = nlohmann::json;

struct PrepareCtx
{
  double sr = 48000;
  int maxBlock = 4096;
  int hostBlock = 64;  // partition size for convolution
  int oversample = 2;  // 1,2,4,8 for nonlinear blocks
  int quality = 1;     // 0 eco, 1 standard, 2 high, 3 ultra
  std::string dataDir; // user library root
};

struct BlockEvent
{
  int type = 0;
  float value = 0.f;
  int arg = 0;
};

template <typename T, int N>
struct SpscQueue
{
  std::array<T, N> buf;
  std::atomic<int> head{0}, tail{0};
  bool push(const T& v)
  {
    const int h = head.load(std::memory_order_relaxed);
    const int nh = (h + 1) % N;
    if (nh == tail.load(std::memory_order_acquire)) return false;
    buf[h] = v;
    head.store(nh, std::memory_order_release);
    return true;
  }
  bool pop(T& v)
  {
    const int t = tail.load(std::memory_order_relaxed);
    if (t == head.load(std::memory_order_acquire)) return false;
    v = buf[t];
    tail.store((t + 1) % N, std::memory_order_release);
    return true;
  }
};

struct ParamDef
{
  std::string name;
  float def, min, max;
};

class Block
{
public:
  virtual ~Block() = default;
  std::string id, algo;
  int nIn = 1, nOut = 1;
  json opts; // creation options (voicing, files...)
  uint32_t inConnected = 0, outConnected = 0;

  // ---- parameters (written by control thread, read by RT) ----
  std::vector<ParamDef> defs;
  std::unique_ptr<std::atomic<float>[]> vals;
  std::unordered_map<std::string, int> index;
  int addParam(const std::string& name, float def, float mn = 0.f, float mx = 1.f)
  {
    defs.push_back({name, def, mn, mx});
    return int(defs.size()) - 1;
  }
  void finalizeParams()
  {
    vals.reset(new std::atomic<float>[defs.size() + 1]);
    for (size_t i = 0; i < defs.size(); ++i)
    {
      vals[i].store(defs[i].def);
      index[defs[i].name] = int(i);
    }
  }
  bool setParam(const std::string& name, float v)
  {
    auto it = index.find(name);
    if (it == index.end()) return false;
    const auto& d = defs[it->second];
    if (v < d.min) v = d.min;
    if (v > d.max) v = d.max;
    vals[it->second].store(v, std::memory_order_relaxed);
    paramsDirty.store(true, std::memory_order_release);
    return true;
  }
  inline float p(int i) const { return vals[i].load(std::memory_order_relaxed); }
  std::atomic<bool> paramsDirty{true};

  // ---- bypass ----
  std::atomic<bool> bypass{false};
  float bypassMix = 1.f; // 1 = fully active (RT-owned)
  bool inputMuted = false;

  // ---- events (control -> RT) ----
  SpscQueue<BlockEvent, 128> events;

  // ---- metering (RT -> control) ----
  std::atomic<double> nsAccum{0}, nsPeak{0};
  std::atomic<int> cycles{0};

  // ---- lifecycle ----
  virtual void prepare(const PrepareCtx& ctx) = 0;
  virtual void process(const float* const* in, float* const* out, int n) = 0;
  virtual void onEvent(const BlockEvent&) {}
  virtual void reset() {}
  virtual bool hasTrails() const { return false; }
  virtual bool alwaysProcess() const { return false; } // e.g. tuner/looper run even when bypassed
  // Called on the control thread ~30 Hz; may do heavy work (e.g. regenerate IR).
  virtual void controlTick() {}
  // Status for UI (control thread).
  virtual void status(json&) {}
  // Load result / error for UI.
  std::string loadError;
  json info;
  // In stereo-normalling: if input 1 is unconnected but 0 is, feed 0 to 1.
  virtual bool normalInputs() const { return true; }
};

using BlockFactory = std::function<std::unique_ptr<Block>(const json& opts, int nIn, int nOut)>;
std::map<std::string, BlockFactory>& blockRegistry();
struct RegisterBlock
{
  RegisterBlock(const std::string& name, BlockFactory f) { blockRegistry()[name] = std::move(f); }
};
std::unique_ptr<Block> createBlock(const std::string& algo, const json& opts, int nIn, int nOut);

} // namespace tz
