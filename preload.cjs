// Bridge between the page and Node/Electron. Only these functions are visible to the page.
const { contextBridge, ipcRenderer, clipboard, webUtils } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const pkg = require('./package.json');

contextBridge.exposeInMainWorld('openflow', {
  version: pkg.version,
  setMenu: template => ipcRenderer.send('menu:set', template),
  onMenuCommand: fn => ipcRenderer.on('menu:command', (_e, id) => fn(id)),
  onOpenPath: fn => ipcRenderer.on('file:open-path', (_e, p) => fn(p)),
  onCloseRequest: fn => ipcRenderer.on('app:close-request', () => fn()),
  confirmClose: () => ipcRenderer.send('app:close-confirmed'),
  closeWindow: () => ipcRenderer.send('app:close-window'),
  rendererReady: () => ipcRenderer.send('renderer:ready'),
  openGuide: () => ipcRenderer.send('help:guide'),
  openDialog: opts => ipcRenderer.invoke('dialog:open', opts),
  saveDialog: opts => ipcRenderer.invoke('dialog:save', opts),
  readTextFileSync: p => fs.readFileSync(p, 'utf8'),
  writeTextFileSync: (p, text) => fs.writeFileSync(p, text, 'utf8'),
  writeBinaryFileSync: (p, base64) => fs.writeFileSync(p, Buffer.from(base64, 'base64')),
  basename: p => path.basename(p),
  dirname: p => path.dirname(p),
  resolve: (base, p) => path.resolve(base, p),
  documentsDir: () => path.join(os.homedir(), 'Documents'),
  // Installed builds keep the examples next to app.asar; development runs use the project folder.
  listExamples: () => {
    const dirs = [path.join(process.resourcesPath || '', 'examples'), path.join(__dirname, 'examples')];
    const dir = dirs.find(d => fs.existsSync(d));
    return dir ? fs.readdirSync(dir).filter(f => f.endsWith('.fprg')).sort().map(f => path.join(dir, f)) : [];
  },
  pathForFile: file => webUtils.getPathForFile(file),
  clipboardWrite: text => clipboard.writeText(text),
  clipboardRead: () => clipboard.readText(),
});
