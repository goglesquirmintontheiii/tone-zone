// Block graphics QA: renders every block and flags DETACHED parts and OVERFLOW (controls, text or art
// sticking out of the enclosure).
// run (from app/):
//   NODE_PATH=$(npm root -g) LD_LIBRARY_PATH=/home/claude/tone-zone/engine/tests/fakejack \
//     xvfb-run -a -s "-screen 0 1600x950x24" node <this file> [--plugin id|core] [--only id1,id2] [--out dir] [--no-png] [--all-png]
// writes <out>/report.json, <out>/summary.json and one <id>.png per flagged block (red = offending pixels,
// cyan outline = body silhouette, yellow box = form w/h box).
const path = require('path');
const fs = require('fs');
const APP = '/home/claude/tone-zone/app';
const { _electron: electron } = require(require.resolve('playwright', { paths: [APP, ...(process.env.NODE_PATH || '').split(':')] }));

const arg = (k, d = null) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const OUT = path.resolve(arg('--out', __dirname));
const only = arg('--only') ? arg('--only').split(',') : null;
const plugin = arg('--plugin');
const noPng = process.argv.includes('--no-png');
const allPng = process.argv.includes('--all-png');
const BATCH = 25;
const SENS = process.argv.includes('--sensitive');
// --thumb-mode: draw like raster.js does for list thumbnails / preset cards (thumb:true, its <style>, no web fonts)
const THUMB = process.argv.includes('--thumb-mode'); // lower thresholds, for surveying borderline cases

// map core form name -> source file (by grepping the form files for the quoted name)
function coreFormFiles() {
  const dir = path.join(APP, 'renderer/js/gfx');
  const files = fs.readdirSync(dir).filter((f) => /^forms.*\.js$/.test(f));
  const src = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
  return (form) => {
    if (!form) return 'forms.js';
    const q = new RegExp(`(['"\`])${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1|forms\\.${form.replace(/[^\w$]/g, '_')}\\b|\\b${form.replace(/[^\w$]/g, '_')}\\s*:`);
    const hit = files.filter((f) => f !== 'forms.js').find((f) => q.test(src[f]));
    return hit || (q.test(src['forms.js']) ? 'forms.js' : '?');
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await electron.launch({ executablePath: require(require.resolve('electron', { paths: [APP] })), args: [APP, '--no-sandbox'], cwd: APP });
  const win = await app.firstWindow();
  win.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 180000 });
  // wait for the plugin defs to settle
  let last = -1, stable = 0;
  for (let i = 0; i < 120 && stable < 4; i++) {
    const n = await win.evaluate(async () => (await import('./js/catalog/index.js')).allDefs().length);
    stable = n === last ? stable + 1 : 0;
    last = n;
    await win.waitForTimeout(750);
  }
  console.log('defs:', last);
  // fonts for the stand-alone SVGs (an SVG drawn as an image can't see the document's web fonts)
  const css = fs.readFileSync(path.join(APP, 'renderer/css/app.css'), 'utf8');
  let fontCss = '';
  for (const m of css.matchAll(/@font-face\s*{[^}]*}/g)) {
    const u = /url\('?([^')]+)'?\)/.exec(m[0]);
    if (!u) continue;
    const f = path.join(APP, 'renderer/css', u[1]);
    if (!fs.existsSync(f)) continue;
    fontCss += m[0].replace(u[0], `url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')})`) + '\n';
  }
  const cfg = Object.assign(SENS ? { MIN_DET: 8, MIN_OVF: 2, MIN_DEPTH: 0.8, TOL: 0.5 } : {}, { thumbMode: THUMB });
  await win.evaluate(INPAGE, { fontCss, cfg });
  const ids = await win.evaluate(async ({ only, plugin }) => {
    const C = await import('./js/catalog/index.js');
    return C.allDefs()
      .filter((d) => !d.hidden && (!only || only.includes(d.id)) && (!plugin || d.plugin === plugin || (plugin === 'core' && !d.plugin)))
      .map((d) => d.id);
  }, { only, plugin });
  console.log('checking', ids.length);
  const formFile = coreFormFiles();
  const SHOTS = path.join(OUT, 'shots');
  fs.mkdirSync(SHOTS, { recursive: true });
  const shotOf = (id) => path.join(SHOTS, id.replace(/[^\w.-]/g, '_') + '.png');
  for (const id of ids) if (fs.existsSync(shotOf(id))) fs.unlinkSync(shotOf(id)); // stale pictures of re-checked blocks
  const results = [];
  const t0 = Date.now();
  for (let i = 0; i < ids.length; i += BATCH) {
    const part = await win.evaluate((a) => window.__qa(a.ids, a.o), { ids: ids.slice(i, i + BATCH), o: { png: !noPng, allPng, stats: !!only } });
    for (const r of part) {
      if (r.png) {
        const f = shotOf(r.id);
        fs.writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64'));
        r.screenshot = f;
      }
      delete r.png;
      if (r.plugin === 'core') r.formFile = formFile(r.form);
      results.push(r);
    }
    process.stdout.write(`\r${Math.min(i + BATCH, ids.length)}/${ids.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log();
  if (process.env.QA_DUMP) fs.writeFileSync(path.join(OUT, 'last.svg'), (await win.evaluate(() => window.__qaLast)).join('\n\n<!-- next -->\n\n'));
  const flagged = results.filter((r) => r.issues.length || r.error);
  const summary = { checked: results.length, flagged: flagged.length, byType: {}, bySeverity: {}, byPlugin: {} };
  for (const r of flagged) {
    const k = r.plugin === 'core' ? 'core:' + r.formFile : r.plugin;
    const s = (summary.byPlugin[k] = summary.byPlugin[k] || { blocks: 0, detached: 0, overflow: 0, error: 0, ids: [] });
    s.blocks++;
    s.ids.push(r.id);
    if (r.error) s.error++;
    if (r.issues.some((x) => x.severity === 'high')) s.high = (s.high || 0) + 1;
    for (const x of r.issues) summary.bySeverity[x.severity] = (summary.bySeverity[x.severity] || 0) + 1;
    const types = new Set(r.issues.map((x) => x.type));
    for (const t of types) { s[t]++; summary.byType[t] = (summary.byType[t] || 0) + 1; }
  }
  summary.byPlugin = Object.fromEntries(Object.entries(summary.byPlugin).sort((a, b) => b[1].blocks - a[1].blocks));
  const appendages = Object.fromEntries(results.filter((r) => r.appendages).map((r) => [r.id, r.appendages]));
  const report = { generated: new Date().toISOString(), args: process.argv.slice(2), summary, blocks: flagged, clean: results.filter((r) => !r.issues.length && !r.error).map((r) => r.id), appendages };
  const suffix = only || plugin ? '-partial' : '';
  fs.writeFileSync(path.join(OUT, `report${suffix}.json`), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(OUT, `summary${suffix}.json`), JSON.stringify(summary, null, 1));
  console.log(`checked ${results.length}, flagged ${flagged.length}`, JSON.stringify(summary.byType));
  for (const [k, v] of Object.entries(summary.byPlugin).slice(0, 25)) console.log(k.padEnd(28), v.blocks, `det ${v.detached} ovf ${v.overflow} high ${v.high || 0}`);
  for (const r of (only ? results : [])) console.log(r.id, JSON.stringify(r.cats), r.opaqueArea, JSON.stringify(r.issues.map((x) => [x.type, x.area, x.details && x.details.kind, x.bbox])));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });

// ===================================================================== in-page analysis
const INPAGE = async ({ fontCss, cfg }) => {
  const C = await import('./js/catalog/index.js');
  const { renderForm } = await import('./js/gfx/forms.js');
  const NS = 'http://www.w3.org/2000/svg';
  const S = 2; // raster scale (px per block unit)
  const A_ON = 128; // opaque threshold
  const MIN_DET = cfg.MIN_DET ?? 20; // detached part: min area, unit²
  const MIN_OVF = cfg.MIN_OVF ?? 6; // overflow blob: min area, unit²
  const MIN_DEPTH = cfg.MIN_DEPTH ?? 1.5; // overflow blob must reach this far (units) past the silhouette
  const BOX_TOL = 3; // tolerance around the form's w/h box
  const SIL_FRAC = 0.35; // filled art pieces at least this big (vs the largest) form the base outline
  const host = document.createElementNS(NS, 'svg');
  host.setAttribute('width', '3000');
  host.setAttribute('height', '3000');
  host.style.cssText = 'position:fixed;left:-4000px;top:0;';
  document.body.appendChild(host);
  const style = cfg.thumbMode ? "<style>text{font-family:'Inter','Barlow Condensed',sans-serif}</style>" : `<style>${fontCss}svg{font-family:'Inter','Barlow Condensed',sans-serif}</style>`;

  function collectDefs(str, out = new Map(), depth = 0) {
    if (depth > 8) return out;
    const re = /url\(&quot;#([^)&"']+)&quot;\)|url\(#([^)"']+)\)|href="#([^"]+)"/g;
    let m;
    while ((m = re.exec(str))) {
      const id = m[1] || m[2] || m[3];
      if (out.has(id)) continue;
      const node = document.getElementById(id);
      if (!node || host.contains(node)) continue;
      const html = new XMLSerializer().serializeToString(node);
      out.set(id, html);
      collectDefs(html, out, depth + 1);
    }
    return out;
  }
  const canvas = document.createElement('canvas');
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  async function raster(node, vb) {
    const body = new XMLSerializer().serializeToString(node);
    const defs = collectDefs(body);
    const txt = `<svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb.join(' ')}" width="${vb[2] * S}" height="${vb[3] * S}">${style}<defs>${[...defs.values()].join('')}</defs>${body}</svg>`;
    window.__qaLast = window.__qaLast || []; window.__qaLast.push(txt); if (window.__qaLast.length > 8) window.__qaLast.shift();
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt);
    await img.decode();
    const W = Math.round(vb[2] * S), H = Math.round(vb[3] * S);
    canvas.width = W;
    canvas.height = H;
    cx.clearRect(0, 0, W, H);
    cx.drawImage(img, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data;
    return { W, H, img, rgba: d };
  }
  const alphaMask = (r, th) => {
    const m = new Uint8Array(r.W * r.H);
    for (let i = 0; i < m.length; i++) m[i] = r.rgba[i * 4 + 3] >= th ? 1 : 0;
    return m;
  };
  // connected components (8-neighbour); returns {lab, comps:[{n, x0,y0,x1,y1}]}
  function components(m, W, H) {
    const lab = new Int32Array(W * H);
    const comps = [];
    const st = new Int32Array(W * H);
    for (let i = 0; i < m.length; i++) {
      if (!m[i] || lab[i]) continue;
      const c = { n: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1, id: comps.length + 1 };
      comps.push(c);
      let sp = 0;
      st[sp++] = i;
      lab[i] = c.id;
      while (sp) {
        const p = st[--sp];
        const x = p % W, y = (p - x) / W;
        c.n++;
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= W) continue;
            const q = yy * W + xx;
            if (m[q] && !lab[q]) { lab[q] = c.id; st[sp++] = q; }
          }
        }
      }
    }
    return { lab, comps };
  }
  // chamfer distance (in px) to the nearest set pixel of m
  function distTo(m, W, H) {
    const D = new Float32Array(W * H);
    const INF = 1e9;
    for (let i = 0; i < D.length; i++) D[i] = m[i] ? 0 : INF;
    const a = 1, b = 1.4142;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let v = D[i];
        if (x > 0) v = Math.min(v, D[i - 1] + a);
        if (y > 0) {
          v = Math.min(v, D[i - W] + a);
          if (x > 0) v = Math.min(v, D[i - W - 1] + b);
          if (x < W - 1) v = Math.min(v, D[i - W + 1] + b);
        }
        D[i] = v;
      }
    for (let y = H - 1; y >= 0; y--)
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        let v = D[i];
        if (x < W - 1) v = Math.min(v, D[i + 1] + a);
        if (y < H - 1) {
          v = Math.min(v, D[i + W] + a);
          if (x < W - 1) v = Math.min(v, D[i + W + 1] + b);
          if (x > 0) v = Math.min(v, D[i + W - 1] + b);
        }
        D[i] = v;
      }
    return D;
  }

  const SHAPES = 'path,rect,circle,ellipse,polygon,polyline,line,text,image,use';
  const inDefs = (el) => el.closest('defs,clipPath,mask,pattern,linearGradient,radialGradient,filter,symbol,marker');
  function effOpacity(el, stopAt) {
    let o = 1;
    for (let e = el; e && e !== stopAt; e = e.parentElement) {
      const cs = getComputedStyle(e);
      o *= parseFloat(cs.opacity || '1');
    }
    return o;
  }
  function catOf(el) {
    if (el.closest('.jack')) return el.tagName === 'text' ? 'jacktext' : 'jack';
    const c = el.closest('.ctl');
    if (c) {
      const k = [...c.classList].find((x) => x !== 'ctl') || 'ctl';
      if (el.tagName === 'text') return 'ctltext';
      return k;
    }
    if (el.closest('.led')) return 'led';
    if (el.tagName === 'text' || el.closest('text')) return 'text';
    return 'art';
  }
  const desc = (el) => {
    let s = el.tagName;
    if (el.id) s += '#' + el.id;
    const c = el.closest('.ctl,.led');
    if (c) s += ` in .${[...c.classList].join('.')}${c.dataset && c.dataset.p ? `[${c.dataset.p}]` : ''}`;
    if (el.tagName === 'text') s += ` "${el.textContent.trim().slice(0, 24)}"`;
    else if (el.getAttribute('d')) s += ` d="${el.getAttribute('d').slice(0, 40)}"`;
    else if (el.tagName === 'circle' || el.tagName === 'ellipse') s += ` c=(${el.getAttribute('cx')},${el.getAttribute('cy')})`;
    else if (el.tagName === 'rect') s += ` (${el.getAttribute('x')},${el.getAttribute('y')} ${el.getAttribute('width')}x${el.getAttribute('height')})`;
    return s;
  };

  async function analyse(d, o) {
    host.innerHTML = '';
    const g = document.createElementNS(NS, 'g');
    host.appendChild(g);
    const rdef = Object.create(d);
    rdef.ports = C.portsFor(d, C.defaultVariant(d));
    let res;
    try {
      res = renderForm({ g, views: new Map(), flip: false, thumb: !!cfg.thumbMode }, rdef);
    } catch (e) {
      return { id: d.id, plugin: d.plugin || 'core', form: d.form, error: String(e.message || e), issues: [] };
    }
    const w = res.w, h = res.h;
    const tubes = !!d.tubesTop;
    const hr = host.getBoundingClientRect();
    const bb = (el) => {
      const r = el.getBoundingClientRect();
      return { x0: r.left - hr.left, y0: r.top - hr.top, x1: r.right - hr.left, y1: r.bottom - hr.top, a: r.width * r.height };
    };
    // ---- element inventory
    const els = [];
    let seq = 0;
    for (const el of g.querySelectorAll(SHAPES)) {
      if (inDefs(el)) continue;
      const cat = catOf(el);
      if (cat === 'jack') continue;
      if (el.closest('text') && el.tagName !== 'text') continue;
      const r = bb(el);
      if (r.x1 - r.x0 <= 0 && r.y1 - r.y0 <= 0) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      el.setAttribute('data-qa', ++seq);
      els.push({ el, cat, r, idx: seq });
    }
    // shadows: direct <image> elements (softShadow); they're drawn as blurred bitmaps
    const shadowEls = els.filter((e) => e.el.tagName === 'image');
    // ---- canvas extent: everything visible (but not absurdly far)
    let X0 = 0, Y0 = tubes ? -50 : 0, X1 = w, Y1 = h;
    const off = [];
    for (const e of els) {
      if (e.el.tagName === 'image') continue;
      const r = e.r;
      if (r.x1 < -300 || r.y1 < -300 || r.x0 > w + 300 || r.y0 > h + 300) {
        if (e.cat !== 'art' || effOpacity(e.el, g) > 0.3) off.push(e);
        continue;
      }
      X0 = Math.min(X0, r.x0); Y0 = Math.min(Y0, r.y0); X1 = Math.max(X1, r.x1); Y1 = Math.max(Y1, r.y1);
    }
    X0 = Math.floor(X0 - 8); Y0 = Math.floor(Y0 - 8); X1 = Math.ceil(X1 + 8); Y1 = Math.ceil(Y1 + 8);
    const vb = [X0, Y0, X1 - X0, Y1 - Y0];
    const toPx = (x, y) => [Math.round((x - X0) * S), Math.round((y - Y0) * S)];
    const toU = (px, py) => [+(px / S + X0).toFixed(1), +(py / S + Y0).toFixed(1)];

    // ---- variant builder
    const variant = (fn) => {
      const cl = g.cloneNode(true);
      // jacks themselves are allowed anywhere on the edge; their labels have to sit on the enclosure
      for (const j of cl.querySelectorAll('.jack')) {
        j.setAttribute('visibility', 'hidden');
        for (const t of j.querySelectorAll('text')) t.setAttribute('visibility', fn ? 'hidden' : 'visible');
      }
      for (const im of cl.querySelectorAll('image')) if (!inDefs(im)) im.setAttribute('display', 'none');
      if (fn) fn(cl);
      return cl;
    };
    const byIdx = (cl) => {
      const m = new Map();
      for (const e of cl.querySelectorAll('[data-qa]')) m.set(+e.getAttribute('data-qa'), e);
      return m;
    };
    // 1) everything opaque (jacks + shadows hidden)
    const full = await raster(variant(), vb);
    const W = full.W, H = full.H;
    const A = alphaMask(full, A_ON);
    // 2) silhouette: big filled shapes that aren't controls / text / LEDs
    const fillable = els.filter((e) => e.cat === 'art' && !['line', 'polyline', 'image', 'text', 'use'].includes(e.el.tagName));
    const cand = [];
    for (const e of fillable) {
      const cs = getComputedStyle(e.el);
      if (!cs.fill || cs.fill === 'none') continue;
      if (/url\("?#p-/.test(cs.fill)) continue; // texture overlays
      const op = effOpacity(e.el, g) * parseFloat(cs.fillOpacity || '1');
      if (op < 0.5) continue;
      cand.push(e);
    }
    const maxA = Math.max(0, ...cand.map((e) => e.r.a));
    // base outline: the biggest filled piece(s); smaller pieces join only via the appendage test below
    const silSet = new Set(cand.filter((e) => e.r.a >= maxA * SIL_FRAC).map((e) => e.idx));
    const silCl = variant((cl) => {
      cl.setAttribute('visibility', 'hidden');
      for (const [i, el] of byIdx(cl)) {
        if (!silSet.has(i)) continue;
        el.setAttribute('visibility', 'visible');
        el.setAttribute('style', 'fill:#000 !important;fill-opacity:1 !important;stroke:none !important;opacity:1 !important;filter:none !important;');
      }
      // ancestors' group opacity would thin the silhouette out
      for (const e of cl.querySelectorAll('g')) { e.removeAttribute('opacity'); e.style.opacity = '1'; }
    });
    const sil = await raster(silCl, vb);
    const SIL = alphaMask(sil, 64);
    let dist = distTo(SIL, W, H);
    const [, tubeY] = toPx(0, 2);
    const tubeZone = (i) => tubes && Math.floor(i / W) < tubeY;
    // only these elements, in their own paint (and clip), for per-element tests
    const onlyEls = (set, solid = false) => variant((cl) => {
      cl.setAttribute('visibility', 'hidden');
      for (const [i, el] of byIdx(cl)) {
        if (!set.has(i)) continue;
        el.setAttribute('visibility', 'visible');
        if (solid) {
          // translucent pieces (glass domes, windows) still belong to the outline
          el.setAttribute('style', (el.getAttribute('style') || '') + ';opacity:1 !important;fill-opacity:1 !important;stroke-opacity:1 !important;');
          for (let a = el.parentElement; a && a !== cl.parentElement; a = a.parentElement) { a.removeAttribute('opacity'); if (a.style) a.style.opacity = '1'; }
        }
      }
    });
    // 2b) appendages: art pieces that stick out of the body on purpose (amp handles, chimneys, horns, feet,
    // wings...) are mostly *outside* the body; decoration that pokes past the edge is mostly inside it.
    // Each art element touching the outside is drawn alone: >= 40% of it outside -> it's part of the outline.
    const appendages = [];
    const APPM = new Uint8Array(W * H);
    // plug ends of male couplers are drawn by the form (no .jack group): treat like jacks
    for (const j of res.jacks || []) {
      if (!j.male) continue;
      const [jx, jy] = toPx(j.x, j.y), R = 18 * S;
      for (let y = Math.max(0, jy - R); y < Math.min(H, jy + R); y++)
        for (let x = Math.max(0, jx - R); x < Math.min(W, jx + R); x++) { const i = y * W + x; if (A[i]) { A[i] = 0; } }
    }
    {
      const out0 = [];
      for (let i = 0; i < A.length; i++) if (A[i] && dist[i] > S && !tubeZone(i)) out0.push(i);
      if (out0.length / (S * S) >= MIN_OVF) {
        // bbox of the outside pixels, per coarse blob
        const O0 = new Uint8Array(W * H);
        for (const i of out0) O0[i] = 1;
        const oc = components(O0, W, H).comps.filter((c) => c.n / (S * S) >= 2);
        const touch = els.filter((e) => e.cat === 'art' && e.el.tagName !== 'image' && !silSet.has(e.idx) && oc.some((c) => {
          const [x0, y0] = toU(c.x0, c.y0), [x1, y1] = toU(c.x1 + 1, c.y1 + 1);
          return e.r.x0 < x1 && e.r.x1 > x0 && e.r.y0 < y1 && e.r.y1 > y0;
        }));
        touch.sort((a, b) => b.r.a - a.r.a);
        let added = 0;
        for (const e of touch.slice(0, 40)) {
          const m = alphaMask(await raster(onlyEls(new Set([e.idx]), true), vb), 40); // geometry, incl. gradient-translucent glass
          let n = 0, o = 0;
          for (let i = 0; i < m.length; i++) if (m[i]) { n++; if (dist[i] > S) o++; }
          if (n / (S * S) < 2) continue;
          if (o / n >= 0.4) {
            for (let i = 0; i < m.length; i++) if (m[i]) { SIL[i] = 1; APPM[i] = 1; }
            appendages.push(desc(e.el));
            added++;
          }
        }
        if (added) dist = distTo(SIL, W, H);
      }
    }
    // ---- category masks (rendered only if needed)
    let catMasks = null;
    const cats = ['jacktext', 'text', 'ctltext', 'knob', 'button', 'toggle', 'slider', 'foot-wrap', 'treadle', 'mic', 'led', 'screen'];
    async function getCats() {
      if (catMasks) return catMasks;
      catMasks = {};
      const groups = {};
      for (const e of els) {
        let c = e.cat;
        if (!cats.includes(c)) c = e.cat === 'art' ? null : 'otherctl';
        if (!c) continue;
        (groups[c] = groups[c] || new Set()).add(e.idx);
      }
      for (const [c, set] of Object.entries(groups)) {
        const cl = variant((cl) => {
          cl.setAttribute('visibility', 'hidden');
          for (const [i, el] of byIdx(cl)) {
            if (set.has(i)) el.setAttribute('visibility', 'visible');
            else if (el.tagName === 'text' || el.tagName === 'g') el.setAttribute('visibility', 'hidden');
          }
        });
        // a group's visibility doesn't render children that are hidden-by-inheritance: set on shapes only
        catMasks[c] = alphaMask(await raster(cl, vb), A_ON);
      }
      return catMasks;
    }
    const issues = [];
    const red = new Uint8Array(W * H);
    // art next to a treadle / big footswitch plate (hinges, pivots) belongs to it
    const footBoxes = els.filter((e) => e.cat === 'treadle' || e.cat === 'foot-wrap').map((e) => e.r);
    const nearFoot = (c, cm) => {
      const r = Math.round(3 * S);
      {
        const [x0, y0] = toU(c.x0, c.y0), [x1, y1] = toU(c.x1 + 1, c.y1 + 1);
        if (footBoxes.some((f) => f.x0 - 3 < x1 && f.x1 + 3 > x0 && f.y0 - 3 < y1 && f.y1 + 3 > y0 && (f.x1 - f.x0) * (f.y1 - f.y0) > 1500)) return true; // big plates / treadles only
      }
      for (const k of ['treadle', 'foot-wrap']) {
        const m = cm[k];
        if (!m) continue;
        for (let y = Math.max(0, c.y0 - r); y <= Math.min(H - 1, c.y1 + r); y++)
          for (let x = Math.max(0, c.x0 - r); x <= Math.min(W - 1, c.x1 + r); x++) if (m[y * W + x]) return true;
      }
      return false;
    };
    const sev = (type, kind, area, depth) => {
      const ui = kind !== 'art';
      if (type === 'detached') return area >= 50 || ui ? 'high' : 'low';
      if (ui) return area >= 15 || depth >= 2.5 ? 'high' : 'low';
      return area >= 40 ? 'medium' : 'low';
    };
    const overlapEls = (c) => {
      const [x0, y0] = toU(c.x0, c.y0), [x1, y1] = toU(c.x1 + 1, c.y1 + 1);
      return els
        .filter((e) => e.el.tagName !== 'image' && e.r.x0 < x1 && e.r.x1 > x0 && e.r.y0 < y1 && e.r.y1 > y0)
        .sort((a, b) => a.r.a - b.r.a)
        .slice(0, 6)
        .map((e) => desc(e.el));
    };
    const bboxU = (c) => { const [x0, y0] = toU(c.x0, c.y0), [x1, y1] = toU(c.x1 + 1, c.y1 + 1); return [x0, y0, +(x1 - x0).toFixed(1), +(y1 - y0).toFixed(1)]; };

    // ===== DETACHED
    const cc = components(A, W, H);
    cc.comps.sort((a, b) => b.n - a.n);
    const main = cc.comps[0];
    for (const c of cc.comps.slice(1)) {
      const area = c.n / (S * S);
      if (area < MIN_DET) continue;
      // what is it made of?
      const cm = await getCats();
      const share = {};
      for (let y = c.y0; y <= c.y1; y++)
        for (let x = c.x0; x <= c.x1; x++) {
          const i = y * W + x;
          if (cc.lab[i] !== c.id) continue;
          let k = 'art';
          for (const [cat, m] of Object.entries(cm)) if (m[i]) { k = cat; break; }
          share[k] = (share[k] || 0) + 1;
        }
      const kind = Object.entries(share).sort((a, b) => b[1] - a[1])[0][0];
      if (kind === 'treadle' || kind === 'mic') continue;
      if (tubes && toU(0, c.y1)[1] < 4) continue; // valves standing on the amp top
      // gap to the main body
      let gap = 1e9;
      for (let y = c.y0; y <= c.y1; y++)
        for (let x = c.x0; x <= c.x1; x++) if (cc.lab[y * W + x] === c.id) gap = Math.min(gap, dist[y * W + x]);
      for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (cc.lab[y * W + x] === c.id) red[y * W + x] = 1;
      issues.push({ type: 'detached', severity: sev('detached', kind, area, 0), bbox: bboxU(c), area: +area.toFixed(1), details: { kind, gapToBody: +(gap / S).toFixed(1), mainArea: +(main.n / (S * S)).toFixed(0), elements: overlapEls(c) } });
    }

    // ===== OVERFLOW past the silhouette
    const tol = (cfg.TOL ?? 1.0) * S; // antialias / edge stroke allowance
    const O = new Uint8Array(W * H);
    let anyO = 0;
    for (let i = 0; i < O.length; i++) {
      if (!A[i] || dist[i] <= tol) continue;
      if (tubeZone(i)) continue;
      O[i] = 1;
      anyO = 1;
    }
    if (anyO) {
      const oc = components(O, W, H);
      const cm = await getCats();
      for (const c of oc.comps) {
        const area = c.n / (S * S);
        if (area < MIN_OVF) continue;
        let depth = 0;
        const share = {};
        for (let y = c.y0; y <= c.y1; y++)
          for (let x = c.x0; x <= c.x1; x++) {
            const i = y * W + x;
            if (oc.lab[i] !== c.id) continue;
            depth = Math.max(depth, dist[i]);
            let k = 'art';
            for (const [cat, m] of Object.entries(cm)) if (m[i]) { k = cat; break; }
            share[k] = (share[k] || 0) + 1;
          }
        if (depth / S < MIN_DEPTH) continue;
        const kind = Object.entries(share).sort((a, b) => b[1] - a[1])[0][0];
        if (['foot-wrap', 'treadle', 'mic'].includes(kind)) continue;
        // part of a detached piece already reported? (then its "overflow" is the same thing)
        let inDet = 0;
        for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) { const i = y * W + x; if (oc.lab[i] === c.id && red[i]) inDet++; }
        if (inDet > c.n * 0.6) continue;
        if (kind === 'art' && nearFoot(c, cm)) continue;
        for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (oc.lab[y * W + x] === c.id) red[y * W + x] = 2;
        issues.push({ type: 'overflow', severity: sev('overflow', kind, area, depth / S), bbox: bboxU(c), area: +area.toFixed(1), details: { kind, where: 'outline', depth: +(depth / S).toFixed(1), share: Object.fromEntries(Object.entries(share).map(([k, v]) => [k, +(v / S / S).toFixed(1)])), elements: overlapEls(c) } });
      }
    }
    // ===== outside the reported w/h box
    {
      const B = new Uint8Array(W * H);
      let any = 0;
      const [bx0, by0] = toPx(-BOX_TOL, (tubes ? -50 : 0) - BOX_TOL), [bx1, by1] = toPx(w + BOX_TOL, h + BOX_TOL);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (A[i] && !APPM[i] && (x < bx0 || x > bx1 || y < by0 || y > by1)) { B[i] = 1; any = 1; }
        }
      if (any) {
        const bc = components(B, W, H);
        const cm = await getCats();
        for (const c of bc.comps) {
          const area = c.n / (S * S);
          if (area < MIN_OVF) continue;
          const share = {};
          for (let y = c.y0; y <= c.y1; y++)
            for (let x = c.x0; x <= c.x1; x++) {
              const i = y * W + x;
              if (bc.lab[i] !== c.id) continue;
              let k = 'art';
              for (const [cat, m] of Object.entries(cm)) if (m[i]) { k = cat; break; }
              share[k] = (share[k] || 0) + 1;
            }
          const kind = Object.entries(share).sort((a, b) => b[1] - a[1])[0][0];
          if (['foot-wrap', 'treadle', 'mic'].includes(kind)) continue;
          if (kind === 'art' && nearFoot(c, cm)) continue;
          for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (bc.lab[y * W + x] === c.id) red[y * W + x] = red[y * W + x] || 3;
          issues.push({ type: 'overflow', severity: sev('overflow', kind, area, 3), bbox: bboxU(c), area: +area.toFixed(1), details: { kind, where: 'box', box: [w, h], share: Object.fromEntries(Object.entries(share).map(([k, v]) => [k, +(v / S / S).toFixed(1)])), elements: overlapEls(c) } });
        }
      }
    }
    for (const e of off.slice(0, 5)) issues.push({ type: 'overflow', severity: 'high', bbox: [+e.r.x0.toFixed(0), +e.r.y0.toFixed(0), +(e.r.x1 - e.r.x0).toFixed(0), +(e.r.y1 - e.r.y0).toFixed(0)], area: 0, details: { kind: e.cat, where: 'offcanvas', elements: [desc(e.el)] } });

    const out = { id: d.id, name: d.name, plugin: d.plugin || 'core', form: d.form, w, h, issues };
    if (appendages.length) out.appendages = appendages.slice(0, 8);
    if (o.stats) { out.cats = {}; for (const e of els) out.cats[e.cat] = (out.cats[e.cat] || 0) + 1; let n = 0; for (let i = 0; i < A.length; i++) n += A[i]; out.opaqueArea = Math.round(n / S / S); }
    if (o.png && (issues.length || o.allPng)) {
      // normal look (with jacks & shadow) dimmed, silhouette outline cyan, offenders red
      const look = await raster(g.cloneNode(true), vb);
      const c2 = document.createElement('canvas');
      c2.width = W; c2.height = H;
      const x2 = c2.getContext('2d');
      x2.fillStyle = '#e8e8e8';
      x2.fillRect(0, 0, W, H);
      x2.globalAlpha = 0.55;
      x2.drawImage(look.img, 0, 0, W, H);
      x2.globalAlpha = 1;
      const id = x2.getImageData(0, 0, W, H);
      const p = id.data;
      for (let i = 0; i < W * H; i++) {
        if (red[i]) { p[i * 4] = red[i] === 1 ? 255 : red[i] === 2 ? 230 : 255; p[i * 4 + 1] = red[i] === 1 ? 0 : red[i] === 2 ? 0 : 120; p[i * 4 + 2] = red[i] === 1 ? 200 : 0; p[i * 4 + 3] = 255; }
        else if (SIL[i] && dist[i] === 0) {
          const x = i % W;
          const edge = (x > 0 && !SIL[i - 1]) || (x < W - 1 && !SIL[i + 1]) || (i >= W && !SIL[i - W]) || (i < W * (H - 1) && !SIL[i + W]);
          if (edge) { p[i * 4] = 0; p[i * 4 + 1] = 170; p[i * 4 + 2] = 255; p[i * 4 + 3] = 255; }
        }
      }
      x2.putImageData(id, 0, 0);
      const [bx0, by0] = toPx(0, 0), [bx1, by1] = toPx(w, h);
      x2.strokeStyle = 'rgba(200,160,0,0.9)';
      x2.setLineDash([6, 4]);
      x2.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
      x2.setLineDash([]);
      x2.lineWidth = 2;
      for (const is of issues) {
        if (is.details.where === 'offcanvas') continue;
        const [a, b] = toPx(is.bbox[0], is.bbox[1]);
        x2.strokeStyle = is.type === 'detached' ? '#d000c0' : '#ff0000';
        x2.strokeRect(a - 4, b - 4, is.bbox[2] * S + 8, is.bbox[3] * S + 8);
      }
      x2.fillStyle = '#000';
      x2.font = 'bold 13px sans-serif';
      x2.fillText(d.id + '  ' + issues.map((x) => x.type[0].toUpperCase() + ':' + x.details.kind).join(' '), 4, 14);
      out.png = c2.toDataURL('image/png');
    }
    return out;
  }
  window.__qa = async (ids, o) => {
    const res = [];
    for (const id of ids) {
      const d = C.allDefs().find((x) => x.id === id);
      try {
        res.push(await analyse(d, o));
      } catch (e) {
        res.push({ id, plugin: d.plugin || 'core', form: d.form, error: 'qa: ' + String(e.stack || e).slice(0, 300), issues: [] });
      }
    }
    host.innerHTML = '';
    return res;
  };
};
