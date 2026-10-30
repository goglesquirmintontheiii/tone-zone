// Pi tab: footswitches, LEDs and expression inputs on the 40 pin header.
import { el, toast, svg } from '../util.js';
import { state } from '../state.js';
import { getDef } from '../catalog/index.js';
import { HEADER, FOOT_ACTIONS, LED_SHOWS, SCREENS, audioDevice, savePi, piLog, chainOrder } from './pi-data.js';
import { card, field, seg, select, range, toggle, demoNote } from './pi-ui.js';

let selPin = 11;

// GPIO numbers taken by the chosen audio device, screen and ADC
export function reservedPins(store) {
  const res = new Map();
  const add = (pins, why) => (pins || []).forEach((g) => !res.has(g) && res.set(g, why));
  const a = store.audio;
  for (const id of new Set([a.input, a.output])) { const d = audioDevice(id); if (d && d.pins) add(d.pins, d.name); }
  const sc = SCREENS.find((x) => x.id === store.display.screen);
  if (sc && sc.pins) add(sc.pins, sc.name);
  if (store.gpio.adc === 'ads1115') add([2, 3], 'ADS1115 (I2C)');
  if (store.gpio.adc === 'mcp3008') add([8, 9, 10, 11], 'MCP3008 (SPI)');
  add([0, 1], 'HAT ID EEPROM');
  return res;
}
const nearestGnd = (pin) => {
  const g = Object.keys(HEADER).map(Number).filter((k) => HEADER[k][2] === 'gnd');
  return g.sort((a, b) => Math.abs(a - pin) - Math.abs(b - pin))[0];
};

export function renderGpio(main, ctx) {
  const { store } = ctx;
  const g = store.gpio;
  const top = el('div', { class: 'pi-sechead' }, main);
  el('div', {}, top, '<h2>Footswitches and GPIO</h2><p>Click a pin on the header to use it for a footswitch or an LED.</p>');
  const res = reservedPins(store);

  const hc = card(main, null, null, 'pi-header-card');
  drawHeader(hc, store, res, (p) => { selPin = p; ctx.rerender(); });
  const legend = el('div', { class: 'pi-legend' }, hc);
  for (const [k, t] of [['foot', 'Footswitch'], ['led', 'LED'], ['gpio', 'Free GPIO'], ['res', 'Used by HAT / screen / ADC'], ['p3', '3.3 V'], ['p5', '5 V'], ['gnd', 'Ground']])
    el('span', {}, legend, `<i class="pin-${k}"></i>${t}`);

  const cols = el('div', { class: 'pi-cols' }, main);
  const left = el('div', { class: 'pi-col' }, cols);
  const right = el('div', { class: 'pi-col' }, cols);
  pinEditor(left, ctx, res);

  // assignments overview
  const lc = card(right, 'Assigned pins', null);
  const t = el('table', { class: 'pi-table' }, lc);
  t.innerHTML = '<thead><tr><th>Pin</th><th>GPIO</th><th>Use</th><th>Does</th></tr></thead>';
  const tb = el('tbody', {}, t);
  const name = (list, v) => (list.find((x) => x[0] === v) || [, v])[1];
  for (const pin of Object.keys(g.pins).map(Number).sort((a, b) => a - b)) {
    const a = g.pins[pin];
    const tr = el('tr', { class: pin === selPin ? 'sel' : '', 'data-pinrow': pin }, tb);
    tr.onclick = () => { selPin = pin; ctx.rerender(); };
    el('td', { class: 'num' }, tr).textContent = pin;
    el('td', { class: 'num' }, tr).textContent = HEADER[pin][1];
    el('td', {}, tr).textContent = a.name;
    el('td', { class: 'pi-muted' }, tr).textContent = a.type === 'foot' ? name(FOOT_ACTIONS, a.press) + (a.mode === 'momentary' && a.hold !== 'none' ? ', hold: ' + name(FOOT_ACTIONS, a.hold) : '') : 'Lights for: ' + name(LED_SHOWS, a.show);
  }
  const bw = el('div', { class: 'pi-opt' }, lc);
  el('div', {}, bw, '<b>Bank change waits for a preset</b><small>Bank up / down only picks the bank. The sound changes when you press A to D (like most floor units).</small>');
  toggle(bw, g.bankWaits, (v) => { g.bankWaits = v; savePi(); });

  // analog
  const ac = card(right, 'Expression pedals', 'The Pi has no analog inputs, so expression pedals go through a small ADC board.');
  field(ac, 'ADC board');
  const fc = ac.lastChild.lastChild;
  select(fc, [['none', 'None'], ['ads1115', 'ADS1115 (I2C, 4 inputs, recommended)'], ['mcp3008', 'MCP3008 (SPI, 8 inputs)']], g.adc, (v) => { g.adc = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'adc' });
  if (g.adc !== 'none') {
    for (const ex of g.expr) {
      const r = el('div', { class: 'pi-expr' }, ac);
      el('b', {}, r).textContent = `${ex.name} (input ${ex.ch})`;
      el('span', { class: 'pi-muted' }, r).textContent = 'Controls: ' + ex.target;
      const bar = el('div', { class: 'pi-meter ok' }, r, '<i></i>');
      bar.firstChild.style.marginLeft = ex.heel + '%';
      bar.firstChild.style.width = ex.toe - ex.heel + '%';
      const cal = el('button', { class: 'btn small' }, r, 'Calibrate');
      cal.onclick = () => { cal.textContent = 'Rock heel to toe...'; setTimeout(() => { cal.textContent = 'Calibrate'; piLog(`${ex.name}: calibrated heel ${ex.heel}%, toe ${ex.toe}%`, 'info', 'gpio'); toast('Calibrated (demo)'); }, 1500); };
    }
    el('p', { class: 'pi-muted' }, ac).textContent = 'Wire a TRS jack: tip to 3.3 V, ring to the ADC input, sleeve to ground. External TRS footswitches can go to two free GPIO pins instead.';
  }
  demoNote(main, 'Pin changes are saved here only. A paired Pi will get them through libgpiod with no reboot.');
}

function drawHeader(parent, store, res, onPick) {
  const W = 20 * 34 + 60, H = 120;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pi-header' }, parent);
  svg('rect', { x: 4, y: 4, width: W - 8, height: H - 8, rx: 10, class: 'pi-pcb' }, s);
  svg('text', { x: 18, y: 62, class: 'pi-hlabel' }, s, 'PIN 1');
  for (let i = 0; i < 20; i++) {
    for (const row of [0, 1]) {
      const pin = i * 2 + (row ? 1 : 2); // top row even, bottom row odd
      const x = 56 + i * 34, y = row ? 76 : 30;
      const [label, bcm, kind] = HEADER[pin];
      const a = bcm != null ? store.gpio.pins[pin] : null;
      const cls = a ? 'pin-' + a.type : bcm != null && res.has(bcm) ? 'pin-res' : 'pin-' + kind;
      const gEl = svg('g', { class: 'pi-pin ' + cls + (pin === selPin ? ' sel' : ''), 'data-pin': pin, transform: `translate(${x},${y})` }, s);
      svg('rect', { x: -13, y: -13, width: 26, height: 26, rx: 5, class: 'pi-pinbg' }, gEl);
      svg('circle', { r: 7, class: 'pi-pinhole' }, gEl);
      svg('text', { y: row ? 27 : -17, class: 'pi-pintxt' }, gEl, a ? a.name : bcm != null ? String(bcm) : label);
      svg('title', {}, gEl, `Pin ${pin}: ${label}${HEADER[pin][3] ? ' (' + HEADER[pin][3] + ')' : ''}${bcm != null && res.has(bcm) ? ', used by ' + res.get(bcm) : ''}`);
      if (bcm != null) gEl.addEventListener('click', () => onPick(pin));
    }
  }
}

function pinEditor(parent, ctx, res) {
  const { store } = ctx;
  const g = store.gpio;
  const info = HEADER[selPin];
  const c = card(parent, `Pin ${selPin}` + (info[1] != null ? ` (GPIO ${info[1]})` : ''), info[3] ? 'Also: ' + info[3] : 'General purpose pin', 'pi-pinedit');
  c.dataset.pin = selPin;
  if (info[1] == null) return el('p', { class: 'pi-muted' }, c).textContent = 'Power or ground pin. Use ground pins for the other side of footswitches and LEDs.';
  if (res.has(info[1]) && !g.pins[selPin]) {
    el('p', { class: 'pi-warn' }, c).textContent = `Used by ${res.get(info[1])}. Pick another pin.`;
    return;
  }
  const a = g.pins[selPin];
  field(c, 'Use for');
  seg(c.lastChild.lastChild, [['none', 'Nothing'], ['foot', 'Footswitch'], ['led', 'LED']], a ? a.type : 'none', (v) => {
    if (v === 'none') delete g.pins[selPin];
    else if (v === 'foot') g.pins[selPin] = { type: 'foot', name: 'FS ' + (countType(g, 'foot') + 1), mode: 'momentary', debounce: 20, press: 'preset+', hold: 'none' };
    else g.pins[selPin] = { type: 'led', name: 'LED ' + (countType(g, 'led') + 1), show: 'status', bright: 80 };
    piLog(`Pin ${selPin} (GPIO ${info[1]}): ${v === 'none' ? 'cleared' : 'set as ' + (v === 'foot' ? 'footswitch' : 'LED')}`, 'info', 'gpio');
    savePi();
    ctx.rerender();
  }, { 'data-ctl': 'pin-type' });
  if (!a) return el('p', { class: 'pi-muted' }, c).textContent = 'Not used.';
  field(c, 'Name');
  const nm = el('input', { type: 'text', value: a.name, maxlength: 10 }, c.lastChild.lastChild);
  nm.onchange = () => { a.name = nm.value.trim() || a.name; savePi(); ctx.rerender(); };
  if (a.type === 'foot') {
    field(c, 'Switch type', 'Soft touch switches are momentary. Clicky 3PDT switches are latching.');
    seg(c.lastChild.lastChild, [['momentary', 'Momentary'], ['latching', 'Latching']], a.mode, (v) => { a.mode = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'mode' });
    field(c, 'Debounce', 'Ignores contact bounce. Raise it if one press counts twice.');
    range(c.lastChild.lastChild, 5, 80, a.debounce, (v) => { a.debounce = v; savePi(); }, (v) => v + ' ms');
    field(c, a.mode === 'latching' ? 'Each click' : 'Press');
    select(c.lastChild.lastChild, FOOT_ACTIONS, a.press, (v) => { a.press = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'press' });
    if (a.press === 'block') blockPick(c, a, 'pressBlock');
    if (a.mode === 'momentary') {
      field(c, 'Hold (600 ms)');
      select(c.lastChild.lastChild, FOOT_ACTIONS, a.hold, (v) => { a.hold = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'hold' });
      if (a.hold === 'block') blockPick(c, a, 'holdBlock');
    }
  } else {
    field(c, 'Lights up for');
    select(c.lastChild.lastChild, LED_SHOWS, a.show, (v) => { a.show = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'show' });
    field(c, 'Brightness', info[1] === 12 || info[1] === 13 ? 'Hardware PWM pin' : 'Software PWM');
    range(c.lastChild.lastChild, 5, 100, a.bright, (v) => { a.bright = v; savePi(); }, (v) => v + '%');
  }
  const wire = el('div', { class: 'pi-wire' }, c);
  wire.innerHTML = a.type === 'foot'
    ? `Wire the switch between <b>pin ${selPin}</b> and a ground pin (nearest: <b>pin ${nearestGnd(selPin)}</b>). No resistor needed, the pull-up inside the Pi is used.`
    : `Wire <b>pin ${selPin}</b> to the LED's long leg through a 330 ohm resistor, short leg to ground (<b>pin ${nearestGnd(selPin)}</b>).`;
  const tb = el('button', { class: 'btn small', 'data-act': 'test-pin' }, c, a.type === 'foot' ? 'Test press' : 'Test blink');
  tb.onclick = () => {
    const pinEl = document.querySelector(`.pi-pin[data-pin="${selPin}"]`);
    pinEl && pinEl.classList.add('flash');
    setTimeout(() => pinEl && pinEl.classList.remove('flash'), 500);
    const what = a.type === 'foot' ? (FOOT_ACTIONS.find((x) => x[0] === a.press) || [])[1] : 'blink';
    piLog(`${a.name} on GPIO ${info[1]}: test ${a.type === 'foot' ? 'press, action "' + what + '"' : 'blink'}`, 'info', 'gpio');
  };
}
const countType = (g, t) => Object.values(g.pins).filter((x) => x.type === t).length;

function blockPick(c, a, key) {
  const blocks = chainOrder(state.preset).filter((b) => { const d = getDef(b.type); return d && d.algo; });
  field(c, 'Block', 'Matched by name in each preset');
  select(c.lastChild.lastChild, [['', 'Pick a block'], ...blocks.map((b) => [getDef(b.type).name, getDef(b.type).name])], a[key] || '', (v) => { a[key] = v; savePi(); });
}
