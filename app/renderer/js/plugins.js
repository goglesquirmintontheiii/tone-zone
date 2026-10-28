// Plugin host (renderer side). Loads every enabled plugin's ES module and hands it the plugin API.
// See docs/plugins.md for the API reference.
import * as helpers from './catalog/helpers.js';
import * as builders from './catalog/builders.js';
import { registerPluginDefs, unregisterPlugin, pluginDefIds, rememberPluginBlocks, CATEGORIES, getDef } from './catalog/index.js';
import { registerForm, unregisterForm, formKit } from './gfx/forms.js';
import { registerScreen } from './screens.js';
import * as controls from './gfx/controls.js';
import * as jacks from './gfx/jacks.js';
import * as fx from './gfx/fx.js';
import * as cabgeom from './gfx/cabgeom.js';
import { svg, el, esc, shade, clamp, bus, toast, luminance } from './util.js';
import { state, uiParams, setParam, syncGraph } from './state.js';

export const API_VERSION = 1;
const loaded = new Map(); // id -> { info, cleanup: [] , count, error }
const blockHooks = new Map(); // block type -> hooks
const pages = new Map();

export function pluginInfo() {
  return loaded;
}
export function hooksFor(type) {
  return blockHooks.get(type);
}
export function pluginPages() {
  return [...pages.values()];
}

function makeApi(info) {
  const m = info.manifest;
  const cleanup = [];
  const api = {
    id: m.id,
    manifest: m,
    apiVersion: API_VERSION,
    appVersion: state.appVersion,
    helpers,
    builders,
    categories: CATEGORIES,
    gfx: Object.assign({ svg, shade, luminance, clamp, formKit, cabgeom }, controls, jacks, fx),
    ui: { el, esc, toast },
    bus: {
      on: (ev, fn) => { bus.on(ev, fn); cleanup.push(() => bus.off && bus.off(ev, fn)); },
      emit: (ev, data) => bus.emit(ev, data),
    },
    addDefs(defs) {
      const n = registerPluginDefs(m.id, Array.isArray(defs) ? defs : [defs], { brand: m.brand });
      rememberPluginBlocks(m.name || m.id, pluginDefIds(m.id));
      return n;
    },
    addForm(name, fn) {
      registerForm(name, fn);
      cleanup.push(() => unregisterForm(name));
    },
    addScreen(kind, impl) {
      registerScreen(kind, impl);
    },
    addStyles(css) {
      const st = document.createElement('style');
      st.dataset.plugin = m.id;
      st.textContent = css;
      document.head.appendChild(st);
      cleanup.push(() => st.remove());
    },
    // per-block-type behaviour: { mount(view), unmount(view), status(view, now), foot(view, ctl, down), menu(block) }
    blockHooks(type, hooks) {
      blockHooks.set(type, hooks);
      cleanup.push(() => blockHooks.delete(type));
    },
    // a full-page tab (shown in the top bar while the plugin is enabled)
    addPage(page) {
      pages.set(m.id + ':' + page.id, Object.assign({ plugin: m.id }, page));
      cleanup.push(() => pages.delete(m.id + ':' + page.id));
      bus.emit('pluginPages');
    },
    asset: (rel) => info.baseUrl + rel,
    engine: {
      send: (cmd) => window.tz.engine.send(cmd),
      onEvent: (fn) => {
        let live = true;
        window.tz.engine.onEvent((ev) => live && fn(ev));
        cleanup.push(() => (live = false));
      },
    },
    storage: {
      get: (k, dflt) => (state.settings.pluginData?.[m.id] ?? {})[k] ?? dflt,
      set: (k, v) => {
        const all = (state.settings.pluginData = state.settings.pluginData || {});
        all[m.id] = Object.assign({}, all[m.id], { [k]: v });
        window.tz.settings.set({ pluginData: all });
      },
    },
    midi: (opts = { sysex: false }) => navigator.requestMIDIAccess(opts),
    app: {
      state,
      ui: (block) => uiParams(block),
      setParam: (id, p, v) => setParam(id, p, v),
      syncGraph: () => syncGraph(),
      getDef: (id) => getDef(id),
    },
    presets: {
      list: () => window.tz.presets.list(),
      load: (f) => window.tz.presets.load(f),
      open: (f) => import('./presets.js').then((m) => m.openPreset(f)),
    },
    sys: { usbDevices: () => window.tz.sys.usbDevices() },
    onUnload: (fn) => cleanup.push(fn),
  };
  return { api, cleanup };
}

async function loadOne(info) {
  const rec = { info, cleanup: [], count: 0, error: null };
  loaded.set(info.id, rec);
  if (info.error) {
    rec.error = info.error;
    return rec;
  }
  if ((info.manifest.api || 1) > API_VERSION) {
    rec.error = `needs plugin API v${info.manifest.api} (this Tone Zone has v${API_VERSION})`;
    return rec;
  }
  try {
    const mod = await import(info.url + (info.builtin ? '' : '?t=' + Date.now()));
    const { api, cleanup } = makeApi(info);
    rec.cleanup = cleanup;
    const reg = mod.default || mod.register;
    if (typeof reg === 'function') await reg(api);
    else if (Array.isArray(mod.defs)) api.addDefs(mod.defs);
    rec.count = pluginDefIds(info.id).length;
  } catch (e) {
    console.error('plugin', info.id, e);
    rec.error = String(e && e.message ? e.message : e);
    unregisterPlugin(info.id);
  }
  return rec;
}

export async function loadPlugins() {
  const list = await window.tz.plugins.list();
  for (const info of list) {
    if (!info.enabled) {
      loaded.set(info.id, { info, cleanup: [], count: 0, error: info.error || null, disabled: true });
      continue;
    }
    await loadOne(info);
  }
  bus.emit('catalog');
  return loaded;
}

export async function setPluginEnabled(id, on) {
  await window.tz.plugins.setEnabled(id, on);
  const rec = loaded.get(id);
  if (!on) {
    if (rec) {
      for (const f of rec.cleanup) try { f(); } catch {}
      unregisterPlugin(id);
      loaded.set(id, Object.assign(rec, { disabled: true, count: 0, cleanup: [] }));
    }
  } else {
    const list = await window.tz.plugins.list();
    const info = list.find((p) => p.id === id);
    if (info) await loadOne(Object.assign(info, { enabled: true }));
  }
  bus.emit('catalog');
  bus.emit('rebuildBoard');
  import('./state.js').then((m) => m.syncGraph());
}

export async function reloadPlugins() {
  for (const [id, rec] of loaded) {
    for (const f of rec.cleanup) try { f(); } catch {}
    unregisterPlugin(id);
  }
  loaded.clear();
  await loadPlugins();
  bus.emit('rebuildBoard');
  import('./state.js').then((m) => m.syncGraph());
}
