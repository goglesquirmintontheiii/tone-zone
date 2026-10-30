// Pi tab (demo UI): every section renders, the add a Pi wizard, a GPIO pin assignment, the compatibility check,
// the on-device preview (edit a parameter, switch preset), fake update progress, audio device choice, no errors.
// v0.9: DSP and CPU load bars and their colours, temperature colours, DSP budget, click a card to pick it, drag
// to sort, Pi 3B+ in the wizard and the compat check, the 3.5 mm jack on a Pi 3B+, PWM LEDs.
// Screenshots of each section go to $SHOTS (default /tmp).
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const S = process.env.SHOTS || '/tmp';
(async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-pi-'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env, XDG_DATA_HOME: data } });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  let fails = 0;
  const ok = (cond, msg) => {
    console.log((cond ? 'ok   ' : 'FAIL ') + msg);
    if (!cond) fails++;
  };
  const shot = (n) => win.screenshot({ path: path.join(S, 'pi-' + n + '.png') });
  const section = async (id) => {
    await win.click(`#view-pi .pi-navbtn[data-section="${id}"]`);
    await win.waitForTimeout(350);
    return win.evaluate((x) => document.querySelector('#view-pi .pi-main').dataset.section === x, id);
  };
  // errors before the tab opens come from elsewhere in the app: shown, but they do not fail this test
  const startErrs = errs.splice(0);
  if (startErrs.length) console.log('note: ' + startErrs.length + ' error(s) at startup, before the Pi tab opened:\n  ' + [...new Set(startErrs.map((e) => e.split('\n')[0]))].join('\n  '));
  // start from clean demo data
  // demo mode even if the desktop side finds a real Pi
  await win.evaluate(() => { try { localStorage.removeItem('tz.pi.demo.v1'); localStorage.setItem('tz.pi.ui.v1', JSON.stringify({ demo: true, order: [] })); } catch {} });
  await win.click('#tabs [data-tab="pi"]');
  await win.waitForSelector('#view-pi .pi-nav', { timeout: 10000 });
  await win.waitForTimeout(500);

  // devices + wizard
  ok(await section('devices'), 'devices section');
  ok((await win.$$('#view-pi .pi-dev')).length === 3, 'three demo devices');
  await shot('devices');

  // load bars: DSP, then CPU below it, coloured by value
  const bars = await win.evaluate(() => {
    const c = document.querySelector('.pi-dev[data-device="d1"]');
    const rows = [...c.querySelectorAll('.pi-dev-cpu')].map((r) => r.dataset.loadrow);
    return { rows, cpu: !!c.querySelector('[data-loadrow="cpu"] .pi-load'), mark: !!c.querySelector('[data-loadrow="dsp"] .pi-budget-mark') };
  });
  ok(bars.rows.join() === 'dsp,cpu' && bars.cpu, 'CPU load bar below the DSP load bar');
  ok(bars.mark, 'DSP bar shows the budget marker');
  const paint = (id, vals) => win.evaluate(async ([id, vals]) => {
    const data = await import('./js/pages/pi-data.js');
    const pi = await import('./js/pages/pi.js');
    const d = data.piStore().devices.find((x) => x.id === id);
    Object.assign(d, vals);
    pi.paintStats(document.getElementById('view-pi'), d);
    const c = document.querySelector(`.pi-dev[data-device="${id}"]`);
    const m = (k) => c.querySelector(`[data-loadrow="${k}"] .pi-load`);
    const t = c.querySelector('[data-live$=":temp"]');
    return { dsp: m('dsp').className, cpu: m('cpu').className, temp: t.className, anim: getComputedStyle(t).animationName, color: getComputedStyle(t).color, lc: getComputedStyle(m('cpu')).getPropertyValue('--lc') };
  }, [id, vals]);
  const lv = {};
  for (const v of [30, 55, 90]) lv[v] = await paint('d1', { dsp: v, cpu: v });
  ok(/load-ok/.test(lv[30].cpu) && /load-ok/.test(lv[30].dsp), 'load 30%: green');
  ok(/load-warn/.test(lv[55].cpu) && /load-warn/.test(lv[55].dsp), 'load 55%: yellow');
  ok(/load-hot/.test(lv[90].cpu) && /load-hot/.test(lv[90].dsp), 'load 90%: red');
  ok(/over/.test(lv[90].dsp) && !/over/.test(lv[55].dsp), 'DSP over the budget marks the bar');
  const tp = {};
  for (const c of [60, 78, 82]) tp[c] = await paint('d1', { temp: c });
  ok(/temp-ok/.test(tp[60].temp) && tp[60].anim === 'none', '60 C: green text');
  ok(/temp-hot/.test(tp[78].temp) && tp[78].anim === 'none', '78 C: red text');
  ok(/temp-crit/.test(tp[82].temp) && tp[82].anim === 'pi-temp-flash', '82 C: flashing red');
  await win.emulateMedia({ reducedMotion: 'reduce' }).catch(() => {});
  const still = await paint('d1', { temp: 82 });
  ok(still.anim === 'none', 'no flashing with reduced motion');
  await win.emulateMedia({ reducedMotion: 'no-preference' }).catch(() => {});
  await paint('d1', { dsp: 30, cpu: 34, temp: 60 });
  await paint('d2', { dsp: 55, cpu: 62, temp: 78 });
  await win.waitForTimeout(700);
  await shot('devices-loads');

  // DSP budget slider
  await win.evaluate(() => {
    const r = document.querySelector('.pi-dev[data-device="d1"] [data-ctl="budget"]');
    r.value = 85;
    r.dispatchEvent(new Event('input'));
    r.dispatchEvent(new Event('change'));
  });
  const bud = await win.evaluate(() => ({
    saved: JSON.parse(localStorage.getItem('tz.pi.demo.v1')).devices.find((d) => d.id === 'd1').budget,
    left: document.querySelector('.pi-dev[data-device="d1"] .pi-budget-mark').style.left,
    hint: document.querySelector('.pi-dev[data-device="d1"] .pi-budget small').textContent,
  }));
  ok(bud.saved === 85 && bud.left === '85%' && /headroom|range/.test(bud.hint), 'DSP budget slider saved and moves the marker (' + JSON.stringify(bud) + ')');

  // click a card to pick that Pi
  await win.click('.pi-dev[data-device="d2"] .pi-dev-info');
  await win.waitForTimeout(400);
  const picked = await win.evaluate(() => ({ cur: document.querySelector('.pi-dev.cur')?.dataset.device, head: document.querySelector('#view-pi .pi-devpick').value, btn: [...document.querySelectorAll('.pi-dev button')].some((b) => /Use this Pi/.test(b.textContent)) }));
  ok(picked.cur === 'd2' && picked.head === 'd2' && !picked.btn, 'clicking a card picks that Pi');
  await win.click('.pi-dev[data-device="d2"] button:has-text("Blink LED")');
  await win.waitForTimeout(200);
  ok(await win.evaluate(() => document.querySelector('.pi-dev.cur').dataset.device === 'd2'), 'buttons on a card do not change the pick');
  await win.focus('.pi-dev[data-device="d1"]');
  await win.keyboard.press('Enter');
  await win.waitForTimeout(400);
  ok(await win.evaluate(() => document.querySelector('.pi-dev.cur').dataset.device === 'd1'), 'Enter on a focused card picks it');

  // drag the Spare Pi card in front of the first card
  const box = async (sel) => (await win.$(sel)).boundingBox();
  const from = await box('.pi-dev[data-device="d3"] .pi-dev-head');
  const to = await box('.pi-dev[data-device="d1"]');
  await win.mouse.move(from.x + 60, from.y + from.height / 2);
  await win.mouse.down();
  await win.mouse.move(from.x + 40, from.y + from.height / 2 + 4, { steps: 3 });
  await win.mouse.move(to.x + 30, to.y + 60, { steps: 12 });
  await win.waitForTimeout(250);
  await shot('devices-drag');
  await win.mouse.up();
  await win.waitForTimeout(400);
  const order = await win.evaluate(() => ({
    dom: [...document.querySelectorAll('.pi-dev')].map((c) => c.dataset.device).join(),
    saved: JSON.parse(localStorage.getItem('tz.pi.ui.v1')).order.join(),
    head: [...document.querySelectorAll('#view-pi .pi-devpick option')].map((o) => o.value).join(),
    cur: document.querySelector('.pi-dev.cur').dataset.device,
  }));
  ok(order.dom === 'd3,d1,d2' && order.saved.startsWith('d3,d1,d2') && order.head === 'd3,d1,d2', 'drag sorted the cards (' + order.dom + ')');
  ok(order.cur === 'd1', 'dragging does not pick the card');
  await section('logs');
  await section('devices');
  ok(await win.evaluate(() => [...document.querySelectorAll('.pi-dev')].map((c) => c.dataset.device).join() === 'd3,d1,d2'), 'card order kept after drawing again');
  await win.click('[data-act="add-device"]');
  await win.waitForSelector('.pi-wiz');
  await win.click('.pi-way[data-way="direct"]');
  ok(await win.evaluate(() => [...document.querySelectorAll('[data-ctl="board"] option')].map((o) => o.value).join() === 'pi5,pi4,pi3bp,pi3b'), 'wizard offers Pi 5, 4, 3B+ and 3B');
  await win.selectOption('[data-ctl="board"]', 'pi3bp');
  await win.waitForTimeout(150);
  await shot('wizard-1');
  const steps = await win.evaluate(() => [...document.querySelectorAll('.pi-wiz-steps span')].length);
  ok(steps === 5, 'direct cable wizard has 5 steps');
  for (let i = 0; i < 3; i++) { await win.click('[data-wiz="next"]'); await win.waitForTimeout(150); }
  ok(await win.evaluate(() => document.querySelector('.pi-wiz-pane').dataset.step === 'Install'), 'install step reached');
  const cmd = await win.evaluate(() => [...document.querySelectorAll('.pi-wiz-pane .pi-code pre')].map((p) => p.textContent).join('\n'));
  ok(/ssh pi@tonezone\.local/.test(cmd) && /install\.sh \| sudo bash/.test(cmd), 'SSH install commands shown');
  await shot('wizard-install');
  await win.click('[data-wiz="next"]');
  await win.waitForTimeout(1100);
  await win.fill('[data-wiz="code"]', '123456');
  await shot('wizard-pair');
  await win.click('[data-wiz="next"]');
  await win.waitForTimeout(400);
  ok((await win.$$('#view-pi .pi-dev')).length === 4, 'paired Pi added');
  ok(await win.evaluate(() => { const s = JSON.parse(localStorage.getItem('tz.pi.demo.v1')); return s.devices.find((d) => d.id === s.current).model === 'pi3bp'; }), 'paired Pi is a 3B+');
  ok(await win.evaluate(() => !document.querySelector('#modalLayer.show')), 'wizard closed');
  // back to the Pi 5 demo device for the rest
  await win.selectOption('#view-pi .pi-devpick', 'd1');
  await win.waitForTimeout(300);

  // presets + compatibility
  ok(await section('presets'), 'presets section');
  ok((await win.$$('#view-pi .pi-bank')).length === 3, 'three demo banks');
  await win.click('[data-act="check"]');
  await win.waitForTimeout(500);
  const res = await win.evaluate(() => {
    const o = document.querySelector('.pi-compat-out');
    return { result: o.dataset.result, rows: o.querySelectorAll('tbody tr:not(.pi-note-row)').length };
  });
  ok(res.result && res.rows > 0, `compat check ran (${res.result}, ${res.rows} blocks)`);
  ok(await win.evaluate(() => ['pi3bp', 'pi4', 'pi5'].every((m) => document.querySelector(`.pi-compat-model[data-model="${m}"]`)) && /85%/.test(document.querySelector('.pi-compat-out').textContent)), 'compat check shows Pi 3B+, Pi 4, Pi 5 against the 85% budget');
  // a NAM heavy preset picked from the list
  const nam = await win.evaluate(async () => {
    const list = await window.tz.presets.list();
    const sel = document.querySelector('.pi-compat-pick');
    for (const q of list) {
      const p = await window.tz.presets.load(q.file);
      if ((p.blocks || []).some((b) => /^amp\.|pack:/.test(b.type)) && (p.blocks || []).length > 7) { sel.value = q.file; return q.name; }
    }
    return null;
  });
  if (nam) {
    await win.click('[data-act="check"]');
    await win.waitForTimeout(600);
    ok(await win.evaluate(() => !!document.querySelector('.pi-compat-out').dataset.result), 'compat check on "' + nam + '"');
  }
  await win.click('[data-act="check-all"]');
  await win.waitForTimeout(1500);
  ok(await win.evaluate(() => document.querySelectorAll('[data-checkall] tbody tr').length >= 7), 'checked every preset on the Pi');
  await shot('presets-checkall');
  await win.click('[data-act="push"]');
  await win.waitForTimeout(2800);
  ok(await win.evaluate(() => document.querySelectorAll('.pi-bank .pi-slot:not(.empty)').length >= 8), 'push filled a slot');
  await shot('presets');

  // GPIO
  ok(await section('gpio'), 'gpio section');
  ok(await win.evaluate(() => document.querySelectorAll('.pi-pin').length === 40), '40 pin header drawn');
  ok(await win.evaluate(() => document.querySelector('.pi-pin[data-pin="12"]').classList.contains('pin-res')), 'HAT pins marked as taken');
  await win.click('.pi-pin[data-pin="18"]');
  await win.waitForTimeout(200);
  await win.click('[data-ctl="pin-type"] [data-v="foot"]');
  await win.waitForTimeout(200);
  await win.selectOption('[data-ctl="press"]', 'bank+');
  await win.waitForTimeout(200);
  await win.click('[data-ctl="mode"] [data-v="latching"]');
  await win.waitForTimeout(200);
  const g = await win.evaluate(() => JSON.parse(localStorage.getItem('tz.pi.demo.v1')).gpio.pins['18']);
  ok(g && g.type === 'foot' && g.press === 'bank+' && g.mode === 'latching', 'pin 18 set as latching bank up footswitch');
  await win.click('[data-act="test-pin"]');
  await shot('gpio');
  // PWM LEDs: GPIO 12 (pin 32) has hardware PWM, GPIO 4 (pin 7) uses software PWM
  ok(await win.evaluate(() => [32, 33, 12, 35].every((p) => document.querySelector(`.pi-pin[data-pin="${p}"] .pi-pwm-dot`)) && !document.querySelector('.pi-pin[data-pin="7"] .pi-pwm-dot')), 'hardware PWM pins marked on the header');
  await win.click('.pi-pin[data-pin="32"]');
  await win.waitForTimeout(200);
  await win.click('[data-ctl="pin-type"] [data-v="led"]');
  await win.waitForTimeout(200);
  ok(await win.evaluate(() => document.querySelector('[data-ctl="led-drive"] .on')?.dataset.v === 'pwm' && document.querySelector('[data-pwm]')?.dataset.pwm === 'hw'), 'GPIO 12 LED is dimmable with hardware PWM');
  await win.evaluate(() => { const r = document.querySelector('[data-ctl="led-bright"]'); r.value = 35; r.dispatchEvent(new Event('input')); });
  await win.evaluate(() => { const r = document.querySelector('[data-ctl="led-dim"]'); r.value = 6; r.dispatchEvent(new Event('input')); });
  await win.selectOption('[data-ctl="show"]', 'tap');
  await win.waitForTimeout(200);
  let led = await win.evaluate(() => JSON.parse(localStorage.getItem('tz.pi.demo.v1')).gpio.pins['32']);
  ok(led && led.type === 'led' && led.drive === 'pwm' && led.bright === 35 && led.dim === 6 && led.show === 'tap', 'PWM LED saved (35% lit, 6% off, tap tempo)');
  await shot('gpio-pwm');
  await win.click('.pi-pin[data-pin="7"]');
  await win.waitForTimeout(200);
  await win.click('[data-ctl="pin-type"] [data-v="led"]');
  await win.waitForTimeout(200);
  ok(await win.evaluate(() => document.querySelector('[data-pwm]')?.dataset.pwm === 'sw'), 'GPIO 4 LED uses software PWM');
  await win.selectOption('[data-ctl="show"]', 'circuit');
  await win.waitForTimeout(200);
  ok(await win.evaluate(() => /circuit/i.test(document.querySelector('.pi-pinedit').textContent)), 'LED can follow a circuit output');
  await win.click('[data-ctl="led-drive"] [data-v="onoff"]');
  await win.waitForTimeout(200);
  led = await win.evaluate(() => Object.assign({ note: !!document.querySelector('[data-pwm]') }, JSON.parse(localStorage.getItem('tz.pi.demo.v1')).gpio.pins['7']));
  ok(led && led.drive === 'onoff' && !led.note, 'LED set to plain on / off');

  // display + on-device preview
  ok(await section('display'), 'display section');
  await win.waitForSelector('.pis');
  const sz = await win.evaluate(() => { const s = document.querySelector('.pis'); return [s.offsetWidth, s.offsetHeight]; });
  ok(sz[0] === 800 && sz[1] === 480, 'preview at 800 x 480');
  ok((await win.$$('.pis-tile')).length > 0, 'preview shows the preset blocks');
  await shot('display');
  await win.click('.pis-tile');
  await win.waitForTimeout(200);
  const slider = await win.$('.pis-param .pis-slider');
  ok(!!slider, 'block edit view with sliders');
  if (slider) {
    const before = await win.evaluate(() => document.querySelector('.pis-param .pis-pval').textContent);
    const b = await slider.boundingBox();
    await win.mouse.click(b.x + b.width * 0.9, b.y + b.height / 2);
    await win.waitForTimeout(200);
    const after = await win.evaluate(() => document.querySelector('.pis-param .pis-pval').textContent);
    ok(before !== after, `parameter edited on the preview (${before} -> ${after})`);
    ok(await win.evaluate(() => /Last edit/.test(document.querySelector('.pi-edits').textContent)), 'edit reported');
  }
  await shot('display-edit');
  await win.click('.pis-nav [data-nav="presets"]');
  await win.waitForTimeout(200);
  await shot('display-presets');
  const name0 = await win.evaluate(() => document.querySelector('.pis-slotbtn.on span')?.textContent);
  await win.click('.pis-slotbtn:not(.on):not(.empty)');
  await win.waitForTimeout(600);
  const name1 = await win.evaluate(() => document.querySelector('.pis-pname').textContent);
  ok(name1 && name1 !== name0, `preset switched from the screen (${name0} -> ${name1})`);
  await win.click('.pis-nav [data-nav="tuner"]');
  await win.waitForTimeout(400);
  await shot('display-tuner');
  // small SPI screen and portrait rotation
  await win.selectOption('[data-ctl="screen"]', 'spi35');
  await win.waitForTimeout(300);
  await win.click('[data-ctl="rotation"] [data-v="90"]');
  await win.waitForTimeout(300);
  const sz2 = await win.evaluate(() => { const s = document.querySelector('.pis'); return [s.offsetWidth, s.offsetHeight]; });
  ok(sz2[0] === 320 && sz2[1] === 480, 'rotated 3.5" preview at 320 x 480');
  await shot('display-spi');
  await win.click('[data-ctl="display-mode"] [data-v="headless"]');
  await win.waitForTimeout(300);
  ok(await win.evaluate(() => !!document.querySelector('.pi-leds') && !document.querySelector('.pis')), 'headless shows status LED');
  await shot('display-headless');

  // audio
  ok(await section('audio'), 'audio section');
  await win.selectOption('[data-ctl="audio-in"]', 'usb-aux');
  await win.waitForTimeout(300);
  await win.selectOption('[data-ctl="audio-out"]', 'hat-hifiberry');
  await win.waitForTimeout(300);
  ok(await win.evaluate(() => /two devices/.test(document.querySelector('.pi-main').textContent)), 'split devices warning');
  ok(await win.evaluate(() => ![...document.querySelectorAll('[data-ctl="audio-out"] option')].some((o) => o.value === 'jack35')), 'Pi 5 offers no 3.5 mm jack');
  await shot('audio');
  // the Pi 3B+ has the 3.5 mm output
  await win.selectOption('#view-pi .pi-devpick', 'd2');
  await win.waitForTimeout(400);
  ok(await win.evaluate(() => [...document.querySelectorAll('[data-ctl="audio-out"] option')].some((o) => o.value === 'jack35') && ![...document.querySelectorAll('[data-ctl="audio-in"] option')].some((o) => o.value === 'jack35')), 'Pi 3B+ offers the 3.5 mm jack as an output only');
  await win.selectOption('[data-ctl="audio-out"]', 'jack35');
  await win.waitForTimeout(300);
  ok(await win.evaluate(() => /Lower than the Pi 4/.test(document.querySelector('[data-q="jack35"]').textContent) && /software PWM/.test(document.querySelector('.pi-main').textContent)), 'Pi 3B+ jack quality and PWM notes');
  await shot('audio-pi3');
  await section('gpio');
  await win.click('.pi-pin[data-pin="32"]');
  await win.waitForTimeout(200);
  ok(await win.evaluate(() => document.querySelector('[data-pwm]')?.dataset.pwm === 'sw'), 'jack in use on a Pi 3B+: GPIO 12 falls back to software PWM');
  await win.selectOption('#view-pi .pi-devpick', 'd1');
  await win.waitForTimeout(400);
  await section('audio');

  // updates
  ok(await section('updates'), 'updates section');
  await win.click('[data-act="install-update"]');
  await win.waitForTimeout(1200);
  ok(await win.evaluate(() => !document.querySelector('[data-progress="update"]').classList.contains('hidden')), 'update progress shown');
  await shot('updates-progress');
  await win.waitForTimeout(3200);
  ok(await win.evaluate(() => document.querySelector('[data-ver]').textContent === '0.8.1'), 'updated to 0.8.1');
  await shot('updates');

  // logs
  ok(await section('logs'), 'logs section');
  ok(await win.evaluate(() => /Updated 0\.8\.0/.test(document.querySelector('[data-log]').textContent)), 'update in the log');
  await shot('logs');

  // light theme look
  await win.evaluate(() => (document.documentElement.dataset.theme = 'light'));
  await section('gpio');
  await shot('light');
  await win.evaluate(() => (document.documentElement.dataset.theme = window.__tz?.state?.settings?.theme || 'dark'));
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(300);
  ok(!errs.length, 'no console errors in the Pi tab' + (errs.length ? ':\n' + errs.join('\n') : ''));
  console.log(fails ? fails + ' FAILED' : 'all ok');
  await app.close();
  process.exit(fails ? 1 : 0);
})();
