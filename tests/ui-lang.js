// Page script for ui-smoke.cjs: switch the UI language through the Settings dialog.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const target = localStorage.getItem('openflowdiagram.settings')?.includes('"lang":"en"') ? 'it' : 'en';
  window.openflowDiagram.onMenuCommand(() => {});
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }));
  await wait(150);
  const help = document.querySelector('.dialog')?.innerText.slice(0, 80);
  document.querySelector('.dialog .primary').click();
  const s = JSON.parse(localStorage.getItem('openflowdiagram.settings') || '{}');
  s.lang = target;
  localStorage.setItem('openflowdiagram.settings', JSON.stringify(s));
  setTimeout(() => location.reload(), 50);
  return { help, switchedTo: target };
})();
