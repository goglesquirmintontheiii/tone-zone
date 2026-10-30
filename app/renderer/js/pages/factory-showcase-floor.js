// Pedal Factory templates: the Atlas Floor and the Pixel Quest, two of the built in multi-effects rebuilt as factory
// designs. Same layout as the board units (scaled to the factory's 360 mm), a circuit that plays like them, and
// screens with their own code (factory-atlas-script.js, factory-pixel-script.js) that run the menus and pages and
// drive the circuit through their outputs.
import { circuit, knobMap, binMap, finish, screen, uid } from './factory-showcase-kit.js';
import { ATLAS_SCRIPT, stripScript, stripValue, modelsValue } from './factory-atlas-script.js';
import { PIXEL_SCRIPT } from './factory-pixel-script.js';

// a screen output that drives circuit inputs (raw) or another screen
const sout = (name, def, to, sig = 'n') => ({ id: uid('p'), name, sig, def, maps: to ? [{ to: to.to, raw: true }] : [] });
const btn = (x, y, label, o = {}) => ({ id: uid('b'), kind: 'button', x, y, r: 4, shape: 'rect', w: 8.1, h: 4, color: '#2c3038', led: false, ledColor: '#3fa8ff', on: false, label, labelPos: 'below', ...o });
const tread = (x, y, w, h, label, o = {}) => ({ id: uid('p'), kind: 'pedal', x, y, w, h, value: 0.5, color: '#191b20', logo: label, label, labelPos: 'none', ...o });
const toPos = (v, lo, hi) => Math.log(v / lo) / Math.log(hi / lo);

/** h = the factory's template helpers: { base, txt, knob, stomp, led, jack, art, toggle, FONTS }. */
export function floorTemplates(h) {
  const { base, txt, knob, stomp, led, jack, art, FONTS } = h;
  return [
    {
      id: 'atlas', name: 'Atlas Floor', desc: 'Floor modeler: 6 blocks, scenes, presets, two treadles',
      make: () => {
        const c = circuit('Atlas chain');
        const i = c.node('in', 40, 60), o = c.node('out', 1600, 60);
        const wah = c.part('wah', 180, 40, { mode: 0, q: 0.55, range: 0.5 });
        const vol = c.part('volume', 320, 40);
        const cp = c.part('comp', 460, 40, { sustain: 0.45, level: 0.55 });
        const od = c.part('overdrive', 600, 40, { gain: 0.4, tone: 0.55, level: 0.6 });
        const amp = c.part('amp', 740, 40, { gain: 0.5, bass: 0.5, mid: 0.55, treble: 0.55, level: 0.45 });
        const ch = c.part('chorus', 880, 40, { mix: 0.35 });
        const dl = c.part('delay', 1020, 40, { mode: 1, time: 420, feedback: 0.32, mix: 0.18 });
        const rv = c.part('reverb', 1160, 40, { mode: 2, mix: 0.18, decay: 0.5 });
        const lv = c.part('level', 1300, 40, { level: -3 });
        c.chain([i, wah, vol, cp, od, amp, ch, dl, rv, lv, o]);
        // the treadles and the toe switch: wah or volume
        const exp1 = c.input('Wah / vol', 1, [[wah, 'pos'], [vol, 'pos']]);
        const toe = c.input('Toe', 0, [[wah, 'on'], [vol, 'on', { lo: 1, hi: 0 }]], { bin: true });
        // what the screen drives (its outputs): the preset loaded
        const B = (name, def, n) => c.input(name, def, [[n, 'on']], { bin: true });
        const A = (name, def, n, key, w) => c.input(name, def, [[n, key, w]]);
        const P1 = { ons: [0, 0, 1, 0, 1, 1], models: [1, 3, 4, 1, 2, 3] }; // BRIT CRUNCH, scene 1
        const time = toPos(420, 40, 2000);
        const ins = [
          ['Comp on', 0, B('Comp on', 0, cp), 'b'], ['Drive on', 0, B('Drive on', 0, od), 'b'], ['Amp on', 1, B('Amp on', 1, amp), 'b'],
          ['Mod on', 0, B('Mod on', 0, ch), 'b'], ['Delay on', 1, B('Delay on', 1, dl), 'b'], ['Verb on', 1, B('Verb on', 1, rv), 'b'],
          ['Drive', 0.4, A('Drive', 0.4, od, 'gain')], ['Amp gain', 0.5, A('Amp gain', 0.5, amp, 'gain')],
          ['Time', time, A('Time', time, dl, 'time', { lo: 40, hi: 2000, log: true })], ['Repeats', 0.32, A('Repeats', 0.32, dl, 'feedback')],
          ['Echo mix', 0.18, A('Echo mix', 0.18, dl, 'mix')], ['Echo type', 0.1, A('Echo type', 0.1, dl, 'mode', { lo: 0, hi: 10 })],
          ['Verb mix', 0.18, A('Verb mix', 0.18, rv, 'mix')], ['Verb type', 2 / 9, A('Verb type', 2 / 9, rv, 'mode', { lo: 0, hi: 9 })],
        ];
        const outs = ins.map(([name, def, t, sig]) => sout(name, def, t, sig || 'n'));
        outs.push(sout('Strip', stripValue({ ons: P1.ons }), null), sout('Models', modelsValue(P1.models), null));
        const main = screen(180, 45, 148.5, 72, 'tft', ATLAS_SCRIPT, { res: 330 / 148.5, label: 'MAIN', sio: { ins: [], outs } });
        const strip = (row, y) => screen(156.6, y, 234, 6.75, 'tft', stripScript(row), {
          res: 520 / 234, label: 'STRIP ' + row,
          sio: { ins: [{ id: uid('p'), name: 'Strip', sig: 'n', from: { scr: main.id, o: 14 } }, { id: uid('p'), name: 'Models', sig: 'n', from: { scr: main.id, o: 15 } }], outs: [] },
        });
        // footswitches only tell the screen they were pressed (an input each, wired to nothing)
        const dummy = (name) => binMap(c.input(name, 1, [], { bin: true }));
        const fsx = (k) => 63 + (k % 5) * 46.8, fsy = (k) => (k < 5 ? 128.7 : 162.9);
        const feet = [...Array(10)].map((_, k) => stomp(fsx(k), fsy(k), { style: 'soft', r: 6.3, label: 'FS ' + (k + 1), labelPos: 'none', map: dummy('FS ' + (k + 1)) }));
        const exp2 = tread(22.5, 90, 27.9, 162, 'EXP 2', { value: 0 });
        const toeB = btn(337.5, 13.5, 'TOE', { w: 20.7, h: 5.4, color: '#2b2e35', labelPos: 'none', map: binMap(toe) });
        const knobs = [...Array(6)].map((_, k) => knob(180 + (k - 2.5) * 24.3, 93.15, String(k + 1), { r: 5.4, style: 'chrome', labelPos: 'below' }));
        const d = base({
          name: 'Atlas Floor',
          desc: 'A floor modeler rebuilt in the Pedal Factory.',
          enc: { size: 'custom', w: 360, h: 182, shape: 'box', radius: 7, dots: false, mat: { m: 'metal', s: 'aluminium', f: 'anodized', c: '#24272d' } },
          labels: { font: FONTS[2][0], size: 2.3, color: '#dfe3ea' },
          title: txt({ id: 'title', text: 'ATLAS', font: FONTS[1][0], weight: 700, x: 66, y: 13.5, size: 9, color: '#f2f3f5', ls: 2.2 }),
          sub: txt({ id: 'sub', text: 'FLOOR MODELER', font: FONTS[2][0], weight: 800, x: 62, y: 21, size: 2.5, color: '#ff8a3d', ls: 1, hidden: false }),
          art: [
            art('rect', 22.5, 91, 36, 173, '#0d0e11'), art('rect', 337.5, 91, 36, 173, '#0d0e11'),
            art('rect', 180, 52.7, 272, 96.3, '#3a3f48', { opacity: 0.7 }), art('rect', 180, 140.4, 272, 72.9, '#15171b'),
            art('rect', 180, 102.5, 259, 1.1, '#ff8a3d', { opacity: 0.9 }), art('circle', 288, 42.3, 30.6, 30.6, '#121418'),
          ],
          ctls: [
            main, strip(1, 112.5), strip(2, 146.7),
            ...knobs,
            btn(59.4, 33.3, 'MENU'), btn(59.4, 45, 'HOME'), btn(59.4, 56.7, 'SAVE', { color: '#3a2a20' }),
            btn(92.7, 92.7, '< PAGE'), btn(267.3, 92.7, 'PAGE >'),
            btn(288, 32.4, 'UP', { w: 5.9, h: 5, labelPos: 'none' }), btn(288, 52.2, 'DOWN', { w: 5.9, h: 5, labelPos: 'none' }),
            btn(277.2, 42.3, 'LEFT', { w: 5, h: 5.9, labelPos: 'none' }), btn(298.8, 42.3, 'RIGHT', { w: 5, h: 5.9, labelPos: 'none' }),
            btn(288, 42.3, 'ENTER', { shape: 'round', r: 3.6, color: '#3a3f49', labelPos: 'none' }),
            btn(274.5, 72, 'BACK'), btn(301.5, 72, 'ON/OFF'),
            ...feet,
            stomp(292.5, 128.7, { style: 'soft', r: 6.3, label: 'MODE', labelPos: 'below', map: dummy('MODE') }),
            stomp(292.5, 162.9, { style: 'soft', r: 6.3, label: 'TAP', labelPos: 'below', map: dummy('TAP') }),
            led(292.5, 118.4, '#ffffff', { r: 1.5 }), led(292.5, 152.6, '#ff3b30', { r: 1.5, bind: 'tap:' + c.inst.id }),
            exp2, tread(337.5, 96.3, 27.9, 149.4, 'EXP 1', { value: 1, logo: 'WAH · VOL', map: knobMap(exp1) }),
            toeB, led(337.5, 8.5, '#ff3b30', { r: 1, bind: 'ctl:' + toeB.id }),
          ],
          jacks: [
            jack('in', 'right', 0.08, { label: 'GUITAR IN' }), jack('out', 'left', 0.08, { label: 'OUT L' }), jack('stereo', 'left', 0.16),
            jack('xlr', 'top', 0.62, { label: 'XLR' }), jack('phones', 'top', 0.86), jack('exp', 'top', 0.76, { label: 'EXP 3', drive: exp2.id }), jack('power', 'top', 0.69),
          ],
        });
        return finish(d, [c.inst]);
      },
    },
    {
      id: 'pixelquest', name: 'Pixel Quest', desc: 'A game console synth: characters are voices, levels are effects',
      make: () => {
        const c = circuit('Pixel synth');
        const i = c.node('in', 40, 60), o = c.node('out', 1400, 60);
        const pw = c.part('pitch', 160, 40, { semis1: 12, level1: 0.6, dry: 1 });
        pw.p.on = 0;
        const s = c.part('synth', 300, 40, { mode: 0, filter: 0.65, reso: 0.25, attack: 0.03, sens: 0.55, wet: 1, dry: 0.5 });
        const cr = c.part('crusher', 440, 40, { bits: 0.75, rate: 0.1, mix: 0.4 });
        const sl = c.part('slicer', 580, 40, { time: 190, pattern: 1, depth: 0.9, smooth: 0.15, mix: 1 });
        const ch = c.part('chorus', 720, 40, { mode: 1, rate: 0.25, depth: 0.45, mix: 1 });
        const dl = c.part('delay', 860, 40, { mode: 0, time: 180, feedback: 0.2, mix: 0.25 });
        const rv = c.part('reverb', 1000, 40, { mode: 0, mix: 0.2, decay: 0.45 });
        const lv = c.part('level', 1140, 40, { level: -7 });
        c.chain([i, pw, s, cr, sl, ch, dl, rv, lv, o]);
        const volume = c.input('Volume', 0.6, [[lv, 'level', { lo: -25, hi: 5 }]]);
        const mix = c.input('Mix', 0.7, [[s, 'wet', { lo: 0.2, hi: 1 }], [s, 'dry', { lo: 0.85, hi: 0 }]]);
        const tone = c.input('Tone', 0.6, [[s, 'filter', { lo: 0.2, hi: 0.95 }]]);
        const B = (name, def, n) => c.input(name, def, [[n, 'on']], { bin: true });
        const A = (name, def, list) => c.input(name, def, list);
        const ins = [
          ['Voice', 0, A('Voice', 0, [[s, 'mode', { lo: 0, hi: 7 }]])], ['Octave', 2 / 3, A('Octave', 2 / 3, [[s, 'octave', { lo: -2, hi: 1 }]])],
          ['Crush on', 0, B('Crush on', 0, cr), 'b'], ['Crush', 0, A('Crush', 0, [[cr, 'bits', { lo: 0.75, hi: 0.25 }], [cr, 'mix', { lo: 0.4, hi: 0.9 }]])],
          ['Slice on', 0, B('Slice on', 0, sl), 'b'], ['Pattern', 0, A('Pattern', 0, [[sl, 'pattern', { lo: 0, hi: 15 }]])],
          ['Slice time', 0.5, A('Slice time', 0.5, [[sl, 'time', { lo: 60, hi: 320 }]])],
          ['Echo on', 1, B('Echo on', 1, dl), 'b'], ['Echo time', 0.15, A('Echo time', 0.15, [[dl, 'time', { lo: 0, hi: 1200 }]])],
          ['Repeats', 0.2, A('Repeats', 0.2, [[dl, 'feedback']])], ['Echo mix', 0.25, A('Echo mix', 0.25, [[dl, 'mix']])],
          ['Echo type', 0, A('Echo type', 0, [[dl, 'mode', { lo: 0, hi: 10 }]])],
          ['Verb type', 0, A('Verb type', 0, [[rv, 'mode', { lo: 0, hi: 9 }]])], ['Verb mix', 0.2, A('Verb mix', 0.2, [[rv, 'mix']])],
          ['Wobble', 0, B('Wobble', 0, ch), 'b'], ['Power', 0, B('Power', 0, pw), 'b'],
        ];
        const outs = ins.map(([name, def, t, sig]) => sout(name, def, t, sig || 'n'));
        const dummy = (name) => binMap(c.input(name, 1, [], { bin: true }));
        const pad = (x, y, label) => btn(x, y, label, { w: 5.5, h: 5.5, color: '#2a2833', labelPos: 'none' });
        const kk = (x, label, t, v) => knob(x, 145, label, { r: 4.5, style: 'white', value: v, ...(t ? { map: knobMap(t) } : {}) });
        const d = base({
          name: 'Pixel Quest',
          desc: 'A game console synth rebuilt in the Pedal Factory.',
          enc: { size: 'custom', w: 150, h: 187, shape: 'box', radius: 8, dots: false, mat: { m: 'plastic', f: 'matte', c: '#c9c3d6' } },
          labels: { font: FONTS[2][0], size: 2.4, color: '#2d2a7a' },
          title: txt({ id: 'title', text: 'PIXEL QUEST', font: FONTS[1][0], weight: 700, x: 66, y: 97, size: 7, color: '#2d2a7a', ls: 0.7, italic: true }),
          // the footswitch legends, light on the dark rubber strip
          sub: txt({ id: 'sub', text: ['POWER', '< LEVEL', 'LEVEL >', 'POWER-UP'].join('\u00a0'.repeat(13)), font: FONTS[2][0], weight: 800, x: 66, y: 179.5, size: 2.3, color: '#e9e4f5', ls: 0.2, hidden: false }),
          art: [
            art('rect', 75, 50, 126, 78, '#45405a'), art('rect', 75, 14.3, 116, 1, '#ff3f7f'), art('rect', 75, 16.3, 116, 1, '#5ec8ff'),
            art('rect', 31, 116, 26, 8, '#2a2833'), art('rect', 31, 116, 8, 26, '#2a2833'),
            art('circle', 126, 112, 12, 12, '#a9a3b8'), art('circle', 111, 120, 12, 12, '#a9a3b8'),
            art('rect', 61, 129, 12, 4.5, '#a9a3b8', { rot: -20 }), art('rect', 81, 129, 12, 4.5, '#a9a3b8', { rot: -20 }),
            ...[...Array(6)].map((_, k) => art('rect', 108 + k * 4.5, 140.5, 1.75, 11, '#000000', { opacity: 0.28, rot: -28 })),
            art('rect', 70, 169.5, 125, 27, '#2a2833'),
          ],
          ctls: [
            screen(75, 48, 80, 60, 'tft', PIXEL_SCRIPT, { res: 2, label: 'GAME', sio: { ins: [], outs } }),
            led(22, 36, '#ff3f7f', { r: 1.3 }),
            pad(31, 108.5, 'UP'), pad(31, 123.5, 'DOWN'), pad(23.5, 116, 'LEFT'), pad(38.5, 116, 'RIGHT'),
            btn(126, 112, 'A', { shape: 'round', r: 4.5, color: '#ff3f7f' }), btn(111, 120, 'B', { shape: 'round', r: 4.5, color: '#ff3f7f' }),
            btn(61, 129, 'SELECT', { shape: 'pill', w: 9, h: 3, color: '#55506a' }), btn(81, 129, 'START', { shape: 'pill', w: 9, h: 3, color: '#55506a' }),
            kk(15, 'VOLUME', volume, 0.6), kk(37, 'MIX', mix, 0.7), kk(59, 'TONE', tone, 0.6), kk(81, 'SPEED', null, 0.5),
            stomp(21, 167, { style: 'soft', r: 5.5, label: 'POWER', labelPos: 'none' }),
            stomp(51, 167, { style: 'soft', r: 5.5, label: '< LEVEL', labelPos: 'none', map: dummy('< Level') }),
            stomp(81, 167, { style: 'soft', r: 5.5, label: 'LEVEL >', labelPos: 'none', map: dummy('Level >') }),
            stomp(111, 167, { style: 'soft', r: 5.5, label: 'POWER-UP', labelPos: 'none', map: dummy('Power-up') }),
          ],
          jacks: [
            jack('in', 'right', 0.25), jack('out', 'left', 0.25, { label: 'OUT L' }), jack('stereo', 'left', 0.4), jack('phones', 'top', 0.85), jack('power', 'top', 0.15),
          ],
        });
        return finish(d, [c.inst]);
      },
    },
  ];
}
