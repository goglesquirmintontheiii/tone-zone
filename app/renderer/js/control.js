// Control cables: expression pedals / footswitches (and plugin devices) drive other blocks through
// TRS "ctrl" jacks. A block declares
//   ctrl: { outs: [{ label, source: 'param:pos' | 'foot' }], ins: [{ label, param, min, max } | { label, action: 'bypass'|'tap'|'event', event } | { label, hook: true }] }
import { state, uiParams, setParam, setBypass, blockById } from './state.js';
import { getDef } from './catalog/index.js';
import { bus } from './util.js';
import { hooksFor } from './plugins.js';

const footState = new Map(); // `${blockId}:${idx}` -> latched on/off

function targetsOf(blockId, outIdx) {
  const key = 'c' + outIdx;
  return state.preset.cables.filter((c) => c.from.node === blockId && c.from.port === key).map((c) => ({ block: blockById(c.to.node), idx: parseInt(String(c.to.port).slice(1), 10) }));
}

// deliver a control value (0..1) or a press (down=true/false) to whatever is plugged into a block's ctrl output
export function sendCtrl(sourceBlock, outIdx, value, kind = 'cont') {
  for (const t of targetsOf(sourceBlock.id, outIdx)) {
    if (!t.block) continue;
    const d = getDef(t.block.type);
    const inp = d?.ctrl?.ins?.[t.idx];
    if (!inp) continue;
    const hooks = hooksFor(t.block.type);
    if (inp.hook && hooks && hooks.ctrl) { hooks.ctrl(t.block, t.idx, value, kind, inp); continue; }
    if (inp.param) {
      const v = (inp.min ?? 0) + ((inp.max ?? 1) - (inp.min ?? 0)) * (inp.invert ? 1 - value : value);
      setParam(t.block.id, inp.param, inp.curve === 'log' && inp.min > 0 ? inp.min * Math.pow(inp.max / inp.min, value) : v);
    } else if (inp.action === 'bypass' && kind === 'press' && value > 0.5) setBypass(t.block.id, !t.block.bypass);
    else if (inp.action === 'tap' && kind === 'press' && value > 0.5) window.tz.engine.send({ cmd: 'event', id: t.block.id, type: inp.event?.type ?? 1, value: 0, arg: 0 });
    else if (inp.action === 'event' && kind === 'press') {
      const ev = value > 0.5 ? inp.event : inp.release;
      if (ev) window.tz.engine.send({ cmd: 'event', id: t.block.id, type: ev.type, value: ev.value ?? 0, arg: ev.arg ?? 0 });
    }
  }
}

// a footswitch on a control-source block (TZ Footswitch, external switches ...)
export function footCtrl(block, idx, down) {
  const d = getDef(block.type);
  const o = d?.ctrl?.outs?.[idx];
  if (!o) return;
  const k = block.id + ':' + idx;
  const latching = (uiParams(block)[`mode${idx + 1}`] ?? (o.latching ? 1 : 0)) > 0.5;
  if (latching) {
    if (!down) return;
    const on = !footState.get(k);
    footState.set(k, on);
    setParam(block.id, `sw${idx + 1}`, on ? 1 : 0);
    sendCtrl(block, idx, 1, 'press');
    sendCtrl(block, idx, on ? 1 : 0, 'latch');
  } else {
    setParam(block.id, `sw${idx + 1}`, down ? 1 : 0);
    sendCtrl(block, idx, down ? 1 : 0, 'press');
  }
}

// continuous sources: a param change on a block whose ctrl output is bound to that param
bus.on('param', ({ id, p, v }) => {
  const b = blockById(id);
  if (!b) return;
  const d = getDef(b.type);
  if (!d?.ctrl?.outs) return;
  d.ctrl.outs.forEach((o, i) => {
    if (o.source === 'param:' + p) {
      const c = d.controls.find((x) => x.p === p);
      const min = c?.min ?? 0, max = c?.max ?? 1;
      sendCtrl(b, i, ((v ?? uiParams(b)[p]) - min) / (max - min || 1), 'cont');
    }
  });
});
