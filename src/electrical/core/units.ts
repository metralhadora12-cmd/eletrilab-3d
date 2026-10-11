/**
 * Unidades e grandezas.
 *
 * Todas as funções de cálculo trabalham em unidades SI de base (W, V, A, m, Ω)
 * exceto a seção de condutores, que segue a prática em mm².
 * Conversões entre dimensões diferentes (ex.: W → VA) são rejeitadas:
 * dependem do fator de potência e devem ser feitas explicitamente.
 */

export type Dimension =
  | 'potencia-ativa'
  | 'potencia-aparente'
  | 'potencia-reativa'
  | 'corrente'
  | 'tensao'
  | 'comprimento'
  | 'resistencia'
  | 'secao'
  | 'tempo';

interface UnitDef {
  dimension: Dimension;
  factor: number;
}

export const UNITS = {
  W: { dimension: 'potencia-ativa', factor: 1 },
  kW: { dimension: 'potencia-ativa', factor: 1e3 },
  MW: { dimension: 'potencia-ativa', factor: 1e6 },
  VA: { dimension: 'potencia-aparente', factor: 1 },
  kVA: { dimension: 'potencia-aparente', factor: 1e3 },
  var: { dimension: 'potencia-reativa', factor: 1 },
  kvar: { dimension: 'potencia-reativa', factor: 1e3 },
  mA: { dimension: 'corrente', factor: 1e-3 },
  A: { dimension: 'corrente', factor: 1 },
  kA: { dimension: 'corrente', factor: 1e3 },
  mV: { dimension: 'tensao', factor: 1e-3 },
  V: { dimension: 'tensao', factor: 1 },
  kV: { dimension: 'tensao', factor: 1e3 },
  mm: { dimension: 'comprimento', factor: 1e-3 },
  cm: { dimension: 'comprimento', factor: 1e-2 },
  m: { dimension: 'comprimento', factor: 1 },
  km: { dimension: 'comprimento', factor: 1e3 },
  'mΩ': { dimension: 'resistencia', factor: 1e-3 },
  'Ω': { dimension: 'resistencia', factor: 1 },
  'kΩ': { dimension: 'resistencia', factor: 1e3 },
  'MΩ': { dimension: 'resistencia', factor: 1e6 },
  'mm²': { dimension: 'secao', factor: 1 },
  ms: { dimension: 'tempo', factor: 1e-3 },
  s: { dimension: 'tempo', factor: 1 },
  min: { dimension: 'tempo', factor: 60 },
  h: { dimension: 'tempo', factor: 3600 },
} as const satisfies Record<string, UnitDef>;

export type Unit = keyof typeof UNITS;

export class UnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitError';
  }
}

export function convert(value: number, from: Unit, to: Unit): number {
  if (!Number.isFinite(value)) throw new UnitError(`Valor não finito: ${value}`);
  const a = UNITS[from];
  const b = UNITS[to];
  if (!a || !b) throw new UnitError(`Unidade desconhecida: ${!a ? from : to}`);
  if (a.dimension !== b.dimension) {
    throw new UnitError(`Conversão inválida: ${from} (${a.dimension}) → ${to} (${b.dimension})`);
  }
  return (value * a.factor) / b.factor;
}

/**
 * Interpreta número no formato brasileiro ou internacional:
 * "2,5" → 2.5 ; "1.234,5" → 1234.5 ; "2.5" → 2.5 ; "1e3" → 1000.
 * Retorna null para entradas inválidas (nunca NaN).
 */
export function parseDecimalBR(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '');
  if (s === '') return null;
  let normalized = s;
  if (s.includes(',') && s.includes('.')) {
    // ponto como separador de milhar, vírgula como decimal
    if (!/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) return null;
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    normalized = s.replace(',', '.');
  }
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(normalized)) return null;
  const v = Number(normalized);
  return Number.isFinite(v) ? v : null;
}

export function formatNumberBR(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export function formatQuantity(value: number | null | undefined, unit: string, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return `— ${unit}`;
  return `${formatNumberBR(value, decimals)} ${unit}`;
}

/** Formata uma corrente escolhendo mA, A ou kA. */
export function formatCurrent(amps: number): string {
  const a = Math.abs(amps);
  if (a < 1) return formatQuantity(amps * 1000, 'mA', 1);
  if (a >= 1000) return formatQuantity(amps / 1000, 'kA', 2);
  return formatQuantity(amps, 'A', 2);
}

export function formatResistance(ohm: number): string {
  if (!Number.isFinite(ohm)) return 'OL';
  const r = Math.abs(ohm);
  if (r >= 1e6) return formatQuantity(ohm / 1e6, 'MΩ', 2);
  if (r >= 1e3) return formatQuantity(ohm / 1e3, 'kΩ', 2);
  if (r < 1) return formatQuantity(ohm * 1000, 'mΩ', 1);
  return formatQuantity(ohm, 'Ω', 3);
}

export function isPositiveFinite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}
