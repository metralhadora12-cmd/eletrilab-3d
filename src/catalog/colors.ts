/**
 * Cores dos condutores.
 *
 * Três camadas distintas, que NÃO devem ser confundidas:
 *  1. normative  — restrição de identificação da ABNT NBR 5410 (6.1.5.3, fonte secundária):
 *                  azul-claro = neutro; verde-amarelo ou verde = PE; fase = qualquer outra cor.
 *  2. hex        — cor usada apenas na representação gráfica 3D/2D.
 *  3. didactic   — convenção didática do EletriLab (ex.: retorno em amarelo/branco/cinza).
 *                  Não é exigência normativa.
 */
import type { ConductorFunction, WireColor } from '../model/schema';

export interface WireColorInfo {
  name: string;
  hex: string;
  stripeHex?: string;
  /** Funções permitidas pela regra de identificação por cor (NBR 5410). */
  normativeFunctions: ConductorFunction[];
  /** Sugestão da convenção didática do EletriLab. */
  didactic: string;
}

const LIVE: ConductorFunction[] = ['L', 'R'];

export const WIRE_COLORS: Record<WireColor, WireColorInfo> = {
  preto: { name: 'Preto', hex: '#1c1c1e', normativeFunctions: LIVE, didactic: 'Fase (convenção didática)' },
  vermelho: { name: 'Vermelho', hex: '#c0182c', normativeFunctions: LIVE, didactic: 'Fase (convenção didática)' },
  marrom: { name: 'Marrom', hex: '#6b3d24', normativeFunctions: LIVE, didactic: 'Fase (convenção didática)' },
  branco: { name: 'Branco', hex: '#ecebe6', normativeFunctions: LIVE, didactic: 'Retorno (convenção didática)' },
  cinza: { name: 'Cinza', hex: '#8a8e93', normativeFunctions: LIVE, didactic: 'Retorno (convenção didática)' },
  amarelo: { name: 'Amarelo', hex: '#e8b90f', normativeFunctions: LIVE, didactic: 'Retorno (convenção didática)' },
  laranja: { name: 'Laranja', hex: '#e2711d', normativeFunctions: LIVE, didactic: 'Fase (uso livre)' },
  violeta: { name: 'Violeta', hex: '#6f3fa0', normativeFunctions: LIVE, didactic: 'Fase (uso livre)' },
  'azul-claro': { name: 'Azul-claro', hex: '#4b9fe0', normativeFunctions: ['N'], didactic: 'Neutro (exigência normativa)' },
  verde: { name: 'Verde', hex: '#1d8a3a', normativeFunctions: ['PE'], didactic: 'Proteção PE (exigência normativa)' },
  'verde-amarelo': {
    name: 'Verde-amarelo',
    hex: '#1d8a3a',
    stripeHex: '#e8c414',
    normativeFunctions: ['PE'],
    didactic: 'Proteção PE (exigência normativa)',
  },
};

export const COLOR_ORDER: WireColor[] = [
  'preto',
  'vermelho',
  'marrom',
  'laranja',
  'violeta',
  'branco',
  'cinza',
  'amarelo',
  'azul-claro',
  'verde-amarelo',
  'verde',
];

export function colorAllowsFunction(color: WireColor, fn: ConductorFunction) {
  return WIRE_COLORS[color].normativeFunctions.includes(fn);
}

export const FUNCTION_LABEL: Record<ConductorFunction, string> = {
  L: 'Fase',
  N: 'Neutro',
  PE: 'Proteção (PE)',
  R: 'Retorno',
};

/** Cor padrão sugerida para cada função (convenção didática). */
export const DEFAULT_COLOR_FOR: Record<ConductorFunction, WireColor> = {
  L: 'preto',
  N: 'azul-claro',
  PE: 'verde-amarelo',
  R: 'amarelo',
};
