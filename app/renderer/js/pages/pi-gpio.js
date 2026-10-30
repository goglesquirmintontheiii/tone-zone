// Pi tab: footswitches, LEDs and expression inputs on the 40 pin header.
import { el, toast, svg } from '../util.js';
import { state } from '../state.js';
import { getDef } from '../catalog/index.js';
import { HEADER, FOOT_ACTIONS, LED_SHOWS, SCREENS, MODELS, HW_PWM, pwmChannel, audioDevice, savePi, piLog, chainOrder, act } from './pi-data.js';
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
  el('span', {}, legend, '<i class="pin-pwmkey"></i>Hardware PWM');

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
    el('td', { class: 'pi-muted' }, tr).textContent = a.type === 'foot' ? name(FOOT_ACTIONS, a.press) + (a.mode === 'momentary' && a.hold !== 'none' ? ', hold: ' + name(FOOT_ACTIONS, a.hold) : '') : 'Lights for: ' + name(LED_SHOWS, a.show) + (a.drive === 'pwm' ? `, ${pwmInfo(store, ctx.dev, pin).hw ? 'hardware' : 'software'} PWM ${a.bright}%` : ', on / off');
  }
  const bw = el('div', { class: 'pi-opt' }, lc);
  el('div', {}, bw, '<b>Bank change waits for a preset</b><small>Bank up / down only picks the bank. The sound changes when you press A to D (like most floor units).</small>');
  toggle(bw, g.bankWaits, (v) => { g.bankWaits = v; savePi(); });
  pwmCard(right, ctx);

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
      cal.onclick = async () => {
        cal.textContent = 'Rock heel to toe...';
        const p = ctx.dev && act('calibrate', { id: ctx.dev.id, ch: ex.ch });
        if (p) {
          try { const r = await p; ex.heel = r.heel; ex.toe = r.toe; savePi(); toast('Calibrated'); } catch { /* shown by act */ }
          cal.textContent = 'Calibrate';
          piLog(`${ex.name}: calibrated heel ${ex.heel}%, toe ${ex.toe}%`, 'info', 'gpio');
          return ctx.rerender();
        }
        setTimeout(() => { cal.textContent = 'Calibrate'; piLog(`${ex.name}: calibrated heel ${ex.heel}%, toe ${ex.toe}%`, 'info', 'gpio'); toast('Calibrated (demo)'); }, 1500);
      };
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
      if (bcm in HW_PWM) svg('circle', { cx: 9, cy: -9, r: 3.2, class: 'pi-pwm-dot' }, gEl);
      svg('text', { y: row ? 27 : -17, class: 'pi-pintxt' }, gEl, a ? a.name : bcm != null ? String(bcm) : label);
      svg('title', {}, gEl, `Pin ${pin}: ${label}${HEADER[pin][3] ? ' (' + HEADER[pin][3] + ')' : ''}${bcm in HW_PWM ? ', hardware PWM' : ''}${bcm != null && res.has(bcm) ? ', used by ' + res.get(bcm) : ''}`);
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
    else g.pins[selPin] = { type: 'led', name: 'LED ' + (countType(g, 'led') + 1), show: 'status', drive: 'pwm', bright: 80, dim: 0 };
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
  } else ledEditor(c, ctx, a, info[1]);
  const wire = el('div', { class: 'pi-wire' }, c);
  wire.innerHTML = a.type === 'foot'
    ? `Wire the switch between <b>pin ${selPin}</b> and a ground pin (nearest: <b>pin ${nearestGnd(selPin)}</b>). No resistor needed, the pull-up inside the Pi is used.`
    : `Wire <b>pin ${selPin}</b> to the LED's long leg through a 330 ohm resistor, short leg to ground (<b>pin ${nearestGnd(selPin)}</b>). A pin gives at most about 16 mA, plenty for one LED.`;
  const tb = el('button', { class: 'btn small', 'data-act': 'test-pin' }, c, a.type === 'foot' ? 'Test press' : a.drive === 'pwm' ? 'Test fade' : 'Test blink');
  tb.onclick = () => {
    const pinEl = document.querySelector(`.pi-pin[data-pin="${selPin}"]`);
    pinEl && pinEl.classList.add('flash');
    setTimeout(() => pinEl && pinEl.classList.remove('flash'), 500);
    const what = a.type === 'foot' ? (FOOT_ACTIONS.find((x) => x[0] === a.press) || [])[1] : 'blink';
    piLog(`${a.name} on GPIO ${info[1]}: test ${a.type === 'foot' ? 'press, action "' + what + '"' : a.drive === 'pwm' ? 'fade' : 'blink'}`, 'info', 'gpio');
    if (ctx.dev) act('testPin', { id: ctx.dev.id, pin: selPin, kind: a.type })?.catch(() => {});
  };
}
const countType = (g, t) => Object.values(g.pins).filter((x) => x.type === t).length;

// how an LED on this pin is dimmed: hardware PWM if the pin has a free channel, software PWM otherwise
export function pwmInfo(store, dev, pin) {
  const model = dev ? dev.model : 'pi5';
  const bcm = HEADER[pin][1];
  const out = { hw: false, channel: null, why: '' };
  if (!(bcm in HW_PWM)) { out.why = 'Software PWM. Works on any pin and uses a tiny bit of CPU. For the smoothest dimming use GPIO 12, 13, 18 or 19.'; return out; }
  const ch = pwmChannel(bcm, model);
  if (model !== 'pi5' && (store.audio.output === 'jack35' || store.audio.input === 'jack35')) {
    out.why = `GPIO ${bcm} has hardware PWM, but the 3.5 mm jack uses both PWM channels on a ${MODELS[model].short}. This LED uses software PWM while the jack is the output.`;
    return out;
  }
  if (model !== 'pi5') {
    // 12 and 18 share channel 0, 13 and 19 channel 1: the lower pin number gets it
    const mate = Object.keys(store.gpio.pins).map(Number).find((p) => p !== pin && HEADER[p][1] in HW_PWM && pwmChannel(HEADER[p][1], model) === ch && store.gpio.pins[p].type === 'led' && store.gpio.pins[p].drive === 'pwm');
    if (mate && mate < pin) {
      out.why = `Hardware PWM channel ${ch} is shared with GPIO ${HEADER[mate][1]} (pin ${mate}) on a ${MODELS[model].short}, which already uses it. This LED uses software PWM.`;
      return out;
    }
  }
  Object.assign(out, { hw: true, channel: ch, why: `Hardware PWM, channel ${ch}. Smooth dimming with no CPU use.` + (model !== 'pi5' ? ` On a ${MODELS[model].short} it shares the channel with GPIO ${{ 12: 18, 18: 12, 13: 19, 19: 13 }[bcm]}.` : '') });
  return out;
}

function ledEditor(c, ctx, a, bcm) {
  const { store } = ctx;
  field(c, 'Lights up for');
  select(c.lastChild.lastChild, LED_SHOWS, a.show, (v) => { a.show = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'show' });
  if (a.show === 'block') blockPick(c, a, 'block');
  if (a.show === 'circuit') circuitPick(c, a, ctx);
  field(c, 'Brightness', 'Dimmable LEDs use PWM: the pin switches on and off very fast.');
  seg(c.lastChild.lastChild, [['onoff', 'On / off'], ['pwm', 'Dimmable (PWM)']], a.drive || 'pwm', (v) => { a.drive = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'led-drive' });
  if (a.drive === 'onoff') {
    el('p', { class: 'pi-muted' }, c).textContent = a.show === 'circuit' ? 'Lights when the circuit output is high.' : 'Full brightness or off. Works on every pin.';
    return;
  }
  const pw = pwmInfo(store, ctx.dev, selPin);
  el('div', { class: 'pi-pwm-note ' + (pw.hw ? 'hw' : 'sw'), 'data-pwm': pw.hw ? 'hw' : 'sw' }, c).textContent = pw.why;
  field(c, 'When lit');
  range(c.lastChild.lastChild, 1, 100, a.bright, (v) => { a.bright = v; savePi(); paintLed(); }, (v) => v + '%').dataset.ctl = 'led-bright';
  field(c, 'When off', 'A faint glow shows where the switch is on a dark stage.');
  range(c.lastChild.lastChild, 0, 50, a.dim || 0, (v) => { a.dim = v; savePi(); paintLed(); }, (v) => (v ? v + '%' : 'Off')).dataset.ctl = 'led-dim';
  if (a.show === 'circuit') el('p', { class: 'pi-muted' }, c).textContent = 'For a binary output the LED switches between the two levels. For a value output the brightness follows it.';
  if (a.show === 'tap') el('p', { class: 'pi-muted' }, c).textContent = 'Flashes at the "When lit" level on each beat and rests at the "When off" level.';
  // a little LED that shows the two levels
  const prev = el('div', { class: 'pi-ledprev' }, c);
  const on = el('span', {}, prev, '<i></i>Lit');
  const off = el('span', {}, prev, '<i></i>Off');
  const paintLed = () => { on.firstChild.style.opacity = 0.15 + (a.bright / 100) * 0.85; off.firstChild.style.opacity = a.dim ? 0.12 + (a.dim / 100) * 0.85 : 0.08; };
  paintLed();
}

function pwmCard(parent, ctx) {
  const model = ctx.dev ? ctx.dev.model : 'pi5';
  const c = card(parent, 'Dimmable LEDs (PWM)', 'Any pin can dim an LED. Four pins have hardware PWM, marked with a dot on the header.', 'pi-pwm-card');
  const t = el('table', { class: 'pi-table compact' }, c);
  t.innerHTML = '<thead><tr><th>Board</th><th>Hardware PWM</th><th>Notes</th></tr></thead>';
  const tb = el('tbody', {}, t);
  for (const [m, hw, note] of [
    ['pi5', 'GPIO 12, 13, 18, 19 (4 channels)', 'All four are independent. No headphone jack to share with.'],
    ['pi4', 'GPIO 12 / 18 and 13 / 19 (2 channels)', 'Pins in a pair share a channel. The 3.5 mm jack uses both channels.'],
    ['pi3bp', 'GPIO 12 / 18 and 13 / 19 (2 channels)', 'Same as Pi 4. Using the 3.5 mm jack moves LEDs to software PWM.'],
  ]) {
    const mine = m === model || (m === 'pi3bp' && model === 'pi3b');
    const tr = el('tr', { class: mine ? 'sel' : '' }, tb);
    el('td', {}, tr).textContent = m === 'pi3bp' ? 'Pi 3B / 3B+' : MODELS[m].short;
    el('td', {}, tr).textContent = hw;
    el('td', { class: 'pi-muted' }, tr).textContent = note;
  }
  el('p', { class: 'pi-muted' }, c).textContent = 'Software PWM works on every board and every free pin. It uses a little CPU and can shimmer slightly at very low brightness. GPIO 18 and 19 are also taken by audio HATs.';
}

function circuitPick(c, a, ctx) {
  const blocks = chainOrder(state.preset).map((b) => [b, getDef(b.type)]).filter(([, d]) => d && d.ctrl && d.ctrl.outs && d.ctrl.outs.length);
  field(c, 'Circuit', 'A custom block with a circuit output, matched by name in each preset');
  if (!blocks.length) {
    el('p', { class: 'pi-muted' }, c).textContent = 'The current preset has no block with a circuit output. Build one in Pedal Factory (a circuit with an FS OUT or EXP OUT jack).';
    return;
  }
  select(c.lastChild.lastChild, [['', 'Pick a block'], ...blocks.map(([, d]) => [d.name, d.name])], a.block || '', (v) => { a.block = v; a.out = 0; savePi(); ctx.rerender(); }, { 'data-ctl': 'led-circuit' });
  const hit = blocks.find(([, d]) => d.name === a.block);
  if (hit) {
    field(c, 'Output');
    select(c.lastChild.lastChild, hit[1].ctrl.outs.map((o, i) => [i, (o.label || 'Out ' + (i + 1)) + (o.sig === 'b' ? ' (on / off)' : ' (value)')]), a.out || 0, (v) => { a.out = +v; savePi(); }, { 'data-ctl': 'led-out' });
  }
}
function blockPick(c, a, key) {
  const blocks = chainOrder(state.preset).filter((b) => { const d = getDef(b.type); return d && d.algo; });
  field(c, 'Block', 'Matched by name in each preset');
  select(c.lastChild.lastChild, [['', 'Pick a block'], ...blocks.map((b) => [getDef(b.type).name, getDef(b.type).name])], a[key] || '', (v) => { a[key] = v; savePi(); });
}
