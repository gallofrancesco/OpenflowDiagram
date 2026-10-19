// Page script for ui-smoke.cjs: inserts shapes through the UI, then runs a program that asks for input.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }));
  const type = (el, text) => { el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const report = {};

  // New program, then insert Declare, Input and Output via the arrows.
  click($('[data-cmd=new]'));
  await wait(200);
  const insert = async (kind, fill) => {
    const gaps = document.querySelectorAll('#chart .gap');
    click(gaps[gaps.length - 1]);
    await wait(100);
    const btn = document.querySelector(`.insert-btn[data-kind="${kind}"]`);
    btn.click();
    await wait(150);
    const inputs = document.querySelectorAll('.dialog input[type=text]');
    fill(inputs);
    document.querySelector('.dialog .primary').click();
    await wait(150);
    return document.querySelector('.dialog-error')?.textContent || '';
  };
  report.declareError = await insert('declare', i => type(i[0], 'nome'));
  // The Declare dialog keeps Integer as default; switch it to String.
  report.shapesAfterDeclare = document.querySelectorAll('#chart .shape').length;
  const declareShape = [...document.querySelectorAll('#chart .shape')].find(s => s.textContent.includes('nome'));
  declareShape.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  await wait(150);
  const sel = document.querySelector('.dialog select');
  sel.value = 'String';
  document.querySelector('.dialog .primary').click();
  await wait(150);
  report.inputError = await insert('input', i => type(i[0], 'nome'));
  report.outputError = await insert('output', i => type(i[0], '"Ciao, " & nome & "!"'));
  report.badSyntax = await insert('assign', i => { type(i[0], 'x'); type(i[1], '1 +'); });
  if (document.querySelector('.dialog')) {
    // Invalid expression keeps the dialog open; cancel it (the empty shape stays, like the original).
    [...document.querySelectorAll('.dialog button')].find(b => !b.classList.contains('primary')).click();
    await wait(100);
  }
  report.captions = [...document.querySelectorAll('#chart .shape')].map(s => s.textContent);
  report.codeHasCin = [...document.querySelectorAll('.code-line')].some(l => l.textContent.includes('cin >> nome'));

  // Undo removes the incomplete Assign.
  click($('[data-cmd=undo]'));
  await wait(150);
  report.afterUndo = document.querySelectorAll('#chart .shape').length;

  // Run: the program waits for input, we answer through the console box.
  const speed = $('#speed');
  speed.value = 'fast';
  speed.dispatchEvent(new Event('change'));
  click($('[data-cmd=run]'));
  for (let i = 0; i < 40 && $('.console-input').disabled; i++) await wait(100);
  report.inputEnabled = !$('.console-input').disabled;
  report.prompt = $('.console-input').placeholder;
  $('.console-input').value = 'Grace';
  $('.console-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  for (let i = 0; i < 40 && $('[data-cmd=stop]:not([disabled])'); i++) await wait(100);
  await wait(200);
  report.console = [...document.querySelectorAll('.console-list .msg')].map(m => m.textContent);
  return report;
})();
