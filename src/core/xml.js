// Minimal XML reader/writer, enough for .fprg program files.
// Works both in the browser and in Node (no DOM dependency).

export class XmlNode {
  constructor(name, attrs = {}, children = []) {
    this.name = name;
    this.attrs = attrs;
    this.children = children;
  }
  attr(name, fallback = '') {
    const key = Object.keys(this.attrs).find(k => k.toLowerCase() === name.toLowerCase());
    return key === undefined ? fallback : this.attrs[key];
  }
  child(name) {
    return this.children.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
  }
  childrenNamed(name) {
    return this.children.filter(c => c.name.toLowerCase() === name.toLowerCase());
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[e] ?? m;
  });
}

export function encode(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;')
    .replace(/\t/g, '&#9;');
}

export function parseXml(text) {
  let i = 0;
  const n = text.length;
  const root = new XmlNode('#document');
  const stack = [root];

  const fail = msg => {
    throw new Error(`XML: ${msg} (pos ${i})`);
  };

  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt < 0) break;
    i = lt;
    if (text.startsWith('<?', i)) {
      const end = text.indexOf('?>', i);
      if (end < 0) fail('unterminated declaration');
      i = end + 2;
    } else if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i);
      if (end < 0) fail('unterminated comment');
      i = end + 3;
    } else if (text.startsWith('<![CDATA[', i)) {
      const end = text.indexOf(']]>', i);
      i = end < 0 ? n : end + 3;
    } else if (text.startsWith('<!', i)) {
      const end = text.indexOf('>', i);
      i = end < 0 ? n : end + 1;
    } else if (text.startsWith('</', i)) {
      const end = text.indexOf('>', i);
      if (end < 0) fail('unterminated end tag');
      const name = text.slice(i + 2, end).trim();
      const top = stack.pop();
      if (!top || top.name !== name) fail(`mismatched </${name}>`);
      i = end + 1;
    } else {
      i++;
      const nameMatch = /^[^\s/>]+/.exec(text.slice(i, i + 200));
      if (!nameMatch) fail('bad tag name');
      const node = new XmlNode(nameMatch[0]);
      i += nameMatch[0].length;
      for (;;) {
        while (i < n && /\s/.test(text[i])) i++;
        if (text[i] === '/' && text[i + 1] === '>') {
          i += 2;
          stack[stack.length - 1].children.push(node);
          break;
        }
        if (text[i] === '>') {
          i++;
          stack[stack.length - 1].children.push(node);
          stack.push(node);
          break;
        }
        const am = /^([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/.exec(text.slice(i));
        if (!am) fail('bad attribute');
        node.attrs[am[1]] = decode(am[3] ?? am[4]);
        i += am[0].length;
      }
    }
  }
  if (stack.length !== 1) fail('unclosed elements');
  return root;
}

export function writeXml(node, indent = '') {
  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => ` ${k}="${encode(v)}"`)
    .join('');
  if (!node.children.length) return `${indent}<${node.name}${attrs}/>\n`;
  let out = `${indent}<${node.name}${attrs}>\n`;
  for (const c of node.children) out += writeXml(c, indent + '    ');
  return out + `${indent}</${node.name}>\n`;
}
