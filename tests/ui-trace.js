// Page script for ui-smoke.cjs (load examples/Fattoriale.fprg): set up the trace table and step through it.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const report = {};
  if ($('[data-cmd=toggleCode]').classList.contains('on')) $('[data-cmd=toggleCode]').click();

  // Opening the tab asks what to trace: keep Main's variables, add a condition and a Fact variable.
  $('[data-cmd=traceTable]').click();
  await wait(200);
  report.dialogTitle = $('.dialog-title')?.textContent;
  report.preselected = [...document.querySelectorAll('.trace-var input')].map(b => b.checked);
  document.querySelectorAll('.trace-var input')[3].click(); // Fact: r
  [...document.querySelectorAll('.dialog button')].find(b => b.textContent.includes('+')).click();
  await wait(80);
  const exprInput = document.querySelector('.dialog .param-row input');
  exprInput.value = 'i % 2 == 0';
  exprInput.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('.dialog .primary').click();
  await wait(150);
  report.emptyText = $('#trace-scroll').innerText;

  // Step: rows appear one by one.
  const counts = [];
  for (let i = 0; i < 6; i++) {
    $('[data-cmd=step]').click();
    await wait(150);
    counts.push(document.querySelectorAll('.trace-table tbody tr').length);
  }
  report.rowsWhileStepping = counts;

  // Finish at full speed.
  const speed = $('#speed');
  speed.value = 'full';
  speed.dispatchEvent(new Event('change'));
  $('[data-cmd=run]').click();
  for (let i = 0; i < 50 && !$('[data-cmd=run]:not([disabled])'); i++) await wait(100);
  await wait(300);
  report.headers = [...document.querySelectorAll('.trace-table th')].map(th => th.textContent);
  report.rows = document.querySelectorAll('.trace-table tbody tr').length;
  report.firstRows = [...document.querySelectorAll('.trace-table tbody tr')].slice(0, 4).map(tr => [...tr.cells].map(c => c.textContent).join(' | '));
  report.count = $('#trace-count').textContent;
  report.exportEnabled = !$('#trace-export').disabled;
  // Export through the real button (the test harness answers the save dialog).
  $('#trace-export').click();
  await wait(800);
  document.querySelector('#trace-scroll').scrollTop = 600;
  return report;
})();
