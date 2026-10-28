// Tube (and solid-state) amplifier and preamp models.
// Signal flow: input coupling -> cascaded triode stages (with gain pot, bright cap, inter-stage filters)
// -> FMV / Baxandall tone stack -> phase inverter + push-pull or single-ended power amp with sag and
// presence/depth negative feedback -> output transformer band limits.
#include "../dsp/tonestack.h"
#include "common.h"

namespace tz
{
namespace
{
struct Stage
{
  float G = 30, H = 1.5f, bias = 0.25f, lp = 10000, hp = 25;
};

struct AmpModel
{
  float inHp = 20;
  std::vector<Stage> st;
  int gainPos = 1; // gain pot sits after this many stages
  int tsPos = 1;   // tone stack sits after this many stages
  int tsType = 0;  // 0 FMV, 1 Baxandall (active), 2 Vox top-boost-ish (FMV, mid fixed), 3 James / bass
  ToneStackComponents ts;
  float tsMakeup = 4.f;
  float brightHz = 0, brightDb = 0;
  int power = 1; // 0 none, 1 push-pull AB, 2 class A (EL84), 3 solid state
  float pwrH = 2.5f, sag = 0.3f, presHz = 3500, depthHz = 90, nfb = 0.5f;
  float otLp = 7500, otHp = 55;
  float masterRef = 0.5f;
  float baxBass = 100, baxTreble = 3500, baxMid = 600, baxRange = 15;
  float tight = 0; // pre-gain low cut amount for high gain models
};

static Stage S(float G, float H, float bias, float lp, float hp) { return {G, H, bias, lp, hp}; }

AmpModel makeModel(const std::string& id)
{
  AmpModel m;
  ToneStackComponents fender{250e3, 1e6, 10e3, 100e3, 250e-12, 100e-9, 47e-9};
  ToneStackComponents bassman{250e3, 1e6, 25e3, 56e3, 250e-12, 20e-9, 20e-9};
  ToneStackComponents marshall{220e3, 1e6, 22e3, 33e3, 470e-12, 22e-9, 22e-9};
  ToneStackComponents mesa{250e3, 250e3, 25e3, 100e3, 250e-12, 100e-9, 47e-9};
  ToneStackComponents vox{1e6, 1e6, 10e3, 100e3, 50e-12, 22e-9, 22e-9};
  ToneStackComponents orange{250e3, 1e6, 25e3, 47e3, 680e-12, 22e-9, 47e-9};
  ToneStackComponents peavey{250e3, 1e6, 25e3, 39e3, 680e-12, 22e-9, 22e-9};
  if (id == "deluxe")
  {
    m.st = {S(35, 1.6f, .2f, 12000, 20), S(35, 1.6f, .2f, 9000, 30)};
    m.gainPos = 1; m.tsPos = 1; m.ts = fender; m.brightHz = 1800; m.brightDb = 6;
    m.power = 1; m.pwrH = 1.4f; m.sag = 0.45f; m.otLp = 6500; m.otHp = 70; m.nfb = 0.4f; m.presHz = 0;
  }
  else if (id == "twin")
  {
    m.st = {S(35, 1.8f, .15f, 14000, 20), S(30, 2.0f, .15f, 11000, 30)};
    m.ts = fender; m.brightHz = 2000; m.brightDb = 7;
    m.power = 1; m.pwrH = 4.5f; m.sag = 0.15f; m.otLp = 8500; m.otHp = 50; m.nfb = 0.7f; m.presHz = 0;
  }
  else if (id == "bassman")
  {
    m.st = {S(35, 1.5f, .25f, 10000, 20), S(30, 1.4f, .3f, 8000, 40)};
    m.gainPos = 0; m.tsPos = 2; m.ts = bassman; m.brightHz = 1500; m.brightDb = 4;
    m.power = 1; m.pwrH = 1.6f; m.sag = 0.5f; m.otLp = 6000; m.otHp = 45; m.presHz = 3000;
  }
  else if (id == "ac30")
  {
    m.st = {S(40, 1.4f, .2f, 12000, 25), S(30, 1.3f, .25f, 10000, 60)};
    m.gainPos = 1; m.tsPos = 2; m.tsType = 2; m.ts = vox; m.brightHz = 2500; m.brightDb = 5;
    m.power = 2; m.pwrH = 1.2f; m.sag = 0.35f; m.otLp = 9000; m.otHp = 75; m.presHz = 4500; m.nfb = 0.f;
  }
  else if (id == "dc30")
  {
    m.st = {S(40, 1.4f, .22f, 11000, 30), S(32, 1.3f, .25f, 9500, 70)};
    m.gainPos = 1; m.tsPos = 2; m.tsType = 2; m.ts = vox;
    m.power = 2; m.pwrH = 1.3f; m.sag = 0.3f; m.otLp = 8500; m.otHp = 70; m.presHz = 4000; m.nfb = 0.f;
  }
  else if (id == "plexi")
  {
    m.st = {S(40, 1.5f, .3f, 12000, 40), S(30, 1.3f, .35f, 9000, 90)};
    m.gainPos = 1; m.tsPos = 2; m.ts = marshall; m.brightHz = 2200; m.brightDb = 7;
    m.power = 1; m.pwrH = 1.5f; m.sag = 0.4f; m.otLp = 7000; m.otHp = 60; m.presHz = 3200;
  }
  else if (id == "jcm800")
  {
    m.st = {S(45, 1.5f, .3f, 11000, 60), S(40, 1.2f, .35f, 8000, 150), S(25, 1.3f, .3f, 7000, 120)};
    m.gainPos = 1; m.tsPos = 3; m.ts = marshall; m.brightHz = 2500; m.brightDb = 5;
    m.power = 1; m.pwrH = 2.0f; m.sag = 0.3f; m.otLp = 6800; m.otHp = 65; m.presHz = 3500;
  }
  else if (id == "jubilee")
  {
    m.st = {S(45, 1.5f, .3f, 11000, 50), S(40, 1.2f, .35f, 8000, 120), S(30, 1.1f, .4f, 7000, 100)};
    m.gainPos = 1; m.tsPos = 3; m.ts = marshall; m.power = 1; m.pwrH = 2.0f; m.sag = 0.35f; m.otLp = 7000; m.presHz = 3500;
  }
  else if (id == "recto")
  {
    m.st = {S(45, 1.5f, .3f, 10000, 30), S(45, 1.2f, .35f, 8000, 60), S(40, 1.1f, .35f, 7000, 80), S(25, 1.2f, .3f, 6500, 60)};
    m.gainPos = 1; m.tsPos = 4; m.ts = mesa; m.power = 1; m.pwrH = 2.2f; m.sag = 0.55f; m.otLp = 6200; m.otHp = 45;
    m.presHz = 3800; m.depthHz = 80; m.tight = 0.3f;
  }
  else if (id == "recto_clean")
  {
    m.st = {S(35, 1.7f, .2f, 12000, 20), S(25, 1.8f, .2f, 10000, 30)};
    m.ts = fender; m.power = 1; m.pwrH = 3.5f; m.sag = 0.3f; m.otLp = 7500; m.otHp = 45; m.presHz = 3500;
  }
  else if (id == "markiic")
  {
    m.st = {S(40, 1.5f, .25f, 11000, 30), S(40, 1.2f, .35f, 8000, 120), S(35, 1.1f, .35f, 7000, 100), S(25, 1.2f, .3f, 6500, 60)};
    m.gainPos = 2; m.tsPos = 1; m.ts = mesa; m.power = 1; m.pwrH = 2.5f; m.sag = 0.3f; m.otLp = 6800; m.otHp = 55; m.presHz = 3500;
  }
  else if (id == "5150")
  {
    m.st = {S(50, 1.5f, .3f, 10000, 40), S(45, 1.1f, .35f, 7500, 160), S(40, 1.0f, .4f, 7000, 140), S(30, 1.1f, .35f, 6500, 100)};
    m.gainPos = 1; m.tsPos = 4; m.ts = peavey; m.power = 1; m.pwrH = 2.2f; m.sag = 0.3f; m.otLp = 6300; m.otHp = 60;
    m.presHz = 3600; m.depthHz = 95; m.tight = 0.6f;
  }
  else if (id == "slo")
  {
    m.st = {S(45, 1.5f, .3f, 10000, 40), S(45, 1.2f, .35f, 7500, 120), S(35, 1.1f, .35f, 7000, 100), S(25, 1.2f, .3f, 6500, 80)};
    m.gainPos = 1; m.tsPos = 4; m.ts = marshall; m.power = 1; m.pwrH = 2.0f; m.sag = 0.35f; m.otLp = 6800; m.presHz = 3300;
  }
  else if (id == "dumble")
  {
    m.st = {S(40, 1.6f, .25f, 11000, 30), S(35, 1.3f, .3f, 8000, 90), S(25, 1.3f, .3f, 7500, 70)};
    m.gainPos = 1; m.tsPos = 1; m.ts = fender; m.power = 1; m.pwrH = 2.6f; m.sag = 0.35f; m.otLp = 7200; m.presHz = 3000;
  }
  else if (id == "orange")
  {
    m.st = {S(45, 1.5f, .3f, 10000, 40), S(40, 1.2f, .35f, 7500, 110), S(30, 1.2f, .35f, 7000, 90)};
    m.gainPos = 1; m.tsPos = 3; m.ts = orange; m.power = 1; m.pwrH = 1.8f; m.sag = 0.45f; m.otLp = 6500; m.presHz = 0;
  }
  else if (id == "uber")
  {
    m.st = {S(50, 1.5f, .3f, 9500, 40), S(45, 1.1f, .35f, 7200, 130), S(40, 1.0f, .4f, 6800, 120), S(30, 1.1f, .35f, 6000, 90)};
    m.gainPos = 1; m.tsPos = 4; m.ts = marshall; m.power = 1; m.pwrH = 2.6f; m.sag = 0.35f; m.otLp = 5800; m.otHp = 55; m.presHz = 3200; m.tight = 0.4f;
  }
  else if (id == "vh4")
  {
    m.st = {S(50, 1.5f, .3f, 10000, 50), S(45, 1.1f, .35f, 7800, 170), S(40, 1.0f, .4f, 7200, 150), S(30, 1.1f, .35f, 6500, 110)};
    m.gainPos = 1; m.tsPos = 4; m.ts = mesa; m.power = 1; m.pwrH = 2.6f; m.sag = 0.25f; m.otLp = 6600; m.otHp = 50; m.presHz = 3800; m.depthHz = 85; m.tight = 0.7f;
  }
  else if (id == "friedman")
  {
    m.st = {S(45, 1.5f, .3f, 11000, 50), S(40, 1.2f, .35f, 8000, 140), S(35, 1.1f, .4f, 7000, 120)};
    m.gainPos = 1; m.tsPos = 3; m.ts = marshall; m.brightHz = 2600; m.brightDb = 4;
    m.power = 1; m.pwrH = 1.9f; m.sag = 0.35f; m.otLp = 7000; m.presHz = 3500; m.tight = 0.4f;
  }
  else if (id == "hiwatt")
  {
    m.st = {S(30, 2.2f, .2f, 13000, 30), S(25, 2.2f, .2f, 10000, 50)};
    m.ts = marshall; m.power = 1; m.pwrH = 3.8f; m.sag = 0.15f; m.otLp = 8000; m.otHp = 50; m.presHz = 3200;
  }
  else if (id == "jc120")
  {
    m.st = {S(20, 4.0f, .0f, 16000, 20)};
    m.tsType = 1; m.baxMid = 800; m.power = 3; m.pwrH = 6.f; m.sag = 0; m.otLp = 12000; m.otHp = 40; m.presHz = 0;
  }
  // ---------------- bass ----------------
  else if (id == "svt")
  {
    m.inHp = 15;
    m.st = {S(35, 1.6f, .25f, 9000, 15), S(25, 1.5f, .3f, 7000, 20)};
    m.tsType = 3; m.baxBass = 50; m.baxMid = 500; m.baxTreble = 4000; m.baxRange = 15;
    m.power = 1; m.pwrH = 2.2f; m.sag = 0.45f; m.otLp = 5500; m.otHp = 30; m.presHz = 0;
  }
  else if (id == "b15")
  {
    m.inHp = 20;
    m.st = {S(30, 1.6f, .25f, 7000, 20), S(25, 1.5f, .25f, 6000, 25)};
    m.tsType = 3; m.baxBass = 60; m.baxMid = 400; m.baxTreble = 2500;
    m.power = 1; m.pwrH = 1.6f; m.sag = 0.5f; m.otLp = 4500; m.otHp = 35; m.presHz = 0;
  }
  else if (id == "gk800")
  {
    m.inHp = 15;
    m.st = {S(10, 5.0f, 0, 15000, 15)};
    m.tsType = 1; m.baxBass = 60; m.baxMid = 500; m.baxTreble = 5000; m.baxRange = 15;
    m.power = 3; m.pwrH = 6.f; m.sag = 0; m.otLp = 12000; m.otHp = 30; m.presHz = 4000;
  }
  else if (id == "ad200")
  {
    m.inHp = 20;
    m.st = {S(40, 1.4f, .3f, 7500, 20), S(30, 1.3f, .35f, 6000, 30)};
    m.tsType = 3; m.baxBass = 70; m.baxMid = 600; m.baxTreble = 2800;
    m.power = 1; m.pwrH = 1.6f; m.sag = 0.5f; m.otLp = 5000; m.otHp = 30; m.presHz = 0;
  }
  else if (id == "markbass")
  {
    m.inHp = 15;
    m.st = {S(8, 6.0f, 0, 18000, 15)};
    m.tsType = 1; m.baxBass = 50; m.baxMid = 700; m.baxTreble = 6000;
    m.power = 3; m.pwrH = 6.f; m.sag = 0; m.otLp = 14000; m.otHp = 30; m.presHz = 0;
  }
  else if (id == "acoustic")
  {
    m.st = {S(6, 8.0f, 0, 18000, 20)};
    m.tsType = 1; m.baxBass = 120; m.baxMid = 900; m.baxTreble = 6000;
    m.power = 0; m.otLp = 18000; m.otHp = 40;
  }
  else // default: "brit"
  {
    m.st = {S(40, 1.5f, .3f, 12000, 40), S(30, 1.3f, .35f, 9000, 90)};
    m.ts = marshall; m.power = 1; m.pwrH = 1.6f;
  }
  return m;
}

// Plugins define new amps by starting from a built-in model ("base") and overriding any field:
// {"base":"jcm800","stages":[[G,H,bias,lp,hp],...],"gainPos":1,"tsPos":3,"tsType":0,"stack":"marshall"|[R1,R2,R3,R4,C1,C2,C3],
//  "tsMakeup":4,"brightHz":0,"brightDb":0,"power":1,"pwrH":2,"sag":.35,"presHz":3500,"depthHz":90,"nfb":.5,
//  "otLp":7000,"otHp":55,"tight":0,"inHp":20,"baxBass":100,"baxMid":600,"baxTreble":3500,"baxRange":15,
//  "drive":1.0 (scales every stage gain), "dark":0 (shifts all stage lows-pass filters down by this many octaves)}
AmpModel modelFromJson(const json& j)
{
  AmpModel m = makeModel(j.value("base", std::string("plexi")));
  if (j.contains("stages") && j["stages"].is_array())
  {
    m.st.clear();
    for (auto& s : j["stages"])
      if (s.is_array() && s.size() >= 5) m.st.push_back(S(s[0], s[1], s[2], s[3], s[4]));
  }
  auto f = [&](const char* k, float& v) { if (j.contains(k)) v = j[k].get<float>(); };
  auto i = [&](const char* k, int& v) { if (j.contains(k)) v = j[k].get<int>(); };
  i("gainPos", m.gainPos); i("tsPos", m.tsPos); i("tsType", m.tsType); i("power", m.power);
  f("tsMakeup", m.tsMakeup); f("brightHz", m.brightHz); f("brightDb", m.brightDb); f("pwrH", m.pwrH); f("sag", m.sag);
  f("presHz", m.presHz); f("depthHz", m.depthHz); f("nfb", m.nfb); f("otLp", m.otLp); f("otHp", m.otHp); f("tight", m.tight);
  f("inHp", m.inHp); f("baxBass", m.baxBass); f("baxMid", m.baxMid); f("baxTreble", m.baxTreble); f("baxRange", m.baxRange);
  if (j.contains("stack"))
  {
    const auto& t = j["stack"];
    if (t.is_array() && t.size() >= 7) m.ts = ToneStackComponents{t[0], t[1], t[2], t[3], t[4], t[5], t[6]};
    else if (t.is_string())
    {
      const std::string n = t.get<std::string>();
      const char* names[] = {"deluxe", "bassman", "jcm800", "recto", "ac30", "orange", "5150"};
      const char* alias[] = {"fender", "bassman", "marshall", "mesa", "vox", "orange", "peavey"};
      for (int k = 0; k < 7; ++k) if (n == alias[k] || n == names[k]) m.ts = makeModel(names[k]).ts;
    }
  }
  const float drive = j.value("drive", 1.f);
  const float dark = j.value("dark", 0.f);
  for (auto& s : m.st) { s.G *= drive; s.lp *= std::pow(2.f, -dark); }
  return m;
}

struct AmpChannel
{
  AmpModel m;
  struct SS { Biquad lp, lp2; OnePole hp; } st[6];
  OnePole inHp, tightHp;
  Biquad bright;
  ToneStack ts;
  Biquad bxB, bxM, bxT;
  Biquad pres, depth, otLp, otLp2;
  OnePole otHp;
  float sagEnv = 0;
  float trim = 1.f;
};

class AmpBlock : public Block
{
public:
  int pGain, pBass, pMid, pTreble, pPresence, pDepth, pMaster, pLevel, pBright, pChannel, pSag, pMidFreq, pUltraLo, pUltraHi;
  std::vector<AmpChannel> chans;
  bool preampOnly = false;
  Oversampler os;
  float sr = 48000, osr = 96000;
  std::vector<float> buf, mono;
  Smoother sGain, sMaster, sLevel;
  float lastT = -1, lastM = -1, lastB = -1, lastP = -1, lastD = -1, lastBr = -1, lastG = -1, lastMf = -1, lastUL = -1, lastUH = -1;
  int lastCh = -1;
  AmpBlock(const json& o)
  {
    pGain = addParam("gain", 0.5f);
    pBass = addParam("bass", 0.5f);
    pMid = addParam("mid", 0.5f);
    pTreble = addParam("treble", 0.5f);
    pPresence = addParam("presence", 0.5f);
    pDepth = addParam("depth", 0.5f);
    pMaster = addParam("master", 0.5f);
    pLevel = addParam("level", 0, -30, 12);
    pBright = addParam("bright", 0, 0, 1);
    pChannel = addParam("channel", 0, 0, 3);
    pSag = addParam("sag", 0.5f);
    pMidFreq = addParam("midfreq", 0.5f);
    pUltraLo = addParam("ultralo", 0, 0, 1);
    pUltraHi = addParam("ultrahi", 0, 0, 1);
    preampOnly = o.value("preamp", false);
    std::vector<json> models;
    if (o.contains("models")) for (auto& m : o["models"]) models.push_back(m);
    else if (o.contains("voice")) models.push_back(o["voice"]);
    else models.push_back(o.value("model", "plexi"));
    for (auto& id : models)
    {
      AmpChannel c;
      c.m = id.is_object() ? modelFromJson(id) : makeModel(id.get<std::string>());
      if (preampOnly) c.m.power = 0;
      chans.push_back(c);
    }
    finalizeParams();
  }

  void prepare(const PrepareCtx& c) override
  {
    sr = float(c.sr);
    os.prepare(std::max(2, c.oversample), c.maxBlock);
    osr = sr * float(os.factor);
    buf.assign(c.maxBlock * 8, 0.f);
    mono.assign(c.maxBlock, 0.f);
    sGain.setTime(40, sr); sMaster.setTime(40, sr); sLevel.setTime(40, sr);
    for (auto& ch : chans)
    {
      setupChannel(ch);
      ch.trim = 1.f;
      ch.trim = calibrate(ch);
    }
    lastT = -1;
    lastCh = -1;
  }

  void setupChannel(AmpChannel& ch)
  {
    const AmpModel& m = ch.m;
    ch.inHp.lp(m.inHp, sr);
    ch.tightHp.lp(80 + 300 * m.tight, osr);
    for (size_t i = 0; i < m.st.size() && i < 6; ++i)
    {
      ch.st[i].lp.set(Biquad::LP, std::min(m.st[i].lp, osr * 0.45f), 0.6, 0, osr);
      ch.st[i].lp2.set(Biquad::LP, std::min(m.st[i].lp * 1.6f, osr * 0.45f), 0.6, 0, osr);
      ch.st[i].hp.lp(m.st[i].hp, osr);
    }
    ch.otLp.set(Biquad::LP, std::min(m.otLp, osr * 0.45f), 0.65, 0, osr);
    ch.otLp2.set(Biquad::LP, std::min(m.otLp * 1.4f, osr * 0.45f), 0.55, 0, osr);
    ch.otHp.lp(m.otHp, osr);
  }

  void updateTone(AmpChannel& ch, bool force)
  {
    const float t = p(pTreble), md = p(pMid), b = p(pBass), pr = p(pPresence), d = p(pDepth), br = p(pBright), g = p(pGain);
    const float mf = p(pMidFreq), ul = p(pUltraLo), uh = p(pUltraHi);
    if (!force && t == lastT && md == lastM && b == lastB && pr == lastP && d == lastD && br == lastBr && g == lastG && mf == lastMf &&
        ul == lastUL && uh == lastUH)
      return;
    lastT = t; lastM = md; lastB = b; lastP = pr; lastD = d; lastBr = br; lastG = g; lastMf = mf; lastUL = ul; lastUH = uh;
    const AmpModel& m = ch.m;
    if (m.tsType == 0) ch.ts.set(t, md, b, osr);
    else if (m.tsType == 2) ch.ts.set(t, 0.55, b, osr);
    else
    {
      const float midF = m.tsType == 3 ? logMap(mf, 220, 3000) : m.baxMid;
      ch.bxB.set(Biquad::LowShelf, m.baxBass, 0.7, (b - 0.5f) * 2 * m.baxRange + (ul > 0.5f ? 4 : 0), osr);
      ch.bxM.set(Biquad::Peak, midF, 0.8, (md - 0.5f) * 2 * m.baxRange - (ul > 0.5f ? 6 : 0), osr);
      ch.bxT.set(Biquad::HighShelf, m.baxTreble, 0.7, (t - 0.5f) * 2 * m.baxRange + (uh > 0.5f ? 6 : 0), osr);
    }
    // bright cap: strongest at low gain settings
    const float brDb = (m.brightHz > 0 ? m.brightDb * (1.f - g) : 0.f) + (br > 0.5f ? 5.f : 0.f);
    ch.bright.set(Biquad::HighShelf, m.brightHz > 0 ? m.brightHz : 2200, 0.7, brDb, osr);
    // presence / depth (feedback loop shelves); class-A "cut" style when nfb == 0
    if (m.presHz > 0) ch.pres.set(Biquad::HighShelf, m.presHz, 0.7, (pr - 0.5f) * 16.f, osr);
    else ch.pres.set(Biquad::HighShelf, 4000, 0.7, (pr - 0.5f) * 6.f, osr);
    ch.depth.set(Biquad::Peak, m.depthHz, 1.0, (d - 0.5f) * 12.f, osr);
  }

  inline float tubeStage(const Stage& s, float x) { return s.G * s.H * shape::tube(x / s.H, s.bias); }

  // run one channel over an oversampled buffer
  void runChannel(AmpChannel& ch, float* x, int n, const float* gainArr, const float* masterArr, int osf)
  {
    const AmpModel& m = ch.m;
    const float sagAmt = m.sag * (0.3f + 1.4f * p(pSag));
    const float sagA = 1.f - std::exp(-1.f / (0.025f * osr)), sagR = 1.f - std::exp(-1.f / (0.15f * osr));
    const bool hasTs = true;
    for (int i = 0; i < n; ++i)
    {
      float v = x[i];
      if (m.tight > 0) v = v - ch.tightHp.processLP(v) * m.tight * 0.8f;
      for (size_t s = 0; s < m.st.size() && s < 6; ++s)
      {
        if (int(s) == m.gainPos) v *= gainArr[i / osf];
        if (s == 0 && m.gainPos == 0) v *= gainArr[i / osf];
        if (s == 0) v = ch.bright.process(v);
        if (hasTs && int(s) == m.tsPos)
        {
          if (m.tsType == 0 || m.tsType == 2) v = ch.ts.process(v) * m.tsMakeup;
          else v = ch.bxT.process(ch.bxM.process(ch.bxB.process(v)));
        }
        v = ch.st[s].hp.processHP(v);
        v = tubeStage(m.st[s], v * (s == 0 ? 1.f : (m.st.size() >= 3 ? 0.25f : 0.6f)));
        v = ch.st[s].lp.process(v);
      }
      if (int(m.st.size()) <= m.tsPos)
      {
        if (m.tsType == 0 || m.tsType == 2) v = ch.ts.process(v) * m.tsMakeup;
        else v = ch.bxT.process(ch.bxM.process(ch.bxB.process(v)));
      }
      if (int(m.st.size()) <= m.gainPos) v *= gainArr[i / osf];
      if (m.power != 0)
      {
        v *= masterArr[i / osf] * 0.05f;
        v = ch.depth.process(v);
        v = ch.pres.process(v);
        // power supply sag reduces available headroom on loud passages
        const float a = std::fabs(v) / m.pwrH;
        ch.sagEnv += (a > ch.sagEnv ? sagA : sagR) * (a - ch.sagEnv);
        const float H = m.pwrH / (1.f + sagAmt * ch.sagEnv);
        if (m.power == 1) v = H * fastTanh(v / H) * (1.f - 0.05f * fastTanh(v / H) * fastTanh(v / H));
        else if (m.power == 2) v = H * shape::asym(v / H, 0.18f);
        else v = H * shape::hard(v / H, 4.f);
        v = ch.otHp.processHP(v);
        v = ch.otLp2.process(ch.otLp.process(v));
      }
      else
      {
        v = ch.otHp.processHP(v);
        v = ch.otLp.process(v);
      }
      x[i] = v * ch.trim;
    }
  }

  float calibrate(AmpChannel& ch)
  {
    // drive the model with a guitar-level test tone at default knob settings and normalise to about -14 dBFS RMS
    std::vector<float> test(4096 * os.factor);
    std::vector<float> gArr(4096, dbToGain(-30.f + 30.f * 0.5f)), mArr(4096, audioTaper(0.5f) * 4.f);
    updateTone(ch, true);
    double e = 0;
    for (int rep = 0; rep < 4; ++rep)
    {
      for (int i = 0; i < int(test.size()); ++i) test[i] = 0.15f * std::sin(float(kTwoPi) * 196.f * (rep * test.size() + i) / osr);
      runChannel(ch, test.data(), int(test.size()), gArr.data(), mArr.data(), os.factor);
      if (rep == 3) for (float v : test) e += v * v;
    }
    const float rms = float(std::sqrt(e / test.size()));
    // reset filter states after calibration
    AmpModel keep = ch.m;
    float tr = rms > 1e-6f ? 0.2f / rms : 1.f;
    ch = AmpChannel();
    ch.m = keep;
    setupChannel(ch);
    lastT = -1;
    return tr;
  }

  void process(const float* const* in, float* const* out, int n) override
  {
    const int chIdx = std::max(0, std::min(int(chans.size()) - 1, int(std::round(p(pChannel)))));
    AmpChannel& ch = chans[chIdx];
    updateTone(ch, chIdx != lastCh);
    lastCh = chIdx;
    const float gTarget = dbToGain(-30.f + 30.f * p(pGain));
    const float mTarget = audioTaper(p(pMaster)) * 4.f;
    const float lTarget = dbToGain(p(pLevel));
    float gArr[64], mArr[64];
    const int osf = os.factor;
    for (int off = 0; off < n; off += 64)
    {
      const int m = std::min(64, n - off);
      for (int i = 0; i < m; ++i)
      {
        mono[i] = ch.inHp.processHP(nIn > 1 ? 0.5f * (in[0][off + i] + in[1][off + i]) : in[0][off + i]);
        gArr[i] = sGain.next(gTarget);
        mArr[i] = sMaster.next(mTarget);
      }
      float* o = os.up(mono.data(), m);
      runChannel(ch, o, m * osf, gArr, mArr, osf);
      os.down(o, buf.data(), m);
      for (int i = 0; i < m; ++i)
      {
        const float y = buf[i] * sLevel.next(lTarget);
        for (int c = 0; c < std::max(1, nOut); ++c) out[c][off + i] = y;
      }
    }
  }
};

RegisterBlock r1("amp", [](const json& o, int, int) { return std::make_unique<AmpBlock>(o); });
} // namespace
} // namespace tz
