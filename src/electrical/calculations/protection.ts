/** Proteção contra sobrecorrentes e critérios associados. */
import type { BreakerCurve, CircuitKind, ConductorMaterial, Insulation } from '../../model/schema';
import { MINIMUM_SECTION_COPPER } from '../../normative/data/referenceData';
import {
  BREAKER_CONVENTIONAL,
  CURVE_INSTANTANEOUS_RANGE,
  K_FACTOR,
  RCD_MAX_BREAK_TIME_S,
  STANDARD_RATED_CURRENTS_A,
} from '../core/constants';
import { type CalcResult, inconclusive, invalid, ok } from './result';

/** Seção mínima do condutor de fase (cobre). Alumínio: não suportado em circuitos residenciais. */
export function minimumPhaseSection(kind: CircuitKind, material: ConductorMaterial): CalcResult<number> {
  if (material === 'aluminio') {
    return inconclusive(
      'Condutores de alumínio têm uso restrito pela NBR 5410 em instalações residenciais; o simulador não dimensiona circuitos terminais em alumínio',
      ['material suportado'],
    );
  }
  return ok(kind === 'iluminacao' ? MINIMUM_SECTION_COPPER.iluminacao : MINIMUM_SECTION_COPPER.forca);
}

/**
 * Seção mínima do condutor de proteção quando do mesmo material da fase:
 * S ≤ 16 → S; 16 < S ≤ 35 → 16; S > 35 → S/2 (fonte secundária).
 */
export function protectiveConductorMinSection(phaseSectionMm2: number): number {
  if (phaseSectionMm2 <= 16) return phaseSectionMm2;
  if (phaseSectionMm2 <= 35) return 16;
  return phaseSectionMm2 / 2;
}

export interface CoordinationCondition {
  id: 'ib-in' | 'in-iz' | 'i2';
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * Coordenação condutor × dispositivo contra sobrecargas:
 *   (a) Ib ≤ In ≤ Iz      (b) I2 ≤ 1,45 · Iz
 * Para minidisjuntores I2 = 1,45 · In (corrente convencional de atuação).
 */
export function checkOverloadCoordination(params: {
  ibA: number;
  inA: number;
  izA: number;
  i2Multiple?: number;
}): { ok: boolean; conditions: CoordinationCondition[] } {
  const { ibA, inA, izA } = params;
  const i2 = (params.i2Multiple ?? BREAKER_CONVENTIONAL.tripping) * inA;
  const conditions: CoordinationCondition[] = [
    {
      id: 'ib-in',
      label: 'Ib ≤ In',
      ok: ibA <= inA + 1e-9,
      detail: `Ib = ${ibA.toFixed(2)} A; In = ${inA} A`,
    },
    {
      id: 'in-iz',
      label: 'In ≤ Iz',
      ok: inA <= izA + 1e-9,
      detail: `In = ${inA} A; Iz = ${izA.toFixed(2)} A`,
    },
    {
      id: 'i2',
      label: 'I2 ≤ 1,45 · Iz',
      ok: i2 <= 1.45 * izA + 1e-9,
      detail: `I2 = ${i2.toFixed(2)} A; 1,45·Iz = ${(1.45 * izA).toFixed(2)} A`,
    },
  ];
  return { ok: conditions.every((c) => c.ok), conditions };
}

/** Menor corrente nominal padronizada com Ib ≤ In (e In ≤ Iz, se informado). */
export function selectRatedCurrent(ibA: number, izA?: number, list = STANDARD_RATED_CURRENTS_A): number | null {
  const candidate = list.find((i) => i >= ibA - 1e-9);
  if (candidate === undefined) return null;
  if (izA !== undefined && candidate > izA + 1e-9) return null;
  return candidate;
}

export function instantaneousTripRangeA(curve: BreakerCurve, inA: number): [number, number] {
  const [lo, hi] = CURVE_INSTANTANEOUS_RANGE[curve];
  return [lo * inA, hi * inA];
}

export function kFactor(material: ConductorMaterial, insulation: Insulation): number {
  return K_FACTOR[material][insulation];
}

/** Tempo máximo admissível de curto-circuito (s): t = (k·S / I)², válido para t ≤ 5 s. */
export function adiabaticWithstandTimeS(k: number, sectionMm2: number, currentA: number): number {
  if (!(currentA > 0)) throw new RangeError('corrente deve ser positiva');
  return ((k * sectionMm2) / currentA) ** 2;
}

export function checkBreakingCapacity(icnKA: number | null, iccKA: number | null): CalcResult<{ ok: boolean; marginKA: number }> {
  const missing: string[] = [];
  if (icnKA === null) missing.push('capacidade de interrupção do dispositivo (Icn)');
  if (iccKA === null) missing.push('corrente de curto-circuito presumida no quadro');
  if (missing.length) return inconclusive('Capacidade de interrupção não verificável: dados ausentes', missing);
  if (!(icnKA! > 0 && iccKA! > 0)) return invalid('valores de corrente devem ser positivos');
  return ok({ ok: icnKA! >= iccKA!, marginKA: icnKA! - iccKA! });
}

/** Tempo máximo de interrupção do DR para um múltiplo de IΔn (null abaixo de IΔn). */
export function rcdMaxBreakTimeS(multipleOfIdn: number): number | null {
  if (multipleOfIdn < 1) return null;
  let t = RCD_MAX_BREAK_TIME_S[0].maxTimeS;
  for (const p of RCD_MAX_BREAK_TIME_S) if (multipleOfIdn >= p.multiple) t = p.maxTimeS;
  return t;
}
