// Pi tab: headless or screen, screen settings, and a live preview of the on-device UI.
import { el, toast } from '../util.js';
import { state, setParam, setBypass, blockById } from '../state.js';
import { SCREENS, savePi, piLog } from './pi-data.js';
import { card, field, seg, select, range, toggle, demoNote } from './pi-ui.js';
import { mountScreen } from './pi-screen.js';
import { loadPresetFile } from './pi-presets.js';

let mirror = false;
let scaleMode = 'fit';

export function renderDisplay(main, ctx) {
  const { store, dev } = ctx;
  const d = store.display;
  const top = el('div', { class: 'pi-sechead' }, main);
  el('div', {}, top, '<h2>Display</h2><p>Run headless with footswitches only, or add a screen for a simple preset and parameter view.</p>');
  const cols = el('div', { class: 'pi-cols pi-cols-display' }, main);
  const left = el('div', { class: 'pi-col' }, cols);
  const right = el('div', { class: 'pi-col' }, cols);

  const c = card(left, 'Screen', null);
  const headless = d.screen === 'none';
  field(c, 'Mode');
  seg(c.lastChild.lastChild, [['headless', 'Headless'], ['screen', 'With a screen']], headless ? 'headless' : 'screen', (v) => {
    d.screen = v === 'headless' ? 'none' : d.lastScreen || 'touch7';
    savePi();
    ctx.rerender();
  }, { 'data-ctl': 'display-mode' });
  if (!headless) {
    field(c, 'Screen');
    select(c.lastChild.lastChild, SCREENS.filter((s) => s.id !== 'none').map((s) => [s.id, `${s.name} (${s.w} x ${s.h})`]), d.screen, (v) => { d.screen = d.lastScreen = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'screen' });
    const sc = SCREENS.find((s) => s.id === d.screen);
    if (sc.pins) el('p', { class: 'pi-muted' }, c).textContent = `Connects over ${sc.bus} and uses GPIO ${sc.pins.join(', ')}. Those pins are marked as taken in Footswitches.`;
    else el('p', { class: 'pi-muted' }, c).textContent = `Connects over ${sc.bus}. No GPIO pins needed.`;
    if (sc.id !== 'oled') {
      field(c, 'Rotation');
      seg(c.lastChild.lastChild, [[0, '0'], [90, '90'], [180, '180'], [270, '270']], d.rotation, (v) => { d.rotation = +v; savePi(); ctx.rerender(); }, { 'data-ctl': 'rotation' });
      field(c, 'Brightness');
      range(c.lastChild.lastChild, 10, 100, d.brightness, (v) => { d.brightness = v; savePi(); const s = main.querySelector('.pis'); if (s) s.style.filter = `brightness(${0.4 + v / 166})`; }, (v) => v + '%');
      field(c, 'Turn off after', 'The screen wakes on touch or any footswitch.');
      select(c.lastChild.lastChild, [[0, 'Never'], [60, '1 minute'], [300, '5 minutes'], [900, '15 minutes']], d.timeout, (v) => { d.timeout = +v; savePi(); });
      field(c, 'Colours');
      seg(c.lastChild.lastChild, [['dark', 'Dark'], ['contrast', 'High contrast'], ['light', 'Light']], d.theme, (v) => { d.theme = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'theme' });
      if (sc.touch) {
        const r = el('div', { class: 'pi-opt' }, c);
        el('div', {}, r, '<b>Touch</b><small>Turn off to only use footswitches (no accidental taps on stage).</small>');
        toggle(r, d.touch, (v) => { d.touch = v; savePi(); });
      }
    }
  }
  const why = card(left, headless ? 'Headless mode' : 'What the screen can do', null);
  const ul = el('ul', { class: 'pi-list' }, why);
  const items = headless
    ? ['Boots straight into the last preset.', 'Footswitches change presets and turn blocks on and off, LEDs show what is on.', 'The status LED blinks: fast = DSP too high, slow = no audio interface, double = pairing code.', 'MIDI in (USB or a MIDI HAT) for program changes and parameters.', 'Everything else from this app over the network.']
    : ['Pick presets and banks, next / previous.', 'Turn blocks on and off and change their parameters with big sliders.', 'Tuner, DSP load and levels.', 'It does not move, add or rewire blocks. That stays in this app, so nothing can break on stage.', 'Drawn with SDL straight to the screen: starts in a second and uses about 20 MB of RAM.'];
  for (const t of items) el('li', {}, ul).textContent = t;

  // preview
  const pc = card(right, headless ? 'Status LED' : 'On-device preview', headless ? 'What the Pi shows without a screen.' : 'Try it: tap blocks, move sliders, switch presets. Uses your current preset.', 'pi-preview-card');
  if (headless) return headlessPreview(pc);
  const sc = SCREENS.find((s) => s.id === d.screen);
  const rot = d.rotation === 90 || d.rotation === 270;
  const w = rot ? sc.h : sc.w, h = rot ? sc.w : sc.h;
  const bar = el('div', { class: 'pi-row pi-prev-bar' }, pc);
  el('span', { class: 'pi-chip' }, bar).textContent = `${w} x ${h} px`;
  seg(bar, [['fit', 'Fit'], ['1', 'Actual pixels']], scaleMode, (v) => { scaleMode = v; ctx.rerender(); });
  const mr = el('label', { class: 'pi-inline' }, bar);
  toggle(mr, mirror, (v) => { mirror = v; }, { 'data-ctl': 'mirror' });
  el('span', {}, mr).textContent = 'Send edits to the board';
  const stage = el('div', { class: 'pi-prev-stage' }, pc);
  const bezel = el('div', { class: 'pi-bezel' + (sc.id === 'oled' ? ' oled' : '') }, stage);
  const holder = el('div', { class: 'pi-prev-holder' }, bezel);
  const banks = dev ? dev.banks : [];
  // start on the board's preset; if it is on the Pi too, show where
  const at = { bank: 0, slot: -1, board: true };
  banks.forEach((b, i) => b.presets.forEach((p, j) => { if (p && at.slot < 0 && (p.file === state.file || p.name === state.preset?.name)) Object.assign(at, { bank: i, slot: j }); }));
  const bankName = () => (at.slot < 0 ? 'Board preset, not on the Pi yet' : banks[at.bank] ? banks[at.bank].name : 'Board');
  const edits = el('div', { class: 'pi-edits' }, pc);
  const scr = mountScreen(holder, {
    w, h, theme: d.theme, preset: state.preset, banks, bankIndex: at.bank, slot: at.slot, bankName: bankName(), cpu: dev ? dev.dsp : 30,
    onLoad: async (bi, si) => {
      const list = [];
      banks.forEach((b, i) => b.presets.forEach((p, j) => p && list.push([i, j, p])));
      if (!list.length) return toast('No presets on this Pi yet');
      let k = list.findIndex((x) => x[0] === bi && x[1] === si);
      if (k < 0) {
        // stepping past the end of a bank: go to the next or previous filled slot
        const cur = list.findIndex((x) => x[0] === at.bank && x[1] === at.slot);
        k = (cur + (si > at.slot || si >= 4 ? 1 : -1) + list.length) % list.length;
      }
      const [b2, s2, p] = list[k];
      const preset = p.file === '__current' ? state.preset : await loadPresetFile(p.file);
      if (!preset) return;
      at.bank = b2; at.slot = s2; at.board = preset === state.preset;
      if (dev) { dev.bank = b2; dev.slot = s2; savePi(); }
      scr.setPreset(preset, { bankIndex: b2, slot: s2, bankName: bankName() });
      piLog(`Screen: loaded ${b2 + 1}${String.fromCharCode(65 + s2)} "${preset.name}"`, 'info', 'ui');
    },
    onEdit: (e) => {
      const line = e.p ? `${e.label || e.p} = ${typeof e.v === 'number' ? e.v.toFixed(2) : e.v}` : e.bypass ? 'turned off' : 'turned on';
      edits.textContent = 'Last edit on the Pi: ' + (at.board ? '' : '(this preset is not on the board) ') + line;
      edits.dataset.edit = e.p || 'bypass';
      if (mirror && at.board && blockById(e.id)) {
        if (e.p) setParam(e.id, e.p, e.v, { silent: true });
        else setBypass(e.id, e.bypass);
      }
    },
  });
  scr.root.style.filter = `brightness(${0.4 + d.brightness / 166})`;
  const fit = () => {
    const avail = stage.clientWidth - 40 - 28 - 4; // stage and bezel padding
    const s = scaleMode === '1' ? 1 : Math.min(1.6, avail / w, 560 / h);
    holder.style.width = w * s + 'px';
    holder.style.height = h * s + 'px';
    scr.root.style.transform = `scale(${s})`;
  };
  requestAnimationFrame(fit);
  const ro = new ResizeObserver(() => (stage.isConnected ? fit() : ro.disconnect()));
  ro.observe(stage);
  edits.textContent = 'Edits stay in the preview unless "Send edits to the board" is on.';
  demoNote(pc, 'This is a mock of the planned screen UI. The real one runs on the Pi.');
}

function headlessPreview(pc) {
  const row = el('div', { class: 'pi-leds' }, pc);
  for (const [cls, t, d] of [['steady', 'Steady', 'Running, all good'], ['fast', 'Fast blink', 'DSP over budget, a lighter preset is needed'], ['slow', 'Slow blink', 'No audio interface found'], ['double', 'Double blink', 'Showing the pairing code'], ['off', 'Off', 'Engine stopped']])
    el('div', { class: 'pi-led-row' }, row, `<i class="pi-led ${cls}"></i><b>${t}</b><span>${d}</span>`);
  demoNote(pc, 'Pick "With a screen" to see the on-device UI preview.');
}
