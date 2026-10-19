import { Generator, quote, startKey, endKey } from './common.js';
import { splitNames } from '../expr.js';

const RESERVED = [
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
  'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield', 'print', 'input', 'int', 'float', 'str',
  'bool', 'len', 'list', 'range', 'abs', 'chr', 'ord', 'format', 'open', 'type', 'id', 'max', 'min', 'sum', 'round',
  'math', 'random', 'main', 'fg', 'file', 'next', 'iter', 'map', 'filter', 'dict', 'set',
];

const DEFAULT_VALUE = { Integer: '0', Real: '0.0', String: '""', Boolean: 'False' };
const PY_PREC = { '||': 1, '&&': 2, '!': 3, '==': 4, '!=': 4, '<': 4, '<=': 4, '>': 4, '>=': 4, '&': 6, '+': 6, '-': 6, '*': 7, '/': 7, '%': 7, '^': 9 };

export class PythonGenerator extends Generator {
  static key = 'python';
  static label = 'Python';
  static extension = 'py';

  constructor(program, opts = {}) {
    super(program, { ...opts, reserved: RESERVED });
  }

  precOf(node) {
    return PY_PREC[node.op] ?? 8;
  }

  // Python's `not` binds looser than comparisons, so it needs parentheses inside them.
  wrap(child, rendered, parentPrec, rightSide) {
    if (child.k === 'un' && child.op === '!' && parentPrec > PY_PREC['!']) return `(${rendered})`;
    return super.wrap(child, rendered, parentPrec, rightSide);
  }

  program_() {
    const [main, ...others] = this.program.functions;
    for (const f of others) {
      this.enterFunction(f);
      const params = f.params.map(p => this.varName(p.name)).join(', ');
      this.emit(`def ${this.funcName(f.name)}(${params}):`, startKey(f), 0);
      const start = this.lines.length;
      this.block(f.body, 1);
      if (f.type !== 'None' && f.variable) this.emit(`return ${this.varName(f.variable)}`, endKey(f), 1);
      if (this.lines.length === start) this.emit('pass', endKey(f), 1);
      this.emit('', null, 0);
    }
    this.enterFunction(main);
    this.emit(`# ${this.msg('mainProgram', 'Main')}`, startKey(main), 0);
    this.block(main.body, 0);
  }

  prelude() {
    const out = [];
    if (this.needs.has('math')) out.push('import math');
    if (this.needs.has('random')) out.push('import random');
    if (out.length) out.push('');
    if (this.needs.has('file')) {
      out.push(
        'class FgFile:',
        '    def open(self, name, mode):',
        '        self.mode = mode',
        '        if mode == "r":',
        '            with open(name) as f:',
        '                self.lines = f.read().splitlines()',
        '            self.pos = 0',
        '        else:',
        '            self.handle = open(name, "w")',
        '',
        '    def read(self):',
        '        line = self.lines[self.pos]',
        '        self.pos += 1',
        '        return line',
        '',
        '    def eof(self):',
        '        return self.pos >= len(self.lines)',
        '',
        '    def write(self, value):',
        '        self.handle.write(str(value) + "\\n")',
        '',
        '    def close(self):',
        '        if self.mode == "w":',
        '            self.handle.close()',
        '',
        'fg = FgFile()',
        '',
      );
    }
    return out;
  }

  comment(text, id, depth) {
    for (const line of String(text).split('\n')) this.emit(`# ${line}`, id, depth);
  }

  convertInput(source, type) {
    switch (type) {
      case 'Integer': return `int(${source})`;
      case 'Real': return `float(${source})`;
      case 'Boolean': return `${source}.strip().lower() == "true"`;
      default: return source;
    }
  }

  statement(s, d) {
    const id = s.id;
    switch (s.kind) {
      case 'declare':
        for (const name of splitNames(s.names)) {
          const init = DEFAULT_VALUE[s.type];
          this.emit(s.array ? `${this.varName(name)} = [${init}] * (${this.ex(s.size)})` : `${this.varName(name)} = ${init}`, id, d);
        }
        break;
      case 'assign': this.emit(`${this.ex(s.variable)} = ${this.ex(s.expression)}`, id, d); break;
      case 'input': {
        const t = this.parse(s.variable);
        const type = t ? this.type(t) : 'String';
        this.emit(`${this.ex(s.variable)} = ${this.convertInput('input()', type)}`, id, d);
        break;
      }
      case 'output':
        this.emit(s.newline ? `print(${this.ex(s.expression)})` : `print(${this.ex(s.expression)}, end="")`, id, d);
        break;
      case 'if':
        this.emit(`if ${this.ex(s.expression)}:`, id, d);
        this.body(s.then, d + 1, id);
        if (s.else.length) {
          this.emit('else:', id, d);
          this.body(s.else, d + 1, id);
        }
        break;
      case 'while':
        this.emit(`while ${this.ex(s.expression)}:`, id, d);
        this.body(s.body, d + 1, id);
        break;
      case 'do': {
        this.emit('while True:', id, d);
        this.block(s.body, d + 1);
        const c = this.parse(s.expression);
        const cond = c ? (c.k === 'bin' ? `(${this.expr(c)})` : this.expr(c)) : s.expression;
        this.emit(`if not ${cond}:`, id, d + 1);
        this.emit('break', id, d + 2);
        break;
      }
      case 'for': {
        const v = this.ex(s.variable);
        const step = (s.step || '1').trim();
        const inc = s.direction !== 'dec';
        const end = inc ? `${this.ex(s.end)} + 1` : `${this.ex(s.end)} - 1`;
        let args = `${this.ex(s.start)}, ${end}`;
        if (!inc) args += `, -${step === '1' ? '1' : `(${this.ex(step)})`}`;
        else if (step !== '1') args += `, ${this.ex(step)}`;
        this.emit(`for ${v} in range(${args}):`, id, d);
        this.body(s.body, d + 1, id);
        break;
      }
      case 'call': this.emit(this.ex(s.expression), id, d); break;
      case 'comment': this.comment(s.text, id, d); break;
      case 'breakpoint': this.comment(this.msg('breakpoint', 'Breakpoint'), id, d); break;
      case 'open': this.needs.add('file'); this.emit(`fg.open(${this.ex(s.expression)}, "${s.mode === 'write' ? 'w' : 'r'}")`, id, d); break;
      case 'close': this.needs.add('file'); this.emit('fg.close()', id, d); break;
      case 'read': {
        this.needs.add('file');
        const t = this.parse(s.variable);
        this.emit(`${this.ex(s.variable)} = ${this.convertInput('fg.read()', t ? this.type(t) : 'String')}`, id, d);
        break;
      }
      case 'write': this.needs.add('file'); this.emit(`fg.write(${this.ex(s.expression)})`, id, d); break;
    }
  }

  body(list, depth, id) {
    const before = this.lines.length;
    this.block(list, depth);
    if (this.lines.length === before) this.emit('pass', id, depth);
  }

  literal(n) {
    switch (n.type) {
      case 'String': return quote(n.value);
      case 'Boolean': return n.value ? 'True' : 'False';
      case 'Real': if (n.constant === 'pi') { this.needs.add('math'); return 'math.pi'; } return n.src ?? String(n.value);
      default: return n.src ?? String(n.value);
    }
  }

  unary(n) {
    if (n.op === '!') return `not ${this.unaryOperand(n)}`;
    return `-${this.unaryOperand(n)}`;
  }

  str(node) {
    const r = this.expr(node);
    return this.type(node) === 'String' ? r : `str(${r})`;
  }

  binary(n) {
    const prec = this.precOf(n);
    const wrapS = (child, right) => {
      if (this.type(child) !== 'String') return `str(${this.expr(child)})`;
      return this.wrap(child, this.expr(child), prec, right);
    };
    if (n.op === '&' || (n.op === '+' && (this.type(n.l) === 'String' || this.type(n.r) === 'String'))) {
      return `${wrapS(n.l, false)} + ${wrapS(n.r, true)}`;
    }
    const [l, r] = this.binaryParts(n, prec);
    const ops = { '&&': 'and', '||': 'or', '^': '**' };
    return `${l} ${ops[n.op] || n.op} ${r}`;
  }

  call(n) {
    const a = n.args.map(x => this.expr(x));
    const math = f => { this.needs.add('math'); return `math.${f}(${a[0]})`; };
    switch (n.name.toLowerCase()) {
      case 'abs': return `abs(${a[0]})`;
      case 'arccos': return math('acos');
      case 'arcsin': return math('asin');
      case 'arctan': return math('atan');
      case 'char': return `${this.atom(n.args[0])}[${a[1]}]`;
      case 'cos': return math('cos');
      case 'eof': this.needs.add('file'); return 'fg.eof()';
      case 'int': return `int(${a[0]})`;
      case 'len': return `len(${a[0]})`;
      case 'log': return math('log');
      case 'log10': return math('log10');
      case 'random': this.needs.add('random'); return `random.randint(0, ${this.atom(n.args[0])} - 1)`;
      case 'sgn': return `((${a[0]} > 0) - (${a[0]} < 0))`;
      case 'sin': return math('sin');
      case 'size': return `len(${a[0]})`;
      case 'sqrt': return math('sqrt');
      case 'tan': return math('tan');
      case 'tochar': return `chr(${a[0]})`;
      case 'tocode': return `ord(${a[0]})`;
      case 'tofixed': {
        const digits = n.args[1]?.k === 'lit' ? `".${n.args[1].value}f"` : `"." + str(${a[1]}) + "f"`;
        return `format(${a[0]}, ${digits})`;
      }
      case 'tointeger': return `int(${a[0]})`;
      case 'toreal': return `float(${a[0]})`;
      case 'tostring': return `str(${a[0]})`;
      default: return `${this.funcName(n.name)}(${a.join(', ')})`;
    }
  }

  atom(node) {
    const r = this.expr(node);
    return node.k === 'bin' || node.k === 'un' ? `(${r})` : r;
  }
}
