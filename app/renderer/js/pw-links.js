// Remembers the PipeWire / JACK links of our own ports (made here or in qpwgraph, Helvum...) and puts them back when
// the engine starts again. A link to a device that's unplugged is kept and comes back when the device does. A link
// removed while both ends exist is forgotten.
import { state } from './state.js';

const SELF = '@self:'; // our client name can change (a second copy gets "Tone Zone-01"), so links store this prefix
let restoring = false;
let lastPresent = null; // port names present in the previous ports event
let retryT = 0;

const saved = () => (Array.isArray(state.settings.pwLinks) ? state.settings.pwLinks : []);
const key = (l) => l[0] + '\n' + l[1];

export function hasSavedLinks() {
  return saved().length > 0;
}

// call when the engine (re)starts: the next ports listing with our ports in it restores saved links
export function startRestore() {
  restoring = true;
  lastPresent = null;
  // device blocks register their ports after the graph arrives, so ask a couple of times
  clearTimeout(retryT);
  retryT = setTimeout(() => window.tz.engine.send({ cmd: 'ports' }), 1200);
}

export function onPortsLinks(ev) {
  if (!ev || !ev.self || !Array.isArray(ev.sources)) return;
  const me = ev.self + ':';
  const toStore = (n) => (n.startsWith(me) ? SELF + n.slice(me.length) : n);
  const toReal = (n) => (n.startsWith(SELF) ? me + n.slice(SELF.length) : n);
  const present = new Set([...ev.sources, ...(ev.sinks || [])].map((p) => toStore(p.name)));
  const restore = restoring && [...present].some((n) => n.startsWith(SELF));
  if (restore) restoring = false;
  const cur = new Map();
  const add = (src, dst) => {
    const l = [toStore(src), toStore(dst)];
    if (l[0].startsWith(SELF) || l[1].startsWith(SELF)) cur.set(key(l), l);
  };
  for (const p of ev.sources) for (const c of p.connections || []) add(p.name, c);
  for (const p of ev.sinks || []) for (const c of p.connections || []) add(c, p.name);
  const next = new Map(cur);
  let sent = 0;
  for (const l of saved()) {
    const k = key(l);
    if (cur.has(k)) continue;
    const both = present.has(l[0]) && present.has(l[1]);
    const wasBoth = lastPresent && lastPresent.has(l[0]) && lastPresent.has(l[1]);
    if (!both) next.set(k, l); // an end is unplugged: keep it for later
    else if (restore || !wasBoth) {
      // starting up, or a device just came back: connect it again
      window.tz.engine.send({ cmd: 'connect', src: toReal(l[0]), dst: toReal(l[1]), on: true });
      next.set(k, l);
      sent++;
    }
    // otherwise both ends were there and the link went away: the user removed it
  }
  lastPresent = present;
  const list = [...next.values()];
  if (JSON.stringify(list) !== JSON.stringify(saved())) {
    state.settings.pwLinks = list;
    window.tz.settings.set({ pwLinks: list });
  }
  if (sent) {
    // PipeWire links settle asynchronously; check again so the patchbay shows them
    clearTimeout(retryT);
    retryT = setTimeout(() => window.tz.engine.send({ cmd: 'ports' }), 700);
  }
}
