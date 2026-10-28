// External device I/O: a block whose outputs come from (and inputs go to) extra PipeWire/JACK ports that are
// auto-connected to a USB device's capture / playback channels (e.g. a Line 6 Helix's USB audio).
// opts: { name: "helix", ins: 8, outs: 8, capture: "regex", playback: "regex" }
//   block inputs  (graph -> device) are sent to ports  <name>_to_<k>   -> device playback channels
//   block outputs (device -> graph) are read from ports <name>_from_<k> <- device capture channels
#include "common.h"

namespace tz
{
namespace
{
class ExtIOBlock : public Block
{
public:
  HostPorts* host = nullptr;
  std::vector<void*> toPorts, fromPorts;
  int pSendGain, pRetGain;
  bool registered = false;
  ExtIOBlock(const json&)
  {
    pSendGain = addParam("send", 0, -40, 12);
    pRetGain = addParam("return", 0, -40, 12);
    finalizeParams();
  }
  ~ExtIOBlock() override
  {
    if (host) { for (void* h : toPorts) host->unregisterPort(h); for (void* h : fromPorts) host->unregisterPort(h); }
  }
  bool alwaysProcess() const override { return true; }
  bool normalInputs() const override { return false; }
  void prepare(const PrepareCtx& c) override
  {
    if (registered || !c.host) return;
    host = c.host;
    const std::string nm = opts.value("name", std::string("device"));
    for (int k = 0; k < nIn; ++k) toPorts.push_back(host->registerPort(nm + "_to_" + std::to_string(k + 1), false));
    for (int k = 0; k < nOut; ++k) fromPorts.push_back(host->registerPort(nm + "_from_" + std::to_string(k + 1), true));
    registered = true;
    const std::string cap = opts.value("capture", std::string()), pb = opts.value("playback", std::string());
    int connected = 0;
    if (!pb.empty()) for (int k = 0; k < nIn; ++k) connected += host->connectMatching(toPorts[k], pb, k, false) == 0;
    if (!cap.empty()) for (int k = 0; k < nOut; ++k) connected += host->connectMatching(fromPorts[k], cap, k, true) == 0;
    info["connected"] = connected;
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const float sg = bypass.load(std::memory_order_relaxed) ? 0.f : dbToGain(p(pSendGain)), rg = dbToGain(p(pRetGain));
    for (int k = 0; k < nIn && k < int(toPorts.size()); ++k)
      if (float* b = host ? host->portBuffer(toPorts[k], n) : nullptr)
        for (int i = 0; i < n; ++i) b[i] = in[k][i] * sg;
    for (int k = 0; k < nOut; ++k)
    {
      float* b = (k < int(fromPorts.size()) && host) ? host->portBuffer(fromPorts[k], n) : nullptr;
      if (b) for (int i = 0; i < n; ++i) out[k][i] = b[i] * rg;
      else std::memset(out[k], 0, sizeof(float) * n);
    }
  }
  void status(json& j) override { j["ports"] = int(toPorts.size() + fromPorts.size()); if (info.contains("connected")) j["connected"] = info["connected"]; }
};

RegisterBlock r1("extio", [](const json& o, int, int) { return std::make_unique<ExtIOBlock>(o); });
} // namespace
} // namespace tz
