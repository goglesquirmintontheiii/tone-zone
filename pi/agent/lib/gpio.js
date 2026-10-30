// Footswitches and LEDs on the GPIO header. Lines go through the tz-gpio helper (kernel GPIO character device,
// works on Pi 3, 4 and 5); fake mode simulates them. LED brightness uses hardware PWM (/sys/class/pwm) on
// GPIO 12, 13, 18, 19 when that channel is enabled, software PWM in the helper elsewhere.
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const hw = require('./hw');
const log = require('./log');

// physical header pin -> BCM GPIO number
const HEADER = { 3: 2, 5: 3, 7: 4, 8: 14, 10: 15, 11: 17, 12: 18, 13: 27, 15: 22, 16: 23, 18: 24, 19: 10, 21: 9, 22: 25, 23: 11, 24: 8, 26: 7, 27: 0, 28: 1, 29: 5, 31: 6, 32: 12, 33: 13, 35: 19, 36: 16, 37: 26, 38: 20, 40: 21 };
const bcmOf = (pin) => HEADER[pin];
// hardware PWM channel per BCM pin (needs dtoverlay=pwm-2chan on Pi 3 / 4; Pi 5 RP1 has four channels)
function hwPwmChannel(bcm, model) {
  if (model === 'pi5') return { 12: 0, 13: 1, 18: 2, 19: 3 }[bcm];
  return { 12: 0, 18: 0, 13: 1, 19: 1 }[bcm];
}

// ---- line drivers: { input(bcm, cb), output(bcm, duty0to1000), release(bcm) }
class HelperLines extends EventEmitter {
  constructor(bin) {
    super();
    this.bin = bin;
    this.levels = {};
    this.p = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.p.on('error', (e) => { log.error('GPIO helper failed: ' + e.message, 'gpio'); this.dead = true; });
    this.p.on('exit', (c) => { if (!this.closing) log.warn(`GPIO helper exited (${c})`, 'gpio'); this.dead = true; });
    readline.createInterface({ input: this.p.stdout }).on('line', (l) => this.line(l));
    this.p.stderr.on('data', (d) => log.warn(String(d).trim(), 'gpio'));
    this.chips = [];
    this.chipsWait = null;
  }
  line(l) {
    const w = l.split(' ');
    if (w[0] === 'e') { this.levels[+w[1]] = +w[2]; this.emit('edge', +w[1], +w[2]); }
    else if (w[0] === 'chip') this.chips.push({ path: w[1], name: w[2], label: w[3], lines: +w[4] });
    else if (w[0] === 'chips-end' && this.chipsWait) { this.chipsWait(this.chips); this.chipsWait = null; }
    else if (w[0] === 'ok' && w[1] === 'in') this.levels[+w[2]] = +w[3];
    else if (w[0] === 'err') log.warn('gpio: ' + l.slice(4), 'gpio');
  }
  cmd(s) { if (!this.dead) try { this.p.stdin.write(s + '\n'); } catch {} }
  async openHeader() {
    this.chips = [];
    const chips = await new Promise((res) => { this.chipsWait = res; this.cmd('chips'); setTimeout(() => res(this.chips), 2000); });
    // the header's chip: pinctrl-bcm2835 (Pi 3), pinctrl-bcm2711 (Pi 4), pinctrl-rp1 (Pi 5)
    const c = chips.find((x) => /pinctrl-(bcm27|bcm28|rp1)/.test(x.label)) || chips.find((x) => x.lines >= 28) || chips[0];
    if (!c) { log.warn('no GPIO chip found', 'gpio'); return null; }
    this.cmd('open ' + c.path);
    log.info(`GPIO: ${c.path} (${c.label}, ${c.lines} lines)`, 'gpio');
    return c;
  }
  input(bcm, debounceMs) { this.cmd(`in ${bcm} up ${Math.round(debounceMs * 1000)}`); }
  output(bcm, duty) { this.cmd(duty <= 0 || duty >= 1000 ? `out ${bcm} ${duty >= 1000 ? 1 : 0}` : `pwm ${bcm} ${Math.round(duty)}`); }
  release(bcm) { this.cmd(`release ${bcm}`); }
  level(bcm) { return this.levels[bcm]; }
  close() { this.closing = true; try { this.p.kill(); } catch {} }
}

class FakeLines extends EventEmitter {
  constructor() { super(); this.levels = {}; this.outputs = {}; this.inputs = new Set(); }
  async openHeader() { log.info('GPIO: fake chip (pinctrl-fake, 54 lines)', 'gpio'); return { path: 'fake', label: 'pinctrl-fake', lines: 54 }; }
  input(bcm) { this.inputs.add(bcm); if (this.levels[bcm] === undefined) this.levels[bcm] = 1; }
  output(bcm, duty) { this.outputs[bcm] = duty; }
  release(bcm) { this.inputs.delete(bcm); delete this.outputs[bcm]; }
  level(bcm) { return this.levels[bcm]; }
  // test hook: drive an input (0 = pressed, the switch pulls to ground)
  set(bcm, level) {
    if (!this.inputs.has(bcm)) return false;
    if (this.levels[bcm] === level) return true;
    this.levels[bcm] = level;
    this.emit('edge', bcm, level);
    return true;
  }
  close() {}
}

// ---- hardware PWM through sysfs
class HwPwm {
  constructor(model) { this.model = model; this.open = {}; }
  chip() {
    const base = hw.sys('/sys/class/pwm');
    try {
      for (const d of fs.readdirSync(base)) if (/^pwmchip\d+$/.test(d)) return path.join(base, d);
    } catch {}
    return null;
  }
  // true when the duty was set in hardware
  set(bcm, duty) {
    const ch = hwPwmChannel(bcm, this.model);
    const chip = ch === undefined ? null : this.chip();
    if (!chip) return false;
    const npwm = Number(fs.readFileSync(path.join(chip, 'npwm'), 'utf8')) || 0;
    if (ch >= npwm) return false;
    const dir = path.join(chip, 'pwm' + ch);
    try {
      if (!fs.existsSync(dir)) {
        fs.writeFileSync(path.join(chip, 'export'), String(ch));
        if (hw.FAKE) fs.mkdirSync(dir, { recursive: true }); // the kernel makes this directory
      }
      const period = 1000000; // 1 kHz, in ns
      if (!this.open[ch]) { fs.writeFileSync(path.join(dir, 'period'), String(period)); this.open[ch] = bcm; }
      fs.writeFileSync(path.join(dir, 'duty_cycle'), String(Math.round((period * Math.max(0, Math.min(1000, duty))) / 1000)));
      fs.writeFileSync(path.join(dir, 'enable'), '1');
      return true;
    } catch (e) {
      if (!this.warned) { this.warned = true; log.warn(`hardware PWM not available (${e.code || e.message}), using software PWM`, 'gpio'); }
      return false;
    }
  }
  release(bcm) {
    const ch = hwPwmChannel(bcm, this.model);
    if (ch === undefined || this.open[ch] !== bcm) return;
    const chip = this.chip();
    try { fs.writeFileSync(path.join(chip, 'pwm' + ch, 'enable'), '0'); } catch {}
    delete this.open[ch];
  }
}

// ---- footswitch logic + LED state, driven by the agent
class Gpio extends EventEmitter {
  constructor({ model, helper, blockedPins }) {
    super();
    this.model = model;
    this.lines = hw.FAKE ? new FakeLines() : new HelperLines(helper);
    this.pwm = new HwPwm(model);
    this.cfg = null;
    this.sw = {}; // bcm -> switch state
    this.leds = {}; // bcm -> { cfg, duty, hw }
    this.blocked = new Set(blockedPins || []); // BCM pins taken by audio (built-in jack uses PWM 40 / 41, HATs 18 to 21)
    this.lines.on('edge', (bcm, level) => this.edge(bcm, level));
    this.ready = this.lines.openHeader();
  }

  async configure(cfg) {
    await this.ready;
    this.cfg = cfg;
    const pins = cfg.pins || {};
    const want = new Set();
    for (const [pin, p] of Object.entries(pins)) {
      const bcm = bcmOf(+pin);
      if (bcm === undefined || !p) continue;
      want.add(bcm);
      if (p.type === 'foot') {
        if (this.leds[bcm]) this.releaseLed(bcm);
        const debounce = Math.max(5, Math.min(80, +p.debounce || 20));
        if (!this.sw[bcm]) this.lines.input(bcm, debounce);
        this.sw[bcm] = Object.assign(this.sw[bcm] || { stable: 1, last: 0, timer: null, holdTimer: null, held: false, pressedAt: 0 }, { cfg: p, pin: +pin, debounce });
      } else if (p.type === 'led') {
        if (this.sw[bcm]) { this.lines.release(bcm); delete this.sw[bcm]; }
        this.leds[bcm] = Object.assign(this.leds[bcm] || { duty: -1 }, { cfg: p, pin: +pin });
      }
    }
    for (const bcm of Object.keys(this.sw).map(Number)) if (!want.has(bcm)) { this.lines.release(bcm); delete this.sw[bcm]; }
    for (const bcm of Object.keys(this.leds).map(Number)) if (!want.has(bcm)) this.releaseLed(bcm);
    log.info(`GPIO: ${Object.keys(this.sw).length} footswitches, ${Object.keys(this.leds).length} LEDs`, 'gpio');
  }

  edge(bcm, level) {
    const s = this.sw[bcm];
    if (!s) return;
    // debounce: act on the level once it has been steady for `debounce` ms
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      const lv = this.lines.level(bcm);
      if (lv === undefined || lv === s.stable) return;
      s.stable = lv;
      this.transition(s, lv === 0);
    }, s.debounce);
  }

  transition(s, down) {
    const c = s.cfg;
    const holdMs = (this.cfg && this.cfg.holdMs) || 600;
    if (c.mode === 'latching') {
      // a clicky latching switch: every change of state is a press
      this.fire(c.press, c, 'press', s);
      return;
    }
    const hasHold = c.hold && c.hold !== 'none';
    if (down) {
      s.pressedAt = Date.now();
      s.held = false;
      // no hold action: act on the way down (snappier)
      if (!hasHold) { this.fire(c.press, c, 'press', s); return; }
      clearTimeout(s.holdTimer);
      s.holdTimer = setTimeout(() => { s.held = true; this.fire(c.hold, c, 'hold', s); }, holdMs);
    } else {
      clearTimeout(s.holdTimer);
      if (hasHold && !s.held) this.fire(c.press, c, 'press', s);
      this.emit('release', { pin: s.pin, cfg: c });
    }
  }

  fire(action, c, kind, s) {
    if (!action || action === 'none') return;
    const block = kind === 'hold' ? c.holdBlock || c.block : c.pressBlock || c.block;
    log.info(`${c.name || 'pin ' + s.pin}: ${kind} -> ${action}${block ? ' (' + block + ')' : ''}`, 'gpio');
    this.emit('action', { action, block, pin: s.pin, kind });
  }

  // brightness 0..100 per LED pin, worked out by the agent from what each LED shows
  setLed(bcm, pct) {
    const l = this.leds[bcm];
    if (!l) return;
    const pwm = l.cfg.drive === 'pwm';
    const duty = Math.round(Math.max(0, Math.min(100, pwm ? pct : pct > 0 ? 100 : 0)) * 10);
    if (duty === l.duty) return;
    l.duty = duty;
    const usesHw = pwm && !this.blocked.has(bcm) && duty > 0 && duty < 1000 && this.pwm.set(bcm, duty);
    if (usesHw) { if (!l.hw) this.lines.release(bcm); l.hw = true; return; }
    if (l.hw) { this.pwm.release(bcm); l.hw = false; }
    this.lines.output(bcm, duty);
  }
  releaseLed(bcm) {
    const l = this.leds[bcm];
    if (l && l.hw) this.pwm.release(bcm);
    this.lines.release(bcm);
    delete this.leds[bcm];
  }
  ledState() {
    const out = {};
    for (const [bcm, l] of Object.entries(this.leds)) out[l.pin] = { bcm: +bcm, duty: l.duty, hw: !!l.hw };
    return out;
  }
  // test hook (fake mode), and the desktop "test" button: press = level 0 for `ms`
  async press(pin, ms = 60) {
    const bcm = bcmOf(+pin);
    if (!(this.lines instanceof FakeLines)) return false;
    this.lines.set(bcm, 0);
    await new Promise((r) => setTimeout(r, ms));
    this.lines.set(bcm, 1);
    return true;
  }
  setLevel(pin, level) {
    return this.lines instanceof FakeLines ? this.lines.set(bcmOf(+pin), level ? 1 : 0) : false;
  }
  close() { this.lines.close(); }
}

module.exports = { Gpio, HEADER, bcmOf, hwPwmChannel };
