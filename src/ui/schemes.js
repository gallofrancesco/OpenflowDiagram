// Color schemes and chart styles for the flowchart.
import { t } from '../core/i18n.js';

const c = (fill, border, text = '#1d1d1f') => ({ fill, border, text });

export const COLOR_SCHEMES = {
  // Default: soft tints of Apple's system colors.
  system: {
    name: 'Sistema',
    page: '#ffffff', line: '#48484a', label: '#86868b', selected: '#007aff', executing: '#ff9500', error: '#ff3b30',
    terminal: c('#f1e6fb', '#af52de'), declare: c('#fff6d5', '#d6a400'), assign: c('#fff6d5', '#d6a400'),
    input: c('#e2f6e7', '#34c759'), output: c('#e2f6e7', '#34c759'), if: c('#ffefd9', '#ff9500'),
    loop: c('#ffe6e4', '#ff6961'), call: c('#e3efff', '#007aff'), comment: c('#f5f5f7', '#aeaeb2', '#6e6e73'),
    breakpoint: c('#ff3b30', '#d70015', '#ffffff'), file: c('#efe9ff', '#5e5ce6'),
  },
  pastel: {
    name: 'Pastello',
    page: '#ffffff', line: '#404040', label: '#606060', selected: '#2f6fd6', executing: '#ff8c1a', error: '#e02424',
    terminal: c('#f0d0ff', '#9070a0'), declare: c('#fffcd0', '#a0a070'), assign: c('#fffcd0', '#a0a070'),
    input: c('#d0ffd0', '#70a070'), output: c('#d0ffd0', '#70a070'), if: c('#ffe0a0', '#a08040'),
    loop: c('#ffd0d0', '#a07070'), call: c('#d0e0ff', '#7080a0'), comment: c('#f4f4f4', '#909090', '#505050'),
    breakpoint: c('#ff6060', '#a02020', '#ffffff'), file: c('#e8e0ff', '#8070b0'),
  },
  vibrant: {
    name: 'Vivace',
    page: '#ffffff', line: '#202020', label: '#404040', selected: '#0050ff', executing: '#ff6a00', error: '#d00000',
    terminal: c('#b070ff', '#6a2fb0', '#ffffff'), declare: c('#ffe94d', '#b39b00'), assign: c('#ffe94d', '#b39b00'),
    input: c('#4dd16a', '#1f8a3a'), output: c('#4dd16a', '#1f8a3a'), if: c('#ffae3d', '#b06a00'),
    loop: c('#ff6b6b', '#b02a2a', '#ffffff'), call: c('#5aa0ff', '#1f5fb0', '#ffffff'), comment: c('#eeeeee', '#888888', '#444444'),
    breakpoint: c('#d00000', '#700000', '#ffffff'), file: c('#a38cff', '#5a3fc0', '#ffffff'),
  },
  blackwhite: {
    name: 'Bianco e nero',
    page: '#ffffff', line: '#000000', label: '#000000', selected: '#000000', executing: '#7a7a7a', error: '#000000',
    terminal: c('#ffffff', '#000000', '#000000'), declare: c('#ffffff', '#000000', '#000000'), assign: c('#ffffff', '#000000', '#000000'),
    input: c('#ffffff', '#000000', '#000000'), output: c('#ffffff', '#000000', '#000000'), if: c('#ffffff', '#000000', '#000000'),
    loop: c('#ffffff', '#000000', '#000000'), call: c('#ffffff', '#000000', '#000000'), comment: c('#ffffff', '#000000', '#000000'),
    breakpoint: c('#ffffff', '#000000', '#000000'), file: c('#ffffff', '#000000', '#000000'),
  },
  blueprint: {
    name: 'Progetto',
    page: '#1f4f8a', line: '#e6f0ff', label: '#cfe0ff', selected: '#ffffff', executing: '#ffd34d', error: '#ff7070',
    terminal: c('#2c6bb3', '#e6f0ff', '#ffffff'), declare: c('#2c6bb3', '#e6f0ff', '#ffffff'), assign: c('#2c6bb3', '#e6f0ff', '#ffffff'),
    input: c('#2c6bb3', '#e6f0ff', '#ffffff'), output: c('#2c6bb3', '#e6f0ff', '#ffffff'), if: c('#2c6bb3', '#e6f0ff', '#ffffff'),
    loop: c('#2c6bb3', '#e6f0ff', '#ffffff'), call: c('#2c6bb3', '#e6f0ff', '#ffffff'), comment: c('#1f4f8a', '#b0c8ef', '#cfe0ff'),
    breakpoint: c('#c04040', '#ffffff', '#ffffff'), file: c('#2c6bb3', '#e6f0ff', '#ffffff'),
  },
};

// Geometry of each shape kind per chart style.
const STANDARD = {
  terminal: 'stadium', declare: 'store', assign: 'rect', input: 'para', output: 'paraFlip', if: 'diamond',
  while: 'hexagon', for: 'hexagon', do: 'hexagon', call: 'sides', comment: 'bracket', breakpoint: 'octagon',
  open: 'card', close: 'card', read: 'para', write: 'paraFlip',
};

export const CHART_STYLES = {
  standard: { name: 'Standard', shapes: STANDARD, verbose: false },
  verbose: { name: 'Descrittivo', shapes: STANDARD, verbose: true },
  classic: {
    name: 'Classico',
    shapes: { ...STANDARD, declare: 'rect', while: 'diamond', for: 'rect', do: 'diamond', input: 'para', output: 'para', open: 'rect', close: 'rect' },
    verbose: true,
  },
};

export function colorCategory(kind) {
  if (['while', 'for', 'do'].includes(kind)) return 'loop';
  if (['open', 'close', 'read', 'write'].includes(kind)) return 'file';
  return kind;
}

// Text shown inside a shape.
export function caption(s, verbose) {
  const kw = k => (verbose ? t(`shape_${k}`) + ' ' : '');
  switch (s.kind) {
    case 'declare': {
      const base = `${s.type}${s.array ? ' Array' : ''} ${s.names}${s.array ? `[${s.size}]` : ''}`;
      return kw('declare') + base;
    }
    case 'assign': return `${kw('assign')}${s.variable} = ${s.expression}`;
    case 'input': return `${t('shape_input')} ${s.variable}`;
    case 'output': return `${t('shape_output')} ${s.expression}`;
    case 'if': return kw('if') + s.expression;
    case 'while': return kw('while') + s.expression;
    case 'do': return kw('do') + s.expression;
    case 'for': {
      const dec = s.direction === 'dec';
      const step = s.step && s.step.trim() !== '1' ? ` step ${s.step}` : '';
      return `${kw('for')}${s.variable} = ${s.start} to ${s.end}${dec ? ' decreasing' : ''}${step}`;
    }
    case 'call': return kw('call') + s.expression;
    case 'comment': return s.text;
    case 'breakpoint': return s.always ? t('shape_breakpoint') : `${t('shape_breakpoint')}: ${s.expression}`;
    case 'open': return `${t('shape_open')} ${s.expression} (${s.mode === 'write' ? t('modeWrite') : t('modeRead')})`;
    case 'close': return t('shape_close');
    case 'read': return `${t('shape_read')} ${s.variable}`;
    case 'write': return `${t('shape_write')} ${s.expression}`;
    default: return s.kind;
  }
}
