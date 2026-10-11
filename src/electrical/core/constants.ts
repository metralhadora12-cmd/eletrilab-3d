/**
 * Constantes físicas e parâmetros técnicos usados pelo motor de cálculo.
 * A origem de cada valor está documentada aqui e em TECHNICAL_SOURCES.md.
 */
import type { BreakerCurve, ConductorMaterial, Insulation } from '../../model/schema';

/** Resistividade a 20 °C (Ω·mm²/m). Cobre recozido padrão IACS (IEC 60028); alumínio IEC 60889. */
export const RESISTIVITY_20C: Record<ConductorMaterial, number> = {
  cobre: 0.017241,
  aluminio: 0.028264,
};

/** Coeficiente de temperatura da resistência a 20 °C (1/K). */
export const ALPHA_20C: Record<ConductorMaterial, number> = {
  cobre: 0.00393,
  aluminio: 0.00403,
};

/** Reatância indutiva típica por unidade de comprimento (Ω/m) — IEC 60364-5-52, Anexo G (informativo). */
export const DEFAULT_REACTANCE_OHM_PER_M = 0.08e-3;

/**
 * Fator k para a verificação adiabática I²t ≤ k²S² (A·s^0,5/mm²).
 * IEC 60364-4-43, Tabela 43A (correspondente na NBR 5410 — fonte secundária).
 */
export const K_FACTOR: Record<ConductorMaterial, Record<Insulation, number>> = {
  cobre: { PVC: 115, EPR: 143, XLPE: 143 },
  aluminio: { PVC: 76, EPR: 94, XLPE: 94 },
};

/** Valores preferenciais de corrente nominal de minidisjuntores (A). */
export const STANDARD_RATED_CURRENTS_A = [2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

/**
 * Faixas de disparo instantâneo (múltiplos de In) — IEC 60898-1 / ABNT NBR NM 60898.
 * [limite inferior (não deve disparar em ≤ 0,1 s), limite superior (deve disparar em < 0,1 s)].
 */
export const CURVE_INSTANTANEOUS_RANGE: Record<BreakerCurve, [number, number]> = {
  B: [3, 5],
  C: [5, 10],
  D: [10, 20],
};

/** Correntes convencionais de minidisjuntores (múltiplos de In) — IEC 60898-1. */
export const BREAKER_CONVENTIONAL = {
  nonTripping: 1.13,
  tripping: 1.45,
  /** Tempo convencional (s) para In ≤ 63 A. */
  conventionalTimeS: 3600,
};

/** Tempos máximos de interrupção de DR de uso geral (s) — IEC 61008-1 / ABNT NBR NM 61008. */
export const RCD_MAX_BREAK_TIME_S = [
  { multiple: 1, maxTimeS: 0.3 },
  { multiple: 2, maxTimeS: 0.15 },
  { multiple: 5, maxTimeS: 0.04 },
];
/** Corrente de não atuação: 0,5 IΔn. */
export const RCD_NON_OPERATING_MULTIPLE = 0.5;

/** Tensão de contato limite convencional em condições normais (V) — UL da NBR 5410. */
export const TOUCH_VOLTAGE_LIMIT_V = 50;

/**
 * Parâmetros do modelo térmico DIDÁTICO de disjuntor (não é curva de fabricante).
 * Calibrado para respeitar os pontos convencionais da IEC 60898-1:
 *   1,13 In não dispara; 1,45 In dispara em < 1 h; 2,55 In dispara entre 1 s e 60 s.
 */
export const THERMAL_MODEL = {
  tauS: 50,
  thresholdMultiple: 1.3,
};

/** Resistência de contato de cada polo de dispositivo no solver (Ω) — valor ilustrativo. */
export const POLE_RESISTANCE_OHM = 0.005;

/** Valores ilustrativos usados SOMENTE pela simulação quando o usuário não informa dados. */
export const ILLUSTRATIVE_DEFAULTS = {
  prospectiveShortCircuitKA: 5,
  earthElectrodeResistanceOhm: 30,
  sourceEarthResistanceOhm: 10,
  circuitLengthM: 10,
  circuitSectionMm2: 2.5,
};
