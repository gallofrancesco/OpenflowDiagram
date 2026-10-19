// Shared machinery for the source-code generators (C, C++, Java, Python).
// Every emitted line carries the id of the shape that produced it, so the
// code viewer can highlight the lines of the selected or executing shape.
import { parseExpression, typeOf, splitNames, PRECEDENCE, UNARY_PRECEDENCE } from '../expr.js';
import { walkStatements, isIncomplete } from '../model.js';

export const startKey = f => `start-${f.id}`;
export const endKey = f => `end-${f.id}`;

export class Generator {
  constructor(program, { reserved = [], indentUnit = '    ', messages = {} } = {}) {
    this.program = program;
    this.reserved = new Set(reserved.map(r => r.toLowerCase()));
    this.indentUnit = indentUnit;
    this.messages = messages;
    this.lines = [];
    this.needs = new Set();
    this.funcs = new Map();
    for (const f of program.functions) {
      this.funcs.set(f.name.toLowerCase(), { ...f, target: this.safeName(f.name) });
    }
  }

  msg(key, fallback) {
    return this.messages[key] || fallback;
  }

  safeName(name) {
    let n = name;
    while (this.reserved.has(n.toLowerCase())) n += '_';
    return n;
  }

  // Variables visible in a function: its parameters plus every Declare in its body.
  enterFunction(func) {
    const vars = new Map();
    for (const p of func.params) {
      vars.set(p.name.toLowerCase(), { name: p.name, type: p.type, array: p.array, param: true, target: this.safeName(p.name) });
    }
    for (const s of walkStatements(func.body)) {
      if (s.kind !== 'declare') continue;
      for (const name of splitNames(s.names)) {
        const key = name.toLowerCase();
        if (!vars.has(key)) vars.set(key, { name, type: s.type, array: s.array, target: this.safeName(name) });
      }
    }
    this.func = func;
    this.vars = vars;
    this.scope = {
      lookup: n => vars.get(n.toLowerCase()) || null,
      func: n => this.funcs.get(n.toLowerCase()) || null,
    };
  }

  varName(name) {
    return this.scope.lookup(name)?.target || this.safeName(name);
  }

  funcName(name) {
    return this.funcs.get(name.toLowerCase())?.target || this.safeName(name);
  }

  type(node) {
    return typeOf(node, this.scope);
  }

  emit(text, id, depth) {
    this.lines.push({ text: depth > 0 ? this.indentUnit.repeat(depth) + text : text, id });
  }

  // Parses user text; on failure returns null so generation can continue.
  parse(text) {
    try {
      return parseExpression(text);
    } catch {
      return null;
    }
  }

  // Renders an expression string, falling back to the raw text when it does not parse.
  ex(text) {
    const ast = this.parse(text);
    return ast ? this.expr(ast) : text;
  }

  // Wraps a rendered child in parentheses when the target language needs them.
  wrap(child, rendered, parentPrec, rightSide) {
    if (child.k !== 'bin') return rendered;
    const p = this.precOf(child);
    if (p < parentPrec || (rightSide && p === parentPrec)) return `(${rendered})`;
    return rendered;
  }

  precOf(node) {
    return PRECEDENCE[node.op] ?? UNARY_PRECEDENCE;
  }

  binaryParts(node, prec = this.precOf(node)) {
    return [this.wrap(node.l, this.expr(node.l), prec, false), this.wrap(node.r, this.expr(node.r), prec, true)];
  }

  unaryOperand(node) {
    const e = node.e;
    const rendered = this.expr(e);
    return e.k === 'bin' ? `(${rendered})` : rendered;
  }

  expr(node) {
    switch (node.k) {
      case 'lit': return this.literal(node);
      case 'paren': return `(${this.expr(node.e)})`;
      case 'var': return node.index ? `${this.varName(node.name)}[${this.expr(node.index)}]` : this.varName(node.name);
      case 'un': return this.unary(node);
      case 'bin': return this.binary(node);
      case 'call': return this.call(node);
      default: return '';
    }
  }

  block(list, depth) {
    for (const s of list) {
      if (isIncomplete(s) && s.kind !== 'comment') {
        this.comment(`${this.msg('incomplete', 'Incomplete shape')}: ${s.kind}`, s.id, depth);
        continue;
      }
      this.statement(s, depth);
    }
  }

  generate() {
    this.lines = [];
    this.needs = new Set();
    this.program_();
    const prelude = this.prelude();
    return [...prelude.map(text => ({ text, id: null })), ...this.lines];
  }
}

export function quote(s, { single = false } = {}) {
  const q = single ? "'" : '"';
  let out = q;
  for (const ch of s) {
    if (ch === '\\') out += '\\\\';
    else if (ch === q) out += '\\' + q;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\r') out += '\\r';
    else out += ch;
  }
  return out + q;
}
