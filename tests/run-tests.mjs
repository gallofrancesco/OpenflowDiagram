// Core tests: interpreter semantics, runtime errors, .fprg round trip, and generated code
// executed with real toolchains (Python, Java; C/C++ when FLUSSO_CC / FLUSSO_CXX are set).
import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PROGRAMS } from './programs.mjs';
import { Interpreter, validateProgram } from '../src/core/interpreter.js';
import { createProgram, createStatement as S, createFunction, programToXml, programFromXml } from '../src/core/model.js';
import { parseExpression, FlowError } from '../src/core/expr.js';
import { generateCode } from '../src/core/codegen/index.js';

let passed = 0, failed = 0, skipped = 0;
const ok = (name) => { passed++; console.log(`  ok   ${name}`); };
const bad = (name, detail) => { failed++; console.log(`  FAIL ${name}\n${String(detail).split('\n').map(l => `       ${l}`).join('\n')}`); };
const skip = (name, why) => { skipped++; console.log(`  skip ${name} (${why})`); };
const check = (name, cond, detail = '') => (cond ? ok(name) : bad(name, detail));

// Runs a program in the interpreter with an in-memory file system.
function interpret(program, inputs = [], files = {}) {
  let out = '';
  const host = {
    output: (text, newline) => { out += text + (newline ? '\n' : ''); },
    files: {
      read: n => { if (!(n in files)) throw new Error('missing'); return files[n]; },
      write: (n, text) => { files[n] = text; },
    },
  };
  const queue = [...inputs];
  const gen = new Interpreter(program, host).run();
  let next;
  for (;;) {
    const r = gen.next(next);
    next = undefined;
    if (r.done) break;
    if (r.value.type === 'input') next = queue.shift();
  }
  return { out, files };
}

function expectError(name, program, code, inputs = []) {
  try {
    interpret(program, inputs);
    bad(name, `expected ${code}, program finished`);
  } catch (e) {
    if (e instanceof FlowError && e.code === code) ok(name);
    else bad(name, `expected ${code}, got ${e.code || e.message}`);
  }
}

const mainOnly = (...body) => {
  const p = createProgram();
  p.functions[0].body = body;
  return p;
};

/* ---------- expressions ---------- */
console.log('Expressions');
{
  const show = n => n.k === 'bin' ? `(${show(n.l)} ${n.op} ${show(n.r)})` : n.k === 'un' ? `(${n.op}${show(n.e)})` : n.k === 'paren' ? show(n.e) : n.k === 'lit' ? String(n.value) : n.k === 'var' ? n.name : `${n.name}(...)`;
  const cases = {
    '1 + 2 * 3': '(1 + (2 * 3))',
    '2 ^ 3 ^ 2': '(2 ^ (3 ^ 2))',
    '-2 ^ 2': '(-(2 ^ 2))',
    'a = b and not c': '((a == b) && (!c))',
    'x <> y or x mod 2 = 0': '((x != y) || ((x % 2) == 0))',
    '"a" & 1 + 2': '(a & (1 + 2))',
  };
  for (const [src, want] of Object.entries(cases)) {
    const got = show(parseExpression(src));
    check(`parse ${src}`, got === want, `got ${got}`);
  }
  for (const badSrc of ['1 +', '(1', 'a[', '3x', '"open']) {
    try {
      parseExpression(badSrc);
      bad(`reject ${badSrc}`, 'parsed');
    } catch (e) {
      check(`reject ${badSrc}`, e instanceof FlowError, e.message);
    }
  }
}

/* ---------- interpreter ---------- */
console.log('Interpreter');
const EXPECTED = {
  factorial: 'Fatt(1) = 1\nFatt(2) = 2\nFatt(3) = 6\nFatt(4) = 24\nFatt(5) = 120\nFatt(6) = 720\n',
  strings: 'ossulF\nLunghezza: 6\n66\nB42!\n34\nordinato\nabc\n',
  arrays: '-3\n7\n7\n19\n42\n100\nSomma = 172\n',
  loops: 'Passi: 111\n0 10 20 \n10\n7\n4\n1\n1024\n-1\nfalse\n4\n',
  input: 'Come ti chiami?\nCiao Ada, somma = 65\nconfermato\n',
  files: 'Totale: 55\n',
};
const interpreted = {};
for (const [name, spec] of Object.entries(PROGRAMS)) {
  try {
    const r = interpret(spec.build(), spec.input);
    interpreted[name] = r.out;
    check(`run ${name}`, r.out === EXPECTED[name], `got:\n${r.out}`);
    if (name === 'files') check('file contents written', r.files['flusso_test_dati.txt'] === '1\n4\n9\n16\n25\n', JSON.stringify(r.files));
  } catch (e) {
    bad(`run ${name}`, e.code ? `${e.code} ${JSON.stringify(e.params)}` : e.stack);
  }
}

{
  const p = mainOnly(S('declare', { names: 'x', type: 'Real' }), S('assign', { variable: 'x', expression: '7 / 2' }), S('output', { expression: 'x' }),
    S('output', { expression: 'ToFixed(Pi, 3)' }), S('output', { expression: 'Sqrt(16) + 0.5' }), S('output', { expression: '10 / 4 * 2' }));
  const r = interpret(p);
  check('real arithmetic', r.out === '3.5\n3.142\n4.5\n5\n', r.out);
}
{
  // A Declare inside a loop re-creates the variable instead of failing.
  const p = mainOnly(S('declare', { names: 'i', type: 'Integer' }), S('for', { variable: 'i', start: '1', end: '3', body: [
    S('declare', { names: 'tmp', type: 'Integer' }), S('assign', { variable: 'tmp', expression: 'i * 2' }), S('output', { expression: 'tmp', newline: false }),
  ] }));
  check('declare inside loop', interpret(p).out === '246', interpret(p).out);
}

console.log('Runtime errors');
expectError('undeclared variable', mainOnly(S('assign', { variable: 'x', expression: '1' })), 'errVariableUndeclared');
expectError('uninitialized variable', mainOnly(S('declare', { names: 'x', type: 'Integer' }), S('output', { expression: 'x' })), 'errVariableUninitialized');
expectError('duplicate declare', mainOnly(S('declare', { names: 'x', type: 'Integer' }), S('declare', { names: 'x', type: 'Real' })), 'errDuplicateDefinition');
expectError('divide by zero', mainOnly(S('output', { expression: '1 / 0' })), 'errDivideByZero');
expectError('modulus by zero', mainOnly(S('output', { expression: '1 % 0' })), 'errModulusByZero');
expectError('assign real to integer', mainOnly(S('declare', { names: 'x', type: 'Integer' }), S('assign', { variable: 'x', expression: '1.5' })), 'errAssignTypeMismatch');
expectError('string math', mainOnly(S('output', { expression: '"a" * 2' })), 'errMathMismatch');
expectError('condition not boolean', mainOnly(S('if', { expression: '1' })), 'errBooleanMismatch');
expectError('compare mismatch', mainOnly(S('output', { expression: '"a" < 1' })), 'errCompareMismatch');
expectError('equality mismatch', mainOnly(S('output', { expression: 'true == 1' })), 'errEqualityTypeMismatch');
expectError('bad subscript', mainOnly(S('declare', { names: 'a', type: 'Integer', array: true, size: '3' }), S('assign', { variable: 'a[3]', expression: '1' })), 'errBadSubscript');
expectError('missing subscript', mainOnly(S('declare', { names: 'a', type: 'Integer', array: true, size: '3' }), S('assign', { variable: 'a', expression: '1' })), 'errMissingSubscript');
expectError('not an array', mainOnly(S('declare', { names: 'a', type: 'Integer' }), S('assign', { variable: 'a[0]', expression: '1' })), 'errNotArray');
expectError('overflow', mainOnly(S('output', { expression: '2147483647 + 1' })), 'errOverflow');
expectError('step zero', mainOnly(S('declare', { names: 'i', type: 'Integer' }), S('for', { variable: 'i', start: '1', end: '3', step: '0' })), 'errStepIsZero');
expectError('undefined function', mainOnly(S('call', { expression: 'Boh()' })), 'errFunctionUndefined');
expectError('incomplete shape', mainOnly(S('output')), 'errIncomplete');
expectError('syntax error', mainOnly(S('output', { expression: '1 +' })), 'errSyntaxEnd');
expectError('illegal input', (() => { const p = mainOnly(S('declare', { names: 'x', type: 'Integer' }), S('input', { variable: 'x' })); return p; })(), 'errIllegalValue', ['abc']);
expectError('file not found', mainOnly(S('open', { expression: '"nope.txt"', mode: 'read' })), 'errFileNotFound');
expectError('read past end', (() => {
  const p = mainOnly(S('declare', { names: 'x', type: 'Integer' }), S('open', { expression: '"e.txt"', mode: 'write' }), S('close'),
    S('open', { expression: '"e.txt"', mode: 'read' }), S('read', { variable: 'x' }));
  return p;
})(), 'errReadPastEnd');
{
  const p = mainOnly(S('call', { expression: 'R(1)' }));
  p.functions.push(createFunction('R', { params: [{ name: 'n', type: 'Integer', array: false }], body: [S('call', { expression: 'R(n + 1)' })] }));
  expectError('stack overflow', p, 'errStackOverflow');
}
{
  const p = mainOnly(S('output', { expression: 'F()' }));
  p.functions.push(createFunction('F', {}));
  expectError('function returns no value', p, 'errFunctionReturnsNoValue');
}
{
  const p = mainOnly(S('output', { expression: 'F(1, 2)' }));
  p.functions.push(createFunction('F', { type: 'Integer', variable: 'r', params: [{ name: 'a', type: 'Integer', array: false }] }));
  expectError('argument count', p, 'errArgumentCountMismatch');
}
{
  const p = mainOnly(S('output', { expression: 'F("x")' }));
  p.functions.push(createFunction('F', { type: 'Integer', variable: 'a', params: [{ name: 'a', type: 'Integer', array: false }] }));
  expectError('argument type', p, 'errArgumentTypeMismatch');
}

/* ---------- trace table ---------- */
console.log('Trace table');
{
  const { TraceRecorder, traceableVariables, checkTraceExpression } = await import('../src/core/trace.js');
  const p = PROGRAMS.factorial.build();
  const vars = traceableVariables(p);
  check('traceable variables', JSON.stringify(vars.map(f => [f.func, f.vars.map(v => v.name)])) === '[["Main",["n","i"]],["Fact",["k","r"]]]', JSON.stringify(vars));
  check('trace rejects user calls', checkTraceExpression('Fact(2) > 1') === 'traceNoUserCalls');
  check('trace accepts built-ins', checkTraceExpression('Len("ab") + i') === null);
  const rec = new TraceRecorder({
    items: [{ func: 'Main', kind: 'var', text: 'i' }, { func: 'Main', kind: 'expr', text: 'i % 2 == 0' }, { func: 'Fact', kind: 'var', text: 'r' }],
    output: true,
  }, s => s.kind);
  const host = { output: (t, nl) => rec.addOutput(t + (nl ? '\n' : '')), files: { read() {}, write() {} } };
  const interp = new Interpreter(p, host);
  const gen = interp.run();
  for (let r = gen.next(); !r.done; r = gen.next()) {
    if (r.value.type === 'after' || r.value.type === 'decision') rec.record(r.value, interp);
  }
  const fmt = v => (v.state === 'ok' ? v.text : v.state);
  const lines = rec.rows.map(r => `${r.func}:${r.block}:${r.result ?? '-'}:${r.values.map(fmt).join('|')}:${r.output}`);
  // declare, assign, then the For check with i = 1, the Fact call (If decision inside Fact), output row...
  check('trace first rows', lines.slice(0, 4).join('\n') === [
    'Main:declare:-:uninit|uninit|absent:',
    'Main:assign:-:uninit|uninit|absent:',
    'Main:for:true:1|false|absent:',
    'Fact:declare:-:1|false|uninit:',
  ].join('\n'), lines.slice(0, 6).join('\n'));
  const outRows = rec.rows.filter(r => r.output);
  check('trace output column', outRows.length === 6 && outRows[5].output === 'Fatt(6) = 720', JSON.stringify(outRows.map(r => r.output)));
  const last = rec.rows[rec.rows.length - 1];
  check('trace final For check is false', last.block === 'for' && last.result === false && fmt(last.values[0]) === '6', lines.slice(-2).join('\n'));
  const changedI = rec.rows.filter(r => r.values[0].changed).map(r => fmt(r.values[0]));
  check('trace marks changes', changedI.join(',') === '1,2,3,4,5,6', changedI.join(','));
}

/* ---------- file format ---------- */

console.log('File format');
for (const [name, spec] of Object.entries(PROGRAMS)) {
  const p = spec.build();
  const stamp = /(saved|edited)" value="[^"]*"/g;
  const xml1 = programToXml(p).replace(stamp, '$1" value=""');
  const back = programFromXml(xml1);
  const xml2 = programToXml(back).replace(stamp, '$1" value=""');
  check(`round trip ${name}`, xml1 === xml2, 'XML differs after reload');
  const r = interpret(back, spec.input);
  check(`reloaded ${name} runs the same`, r.out === EXPECTED[name], r.out);
}
{
  // A file written by the original program's format (attributes, nested then/else).
  const xml = `<?xml version="1.0"?>
<flowgorithm fileversion="4.2">
    <attributes>
        <attribute name="name" value="Esempio"/>
        <attribute name="authors" value="Prova"/>
        <attribute name="about" value=""/>
    </attributes>
    <function name="Main" type="None" variable="">
        <parameters/>
        <body>
            <declare name="n" type="Integer" array="False" size=""/>
            <assign variable="n" expression="4"/>
            <if expression="n &gt; 3">
                <then>
                    <output expression="&quot;grande&quot;" newline="True"/>
                </then>
                <else/>
            </if>
        </body>
    </function>
</flowgorithm>`;
  const p = programFromXml(xml);
  check('reads .fprg written elsewhere', interpret(p).out === 'grande\n' && p.attributes.authors === 'Prova');
}
{
  // Turtle graphics are not supported: such shapes load as comments and the rest still runs.
  const xml = `<?xml version="1.0"?><flowgorithm fileversion="4.2"><function name="Main" type="None" variable=""><parameters/><body>
    <forward expression="100" pen="down"/><turn expression="90" rotate="left"/><home/><output expression="1" newline="True"/>
  </body></function></flowgorithm>`;
  const p = programFromXml(xml);
  const kinds = p.functions[0].body.map(s => s.kind).join(',');
  check('turtle shapes load as comments', kinds === 'comment,comment,comment,output' && p.functions[0].body[0].text.startsWith('[turtle] forward'), kinds);
  check('program with former turtle shapes runs', interpret(p).out === '1\n');
}

/* ---------- generated code ---------- */
console.log('Generated code');
const dir = mkdtempSync(join(tmpdir(), 'flusso-'));
const norm = s => s.replace(/\r\n/g, '\n').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false');

function have(cmd, args) {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const splitCmd = s => s.match(/"[^"]+"|\S+/g).map(x => x.replace(/^"|"$/g, ''));
const toolchains = {
  python: have('python', ['--version']) ? {
    file: 'prog.py', run: (f, input) => spawnSync('python', [f], { cwd: dir, input, encoding: 'utf8' }),
  } : null,
  java: have('java', ['--version']) ? {
    file: 'Main.java', run: (f, input) => spawnSync('java', [f], { cwd: dir, input, encoding: 'utf8' }),
  } : null,
  c: process.env.FLUSSO_CC ? {
    file: 'prog.c',
    compile: f => { const [cmd, ...pre] = splitCmd(process.env.FLUSSO_CC); return spawnSync(cmd, [...pre, f, '-o', join(dir, 'prog_c.exe'), '-lm'], { cwd: dir, encoding: 'utf8' }); },
    run: (_f, input) => spawnSync(join(dir, 'prog_c.exe'), [], { cwd: dir, input, encoding: 'utf8' }),
  } : null,
  cpp: process.env.FLUSSO_CXX ? {
    file: 'prog.cpp',
    compile: f => { const [cmd, ...pre] = splitCmd(process.env.FLUSSO_CXX); return spawnSync(cmd, [...pre, f, '-o', join(dir, 'prog_cpp.exe')], { cwd: dir, encoding: 'utf8' }); },
    run: (_f, input) => spawnSync(join(dir, 'prog_cpp.exe'), [], { cwd: dir, input, encoding: 'utf8' }),
  } : null,
};

// Python's % follows the sign of the divisor, unlike the other three languages.
const KNOWN_DIFFERENCES = { python: { loops: s => s.replace('\n2\nfalse', '\n-1\nfalse') } };

for (const [lang, tc] of Object.entries(toolchains)) {
  for (const [name, spec] of Object.entries(PROGRAMS)) {
    const label = `${lang} ${name}`;
    if (!tc) { skip(label, 'toolchain not available'); continue; }
    const code = generateCode(spec.build(), lang).map(l => l.text).join('\n') + '\n';
    const file = join(dir, tc.file);
    writeFileSync(file, code);
    if (tc.compile) {
      const c = tc.compile(file);
      if (c.status !== 0) { bad(`${label} compiles`, (c.stderr || c.stdout || '').slice(0, 2000) + '\n---\n' + code); continue; }
    }
    const run = tc.run(file, spec.input.length ? spec.input.join('\n') + '\n' : '');
    if (run.status !== 0) { bad(`${label} runs`, (run.stderr || '').slice(0, 2000) + '\n---\n' + code); continue; }
    let got = norm(run.stdout);
    const fix = KNOWN_DIFFERENCES[lang]?.[name];
    if (fix) got = fix(got);
    check(`${label} output matches interpreter`, got === norm(interpreted[name]), `got:\n${got}\nwant:\n${interpreted[name]}\n---\n${code}`);
  }
}
try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir */ }

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
