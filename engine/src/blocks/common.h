#pragma once
#include "../block.h"
#include "../dsp/core.h"
#include <deque>
#include <mutex>

namespace tz
{
// helper: read an EQ band list from json opts and set biquads
struct EqBand
{
  Biquad::Type type = Biquad::Peak;
  float f = 1000, q = 0.7f, db = 0;
};
inline Biquad::Type parseType(const std::string& s)
{
  if (s == "lp") return Biquad::LP;
  if (s == "hp") return Biquad::HP;
  if (s == "bp") return Biquad::BP;
  if (s == "notch") return Biquad::Notch;
  if (s == "ls" || s == "lowshelf") return Biquad::LowShelf;
  if (s == "hs" || s == "highshelf") return Biquad::HighShelf;
  if (s == "ap") return Biquad::AllPass;
  return Biquad::Peak;
}
inline std::vector<EqBand> parseBands(const json& j)
{
  std::vector<EqBand> v;
  if (!j.is_array()) return v;
  for (auto& b : j)
  {
    EqBand e;
    e.type = parseType(b.value("type", "peak"));
    e.f = b.value("f", 1000.f);
    e.q = b.value("q", 0.707f);
    e.db = b.value("db", 0.f);
    v.push_back(e);
  }
  return v;
}

// number of processing channels for "per-channel" algorithms
inline int procChannels(int nIn, int nOut) { return std::max(1, std::max(nIn, nOut)); }
inline const float* inFor(const float* const* in, int nIn, int c, const float* silent)
{
  if (nIn <= 0) return silent;
  return in[std::min(c, nIn - 1)];
}

// Tap tempo helper (shared by delays / modulation)
struct TapTempo
{
  double lastTap = -1;
  double now = 0;
  float ms = -1;
  void advance(int n, double sr) { now += n / sr; }
  bool tap()
  {
    const double dt = now - lastTap;
    lastTap = now;
    if (dt > 0.08 && dt < 3.0)
    {
      ms = float(dt * 1000.0);
      return true;
    }
    return false;
  }
};

} // namespace tz
