import { Generator, quote, startKey, endKey } from './common.js';
import { splitNames } from '../expr.js';

const RESERVED = [
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
  'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if',
  'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private',
  'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
  'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'var', 'record', 'yield', 'null',
  'String', 'Math', 'System', 'Main', 'input', 'args', 'fgReader', 'fgWriter', 'fgClose',
];

const TYPE = { Integer: 'int', Real: 'double', String: 'String', Boolean: 'boolean' };
const DEFAULT = { Integer: '0', Real: '0.0', String: '""', Boolean: 'false' };
const PARSE = {
  Integer: s => `Integer.parseInt(${s}.trim())`,
  Real: s => `Double.parseDouble(${s}.trim())`,
  Boolean: s => `Boolean.parseBoolean(${s}.trim())`,
  String: s => s,
};
const J_PREC = { '&': 6 };

export class JavaGenerator extends Generator {
  static key = 'java';
  static label = 'Java';
  static extension = 'java';

  constructor(program, opts = {}) {
    super(program, { ...opts, reserved: RESERVED });
  }

  precOf(node) {
    return J_PREC[node.op] ?? super.precOf(node);
  }

  program_() {
    const [main, ...others] = this.program.functions;
    this.emit('public class Main {', null, 0);
    // The body is generated first so we know which helpers are needed.
    const header = this.lines.length;
    this.enterFunction(main);
    this.emit('', null, 0);
    this.emit('public static void main(String[] args) {', startKey(main), 1);
    this.block(main.body, 2);
    this.emit('}', endKey(main), 1);
    for (const f of others) {
      this.enterFunction(f);
      this.emit('', null, 0);
      const params = f.params.map(p => `${TYPE[p.type]}${p.array ? '[]' : ''} ${this.varName(p.name)}`).join(', ');
      const ret = f.type === 'None' ? 'void' : TYPE[f.type];
      this.emit(`public static ${ret} ${this.funcName(f.name)}(${params}) {`, startKey(f), 1);
      this.block(f.body, 2);
      if (f.type !== 'None' && f.variable) {
        this.emit('', endKey(f), 0);
        this.emit(`return ${this.varName(f.variable)};`, endKey(f), 2);
      }
      this.emit('}', endKey(f), 1);
    }
    if (this.needs.has('file')) {
      this.emit('', null, 0);
      this.emit('private static void fgClose() throws IOException {', null, 1);
      this.emit('if (fgReader != null) { fgReader.close(); fgReader = null; }', null, 2);
      this.emit('if (fgWriter != null) { fgWriter.close(); fgWriter = null; }', null, 2);
      this.emit('}', null, 1);
    }
    this.emit('}', null, 0);
    // Fields go right after the class header.
    const fields = [];
    if (this.needs.has('input')) fields.push('private static Scanner input = new Scanner(System.in);');
    if (this.needs.has('file')) {
      fields.push('private static BufferedReader fgReader;', 'private static PrintWriter fgWriter;');
    }
    this.lines.splice(header, 0, ...fields.map(text => ({ text: this.indentUnit + text, id: null })));
    // Methods only need "throws" when files are used, which is known only now.
    if (this.needs.has('file')) {
      for (const l of this.lines) {
        if (/^\s*public static .*\) \{$/.test(l.text)) l.text = l.text.replace(/\) \{$/, ') throws IOException {');
      }
    }
  }

  prelude() {
    const out = [];
    if (this.needs.has('input')) out.push('import java.util.*;');
    if (this.needs.has('file')) out.push('import java.io.*;');
    if (out.length) out.push('');
    return out;
  }

  comment(text, id, depth) {
    for (const line of String(text).split('\n')) this.emit(`// ${line}`, id, depth);
  }

  statement(s, d) {
    const id = s.id;
    switch (s.kind) {
      case 'declare':
        for (const name of splitNames(s.names)) {
          const t = TYPE[s.type];
          // Java rejects reads of possibly-unassigned locals, so scalars start at a default value.
          this.emit(s.array
            ? `${t}[] ${this.varName(name)} = new ${t}[${this.ex(s.size)}];`
            : `${t} ${this.varName(name)} = ${DEFAULT[s.type]};`, id, d);
        }
        break;
      case 'assign': this.emit(`${this.ex(s.variable)} = ${this.ex(s.expression)};`, id, d); break;
      case 'input': {
        this.needs.add('input');
        const t = this.parse(s.variable);
        this.emit(`${this.ex(s.variable)} = ${PARSE[t ? this.type(t) : 'String']('input.nextLine()')};`, id, d);
        break;
      }
      case 'output':
        this.emit(`System.out.${s.newline ? 'println' : 'print'}(${this.ex(s.expression)});`, id, d);
        break;
      case 'if':
        this.emit(`if (${this.ex(s.expression)}) {`, id, d);
        this.block(s.then, d + 1);
        if (s.else.length) {
          this.emit('} else {', id, d);
          this.block(s.else, d + 1);
        }
        this.emit('}', id, d);
        break;
      case 'while':
        this.emit(`while (${this.ex(s.expression)}) {`, id, d);
        this.block(s.body, d + 1);
        this.emit('}', id, d);
        break;
      case 'do':
        this.emit('do {', id, d);
        this.block(s.body, d + 1);
        this.emit(`} while (${this.ex(s.expression)});`, id, d);
        break;
      case 'for': this.forLoop(s, d); break;
      case 'call': this.emit(`${this.ex(s.expression)};`, id, d); break;
      case 'comment': this.comment(s.text, id, d); break;
      case 'breakpoint': this.comment(this.msg('breakpoint', 'Breakpoint'), id, d); break;
      case 'open':
        this.needs.add('file');
        this.emit(s.mode === 'write'
          ? `fgWriter = new PrintWriter(new FileWriter(${this.ex(s.expression)}));`
          : `fgReader = new BufferedReader(new FileReader(${this.ex(s.expression)}));`, id, d);
        break;
      case 'close': this.needs.add('file'); this.emit('fgClose();', id, d); break;
      case 'read': {
        this.needs.add('file');
        const t = this.parse(s.variable);
        this.emit(`${this.ex(s.variable)} = ${PARSE[t ? this.type(t) : 'String']('fgReader.readLine()')};`, id, d);
        break;
      }
      case 'write': this.needs.add('file'); this.emit(`fgWriter.println(${this.ex(s.expression)});`, id, d); break;
    }
  }

  forLoop(s, d) {
    const v = this.ex(s.variable);
    const inc = s.direction !== 'dec';
    const step = (s.step || '1').trim();
    const update = step === '1' ? `${v}${inc ? '++' : '--'}` : `${v} ${inc ? '+=' : '-='} ${this.ex(step)}`;
    this.emit(`for (${v} = ${this.ex(s.start)}; ${v} ${inc ? '<=' : '>='} ${this.ex(s.end)}; ${update}) {`, s.id, d);
    this.block(s.body, d + 1);
    this.emit('}', s.id, d);
  }

  literal(n) {
    switch (n.type) {
      case 'String': return quote(n.value);
      case 'Boolean': return n.value ? 'true' : 'false';
      case 'Real': return n.constant === 'pi' ? 'Math.PI' : n.src ?? String(n.value);
      default: return n.src ?? String(n.value);
    }
  }

  unary(n) {
    return `${n.op}${this.unaryOperand(n)}`;
  }

  binary(n) {
    const lt = this.type(n.l), rt = this.type(n.r);
    const [l, r] = this.binaryParts(n);
    switch (n.op) {
      case '&':
        if (lt !== 'String' && rt !== 'String') return `String.valueOf(${this.expr(n.l)}) + ${r}`;
        return `${l} + ${r}`;
      case '/':
        return lt === 'Integer' && rt === 'Integer' ? `(double) ${this.atom(n.l)} / ${r}` : `${l} / ${r}`;
      case '^': {
        const p = `Math.pow(${this.expr(n.l)}, ${this.expr(n.r)})`;
        return lt === 'Integer' && rt === 'Integer' ? `(int) ${p}` : p;
      }
      case '==': case '!=':
        if (lt === 'String' || rt === 'String') {
          const eq = `${this.atom(n.l)}.equals(${this.expr(n.r)})`;
          return n.op === '==' ? eq : `!${eq}`;
        }
        return `${l} ${n.op} ${r}`;
      case '<': case '<=': case '>': case '>=':
        if (lt === 'String' || rt === 'String') return `${this.atom(n.l)}.compareTo(${this.expr(n.r)}) ${n.op} 0`;
        return `${l} ${n.op} ${r}`;
      default:
        return `${l} ${n.op} ${r}`;
    }
  }

  atom(node) {
    const r = this.expr(node);
    return node.k === 'bin' || node.k === 'un' ? `(${r})` : r;
  }

  call(n) {
    const a = n.args.map(x => this.expr(x));
    const t0 = n.args[0] ? this.type(n.args[0]) : null;
    switch (n.name.toLowerCase()) {
      case 'abs': return `Math.abs(${a[0]})`;
      case 'arccos': return `Math.acos(${a[0]})`;
      case 'arcsin': return `Math.asin(${a[0]})`;
      case 'arctan': return `Math.atan(${a[0]})`;
      case 'char': return `String.valueOf(${this.atom(n.args[0])}.charAt(${a[1]}))`;
      case 'cos': return `Math.cos(${a[0]})`;
      case 'eof': this.needs.add('file'); return '!fgReader.ready()';
      case 'int': return `(int) ${this.atom(n.args[0])}`;
      case 'len': return `${this.atom(n.args[0])}.length()`;
      case 'log': return `Math.log(${a[0]})`;
      case 'log10': return `Math.log10(${a[0]})`;
      case 'random': return `(int) (Math.random() * ${this.atom(n.args[0])})`;
      case 'sgn': return `(int) Math.signum(${a[0]})`;
      case 'sin': return `Math.sin(${a[0]})`;
      case 'size': return `${a[0]}.length`;
      case 'sqrt': return `Math.sqrt(${a[0]})`;
      case 'tan': return `Math.tan(${a[0]})`;
      case 'tochar': return `String.valueOf((char) ${this.atom(n.args[0])})`;
      case 'tocode': return `(int) ${this.atom(n.args[0])}.charAt(0)`;
      case 'tofixed': {
        const fmt = n.args[1]?.k === 'lit' ? `"%.${n.args[1].value}f"` : `"%." + ${a[1]} + "f"`;
        return `String.format(${fmt}, (double) ${this.atom(n.args[0])})`;
      }
      case 'tointeger':
        return t0 === 'String' ? `Integer.parseInt(${a[0]})` : `(int) ${this.atom(n.args[0])}`;
      case 'toreal':
        return t0 === 'String' ? `Double.parseDouble(${a[0]})` : `(double) ${this.atom(n.args[0])}`;
      case 'tostring': return `String.valueOf(${a[0]})`;
      default: return `${this.funcName(n.name)}(${a.join(', ')})`;
    }
  }
}
