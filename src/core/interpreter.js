// Step-by-step interpreter. run() is a generator: it yields an event before every statement
// so the UI can highlight shapes, pause on breakpoints, single-step and ask for input.
import {
  FlowError, parseExpression, parseTarget, isValidIdentifier, splitNames, BUILTINS, walkExpression,
} from './expr.js';
import { findFunction, isIncomplete, walkStatements } from './model.js';

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;

const val = (t, v) => ({ t, v });
const CONTROL_KINDS = new Set(['if', 'while', 'do', 'for', 'breakpoint']);
const isNum = x => x.t === 'Integer' || x.t === 'Real';

export function formatReal(v) {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  return String(parseFloat(v.toPrecision(15)));
}

export function formatValue(x) {
  if (!x) return '?';
  switch (x.t) {
    case 'Integer': return String(x.v);
    case 'Real': return formatReal(x.v);
    case 'Boolean': return x.v ? 'true' : 'false';
    default: return x.v;
  }
}

function makeInt(v) {
  if (!Number.isFinite(v) || v < INT_MIN || v > INT_MAX) throw new FlowError('errOverflow');
  return val('Integer', v);
}

function makeReal(v) {
  if (!Number.isFinite(v)) throw new FlowError('errOverflow');
  return val('Real', v);
}

// Converts text typed by the user (or read from a file) into a value of the given type.
export function parseInputValue(text, type) {
  const s = String(text).trim();
  switch (type) {
    case 'Integer':
      if (!/^[+-]?\d+$/.test(s)) throw new FlowError('errIllegalValue', { value: text, type });
      return makeInt(parseInt(s, 10));
    case 'Real':
      if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) throw new FlowError('errIllegalValue', { value: text, type });
      return makeReal(parseFloat(s));
    case 'Boolean': {
      const l = s.toLowerCase();
      if (['true', 'vero', 'yes', 'si', 'sì'].includes(l)) return val('Boolean', true);
      if (['false', 'falso', 'no'].includes(l)) return val('Boolean', false);
      throw new FlowError('errIllegalValue', { value: text, type });
    }
    default:
      return val('String', String(text));
  }
}

// Returns the value converted to `type`, or null if the assignment is not allowed.
function coerce(x, type) {
  if (x.t === type) return x;
  if (type === 'Real' && x.t === 'Integer') return val('Real', x.v);
  return null;
}

/* ---------- static checks run before execution ---------- */

export function validateProgram(program) {
  const seen = new Set();
  if (!findFunction(program, 'Main')) throw new FlowError('errFunctionUndefined', { name: 'Main' });
  for (const f of program.functions) {
    const lower = f.name.toLowerCase();
    if (seen.has(lower) || BUILTINS[lower]) throw new FlowError('errDuplicateDefinition', { name: f.name });
    seen.add(lower);
    for (const s of walkStatements(f.body)) {
      if (s.kind === 'comment') continue;
      if (isIncomplete(s)) throw new FlowError('errIncomplete', {}, s.id);
      try {
        for (const text of expressionsOf(s)) {
          const ast = parseExpression(text);
          for (const n of walkExpression(ast)) {
            if (n.k === 'call' && !BUILTINS[n.name.toLowerCase()] && !findFunction(program, n.name)) {
              throw new FlowError('errFunctionUndefined', { name: n.name });
            }
          }
        }
        if (s.kind === 'declare') {
          for (const name of splitNames(s.names)) {
            if (!isValidIdentifier(name)) throw new FlowError('errIdentifierInvalid', { name });
          }
        }
        if (s.kind === 'call' && parseExpression(s.expression).k !== 'call') {
          throw new FlowError('errFunctionUndefined', { name: s.expression });
        }
      } catch (e) {
        if (e instanceof FlowError && e.stmtId == null) e.stmtId = s.id;
        throw e;
      }
    }
  }
}

function expressionsOf(s) {
  switch (s.kind) {
    case 'declare': return s.array ? [s.size] : [];
    case 'assign': return [s.variable, s.expression];
    case 'input': case 'read': return [s.variable];
    case 'for': return [s.variable, s.start, s.end, s.step || '1'];
    case 'breakpoint': return s.always ? [] : [s.expression];
    case 'close': case 'comment': return [];
    default: return [s.expression];
  }
}

/* ---------- runtime ---------- */

export class Interpreter {
  /*
   host = {
     output(text, newline),
     files: { read(name) -> string (throws if missing), write(name, text) },
   }
  */
  constructor(program, host, { maxStack = 200 } = {}) {
    this.program = program;
    this.host = host;
    this.maxStack = maxStack;
    this.frames = [];
    this.file = null;
    this.astCache = new Map();
  }

  ast(text) {
    let a = this.astCache.get(text);
    if (!a) {
      a = parseExpression(text);
      this.astCache.set(text, a);
    }
    return a;
  }

  get currentFrame() {
    return this.frames[this.frames.length - 1];
  }

  *run() {
    validateProgram(this.program);
    const main = findFunction(this.program, 'Main');
    try {
      yield* this.invoke(main, []);
    } finally {
      this.closeFile();
    }
  }

  closeFile() {
    if (this.file && this.file.mode === 'write') {
      this.host.files.write(this.file.name, this.file.lines.map(l => l + '\n').join(''));
    }
    this.file = null;
  }

  *invoke(func, args) {
    if (this.frames.length >= this.maxStack) throw new FlowError('errStackOverflow');
    const frame = { func, vars: new Map(), order: [], declaredBy: new Map() };
    func.params.forEach((p, i) => {
      const rec = p.array ? args[i] : { name: p.name, type: p.type, array: false, value: args[i], param: true };
      frame.vars.set(p.name.toLowerCase(), rec);
      frame.order.push({ label: p.name, rec, param: true });
    });
    this.frames.push(frame);
    try {
      yield { type: 'terminal', func, which: 'start' };
      yield* this.block(func.body);
      let result = null;
      if (func.type !== 'None') {
        const rec = frame.vars.get(func.variable.toLowerCase());
        if (!func.variable || !rec) throw new FlowError('errMissingReturnVariable', { name: func.name });
        if (rec.value == null) throw new FlowError('errVariableUninitialized', { name: rec.name });
        result = coerce(rec.value, func.type);
        if (!result) throw new FlowError('errAssignTypeMismatch', { name: func.name });
      }
      yield { type: 'terminal', func, which: 'end' };
      return result;
    } finally {
      this.frames.pop();
    }
  }

  *block(list) {
    for (const s of list) {
      if (s.kind === 'comment') continue;
      yield { type: 'statement', stmt: s, func: this.currentFrame.func };
      try {
        yield* this.exec(s);
        // Trace tables record a row once a simple statement has taken effect;
        // decisions (If and loops) report their own rows through 'decision' events.
        if (!CONTROL_KINDS.has(s.kind)) yield { type: 'after', stmt: s, func: this.currentFrame.func };
      } catch (e) {
        if (e instanceof FlowError && e.stmtId == null) {
          e.stmtId = s.id;
          e.funcName = this.currentFrame.func.name;
        }
        throw e;
      }
    }
  }

  lookup(name) {
    const rec = this.currentFrame.vars.get(name.toLowerCase());
    if (!rec) throw new FlowError('errVariableUndeclared', { name });
    return rec;
  }

  *condition(text) {
    const c = yield* this.ev(this.ast(text));
    if (c.t !== 'Boolean') throw new FlowError('errBooleanMismatch');
    return c.v;
  }

  // Evaluates the condition of an If/While/Do and reports the outcome.
  *decide(s) {
    const value = yield* this.condition(s.expression);
    yield { type: 'decision', stmt: s, func: this.currentFrame.func, value };
    return value;
  }

  *exec(s) {
    const frame = this.currentFrame;
    switch (s.kind) {
      case 'declare': {
        let size = 0;
        if (s.array) {
          const n = yield* this.ev(this.ast(s.size));
          if (n.t !== 'Integer') throw new FlowError('errSubscriptTypeMismatch');
          if (n.v < 1) throw new FlowError('errIllegalValue', { value: n.v, type: 'Integer' });
          size = n.v;
        }
        for (const name of splitNames(s.names)) {
          if (!isValidIdentifier(name)) throw new FlowError('errIdentifierInvalid', { name });
          const key = name.toLowerCase();
          const existing = frame.vars.get(key);
          // Re-running the same Declare (e.g. inside a loop) re-creates the variable.
          if (existing && frame.declaredBy.get(key) !== s.id) throw new FlowError('errDuplicateDefinition', { name });
          const rec = s.array
            ? { name, type: s.type, array: true, items: new Array(size).fill(null) }
            : { name, type: s.type, array: false, value: null };
          if (existing) {
            const entry = frame.order.find(o => o.rec === existing);
            entry.rec = rec;
          } else {
            frame.order.push({ label: name, rec });
          }
          frame.vars.set(key, rec);
          frame.declaredBy.set(key, s.id);
        }
        return;
      }
      case 'assign': {
        const target = this.ast(s.variable);
        if (target.k !== 'var') throw new FlowError('errIdentifierInvalid', { name: s.variable });
        const value = yield* this.ev(this.ast(s.expression));
        yield* this.store(target, value);
        return;
      }
      case 'input': {
        const target = parseTarget(s.variable);
        const rec = this.lookup(target.name);
        const text = yield { type: 'input', name: s.variable, varType: rec.type };
        yield* this.store(target, parseInputValue(text ?? '', rec.type));
        return;
      }
      case 'output': {
        const v = yield* this.ev(this.ast(s.expression));
        this.host.output(formatValue(v), s.newline);
        return;
      }
      case 'if': {
        const c = yield* this.decide(s);
        yield* this.block(c ? s.then : s.else);
        return;
      }
      case 'while':
        while (yield* this.decide(s)) {
          yield* this.block(s.body);
          yield { type: 'statement', stmt: s, func: frame.func };
        }
        return;
      case 'do':
        for (;;) {
          yield* this.block(s.body);
          yield { type: 'statement', stmt: s, func: frame.func };
          if (!(yield* this.decide(s))) break;
        }
        return;
      case 'for': {
        const target = this.ast(s.variable);
        if (target.k !== 'var' || target.index) throw new FlowError('errIdentifierInvalid', { name: s.variable });
        const rec = this.lookup(target.name);
        if (rec.array) throw new FlowError('errMissingSubscript', { name: rec.name });
        const start = yield* this.ev(this.ast(s.start));
        const end = yield* this.ev(this.ast(s.end));
        const step = yield* this.ev(this.ast(s.step || '1'));
        for (const x of [start, end, step]) if (!isNum(x)) throw new FlowError('errMathMismatch');
        if (step.v === 0) throw new FlowError('errStepIsZero');
        if (step.v < 0) throw new FlowError('errStepIsNegative');
        const real = rec.type === 'Real';
        if (!real && rec.type !== 'Integer') throw new FlowError('errAssignTypeMismatch', { name: rec.name });
        if (!real && [start, end, step].some(x => x.t === 'Real')) throw new FlowError('errAssignTypeMismatch', { name: rec.name });
        const inc = s.direction !== 'dec';
        let i = start.v;
        let first = true;
        for (;;) {
          if (!first) yield { type: 'statement', stmt: s, func: frame.func };
          first = false;
          const go = inc ? i <= end.v : i >= end.v;
          // The variable keeps its last in-range value once the loop ends.
          if (go) rec.value = real ? makeReal(i) : makeInt(i);
          yield { type: 'decision', stmt: s, func: frame.func, value: go };
          if (!go) break;
          yield* this.block(s.body);
          // The body may have changed the loop variable, as in the original language.
          i = (rec.value ? rec.value.v : i) + (inc ? step.v : -step.v);
        }
        return;
      }
      case 'call': {
        const ast = this.ast(s.expression);
        if (ast.k !== 'call') throw new FlowError('errFunctionUndefined', { name: s.expression });
        yield* this.callFunction(ast, false);
        return;
      }
      case 'breakpoint': {
        if (s.always || (yield* this.condition(s.expression))) yield { type: 'breakpoint', stmt: s };
        return;
      }
      case 'open': {
        if (this.file) throw new FlowError('errFileAlreadyOpen');
        const name = yield* this.ev(this.ast(s.expression));
        if (name.t !== 'String' || !name.v.trim()) throw new FlowError('errIllegalValue', { value: formatValue(name), type: 'String' });
        if (s.mode === 'read') {
          let text;
          try {
            text = this.host.files.read(name.v);
          } catch {
            throw new FlowError('errFileNotFound', { name: name.v });
          }
          const lines = text.replace(/\r\n?/g, '\n').split('\n');
          if (lines.length && lines[lines.length - 1] === '') lines.pop();
          this.file = { name: name.v, mode: 'read', lines, pos: 0 };
        } else {
          try {
            this.host.files.write(name.v, '');
          } catch {
            throw new FlowError('errCannotAccessFile', { name: name.v });
          }
          this.file = { name: name.v, mode: 'write', lines: [] };
        }
        return;
      }
      case 'close':
        if (!this.file) throw new FlowError('errFileNotOpen');
        this.closeFile();
        return;
      case 'read': {
        if (!this.file) throw new FlowError('errFileNotOpen');
        if (this.file.mode !== 'read') throw new FlowError('errInvalidFileMode');
        if (this.file.pos >= this.file.lines.length) throw new FlowError('errReadPastEnd');
        const target = parseTarget(s.variable);
        const rec = this.lookup(target.name);
        const line = this.file.lines[this.file.pos++];
        yield* this.store(target, parseInputValue(line, rec.type));
        return;
      }
      case 'write': {
        if (!this.file) throw new FlowError('errFileNotOpen');
        if (this.file.mode !== 'write') throw new FlowError('errInvalidFileMode');
        const v = yield* this.ev(this.ast(s.expression));
        this.file.lines.push(formatValue(v));
        return;
      }
      default:
        return;
    }
  }

  *store(target, value) {
    const rec = this.lookup(target.name);
    const converted = coerce(value, rec.type);
    if (!converted) throw new FlowError('errAssignTypeMismatch', { name: rec.name });
    if (target.index) {
      if (!rec.array) throw new FlowError('errNotArray', { name: rec.name });
      const i = yield* this.subscript(target.index, rec);
      rec.items[i] = converted;
    } else {
      if (rec.array) throw new FlowError('errMissingSubscript', { name: rec.name });
      rec.value = converted;
    }
  }

  *subscript(node, rec) {
    const i = yield* this.ev(node);
    if (i.t !== 'Integer') throw new FlowError('errSubscriptTypeMismatch');
    if (i.v < 0 || i.v >= rec.items.length) throw new FlowError('errBadSubscript', { index: i.v, name: rec.name });
    return i.v;
  }

  *ev(node) {
    switch (node.k) {
      case 'lit': return val(node.type, node.value);
      case 'paren': return yield* this.ev(node.e);
      case 'var': {
        const rec = this.lookup(node.name);
        if (node.index) {
          if (!rec.array) throw new FlowError('errNotArray', { name: rec.name });
          const i = yield* this.subscript(node.index, rec);
          const x = rec.items[i];
          if (!x) throw new FlowError('errVariableUninitialized', { name: `${rec.name}[${i}]` });
          return x;
        }
        if (rec.array) throw new FlowError('errMissingSubscript', { name: rec.name });
        if (!rec.value) throw new FlowError('errVariableUninitialized', { name: rec.name });
        return rec.value;
      }
      case 'un': {
        const x = yield* this.ev(node.e);
        if (node.op === '-') {
          if (!isNum(x)) throw new FlowError('errNegateTypeMismatch');
          return x.t === 'Integer' ? makeInt(-x.v) : makeReal(-x.v);
        }
        if (x.t !== 'Boolean') throw new FlowError('errNotTypeMismatch');
        return val('Boolean', !x.v);
      }
      case 'bin': return yield* this.binary(node);
      case 'call': {
        const r = yield* this.callFunction(node, true);
        return r;
      }
      default:
        throw new FlowError('errSyntaxUnexpected', { token: node.k });
    }
  }

  *binary(node) {
    const { op } = node;
    if (op === '&&' || op === '||') {
      const l = yield* this.ev(node.l);
      if (l.t !== 'Boolean') throw new FlowError('errBooleanMismatch');
      if (op === '&&' && !l.v) return l;
      if (op === '||' && l.v) return l;
      const r = yield* this.ev(node.r);
      if (r.t !== 'Boolean') throw new FlowError('errBooleanMismatch');
      return r;
    }
    const l = yield* this.ev(node.l);
    const r = yield* this.ev(node.r);
    switch (op) {
      case '&': return val('String', formatValue(l) + formatValue(r));
      case '+':
        if (l.t === 'String' || r.t === 'String') {
          if (l.t === 'Boolean' || r.t === 'Boolean') throw new FlowError('errMathMismatch');
          return val('String', formatValue(l) + formatValue(r));
        }
      // falls through
      case '-': case '*': case '/': case '%': case '^': {
        if (!isNum(l) || !isNum(r)) throw new FlowError('errMathMismatch');
        const ints = l.t === 'Integer' && r.t === 'Integer';
        switch (op) {
          case '+': return ints ? makeInt(l.v + r.v) : makeReal(l.v + r.v);
          case '-': return ints ? makeInt(l.v - r.v) : makeReal(l.v - r.v);
          case '*': return ints ? makeInt(l.v * r.v) : makeReal(l.v * r.v);
          case '/':
            if (r.v === 0) throw new FlowError('errDivideByZero');
            return makeReal(l.v / r.v);
          case '%':
            if (r.v === 0) throw new FlowError('errModulusByZero');
            return ints ? makeInt(l.v % r.v) : makeReal(l.v % r.v);
          case '^': {
            const p = Math.pow(l.v, r.v);
            if (Number.isNaN(p)) throw new FlowError('errIllegalValue', { value: `${formatValue(l)}^${formatValue(r)}`, type: 'Real' });
            return ints && r.v >= 0 ? makeInt(p) : makeReal(p);
          }
        }
        break;
      }
      case '==': case '!=': {
        const same = (isNum(l) && isNum(r)) || l.t === r.t;
        if (!same) throw new FlowError('errEqualityTypeMismatch');
        const eq = l.v === r.v;
        return val('Boolean', op === '==' ? eq : !eq);
      }
      default: {
        const ok = (isNum(l) && isNum(r)) || (l.t === 'String' && r.t === 'String');
        if (!ok) throw new FlowError('errCompareMismatch');
        const a = l.v, b = r.v;
        const res = op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
        return val('Boolean', res);
      }
    }
    throw new FlowError('errSyntaxUnexpected', { token: op });
  }

  *callFunction(node, needValue) {
    const lower = node.name.toLowerCase();
    if (BUILTINS[lower]) return yield* this.builtin(lower, node);
    const func = findFunction(this.program, node.name);
    if (!func) throw new FlowError('errFunctionUndefined', { name: node.name });
    if (node.args.length !== func.params.length) {
      throw new FlowError('errArgumentCountMismatch', { name: func.name, expected: func.params.length, got: node.args.length });
    }
    const args = [];
    for (let i = 0; i < func.params.length; i++) {
      const p = func.params[i];
      const a = node.args[i];
      if (p.array) {
        // Arrays are passed by reference.
        if (a.k !== 'var' || a.index) throw new FlowError('errArgumentTypeMismatch', { name: func.name, index: i + 1 });
        const rec = this.lookup(a.name);
        if (!rec.array || rec.type !== p.type) throw new FlowError('errArgumentTypeMismatch', { name: func.name, index: i + 1 });
        args.push(rec);
      } else {
        const v = coerce(yield* this.ev(a), p.type);
        if (!v) throw new FlowError('errArgumentTypeMismatch', { name: func.name, index: i + 1 });
        args.push(v);
      }
    }
    const result = yield* this.invoke(func, args);
    if (needValue && !result) throw new FlowError('errFunctionReturnsNoValue', { name: func.name });
    return result;
  }

  *builtin(lower, node) {
    const def = BUILTINS[lower];
    if (node.args.length !== def.args.length) {
      throw new FlowError('errArgumentCountMismatch', { name: def.name, expected: def.args.length, got: node.args.length });
    }
    if (lower === 'size') {
      const a = node.args[0];
      if (a.k !== 'var' || a.index) throw new FlowError('errNotArray', { name: def.name });
      const rec = this.lookup(a.name);
      if (!rec.array) throw new FlowError('errNotArray', { name: rec.name });
      return makeInt(rec.items.length);
    }
    if (lower === 'eof') {
      if (!this.file) throw new FlowError('errFileNotOpen');
      if (this.file.mode !== 'read') throw new FlowError('errInvalidFileMode');
      return val('Boolean', this.file.pos >= this.file.lines.length);
    }
    const args = [];
    for (let i = 0; i < node.args.length; i++) {
      const v = yield* this.ev(node.args[i]);
      const want = def.args[i];
      const ok = want === 'Any' || (want === 'Number' ? isNum(v) : v.t === want);
      if (!ok) throw new FlowError('errArgumentTypeMismatch', { name: def.name, index: i + 1 });
      args.push(v);
    }
    const [a, b] = args;
    const illegal = () => new FlowError('errIllegalValue', { value: formatValue(a), type: a.t });
    switch (lower) {
      case 'abs': return a.t === 'Integer' ? makeInt(Math.abs(a.v)) : makeReal(Math.abs(a.v));
      case 'arccos': if (a.v < -1 || a.v > 1) throw illegal(); return makeReal(Math.acos(a.v));
      case 'arcsin': if (a.v < -1 || a.v > 1) throw illegal(); return makeReal(Math.asin(a.v));
      case 'arctan': return makeReal(Math.atan(a.v));
      case 'char':
        if (b.v < 0 || b.v >= a.v.length) throw new FlowError('errBadSubscript', { index: b.v, name: def.name });
        return val('String', a.v[b.v]);
      case 'cos': return makeReal(Math.cos(a.v));
      case 'int': return makeInt(Math.trunc(a.v));
      case 'len': return makeInt(a.v.length);
      case 'log': if (a.v <= 0) throw illegal(); return makeReal(Math.log(a.v));
      case 'log10': if (a.v <= 0) throw illegal(); return makeReal(Math.log10(a.v));
      case 'random': if (a.v <= 0) throw illegal(); return makeInt(Math.floor(Math.random() * a.v));
      case 'sgn': return makeInt(Math.sign(a.v));
      case 'sin': return makeReal(Math.sin(a.v));
      case 'sqrt': if (a.v < 0) throw illegal(); return makeReal(Math.sqrt(a.v));
      case 'tan': return makeReal(Math.tan(a.v));
      case 'tochar': if (a.v < 0 || a.v > 0x10ffff) throw illegal(); return val('String', String.fromCodePoint(a.v));
      case 'tocode': if (!a.v.length) throw illegal(); return makeInt(a.v.codePointAt(0));
      case 'tofixed': if (b.v < 0 || b.v > 100) throw illegal(); return val('String', a.v.toFixed(b.v));
      case 'tointeger':
        if (a.t === 'String') return parseInputValue(a.v, 'Integer');
        if (a.t === 'Boolean') throw new FlowError('errArgumentTypeMismatch', { name: def.name, index: 1 });
        return makeInt(Math.trunc(a.v));
      case 'toreal':
        if (a.t === 'String') return parseInputValue(a.v, 'Real');
        if (a.t === 'Boolean') throw new FlowError('errArgumentTypeMismatch', { name: def.name, index: 1 });
        return makeReal(a.v);
      case 'tostring': return val('String', formatValue(a));
    }
    throw new FlowError('errFunctionUndefined', { name: def.name });
  }

  /*
   Values for the trace table. items: [{ func, kind: 'var' | 'expr', text }].
   Each item is read in the most recent activation of its function; results are
   { state: 'ok', text } | { state: 'uninit' } | { state: 'absent' } | { state: 'error' }.
   Traced expressions never call program functions (checked when they are chosen),
   so evaluating them cannot yield or change the program's state.
  */
  traceValues(items) {
    return items.map(item => {
      const frame = [...this.frames].reverse().find(f => f.func.name.toLowerCase() === item.func.toLowerCase());
      if (!frame) return { state: 'absent' };
      if (item.kind === 'var') {
        const rec = frame.vars.get(item.text.toLowerCase());
        if (!rec) return { state: 'absent' };
        if (rec.array) return { state: 'ok', text: `[${rec.items.map(x => (x ? formatValue(x) : '?')).join(', ')}]` };
        return rec.value ? { state: 'ok', text: formatValue(rec.value) } : { state: 'uninit' };
      }
      this.frames.push(frame);
      try {
        const g = this.ev(this.ast(item.text));
        let r = g.next();
        while (!r.done) r = g.next();
        return { state: 'ok', text: formatValue(r.value) };
      } catch (e) {
        if (e instanceof FlowError && e.code === 'errVariableUninitialized') return { state: 'uninit' };
        if (e instanceof FlowError && e.code === 'errVariableUndeclared') return { state: 'absent' };
        return { state: 'error' };
      } finally {
        this.frames.pop();
      }
    });
  }

  // Snapshot of the call stack for the Variables window.
  watch() {
    return this.frames.map(f => ({
      func: f.func.name,
      vars: f.order.map(({ label, rec, param }) => ({
        name: label,
        type: rec.type,
        param: !!param,
        array: rec.array,
        value: rec.array ? null : formatValueOrNull(rec.value),
        items: rec.array ? rec.items.map(formatValueOrNull) : null,
      })),
    }));
  }
}

const formatValueOrNull = v => (v ? formatValue(v) : null);
