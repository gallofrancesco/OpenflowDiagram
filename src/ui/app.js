// Application controller: editor state, commands, execution and file handling.
import {
  createProgram, createStatement, createFunction, programToXml, programFromXml, findStatement,
  cloneStatements, statementsToXml, statementsFromXml, walkStatements, BLOCKS,
} from '../core/model.js';
import { Interpreter } from '../core/interpreter.js';
import { FlowError } from '../core/expr.js';
import { t, setLanguage, messages } from '../core/i18n.js';
import { startKey, endKey } from '../core/codegen/common.js';
import { layoutFunction, renderSvg, shapeIcon } from './chart.js';
import { COLOR_SCHEMES, CHART_STYLES, caption } from './schemes.js';
import {
  h, modal, alertBox, confirmBox, editStatement, hasEditor, editFunction, editAttributes, chooseFunctions,
  editSettings, infoBox, isModalOpen, editTraceConfig,
} from './dialogs.js';
import { TraceRecorder } from '../core/trace.js';
import { renderTraceTable, traceToSvg } from './trace.js';
import { ConsolePanel, VariablesPanel, CodePanel } from './panels.js';

const api = window.openflowDiagram;
const $ = sel => document.querySelector(sel);

/* ---------- settings ---------- */

const DEFAULT_SETTINGS = {
  settingsVersion: 2, lang: 'it', scheme: 'system', style: 'standard', codeLang: 'cpp', codeOpen: false, speed: 'medium',
  ignoreBreakpoints: false, maxStack: 1000, zoom: 1, recent: [],
  panels: { console: true, variables: true },
  chat: true, lineNumbers: true, traceOnlyChanges: false, showStack: false, sideWidth: 420,
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('openflowdiagram.settings') || '{}');
    // Version 2 introduced the light "system" look: move users off the old default scheme.
    if ((saved.settingsVersion || 1) < 2) {
      if (!saved.scheme || saved.scheme === 'pastel' || saved.scheme === 'night') saved.scheme = 'system';
      saved.settingsVersion = 2;
    }
    // Only known panels: settings saved by older versions may list panels that no longer exist.
    const panels = Object.fromEntries(Object.keys(DEFAULT_SETTINGS.panels).map(k => [k, saved.panels?.[k] ?? DEFAULT_SETTINGS.panels[k]]));
    return { ...structuredClone(DEFAULT_SETTINGS), ...saved, panels };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

const settings = loadSettings();
const saveSettings = () => {
  try {
    localStorage.setItem('openflowdiagram.settings', JSON.stringify(settings));
  } catch { /* settings are a convenience only */ }
};

/* ---------- editor state ---------- */

const state = {
  program: createProgram(),
  filePath: null,
  dirty: false,
  funcIndex: 0,
  selection: [],        // ids of selected statements (contiguous, same block)
  clipboard: [],
  undo: [],
  redo: [],
  layout: null,
  executingKey: null,
  errorKey: null,
  view: 'chart',        // 'chart' or 'trace'
  traceConfig: null,    // what the trace table follows: { items, output }
};

const SPEEDS = { slow: 900, medium: 350, fast: 80, full: 0 };

const currentFunc = () => state.program.functions[state.funcIndex] || state.program.functions[0];

function markDirty() {
  state.dirty = true;
  updateTitle();
}

function snapshot() {
  return { program: structuredClone(state.program), funcIndex: state.funcIndex };
}

function saveUndo() {
  state.undo.push(snapshot());
  if (state.undo.length > 200) state.undo.shift();
  state.redo = [];
}

function restore(snap) {
  state.program = snap.program;
  state.funcIndex = Math.min(snap.funcIndex, state.program.functions.length - 1);
  state.selection = [];
  markDirty();
  refresh();
}

/* ---------- panels ---------- */

let consolePanel, varsPanel, codePanel;

function setupPanels() {
  const panel = (key, title, tools) => {
    const body = h('div', { class: 'panel-body' });
    const section = h('section', { class: 'panel', 'data-panel': key },
      h('header', {}, h('span', { class: 'panel-title' }, title), h('div', { class: 'panel-tools' }, tools()),
        h('button', { class: 'icon', title: t('close'), 'aria-label': t('close'), onclick: () => togglePanel(key, false) }, '✕')),
      body);
    $('#side').append(section);
    return body;
  };
  const toolBtn = (label, onclick, props = {}) => h('button', { class: 'small', onclick, ...props }, label);

  consolePanel = new ConsolePanel(panel('console', t('console'), () => [
    toolBtn(t('chatBubbles'), e => { settings.chat = !settings.chat; consolePanel.chat = settings.chat; e.target.classList.toggle('on', settings.chat); consolePanel.render(); saveSettings(); }, { class: `small${settings.chat ? ' on' : ''}` }),
    toolBtn(t('copyAll'), () => { api.clipboardWrite(consolePanel.toText()); status(t('copied')); }),
    toolBtn(t('clear'), () => consolePanel.clear()),
  ]), { onSubmit: v => runner.provideInput(v) });
  consolePanel.chat = settings.chat;

  varsPanel = new VariablesPanel(panel('variables', t('variables'), () => [
    toolBtn(t('showStack'), e => { settings.showStack = !settings.showStack; varsPanel.showStack = settings.showStack; e.target.classList.toggle('on', settings.showStack); runner.updateWatch(); saveSettings(); }, { class: `small${settings.showStack ? ' on' : ''}` }),
  ]));
  varsPanel.showStack = settings.showStack;

  setupCodeWindow(toolBtn);
  applyPanels();
}

// The source code lives in its own floating window, hidden until the user asks for it.
function setupCodeWindow(toolBtn) {
  const body = h('div', { class: 'codewin-body' });
  const title = h('div', { class: 'codewin-title' },
    h('span', { class: 'codewin-name' }, t('sourceCode')),
    h('span', { class: 'codewin-tools' },
      h('span', { class: 'lang-slot' }),
      toolBtn(t('lineNumbers'), e => { settings.lineNumbers = !settings.lineNumbers; codePanel.lineNumbers = settings.lineNumbers; e.target.classList.toggle('on', settings.lineNumbers); updateCode(); saveSettings(); }, { class: `small${settings.lineNumbers ? ' on' : ''}` }),
      toolBtn(t('copy'), () => { api.clipboardWrite(codePanel.text()); status(t('copied')); }),
      toolBtn(t('saveFile'), saveCode)),
    h('button', { class: 'icon', title: t('close'), 'aria-label': t('close'), onclick: () => toggleCode(false) }, '✕'));
  const win = $('#code-window');
  win.append(title, body);
  codePanel = new CodePanel(body, { lang: settings.codeLang, onLangChange: k => { settings.codeLang = k; saveSettings(); updateCode(); } });
  codePanel.lineNumbers = settings.lineNumbers;
  title.querySelector('.lang-slot').replaceWith(codePanel.select);

  // Drag the window by its title bar, kept inside the workspace.
  title.addEventListener('pointerdown', e => {
    if (e.target.closest('button, select')) return;
    const start = { x: e.clientX, y: e.clientY, left: win.offsetLeft, top: win.offsetTop };
    title.setPointerCapture(e.pointerId);
    const move = ev => {
      const area = $('#workspace').getBoundingClientRect();
      win.style.left = `${Math.max(0, Math.min(area.width - 120, start.left + ev.clientX - start.x))}px`;
      win.style.top = `${Math.max(0, Math.min(area.height - 40, start.top + ev.clientY - start.y))}px`;
    };
    const up = () => {
      title.removeEventListener('pointermove', move);
      title.removeEventListener('pointerup', up);
      settings.codePos = { left: win.offsetLeft, top: win.offsetTop };
      saveSettings();
    };
    title.addEventListener('pointermove', move);
    title.addEventListener('pointerup', up);
  });
  if (settings.codePos) {
    win.style.left = `${settings.codePos.left}px`;
    win.style.top = `${settings.codePos.top}px`;
  }
  win.hidden = !settings.codeOpen;
}

function toggleCode(on = !settings.codeOpen) {
  settings.codeOpen = on;
  saveSettings();
  $('#code-window').hidden = !on;
  document.querySelector('[data-cmd="toggleCode"]')?.classList.toggle('on', on);
  updateCode();
  buildMenu();
}

function togglePanel(key, on = !settings.panels[key]) {
  settings.panels[key] = on;
  saveSettings();
  applyPanels();
  buildMenu();
}

function applyPanels() {
  let any = false;
  for (const el of document.querySelectorAll('.panel')) {
    const on = !!settings.panels[el.dataset.panel];
    el.hidden = !on;
    any ||= on;
  }
  $('#side').hidden = !any;
  $('#splitter').hidden = !any;
  $('#side').style.width = `${settings.sideWidth}px`;
  for (const b of document.querySelectorAll('[data-toggle-panel]')) b.classList.toggle('on', !!settings.panels[b.dataset.togglePanel]);
  updateCode();
}

const LAYOUTS = {
  layoutChart: {},
  layoutConsole: { console: true },
  layoutVariables: { variables: true, console: true },
  layoutAll: { console: true, variables: true },
};

function applyLayout(name) {
  const l = LAYOUTS[name];
  for (const k of Object.keys(settings.panels)) settings.panels[k] = !!l[k];
  saveSettings();
  applyPanels();
  buildMenu();
}

/* ---------- rendering ---------- */

function scheme() {
  return COLOR_SCHEMES[settings.scheme] || COLOR_SCHEMES.system;
}

function renderChart() {
  const func = currentFunc();
  const style = CHART_STYLES[settings.style] || CHART_STYLES.standard;
  state.layout = layoutFunction(func, style);
  const selected = new Set(state.selection);
  $('#chart').innerHTML = renderSvg(state.layout, {
    scheme: scheme(), interactive: true, selectedIds: selected,
    executingKey: state.executingKey, errorKey: state.errorKey, scale: settings.zoom,
  });
  $('#chart-scroll').style.background = scheme().page;
  const executing = $('#chart .shape[data-key="' + state.executingKey + '"]') || $('#chart .shape[data-key="' + state.errorKey + '"]');
  if (executing) executing.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

let codeTimer = null;
function updateCode() {
  if (!settings.codeOpen || !codePanel) return;
  clearTimeout(codeTimer);
  codeTimer = setTimeout(() => {
    const ids = new Set(state.selection);
    if (state.executingKey != null) ids.add(state.executingKey);
    if (state.errorKey != null) ids.add(state.errorKey);
    codePanel.update(state.program, ids, messages());
  }, 30);
}

function refreshFunctionList() {
  const sel = $('#func-select');
  sel.replaceChildren(...state.program.functions.map((f, i) => h('option', { value: i }, i === 0 ? t('main') : f.name)));
  sel.value = String(state.funcIndex);
}

function refresh() {
  refreshFunctionList();
  renderChart();
  updateCode();
  updateTitle();
  updateToolbar();
}

function updateTitle() {
  const name = state.filePath ? api.basename(state.filePath) : t('untitled');
  document.title = `${state.dirty ? '• ' : ''}${name} — ${t('appName')}`;
}

function status(text) {
  $('#status-text').textContent = text;
}

/* ---------- selection and editing ---------- */

function selectedInfo() {
  if (!state.selection.length) return null;
  const func = currentFunc();
  const first = findStatement(func.body, state.selection[0]);
  if (!first) return null;
  const ids = new Set(state.selection);
  const indexes = first.block.map((s, i) => (ids.has(s.id) ? i : -1)).filter(i => i >= 0);
  return { block: first.block, start: Math.min(...indexes), end: Math.max(...indexes) };
}

function selectedStatements() {
  const info = selectedInfo();
  return info ? info.block.slice(info.start, info.end + 1) : [];
}

function selectShape(id, extend) {
  if (extend && state.selection.length) {
    const func = currentFunc();
    const a = findStatement(func.body, state.selection[0]);
    const b = findStatement(func.body, id);
    if (a && b && a.block === b.block) {
      const lo = Math.min(a.index, b.index), hi = Math.max(a.index, b.index);
      state.selection = a.block.slice(lo, hi + 1).map(s => s.id);
      renderChart();
      updateCode();
      return;
    }
  }
  state.selection = [id];
  renderChart();
  updateCode();
  updateToolbar();
}

function guardRunning() {
  if (runner.active) {
    status(t('running'));
    return true;
  }
  return false;
}

async function insertStatement(gap, kind) {
  if (guardRunning()) return;
  saveUndo();
  const s = createStatement(kind);
  gap.list.splice(gap.index, 0, s);
  state.selection = [s.id];
  markDirty();
  refresh();
  if (hasEditor(kind)) {
    const changed = await editStatement(s);
    if (changed) {
      markDirty();
      refresh();
    }
  }
}

async function editSelected(id) {
  if (guardRunning()) return;
  const found = findStatement(currentFunc().body, id);
  if (!found || !hasEditor(found.statement.kind)) return;
  const before = structuredClone(state.program);
  if (await editStatement(found.statement)) {
    state.undo.push({ program: before, funcIndex: state.funcIndex });
    state.redo = [];
    markDirty();
    refresh();
  }
}

function deleteSelection() {
  if (guardRunning()) return;
  const info = selectedInfo();
  if (!info) return;
  saveUndo();
  info.block.splice(info.start, info.end - info.start + 1);
  state.selection = [];
  markDirty();
  refresh();
}

function copySelection() {
  const list = selectedStatements();
  if (!list.length) return false;
  state.clipboard = cloneStatements(list);
  api.clipboardWrite(statementsToXml(list));
  status(t('copied'));
  return true;
}

function cutSelection() {
  if (guardRunning()) return;
  if (copySelection()) deleteSelection();
}

function clipboardStatements() {
  const text = api.clipboardRead();
  if (text && text.includes('<clip')) {
    try {
      const list = statementsFromXml(text);
      if (list.length) return list;
    } catch { /* fall back to the internal clipboard */ }
  }
  return cloneStatements(state.clipboard);
}

function pasteAt(gap) {
  if (guardRunning()) return;
  const list = clipboardStatements();
  if (!list.length) return;
  saveUndo();
  gap.list.splice(gap.index, 0, ...list);
  state.selection = list.map(s => s.id);
  markDirty();
  refresh();
}

// Paste after the selection, or at the end of the current function.
function pasteCommand() {
  const info = selectedInfo();
  if (info) pasteAt({ list: info.block, index: info.end + 1 });
  else pasteAt({ list: currentFunc().body, index: currentFunc().body.length });
}

/* ---------- popup menus ---------- */

const INSERT_GROUPS = [
  ['groupBasic', ['declare', 'assign', 'input', 'output', 'if', 'call']],
  ['groupLoops', ['while', 'for', 'do']],
  ['groupOther', ['comment', 'breakpoint']],
  ['groupFiles', ['open', 'close', 'read', 'write']],
];

function closePopup() {
  $('#popup').hidden = true;
  $('#popup').replaceChildren();
}

function showPopup(x, y, content) {
  const pop = $('#popup');
  pop.replaceChildren(content);
  pop.hidden = false;
  const r = pop.getBoundingClientRect();
  pop.style.left = `${Math.max(4, Math.min(x, window.innerWidth - r.width - 8))}px`;
  pop.style.top = `${Math.max(4, Math.min(y, window.innerHeight - r.height - 8))}px`;
  pop.querySelector('button')?.focus();
}

function showInsertMenu(gap, x, y) {
  if (guardRunning()) return;
  // Each button shows the shape itself, drawn with the current chart style and colors.
  const style = CHART_STYLES[settings.style] || CHART_STYLES.standard;
  const groups = INSERT_GROUPS.map(([title, kinds]) => h('div', { class: 'insert-group', 'data-group': title },
    h('div', { class: 'insert-title' }, t(title)),
    h('div', { class: 'insert-grid' }, kinds.map(k => h('button', {
      class: 'insert-btn', 'data-kind': k, title: t(`shape_${k}`), 'aria-label': t(`shape_${k}`),
      html: shapeIcon(k, t(`shape_${k}`), scheme(), style),
      onclick: () => { closePopup(); insertStatement(gap, k); },
    })))));
  const hasClip = state.clipboard.length || (api.clipboardRead() || '').includes('<clip');
  const paste = h('button', { class: 'insert-paste', disabled: !hasClip, onclick: () => { closePopup(); pasteAt(gap); } }, t('paste'));
  showPopup(x, y, h('div', { class: 'insert-menu' }, ...groups, paste));
}

function showShapeMenu(id, x, y) {
  if (!state.selection.includes(id)) selectShape(id, false);
  const found = findStatement(currentFunc().body, id);
  const item = (label, fn, disabled) => h('button', { class: 'menu-item', disabled, onclick: () => { closePopup(); fn(); } }, label);
  showPopup(x, y, h('div', { class: 'context-menu' },
    item(t('editShape'), () => editSelected(id), !found || !hasEditor(found.statement.kind)),
    item(t('cut'), cutSelection),
    item(t('copy'), copySelection),
    item(t('paste'), pasteCommand, !state.clipboard.length),
    item(t('delete'), deleteSelection)));
}

/* ---------- chart events ---------- */

function setupChartEvents() {
  const chart = $('#chart');
  chart.addEventListener('click', e => {
    const gap = e.target.closest('.gap');
    if (gap) {
      showInsertMenu(state.layout.gaps[+gap.dataset.gap], e.clientX, e.clientY);
      return;
    }
    const shape = e.target.closest('.shape');
    if (shape && !shape.dataset.terminal) {
      selectShape(Number(shape.dataset.key), e.shiftKey);
      return;
    }
    if (state.selection.length) {
      state.selection = [];
      renderChart();
      updateCode();
    }
  });
  chart.addEventListener('dblclick', e => {
    const shape = e.target.closest('.shape');
    if (!shape) return;
    if (shape.dataset.terminal) {
      if (state.funcIndex === 0) commands.attributes();
      else editFunctionAt(state.funcIndex);
    } else {
      editSelected(Number(shape.dataset.key));
    }
  });
  chart.addEventListener('contextmenu', e => {
    e.preventDefault();
    const gap = e.target.closest('.gap');
    if (gap) return showInsertMenu(state.layout.gaps[+gap.dataset.gap], e.clientX, e.clientY);
    const shape = e.target.closest('.shape');
    if (shape && !shape.dataset.terminal) showShapeMenu(Number(shape.dataset.key), e.clientX, e.clientY);
  });
  $('#chart-scroll').addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });
  document.addEventListener('mousedown', e => {
    if (!$('#popup').hidden && !e.target.closest('#popup')) closePopup();
  });
}

function zoomBy(f) {
  settings.zoom = Math.min(3, Math.max(0.3, settings.zoom * f));
  saveSettings();
  renderChart();
  status(`Zoom ${Math.round(settings.zoom * 100)}%`);
}

/* ---------- functions ---------- */

async function addFunction() {
  if (guardRunning()) return;
  const f = createFunction('');
  const others = state.program.functions.map(x => x.name);
  if (!(await editFunction(f, others, { isNew: true }))) return;
  saveUndo();
  state.program.functions.push(f);
  state.funcIndex = state.program.functions.length - 1;
  state.selection = [];
  markDirty();
  refresh();
}

async function editFunctionAt(index) {
  if (guardRunning() || index === 0) return;
  const f = state.program.functions[index];
  const copy = structuredClone(f);
  const others = state.program.functions.filter((_, i) => i !== index).map(x => x.name);
  if (!(await editFunction(copy, others))) return;
  saveUndo();
  Object.assign(f, { name: copy.name, type: copy.type, variable: copy.variable, params: copy.params });
  markDirty();
  refresh();
}

async function deleteFunctionAt(index) {
  if (guardRunning() || index === 0) return;
  const f = state.program.functions[index];
  if ((await confirmBox(t('delete'), t('deleteFunctionConfirm', { name: f.name }), [
    { label: t('delete'), value: 'yes', primary: true }, { label: t('cancel'), value: null }])) !== 'yes') return;
  saveUndo();
  state.program.functions.splice(index, 1);
  state.funcIndex = Math.min(state.funcIndex, state.program.functions.length - 1);
  if (state.funcIndex === index) state.funcIndex = 0;
  markDirty();
  refresh();
}

async function importFunctions() {
  const res = await api.openDialog({ filters: [{ name: 'OpenflowDiagram / Flowgorithm', extensions: ['fprg'] }] });
  if (!res) return;
  let other;
  try {
    other = programFromXml(res.text);
  } catch (e) {
    return alertBox(t('syntaxError'), e.message);
  }
  const names = other.functions.filter(f => f.name.toLowerCase() !== 'main').map(f => f.name);
  if (!names.length) return alertBox(t('import'), t('noFunctionsToImport'));
  const chosen = await chooseFunctions(names);
  if (!chosen.length) return;
  saveUndo();
  for (const name of chosen) {
    const f = other.functions.find(x => x.name === name);
    let n = f.name, k = 2;
    while (state.program.functions.some(x => x.name.toLowerCase() === n.toLowerCase())) n = `${f.name}${k++}`;
    state.program.functions.push({ ...f, name: n });
  }
  markDirty();
  refresh();
}

async function manageFunctions() {
  let close;
  const signature = f => `${f.name}(${f.params.map(p => `${p.type}${p.array ? '[]' : ''} ${p.name}`).join(', ')})${f.type !== 'None' ? ` → ${f.type}` : ''}`;
  const rows = state.program.functions.slice(1).map((f, i) => h('div', { class: 'func-row' },
    h('button', { class: 'link', onclick: () => close({ act: 'show', index: i + 1 }) }, signature(f)),
    h('button', { class: 'small', onclick: () => close({ act: 'edit', index: i + 1 }) }, t('editShape').replace('…', '')),
    h('button', { class: 'small', onclick: () => close({ act: 'delete', index: i + 1 }) }, t('delete'))));
  const res = await modal({
    title: t('manageFunctions').replace('…', ''), wide: true,
    body: h('div', { class: 'func-manager' }, rows.length ? rows : h('p', { class: 'muted' }, '—')),
    buttons: [{ label: t('add'), value: 'add' }, { label: t('import'), value: 'import' }, { label: t('close'), value: null, primary: true }],
    bind: c => { close = c; },
  });
  if (!res) return;
  if (res === 'add') await addFunction();
  else if (res === 'import') await importFunctions();
  else if (res.act === 'edit') await editFunctionAt(res.index);
  else if (res.act === 'delete') await deleteFunctionAt(res.index);
  else if (res.act === 'show') {
    state.funcIndex = res.index;
    state.selection = [];
    refresh();
    return;
  }
  manageFunctions();
}

/* ---------- views: flowchart / trace table ---------- */

let trace = null;            // TraceRecorder of the current or last run
let traceRenderedAt = 0;
let traceTimer = null;

const newRecorder = config => new TraceRecorder(config, s => caption(s, false).replace(/\n/g, ' '));

function setupViews() {
  const tab = (view, ico, label) => h('button', {
    class: 'view-tab', role: 'tab', 'data-view': view, onclick: () => setView(view),
  }, h('span', { class: 'ico', html: icon(ico) }), label);
  $('#view-tabs').append(tab('chart', 'chart', t('chartTab')), tab('trace', 'trace', t('traceTable')));

  const only = h('input', { type: 'checkbox', checked: settings.traceOnlyChanges });
  only.addEventListener('change', () => {
    settings.traceOnlyChanges = only.checked;
    saveSettings();
    renderTrace(true);
  });
  $('#trace-toolbar').append(
    h('button', { class: 'primary', onclick: chooseTraceValues }, t('traceChoose')),
    h('label', { class: 'check' }, only, t('traceOnlyChanges')),
    h('span', { class: 'spacer' }),
    h('span', { id: 'trace-count', class: 'muted' }),
    h('button', { id: 'trace-export', onclick: exportTrace }, h('span', { class: 'ico', html: icon('save') }), t('traceExportPng')),
  );
  setView(state.view);
}

function setView(view) {
  state.view = view;
  $('#chart-scroll').hidden = view !== 'chart';
  $('#trace-view').hidden = view !== 'trace';
  for (const b of document.querySelectorAll('.view-tab')) {
    b.classList.toggle('active', b.dataset.view === view);
    b.setAttribute('aria-selected', String(b.dataset.view === view));
  }
  document.querySelector('[data-cmd="traceTable"]')?.classList.toggle('on', view === 'trace');
  if (view === 'trace') renderTrace(true);
  else renderChart();
}

// Redraws the table at most every 120 ms while a program runs at speed.
function renderTrace(force = false) {
  if (state.view !== 'trace') return;
  const now = performance.now();
  if (!force && now - traceRenderedAt < 120) {
    if (!traceTimer) traceTimer = setTimeout(() => { traceTimer = null; renderTrace(true); }, 130);
    return;
  }
  traceRenderedAt = now;
  const scroll = $('#trace-scroll');
  if (!state.traceConfig) {
    scroll.replaceChildren(h('div', { class: 'trace-empty' }, h('p', {}, t('traceNotConfigured')),
      h('button', { class: 'primary', onclick: chooseTraceValues }, t('traceChoose'))));
  } else {
    renderTraceTable(scroll, trace, state.program, { onlyChanges: settings.traceOnlyChanges });
  }
  $('#trace-count').textContent = trace?.rows.length ? t('traceRows', { n: trace.rows.length }) : '';
  $('#trace-export').disabled = !trace?.rows.length || runner.active;
}

async function chooseTraceValues() {
  const config = await editTraceConfig(state.program, state.traceConfig);
  if (!config) return;
  state.traceConfig = config;
  // Rows already recorded used the old columns; a running program continues with the new ones.
  trace = runner.active ? newRecorder(config) : null;
  renderTrace(true);
}

async function openTraceTable() {
  setView('trace');
  if (!state.traceConfig) await chooseTraceValues();
}

async function exportTrace() {
  if (!trace?.rows.length) return;
  const name = state.program.attributes.name || (state.filePath ? api.basename(state.filePath).replace(/\.fprg$/i, '') : t('untitled'));
  const path = await api.saveDialog({ defaultPath: `${name} - ${t('traceTable')}.png`, filters: [{ name: 'PNG', extensions: ['png'] }] });
  if (!path) return;
  const svg = traceToSvg(trace, state.program, { onlyChanges: settings.traceOnlyChanges, title: `${t('traceTable')} — ${name}` });
  api.writeBinaryFileSync(path, await svgToPng(svg));
  status(t('saved'));
}

/* ---------- execution ---------- */

class Runner {
  constructor() {
    this.reset();
  }

  reset() {
    this.gen = null;
    this.interp = null;
    this.mode = 'idle'; // idle | running | paused | input
    this.timer = null;
    this.next = undefined;
    this.lastFunc = null;
    this.lastWatch = null;
  }

  get active() {
    return this.mode !== 'idle';
  }

  host() {
    const base = () => (state.filePath ? api.dirname(state.filePath) : api.documentsDir());
    return {
      output: (text, newline) => {
        consolePanel.output(text, newline);
        trace?.addOutput(text + (newline ? '\n' : ''));
      },
      files: {
        read: name => api.readTextFileSync(api.resolve(base(), name)),
        write: (name, text) => api.writeTextFileSync(api.resolve(base(), name), text),
      },
    };
  }

  start(stepping) {
    state.errorKey = null;
    consolePanel.clear();
    this.interp = new Interpreter(state.program, this.host(), { maxStack: settings.maxStack });
    trace = state.traceConfig ? newRecorder(state.traceConfig) : null;
    renderTrace(true);
    this.gen = this.interp.run();
    this.next = undefined;
    this.mode = stepping ? 'paused' : 'running';
    if (!settings.panels.console) togglePanel('console', true);
    if (stepping) this.advance(true);
    else this.schedule(0);
    updateToolbar();
  }

  run() {
    if (this.mode === 'idle') return this.start(false);
    if (this.mode === 'paused') {
      this.mode = 'running';
      this.schedule(0);
      updateToolbar();
    }
    // Waiting for input while stepping: keep running once the value arrives.
    if (this.mode === 'input-paused') this.mode = 'input';
  }

  step() {
    if (this.mode === 'idle') return this.start(true);
    if (this.mode === 'paused') this.advance(true);
  }

  pause() {
    if (this.mode === 'running') {
      clearTimeout(this.timer);
      this.mode = 'paused';
      status(t('paused'));
      updateToolbar();
    }
  }

  stop(message = t('programStopped')) {
    if (!this.active) return;
    clearTimeout(this.timer);
    try {
      this.gen.return();
    } catch { /* closing files may fail; the run is over anyway */ }
    consolePanel.stopAsking();
    consolePanel.add('info', message);
    this.finish();
  }

  finish() {
    this.reset();
    state.executingKey = null;
    refreshFunctionList();
    renderChart();
    updateCode();
    renderTrace(true);
    updateToolbar();
    status(t('ready'));
  }

  schedule(delay) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick(), delay);
  }

  tick() {
    if (this.mode !== 'running') return;
    if (settings.speed === 'full') {
      // Run in time slices so the window stays responsive (and Stop works) even in endless loops.
      const deadline = performance.now() + 30;
      while (performance.now() < deadline) if (!this.advance(false)) return;
      this.show();
      this.schedule(0);
      return;
    }
    if (this.advance(false)) this.schedule(SPEEDS[settings.speed] ?? 300);
  }

  // Runs until the next visible event (or a batch of events at full speed).
  // Returns false if execution should not continue automatically.
  advance(singleStep) {
    const full = settings.speed === 'full' && !singleStep;
    let budget = 500;
    for (;;) {
      let r;
      try {
        r = this.gen.next(this.next);
        this.next = undefined;
      } catch (e) {
        this.fail(e);
        return false;
      }
      if (r.done) {
        consolePanel.add('info', t('programEnded'));
        if (this.lastWatch) varsPanel.render(this.lastWatch);
        if (this.lastFunc != null) state.funcIndex = this.lastFunc;
        this.finish();
        return false;
      }
      const ev = r.value;
      if (ev.type === 'statement' || ev.type === 'terminal') {
        const key = ev.type === 'statement' ? ev.stmt.id : ev.which === 'start' ? startKey(ev.func) : endKey(ev.func);
        state.executingKey = key;
        // Keep Main's final values so the Variables panel still shows them after the run.
        if (ev.type === 'terminal' && ev.which === 'end' && this.interp.frames.length === 1) this.lastWatch = this.interp.watch();
        const idx = state.program.functions.indexOf(ev.func);
        if (idx >= 0) this.lastFunc = idx;
        if (!full) {
          this.show();
          return true;
        }
        if (--budget <= 0) return true;
        continue;
      }
      if (ev.type === 'after' || ev.type === 'decision') {
        trace?.record(ev, this.interp);
        continue;
      }
      if (ev.type === 'breakpoint') {
        if (settings.ignoreBreakpoints) continue;
        this.mode = 'paused';
        this.show();
        status(t('breakpointHit'));
        consolePanel.add('break', t('breakpointHit'));
        updateToolbar();
        return false;
      }
      if (ev.type === 'input') {
        this.mode = this.mode === 'paused' ? 'input-paused' : 'input';
        this.show();
        status(t('waitingInput'));
        consolePanel.ask(`${ev.name} (${ev.varType})`);
        updateToolbar();
        return false;
      }
    }
  }

  provideInput(value) {
    if (this.mode !== 'input' && this.mode !== 'input-paused') return;
    this.next = value;
    const wasPaused = this.mode === 'input-paused';
    this.mode = wasPaused ? 'paused' : 'running';
    status(wasPaused ? t('paused') : t('running'));
    updateToolbar();
    if (wasPaused) this.advance(true);
    else this.schedule(0);
  }

  // The chart follows execution into whichever function is running.
  show() {
    if (this.lastFunc != null) state.funcIndex = this.lastFunc;
    refreshFunctionList();
    renderChart();
    updateCode();
    this.updateWatch();
    renderTrace();
  }

  updateWatch() {
    varsPanel.render(this.interp ? this.interp.watch() : []);
  }

  fail(e) {
    const flow = e instanceof FlowError;
    const msg = flow ? t(e.code, e.params) : String(e?.message || e);
    if (flow && e.stmtId != null) {
      state.errorKey = e.stmtId;
      const idx = state.program.functions.findIndex(f => [...walkStatements(f.body)].some(s => s.id === e.stmtId));
      if (idx >= 0) state.funcIndex = idx;
    }
    this.updateWatch();
    consolePanel.stopAsking();
    consolePanel.add('error', `${t('runtimeError')}: ${msg}`);
    this.reset();
    state.executingKey = null;
    refresh();
    renderTrace(true);
    status(t('runtimeError'));
    alertBox(t('runtimeError'), msg);
  }
}

const runner = new Runner();

/* ---------- files ---------- */

async function confirmDiscard() {
  if (!state.dirty) return true;
  const r = await confirmBox(t('appName'), t('confirmDiscard'));
  if (r === null) return false;
  if (r === 'yes') return await save();
  return true;
}

function loadProgram(program, path) {
  if (runner.active) runner.stop();
  state.program = program;
  state.filePath = path;
  state.dirty = false;
  state.funcIndex = 0;
  state.selection = [];
  state.undo = [];
  state.redo = [];
  state.errorKey = null;
  state.executingKey = null;
  if (path) addRecent(path);
  consolePanel.clear();
  varsPanel.render([]);
  // The trace setup refers to this program's variables, so a new program starts without one.
  state.traceConfig = null;
  trace = null;
  renderTrace(true);
  refresh();
}

function addRecent(path) {
  settings.recent = [path, ...settings.recent.filter(p => p !== path)].slice(0, 8);
  saveSettings();
  buildMenu();
}

async function openPath(path) {
  let text;
  try {
    text = api.readTextFileSync(path);
  } catch (e) {
    settings.recent = settings.recent.filter(p => p !== path);
    saveSettings();
    buildMenu();
    return alertBox(t('open').replace('…', ''), e.message);
  }
  try {
    loadProgram(programFromXml(text), path);
  } catch (e) {
    alertBox(t('syntaxError'), e.message);
  }
}

async function openFile() {
  if (!(await confirmDiscard())) return;
  const res = await api.openDialog({ filters: [{ name: 'OpenflowDiagram / Flowgorithm', extensions: ['fprg'] }] });
  if (!res) return;
  try {
    loadProgram(programFromXml(res.text), res.path);
  } catch (e) {
    alertBox(t('syntaxError'), e.message);
  }
}

async function save(forceDialog = false) {
  let path = state.filePath;
  if (!path || forceDialog) {
    const suggested = (state.program.attributes.name || t('untitled')).replace(/[\\/:*?"<>|]/g, '') + '.fprg';
    path = await api.saveDialog({ defaultPath: suggested, filters: [{ name: 'OpenflowDiagram / Flowgorithm', extensions: ['fprg'] }] });
    if (!path) return false;
  }
  try {
    api.writeTextFileSync(path, programToXml(state.program));
  } catch (e) {
    await alertBox(t('save'), e.message);
    return false;
  }
  state.filePath = path;
  state.dirty = false;
  addRecent(path);
  updateTitle();
  status(t('saved'));
  return true;
}

async function saveCode() {
  const path = await api.saveDialog({
    defaultPath: (codePanel.lang === 'java' ? 'Main' : state.program.attributes.name || 'programma') + '.' + codePanel.extension,
    filters: [{ name: codePanel.select.selectedOptions[0].textContent, extensions: [codePanel.extension] }],
  });
  if (path) api.writeTextFileSync(path, codePanel.text());
}

function chartSvg(func, forExport = true) {
  const style = CHART_STYLES[settings.style] || CHART_STYLES.standard;
  return renderSvg(layoutFunction(func, style), { scheme: scheme(), interactive: !forExport });
}

function svgToPng(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      // Double resolution, reduced for very large images (canvas size limits).
      const k = Math.min(2, 16000 / Math.max(img.width, img.height));
      c.width = img.width * k;
      c.height = img.height * k;
      const g = c.getContext('2d');
      g.scale(k, k);
      g.drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

async function exportChart(kind) {
  const func = currentFunc();
  const path = await api.saveDialog({ defaultPath: `${func.name}.${kind}`, filters: [{ name: kind.toUpperCase(), extensions: [kind] }] });
  if (!path) return;
  const svg = chartSvg(func);
  if (kind === 'svg') api.writeTextFileSync(path, svg);
  else api.writeBinaryFileSync(path, await svgToPng(svg));
}

function printChart() {
  const area = $('#print-area');
  area.innerHTML = state.program.functions.map(f => `<div class="print-page">${chartSvg(f)}</div>`).join('');
  window.print();
  area.innerHTML = '';
}

/* ---------- commands ---------- */

const commands = {
  async new() {
    if (!(await confirmDiscard())) return;
    loadProgram(createProgram(), null);
  },
  open: openFile,
  save: () => save(false),
  saveAs: () => save(true),
  print: printChart,
  exportPng: () => exportChart('png'),
  exportSvg: () => exportChart('svg'),
  exit: () => api.closeWindow(),
  undo() {
    if (guardRunning() || !state.undo.length) return;
    state.redo.push(snapshot());
    restore(state.undo.pop());
  },
  redo() {
    if (guardRunning() || !state.redo.length) return;
    state.undo.push(snapshot());
    restore(state.redo.pop());
  },
  cut: cutSelection,
  copy: copySelection,
  paste: pasteCommand,
  delete: deleteSelection,
  editShape: () => state.selection.length && editSelected(state.selection[0]),
  selectNone() {
    closePopup();
    state.selection = [];
    renderChart();
    updateCode();
  },
  run: () => runner.run(),
  step: () => runner.step(),
  pause: () => runner.pause(),
  stop: () => runner.stop(),
  ignoreBreakpoints() {
    settings.ignoreBreakpoints = !settings.ignoreBreakpoints;
    saveSettings();
    buildMenu();
    updateToolbar();
  },
  removeBreakpoints() {
    if (guardRunning()) return;
    saveUndo();
    const strip = list => {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].kind === 'breakpoint') list.splice(i, 1);
        else for (const b of BLOCKS[list[i].kind] || []) strip(list[i][b]);
      }
    };
    for (const f of state.program.functions) strip(f.body);
    markDirty();
    refresh();
  },
  addFunction,
  manageFunctions,
  async attributes() {
    if (await editAttributes(state.program.attributes)) markDirty();
  },
  zoomIn: () => zoomBy(1.15),
  zoomOut: () => zoomBy(1 / 1.15),
  zoomReset() {
    settings.zoom = 1;
    saveSettings();
    renderChart();
  },
  async settings() {
    const before = settings.lang;
    if (!(await editSettings(settings))) return;
    saveSettings();
    if (settings.lang !== before) {
      // Panels and toolbar carry translated labels, so rebuild the whole UI.
      location.reload();
      return;
    }
    codePanel.select.value = settings.codeLang;
    codePanel.lang = settings.codeLang;
    buildMenu();
    refresh();
  },
  toggleCode: () => toggleCode(),
  traceTable: () => (state.view === 'trace' ? setView('chart') : openTraceTable()),
  help: () => infoBox(t('documentation'), t('helpText')),
  guide: () => api.openGuide(),
  about: () => infoBox(t('about'), `<p><b>OpenflowDiagram</b> ${api.version}</p><p>${t('aboutText')}</p>`),
};

for (const name of Object.keys(LAYOUTS)) commands[name] = () => applyLayout(name);
for (const p of ['console', 'variables']) commands[`panel_${p}`] = () => togglePanel(p);
for (const s of Object.keys(SPEEDS)) {
  commands[`speed_${s}`] = () => {
    settings.speed = s;
    saveSettings();
    buildMenu();
    $('#speed').value = s;
  };
}
for (const k of Object.keys(COLOR_SCHEMES)) commands[`scheme_${k}`] = () => { settings.scheme = k; saveSettings(); buildMenu(); renderChart(); };
for (const k of Object.keys(CHART_STYLES)) commands[`style_${k}`] = () => { settings.style = k; saveSettings(); buildMenu(); renderChart(); };

function runCommand(id) {
  if (id.startsWith('recent:')) {
    const path = id.slice(7);
    confirmDiscard().then(ok => ok && openPath(path));
    return;
  }
  if (id.startsWith('example:')) {
    // Examples open as untitled copies so saving never overwrites the installed file.
    confirmDiscard().then(ok => {
      if (!ok) return;
      try {
        loadProgram(programFromXml(api.readTextFileSync(id.slice(8))), null);
      } catch (e) {
        alertBox(t('syntaxError'), e.message);
      }
    });
    return;
  }
  const fn = commands[id];
  if (fn) fn();
}

/* ---------- menu, toolbar, keyboard ---------- */

const SHORTCUTS = {
  new: 'Ctrl+N', open: 'Ctrl+O', save: 'Ctrl+S', saveAs: 'Ctrl+Shift+S', print: 'Ctrl+P',
  undo: 'Ctrl+Z', redo: 'Ctrl+Y', cut: 'Ctrl+X', copy: 'Ctrl+C', paste: 'Ctrl+V', delete: 'Delete',
  editShape: 'Enter', run: 'F5', step: 'F10', pause: 'F6', stop: 'Shift+F5',
  zoomIn: 'Ctrl+=', zoomOut: 'Ctrl+-', zoomReset: 'Ctrl+0', guide: 'F1', toggleCode: 'F4', traceTable: 'F7',
};

// Thin line icons (24×24, drawn with currentColor) in the spirit of SF Symbols.
const ICONS = {
  new: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11.5v6M9 14.5h6',
  open: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z',
  save: 'M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5M5 19.5h14',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  run: '!M7.5 4.8v14.4a.8.8 0 0 0 1.2.7l11.2-7.2a.8.8 0 0 0 0-1.4L8.7 4.1a.8.8 0 0 0-1.2.7z',
  step: 'M5.5 5v14M10 5.5v13l9-6.5z',
  pause: 'M8.5 5v14M15.5 5v14',
  stop: '!M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z',
  add: 'M12 5v14M5 12h14',
  // The "Call" shape of the flowchart (box with side bars), the usual symbol for a function.
  functions: 'M3.5 6.5h17v11h-17zM7.5 6.5v11M16.5 6.5v11',
  zoomOut: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4.5-4.5M7.5 10.5h6',
  zoomIn: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4.5-4.5M7.5 10.5h6M10.5 7.5v6',
  console: 'M5 4.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
  variables: 'M4 5.5h16v13H4zM4 10h16M10 5.5v13',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15',
  chart: 'M9 3.5h6v4H9zM12 7.5v3M7 10.5h10l-2 4H9zM12 14.5v3M9 17.5h6v3H9z',
  trace: 'M3.5 5h17v14h-17zM3.5 9.5h17M3.5 14h17M9 5v14M14.5 5v14',
};

function icon(name) {
  const d = ICONS[name] || '';
  const filled = d.startsWith('!');
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" ${filled
    ? 'fill="currentColor" stroke="none"'
    : 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'}><path d="${filled ? d.slice(1) : d}"/></svg>`;
}

const examples = api.listExamples();

function buildMenu() {
  // CmdOrCtrl shows ⌘ on macOS and Ctrl elsewhere (the page itself accepts both keys).
  const accel = id => SHORTCUTS[id]?.replace('Ctrl+', 'CmdOrCtrl+');
  const item = (id, extra = {}) => ({ id, label: t(id), accelerator: accel(id), ...extra });
  const radio = (id, label, checked) => ({ id, label, type: 'radio', checked });
  const template = [
    { label: t('file'), submenu: [
      item('new'), item('open'),
      { label: t('recent'), submenu: settings.recent.length ? settings.recent.map(p => ({ id: `recent:${p}`, label: p })) : [{ label: '—', enabled: false }] },
      { label: t('examples'), submenu: examples.length ? examples.map(p => ({ id: `example:${p}`, label: api.basename(p).replace(/\.fprg$/, '') })) : [{ label: '—', enabled: false }] },
      { type: 'separator' }, item('save'), item('saveAs'), { type: 'separator' },
      item('exportPng'), item('exportSvg'), item('print'), { type: 'separator' }, item('exit'),
    ] },
    { label: t('edit'), submenu: [
      item('undo'), item('redo'), { type: 'separator' }, item('cut'), item('copy'), item('paste'), item('delete'),
      { type: 'separator' }, item('editShape'),
    ] },
    { label: t('program'), submenu: [
      item('run'), item('step'), item('pause'), item('stop'), { type: 'separator' },
      { label: t('speed'), submenu: Object.keys(SPEEDS).map(s => radio(`speed_${s}`, t(`speed${s[0].toUpperCase()}${s.slice(1)}`), settings.speed === s)) },
      item('ignoreBreakpoints', { type: 'checkbox', checked: settings.ignoreBreakpoints }), item('removeBreakpoints'),
      { type: 'separator' }, item('addFunction'), item('manageFunctions'), item('attributes'),
    ] },
    { label: t('view'), submenu: [
      { id: 'panel_console', label: t('console'), type: 'checkbox', checked: settings.panels.console },
      { id: 'panel_variables', label: t('variables'), type: 'checkbox', checked: settings.panels.variables },
      { type: 'separator' },
      { id: 'toggleCode', label: t('sourceCode'), accelerator: accel('toggleCode'), type: 'checkbox', checked: settings.codeOpen },
      { id: 'traceTable', label: t('traceTable'), accelerator: accel('traceTable') },
      { label: t('layout'), submenu: Object.keys(LAYOUTS).map(k => item(k)) },
      { type: 'separator' }, item('zoomIn'), item('zoomOut'), item('zoomReset'), { type: 'separator' },
      { label: t('colorScheme'), submenu: Object.entries(COLOR_SCHEMES).map(([k, v]) => radio(`scheme_${k}`, v.name, settings.scheme === k)) },
      { label: t('chartStyle'), submenu: Object.entries(CHART_STYLES).map(([k, v]) => radio(`style_${k}`, v.name, settings.style === k)) },
    ] },
    { label: t('tools'), submenu: [item('settings')] },
    { label: t('help'), submenu: [item('guide'), item('help', { label: t('documentation') }), { type: 'separator' }, item('about')] },
  ];
  api.setMenu(template);
}

function setupToolbar() {
  const bar = $('#toolbar');
  const btn = (id, ico, title, iconOnly = false) => h('button', { class: `tool${iconOnly ? ' icon-only' : ''}`, 'data-cmd': id, title: `${title}${SHORTCUTS[id] ? ` (${SHORTCUTS[id]})` : ''}`, 'aria-label': title, onclick: () => runCommand(id) },
    h('span', { class: 'ico', html: icon(ico) }), h('span', { class: 'lbl' }, title));
  const sep = () => h('span', { class: 'sep' });
  const group = (...items) => h('div', { class: 'tool-group' }, ...items);
  const speed = h('select', { id: 'speed', title: t('speed'), 'aria-label': t('speed') },
    Object.keys(SPEEDS).map(s => h('option', { value: s }, t(`speed${s[0].toUpperCase()}${s.slice(1)}`))));
  speed.value = settings.speed;
  speed.addEventListener('change', () => commands[`speed_${speed.value}`]());
  const funcSel = h('select', { id: 'func-select', title: t('functionsOf'), 'aria-label': t('functionsOf') });
  funcSel.addEventListener('change', () => {
    state.funcIndex = +funcSel.value;
    state.selection = [];
    renderChart();
    updateCode();
  });
  const panelBtn = (key, ico, title) => h('button', { class: 'tool toggle icon-only', 'data-toggle-panel': key, title, 'aria-label': title, onclick: () => togglePanel(key) },
    h('span', { class: 'ico', html: icon(ico) }), h('span', { class: 'lbl' }, title));
  // Short labels keep the toolbar on one line; tooltips carry the full names.
  const codeBtn = btn('toggleCode', 'code', t('sourceCode'));
  codeBtn.querySelector('.lbl').textContent = t('codeShort');
  codeBtn.classList.add('toggle', 'code-toggle');
  codeBtn.classList.toggle('on', settings.codeOpen);
  // Function manager: icon plus a visible label (the tooltip keeps the full name).
  const funcBtn = btn('manageFunctions', 'functions', t('manageFunctions').replace('…', ''));
  funcBtn.querySelector('.lbl').textContent = t('functionsOf');
  const traceBtn = btn('traceTable', 'trace', t('traceTable'));
  traceBtn.querySelector('.lbl').textContent = t('traceShort');
  traceBtn.classList.add('toggle', 'code-toggle');
  bar.append(
    group(btn('new', 'new', t('new'), true), btn('open', 'open', t('open').replace('…', ''), true), btn('save', 'save', t('save'), true)),
    group(btn('undo', 'undo', t('undo'), true), btn('redo', 'redo', t('redo'), true)), sep(),
    group(btn('run', 'run', t('run')), btn('step', 'step', t('step')), btn('pause', 'pause', t('pause'), true), btn('stop', 'stop', t('stop'), true)), speed, sep(),
    funcSel,
    group(btn('addFunction', 'add', t('addFunction').replace('…', ''), true), funcBtn),
    group(btn('zoomOut', 'zoomOut', t('zoomOut'), true), btn('zoomIn', 'zoomIn', t('zoomIn'), true)),
    h('span', { class: 'spacer' }),
    group(panelBtn('console', 'console', t('console')), panelBtn('variables', 'variables', t('variables'))),
    traceBtn,
    codeBtn,
  );
}

function updateToolbar() {
  const set = (id, enabled) => {
    const b = document.querySelector(`[data-cmd="${id}"]`);
    if (b) b.disabled = !enabled;
  };
  const m = runner.mode;
  set('run', m === 'idle' || m === 'paused' || m === 'input-paused');
  set('step', m === 'idle' || m === 'paused');
  set('pause', m === 'running');
  set('stop', m !== 'idle');
  set('undo', !runner.active && state.undo.length > 0);
  set('redo', !runner.active && state.redo.length > 0);
  document.body.classList.toggle('running', runner.active);
  if (!runner.active) status(state.errorKey ? t('runtimeError') : t('ready'));
  else if (m === 'running') status(t('running'));
}

function keyName(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  let k = e.key;
  if (k === '+') k = '=';
  if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join('+');
}

function setupKeyboard() {
  const byKey = Object.fromEntries(Object.entries(SHORTCUTS).map(([id, k]) => [k, id]));
  document.addEventListener('keydown', e => {
    if (isModalOpen()) return;
    if (e.key === 'Escape') {
      commands.selectNone();
      return;
    }
    const inField = e.target instanceof Element && e.target.closest('input, textarea, select');
    const name = keyName(e);
    const id = byKey[name];
    if (!id) return;
    // Editing keys belong to text fields when one has focus.
    if (inField && !/^F\d+$/.test(e.key) && !['save', 'saveAs', 'open', 'new', 'print'].includes(id)) return;
    if (id === 'editShape' && !state.selection.length) return;
    e.preventDefault();
    runCommand(id);
  });
}

function setupSplitter() {
  const split = $('#splitter');
  split.addEventListener('pointerdown', e => {
    split.setPointerCapture(e.pointerId);
    const move = ev => {
      settings.sideWidth = Math.max(240, Math.min(window.innerWidth - 300, window.innerWidth - ev.clientX));
      $('#side').style.width = `${settings.sideWidth}px`;
    };
    const up = () => {
      split.removeEventListener('pointermove', move);
      split.removeEventListener('pointerup', up);
      saveSettings();
    };
    split.addEventListener('pointermove', move);
    split.addEventListener('pointerup', up);
  });
}

/* ---------- start-up ---------- */

function init() {
  setLanguage(settings.lang);
  document.documentElement.lang = settings.lang;
  setupToolbar();
  setupPanels();
  setupViews();
  setupChartEvents();
  setupKeyboard();
  setupSplitter();
  buildMenu();
  api.onMenuCommand(runCommand);
  api.onOpenPath(path => confirmDiscard().then(ok => ok && openPath(path)));
  api.onCloseRequest(async () => {
    if (await confirmDiscard()) api.confirmClose();
  });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    const path = file && api.pathForFile(file);
    if (path) confirmDiscard().then(ok => ok && openPath(path));
  });
  refresh();
  status(t('ready'));
  api.rendererReady();
}

init();
