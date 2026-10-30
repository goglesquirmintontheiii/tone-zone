// Pedal Factory template: the Advanced Command Center. A bigger Command Center: four circuits (FRONT, DRIVE, MOD,
// SPACE) with 22 effects, a preset library screen and an effects editor screen that share the pedal's files
// (code files in lib/, a preset bank written with bin.pack), LED ring encoders with RGB rings, RGB status LEDs,
// meter bars, an XY pad, a treadle and nine footswitches. The screen code is in factory-acc-scripts.js.
import { circuit, knobMap, valsMap, binMap, finish, screen, uid } from './factory-showcase-kit.js';
import { ACC_PRESETS_SCRIPT, ACC_EDIT_SCRIPT, accFiles, DEEP } from './factory-acc-scripts.js';

const W = 360, H = 246;
// panel colours: the body, the deck behind the screens, the FX panels, and an accent per circuit
const INK = '#e6e9ef', DIM = '#8d95a3';
const SECT = { front: '#3ddc84', drive: '#ff7a2f', mod: '#b45cff', space: '#2b9bff' };

// small builders on top of the factory helpers
const sout = (name, def, to, sig = 'n') => ({ id: uid('p'), name, sig, def, maps: to ? [{ to: to.to, raw: true }] : [] });
const sin = (name, from, sig = 'n') => ({ id: uid('p'), name, sig, from });

/** h = the factory's template helpers: { base, txt, knob, stomp, led, jack, art, toggle, FONTS }. */
export function accTemplates(h) {
  const { base, txt, knob, stomp, led, jack, art, toggle, FONTS } = h;
  return [
    {
      id: 'acc', name: 'Advanced Command Center', desc: 'Four circuits, 22 effects, two screens with a shared preset library',
      make: () => {
        // ---------------------------------------------------------------- the circuits
        // a comparator chain picks one of several parts from a switch position (0..1)
        const pick = (c, src, parts, x, y) => {
          const n = parts.length;
          parts.forEach((p, k) => {
            const lo = (k - 0.5) / (n - 1), hi = (k + 0.5) / (n - 1);
            let g;
            if (k === 0) {
              const cm = c.part('cmp', x, y + k * 70, { thr: hi, hyst: 0.02 });
              c.wire(src, 'cv', cm, '@in');
              g = c.part('not', x + 150, y + k * 70);
              c.wire(cm, 'cv', g, '@a');
            } else if (k === n - 1) {
              g = c.part('cmp', x, y + k * 70, { thr: lo, hyst: 0.02 });
              c.wire(src, 'cv', g, '@in');
            } else {
              g = c.part('window', x, y + k * 70, { lo, hi });
              c.wire(src, 'cv', g, '@in');
            }
            c.wire(g, 'cv', p, '@on');
          });
        };
        // on above a small amount (a slider at zero turns its part off)
        const gateOn = (c, src, part, x, y, thr = 0.03) => {
          const cm = c.part('cmp', x, y, { thr, hyst: 0.01 });
          c.wire(src, 'cv', cm, '@in');
          c.wire(cm, 'cv', part, '@on');
        };
        const envOut = (c, from, name, x, y) => {
          const e = c.part('env', x, y, { sens: 0.03, release: 220 });
          c.wire(from, 'out', e, 'in');
          return { env: e, out: c.out(name, e) };
        };
        const binOut = (c, name, src, x, y, port = 'cv') => {
          const o = c.node('binout', x, y, { name });
          c.wire(src, port, o, '@in');
          return { n: c.inst.id, p: o.id };
        };

        // FRONT: gate, compressor, wah, octave, whammy
        const F = circuit('Front');
        const fi = F.node('in', 40, 60), fo = F.node('out', 1200, 60);
        const gate = F.part('gate', 180, 40, { threshold: 0.25, decay: 0.4 });
        const comp = F.part('comp', 340, 40, { sustain: 0.5, attack: 0.3, level: 0.55, blend: 0.8 });
        const wah = F.part('wah', 500, 40, { mode: 0, q: 0.55, range: 0.55, level: 0.5 });
        const oct = F.part('octave', 660, 40, { level1: 0, level3: 0, dry: 1 });
        const wham = F.part('pitch', 820, 40, { semis1: 0, level1: 1, dry: 0, glide: 0.25 });
        F.chain([fi, gate, comp, wah, oct, wham, fo]);
        const fIn = envOut(F, fi, 'In', 200, 300).out;
        const fLvl = envOut(F, wham, 'Front', 1000, 300).out;
        const gThr = F.input('Gate', 0.25, [[gate, 'threshold']]);
        const sus = F.input('Sustain', 0.5, [[comp, 'sustain']]);
        const blend = F.input('Blend', 0.8, [[comp, 'blend']]);
        const octLvl = F.input('Octave', 0, [[oct, 'level1']]);
        gateOn(F, octLvl.node, oct, 700, 260);
        const exp = F.input('Treadle', 0.5, [[wah, 'pos'], [wham, 'semis1', { lo: 0, hi: 12 }]]);
        const gateSw = F.input('Gate on', 1, [[gate, 'on']], { bin: true });
        const compSw = F.input('Comp on', 1, [[comp, 'on']], { bin: true });
        const wahSw = F.input('Wah on', 0, [[wah, 'on']], { bin: true });
        const whamSw = F.input('Whammy on', 0, [[wham, 'on']], { bin: true });
        const dAttack = F.input('Attack', DEEP[0].def, [[comp, 'attack']]);
        const dQ = F.input('Wah Q', DEEP[1].def, [[wah, 'q']]);
        const dWmode = F.input('Wah mode', DEEP[2].def, [[wah, 'mode', { lo: 0, hi: 2 }]]);

        // DRIVE: boost, overdrive, distortion, fuzz (one at a time), amp, EQ
        const Dc = circuit('Drive');
        const di = Dc.node('in', 40, 60), dout = Dc.node('out', 1200, 60);
        const boost = Dc.part('boost', 180, 40, { gain: 0.3, level: 0.65, mode: 0 });
        const od = Dc.part('overdrive', 340, 40, { gain: 0.45, tone: 0.55, level: 0.5 });
        const ds = Dc.part('distortion', 500, 40, { gain: 0.45, tone: 0.5, level: 0.42 });
        const fz = Dc.part('fuzz', 660, 40, { gain: 0.5, tone: 0.5, level: 0.4 });
        const amp = Dc.part('amp', 820, 40, { gain: 0.3, bass: 0.5, mid: 0.55, treble: 0.55, level: 0.5 });
        const eq = Dc.part('eq', 980, 40, { lowgain: 0, mid1gain: 0, highgain: 0 });
        Dc.chain([di, boost, od, ds, fz, amp, eq, dout]);
        const dLvl = envOut(Dc, eq, 'Drive', 1000, 300).out;
        const gain = Dc.input('Gain', 0.45, [[od, 'gain'], [ds, 'gain'], [fz, 'gain']]);
        const tone = Dc.input('Tone', 0.55, [[od, 'tone'], [ds, 'tone'], [fz, 'tone']]);
        const bst = Dc.input('Boost', 0.3, [[boost, 'gain']]);
        gateOn(Dc, bst.node, boost, 260, 260);
        const voice = Dc.input('Voice', 0, []);
        pick(Dc, voice.node, [od, ds, fz], 420, 420);
        const dAmp = Dc.input('Amp', DEEP[3].def, [[amp, 'gain']]);
        const dBass = Dc.input('Bass', DEEP[4].def, [[eq, 'lowgain', { lo: -12, hi: 12 }]]);
        const dTreb = Dc.input('Treble', DEEP[5].def, [[eq, 'highgain', { lo: -12, hi: 12 }]]);

        // MOD: chorus, phaser, flanger, tremolo, vibe (one at a time) and a ring modulator
        const M = circuit('Mod');
        const mi = M.node('in', 40, 60), mo = M.node('out', 1200, 60);
        const cho = M.part('chorus', 180, 40, { rate: 0.35, depth: 0.5, mix: 0.5 });
        const pha = M.part('phaser', 340, 40, { rate: 0.35, depth: 0.7, feedback: 0.4, mix: 0.5 });
        const fla = M.part('flanger', 500, 40, { speed: 0.3, width: 0.6, regen: 0.5, mix: 0.5 });
        const trem = M.part('tremolo', 660, 40, { rate: 0.4, depth: 0.6, wave: 0.3 });
        const vibe = M.part('vibe', 820, 40, { speed: 0.4, intensity: 0.7 });
        const ring = M.part('ringmod', 980, 40, { freq: 0.4, mix: 0 });
        M.chain([mi, cho, pha, fla, trem, vibe, ring, mo]);
        const mLvl = envOut(M, ring, 'Mod', 1000, 300).out;
        const lfo = M.part('lfo', 600, 300, { rate: 1, shape: 0, lo: 0, hi: 1 });
        const lfoOut = M.out('LFO', lfo);
        const rate = M.input('Rate', 0.35, [[cho, 'rate'], [pha, 'rate'], [fla, 'speed'], [trem, 'rate'], [vibe, 'speed'], [lfo, 'rate', { lo: 0.1, hi: 8, log: true }]]);
        const depth = M.input('Depth', 0.55, [[cho, 'depth'], [pha, 'depth'], [fla, 'width'], [trem, 'depth'], [vibe, 'intensity']]);
        const wet = M.input('Wet', 0.5, [[cho, 'mix'], [pha, 'mix'], [fla, 'mix']]);
        const mtype = M.input('Type', 0, []);
        pick(M, mtype.node, [cho, pha, fla, trem, vibe], 420, 420);
        const sweep = M.input('Sweep', 0.5, [[pha, 'center'], [fla, 'manual'], [ring, 'freq']]);
        const dFb = M.input('Feedback', DEEP[6].def, [[pha, 'feedback'], [fla, 'regen']]);
        const dShape = M.input('Shape', DEEP[7].def, [[trem, 'wave']]);
        const dRing = M.input('Ring', DEEP[8].def, [[ring, 'mix']]);
        gateOn(M, dRing.node, ring, 980, 260, 0.02);

        // SPACE: delay, slicer, freeze, reverb, lo-fi, output level
        const Sp = circuit('Space');
        const si = Sp.node('in', 40, 60), so = Sp.node('out', 1200, 60);
        const dly = Sp.part('delay', 180, 40, { time: 420, feedback: 0.35, mix: 0.3, mode: 0, tone: 0.6 });
        const slc = Sp.part('slicer', 340, 40, { time: 210, pattern: 1, depth: 0.85, mix: 1 });
        const frz = Sp.part('freeze', 500, 40, { mode: 0, mix: 0.6, decay: 1 });
        const rvb = Sp.part('reverb', 660, 40, { mode: 1, mix: 0.25, decay: 0.5, tone: 0.6 });
        const lofi = Sp.part('lofi', 820, 40, { mode: 0, wow: 0.35, flutter: 0.3, age: 0.4, noise: 0.15, mix: 0.7 });
        const lvl = Sp.part('level', 980, 40, { level: -3 });
        Sp.chain([si, dly, slc, frz, rvb, lofi, lvl, so]);
        slc.p.on = 0;
        frz.p.on = 0;
        lofi.p.on = 0;
        const sEnv = envOut(Sp, lvl, 'Out', 1000, 300);
        const sLvl = sEnv.out;
        const clip = Sp.part('cmp', 1100, 420, { thr: 0.8, hyst: 0.05 });
        Sp.wire(sEnv.env, 'cv', clip, '@in');
        const clipOut = binOut(Sp, 'Clip', clip, 1200, 420);
        const beat = Sp.part('lfo', 700, 300, { rate: 2.4, shape: 2, lo: 0, hi: 1, sync: 1 });
        const beatOut = Sp.out('Beat', beat);
        const time = Sp.input('Time', 0.6, [[dly, 'time', { lo: 40, hi: 2000, log: true }], [slc, 'time', { lo: 40, hi: 1000, log: true }], [beat, 'rate', { lo: 25, hi: 0.5, log: true }]]);
        const reps = Sp.input('Repeats', 0.35, [[dly, 'feedback']]);
        const echo = Sp.input('Echo', 0.3, [[dly, 'mix']]);
        const etype = Sp.input('Echo type', 0, [[dly, 'mode', { lo: 0, hi: 10 }]]);
        const space = Sp.input('Space', 0.35, [[rvb, 'mix', { lo: 0.05, hi: 0.7 }], [rvb, 'decay', { lo: 0.25, hi: 0.95 }]]);
        const outLvl = Sp.input('Output', 0.75, [[lvl, 'level', { lo: -24, hi: 6 }]]);
        const frzSw = Sp.input('Freeze', 0, [[frz, 'on']], { bin: true });
        const frzOut = binOut(Sp, 'Frozen', frzSw.node, 1200, 520);
        const lofiSw = Sp.input('Lo-fi on', 0, [[lofi, 'on']], { bin: true });
        const slcSw = Sp.input('Slicer on', 0, [[slc, 'on']], { bin: true });
        const dotted = Sp.input('Dotted', 0, [[dly, 'subdiv', { lo: 0, hi: 2 }]], { bin: true });
        const wobble = Sp.input('Wobble', 0, [[dly, 'moddepth', { lo: 0, hi: 0.5 }]], { bin: true });
        const dVtype = Sp.input('Verb type', DEEP[9].def, [[rvb, 'mode', { lo: 0, hi: 9 }]]);
        const dVtone = Sp.input('Verb tone', DEEP[10].def, [[rvb, 'tone'], [dly, 'tone']]);
        const dSlice = Sp.input('Pattern', DEEP[11].def, [[slc, 'pattern', { lo: 0, hi: 15 }]]);

        // ---------------------------------------------------------------- the screens
        const deepTo = [dAttack, dQ, dWmode, dAmp, dBass, dTreb, dFb, dShape, dRing, dVtype, dVtone, dSlice];
        const presetsScr = screen(62, 47, 104, 58, 'tft', ACC_PRESETS_SCRIPT, {
          res: 3, label: 'PRESETS',
          sio: {
            ins: [sin('In', fIn), sin('Out', sLvl), sin('Beat', beatOut)],
            outs: [sout('Ring', 0, null), sout('Ring R', 1, null), sout('Ring G', 0.48, null), sout('Ring B', 0.18, null), sout('Slot', 1, null), sout('Recall', 0, null)],
          },
        });
        const A = (o) => ({ scr: presetsScr.id, o });
        const editScr = screen(248, 47, 104, 58, 'tft', ACC_EDIT_SCRIPT, {
          res: 3, label: 'EDIT',
          sio: {
            ins: [sin('Slot', A(4)), sin('Recall', A(5)), sin('Front', fLvl), sin('Drive', dLvl), sin('Mod', mLvl), sin('Space', sLvl), sin('LFO', lfoOut), sin('Beat', beatOut)],
            outs: [...DEEP.map((p, k) => sout(p.name, p.def, deepTo[k])), sout('Page', 0, null), sout('Page R', 0.9, null), sout('Page G', 0.92, null), sout('Page B', 0.95, null)],
          },
        });
        const B = (o) => ({ scr: editScr.id, o });

        // ---------------------------------------------------------------- the panel
        const kk = (x, y, label, t, v, o = {}) => knob(x, y, label, { r: 6, style: 'fluted', value: v, map: knobMap(t), ...o });
        const fader = (x, y, label, t, v, color) => ({ id: uid('v'), kind: 'slider', look: 'led', ledColor: color, x, y, h: 30, w: 5, orient: 'v', value: v, label, labelPos: 'below', map: knobMap(t) });
        const enc = (x, y, label, o = {}) => ({ id: uid('e'), kind: 'knob', part: 'encoder', x, y, r: 5.5, cap: 'knurl', push: false, value: 0, encSteps: 24, label, labelPos: 'below', ...o });
        const ringEnc = (x, y, label, from, rgb, o = {}) => enc(x, y, label, { r: 7, cap: 'rubber', ring: true, ringN: 16, ringMode: 'dot', ringColor: '#38f07a', ringIn: 'one', ringRgb: true, ringFrom: from, ringLeds: rgb, encSteps: 16, ...o });
        const pbtn = (x, y, label, color) => ({ id: uid('b'), kind: 'button', x, y, r: 4.2, shape: 'round', color, led: false, ledColor: '#3fa8ff', on: false, label, labelPos: 'below' });
        const rgbLed = (x, y, label, chans) => led(x, y, '#ffffff', { look: 'rgb', r: 2, bind: 'on', chans, label, labelPos: 'below' });
        const meterBar = (x, y, label, src) => led(x, y, '#3ddc84', { look: 'meter', n: 10, bind: 'src', src, level: 0.7, label, labelPos: 'below' });
        const bar = (x, y, label, color, src) => led(x, y, color, { look: 'bar', w: 58, h: 1.3, bind: 'src', src, label, labelPos: 'above' });
        const dip = (x, y, label, maps, bits, color) => ({ id: uid('d'), kind: 'dip', x, y, n: maps.length, bits, look: 'piano', color, label, labelPos: 'below', maps });
        const dummy = (name) => binMap(Sp.input(name, 0, [], { bin: true }));

        // FX panels: x0 of each, 71 mm wide
        const P0 = [6, 81, 156, 231];
        const py = 112;
        const fxRow = (i) => P0[i];

        // footswitches: three groups along the bottom
        const fsy = 214;
        const fsx = [24, 56, 98, 130, 162, 194, 236, 268, 300].map((x) => x - 2);
        const foot = (k, label, o = {}) => stomp(fsx[k], fsy, { style: 'soft', r: 6.5, label, labelPos: 'below', ...o });
        const feet = [
          foot(0, 'PRESET -', { map: dummy('Preset down') }),
          foot(1, 'PRESET +', { map: dummy('Preset up') }),
          foot(2, 'FRONT', { map: { to: F.inst.id + '.on', min: 0, max: 1, taper: 'lin', invert: false } }),
          foot(3, 'DRIVE', { map: { to: Dc.inst.id + '.on', min: 0, max: 1, taper: 'lin', invert: false } }),
          foot(4, 'MOD', { map: { to: M.inst.id + '.on', min: 0, max: 1, taper: 'lin', invert: false } }),
          foot(5, 'SPACE', { map: { to: Sp.inst.id + '.on', min: 0, max: 1, taper: 'lin', invert: false } }),
          foot(6, 'FREEZE', { map: binMap(frzSw) }),
          foot(7, 'TAP', { map: { to: Sp.inst.id + '.tap' } }),
          foot(8, 'BYPASS', { map: { to: 'bypass' } }),
        ];
        const fled = (k, color, o = {}) => led(fsx[k], fsy - 18, color, { r: 1.8, bind: 'ctl:' + feet[k].id, ...o });

        const d = base({
          name: 'Advanced Command Center',
          desc: 'Four circuits and 22 effects, a preset library and an effects editor on two screens.',
          enc: { size: 'custom', w: W, h: H, shape: 'box', radius: 7, dots: false, mat: { m: 'metal', s: 'aluminium', f: 'anodized', c: '#1d2027' } },
          labels: { font: FONTS[2][0], size: 2.3, color: INK },
          title: txt({ id: 'title', text: 'ADVANCED COMMAND CENTER', font: FONTS[1][0], weight: 700, x: 155, y: 9.5, size: 5, color: INK, ls: 1.8 }),
          sub: txt({ id: 'sub', text: 'FOUR CIRCUITS   22 EFFECTS', font: FONTS[2][0], weight: 800, x: 332, y: 9.5, size: 2.2, color: '#ff7a2f', ls: 0.6, hidden: true }),
          art: [
            // the deck behind the screens and the nav, the FX panels, the footswitch strip, the treadle well
            art('rect', 155, 62, 298, 92, '#121419', { opacity: 0.92 }),
            art('rect', 62, 47, 110, 64, '#050608'), art('rect', 248, 47, 110, 64, '#050608'),
            ...P0.map((x0) => art('rect', x0 + 35.5, py + 33, 71, 66, '#15181e', { opacity: 0.95 })),
            ...P0.map((x0, i) => art('rect', x0 + 35.5, py + 0.6, 71, 1.2, Object.values(SECT)[i], { opacity: 0.85 })),
            art('rect', 155, 211, 298, 58, '#0f1115', { opacity: 0.95 }),
            art('rect', 332, 59, 48, 86, '#121419', { opacity: 0.92 }),
            art('rect', 332, 175, 48, 134, '#0b0c0f'),
            art('rect', 155, 239.4, 298, 1.2, '#ff7a2f', { opacity: 0.8 }),
          ],
          ctls: [
            presetsScr, editScr,
            // nav between the screens
            rgbLed(137, 24, 'SIGNAL', { r: clipOut, g: sLvl }),
            rgbLed(155, 24, 'TEMPO', { r: beatOut, g: beatOut, b: frzOut }),
            rgbLed(173, 24, 'PRESET', { r: A(1), g: A(2), b: A(3) }),
            ringEnc(141.5, 50, 'PRESET', A(0), { r: A(1), g: A(2), b: A(3) }),
            ringEnc(168.5, 50, 'PAGE', B(12), { r: B(13), g: B(14), b: B(15) }, { ringN: 15, ringMode: 'arc', encSteps: 20 }),
            pbtn(141.5, 74, 'STORE', '#3a2a20'), pbtn(168.5, 74, 'RECALL', '#20303a'),
            // level meters under the preset screen, edit encoders under the edit screen
            meterBar(27, 92, 'INPUT', fIn), meterBar(62, 92, 'DRIVE', dLvl), meterBar(97, 92, 'OUTPUT', sLvl),
            enc(209, 93, 'EDIT 1'), enc(235, 93, 'EDIT 2'), enc(261, 93, 'EDIT 3'), enc(287, 93, 'EDIT 4'),
            // the right column: XY pad and the trims
            { id: uid('x'), kind: 'xy', look: 'glow', x: 332, y: 40, w: 36, h: 32, color: '#b45cff', vx: 0.35, vy: 0.5, label: 'MORPH', labelPos: 'above', maps: [knobMap(space), knobMap(sweep)] },
            { id: uid('m'), kind: 'trim', x: 321, y: 74, r: 3, look: 'round', color: '#f2c230', value: 0.25, label: 'GATE', labelPos: 'below', map: knobMap(gThr) },
            { id: uid('m'), kind: 'trim', x: 343, y: 74, r: 3, look: 'round', color: '#f2c230', value: 0.75, label: 'OUTPUT', labelPos: 'below', map: knobMap(outLvl) },
            // FRONT
            bar(fxRow(0) + 35.5, py + 8, 'FRONT', SECT.front, fLvl),
            kk(fxRow(0) + 14, py + 24, 'SUSTAIN', sus, 0.5), kk(fxRow(0) + 36, py + 24, 'BLEND', blend, 0.8),
            fader(fxRow(0) + 58, py + 33, 'OCTAVE', octLvl, 0, SECT.front),
            dip(fxRow(0) + 25, py + 52, 'FRONT OPT', [binMap(gateSw), binMap(compSw), binMap(wahSw), binMap(whamSw)], [1, 1, 0, 0], '#1f6b3a'),
            // DRIVE
            bar(fxRow(1) + 35.5, py + 8, 'DRIVE', SECT.drive, dLvl),
            kk(fxRow(1) + 14, py + 24, 'GAIN', gain, 0.45), kk(fxRow(1) + 36, py + 24, 'TONE', tone, 0.55),
            fader(fxRow(1) + 58, py + 33, 'BOOST', bst, 0.3, SECT.drive),
            toggle(fxRow(1) + 25, py + 51, 3, ['OD', 'DS', 'FZ'], { orient: 'h', label: 'VOICE', labelPos: 'none', map: valsMap(voice, 3) }),
            // MOD
            bar(fxRow(2) + 35.5, py + 8, 'MODULATION', SECT.mod, mLvl),
            kk(fxRow(2) + 14, py + 24, 'RATE', rate, 0.35), kk(fxRow(2) + 36, py + 24, 'DEPTH', depth, 0.55),
            fader(fxRow(2) + 58, py + 33, 'WET', wet, 0.5, SECT.mod),
            { id: uid('r'), kind: 'sel', part: 'steps', look: 'lit', x: fxRow(2) + 25, y: py + 52, n: 5, opts: ['CHO', 'PHA', 'FLG', 'TRM', 'VIB'], pos: 0, ledColor: SECT.mod, label: 'MOD TYPE', labelPos: 'none', map: valsMap(mtype, 5) },
            // SPACE
            bar(fxRow(3) + 35.5, py + 8, 'SPACE', SECT.space, sLvl),
            kk(fxRow(3) + 14, py + 24, 'TIME', time, 0.6), kk(fxRow(3) + 36, py + 24, 'REPEATS', reps, 0.35),
            fader(fxRow(3) + 58, py + 33, 'ECHO', echo, 0.3, SECT.space),
            toggle(fxRow(3) + 13, py + 51, 3, ['DIG', 'TAPE', 'REV'], { orient: 'h', label: 'ECHO TYPE', labelPos: 'none', map: { to: etype.to, values: [0, 0.2, 0.5] } }),
            dip(fxRow(3) + 37, py + 52, 'SPACE OPT', [binMap(lofiSw), binMap(slcSw), binMap(dotted), binMap(wobble)], [0, 0, 0, 0], '#1d3f8a'),
            // footswitches and their LEDs
            ...feet,
            led(fsx[0], fsy - 18, '#ffffff', { look: 'rgb', r: 1.8, bind: 'on', chans: { r: A(1), g: A(2), b: A(3) } }),
            led(fsx[1], fsy - 18, '#ffffff', { look: 'rgb', r: 1.8, bind: 'on', chans: { r: A(1), g: A(2), b: A(3) } }),
            fled(2, SECT.front), fled(3, SECT.drive), fled(4, SECT.mod), fled(5, SECT.space), fled(6, '#9fdcff'),
            led(fsx[7], fsy - 18, '#ff2a1a', { r: 1.8, bind: 'tap:' + Sp.inst.id }), led(fsx[8], fsy - 18, '#ff2a1a', { r: 1.8, bind: 'on' }),
            // the treadle
            { id: uid('p'), kind: 'pedal', x: 332, y: 175, w: 38, h: 124, value: 0.5, color: '#191b20', grip: 'ridges', logo: 'EXP', label: 'TREADLE', labelPos: 'none', map: knobMap(exp) },
          ],
          jacks: [
            jack('in', 'right', 0.1, { label: 'IN' }), jack('out', 'top', 0.11, { label: 'OUT L' }), jack('stereo', 'top', 0.05),
            jack('phones', 'top', 0.955), jack('power', 'top', 0.86),
          ],
        });
        d.files = accFiles();
        const out = finish(d, [F.inst, Dc.inst, M.inst, Sp.inst]);
        return out;
      },
    },
  ];
}
