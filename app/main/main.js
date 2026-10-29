// Tone Zone – Electron main process
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, session, Menu, nativeTheme, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const lib = require('./library');
const plugins = require('./plugins');
const offline = require('./offline');
const { EngineHost, findEngine } = require('./engine-host');

const APP_ROOT = path.join(__dirname, '..');
app.setName('Tone Zone');
// Prefer native Wayland/X11 auto-detection; smooth GPU rendering for the editor canvas
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
nativeTheme.themeSource = 'dark';

let win = null;
let engine = null;
let settings = {};
const T3_PARTITION = 'persist:tone3000';

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1720, width),
    height: Math.min(1040, height),
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: '#0d0f14',
    title: 'Tone Zone',
    icon: path.join(APP_ROOT, 'build', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(APP_ROOT, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => (win = null));
  win.webContents.setWindowOpenHandler(({ url, frameName }) => {
    // pop-out panels (blocks browser / inspector) share the renderer's JS context
    if (url === 'about:blank' && /^tz-panel-/.test(frameName))
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#0f1218', icon: path.join(APP_ROOT, 'build/icon.png'), minWidth: 280, minHeight: 300, webPreferences: { sandbox: false, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ---------------------------------------------------------------- TONE3000 embedded browser
function setupTone3000() {
  const ses = session.fromPartition(T3_PARTITION);
  // present as regular Chrome so sign-in providers work
  const ua = ses.getUserAgent().replace(/\s*Electron\/[\d.]+/, '').replace(/\s*tone-zone\/[\d.]+/i, '');
  ses.setUserAgent(ua);
  const dlDir = path.join(lib.ensureDirs(), 'downloads');
  ses.on('will-download', (event, item) => {
    const name = item.getFilename() || 'download';
    const target = path.join(dlDir, `${Date.now()}-${name.replace(/[^\w.\- ()]+/g, '_')}`);
    item.setSavePath(target);
    send('t3:download', { state: 'started', name, total: item.getTotalBytes() });
    item.on('updated', () => send('t3:download', { state: 'progress', name, received: item.getReceivedBytes(), total: item.getTotalBytes() }));
    item.once('done', (_e, state) => {
      if (state !== 'completed') return send('t3:download', { state: 'failed', name });
      const ext = path.extname(name).toLowerCase();
      if (!['.nam', '.wav', '.zip'].includes(ext)) return send('t3:download', { state: 'ignored', name, path: target });
      try {
        const info = lib.inspect([target], 'tone3000');
        info.sourceUrl = item.getURL();
        send('t3:download', { state: 'completed', name, path: target, inspect: info });
      } catch (e) {
        send('t3:download', { state: 'failed', name, error: e.message });
      }
    });
  });
}

app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      // OAuth / sign-in popups stay inside the TONE3000 session
      if (/tone3000|google|accounts|auth|github|discord|apple/i.test(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520, height: 720, parent: win, autoHideMenuBar: true, backgroundColor: '#111',
            webPreferences: { partition: T3_PARTITION },
          },
        };
      }
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }
});

// ---------------------------------------------------------------- IPC
function setupIpc() {
  ipcMain.on('engine:cmd', (_e, cmd) => engine && engine.send(cmd));
  ipcMain.handle('engine:restart', () => engine && engine.restart());
  ipcMain.handle('engine:info', () => ({ bin: engine && engine.binPath }));
  ipcMain.handle('engine:list', () => {
    try {
      const { execFileSync } = require('child_process');
      const bin = findEngine(APP_ROOT, app.isPackaged);
      return bin ? JSON.parse(execFileSync(bin, ['--list'], { encoding: 'utf8', timeout: 8000 })) : {};
    } catch (e) {
      return {};
    }
  });

  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:set', (_e, s) => {
    const oldBuf = settings.buffer;
    settings = Object.assign({}, settings, s);
    lib.saveSettings(settings);
    if (s.buffer !== undefined && s.buffer !== oldBuf && engine) {
      // PipeWire latency hint is applied at client creation, so reconnect the engine
      engine.send({ cmd: 'settings', buffer: settings.buffer });
      setTimeout(() => engine.restart(), 150);
    }
    return settings;
  });

  ipcMain.handle('lib:list', () => lib.list());
  ipcMain.handle('lib:pickFiles', async (_e, kind) => {
    const filters =
      kind === 'ir'
        ? [{ name: 'Impulse responses', extensions: ['wav', 'zip'] }]
        : [{ name: 'NAM models / IRs / archives', extensions: ['nam', 'wav', 'zip'] }];
    const r = await dialog.showOpenDialog(win, { title: 'Import into Tone Zone', properties: ['openFile', 'multiSelections'], filters });
    if (r.canceled || !r.filePaths.length) return null;
    return lib.inspect(r.filePaths, 'file');
  });
  ipcMain.handle('lib:pickFolder', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Import folder', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths.length) return null;
    return lib.inspect(r.filePaths, 'folder');
  });
  ipcMain.handle('lib:inspectPaths', (_e, paths, origin) => lib.inspect(paths, origin));
  ipcMain.handle('lib:commit', (_e, req) => lib.commit(req));
  ipcMain.handle('lib:update', (_e, id, fields) => lib.update(id, fields));
  ipcMain.handle('lib:remove', (_e, id) => lib.remove(id));
  ipcMain.handle('lib:discard', (_e, id) => lib.discardStaging(id));
  ipcMain.handle('lib:openFolder', () => shell.openPath(lib.dataRoot()));

  ipcMain.handle('presets:list', () => lib.listPresets());
  ipcMain.handle('presets:load', (_e, f) => lib.loadPreset(f));
  ipcMain.handle('presets:save', (_e, p, f) => lib.savePreset(p, f));
  ipcMain.handle('presets:delete', (_e, f) => lib.deletePreset(f));
  ipcMain.handle('presets:deleteMany', (_e, fs_) => { for (const f of fs_ || []) lib.deletePreset(f); return true; });
  ipcMain.handle('presets:deletedFactory', () => lib.deletedFactoryPresets(path.join(APP_ROOT, 'presets')));
  ipcMain.handle('presets:restoreFactory', () => lib.installFactoryPresets(path.join(APP_ROOT, 'presets'), { restore: true }));
  ipcMain.handle('presets:meta', (_e, f, patch) => lib.presetMeta(f, patch));
  ipcMain.handle('presets:duplicate', (_e, f) => lib.duplicatePreset(f));
  ipcMain.handle('presets:export', async (_e, p) => {
    const r = await dialog.showSaveDialog(win, { title: 'Export preset', defaultPath: `${p.name || 'preset'}.tzpreset.json`, filters: [{ name: 'Tone Zone preset', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, JSON.stringify(p, null, 2));
    return true;
  });
  ipcMain.handle('presets:import', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Import preset', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Tone Zone preset', extensions: ['json'] }] });
    if (r.canceled) return [];
    const out = [];
    for (const f of r.filePaths) {
      try {
        const p = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (!p.blocks) continue;
        out.push(lib.savePreset(p));
      } catch (_) {}
    }
    return out;
  });

  // ---- offline renders (preset tools / tests)
  offline.init({ dataRoot: lib.dataRoot(), engineBin: () => (engine && engine.binPath) || findEngine(APP_ROOT, app.isPackaged) });
  ipcMain.handle('offline:render', (_e, graph, di) => offline.renderPreview(graph, di));
  ipcMain.handle('offline:features', (_e, files, t0, t1) => offline.stemsFeatures(files, t0, t1));
  ipcMain.handle('offline:evalGraphs', (_e, graphs, di) => offline.evalGraphs(graphs, di));
  // ---- plugins
  ipcMain.handle('plugins:list', () => plugins.list(APP_ROOT, lib.dataRoot(), settings.plugins || {}));
  ipcMain.handle('plugins:setEnabled', (_e, id, on) => {
    settings.plugins = Object.assign({}, settings.plugins, { [id]: !!on });
    lib.saveSettings(settings);
    return true;
  });
  ipcMain.handle('plugins:install', async (_e, kind) => {
    const r = await dialog.showOpenDialog(win, kind === 'folder'
      ? { title: 'Install plugin folder', properties: ['openDirectory'] }
      : { title: 'Install plugin', properties: ['openFile'], filters: [{ name: 'Tone Zone plugin', extensions: ['zip', 'tzplugin'] }] });
    if (r.canceled || !r.filePaths.length) return null;
    return plugins.install(r.filePaths[0], lib.dataRoot());
  });
  ipcMain.handle('plugins:installPath', (_e, p) => plugins.install(p, lib.dataRoot()));
  ipcMain.handle('plugins:remove', (_e, id) => plugins.remove(id, lib.dataRoot()));
  ipcMain.handle('plugins:openDir', () => shell.openPath(plugins.userDir(lib.dataRoot())));
  // ---- system info for device plugins (USB gear like a Line 6 Helix)
  ipcMain.handle('sys:usbDevices', () => {
    const base = '/sys/bus/usb/devices';
    const out = [];
    try {
      for (const d of fs.readdirSync(base)) {
        const p = path.join(base, d);
        const rd = (f) => { try { return fs.readFileSync(path.join(p, f), 'utf8').trim(); } catch { return null; } };
        const vid = rd('idVendor');
        if (!vid) continue;
        out.push({ bus: d, vendorId: vid, productId: rd('idProduct'), manufacturer: rd('manufacturer'), product: rd('product'), serial: rd('serial') });
      }
    } catch {}
    return out;
  });
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    packaged: app.isPackaged,
    dataDir: lib.dataRoot(),
    t3Preload: 'file://' + path.join(__dirname, 't3-preload.js'),
    partition: T3_PARTITION,
    platform: process.platform,
    electron: process.versions.electron,
  }));
  ipcMain.handle('app:openExternal', (_e, url) => shell.openExternal(url));
  ipcMain.handle('t3:clearSession', async () => {
    await session.fromPartition(T3_PARTITION).clearStorageData();
    return true;
  });
}

// ---------------------------------------------------------------- lifecycle
// automated test runs (Playwright attaches a debugger) may run several instances side by side
const testRun = app.commandLine.hasSwitch('remote-debugging-port') || !!process.env.TZ_NO_SINGLE_INSTANCE;
const gotLock = testRun || app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// Web MIDI (device plugins such as the Line 6 Helix talk MIDI from the renderer)
function allowMidi() {
  const ok = (p) => p === 'midi' || p === 'midiSysex' || p === 'clipboard-sanitized-write' || p === 'media';
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(ok(perm)));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => ok(perm));
}

app.whenReady().then(() => {
  lib.ensureDirs();
  allowMidi();
  lib.installFactoryPresets(path.join(APP_ROOT, 'presets'));
  settings = Object.assign({ buffer: 64, quality: 1, budget: 0.75, autoConnect: true }, lib.loadSettings());
  setupIpc();
  setupTone3000();
  engine = new EngineHost({ appRoot: APP_ROOT, isPackaged: app.isPackaged, dataDir: lib.dataRoot(), getBuffer: () => settings.buffer || 64 });
  engine.on('event', (ev) => send('engine:event', ev));
  engine.on('log', (l) => process.env.TZ_DEBUG && process.stderr.write(l));
  createWindow();
  engine.start();
});

app.on('window-all-closed', () => {
  if (engine) engine.stop();
  app.quit();
});
app.on('before-quit', () => engine && engine.stop());
