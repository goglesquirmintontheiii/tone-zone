// Tone Zone DSP engine.
//   tonezone-engine                       realtime (JACK/PipeWire), JSON lines on stdin/stdout
//   tonezone-engine --offline g.json in.wav out.wav [--block N]
//   tonezone-engine --list                print block registry (params) as JSON
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>

#include "engine.h"

int main(int argc, char** argv)
{
  using namespace tz;
  std::string dataDir;
  int block = 64;
  for (int i = 1; i < argc; ++i)
    if (!strcmp(argv[i], "--data") && i + 1 < argc) dataDir = argv[++i];
    else if (!strcmp(argv[i], "--block") && i + 1 < argc) block = atoi(argv[++i]);
  if (argc > 1 && !strcmp(argv[1], "--list"))
  {
    json out = json::object();
    for (auto& [name, f] : blockRegistry())
    {
      auto b = createBlock(name, json::object(), 1, 1);
      json ps = json::array();
      if (b)
        for (auto& d : b->defs) ps.push_back({{"name", d.name}, {"def", d.def}, {"min", d.min}, {"max", d.max}});
      out[name] = ps;
    }
    std::cout << out.dump(1) << "\n";
    return 0;
  }
  Engine e;
  e.dataDir = dataDir;
  if (argc > 4 && !strcmp(argv[1], "--offline")) return e.runOffline(argv[2], argv[3], argv[4], 48000, block);
  std::string err;
  if (!e.startJack(err))
    e.send({{"ev", "audioError"}, {"error", err}});
  else
  {
    e.handleCommand({{"cmd", "hello"}});
  }
  e.runControlLoop();
  e.stopJack();
  return 0;
}
