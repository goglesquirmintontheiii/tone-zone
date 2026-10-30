// Screen scripts: the language (maths, loops, functions, tables, strings, errors with line numbers, the step
// budget), drawing to a canvas, widgets, the factory inspector, code editor and generator, a script that turns
// a knob and flips DIP switches on a saved pedal on the board (saved, undoable, sent to the engine), test mode
// input, and the board bitmap showing the screen.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const S = process.env.SHOTS || '/tmp';
const JS = path.join(__dirname, '..', 'renderer', 'js', 'screenscript');

let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? 'ok   ' : 'FAIL ') + msg);
  if (!cond) fails++;
};

async function unit() {
  const { VM } = await import(pathToFileURL(path.join(JS, 'vm.js')).href);
  const logs = [];
  const run = (src, o = {}) => {
    const vm = new VM(src, { log: (m) => logs.push(m) });
    vm.start(o.steps || 1e6, o.ms || 500);
    return vm;
  };
  const val = (src, name = 'r') => run(src).get(name);
  const err = (src) => {
    try {
      run(src);
      return null;
    } catch (e) {
      return e;
    }
  };
  ok(val('r = 1 + 2 * 3 - 4 / 2') === 5 && val('r = 7 // 2 + 7 % 3 + 2 ^ 3') === 12 && val('r = -3 % 5') === 2, 'maths and precedence');
  ok(val('r = math.floor(3.7) + math.max(1, 9, 4) + math.abs(-2) + math.clamp(5, 0, 1)') === 15, 'math library');
  ok(val('r = 0 for i = 1, 10 do r = r + i end') === 55 && val('r = 0 for i = 10, 1, -2 do r = r + 1 end') === 5, 'numeric for loops');
  ok(val('r = 0 local i = 0 while true do i += 1 if i > 4 then break end r = r + i end') === 10, 'while, break and +=');
  ok(val('r = 0 repeat local z = r r = r + 1 until z >= 3') === 4, 'repeat until sees the body locals');
  ok(val('local function fib(n) if n < 2 then return n end return fib(n - 1) + fib(n - 2) end r = fib(20)') === 6765, 'recursive functions');
  ok(val('local fs = {} for i = 1, 3 do fs[i] = function() return i end end r = fs[1]() + fs[2]() + fs[3]()') === 6, 'closures capture each loop pass');
  ok(val('local function mk() local n = 0 return function() n = n + 1 return n end end local c = mk() c() c() r = c()') === 3, 'closures keep their own state');
  ok(val('local a, b = (function() return 1, 2 end)() r = a * 10 + b') === 12, 'multiple return values');
  ok(val('local t = {1, 2, 3, x = 5} table.insert(t, 4) r = #t + t.x + t[4]') === 13, 'tables: list part, fields, insert, length');
  ok(val('local t = {} for k, v in pairs({a = 1, b = 2, 3}) do t[#t + 1] = v end r = #t') === 3, 'pairs');
  ok(val('local s = 0 for i, v in ipairs({5, 6, 7}) do s = s + i * v end r = s') === 38, 'ipairs');
  ok(val('local t = {3, 1, 2} table.sort(t) r = table.concat(t, ",")') === '1,2,3', 'table.sort and concat');
  ok(val('local p = {x = 1} function p:move(d) self.x = self.x + d end p:move(4) r = p.x') === 5, 'methods with :');
  ok(val('r = ("Hello"):upper() .. #"abc" .. ("abcdef"):sub(2, 4)') === 'HELLO3bcd', 'string methods and ..');
  ok(val('r = string.format("%05.1f|%d|%s|%x", 3.14159, 42, "hi", 255)') === '003.1|42|hi|ff', 'string.format');
  ok(val('r = #("a,b,c"):split(",")') === 3 && val('r = ("  x "):trim()') === 'x', 'split and trim');
  ok(val('r = tostring(1.5) .. tostring(nil) .. tostring(true) .. type({})') === '1.5niltruetable', 'tostring and type');
  ok(val('local ok, e = pcall(function() error("boom") end) r = (not ok) and e') === 'line 1: boom', 'pcall catches errors');
  ok(val('r = 1 != 2') === true, 'friendly != operator');
  // errors with line numbers
  const e1 = err('x = 1\nif x then\n  y = 2\n');
  ok(e1 && e1.kind === 'syntax' && e1.line === 4 && /close 'if'/.test(e1.message), 'syntax error names the missing end (' + (e1 && e1.message) + ')');
  const e2 = err('local t = nil\n\nprint(t.x)');
  ok(e2 && e2.kind === 'runtime' && e2.line === 3, 'runtime error on line 3: ' + (e2 && e2.message));
  const e3 = err('drawz()');
  ok(e3 && /drawz/.test(e3.message) && /not defined/.test(e3.message), 'calling an unknown function says so');
  const e4 = err('x = "a" + {}');
  ok(e4 && e4.line === 1 && /math/.test(e4.message), 'maths on a table is an error');
  // the budget stops runaway code
  let t0 = Date.now();
  const e5 = err('local i = 0\nwhile true do\n  i = i + 1\nend');
  ok(e5 && e5.kind === 'budget' && e5.line === 2 && Date.now() - t0 < 2000, `an endless loop is stopped (${Date.now() - t0} ms, line ${e5 && e5.line})`);
  const e6 = err('local function f() return f() + 1 end f()');
  ok(e6 && /nested/.test(e6.message), 'endless recursion is stopped');
  const vmB = run('function draw() while true do end end');
  t0 = Date.now();
  let e7 = null;
  try {
    vmB.call('draw', [], 150000, 10);
  } catch (e) {
    e7 = e;
  }
  ok(e7 && e7.kind === 'budget' && Date.now() - t0 < 500, 'a frame that never ends is stopped within its budget');
  const e8 = err('local ok = pcall(function() while true do end end)');
  ok(e8 && e8.kind === 'budget', 'pcall can not catch the budget');
  // sandbox: nothing from the outside world
  ok(val('r = (window == nil) and (require == nil) and (globalThis == nil) and (os == nil) and (io == nil) and (load == nil) and (process == nil)') === true, 'no window, require, os, io, load or process');
  ok(val('r = ("x").constructor') === undefined, 'no JS properties through strings');
  const e9 = err('r = print.constructor');
  ok(e9 && /function/.test(e9.message), 'functions can not be indexed');
  const e10 = err('r = string.rep("x", 1e9)');
  ok(e10 && /too long/.test(e10.message), 'huge strings are refused');
  // speed: a typical frame is far below a millisecond
  const vmS = run('function draw() local s = 0 for i = 1, 2000 do s = s + math.sin(i) * 0.5 end return s end');
  t0 = Date.now();
  for (let i = 0; i < 200; i++) vmS.call('draw', [], 1e6, 100);
  const per = (Date.now() - t0) / 200;
  ok(per < 3, `2000 loop passes take ${per.toFixed(2)} ms`);
}

(async () => {
  await unit();

  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-screens-'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env, XDG_DATA_HOME: data } });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });

  // ---- drawing to an offscreen canvas
  const px = await win.evaluate(async () => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const rt = new ScreenRuntime({ src: `
function draw()
  clear("#000000")
  fillRect(0, 0, 8, 8, "#ff0000")
  pixel(20, 2, "#00ff00")
  line(0, 20, 63, 20, "#0000ff")
  text("AB", 30, 4, "#ffffff")
  fillCircle(52, 8, 5, "#ffff00")
  icon("heart", 40, 22, 9, "#ff00ff")
  digits("8", 2, 22, 9, "#00ffff")
end`, w: 64, h: 32, host: null, readBack: true });
    rt.frame(performance.now());
    const g = rt.g;
    const at = (x, y) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)].join(',');
    const count = (x, y, w, h, f) => { const d = g.getImageData(x, y, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (f(d[i], d[i + 1], d[i + 2])) n++; return n; };
    return {
      err: rt.error,
      red: at(3, 3), green: at(20, 2), blue: at(10, 20), yellow: at(52, 8),
      white: count(30, 4, 12, 8, (r, g2, b) => r > 200 && g2 > 200 && b > 200),
      magenta: count(40, 22, 10, 10, (r, g2, b) => r > 150 && b > 150 && g2 < 80),
      cyan: count(0, 21, 12, 11, (r, g2, b) => g2 > 150 && b > 150 && r < 80),
    };
  });
  ok(!px.err && px.red === '255,0,0' && px.green === '0,255,0' && px.blue === '0,0,255' && px.yellow === '255,255,0', `shapes land on the right pixels (${px.red} ${px.green} ${px.blue} ${px.yellow})`);
  ok(px.white > 10 && px.magenta > 10 && px.cyan > 6, `text, icons and digits draw (${px.white}, ${px.magenta}, ${px.cyan})`);

  // widgets get pointer input; errors draw on the screen
  const wd = await win.evaluate(async () => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const rt = new ScreenRuntime({ src: 'clicks = 0\nv = 0.2\non = false\nfunction draw()\n  clear()\n  if button("GO", 0, 0, 40, 12) then clicks = clicks + 1 end\n  v = slider("V", 0, 14, 60, 10, v)\n  on = toggle("T", 0, 26, 60, 10, on)\nend', w: 64, h: 40, host: null });
    const t = performance.now();
    rt.frame(t);
    rt.pointer('down', 10, 5); rt.pointer('up', 10, 5); rt.frame(t + 40);
    rt.pointer('down', 30, 18); rt.frame(t + 80); rt.pointer('move', 45, 18); rt.frame(t + 120); rt.pointer('up', 45, 18); rt.frame(t + 160);
    rt.pointer('down', 50, 30); rt.pointer('up', 50, 30); rt.frame(t + 200);
    const bad = new ScreenRuntime({ src: 'function draw()\n  clear()\n  local x = nil + 1\nend', w: 64, h: 32, host: null, readBack: true });
    bad.frame(t);
    const redTop = [...bad.g.getImageData(10, 3, 1, 1).data.slice(0, 3)];
    return { clicks: rt.vm.get('clicks'), v: rt.vm.get('v'), on: rt.vm.get('on'), badLine: bad.error && bad.error.line, redTop };
  });
  ok(wd.clicks === 1 && Math.abs(wd.v - 0.75) < 0.03 && wd.on === true, `button, slider and toggle react (${wd.clicks}, ${wd.v.toFixed(2)}, ${wd.on})`);
  ok(wd.badLine === 3 && wd.redTop[0] > 200, 'a script error shows on the screen with its line');

  // text fields take typing, control changes call onControl, saved values come back
  const ev = await win.evaluate(async () => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { makeHost, simIO } = await import('./js/screenscript/host.js');
    const design = { ctls: [{ id: 'k1', kind: 'knob', label: 'GAIN', value: 0.5 }, { id: 'f1', kind: 'foot', label: '', map: { to: 'bypass' } }] };
    const { io, sim } = simIO(design, { demo: false });
    const host = makeHost(design, io);
    const src = 'name = "ab"\nchanges = 0\nfoots = 0\nfunction onControl(n, v) changes = changes + 1 last = n end\nfunction onFoot(n, on) foots = foots + 1 end\nsave("kept", {1, 2, x = "y"})\nfunction draw()\n  clear()\n  name = textfield("n", 0, 0, 60, 12, name)\nend';
    const rt = new ScreenRuntime({ src, w: 64, h: 40, host });
    let t = performance.now();
    rt.frame(t);
    rt.pointer('down', 10, 5); rt.pointer('up', 10, 5); rt.frame((t += 40));
    const kb = !!rt.focus;
    for (const k of ['c', 'd', 'Backspace', 'e', 'Enter']) rt.key({ key: k });
    rt.frame((t += 40));
    io.set('u.k1', 0.8);
    sim.bypass = true;
    rt.frame((t += 40));
    rt.frame((t += 1000));
    const rt2 = new ScreenRuntime({ src: 'k = load("kept", nil)\nr = k[2] + #k .. k.x\nmissing = load("nope", 7)', w: 32, h: 16, host });
    rt2.frame(t);
    return { kb, name: rt.vm.get('name'), changes: rt.vm.get('changes'), last: rt.vm.get('last'), foots: rt.vm.get('foots'), kept: rt2.vm.get('r'), missing: rt2.vm.get('missing'), err: rt.error || rt2.error };
  });
  ok(ev.kb && ev.name === 'abce', `a text field opens the keyboard and takes typing (${ev.name})`);
  ok(ev.changes === 2 && ev.foots === 1, `onControl and onFoot are called (${ev.changes}, ${ev.foots}, ${ev.last})`);
  ok(ev.kept === '4y' && ev.missing === 7 && !ev.err, 'save and load keep values');

  // ---- the factory: Shows -> Custom, code editor, generator
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForSelector('.fz-stage');
  await win.click('#fzTemplates');
  await win.click('[data-template="synth"]');
  await win.waitForTimeout(400);
  const D = () => win.evaluate(() => JSON.parse(JSON.stringify(window.__tzFactory.design())));
  const d0 = await D();
  const scr = d0.ctls.find((c) => c.kind === 'screen');
  await win.evaluate((id) => window.__tzFactory.select(id), scr.id);
  await win.waitForTimeout(200);
  const showsSel = '.fz-row:has(> label:text-is("Shows")) select';
  ok((await win.$eval(showsSel, (s) => s.value)) === 'text', 'a screen shows basic text by default');
  await win.selectOption(showsSel, 'custom');
  await win.waitForTimeout(500);
  const d1 = await D();
  const s1 = d1.ctls.find((c) => c.id === scr.id);
  ok(s1.shows === 'custom' && /function draw/.test(s1.script), 'Custom gives the screen a starting script');
  ok(!!(await win.$('[data-ss="edit"]')) && !!(await win.$('[data-ss="gen"]')) && !!(await win.$('[data-ss="template"]')), 'inspector has Edit code, Generate and templates');
  const st1 = await win.evaluate(() => window.__tzScreens.stage());
  ok(st1.length === 1 && st1[0].connected && !st1[0].error && st1[0].frames > 0, 'the stage runs the screen live ' + JSON.stringify(st1));
  await win.screenshot({ path: path.join(S, 'screens-inspector.png') });
  await win.selectOption('[data-ss="template"]', 'readout');
  await win.waitForTimeout(300);
  ok(/knob\(name\)/.test((await D()).ctls.find((c) => c.id === scr.id).script), 'a template replaces the script');

  // code editor
  await win.click('[data-ss="edit"]');
  await win.waitForSelector('.ss-win .ss-ta');
  await win.waitForTimeout(400);
  let ed = await win.evaluate(() => window.__tzScreens.editor().peek());
  ok(!ed.error && ed.frames > 2, 'the editor preview runs');
  ok((await win.$$('.ss-hl .ss-t-kw')).length > 3 && (await win.$$('.ss-hl .ss-t-api')).length > 3, 'code is highlighted');
  ok((await win.$$('.ss-gutter-in div')).length >= 10, 'line numbers');
  // type a new script: auto indent, then a syntax error, then fix it
  await win.click('.ss-ta');
  await win.keyboard.press('Control+A');
  await win.keyboard.press('Delete');
  await win.keyboard.type('function draw()');
  await win.keyboard.press('Enter');
  ok((await win.$eval('.ss-ta', (t) => t.value)) === 'function draw()\n  ', 'Enter after function() indents');
  await win.keyboard.type('clear()');
  await win.keyboard.press('Enter');
  await win.keyboard.type('end');
  ok((await win.$eval('.ss-ta', (t) => t.value)) === 'function draw()\n  clear()\nend', 'typing end moves it back');
  await win.keyboard.press('Enter');
  await win.keyboard.type('if x then');
  await win.waitForTimeout(600);
  ok((await win.$$('.ss-gutter-in div.err')).length === 1 && (await win.$eval('.ss-status', (s) => s.className)).includes('bad'), 'a syntax error is marked in the gutter and status');
  ok(/close 'if'/.test(await win.$eval('.ss-status', (s) => s.textContent)), 'the status says what is missing');
  await win.keyboard.press('Control+A');
  await win.keyboard.press('Delete');
  await win.keyboard.insertText(`-- turn the knob and a DIP from the screen
local done = false
function draw()
  clear()
  if not done then
    setKnob("CUTOFF", 0.9)
    setDip("VOICE", 2, true)
    setDip(4, true)
    done = true
  end
  text("CUT " .. math.floor(knob("CUTOFF") * 100), 4, 4, colors.fg, 14, nil, "condensed")
  meter(4, H - 12, W - 8, 8, signal("in"))
  if button(dip(1) and "DIP1 ON" or "DIP1 OFF", W - 64, 4, 60, 16) then setDip(1, not dip(1)) end
end
`);
  await win.waitForTimeout(700);
  ed = await win.evaluate(() => window.__tzScreens.editor().peek());
  const dip = d1.ctls.find((c) => c.kind === 'dip');
  const cut = d1.ctls.find((c) => c.label === 'CUTOFF');
  ok(!ed.error && Math.abs(ed.sim['u.' + cut.id] - 0.9) < 1e-6 && ed.sim['u.' + dip.id + '.1'] === 1 && ed.sim['u.' + dip.id + '.3'] === 1, 'the preview script turns the simulated knob and DIPs');
  ok(await win.evaluate((k) => Math.abs(+document.querySelector(`.ss-pane-test [data-ctl="${k}"]`).value - 0.9) < 0.01, cut.id), 'the simulated control follows the script');
  // click the button on the preview
  const pc = await (await win.$('.ss-pcanvas')).boundingBox();
  await win.mouse.click(pc.x + pc.width - 20, pc.y + 16);
  await win.waitForTimeout(150);
  ed = await win.evaluate(() => window.__tzScreens.editor().peek());
  ok(ed.sim['u.' + dip.id + '.0'] === 1, 'clicking a button on the preview flips DIP 1');
  // find
  await win.click('.ss-ta');
  await win.keyboard.press('Control+F');
  await win.keyboard.type('setDip');
  await win.waitForTimeout(150);
  ok((await win.$('.ss-find.open')) && /of 3/.test(await win.$eval('.ss-fcount', (e) => e.textContent)), 'find shows the matches');
  await win.keyboard.press('Escape');
  await win.click('.ss-tabs [data-tab="ref"]');
  ok((await win.$$('.ss-refitem')).length > 60, 'the API reference is in the editor');
  await win.screenshot({ path: path.join(S, 'screens-editor.png') });
  await win.click('.ss-tabs [data-tab="test"]');
  await win.click('[data-ss="done"]');
  await win.waitForTimeout(300);
  ok(/setKnob\("CUTOFF", 0.9\)/.test((await D()).ctls.find((c) => c.id === scr.id).script), 'the code is kept in the design');

  // generator
  await win.click('[data-ss="gen"]');
  await win.waitForSelector('.ss-gcard');
  await win.waitForTimeout(700);
  const gen = await win.evaluate(() => window.__tzScreens.generator().errors());
  ok(gen.length === 8 && gen.every((g) => !g.error && g.frames > 3), 'every generator style runs without errors: ' + gen.filter((g) => g.error).map((g) => g.style + ': ' + g.error.message).join('; '));
  await win.screenshot({ path: path.join(S, 'screens-generator.png') });
  await win.click('.ss-gcard[data-style="tft"]');
  await win.click('[data-ss="use"]');
  await win.waitForTimeout(300);
  ok(/theme\("tft"\)/.test((await D()).ctls.find((c) => c.id === scr.id).script), 'the generated code replaces the script');
  // every style also runs for other designs and screen sizes
  const allGen = await win.evaluate(async () => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { makeHost, simIO, controlList } = await import('./js/screenscript/host.js');
    const out = [];
    for (const tid of ['drive', 'delay', 'synth', 'glass']) {
      const D = window.__tzFactory.template(tid);
      const names = controlList(D).map((e) => e.name);
      for (const [w, h] of [[120, 56], [200, 88], [72, 72]]) {
        for (const style of window.__tzScreens.styles()) {
          const code = window.__tzScreens.generate(style, { title: D.name, items: [...names.slice(0, 4), 'in', 'out'], signals: ['in', 'out'] });
          const rt = new ScreenRuntime({ src: code, w, h, host: makeHost(D, simIO(D).io) });
          const t = performance.now();
          for (let i = 0; i < 6; i++) rt.frame(t + i * 40);
          if (rt.error) out.push(`${tid} ${w}x${h} ${style}: line ${rt.error.line} ${rt.error.message}`);
        }
      }
    }
    return out;
  });
  ok(allGen.length === 0, 'generated code runs for 4 designs at 3 sizes: ' + allGen.slice(0, 3).join('; '));

  // the knob and DIP script again, then save as a block
  await win.evaluate((id) => {
    const d = window.__tzFactory.design();
    const c = d.ctls.find((x) => x.id === id);
    c.script = `local done = false
function draw()
  clear()
  if not done then
    setKnob("CUTOFF", 0.9)
    setDip("VOICE", 2, true)
    setDip(4, true)
    done = true
  end
  text("CUT " .. math.floor(knob("CUTOFF") * 100), 4, 4, colors.fg, 14, nil, "condensed")
  meter(4, H - 12, W - 8, 8, signal("in"))
  if button(dip(1) and "DIP1 ON" or "DIP1 OFF", W - 64, 4, 60, 16) then setDip(1, not dip(1)) end
end
`;
    window.__tzFactory.load(d);
  }, scr.id);
  await win.waitForTimeout(300);

  // test mode: the stage screen is playable and drives the test block
  await win.evaluate(() => window.__tzFactory.test(true));
  await win.waitForTimeout(800);
  let ti = await win.evaluate(() => window.__tzFactory.testInfo());
  ok(Math.abs(ti.params['u.' + cut.id] - 0.9) < 1e-6 && ti.params['u.' + dip.id + '.1'] === 1, 'in test mode the script sets the test block params');
  const sc = await (await win.$('.fz-stage canvas.ss-play')).boundingBox();
  await win.mouse.click(sc.x + sc.width - sc.width * 0.15, sc.y + sc.height * 0.15);
  await win.waitForTimeout(200);
  ti = await win.evaluate(() => window.__tzFactory.testInfo());
  ok(ti.params['u.' + dip.id + '.0'] === 1, 'clicking the screen in test mode flips DIP 1');
  await win.evaluate(() => window.__tzFactory.test(false));
  await win.waitForTimeout(200);

  await win.click('#fzSaveBlock');
  await win.waitForFunction(() => !!window.__tzFactory.design().blockId, null, { timeout: 5000 });
  const blockId = (await D()).blockId;
  const saved = JSON.parse(fs.readFileSync(path.join(data, 'tone-zone', 'custom-blocks', blockId + '.json'), 'utf8'));
  const sc0 = saved.design.ctls.find((c) => c.kind === 'screen');
  ok(sc0.shows === 'custom' && /setKnob/.test(sc0.script), 'the script is saved with the pedal');

  // ---- on the board
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(300);
  const board = await win.evaluate(async ({ id, cutId, dipId }) => {
    const m = await import('./js/state.js');
    const b = m.addBlock(id, 900, 700);
    const before = m.engineParamsFor({ id: 'x', type: id, params: {} }); // the defaults
    const ed2 = window.__tz.editor;
    ed2.view.z = 1.8;
    ed2.view.x = -b.x * 1.8 + 400;
    ed2.view.y = -b.y * 1.8 + 150;
    ed2.applyView && ed2.applyView();
    await new Promise((r) => setTimeout(r, 1200));
    const bb = m.blockById(b.id);
    const after = m.engineParamsFor(bb);
    const k = Object.keys(after).find((x) => !x.startsWith('u.') && after[x] !== before[x] && typeof after[x] === 'number');
    const { boardScreens } = await import('./js/screenscript/board.js');
    const v = ed2.views.get(b.id);
    return { bid: b.id, knob: bb.params['u.' + cutId], dip2: bb.params['u.' + dipId + '.1'], dip4: bb.params['u.' + dipId + '.3'], filterBefore: before[k], filterAfter: after[k], fkey: k, screens: boardScreens(), img: !!v.g.querySelector('.ss-board image.ss-img[href^="data:image/png"]'), undo: m.canUndo() };
  }, { id: blockId, cutId: cut.id, dipId: dip.id });
  ok(Math.abs(board.knob - 0.9) < 1e-6 && board.dip2 === 1 && board.dip4 === 1, 'on the board the script turned the knob and flipped two DIPs');
  ok(board.filterAfter !== board.filterBefore && typeof board.filterAfter === 'number', `the engine gets the mapped values (${board.fkey}: ${board.filterBefore} -> ${board.filterAfter})`);
  const bs = board.screens.find((x) => x.key.startsWith(board.bid));
  ok(bs && !bs.error && bs.frames > 5 && bs.connected && board.img, `the board screen repaints (${bs && bs.frames} frames)`);
  ok(board.undo, 'the change is undoable');
  // click the button on the board screen
  const scrBox = await (await win.$(`[data-node="${board.bid}"] .ss-board`)).boundingBox();
  await win.mouse.click(scrBox.x + scrBox.width * 0.85, scrBox.y + scrBox.height * 0.2);
  await win.waitForTimeout(300);
  const clicked = await win.evaluate(async ({ bid, dipId }) => (await import('./js/state.js')).blockById(bid).params['u.' + dipId + '.0'], { bid: board.bid, dipId: dip.id });
  ok(clicked === 1, 'clicking the button on the board screen flips DIP 1');
  // undo brings the DIP back
  const undone = await win.evaluate(async ({ bid, dipId }) => {
    const m = await import('./js/state.js');
    m.undo();
    await new Promise((r) => setTimeout(r, 300));
    return m.blockById(bid).params['u.' + dipId + '.0'];
  }, { bid: board.bid, dipId: dip.id });
  ok(undone !== 1, 'undo puts DIP 1 back');
  // the bitmap of the block (zoomed out, thumbnails) shows the screen
  const lod = await win.evaluate(async (bid) => {
    const v = window.__tz.editor.views.get(bid);
    const okLod = v.makeLOD ? await v.makeLOD(1) : true;
    const { renderForm } = await import('./js/gfx/forms.js');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const def = Object.create(v.def);
    def.ports = v.def.ports;
    renderForm({ g, views: new Map(), flip: false, thumb: true }, def);
    return { okLod, still: !!g.querySelector('image[href^="data:image/png"]'), noLive: !g.querySelector('foreignObject') };
  }, board.bid);
  ok(lod.okLod, 'the block bitmap is made with the screen in it');
  ok(lod.still && lod.noLive, 'thumbnails show the last frame of the screen');
  await win.screenshot({ path: path.join(S, 'screens-board.png') });

  // ---- a few generated screens on pedals, for a look
  const looks = [['delay', 'amp'], ['delay', 'vu'], ['synth', 'pixel'], ['delay', 'phosphor'], ['synth', 'digits'], ['delay', 'tuner']];
  const ids = [];
  for (const [tid, style] of looks) {
    const id = await win.evaluate(async ({ tid, style }) => {
      const { controlList } = await import('./js/screenscript/host.js');
      const { saveCustomBlock } = await import('./js/catalog/custom.js');
      const D = window.__tzFactory.template(tid);
      const c = D.ctls.find((x) => x.kind === 'screen');
      c.shows = 'custom';
      c.type = { amp: 'tft', vu: 'lcd', pixel: 'tft', phosphor: 'oled', digits: 'amber', tuner: 'oled' }[style];
      const names = controlList(D).filter((e) => e.kind === 'knob').map((e) => e.name);
      c.script = window.__tzScreens.generate(style, { title: D.name.toUpperCase(), items: [...names.slice(0, 3), 'in'], signals: ['in', 'out'] });
      D.name = D.name + ' ' + style;
      D.blockId = null;
      return saveCustomBlock(D, { asNew: true });
    }, { tid, style });
    ids.push(id);
  }
  const placed = await win.evaluate(async (ids) => {
    const m = await import('./js/state.js');
    const out = ids.map((id, i) => m.addBlock(id, 3000 + i * 900, 3000).id);
    await new Promise((r) => setTimeout(r, 300));
    return out;
  }, ids);
  for (let i = 0; i < placed.length; i++) {
    const box = await win.evaluate(async (bid) => {
      const ed2 = window.__tz.editor;
      const v = ed2.views.get(bid);
      const z = 1.7;
      ed2.view.z = z;
      ed2.view.x = -(v.block.x + v.w / 2) * z + 640;
      ed2.view.y = -(v.block.y + v.h / 2) * z + 470;
      ed2.applyView && ed2.applyView();
      await new Promise((r) => setTimeout(r, 900));
      const r = v.g.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }, placed[i]);
    const clip = { x: Math.max(0, box.x - 10), y: Math.max(60, box.y - 10), width: Math.min(1280, box.width + 20), height: Math.min(880, box.height + 20) };
    await win.screenshot({ path: path.join(S, `screens-look-${looks[i][1]}.png`), clip });
  }
  const running = await win.evaluate(async (out) => {
    const { boardScreens } = await import('./js/screenscript/board.js');
    return boardScreens().filter((s) => out.some((b) => s.key.startsWith(b + '|')));
  }, placed);
  ok(running.length === looks.length && running.every((s) => !s.error && s.frames > 3), 'six generated screens run on the board: ' + running.filter((s) => s.error).map((s) => s.error.message).join('; '));

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await app.close();
  console.log(fails ? `${fails} FAILED` : 'all passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
