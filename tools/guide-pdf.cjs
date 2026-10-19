// `electron tools/guide-pdf.cjs [preview-dir]`: prints src/docs/guida.html to docs/Flusso - Guida introduttiva.pdf.
// With preview-dir, also saves screenshots of the guide at a few scroll positions (for review).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const previewDir = process.argv.slice(2).find(a => !a.startsWith('--'));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1320, height: 1000, show: false, webPreferences: { offscreen: true, sandbox: true } });
  let frame = null;
  win.webContents.on('paint', (_e, _d, img) => { frame = img; });
  await win.loadFile(path.join(root, 'src', 'docs', 'guida.html'));
  await new Promise(r => setTimeout(r, 1200));
  if (previewDir) {
    const height = await win.webContents.executeJavaScript('document.documentElement.scrollHeight');
    const shots = Math.min(40, Math.ceil(height / 1000));
    for (let i = 0; i < shots; i++) {
      await win.webContents.executeJavaScript(`window.scrollTo(0, ${i * 1000})`);
      win.webContents.invalidate();
      await new Promise(r => setTimeout(r, 400));
      fs.writeFileSync(path.join(previewDir, `guide-${String(i).padStart(2, '0')}.png`), frame.toPNG());
    }
    console.log(`preview: ${shots} pages, height ${height}px`);
  }
  const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'default' } });
  const out = path.join(root, 'docs', 'Flusso - Guida introduttiva.pdf');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, pdf);
  console.log(`pdf: ${out} (${Math.round(pdf.length / 1024)} KB)`);
  app.exit(0);
});
