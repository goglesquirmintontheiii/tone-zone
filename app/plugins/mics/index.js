// Built-in Tone Zone plugin: Studio Mics.
// Microphone models inspired by well-known dynamic, condenser and ribbon mics, plus a few Tone Zone originals.
// Names and badges are Tone Zone originals; shapes, colours and frequency responses follow the real mics
// (see each model's `ref`). Data in models.js, drawings in draw.js.
import { MODELS } from './models.js';
import { initDraw, drawMic, fitMic, micSize, drawOnCab } from './draw.js';

const TYPE_NAMES = { dynamic: 'Dynamic mic', condenser: 'Condenser mic', ribbon: 'Ribbon mic' };
const PATTERN_NAMES = { cardioid: 'cardioid', supercardioid: 'supercardioid', hypercardioid: 'hypercardioid', figure8: 'figure 8', omni: 'omni', wide: 'wide cardioid' };
// on-canvas size of a free-standing mic block (mic units to pixels)
const SCALE = 1.3;

export function micDefs(tz) {
  const { def } = tz.helpers;
  return MODELS.map((m) => {
    const mic = {
      type: m.type, pattern: m.pattern, resp: m.resp.map((p) => p.slice()), offAxis: m.offAxis, prox: m.prox, sens: m.sens,
      color: m.color, look: Object.assign({}, m.look),
    };
    // drawing hooks for the core (not enumerable, so they never travel with the data)
    // draw(g, { view: 'side' | 'cab', w, h, len, angle, head }): side view (natural size, or fitted into w x h),
    // or the on-cab view centred on the capsule
    const draw = (g, o = {}) => (o.view === 'cab' ? drawOnCab(g, mic.look, o) : o.w ? fitMic(g, mic.look, o.w, o.h, o) : drawMic(g, mic.look));
    Object.defineProperty(mic, 'draw', { value: draw, enumerable: false });
    Object.defineProperty(mic, 'size', { value: () => micSize(mic.look), enumerable: false });
    const d = def({
      id: 'smic.' + m.id, name: m.name, brand: m.original ? 'Tone Zone' : m.brand, ref: m.original ? 'Tone Zone original' : m.ref,
      cat: 'Mic', form: 'tzmic', baseForm: 'mic', algo: 'none', cost: 0, ports: { ins: [], outs: [] }, controls: [],
      color: m.color, typeName: `${TYPE_NAMES[m.type]}, ${PATTERN_NAMES[m.pattern]}`, desc: m.desc,
      tags: ['mic', 'microphone', m.type, PATTERN_NAMES[m.pattern]], mic,
    });
    return d;
  });
}

export default function register(tz) {
  initDraw(tz.gfx);
  // free-standing mic: the side view at its real relative size
  tz.addForm('tzmic', (ctx, d) => {
    const look = d.mic.look, size = micSize(look);
    const w = Math.round(size.w * SCALE + 8), h = Math.round(size.h * SCALE + 6);
    const g = tz.gfx.svg('g', { transform: `translate(${(w / 2).toFixed(1)},3) scale(${SCALE})` }, ctx.g);
    drawMic(g, look);
    const outs = (d.ports && d.ports.outs) || [];
    const jacks = outs.map((l, i) => ({ key: 'o' + i, dir: 'out', port: i, label: l, side: 'bottom', x: w / 2, y: h + 2, kind: 'xlr' }));
    return { w, h, theme: { text: '#ccc', jackLabels: false }, jacks };
  });
  tz.addDefs(micDefs(tz));
}
