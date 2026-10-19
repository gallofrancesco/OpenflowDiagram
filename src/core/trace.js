// Trace table: one row per executed shape, with the values the user chose to follow.
import { parseExpression, walkExpression, BUILTINS, splitNames } from './expr.js';
import { walkStatements } from './model.js';

export const MAX_TRACE_ROWS = 10000;

// Variables that can be traced, grouped by function: [{ func, vars: [{ name, type, array }] }].
export function traceableVariables(program) {
  return program.functions.map(f => {
    const seen = new Set();
    const vars = [];
    const add = (name, type, array) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return;
      seen.add(key);
      vars.push({ name, type, array });
    };
    for (const p of f.params) add(p.name, p.type, p.array);
    for (const s of walkStatements(f.body)) {
      if (s.kind === 'declare') for (const n of splitNames(s.names)) add(n, s.type, s.array);
    }
    return { func: f.name, vars };
  });
}

// Returns an error key for an expression that cannot be traced, or null.
export function checkTraceExpression(text) {
  let ast;
  try {
    ast = parseExpression(text);
  } catch (e) {
    return e.code || 'errSyntaxUnexpected';
  }
  for (const n of walkExpression(ast)) {
    if (n.k === 'call' && !BUILTINS[n.name.toLowerCase()]) return 'traceNoUserCalls';
  }
  return null;
}

/*
 config = { items: [{ func, kind: 'var' | 'expr', text }], output: boolean }
 caption(stmt) gives the text shown for a shape.
*/
export class TraceRecorder {
  constructor(config, caption) {
    this.config = config;
    this.caption = caption;
    this.rows = [];
    this.pendingOutput = '';
    this.truncated = false;
    this.version = 0;
  }

  addOutput(text) {
    if (this.config.output) this.pendingOutput += text;
  }

  // Called for 'after' and 'decision' interpreter events.
  record(ev, interpreter) {
    if (this.rows.length >= MAX_TRACE_ROWS) {
      this.truncated = true;
      return;
    }
    const prev = this.rows[this.rows.length - 1];
    const values = interpreter.traceValues(this.config.items).map((v, i) => {
      const before = prev?.values[i];
      const changed = !prev || before.state !== v.state || before.text !== v.text;
      return { ...v, changed: changed && v.state === 'ok' };
    });
    this.rows.push({
      n: this.rows.length + 1,
      func: ev.func.name,
      block: this.caption(ev.stmt),
      result: ev.type === 'decision' ? ev.value : null,
      values,
      output: this.pendingOutput.replace(/\n$/, ''),
    });
    this.pendingOutput = '';
    this.version++;
  }
}
