// Built-in Tone Zone plugin: Ground Control Audio.
// Inspired by Ground Control Audio's UwU Virtual Pet Buffer. Name, logo and artwork are Tone Zone originals;
// features follow the real unit: an always-on buffer with a pixel pet on an OLED that reacts to your playing,
// earns XP, levels up through 30 stages and gets hungry and sleepy. A / B buttons, SENS and HARDCORE settings.
//
// "gca-pet" screen: pet progress (level, XP, hunger, mood) is saved per block with tz.storage. Input level comes
// from the block's meter status.
export default function register(tz) {
  const { TOG, BTN, LED, SCREEN, def, MONO } = tz.helpers;
  const { svg, label, formKit, softShadow, noisePattern, setA, setText } = tz.gfx;

  // 12 x 12 sprites ('1' = lit pixel). Rows 0-1 are reserved for the crown of the grown-up forms.
  const SPR = {
    kittenA: ['............', '............', '............', '...1....1...', '...111111...', '..11111111..', '..10111101..', '..11100111..', '...111111...', '...11..11...', '...1....1...', '............'],
    kittenB: ['............', '............', '...1....1...', '...111111...', '..11111111..', '..10111101..', '..11100111..', '...111111...', '..11....11..', '..1......1..', '............', '............'],
    catA: ['............', '............', '.1........1.', '.11......11.', '.1111111111.', '111111111111', '110111111011', '111111111111', '111110011111', '.1111111111.', '..11111111..', '..1..11..1..'],
    catB: ['............', '.1........1.', '.11......11.', '.1111111111.', '111111111111', '110111111011', '111111111111', '111110011111', '.1111111111.', '..11111111..', '.1..1111..1.', '1..........1'],
    catSleep: ['............', '............', '............', '.1........1.', '.11......11.', '.1111111111.', '111111111111', '100111111001', '111111111111', '111111111111', '.1111111111.', '111111111111'],
  };
  const CROWN = ['..1.1..1.1..', '..1111111...'];
  const PX = 3, GW = 12;
  const key = (b) => 'pet:' + b.id;

  tz.addScreen('gca-pet', {
    build(s, g, w, h, nv) {
      svg('rect', { width: w, height: h, fill: '#020203' }, g);
      s.col = '#bff6ff';
      s.px = [];
      const ox = 6, oy = 6;
      for (let y = 0; y < GW; y++) for (let x = 0; x < GW; x++) s.px.push(svg('rect', { x: ox + x * PX, y: oy + y * PX, width: PX - 0.3, height: PX - 0.3, fill: s.col, 'fill-opacity': 0 }, g));
      s.gpet = g;
      const T = (x, y, sz, anchor = 'start') => svg('text', { x, y, fill: s.col, 'font-family': "'Share Tech Mono', monospace", 'font-size': sz, 'text-anchor': anchor, 'dominant-baseline': 'central' }, g, '');
      s.tLvl = T(48, 8, 7.4);
      s.tMul = T(w - 4, 8, 6.4, 'end');
      s.tHeart = T(48, 19, 6.4);
      s.tFood = T(48, 29, 6.4);
      s.tMsg = T(48, 40, 5.6);
      s.zz = T(40, 10, 6);
      s.fish = svg('path', { d: 'M38 34 l5 -3 v6 Z M43 34 q5 -5 9 0 q-4 5 -9 0 Z', fill: s.col, 'fill-opacity': 0 }, g);
      svg('rect', { x: 4, y: h - 7, width: w - 8, height: 4, fill: 'none', stroke: s.col, 'stroke-width': 0.6, 'stroke-opacity': 0.7 }, g);
      s.bar = svg('rect', { x: 5, y: h - 6, width: 0, height: 2, fill: s.col }, g);
      const saved = tz.storage.get(key(nv.block), null);
      s.pet = Object.assign({ lvl: 1, xp: 0, food: 3, joy: 3, hcLeft: 600 }, saved || {});
      s.t = 0; s.play = 0; s.idle = 0; s.anim = null; s.lastSave = 0; s.lastA = undefined; s.lastB = undefined; s.frame = '';
      s.env = 0;
    },
    update(s, st, nv, now) {
      const p = s.pet, ui = s.ui || {};
      const dt = s.t ? Math.min(0.5, (now - s.t) / 1000) : 0;
      s.t = now;
      // input level (meter status: [[peak, rms, clip]]) against the SENS setting
      const m = st && st.meter && st.meter[0];
      const rms = m ? m[1] : 0;
      s.env = Math.max(rms, s.env * 0.9);
      const thr = [0.03, 0.012, 0.005][ui.sens ?? 1];
      const playing = !!m && s.env > thr;
      if (playing) { s.play += dt; s.idle = 0; } else { s.idle += dt; if (s.idle > 10) s.play = 0; }
      const mul = s.play > 180 ? 8 : s.play > 60 ? 4 : s.play > 20 ? 2 : 1;
      const need = Math.round(40 * Math.pow(p.lvl, 1.25));
      if (playing && p.lvl < 30) {
        p.xp += dt * mul * (p.food > 0 ? 1 : 0.4);
        p.joy = Math.min(4, p.joy + dt / 40);
        if (p.xp >= need) { p.xp -= need; p.lvl++; p.hcLeft = 600; s.anim = { kind: 'lvl', t: now }; }
      }
      p.food = Math.max(0, p.food - dt / (ui.hard ? 60 : 150));
      if (!playing) p.joy = Math.max(0, p.joy - dt / 240);
      if (ui.hard && p.lvl > 1) {
        p.hcLeft -= dt;
        if (p.hcLeft <= 0) { p.lvl = 1; p.xp = 0; p.hcLeft = 600; s.anim = { kind: 'reset', t: now }; }
      }
      // buttons: A = feed, B = play (each press flips a virtual param)
      if (s.lastA !== undefined && ui.btnA !== s.lastA) { p.food = Math.min(4, p.food + 1); s.anim = { kind: 'feed', t: now }; s.idle = Math.min(s.idle, 5); }
      if (s.lastB !== undefined && ui.btnB !== s.lastB) { p.joy = Math.min(4, p.joy + 1); s.anim = { kind: 'jump', t: now }; s.idle = Math.min(s.idle, 5); }
      s.lastA = ui.btnA; s.lastB = ui.btnB;
      if (s.anim && now - s.anim.t > 1600) s.anim = null;
      // sprite choice
      const sleep = s.idle > 20 && !s.anim;
      const grown = p.lvl >= 5;
      const beat = Math.floor(now / (playing ? 220 : 700)) % 2;
      let spr = grown ? (playing || (s.anim && s.anim.kind !== 'feed') ? (beat ? SPR.catB : SPR.catA) : SPR.catA) : beat && (playing || s.anim) ? SPR.kittenB : SPR.kittenA;
      if (sleep) spr = grown ? SPR.catSleep : SPR.kittenA;
      const blink = !playing && !sleep && now % 4000 < 160;
      const crown = p.lvl >= 15;
      const dy = s.anim && s.anim.kind === 'jump' ? -Math.round(Math.sin(((now - s.anim.t) / 400) * Math.PI) ** 2 * 2) : 0;
      const bright = [0.45, 0.75, 1][ui.bright ?? 2];
      if (bright !== s.bright) {
        s.bright = bright;
        for (const el of [s.tLvl, s.tMul, s.tHeart, s.tFood, s.tMsg, s.zz, s.bar]) setA(el, 'fill-opacity', bright);
      }
      const fkey = spr.join('') + crown + blink + dy + bright;
      if (fkey !== s.frame) {
        s.frame = fkey;
        for (let y = 0; y < GW; y++)
          for (let x = 0; x < GW; x++) {
            const sy = y - dy;
            let row = sy >= 0 && sy < GW ? spr[sy] : '';
            if (crown && sy < 2 && sy >= 0) row = CROWN[sy];
            let on = row[x] === '1';
            if (blink && sy === 6 && row[x] === '0' && row.indexOf('1') < x && x < row.lastIndexOf('1')) on = true; // eyes shut
            setA(s.px[y * GW + x], 'fill-opacity', on ? s.bright : 0);
          }
      }
      setA(s.fish, 'fill-opacity', s.anim && s.anim.kind === 'feed' ? s.bright : 0);
      setText(s.zz, sleep ? (Math.floor(now / 600) % 2 ? 'z' : 'Zz') : '');
      // readouts
      setText(s.tLvl, `LV${p.lvl}`);
      setText(s.tMul, mul > 1 ? `x${mul}` : '');
      const hearts = Math.round(p.joy), food = Math.ceil(p.food);
      setText(s.tHeart, '♥'.repeat(hearts) + '♡'.repeat(4 - hearts));
      setText(s.tFood, 'FD' + '■'.repeat(food) + '□'.repeat(4 - food));
      const msg = s.anim ? { feed: 'NOM NOM', jump: 'YAY!', lvl: 'LEVEL UP!', reset: 'OH NO..' }[s.anim.kind]
        : sleep ? 'ZZZ...' : p.food < 0.5 ? 'HUNGRY!' : ui.hard && p.lvl > 1 ? `HC ${Math.floor(p.hcLeft / 60)}:${String(Math.floor(p.hcLeft % 60)).padStart(2, '0')}` : playing ? 'DANCING' : 'UwU';
      setText(s.tMsg, msg);
      setA(s.bar, 'width', ((p.lvl >= 30 ? 1 : p.xp / need) * (s.ctl.w - 10)).toFixed(1));
      if (now - s.lastSave > 15000) { s.lastSave = now; try { tz.storage.set(key(nv.block), { lvl: p.lvl, xp: Math.round(p.xp), food: +p.food.toFixed(2), joy: +p.joy.toFixed(2), hcLeft: Math.round(p.hcLeft) }); } catch { /* storage unavailable */ } }
    },
  });

  function ensureDefs() {
    if (document.getElementById('gca-shell')) return;
    const d = document.getElementById('globalDefs');
    if (!d) return;
    const gr = svg('radialGradient', { id: 'gca-shell', cx: 0.4, cy: 0.3, r: 0.85 }, d);
    for (const [o, c] of [[0, '#ffe3f0'], [0.6, '#f7a8cb'], [1, '#d97aa6']]) svg('stop', { offset: o, 'stop-color': c }, gr);
    const lg = svg('linearGradient', { id: 'gca-gloss', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    for (const [o, c, a] of [[0, '#fff', 0.4], [0.2, '#fff', 0.06], [1, '#000', 0.18]]) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, lg);
    noisePattern(d, 'gca-speck', 26, 52, [255, 255, 255], 0, 0.12, 1);
  }

  tz.addForm('gca-pet', (ctx, d) => {
    ensureDefs();
    const g = ctx.g, w = 124, h = 200, rx = 10;
    softShadow(g, { w, h, rx, dy: 12, blur: 8, opacity: 0.55 });
    svg('rect', { width: w, height: h, rx, fill: d.color || '#f6b6d2' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#gca-speck)' }, g);
    // egg-shaped toy face plate around the screen and buttons
    svg('ellipse', { cx: w / 2, cy: 78, rx: 56, ry: 68, fill: 'url(#gca-shell)', stroke: '#b45b85', 'stroke-width': 1 }, g);
    svg('ellipse', { cx: w / 2, cy: 78, rx: 52, ry: 64, fill: 'none', stroke: '#fff', 'stroke-width': 1, 'stroke-opacity': 0.6 }, g);
    for (const [x, y] of [[30, 26], [94, 26], [18, 80], [106, 80]]) {
      svg('path', { d: `M${x} ${y - 3} l1 2 l2.2 0.3 l-1.6 1.5 l0.4 2.2 l-2 -1 l-2 1 l0.4 -2.2 l-1.6 -1.5 l2.2 -0.3 Z`, fill: '#fff6a8', stroke: '#b45b85', 'stroke-width': 0.4 }, g);
    }
    const t = label(g, w / 2, 32, d.logo || 'OwO', { size: 15, fill: '#ffffff', font: "'Oswald', sans-serif", weight: 700, ls: 1 });
    t.setAttribute('stroke', '#b45b85'); t.setAttribute('stroke-width', 2.4); t.setAttribute('paint-order', 'stroke');
    label(g, w / 2, 43, 'POCKET PET BUFFER', { size: 4.6, fill: '#7a2a52', weight: 800, ls: 1.1 });
    svg('rect', { width: w, height: h, rx, fill: 'url(#gca-gloss)', 'pointer-events': 'none' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'none', stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.8 }, g);
    label(g, w / 2, h - 7, 'TONE ZONE', { size: 4.2, fill: '#7a2a52', weight: 800, ls: 1.2, opacity: 0.7 });
    const theme = { text: '#5a1d3c', labelSize: 5.6, labelFont: "'Barlow Condensed', sans-serif" };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  tz.addDefs([
    def({
      id: 'gca.uwu', name: 'OwO Pocket Pet', code: 'OwO', logo: 'OwO', ref: 'Ground Control Audio UwU Virtual Pet Buffer', brand: 'Ground Control Audio',
      cat: 'Utility', kind: 'Utility', typeName: 'Buffer + virtual pet', form: 'gca-pet', color: '#f6b6d2', cost: 0.1,
      tags: ['buffer', 'tamagotchi', 'virtual pet', 'cat', 'oled', 'novelty'],
      algo: 'meter', alwaysOn: true,
      controls: [
        SCREEN('gca-pet', { x: 62, y: 80, w: 88, h: 52, bezel: '#2a1220', bg: '#020203' }),
        BTN('A · FEED', { p: 'btnA', toggle: true, virtual: true, x: 40, y: 122, r: 5.5, color: '#ff5fa2', labelSize: 5 }),
        BTN('B · PLAY', { p: 'btnB', toggle: true, virtual: true, x: 84, y: 122, r: 5.5, color: '#5fd0ff', labelSize: 5 }),
        TOG('sens', 'SENS', ['LO', 'MED', 'HI'], { x: 22, y: 168, def: 1, virtual: true, orient: 'h' }),
        TOG('bright', 'BRIGHT', ['LO', 'MED', 'HI'], { x: 62, y: 168, def: 2, virtual: true, orient: 'h' }),
        TOG('hard', 'HARDCORE', ['OFF', 'ON'], { x: 102, y: 168, def: 0, virtual: true, orient: 'h' }),
        LED({ x: 62, y: 144, r: 2.2, color: '#7dff9a' }),
      ],
      desc: 'A clean, always-on buffer with a pixel pet on its screen. Play and it dances, earns XP and grows from kitten to crowned cat over 30 levels. A feeds it, B plays with it. SENS sets how loud you must play, HARDCORE gives you 10 minutes per level or it goes back to level 1.',
    }),
  ]);
}
