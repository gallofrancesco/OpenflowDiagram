// Lays out one function as a top-down flowchart and renders it as SVG markup.
// The same markup is used on screen (with click targets) and for PNG/SVG export and printing.
import { isIncomplete } from '../core/model.js';
import { startKey, endKey } from '../core/codegen/common.js';
import { t } from '../core/i18n.js';
import { caption, colorCategory } from './schemes.js';

export { FONT };

const GAP = 32;          // length of the arrow between two shapes
const FONT_SIZE = 15;
const LINE_H = 19;       // text line height
const PAD_X = 30;        // horizontal padding inside a shape
const MIN_W = 90;
const BRANCH_GAP = 36;   // space between the two sides of an If
const LOOP_GAP = 26;     // distance of loop-back lines from the body
const FONT_FAMILY = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
const FONT = `${FONT_SIZE}px ${FONT_FAMILY}`;

let measureCanvas = null;
export function measureText(text) {
  if (typeof document === 'undefined') return text.length * 8;
  if (!measureCanvas) measureCanvas = document.createElement('canvas').getContext('2d');
  measureCanvas.font = FONT;
  return measureCanvas.measureText(text).width;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shapeSize(text, geom) {
  const lines = String(text || ' ').split('\n');
  const tw = Math.max(...lines.map(measureText));
  let w = Math.max(MIN_W, tw + PAD_X * 2);
  let h = Math.max(42, lines.length * LINE_H + 22);
  if (geom === 'diamond') { w = Math.max(110, tw + 72); h = Math.max(58, lines.length * LINE_H + 36); }
  if (geom === 'hexagon') w += 20;
  if (geom === 'para' || geom === 'paraFlip') w += 20;
  if (geom === 'octagon') w = Math.max(w, 130);
  return { w: Math.round(w), h: Math.round(h), lines };
}

/* ---------- layout ---------- */

function layoutStatement(s, style) {
  const geom = style.shapes[s.kind] || 'rect';
  const text = caption(s, style.verbose);
  const size = shapeSize(text, geom);
  const shape = { s, geom, ...size };

  if (s.kind === 'if') {
    const thenB = layoutBlock(s.then, style);
    const elseB = layoutBlock(s.else, style);
    const elseAxis = -Math.max(size.w / 2 + 12, elseB.right + BRANCH_GAP / 2);
    const thenAxis = Math.max(size.w / 2 + 12, thenB.left + BRANCH_GAP / 2);
    const bodyH = Math.max(thenB.h, elseB.h);
    return {
      left: -elseAxis + elseB.left, right: thenAxis + thenB.right, h: size.h + bodyH + 18,
      place(x, y, out) {
        out.shapes.push({ ...shape, x, y });
        const midY = y + size.h / 2, top = y + size.h, bottom = top + bodyH, merge = bottom + 12;
        const ex = x + elseAxis, tx = x + thenAxis;
        out.lines.push({ pts: [[x - size.w / 2, midY], [ex, midY], [ex, top]] });
        out.lines.push({ pts: [[x + size.w / 2, midY], [tx, midY], [tx, top]] });
        out.labels.push({ x: x - size.w / 2 - 4, y: midY - 6, text: t('falseWord'), anchor: 'end' });
        out.labels.push({ x: x + size.w / 2 + 4, y: midY - 6, text: t('trueWord'), anchor: 'start' });
        elseB.place(ex, top, out, s, 'else');
        thenB.place(tx, top, out, s, 'then');
        out.lines.push({ pts: [[ex, top + elseB.h], [ex, merge], [x, merge]], arrow: true });
        out.lines.push({ pts: [[tx, top + thenB.h], [tx, merge], [x, merge]], arrow: true });
        out.lines.push({ pts: [[x, merge], [x, y + size.h + bodyH + 18]] });
        out.dots.push({ x, y: merge });
      },
    };
  }

  if (s.kind === 'while' || s.kind === 'for') {
    const body = layoutBlock(s.body, style);
    const backX = -(Math.max(body.left, size.w / 2) + LOOP_GAP);
    const exitX = Math.max(body.right, size.w / 2) + LOOP_GAP;
    return {
      left: -backX + 6, right: exitX + 30, h: size.h + body.h + 24,
      place(x, y, out) {
        out.shapes.push({ ...shape, x, y });
        const midY = y + size.h / 2, top = y + size.h, bottom = top + body.h;
        body.place(x, top, out, s, 'body');
        out.lines.push({ pts: [[x, bottom], [x, bottom + 10], [x + backX, bottom + 10], [x + backX, midY], [x - size.w / 2, midY]], arrow: true });
        out.lines.push({ pts: [[x + size.w / 2, midY], [x + exitX, midY], [x + exitX, bottom + 22], [x, bottom + 22], [x, y + size.h + body.h + 24]] });
        out.labels.push({ x: x + 5, y: top + 12, text: t('trueWord'), anchor: 'start' });
        out.labels.push({ x: x + size.w / 2 + 4, y: midY - 6, text: t('falseWord'), anchor: 'start' });
      },
    };
  }

  if (s.kind === 'do') {
    const body = layoutBlock(s.body, style);
    const backX = -(Math.max(body.left, size.w / 2) + LOOP_GAP);
    return {
      left: -backX + 6, right: Math.max(body.right, size.w / 2) + 6, h: body.h + size.h + GAP / 2,
      place(x, y, out) {
        out.lines.push({ pts: [[x, y], [x, y + GAP / 2]] });
        const top = y + GAP / 2;
        body.place(x, top, out, s, 'body');
        const hy = top + body.h;
        out.shapes.push({ ...shape, x, y: hy });
        const midY = hy + size.h / 2;
        out.lines.push({ pts: [[x - size.w / 2, midY], [x + backX, midY], [x + backX, y + 6], [x, y + 6]], arrow: true });
        out.labels.push({ x: x - size.w / 2 - 4, y: midY - 6, text: t('trueWord'), anchor: 'end' });
        out.labels.push({ x: x + 5, y: hy + size.h + 12, text: t('falseWord'), anchor: 'start' });
      },
    };
  }

  return {
    left: size.w / 2, right: size.w / 2, h: size.h,
    place(x, y, out) {
      out.shapes.push({ ...shape, x, y });
    },
  };
}

// A block is a vertical list of statements separated by arrows; each arrow is an insertion point.
function layoutBlock(list, style) {
  const items = list.map(s => layoutStatement(s, style));
  const left = Math.max(30, ...items.map(i => i.left));
  const right = Math.max(30, ...items.map(i => i.right));
  const h = GAP + items.reduce((sum, i) => sum + i.h + GAP, 0);
  return {
    left, right, h,
    // finalArrow: the last arrow points into a shape (the End terminal) rather than into a join.
    place(x, y, out, parent = null, slot = 'body', finalArrow = false) {
      let cy = y;
      for (let i = 0; i <= items.length; i++) {
        out.gaps.push({ list, index: i, parent, slot, x, y1: cy, y2: cy + GAP });
        out.lines.push({ pts: [[x, cy], [x, cy + GAP]], arrow: i < items.length || finalArrow });
        cy += GAP;
        if (i < items.length) {
          items[i].place(x, cy, out);
          cy += items[i].h;
        }
      }
    },
  };
}

function functionCaptions(func) {
  const isMain = func.name.toLowerCase() === 'main';
  const params = func.params.map(p => `${p.type}${p.array ? ' Array' : ''} ${p.name}`).join(', ');
  const start = isMain ? t('main') : `${func.name}(${params})`;
  const end = func.type !== 'None' && func.variable ? `${t('returnWord')} ${func.type} ${func.variable}` : t('end');
  return { start, end };
}

export function layoutFunction(func, style) {
  const caps = functionCaptions(func);
  const startSize = shapeSize(caps.start, 'stadium');
  const endSize = shapeSize(caps.end, 'stadium');
  const block = layoutBlock(func.body, style);
  const margin = 30;
  const left = Math.max(block.left, startSize.w / 2, endSize.w / 2) + margin;
  const right = Math.max(block.right, startSize.w / 2, endSize.w / 2) + margin;
  const out = { shapes: [], lines: [], labels: [], gaps: [], dots: [] };
  const x = left, y = margin;
  out.shapes.push({ terminal: 'start', key: startKey(func), geom: 'stadium', x, y, ...startSize, func });
  block.place(x, y + startSize.h, out, null, 'body', true);
  const endY = y + startSize.h + block.h;
  out.shapes.push({ terminal: 'end', key: endKey(func), geom: 'stadium', x, y: endY, ...endSize, func });
  return { ...out, width: Math.ceil(left + right), height: Math.ceil(endY + endSize.h + margin) };
}

/* ---------- rendering ---------- */

function shapePath(geom, x, y, w, h) {
  const l = x - w / 2, r = x + w / 2, b = y + h, m = y + h / 2;
  const pts = arr => `<polygon points="${arr.map(p => p.join(',')).join(' ')}"/>`;
  const s = 14;
  switch (geom) {
    case 'stadium': return `<rect x="${l}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>`;
    case 'para': return pts([[l + s, y], [r, y], [r - s, b], [l, b]]);
    case 'paraFlip': return pts([[l, y], [r - s, y], [r, b], [l + s, b]]);
    case 'diamond': return pts([[x, y], [r, m], [x, b], [l, m]]);
    case 'hexagon': return pts([[l + 16, y], [r - 16, y], [r, m], [r - 16, b], [l + 16, b], [l, m]]);
    case 'card': return pts([[l + 12, y], [r, y], [r, b], [l, b], [l, y + 12]]);
    case 'octagon': {
      const c = Math.min(14, h / 3);
      return pts([[l + c, y], [r - c, y], [r, y + c], [r, b - c], [r - c, b], [l + c, b], [l, b - c], [l, y + c]]);
    }
    case 'bracket':
      return `<rect class="comment-bg" x="${l}" y="${y}" width="${w}" height="${h}" stroke="none"/>`
        + `<path fill="none" d="M${l + 14},${y} L${l},${y} L${l},${b} L${l + 14},${b}"/>`;
    case 'store':
      return `<rect x="${l}" y="${y}" width="${w}" height="${h}" rx="8"/>`
        + `<path fill="none" d="M${l + 9},${y} L${l + 9},${b} M${l},${y + 9} L${r},${y + 9}"/>`;
    case 'sides':
      return `<rect x="${l}" y="${y}" width="${w}" height="${h}" rx="8"/>`
        + `<path fill="none" d="M${l + 9},${y} L${l + 9},${b} M${r - 9},${y} L${r - 9},${b}"/>`;
    default: return `<rect x="${l}" y="${y}" width="${w}" height="${h}" rx="8"/>`;
  }
}

// Small picture of a shape, drawn with the chart's own geometry and colors (used by the insert menu).
export function shapeIcon(kind, label, scheme, style, w = 112, h = 38) {
  const geom = style.shapes[kind] || 'rect';
  const col = scheme[colorCategory(kind)] || scheme.assign;
  const pad = 2;
  const W = w + pad * 2, H = h + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">`
    + `<g fill="${col.fill}" stroke="${col.border}" stroke-width="1.6">${shapePath(geom, W / 2, pad, w, h)}`
    + `<text x="${W / 2}" y="${pad + h / 2 + 5}" fill="${col.text}" stroke="none" text-anchor="middle" font-size="14" font-family='${FONT_FAMILY}'>${esc(label)}</text></g></svg>`;
}

function arrowHead(pts, color) {
  const [x2, y2] = pts[pts.length - 1];
  const [x1, y1] = pts[pts.length - 2];
  const a = Math.atan2(y2 - y1, x2 - x1);
  const L = 10, W = 5.5;
  const bx = x2 - L * Math.cos(a), by = y2 - L * Math.sin(a);
  const sx = W * Math.sin(a), sy = W * Math.cos(a);
  return `<polygon fill="${color}" stroke="none" points="${x2},${y2} ${bx - sx},${by + sy} ${bx + sx},${by - sy}"/>`;
}

/*
 options: { scheme, interactive, selectedIds:Set, executingKey, errorKey, scale }
*/
export function renderSvg(layout, options) {
  const { scheme, interactive = false, selectedIds = new Set(), executingKey = null, errorKey = null, scale = 1 } = options;
  const parts = [];
  const W = layout.width, H = layout.height;
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * scale)}" height="${Math.round(H * scale)}" viewBox="0 0 ${W} ${H}" font-family='${FONT_FAMILY}' font-size="${FONT_SIZE}">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${scheme.page}"/>`);
  parts.push(`<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="${scheme.page}"/><line x1="0" y1="0" x2="0" y2="8" stroke="${scheme.error}" stroke-opacity="0.35" stroke-width="3"/></pattern></defs>`);

  for (const ln of layout.lines) {
    const d = ln.pts.map(p => p.join(',')).join(' ');
    parts.push(`<polyline fill="none" stroke="${scheme.line}" stroke-width="1.7" points="${d}"/>`);
    if (ln.arrow) parts.push(arrowHead(ln.pts, scheme.line));
  }
  for (const dot of layout.dots) parts.push(`<circle cx="${dot.x}" cy="${dot.y}" r="4" fill="${scheme.line}"/>`);
  for (const lb of layout.labels) {
    parts.push(`<text x="${lb.x}" y="${lb.y}" fill="${scheme.label}" font-size="13" text-anchor="${lb.anchor}">${esc(lb.text)}</text>`);
  }

  for (const sh of layout.shapes) {
    const key = sh.terminal ? sh.key : sh.s.id;
    const cat = sh.terminal ? 'terminal' : colorCategory(sh.s.kind);
    const col = scheme[cat] || scheme.assign;
    const incomplete = !sh.terminal && sh.s.kind !== 'comment' && isIncomplete(sh.s);
    let stroke = col.border, strokeW = 1.8;
    if (selectedIds.has(key)) { stroke = scheme.selected; strokeW = 3; }
    if (key === executingKey) { stroke = scheme.executing; strokeW = 3.5; }
    if (key === errorKey) { stroke = scheme.error; strokeW = 3.5; }
    const fill = incomplete ? 'url(#hatch)' : col.fill;
    const attrs = interactive
      ? ` class="shape${selectedIds.has(key) ? ' selected' : ''}" data-key="${key}"${sh.terminal ? ` data-terminal="${sh.terminal}"` : ''}`
      : '';
    parts.push(`<g${attrs} fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}">`);
    if (key === executingKey) {
      parts.push(`<g opacity="0.25" stroke="${scheme.executing}" stroke-width="10" fill="none">${shapePath(sh.geom, sh.x, sh.y, sh.w, sh.h)}</g>`);
    }
    parts.push(shapePath(sh.geom, sh.x, sh.y, sh.w, sh.h));
    const lines = sh.lines;
    const textColor = incomplete ? scheme.label : col.text;
    const ty = sh.y + sh.h / 2 - ((lines.length - 1) * LINE_H) / 2 + 5.5;
    lines.forEach((line, i) => {
      parts.push(`<text x="${sh.x}" y="${ty + i * LINE_H}" fill="${textColor}" stroke="none" text-anchor="middle">${esc(line)}</text>`);
    });
    parts.push('</g>');
  }

  if (interactive) {
    layout.gaps.forEach((g, i) => {
      parts.push(`<rect class="gap" data-gap="${i}" x="${g.x - 16}" y="${g.y1 + 2}" width="32" height="${g.y2 - g.y1 - 4}" fill="transparent"/>`);
    });
  }
  parts.push('</svg>');
  return parts.join('');
}
