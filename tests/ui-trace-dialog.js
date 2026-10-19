// Page script for ui-smoke.cjs: leave the trace setup dialog open for a screenshot.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('[data-cmd=traceTable]').click();
  await wait(200);
  [...document.querySelectorAll('.dialog button')].find(b => b.textContent.includes('+')).click();
  await wait(80);
  const input = document.querySelector('.dialog .param-row input');
  input.value = 'n - i';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return document.querySelectorAll('.trace-var').length;
})();
