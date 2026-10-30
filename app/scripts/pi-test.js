// Pi tab (demo UI): every section renders, the add a Pi wizard, a GPIO pin assignment, the compatibility check,
// the on-device preview (edit a parameter, switch preset), fake update progress, audio device choice, no errors.
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
  await win.evaluate(() => { try { localStorage.removeItem('tz.pi.demo.v1'); } catch {} });
  await win.click('#tabs [data-tab="pi"]');
  await win.waitForSelector('#view-pi .pi-nav', { timeout: 10000 });
  await win.waitForTimeout(500);

  // devices + wizard
  ok(await section('devices'), 'devices section');
  ok((await win.$$('#view-pi .pi-dev')).length === 3, 'three demo devices');
  await shot('devices');
  await win.click('[data-act="add-device"]');
  await win.waitForSelector('.pi-wiz');
  await win.click('.pi-way[data-way="direct"]');
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
