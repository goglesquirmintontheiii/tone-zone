// Plugins tab: view modes (large / medium / tile / list), lazy images, detail panel, sandbox controls
// (knobs, switches, footswitches, buttons, screens, DIPs, status hooks) on several multi-FX, remove + restore.
// usage: node plugins-page-test.js out-dir
const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.argv[2] || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', (e) => errs.push(e.message));
  win.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  await win.evaluate(() => { try { localStorage.removeItem('tz.pluginView'); } catch {} });
  await win.click('#tabs [data-tab="plugins"]');
  await win.waitForTimeout(4000);
  console.log('cards', await win.locator('.plugin-card').count());
  await win.screenshot({ path: S + '/plugins-grid.png' });

  // ---- views
  for (const v of ['large', 'medium', 'list', 'tile']) {
    await win.click(`.pl-views [data-view="${v}"]`);
    await win.waitForTimeout(1500);
    const r = await win.evaluate(async () => {
      const page = document.querySelector('.plugins-page');
      const n = document.querySelectorAll('.plugin-card, .pl-lrow').length;
      const imgs = document.querySelectorAll('.plugins-page img').length;
      const c = document.querySelector('.plugin-card, .pl-lrow').getBoundingClientRect();
      // scroll through the page and time the frames
      const times = [];
      let last = performance.now();
      await new Promise((res) => {
        let k = 0;
        const step = () => {
          const now = performance.now();
          times.push(now - last); last = now;
          page.scrollTop += 60;
          if (++k < 90) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
      await new Promise((r) => setTimeout(r, 1500));
      // second pass: pictures already made
      page.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 300));
      const t2 = [];
      last = performance.now();
      await new Promise((res) => {
        let k = 0;
        const step = () => { const now = performance.now(); t2.push(now - last); last = now; page.scrollTop += 60; if (++k < 90) requestAnimationFrame(step); else res(); };
        requestAnimationFrame(step);
      });
      t2.sort((a, b) => a - b);
      const imgsAfter = document.querySelectorAll('.plugins-page img').length;
      page.scrollTop = 0;
      times.sort((a, b) => a - b);
      return { n, w: Math.round(c.width), h: Math.round(c.height), imgs, imgsAfter, median: +times[times.length >> 1].toFixed(1), p95: +times[Math.floor(times.length * 0.95)].toFixed(1), max: +times[times.length - 1].toFixed(1), median2: +t2[t2.length >> 1].toFixed(1), p95b: +t2[Math.floor(t2.length * 0.95)].toFixed(1) };
    });
    console.log('view', v, JSON.stringify(r));
    await win.waitForTimeout(500);
    await win.screenshot({ path: `${S}/plugins-view-${v}.png` });
  }
  await win.click('.pl-views [data-view="tile"]');
  await win.waitForTimeout(800);
  console.log('view saved', await win.evaluate(() => localStorage.getItem('tz.pluginView')));

  // ---- detail + a knob turn in the sandbox from the UI
  await win.locator('.plugin-card', { hasText: 'Chase Bliss' }).first().click();
  await win.waitForTimeout(2500);
  await win.screenshot({ path: S + '/plugins-detail.png' });
  console.log('blocks in detail', await win.locator('.pd-block').count());
  await win.locator('.pd-block').nth(0).click();
  await win.waitForTimeout(1200);
  const knob = win.locator('.sb-svg .ctl.knob').first();
  const kb = await knob.boundingBox();
  await win.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2); await win.mouse.down(); await win.mouse.move(kb.x + kb.width / 2, kb.y - 60, { steps: 6 }); await win.mouse.up();
  await win.waitForTimeout(300);
  await win.screenshot({ path: S + '/plugins-sandbox.png' });
  await win.keyboard.press('Escape'); await win.waitForTimeout(200); await win.keyboard.press('Escape'); await win.waitForTimeout(300);

  // ---- sandbox on several blocks: every kind of control, screen clicks, status hooks
  const ids = await win.evaluate(async () => {
    const cat = await import('./js/catalog/index.js');
    const pick = (plug, n, f) => cat.pluginDefIds(plug).map(cat.getDef).filter((d) => d && !d.hidden && f(d)).slice(0, n).map((d) => d.id);
    const mfx = (d) => cat.kindOf(d) === 'Multi-FX';
    const hasDips = (d) => (d.controls || []).some((c) => c.t === 'screen' && /dip/.test(c.kind || ''));
    const pl = await import('./js/plugins.js');
    const withStatus = (d) => !!pl.hooksFor(d.id)?.status;
    return ['tz.atlas', 'tz.paraeq', ...pick('line6', 3, mfx), ...pick('kemper', 1, mfx), ...pick('fractal-audio', 2, mfx), ...pick('zoom', 2, mfx), ...pick('chase-bliss', 2, hasDips), ...pick('walrus-audio', 1, withStatus), ...pick('tc-helicon', 1, withStatus)];
  });
  console.log('sandbox blocks', ids.join(' '));
  const sig = () => win.evaluate(() => {
    const root = [...document.querySelectorAll('.sb-svg')].pop();
    const { block } = root._sandbox;
    const st = window.__tzState;
    return JSON.stringify([block.params, block.bypass, root.querySelector('.node').innerHTML.length, (st && st.ui[block.id]) || null]);
  });
  await win.evaluate(async () => { window.__tzState = (await import('./js/state.js')).state; });
  for (const id of ids) {
    const info = await win.evaluate(async (id) => {
      const [{ openSandbox }, cat, pl] = await Promise.all([import('./js/pages/plugins.js'), import('./js/catalog/index.js'), import('./js/plugins.js')]);
      const d = cat.getDef(id);
      const hk = pl.hooksFor(id);
      window.__statusN = 0;
      if (hk && hk.status && !hk.__wrapped) { const f = hk.status; hk.status = function (...a) { window.__statusN++; return f.apply(this, a); }; hk.__wrapped = true; }
      window.__sbClose = openSandbox(d);
      await new Promise((r) => setTimeout(r, 400));
      const root = [...document.querySelectorAll('.sb-svg')].pop();
      const { nv, block } = root._sandbox;
      const ctls = {};
      for (const [cid, { ctl }] of nv.views) {
        const k = ctl.t === 'screen' ? 'screen:' + ctl.kind : ctl.t;
        (ctls[k] = ctls[k] || []).push(cid);
      }
      return { name: d.name, ctls, hasStatus: !!(hk && hk.status), inPreset: window.__tzState.preset.blocks.includes(block), inJson: JSON.stringify(window.__tzState.preset).includes(block.id) };
    }, id);
    const box = async (cid) => {
      const l = win.locator(`.sb-svg [data-ctl="${cid}"]`).last();
      return (await l.count()) ? l.boundingBox() : null;
    };
    const results = [];
    const tryCtl = async (label, cid, act) => {
      const b = await box(cid);
      if (!b || b.width < 1) return results.push(label + ':nobox');
      const before = await sig();
      await act(b);
      await win.waitForTimeout(250);
      const after = await sig();
      results.push(label + (before !== after ? ':ok' : ':same'));
    };
    const click = (fx = 0.5, fy = 0.5) => async (b) => { await win.mouse.click(b.x + b.width * fx, b.y + b.height * fy); };
    const dragDown = async (b) => { await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await win.mouse.down(); await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 60, { steps: 5 }); await win.mouse.up(); };
    const dragAcross = async (b) => { await win.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5); await win.mouse.down(); await win.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.3, { steps: 6 }); await win.mouse.up(); };
    const dragUp = async (b) => { await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await win.mouse.down(); await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 50, { steps: 5 }); await win.mouse.up(); };
    const C = info.ctls;
    if (C.knob) await tryCtl('knob', C.knob[0], dragUp);
    if (C.slider) await tryCtl('slider', C.slider[0], dragUp);
    if (C.treadle) await tryCtl('treadle', C.treadle[0], dragDown);
    if (C.sel) await tryCtl('sel', C.sel[0], click());
    if (C.toggle) await tryCtl('toggle', C.toggle[0], click());
    if (C.button) await tryCtl('button', C.button[0], click());
    if (C.foot) {
      // some footswitches only send engine events (tap): count the ones that changed something
      const n0 = results.length;
      for (const cid of C.foot.slice(0, 6)) await tryCtl('f', cid, click());
      const fr = results.splice(n0);
      results.push(`foot:${fr.filter((x) => x.endsWith(':ok')).length}/${fr.length}`);
    }
    for (const k of Object.keys(C).filter((k) => k.startsWith('screen:'))) {
      for (const cid of C[k].slice(0, 2)) await tryCtl(k, cid, /dip/.test(k) ? click(0.08, 0.5) : k === 'screen:paraeq' ? dragAcross : click(0.5, 0.5));
      if (k === 'screen:paraeq') await tryCtl(k + '-top', C[k][0], click(0.05, 0.02));
    }
    await win.screenshot({ path: `${S}/sandbox-${id}.png` });
    const after = await win.evaluate(async () => {
      const root = [...document.querySelectorAll('.sb-svg')].pop();
      const { block } = root._sandbox;
      const n = window.__statusN;
      window.__sbClose();
      await new Promise((r) => setTimeout(r, 150));
      const st = window.__tzState;
      return { status: n, left: st.preset.blocks.includes(block), patched: Object.prototype.hasOwnProperty.call(st.preset.blocks, 'toJSON'), overlay: document.querySelectorAll('.pl-overlay.sandbox').length };
    });
    console.log(`${id} (${info.name}) inPreset ${info.inPreset} inJson ${info.inJson} status ${info.hasStatus ? after.status : '-'} | ${results.join(' ')} | closed: left ${after.left} patched ${after.patched} overlay ${after.overlay}`);
  }

  // ---- remove a built-in plugin, then restore it
  await win.locator('.plugin-card', { hasText: 'Dwarfcraft' }).first().click();
  await win.waitForTimeout(600);
  await win.locator('.pd-acts .btn-danger').click();
  await win.waitForTimeout(300);
  await win.click('.modal footer .btn-danger, .modal footer .btn-accent');
  await win.waitForTimeout(3000);
  const gone = await win.locator('.plugin-card', { hasText: 'Dwarfcraft' }).count();
  const hasDef = await win.evaluate(async () => !!(await import('./js/catalog/index.js')).getDef('dwc.destroyer')?.plugin);
  console.log('after remove: card', gone, 'def loaded', hasDef);
  await win.locator('.page-actions .btn', { hasText: 'Restore removed' }).click();
  await win.waitForTimeout(300);
  await win.click('.modal footer .btn-accent, .modal footer .btn-danger');
  await win.waitForTimeout(3000);
  console.log('after restore: card', await win.locator('.plugin-card', { hasText: 'Dwarfcraft' }).count());
  console.log('preset dirty', await win.evaluate(() => window.__tzState.dirty));
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
