import { CFamilyGenerator, C_RESERVED } from './cfamily.js';
import { splitNames } from '../expr.js';

const RESERVED = [
  ...C_RESERVED, 'fg_concat', 'fg_itos', 'fg_rtos', 'fg_btos', 'fg_input', 'fg_char', 'fg_tochar', 'fg_tofixed',
  'fg_file', 'fg_readline', 'fg_eof', 'FILE', 'string', 'atoi', 'atof', 'fopen', 'fclose', 'fprintf', 'fgets',
];

const TYPE = { Integer: 'int', Real: 'double', String: 'char *', Boolean: 'bool' };
const FORMAT = { Integer: '%d', Real: '%g', String: '%s', Boolean: '%s' };
const PARSE = {
  Integer: s => `atoi(${s})`,
  Real: s => `atof(${s})`,
  Boolean: s => `strcmp(${s}, "true") == 0`,
  String: s => s,
};

// Helper functions emitted on demand, with the helpers each one relies on.
const HELPERS = {
  fg_concat: { code: [
    'char *fg_concat(const char *a, const char *b) {',
    '    char *r = malloc(strlen(a) + strlen(b) + 1);',
    '    strcpy(r, a);',
    '    strcat(r, b);',
    '    return r;',
    '}',
  ] },
  fg_itos: { code: [
    'char *fg_itos(int x) {',
    '    char *r = malloc(16);',
    '    sprintf(r, "%d", x);',
    '    return r;',
    '}',
  ] },
  fg_rtos: { code: [
    'char *fg_rtos(double x) {',
    '    char *r = malloc(32);',
    '    sprintf(r, "%g", x);',
    '    return r;',
    '}',
  ] },
  fg_btos: { code: ['char *fg_btos(bool x) {', '    return x ? "true" : "false";', '}'] },
  fg_input: { code: [
    'char *fg_input(void) {',
    '    char buffer[1024];',
    '    if (!fgets(buffer, sizeof buffer, stdin)) buffer[0] = 0;',
    '    buffer[strcspn(buffer, "\\r\\n")] = 0;',
    '    char *r = malloc(strlen(buffer) + 1);',
    '    strcpy(r, buffer);',
    '    return r;',
    '}',
  ] },
  fg_char: { code: [
    'char *fg_char(const char *s, int i) {',
    '    char *r = malloc(2);',
    '    r[0] = s[i];',
    '    r[1] = 0;',
    '    return r;',
    '}',
  ] },
  fg_tochar: { code: [
    'char *fg_tochar(int c) {',
    '    char *r = malloc(2);',
    '    r[0] = (char) c;',
    '    r[1] = 0;',
    '    return r;',
    '}',
  ] },
  fg_tofixed: { code: [
    'char *fg_tofixed(double x, int digits) {',
    '    char *r = malloc(64);',
    '    sprintf(r, "%.*f", digits, x);',
    '    return r;',
    '}',
  ] },
  fg_file: { code: ['FILE *fg_file;'] },
  fg_readline: { deps: ['fg_file'], code: [
    'char *fg_readline(void) {',
    '    char buffer[1024];',
    '    if (!fgets(buffer, sizeof buffer, fg_file)) buffer[0] = 0;',
    '    buffer[strcspn(buffer, "\\r\\n")] = 0;',
    '    char *r = malloc(strlen(buffer) + 1);',
    '    strcpy(r, buffer);',
    '    return r;',
    '}',
  ] },
  fg_eof: { deps: ['fg_file'], code: [
    'bool fg_eof(void) {',
    '    int c = fgetc(fg_file);',
    '    if (c == EOF) return true;',
    '    ungetc(c, fg_file);',
    '    return false;',
    '}',
  ] },
};

export class CGenerator extends CFamilyGenerator {
  static key = 'c';
  static label = 'C';
  static extension = 'c';

  constructor(program, opts = {}) {
    super(program, { ...opts, reserved: RESERVED });
  }

  seedRandom() {
    return 'srand(time(NULL));';
  }

  sizeName(name) {
    return `${this.varName(name)}_size`;
  }

  functionHeader(f) {
    const params = f.params.map(p => p.array
      ? `${TYPE[p.type]}${TYPE[p.type].endsWith('*') ? '' : ' '}${this.varName(p.name)}[], int ${this.sizeName(p.name)}`
      : `${TYPE[p.type]}${TYPE[p.type].endsWith('*') ? '' : ' '}${this.varName(p.name)}`);
    const ret = f.type === 'None' ? 'void' : TYPE[f.type];
    return `${ret}${ret.endsWith('*') ? '' : ' '}${this.funcName(f.name)}(${params.length ? params.join(', ') : 'void'})`;
  }

  prelude() {
    const n = this.needs;
    const inc = ['stdio.h', 'stdlib.h', 'stdbool.h', 'string.h'];
    if (n.has('math') || n.has('pi')) inc.push('math.h');
    if (n.has('random')) inc.push('time.h');
    const out = inc.map(h => `#include <${h}>`);
    out.push('');
    if (n.has('pi')) out.push('#ifndef M_PI', '#define M_PI 3.14159265358979323846', '#endif', '');
    const done = new Set();
    const add = name => {
      if (done.has(name)) return;
      done.add(name);
      for (const d of HELPERS[name].deps || []) add(d);
      out.push(...HELPERS[name].code, '');
    };
    for (const name of Object.keys(HELPERS)) if (n.has(name)) add(name);
    return out;
  }

  decl(type, name) {
    const t = TYPE[type];
    return t.endsWith('*') ? `${t}${name}` : `${t} ${name}`;
  }

  specific(s, d) {
    const id = s.id;
    switch (s.kind) {
      case 'declare':
        for (const name of splitNames(s.names)) {
          if (s.array) {
            this.emit(`${this.decl(s.type, this.varName(name))}[${this.ex(s.size)}];`, id, d);
            this.emit(`int ${this.sizeName(name)} = ${this.ex(s.size)};`, id, d);
          } else {
            this.emit(`${this.decl(s.type, this.varName(name))};`, id, d);
          }
        }
        break;
      case 'assign': this.emit(`${this.ex(s.variable)} = ${this.ex(s.expression)};`, id, d); break;
      case 'input': {
        this.needs.add('fg_input');
        const t = this.parse(s.variable);
        this.emit(`${this.ex(s.variable)} = ${PARSE[t ? this.type(t) : 'String']('fg_input()')};`, id, d);
        break;
      }
      case 'output': {
        const [fmt, arg] = this.formatted(s.expression);
        this.emit(`printf("${fmt}${s.newline ? '\\n' : ''}", ${arg});`, id, d);
        break;
      }
      case 'open':
        this.needs.add('fg_file');
        this.emit(`fg_file = fopen(${this.ex(s.expression)}, "${s.mode === 'write' ? 'w' : 'r'}");`, id, d);
        break;
      case 'close': this.needs.add('fg_file'); this.emit('fclose(fg_file);', id, d); break;
      case 'read': {
        this.needs.add('fg_readline');
        const t = this.parse(s.variable);
        this.emit(`${this.ex(s.variable)} = ${PARSE[t ? this.type(t) : 'String']('fg_readline()')};`, id, d);
        break;
      }
      case 'write': {
        this.needs.add('fg_file');
        const [fmt, arg] = this.formatted(s.expression);
        this.emit(`fprintf(fg_file, "${fmt}\\n", ${arg});`, id, d);
        break;
      }
    }
  }

  // printf format and argument for an expression of any type.
  formatted(text) {
    const e = this.parse(text);
    if (!e) return ['%s', text];
    const type = this.type(e);
    const r = this.expr(e);
    if (type === 'Boolean') return ['%s', `${e.k === 'bin' ? `(${r})` : r} ? "true" : "false"`];
    return [FORMAT[type], r];
  }

  toStr(node) {
    const r = this.expr(node);
    switch (this.type(node)) {
      case 'Integer': this.needs.add('fg_itos'); return `fg_itos(${r})`;
      case 'Real': this.needs.add('fg_rtos'); return `fg_rtos(${r})`;
      case 'Boolean': this.needs.add('fg_btos'); return `fg_btos(${r})`;
      default: return r;
    }
  }

  binary(n) {
    const lt = this.type(n.l), rt = this.type(n.r);
    if (n.op === '&' || (n.op === '+' && (lt === 'String' || rt === 'String'))) {
      this.needs.add('fg_concat');
      return `fg_concat(${this.toStr(n.l)}, ${this.toStr(n.r)})`;
    }
    if (lt === 'String' && rt === 'String' && ['==', '!=', '<', '<=', '>', '>='].includes(n.op)) {
      return `strcmp(${this.expr(n.l)}, ${this.expr(n.r)}) ${n.op} 0`;
    }
    const [l, r] = this.binaryParts(n);
    return this.numericBinary(n, l, r);
  }

  precOf(node) {
    // Concatenation becomes a function call, and strcmp comparisons stay relational.
    return node.op === '&' ? 10 : super.precOf(node);
  }

  argument(node, param) {
    if (param?.array && node.k === 'var' && !node.index) return `${this.varName(node.name)}, ${this.sizeName(node.name)}`;
    return this.expr(node);
  }

  call(n) {
    const a = n.args.map(x => this.expr(x));
    const m = this.mathCall(n, a);
    if (m) return m;
    const t0 = n.args[0] ? this.type(n.args[0]) : null;
    switch (n.name.toLowerCase()) {
      case 'char': this.needs.add('fg_char'); return `fg_char(${a[0]}, ${a[1]})`;
      case 'eof': this.needs.add('fg_eof'); return 'fg_eof()';
      case 'len': return `(int) strlen(${a[0]})`;
      case 'size': return n.args[0]?.k === 'var' ? this.sizeName(n.args[0].name) : '0';
      case 'tochar': this.needs.add('fg_tochar'); return `fg_tochar(${a[0]})`;
      case 'tocode': return `(int) ${this.atom(n.args[0])}[0]`;
      case 'tofixed': this.needs.add('fg_tofixed'); return `fg_tofixed(${a[0]}, ${a[1]})`;
      case 'tointeger': return t0 === 'String' ? `atoi(${a[0]})` : `(int) ${this.atom(n.args[0])}`;
      case 'toreal': return t0 === 'String' ? `atof(${a[0]})` : `(double) ${this.atom(n.args[0])}`;
      case 'tostring': return this.toStr(n.args[0]);
      default: return this.userCall(n);
    }
  }
}
