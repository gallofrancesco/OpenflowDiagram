// Generates the screenshots for the user guide by driving the real UI (tests/ui-smoke.cjs).
// Usage: node tools/screenshots.mjs [name...]   → src/docs/img/<name>.png and src/docs/img/meta.json
import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src', 'docs', 'img');
const electron = join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const ex = name => join(root, 'examples', `${name}.fprg`);
mkdirSync(outDir, { recursive: true });
const tempCopy = name => {
  const dir = join(tmpdir(), 'openflowdiagram-shots');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.fprg`);
  copyFileSync(ex(name), file);
  return file;
};

/* Helpers available to every scenario (they run inside the page). */
const LIB = String.raw`
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const click = (el, x = 300, y = 300) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
const dbl = el => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
const type = (el, text) => { el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); };
const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; };
const pad = (r, p = 14) => ({ x: r.x - p, y: r.y - p, width: r.width + 2 * p, height: r.height + 2 * p });
const union = (...rs) => {
  const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
  return { x, y, width: Math.max(...rs.map(r => r.x + r.width)) - x, height: Math.max(...rs.map(r => r.y + r.height)) - y };
};
// The part of the chart picture that is actually on screen (tall charts scroll).
const chartBox = () => {
  const a = box($('#chart svg')), b = box($('#chart-scroll'));
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return { x, y, width: Math.min(a.x + a.width, b.x + b.width) - x, height: Math.min(a.y + a.height, b.y + b.height) - y };
};
const shape = text => $$('#chart .shape').find(s => s.textContent.trim().startsWith(text));
const setSpeed = v => { const s = $('#speed'); s.value = v; s.dispatchEvent(new Event('change')); };
const idle = async () => { for (let i = 0; i < 100 && !$('[data-cmd=run]:not([disabled])'); i++) await wait(100); await wait(250); };
const run = async () => { click($('[data-cmd=run]')); await idle(); };
const step = async n => { for (let i = 0; i < n; i++) { click($('[data-cmd=step]')); await wait(140); } };
const openInsert = async (which = 'last') => {
  const gaps = $$('#chart .gap');
  const g = which === 'last' ? gaps[gaps.length - 1] : gaps[which];
  const r = g.getBoundingClientRect();
  g.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.right + 30, clientY: r.top - 10 }));
  await wait(220);
};
const insert = async (kind, fill, where = 'last') => {
  await openInsert(where);
  click($('.insert-btn[data-kind="' + kind + '"]'));
  await wait(220);
  if (fill) fill($$('.dialog input[type=text]'));
};
const ok = async () => { $('.dialog .primary').click(); await wait(220); };
const buildTutorial = async () => {
  await insert('declare', i => type(i[0], 'nome'));
  const sel = $('.dialog select'); sel.value = 'String'; sel.dispatchEvent(new Event('change'));
  await ok();
  await insert('output', i => type(i[0], '"Come ti chiami?"')); await ok();
  await insert('input', i => type(i[0], 'nome')); await ok();
  await insert('output', i => type(i[0], '"Ciao, " & nome & "!"')); await ok();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); // deselect
  await wait(150);
};
const toggleCode = async on => {
  const b = $('[data-cmd=toggleCode]');
  if (b.classList.contains('on') !== on) { click(b); await wait(200); }
};
const answer = async text => {
  for (let i = 0; i < 60 && $('.console-input').disabled; i++) await wait(100);
  $('.console-input').value = text;
  $('.console-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(250);
};
`;

const FULL = null; // whole window

/* Scenarios: name → { program, commands, script (runs in the page; may return { crop, ... }) } */
const SCENARIOS = {
  overview: {
    program: ex('Fattoriale'),
    script: async () => {
      setSpeed('full');
      await run();
      const r = sel => box($(sel));
      return {
        areas: {
          toolbar: r('#toolbar'), file: r('.tool-group'), run: box($('[data-cmd=run]').parentElement), speed: r('#speed'),
          funcs: r('#func-select'), tabs: r('#view-tabs'), chart: r('#chart-scroll'), console: r('.panel[data-panel=console]'),
          vars: r('.panel[data-panel=variables]'), trace: r('[data-cmd=traceTable]'), code: r('[data-cmd=toggleCode]'),
        },
        window: { width: innerWidth, height: innerHeight },
      };
    },
  },
  'tutorial-insert': {
    script: async () => {
      await openInsert(0);
      return { crop: pad(union(box($('#popup')), box($('#chart svg'))), 16) };
    },
  },
  'tutorial-declare': {
    script: async () => {
      await insert('declare', i => type(i[0], 'nome'));
      const sel = $('.dialog select'); sel.value = 'String'; sel.dispatchEvent(new Event('change'));
      await wait(100);
      return { crop: pad(box($('.dialog')), 18) };
    },
  },
  'tutorial-output': {
    script: async () => {
      await insert('declare', i => type(i[0], 'nome'));
      const sel = $('.dialog select'); sel.value = 'String'; sel.dispatchEvent(new Event('change'));
      await ok();
      await insert('output', i => type(i[0], '"Come ti chiami?"'));
      return { crop: pad(box($('.dialog')), 18) };
    },
  },
  'tutorial-chart': {
    script: async () => {
      await buildTutorial();
      return { crop: chartBox() };
    },
  },
  'tutorial-run': {
    script: async () => {
      await buildTutorial();
      setSpeed('fast');
      click($('[data-cmd=run]'));
      await answer('Ada');
      await idle();
      return { crop: union(box($('#chart-pane')), box($('#side'))) };
    },
  },
  'tutorial-waiting': {
    script: async () => {
      await buildTutorial();
      setSpeed('fast');
      click($('[data-cmd=run]'));
      for (let i = 0; i < 60 && $('.console-input').disabled; i++) await wait(100);
      $('.console-input').value = 'Ada';
      await wait(150);
      return { crop: pad(box($('.panel[data-panel=console]')), 8) };
    },
  },
  shapes: {
    program: ex('Cicli'),
    script: async () => {
      click($('[data-cmd=zoomOut]'));
      click($('[data-cmd=zoomOut]'));
      await wait(200);
      return { crop: chartBox() };
    },
  },
  step: {
    program: ex('Ordinamento'),
    script: async () => {
      await toggleCode(true);
      await step(9);
      return {};
    },
  },
  breakpoint: {
    program: ex('Cicli'),
    script: async () => {
      setSpeed('full');
      await run();
      $('#chart-scroll').scrollTop = 99999;
      await wait(200);
      return {};
    },
  },
  error: {
    program: ex('Cicli'),
    script: async () => {
      dbl(shape('n = 27'));
      await wait(200);
      type($$('.dialog input[type=text]')[1], '27 / 0');
      await ok();
      setSpeed('full');
      click($('[data-cmd=run]'));
      for (let i = 0; i < 40 && !$('.dialog'); i++) await wait(100);
      await wait(200);
      return {};
    },
  },
  'functions-manager': {
    program: ex('Ordinamento'),
    script: async () => {
      click($('[data-cmd=manageFunctions]'));
      await wait(250);
      return { crop: pad(box($('.dialog')), 18) };
    },
  },
  'function-edit': {
    program: ex('Ordinamento'),
    script: async () => {
      const s = $('#func-select'); s.value = '2'; s.dispatchEvent(new Event('change'));
      await wait(200);
      dbl($('#chart .shape[data-terminal=start]'));
      await wait(250);
      return { crop: pad(box($('.dialog')), 18) };
    },
  },
  'function-chart': {
    program: ex('Ordinamento'),
    script: async () => {
      const s = $('#func-select'); s.value = '2'; s.dispatchEvent(new Event('change'));
      await wait(250);
      return { crop: chartBox() };
    },
  },
  'variables-stack': {
    program: ex('Ordinamento'),
    script: async () => {
      [...document.querySelectorAll('.panel[data-panel=variables] button')].find(b => b.textContent.includes('stack')).click();
      await step(19);
      return { crop: pad(box($('.panel[data-panel=variables]')), 6) };
    },
  },
  'code-window': {
    program: ex('Fattoriale'),
    script: async () => {
      await toggleCode(true);
      const s = $('#code-window select'); s.value = 'python'; s.dispatchEvent(new Event('change'));
      await wait(250);
      return { crop: pad(box($('#code-window')), 14) };
    },
  },
  'code-java': {
    program: ex('Fattoriale'),
    script: async () => {
      await toggleCode(true);
      const s = $('#code-window select'); s.value = 'java'; s.dispatchEvent(new Event('change'));
      await wait(250);
      return { crop: pad(box($('#code-window')), 14) };
    },
  },
  'trace-setup': {
    program: ex('Fattoriale'),
    script: async () => {
      click($('[data-cmd=traceTable]'));
      await wait(250);
      $$('.trace-var input')[3].click();
      [...document.querySelectorAll('.dialog button')].find(b => b.textContent.includes('+')).click();
      await wait(100);
      type($('.dialog .param-row input'), 'i % 2 == 0');
      await wait(100);
      return { crop: pad(box($('.dialog')), 18) };
    },
  },
  'trace-table': {
    program: ex('Fattoriale'),
    script: async () => {
      click($('[data-cmd=traceTable]'));
      await wait(250);
      $$('.trace-var input')[3].click();
      [...document.querySelectorAll('.dialog button')].find(b => b.textContent.includes('+')).click();
      await wait(100);
      type($('.dialog .param-row input'), 'i % 2 == 0');
      await ok();
      setSpeed('full');
      await run();
      $('#trace-scroll').scrollTop = 0;
      await wait(200);
      return { crop: pad(box($('#chart-pane')), 4) };
    },
  },
  'trace-step': {
    program: ex('Fattoriale'),
    script: async () => {
      click($('[data-cmd=traceTable]'));
      await wait(250);
      await ok();
      await step(9);
      return { crop: pad(box($('#chart-pane')), 4) };
    },
  },
  settings: {
    commands: ['settings'],
    script: async () => ({ cropSelector: '.dialog' }),
  },
  'style-classic': {
    program: ex('Cicli'),
    commands: ['scheme_vibrant', 'style_classic', 'zoomOut', 'zoomOut'],
    script: async () => ({ cropSelector: '#chart-scroll', cropPad: 0 }),
  },
  files: {
    // A copy in a temp folder: the program writes its data file next to the .fprg it was opened from.
    program: tempCopy('File'),
    script: async () => {
      setSpeed('full');
      await run();
      return { crop: union(box($('#chart-pane')), box($('#side'))) };
    },
  },
};

const only = process.argv.slice(2);
const meta = existsSync(join(outDir, 'meta.json')) ? JSON.parse(readFileSync(join(outDir, 'meta.json'), 'utf8')) : {};
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let failures = 0;

for (const [name, sc] of Object.entries(SCENARIOS)) {
  if (only.length && !only.includes(name)) continue;
  const scriptFile = join(tmpdir(), `openflowdiagram-shot-${name}.js`);
  writeFileSync(scriptFile, `(async () => {\n${LIB}\nreturn await (${sc.script.toString()})();\n})();`);
  const args = [join(root, 'tests', 'ui-smoke.cjs'), join(outDir, `${name}.png`), sc.program || '', scriptFile, '--fresh'];
  if (sc.commands) args.push(`--commands=${sc.commands.join(',')}`);
  const r = spawnSync(electron, args, { env, encoding: 'utf8', timeout: 120000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = /NO ERRORS/.test(out);
  if (!ok) failures++;
  const line = out.split('\n').find(l => l.startsWith('SCRIPT:'));
  if (line) {
    const data = JSON.parse(line.slice(8));
    if (data.areas) meta[name] = data;
  }
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n${out.split('\n').filter(l => /ERROR|script|Error/.test(l)).join('\n')}`}`);
}
writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
process.exit(failures ? 1 : 0);
