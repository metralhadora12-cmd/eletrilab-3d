/**
 * Instrumentos virtuais. Todas as leituras derivam do solver nodal —
 * nenhum valor é aleatório. Resultados ilustrativos são identificados.
 */
import { effectiveElectrical, getCatalogItem } from '../../catalog';
import type { RcdElectrical } from '../../catalog/schema';
import type { Project } from '../../model/schema';
import { circuitOwnerId, terminalKey } from '../../model/schema';
import { ownerTerminals } from '../../model/terminals';
import { TOUCH_VOLTAGE_LIMIT_V } from '../core/constants';
import { cabs, cadd, csub, ZERO, type Complex } from '../core/complex';
import { rcdMaxBreakTimeS } from '../calculations/protection';
import { SOURCE_KEYS } from './graph';
import { TERRA, loadNode, measurePassiveResistance } from './solver';
import type { SimulationSnapshot } from './engine';
import type { TopologyAnalysis } from './topology';

export interface ProbePoint {
  key: string;
  label: string;
}

export const OL_THRESHOLD_OHM = 2e7;

export function measureVoltage(snap: SimulationSnapshot, a: string, b: string) {
  const v = cabs(csub(snap.solve.voltage(a), snap.solve.voltage(b)));
  return { volts: v < 0.05 ? 0 : v };
}

export function measureResistance(project: Project, a: string, b: string) {
  if (project.simulation.energized) {
    return {
      blocked: true as const,
      message: 'Instalação energizada: desligue a alimentação antes de medir resistência ou continuidade.',
    };
  }
  const r = measurePassiveResistance(project, a, b);
  return {
    blocked: false as const,
    ohm: r > OL_THRESHOLD_OHM ? Infinity : r,
    continuity: r < 2,
    note: 'Medição com a instalação isolada da rede (seccionamento geral aberto, inclusive o neutro). Cargas representadas pela parte resistiva da impedância nominal.',
  };
}

/** Corrente em um condutor do quadro (multímetro em série ou alicate). */
export function measureWireCurrent(snap: SimulationSnapshot, wireId: string) {
  return { amps: snap.wireCurrentsA.get(wireId) ?? 0 };
}

/**
 * Alicate no cabo do circuito:
 *  - 'fase': envolve só a fase → corrente de carga;
 *  - 'vivos': envolve fases + neutro (SEM o PE) → soma vetorial = corrente de fuga.
 * Envolver também o PE anularia a leitura, pois a fuga retorna pelo próprio PE.
 */
export function clampCircuit(project: Project, snap: SimulationSnapshot, circuitId: string, mode: 'fase' | 'vivos') {
  const ids = ownerTerminals(project, circuitOwnerId(circuitId))
    .map((t) => t.id)
    .filter((id) => id !== 'PE');
  if (mode === 'fase') {
    return { amps: cabs(snap.solve.edgeCurrent(`cable:${circuitId}:L1`)) };
  }
  let sum: Complex = ZERO;
  for (const id of ids) sum = cadd(sum, snap.solve.edgeCurrent(`cable:${circuitId}:${id}`));
  return { amps: cabs(sum) };
}

/** Indicador de tensão: presença de tensão perigosa entre o ponto e a terra. */
export function voltageIndicator(snap: SimulationSnapshot, key: string) {
  const v = cabs(csub(snap.solve.voltage(key), snap.solve.voltage(TERRA)));
  return { volts: v, present: v > TOUCH_VOLTAGE_LIMIT_V };
}

/** Continuidade do PE entre a massa do equipamento e o borne PE da entrada. */
export function peContinuity(project: Project, circuitId: string) {
  return measureResistance(project, loadNode(circuitId, 'PE'), SOURCE_KEYS.PE);
}

export function powerMeter(snap: SimulationSnapshot, circuitId: string) {
  const r = snap.circuits.get(circuitId);
  if (!r) return null;
  return {
    voltageV: r.voltageV,
    currentA: r.currentA,
    activeW: r.powerW,
    reactiveVar: r.reactiveVar,
    apparentVA: r.apparentVA,
    powerFactor: r.powerFactor,
  };
}

export interface RcdTestResult {
  ok: boolean;
  rcdLabel: string | null;
  testCurrentMA: number | null;
  tripped: boolean;
  maxTimeMs: number | null;
  message: string;
  disclaimer: string;
}

/**
 * Ensaio didático de DR: injeta corrente entre fase e PE no ponto de utilização.
 * Requer instalação energizada, circuito alimentado e PE contínuo.
 */
export function rcdTest(
  project: Project,
  snap: SimulationSnapshot,
  topo: TopologyAnalysis,
  circuitId: string,
  multipleOfIdn: number,
): RcdTestResult {
  const disclaimer = 'Resultado didático do modelo — não substitui o ensaio com instrumento real e calibrado.';
  const base = { rcdLabel: null, testCurrentMA: null, tripped: false, maxTimeMs: null, disclaimer };
  const reading = snap.circuits.get(circuitId);
  if (!project.simulation.energized || !reading?.energized) {
    return { ...base, ok: false, message: 'Circuito desenergizado: o testador não consegue injetar a corrente de ensaio.' };
  }
  const ct = topo.circuits.get(circuitId);
  const peTrace = ct?.conductors.find((t) => t.expected === 'PE');
  const peOpen = project.simulation.faults.some((f) => f.kind === 'pe-open' && f.circuitId === circuitId);
  if (!peTrace?.reachedSource || peOpen) {
    return { ...base, ok: false, message: 'Sem continuidade do PE: a corrente de ensaio fase-PE não circula. Corrija o PE antes de testar.' };
  }
  const rcdId = ct?.rcdIds.find((id) => project.devices.find((d) => d.id === id)?.state === 'on');
  if (!rcdId) {
    return { ...base, ok: false, message: 'Nenhum DR ligado a montante deste circuito: o ensaio não provoca atuação.' };
  }
  const dev = project.devices.find((d) => d.id === rcdId)!;
  const params = effectiveElectrical(dev, getCatalogItem(dev.catalogId)!) as RcdElectrical;
  if (params.residualCurrentMA === null) {
    return { ...base, ok: false, rcdLabel: dev.label, message: 'IΔn do DR desconhecida: ensaio inconclusivo.' };
  }
  const testMA = params.residualCurrentMA * multipleOfIdn;
  const tripped = multipleOfIdn >= 1;
  const tmax = rcdMaxBreakTimeS(multipleOfIdn);
  return {
    ok: true,
    rcdLabel: dev.label,
    testCurrentMA: testMA,
    tripped,
    maxTimeMs: tmax === null ? null : tmax * 1000,
    message: tripped
      ? `${dev.label} atuou com ${testMA} mA (${multipleOfIdn}×IΔn). Tempo máximo admitido pela norma de produto: ${tmax! * 1000} ms. O simulador não mede o tempo real de atuação.`
      : `${dev.label} não atuou com ${testMA} mA (${multipleOfIdn}×IΔn) — esperado: a norma de produto exige NÃO atuação a 0,5×IΔn.`,
    disclaimer,
  };
}

export function terminalProbe(owner: string, terminal: string): string {
  return terminalKey({ owner, terminal });
}
