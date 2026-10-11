/**
 * Dimensionamento de condutores de circuitos terminais.
 *
 * Critérios que determinam a SEÇÃO MÍNIMA (todos devem ser atendidos):
 *   1. seção mínima por tipo de circuito;
 *   2. capacidade de condução corrigida (Iz ≥ Ib);
 *   3. queda de tensão (≤ limite do circuito);
 *   4. proteção contra sobrecarga (Ib ≤ In ≤ Iz; I2 ≤ 1,45 Iz).
 * Critérios verificados para a configuração ESCOLHIDA (seção + dispositivo):
 *   5. proteção contra curto-circuito (alcance do disparo instantâneo e I²t ≤ k²S²);
 *   6. capacidade de interrupção (Icn ≥ Icc presumida).
 *
 * Se algum dado necessário faltar, o resultado é INCONCLUSIVO — nunca presumido.
 */
import type { BreakerCurve, Circuit, Supply } from '../../model/schema';
import { AVAILABLE_SECTIONS_MM2 } from '../../catalog/conductors';
import { loadedConductors, supplySupportsConnection, systemVoltages, CONNECTION_LABEL } from '../core/systems';
import { formatNumberBR } from '../core/units';
import { aggregateLoads, designCurrent, type AggregatedLoad } from './power';
import { conductorAmpacity } from './ampacity';
import { voltageDrop } from './voltageDrop';
import {
  adiabaticWithstandTimeS,
  checkBreakingCapacity,
  checkOverloadCoordination,
  instantaneousTripRangeA,
  kFactor,
  minimumPhaseSection,
  selectRatedCurrent,
} from './protection';
import { estimateShortCircuit, type ShortCircuitEstimate } from './shortCircuit';
import { INCONCLUSIVE_INSTALL_MSG, describeNotOk, type CalcResult } from './result';

export interface ProtectionInfo {
  deviceId: string | null;
  label: string;
  ratedCurrentA: number | null;
  curve: BreakerCurve | null;
  breakingCapacityKA: number | null;
}

export type CriterionId =
  | 'secao-minima'
  | 'capacidade'
  | 'queda-tensao'
  | 'queda-total'
  | 'sobrecarga'
  | 'curto-circuito'
  | 'capacidade-interrupcao';

export type CriterionStatus = 'ok' | 'falha' | 'inconclusivo' | 'nao-avaliado';

export interface Criterion {
  id: CriterionId;
  label: string;
  status: CriterionStatus;
  detail: string;
}

export interface SectionEvaluation {
  sectionMm2: number;
  criteria: Criterion[];
  /** true = atende 1–4; false = reprovada; null = inconclusiva. */
  accepted: boolean | null;
  izA: number | null;
  dropPct: number | null;
  dropV: number | null;
}

export interface SizingResult {
  sizingStatus: 'ok' | 'reprovado' | 'inconclusivo';
  chosenStatus: 'ok' | 'falha' | 'inconclusivo' | 'nao-escolhida';
  summary: string;
  load: AggregatedLoad | null;
  designCurrentA: number | null;
  voltageV: number;
  formula: string | null;
  minSectionMm2: number | null;
  recommendedInA: number | null;
  evaluations: SectionEvaluation[];
  chosen: SectionEvaluation | null;
  missing: string[];
  assumptions: string[];
  shortCircuit: CalcResult<ShortCircuitEstimate> | null;
}

const SECTION_DRIVING: CriterionId[] = ['secao-minima', 'capacidade', 'queda-tensao', 'sobrecarga'];

export function sizeCircuit(params: {
  circuit: Circuit;
  supply: Supply;
  protection: ProtectionInfo | null;
}): SizingResult {
  const { circuit, supply, protection } = params;
  const voltages = systemVoltages(supply.systemVoltage);
  const voltageV = circuit.connection === 'F-N' ? voltages.u0 : voltages.u;
  const base: SizingResult = {
    sizingStatus: 'inconclusivo',
    chosenStatus: circuit.sectionMm2 === null ? 'nao-escolhida' : 'inconclusivo',
    summary: '',
    load: null,
    designCurrentA: null,
    voltageV,
    formula: null,
    minSectionMm2: null,
    recommendedInA: null,
    evaluations: [],
    chosen: null,
    missing: [],
    assumptions: [],
    shortCircuit: null,
  };

  if (!supplySupportsConnection(supply, circuit.connection)) {
    return {
      ...base,
      sizingStatus: 'reprovado',
      chosenStatus: circuit.sectionMm2 === null ? 'nao-escolhida' : 'falha',
      summary: `Ligação "${CONNECTION_LABEL[circuit.connection]}" indisponível em alimentação ${supply.type}.`,
    };
  }

  const agg = aggregateLoads(circuit.loads);
  if (agg.status !== 'ok') {
    return {
      ...base,
      summary: describeNotOk(agg),
      missing: agg.status === 'inconclusivo' ? agg.missing : [],
    };
  }
  const dc = designCurrent({
    activeW: agg.value.activeW,
    powerFactor: agg.value.powerFactor,
    connection: circuit.connection,
    voltages,
  });
  if (dc.status !== 'ok') return { ...base, load: agg.value, summary: describeNotOk(dc) };
  const ib = dc.value.currentA;
  const loaded = loadedConductors(circuit.connection);
  const minSec = minimumPhaseSection(circuit.kind, circuit.material);
  const missing = new Set<string>();
  const assumptions = new Set<string>([...dc.assumptions]);

  const evaluate = (sectionMm2: number, withProtection: boolean): SectionEvaluation => {
    const criteria: Criterion[] = [];
    // 1. Seção mínima
    if (minSec.status === 'ok') {
      criteria.push({
        id: 'secao-minima',
        label: 'Seção mínima',
        status: sectionMm2 >= minSec.value ? 'ok' : 'falha',
        detail: `${formatNumberBR(sectionMm2)} mm² ${sectionMm2 >= minSec.value ? '≥' : '<'} mínimo de ${formatNumberBR(minSec.value)} mm² para ${circuit.kind === 'iluminacao' ? 'iluminação' : 'circuitos de força/tomadas'}`,
      });
    } else {
      criteria.push({ id: 'secao-minima', label: 'Seção mínima', status: 'inconclusivo', detail: describeNotOk(minSec) });
    }

    // 2. Capacidade de condução
    const amp = conductorAmpacity({
      sectionMm2,
      material: circuit.material,
      insulation: circuit.insulation,
      method: circuit.method,
      loadedConductors: loaded,
      ambientTempC: circuit.ambientTempC,
      groupedCircuits: circuit.groupedCircuits,
    });
    let iz: number | null = null;
    if (amp.status === 'ok') {
      iz = amp.value.izA;
      amp.assumptions.forEach((a) => assumptions.add(a));
      criteria.push({
        id: 'capacidade',
        label: 'Capacidade de condução',
        status: iz >= ib - 1e-9 ? 'ok' : 'falha',
        detail: `Iz = I0·kθ·kg = ${formatNumberBR(amp.value.i0A)}·${formatNumberBR(amp.value.kTemp, 3)}·${formatNumberBR(amp.value.kGroup, 2)} = ${formatNumberBR(iz)} A ${iz >= ib ? '≥' : '<'} Ib = ${formatNumberBR(ib)} A`,
      });
    } else {
      if (amp.status === 'inconclusivo') amp.missing.forEach((m) => missing.add(m));
      criteria.push({ id: 'capacidade', label: 'Capacidade de condução', status: 'inconclusivo', detail: describeNotOk(amp) });
    }

    // 3. Queda de tensão
    const vd = voltageDrop({
      currentA: ib,
      lengthM: circuit.lengthM,
      sectionMm2,
      material: circuit.material,
      insulation: circuit.insulation,
      powerFactor: agg.value.powerFactor,
      connection: circuit.connection,
      voltages,
      limitPct: circuit.voltageDropLimitPct,
    });
    let dropPct: number | null = null;
    let dropV: number | null = null;
    if (vd.status === 'ok') {
      dropPct = vd.value.percent;
      dropV = vd.value.volts;
      vd.assumptions.forEach((a) => assumptions.add(a));
      const limitKind = circuit.voltageDropLimitSource === 'normativo' ? 'limite normativo' : 'meta do exercício';
      criteria.push({
        id: 'queda-tensao',
        label: 'Queda de tensão',
        status: vd.value.pass ? 'ok' : 'falha',
        detail: `ΔU = ${formatNumberBR(vd.value.volts)} V (${formatNumberBR(dropPct)} %) ${vd.value.pass ? '≤' : '>'} ${formatNumberBR(circuit.voltageDropLimitPct)} % (${limitKind})`,
      });
      if (supply.upstreamVoltageDropPct !== null) {
        const total = supply.upstreamVoltageDropPct + dropPct;
        criteria.push({
          id: 'queda-total',
          label: 'Queda total desde o ponto de entrega',
          status: total <= 5 + 1e-9 ? 'ok' : 'falha',
          detail: `${formatNumberBR(supply.upstreamVoltageDropPct)} % (a montante) + ${formatNumberBR(dropPct)} % = ${formatNumberBR(total)} % (limite 5 %, NBR 5410 6.2.7.1 c — fonte secundária)`,
        });
      } else {
        criteria.push({
          id: 'queda-total',
          label: 'Queda total desde o ponto de entrega',
          status: 'nao-avaliado',
          detail: 'Queda de tensão a montante do quadro não informada',
        });
      }
    } else {
      if (vd.status === 'inconclusivo') vd.missing.forEach((m) => missing.add(m));
      criteria.push({ id: 'queda-tensao', label: 'Queda de tensão', status: 'inconclusivo', detail: describeNotOk(vd) });
    }

    // 4. Sobrecarga
    if (iz === null) {
      criteria.push({
        id: 'sobrecarga',
        label: 'Proteção contra sobrecarga',
        status: 'inconclusivo',
        detail: 'Requer a capacidade de condução corrigida (Iz)',
      });
    } else if (protection?.ratedCurrentA != null) {
      const coord = checkOverloadCoordination({ ibA: ib, inA: protection.ratedCurrentA, izA: iz });
      criteria.push({
        id: 'sobrecarga',
        label: 'Proteção contra sobrecarga',
        status: coord.ok ? 'ok' : 'falha',
        detail: coord.conditions.map((c) => `${c.ok ? '✓' : '✗'} ${c.label} (${c.detail})`).join(' · '),
      });
    } else {
      const sel = selectRatedCurrent(ib, iz);
      criteria.push({
        id: 'sobrecarga',
        label: 'Proteção contra sobrecarga',
        status: sel !== null ? 'ok' : 'falha',
        detail:
          sel !== null
            ? `Existe In padronizado com Ib ≤ In ≤ Iz: ${sel} A (dispositivo ainda não definido)`
            : `Nenhum In padronizado satisfaz ${formatNumberBR(ib)} A ≤ In ≤ ${formatNumberBR(iz)} A`,
      });
    }

    if (withProtection) {
      // 5. Curto-circuito
      const sc = estimateShortCircuit({
        voltages,
        connection: circuit.connection,
        prospectiveOriginKA: supply.prospectiveShortCircuitKA,
        lengthM: circuit.lengthM,
        sectionMm2,
        material: circuit.material,
        insulation: circuit.insulation,
      });
      base.shortCircuit = sc;
      if (sc.status !== 'ok') {
        criteria.push({ id: 'curto-circuito', label: 'Proteção contra curto-circuito', status: 'inconclusivo', detail: describeNotOk(sc) });
      } else if (!protection || protection.ratedCurrentA == null || protection.curve == null) {
        criteria.push({
          id: 'curto-circuito',
          label: 'Proteção contra curto-circuito',
          status: 'inconclusivo',
          detail: 'Corrente nominal e/ou curva do dispositivo de proteção desconhecidas',
        });
      } else {
        const [, hi] = instantaneousTripRangeA(protection.curve, protection.ratedCurrentA);
        const k = kFactor(circuit.material, circuit.insulation);
        const tAdm = adiabaticWithstandTimeS(k, sectionMm2, sc.value.iccOriginA);
        if (sc.value.iccEndMinA < hi) {
          criteria.push({
            id: 'curto-circuito',
            label: 'Proteção contra curto-circuito',
            status: 'inconclusivo',
            detail: `Icc mínima no fim do circuito ≈ ${formatNumberBR(sc.value.iccEndMinA, 0)} A < ${formatNumberBR(hi, 0)} A (disparo instantâneo garantido da curva ${protection.curve}). A eliminação pode depender do disparador térmico — verificar com a curva do fabricante.`,
          });
        } else if (tAdm < 0.1) {
          criteria.push({
            id: 'curto-circuito',
            label: 'Proteção contra curto-circuito',
            status: 'inconclusivo',
            detail: `(k·S/Icc)² = ${formatNumberBR(tAdm * 1000, 1)} ms < 100 ms: requer a energia I²t de passagem do fabricante para confirmar I²t ≤ k²S²`,
          });
        } else {
          criteria.push({
            id: 'curto-circuito',
            label: 'Proteção contra curto-circuito',
            status: 'ok',
            detail: `Disparo instantâneo alcança todo o circuito (Icc mín ≈ ${formatNumberBR(sc.value.iccEndMinA, 0)} A ≥ ${formatNumberBR(hi, 0)} A) e (k·S/Icc)² = ${formatNumberBR(tAdm, 2)} s ≥ 0,1 s`,
          });
        }
      }
      // 6. Capacidade de interrupção
      const bc = checkBreakingCapacity(protection?.breakingCapacityKA ?? null, supply.prospectiveShortCircuitKA);
      criteria.push({
        id: 'capacidade-interrupcao',
        label: 'Capacidade de interrupção',
        status: bc.status === 'ok' ? (bc.value.ok ? 'ok' : 'falha') : 'inconclusivo',
        detail:
          bc.status === 'ok'
            ? `Icn = ${formatNumberBR(protection!.breakingCapacityKA!)} kA ${bc.value.ok ? '≥' : '<'} Icc presumida = ${formatNumberBR(supply.prospectiveShortCircuitKA!)} kA`
            : `${describeNotOk(bc)} (${bc.status === 'inconclusivo' ? bc.missing.join(', ') : ''})`,
      });
    }

    const driving = criteria.filter((c) => SECTION_DRIVING.includes(c.id));
    const accepted = driving.some((c) => c.status === 'falha')
      ? false
      : driving.some((c) => c.status === 'inconclusivo')
        ? null
        : true;
    return { sectionMm2, criteria, accepted, izA: iz, dropPct, dropV };
  };

  const evaluations = AVAILABLE_SECTIONS_MM2.map((s) => evaluate(s, false));
  let sizingStatus: SizingResult['sizingStatus'] = 'reprovado';
  let minSectionMm2: number | null = null;
  for (const ev of evaluations) {
    if (ev.accepted === null) {
      sizingStatus = 'inconclusivo';
      break;
    }
    if (ev.accepted) {
      sizingStatus = 'ok';
      minSectionMm2 = ev.sectionMm2;
      break;
    }
  }

  let recommendedInA: number | null = protection?.ratedCurrentA ?? null;
  if (recommendedInA === null && minSectionMm2 !== null) {
    const iz = evaluations.find((e) => e.sectionMm2 === minSectionMm2)?.izA;
    recommendedInA = iz != null ? selectRatedCurrent(ib, iz) : null;
  }

  const chosen = circuit.sectionMm2 !== null ? evaluate(circuit.sectionMm2, true) : null;
  let chosenStatus: SizingResult['chosenStatus'] = 'nao-escolhida';
  if (chosen) {
    chosenStatus = chosen.criteria.some((c) => c.status === 'falha')
      ? 'falha'
      : chosen.criteria.some((c) => c.status === 'inconclusivo')
        ? 'inconclusivo'
        : 'ok';
  }

  let summary: string;
  if (sizingStatus === 'inconclusivo') {
    const m = [...missing];
    summary = m.some((x) => ['método de instalação', 'temperatura ambiente', 'número de circuitos agrupados'].includes(x))
      ? `${INCONCLUSIVE_INSTALL_MSG} (${m.join(', ')})`
      : `Dimensionamento inconclusivo: ${m.length ? m.join(', ') : 'dados insuficientes'}`;
  } else if (sizingStatus === 'reprovado') {
    summary = `Nenhuma seção disponível (até ${AVAILABLE_SECTIONS_MM2[AVAILABLE_SECTIONS_MM2.length - 1]} mm²) atende a todos os critérios.`;
  } else {
    summary = `Seção mínima que atende aos critérios 1–4: ${formatNumberBR(minSectionMm2!)} mm²${recommendedInA ? `; In = ${recommendedInA} A` : ''}.`;
  }

  return {
    ...base,
    sizingStatus,
    chosenStatus,
    summary,
    load: agg.value,
    designCurrentA: ib,
    formula: dc.value.formula,
    minSectionMm2,
    recommendedInA,
    evaluations,
    chosen,
    missing: [...missing],
    assumptions: [...assumptions],
  };
}
