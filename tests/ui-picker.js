// Page script for ui-smoke.cjs (load examples/Ordinamento.fprg): insert functions with the ƒ(x) picker.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const report = {};
  const shape = text => [...document.querySelectorAll('#chart .shape')].find(s => s.textContent.trim().startsWith(text));

  // Edit "v[0] = 42": type "1 + " then pick Sqrt from the list.
  shape('v[0] = 42').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  await wait(200);
  report.buttons = document.querySelectorAll('.dialog .fn-button').length;
  const input = document.querySelectorAll('.dialog input[type=text]')[1];
  input.value = '1 + ';
  input.setSelectionRange(4, 4);
  $('.dialog .fn-button').click();
  await wait(150);
  report.groups = [...document.querySelectorAll('.fn-group-title')].map(g => g.textContent);
  report.userFunctions = [...document.querySelectorAll('.fn-group')].find(g => g.textContent.startsWith('Le tue'))?.querySelectorAll('.fn-item').length;
  [...document.querySelectorAll('.fn-item')].find(b => b.textContent.startsWith('Sqrt(x)')).click();
  await wait(100);
  report.afterSqrt = { value: input.value, caret: input.selectionStart };
  // Type the argument where the caret is, then use search + Enter to add Abs.
  input.setRangeText('16', input.selectionStart, input.selectionStart, 'end');
  input.value += ' * ';
  input.setSelectionRange(input.value.length, input.value.length);
  $('.dialog .fn-button').click();
  await wait(150);
  const search = $('.fn-search');
  search.value = 'assol';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  report.searchResults = [...document.querySelectorAll('.fn-item code')].map(c => c.textContent);
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(100);
  report.afterAbs = input.value;
  report.dialogStillOpen = !!$('.dialog');
  // Esc closes only the list.
  $('.dialog .fn-button').click();
  await wait(100);
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(100);
  report.escClosesOnlyList = !$('.fn-picker') && !!$('.dialog');
  $('.dialog .fn-button').click();
  await wait(150);
  const r = $('.fn-picker').getBoundingClientRect(), d = $('.dialog').getBoundingClientRect();
  report.crop = { x: Math.min(r.left, d.left) - 16, y: Math.min(r.top, d.top) - 16, width: Math.max(r.right, d.right) - Math.min(r.left, d.left) + 32, height: Math.max(r.bottom, d.bottom) - Math.min(r.top, d.top) + 32 };
  return report;
})();
