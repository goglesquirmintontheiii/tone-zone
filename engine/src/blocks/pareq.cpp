// Studio parametric EQ: 6 switchable bands (any type), switchable HPF / LPF with slope, band "listen"
// (solo a frequency region), and a spectrum analyser (pre or post EQ) reported to the UI.
#include "common.h"

namespace tz
{
namespace
{
class ParEqBlock : public Block
{
public:
  static constexpr int NB = 6, SPEC_BINS = 120, FFTN = 4096;
  struct BandP { int on, type, f, g, q; } bp[NB];
  int pHpOn, pHpF, pHpS, pLpOn, pLpF, pLpS, pListen, pListenF, pListenQ, pLevel, pSpec, pSpecPost;
  Biquad band[2][NB], hp[2][4], lp[2][4], lis[2][2];
  float sr = 48000;
  std::vector<float> last;
  // analyser
  std::vector<float> ringPre, ringPost;
  std::atomic<int> ringPos{0};
  FFT fft;
  std::vector<std::complex<float>> spec;
  std::vector<float> win, smooth;
  int lastSpecPost = -1;
  Smoother sL;
  ParEqBlock(const json&)
  {
    const float defF[NB] = {80, 250, 800, 2500, 6000, 12000};
    const int defT[NB] = {1, 0, 0, 0, 0, 2}; // 0 peak, 1 low shelf, 2 high shelf, 3 notch, 4 band-pass, 5 tilt
    for (int i = 0; i < NB; ++i)
    {
      const std::string k = "b" + std::to_string(i + 1);
      bp[i].on = addParam(k + "on", 1, 0, 1);
      bp[i].type = addParam(k + "type", float(defT[i]), 0, 5);
      bp[i].f = addParam(k + "f", defF[i], 20, 20000);
      bp[i].g = addParam(k + "g", 0, -18, 18);
      bp[i].q = addParam(k + "q", 0.9f, 0.1f, 18);
    }
    pHpOn = addParam("hpon", 0, 0, 1);
    pHpF = addParam("hpf", 80, 20, 2000);
    pHpS = addParam("hps", 1, 0, 3);   // 0: 6, 1: 12, 2: 24, 3: 48 dB/oct
    pLpOn = addParam("lpon", 0, 0, 1);
    pLpF = addParam("lpf", 9000, 500, 20000);
    pLpS = addParam("lps", 1, 0, 3);
    pListen = addParam("listen", 0, 0, 1);
    pListenF = addParam("listenf", 1000, 20, 20000);
    pListenQ = addParam("listenq", 2, 0.3f, 12);
    pLevel = addParam("level", 0, -24, 12);
    pSpec = addParam("spectrum", 1, 0, 1);
    pSpecPost = addParam("specpost", 1, 0, 1);
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    ringPre.assign(FFTN, 0.f);
    ringPost.assign(FFTN, 0.f);
    fft.init(FFTN);
    spec.assign(FFTN, 0);
    win.resize(FFTN);
    for (int i = 0; i < FFTN; ++i) win[i] = 0.5f - 0.5f * std::cos(float(kTwoPi) * i / FFTN);
    smooth.assign(SPEC_BINS, -100.f);
    sL.setTime(20, sr);
    last.clear();
  }
  void update()
  {
    std::vector<float> cur;
    for (int i = 0; i < NB; ++i) for (int id : {bp[i].on, bp[i].type, bp[i].f, bp[i].g, bp[i].q}) cur.push_back(p(id));
    for (int id : {pHpF, pHpS, pLpF, pLpS, pListenF, pListenQ}) cur.push_back(p(id));
    if (cur == last) return;
    last = cur;
    for (int c = 0; c < 2; ++c)
    {
      for (int i = 0; i < NB; ++i)
      {
        const int t = int(std::round(p(bp[i].type)));
        const float f = p(bp[i].f), g = p(bp[i].g), q = p(bp[i].q);
        switch (t)
        {
          case 1: band[c][i].set(Biquad::LowShelf, f, std::min(q, 2.f), g, sr); break;
          case 2: band[c][i].set(Biquad::HighShelf, f, std::min(q, 2.f), g, sr); break;
          case 3: band[c][i].set(Biquad::Notch, f, q, 0, sr); break;
          case 4: band[c][i].set(Biquad::BP, f, q, 0, sr); break;
          case 5: band[c][i].set(Biquad::HighShelf, f, 0.5, g, sr); break; // tilt-ish (gentle shelf around f)
          default: band[c][i].set(Biquad::Peak, f, q, g, sr);
        }
      }
      const int hs = int(std::round(p(pHpS))), ls = int(std::round(p(pLpS)));
      // Butterworth cascades
      static const float q4[4][4] = {{0.707f}, {0.707f}, {0.541f, 1.307f}, {0.510f, 0.601f, 0.900f, 2.563f}};
      for (int k = 0; k < 4; ++k)
      {
        hp[c][k].set(Biquad::HP, p(pHpF), hs == 0 ? 0.5f : q4[hs][std::min(k, hs == 1 ? 0 : hs == 2 ? 1 : 3)], 0, sr);
        lp[c][k].set(Biquad::LP, p(pLpF), ls == 0 ? 0.5f : q4[ls][std::min(k, ls == 1 ? 0 : ls == 2 ? 1 : 3)], 0, sr);
      }
      for (int k = 0; k < 2; ++k) lis[c][k].set(Biquad::BP, p(pListenF), p(pListenQ), 0, sr);
    }
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    update();
    const bool hpOn = p(pHpOn) > 0.5f, lpOn = p(pLpOn) > 0.5f, listen = p(pListen) > 0.5f;
    const int hs = int(std::round(p(pHpS))), ls = int(std::round(p(pLpS)));
    const int hN = hs <= 1 ? 1 : hs == 2 ? 2 : 4, lN = ls <= 1 ? 1 : ls == 2 ? 2 : 4;
    bool on[NB];
    for (int i = 0; i < NB; ++i) on[i] = p(bp[i].on) > 0.5f;
    const float lvl = dbToGain(p(pLevel));
    const int nc = std::min(2, procChannels(nIn, nOut));
    int pos = ringPos.load(std::memory_order_relaxed);
    for (int i = 0; i < n; ++i)
    {
      float monoPre = 0, monoPost = 0;
      for (int c = 0; c < nc; ++c)
      {
        const float x = nIn ? in[std::min(c, nIn - 1)][i] : 0.f;
        float v = x;
        if (hpOn) for (int k = 0; k < hN; ++k) v = hp[c][k].process(v);
        for (int b = 0; b < NB; ++b) if (on[b]) v = band[c][b].process(v);
        if (lpOn) for (int k = 0; k < lN; ++k) v = lp[c][k].process(v);
        if (listen) v = lis[c][1].process(lis[c][0].process(v)) * 1.4f;
        monoPre += x;
        monoPost += v;
        out[std::min(c, nOut - 1)][i] = v * sL.next(lvl);
      }
      ringPre[pos] = monoPre / nc;
      ringPost[pos] = monoPost / nc;
      pos = (pos + 1) & (FFTN - 1);
    }
    ringPos.store(pos, std::memory_order_relaxed);
    for (int c = nc; c < nOut; ++c) std::memcpy(out[c], out[0], sizeof(float) * n);
  }
  void status(json& j) override
  {
    if (p(pSpec) < 0.5f) return;
    const bool post = p(pSpecPost) > 0.5f;
    if (int(post) != lastSpecPost) { std::fill(smooth.begin(), smooth.end(), -100.f); lastSpecPost = int(post); }
    const auto& ring = post ? ringPost : ringPre;
    const int pos = ringPos.load(std::memory_order_relaxed);
    for (int i = 0; i < FFTN; ++i) spec[i] = ring[(pos + i) & (FFTN - 1)] * win[i];
    fft.transform(spec.data(), false);
    json a = json::array();
    // log-spaced bins 20 Hz .. 20 kHz, value = max magnitude in the bin range, dBFS, smoothed (fast attack, slow fall)
    for (int b = 0; b < SPEC_BINS; ++b)
    {
      const float f0 = 20.f * std::pow(1000.f, float(b) / SPEC_BINS), f1 = 20.f * std::pow(1000.f, float(b + 1) / SPEC_BINS);
      int k0 = int(f0 * FFTN / sr), k1 = std::max(k0 + 1, int(f1 * FFTN / sr));
      k1 = std::min(k1, FFTN / 2);
      float m = 0;
      for (int k = k0; k < k1; ++k) m = std::max(m, std::abs(spec[k]));
      const float db = 20.f * std::log10(std::max(1e-9f, m * 4.f / FFTN));
      smooth[b] = db > smooth[b] ? db : smooth[b] * 0.8f + db * 0.2f;
      a.push_back(int(std::max(-120.f, smooth[b])));
    }
    j["spec"] = a;
  }
};

RegisterBlock r1("pareq", [](const json& o, int, int) { return std::make_unique<ParEqBlock>(o); });
} // namespace
} // namespace tz
