// Low-latency time-domain pitch shifter with correlation-aligned splices (WSOLA-style).
// The read head runs at `ratio` speed relative to the write head; whenever it drifts outside the allowed delay
// window it jumps by an amount chosen to maximise waveform similarity, then crossfades. Splicing between
// self-similar waveform segments avoids the comb/"warble" artifacts of naive two-tap shifters.
#pragma once
#include "core.h"

namespace tz
{
struct WsolaShifter
{
  std::vector<float> buf;
  int mask = 0;
  long long w = 0;      // write index
  double rd = 0;        // read index (fractional)
  double rdOld = 0;     // previous head during crossfade
  int xfadeLen = 256, xfadePos = -1;
  float minDelay = 96, maxDelay = 1200;
  int corrLen = 256;
  int searchStep = 2;
  float sr = 48000;

  void prepare(float sampleRate, float minMs = 2.5f, float maxMs = 22.f, float xfadeMs = 7.f)
  {
    sr = sampleRate;
    int n = 1;
    const int need = int((maxMs * 3 + 60) * 0.001f * sr);
    while (n < need) n <<= 1;
    buf.assign(n, 0.f);
    mask = n - 1;
    w = 0;
    minDelay = minMs * 0.001f * sr;
    maxDelay = maxMs * 0.001f * sr;
    xfadeLen = std::max(32, int(xfadeMs * 0.001f * sr));
    corrLen = std::max(64, int(5.0f * 0.001f * sr));
    rd = -double(minDelay + maxDelay) * 0.5;
    xfadePos = -1;
  }
  int latency() const { return int((minDelay + maxDelay) * 0.5f); }
  inline float at(long long i) const { return buf[size_t(i) & size_t(mask)]; }
  inline float readFrac(double pos) const
  {
    const long long i = (long long)std::floor(pos);
    const float f = float(pos - double(i));
    const float xm1 = at(i - 1), x0 = at(i), x1 = at(i + 1), x2 = at(i + 2);
    const float c1 = 0.5f * (x1 - xm1);
    const float c2 = xm1 - 2.5f * x0 + 2.f * x1 - 0.5f * x2;
    const float c3 = 0.5f * (x2 - xm1) + 1.5f * (x0 - x1);
    return ((c3 * f + c2) * f + c1) * f + x0;
  }
  // find best jump target near `target` such that segment at new pos matches segment at `from`
  double bestAligned(double from, double lo, double hi, double ratio)
  {
    double best = 0.5 * (lo + hi), bestScore = -1e30;
    // compare the upcoming material (as it will be read at `ratio` speed) at both positions
    for (double c = lo; c <= hi; c += searchStep)
    {
      double s = 0, e1 = 1e-9, e2 = 1e-9;
      for (int k = 0; k < corrLen; k += 2)
      {
        const float a = at((long long)(from + k * ratio));
        const float b = at((long long)(c + k * ratio));
        s += a * b;
        e1 += a * a;
        e2 += b * b;
      }
      const double score = s / std::sqrt(e1 * e2);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }
  inline float process(float x, float ratio)
  {
    buf[size_t(w) & size_t(mask)] = x;
    ++w;
    double delay = double(w) - rd;
    if (xfadePos < 0)
    {
      // keep the head inside [minDelay + lookahead, maxDelay]
      const double look = corrLen * std::max(1.0, double(ratio)) + 4;
      if (delay < minDelay + look || delay > maxDelay)
      {
        const double center = double(w) - double(minDelay + maxDelay) * 0.5;
        const double span = (maxDelay - minDelay - look) * 0.45;
        double lo = center - span, hi = center + span;
        // only search on the far side of where we are going
        if (delay > maxDelay) lo = std::max(lo, double(w) - maxDelay + 1);
        else hi = std::min(hi, double(w) - (minDelay + look));
        if (hi < lo) hi = lo;
        rdOld = rd;
        rd = bestAligned(rd, lo, hi, ratio);
        xfadePos = 0;
      }
    }
    float y;
    if (xfadePos >= 0)
    {
      const float t = float(xfadePos) / float(xfadeLen);
      const float gIn = std::sin(0.5f * float(kPi) * t), gOut = std::cos(0.5f * float(kPi) * t);
      y = readFrac(rd) * gIn + readFrac(rdOld) * gOut;
      rdOld += ratio;
      if (++xfadePos >= xfadeLen) xfadePos = -1;
    }
    else
      y = readFrac(rd);
    rd += ratio;
    return y;
  }
};
} // namespace tz
