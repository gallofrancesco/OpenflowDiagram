// Trace table view: live HTML table plus an SVG rendering used for PNG export.
import { t } from '../core/i18n.js';
import { MAX_TRACE_ROWS } from '../core/trace.js';
import { h } from './dialogs.js';

// Column descriptors shared by the HTML table and the exported image.
export function traceColumns(config, program) {
  const multi = program.functions.length > 1;
  const mainName = program.functions[0].name.toLowerCase();
  const cols = [{ key: 'n', label: t('traceStep') }];
  if (multi) cols.push({ key: 'func', label: t('traceFunction') });
  cols.push({ key: 'block', label: t('traceBlock') }, { key: 'result', label: t('traceResult') });
  config.items.forEach((item, i) => {
    const prefix = multi && item.func.toLowerCase() !== mainName ? `${item.func}: ` : '';
    cols.push({ key: 'value', index: i, label: prefix + item.text, expr: item.kind === 'expr' });
  });
  if (config.output) cols.push({ key: 'output', label: t('traceOutput') });
  return cols;
}

function cellContent(col, row, program) {
  switch (col.key) {
    case 'n': return { text: String(row.n), cls: 'num' };
    case 'func': return { text: row.func === program.functions[0].name ? t('main') : row.func, cls: 'muted' };
    case 'block': return { text: row.block, cls: 'block' };
    case 'result':
      if (row.result === null) return { text: '', cls: '' };
      return { text: row.result ? t('trueWord') : t('falseWord'), cls: row.result ? 'yes' : 'no' };
    case 'output': return { text: row.output, cls: 'out' };
    default: {
      const v = row.values[col.index];
      if (v.state === 'ok') return { text: v.text, cls: v.changed ? 'val changed' : 'val' };
      if (v.state === 'uninit') return { text: '?', cls: 'val muted' };
      if (v.state === 'error') return { text: '—', cls: 'val muted' };
      return { text: '', cls: 'val' };
    }
  }
}

export function visibleRows(recorder, onlyChanges) {
  if (!onlyChanges) return recorder.rows;
  return recorder.rows.filter((r, i) => i === 0 || r.result !== null || r.output || r.values.some(v => v.changed));
}

export function renderTraceTable(container, recorder, program, { onlyChanges }) {
  if (!recorder || !recorder.rows.length) {
    container.replaceChildren(h('p', { class: 'trace-empty' }, t('traceEmpty')));
    return;
  }
  const cols = traceColumns(recorder.config, program);
  const rows = visibleRows(recorder, onlyChanges);
  const head = h('thead', {}, h('tr', {}, cols.map(c => h('th', { class: `c-${c.key}${c.expr ? ' expr' : ''}` }, c.label))));
  const body = h('tbody', {}, rows.map((r, i) => h('tr', { class: i === rows.length - 1 ? 'current' : '' },
    cols.map(c => {
      const { text, cls } = cellContent(c, r, program);
      return h('td', { class: `c-${c.key} ${cls}` }, c.key === 'result' && text ? h('span', { class: `pill ${cls}` }, text) : text);
    }))));
  const parts = [h('table', { class: 'trace-table' }, head, body)];
  if (recorder.truncated) parts.push(h('p', { class: 'trace-note' }, t('traceLimit', { n: MAX_TRACE_ROWS })));
  container.replaceChildren(...parts);
  container.querySelector('tr.current')?.scrollIntoView({ block: 'nearest' });
}

/* ---------- PNG export ---------- */

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';

export function traceToSvg(recorder, program, { onlyChanges, title }) {
  const cols = traceColumns(recorder.config, program);
  const rows = visibleRows(recorder, onlyChanges);
  const g = document.createElement('canvas').getContext('2d');
  const measure = (text, bold) => {
    g.font = `${bold ? 600 : 400} 14px ${FONT}`;
    return g.measureText(text).width;
  };
  const PAD = 14, ROW = 32, HEAD = 38, TITLE = title ? 46 : 0, MARGIN = 20;
  const widths = cols.map(c => Math.max(measure(c.label, true),
    ...rows.map(r => measure(cellContent(c, r, program).text, true))) + PAD * 2);
  const W = widths.reduce((a, b) => a + b, 0) + MARGIN * 2;
  const H = TITLE + HEAD + rows.length * ROW + MARGIN * 2;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family='${FONT}' font-size="14">`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`];
  if (title) out.push(`<text x="${MARGIN}" y="${MARGIN + 22}" font-size="19" font-weight="600" fill="#1c1c1e">${esc(title)}</text>`);
  const top = MARGIN + TITLE;
  const tableW = W - MARGIN * 2;
  out.push(`<rect x="${MARGIN}" y="${top}" width="${tableW}" height="${HEAD}" fill="#f2f2f7"/>`);
  let x = MARGIN;
  cols.forEach((c, i) => {
    out.push(`<text x="${x + PAD}" y="${top + 24}" font-weight="600" fill="#3a3a3c">${esc(c.label)}</text>`);
    x += widths[i];
  });
  rows.forEach((r, ri) => {
    const y = top + HEAD + ri * ROW;
    if (ri % 2 === 1) out.push(`<rect x="${MARGIN}" y="${y}" width="${tableW}" height="${ROW}" fill="#fafafc"/>`);
    let cx = MARGIN;
    cols.forEach((c, i) => {
      const { text, cls } = cellContent(c, r, program);
      if (cls.includes('changed')) out.push(`<rect x="${cx + 1}" y="${y + 1}" width="${widths[i] - 2}" height="${ROW - 2}" rx="4" fill="#fff4cc"/>`);
      let color = '#1c1c1e', weight = 400;
      if (cls.includes('muted')) color = '#8a8a8e';
      if (cls.includes('yes')) { color = '#1e8a3c'; weight = 600; }
      if (cls.includes('no')) { color = '#d70015'; weight = 600; }
      if (cls.includes('changed')) weight = 600;
      if (cls.includes('out')) color = '#0060d1';
      out.push(`<text x="${cx + PAD}" y="${y + 21}" fill="${color}" font-weight="${weight}">${esc(text)}</text>`);
      cx += widths[i];
    });
    out.push(`<line x1="${MARGIN}" y1="${y + ROW}" x2="${MARGIN + tableW}" y2="${y + ROW}" stroke="#e8e8ed"/>`);
  });
  let lx = MARGIN;
  widths.slice(0, -1).forEach(w => {
    lx += w;
    out.push(`<line x1="${lx}" y1="${top}" x2="${lx}" y2="${top + HEAD + rows.length * ROW}" stroke="#e8e8ed"/>`);
  });
  out.push(`<rect x="${MARGIN}" y="${top}" width="${tableW}" height="${HEAD + rows.length * ROW}" fill="none" stroke="#d8d8dd" rx="6"/>`);
  out.push('</svg>');
  return out.join('');
}
