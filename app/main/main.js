// Tone Zone: Electron main process
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, session, Menu, nativeTheme, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const lib = require('./library');
const plugins = require('./plugins');
const offline = require('./offline');
const capture = require('./capture');
const { EngineHost, findEngine } = require('./engine-host');

const APP_ROOT = path.join(__dirname, '..');
app.setName('Tone Zone');
// let Chromium pick Wayland or X11 natively
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
nativeTheme.themeSource = 'dark';

let win = null;
let engine = null;
let settings = {};

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// window colour before the page paints, so a light theme doesn't flash dark
const themeBg = () => ({ light: '#eceff3', mono: '#0b0b0b' }[settings.theme] || '#0d0f14');

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1720, width),
    height: Math.min(1040, height),
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: themeBg(),
    title: 'Tone Zone',
    icon: path.join(APP_ROOT, 'build', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: themeBg(), icon: path.join(APP_ROOT, 'build/icon.png'), minWidth: 280, minHeight: 300, webPreferences: { sandbox: false, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

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
  // ---- Pedal Factory designs saved as blocks
  require('./custom-blocks').setup(ipcMain, lib.dataRoot());
  require('./circuits').setup(ipcMain, lib.dataRoot());
  // ---- Raspberry Pi pedals (pi.js)
  require('./pi').setup(ipcMain, { dataRoot: lib.dataRoot(), send, dialog, getWin: () => win });
  // ---- capture (NAM models from presets)
  capture.init({ dataRoot: lib.dataRoot(), engineBin: () => (engine && engine.binPath) || findEngine(APP_ROOT, app.isPackaged), send });
  ipcMain.handle('capture:status', () => capture.status());
  ipcMain.handle('capture:setup', (_e, opts) => capture.setupTrainer(opts));
  ipcMain.handle('capture:cancelSetup', () => capture.cancelSetup());
  ipcMain.handle('capture:removeTrainer', () => capture.removeTrainer());
  ipcMain.handle('capture:trainerSize', () => capture.trainerSize());
  ipcMain.handle('capture:downloadInput', () => capture.downloadInput());
  ipcMain.handle('capture:pickInput', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose the NAM training signal (v3_0_0.wav)', properties: ['openFile'], filters: [{ name: 'WAV audio', extensions: ['wav'] }] });
    if (r.canceled || !r.filePaths.length) return null;
    return capture.useInputFile(r.filePaths[0]);
  });
  ipcMain.handle('capture:start', (_e, opts) => capture.start(opts));
  ipcMain.handle('capture:cancel', () => capture.cancel());
  ipcMain.handle('capture:finish', () => capture.finishEarly());
  ipcMain.handle('capture:clear', () => capture.clearJob());
  // ---- plugins
  ipcMain.handle('plugins:list', () => plugins.list(APP_ROOT, lib.dataRoot(), settings.plugins || {}, settings.pluginsRemoved || []));
  ipcMain.handle('plugins:removeBuiltin', (_e, id) => {
    settings.pluginsRemoved = [...new Set([...(settings.pluginsRemoved || []), id])];
    lib.saveSettings(settings);
    return true;
  });
  ipcMain.handle('plugins:removedBuiltins', () => plugins.removedBuiltins(APP_ROOT, settings.pluginsRemoved || []));
  ipcMain.handle('plugins:restoreBuiltins', (_e, ids) => {
    settings.pluginsRemoved = ids ? (settings.pluginsRemoved || []).filter((x) => !ids.includes(x)) : [];
    lib.saveSettings(settings);
    return true;
  });
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
    platform: process.platform,
    electron: process.versions.electron,
  }));
  ipcMain.handle('app:openExternal', (_e, url) => shell.openExternal(url));

}

// ---------------------------------------------------------------- lifecycle
// test runs (Playwright attaches a debugger) may run several instances at once
const testRun = app.commandLine.hasSwitch('remote-debugging-port') || !!process.env.TZ_NO_SINGLE_INSTANCE;
const gotLock = testRun || app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// Web MIDI (device plugins like the Line 6 Helix use MIDI from the renderer)
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
app.on('before-quit', () => {
  capture.shutdown();
  if (engine) engine.stop();
});
