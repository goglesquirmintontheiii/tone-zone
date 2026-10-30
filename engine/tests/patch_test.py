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

# 10. analog values -255..255 through math parts (raw slots): (200 * -1) + 201 = 1 opens a VCA; 200 * 200 clamps to 255
R = lambda p, d: {'p': p, 'def': d, 'lo': -255, 'hi': 255, 'raw': True}
a200 = {'k': 'param', 'pi': 0, 'slots': []}
mul = {'k': 'mul', 'slots': [R('a', 0), R('b', -1)]}
addn = {'k': 'add', 'slots': [R('a', 0), R('b', 201)]}
vg = {'k': 'vca', 'slots': [{'p': 'gain', 'def': 0, 'lo': 0, 'hi': 1}]}
pa = [{'name': 'c1.a', 'def': 200, 'min': -255, 'max': 255}]
y12 = render(patch([AIN, a200, mul, addn, vg, AOUT], [[1, 0, 2, 0, 1], [2, 0, 3, 0, 1], [3, 0, 4, 0, 1], [0, 0, 4, 0, 0], [4, 0, 5, 0, 0]], pa), sine)
check(abs(rms(y12[4800:]) - rms(dry[4800:])) < 0.003, f'200 * -1 + 201 = 1 opens a VCA ({rms(y12[4800:]):.4f})')
sq = {'k': 'mul', 'slots': [R('a', 0), R('b', 200)]}
sub = {'k': 'sub', 'slots': [R('a', 0), R('b', 254)]}
y13 = render(patch([AIN, a200, sq, sub, vg, AOUT], [[1, 0, 2, 0, 1], [2, 0, 3, 0, 1], [3, 0, 4, 0, 1], [0, 0, 4, 0, 0], [4, 0, 5, 0, 0]], pa), sine)
check(abs(rms(y13[4800:]) - rms(dry[4800:])) < 0.003, '200 * 200 clamps to 255, minus 254 = 1')
dv = {'k': 'div', 'slots': [R('a', 5), R('b', 0)]}
vh = {'k': 'vca', 'slots': [{'p': 'gain', 'def': 1, 'lo': 0, 'hi': 1}]}
y14 = render(patch([AIN, dv, vh, AOUT], [[1, 0, 2, 0, 1], [0, 0, 2, 0, 0], [2, 0, 3, 0, 0]]), sine)
check(rms(y14[4800:]) < 1e-4, f'dividing by zero gives 0, not a blow up ({rms(y14[4800:]):.5f})')
neg = {'k': 'param', 'pi': 0, 'slots': []}
y15 = render(patch([AIN, neg, vh, AOUT], [[1, 0, 2, 0, 1], [0, 0, 2, 0, 0], [2, 0, 3, 0, 0]], [{'name': 'c1.n', 'def': -120.5, 'min': -255, 'max': 255}]), sine)
check(rms(y15[4800:]) < 1e-4, 'a negative analog value reads as the bottom of a normal slot')

# 11. an input span: 50 of 0..100 is half way
p50 = {'k': 'param', 'pi': 0, 'slots': []}
vs = {'k': 'vca', 'slots': [{'p': 'gain', 'def': 1, 'lo': 0, 'hi': 1, 'xlo': 0, 'xhi': 100}]}
y16 = render(patch([AIN, p50, vs, AOUT], [[1, 0, 2, 0, 1], [0, 0, 2, 0, 0], [2, 0, 3, 0, 0]], [{'name': 'c1.p', 'def': 50, 'min': 0, 'max': 100}]), sine)
check(abs(rms(y16[4800:]) / rms(dry[4800:]) - 0.5) < 0.01, 'an input span maps 50 of 0..100 to half')

# 12. control delay: a constant 1 reaches the VCA half a second later
c1 = {'k': 'const', 'slots': [{'p': 'value', 'def': 1}]}
cd = {'k': 'cdelay', 'slots': [{'p': 'in', 'def': 0, 'lo': -255, 'hi': 255, 'raw': True}, {'p': 'time', 'def': 0.5, 'lo': 0, 'hi': 10, 'raw': True}]}
y17 = render(patch([AIN, c1, cd, vg, AOUT], [[1, 0, 2, 0, 1], [2, 0, 3, 0, 1], [0, 0, 3, 0, 0], [3, 0, 4, 0, 0]]), sine)
early, late = rms(y17[2400:21600]), rms(y17[28800:48000])
check(early < 1e-4 and abs(late - rms(dry[4800:])) < 0.003, f'the delay part passes its input on after 0.5 s ({early:.5f} then {late:.4f})')

# 13. a circuit input fed by another circuit's output (its 'in' slot) instead of its param
fed = {'k': 'param', 'pi': 0, 'slots': [{'p': 'in', 'def': 0, 'lo': -255, 'hi': 255, 'raw': True}]}
c0b = {'k': 'const', 'slots': [{'p': 'value', 'def': 0}]}
y18 = render(patch([AIN, c0b, fed, vh, AOUT], [[1, 0, 2, 0, 1], [2, 0, 3, 0, 1], [0, 0, 3, 0, 0], [3, 0, 4, 0, 0]], [{'name': 'c1.x', 'def': 1, 'min': 0, 'max': 1}]), sine)
check(rms(y18[4800:]) < 1e-4, 'a wired circuit input follows the wire, not its param')

print(f'{fails} failed' if fails else 'all passed')
sys.exit(1 if fails else 0)
