// Writes the sample programs to examples/*.fprg.
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { PROGRAMS } from './programs.mjs';
import { programToXml } from '../src/core/model.js';

const dir = fileURLToPath(new URL('../examples/', import.meta.url));
mkdirSync(dir, { recursive: true });
for (const spec of Object.values(PROGRAMS)) {
  const p = spec.build();
  const file = `${dir}${p.attributes.name}.fprg`;
  writeFileSync(file, programToXml(p));
  console.log(file);
}
