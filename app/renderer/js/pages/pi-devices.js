// Pi tab: Devices section and the Add a Pi wizard (demo: scanning and pairing are faked).
import { el, esc, toast } from '../util.js';
import { modal } from '../menus.js';
import { MODELS, MODEL_IDS, LINKS, BUDGET_MIN, BUDGET_MAX, budgetOf, defaultBudget, isPi3, savePi, piLog, fmtUptime, fmtAgo, latencyOf, act, orderedDevices, setDeviceOrder, selectDevice, currentDevice } from './pi-data.js';
import { card, copyBox, demoNote, loadMeter, paintLoad, paintTemp, range, select } from './pi-ui.js';

const INSTALL_URL = 'https://raw.githubusercontent.com/goglesquirmintontheiii/tone-zone/main/pi/install.sh';
export const INSTALL_ONE = `curl -fsSL ${INSTALL_URL} | sudo bash`;

export function renderDevices(main, ctx) {
  const { store } = ctx;
  const top = el('div', { class: 'pi-sechead' }, main);
  el('div', {}, top, '<h2>Devices</h2><p>Pis running Tone Zone on your network or on a cable to this computer. Click a card to pick that Pi, drag cards to sort them.</p>');
  const acts = el('div', { class: 'pi-row' }, top);
  const scan = el('button', { class: 'btn', 'data-act': 'scan' }, acts, 'Scan again');
  const add = el('button', { class: 'btn btn-accent', 'data-act': 'add-device' }, acts, '+ Add a Pi');
  add.onclick = () => openWizard(ctx);
  scan.onclick = async () => {
    scan.textContent = 'Scanning...';
    scan.disabled = true;
    piLog('Scanning for _tonezone._tcp on all interfaces');
    const done = (n) => { scan.textContent = 'Scan again'; scan.disabled = false; toast(`Found ${n} Pi${n === 1 ? '' : 's'}${ctx.live ? '' : ' (demo)'}`); };
    const p = act('scan');
    if (p) p.then((list) => done((list || []).filter((d) => d.online).length), () => done(0));
    else setTimeout(() => done(store.devices.filter((d) => d.online).length), 1200);
  };

  const grid = el('div', { class: 'pi-devgrid' }, main);
  const cur = currentDevice();
  for (const d of orderedDevices(store)) deviceCard(grid, d, ctx, cur && d.id === cur.id);
  if (!store.devices.length) el('div', { class: 'pi-empty' }, grid).textContent = ctx.live ? 'No Pis found yet. Add one, or check that it is on and on the same network.' : 'No Pis yet. Add one to get started.';
  dragSort(grid, ctx);

  const help = card(main, 'What you need', 'A Raspberry Pi 3B, 3B+, 4 or 5, a microSD card (16 GB or more), a power supply and an audio interface.');
  const ul = el('ul', { class: 'pi-list' }, help);
  for (const t of [
    'Pi 5 is the best choice. Pi 4 works for amp + cab + pedals and for NAM Lite / Feather models.',
    'Pi 3B and 3B+ work for lighter presets: amp + cab + a few pedals, or one NAM Feather model. They have a 3.5 mm output, so headphones work without extra parts.',
    'Audio input: an audio HAT, a USB audio interface, or a cheap USB audio adapter to start with. No Pi has an audio input of its own.',
    'Optional: a screen (official 7" touch screen, a small HDMI or SPI screen), footswitches and LEDs on the GPIO pins.',
    'Raspberry Pi OS Lite (64-bit), also on a Pi 3B or 3B+ (they run it fine). Raspberry Pi Imager puts it on the SD card for you.',
  ]) el('li', {}, ul).textContent = t;
}

function deviceCard(grid, d, ctx, isCur) {
  const { store } = ctx;
  const M = MODELS[d.model] || MODELS.pi4;
  const c = el('div', { class: 'pi-dev' + (isCur ? ' cur' : '') + (d.online ? '' : ' offline'), 'data-device': d.id, tabindex: 0, role: 'button', 'aria-pressed': isCur ? 'true' : 'false', 'aria-label': `${d.name}, ${M.name}. Enter to pick, Alt and arrow keys to move.` }, grid);
  const h = el('div', { class: 'pi-dev-head' }, c);
  el('span', { class: 'pi-grip', title: 'Drag to move', 'aria-hidden': 'true' }, h, '<i></i><i></i><i></i>');
  el('div', { class: 'pi-board-ic ' + d.model }, h, `<b>${M.short}</b>`);
  const t = el('div', { class: 'pi-dev-title' }, h);
  el('h3', {}, t).textContent = d.name;
  el('div', { class: 'sub' }, t).textContent = `${M.name}, ${d.ram} GB`;
  if (isCur) el('span', { class: 'pi-chip pi-selchip' }, h).textContent = 'Selected';
  el('span', { class: 'pi-status ' + (d.online ? 'on' : 'off') }, h).textContent = d.online ? 'Online' : 'Offline';
  const info = el('div', { class: 'pi-dev-info' }, c);
  const kv = (k, v, live) => { const r = el('div', {}, info); el('span', {}, r).textContent = k; const b = el('b', live ? { 'data-live': d.id + ':' + live } : {}, r); b.textContent = v; return b; };
  kv('Address', d.host || '-');
  kv('IP', d.ip || '-');
  kv('Connection', LINKS[d.link] || d.link || '-');
  kv('Version', d.version || '-');
  if (d.online) {
    paintTemp(kv('Temperature', '', 'temp'), d.temp);
    kv('Latency', latencyOf(d).toFixed(1) + ' ms');
    kv('Dropouts', String(d.xruns), 'xruns');
    kv('Up for', fmtUptime(d.uptime));
    if (d.os === '32-bit') el('p', { class: 'pi-warn' }, c).textContent = 'This Pi runs a 32-bit system. Tone Zone needs Raspberry Pi OS 64-bit (it runs fine on every supported Pi).';
    const loads = el('div', { class: 'pi-loads' }, c);
    const row = (label, key, opts) => {
      const r = el('div', { class: 'pi-dev-cpu', 'data-loadrow': key }, loads);
      el('span', {}, r).textContent = label;
      const m = loadMeter(r, d[key], opts);
      m.dataset.live = d.id + ':' + key + 'bar';
      el('b', { 'data-live': d.id + ':' + key }, r).textContent = Math.round(d[key]) + '%';
    };
    row('DSP load', 'dsp', { budget: budgetOf(d) });
    row('CPU load', 'cpu', {});
    budgetRow(c, d, ctx);
  } else el('div', { class: 'pi-dev-off' }, c).textContent = `Last seen ${fmtAgo(d.lastSeen)}. Check that it has power and is on the same network.`;
  const row = el('div', { class: 'pi-row' }, c);
  const idb = el('button', { class: 'btn small', disabled: d.online ? null : '' }, row, 'Blink LED');
  idb.onclick = () => {
    piLog(`Identify: blinking status LED on ${d.name}`, 'info', 'gpio');
    const p = act('identify', { id: d.id });
    if (p) p.then(() => toast(`${d.name}: the status LED blinks for 10 seconds`), () => {});
    else toast(`${d.name}: the status LED blinks for 10 seconds (demo)`);
  };
  const rn = el('button', { class: 'btn small btn-ghost' }, row, 'Rename');
  rn.onclick = () => {
    // inline edit (Electron has no window.prompt)
    const inp = el('input', { type: 'text', value: d.name, class: 'pi-rename' });
    c.querySelector('h3').replaceWith(inp);
    inp.focus();
    inp.select();
    let gone = false;
    const done = () => { if (gone) return; gone = true; d.name = inp.value.trim() || d.name; savePi(); ctx.refreshAll(); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') done(); };
    inp.onblur = done;
  };
  if (d.online) {
    const rb = el('button', { class: 'btn small btn-ghost' }, row, 'Reboot');
    rb.onclick = () => {
      piLog(`Reboot requested for ${d.name}`);
      const p = act('reboot', { id: d.id });
      if (p) p.then(() => toast(`${d.name} is restarting. Sound stops for about 20 seconds.`), () => {});
      else toast('Rebooting (demo). Sound stops for about 20 seconds.');
    };
  }
  const fg = el('button', { class: 'btn small btn-ghost pi-danger' }, row, 'Forget');
  fg.onclick = async () => {
    const p = act('forget', { id: d.id });
    if (p) { try { await p; } catch { return; } }
    store.devices = store.devices.filter((x) => x !== d);
    if (store.current === d.id) store.current = orderedDevices(store)[0]?.id;
    piLog(`Forgot ${d.name} (keys removed)`);
    savePi();
    ctx.refreshAll();
  };

  // a click anywhere on the card that is not a control picks this Pi
  const pick = () => {
    if (isCur) return;
    selectDevice(d.id);
    piLog(`Using ${d.name}`, 'info', 'ui');
    ctx.refreshAll();
  };
  c.addEventListener('click', (e) => {
    if (c.dataset.dragged) { delete c.dataset.dragged; return; }
    if (e.target.closest(INTERACTIVE)) return;
    pick();
  });
  c.addEventListener('keydown', (e) => {
    if (e.target !== c) return;
    if ((e.key === 'Enter' || e.key === ' ') && !e.altKey) { e.preventDefault(); pick(); return; }
    const dir = e.altKey && { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const sib = dir < 0 ? c.previousElementSibling : c.nextElementSibling;
    if (!sib || !sib.classList.contains('pi-dev')) return;
    grid.insertBefore(c, dir < 0 ? sib : sib.nextSibling);
    saveOrder(grid, ctx);
    c.focus();
  });
}
const INTERACTIVE = 'button, input, select, textarea, label, a, .pi-range, .pi-budget';

// DSP budget: the most DSP a preset may use on this Pi
function budgetRow(c, d, ctx) {
  const b = el('div', { class: 'pi-budget', 'data-budget': d.id }, c);
  const top = el('div', { class: 'pi-budget-top' }, b);
  el('span', {}, top).textContent = 'DSP budget';
  const r = range(top, BUDGET_MIN, BUDGET_MAX, budgetOf(d), (v) => {
    d.budget = v;
    const m = c.querySelector('[data-live$=":dspbar"]');
    if (m) paintLoad(m, d.dsp, v);
    hint.textContent = budgetHint(d);
  }, (v) => v + '%');
  r.dataset.ctl = 'budget';
  r.setAttribute('aria-label', 'DSP budget for ' + d.name);
  r.onchange = () => { savePi(); piLog(`${d.name}: DSP budget ${d.budget}%`); };
  const hint = el('small', { class: 'pi-muted' }, b);
  hint.textContent = budgetHint(d);
}
function budgetHint(d) {
  const v = budgetOf(d);
  const base = 'Presets above this are made lighter or refused, so the sound never drops out.';
  if (v >= 88) return base + ' Very little headroom: Wi-Fi, the screen or a busy moment can cause dropouts.';
  if (v <= 50) return base + ' Very safe, but heavier presets will not fit.';
  return base + (isPi3(d.model) ? ' 60 to 70% suits a Pi 3.' : ' 70 to 80% is a good range.');
}

function saveOrder(grid, ctx) {
  const ids = [...grid.querySelectorAll('.pi-dev')].map((x) => x.dataset.device);
  setDeviceOrder(ids);
  if (!ctx.live) {
    // keep the demo list in the same order too
    const s = ctx.store;
    s.devices.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    savePi();
  }
  // the header device list follows the new order
  const pick = document.querySelector('#view-pi .pi-devpick');
  if (pick) for (const id of ids) { const o = pick.querySelector(`option[value="${id}"]`); if (o) pick.appendChild(o); }
}

// drag cards with the mouse (or touch) to sort them; a short move is still a click
function dragSort(grid, ctx) {
  let drag = null;
  grid.addEventListener('pointerdown', (e) => {
    const c = e.target.closest('.pi-dev');
    if (!c || e.button !== 0 || e.target.closest(INTERACTIVE)) return;
    drag = { c, id: e.pointerId, sx: e.clientX, sy: e.clientY, ol: c.offsetLeft, ot: c.offsetTop, on: false };
  });
  grid.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.on) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.on = true;
      drag.c.setPointerCapture(e.pointerId);
      drag.c.classList.add('drag');
      grid.classList.add('dragging');
    }
    const place = () => { drag.c.style.transform = `translate(${drag.ol + dx - drag.c.offsetLeft}px, ${drag.ot + dy - drag.c.offsetTop}px)`; };
    place();
    // the card under the pointer: drop before it on its first half, after it on the second
    const over = [...grid.querySelectorAll('.pi-dev:not(.drag)')].find((x) => { const r = x.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
    if (!over) return;
    const r = over.getBoundingClientRect();
    const wide = grid.clientWidth > r.width * 1.5;
    const after = wide ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    const ref = after ? over.nextSibling : over;
    if (ref === drag.c || ref === drag.c.nextSibling) return; // already there
    flip(grid, () => grid.insertBefore(drag.c, ref));
    place();
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.on) return;
    d.c.dataset.dragged = '1';
    setTimeout(() => delete d.c.dataset.dragged, 0);
    d.c.classList.remove('drag');
    d.c.classList.add('drop');
    d.c.style.transform = '';
    setTimeout(() => d.c.classList.remove('drop'), 260);
    grid.classList.remove('dragging');
    saveOrder(grid, ctx);
  };
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);
}
// animate the other cards to their new places
function flip(grid, change) {
  const cards = [...grid.querySelectorAll('.pi-dev:not(.drag)')];
  const before = new Map(cards.map((x) => [x, x.getBoundingClientRect()]));
  change();
  for (const x of cards) {
    const a = before.get(x), b = x.getBoundingClientRect();
    if (a.left === b.left && a.top === b.top) continue;
    x.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
  }
}

// ---------------------------------------------------------------- Add a Pi wizard
function boardNote(m) {
  return {
    pi5: 'Best choice. Runs NAM A2 Full and big presets.',
    pi4: 'Good for amp + cab + pedals and NAM Lite / Feather models. Has a 3.5 mm output.',
    pi3bp: 'Works for lighter presets and one NAM Feather model. Has a 3.5 mm output (lower quality).',
    pi3b: 'Works for light presets. A bit slower than the 3B+. Has a 3.5 mm output (lower quality).',
  }[m];
}
const WAYS = [
  ['wifi', 'Wi-Fi', 'The Pi joins your home Wi-Fi. No cables except power.'],
  ['ethernet', 'Ethernet to your router', 'Plug the Pi into your router or a network switch.'],
  ['direct', 'Cable straight to this computer', 'One Ethernet cable from this computer to the Pi. No router needed.'],
  ['manual', 'It is already set up', 'Tone Zone is already installed, or you know its address.'],
];

export function openWizard(ctx) {
  const w = { step: 0, way: 'wifi', board: 'pi5', host: 'tonezone.local', code: '', found: null, busy: false };
  const body = el('div', { class: 'pi-wiz' });
  const steps = () => (w.way === 'manual' ? ['Connection', 'Address', 'Pair'] : ['Connection', 'SD card', 'Network', 'Install', 'Pair']);
  const md = modal({ title: 'Add a Raspberry Pi', subtitle: 'Step by step. Takes about 15 minutes the first time.', body, width: 'min(760px, 94vw)' });
  md.el.classList.add('pi-wiz-modal');
  const foot = md.el.querySelector('footer');
  const back = el('button', { class: 'btn', 'data-wiz': 'back' }, foot, 'Back');
  const next = el('button', { class: 'btn btn-accent', 'data-wiz': 'next' }, foot, 'Next');
  back.onclick = () => { if (w.step > 0) { w.step--; draw(); } };
  next.onclick = () => {
    const names = steps();
    if (names[w.step] === 'Pair') return finish();
    w.step++;
    draw();
  };
  async function finish() {
    if (!/^\d{6}$/.test(w.code)) { toast('Type the 6 digit code shown by the Pi', 'warn'); return; }
    if (w.busy) return;
    const s = ctx.store;
    const p = act('pair', { host: w.host, code: w.code, link: w.way });
    if (p) {
      w.busy = true;
      next.textContent = 'Pairing...';
      try {
        const d = await p;
        piLog(`Paired with ${w.host} as "${d && d.name ? d.name : w.host}" over ${LINKS[w.way]}`);
        md.close();
        toast(`${d && d.name ? d.name : 'The Pi'} is paired`);
        if (d && d.id) selectDevice(d.id);
        ctx.refreshAll();
      } catch {
        w.busy = false;
        next.textContent = 'Pair';
      }
      return;
    }
    const id = 'd' + Date.now().toString(36);
    const name = 'New Pi ' + (s.devices.length + 1);
    const model = (w.found && w.found.model) || w.board;
    s.devices.push({ id, name, model, ram: MODELS[model].ram[Math.min(1, MODELS[model].ram.length - 1)], host: w.host, ip: w.way === 'direct' ? '169.254.88.14' : '192.168.1.' + (50 + s.devices.length), link: w.way, online: true, version: '0.8.0', os: '64-bit', budget: defaultBudget(model), dsp: 6, cpu: 9, temp: 47, xruns: 0, uptime: 60, banks: [], bank: 0, slot: 0 });
    s.current = id;
    savePi();
    piLog(`Paired with ${w.host} as "${name}" over ${LINKS[w.way]}`);
    md.close();
    toast(`${name} added (demo)`);
    ctx.refreshAll();
  }
  function draw() {
    body.innerHTML = '';
    const names = steps();
    const prog = el('div', { class: 'pi-wiz-steps' }, body);
    names.forEach((n, i) => el('span', { class: i === w.step ? 'on' : i < w.step ? 'done' : '' }, prog, `<b>${i + 1}</b>${n}`));
    const pane = el('div', { class: 'pi-wiz-pane', 'data-step': names[w.step] }, body);
    back.style.visibility = w.step ? '' : 'hidden';
    next.textContent = names[w.step] === 'Pair' ? 'Pair' : 'Next';
    ({ Connection: stepWay, 'SD card': stepCard, Network: stepNet, Install: stepInstall, Address: stepAddress, Pair: stepPair })[names[w.step]](pane);
  }
  function stepWay(p) {
    el('h4', {}, p).textContent = 'How will the Pi connect to this computer?';
    const g = el('div', { class: 'pi-ways' }, p);
    for (const [id, t, d] of WAYS) {
      const b = el('button', { class: 'pi-way' + (w.way === id ? ' on' : ''), 'data-way': id }, g, `<b>${t}</b><span>${d}</span>`);
      b.onclick = () => { w.way = id; draw(); };
    }
    el('h4', {}, p).textContent = 'Which Pi is it?';
    const br = el('div', { class: 'pi-row' }, p);
    select(br, MODEL_IDS.slice().reverse().map((m) => [m, MODELS[m].name]), w.board, (v) => { w.board = v; draw(); }, { 'data-ctl': 'board' });
    el('span', { class: 'pi-muted' }, br).textContent = boardNote(w.board);
  }
  function stepCard(p) {
    el('h4', {}, p).textContent = 'Prepare the SD card';
    const ol = el('ol', { class: 'pi-steps' }, p);
    const li = (h) => el('li', {}, ol, h);
    li('Install <b>Raspberry Pi Imager</b> on this computer (raspberrypi.com/software) and put the SD card in.');
    li(`Choose your board (<b>${MODELS[w.board].name}</b>), then <b>Raspberry Pi OS (other) &rsaquo; Raspberry Pi OS Lite (64-bit)</b>.`);
    if (isPi3(w.board)) li('Pick the <b>64-bit</b> image even on a Pi 3: the 3B and 3B+ run it fine, and Tone Zone is built for 64-bit. The Lite image leaves most of the 1 GB of memory for audio.');
    li('Click <b>Edit settings</b>. Set the hostname to <code>tonezone</code>, a user name and password, and turn on <b>SSH</b> (Services tab).');
    if (w.way === 'wifi') li('Still in settings: type your <b>Wi-Fi name and password</b>. Skipping this is okay: the Pi will open a setup hotspot instead.');
    li('Write the card, put it in the Pi, connect the audio interface and power it on. The first boot takes about 2 minutes.');
  }
  function stepNet(p) {
    el('h4', {}, p).textContent = { wifi: 'Get the Pi on Wi-Fi', ethernet: 'Plug in the network cable', direct: 'Connect the cable to this computer' }[w.way];
    const ol = el('ol', { class: 'pi-steps' }, p);
    const li = (h) => el('li', {}, ol, h);
    if (w.way === 'wifi') {
      li('If you typed your Wi-Fi in Imager, nothing to do here. Wait until the Pi shows up in the next steps.');
      li('No Wi-Fi set yet? After Tone Zone is installed the Pi opens a hotspot called <b>ToneZone-Setup</b>. Join it from your phone or computer, a page opens, pick your network. The hotspot turns off by itself.');
      li('Moving to a new place later: hold footswitch 1 while the Pi starts to bring the hotspot back.');
    } else if (w.way === 'ethernet') {
      li('Plug an Ethernet cable from the Pi into your router or switch.');
      li('That is it. Your router gives the Pi an address and this computer finds it by name (<code>tonezone.local</code>).');
    } else {
      li('Plug an Ethernet cable from this computer (or a USB Ethernet adapter) straight into the Pi.');
      li('Both sides give themselves an automatic address (169.254.x.x). This computer finds the Pi as <code>tonezone.local</code>.');
      li('On Linux: open your network settings, pick the wired connection and set IPv4 to <b>Link-Local Only</b> (or <b>Shared to other computers</b>, which also gives the Pi internet through this computer).');
      li('Windows and macOS do this on their own.');
    }
    demoNote(p, 'The hotspot and automatic discovery are planned. Today you would set Wi-Fi in Imager.');
  }
  function stepInstall(p) {
    el('h4', {}, p).textContent = 'Install Tone Zone on the Pi';
    el('p', { class: 'pi-muted' }, p).textContent = 'Open a terminal on this computer (Terminal on macOS and Linux, PowerShell on Windows) and run these two commands. Use the user name you picked in Imager instead of "pi".';
    copyBox(p, 'ssh pi@tonezone.local', '1. Log in to the Pi (type the password you set)');
    copyBox(p, INSTALL_ONE, '2. Install Tone Zone (about 3 minutes)');
    const d = el('details', { class: 'pi-details' }, p);
    el('summary', {}, d).textContent = 'Rather read the script first?';
    copyBox(d, `curl -fsSLO ${INSTALL_URL}\nless install.sh\nsudo bash install.sh`);
    el('p', { class: 'pi-muted' }, d).textContent = 'It installs the audio engine and a small helper service, sets real-time audio priority and the CPU to full speed, then prints a 6 digit pairing code. To remove it later: sudo tonezone uninstall';
    demoNote(p, 'The installer is not published yet, so these commands do not work today.');
  }
  function stepAddress(p) {
    el('h4', {}, p).textContent = 'Where is the Pi?';
    el('p', { class: 'pi-muted' }, p).textContent = 'Usually tonezone.local finds it. You can also type its IP address (your router shows it, or run "hostname -I" on the Pi).';
    const inp = el('input', { type: 'text', value: w.host, class: 'pi-addr', 'data-wiz': 'addr' }, p);
    inp.oninput = () => (w.host = inp.value.trim());
    el('p', { class: 'pi-muted' }, p).textContent = 'Port 7650 is used. It only answers on your local network.';
  }
  function stepPair(p) {
    el('h4', {}, p).textContent = 'Pair with the Pi';
    const f = el('div', { class: 'pi-found' }, p);
    f.innerHTML = '<span class="pi-spin"></span> Looking for Tone Zone on your network...';
    const shown = (info) => {
      if (!f.isConnected) return;
      w.found = info;
      if (!info) { f.innerHTML = `<span class="pi-dot off"></span> No answer from <b>${esc(w.host)}</b> yet. Check the address, or wait for the Pi to finish starting.`; return; }
      f.innerHTML = `<span class="pi-dot on"></span> Found <b>${esc(w.host)}</b> (${esc((MODELS[info.model] || MODELS.pi4).name)}, Tone Zone ${esc(info.version || '?')}) over ${esc(LINKS[w.way])}`;
    };
    const pr = act('probe', { host: w.host });
    if (pr) pr.then(shown, () => shown(null));
    else setTimeout(() => shown({ model: w.board, version: '0.8.0' }), 900);
    el('p', { class: 'pi-muted' }, p).textContent = 'The Pi shows a 6 digit code on its screen, at the end of the install, or with "tonezone pair" over SSH. Headless? The status LED blinks it.';
    const inp = el('input', { type: 'text', inputmode: 'numeric', maxlength: 6, placeholder: '000000', class: 'pi-code-in', 'data-wiz': 'code', value: w.code }, p);
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); w.code = inp.value; };
    setTimeout(() => inp.focus(), 50);
    demoNote(p, 'Any 6 digits work in demo mode.');
  }
  draw();
  return md;
}
