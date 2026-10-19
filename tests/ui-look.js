// Page script for ui-smoke.cjs: run to the end with the code window closed, so the screenshot shows the main look.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  if ($('[data-cmd=toggleCode]').classList.contains('on')) $('[data-cmd=toggleCode]').click();
  const speed = $('#speed');
  speed.value = 'full';
  speed.dispatchEvent(new Event('change'));
  $('[data-cmd=run]').click();
  for (let i = 0; i < 50 && !$('[data-cmd=run]:not([disabled])'); i++) await wait(100);
  return document.querySelectorAll('.badge').length;
})();
