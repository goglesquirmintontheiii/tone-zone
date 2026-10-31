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

# ---------------------------------------------------------------- script audio
def render2(node, src, timeline=(), nodes_extra=None):
    """Render one block and return (mono output, its status at the end)."""
    g = {'nodes': [{'id': 'p', 'nIn': 1, 'nOut': 1, 'params': {}, **node}],
         'cables': [{'from': {'node': '__in', 'port': 0}, 'to': {'node': 'p', 'port': 0}},
                    {'from': {'node': 'p', 'port': 0}, 'to': {'node': '__out', 'port': 0}}],
         'timeline': list(timeline)}
    gp, op = os.path.join(TMP, 'g2.json'), os.path.join(TMP, 'o2.wav')
    json.dump(g, open(gp, 'w'))
    r = subprocess.run([EXE, '--offline', gp, src, op], check=True, capture_output=True, text=True)
    st = {}
    for line in r.stderr.splitlines():
        if line.startswith('status: '):
            st = json.loads(line[8:]).get('p') or {}
    _, y = wavfile.read(op)
    return (y if y.ndim == 1 else y[:, 0]), st


def peak_hz(x):
    w = np.hanning(len(x))
    m = np.abs(np.fft.rfft(x * w))
    return float(np.argmax(m) * 48000 / len(x))


def at(tsec, cmd):
    return {'t': tsec, 'cmd': cmd}


def param(name, v):
    return {'cmd': 'param', 'id': 'p', 'name': name, 'value': v}


# 14. an oscillator played by a circuit input (as a screen output drives it): note 69 is 440 Hz, then 81 is 880 Hz
RAWN = {'p': 'note', 'def': 57, 'lo': 0, 'hi': 127, 'raw': True}
oscp = lambda shape: {'k': 'osc', 'slots': [RAWN, {'p': 'amp', 'def': 0.5}, {'p': 'shape', 'def': shape}, {'p': 'pw', 'def': 0.5}, {'p': 'glide', 'def': 10}]}
pn = {'k': 'param', 'pi': 0, 'sm': 15}
pp = [{'name': 'c1.note', 'def': 69, 'min': 0, 'max': 127}]
y20, _ = render2(patch([AIN, pn, oscp(0), AOUT], [[1, 0, 2, 0, 1], [2, 0, 3, 0, 0]], pp), sine, [at(1.0, param('c1.note', 81))])
f1, f2 = peak_hz(y20[9600:48000]), peak_hz(y20[57600:96000])
check(abs(f1 - 440) < 3 and abs(f2 - 880) < 3, f'a Script osc plays the note it is set to ({f1:.1f} Hz, then {f2:.1f} Hz)')
check(abs(rms(y20[9600:48000]) - 0.5 / np.sqrt(2)) < 0.01, f'its level is its amp ({rms(y20[9600:48000]):.3f})')
d = np.abs(np.diff(y20[47000:50000]))
check(d.max() < 0.2, f'the note change glides without a click (largest step {d.max():.3f})')
for sh, nm in [(1, 'triangle'), (2, 'saw'), (3, 'square'), (4, 'pulse')]:
    ys, _ = render2(patch([AIN, pn, oscp(sh), AOUT], [[1, 0, 2, 0, 1], [2, 0, 3, 0, 0]], pp), sine)
    check(np.isfinite(ys).all() and abs(peak_hz(ys[9600:48000]) - 440) < 3 and np.abs(ys).max() < 0.7, f'{nm} wave at 440 Hz ({peak_hz(ys[9600:48000]):.1f} Hz)')

# 15. noise: white and pink, pink darker
nz = lambda c: {'k': 'noise', 'slots': [{'p': 'amp', 'def': 0.3}, {'p': 'color', 'def': c}]}
yw, _ = render2(patch([AIN, nz(0), AOUT], [[1, 0, 2, 0, 0]]), sine)
yp, _ = render2(patch([AIN, nz(1), AOUT], [[1, 0, 2, 0, 0]]), sine)
hf = lambda x: rms(np.diff(x)) / rms(x)
check(rms(yw) > 0.1 and rms(yp) > 0.03 and hf(yp) < hf(yw) * 0.6, f'white and pink noise ({rms(yw):.3f} / {rms(yp):.3f}, pink is darker)')

# 16. an envelope gated by a circuit input shapes the oscillator
gp_ = {'k': 'param', 'pi': 1}
adsr = {'k': 'adsr', 'slots': [{'p': 'gate', 'def': 0}, {'p': 'attack', 'def': 5}, {'p': 'decay', 'def': 100}, {'p': 'sustain', 'def': 0.5}, {'p': 'release', 'def': 100}]}
pp2 = pp + [{'name': 'c1.gate', 'def': 0, 'min': 0, 'max': 1}]
y21, _ = render2(patch([AIN, pn, oscp(0), gp_, adsr, AOUT], [[1, 0, 2, 0, 1], [2, 0, 4, 0, 0], [3, 0, 4, 0, 1], [4, 0, 5, 0, 0]], pp2), sine,
                 [at(0.5, param('c1.gate', 1)), at(1.2, param('c1.gate', 0))])
pre, hold, after = rms(y21[0:22000]), rms(y21[38400:55000]), rms(y21[72000:96000])
check(pre < 1e-4 and abs(hold - 0.5 * 0.5 / np.sqrt(2)) < 0.01 and after < 1e-3, f'the envelope opens on the gate, holds at sustain and lets go ({pre:.5f}, {hold:.3f}, {after:.5f})')

# 17. the sampler plays an uploaded buffer (int16 base64) when its gate goes on, and keeps it when the block is rebuilt
import base64
tone = (0.5 * np.sin(2 * np.pi * 1000 * np.arange(24000) / 48000) * 32767).astype('<i2')
b64 = base64.b64encode(tone.tobytes()).decode()
smp = {'k': 'sampler', 'slots': [{'p': 'slot', 'def': 2}, {'p': 'gate', 'def': 0}, {'p': 'mode', 'def': 0}, {'p': 'rate', 'def': 1}, {'p': 'level', 'def': 1}]}
pg = [{'name': 'c1.gate', 'def': 0, 'min': 0, 'max': 1}]
spatch = patch([AIN, {'k': 'param', 'pi': 0}, smp, AOUT], [[1, 0, 2, 1, 1], [2, 0, 3, 0, 0]], pg)
y22, _ = render2(spatch, sine, [at(0, {'cmd': 'sample', 'id': 'p', 'slot': 2, 'sr': 48000, 'b64': b64, 'fmt': 's16'}), at(0.4, param('c1.gate', 1))])
pre, play, post = rms(y22[0:19000]), y22[21000:39000], rms(y22[48000:])
check(pre < 1e-4 and abs(peak_hz(play) - 1000) < 5 and abs(rms(play) - 0.5 / np.sqrt(2)) < 0.02 and post < 1e-4, f'the sampler plays its buffer once on the gate ({pre:.5f}, {peak_hz(play):.0f} Hz at {rms(play):.3f}, then {post:.5f})')
# a JSON array buffer at 24 kHz, played at double speed: 2 x 250 Hz = 500 Hz
arr = [round(float(v), 4) for v in 0.4 * np.sin(2 * np.pi * 250 * np.arange(12000) / 24000)]
smp2 = dict(smp, slots=[{'p': 'slot', 'def': 1}, {'p': 'gate', 'def': 0}, {'p': 'mode', 'def': 2}, {'p': 'rate', 'def': 2}, {'p': 'level', 'def': 1}])
spatch2 = patch([AIN, {'k': 'param', 'pi': 0}, smp2, AOUT], [[1, 0, 2, 1, 1], [2, 0, 3, 0, 0]], pg)
# after 0.3 s the graph changes (a new block instance): the buffer is handed over and the loop keeps going
g_new = {'nodes': [{'id': 'p', 'nIn': 1, 'nOut': 1, 'params': {'c1.gate': 1}, **dict(spatch2, opts=dict(spatch2['opts'], mixDef=1, mix=False, extra=1))}],
         'cables': [{'from': {'node': '__in', 'port': 0}, 'to': {'node': 'p', 'port': 0}}, {'from': {'node': 'p', 'port': 0}, 'to': {'node': '__out', 'port': 0}}]}
y23, _ = render2(spatch2, sine, [at(0, {'cmd': 'sample', 'id': 'p', 'slot': 1, 'sr': 24000, 'data': arr}), at(0.1, param('c1.gate', 1)), at(0.6, {'cmd': 'setGraph', 'graph': g_new})])
a1, a2 = y23[9600:28000], y23[48000:96000]
check(abs(peak_hz(a1) - 500) < 5 and abs(peak_hz(a2) - 500) < 5 and rms(a2) > 0.2, f'a 24 kHz buffer at double speed loops at 500 Hz, and survives a rebuild ({peak_hz(a1):.0f} / {peak_hz(a2):.0f} Hz, {rms(a2):.3f})')

# 18. jack analysis: only when asked, then level, spectrum, waveform and pitch per tagged jack
scp = patch([dict(AIN, jk='jin'), {'k': 'vca', 'slots': [{'p': 'gain', 'def': 0.5}]}, dict(AOUT, jk='jout')], [[0, 0, 1, 0, 0], [1, 0, 2, 0, 0]])
_, st0 = render2(scp, sine)
check('scope' not in st0, 'no analysis in the status until a script asks')
_, st1 = render2(scp, sine, [at(0, {'cmd': 'scope', 'id': 'p', 'what': ['level', 'spec', 'wave', 'pitch']})])
sc = st1.get('scope', {})
ji, jo = sc.get('jin', {}), sc.get('jout', {})
check(abs(ji.get('rms', 0) - 0.3 / np.sqrt(2)) < 0.01 and abs(jo.get('rms', 0) - 0.15 / np.sqrt(2)) < 0.01 and abs(ji.get('peak', 0) - 0.3) < 0.01,
      f"levels per jack (in {ji.get('rms')} peak {ji.get('peak')}, out {jo.get('rms')})")
sp = ji.get('spec', [])
band = int(round(31 * np.log(220 / 40) / np.log(400)))  # centres 40 Hz .. 16 kHz
check(len(sp) == 32 and int(np.argmax(sp)) == band and abs(sp[band] - 20 * np.log10(0.3)) < 2, f'a 32 band spectrum peaks at the 220 Hz band ({int(np.argmax(sp)) if sp else None} / {band}, {sp[band] if sp else None} dB)')
wv = ji.get('wave', [])
check(len(wv) == 128 and max(wv) > 0.25 and min(wv) < -0.25 and wv[0] >= -0.05 and wv[1] > wv[0], 'a 128 point waveform, starting on a rising zero crossing')
check(abs(ji.get('hz', 0) - 220) < 2 and ji.get('conf', 0) > 0.8, f"pitch of the input jack ({ji.get('hz')} Hz, confidence {ji.get('conf')})")
_, st2 = render2(scp, sine, [at(0, {'cmd': 'scope', 'id': 'p', 'what': ['level'], 'jacks': ['jout']})])
check(list(st2.get('scope', {}).keys()) == ['jout'] and 'spec' not in st2['scope']['jout'], 'a request can pick jacks and what to measure')
_, st3 = render2(scp, sine, [at(0, {'cmd': 'scope', 'id': 'p', 'what': ['level']}), at(1, {'cmd': 'scope', 'id': 'p', 'on': False})])
check('scope' not in st3, 'and switch it off again')

# 19. script gain: gain and the cuts glide, half gain is half the level, a high cut tames a 5 kHz tone
hi5 = os.path.join(TMP, 'hi5.wav')
gen.write(hi5, 0.3 * np.sin(2 * np.pi * 5000 * t))
sg = lambda g, lp: {'k': 'sgain', 'slots': [{'p': 'gain', 'def': g}, {'p': 'lp', 'def': lp}, {'p': 'hp', 'def': 20}, {'p': 'smooth', 'def': 20}]}
yg, _ = render2(patch([AIN, sg(0.5, 20000), AOUT], [[0, 0, 1, 0, 0], [1, 0, 2, 0, 0]]), sine)
check(abs(rms(yg[4800:]) / rms(dry[4800:]) - 0.5) < 0.01, f'Script gain at 0.5 halves the level ({rms(yg[4800:]) / rms(dry[4800:]):.3f})')
_, dhi = wavfile.read(hi5)
yl, _ = render2(patch([AIN, sg(1, 500), AOUT], [[0, 0, 1, 0, 0], [1, 0, 2, 0, 0]]), hi5)
check(rms(yl[4800:]) < 0.2 * rms(dhi[4800:]), f'its high cut at 500 Hz takes a 5 kHz tone down ({20 * np.log10(rms(yl[4800:]) / rms(dhi[4800:])):.1f} dB)')
pgain = [{'name': 'c1.g', 'def': 0, 'min': 0, 'max': 2}]
yj, _ = render2(patch([AIN, {'k': 'param', 'pi': 0}, sg(0, 20000), AOUT], [[1, 0, 2, 0, 1], [0, 0, 2, 0, 0], [2, 0, 3, 0, 0]], pgain), sine, [at(1, param('c1.g', 1))])
d = np.abs(np.diff(yj[47000:50000]))
check(d.max() < 0.05 and rms(yj[60000:]) > 0.2, f'a gain jump set by a script glides (largest step {d.max():.4f})')

# 20. script voices: started, changed and stopped by commands, added to a jack before or after the circuit
quiet = os.path.join(TMP, 'quiet.wav')
gen.write(quiet, np.zeros(48000 * 2))
thru = patch([dict(AIN, jk='jin'), {'k': 'vca', 'slots': [{'p': 'gain', 'def': 0.5}]}, dict(AOUT, jk='jout')], [[0, 0, 1, 0, 0], [1, 0, 2, 0, 0]])
V = lambda t, **o: at(t, {'cmd': 'voice', 'id': 'p', 'v': o.pop('v', 0), **o})
y30, _ = render2(thru, quiet, [V(0, type='sine', freq=330, amp=0.5, to={'jack': 'jout'}), V(0.5, type='sine', freq=660, amp=0.5, to={'jack': 'jout'}), V(1.0, stop=True)])
a, b, c = y30[4800:24000], y30[28800:48000], y30[49500:]
check(abs(peak_hz(a) - 330) < 3 and abs(rms(a) - 0.5 / np.sqrt(2)) < 0.01 and abs(peak_hz(b) - 660) < 3 and rms(c) < 1e-4,
      f'a voice on the output jack plays, changes note and stops ({peak_hz(a):.0f} Hz at {rms(a):.3f}, {peak_hz(b):.0f} Hz, then {rms(c):.5f})')
y31, _ = render2(thru, quiet, [V(0, type='saw', freq=110, amp=0.4, to={'jack': 'jin'})])
check(abs(rms(y31[4800:]) / (0.4 / np.sqrt(3)) - 0.5) < 0.03, f'a voice on the input jack goes through the circuit (half level: {rms(y31[4800:]) / (0.4 / np.sqrt(3)):.3f})')
y32, _ = render2(thru, quiet, [V(0, type='square', freq=220, amp=0.3, env=True, gate=True, attack=0.01, decay=0.1, sustain=0.5, release=0.1, to={'jack': 'jout'}),
                               V(0.6, type='square', freq=220, amp=0.3, env=True, gate=False, attack=0.01, decay=0.1, sustain=0.5, release=0.1, to={'jack': 'jout'})])
hold, after = rms(y32[19200:28000]), rms(y32[48000:])
check(abs(hold - 0.15) < 0.01 and after < 1e-3, f'its envelope holds at sustain and lets go on gate off ({hold:.3f}, then {after:.5f})')
smp9 = (0.5 * np.sin(2 * np.pi * 500 * np.arange(4800) / 48000)).astype('<f4')
y33, _ = render2(thru, quiet, [at(0, {'cmd': 'sample', 'id': 'p', 'slot': 9, 'sr': 48000, 'b64': base64.b64encode(smp9.tobytes()).decode()}),
                               V(0.2, type='sample', slot=9, loop=True, rate=2, amp=1, to={'jack': 'jout'})])
check(abs(peak_hz(y33[14400:]) - 1000) < 5 and rms(y33[14400:]) > 0.3 and rms(y33[:9000]) < 1e-4, f'a sample voice loops its buffer at double speed ({peak_hz(y33[14400:]):.0f} Hz)')
sin_part = patch([dict(AIN, jk='jin'), {'k': 'scriptin', 'sn': 'lead', 'sni': 'synth', 'slots': [{'p': 'level', 'def': 0.5}]}, dict(AOUT, jk='jout')], [[1, 0, 2, 0, 0]])
y34, _ = render2(sin_part, quiet, [V(0, type='tri', freq=440, amp=0.6, to={'part': 'Lead'})])
check(abs(peak_hz(y34[4800:]) - 440) < 3 and abs(rms(y34[4800:]) - 0.3 / np.sqrt(3)) < 0.01, f'a voice into a Script audio in part by name ({rms(y34[4800:]):.3f})')
F = lambda t, **o: at(t, {'cmd': 'fx', 'id': 'p', 'f': o.pop('f', 0), **o})
y35, _ = render2(patch([dict(AIN, jk='jin'), dict(AOUT, jk='jout')], [[0, 0, 1, 0, 0]]), sine, [F(0, type='gain', gain=0.25, jack='jin'), F(1.0, stop=True)])
check(abs(rms(y35[4800:43000]) / rms(dry[4800:43000]) - 0.25) < 0.01 and abs(rms(y35[50000:]) / rms(dry[50000:]) - 1) < 0.01, 'a gain processor on a jack, then stopped')
y36, _ = render2(patch([dict(AIN, jk='jin'), dict(AOUT, jk='jout')], [[0, 0, 1, 0, 0]]), hi5, [F(0, type='lowpass', freq=500, q=0.7, jack='jout')])
check(rms(y36[4800:]) < 0.05 * rms(dhi[4800:]), f'a low pass processor on the output ({20 * np.log10(rms(y36[4800:]) / rms(dhi[4800:])):.1f} dB at 5 kHz)')
_, st4 = render2(thru, quiet, [V(0, type='sine', freq=1000, amp=0.5, to={'jack': 'jout'}), at(0, {'cmd': 'scope', 'id': 'p', 'what': ['level', 'wave'], 'wave': 48, 'span': 48, 'sync': False})])
jo = st4.get('scope', {}).get('jout', {})
check(abs(jo.get('rms', 0) - 0.354) < 0.01 and len(jo.get('wave', [])) == 48, f"the output jack's analysis includes the voices, raw waves come back as asked ({jo.get('rms')}, {len(jo.get('wave', []))} points)")
_, st5 = render2(scp, guitar, [at(0, {'cmd': 'scope', 'id': 'p', 'what': ['level']})])
check(st5.get('scope', {}).get('jin', {}).get('onset', 0) >= 3, f"note starts are counted ({st5.get('scope', {}).get('jin', {}).get('onset')} of 4)")

print(f'{fails} failed' if fails else 'all passed')
sys.exit(1 if fails else 0)
