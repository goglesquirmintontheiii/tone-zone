// Pi tab, live data: talks to real Pis through window.tz.pi (app/main/pi.js) and turns what the agent says into
// the plain objects described at the top of pi-data.js. Also converts a desktop preset into what the Pi plays.
//
// Extension in live mode: Config.audio.alsa = { inputs, outputs, input, output } lists the Pi's real ALSA
// devices ({ id: 'hw:CARD=Device,DEV=0', name, kind }); audio.input / audio.output stay AUDIO_DEVICES ids.
import { getDef } from '../catalog/index.js';
import { db, ms, pct, ten } from '../catalog/helpers.js';
import { buildGraph, uiParams, engineParamsFor } from '../state.js';

const SCAN_MS = 15000;

// ---- desktop preset -> Pi preset
function unitOf(c) {
  if (c.display === db) return 'dB';
  if (c.display === ms) return 'ms';
  if (c.display === pct) return '%';
  if (c.display === ten) return '0-10';
  return '';
}
export function toPiPreset(preset, file) {
  const graph = buildGraph(preset);
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const blocks = [];
  for (const b of preset.blocks || []) {
    if (String(b.id).startsWith('__')) continue;
    const d = getDef(b.type);
    if (!d || !d.algo || !nodes.has(b.id)) continue;
    const ui = uiParams(b), eng = engineParamsFor(b);
    const params = [];
    for (const c of d.controls || []) {
      if (!c.p || c.virtual || c.invert) continue;
      if (c.t === 'knob' || c.t === 'slider' || c.t === 'treadle') {
        if (typeof eng[c.p] !== 'number') continue;
        params.push({ p: c.p, label: c.label || c.p, kind: 'knob', min: c.min ?? 0, max: c.max ?? 1, value: eng[c.p], unit: unitOf(c) });
      } else if ((c.t === 'sel' || c.t === 'toggle') && Array.isArray(c.options)) {
        const vals = c.options.map((o, i) => (c.values ? c.values[i] : i));
        if (!vals.every((v) => typeof v === 'number')) continue;
        params.push({ p: c.p, label: c.label || c.p, kind: c.t, options: c.options.map((o, i) => ({ label: String(typeof o === 'object' ? o.label ?? o.name ?? i : o), value: vals[i] })), value: eng[c.p] ?? vals[ui[c.p] | 0] });
      }
    }
    blocks.push({
      id: b.id, type: b.type, name: d.name, cat: d.cat, color: d.color || null, bypass: !!b.bypass && !d.alwaysOn, canBypass: !d.alwaysOn,
      tap: (d.controls || []).some((c) => c.action === 'tap'), looper: d.algo === 'looper' ? { event: 1 } : undefined, params,
    });
  }
  const id = String(file || preset.name || 'preset').replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(0, 60) || 'preset';
  return { id, name: preset.name || id, source: file || null, graph, blocks };
}

// ---- audio: real ALSA devices <-> the tab's device list
function uiAudioId(d) {
  if (!d) return '';
  const n = `${d.name} ${d.driver || ''}`;
  if (d.kind === 'builtin') return 'jack35';
  if (d.kind === 'hdmi') return 'hdmi';
  if (d.kind === 'usb') return /scarlett|focusrite/i.test(n) ? 'usb-scarlett' : /umc|behringer/i.test(n) ? 'usb-umc22' : 'usb-aux';
  return /pisound/i.test(n) ? 'hat-pisound' : /codec|iqaudio|da7213/i.test(n) ? 'hat-codec' : 'hat-hifiberry';
}
function audioIn(a) {
  const devs = a.devices || { inputs: [], outputs: [] };
  const act = a.active || {};
  const inId = act.input || a.input, outId = act.output || a.output;
  return {
    input: uiAudioId(devs.inputs.find((d) => d.id === inId)) || 'usb-aux',
    output: uiAudioId(devs.outputs.find((d) => d.id === outId)) || 'jack35',
    rate: a.rate, buffer: a.buffer, periods: a.periods, governor: a.governor, isolate: a.isolate,
    server: a.mode === 'pipewire' || a.server === 'pipewire' ? 'pipewire' : 'jack',
    alsa: { inputs: devs.inputs, outputs: devs.outputs, input: inId || '', output: outId || '' },
  };
}
function audioOut(v, last) {
  const al = (last && last.alsa) || { inputs: [], outputs: [] };
  const pick = (list, uiId, explicit) => explicit || ((list.find((d) => uiAudioId(d) === uiId) || {}).id) || '';
  const out = { rate: v.rate, buffer: v.buffer, periods: v.periods, governor: v.governor, isolate: v.isolate, server: v.server === 'pipewire' ? 'pipewire' : v.server === 'jack' ? 'jackd' : 'auto' };
  out.input = pick(al.inputs, v.input, v.alsa && v.alsa.input !== al.input ? v.alsa.input : null) || al.input;
  out.output = pick(al.outputs, v.output, v.alsa && v.alsa.output !== al.output ? v.alsa.output : null) || al.output;
  if (v.input !== last.input) out.input = pick(al.inputs, v.input) || out.input;
  if (v.output !== last.output) out.output = pick(al.outputs, v.output) || out.output;
  return out;
}

// ---- agent state -> Device fields
const banksIn = (banks) => (banks || []).map((b) => ({ name: b.name, presets: [0, 1, 2, 3].map((k) => { const p = b.presets[k]; return p ? { file: p.id, name: p.name, dsp: p.dsp ?? undefined } : null; }) }));
const banksOut = (banks) => (banks || []).map((b) => ({ name: b.name, presets: [0, 1, 2, 3].map((k) => { const p = b.presets && b.presets[k]; return p ? { id: String(p.file || p.id).replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_.-]+/g, '-'), name: p.name } : null; }) }));
function statsIn(s) {
  if (!s) return {};
  return { dsp: s.dsp ?? 0, cpu: s.cpu ?? 0, temp: s.temp ?? 0, xruns: s.xruns ?? 0, uptime: s.uptime ?? 0, latency: s.latency ?? 0 };
}
function configIn(c) {
  if (!c) return {};
  return { gpio: c.gpio, display: c.display, audio: c.audio ? audioIn(c.audio) : undefined, updates: c.updates, switching: c.switching };
}

export function createLive(api) {
  let emit = () => {};
  let timer = 0;
  let stopped = false;
  let listening = false;
  const devices = new Map(); // id -> Device
  const lastAudio = {}; // id -> last audio config shown (UI shape)
  const versions = {};

  const emitDevices = () => emit({ type: 'devices', devices: [...devices.values()].map((d) => Object.assign({}, d)) });

  function fromList(d) {
    const old = devices.get(d.id) || {};
    devices.set(d.id, old);
    return Object.assign(old, {
      id: d.id, name: d.name, model: d.model || old.model || 'pi4', ram: d.ram || old.ram || 1, host: d.host || old.host || '', ip: d.ip || old.ip || '',
      link: d.link || 'wifi', online: !!d.online, paired: !!d.paired, lastSeen: d.lastSeen || Date.now(), version: d.version || old.version || '',
      prevVersion: d.prevVersion || old.prevVersion || null, os: d.os || old.os || '64-bit', budget: d.budget || old.budget,
      banks: old.banks || [], bank: old.bank || 0, slot: old.slot || 0, fake: d.fake,
    });
  }

  function onState(id, st) {
    const d = devices.get(id);
    if (!d || !st) return;
    const dev = st.device || {};
    const patch = { name: dev.name || d.name, model: dev.model || d.model, ram: dev.ram || d.ram, version: dev.version || d.version, prevVersion: dev.prevVersion || null, os: dev.os || d.os, budget: dev.budget || d.budget, link: dev.link || d.link, banks: banksIn(st.banks), bank: st.bank || 0, slot: st.slot || 0, online: true };
    Object.assign(d, patch, statsIn(st.stats));
    emit({ type: 'device', id, patch: Object.assign(patch, statsIn(st.stats)) });
    if (st.config) {
      const cfg = configIn(st.config);
      if (cfg.audio) lastAudio[id] = cfg.audio;
      emit({ type: 'config', id, config: cfg });
    }
  }

  function onMsg({ id, msg }) {
    if (!msg || stopped) return;
    const d = devices.get(id);
    switch (msg.t) {
      case 'state': return onState(id, msg.state);
      case 'stats': if (d) Object.assign(d, statsIn(msg.stats)); return emit({ type: 'stats', id, stats: statsIn(msg.stats) });
      case 'config': { const cfg = configIn(msg.config); if (cfg.audio) lastAudio[id] = cfg.audio; return emit({ type: 'config', id, config: cfg }); }
      case 'log': return emit({ type: 'log', id, line: msg.line });
      case 'progress': return emit({ type: 'progress', id, job: msg.job, pct: msg.pct, text: msg.text, done: msg.done, error: msg.error });
      case 'online':
        if (d) { d.online = msg.online; emit({ type: 'device', id, patch: { online: msg.online, lastSeen: Date.now() } }); }
        if (msg.online) refresh(id);
        return;
    }
  }

  async function refresh(id) {
    try { onState(id, await api.api(id, 'GET', '/api/state')); } catch (e) { /* offline or not paired */ }
  }

  async function scan() {
    const list = await api.scan({ timeout: 1500 });
    for (const d of list) fromList(d);
    for (const id of [...devices.keys()]) if (!list.some((d) => d.id === id)) devices.delete(id);
    emitDevices();
    for (const d of list) if (d.paired) { api.connect(d.id); if (d.online) refresh(d.id); }
    return [...devices.values()];
  }

  const need = (id) => { const d = devices.get(id); if (!d) throw new Error('That Pi is not connected.'); return d; };
  const call = async (action, a = {}) => {
    switch (action) {
      case 'scan': return scan();
      case 'probe': { const i = await api.probe(a.host); return i ? { model: i.model, version: i.version, name: i.name, id: i.id, paired: i.paired } : null; }
      case 'pair': {
        const d = await api.pair(a.host, a.code, a.link);
        fromList(d);
        emitDevices();
        api.connect(d.id);
        await refresh(d.id);
        return devices.get(d.id);
      }
      case 'forget': await api.forget(a.id); devices.delete(a.id); emitDevices(); return {};
      case 'rename': return api.api(a.id, 'POST', '/api/rename', { name: a.name });
      case 'identify': return api.api(a.id, 'POST', '/api/identify', {});
      case 'reboot': return api.api(a.id, 'POST', '/api/reboot', {});
      case 'setBudget': return api.api(a.id, 'POST', '/api/budget', { budget: a.budget });
      case 'setBanks': return api.api(a.id, 'PUT', '/api/banks', { banks: banksOut(a.banks) });
      case 'select': return api.api(a.id, 'POST', '/api/select', { bank: a.bank, slot: a.slot });
      case 'push': {
        need(a.id);
        const pp = toPiPreset(a.preset, a.file);
        if (a.name) pp.name = a.name;
        const r = await api.pushPreset(a.id, pp, { bank: a.bank, slot: a.slot });
        refresh(a.id);
        return { dsp: r.dsp, id: r.id };
      }
      case 'setConfig': {
        let v = a.value;
        if (a.part === 'audio') v = audioOut(v, lastAudio[a.id] || {});
        return api.api(a.id, 'PUT', '/api/config/' + a.part, v);
      }
      case 'testPin': return api.api(a.id, 'POST', '/api/gpio/test', { pin: a.pin, kind: a.kind });
      case 'calibrate': throw new Error('Expression pedals (ADS1115 / MCP3008) are not supported on the Pi yet.');
      case 'testTone': throw new Error('The test tone is not available on the Pi yet.');
      case 'checkUpdate': {
        const d = need(a.id);
        // ask GitHub from here, so it works when the Pi has no internet
        const info = await api.latest(a.channel || 'stable');
        versions[a.id] = info;
        return { latest: info.version, notes: info.notes || [], newer: info.version !== d.version };
      }
      case 'update': {
        const d = need(a.id);
        emit({ type: 'progress', id: a.id, job: 'update', pct: 5, text: 'Starting the update' });
        const r = a.via === 'network' && !a.file
          ? await api.api(a.id, 'POST', '/api/update/download', { channel: a.channel })
          : await api.pushUpdate(a.id, { channel: a.channel, file: a.file });
        // the Pi restarts into the new version and checks itself; wait for it to come back
        const t0 = Date.now();
        while (Date.now() - t0 < 90000) {
          await new Promise((res) => setTimeout(res, 2000));
          try {
            const st = await api.api(a.id, 'GET', '/api/state');
            if (st && st.device && (st.device.version === r.version || st.device.failedUpdate)) {
              onState(a.id, st);
              const failed = st.device.version !== r.version;
              emit({ type: 'progress', id: a.id, job: 'update', pct: 100, done: true, error: failed ? `Version ${r.version} failed its check. The Pi went back to ${st.device.version}.` : undefined, text: failed ? 'Rolled back' : 'Updated' });
              return { version: st.device.version, rolledBack: failed };
            }
          } catch {}
        }
        emit({ type: 'progress', id: a.id, job: 'update', pct: 100, done: true, error: 'The Pi did not come back after the update. Check its power and network.' });
        throw new Error(`The Pi did not come back after updating ${d.name}.`);
      }
      case 'rollback': { const r = await api.api(a.id, 'POST', '/api/update/rollback', {}); setTimeout(() => refresh(a.id), 4000); return r; }
      case 'logs': return api.api(a.id, 'GET', '/api/logs');
      case 'supportBundle': return api.supportBundle(a.id);
      case 'levels': {
        const s = await api.api(a.id, 'GET', '/api/stats');
        const p = (v) => Math.max(0, Math.min(100, Math.round(100 + (20 * Math.log10(Math.max(1e-5, v || 0))) * (100 / 60))));
        return { in: p(s.inPeak), out: p(s.outPeak) };
      }
      // extras for the live tab
      case 'param': return api.api(a.id, 'POST', '/api/param', { block: a.block, name: a.name, value: a.value });
      case 'bypass': return api.api(a.id, 'POST', '/api/bypass', { block: a.block, on: a.on });
      case 'interfaces': return api.interfaces();
      case 'setupDirect': return api.setupDirect(a.iface);
      default: throw new Error('Not supported yet: ' + action);
    }
  };

  return {
    async start(e) {
      emit = e;
      stopped = false;
      if (!listening) { listening = true; api.onEvent(onMsg); }
      try {
        // remembered Pis first (instant), then a scan
        for (const d of await api.list()) fromList(d);
        if (devices.size) emitDevices();
      } catch {}
      await scan().catch(() => {});
      clearInterval(timer);
      timer = setInterval(() => !stopped && scan().catch(() => {}), SCAN_MS);
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      for (const id of devices.keys()) try { api.disconnect(id); } catch {}
    },
    call,
  };
}
