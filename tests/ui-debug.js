// Page script for ui-smoke.cjs (load examples/Cicli.fprg): breakpoint, stepping, language switch, error dialog.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 300 }));
  const report = {};
  const speed = $('#speed');
  speed.value = 'full';
  speed.dispatchEvent(new Event('change'));

  // The program ends with a breakpoint: running stops there in paused state.
  click($('[data-cmd=run]'));
  for (let i = 0; i < 50 && !$('[data-cmd=run]:not([disabled])'); i++) await wait(100);
  report.status = $('#status-text').textContent;
  report.stopEnabled = !$('[data-cmd=stop]').disabled;
  report.highlighted = $('#chart .shape[data-key] polygon[points]') ? [...document.querySelectorAll('#chart .shape')].filter(s => s.getAttribute('stroke-width') === '3.5').map(s => s.textContent) : [];
  click($('[data-cmd=run]'));
  await wait(400);
  report.afterContinue = [...document.querySelectorAll('.console-list .msg')].slice(-2).map(m => m.textContent);

  // Step mode: each click advances one shape.
  click($('[data-cmd=step]'));
  await wait(100);
  const steps = [];
  for (let i = 0; i < 4; i++) {
    click($('[data-cmd=step]'));
    await wait(80);
    steps.push([...document.querySelectorAll('#chart .shape')].filter(s => s.getAttribute('stroke-width') === '3.5').map(s => s.textContent).join());
  }
  report.steps = steps;
  click($('[data-cmd=stop]'));
  await wait(100);

  // Language switch in the code panel.
  const codeBtn = $('[data-cmd=toggleCode]');
  if (!codeBtn.classList.contains('on')) codeBtn.click();
  await wait(100);
  const sel = document.querySelector('#code-window select');
  const firstLines = {};
  for (const lang of ['c', 'cpp', 'java', 'python']) {
    sel.value = lang;
    sel.dispatchEvent(new Event('change'));
    await wait(120);
    firstLines[lang] = [...document.querySelectorAll('.code-line .src')].map(l => l.textContent.replace('​', '')).find(t => /while|for/.test(t));
  }
  report.loopLine = firstLines;
  report.languages = [...sel.options].map(o => o.textContent);

  // Runtime error: edit the first assignment to divide by zero.
  const assign = [...document.querySelectorAll('#chart .shape')].find(s => s.textContent.startsWith('n = 27'));
  assign.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  await wait(150);
  const exprInput = document.querySelectorAll('.dialog input[type=text]')[1];
  exprInput.value = '27 / 0';
  document.querySelector('.dialog .primary').click();
  await wait(150);
  click($('[data-cmd=run]'));
  for (let i = 0; i < 30 && !document.querySelector('.dialog'); i++) await wait(100);
  report.errorDialog = document.querySelector('.dialog')?.innerText;
  report.errorShape = [...document.querySelectorAll('#chart .shape')].filter(s => ['#e02424', '#ff3b30'].includes(s.getAttribute('stroke'))).map(s => s.textContent);
  return report;
})();
