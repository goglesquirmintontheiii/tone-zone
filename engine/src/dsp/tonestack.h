// Fender/Marshall/Vox (FMV) passive tone stack, discretised with the bilinear transform
// (D.T. Yeh & J.O. Smith, "Discretization of the '59 Fender Bassman Tone Stack", DAFx 2006).
#pragma once
#include "core.h"

namespace tz
{
struct ToneStackComponents
{
  double R1 = 250e3, R2 = 1e6, R3 = 25e3, R4 = 56e3, C1 = 250e-12, C2 = 20e-9, C3 = 20e-9;
};

struct ToneStack
{
  ToneStackComponents k;
  double b[4] = {0}, a[4] = {1, 0, 0, 0};
  double z[3] = {0, 0, 0};
  double fs = 48000;
  // t treble, m mid, l bass in 0..1
  void set(double t, double m, double l, double sampleRate)
  {
    fs = sampleRate;
    t = std::min(std::max(t, 0.0), 1.0);
    m = std::min(std::max(m, 0.0), 1.0);
    // bass pot is log taper
    l = std::min(std::max(l, 0.0), 1.0);
    l = (std::exp(3.4 * (l - 1.0)) - std::exp(-3.4)) / (1 - std::exp(-3.4));
    m = (std::exp(3.4 * (m - 1.0)) - std::exp(-3.4)) / (1 - std::exp(-3.4)) * 0.6 + m * 0.4;
    const double R1 = k.R1, R2 = k.R2, R3 = k.R3, R4 = k.R4, C1 = k.C1, C2 = k.C2, C3 = k.C3;
    const double b1 = t * C1 * R1 + m * C3 * R3 + l * (C1 * R2 + C2 * R2) + (C1 * R3 + C2 * R3);
    const double b2 = t * (C1 * C2 * R1 * R4 + C1 * C3 * R1 * R4) - m * m * (C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3) +
                      m * (C1 * C3 * R1 * R3 + C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3) +
                      l * (C1 * C2 * R1 * R2 + C1 * C2 * R2 * R4 + C1 * C3 * R2 * R4) +
                      l * m * (C1 * C3 * R2 * R3 + C2 * C3 * R2 * R3) + (C1 * C2 * R1 * R3 + C1 * C2 * R3 * R4 + C1 * C3 * R3 * R4);
    const double b3 = l * m * (C1 * C2 * C3 * R1 * R2 * R3 + C1 * C2 * C3 * R2 * R3 * R4) -
                      m * m * (C1 * C2 * C3 * R1 * R3 * R3 + C1 * C2 * C3 * R3 * R3 * R4) +
                      m * (C1 * C2 * C3 * R1 * R3 * R3 + C1 * C2 * C3 * R3 * R3 * R4) + t * C1 * C2 * C3 * R1 * R3 * R4 -
                      t * m * C1 * C2 * C3 * R1 * R3 * R4 + t * l * C1 * C2 * C3 * R1 * R2 * R4;
    const double a0 = 1;
    const double a1 = (C1 * R1 + C1 * R3 + C2 * R3 + C2 * R4 + C3 * R4) + m * C3 * R3 + l * (C1 * R2 + C2 * R2);
    const double a2 = m * (C1 * C3 * R1 * R3 - C2 * C3 * R3 * R4 + C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3) +
                      l * m * (C1 * C3 * R2 * R3 + C2 * C3 * R2 * R3) - m * m * (C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3) +
                      l * (C1 * C2 * R2 * R4 + C1 * C2 * R1 * R2 + C1 * C3 * R2 * R4 + C2 * C3 * R2 * R4) +
                      (C1 * C2 * R1 * R4 + C1 * C3 * R1 * R4 + C1 * C2 * R3 * R4 + C1 * C2 * R1 * R3 + C1 * C3 * R3 * R4 +
                       C2 * C3 * R3 * R4);
    const double a3 = l * m * (C1 * C2 * C3 * R1 * R2 * R3 + C1 * C2 * C3 * R2 * R3 * R4) -
                      m * m * (C1 * C2 * C3 * R1 * R3 * R3 + C1 * C2 * C3 * R3 * R3 * R4) +
                      m * (C1 * C2 * C3 * R3 * R3 * R4 + C1 * C2 * C3 * R1 * R3 * R3 - C1 * C2 * C3 * R1 * R3 * R4) +
                      l * C1 * C2 * C3 * R1 * R2 * R4 + C1 * C2 * C3 * R1 * R3 * R4;
    // bilinear: s = c (1 - z^-1) / (1 + z^-1)
    const double c = 2 * fs;
    const double c2 = c * c, c3 = c2 * c;
    const double B0 = -b1 * c - b2 * c2 - b3 * c3;
    const double B1 = -b1 * c + b2 * c2 + 3 * b3 * c3;
    const double B2 = b1 * c + b2 * c2 - 3 * b3 * c3;
    const double B3 = b1 * c - b2 * c2 + b3 * c3;
    const double A0 = -a0 - a1 * c - a2 * c2 - a3 * c3;
    const double A1 = -3 * a0 - a1 * c + a2 * c2 + 3 * a3 * c3;
    const double A2 = -3 * a0 + a1 * c + a2 * c2 - 3 * a3 * c3;
    const double A3 = -a0 + a1 * c - a2 * c2 + a3 * c3;
    b[0] = B0 / A0; b[1] = B1 / A0; b[2] = B2 / A0; b[3] = B3 / A0;
    a[0] = 1; a[1] = A1 / A0; a[2] = A2 / A0; a[3] = A3 / A0;
  }
  inline float process(float xf)
  {
    const double x = xf;
    const double y = b[0] * x + z[0];
    z[0] = b[1] * x - a[1] * y + z[1];
    z[1] = b[2] * x - a[2] * y + z[2];
    z[2] = b[3] * x - a[3] * y;
    if (std::fabs(z[0]) < 1e-30) z[0] = 0;
    return float(y);
  }
  void reset() { z[0] = z[1] = z[2] = 0; }
  double mag(double f) const
  {
    std::complex<double> zz = std::polar(1.0, -kTwoPi * f / fs);
    std::complex<double> num = b[0] + b[1] * zz + b[2] * zz * zz + b[3] * zz * zz * zz;
    std::complex<double> den = a[0] + a[1] * zz + a[2] * zz * zz + a[3] * zz * zz * zz;
    return std::abs(num / den);
  }
};
} // namespace tz
