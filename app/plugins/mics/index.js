// Built-in Tone Zone plugin: Studio Mics.
// Microphone models inspired by well-known dynamic, condenser and ribbon mics, plus a few Tone Zone originals.
// Names and badges are Tone Zone originals; shapes, colours and frequency responses follow the real mics
// (see each model's `ref`). Data in models.js, drawings in draw.js. The mic contract is in docs/mic-blocks.md.
import { MODELS } from './models.js';
import { initDraw, drawMicMM } from './draw.js';

// the drawing kind these models use in the core mic graphics (library thumbnails, mics on cabs)
export const LOOK_KIND = 'studio-mics';

export function micDefs(tz) {
  const { mic } = tz.builders;
  return MODELS.map((m) =>
    mic({
      id: 'smic.' + m.id, name: m.name, brand: m.original ? 'Tone Zone' : m.brand, ref: m.original ? 'Tone Zone original' : m.ref,
      desc: m.desc, color: m.color,
      mic: {
        type: m.type, pattern: m.pattern, resp: m.resp.map((p) => p.slice()), offAxis: m.offAxis, prox: m.prox, sens: m.sens,
        color: m.color, short: shortName(m), look: Object.assign({ kind: LOOK_KIND }, m.look),
      },
    })
  );
}
// short tag shown next to the mic on a cab
const SHORT = {
  e609: 'F69', re20: 'B20', re320: 'B32', sm7b: 'NB7', beta52: 'K52', i5: 'W5', d6: 'K6', pr30: 'F30', m88: 'H88', m201: 'H21',
  d112: 'EGG', md409: 'F49', nd468: 'P68', m80: 'E80', e604: 'C64', pr31: 'F31', u47: '47T', tlm103: '103', km184: 'P84',
  c451: 'P451', c800g: '800', ksm32: 'S32', ela251: '251', at4050: '4050', at2020: '2020', nt1: 'ONE', nt5: 'P5', u47fet: '47S',
  r10: 'B10', c4038: 'L38', rca44: '44', rca77: '77', m130: 'R130', r92: 'P92', ksm313: '313', fathead: 'FAT',
  'tz-hornet': 'HRNT', 'tz-velvet': 'VLVT', 'tz-prism': 'PRSM', 'tz-orb': 'ORB',
};
const shortName = (m) => SHORT[m.id] || m.name.split(/\s+/).pop().slice(0, 5).toUpperCase();

export default function register(tz) {
  if (!tz.builders.mic || !tz.builders.micLook) throw new Error('Studio Mics needs Tone Zone 0.11 or newer (mic blocks)');
  initDraw(tz.gfx);
  tz.builders.micLook(LOOK_KIND, (g, look) => drawMicMM(g, look));
  tz.addDefs(micDefs(tz));
}
