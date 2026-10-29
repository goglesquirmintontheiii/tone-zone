// Built-in Tone Zone plugin: Fender.
// Blocks inspired by Fender gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`).
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
    const w = d.fw || (wide ? 190 : 140);
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
    const spots = (n) => (n > 2 ? [w * 0.2, w * 0.5, w * 0.8] : n > 1 ? [w * 0.27, w * 0.73] : [w / 2]);
    const jx = spots(leds.length);
    jx.forEach((x) => {
      svg('circle', { cx: x, cy: ly, r: 8.5, fill: 'url(#g-chromeR)' }, g);
      svg('circle', { cx: x, cy: ly, r: 6.2, fill: '#2a0505' }, g);
    });
    leds.forEach((l, i) => Object.assign(l, { _fa: 1, x: jx[i] ?? w / 2, y: ly, r: 5, color: l.color || '#ff2a1a' }));
    label(g, w / 2, ly + 24, d.logo || d.name, { size: d.logoSize || ((d.logo || d.name).length > 11 ? 12 : 15), fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.4 });
    label(g, w / 2, ly + 37, (d.typeName || d.cat).toUpperCase(), { size: 5.4, fill: txt, weight: 700, ls: 1.8, opacity: 0.75 });
    const fx = spots(foots.length);
    foots.forEach((f, i) => Object.assign(f, { _fa: 1, style: 'stomp', r: 13, y: fy, x: fx[i], labelDy: -20 }));
    if (d.art) d.art(g, w, h, ly);
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.2);
    const theme = { text: txt, knob: d.knob || 'fender', labelSize: 5.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: deckH + 24, gap: 26, flip: ctx.flip }) };
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
  registerPedals(tz, FP, HT);
}

// ================================================================ pedals (v0.4)
// More of the current Fender pedal line: Hammertone series plus the anodised 2018+ family.
function registerPedals(tz, FP, HT) {
  const { K, TOG, FOOT, LED, SCREEN, TREADLE, def, ten, db, ms, STEREO } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;
  const ON = (o = {}) => FOOT(Object.assign({ action: 'bypass', label: 'ON' }, o));
  const RED = (o = {}) => LED(Object.assign({ color: '#ff2a1a' }, o));

  // tooled leather scrollwork for the Waylon phaser
  const leather = (g, w, h, ly) => {
    const st = { fill: 'none', stroke: '#e8dcc0', 'stroke-opacity': 0.5, 'stroke-width': 1.1, 'stroke-linecap': 'round' };
    for (const sx of [1, -1]) {
      const x = sx > 0 ? 14 : w - 14;
      svg('path', Object.assign({ d: `M${x} ${ly - 14} q${sx * 10} 10 0 22 q${-sx * 8} 9 ${sx * 4} 20 q${sx * 9} 6 ${sx * 2} 16` }, st), g);
      svg('circle', { cx: x + sx * 5, cy: ly + 4, r: 2.4, fill: '#e8dcc0', 'fill-opacity': 0.45 }, g);
      svg('circle', { cx: x + sx * 4, cy: ly + 38, r: 2, fill: '#e8dcc0', 'fill-opacity': 0.45 }, g);
    }
    svg('rect', { x: 10, y: h - 22, width: w - 20, height: 1.2, fill: '#e8dcc0', 'fill-opacity': 0.35 }, g);
  };

  // '63 outboard reverb: small tolex box with a silver panel
  tz.addForm('fender-63verb', (ctx, d) => {
    const g = ctx.g, w = 230, h = 128;
    formKit.body(g, w, h, d.tolex || '#2a1a10', { rx: 6 });
    svg('rect', { x: 0, y: 0, width: w, height: h, rx: 6, fill: 'url(#p-grain)' }, g);
    svg('rect', { x: 10, y: 10, width: w - 20, height: 62, rx: 3, fill: d.panel || '#c9c1ad', stroke: '#000', 'stroke-opacity': 0.4 }, g);
    svg('rect', { x: 10, y: 80, width: w - 20, height: 38, rx: 3, fill: d.grille || '#5a3a22' }, g);
    for (let i = 0; i < 9; i++) svg('line', { x1: 14, y1: 84 + i * 4, x2: w - 14, y2: 84 + i * 4, stroke: '#000', 'stroke-opacity': 0.25 }, g);
    label(g, w / 2, 103, d.logo, { size: 14, fill: '#efe6d0', font: "'Dancing Script', cursive", weight: 700 });
    const kn = d.controls.filter((c) => c.t === 'knob');
    kn.forEach((c, i) => Object.assign(c, { x: 50 + i * 50, y: 44, r: 12, labelPos: 'above', labelSize: 5.4 }));
    d.controls.forEach((c) => {
      if (c.t === 'led') Object.assign(c, { x: w - 34, y: 30, r: 3 });
      if (c.t === 'foot') Object.assign(c, { style: 'soft', x: w - 34, y: 52, r: 9 });
    });
    formKit.tzBadge(g, w - 34, 66, '#2a1d10', 3.4);
    const theme = { text: '#2a1d10', knob: 'chicken', labelSize: 5.4 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 40, gap: 26, flip: ctx.flip }) };
  });

  const muffish = { clip: 'muff', preHp: 70, gainMinDb: 18, gainMaxDb: 48, tone: 'lp', toneLo: 700, toneHi: 7000, postLp: 6500 };

  tz.addDefs([
    // ---------------- Hammertone
    HT({ id: 'fender.ht-fuzz', name: 'Hammerstone Fuzz', ref: 'Fender Hammertone Fuzz', logo: 'FUZZ', typeName: 'Hammerstone', cat: 'Fuzz', knobColor: '#9b59b6',
      algo: 'chain', cost: 1.1, opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: Object.assign({}, muffish, { levelMaxDb: -3 }) },
        { prefix: 'o', algo: 'pitch', on: false, params: { semis1: 12, level1: 0.55, dry: 0.9, quality: 0, tone: 0.8 } },
      ] },
      controls: [K('f.tone', 'TONE', { display: ten }), K('f.gain', 'FUZZ', { display: ten, def: 0.6 }), K('f.level', 'LEVEL', { display: ten }), TOG('oct', 'OCTAVE', ['OFF', 'ON'], { virtual: true })],
      derive: (u) => ({ 'o.on': u.oct ? 1 : 0 }), desc: 'Thick silicon fuzz with an octave-up switch.' }),
    HT({ id: 'fender.ht-metal', name: 'Hammerstone Metal', ref: 'Fender Hammertone Metal', logo: 'METAL', typeName: 'Hammerstone', cat: 'Distortion', knobColor: '#c8ccd0',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 10, preHp: 120, gainMinDb: 14, gainMaxDb: 52, tone: 'eq3', eqRangeDb: 14, bassF: 100, midF: 750, trebleF: 3600, postLp: 7200, levelMaxDb: -6, preEq: [{ type: 'peak', f: 700, q: 0.8, db: -3 }] },
      controls: [K('treble', 'HIGH', { display: ten }), K('bass', 'LOW', { display: ten }), K('level', 'LEVEL', { display: ten }), K('gain', 'GAIN', { display: ten, def: 0.6 })],
      desc: 'High-gain metal distortion with active high and low EQ.' }),
    HT({ id: 'fender.ht-chorus', name: 'Hammerstone Chorus', ref: 'Fender Hammertone Chorus', logo: 'CHORUS', typeName: 'Hammerstone', cat: 'Modulation', knobColor: '#58b4e8', stereo: 'both',
      algo: 'chorus', opts: { style: 'bbd' },
      controls: [K('depth', 'DEPTH', { display: ten, def: 0.5 }), K('rate', 'RATE', { display: ten, def: 0.35 }), K('mix', 'LEVEL', { display: ten, def: 0.5 }),
        TOG('mode', 'TYPE', ['CHORUS', 'VIBRATO'], { values: [0, 1] }), TOG('tilt', 'TONE', ['DARK', 'BRIGHT'], { virtual: true, def: 1 })],
      derive: (u) => ({ tone: u.tilt ? 0.65 : 0.35, ...(u.mode ? { mix: 1 } : {}) }), desc: 'Lush analog-style chorus or vibrato with a dark / bright switch.' }),
    HT({ id: 'fender.ht-flanger', name: 'Hammerstone Flanger', ref: 'Fender Hammertone Flanger', logo: 'FLANGER', typeName: 'Hammerstone', cat: 'Modulation', knobColor: '#e84a8a', stereo: 'both',
      algo: 'flanger',
      controls: [K('manual', 'MANUAL', { display: ten }), K('speed', 'RATE', { display: ten, def: 0.3 }), K('width', 'DEPTH', { display: ten, def: 0.6 }),
        TOG('res', 'RES', ['LO', 'HI'], { virtual: true }), TOG('mode', 'TYPE', ['CLASSIC', 'THRU-0'], { values: [0, 3] })],
      derive: (u) => ({ regen: u.res ? 0.8 : 0.45, mix: 0.5 }), desc: 'Jet flanger with a resonance switch and a through-zero mode.' }),
    HT({ id: 'fender.ht-spacedelay', name: 'Hammerstone Space Echo', ref: 'Fender Hammertone Space Delay', logo: 'SPACE DELAY', typeName: 'Hammerstone', cat: 'Delay', knobColor: '#2c5fb5', stereo: 'both',
      algo: 'delay', opts: { maxMs: 1000 }, cost: 1,
      controls: [K('time', 'TIME', { min: 40, max: 1000, def: 330, curve: 'log', display: ms }), K('feedback', 'FEEDBACK', { display: ten, def: 0.4 }), K('mix', 'LEVEL', { display: ten, def: 0.35 }),
        TOG('heads', 'PATTERN', ['1', '2', '3'], { values: [4, 6, 7] }), TOG('mod', 'MOD', ['OFF', 'ON'], { virtual: true })],
      derive: (u) => ({ mode: 2, moddepth: u.mod ? 0.4 : 0.08, modrate: 0.3, age: 0.35 }), desc: 'Multi-head tape echo with three head patterns and wow and flutter.' }),
    HT({ id: 'fender.ht-boost', name: 'Hammerstone Boost', ref: 'Fender Hammertone Boost', logo: 'BOOST', typeName: 'Hammerstone', cat: 'Boost', knobColor: '#e6c229',
      algo: 'boost',
      controls: [K('gain', 'BOOST', { display: ten, def: 0.12 }), K('bass', 'BASS', { display: ten }), K('treble', 'TREBLE', { display: ten }), TOG('mode', 'TYPE', ['OP-AMP', 'JFET'], { values: [0, 3] })],
      desc: 'Clean op-amp or JFET boost with centre-detent bass and treble.' }),
    HT({ id: 'fender.ht-breakup', name: 'Hammerstone Breakup', ref: 'Fender Hammertone Breakup Drive', logo: 'BREAKUP', typeName: 'Hammerstone', cat: 'Overdrive', knobColor: '#f08a3a',
      algo: 'drive', opts: { gainMinDb: 0, gainMaxDb: 28, tone: 'lp', toneLo: 1500, toneHi: 11000, postLp: 9500, levelMaxDb: 14,
        modes: [{ clip: 'jfet', bias: 0.1 }, { clip: 'asym', bias: 0.25 }, { clip: 'jfet', bias: 0.1, preEq: [{ type: 'peak', f: 850, q: 0.7, db: 5 }] }, { clip: 'asym', bias: 0.25, preEq: [{ type: 'peak', f: 850, q: 0.7, db: 5 }] }] },
      controls: [K('tone', 'TONE', { display: ten }), K('gain', 'GAIN', { display: ten, def: 0.4 }), K('level', 'LEVEL', { display: ten }), TOG('clip', 'CLIP', ['A', 'B'], { virtual: true }), TOG('mid', 'PRE-MID', ['OFF', 'BOOST'], { virtual: true })],
      derive: (u) => ({ mode: (u.clip ?? 0) + 2 * (u.mid ?? 0) }), desc: 'Low-gain, amp-like breakup with two clipping modes and a mid boost.' }),
    HT({ id: 'fender.ht-kaiju', name: 'Kaiju Distortion', ref: 'Fender Godzilla Distortion', logo: 'KAIJU', typeName: 'Distortion', cat: 'Distortion', color: '#2f4a2c', knobColor: '#7fd34a',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 8, preHp: 100, gainMinDb: 10, gainMaxDb: 48, tone: 'eq3', eqRangeDb: 14, bassF: 110, midF: 800, trebleF: 3400, postLp: 7500, levelMaxDb: -6 },
      controls: [K('gain', 'DISTORTION', { display: ten, def: 0.6 }), K('treble', 'TREBLE', { display: ten }), K('bass', 'BASS', { display: ten })], fixed: { level: 0.5 },
      desc: 'Monster-movie themed high-gain distortion with active bass and treble.' }),

    // ---------------- anodised 2018+ family
    FP({ id: 'fender.pelt', name: 'The Hide Fuzz', ref: 'Fender The Pelt Fuzz', logo: 'THE HIDE', typeName: 'Fuzz', cat: 'Fuzz', color: '#7a4b2a',
      algo: 'drive', opts: Object.assign({}, muffish, { cleanSum: true, levelMaxDb: -2, modes: [{}, { postEq: [{ type: 'peak', f: 800, q: 0.7, db: 4 }] }, { preEq: [{ type: 'ls', f: 150, q: 0.7, db: 5 }] }, { preEq: [{ type: 'ls', f: 150, q: 0.7, db: 5 }], postEq: [{ type: 'peak', f: 800, q: 0.7, db: 4 }] }] }),
      controls: [K('level', 'LEVEL', { display: ten }), K('blend', 'BLEND', { display: ten, def: 1 }), K('gain', 'FUZZ', { display: ten, def: 0.6 }), K('tone', 'TONE', { display: ten }),
        TOG('bloom', 'BLOOM', ['OFF', 'ON'], { virtual: true }), TOG('mids', 'MIDS', ['SCOOP', 'FLAT'], { virtual: true }), TOG('thick', 'THICK', ['OFF', 'ON'], { virtual: true })],
      derive: (u) => ({ mode: (u.mids ?? 0) + 2 * (u.thick ?? 0), sag: u.bloom ? 0.6 : 0 }), desc: 'Big, woolly fuzz with a dry blend. Bloom adds sag, Mids fills the scoop, Thick adds bass.' }),
    FP({ id: 'fender.bends', name: 'The Curves Comp', ref: 'Fender The Bends Compressor', logo: 'THE CURVES', typeName: 'Compressor', cat: 'Dynamics', color: '#3c6aa8',
      algo: 'comp', opts: { type: 'ota' },
      controls: [K('sustain', 'DRIVE', { display: ten, def: 0.5 }), K('level', 'RECOVERY', { display: ten, def: 0.38 }), K('blend', 'BLEND', { display: ten, def: 0.8 }), TOG('fast', 'ATTACK', ['SLOW', 'FAST'], { virtual: true })],
      derive: (u) => ({ attack: u.fast ? 0.1 : 0.45 }), desc: 'Smooth compressor with a dry blend and a slow / fast attack switch.' }),
    FP({ id: 'fender.pinwheel', name: 'The Whirligig', ref: 'Fender The Pinwheel Rotary Speaker Emulator', logo: 'WHIRLIGIG', typeName: 'Rotary Speaker', cat: 'Modulation', color: '#7c2230', stereo: 'stereo', ports: { ins: ['IN L (MONO)', 'IN R'], outs: ['OUT L (MONO)', 'OUT R'] }, cost: 1.2, wide: true,
      algo: 'rotary', ctrl: { ins: [{ label: 'EXP', param: 'speed', min: 0, max: 1 }] },
      controls: [K('accel', 'RAMP', { display: ten, def: 0.5 }), K('drive', 'DRIVE', { display: ten, def: 0.25 }), K('balance', 'BALANCE', { display: ten, def: 0.5 }), K('mix', 'MIX', { display: ten, def: 1 }), K('level', 'LEVEL', { display: ten, def: 0.4 }),
        TOG('keys', 'VOICE', ['GUITAR', 'KEYS'], { virtual: true }), TOG('dyn', 'DYNAMIC', ['OFF', 'ON'], { virtual: true }),
        ON(), FOOT({ action: 'param', p: 'fast', toggle: true, label: 'SLOW / FAST', virtual: true }), RED(), RED({ bind: 'param:fast' })],
      noStd: true, derive: (u) => ({ speed: u.fast ? 1 : 0, drive: Math.min(1, (u.drive ?? 0.25) * (u.keys ? 1.4 : 1) + (u.dyn ? 0.1 : 0)) }),
      desc: 'Rotary speaker with horn / drum balance, drive and a slow / fast footswitch. EXP jack sweeps the speed.' }),
    FP({ id: 'fender.losthighway', name: 'Long Road Phaser', ref: 'Fender Lost Highway Phaser', logo: 'LONG ROAD', typeName: 'Phaser', cat: 'Modulation', color: '#a35a2a', stereo: 'both', wide: true,
      algo: 'phaser',
      controls: [K('r1', 'RATE 1', { display: ten, def: 0.3, virtual: true }), K('r2', 'RATE 2', { display: ten, def: 0.7, virtual: true }), K('depth', 'DEPTH', { display: ten, def: 0.8 }), K('feedback', 'FEEDBACK', { display: ten, def: 0.4 }),
        TOG('stages', 'STAGES', ['4', '8'], { values: [4, 8] }), TOG('wave', 'WAVE', ['TRI', 'SINE'], { virtual: true }),
        ON(), FOOT({ action: 'param', p: 'alt', toggle: true, label: 'RATE 1 / 2', virtual: true }), RED(), RED({ bind: 'param:alt' })],
      noStd: true, derive: (u) => ({ rate: u.alt ? u.r2 ?? 0.7 : u.r1 ?? 0.3, mix: 0.5, center: u.wave ? 0.55 : 0.5 }), desc: 'Four or eight stage phaser with two rates on a second footswitch.' }),
    FP({ id: 'fender.waylon', name: 'Outlaw Phaser', ref: 'Fender Waylon Jennings Phaser', logo: 'OUTLAW', typeName: 'Phaser', cat: 'Modulation', color: '#1f1b17', text: '#e8dcc0', art: leather,
      algo: 'phaser',
      controls: [K('rate', 'RATE', { display: ten, def: 0.45 }), K('center', 'RANGE', { display: ten, def: 0.4 }), K('feedback', 'FEEDBACK', { display: ten, def: 0.55 }),
        TOG('stages', 'STAGES', ['2', '4', '6'], { values: [2, 4, 6], def: 1 }), TOG('sweet', 'SWEET', ['OFF', 'ON'], { virtual: true, def: 1 })],
      derive: (u) => ({ depth: u.sweet ? 0.6 : 0.9, mix: 0.5 }), desc: 'Classic country phaser with 2, 4 or 6 stages. Sweet keeps the sweep gentle.' }),
    FP({ id: 'fender.shields', name: 'Mixer Fuzz', ref: 'Fender Shields Blender', logo: 'MIXER', typeName: 'Octave Fuzz', cat: 'Fuzz', color: '#8f9aa6', text: '#141414', wide: true,
      algo: 'chain', cost: 1.4, opts: { chain: [
        { prefix: 'p', algo: 'pitch', params: { semis1: 12, level1: 0, semis2: -12, level2: 0, level3: 0, dry: 1, quality: 0, tone: 0.8 } },
        { prefix: 'f', algo: 'drive', opts: Object.assign({}, muffish, { cleanSum: true, levelMaxDb: -2 }) },
      ] },
      controls: [K('f.level', 'VOLUME', { display: ten }), K('f.gain', 'FUZZ', { display: ten, def: 0.65 }), K('f.tone', 'TONE', { display: ten }), K('f.blend', 'BLEND', { display: ten, def: 1 }), K('sub', 'SUB VOL', { display: ten, def: 0.5, virtual: true }), K('f.sag', 'SAG', { display: ten, def: 0 }),
        TOG('oct', 'OCTAVE', ['OFF', 'ON'], { virtual: true, def: 1 }),
        ON(), FOOT({ action: 'param', p: 'subon', toggle: true, label: 'SUB', virtual: true }), FOOT({ action: 'param', p: 'expand', toggle: true, label: 'EXPAND', virtual: true }), RED(), RED({ bind: 'param:subon' }), RED({ bind: 'param:expand' })],
      noStd: true, derive: (u) => ({ 'p.level1': u.oct ? 0.55 : 0, 'p.level2': u.subon ? 0.9 * (u.sub ?? 0.5) : 0, 'p.on': u.oct || u.subon ? 1 : 0, ...(u.expand ? { 'f.level': Math.min(1, (u['f.level'] ?? 0.5) + 0.2) } : {}) }),
      desc: 'Octave-up fuzz with a footswitched sub-octave, sag and an Expand boost.' }),
    FP({ id: 'fender.trapper', name: 'The Prowler Dual Fuzz', ref: 'Fender The Trapper Dual Fuzz', logo: 'THE PROWLER', typeName: 'Dual Fuzz', cat: 'Fuzz', color: '#5b1f24', wide: true,
      algo: 'chain', cost: 1.5, opts: { chain: [
        { prefix: 'a', algo: 'drive', opts: Object.assign({}, muffish, { clip: 'si', levelMaxDb: -2, tone: 'eq3', eqRangeDb: 10, bassF: 120, midF: 650, trebleF: 2800 }) },
        { prefix: 'o', algo: 'pitch', on: false, params: { semis1: 12, level1: 0.5, dry: 0.9, quality: 0, tone: 0.8 } },
        { prefix: 'b', algo: 'drive', on: false, opts: { clip: 'ge', preHp: 60, gainMinDb: 10, gainMaxDb: 34, tone: 'none', postLp: 6000, levelMaxDb: 0 } },
      ] },
      controls: [K('a.mid', 'CONTOUR', { display: ten, def: 0.4 }), K('a.treble', 'TONE', { display: ten }), K('a.level', 'LEVEL 1', { display: ten }), K('b.gain', 'FUZZ 2', { display: ten, def: 0.5 }), K('b.level', 'LEVEL 2', { display: ten }),
        TOG('oct', 'OCTAVE', ['OFF', 'ON'], { virtual: true }),
        ON(), FOOT({ action: 'param', p: 'b.on', toggle: true, label: 'FUZZ 2' }), RED(), RED({ bind: 'param:b.on' })],
      noStd: true, alwaysOn: false, derive: (u) => ({ 'o.on': u.oct ? 1 : 0 }), desc: 'Two fuzzes in one box: a sculpted silicon fuzz with octave, then a germanium-style fuzz stacked on the second switch.' }),
    FP({ id: 'fender.levelset', name: 'Set Point Buffer', ref: 'Fender Level Set Buffer', logo: 'SET POINT', typeName: 'Buffer', cat: 'Utility', kind: 'Utility', color: '#bfc3c7', text: '#141414', cost: 0.1,
      algo: 'boost', fixed: { mode: 0, bass: 0.5 },
      controls: [K('gain', 'LEVEL', { def: 0.04, display: ten }), K('treble', 'HI CUT', { def: 0.5, invert: true, display: ten }), TOG('load', 'LOAD', ['HI-Z', 'LO-Z'], { virtual: true })],
      derive: (u) => ({ treble: Math.max(0, (u.treble ?? 0.5) - (u.load ? 0.08 : 0)) }), desc: 'Buffer with a level trim and treble roll-off to match long cable runs.' }),
    FP({ id: 'fender.pourover', name: 'Drip Envelope Filter', ref: 'Fender Pour Over Envelope Filter', logo: 'DRIP', typeName: 'Envelope Filter', cat: 'Filter', color: '#6b4226',
      algo: 'wah', opts: { fLo: 250, fHi: 2800 }, fixed: { mode: 2 },
      controls: [K('sens', 'SENS', { display: ten, def: 0.55 }), K('q', 'RES', { display: ten, def: 0.6 }), K('range', 'RANGE', { display: ten, def: 0.5 }), K('level', 'LEVEL', { display: ten, def: 0.32 }),
        TOG('filter', 'FILTER', ['LP', 'BP', 'HP'], { values: [0, 1, 2], def: 1 }), TOG('direction', 'SWEEP', ['UP', 'DOWN'], { values: [0, 1] })],
      desc: 'Funky envelope filter with LP / BP / HP modes and up or down sweeps.' }),
    FP({ id: 'fender.fullmoon', name: 'Night Sky Distortion', ref: 'Fender Full Moon Distortion', logo: 'NIGHT SKY', typeName: 'Distortion', cat: 'Distortion', color: '#22305a', wide: true,
      algo: 'drive', opts: { clip: 'diode', preHp: 90, gainMinDb: 8, gainMaxDb: 46, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 750, trebleF: 3300, postLp: 7600, levelMaxDb: 0, modes: [{}, { preEq: [{ type: 'ls', f: 160, q: 0.7, db: 5 }] }] },
      controls: [K('level', 'LEVEL', { display: ten }), K('gain', 'GAIN', { display: ten, def: 0.55 }), K('bright', 'BITE', { display: ten, def: 0.2 }), K('bass', 'BASS', { display: ten }), K('mid', 'MID', { display: ten }), K('treble', 'TREBLE', { display: ten }),
        TOG('mode', 'FAT', ['OFF', 'ON']), TOG('btype', 'BOOST', ['LEVEL', 'GAIN'], { virtual: true }),
        ON(), FOOT({ action: 'param', p: 'boost', toggle: true, label: 'BOOST', virtual: true }), RED(), RED({ bind: 'param:boost' })],
      noStd: true, derive: (u) => (u.boost ? (u.btype ? { gain: Math.min(1, (u.gain ?? 0.55) + 0.25) } : { level: Math.min(1, (u.level ?? 0.5) + 0.2) }) : {}), desc: 'Versatile distortion with a full EQ, Bite, a Fat switch and a footswitched boost.' }),
    FP({ id: 'fender.mtgla', name: 'MTG:SoCal Tube Dist', ref: 'Fender MTG:LA Tube Distortion', logo: 'MTG:SOCAL', typeName: 'Tube Distortion', cat: 'Distortion', color: '#6a2c5a', wide: true,
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 6, preHp: 80, gainMinDb: 10, gainMaxDb: 44, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 700, trebleF: 3200, postLp: 7800, levelMaxDb: 2, modes: [{}, { preHp: 180 }] },
      controls: [K('level', 'LEVEL', { display: ten }), K('gain', 'GAIN', { display: ten, def: 0.55 }), K('bass', 'BASS', { display: ten }), K('mid', 'MID', { display: ten }), K('treble', 'TREBLE', { display: ten }),
        TOG('mode', 'TIGHT', ['OFF', 'ON']), ON(), FOOT({ action: 'param', p: 'boost', toggle: true, label: 'BOOST', virtual: true }), RED(), RED({ bind: 'param:boost' })],
      noStd: true, derive: (u) => (u.boost ? { gain: Math.min(1, (u.gain ?? 0.55) + 0.2) } : {}), desc: 'Real-tube style distortion voiced for LA hard rock, with a Tight switch and gain boost.' }),
    FP({ id: 'fender.mtg', name: 'MTG Valve Dist', ref: 'Fender MTG Tube Distortion', logo: 'MTG VALVE', typeName: 'Tube Distortion', cat: 'Distortion', color: '#2b2b2d',
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 6, preHp: 70, gainMinDb: 8, gainMaxDb: 42, tone: 'lp', toneLo: 1200, toneHi: 9000, postLp: 8000, levelMaxDb: 2, modes: [{}, { preHp: 180 }, { postEq: [{ type: 'hs', f: 3000, q: 0.7, db: -4 }] }, { preHp: 180, postEq: [{ type: 'hs', f: 3000, q: 0.7, db: -4 }] }] },
      controls: [K('level', 'LEVEL', { display: ten }), K('gain', 'GAIN', { display: ten, def: 0.55 }), K('tone', 'TONE', { display: ten }), TOG('tight', 'TIGHT', ['OFF', 'ON'], { virtual: true }), TOG('dark', 'VOICE', ['BRIGHT', 'DARK'], { virtual: true })],
      derive: (u) => ({ mode: (u.tight ?? 0) + 2 * (u.dark ?? 0) }), desc: 'Tube-driven distortion with Tight and Dark voicing switches.' }),
    FP({ id: 'fender.compugilist', name: 'Comp-Brawler', ref: 'Fender Compugilist Compressor / Distortion', logo: 'COMP-BRAWLER', typeName: 'Compressor / Distortion', cat: 'Distortion', color: '#2b2620', text: '#e6c27a', wide: true,
      algo: 'chain', cost: 1, opts: { chain: [
        { prefix: 'c', algo: 'comp', opts: { type: 'vca' } },
        { prefix: 'd', algo: 'drive', opts: { clip: 'diode', preHp: 80, gainMinDb: 6, gainMaxDb: 42, tone: 'lp', toneLo: 1200, toneHi: 9000, postLp: 8000, levelMaxDb: -2 } },
      ] },
      controls: [K('c.sustain', 'COMP', { display: ten, def: 0.5 }), K('c.level', 'COMP LVL', { display: ten, def: 0.5 }), K('c.blend', 'BLEND', { display: ten, def: 0.8 }), K('d.gain', 'GAIN', { display: ten, def: 0.5 }), K('d.tone', 'TONE', { display: ten }), K('d.level', 'LEVEL', { display: ten }),
        TOG('c.attack', 'ATTACK', ['FAST', 'SLOW'], { values: [0.1, 0.45] }),
        FOOT({ action: 'param', p: 'c.on', toggle: true, label: 'COMP' }), FOOT({ action: 'param', p: 'd.on', toggle: true, label: 'DIST' }), RED({ bind: 'param:c.on' }), RED({ bind: 'param:d.on' })],
      noStd: true, alwaysOn: true, initParams: { 'c.on': 1, 'd.on': 1 }, desc: 'Compressor and distortion in one box, each on its own footswitch.' }),
    FP({ id: 'fender.engager', name: 'Igniter Boost', ref: 'Fender Engager Boost', logo: 'IGNITER', typeName: 'Boost', cat: 'Boost', color: '#c2411f',
      algo: 'boost',
      controls: [K('gain', 'BOOST', { display: ten, def: 0.12 }), K('bass', 'BASS', { display: ten }), K('treble', 'TREBLE', { display: ten }), TOG('mode', 'VOICE', ['FLAT', 'MID'], { values: [0, 2] })],
      desc: 'Clean JFET boost with bass and treble and a mid-push voice.' }),
    FP({ id: 'fender.dualmarine', name: 'Twin Sea Mist Reverb', ref: 'Fender Dual Marine Layer Reverb', logo: 'TWIN SEA MIST', typeName: 'Dual Reverb', cat: 'Reverb', color: '#4b8f88', text: '#0f2622', stereo: 'both', wide: true,
      algo: 'chain', cost: 2.6, opts: { chain: [{ prefix: 'a', algo: 'reverb', params: { mode: 0 } }, { prefix: 'b', algo: 'reverb', params: { mode: 1 } }] },
      controls: [K('a.decay', 'TIME A', { display: ten, def: 0.4 }), K('a.highdamp', 'DAMP A', { display: ten, def: 0.4 }), K('a.mix', 'LEVEL A', { display: ten, def: 0.28 }), K('b.decay', 'TIME B', { display: ten, def: 0.6 }), K('b.highdamp', 'DAMP B', { display: ten, def: 0.45 }), K('b.mix', 'LEVEL B', { display: ten, def: 0.3 }),
        TOG('a.mode', 'TYPE A', ['ROOM', 'HALL', 'SPEC'], { values: [0, 1, 4] }), TOG('b.mode', 'TYPE B', ['ROOM', 'HALL', 'SPEC'], { values: [0, 1, 4], def: 1 }),
        FOOT({ action: 'param', p: 'a.on', toggle: true, label: 'A' }), FOOT({ action: 'param', p: 'b.on', toggle: true, label: 'B' }), RED({ bind: 'param:a.on' }), RED({ bind: 'param:b.on' })],
      noStd: true, alwaysOn: true, initParams: { 'a.on': 1, 'b.on': 0 }, desc: 'Two independent reverbs (room, hall or special), one per footswitch.' }),
    FP({ id: 'fender.downtown', name: 'Uptown Local Bass FX', ref: 'Fender Downtown Express Bass Multi-Effect', logo: 'UPTOWN LOCAL', typeName: 'Bass Multi-Effect', cat: 'Multi-FX', kind: 'Pedal', color: '#2a3a5a', fw: 240,
      algo: 'chain', cost: 1.4, opts: { chain: [
        { prefix: 'c', algo: 'comp', opts: { type: 'vca' } },
        { prefix: 'd', algo: 'drive', opts: { clip: 'opamp', preHp: 40, gainMinDb: 6, gainMaxDb: 36, tone: 'lp', toneLo: 1000, toneHi: 8000, postLp: 6000, cleanSum: true, levelMaxDb: 2 }, params: { blend: 0.6 } },
        { prefix: 'e', algo: 'peq' },
      ] },
      controls: [K('c.sustain', 'THRESH', { display: ten, def: 0.45 }), K('c.level', 'GAIN', { display: ten, def: 0.38 }), K('c.blend', 'BLEND', { display: ten, def: 0.8 }), K('d.gain', 'DRIVE', { display: ten, def: 0.45 }), K('d.tone', 'TONE', { display: ten }),
        K('d.level', 'LEVEL', { display: ten }), K('e.lowgain', 'BASS', { min: -15, max: 15, def: 0, display: db }), K('e.mid1gain', 'MID', { min: -15, max: 15, def: 0, display: db }), K('e.highgain', 'TREBLE', { min: -15, max: 15, def: 0, display: db }),
        FOOT({ action: 'param', p: 'c.on', toggle: true, label: 'COMP' }), FOOT({ action: 'param', p: 'd.on', toggle: true, label: 'DRIVE' }), FOOT({ action: 'param', p: 'e.on', toggle: true, label: 'EQ' }), RED({ bind: 'param:c.on' }), RED({ bind: 'param:d.on' }), RED({ bind: 'param:e.on' })],
      noStd: true, alwaysOn: true, initParams: { 'c.on': 1, 'd.on': 0, 'e.on': 1 }, fixed: { 'e.lowfreq': 80, 'e.mid1freq': 600, 'e.highfreq': 4000 },
      desc: 'Bass compressor, blendable overdrive and 3-band EQ, each on its own footswitch.' }),
    def({ id: 'fender.strobosonic', name: 'Strobe-O-Matic Pro', ref: 'Fender Strobo-Sonic Pro Tuner', logo: 'STROBE-O-MATIC', typeName: 'Strobe Tuner', cat: 'Utility', kind: 'Utility', form: 'tz', color: '#18191b', text: '#ececec', accent: '#c9a24a',
      algo: 'tuner', opts: { mute: 1 }, ports: { ins: ['INPUT'], outs: ['OUTPUT', 'BYPASS'] },
      controls: [SCREEN('strobe', { w: 94, h: 64, y: 84 }), FOOT(), LED({ bind: 'tunerOk', color: '#3ddc84' })], defaultBypass: true, tunerBlock: true,
      desc: 'Strobe tuner. The pedal mutes OUTPUT while tuning; BYPASS always passes the signal.' }),
    def({ id: 'fender.verb63', name: "'63 Outboard Verb", ref: "Fender '63 Tube Reverb", logo: 'Outboard Reverb', cat: 'Reverb', form: 'fender-63verb', tolex: '#3b2414', panel: '#c9c1ad', grille: '#5a3a22',
      algo: 'reverb', cost: 1.2, fixed: { mode: 3, lowcut: 0.15, predelay: 8 },
      controls: [K('decay', 'DWELL', { display: ten, def: 0.55 }), K('mix', 'MIXER', { display: ten, def: 0.35 }), K('tone', 'TONE', { display: ten, def: 0.55 }), FOOT(), RED()],
      desc: 'Stand-alone tube spring reverb: Dwell, Mixer and Tone, drippy surf to subtle splash.' }),
    def({ id: 'fender.fuzzwah', name: 'Fuzz-Wahzer', ref: 'Fender Fuzz-Wah (1970s)', code: 'FZW', logo: 'Fuzz-Wahzer', logoColor: '#e0e0e0', cat: 'Wah', form: 'treadle', color: '#202022', treadleColor: '#3a3a3c',
      algo: 'chain', cost: 0.8, opts: { chain: [
        { prefix: 'f', algo: 'drive', on: false, opts: { clip: 'ge', preHp: 70, gainMinDb: 18, gainMaxDb: 40, tone: 'none', postLp: 6000, levelMaxDb: -2 }, params: { gain: 0.7 } },
        { prefix: 'w', algo: 'wah', opts: { fLo: 380, fHi: 2100, q: 5 }, params: { level: 0.38 } },
      ] },
      controls: [TREADLE('w.pos', { def: 0.5 }), Object.assign(TOG('f.on', '', ['FUZZ OFF', 'FUZZ ON']), { x: 56, y: 283, orient: 'v', optSize: 4.4 }), LED({ color: '#ff2a1a', r: 2.2, x: 76, y: 11 })],
      toeSwitch: true, desc: 'Vintage wah with a switchable fuzz. Drag the treadle; click it to switch the wah on or off.' }),
    FP({ id: 'fender.blender', name: 'Mixmaster 69', ref: 'Fender Blender (1968)', logo: 'MIXMASTER', typeName: 'Octave Fuzz', cat: 'Fuzz', color: '#3a3f46',
      algo: 'chain', cost: 1.1, opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: Object.assign({}, muffish, { clip: 'si', cleanSum: true, levelMaxDb: -4 }) },
        { prefix: 'o', algo: 'pitch', on: false, params: { semis1: 12, level1: 0.5, dry: 0.9, quality: 0, tone: 0.8 } },
      ] },
      controls: [K('f.level', 'VOLUME', { display: ten }), K('f.gain', 'SUSTAIN', { display: ten, def: 0.65 }), K('f.tone', 'TONE', { display: ten }), K('f.blend', 'BLEND', { display: ten, def: 1 }), TOG('oct', 'OCTAVE', ['OFF', 'ON'], { virtual: true })],
      derive: (u) => ({ 'o.on': u.oct ? 1 : 0 }), desc: 'Late-60s octave fuzz with a blend control: raw, buzzy and huge.' }),
  ]);
}
