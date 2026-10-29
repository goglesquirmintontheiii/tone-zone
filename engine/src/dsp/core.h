// Core DSP primitives used across Tone Zone blocks.
#pragma once
#include <algorithm>
#include <cmath>
#include <complex>
#include <cstdint>
#include <cstring>
#include <vector>

namespace tz
{
constexpr double kPi = 3.14159265358979323846;
constexpr double kTwoPi = 2.0 * kPi;

inline float dbToGain(float db) { return std::pow(10.0f, db * 0.05f); }
inline float gainToDb(float g) { return 20.0f * std::log10(std::max(g, 1e-9f)); }
inline float clampf(float x, float a, float b) { return std::min(std::max(x, a), b); }
inline float lerp(float a, float b, float t) { return a + (b - a) * t; }
// Map 0..1 knob to a frequency on a log scale.
inline float logMap(float t, float lo, float hi) { return lo * std::pow(hi / lo, clampf(t, 0.f, 1.f)); }
// Audio taper (log pot) approximation.
inline float audioTaper(float t) { t = clampf(t, 0.f, 1.f); return (std::exp(3.5f * t) - 1.f) / (std::exp(3.5f) - 1.f); }
inline float flushDenorm(float x) { return std::fabs(x) < 1e-20f ? 0.f : x; }

// One-pole smoother for parameters.
struct Smoother
{
  float y = 0.f, a = 0.999f;
  bool init = false;
  void setTime(float ms, float sr) { a = std::exp(-1.0f / std::max(1.f, ms * 0.001f * sr)); }
  void reset(float v) { y = v; init = true; }
  inline float next(float target)
  {
    if (!init) { y = target; init = true; }
    y = target + (y - target) * a;
    return y;
  }
};

struct OnePole
{
  float a = 0.f, b = 1.f, z = 0.f;
  void lp(float fc, float sr) { float x = std::exp(-kTwoPi * std::min(fc, sr * 0.49f) / sr); a = x; b = 1.f - x; }
  inline float processLP(float x) { z = b * x + a * z; return z; }
  inline float processHP(float x) { z = b * x + a * z; return x - z; }
  void reset() { z = 0.f; }
};

struct DCBlocker
{
  float r = 0.995f, x1 = 0.f, y1 = 0.f;
  void setup(float fc, float sr) { r = 1.f - (kTwoPi * fc / sr); r = clampf(r, 0.9f, 0.99999f); }
  inline float process(float x) { float y = x - x1 + r * y1; x1 = x; y1 = flushDenorm(y); return y1; }
  void reset() { x1 = y1 = 0.f; }
};

// RBJ cookbook biquad, transposed direct form II.
struct Biquad
{
  float b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  float z1 = 0, z2 = 0;
  enum Type { LP, HP, BP, Notch, Peak, LowShelf, HighShelf, AllPass };
  void set(Type t, double fc, double q, double gainDb, double sr)
  {
    fc = std::min(std::max(fc, 5.0), sr * 0.49);
    q = std::max(q, 0.05);
    const double A = std::pow(10.0, gainDb / 40.0);
    const double w0 = kTwoPi * fc / sr;
    const double cw = std::cos(w0), sw = std::sin(w0);
    const double alpha = sw / (2.0 * q);
    double B0 = 1, B1 = 0, B2 = 0, A0 = 1, A1 = 0, A2 = 0;
    switch (t)
    {
      case LP: B0 = (1 - cw) / 2; B1 = 1 - cw; B2 = (1 - cw) / 2; A0 = 1 + alpha; A1 = -2 * cw; A2 = 1 - alpha; break;
      case HP: B0 = (1 + cw) / 2; B1 = -(1 + cw); B2 = (1 + cw) / 2; A0 = 1 + alpha; A1 = -2 * cw; A2 = 1 - alpha; break;
      case BP: B0 = alpha; B1 = 0; B2 = -alpha; A0 = 1 + alpha; A1 = -2 * cw; A2 = 1 - alpha; break;
      case Notch: B0 = 1; B1 = -2 * cw; B2 = 1; A0 = 1 + alpha; A1 = -2 * cw; A2 = 1 - alpha; break;
      case AllPass: B0 = 1 - alpha; B1 = -2 * cw; B2 = 1 + alpha; A0 = 1 + alpha; A1 = -2 * cw; A2 = 1 - alpha; break;
      case Peak: B0 = 1 + alpha * A; B1 = -2 * cw; B2 = 1 - alpha * A; A0 = 1 + alpha / A; A1 = -2 * cw; A2 = 1 - alpha / A; break;
      case LowShelf:
      {
        const double sq = 2 * std::sqrt(A) * alpha;
        B0 = A * ((A + 1) - (A - 1) * cw + sq); B1 = 2 * A * ((A - 1) - (A + 1) * cw); B2 = A * ((A + 1) - (A - 1) * cw - sq);
        A0 = (A + 1) + (A - 1) * cw + sq; A1 = -2 * ((A - 1) + (A + 1) * cw); A2 = (A + 1) + (A - 1) * cw - sq;
        break;
      }
      case HighShelf:
      {
        const double sq = 2 * std::sqrt(A) * alpha;
        B0 = A * ((A + 1) + (A - 1) * cw + sq); B1 = -2 * A * ((A - 1) + (A + 1) * cw); B2 = A * ((A + 1) + (A - 1) * cw - sq);
        A0 = (A + 1) - (A - 1) * cw + sq; A1 = 2 * ((A - 1) - (A + 1) * cw); A2 = (A + 1) - (A - 1) * cw - sq;
        break;
      }
    }
    b0 = float(B0 / A0); b1 = float(B1 / A0); b2 = float(B2 / A0); a1 = float(A1 / A0); a2 = float(A2 / A0);
  }
  inline float process(float x)
  {
    const float y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    z1 = flushDenorm(z1); z2 = flushDenorm(z2);
    return y;
  }
  void reset() { z1 = z2 = 0; }
  // magnitude response (for UI / tests)
  double mag(double f, double sr) const
  {
    std::complex<double> z = std::polar(1.0, -kTwoPi * f / sr);
    auto num = double(b0) + double(b1) * z + double(b2) * z * z;
    auto den = 1.0 + double(a1) * z + double(a2) * z * z;
    return std::abs(num / den);
  }
};

// State-variable filter (TPT / Zavalishin), good for swept filters (wah, envelope).
struct SVF
{
  float g = 0, k = 1, a1 = 0, a2 = 0, a3 = 0, ic1 = 0, ic2 = 0;
  float lp = 0, bp = 0, hp = 0;
  void set(float fc, float q, float sr)
  {
    fc = clampf(fc, 10.f, sr * 0.45f);
    g = std::tan(float(kPi) * fc / sr);
    k = 1.f / std::max(q, 0.05f);
    a1 = 1.f / (1.f + g * (g + k));
    a2 = g * a1;
    a3 = g * a2;
  }
  inline void process(float x)
  {
    const float v3 = x - ic2;
    const float v1 = a1 * ic1 + a2 * v3;
    const float v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = flushDenorm(2 * v1 - ic1);
    ic2 = flushDenorm(2 * v2 - ic2);
    lp = v2; bp = v1; hp = x - k * v1 - v2;
  }
  void reset() { ic1 = ic2 = 0; }
};

// First-order allpass (for phasers / dispersion).
struct Allpass1
{
  float a = 0, z = 0;
  inline float process(float x) { const float y = a * x + z; z = flushDenorm(x - a * y); return y; }
  void setFreq(float fc, float sr) { const float t = std::tan(float(kPi) * clampf(fc, 10.f, sr * 0.45f) / sr); a = (t - 1.f) / (t + 1.f); }
};

// Delay line with fractional (cubic Hermite) read.
struct DelayLine
{
  std::vector<float> buf;
  int mask = 0, w = 0;
  void allocate(int maxSamples)
  {
    int n = 1;
    while (n < maxSamples + 4) n <<= 1;
    buf.assign(n, 0.f);
    mask = n - 1;
    w = 0;
  }
  void clear() { std::fill(buf.begin(), buf.end(), 0.f); }
  inline void push(float x) { buf[w] = x; w = (w + 1) & mask; }
  inline float tap(int d) const { return buf[(w - 1 - d) & mask]; }
  inline float read(float d) const
  {
    d = std::max(d, 1.f);
    const int i = int(d);
    const float f = d - float(i);
    const float xm1 = tap(i - 1), x0 = tap(i), x1 = tap(i + 1), x2 = tap(i + 2);
    const float c1 = 0.5f * (x1 - xm1);
    const float c2 = xm1 - 2.5f * x0 + 2.f * x1 - 0.5f * x2;
    const float c3 = 0.5f * (x2 - xm1) + 1.5f * (x0 - x1);
    return ((c3 * f + c2) * f + c1) * f + x0;
  }
  inline float readLinear(float d) const
  {
    const int i = int(d);
    const float f = d - float(i);
    return tap(i) + f * (tap(i + 1) - tap(i));
  }
  int size() const { return mask + 1; }
};

// sin(2*pi*p) for p in [0,1): parabolic approximation with one refinement step (|err| < 1e-3)
inline float fastSin2Pi(float p)
{
  const float t = p - 0.5f;
  float y = 8.f * t - 16.f * t * std::fabs(t);
  y = 0.225f * (y * std::fabs(y) - y) + y;
  return -y;
}
struct LFO
{
  double phase = 0;
  float inc = 0;
  void setRate(float hz, float sr) { inc = hz / sr; }
  // shape: 0 sine, 1 triangle, 2 square(soft), 3 saw up, 4 saw down, 5 random S&H (smoothed)
  inline float next(int shape = 0)
  {
    phase += inc;
    if (phase >= 1.0) phase -= 1.0;
    return value(float(phase), shape);
  }
  static inline float value(float p, int shape)
  {
    switch (shape)
    {
      default:
      case 0: return fastSin2Pi(p);
      case 1: return p < 0.5f ? (4.f * p - 1.f) : (3.f - 4.f * p);
      case 2: { const float v = 6.f * fastSin2Pi(p); return v / std::sqrt(1.f + v * v) * 1.014f; }
      case 3: return 2.f * p - 1.f;
      case 4: return 1.f - 2.f * p;
    }
  }
};

struct EnvFollower
{
  float att = 0.01f, rel = 0.001f, env = 0;
  void setup(float attackMs, float releaseMs, float sr)
  {
    att = 1.f - std::exp(-1.f / std::max(1.f, attackMs * 0.001f * sr));
    rel = 1.f - std::exp(-1.f / std::max(1.f, releaseMs * 0.001f * sr));
  }
  inline float process(float x)
  {
    const float a = std::fabs(x);
    env += (a > env ? att : rel) * (a - env);
    env = flushDenorm(env);
    return env;
  }
};

// ---------------- Polyphase IIR halfband (HIIR-style) oversampling ----------------
struct HalfbandDesign
{
  static double ipowp(double x, long n)
  {
    double z = 1.0;
    while (n != 0)
    {
      if (n & 1) z *= x;
      n >>= 1;
      x *= x;
    }
    return z;
  }
  static std::vector<double> design(int nbrCoefs, double transition)
  {
    double k = std::tan((1 - transition * 2) * kPi / 4);
    k *= k;
    const double kksqrt = std::pow(1 - k * k, 0.25);
    const double e = 0.5 * (1 - kksqrt) / (1 + kksqrt);
    const double e2 = e * e, e4 = e2 * e2;
    const double q = e * (1 + e4 * (2 + e4 * (15 + 150 * e4)));
    const int order = nbrCoefs * 2 + 1;
    std::vector<double> c(nbrCoefs);
    for (int idx = 0; idx < nbrCoefs; ++idx)
    {
      const int cc = idx + 1;
      double num = 0, den = 0;
      {
        long i = 0; int j = 1; double t;
        do { t = ipowp(q, i * (i + 1)) * std::sin((i * 2 + 1) * cc * kPi / order) * j; num += t; j = -j; ++i; } while (std::fabs(t) > 1e-100 && i < 100);
      }
      {
        long i = 1; int j = -1; double t;
        do { t = ipowp(q, i * i) * std::cos(i * 2 * cc * kPi / order) * j; den += t; j = -j; ++i; } while (std::fabs(t) > 1e-100 && i < 100);
      }
      num *= std::pow(q, 0.25);
      den += 0.5;
      const double ww = num / den, wwsq = ww * ww;
      const double x = std::sqrt((1 - wwsq * k) * (1 - wwsq / k)) / (1 + wwsq);
      c[idx] = (1 - x) / (1 + x);
    }
    return c;
  }
};

struct AllpassChain
{
  std::vector<float> c, xm, ym;
  void init(const std::vector<double>& coefs, int parity)
  {
    c.clear();
    for (size_t i = parity; i < coefs.size(); i += 2) c.push_back(float(coefs[i]));
    xm.assign(c.size(), 0.f);
    ym.assign(c.size(), 0.f);
  }
  inline float process(float x)
  {
    for (size_t i = 0; i < c.size(); ++i)
    {
      const float y = (x - ym[i]) * c[i] + xm[i];
      xm[i] = x;
      ym[i] = flushDenorm(y);
      x = y;
    }
    return x;
  }
  void reset() { std::fill(xm.begin(), xm.end(), 0.f); std::fill(ym.begin(), ym.end(), 0.f); }
};

struct Halfband2x
{
  AllpassChain upA, upB, dnA, dnB;
  void init(int nCoefs = 10, double tbw = 0.035)
  {
    auto co = HalfbandDesign::design(nCoefs, tbw);
    upA.init(co, 0); upB.init(co, 1); dnA.init(co, 0); dnB.init(co, 1);
  }
  inline void up(float x, float& o0, float& o1) { o0 = upA.process(x); o1 = upB.process(x); }
  inline float down(float i0, float i1) { return 0.5f * (dnA.process(i1) + dnB.process(i0)); }
  void reset() { upA.reset(); upB.reset(); dnA.reset(); dnB.reset(); }
};

// Oversampler: factor 1,2,4,8 using cascaded halfbands.
struct Oversampler
{
  int factor = 1, stages = 0;
  Halfband2x hb[3];
  std::vector<float> work[2];
  void prepare(int f, int maxBlock)
  {
    factor = f <= 1 ? 1 : (f <= 2 ? 2 : (f <= 4 ? 4 : 8));
    stages = factor == 1 ? 0 : factor == 2 ? 1 : factor == 4 ? 2 : 3;
    for (int s = 0; s < 3; ++s) hb[s].init(s == 0 ? 10 : 6, s == 0 ? 0.035 : 0.12);
    work[0].assign(maxBlock * 8 + 8, 0.f);
    work[1].assign(maxBlock * 8 + 8, 0.f);
  }
  // Upsample n samples into internal buffer, returns pointer to n*factor samples.
  float* up(const float* in, int n)
  {
    if (stages == 0)
    {
      std::memcpy(work[0].data(), in, sizeof(float) * n);
      return work[0].data();
    }
    const float* src = in;
    int len = n;
    int dst = 0;
    for (int s = 0; s < stages; ++s)
    {
      float* d = work[dst].data();
      for (int i = 0; i < len; ++i) hb[s].up(src[i], d[2 * i], d[2 * i + 1]);
      src = d;
      len *= 2;
      dst ^= 1;
    }
    upBuf = dst ^ 1;
    return work[upBuf].data();
  }
  // Downsample buffer (n*factor) to out (n).
  void down(float* os, float* out, int n)
  {
    if (stages == 0)
    {
      std::memcpy(out, os, sizeof(float) * n);
      return;
    }
    int len = n * factor;
    float* src = os;
    for (int s = stages - 1; s >= 0; --s)
    {
      len /= 2;
      float* d = (s == 0) ? out : src; // in-place is safe: write index i <= read index 2i
      for (int i = 0; i < len; ++i) d[i] = hb[s].down(src[2 * i], src[2 * i + 1]);
      src = d;
    }
  }
  void reset() { for (auto& h : hb) h.reset(); }
  int upBuf = 0;
};

// ---------------- FFT (radix-2, complex, in-place) ----------------
struct FFT
{
  int n = 0, logn = 0;
  std::vector<std::complex<float>> tw;
  std::vector<int> rev;
  void init(int size)
  {
    n = size;
    logn = 0;
    while ((1 << logn) < n) ++logn;
    tw.resize(n / 2);
    for (int i = 0; i < n / 2; ++i) tw[i] = std::polar(1.0f, float(-kTwoPi * i / n));
    rev.resize(n);
    for (int i = 0; i < n; ++i)
    {
      int r = 0;
      for (int b = 0; b < logn; ++b) if (i & (1 << b)) r |= 1 << (logn - 1 - b);
      rev[i] = r;
    }
  }
  void transform(std::complex<float>* d, bool inverse) const
  {
    for (int i = 0; i < n; ++i) if (i < rev[i]) std::swap(d[i], d[rev[i]]);
    for (int len = 2; len <= n; len <<= 1)
    {
      const int half = len / 2, step = n / len;
      for (int i = 0; i < n; i += len)
        for (int j = 0; j < half; ++j)
        {
          std::complex<float> w = tw[j * step];
          if (inverse) w = std::conj(w);
          const auto u = d[i + j];
          const auto v = d[i + j + half] * w;
          d[i + j] = u + v;
          d[i + j + half] = u - v;
        }
    }
    if (inverse)
    {
      const float s = 1.f / float(n);
      for (int i = 0; i < n; ++i) d[i] *= s;
    }
  }
};

// ---------------- Uniformly partitioned convolution (zero added latency when block == partition) ----------------
struct Convolver
{
  int P = 64;           // partition size
  int nParts = 0;
  FFT fft;
  std::vector<std::vector<std::complex<float>>> H;   // IR partitions spectra (size 2P)
  std::vector<std::vector<std::complex<float>>> X;   // input history spectra (ring)
  int xIdx = 0;
  std::vector<float> inBuf;     // last 2P input samples
  std::vector<std::complex<float>> acc, tmp;
  // fallback buffering when host block != P
  std::vector<float> fifoIn, fifoOut;
  int fifoPos = 0;
  bool ready = false;

  void prepare(int partition) { P = partition; }
  void setIR(const float* ir, int len)
  {
    nParts = std::max(1, (len + P - 1) / P);
    fft.init(2 * P);
    H.assign(nParts, std::vector<std::complex<float>>(2 * P));
    for (int p = 0; p < nParts; ++p)
    {
      auto& h = H[p];
      for (int i = 0; i < 2 * P; ++i) h[i] = 0;
      for (int i = 0; i < P; ++i)
      {
        const int k = p * P + i;
        if (k < len) h[i] = ir[k];
      }
      fft.transform(h.data(), false);
    }
    X.assign(nParts, std::vector<std::complex<float>>(2 * P));
    inBuf.assign(2 * P, 0.f);
    acc.assign(2 * P, 0);
    tmp.assign(2 * P, 0);
    fifoIn.assign(P, 0.f);
    fifoOut.assign(P, 0.f);
    fifoPos = 0;
    xIdx = 0;
    ready = true;
  }
  void reset()
  {
    for (auto& x : X) std::fill(x.begin(), x.end(), std::complex<float>(0));
    std::fill(inBuf.begin(), inBuf.end(), 0.f);
    std::fill(fifoIn.begin(), fifoIn.end(), 0.f);
    std::fill(fifoOut.begin(), fifoOut.end(), 0.f);
    fifoPos = 0;
  }
  // process exactly P samples
  void processPartition(const float* in, float* out)
  {
    std::memmove(inBuf.data(), inBuf.data() + P, sizeof(float) * P);
    std::memcpy(inBuf.data() + P, in, sizeof(float) * P);
    auto& x = X[xIdx];
    for (int i = 0; i < 2 * P; ++i) x[i] = inBuf[i];
    fft.transform(x.data(), false);
    std::fill(acc.begin(), acc.end(), std::complex<float>(0));
    const int bins = 2 * P;
    for (int p = 0; p < nParts; ++p)
    {
      const auto& xs = X[(xIdx - p + nParts) % nParts];
      const auto& h = H[p];
      // full complex multiply-accumulate (spectrum is hermitian; we keep it simple)
      for (int k = 0; k <= P; ++k) acc[k] += xs[k] * h[k];
    }
    for (int k = 1; k < P; ++k) acc[bins - k] = std::conj(acc[k]);
    fft.transform(acc.data(), true);
    for (int i = 0; i < P; ++i) out[i] = acc[P + i].real();
    xIdx = (xIdx + 1) % nParts;
  }
  void process(const float* in, float* out, int n)
  {
    if (!ready) { std::memcpy(out, in, sizeof(float) * n); return; }
    if (n == P) { processPartition(in, out); return; }
    if (n % P == 0)
    {
      for (int o = 0; o < n; o += P) processPartition(in + o, out + o);
      return;
    }
    // generic FIFO path (adds P samples latency)
    for (int i = 0; i < n; ++i)
    {
      fifoIn[fifoPos] = in[i];
      out[i] = fifoOut[fifoPos];
      if (++fifoPos == P)
      {
        processPartition(fifoIn.data(), fifoOut.data());
        fifoPos = 0;
      }
    }
  }
};

// Make an IR minimum-phase from a desired magnitude response (via real cepstrum).
// mag: magnitudes for bins 0..N/2 of an N-point FFT.
std::vector<float> minimumPhaseFromMagnitude(const std::vector<float>& mag, int N, int outLen);

// Linear-interpolating resampler for loading IRs at session rate (windowed sinc).
std::vector<float> resampleSinc(const std::vector<float>& in, double fromSr, double toSr);

// ---------------- Waveshapers ----------------
// Pade(7,6) tanh: |err| < 2e-6 for |x| < 3, monotonic, clamped to +-1. ~6x faster than std::tanh.
inline float fastTanh(float x)
{
  x = std::max(-6.f, std::min(6.f, x));
  const float x2 = x * x;
  const float a = x * (135135.f + x2 * (17325.f + x2 * (378.f + x2)));
  const float b = 135135.f + x2 * (62370.f + x2 * (3150.f + x2 * 28.f));
  return std::max(-1.f, std::min(1.f, a / b));
}
namespace shape
{
inline float soft(float x) { return fastTanh(x); }
inline float hard(float x, float knee = 2.5f)
{
  if (knee == 4.f) { const float x2 = x * x; return x / std::sqrt(std::sqrt(1.f + x2 * x2)); }
  if (knee == 2.f) return x / std::sqrt(1.f + x * x);
  return x / std::pow(1.f + std::pow(std::fabs(x), knee), 1.f / knee);
}
inline float asym(float x, float bias) { return fastTanh(x + bias) - fastTanh(bias); }
inline float diode(float x) { // smooth diode pair to ground ~ exponential knee
  const float a = std::fabs(x);
  const float y = a < 0.3f ? a : 0.3f + (1.f - std::exp(-(a - 0.3f) * 3.f)) * 0.42f;
  return std::copysign(y * 1.38f, x);
}
inline float tube(float x, float bias) {
  // asymmetric triode-ish curve: softer on positive grid conduction, harder cutoff on negative
  x += bias;
  float y = x >= 0 ? fastTanh(x * 0.9f) : (x / (1.f + std::fabs(x * 1.3f)));
  const float b = bias;
  const float yb = b >= 0 ? fastTanh(b * 0.9f) : (b / (1.f + std::fabs(b * 1.3f)));
  return y - yb;
}
inline float fuzzGe(float x, float bias) {
  // germanium fuzz: very asymmetric, with "sputter" gating handled outside
  x += bias;
  float y = x > 0 ? 1.f - std::exp(-x * 1.5f) : -(1.f - std::exp(x * 0.6f)) * 0.75f;
  return y;
}
} // namespace shape

} // namespace tz
