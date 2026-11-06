// Block builders shared by the core catalog and plugins (plugins get them as `tz.builders`).
import { defaultMicXY, micToSpeaker } from '../gfx/cabgeom.js';
import { K, FOOT, LED, MIC, def, ten, STD, STEREO } from './helpers.js';
import { MAX_MICS, LEGACY_MODELS, cabPorts, cabPortKeys, remapCabCables, cabEngineOpts } from './cabmics.js';

// ---- compact pedals
export const compact = (o) => def(Object.assign({ form: 'compact' }, o, { controls: [...(o.controls || []), ...(o.noStd ? [] : STD(o.led))] }));
export const BOSS = (o) => compact(Object.assign({ brand: 'BOSS' }, o));
export const nine = (o) => def(Object.assign({ form: 'nine' }, o, { controls: [...(o.controls || []), ...(o.noStd ? [] : STD(o.led))] }));
export const NINE = (o) => nine(Object.assign({ brand: 'Ibanez' }, o));
export const mxr = (o) => def(Object.assign({ form: 'mxr' }, o, { controls: [...(o.controls || []), ...(o.noStd ? [] : STD(o.led || '#3d8bff'))] }));
export const MXRD = (o) => mxr(Object.assign({ brand: 'MXR' }, o));
// generic stomp in the "tz" enclosure (works for any brand, colours, logo and knobs come from the def)
export const stomp = (o) => def(Object.assign({ form: 'tz' }, o, { controls: [...(o.controls || []), ...(o.noStd ? [] : STD(o.led))] }));
export const lvl = (label = 'LEVEL') => K('level', label, { display: ten });
export const tone = (label = 'TONE') => K('tone', label, { display: ten });
export const gain = (label) => K('gain', label, { display: ten });

// ---- Strymon-style medium / small enclosures
export const S = (o) => def(Object.assign({ form: 'strymon', brand: 'Strymon', stereo: 'stereo', ports: STEREO, cost: 1.2 }, o));
export const onFoot = (o = {}) => FOOT(Object.assign({ action: 'bypass', label: 'ON' }, o));
export const onLed = () => LED({ bind: 'on' });

// ---- amps / preamps
export const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));
export const AMP = (o) =>
  def(Object.assign({ form: 'amp', cat: 'Amp', algo: 'amp', cost: 2.5, ports: { ins: ['INPUT'], outs: ['SPEAKER OUT'] } }, o, {
    controls: [...o.controls, LED({ color: '#ff3020', r: 4.5 }), FOOT({ action: 'bypass' })],
  }));
export const marshallKnobs = (gainLabel = 'PRE-AMP', masterLabel = 'MASTER') => [k('presence', 'PRESENCE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', masterLabel), k('gain', gainLabel)];
export const fenderKnobs = (mid = true) => [k('gain', 'VOLUME', { scale: 10, style: 'fender' }), k('treble', 'TREBLE', { scale: 10, style: 'fender' }), ...(mid ? [k('mid', 'MIDDLE', { scale: 10, style: 'fender' })] : []), k('bass', 'BASS', { scale: 10, style: 'fender' }), k('master', 'POWER', { scale: 10, style: 'fender', def: 0.6 })];
// preamp-only rack version of an amp (no power amp or output transformer)
export function preampOf(a) {
  return def({
    id: a.id.replace(/^amp\./, 'pre.').replace(/^([^.]+)\.amp-/, '$1.pre-'), name: a.name + ' Pre', ref: a.ref + ' (preamp)', brand: a.brand, cat: 'Preamp', form: 'rack', algo: 'amp', cost: 1.6,
    opts: Object.assign({}, a.opts, { preamp: true }), color: a.panel === '#151515' || a.panel === '#141414' ? '#1a1b1e' : '#26282c',
    logo: (a.logo || a.name).toUpperCase().slice(0, 14), typeName: a.bass || a.cat === 'Bass Amp' ? 'Bass tube preamp' : 'Tube preamp', ports: { ins: ['INPUT'], outs: ['PREAMP OUT'] },
    controls: [...a.controls.filter((c) => c.t === 'knob' && c.p !== 'master' && c.p !== 'presence' && c.p !== 'depth').map((c) => Object.assign({}, c, { style: undefined, scale: undefined, x: undefined, y: undefined })), K('level', 'OUTPUT', { min: -30, max: 12, def: 0 }), LED({ color: '#3ddc84' }), FOOT()],
  });
}
export const preampPair = (a) => [a, preampOf(a)];

// ---- speaker cabinets: up to 8 mics (mic blocks dropped on the cab), any speaker, one output jack per mic
export const CAB = (o) => {
  const d = def(Object.assign({ form: 'cab', cat: o.bass ? 'Bass Cab' : 'Cab', algo: 'cab', cost: 0.9, stereo: 'both', ports: { ins: ['INPUT'], outs: ['MIC 1 57'] } }, o, {
    controls: [...Array(MAX_MICS)].map((_, k) => MIC({ idx: k + 1 })),
  }));
  const size = d.cabSize || '4x12';
  const m1 = defaultMicXY(size, 1);
  d.initParams = Object.assign({ m1on: 1, m1model: LEGACY_MODELS[d.opts.mic ?? 0] || LEGACY_MODELS[0], m1dist: 0.15, _m1x: m1.x, _m1y: m1.y }, d.initParams || {});
  // a def that still names an old mic type gets the matching model
  for (let i = 1; i <= MAX_MICS; i++) if (o.initParams && o.initParams[`m${i}type`] !== undefined && !o.initParams[`m${i}model`]) d.initParams[`m${i}model`] = LEGACY_MODELS[o.initParams[`m${i}type`] | 0];
  d.cabMics = true;
  d.derive = (ui) => {
    const out = {};
    for (let i = 1; i <= MAX_MICS; i++) {
      if (ui[`_m${i}x`] === undefined) continue;
      const s = micToSpeaker(size, ui[`_m${i}x`], ui[`_m${i}y`]);
      out[`m${i}pos`] = s.pos;
      out[`m${i}spk`] = s.spk;
    }
    return out;
  };
  // jacks follow the mics on the cab (state.js nodePorts / buildGraph / setVariant ask for these)
  d.portsOf = (b, variant) => cabPorts(b, d, variant);
  d.portKeys = (b) => cabPortKeys(b, d);
  d.remapPorts = (cables, b, before) => remapCabCables(cables, b.id, before, cabPortKeys(b, d));
  d.engineOpts = (b, base) => cabEngineOpts(b, d, base);
  return d;
};

// ---- microphone models (cat 'Mic'): they live on a cab, never on the board. docs/mic-blocks.md has the contract.
const MIC_TYPE_NAMES = { dynamic: 'Dynamic mic', condenser: 'Condenser mic', ribbon: 'Ribbon mic' };
export const mic = (o) => {
  const d = def(Object.assign({ cat: 'Mic', form: 'mic', cost: 0, stereo: 'mono', ports: { ins: [], outs: [] }, controls: [] }, o, { algo: null }));
  d.mic = Object.assign({ type: 'dynamic', pattern: 'cardioid', resp: [], offAxis: -6, prox: 6, sens: 0, color: '#3a3d42', look: {} }, o.mic || {});
  // the list adds "Inspired by", so the ref is just the real mic's name
  if (d.ref) d.ref = String(d.ref).replace(/^inspired by (the )?/i, '');
  d.typeName = d.typeName || MIC_TYPE_NAMES[d.mic.type] || 'Microphone';
  d.color = d.color || d.mic.color;
  d.tags = [...(d.tags || []), 'mic', 'microphone', d.mic.type, d.mic.pattern];
  return d;
};
// a custom drawing for a mic look kind: fn(g, look, mic, def) draws the mic in millimetres, see docs/mic-blocks.md
export { registerMicLook as micLook } from '../gfx/forms-mic.js';

// ---- Tone Zone originals / utilities
export const TZ = (o) => def(Object.assign({ form: 'tz', brand: 'Tone Zone', ref: 'Tone Zone original' }, o, { controls: [...(o.controls || []), ...(o.noStd ? [] : STD(o.led))] }));
export const UT = (o) => def(Object.assign({ form: 'util', brand: 'Tone Zone', ref: 'Utility', cat: 'Utility', cost: 0.05 }, o, { controls: [...(o.controls || []), ...(o.noFoot ? [] : [FOOT(), LED({ color: '#3ddc84' })])] }));
