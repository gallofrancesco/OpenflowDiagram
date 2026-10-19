// Draws the application icon (a small flowchart) and writes build/icon.png.
// 1024x1024: macOS needs at least 512, and Windows/Linux icons are scaled down from it.
// Shapes are described on a 256-unit grid and scaled to the output size.
import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const S = 1024;
const K = S / 256;
const px = new Uint8Array(S * S * 4);

function blend(x, y, [r, g, b], a) {
  if (x < 0 || y < 0 || x >= S || y >= S || a <= 0) return;
  const i = (y * S + x) * 4;
  const na = a + (px[i + 3] / 255) * (1 - a);
  px[i] = Math.round((r * a + px[i] * (px[i + 3] / 255) * (1 - a)) / na);
  px[i + 1] = Math.round((g * a + px[i + 1] * (px[i + 3] / 255) * (1 - a)) / na);
  px[i + 2] = Math.round((b * a + px[i + 2] * (px[i + 3] / 255) * (1 - a)) / na);
  px[i + 3] = Math.round(na * 255);
}

// Fills every pixel whose centre is inside `inside(x, y)`, with 4x4 supersampling for smooth edges.
function fill(inside, color) {
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let n = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside((x + (sx + 0.5) / 4) / K, (y + (sy + 0.5) / 4) / K)) n++;
      if (n) blend(x, y, color, n / 16);
    }
  }
}

const roundRect = (x0, y0, x1, y1, r) => (x, y) => {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const diamond = (cx, cy, w, h) => (x, y) => Math.abs(x - cx) / w + Math.abs(y - cy) / h <= 1;
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

fill(roundRect(8, 8, 248, 248, 52), [47, 111, 214]);           // background tile
const white = [255, 255, 255];
fill(rect(124, 52, 132, 206), white);                         // main flow line
fill(rect(66, 128, 190, 136), white);                         // branches
fill(rect(62, 128, 70, 176), white);
fill(rect(186, 128, 194, 176), white);
fill(roundRect(80, 30, 176, 66, 18), [240, 208, 255]);        // start
fill(diamond(128, 132, 46, 30), [255, 224, 160]);             // decision
fill(roundRect(36, 168, 96, 200, 6), [208, 255, 208]);        // left action
fill(roundRect(160, 168, 220, 200, 6), [255, 252, 208]);      // right action
fill(roundRect(80, 206, 176, 238, 16), [240, 208, 255]);      // end

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  Buffer.from(px.buffer, y * S * 4, S * 4).copy(raw, y * (S * 4 + 1) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(fileURLToPath(new URL('./icon.png', import.meta.url)), png);
console.log('build/icon.png written');
