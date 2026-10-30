// Pi tab: Devices section and the Add a Pi wizard (demo: scanning and pairing are faked).
import { el, esc, toast } from '../util.js';
import { modal } from '../menus.js';
import { MODELS, LINKS, PI_BUDGET, savePi, piLog, fmtUptime } from './pi-data.js';
import { card, meter, copyBox, demoNote } from './pi-ui.js';

const INSTALL_URL = 'https://raw.githubusercontent.com/goglesquirmintontheiii/tone-zone/main/pi/install.sh';
export const INSTALL_ONE = `curl -fsSL ${INSTALL_URL} | sudo bash`;

export function renderDevices(main, ctx) {
  const { store } = ctx;
  const top = el('div', { class: 'pi-sechead' }, main);
  el('div', {}, top, '<h2>Devices</h2><p>Pis running Tone Zone on your network or on a cable to this computer.</p>');
  const acts = el('div', { class: 'pi-row' }, top);
  const scan = el('button', { class: 'btn', 'data-act': 'scan' }, acts, 'Scan again');
  const add = el('button', { class: 'btn btn-accent', 'data-act': 'add-device' }, acts, '+ Add a Pi');
  add.onclick = () => openWizard(ctx);
  scan.onclick = () => {
    scan.textContent = 'Scanning...';
    scan.disabled = true;
    piLog('Scanning for _tonezone._tcp on all interfaces');
    setTimeout(() => {
      scan.textContent = 'Scan again';
      scan.disabled = false;
      toast(`Found ${store.devices.filter((d) => d.online).length} Pis (demo)`);
    }, 1200);
  };

  const grid = el('div', { class: 'pi-devgrid' }, main);
  for (const d of store.devices) {
    const c = el('div', { class: 'pi-dev' + (d.id === store.current ? ' cur' : '') + (d.online ? '' : ' offline'), 'data-device': d.id }, grid);
    const h = el('div', { class: 'pi-dev-head' }, c);
    el('div', { class: 'pi-board-ic ' + d.model }, h, `<b>${MODELS[d.model].short}</b>`);
    const t = el('div', { class: 'pi-dev-title' }, h);
    el('h3', {}, t).textContent = d.name;
    el('div', { class: 'sub' }, t).textContent = `${MODELS[d.model].name}, ${d.ram} GB`;
    el('span', { class: 'pi-status ' + (d.online ? 'on' : 'off') }, h).textContent = d.online ? 'Online' : 'Offline';
    const info = el('div', { class: 'pi-dev-info' }, c);
    const kv = (k, v, live) => { const r = el('div', {}, info); el('span', {}, r).textContent = k; const b = el('b', live ? { 'data-live': d.id + ':' + live } : {}, r); b.textContent = v; };
    kv('Address', d.host);
    kv('IP', d.ip);
    kv('Connection', LINKS[d.link] || d.link);
    kv('Version', d.version);
    if (d.online) {
      kv('Temperature', d.temp.toFixed(0) + ' C', 'temp');
      kv('Latency', (d.model === 'pi5' ? 5.3 : 10.7).toFixed(1) + ' ms');
      kv('Dropouts', String(d.xruns));
      kv('Up for', fmtUptime(d.uptime));
      const cpu = el('div', { class: 'pi-dev-cpu' }, c);
      el('span', {}, cpu).textContent = 'DSP load';
      const m = meter(cpu, d.cpu, d.cpu > PI_BUDGET ? 'bad' : d.cpu > PI_BUDGET * 0.8 ? 'heavy' : 'ok');
      m.firstChild.dataset.live = d.id + ':cpubar';
      el('b', { 'data-live': d.id + ':cpu' }, cpu).textContent = Math.round(d.cpu) + '%';
    } else el('div', { class: 'pi-dev-off' }, c).textContent = 'Last seen 2 days ago. Check that it has power and is on the same network.';
    const row = el('div', { class: 'pi-row' }, c);
    if (d.id !== store.current) {
      const u = el('button', { class: 'btn small btn-accent' }, row, 'Use this Pi');
      u.onclick = () => { store.current = d.id; savePi(); ctx.refreshAll(); };
    } else el('span', { class: 'pi-chip' }, row).textContent = 'Selected';
    const idb = el('button', { class: 'btn small', disabled: d.online ? null : '' }, row, 'Blink LED');
    idb.onclick = () => { piLog(`Identify: blinking status LED on ${d.name}`, 'info', 'gpio'); toast(`${d.name}: the status LED blinks for 10 seconds (demo)`); };
    const rn = el('button', { class: 'btn small btn-ghost' }, row, 'Rename');
    rn.onclick = () => {
      // inline edit (Electron has no window.prompt)
      const inp = el('input', { type: 'text', value: d.name, class: 'pi-rename' });
      c.querySelector('h3').replaceWith(inp);
      inp.focus();
      inp.select();
      const done = () => { d.name = inp.value.trim() || d.name; savePi(); ctx.refreshAll(); };
      inp.onkeydown = (e) => e.key === 'Enter' && done();
      inp.onblur = done;
    };
    if (d.online) {
      const rb = el('button', { class: 'btn small btn-ghost' }, row, 'Reboot');
      rb.onclick = () => { piLog(`Reboot requested for ${d.name}`); toast('Rebooting (demo). Sound stops for about 20 seconds.'); };
    }
    const fg = el('button', { class: 'btn small btn-ghost pi-danger' }, row, 'Forget');
    fg.onclick = () => {
      store.devices = store.devices.filter((x) => x !== d);
      if (store.current === d.id) store.current = store.devices[0]?.id;
      piLog(`Forgot ${d.name} (keys removed)`);
      savePi();
      ctx.refreshAll();
    };
  }
  if (!store.devices.length) el('div', { class: 'pi-empty' }, grid).textContent = 'No Pis yet. Add one to get started.';

  const help = card(main, 'What you need', 'A Raspberry Pi 4 or 5, a microSD card (16 GB or more), a power supply and an audio interface.');
  const ul = el('ul', { class: 'pi-list' }, help);
  for (const t of ['Pi 5 is the best choice. Pi 4 works for amp + cab + pedals and for NAM Lite / Feather models.', 'Audio: an audio HAT, a USB audio interface, or a cheap USB audio adapter to start with. The Pi has no audio input of its own.', 'Optional: a screen (official 7" touch screen, a small HDMI or SPI screen), footswitches and LEDs on the GPIO pins.', 'Raspberry Pi OS Lite (64-bit). Raspberry Pi Imager puts it on the SD card for you.'])
    el('li', {}, ul).textContent = t;
}

// ---------------------------------------------------------------- Add a Pi wizard
const WAYS = [
  ['wifi', 'Wi-Fi', 'The Pi joins your home Wi-Fi. No cables except power.'],
  ['ethernet', 'Ethernet to your router', 'Plug the Pi into your router or a network switch.'],
  ['direct', 'Cable straight to this computer', 'One Ethernet cable from this computer to the Pi. No router needed.'],
  ['manual', 'It is already set up', 'Tone Zone is already installed, or you know its address.'],
];

export function openWizard(ctx) {
  const w = { step: 0, way: 'wifi', host: 'tonezone.local', code: '', found: null };
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
  function finish() {
    if (!/^\d{6}$/.test(w.code)) { toast('Type the 6 digit code shown by the Pi', 'warn'); return; }
    const id = 'd' + Date.now().toString(36);
    const s = ctx.store;
    const name = 'New Pi ' + (s.devices.length + 1);
    s.devices.push({ id, name, model: 'pi5', ram: 4, host: w.host, ip: w.way === 'direct' ? '169.254.88.14' : '192.168.1.' + (50 + s.devices.length), link: w.way, online: true, version: '0.8.0', cpu: 6, temp: 47, xruns: 0, uptime: 60, banks: [], bank: 0, slot: 0 });
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
  }
  function stepCard(p) {
    el('h4', {}, p).textContent = 'Prepare the SD card';
    const ol = el('ol', { class: 'pi-steps' }, p);
    const li = (h) => el('li', {}, ol, h);
    li('Install <b>Raspberry Pi Imager</b> on this computer (raspberrypi.com/software) and put the SD card in.');
    li('Choose your board (Pi 4 or Pi 5), then <b>Raspberry Pi OS (other) &rsaquo; Raspberry Pi OS Lite (64-bit)</b>.');
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
    setTimeout(() => {
      if (!f.isConnected) return;
      w.found = true;
      f.innerHTML = `<span class="pi-dot on"></span> Found <b>${esc(w.host)}</b> (Raspberry Pi 5, Tone Zone 0.8.0) over ${esc(LINKS[w.way])}`;
    }, 900);
    el('p', { class: 'pi-muted' }, p).textContent = 'The Pi shows a 6 digit code on its screen, at the end of the install, or with "tonezone pair" over SSH. Headless? The status LED blinks it.';
    const inp = el('input', { type: 'text', inputmode: 'numeric', maxlength: 6, placeholder: '000000', class: 'pi-code-in', 'data-wiz': 'code', value: w.code }, p);
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); w.code = inp.value; };
    setTimeout(() => inp.focus(), 50);
    demoNote(p, 'Any 6 digits work in this preview.');
  }
  draw();
  return md;
}
