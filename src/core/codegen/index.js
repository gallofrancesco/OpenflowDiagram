// The only target languages offered by this application: C, C++, Java and Python.
import { CGenerator } from './c.js';
import { CppGenerator } from './cpp.js';
import { JavaGenerator } from './java.js';
import { PythonGenerator } from './python.js';

export const GENERATORS = [CGenerator, CppGenerator, JavaGenerator, PythonGenerator];

export function generatorFor(key) {
  return GENERATORS.find(g => g.key === key) || CppGenerator;
}

// Returns [{text, id}] lines; id links a line back to the shape that produced it.
export function generateCode(program, key, messages = {}) {
  const G = generatorFor(key);
  return new G(program, { messages }).generate();
}
