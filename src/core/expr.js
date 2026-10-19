// Expression language: tokenizer, precedence parser, static typing and built-in function table.
// Identifiers and keywords are case-insensitive.

export class FlowError extends Error {
  // code is a key of MESSAGES in i18n.js; params fill its {placeholders}.
  constructor(code, params = {}, stmtId = null) {
    super(code);
    this.code = code;
    this.params = params;
    this.stmtId = stmtId;
  }
}

export const BUILTINS = {
  abs: { name: 'Abs', args: ['Number'], ret: 'arg0' },
  arccos: { name: 'ArcCos', args: ['Number'], ret: 'Real' },
  arcsin: { name: 'ArcSin', args: ['Number'], ret: 'Real' },
  arctan: { name: 'ArcTan', args: ['Number'], ret: 'Real' },
  char: { name: 'Char', args: ['String', 'Integer'], ret: 'String' },
  cos: { name: 'Cos', args: ['Number'], ret: 'Real' },
  eof: { name: 'EOF', args: [], ret: 'Boolean' },
  int: { name: 'Int', args: ['Number'], ret: 'Integer' },
  len: { name: 'Len', args: ['String'], ret: 'Integer' },
  log: { name: 'Log', args: ['Number'], ret: 'Real' },
  log10: { name: 'Log10', args: ['Number'], ret: 'Real' },
  random: { name: 'Random', args: ['Integer'], ret: 'Integer' },
  sgn: { name: 'Sgn', args: ['Number'], ret: 'Integer' },
  sin: { name: 'Sin', args: ['Number'], ret: 'Real' },
  size: { name: 'Size', args: ['Array'], ret: 'Integer' },
  sqrt: { name: 'Sqrt', args: ['Number'], ret: 'Real' },
  tan: { name: 'Tan', args: ['Number'], ret: 'Real' },
  tochar: { name: 'ToChar', args: ['Integer'], ret: 'String' },
  tocode: { name: 'ToCode', args: ['String'], ret: 'Integer' },
  tofixed: { name: 'ToFixed', args: ['Number', 'Integer'], ret: 'String' },
  tointeger: { name: 'ToInteger', args: ['Any'], ret: 'Integer' },
  toreal: { name: 'ToReal', args: ['Any'], ret: 'Real' },
  tostring: { name: 'ToString', args: ['Any'], ret: 'String' },
};

export const CONSTANTS = { pi: 'Real', true: 'Boolean', false: 'Boolean' };

const WORD_OPS = { and: '&&', or: '||', not: '!', mod: '%' };
export const RESERVED = new Set([...Object.keys(WORD_OPS), ...Object.keys(CONSTANTS), ...Object.keys(BUILTINS)]);

// Binding power of binary operators (higher binds tighter).
export const PRECEDENCE = {
  '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4,
  '&': 5, '+': 6, '-': 6, '*': 7, '/': 7, '%': 7, '^': 9,
};
export const UNARY_PRECEDENCE = 8;

export function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    const start = i;
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(text[i + 1] || ''))) {
      while (/[0-9]/.test(text[i] || '')) i++;
      let real = false;
      if (text[i] === '.' && /[0-9]/.test(text[i + 1] || '')) {
        real = true;
        i++;
        while (/[0-9]/.test(text[i] || '')) i++;
      }
      if (/[eE]/.test(text[i] || '') && /[0-9+-]/.test(text[i + 1] || '')) {
        real = true;
        i += 2;
        while (/[0-9]/.test(text[i] || '')) i++;
      }
      if (/[A-Za-z_]/.test(text[i] || '')) throw new FlowError('errLexical', { text: text.slice(start, i + 1) });
      tokens.push({ t: real ? 'real' : 'int', v: text.slice(start, i), pos: start });
      continue;
    }
    if (/[A-Za-z_À-￿]/.test(c)) {
      while (/[A-Za-z0-9_À-￿]/.test(text[i] || '')) i++;
      const word = text.slice(start, i);
      const lower = word.toLowerCase();
      if (WORD_OPS[lower]) tokens.push({ t: 'op', v: WORD_OPS[lower], pos: start });
      else tokens.push({ t: 'id', v: word, pos: start });
      continue;
    }
    if (c === '"' || c === "'") {
      i++;
      let s = '';
      while (i < text.length && text[i] !== c) s += text[i++];
      if (i >= text.length) throw new FlowError('errLexical', { text: text.slice(start) });
      i++;
      tokens.push({ t: 'str', v: s, pos: start });
      continue;
    }
    const two = text.slice(i, i + 2);
    if (['==', '!=', '<>', '<=', '>=', '&&', '||'].includes(two)) {
      tokens.push({ t: 'op', v: two === '<>' ? '!=' : two, pos: start });
      i += 2;
      continue;
    }
    if ('+-*/%^&<>!='.includes(c)) {
      tokens.push({ t: 'op', v: c === '=' ? '==' : c, pos: start });
      i++;
      continue;
    }
    if ('()[],'.includes(c)) {
      tokens.push({ t: c, v: c, pos: start });
      i++;
      continue;
    }
    throw new FlowError('errLexical', { text: c });
  }
  return tokens;
}

/*
 AST nodes:
  {k:'lit', type, value}        literal (value already converted)
  {k:'var', name, index?}       variable or array element
  {k:'call', name, args}        built-in or user function
  {k:'un', op, e}               unary - or !
  {k:'bin', op, l, r}
  {k:'paren', e}                kept so generated code mirrors the user's grouping
*/
export function parseExpression(text) {
  const tokens = tokenize(text);
  let p = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const expect = t => {
    const tok = next();
    if (!tok) throw new FlowError('errSyntaxEnd', { text });
    if (tok.t !== t) throw new FlowError('errSyntaxUnexpected', { token: tok.v });
    return tok;
  };

  function primary() {
    const tok = next();
    if (!tok) throw new FlowError('errSyntaxEnd', { text });
    switch (tok.t) {
      case 'int': return { k: 'lit', type: 'Integer', value: parseInt(tok.v, 10), src: tok.v };
      case 'real': return { k: 'lit', type: 'Real', value: parseFloat(tok.v), src: tok.v };
      case 'str': return { k: 'lit', type: 'String', value: tok.v };
      case '(': {
        const e = binary(0);
        expect(')');
        return { k: 'paren', e };
      }
      case 'op':
        if (tok.v === '-' || tok.v === '!') return { k: 'un', op: tok.v, e: binary(UNARY_PRECEDENCE) };
        if (tok.v === '+') return binary(UNARY_PRECEDENCE);
        throw new FlowError('errSyntaxUnexpected', { token: tok.v });
      case 'id': {
        const lower = tok.v.toLowerCase();
        if (lower === 'true' || lower === 'false') return { k: 'lit', type: 'Boolean', value: lower === 'true' };
        if (lower === 'pi') return { k: 'lit', type: 'Real', value: Math.PI, constant: 'pi' };
        if (peek()?.t === '(') {
          next();
          const args = [];
          if (peek()?.t !== ')') {
            for (;;) {
              args.push(binary(0));
              if (peek()?.t === ',') { next(); continue; }
              break;
            }
          }
          expect(')');
          return { k: 'call', name: tok.v, args };
        }
        if (peek()?.t === '[') {
          next();
          const index = binary(0);
          expect(']');
          return { k: 'var', name: tok.v, index };
        }
        return { k: 'var', name: tok.v };
      }
      default:
        throw new FlowError('errSyntaxUnexpected', { token: tok.v });
    }
  }

  function binary(minPrec) {
    let left = primary();
    for (;;) {
      const tok = peek();
      if (!tok || tok.t !== 'op' || !(tok.v in PRECEDENCE)) break;
      const prec = PRECEDENCE[tok.v];
      if (prec < minPrec) break;
      next();
      // ^ is right associative, everything else left associative.
      const right = binary(tok.v === '^' ? prec : prec + 1);
      left = { k: 'bin', op: tok.v, l: left, r: right };
    }
    return left;
  }

  if (!tokens.length) throw new FlowError('errSyntaxEnd', { text });
  const ast = binary(0);
  if (p < tokens.length) throw new FlowError('errSyntaxUnexpected', { token: tokens[p].v });
  return ast;
}

// Parses an assignment/input target: name or name[index].
export function parseTarget(text) {
  const ast = parseExpression(text);
  if (ast.k !== 'var') throw new FlowError('errIdentifierInvalid', { name: text });
  return ast;
}

export function isValidIdentifier(name) {
  return /^[A-Za-zÀ-￿][A-Za-z0-9_À-￿]*$/.test(name) && !RESERVED.has(name.toLowerCase());
}

export function splitNames(text) {
  return text.split(',').map(s => s.trim()).filter(Boolean);
}

/*
 Static type inference, used by code generators.
 scope.lookup(name) -> {name, type, array} | null
 scope.func(name)   -> {name, type, params} | null
*/
export function typeOf(node, scope) {
  switch (node.k) {
    case 'lit': return node.type;
    case 'paren': return typeOf(node.e, scope);
    case 'var': {
      const v = scope.lookup(node.name);
      return v ? v.type : 'Integer';
    }
    case 'un': return node.op === '!' ? 'Boolean' : typeOf(node.e, scope);
    case 'call': {
      const b = BUILTINS[node.name.toLowerCase()];
      if (b) return b.ret === 'arg0' ? (node.args[0] ? typeOf(node.args[0], scope) : 'Integer') : b.ret;
      const f = scope.func(node.name);
      return f && f.type !== 'None' ? f.type : 'Integer';
    }
    case 'bin': {
      const { op } = node;
      if (['==', '!=', '<', '<=', '>', '>=', '&&', '||'].includes(op)) return 'Boolean';
      if (op === '&') return 'String';
      const lt = typeOf(node.l, scope), rt = typeOf(node.r, scope);
      if (op === '+' && (lt === 'String' || rt === 'String')) return 'String';
      if (op === '/') return 'Real';
      return lt === 'Real' || rt === 'Real' ? 'Real' : 'Integer';
    }
    default: return 'Integer';
  }
}

// Collects identifiers referenced in an expression (used by the pre-run scanner).
export function* walkExpression(node) {
  if (!node) return;
  yield node;
  switch (node.k) {
    case 'paren': case 'un': yield* walkExpression(node.e); break;
    case 'bin': yield* walkExpression(node.l); yield* walkExpression(node.r); break;
    case 'var': if (node.index) yield* walkExpression(node.index); break;
    case 'call': for (const a of node.args) yield* walkExpression(a); break;
  }
}
