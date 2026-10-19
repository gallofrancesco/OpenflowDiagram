// Electron main process: window, native menu, file dialogs.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');

let win = null;
let allowClose = false;
let pendingOpen = fileFromArgs(process.argv);

function fileFromArgs(argv) {
  return argv.slice(1).find(a => /\.fprg$/i.test(a) && fs.existsSync(a)) || null;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 800,
    minHeight: 500,
    title: 'Flusso',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#f5f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload needs Node's fs for the program's own file I/O shapes.
      sandbox: false,
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.on('close', e => {
    if (allowClose) return;
    e.preventDefault();
    win.webContents.send('app:close-request');
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Accelerators are shown in the menu but handled by the page, so text fields keep Ctrl+C/V/Z.
function toMenu(items) {
  return items.map(item => {
    const out = { ...item };
    delete out.id;
    if (item.accelerator) out.registerAccelerator = false;
    if (item.submenu) out.submenu = toMenu(item.submenu);
    else if (item.id) out.click = () => win && win.webContents.send('menu:command', item.id);
    return out;
  });
}

ipcMain.on('menu:set', (_e, template) => {
  const items = toMenu(template);
  // macOS shows the first menu under the application's name: give it the standard app menu.
  if (process.platform === 'darwin') items.unshift({ role: 'appMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(items));
});

// macOS delivers files opened from the Finder (or dropped on the Dock icon) through this event.
app.on('open-file', (e, file) => {
  e.preventDefault();
  if (win && !pendingOpen) win.webContents.send('file:open-path', file);
  else pendingOpen = file;
});

ipcMain.on('renderer:ready', () => {
  if (pendingOpen) {
    win.webContents.send('file:open-path', pendingOpen);
    pendingOpen = null;
  }
});

ipcMain.on('app:close-confirmed', () => {
  allowClose = true;
  win.close();
});

ipcMain.on('app:close-window', () => win && win.close());

// The getting-started guide opens in its own sandboxed window without access to Node.
let guideWin = null;
ipcMain.on('help:guide', () => {
  if (guideWin && !guideWin.isDestroyed()) {
    guideWin.focus();
    return;
  }
  guideWin = new BrowserWindow({
    width: 1240, height: 900, title: 'Flusso — Guida introduttiva', icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#f2f2f7', autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  guideWin.setMenu(null);
  guideWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  guideWin.loadFile(path.join(__dirname, 'src', 'docs', 'guida.html'));
});

ipcMain.handle('dialog:open', async (_e, { filters }) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [...filters, { name: '*', extensions: ['*'] }] });
  if (r.canceled || !r.filePaths.length) return null;
  const file = r.filePaths[0];
  return { path: file, text: fs.readFileSync(file, 'utf8') };
});

ipcMain.handle('dialog:save', async (_e, { defaultPath, filters }) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.isAbsolute(defaultPath || '') ? defaultPath : path.join(app.getPath('documents'), defaultPath || ''),
    filters,
  });
  return r.canceled ? null : r.filePath;
});

const single = app.requestSingleInstanceLock();
if (!single) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const file = fileFromArgs(argv);
    if (file) win.webContents.send('file:open-path', file);
  });
  app.whenReady().then(() => {
    // Always light: menus, file dialogs and scrollbars ignore the Windows dark theme.
    nativeTheme.themeSource = 'light';
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
