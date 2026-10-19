// Sample programs shared by the tests and the examples folder.
import { createProgram, createStatement as S, createFunction } from '../src/core/model.js';

const param = (name, type, array = false) => ({ name, type, array });

function program(name, main, functions = []) {
  const p = createProgram();
  p.attributes.name = name;
  p.functions[0].body = main;
  p.functions.push(...functions);
  return p;
}

export const PROGRAMS = {
  factorial: {
    input: [],
    build: () => program('Fattoriale', [
      S('declare', { names: 'n, i', type: 'Integer' }),
      S('assign', { variable: 'n', expression: '6' }),
      S('for', { variable: 'i', start: '1', end: 'n', body: [S('output', { expression: '"Fatt(" & i & ") = " & Fact(i)' })] }),
    ], [createFunction('Fact', {
      type: 'Integer', variable: 'r', params: [param('k', 'Integer')],
      body: [
        S('declare', { names: 'r', type: 'Integer' }),
        S('if', { expression: 'k <= 1', then: [S('assign', { variable: 'r', expression: '1' })], else: [S('assign', { variable: 'r', expression: 'k * Fact(k - 1)' })] }),
      ],
    })]),
  },

  strings: {
    input: [],
    build: () => program('Stringhe', [
      S('declare', { names: 'nome, inverso', type: 'String' }),
      S('declare', { names: 'i', type: 'Integer' }),
      S('assign', { variable: 'nome', expression: '"OpenflowDiagram"' }),
      S('assign', { variable: 'inverso', expression: '""' }),
      S('for', { variable: 'i', start: 'Len(nome) - 1', end: '0', direction: 'dec', body: [
        S('assign', { variable: 'inverso', expression: 'inverso & Char(nome, i)' }),
      ] }),
      S('output', { expression: 'inverso' }),
      S('output', { expression: '"Lunghezza: " & Len(nome)' }),
      S('output', { expression: 'ToCode("A") + 1' }),
      S('output', { expression: 'ToChar(66) & ToString(42) & "!"' }),
      S('output', { expression: 'ToInteger("17") * 2' }),
      S('if', { expression: '"abc" < "abd" and nome == "OpenflowDiagram"', then: [S('output', { expression: '"ordinato"' })], else: [S('output', { expression: '"no"' })] }),
      S('output', { expression: '"a" + "b"', newline: false }),
      S('output', { expression: '"c"' }),
    ]),
  },

  arrays: {
    input: [],
    build: () => program('Ordinamento', [
      S('declare', { names: 'v', type: 'Integer', array: true, size: '6' }),
      S('declare', { names: 'i', type: 'Integer' }),
      S('assign', { variable: 'v[0]', expression: '42' }),
      S('assign', { variable: 'v[1]', expression: '7' }),
      S('assign', { variable: 'v[2]', expression: '19' }),
      S('assign', { variable: 'v[3]', expression: '-3' }),
      S('assign', { variable: 'v[4]', expression: '7' }),
      S('assign', { variable: 'v[5]', expression: '100' }),
      S('call', { expression: 'Ordina(v)' }),
      S('for', { variable: 'i', start: '0', end: 'Size(v) - 1', body: [S('output', { expression: 'v[i]' })] }),
      S('output', { expression: '"Somma = " & Somma(v)' }),
    ], [
      createFunction('Ordina', {
        params: [param('a', 'Integer', true)],
        body: [
          S('declare', { names: 'i, j, t', type: 'Integer' }),
          S('for', { variable: 'i', start: '0', end: 'Size(a) - 2', body: [
            S('for', { variable: 'j', start: '0', end: 'Size(a) - 2 - i', body: [
              S('if', { expression: 'a[j] > a[j + 1]', then: [
                S('assign', { variable: 't', expression: 'a[j]' }),
                S('assign', { variable: 'a[j]', expression: 'a[j + 1]' }),
                S('assign', { variable: 'a[j + 1]', expression: 't' }),
              ] }),
            ] }),
          ] }),
        ],
      }),
      createFunction('Somma', {
        type: 'Integer', variable: 's', params: [param('a', 'Integer', true)],
        body: [
          S('declare', { names: 's, i', type: 'Integer' }),
          S('assign', { variable: 's', expression: '0' }),
          S('for', { variable: 'i', start: '0', end: 'Size(a) - 1', body: [S('assign', { variable: 's', expression: 's + a[i]' })] }),
        ],
      }),
    ]),
  },

  loops: {
    input: [],
    build: () => program('Cicli', [
      S('declare', { names: 'n, passi', type: 'Integer' }),
      S('comment', { text: 'Congettura di Collatz' }),
      S('assign', { variable: 'n', expression: '27' }),
      S('assign', { variable: 'passi', expression: '0' }),
      S('while', { expression: 'n != 1', body: [
        S('if', { expression: 'n % 2 == 0', then: [S('assign', { variable: 'n', expression: 'Int(n / 2)' })], else: [S('assign', { variable: 'n', expression: '3 * n + 1' })] }),
        S('assign', { variable: 'passi', expression: 'passi + 1' }),
      ] }),
      S('output', { expression: '"Passi: " & passi' }),
      S('assign', { variable: 'n', expression: '0' }),
      S('do', { expression: 'n < 3', body: [
        S('output', { expression: 'n * 10', newline: false }),
        S('output', { expression: '" "', newline: false }),
        S('assign', { variable: 'n', expression: 'n + 1' }),
      ] }),
      S('output', { expression: '""' }),
      S('for', { variable: 'n', start: '10', end: '1', direction: 'dec', step: '3', body: [S('output', { expression: 'n' })] }),
      S('output', { expression: '2 ^ 10' }),
      S('output', { expression: '-7 % 3' }),
      S('output', { expression: 'not (3 > 2) or false' }),
      S('output', { expression: 'Abs(-5) + Sgn(-9)' }),
      S('breakpoint', { always: true }),
    ]),
  },

  input: {
    input: ['Ada', '3', '10', '20', '35', 'true'],
    build: () => program('Input', [
      S('declare', { names: 'nome', type: 'String' }),
      S('declare', { names: 'n, i, x, somma', type: 'Integer' }),
      S('declare', { names: 'ok', type: 'Boolean' }),
      S('output', { expression: '"Come ti chiami?"' }),
      S('input', { variable: 'nome' }),
      S('input', { variable: 'n' }),
      S('assign', { variable: 'somma', expression: '0' }),
      S('for', { variable: 'i', start: '1', end: 'n', body: [
        S('input', { variable: 'x' }),
        S('assign', { variable: 'somma', expression: 'somma + x' }),
      ] }),
      S('input', { variable: 'ok' }),
      S('output', { expression: '"Ciao " & nome & ", somma = " & somma' }),
      S('if', { expression: 'ok', then: [S('output', { expression: '"confermato"' })] }),
    ]),
  },

  files: {
    input: [],
    build: () => program('File', [
      S('declare', { names: 'i, x, tot', type: 'Integer' }),
      S('open', { expression: '"dati_esempio.txt"', mode: 'write' }),
      S('for', { variable: 'i', start: '1', end: '5', body: [S('write', { expression: 'i * i' })] }),
      S('close'),
      S('open', { expression: '"dati_esempio.txt"', mode: 'read' }),
      S('assign', { variable: 'tot', expression: '0' }),
      S('while', { expression: 'not EOF()', body: [
        S('read', { variable: 'x' }),
        S('assign', { variable: 'tot', expression: 'tot + x' }),
      ] }),
      S('close'),
      S('output', { expression: '"Totale: " & tot' }),
    ]),
  },

};
