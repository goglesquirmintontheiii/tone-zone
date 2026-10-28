"""Generate test signals for offline engine tests."""
import numpy as np, sys
from scipy.io import wavfile
SR = 48000

def ks(freq, dur, sr=SR, amp=0.3, bright=0.5, seed=0):
    rng = np.random.default_rng(seed)
    n = int(dur * sr)
    period = sr / freq
    N = int(period)
    frac = period - N
    buf = rng.uniform(-1, 1, N) * amp
    # lowpass the excitation
    for _ in range(int((1 - bright) * 4)):
        buf = 0.5 * (buf + np.roll(buf, 1))
    out = np.zeros(n)
    d = np.concatenate([buf, np.zeros(n)])
    # simple KS with fractional delay via allpass
    a = (1 - frac) / (1 + frac)
    prev_x = 0.0; prev_y = 0.0
    y = np.zeros(n + N)
    y[:N] = buf
    for i in range(N, n + N):
        x = 0.996 * 0.5 * (y[i - N] + y[i - N - 1 if i - N - 1 >= 0 else 0])
        ap = a * x + prev_x - a * prev_y
        prev_x = x; prev_y = ap
        y[i] = ap
    return y[N:N + n].astype(np.float32)

def write(path, x, sr=SR):
    wavfile.write(path, sr, np.asarray(x, dtype=np.float32))

if __name__ == '__main__':
    what = sys.argv[1]
    if what == 'guitar':
        notes = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]
        sig = np.concatenate([ks(f, 1.0, seed=i) for i, f in enumerate(notes)])
        chord = sum(ks(f, 2.0, seed=10 + i, amp=0.15) for i, f in enumerate(notes))
        write(sys.argv[2], np.concatenate([sig, chord]))
    elif what == 'sine':
        f = float(sys.argv[3]); dur = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0
        amp = float(sys.argv[5]) if len(sys.argv) > 5 else 0.3
        t = np.arange(int(dur * SR)) / SR
        write(sys.argv[2], amp * np.sin(2 * np.pi * f * t))
    elif what == 'pluck':
        f = float(sys.argv[3]); dur = float(sys.argv[4]) if len(sys.argv) > 4 else 3.0
        write(sys.argv[2], ks(f, dur, bright=0.3))
    elif what == 'impulse':
        x = np.zeros(SR * 3); x[100] = 0.5
        write(sys.argv[2], x)
    elif what == 'noise':
        rng = np.random.default_rng(1)
        write(sys.argv[2], rng.normal(0, 0.1, SR * 4))
