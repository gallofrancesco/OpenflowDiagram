import { CFamilyGenerator, C_RESERVED } from './cfamily.js';
import { splitNames } from '../expr.js';

const RESERVED = [
  ...C_RESERVED, 'class', 'namespace', 'new', 'delete', 'this', 'template', 'typename', 'public', 'private',
  'protected', 'virtual', 'operator', 'friend', 'using', 'try', 'catch', 'throw', 'string', 'vector', 'cin',
  'cout', 'endl', 'std', 'and', 'or', 'not', 'xor', 'fg_str', 'fg_fixed', 'fg_bool', 'fg_in', 'fg_out',
  'fg_readline', 'fg_close', 'fg_read_bool', 'nullptr', 'explicit', 'mutable', 'export',
];

const TYPE = { Integer: 'int', Real: 'double', String: 'string', Boolean: 'bool' };
const PARSE = {
  Integer: s => `stoi(${s})`,
  Real: s => `stod(${s})`,
  Boolean: s => `fg_bool(${s})`,
  String: s => s,
};

export class CppGenerator extends CFamilyGenerator {
  static key = 'cpp';
  static label = 'C++';
  static extension = 'cpp';

  constructor(program, opts = {}) {
    super(program, { ...opts, reserved: RESERVED });
  }

  seedRandom() {
    return 'srand(time(0));';
  }

  functionHeader(f) {
    const params = f.params.map(p =>
      p.array ? `vector<${TYPE[p.type]}> &${this.varName(p.name)}` : `${TYPE[p.type]} ${this.varName(p.name)}`);
    return `${f.type === 'None' ? 'void' : TYPE[f.type]} ${this.funcName(f.name)}(${params.join(', ')})`;
  }

  prelude() {
    const n = this.needs;
    const inc = ['iostream', 'string'];
    if (n.has('math') || n.has('pi')) inc.push('cmath');
    if (n.has('random')) inc.push('cstdlib', 'ctime');
    if (n.has('vector')) inc.push('vector');
    if (n.has('file')) inc.push('fstream');
    if (n.has('fg_str') || n.has('fg_fixed')) inc.push('sstream');
    if (n.has('fg_fixed')) inc.push('iomanip');
    const out = inc.map(h => `#include <${h}>`);
    out.push('', 'using namespace std;', '');
    if (n.has('pi')) out.push('#ifndef M_PI', '#define M_PI 3.14159265358979323846', '#endif', '');
    if (n.has('fg_str')) {
      out.push(
        'string fg_str(int x) { return to_string(x); }',
        'string fg_str(double x) { ostringstream s; s << x; return s.str(); }',
        'string fg_str(bool x) { return x ? "true" : "false"; }',
        'string fg_str(const string &x) { return x; }',
        '',
      );
    }
    if (n.has('fg_fixed')) out.push('string fg_fixed(double x, int d) { ostringstream s; s << fixed << setprecision(d) << x; return s.str(); }', '');
    if (n.has('fg_bool')) out.push('bool fg_bool(const string &s) { return s == "true"; }', '');
    if (n.has('fg_read_bool')) out.push('bool fg_read_bool() { string s; cin >> s; return s == "true"; }', '');
    if (n.has('file')) {
      out.push(
        'ifstream fg_in;',
        'ofstream fg_out;',
        'string fg_readline() { string line; getline(fg_in, line); return line; }',
        'void fg_close() { if (fg_in.is_open()) fg_in.close(); if (fg_out.is_open()) fg_out.close(); }',
        '',
      );
    }
    return out;
  }

  specific(s, d) {
    const id = s.id;
    switch (s.kind) {
      case 'declare':
        for (const name of splitNames(s.names)) {
          if (s.array) {
            this.needs.add('vector');
            this.emit(`vector<${TYPE[s.type]}> ${this.varName(name)}(${this.ex(s.size)});`, id, d);
          } else {
            this.emit(`${TYPE[s.type]} ${this.varName(name)};`, id, d);
          }
        }
        break;
      case 'assign': this.emit(`${this.ex(s.variable)} = ${this.ex(s.expression)};`, id, d); break;
      case 'input': {
        const t = this.parse(s.variable);
        if (t && this.type(t) === 'Boolean') {
          this.needs.add('fg_read_bool');
          this.emit(`${this.ex(s.variable)} = fg_read_bool();`, id, d);
        } else {
          this.emit(`cin >> ${this.ex(s.variable)};`, id, d);
        }
        break;
      }
      case 'output': {
        const e = this.parse(s.expression);
        let text = e ? this.expr(e) : s.expression;
        if (e && this.type(e) === 'Boolean') text = `(${text} ? "true" : "false")`;
        else if (e && e.k === 'bin' && ['&&', '||', '==', '!=', '<', '<=', '>', '>='].includes(e.op)) text = `(${text})`;
        this.emit(`cout << ${text}${s.newline ? ' << endl' : ''};`, id, d);
        break;
      }
      case 'open':
        this.needs.add('file');
        this.emit(`${s.mode === 'write' ? 'fg_out' : 'fg_in'}.open(${this.ex(s.expression)});`, id, d);
        break;
      case 'close': this.needs.add('file'); this.emit('fg_close();', id, d); break;
      case 'read': {
        this.needs.add('file');
        const t = this.parse(s.variable);
        const type = t ? this.type(t) : 'String';
        if (type === 'Boolean') this.needs.add('fg_bool');
        this.emit(`${this.ex(s.variable)} = ${PARSE[type]('fg_readline()')};`, id, d);
        break;
      }
      case 'write': {
        this.needs.add('file');
        const e = this.parse(s.expression);
        let text = e ? this.expr(e) : s.expression;
        if (e && this.type(e) === 'Boolean') text = `(${text} ? "true" : "false")`;
        this.emit(`fg_out << ${text} << endl;`, id, d);
        break;
      }
    }
  }

  // std::string operand: literals need wrapping so "a" + "b" is not pointer arithmetic.
  strOperand(node, prec, right) {
    if (this.type(node) !== 'String') {
      this.needs.add('fg_str');
      return `fg_str(${this.expr(node)})`;
    }
    if (node.k === 'lit' && !right) return `string(${this.expr(node)})`;
    return this.wrap(node, this.expr(node), prec, right);
  }

  binary(n) {
    const lt = this.type(n.l), rt = this.type(n.r);
    const prec = this.precOf(n);
    if (n.op === '&' || (n.op === '+' && (lt === 'String' || rt === 'String'))) {
      return `${this.strOperand(n.l, 6, false)} + ${this.strOperand(n.r, 6, true)}`;
    }
    const [l, r] = this.binaryParts(n, prec);
    if (lt === 'String' && n.l.k === 'lit' && ['==', '!=', '<', '<=', '>', '>='].includes(n.op)) {
      return `string(${l}) ${n.op} ${r}`;
    }
    return this.numericBinary(n, l, r);
  }

  precOf(node) {
    return node.op === '&' ? 6 : super.precOf(node);
  }

  call(n) {
    const a = n.args.map(x => this.expr(x));
    const m = this.mathCall(n, a);
    if (m) return m;
    const t0 = n.args[0] ? this.type(n.args[0]) : null;
    switch (n.name.toLowerCase()) {
      case 'char': return `string(1, ${this.atom(n.args[0])}[${a[1]}])`;
      case 'eof': this.needs.add('file'); return '(fg_in.peek() == EOF)';
      case 'len': return `(int) ${this.atom(n.args[0])}.length()`;
      case 'size': return `(int) ${a[0]}.size()`;
      case 'tochar': return `string(1, (char) ${this.atom(n.args[0])})`;
      case 'tocode': return `(int) ${this.atom(n.args[0])}[0]`;
      case 'tofixed': this.needs.add('fg_fixed'); return `fg_fixed(${a[0]}, ${a[1]})`;
      case 'tointeger': return t0 === 'String' ? `stoi(${a[0]})` : `(int) ${this.atom(n.args[0])}`;
      case 'toreal': return t0 === 'String' ? `stod(${a[0]})` : `(double) ${this.atom(n.args[0])}`;
      case 'tostring':
        // A string literal would pick the bool overload, so strings pass through untouched.
        if (t0 === 'String') return a[0];
        this.needs.add('fg_str');
        return `fg_str(${a[0]})`;
      default: return this.userCall(n);
    }
  }
}
