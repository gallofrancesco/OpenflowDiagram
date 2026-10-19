// Page script for ui-smoke.cjs: open the insert menu on the first arrow and leave it on screen.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const code = document.querySelector('[data-cmd=toggleCode]');
  if (code.classList.contains('on')) code.click();
  const gap = document.querySelectorAll('#chart .gap')[3];
  const r = gap.getBoundingClientRect();
  gap.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.right + 20, clientY: r.top }));
  await wait(200);
  return {
    titles: [...document.querySelectorAll('.insert-title')].map(e => e.textContent),
    tiles: [...document.querySelectorAll('.insert-btn')].map(b => `${b.dataset.kind}:${b.querySelector('svg polygon, svg rect, svg path') ? 'shape' : 'none'}`),
  };
})();
