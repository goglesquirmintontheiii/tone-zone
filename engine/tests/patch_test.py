#!/usr/bin/env python3
"""Offline checks for the 'patch' block (Pedal Factory circuits).
usage: patch_test.py [engine binary]"""
import json, os, subprocess, sys, tempfile
import numpy as np
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen  # noqa: E402

EXE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'build', 'tonezone-engine')
TMP = tempfile.mkdtemp(prefix='tz-patch-')
fails = 0


def check(cond, msg):
    global fails
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails += 1


def render(node, src):
    g = {'nodes': [{'id': 'p', 'nIn': 1, 'nOut': 1, 'params': {}, **node}],
         'cables': [{'from': {'node': '__in', 'port': 0}, 'to': {'node': 'p', 'port': 0}},
                    {'from': {'node': 'p', 'port': 0}, 'to': {'node': '__out', 'port': 0}}]}
    gp, op = os.path.join(TMP, 'g.json'), os.path.join(TMP, 'o.wav')
    json.dump(g, open(gp, 'w'))
    subprocess.run([EXE, '--offline', gp, src, op], check=True, capture_output=True)
    _, y = wavfile.read(op)
    return y if y.ndim == 1 else y[:, 0]


def rms(x):
    return float(np.sqrt(np.mean(np.square(x)) + 1e-20))


guitar = os.path.join(TMP, 'gtr.wav')
gen.write(guitar, np.concatenate([gen.ks(f, 1.0, seed=i) for i, f in enumerate([82.41, 110.0, 146.83, 196.0])]))
sine = os.path.join(TMP, 'sine.wav')
t = np.arange(48000 * 2) / 48000
gen.write(sine, 0.3 * np.sin(2 * np.pi * 220 * t))
_, dry = wavfile.read(sine)

AIN = {'k': 'ain', 'idx': 0}
AOUT = {'k': 'aout', 'idx': 0}
patch = lambda nodes, edges, params=(), **o: {'algo': 'patch', 'opts': dict(params=list(params), nodes=nodes, edges=edges, outs=[[0, 0]], **o)}

# 1. a drive in a patch sounds like the same drive on its own
drv = {'k': 'algo', 'algo': 'drive', 'opts': {'clip': 'ts', 'tone': 'ts'}, 'params': {'gain': 0.7}, 'slots': []}
y1 = render(patch([AIN, drv, AOUT], [[0, 0, 1, 0, 0], [1, 0, 2, 0, 0]]), guitar)
y0 = render({'algo': 'drive', 'opts': {'clip': 'ts', 'tone': 'ts'}, 'params': {'gain': 0.7}}, guitar)
check(rms(y1) > 0.01 and abs(20 * np.log10(rms(y1) / rms(y0))) < 0.5, f'drive in a patch matches the plain block ({rms(y1):.4f} vs {rms(y0):.4f})')

# 2. LFO into a VCA: a tremolo (output level swings)
lfo = {'k': 'lfo', 'slots': [{'p': 'rate', 'def': 4}, {'p': 'lo', 'def': 0}, {'p': 'hi', 'def': 1}]}
vca = {'k': 'vca', 'slots': [{'p': 'gain', 'def': 1, 'lo': 0, 'hi': 1}]}
y2 = render(patch([AIN, lfo, vca, AOUT], [[0, 0, 2, 0, 0], [1, 0, 2, 0, 1], [2, 0, 3, 0, 0]]), sine)
env = np.array([rms(y2[i:i + 480]) for i in range(0, len(y2) - 480, 480)])
check(env.max() > 0.15 and env.min() < 0.03, f'LFO into a VCA pulses ({env.min():.3f} .. {env.max():.3f})')

# 3. an exposed param drives a slot: the 'vol' knob at 0.25 vs 1
knob = {'k': 'param', 'pi': 0}
vca2 = {'k': 'vca', 'slots': [{'p': 'gain', 'def': 1, 'lo': 0, 'hi': 1}]}
mk = lambda v: dict(patch([AIN, knob, vca2, AOUT], [[0, 0, 2, 0, 0], [1, 0, 2, 0, 1], [2, 0, 3, 0, 0]], [{'name': 'c1.vol', 'def': v, 'min': 0, 'max': 1}]))
lo, hi = rms(render(mk(0.25), sine)[4800:]), rms(render(mk(1.0), sine)[4800:])
check(abs(hi / lo - 4) < 0.1, f'an exposed param scales a slot ({lo:.4f} -> {hi:.4f})')

# 4. a feedback loop through 'fb' rings on but stays bounded, an audio loop without one is not a crash
fb = {'k': 'fb', 'slots': [{'p': 'amount', 'def': 0.9}, {'p': 'time', 'def': 120}, {'p': 'tone', 'def': 6000}]}
summ = {'k': 'sum'}
imp = os.path.join(TMP, 'imp.wav')
x = np.zeros(48000 * 3)
x[100] = 0.5
gen.write(imp, x)
y4 = render(patch([AIN, summ, fb, AOUT], [[0, 0, 1, 0, 0], [2, 0, 1, 0, 0], [1, 0, 2, 0, 0], [1, 0, 3, 0, 0]]), imp)
tail = rms(y4[48000:96000])
check(tail > 1e-4 and np.abs(y4).max() < 1.5, f'feedback loop repeats and stays bounded (tail {tail:.5f}, peak {np.abs(y4).max():.3f})')
y5 = render(patch([AIN, summ, {'k': 'sum'}, AOUT], [[0, 0, 1, 0, 0], [2, 0, 1, 0, 0], [1, 0, 2, 0, 0], [2, 0, 3, 0, 0]]), sine)
check(np.isfinite(y5).all() and np.abs(y5).max() < 10, 'a plain audio loop is broken, not blown up')

# 5. envelope follower + comparator switch between two paths (dry when quiet, inverted+boosted when loud)
envn = {'k': 'env', 'slots': [{'p': 'sens', 'def': 0.5}, {'p': 'attack', 'def': 2}, {'p': 'release', 'def': 50}]}
cmp = {'k': 'cmp', 'slots': [{'p': 'in', 'def': 0}, {'p': 'thr', 'def': 0.5}, {'p': 'hyst', 'def': 0.05}]}
sw = {'k': 'switch', 'slots': [{'p': 'sel', 'def': 0, 'lo': 0, 'hi': 1}]}
mute = {'k': 'vca', 'slots': [{'p': 'gain', 'def': 0}]}
nodes = [AIN, envn, cmp, mute, sw, AOUT]
edges = [[0, 0, 1, 0, 0], [1, 0, 2, 0, 1], [0, 0, 3, 0, 0], [3, 0, 4, 0, 0], [0, 0, 4, 1, 0], [2, 0, 4, 0, 1], [4, 0, 5, 0, 0]]
y6 = render(patch(nodes, edges), guitar)
check(rms(y6[:4800]) > 0.005, f'loud input passes through the comparator gated path ({rms(y6[:4800]):.4f})')

# 6. instance on/off ('bypass' part) and 'on' of an algo node
byp = {'k': 'bypass', 'slots': [{'p': 'on', 'def': 0}]}
y7 = render(patch([AIN, drv, byp, AOUT], [[0, 0, 1, 0, 0], [1, 0, 2, 0, 0], [0, 0, 2, 1, 0], [2, 0, 3, 0, 0]]), sine)
check(abs(rms(y7[4800:]) - rms(dry[4800:])) < 0.003, 'a circuit switched off passes the dry signal')
drv_off = dict(drv, slots=[{'p': 'on', 'def': 0}])
y8 = render(patch([AIN, drv_off, AOUT], [[0, 0, 1, 0, 0], [1, 0, 2, 0, 0]]), sine)
check(abs(rms(y8[4800:]) - rms(dry[4800:])) < 0.003, 'a part switched off passes its input')

# 7. logic: NOT of a constant 0 opens a VCA fully
c0 = {'k': 'const', 'slots': [{'p': 'value', 'def': 0}]}
nt = {'k': 'not', 'slots': [{'p': 'a', 'def': 0}]}
v3 = {'k': 'vca', 'slots': [{'p': 'gain', 'def': 0, 'lo': 0, 'hi': 1}]}
y9 = render(patch([AIN, c0, nt, v3, AOUT], [[1, 0, 2, 0, 1], [0, 0, 3, 0, 0], [2, 0, 3, 0, 1], [3, 0, 4, 0, 0]]), sine)
check(abs(rms(y9[4800:]) - rms(dry[4800:])) < 0.003, 'NOT gate drives a VCA open')

# 8. filter swept by an envelope (auto-wah) changes the tone over a note
flt = {'k': 'filter', 'slots': [{'p': 'freq', 'def': 400, 'lo': 300, 'hi': 3000, 'log': True}, {'p': 'res', 'def': 0.5}, {'p': 'mode', 'def': 0}]}
y10 = render(patch([AIN, envn, flt, AOUT], [[0, 0, 1, 0, 0], [0, 0, 2, 0, 0], [1, 0, 2, 0, 1], [2, 0, 3, 0, 0]]), guitar)
check(rms(y10) > 0.005 and np.isfinite(y10).all(), f'envelope filter renders ({rms(y10):.4f})')

# 9. a lookup table on a slot: 0.5 picks the middle entry (0.25)
c5 = {'k': 'const', 'slots': [{'p': 'value', 'def': 0.5}]}
vt = {'k': 'vca', 'slots': [{'p': 'gain', 'def': 1, 'lo': 0, 'hi': 1, 'tab': [0, 0.25, 1]}]}
y11 = render(patch([AIN, c5, vt, AOUT], [[0, 0, 2, 0, 0], [1, 0, 2, 0, 1], [2, 0, 3, 0, 0]]), sine)
check(abs(rms(y11[4800:]) / rms(dry[4800:]) - 0.25) < 0.01, 'a slot table picks its entry')

print(f'{fails} failed' if fails else 'all passed')
sys.exit(1 if fails else 0)
