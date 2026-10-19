// Page script for ui-smoke.cjs (load examples/Ordinamento.fprg): show a function and open its editor.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const sel = document.querySelector('#func-select');
  sel.value = '1';
  sel.dispatchEvent(new Event('change'));
  await wait(150);
  document.querySelector('#chart .shape[data-terminal=start]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  await wait(200);
  return { dialog: document.querySelector('.dialog')?.innerText.replace(/\n+/g, ' | ') };
})();
