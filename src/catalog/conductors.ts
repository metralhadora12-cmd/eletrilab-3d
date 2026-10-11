/**
 * Biblioteca de condutores (seções disponíveis para fins didáticos).
 *
 * A lista de seções é um conjunto inicial, NÃO uma prescrição para circuitos.
 * Resistências máximas em CC a 20 °C: valores amplamente publicados da
 * IEC 60228 (equivalente ABNT NBR NM 280) — status 'fonte-secundaria'.
 */
import type { ConductorSpec } from './schema';
import type { ConductorMaterial, Insulation } from '../model/schema';

export const AVAILABLE_SECTIONS_MM2 = [1.5, 2.5, 4, 6, 10, 16, 25, 35] as const;

const REVIEWED = '2026-10-11';

const R20_CU_CLASS5: Record<number, number> = {
  1.5: 13.3,
  2.5: 7.98,
  4: 4.95,
  6: 3.3,
  10: 1.91,
  16: 1.21,
  25: 0.78,
  35: 0.554,
};

const R20_AL_CLASS2: Record<number, number> = {
  16: 1.91,
  25: 1.2,
  35: 0.868,
};

const OUTER_D_MM: Record<number, number> = {
  1.5: 3.0,
  2.5: 3.6,
  4: 4.2,
  6: 4.8,
  10: 6.2,
  16: 7.3,
  25: 9.2,
  35: 10.5,
};

const INSULATION_TEMPS: Record<Insulation, { op: number; sc: number }> = {
  PVC: { op: 70, sc: 160 },
  EPR: { op: 90, sc: 250 },
  XLPE: { op: 90, sc: 250 },
};

const resistanceSource = {
  kind: 'norma' as const,
  reference:
    'IEC 60228 / ABNT NBR NM 280 — resistência máxima em CC a 20 °C (classe 5 cobre; classe 2 alumínio); temperaturas da isolação conforme NBR 5410',
  reviewedAt: REVIEWED,
  status: 'fonte-secundaria' as const,
  notes: 'Valores consistentes em catálogos técnicos; conferir na edição vigente da norma.',
};

function spec(section: number, material: ConductorMaterial, insulation: Insulation): ConductorSpec {
  const r20 = material === 'cobre' ? R20_CU_CLASS5[section] : R20_AL_CLASS2[section];
  return {
    id: `${material}-${insulation}-${section}`,
    sectionMm2: section,
    material,
    insulation,
    strandingClass: material === 'cobre' ? 'classe-5' : 'classe-2',
    maxOperatingTempC: INSULATION_TEMPS[insulation].op,
    maxShortCircuitTempC: INSULATION_TEMPS[insulation].sc,
    r20OhmPerKm: r20 ?? null,
    approxOuterDiameterMm: OUTER_D_MM[section] ?? Math.sqrt(section) * 2 + 1.6,
    source: resistanceSource,
  };
}

export const CONDUCTOR_CATALOG: ConductorSpec[] = [
  ...AVAILABLE_SECTIONS_MM2.flatMap((s) => (['PVC', 'EPR', 'XLPE'] as Insulation[]).map((ins) => spec(s, 'cobre', ins))),
  ...[16, 25, 35].flatMap((s) => (['PVC', 'XLPE'] as Insulation[]).map((ins) => spec(s, 'aluminio', ins))),
];

export function findConductor(sectionMm2: number, material: ConductorMaterial, insulation: Insulation) {
  return CONDUCTOR_CATALOG.find(
    (c) => c.sectionMm2 === sectionMm2 && c.material === material && c.insulation === insulation,
  );
}

export function insulationMaxTemp(insulation: Insulation) {
  return INSULATION_TEMPS[insulation].op;
}

export function insulationShortCircuitTemp(insulation: Insulation) {
  return INSULATION_TEMPS[insulation].sc;
}
