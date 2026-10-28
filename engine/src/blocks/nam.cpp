// Neural Amp Modeler block: loads one or more .nam captures (A1, A2 incl. slimmable Full/Lite, LSTM, ...)
// as a single block with selectable configurations.
#include "NAM/dsp.h"
#include "NAM/get_dsp.h"
#include "NAM/slimmable.h"
namespace iplug
{
constexpr double PI = 3.14159265358979323846;
}
#ifndef DEFAULT_BLOCK_SIZE
  #define DEFAULT_BLOCK_SIZE 512
#endif
#include "ResamplingContainer/ResamplingContainer.h"
#include "common.h"

namespace tz
{
namespace
{
struct NamSlot
{
  std::unique_ptr<nam::DSP> dsp;
  std::unique_ptr<dsp::ResamplingContainer<float, 1, 12>> rs;
  std::string name, error, arch;
  double expectedSr = 48000;
  double loudness = 0;
  bool hasLoudness = false;
  bool slimmable = false;
};

class NamBlock : public Block
{
public:
  int pModel, pInput, pOutput, pBass, pMid, pTreble, pNormalize, pSize, pGate;
  std::vector<NamSlot> slots;
  float sr = 48000;
  int cur = -1, prev = -1, fadePos = -1, fadeLen = 1440;
  std::vector<float> inBuf, outA, outB, tmp;
  Biquad eqB, eqM, eqT;
  float lb = -1, lm = -1, lt = -1;
  Smoother sIn, sOut;
  float lastSize = -1;
  int quality = 1;
  float gateEnv = 0, gateGain = 1;
  NamBlock(const json& o)
  {
    const int count = o.contains("files") ? std::max<int>(1, int(o["files"].size())) : 1;
    pModel = addParam("model", 0, 0, float(count - 1));
    pInput = addParam("input", 0, -24, 24);
    pOutput = addParam("output", 0, -24, 24);
    pBass = addParam("bass", 0.5f);
    pMid = addParam("mid", 0.5f);
    pTreble = addParam("treble", 0.5f);
    pNormalize = addParam("normalize", 1, 0, 1);
    pSize = addParam("size", -1, -1, 1); // A2 slimmable size; -1 = follow DSP quality setting
    pGate = addParam("gate", 0.f);       // 0 = off
    finalizeParams();
  }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    quality = c.quality;
    fadeLen = int(0.03f * sr);
    inBuf.assign(c.maxBlock, 0.f);
    outA.assign(c.maxBlock, 0.f);
    outB.assign(c.maxBlock, 0.f);
    tmp.assign(c.maxBlock * 4, 0.f);
    sIn.setTime(30, sr);
    sOut.setTime(30, sr);
    slots.clear();
    json inf = json::array();
    if (opts.contains("files"))
      for (auto& fj : opts["files"])
      {
        NamSlot s;
        const std::string path = fj.get<std::string>();
        s.name = path.substr(path.find_last_of('/') + 1);
        try
        {
          nam::dspData conf;
          s.dsp = nam::get_dsp(std::filesystem::path(path), conf);
          if (!s.dsp) throw std::runtime_error("unsupported model");
          s.arch = conf.architecture;
          s.expectedSr = s.dsp->GetExpectedSampleRate();
          if (s.expectedSr <= 0) s.expectedSr = 48000;
          s.hasLoudness = s.dsp->HasLoudness();
          if (s.hasLoudness) s.loudness = s.dsp->GetLoudness();
          s.slimmable = dynamic_cast<nam::SlimmableModel*>(s.dsp.get()) != nullptr;
          const bool arbitrary = s.dsp->SupportsArbitrarySampleRate();
          if (std::fabs(s.expectedSr - sr) > 1 && !arbitrary)
          {
            s.rs = std::make_unique<dsp::ResamplingContainer<float, 1, 12>>(s.expectedSr);
            s.rs->Reset(sr, c.maxBlock);
            const int inner = int(std::ceil(c.maxBlock * s.expectedSr / sr)) + 64;
            s.dsp->Reset(s.expectedSr, inner);
          }
          else
            s.dsp->Reset(arbitrary ? sr : s.expectedSr, c.maxBlock);
          applySize(s, true);
        }
        catch (const std::exception& e)
        {
          s.error = e.what();
          loadError += s.name + ": " + e.what() + ". ";
          s.dsp.reset();
        }
        inf.push_back({{"name", s.name}, {"arch", s.arch}, {"sr", s.expectedSr}, {"resampled", bool(s.rs)},
                       {"slimmable", s.slimmable}, {"error", s.error}, {"loudness", s.loudness}});
        slots.push_back(std::move(s));
      }
    info = {{"models", inf}};
    cur = -1;
  }
  void applySize(NamSlot& s, bool force)
  {
    if (!s.slimmable || !s.dsp) return;
    float v = p(pSize);
    if (v < 0) v = quality == 0 ? 0.f : 1.f; // eco quality -> A2 Lite, otherwise Full
    if (!force && v == lastSize) return;
    if (auto* sl = dynamic_cast<nam::SlimmableModel*>(s.dsp.get())) sl->SetSlimmableSize(v);
  }
  void controlTick() override
  {
    // A2 size changes are applied from the control thread only when requested (cheap pointer flip inside NAM)
    const float v = p(pSize);
    if (v != lastSize)
    {
      for (auto& s : slots) applySize(s, true);
      lastSize = v;
    }
  }
  void runSlot(int idx, const float* x, float* y, int n)
  {
    auto& s = slots[idx];
    if (!s.dsp) { std::memcpy(y, x, sizeof(float) * n); return; }
    float* ip[1] = {const_cast<float*>(x)};
    float* op[1] = {y};
    if (s.rs)
      s.rs->ProcessBlock(ip, op, n, [&s](float** a, float** b, int m) { s.dsp->process(a, b, m); });
    else
      s.dsp->process(ip, op, n);
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    if (slots.empty())
    {
      for (int c = 0; c < nOut; ++c) std::memcpy(out[c], in[std::min(c, nIn - 1)], sizeof(float) * n);
      return;
    }
    if (p(pBass) != lb || p(pMid) != lm || p(pTreble) != lt)
    {
      lb = p(pBass); lm = p(pMid); lt = p(pTreble);
      eqB.set(Biquad::LowShelf, 150, 0.7, (lb - 0.5f) * 20.f, sr);
      eqM.set(Biquad::Peak, 425, 0.6, (lm - 0.5f) * 20.f, sr);
      eqT.set(Biquad::HighShelf, 1800, 0.7, (lt - 0.5f) * 20.f, sr);
    }
    const int want = std::max(0, std::min(int(slots.size()) - 1, int(std::round(p(pModel)))));
    if (cur < 0) cur = want;
    if (want != cur && fadePos < 0) { prev = cur; cur = want; fadePos = 0; }
    const float ig = dbToGain(p(pInput));
    const float gateThr = p(pGate) > 0.001f ? dbToGain(-90.f + 60.f * p(pGate)) : 0.f;
    for (int i = 0; i < n; ++i)
    {
      float x = (nIn > 1 ? 0.5f * (in[0][i] + in[1][i]) : in[0][i]) * sIn.next(ig);
      if (gateThr > 0)
      {
        const float a = std::fabs(x);
        gateEnv = std::max(a, gateEnv * 0.9995f);
        const float tgt = gateEnv > gateThr ? 1.f : 0.f;
        gateGain += (tgt - gateGain) * (tgt > gateGain ? 0.01f : 0.0008f);
      }
      inBuf[i] = x;
    }
    runSlot(cur, inBuf.data(), outA.data(), n);
    auto norm = [&](int idx) {
      const auto& s = slots[idx];
      if (p(pNormalize) > 0.5f && s.hasLoudness) return dbToGain(float(-18.0 - s.loudness));
      return 1.f;
    };
    const float na = norm(cur);
    if (fadePos >= 0)
    {
      runSlot(prev, inBuf.data(), outB.data(), n);
      const float nb = norm(prev);
      for (int i = 0; i < n; ++i)
      {
        const float t = std::min(1.f, float(fadePos + i) / fadeLen);
        outA[i] = outA[i] * na * t + outB[i] * nb * (1 - t);
      }
      fadePos += n;
      if (fadePos >= fadeLen) fadePos = -1;
    }
    else
      for (int i = 0; i < n; ++i) outA[i] *= na;
    const float og = dbToGain(p(pOutput));
    for (int i = 0; i < n; ++i)
    {
      float y = eqT.process(eqM.process(eqB.process(outA[i]))) * sOut.next(og);
      if (gateThr > 0) y *= gateGain;
      for (int c = 0; c < std::max(1, nOut); ++c) out[c][i] = y;
    }
  }
  void status(json& j) override { j["model"] = cur; }
};

RegisterBlock r1("nam", [](const json& o, int, int) { return std::make_unique<NamBlock>(o); });
} // namespace
} // namespace tz
