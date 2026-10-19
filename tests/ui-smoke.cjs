// UI smoke test: `electron tests/ui-smoke.cjs <out.png> [program.fprg] [script.js]`
// Opens the real page with the real preload, optionally loads a program and runs a script
// in the page, then saves a screenshot and prints any console errors.
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

const [out, programPath, scriptPath] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const root = path.join(__dirname, '..');
const errors = [];

ipcMain.on('menu:set', (_e, tpl) => { global.menuTemplate = tpl; });
ipcMain.on('renderer:ready', () => {});
// Save dialogs answer with a file in OPENFLOW_SAVE_DIR (if set); --commands=a,b sends menu commands.
const saveDir = process.env.OPENFLOW_SAVE_DIR;
const commandsArg = (process.argv.find(a => a.startsWith('--commands=')) || '').slice(11);
ipcMain.handle('dialog:open', () => null);
ipcMain.handle('dialog:save', (_e, o) => (saveDir ? path.join(saveDir, path.basename(o.defaultPath || 'out')) : null));

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    // Offscreen rendering paints every frame without showing a window on the desktop.
    width: 1400, height: 880, show: false,
    webPreferences: { preload: path.join(root, 'preload.cjs'), contextIsolation: true, sandbox: false, offscreen: true },
  });
  let lastFrame = null;
  win.webContents.on('paint', (_e, _dirty, image) => { lastFrame = image; });
  win.webContents.setFrameRate(30);
  win.webContents.on('console-message', (e) => {
    const { level, message, lineNumber, sourceId } = e;
    if (level === 'error' || level === 3) errors.push(`${message} (${sourceId}:${lineNumber})`);
  });
  win.webContents.on('preload-error', (_e, p, err) => errors.push(`preload: ${err}`));
  // --fresh: start from default settings (no saved panels, language or scheme).
  if (process.argv.includes('--fresh')) await win.webContents.session.clearStorageData({ storages: ['localstorage'] });
  await win.loadFile(path.join(root, 'src', 'index.html'));
  await new Promise(r => setTimeout(r, 600));
  if (programPath) {
    win.webContents.send('file:open-path', path.resolve(programPath));
    const name = path.basename(programPath);
    for (let i = 0; i < 50 && !(await win.webContents.executeJavaScript('document.title')).includes(name); i++) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  await new Promise(r => setTimeout(r, 300));
  // A script may return { crop: { x, y, width, height } } to save only part of the window.
  let crop = null;
  if (scriptPath) {
    try {
      const result = await win.webContents.executeJavaScript(fs.readFileSync(scriptPath, 'utf8'));
      if (result && result.crop) crop = result.crop;
      if (result && result.cropSelector) {
        global.cropSelector = result.cropSelector;
        global.cropPad = result.cropPad ?? 16;
      }
      if (result !== undefined) console.log('SCRIPT:', typeof result === 'string' ? result : JSON.stringify(result));
    } catch (e) {
      errors.push(`script: ${e.message}`);
    }
  }
  for (const id of commandsArg.split(',').filter(Boolean)) {
    win.webContents.send('menu:command', id);
    await new Promise(r => setTimeout(r, 700));
  }
  // cropSelector: the area is measured after the menu commands ran (e.g. a dialog they opened).
  if (global.cropSelector) {
    crop = await win.webContents.executeJavaScript(`(() => {
      const r = document.querySelector(${JSON.stringify(global.cropSelector)}).getBoundingClientRect();
      const p = ${global.cropPad};
      return { x: r.left - p, y: r.top - p, width: r.width + 2 * p, height: r.height + 2 * p };
    })()`);
  }
  win.webContents.invalidate();
  await new Promise(r => setTimeout(r, 600));
  let img = lastFrame || await win.webContents.capturePage();
  if (crop) {
    const size = img.getSize();
    const x = Math.max(0, Math.round(crop.x)), y = Math.max(0, Math.round(crop.y));
    img = img.crop({ x, y, width: Math.min(size.width - x, Math.round(crop.width)), height: Math.min(size.height - y, Math.round(crop.height)) });
  }
  fs.writeFileSync(out, img.toPNG());
  console.log('MENU:', global.menuTemplate ? global.menuTemplate.map(m => m.label).join(' | ') : 'none');
  console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'NO ERRORS');
  app.exit(errors.length ? 1 : 0);
});
