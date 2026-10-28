// Multi-track phrase looper (RC-500 / RC-600 style) with sync, undo, reverse and a built-in rhythm machine.
#include <cstdlib>

#include "common.h"

namespace tz
{
namespace
{
enum TState { TEmpty = 0, TRec = 1, TPlay = 2, TDub = 3, TStop = 4 };

struct Track
{
  float* data[2] = {nullptr, nullptr};
  float* undo[2] = {nullptr, nullptr};
  long cap = 0, len = 0, pos = 0;
  int state = TEmpty;
  bool hasUndo = false, undone = false, reverse = false;
  float fadeIn = 1.f;
  long dubStartRp = -1, dubCount = 0, swapRemaining = 0, swapIdx = 0;
  int dubDir = 1;
};

struct Drum
{
  float sr = 48000;
  float kEnv = 0, kPh = 0, kF = 0, sEnv = 0, hEnv = 0, sPh = 0;
  uint32_t rng = 777;
  OnePole hatHp, snLp;
  void prepare(float s) { sr = s; hatHp.lp(7000, sr); snLp.lp(5000, sr); }
  float noise() { rng = rng * 1664525u + 1013904223u; return float(int32_t(rng)) / 2147483648.f; }
  void kick() { kEnv = 1; kF = 160; kPh = 0; }
  void snare() { sEnv = 1; }
  void hat(float a) { hEnv = a; }
  float next()
  {
    float y = 0;
    if (kEnv > 1e-4f)
    {
      kF = 48 + (kF - 48) * 0.9992f;
      kPh += kF / sr;
      y += std::sin(float(kTwoPi) * kPh) * kEnv * 0.9f;
      kEnv *= 0.99975f;
    }
    if (sEnv > 1e-4f)
    {
      sPh += 185.f / sr;
      y += (snLp.processLP(noise()) * 0.6f + std::sin(float(kTwoPi) * sPh) * 0.4f) * sEnv * 0.6f;
      sEnv *= 0.9993f;
    }
    if (hEnv > 1e-4f)
    {
      y += hatHp.processHP(noise()) * hEnv * 0.35f;
      hEnv *= 0.9985f;
    }
    return y;
  }
};

class LooperBlock : public Block
{
public:
  int nTracks;
  float maxSec;
  std::vector<Track> tr;
  std::vector<int> pLevel, pPan;
  int pRhythmOn, pRhythmLevel, pTempo, pPattern, pSync, pRecAction, pDubLevel, pMaster, pInput, pCurrent;
  long masterLen = 0, masterPos = 0;
  float sr = 48000;
  int C = 1;
  Drum drum;
  double beatPhase = 0;
  int step = -1;
  bool rhythmRunning = false;
  TapTempo tap;
  std::atomic<int> stateOut[8];
  std::atomic<float> posOut[8], lenOut[8];
  std::atomic<int> stepOut{0};
  LooperBlock(const json& o, int nIn)
  {
    nTracks = std::max(1, std::min(8, o.value("tracks", 2)));
    maxSec = o.value("maxSec", nTracks > 2 ? 30.f : 60.f);
    for (int t = 0; t < nTracks; ++t)
    {
      pLevel.push_back(addParam("level" + std::to_string(t + 1), 0.8f));
      pPan.push_back(addParam("pan" + std::to_string(t + 1), 0.f, -1, 1));
    }
    pRhythmOn = addParam("rhythm", 0, 0, 1);
    pRhythmLevel = addParam("rhythmLevel", 0.5f);
    pTempo = addParam("tempo", 100, 40, 250);
    pPattern = addParam("pattern", 0, 0, 9);
    pSync = addParam("sync", 1, 0, 1);
    pRecAction = addParam("recAction", 0, 0, 1); // 0: REC->DUB, 1: REC->PLAY
    pDubLevel = addParam("dubLevel", 1.0f);       // overdub feedback (1 = keep previous layers fully)
    pMaster = addParam("master", 0.8f);
    pInput = addParam("input", 1.0f);
    pCurrent = addParam("current", 0, 0, 7);
    for (int i = 0; i < 8; ++i) { stateOut[i] = 0; posOut[i] = 0; lenOut[i] = 0; }
    (void)nIn;
    finalizeParams();
  }
  ~LooperBlock() override
  {
    for (auto& t : tr)
      for (int c = 0; c < 2; ++c) { free(t.data[c]); free(t.undo[c]); }
  }
  bool alwaysProcess() const override { return true; }
  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    C = std::min(2, std::max(nIn, nOut));
    tr.assign(nTracks, Track());
    const long cap = long(maxSec * sr);
    for (auto& t : tr)
    {
      t.cap = cap;
      for (int ch = 0; ch < C; ++ch)
      {
        // calloc: zero pages are mapped lazily, so unused loop memory costs nothing
        t.data[ch] = static_cast<float*>(calloc(cap, sizeof(float)));
        t.undo[ch] = static_cast<float*>(calloc(cap, sizeof(float)));
      }
    }
    drum.prepare(sr);
    info = {{"tracks", nTracks}, {"maxSec", maxSec}};
  }
  long syncedLen(long raw)
  {
    if (p(pSync) < 0.5f || masterLen <= 0) return raw;
    long k = std::max(1L, long(std::round(double(raw) / double(masterLen))));
    return std::min(k * masterLen, tr[0].cap);
  }
  void finishRecording(Track& t, int idx, bool toDub)
  {
    long L = t.pos;
    if (L < long(0.05f * sr)) { t.state = TEmpty; t.len = 0; t.pos = 0; return; }
    if (masterLen == 0)
    {
      if (rhythmRunning)
      {
        // snap the first loop to whole beats of the rhythm
        const double beat = 60.0 / p(pTempo) * sr;
        L = long(std::max(1.0, std::round(L / beat)) * beat);
        L = std::min(L, t.cap);
      }
      masterLen = L;
      masterPos = t.pos % std::max(1L, masterLen);
    }
    else
      L = syncedLen(L);
    t.len = L;
    t.pos = (p(pSync) > 0.5f && masterLen > 0) ? (masterPos % t.len) : 0;
    t.state = toDub ? TDub : TPlay;
    (void)idx;
  }
  void saveUndo(Track& t)
  {
    // copy-on-write: the previous layer is saved sample by sample while overdubbing
    t.dubStartRp = -1;
    t.dubCount = 0;
    t.dubDir = t.reverse ? -1 : 1;
    t.hasUndo = true;
    t.undone = false;
  }
  void onEvent(const BlockEvent& e) override
  {
    const int ti = std::max(0, std::min(nTracks - 1, e.arg));
    Track& t = tr[ti];
    switch (e.type)
    {
      case 1: // REC/PLAY/DUB footswitch
        if (t.state == TEmpty)
        {
          t.state = TRec;
          t.pos = 0;
          t.len = 0;
          t.fadeIn = 0.f;
        }
        else if (t.state == TRec) finishRecording(t, ti, p(pRecAction) < 0.5f);
        else if (t.state == TDub) t.state = TPlay;
        else if (t.state == TPlay) { saveUndo(t); t.state = TDub; }
        else if (t.state == TStop) { t.state = TPlay; if (p(pSync) > 0.5f && masterLen) t.pos = masterPos % t.len; else t.pos = 0; }
        break;
      case 2: // STOP
        if (t.state == TRec) finishRecording(t, ti, false);
        if (t.state != TEmpty) t.state = TStop;
        break;
      case 3: // CLEAR
        t.state = TEmpty;
        t.len = 0;
        t.pos = 0;
        t.hasUndo = false;
        {
          bool any = false;
          for (auto& o : tr) if (o.state != TEmpty) any = true;
          if (!any) { masterLen = 0; masterPos = 0; }
        }
        break;
      case 4: // UNDO / REDO (swap layers)
        if (t.hasUndo && t.len > 0 && t.dubCount > 0 && t.swapRemaining == 0)
        {
          if (t.state == TDub) t.state = TPlay;
          t.swapRemaining = t.dubCount; // swapped incrementally in process() to stay real-time safe
          t.swapIdx = 0;
          t.undone = !t.undone;
        }
        break;
      case 5: // ALL START/STOP
      {
        bool anyPlaying = false;
        for (auto& o : tr) if (o.state == TPlay || o.state == TDub || o.state == TRec) anyPlaying = true;
        for (auto& o : tr)
        {
          if (o.state == TRec) { finishRecording(o, 0, false); }
          if (o.state == TEmpty) continue;
          o.state = anyPlaying ? TStop : TPlay;
          if (!anyPlaying) o.pos = 0;
        }
        if (!anyPlaying) masterPos = 0;
        break;
      }
      case 6: vals[pCurrent].store(float(ti)); break;
      case 7: rhythmRunning = !rhythmRunning; beatPhase = 0; step = -1; break;
      case 8:
        if (tap.tap()) vals[pTempo].store(clampf(60000.f / tap.ms, 40, 250));
        break;
      case 9: t.reverse = !t.reverse; break;
    }
  }
  void process(const float* const* in, float* const* out, int n) override
  {
    tap.advance(n, sr);
    const float ing = p(pInput), master = p(pMaster), dub = p(pDubLevel);
    // rhythm
    static const uint16_t pats[10][3] = {
      // kick, snare, hat bitmasks over 16 steps (bit 0 = step 1)
      {0x0101, 0x1010, 0x5555}, {0x0111, 0x1010, 0x5555}, {0x2121, 0x1010, 0xFFFF}, {0x0909, 0x1212, 0x4949},
      {0x5555, 0x1010, 0x5555}, {0x0001, 0x0100, 0x1111}, {0x1111, 0x0000, 0x4444}, {0x0001, 0x0100, 0x5555},
      {0x0909, 0x2424, 0x5555}, {0x1111, 0x0000, 0x0000}};
    const int pat = std::max(0, std::min(9, int(std::round(p(pPattern)))));
    const bool rOn = rhythmRunning || p(pRhythmOn) > 0.5f;
    const double stepInc = p(pTempo) / 60.0 * 4.0 / sr;
    const float rl = p(pRhythmLevel);
    for (int i = 0; i < n; ++i)
    {
      float rs = 0;
      if (rOn)
      {
        beatPhase += stepInc;
        const int s = int(beatPhase) % 16;
        if (s != step)
        {
          step = s;
          if (pats[pat][0] & (1 << s)) drum.kick();
          if (pats[pat][1] & (1 << s)) drum.snare();
          if (pats[pat][2] & (1 << s)) drum.hat(s % 4 == 0 ? 0.9f : 0.5f);
          stepOut.store(s);
        }
        rs = drum.next() * rl;
      }
      float mix[2] = {0, 0};
      float inS[2];
      for (int c = 0; c < C; ++c) inS[c] = in[std::min(c, nIn - 1)][i] * ing;
      for (int ti = 0; ti < nTracks; ++ti)
      {
        Track& t = tr[ti];
        if (t.state == TRec)
        {
          if (t.pos < t.cap)
          {
            t.fadeIn = std::min(1.f, t.fadeIn + 1.f / (0.004f * sr));
            for (int c = 0; c < C; ++c) t.data[c][t.pos] = inS[c] * t.fadeIn;
            ++t.pos;
          }
          else
            finishRecording(t, ti, false);
        }
        else if ((t.state == TPlay || t.state == TDub) && t.len > 0)
        {
          const long rp = t.reverse ? (t.len - 1 - t.pos) : t.pos;
          // short crossfade at the loop seam to avoid clicks
          const long edge = std::min<long>(long(0.003f * sr), t.len / 4);
          float seam = 1.f;
          if (t.pos < edge) seam = float(t.pos) / edge;
          else if (t.pos > t.len - edge) seam = float(t.len - t.pos) / edge;
          const float lvl = p(pLevel[ti]);
          const float pan = p(pPan[ti]);
          for (int c = 0; c < C; ++c)
          {
            const float v = t.data[c][rp];
            float g = lvl * (0.7f + 0.3f * seam);
            if (C == 2 || nOut == 2) g *= (c == 0 ? std::min(1.f, 1.f - pan) : std::min(1.f, 1.f + pan));
            mix[c] += v * g;
            if (t.state == TDub)
            {
              if (c == 0 && t.dubCount < t.len)
              {
                if (t.dubStartRp < 0) t.dubStartRp = rp;
                for (int cc = 0; cc < C; ++cc) t.undo[cc][rp] = t.data[cc][rp];
                ++t.dubCount;
              }
              t.data[c][rp] = v * dub + inS[c];
            }
          }
          if (++t.pos >= t.len) t.pos = 0;
        }
      }
      if (masterLen > 0 && ++masterPos >= masterLen) masterPos = 0;
      for (int c = 0; c < std::max(1, nOut); ++c)
      {
        const int src = std::min(c, C - 1);
        out[c][i] = in[std::min(c, nIn - 1)][i] + (mix[src] + rs) * master;
      }
    }
    // incremental undo/redo swaps
    for (auto& t : tr)
      if (t.swapRemaining > 0 && t.len > 0)
      {
        const long chunk = std::min<long>(t.swapRemaining, 32768);
        for (long k = 0; k < chunk; ++k)
        {
          long idx = (t.dubStartRp + t.dubDir * (t.swapIdx + k)) % t.len;
          if (idx < 0) idx += t.len;
          for (int c = 0; c < C; ++c) std::swap(t.data[c][idx], t.undo[c][idx]);
        }
        t.swapIdx += chunk;
        t.swapRemaining -= chunk;
      }
    for (int ti = 0; ti < nTracks && ti < 8; ++ti)
    {
      stateOut[ti].store(tr[ti].state);
      posOut[ti].store(tr[ti].len > 0 ? float(tr[ti].pos) / tr[ti].len : (tr[ti].state == TRec ? float(tr[ti].pos) / sr : 0.f));
      lenOut[ti].store(tr[ti].state == TRec ? float(tr[ti].pos) / sr : float(tr[ti].len) / sr);
    }
  }
  void status(json& j) override
  {
    json ts = json::array();
    for (int t = 0; t < nTracks && t < 8; ++t)
      ts.push_back({{"state", stateOut[t].load()}, {"pos", posOut[t].load()}, {"len", lenOut[t].load()}, {"rev", tr.size() > size_t(t) && tr[t].reverse}});
    j["looper"] = {{"tracks", ts}, {"rhythm", rhythmRunning || p(pRhythmOn) > 0.5f}, {"step", stepOut.load()},
                   {"tempo", p(pTempo)}, {"master", masterLen / sr}};
  }
};

RegisterBlock r1("looper", [](const json& o, int nIn, int) { return std::make_unique<LooperBlock>(o, nIn); });
} // namespace
} // namespace tz
