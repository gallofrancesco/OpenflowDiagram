// Page script for ui-smoke.cjs: runs the loaded program at full speed and reports what the panels show.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const speed = document.querySelector('#speed');
  speed.value = 'full';
  speed.dispatchEvent(new Event('change'));
  for (const k of ['console', 'variables']) {
    const b = document.querySelector(`[data-toggle-panel=${k}]`);
    if (!b.classList.contains('on')) b.click();
  }
  const codeBtn = document.querySelector('[data-cmd=toggleCode]');
  const codeHiddenAtStart = document.querySelector('#code-window').hidden;
  if (!codeBtn.classList.contains('on')) codeBtn.click();
  document.querySelector('[data-cmd=run]').click();
  for (let i = 0; i < 50 && !document.querySelector('[data-cmd=run]:not([disabled])'); i++) await wait(100);
  await wait(300);
  return {
    console: [...document.querySelectorAll('.console-list .msg')].map(m => m.textContent),
    vars: document.querySelector('.vars')?.innerText.slice(0, 300),
    codeLines: document.querySelectorAll('.code-line').length,
    codeHiddenAtStart,
    codeVisible: !document.querySelector('#code-window').hidden,
    title: document.title,
  };
})();
