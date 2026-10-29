// Catalog helpers. A block definition gives the DSP algorithm and voicing, the enclosure and colours,
// and the controls (knobs, switches, footswitches, LEDs, screens) mapped to engine params.

// knob: p = engine param, min/max = engine range mapped over the knob sweep
export const K = (p, label, o = {}) => Object.assign({ t: 'knob', p, label, min: 0, max: 1, def: 0.5 }, o);
// rotary selector (detented)
export const SEL = (p, label, options, o = {}) => Object.assign({ t: 'sel', p, label, options, def: 0 }, o);
// mini toggle
export const TOG = (p, label, options, o = {}) => Object.assign({ t: 'toggle', p, label, options, def: 0 }, o);
// push button (latching param or action)
export const BTN = (label, o = {}) => Object.assign({ t: 'button', label }, o);
export const FOOT = (o = {}) => Object.assign({ t: 'foot', action: 'bypass' }, o);
export const LED = (o = {}) => Object.assign({ t: 'led', bind: 'on' }, o);
export const SLIDER = (p, label, o = {}) => Object.assign({ t: 'slider', p, label, min: 0, max: 1, def: 0.5 }, o);
export const SCREEN = (kind, o = {}) => Object.assign({ t: 'screen', kind }, o);
export const TREADLE = (p, o = {}) => Object.assign({ t: 'treadle', p, def: 0.5, min: 0, max: 1 }, o);
export const MIC = (o = {}) => Object.assign({ t: 'mic' }, o);

// 0..10 scale display for classic knobs
export const ten = (v, c) => (((v - c.min) / (c.max - c.min)) * 10).toFixed(1);
export const pct = (v, c) => Math.round(((v - c.min) / (c.max - c.min)) * 100) + '%';
export const db = (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
export const ms = (v) => (v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v) + ' ms');

export const MONO = { ins: ['INPUT'], outs: ['OUTPUT'] };
export const STEREO = { ins: ['INPUT A (MONO)', 'INPUT B'], outs: ['OUTPUT A (MONO)', 'OUTPUT B'] };
export const MONO_TO_ST = { ins: ['INPUT'], outs: ['OUTPUT A (MONO)', 'OUTPUT B'] };

// standard bypass footswitch and LED for single-switch pedals
export const STD = (ledColor = '#ff2a1a') => [FOOT(), LED({ color: ledColor })];

export function def(o) {
  // normalise a definition
  const d = Object.assign(
    {
      cat: 'Drive',
      form: 'tz',
      color: '#555',
      algo: 'drive',
      opts: {},
      fixed: {},
      ports: MONO,
      stereo: 'mono', // 'mono' | 'both' | 'stereo' (default stereo, can switch)
      cost: 0.5,
      controls: [],
    },
    o
  );
  d.code = d.code || d.name;
  return d;
}
