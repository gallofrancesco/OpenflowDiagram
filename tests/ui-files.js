// Page script for ui-smoke.cjs (load a copy of examples/File.fprg): watch the file panel while stepping.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const snap = () => ({
    file: $('.file-bar select')?.value,
    state: $('.file-state')?.textContent,
    lines: [...document.querySelectorAll('.file-line')].map(l => `${l.classList.contains('done') ? '·' : ''}${l.classList.contains('next') ? '>' : ''}${l.querySelector('.src').textContent.replace('​', '')}`).join(' '),
  });
  const report = {};
  const btn = $('[data-toggle-panel=files]');
  if (!btn.classList.contains('on')) btn.click();
  await wait(200);
  report.beforeRun = snap();

  // Step until the program is writing, then until it is reading.
  const steps = [];
  for (let i = 0; i < 40; i++) {
    $('[data-cmd=step]').click();
    await wait(90);
    const s = snap();
    if (!steps.length || steps[steps.length - 1].state !== s.state || steps[steps.length - 1].lines !== s.lines) steps.push(s);
  }
  report.steps = steps;
  // Finish and show the file on disk.
  const sp = $('#speed'); sp.value = 'full'; sp.dispatchEvent(new Event('change'));
  $('[data-cmd=run]').click();
  for (let i = 0; i < 50 && !$('[data-cmd=run]:not([disabled])'); i++) await wait(100);
  await wait(200);
  report.after = snap();
  return report;
})();
