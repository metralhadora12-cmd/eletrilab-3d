/**
 * Capacidade de condução de corrente corrigida:
 *   Iz = I0(método, seção, isolação, condutores carregados) · kθ · kg
 * Não existe "tabela universal de ampères por seção": I0 depende do método
 * de instalação e é corrigida pela temperatura ambiente e pelo agrupamento.
 */
import type { ConductorMaterial, InstallationMethod, Insulation } from '../../model/schema';
import { insulationMaxTemp } from '../../catalog/conductors';
import { GROUPING_FACTORS_BUNCHED, getAmpacityDataset, lookupReferenceAmpacity } from '../../normative/data/referenceData';
import { type CalcResult, INCONCLUSIVE_INSTALL_MSG, inconclusive, invalid, ok } from './result';

/** k = √((θp − θa)/(θp − θref)) com θref = 30 °C (ar). */
export function temperatureCorrectionFactor(ambientC: number, insulation: Insulation): CalcResult<number> {
  const theta = insulationMaxTemp(insulation);
  const ref = getAmpacityDataset().referenceAmbientC;
  if (!Number.isFinite(ambientC)) return invalid('temperatura ambiente inválida');
  if (ambientC >= theta) {
    return invalid(`temperatura ambiente (${ambientC} °C) ≥ temperatura máxima da isolação (${theta} °C)`);
  }
  return ok(Math.sqrt((theta - ambientC) / (theta - ref)), [
    `kθ = √((${theta} − ${ambientC}) / (${theta} − ${ref}))`,
  ]);
}

export function groupingCorrectionFactor(circuits: number): CalcResult<number> {
  if (!Number.isInteger(circuits) || circuits < 1) return invalid('número de circuitos agrupados deve ser inteiro ≥ 1');
  if (circuits > 20) return inconclusive('Agrupamento acima de 20 circuitos fora do conjunto de dados', ['agrupamento']);
  const entry = GROUPING_FACTORS_BUNCHED.find((g) => circuits <= g.maxCircuits)!;
  return ok(entry.factor, ['Agrupamento em feixe / conduto fechado, condutores de mesma seção igualmente carregados']);
}

export interface AmpacityInput {
  sectionMm2: number;
  material: ConductorMaterial;
  insulation: Insulation;
  method: InstallationMethod | null;
  loadedConductors: 2 | 3;
  ambientTempC: number | null;
  groupedCircuits: number | null;
}

export interface AmpacityResult {
  izA: number;
  i0A: number;
  kTemp: number;
  kGroup: number;
}

export function conductorAmpacity(input: AmpacityInput): CalcResult<AmpacityResult> {
  const missing: string[] = [];
  if (input.method === null) missing.push('método de instalação');
  if (input.ambientTempC === null) missing.push('temperatura ambiente');
  if (input.groupedCircuits === null) missing.push('número de circuitos agrupados');
  if (missing.length) return inconclusive(INCONCLUSIVE_INSTALL_MSG, missing);

  const i0 = lookupReferenceAmpacity(
    input.material,
    input.insulation,
    input.loadedConductors,
    input.method!,
    input.sectionMm2,
  );
  if (i0 === null) {
    return inconclusive(
      `Sem dado de referência para ${input.material}/${input.insulation}/${input.method}/${input.sectionMm2} mm² no conjunto ativo`,
      ['dado de capacidade de condução'],
    );
  }
  const kt = temperatureCorrectionFactor(input.ambientTempC!, input.insulation);
  if (kt.status !== 'ok') return kt;
  const kg = groupingCorrectionFactor(input.groupedCircuits!);
  if (kg.status !== 'ok') return kg;
  return ok(
    { izA: i0 * kt.value * kg.value, i0A: i0, kTemp: kt.value, kGroup: kg.value },
    [...kt.assumptions, ...kg.assumptions, `I0 = ${i0} A (${getAmpacityDataset().info.id})`],
  );
}
