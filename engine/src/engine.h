#pragma once
#include <chrono>
#include <atomic>
#include <condition_variable>
#include <deque>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "block.h"
#include "jack_dl.h"

namespace tz
{
constexpr int kNumSysIn = 4;
constexpr int kNumSysOut = 4;
constexpr int kMaxBlock = 4096;

struct CompiledGraph
{
  struct Node
  {
    Block* b = nullptr;
    std::vector<int> in;              // buffer index per input
    std::vector<std::vector<int>> inSum; // if an input has multiple cables
    std::vector<int> out;             // buffer index per output
  };
  std::vector<std::shared_ptr<Block>> owned;
  std::vector<Node> nodes; // topological order
  std::vector<std::vector<float>> buffers;
  std::vector<std::vector<int>> sysOut; // per system output: list of buffers summed
  int silentBuf = 0;
  // scratch pointer arrays
  std::vector<const float*> inPtrs;
  std::vector<float*> outPtrs;
  std::vector<float> dryScratch;
};

struct Settings
{
  int quality = 1;           // 0 eco .. 3 ultra
  float budget = 0.75f;      // fraction of cycle
  bool autoQuality = false;
  float inGainDb = 0, outGainDb = 0;
  bool autoConnect = true;
  int requestedBuffer = 64;
};

class Engine : public HostPorts
{
public:
  void* registerPort(const std::string& name, bool input) override;
  void unregisterPort(void* h) override;
  float* portBuffer(void* h, int n) override;
  int connectMatching(void* h, const std::string& pattern, int index, bool input) override;
  Engine();
  ~Engine();

  bool startJack(std::string& err);
  void stopJack();
  void runControlLoop(); // blocking; reads stdin commands
  int runOffline(const std::string& graphPath, const std::string& inWav, const std::string& outWav, double sr, int block);
  int runBench(double sr, int block);

  // RT
  int process(jack_nframes_t n);

  void handleCommand(const json& cmd);
  void send(const json& ev);

  std::string dataDir;

private:
  void setGraph(const json& g);
  void rebuild(); // re-create all blocks (settings / sr change)
  std::shared_ptr<CompiledGraph> compile(const json& g, std::map<std::string, std::shared_ptr<Block>>& blocks,
                                         bool forceNew);
  void swapGraph(std::shared_ptr<CompiledGraph> g);
  void statusTick();
  void processGraph(CompiledGraph* g, const float* const* sysIn, float* const* sysOut, int n);
  void listPorts();
  void autoConnect();
  int oversampleFor(int quality) const;

  JackApi* jack = nullptr;
  jack_client_t* client = nullptr;
  jack_port_t* inPorts[kNumSysIn] = {};
  jack_port_t* outPorts[kNumSysOut] = {};
  std::atomic<bool> running{false};
  std::atomic<bool> jackActive{false};

  double sr = 48000;
  int bufSize = 64;
  std::atomic<int> xruns{0};
  std::atomic<bool> needRebuild{false};
  std::atomic<bool> portsDirty{false}; // set from JACK port / connection callbacks; the control loop re-sends the port list
  std::chrono::steady_clock::time_point portsDirtyAt{};

  // graph handoff
  std::shared_ptr<CompiledGraph> current;            // control-thread owned
  std::atomic<CompiledGraph*> pending{nullptr};
  std::atomic<CompiledGraph*> inUse{nullptr};
  std::vector<std::shared_ptr<CompiledGraph>> retired;
  std::map<std::string, std::shared_ptr<Block>> blocks; // id -> block
  json lastGraph;
  std::map<std::string, std::vector<std::string>> followers; // id -> nodes that also take its params / events ("also")

  // presets built ahead of time (the Pi agent preloads next / previous for instant switching)
  struct CachedGraph
  {
    json graph;
    std::map<std::string, std::shared_ptr<Block>> blocks;
    std::map<std::string, std::vector<std::string>> followers;
    std::shared_ptr<CompiledGraph> g;
  };
  std::map<std::string, CachedGraph> graphCache;
  std::string currentKey;
  static std::map<std::string, std::vector<std::string>> followersOf(const json& g);

  Settings settings;
  std::atomic<float> inGain{1.f}, outGain{1.f};
  std::atomic<float> inTrim[8] = {1, 1, 1, 1, 1, 1, 1, 1}, outTrim[8] = {1, 1, 1, 1, 1, 1, 1, 1};

  // metering
  std::atomic<float> inPeak[kNumSysIn], outPeak[kNumSysOut];
  std::atomic<double> cycleNsAccum{0}, cycleNsPeak{0};
  std::atomic<int> cycleCount{0};
  float lastLoad = 0, lastPeakLoad = 0;

  // command queue from stdin thread
  std::mutex qMutex;
  std::condition_variable qCv;
  std::deque<json> queue;
  std::thread stdinThread;
  std::mutex outMutex;

  // offline scratch
  std::vector<std::vector<float>> scratchIn, scratchOut;
};

} // namespace tz
