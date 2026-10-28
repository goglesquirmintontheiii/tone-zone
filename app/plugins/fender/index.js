// Built-in Tone Zone plugin: Fender.
// Blocks inspired by Fender gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, preampOf, marshallKnobs, fenderKnobs } = tz.builders;

  // ---- amp helpers (same pattern in every amp-brand plugin)
  // ampFit: explicit panel layout so mini toggles never collide with the knob row / power LED.
  // AMPX: amp + matching rack preamp; controls named 'r.*' / 't.*' add an onboard spring reverb / tremolo (chain).
  const isFx = (c) => typeof c.p === 'string' && /^[rt]\./.test(c.p);
  function ampFit(a) {
    const tg = a.controls.filter((c) => c.t === 'toggle' && c.x === undefined);
    if (!tg.length) return a;
    const kn = a.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && !c.hidden);
    const tgW = 34 * tg.length + 6, pads = Math.ceil(tgW / 44);
    for (let i = 0; i < pads; i++) a.controls.push({ t: 'knob', hidden: true });
    const w = Math.max(420, 70 + (kn.length + pads) * 44 + 90), y = (a.combo ? 14 : 104) + 43, x0 = 76, x1 = w - 86 - tgW;
    kn.forEach((c, i) => Object.assign(c, { x: kn.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (kn.length - 1), y }));
    tg.forEach((t, i) => Object.assign(t, { x: x1 + 40 + i * 34, y: y + 1, orient: 'v', optSize: 4.6 }));
    return a;
  }
  function AMPX(o) {
    const a = ampFit(AMP(o));
    const pre = preampOf(Object.assign({}, a, { controls: a.controls.filter((c) => !isFx(c)) }));
    const sw = a.controls.filter((c) => (c.t === 'toggle' || c.t === 'sel') && !isFx(c)).map((c) => SEL(c.p, c.label, c.options, { values: c.values, def: c.def ?? 0, virtual: c.virtual, sweep: c.options.length > 2 ? 90 : 60, optSize: 4.2 }));
    const pc = pre.controls.filter((c) => !(c.t === 'knob' && !c.p));
    const li = pc.findIndex((c) => c.p === 'level');
    pc.splice(li, 0, ...sw);
    pre.controls = pc;
    if (o.derive) pre.derive = o.derive;
    if (o.preFixed) pre.fixed = o.preFixed;
    if (a.controls.some(isFx)) {
      const hasT = a.controls.some((c) => c.p && c.p.startsWith('t.')), hasR = a.controls.some((c) => c.p && c.p.startsWith('r.'));
      const chain = [{ prefix: 'a', algo: 'amp', opts: a.opts }];
      if (hasT) chain.push({ prefix: 't', algo: 'tremolo', params: Object.assign({ mode: 0, depth: 0, rate: 0.45, wave: 0.25 }, o.trem) });
      if (hasR) chain.push({ prefix: 'r', algo: 'reverb', params: Object.assign({ mode: 3, decay: 0.45, mix: 0.2, tone: 0.55, lowcut: 0.2 }, o.verb) });
      a.algo = 'chain';
      a.opts = { chain };
      a.cost = 3.2;
      a.controls = a.controls.map((c) => (c.p && !isFx(c) ? Object.assign({}, c, { p: 'a.' + c.p }) : c));
      if (a.fixed) a.fixed = Object.fromEntries(Object.entries(a.fixed).map(([kk, v]) => ['a.' + kk, v]));
      const dv = o.derive;
      a.derive = (u) => {
        const out = {};
        if (dv) {
          const plain = {};
          for (const kk in u) plain[kk.startsWith('a.') ? kk.slice(2) : kk] = u[kk];
          const r = dv(plain);
          for (const kk in r) out['a.' + kk] = r[kk];
        }
        if (hasT) out['t.on'] = (u['t.depth'] ?? 0) > 0.01 ? 1 : 0;
        if (hasR) out['r.on'] = (u['r.mix'] ?? 0) > 0.004 ? 1 : 0;
        return out;
      };
    }
    return [a, pre];
  }
  const fk = (p, label, o = {}) => k(p, label, Object.assign({ scale: 10, style: 'fender' }, o));

  // ---- Fender 2018+ pedal enclosure: anodized aluminium, dark control deck, chrome amp-jewel LED
  tz.addForm('fender-pedal', (ctx, d) => {
    const { svg, label, formKit, shade } = tz.gfx;
    const g = ctx.g;
    const kn = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && (c.x === undefined || c._fa));
    const foots = d.controls.filter((c) => c.t === 'foot' && (c.x === undefined || c._fa));
    const tg = d.controls.filter((c) => c.t === 'toggle' && (c.x === undefined || c._fa));
    const wide = d.wide || kn.length > 4 || foots.length > 1;
    const w = wide ? 190 : 140;
    const txt = d.text || '#f2f2f2';
    const perRow = kn.length === 4 && !wide ? 2 : kn.length <= 3 ? kn.length : Math.ceil(kn.length / 2);
    const rows = [];
    for (let i = 0; i < kn.length; i += perRow) rows.push(kn.slice(i, i + perRow));
    const deckH = 22 + rows.length * 46 + (tg.length ? 34 : 0);
    const ly = deckH + 30, fy = ly + 68, h = fy + 38;
    formKit.body(g, w, h, d.color, { rx: 10, brushed: true });
    const darkTxt = tz.gfx.luminance(txt) < 0.5;
    svg('rect', { x: 8, y: 8, width: w - 16, height: deckH, rx: 7, fill: darkTxt ? '#fff' : '#0b0b0c', opacity: darkTxt ? 0.32 : 0.82 }, g);
    svg('rect', { x: 8, y: 8, width: w - 16, height: deckH, rx: 7, fill: 'none', stroke: shade(d.color, 0.35), 'stroke-opacity': 0.6 }, g);
    rows.forEach((r, ri) => {
      const step = (w - 64) / Math.max(1, perRow - 1), x0 = r.length === 1 ? w / 2 : 32 + ((perRow - r.length) * step) / 2, x1 = r.length === 1 ? w / 2 : x0 + step * (r.length - 1);
      r.forEach((c, i) => Object.assign(c, { _fa: 1, x: r.length === 1 ? w / 2 : x0 + ((x1 - x0) * i) / (r.length - 1), y: 40 + ri * 46, r: 12, labelPos: 'above', labelSize: 5.6 }));
    });
    tg.forEach((t, i) => Object.assign(t, { _fa: 1, x: tg.length === 1 ? w / 2 : 34 + (i * (w - 68)) / (tg.length - 1), y: 22 + rows.length * 46 + 10, orient: 'h', optSize: 4.4 }));
    // amp jewel
    const leds = d.controls.filter((c) => c.t === 'led' && (c.x === undefined || c._fa));
    const jx = leds.length > 1 ? [w * 0.27, w * 0.73] : [w / 2];
    jx.forEach((x) => {
      svg('circle', { cx: x, cy: ly, r: 8.5, fill: 'url(#g-chromeR)' }, g);
      svg('circle', { cx: x, cy: ly, r: 6.2, fill: '#2a0505' }, g);
    });
    leds.forEach((l, i) => Object.assign(l, { _fa: 1, x: jx[i] ?? w / 2, y: ly, r: 5, color: l.color || '#ff2a1a' }));
    label(g, w / 2, ly + 24, d.logo || d.name, { size: d.logoSize || ((d.logo || d.name).length > 11 ? 12 : 15), fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.4 });
    label(g, w / 2, ly + 37, (d.typeName || d.cat).toUpperCase(), { size: 5.4, fill: txt, weight: 700, ls: 1.8, opacity: 0.75 });
    foots.forEach((f, i) => Object.assign(f, { _fa: 1, style: 'stomp', r: 13, y: fy, x: foots.length === 1 ? w / 2 : [w * 0.27, w * 0.73][i], labelDy: -20 }));
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.2);
    const theme = { text: txt, knob: d.knob || 'fender', labelSize: 5.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 56, gap: 28, flip: ctx.flip }) };
  });

  // ---- Hammertone series: slim enclosure with a hammered finish and coloured knobs
  tz.addForm('fender-hammertone', (ctx, d) => {
    const { svg, label, formKit, noisePattern } = tz.gfx;
    const g = ctx.g;
    const defs = document.getElementById('globalDefs');
    if (defs && !document.getElementById('fdr-hammer')) {
      noisePattern(defs, 'fdr-hammer', 26, 40, [255, 255, 255], 0, 0.22, 2);
      noisePattern(defs, 'fdr-hammer2', 17, 32, [0, 0, 0], 0, 0.3, 2);
    }
    const w = 124, h = 222, txt = d.text || '#f4f4f4';
    formKit.body(g, w, h, d.color, { rx: 8, grain: false });
    svg('rect', { x: 0, y: 0, width: w, height: h, rx: 8, fill: 'url(#fdr-hammer)' }, g);
    svg('rect', { x: 0, y: 0, width: w, height: h, rx: 8, fill: 'url(#fdr-hammer2)' }, g);
    const kn = d.controls.filter((c) => c.t === 'knob' && (c.x === undefined || c._fa));
    const top = kn.length === 4 ? kn.slice(0, 2) : kn;
    const bot = kn.length === 4 ? kn.slice(2) : [];
    top.forEach((c, i) => Object.assign(c, { _fa: 1, x: top.length === 1 ? w / 2 : 26 + ((w - 52) * i) / (top.length - 1), y: 34, r: 11, labelPos: 'below', labelSize: 5.4 }));
    bot.forEach((c, i) => Object.assign(c, { _fa: 1, x: 26 + ((w - 52) * i) / (bot.length - 1), y: 78, r: 11, labelPos: 'below', labelSize: 5.4 }));
    const kc = d.knobColor || '#e8e8e8';
    for (const c of kn) svg('circle', { cx: c.x, cy: c.y, r: c.r + 2.2, fill: kc, opacity: 0.95 }, g);
    const tg = d.controls.filter((c) => c.t === 'toggle' && (c.x === undefined || c._fa));
    const ty = bot.length ? 116 : 86;
    tg.forEach((t, i) => Object.assign(t, { _fa: 1, x: tg.length === 1 ? w / 2 : [34, w - 34][i], y: ty, orient: 'h', optSize: 4.2 }));
    const ly = tg.length ? ty + 30 : bot.length ? 122 : 104;
    label(g, w / 2, ly, d.logo || d.name, { size: 13, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.2 });
    svg('rect', { x: 22, y: ly + 9, width: w - 44, height: 2, fill: kc, opacity: 0.9 }, g);
    label(g, w / 2, ly + 19, (d.typeName || d.cat).toUpperCase(), { size: 5.2, fill: txt, weight: 700, ls: 1.8, opacity: 0.8 });
    d.controls.forEach((c) => {
      if (c.t === 'led' && (c.x === undefined || c._fa)) Object.assign(c, { _fa: 1, x: w / 2, y: h - 66, r: 3 });
      if (c.t === 'foot' && (c.x === undefined || c._fa)) Object.assign(c, { _fa: 1, style: 'stomp', x: w / 2, y: h - 36, r: 13 });
    });
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.2);
    const theme = { text: txt, knob: d.knob || 'white', labelSize: 5.4 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 150, gap: 28, flip: ctx.flip }) };
  });

  const FP = (o) => def(Object.assign({ form: 'fender-pedal' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: '#ff2a1a' })])] }));
  const HT = (o) => def(Object.assign({ form: 'fender-hammertone', color: '#5f6368' }, o, { controls: [...o.controls, FOOT(), LED({ color: '#ff2a1a' })] }));

  tz.addDefs([
    preampPair(AMP({ id: 'amp.deluxe', name: 'US Deluxe 65', ref: 'Fender Deluxe Reverb', opts: { model: 'deluxe' }, combo: true, speakers: 1, tolex: '#141414', panel: '#151515', panelText: '#e8e8e8', grille: 'silver', logo: 'Delux', logoColor: '#e9e9e9', knob: 'fender', controls: [...fenderKnobs(false), TOG('bright', 'BRIGHT', ['OFF', 'ON'])], desc: 'Classic blackface clean that breaks up when pushed.' })),
    preampPair(AMP({ id: 'amp.twin', name: 'US Twin 65', ref: 'Fender Twin Reverb', opts: { model: 'twin' }, combo: true, speakers: 2, tolex: '#141414', panel: '#151515', panelText: '#e8e8e8', grille: 'silver', logo: 'Twain', logoColor: '#e9e9e9', knob: 'fender', controls: [...fenderKnobs(true), TOG('bright', 'BRIGHT', ['OFF', 'ON'])] })),
    preampPair(AMP({ id: 'amp.bassman', name: 'Tweed Bassmaster', ref: 'Fender 1959 Bassman', opts: { model: 'bassman' }, combo: true, speakers: 2, tolex: '#c8b27c', panel: '#c9c1ad', panelText: '#2a1d10', grille: 'brown', logo: 'Bassmaster', logoColor: '#efe6d0', knob: 'chicken', piping: '#5a3a1a',
      controls: [k('presence', 'PRESENCE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('gain', 'VOLUME'), k('master', 'MASTER', { def: 0.65 })] })),
    CAB({ id: 'cab.1x12us', name: '1x12 US Deluxe', ref: 'Fender Deluxe 1x12 (Jensen)', opts: { model: '1x12us' }, cabSize: '1x12', grille: 'silver', logo: 'Delux', logoColor: '#eee' }),
    CAB({ id: 'cab.2x12twin', name: '2x12 US Twin', ref: 'Fender Twin 2x12', opts: { model: '2x12twin' }, cabSize: '2x12', grille: 'silver', logo: 'Twain', logoColor: '#eee' }),
    CAB({ id: 'cab.4x10tweed', name: '4x10 Tweed', ref: 'Fender Bassman 4x10', opts: { model: '4x10tweed' }, cabSize: '4x10', tolex: '#c8b27c', grille: 'brown', logo: 'Bassmaster', piping: '#5a3a1a' }),

    // ---------------- amps (v0.2)
    AMPX({ id: 'fender.amp-princeton', name: 'US Princely 65', ref: "Fender '65 Princeton Reverb", combo: true, speakers: 1, tolex: '#141414', panel: '#151515', panelText: '#e8e8e8', grille: 'silver', logo: 'Princely', logoColor: '#e9e9e9', knob: 'fender',
      opts: { voice: { base: 'deluxe', stages: [[34, 1.35, 0.2, 10000, 30], [32, 1.35, 0.22, 7800, 45]], stack: [250e3, 250e3, 6.8e3, 100e3, 250e-12, 100e-9, 47e-9], brightDb: 0, pwrH: 1.1, sag: 0.55, otLp: 6000, otHp: 90, nfb: 0.35 } },
      controls: [fk('gain', 'VOLUME', { def: 0.45 }), fk('treble', 'TREBLE', { def: 0.6 }), fk('bass', 'BASS', { def: 0.45 }), fk('r.mix', 'REVERB', { def: 0.22 }), fk('t.rate', 'SPEED', { def: 0.45 }), fk('t.depth', 'INTENSITY', { def: 0 })],
      fixed: { master: 0.6 }, desc: 'Small blackface combo: sweet, early breakup, onboard spring reverb and bias tremolo.' }),
    AMPX({ id: 'fender.amp-superreverb', name: 'US Super Verb 65', ref: 'Fender Super Reverb (blackface)', combo: true, speakers: 2, tolex: '#141414', panel: '#151515', panelText: '#e8e8e8', grille: 'silver', logo: 'Super Verb', logoColor: '#e9e9e9', knob: 'fender',
      opts: { voice: { base: 'twin', stages: [[36, 1.6, 0.17, 12500, 25], [31, 1.7, 0.18, 9500, 35]], brightHz: 2000, brightDb: 6, pwrH: 2.6, sag: 0.3, otLp: 7400, otHp: 60, nfb: 0.55 } },
      controls: [fk('gain', 'VOLUME', { def: 0.4 }), fk('treble', 'TREBLE', { def: 0.6 }), fk('mid', 'MIDDLE'), fk('bass', 'BASS', { def: 0.45 }), fk('r.mix', 'REVERB', { def: 0.2 }), fk('t.rate', 'SPEED', { def: 0.45 }), fk('t.depth', 'INTENSITY', { def: 0 }), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      fixed: { master: 0.6 }, desc: '4x10 blackface combo: big, scooped clean with lots of headroom.' }),
    AMPX({ id: 'fender.amp-hotrod', name: 'Hot Road Deluxe', ref: 'Fender Hot Rod Deluxe IV', combo: true, speakers: 1, tolex: '#151515', panel: '#c5c9ce', panelText: '#111', grille: 'silver', logo: 'Hot Road', logoColor: '#ececec', knob: 'chicken',
      opts: { models: [
        { base: 'twin', stages: [[36, 1.6, 0.18, 12000, 25], [30, 1.7, 0.2, 9500, 35]], pwrH: 2.4, sag: 0.3, otLp: 7000, presHz: 3800 },
        { base: 'jcm800', stages: [[42, 1.5, 0.28, 11000, 40], [38, 1.25, 0.33, 8000, 110], [26, 1.3, 0.3, 7000, 100]], stack: 'fender', tsPos: 3, pwrH: 2.2, sag: 0.35, otLp: 6800, presHz: 3800 },
        { base: 'jcm800', stages: [[45, 1.5, 0.3, 10500, 40], [42, 1.2, 0.35, 7800, 130], [36, 1.1, 0.38, 7000, 110], [24, 1.2, 0.3, 6600, 80]], stack: 'fender', tsPos: 4, pwrH: 2.2, sag: 0.35, otLp: 6500, presHz: 3800, tight: 0.2 },
      ] },
      controls: [k('vol', 'VOLUME', { def: 0.45, virtual: true }), k('drv', 'DRIVE', { def: 0.55, virtual: true }), k('treble', 'TREBLE'), k('bass', 'BASS', { def: 0.45 }), k('mid', 'MIDDLE'), k('master', 'MASTER'), k('r.mix', 'REVERB', { def: 0.15 }), k('presence', 'PRESENCE'),
        TOG('bright', 'BRIGHT', ['OFF', 'ON']), TOG('channel', 'CHANNEL', ['NORMAL', 'DRIVE', 'MORE'])],
      derive: (u) => ({ gain: (u.channel ?? 0) ? u.drv ?? 0.55 : u.vol ?? 0.45 }), desc: 'The club workhorse: Normal channel, Drive and More Drive, spring reverb.' }),
    AMPX({ id: 'fender.amp-tweeddeluxe', name: 'Tweed Delightful', ref: "Fender '57 Tweed Deluxe 5E3", combo: true, speakers: 1, tolex: '#c8b27c', panel: '#c9c1ad', panelText: '#2a1d10', grille: 'brown', logo: 'Tweedy', logoColor: '#efe6d0', knob: 'chicken', piping: '#5a3a1a',
      opts: { voice: { base: 'deluxe', stages: [[40, 1.25, 0.3, 7600, 25], [32, 1.15, 0.36, 6200, 40]], stack: 'fender', tsPos: 1, brightHz: 1600, brightDb: 3, pwrH: 0.9, sag: 0.75, nfb: 0, otLp: 5200, otHp: 80, presHz: 0 } },
      controls: [k('gain', 'INST VOL', { def: 0.55 }), k('mic', 'MIC VOL', { def: 0.4, virtual: true }), k('treble', 'TONE', { def: 0.55 })],
      derive: (u) => ({ bass: 0.35 + 0.45 * (u.mic ?? 0.4), mid: 0.45 + 0.3 * (u.mic ?? 0.4) }), fixed: { master: 0.55 }, desc: 'Cathode-biased 6V6 tweed: compresses and growls as soon as you dig in.' }),
    AMPX({ id: 'fender.amp-bassman100t', name: 'Bassmaster 100', ref: 'Fender Bassman 100T', cat: 'Bass Amp', tolex: '#151515', panel: '#c9ccd1', panelText: '#111', grille: 'silver', logo: 'Bassmaster', logoColor: '#ececec', knob: 'fender', piping: '#d8d8d8',
      opts: { voice: { base: 'svt', stages: [[38, 1.6, 0.25, 9000, 15], [28, 1.5, 0.3, 7000, 20]], tsType: 0, stack: 'bassman', tsPos: 1, pwrH: 2.4, sag: 0.4, otLp: 5600, otHp: 30, presHz: 0 } },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS', { def: 0.55 }), k('master', 'MASTER'), TOG('bright', 'BRIGHT', ['OFF', 'ON']), TOG('ultralo', 'DEEP', ['OFF', 'ON'])],
      desc: 'All-tube 100 W bass head with the classic Fender bass stack.' }),
    AMPX({ id: 'fender.amp-rumble800', name: 'Rumbler 800', ref: 'Fender Rumble 800 HD', cat: 'Bass Amp', tolex: '#111', panel: '#2b2c2f', panelText: '#e8e8e8', grille: 'black', headGrille: false, logo: 'Rumbler', logoColor: '#d8d8d8', knob: 'chrome',
      opts: { models: [
        { base: 'markbass', tsType: 3, baxBass: 60, baxTreble: 5000, baxRange: 15 },
        { base: 'b15', stages: [[30, 1.8, 0.22, 7500, 20], [24, 1.7, 0.25, 6500, 25]], tsType: 3, baxBass: 70, baxTreble: 3000 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('bass', 'BASS'), k('mid', 'MID'), k('midfreq', 'FREQ'), k('treble', 'TREBLE'), k('master', 'MASTER'), TOG('ultrahi', 'BRIGHT', ['OFF', 'ON']), TOG('ultralo', 'CONTOUR', ['OFF', 'ON']), TOG('channel', 'VINTAGE', ['OFF', 'ON'])],
      desc: 'Lightweight class-D bass head with Bright, Contour and Vintage voicings.' }),

    // ---------------- cabs (v0.2)
    CAB({ id: 'fender.cab-princeton', name: '1x10 US Princely', ref: 'Fender Princeton 1x10 (Jensen C10R)', opts: { cab: { hp: 115, hpQ: 0.9, resDb: 2, lp: 5200, open: true, peaks: [[1200, 1.2, -1.5], [2600, 1.6, 4], [4200, 2, 2]], seed: 31 } }, cabSize: '1x10', grille: 'silver', logo: 'Princely', logoColor: '#eee' }),
    CAB({ id: 'fender.cab-super4x10', name: '4x10 US Super Verb', ref: 'Fender Super Reverb 4x10 (Jensen P10R)', opts: { cab: { hp: 95, hpQ: 1.0, resDb: 2, lp: 5800, open: true, peaks: [[700, 1, 1], [2400, 1.4, 3.5], [4500, 2, 2]], seed: 32 } }, cabSize: '4x10', grille: 'silver', logo: 'Super Verb', logoColor: '#eee' }),
    CAB({ id: 'fender.cab-rumble115', name: '1x15 Rumbler', ref: 'Fender Rumble 115', bass: true, opts: { cab: { hp: 38, hpQ: 1.1, resDb: 3, lp: 3800, peaks: [[70, 1, 2.5], [500, 1, 1], [1300, 1.2, -2], [5000, 1, 2]], seed: 33, detail: 1.2 } }, cabSize: '1x15', grille: 'black', logo: 'Rumbler', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8', piping: '#9a9a9a' }),

    // ---------------- pedals (v0.2)
    FP({ id: 'fender.smolder', name: 'Ember Acoustic OD', ref: 'Fender Smolder Acoustic Overdrive', logo: 'EMBER', typeName: 'Acoustic Overdrive', cat: 'Overdrive', color: '#8a3a22', wide: true,
      algo: 'drive', opts: { clip: 'jfet', bias: 0.12, preHp: 55, gainMinDb: 0, gainMaxDb: 28, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 900, trebleF: 4200, midQ: 0.8, postLp: 13000, levelMaxDb: 14,
        modes: [{}, { preEq: [{ type: 'hs', f: 3500, q: 0.7, db: -6 }, { type: 'peak', f: 1300, q: 1.2, db: -2 }] }, { postEq: [{ type: 'lp', f: 6500, q: 0.7, db: 0 }, { type: 'peak', f: 2600, q: 1.2, db: -3 }] }, { preEq: [{ type: 'hs', f: 3500, q: 0.7, db: -6 }], postEq: [{ type: 'lp', f: 6500, q: 0.7, db: 0 }, { type: 'peak', f: 2600, q: 1.2, db: -3 }] }] },
      controls: [K('level', 'LEVEL', { display: ten }), K('gain', 'DRIVE', { display: ten, def: 0.35 }), K('bass', 'BASS', { display: ten }), K('mid', 'MID', { display: ten }), K('treble', 'TREBLE', { display: ten }), TOG('pcomp', 'PICKUP COMP', ['OFF', 'ON'], { virtual: true }), TOG('filt', 'FILTER', ['OFF', 'ON'], { virtual: true })],
      derive: (u) => ({ mode: (u.pcomp ?? 0) + 2 * (u.filt ?? 0) }), desc: 'Acoustic-friendly overdrive: warm grit that keeps a piezo or acoustic DI sounding woody. Pickup Comp tames piezo quack, Filter is a cab-style roll-off for full-range rigs.', tags: ['acoustic', 'piezo'] }),
    FP({ id: 'fender.santaana', name: 'Santa Rita Overdrive', ref: 'Fender Santa Ana Overdrive', logo: 'SANTA RITA', typeName: 'Overdrive', cat: 'Overdrive', color: '#b3202a',
      algo: 'drive', opts: { tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 750, trebleF: 3200, levelMaxDb: 10, modes: [{ clip: 'asym', bias: 0.2, gainMinDb: 2, gainMaxDb: 36, postLp: 8000 }, { clip: 'jfet', bias: 0.1, gainMinDb: 0, gainMaxDb: 32, postLp: 10500, preEq: [{ type: 'peak', f: 900, q: 0.8, db: -2 }] }] },
      controls: [K('level', 'LEVEL', { display: ten }), K('gain', 'DRIVE', { display: ten, def: 0.45 }), K('bright', 'PRESENCE', { display: ten, def: 0.3 }), K('bass', 'BASS', { display: ten }), K('mid', 'MIDDLE', { display: ten }), K('treble', 'TREBLE', { display: ten }),
        TOG('mode', 'VOICE', ['A', 'B']), TOG('btype', 'BOOST', ['LEVEL', 'DRIVE'], { virtual: true }),
        FOOT({ action: 'bypass', label: 'ON' }), FOOT({ action: 'param', p: 'boost', toggle: true, label: 'BOOST', virtual: true }), LED({ color: '#ff2a1a' }), LED({ bind: 'param:boost', color: '#ff2a1a' })],
      noStd: true, derive: (u) => (u.boost ? (u.btype ? { gain: Math.min(1, (u.gain ?? 0.45) + 0.25) } : { level: Math.min(1, (u.level ?? 0.5) + 0.2) }) : {}), desc: 'Two-voice overdrive with a second footswitch for a level or drive boost.' }),
    FP({ id: 'fender.pugilist', name: 'Brawler Distortion', ref: 'Fender Pugilist Distortion', logo: 'BRAWLER', typeName: 'Dual Distortion', cat: 'Distortion', color: '#c9a24a', text: '#141414',
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'drive', opts: { clip: 'diode', preHp: 80, gainMinDb: 6, gainMaxDb: 40, tone: 'lp', toneLo: 1200, toneHi: 9000, postLp: 8000, levelMaxDb: 4, modes: [{}, { preEq: [{ type: 'ls', f: 140, q: 0.7, db: 6 }] }] }, params: { level: 0.55 } },
        { prefix: 'b', algo: 'drive', opts: { clip: 'si', bias: 0.2, preHp: 60, gainMinDb: 4, gainMaxDb: 36, tone: 'lp', toneLo: 1500, toneHi: 10000, postLp: 8500, levelMaxDb: 2, cleanSum: true, modes: [{}, { preEq: [{ type: 'ls', f: 140, q: 0.7, db: 5 }] }] } },
      ] },
      controls: [K('a.tone', 'TONE A', { display: ten }), K('a.gain', 'GAIN A', { display: ten }), K('b.tone', 'TONE B', { display: ten }), K('b.gain', 'GAIN B', { display: ten, def: 0.4 }), K('mix', 'BLEND', { display: ten, virtual: true }), K('b.level', 'LEVEL', { display: ten, def: 0.45 }),
        TOG('series', 'MODE', ['BLEND', 'SERIES'], { virtual: true }), TOG('bb', 'BASS BOOST', ['OFF', 'ON'], { virtual: true })],
      derive: (u) => ({ 'b.blend': u.series ? 1 : 0.15 + 0.85 * (u.mix ?? 0.5), 'a.mode': u.bb ?? 0, 'b.mode': u.bb ?? 0 }), desc: 'Two distortion engines, blended or stacked in series, with a bass boost.' }),
    FP({ id: 'fender.marinelayer', name: 'Sea Mist Reverb', ref: 'Fender Marine Layer Reverb', logo: 'SEA MIST', typeName: 'Reverb', cat: 'Reverb', color: '#7fbfb1', text: '#0f2622', stereo: 'both',
      algo: 'reverb', cost: 1.5,
      controls: [K('decay', 'TIME', { display: ten, def: 0.5 }), K('highdamp', 'DAMPING', { display: ten, def: 0.4 }), K('predelay', 'PRE-DELAY', { min: 0, max: 250, def: 15, display: ms }), K('mix', 'LEVEL', { display: ten, def: 0.32 }),
        TOG('type', 'TYPE', ['HALL', 'ROOM', 'SPECIAL'], { virtual: true }), TOG('var', 'VARIATION', ['1', '2'], { virtual: true })],
      derive: (u) => ({ mode: [[1, 6], [0, 2], [4, 5]][u.type ?? 0][u.var ?? 0] }), desc: 'Hall, Room and Special (shimmer / cloud) reverbs, two variations each.' }),
    FP({ id: 'fender.mirrorimage', name: 'Looking Glass Delay', ref: 'Fender Mirror Image Delay', logo: 'LOOKING GLASS', typeName: 'Delay', cat: 'Delay', color: '#2f5f8f', stereo: 'both',
      algo: 'delay', opts: { maxMs: 1500 }, cost: 1,
      controls: [K('moddepth', 'DEPTH', { display: ten, def: 0.15 }), K('modrate', 'RATE', { display: ten, def: 0.3 }), K('feedback', 'FEEDBACK', { display: ten, def: 0.35 }), K('time', 'TIME', { min: 30, max: 1500, def: 420, curve: 'log', display: ms }), K('mix', 'LEVEL', { display: ten, def: 0.35 }),
        TOG('mode', 'MODE', ['DIGITAL', 'ANALOG', 'TAPE'], { values: [0, 1, 2] }), TOG('dot', 'DOTTED 1/8', ['OFF', 'ON'], { virtual: true })],
      derive: (u) => (u.dot ? { time: (u.time ?? 420) * 0.75 } : {}), desc: 'Digital, analog (BBD) and tape echo with modulation and a dotted-eighth switch.' }),
    FP({ id: 'fender.treverb', name: 'Trem-O-Verb', ref: 'Fender Tre-Verb', logo: 'TREM-O-VERB', typeName: 'Tremolo & Reverb', cat: 'Reverb', color: '#3d4a52', stereo: 'both',
      algo: 'chain', cost: 1.6, opts: { chain: [{ prefix: 't', algo: 'tremolo' }, { prefix: 'r', algo: 'reverb', params: { mode: 3 } }] },
      controls: [K('t.rate', 'RATE', { display: ten, def: 0.45 }), K('t.depth', 'DEPTH', { display: ten, def: 0.55 }), K('t.level', 'LEVEL', { display: ten, def: 0.5 }), K('r.decay', 'DWELL', { display: ten, def: 0.45 }), K('r.tone', 'TONE', { display: ten, def: 0.55 }), K('r.mix', 'BLEND', { display: ten, def: 0.3 }),
        TOG('ttype', 'TREMOLO', ['OPTO', 'BIAS', 'HARM'], { virtual: true }), TOG('rtype', 'REVERB', ["'63", "'65", 'PLATE'], { virtual: true }),
        FOOT({ action: 'param', p: 't.on', toggle: true, label: 'TREMOLO' }), FOOT({ action: 'param', p: 'r.on', toggle: true, label: 'REVERB' }), LED({ bind: 'rate:t.on:t.rate' }), LED({ bind: 'param:r.on' })],
      noStd: true, alwaysOn: true, initParams: { 't.on': 1, 'r.on': 1 },
      derive: (u) => ({ 't.mode': [0, 2, 1][u.ttype ?? 0], 'r.mode': 3, 'r.decay': (u.rtype ?? 0) === 0 ? (u['r.decay'] ?? 0.45) * 0.8 : u['r.decay'] ?? 0.45, ...((u.rtype ?? 0) === 2 ? { 'r.mode': 2 } : {}) }), desc: 'Opto / bias / harmonic tremolo and three spring-and-plate reverbs, each on its own footswitch.' }),
    FP({ id: 'fender.bubbler', name: 'Fizzler Chorus', ref: 'Fender Bubbler Analog Chorus / Vibrato', logo: 'FIZZLER', typeName: 'Analog Chorus / Vibrato', cat: 'Modulation', color: '#6b4a8c', stereo: 'both',
      algo: 'chorus', opts: { style: 'bbd' },
      controls: [K('slow', 'RATE 1', { display: ten, def: 0.25, virtual: true }), K('fast', 'RATE 2', { display: ten, def: 0.7, virtual: true }), K('depth', 'DEPTH', { display: ten, def: 0.5 }), K('mix', 'LEVEL', { display: ten, def: 0.5 }),
        TOG('wave', 'WAVE', ['TRI', 'SINE'], { values: [0, 1] }), TOG('mode', 'MODE', ['CHORUS', 'VIBRATO'], { values: [0, 1] }),
        FOOT({ action: 'bypass', label: 'ON' }), FOOT({ action: 'param', p: 'spd', toggle: true, label: 'RATE 1 / 2', virtual: true }), LED({ color: '#ff2a1a' }), LED({ bind: 'param:spd', color: '#ff2a1a' })],
      noStd: true, wide: true, derive: (u) => ({ rate: u.spd ? u.fast ?? 0.7 : u.slow ?? 0.25, ...(u.mode ? { mix: 1 } : {}) }), desc: 'Analog chorus / vibrato with two rate settings switched from the second footswitch.' }),
    HT({ id: 'fender.ht-dist', name: 'Hammerstone Distortion', ref: 'Fender Hammertone Distortion', logo: 'DISTORTION', typeName: 'Hammerstone', cat: 'Distortion', knobColor: '#e8742a',
      algo: 'drive', opts: { clip: 'diode', preHp: 90, gainMinDb: 8, gainMaxDb: 46, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3200, postLp: 7500, levelMaxDb: 0 },
      controls: [K('level', 'LEVEL', { display: ten }), K('gain', 'GAIN', { display: ten, def: 0.55 }), K('bass', 'BASS', { display: ten }), K('treble', 'TREBLE', { display: ten })] }),
    HT({ id: 'fender.ht-od', name: 'Hammerstone Overdrive', ref: 'Fender Hammertone Overdrive', logo: 'OVERDRIVE', typeName: 'Hammerstone', cat: 'Overdrive', knobColor: '#d02a24',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, clipHp: 300, gainMinDb: 2, gainMaxDb: 36, tone: 'lp', toneLo: 1200, toneHi: 10000, postLp: 8500, levelMaxDb: 8, modes: [{}, { preEq: [{ type: 'peak', f: 800, q: 0.7, db: 5 }] }] },
      controls: [K('level', 'LEVEL', { display: ten }), K('gain', 'GAIN', { display: ten, def: 0.45 }), K('tone', 'TONE', { display: ten }), TOG('mode', 'PRE-MID', ['OFF', 'BOOST'])] }),
    HT({ id: 'fender.ht-delay', name: 'Hammerstone Delay', ref: 'Fender Hammertone Delay', logo: 'DELAY', typeName: 'Hammerstone', cat: 'Delay', knobColor: '#3b8fd6', stereo: 'both',
      algo: 'delay', opts: { maxMs: 1200 }, cost: 0.9,
      controls: [K('mix', 'MIX', { display: ten, def: 0.35 }), K('time', 'TIME', { min: 30, max: 1200, def: 380, curve: 'log', display: ms }), K('feedback', 'FEEDBACK', { display: ten, def: 0.35 }),
        TOG('mod', 'MOD', ['OFF', 'ON'], { virtual: true }), TOG('mode', 'TYPE', ['DIGITAL', 'ANALOG'], { values: [0, 1] })],
      derive: (u) => ({ moddepth: u.mod ? 0.35 : 0, modrate: 0.35 }) }),
    HT({ id: 'fender.ht-reverb', name: 'Hammerstone Reverb', ref: 'Fender Hammertone Reverb', logo: 'REVERB', typeName: 'Hammerstone', cat: 'Reverb', knobColor: '#2fb5a8', stereo: 'both',
      algo: 'reverb', cost: 1.4,
      controls: [K('mix', 'MIX', { display: ten, def: 0.32 }), K('decay', 'TIME', { display: ten, def: 0.5 }), K('highdamp', 'DAMP', { display: ten, def: 0.45 }),
        TOG('mode', 'TYPE', ['HALL', 'ROOM', 'MOD'], { values: [1, 0, 6] }), TOG('tilt', 'TONE', ['DARK', 'BRIGHT'], { virtual: true, def: 1 })],
      derive: (u) => ({ tone: u.tilt ? 0.65 : 0.35 }) }),
  ]);
}
