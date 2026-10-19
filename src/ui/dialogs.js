// Modal dialogs: generic helpers plus the editors for shapes, functions and settings.
import { t, LANGUAGES } from '../core/i18n.js';
import { TYPES, RETURN_TYPES } from '../core/model.js';
import { parseExpression, FlowError, isValidIdentifier, splitNames } from '../core/expr.js';
import { COLOR_SCHEMES, CHART_STYLES } from './schemes.js';
import { GENERATORS } from '../core/codegen/index.js';
import { traceableVariables, checkTraceExpression } from '../core/trace.js';

export const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
};

let openCount = 0;
export const isModalOpen = () => openCount > 0;

/*
 Opens a modal. `validate` may return an error string to keep it open.
 Resolves with the clicked button's value (or null when cancelled).
*/
export function modal({ title, body, buttons = [{ label: t('ok'), value: 'ok', primary: true }, { label: t('cancel'), value: null }], validate, wide = false, bind }) {
  return new Promise(resolve => {
    openCount++;
    const error = h('div', { class: 'dialog-error', role: 'alert' });
    const footer = h('div', { class: 'dialog-buttons' });
    const box = h('div', { class: `dialog${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'dialog-title' }, title),
      h('div', { class: 'dialog-body' }, body),
      error,
      footer);
    const overlay = h('div', { class: 'overlay' }, box);
    const close = value => {
      overlay.remove();
      openCount--;
      document.removeEventListener('keydown', onKey, true);
      resolve(value);
    };
    const attempt = value => {
      if (value !== null && validate) {
        const msg = validate(value);
        if (msg) {
          error.textContent = msg;
          return;
        }
      }
      close(value);
    };
    for (const b of buttons) {
      footer.append(h('button', { class: b.primary ? 'primary' : '', onclick: () => attempt(b.value) }, b.label));
    }
    const onKey = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(null);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        e.stopPropagation();
        const primary = buttons.find(b => b.primary);
        if (primary) attempt(primary.value);
      }
    };
    document.addEventListener('keydown', onKey, true);
    // Lets content inside the body close the dialog with its own result.
    bind?.(close);
    document.body.append(overlay);
    const first = box.querySelector('input:not([type=checkbox]):not([type=radio]), textarea, select');
    (first || footer.querySelector('button')).focus();
    if (first && first.select) first.select();
  });
}

export const alertBox = (title, message) => modal({ title, body: h('p', {}, message), buttons: [{ label: t('ok'), value: 'ok', primary: true }] });

export const confirmBox = (title, message, buttons) => modal({
  title, body: h('p', {}, message),
  buttons: buttons || [{ label: t('yes'), value: 'yes', primary: true }, { label: t('no'), value: 'no' }, { label: t('cancel'), value: null }],
});

// Groups of radios already contain labels, so they get a <div> instead.
// Expression inputs (data-picker) get the ƒ(x) button that inserts functions.
const field = (label, input, hint) => {
  if (input.dataset?.picker) {
    const button = h('button', { type: 'button', class: 'fn-button', title: t('fnPicker'), 'aria-label': t('fnPicker') }, 'ƒ(x)');
    button.addEventListener('click', () => openPicker(input, button, input.dataset.picker));
    return h('div', { class: 'field' }, h('span', {}, label), h('div', { class: 'expr-row' }, input, button), hint ? h('small', {}, hint) : null);
  }
  return h(['INPUT', 'SELECT', 'TEXTAREA'].includes(input.tagName) ? 'label' : 'div',
    { class: 'field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
};
const textInput = (value, props = {}) => h('input', { type: 'text', value: value ?? '', spellcheck: 'false', ...props });
const exprInput = (value, mode = 'all') => textInput(value, { 'data-picker': mode });

/* ---------- function picker (ƒ(x)) ---------- */

// Built-in functions by group: [name, arguments shown in the signature (null = constant, no parentheses)].
const FN_GROUPS = [
  ['fnGroupMath', [['Abs', 'x'], ['Sqrt', 'x'], ['Int', 'x'], ['Sgn', 'x'], ['Random', 'n'], ['Log', 'x'], ['Log10', 'x'],
    ['Sin', 'x'], ['Cos', 'x'], ['Tan', 'x'], ['ArcSin', 'x'], ['ArcCos', 'x'], ['ArcTan', 'x'], ['Pi', null]]],
  ['fnGroupText', [['Len', 's'], ['Char', 's, i'], ['ToCode', 's'], ['ToChar', 'n']]],
  ['fnGroupConv', [['ToInteger', 'x'], ['ToReal', 'x'], ['ToString', 'x'], ['ToFixed', 'x, d']]],
  ['fnGroupOther', [['Size', 'a'], ['EOF', '']]],
];

let pickerFunctions = [];   // the program's own functions, set by editStatement
let picker = null;

function closePicker() {
  if (!picker) return;
  picker.el.remove();
  window.removeEventListener('keydown', picker.onKey, true);
  document.removeEventListener('mousedown', picker.onDown, true);
  picker = null;
}

// mode 'all': built-ins and functions that return a value; mode 'call': only the program's functions.
function openPicker(input, anchor, mode) {
  closePicker();
  const items = [];
  if (mode !== 'call') {
    for (const [group, fns] of FN_GROUPS) {
      for (const [name, args] of fns) {
        items.push({
          group: t(group), sig: args === null ? name : `${name}(${args})`, desc: t(`fn_${name.toLowerCase()}`),
          text: args === null ? name : `${name}()`, back: args ? 1 : 0,
        });
      }
    }
  }
  for (const f of pickerFunctions) {
    if (mode !== 'call' && f.type === 'None') continue;
    items.push({
      group: t('fnGroupUser'),
      sig: `${f.name}(${f.params.map(p => `${p.type}${p.array ? '[]' : ''} ${p.name}`).join(', ')})`,
      desc: f.type === 'None' ? t('fnNoValue') : t('fnReturns', { type: f.type }),
      text: `${f.name}()`, back: f.params.length ? 1 : 0,
    });
  }

  const insert = item => {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.value = input.value.slice(0, start) + item.text + input.value.slice(end);
    const caret = start + item.text.length - item.back; // inside the parentheses when there are arguments
    closePicker();
    input.focus();
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const search = textInput('', { class: 'fn-search', placeholder: t('fnSearch'), 'aria-label': t('fnSearch') });
  const list = h('div', { class: 'fn-list', role: 'listbox' });
  let shown = [];
  const render = () => {
    const q = search.value.trim().toLowerCase();
    shown = items.filter(i => !q || i.sig.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
    const groups = [...new Set(shown.map(i => i.group))];
    list.replaceChildren(...(shown.length ? groups.map(g => h('div', { class: 'fn-group' },
      h('div', { class: 'fn-group-title' }, g),
      ...shown.filter(i => i.group === g).map(i => h('button', { type: 'button', class: 'fn-item', role: 'option', onclick: () => insert(i) },
        h('code', {}, i.sig), h('span', {}, i.desc))))) : [h('p', { class: 'muted fn-none' }, mode === 'call' && !items.length ? t('fnNoneDefined') : t('fnNoMatch'))]));
  };
  search.addEventListener('input', render);
  render();

  const el = h('div', { class: 'fn-picker', role: 'dialog', 'aria-label': t('fnPicker') }, search, list);
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  const pr = el.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(r.right - pr.width, window.innerWidth - pr.width - 8))}px`;
  el.style.top = `${r.bottom + 6 + pr.height > window.innerHeight ? Math.max(8, r.top - pr.height - 6) : r.bottom + 6}px`;
  search.focus();

  // Runs before the dialog's own key handler: Esc closes only the list, Enter inserts the first match.
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(); input.focus(); }
    else if (e.key === 'Enter' && e.target === search) { e.preventDefault(); e.stopPropagation(); if (shown[0]) insert(shown[0]); }
  };
  const onDown = e => { if (!el.contains(e.target) && e.target !== anchor) closePicker(); };
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onDown, true);
  picker = { el, onKey, onDown };
}
const select = (value, options) => h('select', {}, options.map(([v, label]) => {
  const o = h('option', { value: v }, label);
  if (v === value) o.selected = true;
  return o;
}));
const radio = (name, value, current, label) => h('label', { class: 'radio' },
  h('input', { type: 'radio', name, value, checked: value === current }), label);
const radioValue = (root, name) => root.querySelector(`input[name="${name}"]:checked`)?.value;

const typeOptions = () => TYPES.map(x => [x, x]);

function syntaxCheck(text, label) {
  if (!String(text).trim()) return null;
  try {
    parseExpression(text);
    return null;
  } catch (e) {
    const msg = e instanceof FlowError ? t(e.code, e.params) : e.message;
    return `${label}: ${msg}`;
  }
}

/* ---------- shape editors ---------- */

// Edits the statement in place; resolves true if something changed.
// context.functions: the program's functions, offered by the ƒ(x) picker.
export async function editStatement(s, context = {}) {
  pickerFunctions = context.functions || [];
  const body = h('div', { class: 'form' });
  let read = () => ({});
  let checks = () => [];
  switch (s.kind) {
    case 'declare': {
      const names = textInput(s.names);
      const type = select(s.type, typeOptions());
      const isArray = h('input', { type: 'checkbox', checked: s.array });
      const size = exprInput(s.size);
      const sizeField = field(t('arraySize'), size);
      const sync = () => { sizeField.style.display = isArray.checked ? '' : 'none'; };
      isArray.addEventListener('change', sync);
      sync();
      body.append(field(t('variableNames'), names), field(t('type'), type),
        h('label', { class: 'check' }, isArray, t('isArray')), sizeField);
      read = () => ({ names: names.value.trim(), type: type.value, array: isArray.checked, size: isArray.checked ? size.value.trim() : '' });
      checks = v => [
        ...splitNames(v.names).filter(n => !isValidIdentifier(n)).map(n => t('invalidName', { name: n })),
        v.array ? syntaxCheck(v.size, t('arraySize')) : null,
      ];
      break;
    }
    case 'assign': {
      const v = textInput(s.variable), e = exprInput(s.expression);
      body.append(field(t('variableName'), v), field(t('expression'), e));
      read = () => ({ variable: v.value.trim(), expression: e.value.trim() });
      checks = x => [syntaxCheck(x.variable, t('variableName')), syntaxCheck(x.expression, t('expression'))];
      break;
    }
    case 'input': case 'read': {
      const v = textInput(s.variable);
      body.append(field(t('variableName'), v));
      read = () => ({ variable: v.value.trim() });
      checks = x => [syntaxCheck(x.variable, t('variableName'))];
      break;
    }
    case 'output': {
      const e = exprInput(s.expression);
      const nl = h('input', { type: 'checkbox', checked: s.newline });
      // The same marker drawn in the chart (↵ new line, → same line), updated live.
      const mark = h('span', { class: 'nl-mark' });
      const hint = h('span', { class: 'muted' });
      const sync = () => {
        mark.textContent = nl.checked ? '↵' : '→';
        hint.textContent = nl.checked ? '' : `(${t('noNewline').toLowerCase()})`;
      };
      nl.addEventListener('change', sync);
      sync();
      body.append(field(t('expression'), e, '"Testo" & variabile'), h('label', { class: 'check' }, nl, t('newline'), mark, hint));
      read = () => ({ expression: e.value.trim(), newline: nl.checked });
      checks = x => [syntaxCheck(x.expression, t('expression'))];
      break;
    }
    case 'if': case 'while': case 'do': {
      const e = exprInput(s.expression);
      body.append(field(t('condition'), e));
      read = () => ({ expression: e.value.trim() });
      checks = x => [syntaxCheck(x.expression, t('condition'))];
      break;
    }
    case 'for': {
      const v = textInput(s.variable), a = exprInput(s.start), b = exprInput(s.end), st = exprInput(s.step || '1');
      const dir = h('div', { class: 'radios' }, radio('dir', 'inc', s.direction, t('increasing')), radio('dir', 'dec', s.direction, t('decreasing')));
      body.append(field(t('variableName'), v), h('div', { class: 'row' }, field(t('start_'), a), field(t('end_'), b)),
        field(t('direction'), dir), field(t('stepValue'), st));
      read = () => ({ variable: v.value.trim(), start: a.value.trim(), end: b.value.trim(), step: st.value.trim() || '1', direction: radioValue(body, 'dir') });
      checks = x => [syntaxCheck(x.variable, t('variableName')), syntaxCheck(x.start, t('start_')), syntaxCheck(x.end, t('end_')), syntaxCheck(x.step, t('stepValue'))];
      break;
    }
    case 'call': {
      const e = exprInput(s.expression, 'call');
      body.append(field(t('callText'), e));
      read = () => ({ expression: e.value.trim() });
      checks = x => [syntaxCheck(x.expression, t('callText'))];
      break;
    }
    case 'comment': {
      const e = h('textarea', { rows: 5 }, s.text);
      body.append(field(t('commentText'), e));
      read = () => ({ text: e.value });
      break;
    }
    case 'breakpoint': {
      const e = exprInput(s.expression);
      const mode = h('div', { class: 'radios vertical' }, radio('bp', 'always', s.always ? 'always' : 'cond', t('always')), radio('bp', 'cond', s.always ? 'always' : 'cond', t('conditional')));
      body.append(mode, field(t('condition'), e));
      read = () => ({ always: radioValue(body, 'bp') === 'always', expression: e.value.trim() });
      checks = x => [x.always ? null : syntaxCheck(x.expression, t('condition'))];
      break;
    }
    case 'open': {
      const e = exprInput(s.expression);
      const mode = h('div', { class: 'radios' }, radio('mode', 'read', s.mode, t('modeRead')), radio('mode', 'write', s.mode, t('modeWrite')));
      body.append(field(t('fileName'), e, '"dati.txt"'), field(t('mode'), mode));
      read = () => ({ expression: e.value.trim(), mode: radioValue(body, 'mode') });
      checks = x => [syntaxCheck(x.expression, t('fileName'))];
      break;
    }
    case 'write': {
      const e = exprInput(s.expression);
      body.append(field(t('expression'), e));
      read = () => ({ expression: e.value.trim() });
      checks = x => [syntaxCheck(x.expression, t('expression'))];
      break;
    }
    default:
      return false; // close has nothing to edit
  }
  const result = await modal({
    title: t(`shape_${s.kind}`),
    body,
    validate: () => checks(read()).find(Boolean) || null,
  });
  closePicker();
  if (result !== 'ok') return false;
  Object.assign(s, read());
  return true;
}

export const hasEditor = kind => kind !== 'close';

/* ---------- functions ---------- */

// Edits a function definition (name, return type, parameters). `others` are the other functions' names.
export async function editFunction(func, others, { isNew = false } = {}) {
  const name = textInput(func.name);
  const ret = select(func.type, RETURN_TYPES.map(x => [x, x === 'None' ? t('none') : x]));
  const retVar = textInput(func.variable);
  const retField = field(t('returnVariable'), retVar);
  const sync = () => { retField.style.display = ret.value === 'None' ? 'none' : ''; };
  ret.addEventListener('change', sync);
  sync();
  const params = func.params.map(p => ({ ...p }));
  const list = h('div', { class: 'param-list' });
  const renderParams = () => {
    list.replaceChildren(...params.map((p, i) => {
      const n = textInput(p.name, { 'aria-label': t('parameterName'), oninput: e => { p.name = e.target.value.trim(); } });
      const ty = select(p.type, typeOptions());
      ty.addEventListener('change', () => { p.type = ty.value; });
      const arr = h('input', { type: 'checkbox', checked: p.array, onchange: e => { p.array = e.target.checked; } });
      return h('div', { class: 'param-row' }, n, ty, h('label', { class: 'check' }, arr, t('isArray')),
        h('button', { title: t('moveUp'), onclick: () => { if (i > 0) { [params[i - 1], params[i]] = [params[i], params[i - 1]]; renderParams(); } } }, '↑'),
        h('button', { title: t('moveDown'), onclick: () => { if (i < params.length - 1) { [params[i + 1], params[i]] = [params[i], params[i + 1]]; renderParams(); } } }, '↓'),
        h('button', { title: t('remove'), onclick: () => { params.splice(i, 1); renderParams(); } }, '✕'));
    }));
  };
  renderParams();
  const addParam = h('button', { onclick: () => { params.push({ name: '', type: 'Integer', array: false }); renderParams(); list.querySelector('.param-row:last-child input')?.focus(); } }, `+ ${t('add')}`);
  const body = h('div', { class: 'form' },
    field(t('functionName'), name),
    h('div', { class: 'row' }, field(t('returnType'), ret), retField),
    h('div', { class: 'field' }, h('span', {}, t('parameters')), list, addParam));
  const result = await modal({
    title: isNew ? t('newFunction') : t('editFunction'),
    body, wide: true,
    validate: () => {
      const n = name.value.trim();
      if (!isValidIdentifier(n) || n.toLowerCase() === 'main') return t('invalidName', { name: n });
      if (others.some(o => o.toLowerCase() === n.toLowerCase())) return t('duplicateName', { name: n });
      if (ret.value !== 'None' && !isValidIdentifier(retVar.value.trim())) return t('invalidName', { name: retVar.value.trim() });
      const seen = new Set();
      for (const p of params) {
        if (!isValidIdentifier(p.name)) return t('invalidName', { name: p.name });
        if (seen.has(p.name.toLowerCase())) return t('errDuplicateDefinition', { name: p.name });
        seen.add(p.name.toLowerCase());
      }
      return null;
    },
  });
  if (result !== 'ok') return false;
  func.name = name.value.trim();
  func.type = ret.value;
  func.variable = ret.value === 'None' ? '' : retVar.value.trim();
  func.params = params;
  return true;
}

export async function editAttributes(attrs) {
  const name = textInput(attrs.name), authors = textInput(attrs.authors);
  const about = h('textarea', { rows: 5 }, attrs.about || '');
  const body = h('div', { class: 'form' }, field(t('programName'), name), field(t('authors'), authors), field(t('aboutProgram'), about));
  if ((await modal({ title: t('attributes').replace('…', ''), body })) !== 'ok') return false;
  Object.assign(attrs, { name: name.value.trim(), authors: authors.value.trim(), about: about.value });
  return true;
}

export async function chooseFunctions(names) {
  const boxes = names.map(n => h('input', { type: 'checkbox', checked: true, value: n }));
  const body = h('div', { class: 'form' }, h('p', {}, t('importFunctions')),
    ...names.map((n, i) => h('label', { class: 'check' }, boxes[i], n)));
  if ((await modal({ title: t('import').replace('…', ''), body })) !== 'ok') return [];
  return boxes.filter(b => b.checked).map(b => b.value);
}

export async function editSettings(settings) {
  const lang = select(settings.lang, Object.entries(LANGUAGES).map(([k, v]) => [k, v.name]));
  const scheme = select(settings.scheme, Object.entries(COLOR_SCHEMES).map(([k, v]) => [k, v.name]));
  const style = select(settings.style, Object.entries(CHART_STYLES).map(([k, v]) => [k, v.name]));
  const code = select(settings.codeLang, GENERATORS.map(g => [g.key, g.label]));
  const stack = h('input', { type: 'number', min: 10, max: 100000, value: settings.maxStack });
  const body = h('div', { class: 'form' },
    field(t('language'), lang), field(t('colorScheme'), scheme), field(t('chartStyle'), style),
    field(t('defaultCodeLanguage'), code), field(t('maxStack'), stack));
  if ((await modal({ title: t('settingsTitle'), body })) !== 'ok') return false;
  Object.assign(settings, {
    lang: lang.value, scheme: scheme.value, style: style.value, codeLang: code.value,
    maxStack: Math.max(10, parseInt(stack.value, 10) || 1000),
  });
  return true;
}

/*
 Chooses what the trace table follows. Returns { items, output } or null if cancelled.
 items: [{ func, kind: 'var' | 'expr', text }]
*/
export async function editTraceConfig(program, current) {
  const chosen = new Set((current?.items || []).filter(i => i.kind === 'var').map(i => `${i.func.toLowerCase()}|${i.text.toLowerCase()}`));
  const first = !current;
  const groups = traceableVariables(program).filter(g => g.vars.length);
  const boxes = [];
  const varSection = h('div', { class: 'trace-vars' }, groups.length ? groups.map((g, gi) => h('div', { class: 'trace-func' },
    h('div', { class: 'trace-func-name' }, gi === 0 ? t('main') : g.func),
    h('div', { class: 'trace-var-grid' }, g.vars.map(v => {
      // On first use, Main's variables start selected.
      const on = first ? gi === 0 : chosen.has(`${g.func.toLowerCase()}|${v.name.toLowerCase()}`);
      const box = h('input', { type: 'checkbox', checked: on });
      boxes.push({ box, func: g.func, name: v.name });
      return h('label', { class: 'check trace-var' }, box, h('span', { class: 'trace-var-name' }, v.name),
        h('span', { class: `badge b-${v.type}` }, `${v.type}${v.array ? '[ ]' : ''}`));
    })))) : h('p', { class: 'muted' }, t('noVariables')));

  const funcNames = program.functions.map((f, i) => [f.name, i === 0 ? t('main') : f.name]);
  const exprs = (current?.items || []).filter(i => i.kind === 'expr').map(i => ({ ...i }));
  const exprList = h('div', { class: 'param-list' });
  const renderExprs = () => {
    exprList.replaceChildren(...exprs.map((x, i) => {
      const input = textInput(x.text, { placeholder: 'n > 0', oninput: e => { x.text = e.target.value; } });
      const fsel = select(x.func, funcNames);
      fsel.addEventListener('change', () => { x.func = fsel.value; });
      return h('div', { class: 'param-row' }, input, h('span', { class: 'muted' }, t('traceIn')), fsel,
        h('button', { title: t('remove'), 'aria-label': t('remove'), onclick: () => { exprs.splice(i, 1); renderExprs(); } }, '✕'));
    }));
  };
  renderExprs();
  const addExpr = h('button', { onclick: () => {
    exprs.push({ func: program.functions[0].name, kind: 'expr', text: '' });
    renderExprs();
    exprList.querySelector('.param-row:last-child input')?.focus();
  } }, `+ ${t('traceAddExpr')}`);
  const output = h('input', { type: 'checkbox', checked: current ? current.output : true });

  const body = h('div', { class: 'form' },
    h('div', { class: 'field' }, h('span', {}, t('traceVariables')), varSection),
    h('div', { class: 'field' }, h('span', {}, t('traceExpressions')), exprList, addExpr, h('small', {}, t('traceExprHint'))),
    h('label', { class: 'check' }, output, t('traceOutputCol')));

  const collect = () => [
    ...boxes.filter(b => b.box.checked).map(b => ({ func: b.func, kind: 'var', text: b.name })),
    ...exprs.filter(x => x.text.trim()).map(x => ({ func: x.func, kind: 'expr', text: x.text.trim() })),
  ];
  const result = await modal({
    title: t('traceTitle'), body, wide: true,
    validate: () => {
      const items = collect();
      if (!items.length) return t('traceNothing');
      for (const x of items.filter(i => i.kind === 'expr')) {
        const err = checkTraceExpression(x.text);
        if (err) return `${x.text}: ${t(err, { text: x.text, token: x.text, name: x.text })}`;
      }
      return null;
    },
  });
  if (result !== 'ok') return null;
  return { items: collect(), output: output.checked };
}

export function infoBox(title, html) {
  return modal({ title, body: h('div', { class: 'help', html }), buttons: [{ label: t('close'), value: 'ok', primary: true }], wide: true });
}
