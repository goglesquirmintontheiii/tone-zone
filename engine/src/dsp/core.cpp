#include "core.h"

namespace tz
{
std::vector<float> minimumPhaseFromMagnitude(const std::vector<float>& mag, int N, int outLen)
{
  FFT fft;
  fft.init(N);
  std::vector<std::complex<float>> c(N);
  // log magnitude, symmetric
  for (int k = 0; k <= N / 2; ++k)
  {
    const float m = std::max(mag[k], 1e-6f);
    c[k] = std::log(m);
    if (k > 0 && k < N / 2) c[N - k] = c[k];
  }
  fft.transform(c.data(), true); // real cepstrum
  // fold: keep c0, double positive quefrencies, zero negative
  for (int n = 1; n < N / 2; ++n) { c[n] *= 2.f; c[N - n] = 0; }
  fft.transform(c.data(), false);
  for (int k = 0; k < N; ++k) c[k] = std::exp(c[k]);
  fft.transform(c.data(), true);
  std::vector<float> ir(outLen);
  for (int i = 0; i < outLen; ++i)
  {
    // gentle fade at end
    float w = 1.f;
    const int fadeStart = outLen * 3 / 4;
    if (i > fadeStart) w = 0.5f * (1.f + std::cos(float(kPi) * float(i - fadeStart) / float(outLen - fadeStart)));
    ir[i] = c[i].real() * w;
  }
  return ir;
}

std::vector<float> resampleSinc(const std::vector<float>& in, double fromSr, double toSr)
{
  if (std::fabs(fromSr - toSr) < 0.5 || in.empty()) return in;
  const double ratio = toSr / fromSr;
  const size_t outLen = size_t(std::ceil(in.size() * ratio));
  std::vector<float> out(outLen, 0.f);
  const int half = 24;
  const double cutoff = std::min(1.0, ratio) * 0.95;
  for (size_t i = 0; i < outLen; ++i)
  {
    const double t = double(i) / ratio;
    const long c = long(std::floor(t));
    double acc = 0;
    for (long k = c - half + 1; k <= c + half; ++k)
    {
      if (k < 0 || k >= long(in.size())) continue;
      const double x = t - double(k);
      const double sx = x * cutoff;
      const double s = std::fabs(sx) < 1e-9 ? 1.0 : std::sin(kPi * sx) / (kPi * sx);
      const double w = 0.42 + 0.5 * std::cos(kPi * x / half) + 0.08 * std::cos(2 * kPi * x / half); // Blackman
      acc += in[k] * s * w * cutoff;
    }
    out[i] = float(acc);
  }
  return out;
}
} // namespace tz
