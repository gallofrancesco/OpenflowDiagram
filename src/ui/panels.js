// Side panels: console, variable watch and source code viewer.
import { t } from '../core/i18n.js';
import { GENERATORS, generateCode, generatorFor } from '../core/codegen/index.js';
import { h } from './dialogs.js';

/* ---------- console ---------- */

export class ConsolePanel {
  constructor(root, { onSubmit }) {
    this.messages = [];
    this.openLine = false;
    this.chat = true;
    this.onSubmit = onSubmit;
    this.list = h('div', { class: 'console-list', role: 'log', 'aria-live': 'polite' });
    this.input = h('input', { type: 'text', class: 'console-input', disabled: true, placeholder: t('enterValue'), spellcheck: 'false' });
    this.send = h('button', { disabled: true, onclick: () => this.submit() }, t('send'));
    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });
    root.append(this.list, h('div', { class: 'console-entry' }, this.input, this.send));
  }

  clear() {
    this.messages = [];
    this.openLine = false;
    this.render();
  }

  add(kind, text) {
    this.messages.push({ kind, text });
    this.openLine = false;
    this.render();
  }

  output(text, newline) {
    const last = this.messages[this.messages.length - 1];
    if (this.openLine && last && last.kind === 'out') last.text += text;
    else this.messages.push({ kind: 'out', text });
    this.openLine = !newline;
    this.render();
  }

  ask(prompt) {
    this.input.disabled = false;
    this.send.disabled = false;
    this.input.placeholder = prompt;
    this.input.value = '';
    this.input.focus();
  }

  stopAsking() {
    this.input.disabled = true;
    this.send.disabled = true;
    this.input.placeholder = t('enterValue');
  }

  submit() {
    if (this.input.disabled) return;
    const value = this.input.value;
    this.input.value = '';
    this.messages.push({ kind: 'in', text: value });
    this.openLine = false;
    this.stopAsking();
    this.render();
    this.onSubmit(value);
  }

  // Batched: a program can print thousands of lines per second.
  render() {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      this.list.classList.toggle('chat', this.chat);
      this.list.replaceChildren(...this.messages.slice(-2000).map(m => h('div', { class: `msg ${m.kind}` }, m.text)));
      this.list.scrollTop = this.list.scrollHeight;
    }, 16);
  }

  toText() {
    return this.messages.map(m => (m.kind === 'in' ? `> ${m.text}` : m.text)).join('\n');
  }
}

/* ---------- variable watch ---------- */

export class VariablesPanel {
  constructor(root) {
    this.root = h('div', { class: 'vars' });
    this.showStack = false;
    root.append(this.root);
    this.render([]);
  }

  render(frames) {
    if (!frames.length) {
      this.root.replaceChildren(h('p', { class: 'muted' }, t('noVariables')));
      return;
    }
    const shown = this.showStack ? frames : frames.slice(-1);
    this.root.replaceChildren(...shown.slice().reverse().map(f => h('div', { class: 'frame' },
      h('div', { class: 'frame-title' }, f.func),
      h('table', {}, h('tbody', {}, f.vars.map(v => {
        if (!v.array) {
          return h('tr', {}, h('td', { class: `vname t-${v.type}` }, v.name, v.param ? h('small', {}, ' ⟵') : null),
            h('td', { class: 'vtype' }, h('span', { class: `badge b-${v.type}` }, v.type)),
            h('td', { class: `vval${v.value == null ? ' uninit' : ''}` }, v.value == null ? t('uninitialized') : display(v)));
        }
        return h('tr', {}, h('td', { class: `vname t-${v.type}` }, v.name), h('td', { class: 'vtype' }, h('span', { class: `badge b-${v.type}` }, `${v.type}[${v.items.length}]`)),
          h('td', { class: 'vval' }, h('div', { class: 'array' }, v.items.map((x, i) =>
            h('span', { class: `cell${x == null ? ' uninit' : ''}`, title: `[${i}]` }, h('sub', {}, i), x == null ? '?' : display({ type: v.type, value: x }))))));
      }))))));
  }
}

const display = v => (v.type === 'String' ? `"${v.value}"` : v.value);

/* ---------- source code ---------- */

const KEYWORDS = {
  c: 'int double char bool void if else while for do return include define true false const static struct',
  cpp: 'int double char bool void if else while for do return include define true false const static using namespace string vector auto',
  java: 'public private static class void int double boolean String if else while for do return new import true false throws',
  python: 'def if else elif while for in range return import and or not True False None pass break class global print input',
};

function highlight(line, lang) {
  const kw = new Set(KEYWORDS[lang].split(' '));
  const comment = lang === 'python' ? '#' : '//';
  const out = [];
  let i = 0;
  const push = (cls, text) => out.push(cls ? h('span', { class: cls }, text) : document.createTextNode(text));
  if (/^\s*#\s*(include|define|ifndef|endif)/.test(line) && lang !== 'python') {
    push('tk-pre', line);
    return out;
  }
  while (i < line.length) {
    const rest = line.slice(i);
    if (rest.startsWith(comment)) { push('tk-com', rest); break; }
    const str = /^("(\\.|[^"\\])*"|'(\\.|[^'\\])*')/.exec(rest);
    if (str) { push('tk-str', str[0]); i += str[0].length; continue; }
    const num = /^\d+(\.\d+)?/.exec(rest);
    if (num) { push('tk-num', num[0]); i += num[0].length; continue; }
    const word = /^[A-Za-z_]\w*/.exec(rest);
    if (word) { push(kw.has(word[0]) ? 'tk-kw' : null, word[0]); i += word[0].length; continue; }
    push(null, rest[0]);
    i++;
  }
  return out;
}

export class CodePanel {
  constructor(root, { lang, onLangChange }) {
    this.lang = lang;
    this.lineNumbers = true;
    this.lines = [];
    this.select = h('select', { 'aria-label': t('codeLanguage') }, GENERATORS.map(g => h('option', { value: g.key }, g.label)));
    this.select.value = lang;
    this.select.addEventListener('change', () => {
      this.lang = this.select.value;
      onLangChange(this.lang);
    });
    this.view = h('pre', { class: 'code', tabindex: '0' });
    this.toolbarSlot = this.select;
    root.append(this.view);
  }

  update(program, highlightIds, messages) {
    try {
      this.lines = generateCode(program, this.lang, messages);
    } catch (e) {
      this.lines = [{ text: `// ${e.message}`, id: null }];
    }
    const width = String(this.lines.length).length;
    let first = null;
    const rows = this.lines.map((l, i) => {
      const hl = l.id != null && highlightIds.has(l.id);
      const row = h('div', { class: `code-line${hl ? ' hl' : ''}` },
        this.lineNumbers ? h('span', { class: 'ln' }, String(i + 1).padStart(width, ' ')) : null,
        h('span', { class: 'src' }, ...highlight(l.text, this.lang), '\u200b'));
      if (hl && !first) first = row;
      return row;
    });
    this.view.replaceChildren(...rows);
    if (first) first.scrollIntoView({ block: 'nearest' });
  }

  text() {
    return this.lines.map(l => l.text).join('\n') + '\n';
  }

  get extension() {
    return generatorFor(this.lang).extension;
  }
}
