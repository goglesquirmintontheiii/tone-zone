'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('tz', {
  engine: {
    send: (cmd) => ipcRenderer.send('engine:cmd', cmd),
    onEvent: (fn) => ipcRenderer.on('engine:event', (_e, ev) => fn(ev)),
    restart: () => ipcRenderer.invoke('engine:restart'),
    info: () => ipcRenderer.invoke('engine:info'),
    list: () => ipcRenderer.invoke('engine:list'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (s) => ipcRenderer.invoke('settings:set', s),
  },
  lib: {
    list: () => ipcRenderer.invoke('lib:list'),
    pickFiles: (kind) => ipcRenderer.invoke('lib:pickFiles', kind),
    pickFolder: () => ipcRenderer.invoke('lib:pickFolder'),
    inspectPaths: (paths, origin) => ipcRenderer.invoke('lib:inspectPaths', paths, origin),
    commit: (req) => ipcRenderer.invoke('lib:commit', req),
    update: (id, f) => ipcRenderer.invoke('lib:update', id, f),
    remove: (id) => ipcRenderer.invoke('lib:remove', id),
    discard: (id) => ipcRenderer.invoke('lib:discard', id),
    openFolder: () => ipcRenderer.invoke('lib:openFolder'),
    pathForFile: (file) => (webUtils && webUtils.getPathForFile ? webUtils.getPathForFile(file) : file.path),
  },
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    setEnabled: (id, on) => ipcRenderer.invoke('plugins:setEnabled', id, on),
    install: (kind) => ipcRenderer.invoke('plugins:install', kind),
    installPath: (p) => ipcRenderer.invoke('plugins:installPath', p),
    remove: (id) => ipcRenderer.invoke('plugins:remove', id),
    removeBuiltin: (id) => ipcRenderer.invoke('plugins:removeBuiltin', id),
    removedBuiltins: () => ipcRenderer.invoke('plugins:removedBuiltins'),
    restoreBuiltins: (ids) => ipcRenderer.invoke('plugins:restoreBuiltins', ids),
    openDir: () => ipcRenderer.invoke('plugins:openDir'),
  },
  offline: {
    render: (graph, di) => ipcRenderer.invoke('offline:render', graph, di),
    features: (files, t0, t1) => ipcRenderer.invoke('offline:features', files, t0, t1),
    evalGraphs: (graphs, di) => ipcRenderer.invoke('offline:evalGraphs', graphs, di),
  },
  sys: {
    usbDevices: () => ipcRenderer.invoke('sys:usbDevices'),
  },
  presets: {
    list: () => ipcRenderer.invoke('presets:list'),
    load: (f) => ipcRenderer.invoke('presets:load', f),
    save: (p, f) => ipcRenderer.invoke('presets:save', p, f),
    remove: (f) => ipcRenderer.invoke('presets:delete', f),
    removeMany: (files) => ipcRenderer.invoke('presets:deleteMany', files),
    deletedFactory: () => ipcRenderer.invoke('presets:deletedFactory'),
    restoreFactory: () => ipcRenderer.invoke('presets:restoreFactory'),
    meta: (f, patch) => ipcRenderer.invoke('presets:meta', f, patch),
    duplicate: (f) => ipcRenderer.invoke('presets:duplicate', f),
    exportPreset: (p) => ipcRenderer.invoke('presets:export', p),
    importPresets: () => ipcRenderer.invoke('presets:import'),
  },
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    openExternal: (u) => ipcRenderer.invoke('app:openExternal', u),
  },
});
