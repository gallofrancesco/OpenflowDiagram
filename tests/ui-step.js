// Page script for ui-smoke.cjs (load examples/Ordinamento.fprg): open the code window and step through.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const codeHiddenAtStart = $('#code-window').hidden;
  if (codeHiddenAtStart) $('[data-cmd=toggleCode]').click();
  await wait(150);
  const lang = $('#code-window select');
  lang.value = 'c';
  lang.dispatchEvent(new Event('change'));
  const trace = [];
  for (let i = 0; i < 8; i++) {
    $('[data-cmd=step]').click();
    await wait(120);
    trace.push({
      shape: [...document.querySelectorAll('#chart .shape')].filter(s => s.getAttribute('stroke-width') === '3.5').map(s => s.textContent).join(),
      code: [...document.querySelectorAll('#code-window .code-line.hl .src')].map(l => l.textContent.replace('​', '').trim()).join(' | '),
    });
  }
  return {
    codeHiddenAtStart,
    trace,
    vars: $('.vars').innerText.replace(/\n+/g, ' '),
    stepEnabled: !$('[data-cmd=step]').disabled,
  };
})();
