// Program model: functions made of nested statement blocks, plus .fprg (XML) load/save.
import { XmlNode, parseXml, writeXml } from './xml.js';

export const TYPES = ['Integer', 'Real', 'String', 'Boolean'];
export const RETURN_TYPES = ['None', ...TYPES];
export const FILE_VERSION = '4.2';

let nextId = 1;
export const newId = () => nextId++;

// Default fields for every statement kind. Child blocks are listed in BLOCKS.
const DEFAULTS = {
  declare: { names: '', type: 'Integer', array: false, size: '' },
  assign: { variable: '', expression: '' },
  input: { variable: '' },
  output: { expression: '', newline: true },
  if: { expression: '' },
  while: { expression: '' },
  for: { variable: '', start: '', end: '', direction: 'inc', step: '1' },
  do: { expression: '' },
  call: { expression: '' },
  comment: { text: '' },
  breakpoint: { expression: '', always: true },
  open: { expression: '', mode: 'read' },
  close: {},
  read: { variable: '' },
  write: { expression: '' },
};

export const STATEMENT_KINDS = Object.keys(DEFAULTS);

export const BLOCKS = {
  if: ['then', 'else'],
  while: ['body'],
  for: ['body'],
  do: ['body'],
};

export function createStatement(kind, fields = {}) {
  if (!DEFAULTS[kind]) throw new Error(`Unknown statement: ${kind}`);
  const s = { kind, id: newId(), ...structuredClone(DEFAULTS[kind]), ...fields };
  for (const b of BLOCKS[kind] || []) if (!s[b]) s[b] = [];
  return s;
}

export function createFunction(name = 'Main', fields = {}) {
  return { id: newId(), name, type: 'None', variable: '', params: [], body: [], ...fields };
}

export function createProgram() {
  const now = new Date().toISOString();
  return {
    attributes: { name: '', authors: '', about: '', created: now, edited: now },
    functions: [createFunction('Main')],
  };
}

// Deep copy with fresh ids, used for paste and snapshots.
export function cloneStatements(list) {
  return list.map(s => {
    const c = { ...structuredClone(s), id: newId() };
    for (const b of BLOCKS[s.kind] || []) c[b] = cloneStatements(s[b]);
    return c;
  });
}

export function cloneFunction(f) {
  return { ...structuredClone(f), id: newId(), body: cloneStatements(f.body) };
}

export function cloneProgram(p) {
  return { attributes: { ...p.attributes }, functions: p.functions.map(cloneFunction) };
}

export function* walkStatements(list) {
  for (const s of list) {
    yield s;
    for (const b of BLOCKS[s.kind] || []) yield* walkStatements(s[b]);
  }
}

// Returns { block, index, statement } for the statement with the given id.
export function findStatement(list, id) {
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.id === id) return { block: list, index: i, statement: s };
    for (const b of BLOCKS[s.kind] || []) {
      const r = findStatement(s[b], id);
      if (r) return r;
    }
  }
  return null;
}

export function findFunction(program, name) {
  const lower = name.toLowerCase();
  return program.functions.find(f => f.name.toLowerCase() === lower) || null;
}

// True when the statement still has a required field left empty.
export function isIncomplete(s) {
  switch (s.kind) {
    case 'declare': return !s.names.trim() || (s.array && !String(s.size).trim());
    case 'assign': return !s.variable.trim() || !s.expression.trim();
    case 'input': case 'read': return !s.variable.trim();
    case 'output': case 'if': case 'while': case 'do': case 'call':
    case 'open': case 'write':
      return !s.expression.trim();
    case 'for': return !s.variable.trim() || !s.start.trim() || !s.end.trim();
    case 'breakpoint': return !s.always && !s.expression.trim();
    default: return false;
  }
}

/* ---------- .fprg serialization ---------- */

const bool = v => String(v).toLowerCase() === 'true';
const boolText = v => (v ? 'True' : 'False');

function statementToXml(s) {
  const node = (name, attrs, children) => new XmlNode(name, attrs, children);
  switch (s.kind) {
    case 'declare': return node('declare', { name: s.names, type: s.type, array: boolText(s.array), size: s.size });
    case 'assign': return node('assign', { variable: s.variable, expression: s.expression });
    case 'input': return node('input', { variable: s.variable });
    case 'output': return node('output', { expression: s.expression, newline: boolText(s.newline) });
    case 'if': return node('if', { expression: s.expression }, [
      node('then', {}, s.then.map(statementToXml)),
      node('else', {}, s.else.map(statementToXml)),
    ]);
    case 'while': return node('while', { expression: s.expression }, s.body.map(statementToXml));
    case 'do': return node('do', { expression: s.expression }, s.body.map(statementToXml));
    case 'for': return node('for', {
      variable: s.variable, start: s.start, end: s.end, direction: s.direction, step: s.step,
    }, s.body.map(statementToXml));
    case 'call': return node('call', { expression: s.expression });
    case 'comment': return node('comment', { text: s.text });
    case 'breakpoint': return node('breakpoint', { expression: s.expression, always: boolText(s.always) });
    case 'open': return node('open', { expression: s.expression, mode: s.mode });
    case 'read': return node('read', { variable: s.variable });
    case 'write': return node('write', { expression: s.expression });
    default: return node(s.kind, {});
  }
}

function statementFromXml(x) {
  const k = x.name.toLowerCase();
  const a = n => x.attr(n);
  const kids = () => x.children.map(statementFromXml);
  switch (k) {
    case 'declare': return createStatement('declare', {
      names: a('name'), type: normType(a('type')), array: bool(a('array')), size: a('size'),
    });
    case 'assign': return createStatement('assign', { variable: a('variable'), expression: a('expression') });
    case 'input': return createStatement('input', { variable: a('variable') });
    case 'output': return createStatement('output', {
      expression: a('expression'), newline: x.attr('newline', 'True') === '' ? true : bool(x.attr('newline', 'True')),
    });
    case 'if': {
      const t = x.child('then'), e = x.child('else');
      return createStatement('if', {
        expression: a('expression'),
        then: t ? t.children.map(statementFromXml) : [],
        else: e ? e.children.map(statementFromXml) : [],
      });
    }
    case 'while': return createStatement('while', { expression: a('expression'), body: kids() });
    case 'do': return createStatement('do', { expression: a('expression'), body: kids() });
    case 'for': return createStatement('for', {
      variable: a('variable'), start: a('start'), end: a('end'),
      direction: (a('direction') || 'inc').toLowerCase() === 'dec' ? 'dec' : 'inc',
      step: a('step') || '1', body: kids(),
    });
    case 'call': return createStatement('call', { expression: a('expression') });
    case 'comment': return createStatement('comment', { text: a('text') });
    case 'breakpoint': return createStatement('breakpoint', {
      expression: a('expression'), always: x.attr('always', 'True') === '' ? true : bool(x.attr('always', 'True')),
    });
    // Turtle graphics are not supported: keep such shapes visible as comments so the file still opens.
    case 'turn': case 'forward': case 'home': case 'clear': case 'pen': {
      const detail = Object.entries(x.attrs).map(([k, v]) => `${k}=${v}`).join(', ');
      return createStatement('comment', { text: `[turtle] ${k}${detail ? ` (${detail})` : ''}` });
    }
    case 'open': return createStatement('open', {
      expression: a('expression'), mode: (a('mode') || 'read').toLowerCase() === 'write' ? 'write' : 'read',
    });
    case 'close': return createStatement('close');
    case 'read': return createStatement('read', { variable: a('variable') });
    case 'write': return createStatement('write', { expression: a('expression') });
    default: throw new Error(`Unsupported shape: ${x.name}`);
  }
}

function normType(t) {
  const found = RETURN_TYPES.find(x => x.toLowerCase() === String(t).toLowerCase());
  return found || 'Integer';
}

export function programToXml(program) {
  const now = new Date().toISOString();
  const attrs = { ...program.attributes, edited: now, saved: now };
  const root = new XmlNode('flowgorithm', { fileversion: FILE_VERSION }, [
    new XmlNode('attributes', {}, ['name', 'authors', 'about', 'saved', 'created', 'edited'].map(
      n => new XmlNode('attribute', { name: n, value: attrs[n] || '' }))),
    ...program.functions.map(functionToXml),
  ]);
  return '<?xml version="1.0"?>\n' + writeXml(root);
}

export function functionToXml(f) {
  return new XmlNode('function', { name: f.name, type: f.type, variable: f.variable }, [
    new XmlNode('parameters', {}, f.params.map(p =>
      new XmlNode('parameter', { name: p.name, type: p.type, array: boolText(p.array) }))),
    new XmlNode('body', {}, f.body.map(statementToXml)),
  ]);
}

export function functionFromXml(x) {
  const params = (x.child('parameters')?.children || []).map(p => ({
    name: p.attr('name'), type: normType(p.attr('type')), array: bool(p.attr('array')),
  }));
  const body = (x.child('body')?.children || []).map(statementFromXml);
  return createFunction(x.attr('name') || 'Main', {
    type: normType(x.attr('type') || 'None'), variable: x.attr('variable'), params, body,
  });
}

export function programFromXml(text) {
  const doc = parseXml(text);
  const root = doc.child('flowgorithm');
  if (!root) throw new Error('Invalid file format: <flowgorithm> expected');
  const program = createProgram();
  for (const a of root.child('attributes')?.childrenNamed('attribute') || []) {
    program.attributes[a.attr('name')] = a.attr('value');
  }
  program.functions = root.childrenNamed('function').map(functionFromXml);
  if (!program.functions.length) program.functions.push(createFunction('Main'));
  const main = program.functions.findIndex(f => f.name.toLowerCase() === 'main');
  if (main > 0) program.functions.unshift(...program.functions.splice(main, 1));
  return program;
}

// Clipboard payloads use the same XML vocabulary as files.
export function statementsToXml(list) {
  return writeXml(new XmlNode('clip', {}, list.map(statementToXml)));
}

export function statementsFromXml(text) {
  const clip = parseXml(text).child('clip');
  return clip ? clip.children.map(statementFromXml) : [];
}
