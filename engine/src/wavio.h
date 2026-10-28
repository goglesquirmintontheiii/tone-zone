#pragma once
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace tz
{
// Reads PCM 8/16/24/32-bit int and 32/64-bit float WAV (incl. WAVE_FORMAT_EXTENSIBLE).
inline bool readWav(const std::string& path, std::vector<std::vector<float>>& chans, double& sr)
{
  FILE* f = fopen(path.c_str(), "rb");
  if (!f) return false;
  std::vector<uint8_t> d;
  {
    uint8_t buf[65536];
    size_t r;
    while ((r = fread(buf, 1, sizeof buf, f)) > 0) d.insert(d.end(), buf, buf + r);
    fclose(f);
  }
  if (d.size() < 12 || memcmp(d.data(), "RIFF", 4) || memcmp(d.data() + 8, "WAVE", 4)) return false;
  auto u16 = [&](size_t o) { return uint16_t(d[o] | (d[o + 1] << 8)); };
  auto u32 = [&](size_t o) { return uint32_t(d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (uint32_t(d[o + 3]) << 24)); };
  size_t pos = 12;
  int fmt = 0, nch = 0, bits = 0;
  uint32_t rate = 0;
  const uint8_t* data = nullptr;
  size_t dataLen = 0;
  while (pos + 8 <= d.size())
  {
    const uint32_t len = u32(pos + 4);
    if (!memcmp(d.data() + pos, "fmt ", 4) && pos + 24 <= d.size())
    {
      fmt = u16(pos + 8);
      nch = u16(pos + 10);
      rate = u32(pos + 12);
      bits = u16(pos + 22);
      if (fmt == 0xFFFE && len >= 40 && pos + 8 + 26 <= d.size()) fmt = u16(pos + 8 + 24);
    }
    else if (!memcmp(d.data() + pos, "data", 4))
    {
      data = d.data() + pos + 8;
      dataLen = std::min<size_t>(len, d.size() - pos - 8);
    }
    pos += 8 + len + (len & 1);
  }
  if (!data || nch <= 0 || rate == 0) return false;
  const int bps = bits / 8;
  if (bps <= 0) return false;
  const size_t frames = dataLen / (bps * nch);
  chans.assign(nch, std::vector<float>(frames));
  for (size_t i = 0; i < frames; ++i)
    for (int c = 0; c < nch; ++c)
    {
      const uint8_t* s = data + (i * nch + c) * bps;
      float v = 0;
      if (fmt == 3 && bps == 4) { float x; memcpy(&x, s, 4); v = x; }
      else if (fmt == 3 && bps == 8) { double x; memcpy(&x, s, 8); v = float(x); }
      else if (bps == 1) v = (float(s[0]) - 128.f) / 128.f;
      else if (bps == 2) v = float(int16_t(s[0] | (s[1] << 8))) / 32768.f;
      else if (bps == 3) { int32_t x = (s[0] << 8) | (s[1] << 16) | (s[2] << 24); v = float(x) / 2147483648.f; }
      else if (bps == 4) { int32_t x; memcpy(&x, s, 4); v = float(x) / 2147483648.f; }
      chans[c][i] = v;
    }
  sr = rate;
  return true;
}

inline bool writeWav(const std::string& path, const std::vector<std::vector<float>>& chans, double sr)
{
  FILE* f = fopen(path.c_str(), "wb");
  if (!f) return false;
  const uint16_t nch = uint16_t(chans.size());
  const uint32_t frames = chans.empty() ? 0 : uint32_t(chans[0].size());
  const uint32_t dataSize = frames * nch * 4;
  auto w32 = [&](uint32_t v) { fwrite(&v, 4, 1, f); };
  auto w16 = [&](uint16_t v) { fwrite(&v, 2, 1, f); };
  fwrite("RIFF", 1, 4, f); w32(36 + dataSize); fwrite("WAVE", 1, 4, f);
  fwrite("fmt ", 1, 4, f); w32(16); w16(3); w16(nch); w32(uint32_t(sr)); w32(uint32_t(sr) * nch * 4); w16(nch * 4); w16(32);
  fwrite("data", 1, 4, f); w32(dataSize);
  for (uint32_t i = 0; i < frames; ++i)
    for (uint16_t c = 0; c < nch; ++c) fwrite(&chans[c][i], 4, 1, f);
  fclose(f);
  return true;
}
} // namespace tz
