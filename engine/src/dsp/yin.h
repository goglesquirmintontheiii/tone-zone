// YIN period detection (shared by the tuner and the patch block's jack analysis).
#pragma once
#include <cmath>
#include <vector>

namespace tz
{
struct PitchResult
{
  double freq = 0;
  double conf = 0;
};
// x: len samples at rate sr; buf: scratch kept by the caller (no allocation once it is big enough)
inline PitchResult yinDetect(const float* x, int len, double sr, double fmin, double fmax, std::vector<float>& buf)
{
  const int tauMin = std::max(2, int(sr / fmax));
  const int tauMax = std::min(len / 2, int(sr / fmin) + 2);
  const int W = len - tauMax;
  if (W < 64) return {};
  buf.assign(tauMax + 2, 0.f);
  // difference function
  for (int tau = 1; tau <= tauMax; ++tau)
  {
    double s = 0;
    for (int i = 0; i < W; ++i)
    {
      const double d = double(x[i]) - double(x[i + tau]);
      s += d * d;
    }
    buf[tau] = float(s);
  }
  // cumulative mean normalised difference
  double run = 0;
  buf[0] = 1;
  for (int tau = 1; tau <= tauMax; ++tau)
  {
    run += buf[tau];
    buf[tau] = run > 0 ? float(buf[tau] * tau / run) : 1.f;
  }
  int best = -1;
  const float thr = 0.15f;
  for (int tau = tauMin; tau < tauMax; ++tau)
    if (buf[tau] < thr)
    {
      while (tau + 1 < tauMax && buf[tau + 1] < buf[tau]) ++tau;
      best = tau;
      break;
    }
  if (best < 0)
  {
    // no clear dip: take global minimum if reasonably periodic
    float mv = 1e9;
    for (int tau = tauMin; tau < tauMax; ++tau)
      if (buf[tau] < mv) { mv = buf[tau]; best = tau; }
    if (mv > 0.4f) return {};
  }
  double t = best;
  if (best > 1 && best + 1 <= tauMax)
  {
    const double a = buf[best - 1], b = buf[best], c = buf[best + 1];
    const double den = a - 2 * b + c;
    if (std::fabs(den) > 1e-12) t = best + 0.5 * (a - c) / den;
  }
  return {sr / t, 1.0 - buf[best]};
}
} // namespace tz
