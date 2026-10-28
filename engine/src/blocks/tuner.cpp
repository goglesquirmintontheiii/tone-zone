// High-accuracy chromatic + polyphonic tuner.
// RT thread: anti-alias + decimate to ~6 kHz into a ring buffer.
// Control thread: YIN period detection (handles missing fundamentals of low strings) followed by
// phase-regression refinement on the strongest harmonic, giving sub-cent accuracy down to ~25 Hz
// (low B on 5/6-string bass, F#1 on 8-string guitar, etc.).
#include "common.h"

namespace tz
{
namespace
{
struct PitchResult
{
  double freq = 0;
  double conf = 0;
};

class TunerBlock : public Block
{
public:
  int pMute, pCalib, pMode, pTuning, pAlwaysOn, pRange;
  static constexpr int RING = 16384;
  std::vector<float> ring;
  std::atomic<int> wpos{0};
  int dec = 8, decCount = 0;
  Biquad aa1, aa2, aa3;
  OnePole dcHp;
  double dsr = 6000;
  float sr = 48000;
  // control-thread state
  std::vector<float> work, yinBuf;
  double smoothCents = 0, lastFreq = 0;
  int lastNote = -1, stableCount = 0;
  std::deque<double> hist;
  json st;
  std::mutex stMutex;
  std::atomic<float> rms{0};
  float rmsAcc = 0;
  int rmsN = 0;
  TunerBlock(const json& o)
  {
    pMute = addParam("mute", o.value("mute", 1.f), 0, 1);
    pCalib = addParam("calib", 440, 425, 455);
    pMode = addParam("mode", 0, 0, 3);     // 0 needle, 1 strobe, 2 poly, 3 auto (poly on strum)
    pTuning = addParam("tuning", 0, 0, 11); // poly tuning preset
    pAlwaysOn = addParam("alwaysOn", 0, 0, 1);
    pRange = addParam("range", 2, 0, 2); // 0 guitar, 1 bass / extended range, 2 auto
    finalizeParams();
  }
  bool alwaysProcess() const override { return true; }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    dec = std::max(1, int(std::round(sr / 8000.f)));
    dsr = sr / dec;
    ring.assign(RING, 0.f);
    aa1.set(Biquad::LP, 2900, 0.54, 0, sr);
    aa2.set(Biquad::LP, 2900, 1.31, 0, sr);
    aa3.set(Biquad::HP, 18, 0.7, 0, sr);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    const bool engaged = !bypass.load(std::memory_order_relaxed);
    const bool mute = engaged && p(pMute) > 0.5f;
    int w = wpos.load(std::memory_order_relaxed);
    for (int i = 0; i < n; ++i)
    {
      const float x = in[0][i];
      const float f = aa2.process(aa1.process(aa3.process(x)));
      rmsAcc += x * x;
      ++rmsN;
      if (++decCount >= dec)
      {
        decCount = 0;
        ring[w] = f;
        w = (w + 1) & (RING - 1);
      }
      for (int c = 0; c < nOut; ++c) out[c][i] = mute ? 0.f : in[std::min(c, nIn - 1)][i];
    }
    wpos.store(w, std::memory_order_release);
    if (rmsN > 2048)
    {
      rms.store(std::sqrt(rmsAcc / rmsN));
      rmsAcc = 0;
      rmsN = 0;
    }
  }

  // ---------- analysis (control thread) ----------
  void snapshot(int len)
  {
    work.resize(len);
    const int w = wpos.load(std::memory_order_acquire);
    for (int i = 0; i < len; ++i) work[i] = ring[(w - len + i + RING) & (RING - 1)];
  }
  PitchResult yin(const float* x, int len, double fmin, double fmax)
  {
    const int tauMin = std::max(2, int(dsr / fmax));
    const int tauMax = std::min(len / 2, int(dsr / fmin) + 2);
    const int W = len - tauMax;
    if (W < 64) return {};
    yinBuf.assign(tauMax + 2, 0.f);
    // difference function
    for (int tau = 1; tau <= tauMax; ++tau)
    {
      double s = 0;
      for (int i = 0; i < W; ++i)
      {
        const double d = double(x[i]) - double(x[i + tau]);
        s += d * d;
      }
      yinBuf[tau] = float(s);
    }
    // cumulative mean normalised difference
    double run = 0;
    yinBuf[0] = 1;
    for (int tau = 1; tau <= tauMax; ++tau)
    {
      run += yinBuf[tau];
      yinBuf[tau] = run > 0 ? float(yinBuf[tau] * tau / run) : 1.f;
    }
    int best = -1;
    const float thr = 0.15f;
    for (int tau = tauMin; tau < tauMax; ++tau)
      if (yinBuf[tau] < thr)
      {
        while (tau + 1 < tauMax && yinBuf[tau + 1] < yinBuf[tau]) ++tau;
        best = tau;
        break;
      }
    if (best < 0)
    {
      // no clear dip: take global minimum if reasonably periodic
      float mv = 1e9;
      for (int tau = tauMin; tau < tauMax; ++tau)
        if (yinBuf[tau] < mv) { mv = yinBuf[tau]; best = tau; }
      if (mv > 0.4f) return {};
    }
    double t = best;
    if (best > 1 && best + 1 <= tauMax)
    {
      const double a = yinBuf[best - 1], b = yinBuf[best], c = yinBuf[best + 1];
      const double den = a - 2 * b + c;
      if (std::fabs(den) > 1e-12) t = best + 0.5 * (a - c) / den;
    }
    return {dsr / t, 1.0 - yinBuf[best]};
  }
  // complex demodulation at frequency f; returns (energy, refined freq) via phase regression
  std::pair<double, double> refine(const float* x, int len, double f, int K = 16)
  {
    const int seg = len / K;
    if (seg < 8) return {0, f};
    std::vector<std::complex<double>> z(K);
    double energy = 0;
    for (int k = 0; k < K; ++k)
    {
      std::complex<double> acc = 0;
      for (int i = 0; i < seg; ++i)
      {
        const int idx = k * seg + i;
        const double w = 0.5 - 0.5 * std::cos(kTwoPi * (i + 0.5) / seg);
        const double ph = -kTwoPi * f * idx / dsr;
        acc += double(x[idx]) * w * std::complex<double>(std::cos(ph), std::sin(ph));
      }
      z[k] = acc;
      energy += std::norm(acc);
    }
    // weighted regression of unwrapped phase vs segment time
    std::vector<double> ph(K);
    ph[0] = std::arg(z[0]);
    for (int k = 1; k < K; ++k)
    {
      double d = std::arg(z[k]) - std::arg(z[k - 1]);
      while (d > kPi) d -= kTwoPi;
      while (d < -kPi) d += kTwoPi;
      ph[k] = ph[k - 1] + d;
    }
    double sw = 0, st = 0, sp = 0, stt = 0, stp = 0;
    for (int k = 0; k < K; ++k)
    {
      const double wgt = std::abs(z[k]);
      const double t = (k * seg + seg * 0.5) / dsr;
      sw += wgt; st += wgt * t; sp += wgt * ph[k]; stt += wgt * t * t; stp += wgt * t * ph[k];
    }
    const double den = sw * stt - st * st;
    if (std::fabs(den) < 1e-18) return {energy, f};
    const double slope = (sw * stp - st * sp) / den; // rad/s
    return {energy, f + slope / kTwoPi};
  }
  double precise(const float* x, int len, double f0)
  {
    // pick strongest harmonic below Nyquist margin and refine it twice
    double bestE = -1, bestF = f0;
    int bestH = 1;
    for (int h = 1; h <= 4; ++h)
    {
      if (f0 * h > dsr * 0.4) break;
      auto r0 = refine(x, len, f0 * h, 64);
      auto r = refine(x, len, r0.second, 16);
      // prefer the fundamental unless a harmonic is clearly stronger
      const double e = r.first * (h == 1 ? 1.6 : 1.0);
      if (e > bestE) { bestE = e; bestF = r.second; bestH = h; }
    }
    double f = bestF;
    auto r2 = refine(x, len, f);
    f = r2.second;
    return f / bestH;
  }

  void controlTick() override
  {
    const bool engaged = !bypass.load();
    const bool always = p(pAlwaysOn) > 0.5f;
    json s;
    s["engaged"] = engaged;
    if (!engaged && !always)
    {
      std::lock_guard<std::mutex> lk(stMutex);
      st = s;
      return;
    }
    const float level = rms.load();
    s["level"] = level;
    const int range = int(std::round(p(pRange)));
    double fmin = range == 1 ? 24.0 : 55.0; // guitar: down to A1 (drop A), bass/ERG: down to ~G0
    int len = range == 1 ? 5460 : 2730;     // ~680 / 340 ms windows
    snapshot(len);
    const double a4 = p(pCalib);
    const int mode = int(std::round(p(pMode)));
    if (level < 0.0025f)
    {
      s["note"] = nullptr;
      hist.clear();
      std::lock_guard<std::mutex> lk(stMutex);
      st = s;
      return;
    }
    if (mode == 2 || mode == 3) polyAnalyze(s, a4);
    auto r = yin(work.data(), len, fmin, 2000.0);
    if (range == 2 && (r.freq <= 0 || r.conf <= 0.5 || r.freq < 75.0))
    {
      // auto range: retry with the long window for low strings
      len = 5460;
      fmin = 24.0;
      snapshot(len);
      r = yin(work.data(), len, fmin, 2000.0);
    }
    if (r.freq > 0 && r.conf > 0.5)
    {
      double f = precise(work.data(), len, r.freq);
      if (!(f > 0) || std::fabs(1200 * std::log2(f / r.freq)) > 60) f = r.freq;
      const double midi = 69 + 12 * std::log2(f / a4);
      const int note = int(std::round(midi));
      double cents = (midi - note) * 100.0;
      if (note != lastNote) { hist.clear(); smoothCents = cents; }
      hist.push_back(cents);
      if (hist.size() > 5) hist.pop_front();
      std::vector<double> sorted(hist.begin(), hist.end());
      std::sort(sorted.begin(), sorted.end());
      const double med = sorted[sorted.size() / 2];
      smoothCents = smoothCents * 0.55 + med * 0.45;
      lastNote = note;
      static const char* names[12] = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
      s["note"] = names[((note % 12) + 12) % 12];
      s["octave"] = note / 12 - 1;
      s["cents"] = smoothCents;
      s["freq"] = f;
      s["conf"] = r.conf;
    }
    else
      s["note"] = nullptr;
    std::lock_guard<std::mutex> lk(stMutex);
    st = s;
  }

  void polyAnalyze(json& s, double a4)
  {
    // tuning presets (MIDI notes, low to high)
    static const std::vector<std::vector<int>> tunings = {
      {40, 45, 50, 55, 59, 64},             // 0 E standard
      {38, 45, 50, 55, 59, 64},             // 1 drop D
      {39, 44, 49, 54, 58, 63},             // 2 Eb standard
      {38, 43, 48, 53, 57, 62},             // 3 D standard
      {35, 40, 45, 50, 55, 59, 64},         // 4 7-string B
      {30, 35, 40, 45, 50, 55, 59, 64},     // 5 8-string F#
      {28, 33, 38, 43},                     // 6 bass 4 E
      {23, 28, 33, 38, 43},                 // 7 bass 5 B
      {23, 28, 33, 38, 43, 48},             // 8 bass 6 B-C
      {38, 45, 50, 54, 57, 62},             // 9 open D
      {38, 43, 50, 55, 59, 62},             // 10 open G
      {38, 45, 50, 55, 57, 62},             // 11 DADGAD
    };
    const int ti = std::max(0, std::min(int(tunings.size()) - 1, int(std::round(p(pTuning)))));
    const auto& tn = tunings[ti];
    const int len = 6000;
    snapshot(len);
    json strings = json::array();
    double totalE = 0;
    std::vector<double> energies;
    std::vector<double> cents;
    for (int m : tn)
    {
      const double fExp = a4 * std::pow(2.0, (m - 69) / 12.0);
      // search the harmonic with most energy (low strings often have weak fundamentals)
      double bestE = 0, bestC = 0;
      for (int h = 1; h <= 3; ++h)
      {
        if (fExp * h > dsr * 0.4) break;
        double locE = 0, locF = fExp * h;
        for (int c = -60; c <= 60; c += 15)
        {
          const double f = fExp * h * std::pow(2.0, c / 1200.0);
          auto r = refine(work.data(), len, f);
          if (r.first > locE) { locE = r.first; locF = r.second; }
        }
        auto r2 = refine(work.data(), len, locF);
        const double cc = 1200 * std::log2(r2.second / (fExp * h));
        if (locE > bestE && std::fabs(cc) < 100) { bestE = locE; bestC = cc; }
      }
      energies.push_back(bestE);
      cents.push_back(bestC);
      totalE += bestE;
    }
    const double meanE = totalE / std::max<size_t>(1, tn.size());
    int active = 0;
    for (size_t i = 0; i < tn.size(); ++i)
    {
      const bool on = energies[i] > meanE * 0.15 && energies[i] > 1e-7;
      active += on;
      strings.push_back({{"cents", cents[i]}, {"active", on}});
    }
    s["strings"] = strings;
    s["polyActive"] = active >= 3;
    s["tuning"] = ti;
  }

  void status(json& j) override
  {
    std::lock_guard<std::mutex> lk(stMutex);
    j["tuner"] = st;
  }
};

RegisterBlock r1("tuner", [](const json& o, int, int) { return std::make_unique<TunerBlock>(o); });
} // namespace
} // namespace tz
