// Pedal Factory templates with coded screens: three small ones (VU Drive, Wave Trem, Squeeze) and two big ones
// (Command Center, Pattern Lab), plus the screen code for the Synth Box and Twin Echo templates. Each template
// is a full design: its circuit graph, the controls wired to it, and screens wired through their own inputs
// and outputs (circuit outputs into the screen, screen outputs into circuit inputs).
import { circuit, knobMap, valsMap, binMap, finish, screen, uid } from './factory-showcase-kit.js';
import { floorTemplates } from './factory-showcase-floor.js';
import { accTemplates } from './factory-showcase-acc.js';
import { SYNTH_SCRIPT, ECHO_SCRIPT, VU_SCRIPT, TREM_SCRIPT, SQUEEZE_SCRIPT, COMMAND_SCRIPT, PATTERN_SCRIPT } from './factory-showcase-scripts.js';

export { SYNTH_SCRIPT, ECHO_SCRIPT };

// ------------------------------------------------------------------ the templates
/** h = the factory's template helpers: { base, txt, knob, stomp, led, jack, art, toggle, FONTS }. */
export function showcaseTemplates(h) {
  const { base, txt, knob, stomp, led, jack, art, toggle, FONTS } = h;
  const list = [
    {
      id: 'vudrive', name: 'VU Drive', desc: 'Amp drive with a needle meter screen',
      make: () => {
        const c = circuit('Amp in a box');
        const i = c.node('in', 40, 60), a = c.part('amp', 260, 40), o = c.node('out', 520, 60);
        c.chain([i, a, o]);
        const env = c.part('env', 300, 260, { sens: 0.03, release: 300 });
        c.wire(a, 'out', env, 'in');
        const lvl = c.out('Level', env);
        const T = (name, key, def) => c.input(name, def, [[a, key]]);
        const gain = T('Gain', 'gain', 0.55), bass = T('Bass', 'bass', 0.5), mid = T('Mid', 'mid', 0.6), treb = T('Treble', 'treble', 0.5), level = T('Level', 'level', 0.5);
        const d = base({
          name: 'VU Drive',
          enc: { size: '1590BB', w: 94, h: 119, shape: 'box', radius: 3, mat: { m: 'metal', s: 'aluminium', f: 'powder', c: '#e9dcc0' } },
          labels: { font: FONTS[0][0], size: 3.2, color: '#2a2219' },
          title: txt({ id: 'title', text: 'VU DRIVE', font: FONTS[1][0], weight: 700, x: 47, y: 86, size: 8, color: '#2a2219', ls: 1.5 }),
          art: [art('rect', 47, 22, 56, 28, '#2a2219', { opacity: 0.9 })],
          ctls: [
            screen(47, 22, 48, 22, 'amber', VU_SCRIPT, { sio: { ins: [{ id: uid('p'), name: 'Level', sig: 'n', from: lvl }], outs: [] } }),
            knob(16, 52, 'GAIN', { r: 6.5, style: 'cream', value: 0.55, map: knobMap(gain) }),
            knob(36.7, 52, 'BASS', { r: 6, style: 'cream', map: knobMap(bass) }),
            knob(57.3, 52, 'MID', { r: 6, style: 'cream', value: 0.6, map: knobMap(mid) }),
            knob(78, 52, 'TREBLE', { r: 6, style: 'cream', map: knobMap(treb) }),
            knob(47, 70, 'LEVEL', { r: 5.5, style: 'cream', map: knobMap(level) }),
            led(20, 104, '#ffb020'), stomp(47, 104),
          ],
          jacks: [jack('in', 'right', 0.5), jack('out', 'left', 0.5), jack('power', 'top', 0.5)],
        });
        return finish(d, [c.inst]);
      },
    },
    {
      id: 'wavetrem', name: 'Wave Trem', desc: 'Tremolo that draws its own wave',
      make: () => {
        const c = circuit('LFO tremolo');
        const i = c.node('in', 40, 60), v = c.part('vca', 300, 60), o = c.node('out', 520, 60);
        c.chain([i, v, o]);
        const lfo = c.part('lfo', 300, 220, { rate: 4, shape: 0, lo: 0.4, hi: 1 });
        c.wire(lfo, 'cv', v, '@gain', { lo: 0, hi: 1 });
        const lfoOut = c.out('LFO', lfo);
        const rate = c.input('Rate', 0.45, [[lfo, 'rate', { lo: 0.5, hi: 12, log: true }]]);
        const depth = c.input('Depth', 0.6, [[lfo, 'lo', { lo: 1, hi: 0 }]]);
        const shape = c.input('Shape', 0, [[lfo, 'shape', { lo: 0, hi: 5 }]]);
        const d = base({
          name: 'Wave Trem',
          enc: { size: '125B', w: 66, h: 122, shape: 'box', radius: 3, mat: { m: 'metal', s: 'aluminium', f: 'anodized', c: '#2b7bd6' } },
          labels: { font: FONTS[0][0], size: 3.2, color: '#f4f1e8' },
          title: txt({ id: 'title', text: 'WAVE TREM', font: FONTS[1][0], weight: 700, x: 33, y: 86, size: 7, ls: 1.5 }),
          ctls: [
            screen(33, 20, 50, 20, 'oled', TREM_SCRIPT, { sio: { ins: [{ id: uid('p'), name: 'LFO', sig: 'n', from: lfoOut }], outs: [] } }),
            knob(15, 47, 'RATE', { r: 6.5, style: 'mxr', value: 0.45, map: knobMap(rate) }),
            knob(51, 47, 'DEPTH', { r: 6.5, style: 'mxr', value: 0.6, map: knobMap(depth) }),
            { id: uid('r'), kind: 'sel', x: 33, y: 64, n: 6, r: 5.5, style: 'boss', opts: ['SIN', 'TRI', 'SQR', 'UP', 'DN', 'RND'], pos: 0, label: 'SHAPE', labelPos: 'none', map: valsMap(shape, 6) },
            led(33, 96, '#3fa8ff'), stomp(33, 108, { r: 6.5 }),
          ],
          jacks: [jack('in', 'right', 0.62), jack('out', 'left', 0.62), jack('power', 'top', 0.5)],
        });
        return finish(d, [c.inst]);
      },
    },
    {
      id: 'squeeze', name: 'Squeeze', desc: 'Compressor in clear acrylic, blend on screen',
      make: () => {
        const c = circuit('Compressor');
        const i = c.node('in', 40, 60), cp = c.part('comp', 300, 40), o = c.node('out', 540, 60);
        c.chain([i, cp, o]);
        const e1 = c.part('env', 260, 240, { sens: 0.03, release: 250 }), e2 = c.part('env', 460, 240, { sens: 0.03, release: 250 });
        c.wire(i, 'out', e1, 'in');
        c.wire(cp, 'out', e2, 'in');
        const inL = c.out('In', e1), outL = c.out('Out', e2);
        const sus = c.input('Sustain', 0.6, [[cp, 'sustain']]), att = c.input('Attack', 0.3, [[cp, 'attack']]), lvl = c.input('Level', 0.55, [[cp, 'level']]);
        const blend = c.input('Blend', 1, [[cp, 'blend']]);
        const d = base({
          name: 'Squeeze',
          enc: { size: '125B', w: 66, h: 122, shape: 'box', radius: 4, mat: { m: 'acrylic', f: 'clear', c: '#9fd4ff' }, pcb: true, pcbColor: '#1d3f8a' },
          labels: { font: FONTS[0][0], size: 3.2, color: '#f4f1e8' },
          title: txt({ id: 'title', text: 'SQUEEZE', font: FONTS[1][0], weight: 700, x: 33, y: 88, size: 7, ls: 1.5, outline: 0.25, outlineColor: '#111111' }),
          ctls: [
            screen(33, 21, 54, 26, 'tft', SQUEEZE_SCRIPT, { sio: { ins: [{ id: uid('p'), name: 'In', sig: 'n', from: inL }, { id: uid('p'), name: 'Out', sig: 'n', from: outL }], outs: [{ id: uid('p'), name: 'Blend', sig: 'n', def: 1, maps: [{ to: blend.to, raw: true }] }] } }),
            knob(14, 54, 'SUSTAIN', { r: 5.5, style: 'chrome', value: 0.6, map: knobMap(sus) }),
            knob(33, 54, 'ATTACK', { r: 5.5, style: 'chrome', value: 0.3, map: knobMap(att) }),
            knob(52, 54, 'LEVEL', { r: 5.5, style: 'chrome', value: 0.55, map: knobMap(lvl) }),
            led(33, 76, '#3fa8ff'), stomp(33, 106),
          ],
          jacks: [jack('in', 'right', 0.55), jack('out', 'left', 0.55), jack('power', 'top', 0.5)],
        });
        return finish(d, [c.inst]);
      },
    },
    {
      id: 'command', name: 'Command Center', desc: 'Five effects, a paged touch screen with menus',
      make: () => {
        const c = circuit('Command chain');
        const i = c.node('in', 40, 60);
        const cp = c.part('comp', 240, 40, { sustain: 0.45 });
        const od = c.part('overdrive', 440, 40);
        const ch = c.part('chorus', 640, 40, { mix: 0.45 });
        const dl = c.part('delay', 840, 40, { mix: 0.3, feedback: 0.35 });
        const rv = c.part('reverb', 1040, 40, { mode: 1, mix: 0.3, decay: 0.55 });
        const o = c.node('out', 1240, 60);
        c.chain([i, cp, od, ch, dl, rv, o]);
        const e1 = c.part('env', 240, 300, { sens: 0.03, release: 200 }), e2 = c.part('env', 1100, 300, { sens: 0.03, release: 200 });
        c.wire(i, 'out', e1, 'in');
        c.wire(rv, 'out', e2, 'in');
        const inL = c.out('In', e1), outL = c.out('Out', e2);
        const K = (name, def, n, key, w) => c.input(name, def, [[n, key, w]]);
        const sus = K('Sustain', 0.45, cp, 'sustain'), drv = K('Drive', 0.5, od, 'gain'), tone = K('Tone', 0.55, od, 'tone'), lvl = K('Level', 0.5, od, 'level');
        const rate = K('Rate', 0.3, ch, 'rate'), dep = K('Depth', 0.5, ch, 'depth');
        const time = K('Time', 0.6, dl, 'time', { lo: 20, hi: 2000, log: true }), rep = K('Repeats', 0.35, dl, 'feedback'), emix = K('Echo', 0.3, dl, 'mix');
        const vmix = K('Verb', 0.3, rv, 'mix');
        const master = c.input('Master', 0.6, [[rv, 'level']]);
        const driveOn = c.input('Drive on', 1, [[od, 'on']], { bin: true }), modOn = c.input('Mod on', 1, [[ch, 'on']], { bin: true });
        const compOn = c.input('Comp on', 1, [[cp, 'on']], { bin: true });
        const tape = c.input('Tape', 0, [[dl, 'mode', { lo: 0, hi: 2 }]]), shim = c.input('Shimmer', 0, [[rv, 'mode', { lo: 1, hi: 4 }]]), vib = c.input('Vibrato', 0, [[ch, 'mode', { lo: 0, hi: 1 }]]);
        const kk = (x, y, label, t, def, o = {}) => knob(x, y, label, { r: 6, style: 'strymon', value: def, map: knobMap(t), ...o });
        const d = base({
          name: 'Command Center',
          enc: { size: 'custom', w: 220, h: 140, shape: 'box', radius: 5, mat: { m: 'metal', s: 'aluminium', f: 'anodized', c: '#23262d' } },
          labels: { font: FONTS[0][0], size: 3.2, color: '#e8ecf2' },
          title: txt({ id: 'title', text: 'COMMAND CENTER', font: FONTS[1][0], weight: 700, x: 110, y: 97, size: 6.5, color: '#e8ecf2', ls: 1.6 }),
          art: [art('rect', 110, 40, 104, 54, '#0a0b0d', { opacity: 0.9 }), art('rect', 110, 137, 220, 6, '#ff7a2f', { opacity: 0.85 })],
          ctls: [
            screen(110, 40, 98, 48, 'tft', COMMAND_SCRIPT, {
              res: 3,
              sio: { ins: [{ id: uid('p'), name: 'In', sig: 'n', from: inL }, { id: uid('p'), name: 'Out', sig: 'n', from: outL }], outs: [{ id: uid('p'), name: 'Master', sig: 'n', def: 0.6, maps: [{ to: master.to, raw: true }] }] },
            }),
            kk(20, 22, 'SUSTAIN', sus, 0.45), kk(44, 22, 'DRIVE', drv, 0.5), kk(20, 50, 'TONE', tone, 0.55), kk(44, 50, 'LEVEL', lvl, 0.5),
            kk(176, 22, 'RATE', rate, 0.3), kk(200, 22, 'DEPTH', dep, 0.5), kk(176, 50, 'TIME', time, 0.6), kk(200, 50, 'REPEATS', rep, 0.35),
            kk(78, 80, 'ECHO', emix, 0.3, { r: 5 }), kk(142, 80, 'VERB', vmix, 0.3, { r: 5 }),
            { id: uid('d'), kind: 'dip', x: 110, y: 79, n: 4, bits: [1, 0, 0, 0], color: '#1f4fbf', label: 'SETUP', labelPos: 'below', maps: [binMap(compOn), knobMap(tape), knobMap(shim), knobMap(vib)] },
            led(30, 109, '#3ddc84'), led(80, 109, '#ff7a2f', { bind: 'fz1' }), led(140, 109, '#b45cff', { bind: 'fz2' }), led(190, 109, '#ff2a1a', { bind: 'tap:' + c.inst.id }),
            stomp(30, 124, { r: 6, label: 'BYPASS', labelPos: 'none' }),
            stomp(80, 124, { r: 6, label: 'DRIVE', labelPos: 'none', map: binMap(driveOn) }),
            stomp(140, 124, { r: 6, label: 'MOD', labelPos: 'none', map: binMap(modOn) }),
            stomp(190, 124, { r: 6, label: 'TAP', labelPos: 'none', map: { to: c.inst.id + '.tap' } }),
          ],
          jacks: [jack('in', 'right', 0.4), jack('out', 'left', 0.35), jack('stereo', 'left', 0.6), jack('exp', 'top', 0.25), jack('power', 'top', 0.75)],
        });
        return finish(d, [c.inst]);
      },
    },
    {
      id: 'patternlab', name: 'Pattern Lab', desc: '8 step filter sequencer, step grid on screen',
      make: () => {
        const c = circuit('Step filter');
        const i = c.node('in', 40, 60), f = c.part('filter', 400, 40, { res: 0.55, mode: 0 }), x = c.part('xfade', 640, 60, { mix: 0.85 }), o = c.node('out', 860, 60);
        c.wire(i, 'out', f, 'in');
        c.wire(i, 'out', x, 'a');
        c.wire(f, 'out', x, 'b');
        c.wire(x, 'out', o, 'in');
        const start = [0.2, 0.9, 0.5, 1, 0.1, 0.7, 0.4, 0.8];
        const seqA = c.part('seq', 220, 260, Object.fromEntries(start.map((v, k) => ['s' + (k + 1), v])));
        const seqB = c.part('seq', 220, 460, { glide: 0, ...Object.fromEntries(start.map((_, k) => ['s' + (k + 1), k / 7])) });
        c.wire(seqA, 'cv', f, '@freq', { lo: 150, hi: 5000, log: true });
        const stepOut = c.out('Step', seqA), posOut = c.out('Pos', seqB);
        const rate = c.input('Rate', 0.45, [[seqA, 'rate', { lo: 0.5, hi: 16, log: true }], [seqB, 'rate', { lo: 0.5, hi: 16, log: true }]]);
        const len = c.input('Length', 1, [[seqA, 'steps', { lo: 1, hi: 8 }], [seqB, 'steps', { lo: 1, hi: 8 }]]);
        const glide = c.input('Glide', 0.15, [[seqA, 'glide']]);
        const res = c.input('Res', 0.55, [[f, 'res']]);
        const mix = c.input('Mix', 0.85, [[x, 'mix']]);
        const type = c.input('Type', 0, [[f, 'mode', { lo: 0, hi: 2 }]]);
        const stepIns = start.map((v, k) => c.input('Step ' + (k + 1), v, [[seqA, 's' + (k + 1)]]));
        const outs = stepIns.map((s, k) => ({ id: uid('p'), name: 'Step ' + (k + 1), sig: 'n', def: start[k], maps: [{ to: s.to, raw: true }] }));
        const d = base({
          name: 'Pattern Lab',
          enc: { size: 'custom', w: 160, h: 132, shape: 'box', radius: 6, mat: { m: 'acrylic', f: 'clear', c: '#b0e0d0' }, pcb: true, pcbColor: '#222428' },
          labels: { font: FONTS[4][0], size: 3, color: '#f4f1e8' },
          title: txt({ id: 'title', text: 'PATTERN LAB', font: FONTS[4][0], weight: 400, x: 80, y: 104, size: 6, color: '#f4f1e8', ls: 1.4, outline: 0.25, outlineColor: '#111111' }),
          ctls: [
            screen(80, 28, 74, 36, 'tft', PATTERN_SCRIPT, { sio: { ins: [{ id: uid('p'), name: 'Pos', sig: 'n', from: posOut }, { id: uid('p'), name: 'Step', sig: 'n', from: stepOut }], outs } }),
            knob(20, 22, 'RATE', { r: 6, style: 'white', value: 0.45, map: knobMap(rate) }),
            knob(20, 48, 'GLIDE', { r: 5.5, style: 'white', value: 0.15, map: knobMap(glide) }),
            knob(140, 22, 'RES', { r: 6, style: 'white', value: 0.55, map: knobMap(res) }),
            knob(140, 48, 'MIX', { r: 5.5, style: 'white', value: 0.85, map: knobMap(mix) }),
            { id: uid('r'), kind: 'sel', part: 'steps', x: 80, y: 66, n: 8, opts: ['1', '2', '3', '4', '5', '6', '7', '8'], pos: 7, ledColor: '#3ddc84', label: 'LENGTH', labelPos: 'none', map: valsMap(len, 8) },
            toggle(80, 86, 3, ['LP', 'BP', 'HP'], { orient: 'h', label: 'TYPE', labelPos: 'none', map: valsMap(type, 3) }),
            led(40, 100, '#3ddc84'), led(120, 100, '#ff2a1a', { bind: 'tap:' + c.inst.id }),
            stomp(40, 116, { r: 6, label: 'BYPASS', labelPos: 'none' }),
            stomp(120, 116, { r: 6, label: 'TAP', labelPos: 'none', map: { to: c.inst.id + '.tap' } }),
          ],
          jacks: [jack('in', 'right', 0.45), jack('out', 'left', 0.45), jack('exp', 'top', 0.25), jack('power', 'top', 0.75)],
        });
        return finish(d, [c.inst]);
      },
    },
  ];
  // the Atlas Floor and Pixel Quest rebuilt as factory designs (factory-showcase-floor.js)
  return [...list, ...floorTemplates(h), ...accTemplates(h)];
}

/** The Synth Box and Twin Echo templates get their coded screens. */
export function codedScreen(d, script) {
  const s = d.ctls.find((c) => c.kind === 'screen');
  if (s) Object.assign(s, { shows: 'custom', script, res: s.res || 4 });
  return d;
}
