// Screen scripts: the language (maths, loops, functions, tables, strings, errors with line numbers, the step
// budget), drawing to a canvas, widgets, the factory inspector, code editor and generator, a script that turns
// a knob and flips DIP switches on a saved pedal on the board (saved, undoable, sent to the engine), test mode
// input, the board bitmap showing the screen, and the editor's type hints (completion, signature help, hovers,
// checks) with the screen ports docs.
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

  // the docs: docs/screen-scripts.md has the reference from docs.js, with the screen ports guide
  const { apiMarkdown, SIGS, API } = await import(pathToFileURL(path.join(JS, 'docs.js')).href);
  const md = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'screen-scripts.md'), 'utf8');
  ok(md.includes(apiMarkdown()), 'docs/screen-scripts.md has the current reference from docs.js');
  ok(['## Screen ports', '### Adding inputs and outputs', '### Reading inputs', '### Writing outputs', '### A screen wired both ways', '### Hints while you type'].every((h) => md.includes(h + '\n')), 'the docs have the screen ports and hints sections');
  ok(!/[\u2013\u2014]/.test(md + JSON.stringify(API)), 'no em or en dashes in the docs');
  const noSig = API.flatMap((g) => g.items.map(([n]) => n)).filter((n) => !SIGS.has(n) && !['W', 'screen', 'colors', 'mouse', 'math', 'string', 'table', 'pairs', 'tostring', 'pcall', 'ctl', 'pedalOn', 'clip', 'push', 'translate'].includes(n));
  ok(noSig.length === 0, 'every API function has types for the hints: ' + noSig.join(', '));
  // hints for on(): event names, the right kind of name, checks
  const HN = await import(pathToFileURL(path.join(JS, 'hints.js')).href);
  const hctx = { controls: [{ name: 'Rate', kind: 'knob' }, { name: 'A', kind: 'foot' }], findControl: (n, k) => (k === 'foot' ? ['a'] : ['rate']).includes(String(n).toLowerCase()), ports: { ins: [{ name: 'Gate', sig: 'b' }], outs: [] } };
  const evc = HN.completions('on("foot', 8, hctx);
  ok(evc && evc.items.map((i) => i.label).sort().join(',') === 'footswitch_down,footswitch_up', 'on(" offers the event names');
  const tgt = HN.completions('on("encoder", "', 15, hctx);
  ok(tgt && tgt.items.map((i) => i.label).join(',') === 'Rate', 'on("encoder", " offers the knobs');
  const evl = HN.lint('on("chnge", function(e) end)\non("input", "Nope", function(e) end)\non("touch", "x", function(e) end)\non("footswitch_down", "A", function(e) end)', hctx).map((w) => w.message);
  ok(evl.length === 3 && /Did you mean "change"/.test(evl[0]) && /no input called "Nope"/.test(evl[1]) && /takes no name/.test(evl[2]), 'on() checks the event and its name: ' + evl.join(' | '));

  // files: paths, the store and its budget, bin.pack / bin.unpack
  const F = await import(pathToFileURL(path.join(JS, 'files.js')).href);
  const BF = await import(pathToFileURL(path.join(JS, 'binfmt.js')).href);
  const pathErr = (p) => { try { F.checkPath(p); return ''; } catch (e) { return e.message; } };
  ok(F.checkPath('presets/a b-1.txt') === 'presets/a b-1.txt' && /\.\./.test(pathErr('../x')) && /start inside/.test(pathErr('/etc/x')) && /empty folder/.test(pathErr('a//b')) && /not a good name/.test(pathErr('.hidden')) && pathErr('a\\b') !== '', 'paths are sandboxed (no .., no absolute paths, sane names)');
  const st = new F.FileStore({ base: () => ({ 'util.lua': 'return 1', 'seed.txt': 'x' }), fixed: () => 1000 });
  st.write('d/a.bin', new Uint8Array([0, 255, 7]));
  st.remove('seed.txt');
  ok(st.list('').join(',') === 'util.lua,d/' && st.list('d').join(',') === 'a.bin' && st.used() === 1000 + 8 + 3 && F.toStored(st.read('d/a.bin')).b64 === 'AP8H', 'the store lists, removes base files and keeps bytes: ' + st.list('').join(','));
  let bigErr = '';
  try { st.write('big.bin', new Uint8Array(F.FILE_BUDGET - 1000)); } catch (e) { bigErr = e.message; }
  ok(/1 MB/.test(bigErr) && !st.has('big.bin'), 'a write over 1 MB is refused: ' + bigErr);
  const packed = BF.packBin('<I2 h > I f d s1 z c4 x B', [513, -2, 0x01020304, 1.5, Math.PI, 'hi', 'zero', 'ab', 200]);
  const back = BF.unpackBin('<I2 h > I f d s1 z c4 x B', packed);
  ok(packed.length === 2 + 2 + 4 + 4 + 8 + 3 + 5 + 4 + 1 + 1 && back[0] === 513 && back[1] === -2 && back[2] === 0x01020304 && back[3] === 1.5 && back[4] === Math.PI && back[5] === 'hi' && back[6] === 'zero' && back[7] === 'ab\0\0' && back[8] === 200 && back[9] === packed.length + 1, 'bin.pack and bin.unpack round trip little and big endian ints, floats and text');
  let fitErr = '';
  try { BF.packBin('B', [300]); } catch (e) { fitErr = e.message; }
  ok(/does not fit/.test(fitErr) && BF.sizeBin('<I2 f d') === 14, 'bin checks sizes: ' + fitErr);
  // hints across files: what a code file returns, completion after util., require(" and checks
  const mods = [{ name: 'util', path: 'util.lua', info: HN.moduleInfo('local M = {}\nfunction M.twice(x) return x * 2 end\nM.half = function(v) return v / 2 end\nfunction shout(s) return s end\nreturn M') }];
  const mctx = { ...hctx, modules: mods, files: ['util.lua', 'presets/1.txt'], file: '' };
  const src1 = 'local util = require("util")\nutil.';
  const mc = HN.completions(src1, src1.length, mctx);
  ok(mc && mc.items.map((i) => i.label).sort().join(',') === 'half,twice' && /from util.lua/.test(mc.items[0].detail), 'util. offers the functions util.lua returns: ' + (mc && mc.items.map((i) => i.label + ' ' + i.detail).join('; ')));
  const rq = HN.completions('require("u', 10, mctx);
  ok(rq && rq.items[0].label === 'util', 'require(" offers the code files');
  const fr = HN.completions('fs.read("pre', 12, mctx);
  ok(fr && fr.items.some((i) => i.label === 'presets/1.txt'), 'fs.read(" offers the pedal\'s files');
  const gl = HN.completions('sho', 3, mctx);
  ok(gl && gl.items[0].label === 'shout' && /util.lua/.test(gl.items[0].detail), 'globals of other files are offered');
  const ml = HN.lint('local u = require("utl")\nshout("x")\nfs.reed("a")', mctx).map((w) => w.message);
  ok(ml.length === 2 && /no code file "utl.lua".*"util"/.test(ml[0]) && /fs.reed is not a fs function.*fs.read/.test(ml[1]), 'checks: a missing code file, a typo in fs: ' + ml.join(' | '));
  const hv = HN.hoverAt('local util = require("util")\nutil.twice(2)', 36, mctx);
  ok(hv && /function util.twice\(x\)/.test(hv.title) && /util.lua on line 2/.test(hv.body), 'hovering util.twice says where it is: ' + (hv && hv.title));
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

  // events: on(event, [name], fn)
  const evs = await win.evaluate(async () => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { makeHost, simIO } = await import('./js/screenscript/host.js');
    const design = { ctls: [
      { id: 'k1', kind: 'knob', label: 'GAIN', value: 0.5 },
      { id: 'e1', kind: 'knob', part: 'encoder', label: 'RATE', value: 0.95 },
      { id: 'f1', kind: 'foot', label: 'A', map: { to: 'c1.on' } },
      { id: 'f2', kind: 'foot', label: '', map: { to: 'bypass' } },
      { id: 's1', kind: 'screen', label: 'S', sio: { ins: [{ id: 'p1', name: 'Env', sig: 'n' }, { id: 'p2', name: 'Gate', sig: 'b' }], outs: [] } },
    ] };
    const { io, sim } = simIO(design, { demo: false });
    io.cid = 's1';
    const host = makeHost(design, io);
    const src = `
log = {}
local function add(s) log[#log + 1] = s end
downs, ups, enc, changes, gate, offCount, good, timers = 0, 0, {}, {}, {}, 0, 0, 0
on("footswitch_down", "A", function(e) downs += 1 add("down " .. e.name) end)
on("footswitch_up", "A", function(e) ups += 1 add("up") end)
on("encoder", "RATE", function(e) enc[#enc + 1] = e.dir * e.steps add("enc") end)
on("change", "GAIN", function(e) changes[#changes + 1] = e.old .. ">" .. e.value add("change") end)
on("input", "Gate", function(e) gate[#gate + 1] = e.port .. ":" .. e.old .. ">" .. e.value end)
local h = on("change", function(e) offCount += 1 end)
on("change", "GAIN", function(e)
  local x = nil
  return x.boom
end)
on("change", "GAIN", function(e) good += 1 end)
on("bypass", function(e) add(e.on and "on" or "off") end)
on("timer", 100, function(e) timers = e.count end)
function stopIt() h:off() end
function draw() clear() end
`;
    const rt = new ScreenRuntime({ src, w: 64, h: 32, host });
    let t = 1000;
    const step = () => rt.frame((t += 40));
    io.set('u.f1', 0);
    step();
    io.set('u.f1', 1); step();
    io.set('u.f1', 0); step();
    io.set('u.e1', 0.02); step(); // clockwise through the top: wraps
    io.set('u.e1', 0.9); step(); // back, counter clockwise
    io.set('u.k1', 0.8); step();
    io.set('u.k1', 0.8); step(); // no change, no event
    sim.ports.set(1, 1); step();
    rt.vm.call('stopIt', [], 1e5, 10);
    io.set('u.k1', 0.3); step();
    sim.bypass = true; step();
    for (let i = 0; i < 6; i++) step();
    const g = (n) => rt.vm.get(n);
    const list = (n) => g(n).a.slice();
    return { downs: g('downs'), ups: g('ups'), enc: list('enc'), changes: list('changes'), gate: list('gate'), offCount: g('offCount'), good: g('good'), timers: g('timers'), log: list('log'), err: rt.error, herr: rt.handlerError };
  });
  ok(evs.downs === 1 && evs.ups === 1 && evs.log[0] === 'down A' && evs.log[1] === 'up', 'footswitch_down and footswitch_up fire once each: ' + evs.log.slice(0, 2).join(', '));
  ok(evs.enc.length === 2 && evs.enc[0] === 1 && evs.enc[1] === -2, 'an endless encoder gives CW through the wrap, then CCW: ' + JSON.stringify(evs.enc));
  ok(evs.changes.join(' ') === '0.5>0.8 0.8>0.3', 'change gives the old and new value: ' + evs.changes.join(' '));
  ok(evs.gate.join(' ') === '2:0>1', 'a screen input change fires with its port: ' + evs.gate.join(' '));
  ok(evs.offCount === 5, 'off() stops a handler (' + evs.offCount + ' calls before)');
  ok(evs.good === 2 && !evs.err && evs.herr && evs.herr.line === 13 && /boom|nil/.test(evs.herr.message), 'a handler that throws does not stop the others or the screen: ' + (evs.herr && evs.herr.message));
  ok(evs.log.includes('off') && evs.timers >= 3, `bypass and timer events (timer ran ${evs.timers} times)`);
  ok(evs.log.join(',').startsWith('down A,up,enc,enc,change'), 'events run in order: ' + evs.log.join(','));

  // ---- code files, the file store and audio
  const fl = await win.evaluate(async () => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { makeHost, simIO } = await import('./js/screenscript/host.js');
    const design = {
      ctls: [{ id: 's1', kind: 'screen', shows: 'custom', script: 'x' }, { id: 's2', kind: 'screen', shows: 'custom', script: 'y' }],
      files: {
        'util.lua': 'loads = (loads or 0) + 1\nlocal M = {}\nfunction M.twice(x) return x * 2 end\nfunction M.bad()\n  local t = nil\n  return t.x\nend\nreturn M\n',
        'lib/a.lua': 'return require("lib.b")',
        'lib/b.lua': 'return require("lib/a")',
        'syn.lua': 'local x = 1\nif x then\n',
      },
    };
    const run = (src, cid = 's1', o = {}) => {
      const { io, sim } = simIO(design, { demo: o.demo !== false });
      io.cid = cid;
      const rt = new ScreenRuntime({ src, w: 64, h: 32, host: makeHost(design, io) });
      let t = 1000;
      for (let i = 0; i < (o.frames || 2); i++) rt.frame((t += 40));
      return { rt, sim, g: (n) => rt.vm.get(n) };
    };
    const out = {};
    // require: caching, a loop, a syntax error and a missing file, all with file and line
    const a = run('local u = require("util")\nlocal u2 = require("util.lua")\nr = u.twice(21)\nsame = u == u2\nok1, e1 = pcall(u.bad)\nok2, e2 = pcall(require, "lib.a")\nok3, e3 = pcall(require, "syn")\nok4, e4 = pcall(require, "nope")');
    Object.assign(out, { r: a.g('r'), same: a.g('same'), loads: a.g('loads'), e1: a.g('e1'), e2: a.g('e2'), e3: a.g('e3'), e4: a.g('e4'), err: a.rt.error });
    const b = run('local u = require("util")\nfunction draw()\n  u.bad()\nend');
    out.uncaught = b.rt.error;
    // fs: write, read, append, list, remove, binary
    const c = run(`fs.write("presets/1.txt", "gain=0.5")
fs.append("presets/1.txt", ";tone=0.2")
fs.mkdir("empty")
txt = fs.read("presets/1.txt")
top = table.concat(fs.list(), ",")
sub = table.concat(fs.list("presets"), ",")
missing = fs.read("nope.txt")
fs.writeBytes("raw.bin", {0, 1, 2, 255})
raw = fs.readBytes("raw.bin")
rawSum = raw[1] + raw[2] + raw[3] + raw[4]
local data = bin.pack("<c4 I2 f s1", "TZFX", 3, 0.25, "hello")
fs.writeBytes("fmt.bin", data)
local back = fs.readBin("fmt.bin")
magic, n, f, s, nextPos = bin.unpack("<c4 I2 f s1", back)
size = fs.size("fmt.bin")
hex = bin.hex(back:sub(1, 4))
removed = fs.remove("raw.bin")
gone = not fs.exists("raw.bin")
okDots, eDots = pcall(fs.write, "../x.txt", "no")
okAbs, eAbs = pcall(fs.read, "/etc/passwd")`);
    for (const k of ['txt', 'top', 'sub', 'missing', 'rawSum', 'magic', 'n', 'f', 's', 'nextPos', 'size', 'hex', 'removed', 'gone', 'okDots', 'eDots', 'okAbs', 'eAbs']) out['fs_' + k] = c.g(k);
    out.fsErr = c.rt.error;
    // the budget is shared by the screens of one pedal
    const s1 = run('local chunk = string.rep("a", 100000)\nlocal big = ""\nfor i = 1, 6 do big = big .. chunk end\nfs.write("one.txt", big)\nleft = fs.free()');
    const s2 = run('seen = #(fs.read("one.txt") or "")\nlocal chunk = string.rep("b", 100000)\nlocal big = ""\nfor i = 1, 6 do big = big .. chunk end\nok, e = pcall(fs.write, "two.txt", big)\nsmall = pcall(fs.write, "two.txt", "fine")', 's2');
    Object.assign(out, { left: s1.g('left'), seen: s2.g('seen'), budgetOk: s2.g('ok'), budgetErr: s2.g('e'), small: s2.g('small') });
    // audio in the preview: the demo guitar on the input, a generator on the output
    const d = run(`audio.gen("bass", {type = "saw", freq = 110, amp = 0.6, to = "out"})
function draw()
  lvl = audio.level("in")
  pk = audio.peak("in")
  bands = audio.spectrum("in", 16)
  wave = audio.wave("out", 512)
  pitch = audio.pitch("out")
  outLvl = audio.level("out")
  jacks = table.concat(audio.jacks(), ",")
  ready = audio.ready()
end`, 's1', { frames: 3, demo: false });
    const bands = d.g('bands').a, wave = d.g('wave').a;
    Object.assign(out, { lvl: d.g('lvl'), pk: d.g('pk'), nb: bands.length, bandMax: Math.max(...bands), nw: wave.length, waveMax: Math.max(...wave.map(Math.abs)), pitch: d.g('pitch'), outLvl: d.g('outLvl'), jacks: d.g('jacks'), ready: d.g('ready'), gens: [...d.sim.audio.gens.keys()], audioErr: d.rt.error });
    return out;
  });
  ok(fl.r === 42 && fl.same === true && fl.loads === 1 && !fl.err, `require runs a code file once and caches it (r ${fl.r}, loads ${fl.loads})`);
  ok(/^util\.lua:6: /.test(fl.e1) && /loop/.test(fl.e2) && /lib\/a\.lua needs lib\/b\.lua needs lib\/a\.lua/.test(fl.e2) && /^syn\.lua:3: /.test(fl.e3) && /no code file "nope\.lua"/.test(fl.e4), 'require errors name the file and line: ' + [fl.e1, fl.e2, fl.e3, fl.e4].join(' | '));
  ok(fl.uncaught && fl.uncaught.file === 'util.lua' && fl.uncaught.line === 6, 'an error inside a code file stops the screen with its file and line: ' + JSON.stringify(fl.uncaught));
  ok(fl.fs_txt === 'gain=0.5;tone=0.2' && fl.fs_top === 'syn.lua,util.lua,empty/,lib/,presets/' && fl.fs_sub === '1.txt' && fl.fs_missing === undefined, 'fs write, append, read and list: ' + fl.fs_top + ' | ' + fl.fs_sub);
  ok(fl.fs_rawSum === 258 && fl.fs_removed === true && fl.fs_gone === true, 'fs.writeBytes, readBytes and remove');
  ok(fl.fs_magic === 'TZFX' && fl.fs_n === 3 && fl.fs_f === 0.25 && fl.fs_s === 'hello' && fl.fs_size === 16 && fl.fs_nextPos === 17 && fl.fs_hex === '54 5a 46 58', 'a binary file round trips through bin.pack, fs.writeBytes, fs.readBin and bin.unpack');
  ok(fl.fs_okDots === false && /not allowed/.test(fl.fs_eDots) && fl.fs_okAbs === false && /start inside/.test(fl.fs_eAbs) && !fl.fsErr, 'scripts can not leave the sandbox: ' + fl.fs_eDots);
  ok(fl.seen === 600000 && fl.budgetOk === false && /1 MB/.test(fl.budgetErr) && fl.small === true && fl.left < 1048576 - 600000, 'two screens of one pedal share the files and the 1 MB budget: ' + fl.budgetErr);
  ok(fl.lvl > 0.01 && fl.pk >= fl.lvl && fl.nb === 16 && fl.bandMax > 0.3 && fl.nw === 512 && fl.waveMax > 0.2 && fl.pitch === 110 && fl.outLvl > 0.1 && fl.ready === true && !fl.audioErr, `audio analysis in the preview (level ${fl.lvl.toFixed(2)}, peak ${fl.pk.toFixed(2)}, ${fl.nb} bands max ${fl.bandMax.toFixed(2)}, ${fl.nw} samples max ${fl.waveMax.toFixed(2)}, pitch ${fl.pitch}, out ${fl.outLvl.toFixed(2)}, ready ${fl.ready}, ${JSON.stringify(fl.audioErr)})`);
  ok(fl.gens.join(',') === 's1:bass' && /IN/i.test(fl.jacks), 'a generator runs in the preview fake: ' + fl.gens.join(',') + ' jacks ' + fl.jacks);
  // the bridge: on the board the engine side gets the calls through setAudioBackend
  const br = await win.evaluate(async () => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { makeHost, setAudioBackend } = await import('./js/screenscript/host.js');
    const design = { ctls: [{ id: 'sx', kind: 'screen', shows: 'custom' }], jacks: [{ id: 'j1', kind: 'in', label: 'GTR' }, { id: 'j2', kind: 'out', label: 'MAIN' }, { id: 'j3', kind: 'out', label: 'AUX' }] };
    const calls = [];
    const off = setAudioBackend({
      analysis: (ctx, j, want) => (calls.push(['analysis', j.dir + j.index, want.bands]), { rms: 0.3, peak: 0.5, bands: new Array(want.bands).fill(0.2), wave: [0, 0.5, -0.5], pitch: 196, onset: calls.length > 3 ? 2 : 1 }),
      gen: (ctx, id, p) => (calls.push(['gen', id, p.type, p.freq, JSON.stringify(p.to), ctx.mode, ctx.blockId]), true),
      buffer: (ctx, id, x, rate) => (calls.push(['buffer', id, x.length, rate]), true),
      fx: (ctx, id, p) => (calls.push(['fx', id, p.type, JSON.stringify(p.jack)]), true),
      stop: (ctx, id) => calls.push(['stop', id]),
      reset: (ctx) => calls.push(['reset', ctx.screen]),
    });
    const io = { mode: 'board', cid: 'sx', blockId: 'b9', get: () => undefined, set() {}, bypassed: () => false, levels: () => ({ inPk: 0, outPk: 0 }), blockStatus: () => null, params: () => ({}) };
    const rt = new ScreenRuntime({ src: `audio.gen("lead", {type = "square", freq = 440, amp = 0.3, to = "AUX"})
audio.gen("lead", {freq = 440})
audio.buffer("wt", {0, 0.5, 1, 0.5, 0, -0.5, -1, -0.5}, 44100)
audio.play("loop", "wt", {loop = true, to = "circuit:Synth in"})
audio.fx("lp", {type = "lowpass", jack = "MAIN", freq = 900})
audio.stop("lp")
function draw()
  lvl = audio.level("GTR")
  p = audio.pitch("gtr")
  nb = #audio.spectrum("GTR")
end`, w: 32, h: 16, host: makeHost(design, io) });
    let t = 0;
    rt.frame((t += 40));
    rt.frame((t += 40));
    off();
    return { calls, err: rt.error, lvl: rt.vm.get('lvl'), p: rt.vm.get('p'), nb: rt.vm.get('nb') };
  });
  const gens = br.calls.filter((c) => c[0] === 'gen');
  ok(!br.err && br.calls[0][0] === 'reset' && br.calls[0][1] === 'sx', 'a screen start resets its sounds on the bridge');
  ok(gens.length === 2 && gens[0][1] === 'sx:lead' && gens[0][2] === 'square' && gens[0][3] === 440 && gens[0][4] === '{"dir":"out","index":1}' && gens[0][5] === 'board' && gens[0][6] === 'b9', 'a generator call reaches the bridge once (only changes are sent): ' + JSON.stringify(gens));
  ok(gens[1][1] === 'sx:loop' && gens[1][2] === 'sample' && gens[1][4] === '{"circuit":"Synth in"}' && br.calls.some((c) => c[0] === 'buffer' && c[1] === 'sx:wt' && c[2] === 8 && c[3] === 44100), 'buffers and sample playback into a circuit input reach the bridge');
  ok(br.calls.some((c) => c[0] === 'fx' && c[1] === 'sx:lp' && c[2] === 'lowpass' && c[3] === '{"dir":"out","index":0}') && br.calls.some((c) => c[0] === 'stop' && c[1] === 'sx:lp'), 'processors and stop reach the bridge');
  ok(br.lvl === 0.3 && br.p === 196 && br.nb === 32 && br.calls.filter((c) => c[0] === 'analysis').length === 2, 'analysis comes from the backend, once per jack per frame: ' + br.calls.filter((c) => c[0] === 'analysis').length);

  // ---- the factory: Shows -> Custom, code editor, generator
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForSelector('.fz-stage');
  await win.click('#fzTemplates');
  await win.click('[data-template="synth"]');
  await win.waitForTimeout(400);
  // the Synth Box template comes with a coded screen: start this check from a plain text screen
  await win.evaluate(() => {
    const d = JSON.parse(JSON.stringify(window.__tzFactory.design()));
    const s = d.ctls.find((c) => c.kind === 'screen');
    delete s.shows;
    delete s.script;
    window.__tzFactory.load(d);
  });
  await win.waitForTimeout(300);
  const D = () => win.evaluate(() => JSON.parse(JSON.stringify(window.__tzFactory.design())));
  const d0 = await D();
  const scr = d0.ctls.find((c) => c.kind === 'screen');
  await win.evaluate((id) => window.__tzFactory.select(id), scr.id);
  await win.waitForTimeout(200);
  const showsSel = '.fz-row:has(> label:text-is("Shows")) select';
  // the Synth Box template may come with a coded screen (factory-showcase.js): go back to text first
  const shows0 = await win.$eval(showsSel, (s) => s.value);
  ok(shows0 === 'text' || shows0 === 'custom', 'a screen has a Shows choice (' + shows0 + ')');
  if (shows0 !== 'text') {
    await win.selectOption(showsSel, 'text');
    await win.waitForTimeout(300);
    await win.evaluate((id) => { const c = window.__tzFactory.design().ctls.find((x) => x.id === id); c.script = ''; }, scr.id);
  }
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

  // ---- type hints: completion, signature help, hovers, checks, and the screen ports reference
  const keepScript = (await D()).ctls.find((c) => c.id === scr.id).script;
  await win.evaluate((id) => {
    const d = window.__tzFactory.design();
    const c = d.ctls.find((x) => x.id === id);
    c.sio = { ins: [{ id: 'pe', name: 'Env', sig: 'n' }, { id: 'pg', name: 'Gate', sig: 'b' }], outs: [{ id: 'ps', name: 'Sens', sig: 'n' }, { id: 'ph', name: 'Hold', sig: 'b' }] };
    window.__tzFactory.load(d);
    window.__tzFactory.select(id);
  }, scr.id);
  await win.waitForTimeout(300);
  await win.click('[data-ss="edit"]');
  await win.waitForSelector('.ss-win .ss-ta');
  await win.waitForTimeout(300);
  const edBox = async () => (await (await win.$('.ss-win')).boundingBox());
  const shotEd = async (name) => win.screenshot({ path: path.join(S, name), clip: await edBox() });
  const acLabels = () => win.$$eval('.ss-ac.open .ss-ac-item', (r) => r.map((x) => x.dataset.label));
  await win.click('.ss-ta');
  await win.keyboard.press('Control+A');
  await win.keyboard.press('Delete');
  await win.keyboard.type('local level = 0\nfunction draw()\n');
  await win.keyboard.type('clear()\n');
  await win.keyboard.type('setK');
  await win.waitForTimeout(100);
  let labels = await acLabels();
  ok(labels[0] === 'setKnob', 'typing setK offers setKnob: ' + labels.slice(0, 3).join(', '));
  ok(/name: control, value: number/.test(await win.$eval('.ss-ac.open .ss-ac-item.on span', (e) => e.textContent)), 'the completion shows the parameter types');
  await shotEd('screens-hint-complete.png');
  await win.keyboard.press('Enter');
  ok(/setKnob\($/.test(await win.$eval('.ss-ta', (t) => t.value)), 'Enter inserts setKnob(');
  await win.keyboard.type('"');
  await win.waitForTimeout(100);
  labels = await acLabels();
  const knobNames = await win.evaluate(async () => {
    const { controlList } = await import('./js/screenscript/host.js');
    return controlList(window.__tzFactory.design()).filter((e) => e.kind === 'knob').map((e) => e.name);
  });
  ok(labels.length === knobNames.length && knobNames.every((n) => labels.includes(n)), 'inside setKnob(" the pedal\'s knob names are offered: ' + labels.join(', '));
  await shotEd('screens-hint-controls.png');
  await win.keyboard.press('Escape');
  ok(!!(await win.$('.ss-win')), 'Esc closes the list, not the editor');
  await win.keyboard.type('CUTOFF", 0.5)\n');
  // signature help
  await win.keyboard.type('rect(');
  await win.waitForTimeout(80);
  let sig = await win.evaluate(() => ({ open: !!document.querySelector('.ss-sig.open'), text: document.querySelector('.ss-sig').textContent, on: (document.querySelector('.ss-sig-p.on') || {}).textContent }));
  ok(sig.open && /rect\(x: number, y: number, w: number, h: number, \[color: color\], \[width: number\]\)/.test(sig.text) && sig.on === 'x: number' && /Pixels from the left/.test(sig.text), 'signature help for rect( shows the types and x first: ' + sig.text.slice(0, 120));
  await win.keyboard.type('2, 2, ');
  await win.waitForTimeout(80);
  sig = await win.evaluate(() => (document.querySelector('.ss-sig-p.on') || {}).textContent);
  ok(sig === 'w: number', 'the current parameter follows the commas (' + sig + ')');
  await shotEd('screens-hint-signature.png');
  await win.keyboard.type('20, 10)\n');
  ok(!(await win.$('.ss-sig.open')), 'signature help closes after the call');
  // port names from this screen
  await win.keyboard.type('level = input("');
  await win.waitForTimeout(100);
  labels = await acLabels();
  ok(labels.join(',') === 'Env,Gate', 'input(" offers this screen\'s inputs: ' + labels.join(', '));
  await win.keyboard.press('Enter');
  await win.keyboard.type('")\noutput("');
  await win.waitForTimeout(100);
  labels = await acLabels();
  ok(labels.join(',') === 'Sens,Hold', 'output(" offers its outputs: ' + labels.join(', '));
  await win.keyboard.press('Escape');
  await win.keyboard.type('Sens", level * 2)\nrect(1, 2)\nknob("Cutof")\noutput("Nope", 1)\nif false then filRect(0, 0, 4, 4) end\ntext("hi", "two", 3)\nend\n');
  await win.waitForTimeout(700);
  ed = await win.evaluate(() => window.__tzScreens.editor().peek());
  const wmsg = ed.warnings.map((w) => w.message).join(' | ');
  ok(ed.warnings.some((w) => /rect needs at least 4 arguments \(x, y, w, h\), this call has 2/.test(w.message)), 'a wrong argument count is underlined: ' + wmsg);
  ok(/no knob called "Cutof".*CUTOFF/.test(wmsg) && /no output called "Nope"/.test(wmsg), 'unknown control and port names are flagged');
  ok(/filRect is not a Tone Zone function.*fillRect/.test(wmsg) && /x should be a number, not text/.test(wmsg), 'unknown functions and text for a number are flagged');
  ok(!ed.error && ed.frames > 0, 'the checks do not stop the script' + (ed.error || !ed.frames ? ': ' + JSON.stringify({ error: ed.error, frames: ed.frames }) : ''));
  ok((await win.$$('.ss-marks .ss-warn')).length === ed.warnings.length && (await win.$$('.ss-gutter-in div.warn')).length >= 4, 'warnings are underlined and marked in the gutter');
  ok(/5 hints/.test(await win.$eval('.ss-status', (s) => s.textContent)), 'the status counts the hints');
  // hover a warning, then an API name
  const hoverAt = async (word, nth = 0) => {
    const xy = await win.evaluate(({ word, nth }) => {
      const e = window.__tzScreens.editor().editor;
      let i = -1;
      for (let k = 0; k <= nth; k++) i = e.value.indexOf(word, i + 1);
      return e.coordsAt(i + 1);
    }, { word, nth });
    await win.mouse.move(xy.x, xy.y);
    await win.waitForTimeout(500);
    return win.evaluate(() => (document.querySelector('.ss-tip.open') || {}).textContent || '');
  };
  let tip = await hoverAt('rect(1, 2)');
  ok(/rect needs at least 4/.test(tip), 'hovering the underline explains it: ' + tip.slice(0, 120));
  await shotEd('screens-hint-warnings.png');
  tip = await hoverAt('input("');
  ok(/input\(\[port: port\]\) -> number/.test(tip) && /The value wired into this input/.test(tip) && /port: Input number/.test(tip), 'hovering input shows its signature and description: ' + tip.slice(0, 100));
  await shotEd('screens-hint-hover.png');
  tip = await hoverAt('level', 1);
  ok(/level \(a variable\)/.test(tip) && /line 1/.test(tip), 'hovering a script variable says where it is defined: ' + tip.slice(0, 120));
  await win.mouse.move(5, 5);
  // the Test tab: simulated inputs, outputs shown
  ok((await win.$$('.ss-pane-test [data-sin]')).length === 2 && (await win.$$('.ss-pane-test [data-sout]')).length === 2, 'the Test tab has the screen inputs and outputs');
  await win.$eval('.ss-pane-test input[data-sin="0"]', (i) => { i.value = 0.35; i.dispatchEvent(new Event('input')); });
  await win.waitForTimeout(250);
  ok((await win.$eval('.ss-pane-test [data-sout="0"]', (e) => e.textContent)) === '0.7', 'a simulated input reaches the script and its output shows (' + (await win.$eval('.ss-pane-test [data-sout="0"]', (e) => e.textContent)) + ')');
  // the reference has the screen ports guide
  await win.click('.ss-tabs [data-tab="ref"]');
  await win.waitForTimeout(100);
  const guide = await win.evaluate(() => {
    const g = document.querySelector('.ss-refguide[data-guide="Screen ports"]');
    if (!g) return null;
    g.scrollIntoView({ block: 'start' });
    return { heads: [...g.querySelectorAll('h6')].map((h) => h.textContent), code: g.querySelectorAll('.ss-refcode').length };
  });
  ok(guide && ['Adding inputs and outputs', 'Reading inputs', 'Writing outputs', 'A screen wired both ways'].every((h) => guide.heads.includes(h)) && guide.code >= 5, 'the Reference has the screen ports guide: ' + JSON.stringify(guide));
  await win.evaluate(() => { const h = [...document.querySelectorAll('.ss-ref h5')].find((x) => x.textContent === 'Screen ports'); if (h) h.scrollIntoView({ block: 'start' }); });
  await win.waitForTimeout(100);
  await shotEd('screens-hint-reference.png');
  await win.evaluate(() => { const h = [...document.querySelectorAll('.ss-refguide h6')].find((x) => x.textContent === 'Writing outputs'); if (h) h.scrollIntoView({ block: 'start' }); });
  await win.waitForTimeout(100);
  await shotEd('screens-hint-reference2.png');
  await win.evaluate(() => { const h = [...document.querySelectorAll('.ss-ref h5')].find((x) => x.textContent === 'Events'); if (h) h.scrollIntoView({ block: 'start' }); });
  await win.waitForTimeout(100);
  await shotEd('screens-events-reference.png');
  await win.click('.ss-tabs [data-tab="test"]');
  // every example in the guide runs
  const exErr = await win.evaluate(async (id) => {
    const { API } = await import('./js/screenscript/docs.js');
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { makeHost, simIO } = await import('./js/screenscript/host.js');
    // the code files example is there as util.lua
    const util = API.find((g) => g.group === 'Code files').guide.find(([k]) => k === 'code')[1];
    const d = { ...window.__tzFactory.design(), files: { 'util.lua': util } };
    const out = [];
    for (const g of API) for (const [k, v] of g.guide || []) {
      if (k !== 'code') continue;
      const { io } = simIO(d, { demo: false });
      io.cid = id;
      const rt = new ScreenRuntime({ src: v, w: 120, h: 48, host: makeHost(d, io) });
      const t = performance.now();
      for (let i = 0; i < 4; i++) rt.frame(t + i * 40);
      if (rt.error) out.push(v.split('\n')[0] + ': ' + rt.error.message);
    }
    return out;
  }, scr.id);
  ok(exErr.length === 0, 'every screen ports example runs: ' + exErr.join('; '));
  await win.evaluate(({ id, src }) => {
    window.__tzScreens.editor().editor.value = src;
  }, { id: scr.id, src: keepScript });
  await win.click('[data-ss="done"]');
  await win.waitForTimeout(300);

  // ---- files in the code editor: a code file, an error in it, rename / copy / delete, files from the preview
  await win.click('[data-ss="edit"]');
  await win.waitForSelector('.ss-win .ss-ta');
  await win.waitForTimeout(300);
  const peekEd = () => win.evaluate(() => window.__tzScreens.editor().peek());
  const visTa = '.ss-codes .ss-code:not([hidden]) .ss-ta';
  const setCode = async (code) => {
    await win.click(visTa);
    await win.keyboard.press('Control+A');
    await win.keyboard.press('Delete');
    await win.keyboard.insertText(code);
    await win.waitForTimeout(700);
  };
  ok(!!(await win.$('.ss-files [data-file="main"].on')) && /of 1 MB/.test(await win.$eval('[data-ss="usage"]', (e) => e.textContent)), 'the editor has a file list with main and a usage bar');
  await win.click('[data-ss="file-new"]');
  await win.fill('[data-ss="file-name"]', 'util');
  await win.keyboard.press('Enter');
  await win.waitForTimeout(300);
  let pe = await peekEd();
  ok(pe.file === 'util.lua' && /local M/.test((await D()).files['util.lua']), 'New makes util.lua (a code file) and opens it');
  await setCode('local M = {}\nfunction M.scale(v, k)\n  return v * k\nend\nfunction M.label(s)\n  text(s, 2, 2, colors.dim, "small")\nend\nreturn M\n');
  await win.click('.ss-files [data-file="main"]');
  await setCode('local util = require("util")\nx = util.');
  await win.keyboard.type('sc');
  await win.waitForTimeout(150);
  labels = await acLabels();
  ok(labels[0] === 'scale', 'after util. the completion offers what util.lua returns: ' + labels.join(', '));
  await win.keyboard.press('Escape');
  await setCode(`local util = require("util")
local saved = 0
function draw()
  clear()
  util.label("x " .. util.scale(2, 21))
  if button("SAVE", 2, 14, 40, 12) then
    saved += 1
    fs.write("presets/" .. saved .. ".txt", "gain=" .. knob(1))
  end
  text(fs.free() // 1024 .. " KB free", 2, H - 9, colors.dim, "small")
end
`);
  pe = await peekEd();
  ok(!pe.error && pe.frames > 0, 'the preview runs a screen that requires util.lua: ' + JSON.stringify(pe.error));
  {
    const pcb = await (await win.$('.ss-pcanvas')).boundingBox();
    const sz = await win.evaluate(() => { const c = document.querySelector('.ss-pcanvas'); return { w: c.width, h: c.height }; });
    await win.mouse.click(pcb.x + (20 / sz.w) * pcb.width, pcb.y + (20 / sz.h) * pcb.height);
    await win.waitForTimeout(400);
  }
  pe = await peekEd();
  ok(pe.preview.includes('presets/1.txt') && !!(await win.$('.ss-frow.prev [data-keep="presets/1.txt"]')), 'a file the preview writes shows in the list with Keep: ' + pe.preview.join(','));
  await win.click('.ss-files [data-file="util.lua"]');
  await win.waitForTimeout(200);
  await shotEd('screens-files.png');
  await win.click('[data-keep="presets/1.txt"]');
  await win.waitForTimeout(200);
  ok(/^gain=/.test((await D()).files['presets/1.txt'] || ''), 'Keep copies it into the design');
  // an error in the code file: the status names the file and line, a click opens it there
  await setCode('local M = {}\nfunction M.scale(v, k)\n  return v * k + nil\nend\nfunction M.label(s)\n  text(s, 2, 2, colors.dim, "small")\nend\nreturn M\n');
  pe = await peekEd();
  const stText = await win.$eval('.ss-status', (e) => e.textContent);
  ok(pe.error && pe.error.file === 'util.lua' && pe.error.line === 3 && /^util\.lua line 3: /.test(stText) && !!(await win.$('.ss-frow.err[data-file="util.lua"]')), 'an error in util.lua shows its file and line: ' + stText);
  await win.click('.ss-files [data-file="main"]');
  await win.click('.ss-status [data-ss="error"]');
  await win.waitForTimeout(200);
  pe = await peekEd();
  ok(pe.file === 'util.lua' && (await win.$$('.ss-codes .ss-code:not([hidden]) .ss-gutter-in div.err')).length === 1, 'clicking the error opens util.lua with the line marked');
  await shotEd('screens-files-error.png');
  await setCode('local M = {}\nfunction M.scale(v, k)\n  return v * k\nend\nfunction M.label(s)\n  text(s, 2, 2, colors.dim, "small")\nend\nreturn M\n');
  ok(!(await peekEd()).error, 'fixing it runs the screen again');
  // rename, copy, delete
  await win.click('[data-ss="file-rename"]');
  await win.fill('[data-ss="file-name"]', 'helpers.lua');
  await win.keyboard.press('Enter');
  await win.waitForTimeout(700);
  pe = await peekEd();
  ok(pe.files.includes('helpers.lua') && !pe.files.includes('util.lua') && pe.error && !pe.error.file && /no code file "util.lua"/.test(pe.error.message), 'Rename renames the file (and require("util") then says it is missing)');
  await win.click('[data-ss="file-dup"]');
  await win.keyboard.press('Enter');
  await win.waitForTimeout(200);
  pe = await peekEd();
  ok(pe.files.includes('helpers copy.lua') && pe.file === 'helpers copy.lua', 'Copy makes helpers copy.lua');
  await win.click('[data-ss="file-del"]');
  await win.click('[data-ss="file-del-ok"]');
  await win.waitForTimeout(200);
  pe = await peekEd();
  ok(!pe.files.includes('helpers copy.lua') && pe.file === '', 'Delete removes it');
  await win.click('.ss-files [data-file="helpers.lua"]');
  await win.click('[data-ss="file-rename"]');
  await win.fill('[data-ss="file-name"]', 'util.lua');
  await win.keyboard.press('Enter');
  await win.waitForTimeout(700);
  pe = await peekEd();
  ok(!pe.error && pe.files.includes('util.lua') && pe.used.all > 300 && pe.used.code > pe.used.data, `back to util.lua, the screen runs (${pe.used.all} bytes used)`);
  await shotEd('screens-files-example.png');
  // audio in the preview: the spectrum and scope example, and a drone from the docs
  await win.click('.ss-files [data-file="main"]');
  await setCode('-- a spectrum and a scope of the input, and a drone on the output\naudio.gen("drone", {type = "saw", freq = 82, amp = 0.2, to = "out"})\nfunction draw()\n  clear()\n  local bands = audio.spectrum("in", 32)\n  local bw = W / #bands\n  for i, v in ipairs(bands) do\n    fillRect((i - 1) * bw, H - v * H, bw - 1, v * H, hsv(i * 8, 0.8, 1))\n  end\n  graph(0, 0, W, H / 2, audio.wave("out", 128), colors.fg, -1, 1)\n  text(string.format("%.0f Hz", audio.pitch("out")), 2, 2, colors.accent, "small")\nend\n');
  await win.waitForTimeout(500);
  pe = await peekEd();
  ok(!pe.error && pe.gens.includes(pe.gens.find((g) => /:drone$/.test(g))) && /drone: saw 82 Hz/.test(await win.$eval('[data-ss="audio"]', (e) => e.textContent)), 'the Test tab lists the sounds the script runs: ' + pe.gens.join(',') + ' | ' + (await win.$eval('[data-ss="audio"]', (e) => e.textContent)));
  await win.evaluate(() => { const h = [...document.querySelectorAll('.ss-pane-test h5')].find((x) => x.textContent === 'Audio'); if (h) h.scrollIntoView({ block: 'start' }); });
  await shotEd('screens-audio.png');
  await win.click('[data-ss="done"]');
  await win.waitForTimeout(300);
  {
    const d = await D();
    const st = await win.evaluate(() => window.__tzScreens.stage());
    ok(d.files && /M\.scale/.test(d.files['util.lua']) && st.every((x) => !x.error), 'the code file is kept in the design and the stage runs it: ' + Object.keys(d.files || {}).join(',') + ' ' + JSON.stringify(st.filter((x) => x.error)));
  }

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
  ok(saved.design.files && /M\.scale/.test(saved.design.files['util.lua']) && /^gain=/.test(saved.design.files['presets/1.txt']), 'the pedal\'s files are saved with the block');

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

  // ---- files written on the board are saved with the preset and come back after a reload
  const fileBlock = await win.evaluate(async () => {
    const { saveCustomBlock } = await import('./js/catalog/custom.js');
    const D = window.__tzFactory.template('delay');
    const c = D.ctls.find((x) => x.kind === 'screen');
    c.shows = 'custom';
    c.script = 'local n = tonumber(fs.read("boots.txt") or "0") + 1\nfs.write("boots.txt", tostring(n))\nfs.writeBytes("state.bin", bin.pack("<I2 f", n, 0.5))\nfunction draw()\n  clear()\n  text("BOOT " .. n .. " " .. fs.read("seed.txt"), 2, 2)\nend\n';
    D.files = { 'seed.txt': 'from the design' };
    D.name = 'Files test';
    D.blockId = null;
    const id = await saveCustomBlock(D, { asNew: true });
    const m = await import('./js/state.js');
    const b = m.addBlock(id, 6000, 3000);
    await new Promise((r) => setTimeout(r, 300));
    const ed2 = window.__tz.editor;
    const v = ed2.views.get(b.id);
    ed2.view.z = 1.5;
    ed2.view.x = -(v.block.x + v.w / 2) * 1.5 + 640;
    ed2.view.y = -(v.block.y + v.h / 2) * 1.5 + 470;
    ed2.applyView && ed2.applyView();
    await new Promise((r) => setTimeout(r, 1800));
    const bb = m.blockById(b.id);
    const p = m.serialize();
    const file = await window.tz.presets.save(p, null);
    localStorage.setItem('tz.lastPreset', file);
    return { id, bid: b.id, fs: bb.params._fs, file };
  });
  const fs0 = JSON.parse(fileBlock.fs || '{}');
  ok(fs0['boots.txt'] === '1' && fs0['state.bin'] && fs0['seed.txt'] === undefined, 'files written on the board go to the block (saved with the preset): ' + fileBlock.fs);
  await win.reload();
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  await win.waitForTimeout(500);
  const after = await win.evaluate(async ({ bid }) => {
    const m = await import('./js/state.js');
    const b = m.blockById(bid);
    if (!b) return { missing: true, blocks: m.state.preset.blocks.map((x) => x.id) };
    // the screen starts again on the board: it reads the saved count and adds one
    const ed2 = window.__tz.editor;
    const v = ed2.views.get(bid);
    ed2.view.z = 1.5;
    ed2.view.x = -(v.block.x + v.w / 2) * 1.5 + 640;
    ed2.view.y = -(v.block.y + v.h / 2) * 1.5 + 470;
    ed2.applyView && ed2.applyView();
    await new Promise((r) => setTimeout(r, 1500));
    const { boardIO } = await import('./js/screenscript/board.js');
    const { makeHost } = await import('./js/screenscript/host.js');
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { getDef } = await import('./js/catalog/index.js');
    const D = getDef(b.type).design;
    const c = D.ctls.find((x) => x.kind === 'screen');
    const rt = new ScreenRuntime({ src: 'boots = fs.read("boots.txt")\nseed = fs.read("seed.txt")\nn, f = bin.unpack("<I2 f", fs.readBin("state.bin"))', w: 32, h: 16, host: makeHost(D, boardIO(bid, b, c.id, D)) });
    rt.frame(performance.now());
    return { boots: rt.vm.get('boots'), seed: rt.vm.get('seed'), n: rt.vm.get('n'), f: rt.vm.get('f'), err: rt.error };
  }, { bid: fileBlock.bid });
  {
    const box = await win.evaluate((bid) => { const r = window.__tz.editor.views.get(bid).g.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, fileBlock.bid);
    await win.screenshot({ path: path.join(S, 'screens-files-board.png'), clip: { x: Math.max(0, box.x - 10), y: Math.max(60, box.y - 10), width: Math.min(1280, box.width + 20), height: Math.min(860, box.height + 20) } });
  }
  ok(after.boots === '2' && after.seed === 'from the design' && after.n === 2 && after.f === 0.5 && !after.err, 'after a reload the pedal on the board still has its files: ' + JSON.stringify(after));

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await app.close();
  console.log(fails ? `${fails} FAILED` : 'all passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
