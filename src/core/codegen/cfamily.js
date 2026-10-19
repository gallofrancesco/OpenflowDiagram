// Control flow and math shared by the C and C++ generators.
import { Generator, quote, startKey, endKey } from './common.js';

export const C_RESERVED = [
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern',
  'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'register', 'restrict', 'return', 'short', 'signed',
  'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while', 'bool',
  'true', 'false', 'main', 'printf', 'scanf', 'abs', 'fabs', 'pow', 'sqrt', 'sin', 'cos', 'tan', 'log', 'log10',
  'exp', 'rand', 'srand', 'time', 'strlen', 'strcmp', 'exit', 'free', 'malloc', 'NULL', 'EOF', 'M_PI',
];

export class CFamilyGenerator extends Generator {
  program_() {
    const [main, ...others] = this.program.functions;
    const protoAt = this.lines.length;
    this.enterFunction(main);
    this.emit('int main() {', startKey(main), 0);
    const seedAt = this.lines.length;
    this.block(main.body, 1);
    this.emit('return 0;', endKey(main), 1);
    this.emit('}', endKey(main), 0);
    const protos = [];
    for (const f of others) {
      this.enterFunction(f);
      const header = this.functionHeader(f);
      protos.push(`${header};`);
      this.emit('', null, 0);
      this.emit(`${header} {`, startKey(f), 0);
      this.block(f.body, 1);
      if (f.type !== 'None' && f.variable) {
        this.emit('', endKey(f), 0);
        this.emit(`return ${this.varName(f.variable)};`, endKey(f), 1);
      }
      this.emit('}', endKey(f), 0);
    }
    // Inserted last (seed first, it sits below the prototypes) once all uses are known.
    if (this.needs.has('random')) this.lines.splice(seedAt, 0, { text: this.indentUnit + this.seedRandom(), id: startKey(main) });
    if (protos.length) {
      this.lines.splice(protoAt, 0, ...protos.map(text => ({ text, id: null })), { text: '', id: null });
    }
  }

  comment(text, id, depth) {
    for (const line of String(text).split('\n')) this.emit(`// ${line}`, id, depth);
  }

  statement(s, d) {
    const id = s.id;
    switch (s.kind) {
      case 'if':
        this.emit(`if (${this.ex(s.expression)}) {`, id, d);
        this.block(s.then, d + 1);
        if (s.else.length) {
          this.emit('} else {', id, d);
          this.block(s.else, d + 1);
        }
        this.emit('}', id, d);
        return;
      case 'while':
        this.emit(`while (${this.ex(s.expression)}) {`, id, d);
        this.block(s.body, d + 1);
        this.emit('}', id, d);
        return;
      case 'do':
        this.emit('do {', id, d);
        this.block(s.body, d + 1);
        this.emit(`} while (${this.ex(s.expression)});`, id, d);
        return;
      case 'for': {
        const v = this.ex(s.variable);
        const inc = s.direction !== 'dec';
        const step = (s.step || '1').trim();
        const update = step === '1' ? `${v}${inc ? '++' : '--'}` : `${v} ${inc ? '+=' : '-='} ${this.ex(step)}`;
        this.emit(`for (${v} = ${this.ex(s.start)}; ${v} ${inc ? '<=' : '>='} ${this.ex(s.end)}; ${update}) {`, id, d);
        this.block(s.body, d + 1);
        this.emit('}', id, d);
        return;
      }
      case 'call': this.emit(`${this.ex(s.expression)};`, id, d); return;
      case 'comment': this.comment(s.text, id, d); return;
      case 'breakpoint': this.comment(this.msg('breakpoint', 'Breakpoint'), id, d); return;
      default:
        this.specific(s, d);
    }
  }

  literal(n) {
    switch (n.type) {
      case 'String': return quote(n.value);
      case 'Boolean': return n.value ? 'true' : 'false';
      case 'Real': if (n.constant === 'pi') { this.needs.add('pi'); return 'M_PI'; } return n.src ?? String(n.value);
      default: return n.src ?? String(n.value);
    }
  }

  unary(n) {
    return `${n.op}${this.unaryOperand(n)}`;
  }

  atom(node) {
    const r = this.expr(node);
    return node.k === 'bin' || node.k === 'un' ? `(${r})` : r;
  }

  numericBinary(n, l, r) {
    const lt = this.type(n.l), rt = this.type(n.r);
    const ints = lt === 'Integer' && rt === 'Integer';
    switch (n.op) {
      case '/': return ints ? `(double) ${this.atom(n.l)} / ${r}` : `${l} / ${r}`;
      case '%': this.needs.add('math'); return ints ? `${l} % ${r}` : `fmod(${this.expr(n.l)}, ${this.expr(n.r)})`;
      case '^': {
        this.needs.add('math');
        const p = `pow(${this.expr(n.l)}, ${this.expr(n.r)})`;
        return ints ? `(int) ${p}` : p;
      }
      default: return `${l} ${n.op} ${r}`;
    }
  }

  mathCall(n, a) {
    const f = name => { this.needs.add('math'); return `${name}(${a[0]})`; };
    const t0 = n.args[0] ? this.type(n.args[0]) : null;
    switch (n.name.toLowerCase()) {
      case 'abs': return t0 === 'Integer' ? `abs(${a[0]})` : f('fabs');
      case 'arccos': return f('acos');
      case 'arcsin': return f('asin');
      case 'arctan': return f('atan');
      case 'cos': return f('cos');
      case 'int': return `(int) ${this.atom(n.args[0])}`;
      case 'log': return f('log');
      case 'log10': return f('log10');
      case 'random': this.needs.add('random'); return `rand() % ${this.atom(n.args[0])}`;
      case 'sgn': return `((${a[0]} > 0) - (${a[0]} < 0))`;
      case 'sin': return f('sin');
      case 'sqrt': return f('sqrt');
      case 'tan': return f('tan');
      default: return null;
    }
  }

  userCall(n) {
    const f = this.funcs.get(n.name.toLowerCase());
    const args = n.args.map((x, i) => this.argument(x, f?.params[i]));
    return `${this.funcName(n.name)}(${args.join(', ')})`;
  }

  argument(node) {
    return this.expr(node);
  }
}
