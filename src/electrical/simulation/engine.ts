/**
 * Motor de simulação: leituras derivadas do solver nodal e atuação didática
 * dos dispositivos de proteção.
 *
 * Simplificações (explicitadas na interface):
 *  - Disparo magnético: ocorre quando I ≥ limite SUPERIOR da faixa instantânea
 *    da curva (disparo garantido). Entre os limites a atuação real é incerta.
 *  - Disparo térmico: modelo de primeira ordem calibrado nos pontos
 *    convencionais da norma de produto — não é curva de fabricante.
 *  - DR: atua quando |ΣI| ≥ IΔn (a norma admite atuação entre 0,5 e 1 IΔn).
 *  - Seletividade não é modelada: atua o dispositivo mais a jusante entre os
 *    solicitados; isso é informado no registro de eventos.
 */
import { effectiveElectrical, getCatalogItem } from '../../catalog';
import type { BreakerElectrical, RcdElectrical } from '../../catalog/schema';
import type { DeviceInstance, Project } from '../../model/schema';
import { circuitOwnerId, terminalKey } from '../../model/schema';
import { ownerTerminals } from '../../model/terminals';
import { CURVE_INSTANTANEOUS_RANGE, THERMAL_MODEL } from '../core/constants';
import { type Complex, ZERO, cabs, cadd, cconj, cmul, csub } from '../core/complex';
import { connectionHasNeutral, systemVoltages } from '../core/systems';
import { formatCurrent } from '../core/units';
import { TERRA, loadNode, solveNetwork, type SolveResult } from './solver';
import type { TopologyAnalysis } from './topology';

export interface DeviceReading {
  deviceId: string;
  poleCurrentsA: number[];
  maxCurrentA: number;
  differentialA: number | null;
}

export type CircuitStatus = 'normal' | 'desenergizado' | 'sobrecarga' | 'falta' | 'tensao-anormal';

export interface CircuitReading {
  circuitId: string;
  energized: boolean;
  voltageV: number;
  nominalV: number;
  currentA: number;
  powerW: number;
  reactiveVar: number;
  apparentVA: number;
  powerFactor: number | null;
  touchVoltageV: number;
  bodyCurrentA: number | null;
  faultCurrentA: number | null;
  neutralToPeV: number;
  status: CircuitStatus;
}

export interface SimulationSnapshot {
  solve: SolveResult;
  devices: Map<string, DeviceReading>;
  circuits: Map<string, CircuitReading>;
  wireCurrentsA: Map<string, number>;
  notes: string[];
}

export interface TripEvent {
  deviceId: string;
  label: string;
  reason: 'magnetico' | 'termico' | 'diferencial' | 'teste';
  currentA: number;
  message: string;
  severity: 'info' | 'alerta' | 'erro';
}

function breakerParams(d: DeviceInstance) {
  const item = getCatalogItem(d.catalogId);
  if (!item || item.category !== 'disjuntor') return null;
  return effectiveElectrical(d, item) as BreakerElectrical;
}

function rcdParams(d: DeviceInstance) {
  const item = getCatalogItem(d.catalogId);
  if (!item || item.category !== 'dr') return null;
  return effectiveElectrical(d, item) as RcdElectrical;
}

export function readSimulation(project: Project, topo?: TopologyAnalysis): SimulationSnapshot {
  const solve = solveNetwork(project);
  const devices = new Map<string, DeviceReading>();
  for (const d of project.devices) {
    const item = getCatalogItem(d.catalogId);
    if (!item) continue;
    const poles = item.internal.filter((l) => l.kind === 'pole');
    if (!poles.length) continue;
    const currents: Complex[] = poles.map((p) => (p.kind === 'pole' ? solve.edgeCurrent(`pole:${d.id}:${p.pole}`) : ZERO));
    const sum = currents.reduce((acc, c) => cadd(acc, c), ZERO);
    devices.set(d.id, {
      deviceId: d.id,
      poleCurrentsA: currents.map(cabs),
      maxCurrentA: Math.max(0, ...currents.map(cabs)),
      differentialA: item.category === 'dr' ? cabs(sum) : null,
    });
  }
  const wireCurrentsA = new Map<string, number>();
  for (const w of project.wires) wireCurrentsA.set(w.id, cabs(solve.edgeCurrent(`wire:${w.id}`)));

  const v = systemVoltages(project.supply.systemVoltage);
  const circuits = new Map<string, CircuitReading>();
  for (const c of project.circuits) {
    const nominalV = c.connection === 'F-N' ? v.u0 : v.u;
    const vl1 = solve.voltage(loadNode(c.id, 'L1'));
    const other = c.connection === 'F-N' ? loadNode(c.id, 'N') : loadNode(c.id, 'L2');
    const voltageV = cabs(csub(vl1, solve.voltage(other)));
    const phaseIds = ownerTerminals(project, circuitOwnerId(c.id))
      .map((t) => t.id)
      .filter((id) => id.startsWith('L'));
    const currentA = Math.max(0, ...phaseIds.map((id) => cabs(solve.edgeCurrent(`cable:${c.id}:${id}`))));
    let s: Complex = ZERO;
    for (const e of solve.edges) {
      if (e.ref.kind !== 'load' || e.ref.circuitId !== c.id) continue;
      const i = solve.edgeCurrent(e.id);
      const u = csub(solve.voltage(e.a), solve.voltage(e.b));
      s = cadd(s, cmul(u, cconj(i)));
    }
    const massV = solve.voltage(loadNode(c.id, 'PE'));
    const touchVoltageV = cabs(csub(massV, solve.voltage(TERRA)));
    const body = solve.edges.find((e) => e.ref.kind === 'body' && e.ref.circuitId === c.id);
    const fault = solve.edges.find((e) => e.ref.kind === 'fault' && e.ref.circuitId === c.id);
    const faultCurrentA = fault ? cabs(solve.edgeCurrent(fault.id)) : null;
    const nV = connectionHasNeutral(c.connection) ? solve.voltage(loadNode(c.id, 'N')) : ZERO;
    const energized = voltageV > 0.5 * nominalV;
    const protectiveId = topo?.circuits.get(c.id)?.protectiveBreakerId ?? null;
    const protective = project.devices.find((d) => d.id === protectiveId);
    const inA = protective ? breakerParams(protective)?.ratedCurrentA ?? null : null;
    let status: CircuitStatus = 'normal';
    if (!energized && currentA < 0.01) status = 'desenergizado';
    else if (faultCurrentA !== null && faultCurrentA > 0.005) status = 'falta';
    else if (inA !== null && currentA > inA * 1.0001) status = 'sobrecarga';
    else if (energized && (voltageV > 1.1 * nominalV || voltageV < 0.9 * nominalV)) status = 'tensao-anormal';
    circuits.set(c.id, {
      circuitId: c.id,
      energized,
      voltageV,
      nominalV,
      currentA,
      powerW: s.re,
      reactiveVar: s.im,
      apparentVA: cabs(s),
      powerFactor: cabs(s) > 1e-6 ? s.re / cabs(s) : null,
      touchVoltageV,
      bodyCurrentA: body ? cabs(solve.edgeCurrent(body.id)) : null,
      faultCurrentA,
      neutralToPeV: cabs(csub(nV, massV)),
      status,
    });
  }
  return { solve, devices, circuits, wireCurrentsA, notes: solve.notes };
}

/** Disparos instantâneos (magnético e diferencial) para o estado atual. */
export function findInstantaneousTrips(project: Project, snap: SimulationSnapshot, topo: TopologyAnalysis): TripEvent[] {
  const candidates: TripEvent[] = [];
  for (const d of project.devices) {
    if (d.state !== 'on') continue;
    const reading = snap.devices.get(d.id);
    if (!reading) continue;
    const bp = breakerParams(d);
    if (bp && bp.ratedCurrentA !== null && bp.curve !== null) {
      const hi = CURVE_INSTANTANEOUS_RANGE[bp.curve][1] * bp.ratedCurrentA;
      if (reading.maxCurrentA >= hi) {
        const exceeds = bp.breakingCapacityKA !== null && reading.maxCurrentA > bp.breakingCapacityKA * 1000;
        candidates.push({
          deviceId: d.id,
          label: d.label,
          reason: 'magnetico',
          currentA: reading.maxCurrentA,
          severity: exceeds ? 'erro' : 'alerta',
          message: exceeds
            ? `${d.label}: corrente de ${formatCurrent(reading.maxCurrentA)} EXCEDE a capacidade de interrupção (${bp.breakingCapacityKA} kA). Na prática o dispositivo poderia não interromper com segurança.`
            : `${d.label}: disparo magnético (instantâneo) — ${formatCurrent(reading.maxCurrentA)} ≥ ${CURVE_INSTANTANEOUS_RANGE[bp.curve][1]}·In = ${formatCurrent(hi)} (curva ${bp.curve}).`,
        });
      }
    }
    const rp = rcdParams(d);
    if (rp && rp.residualCurrentMA !== null && reading.differentialA !== null) {
      const idn = rp.residualCurrentMA / 1000;
      if (reading.differentialA >= idn) {
        candidates.push({
          deviceId: d.id,
          label: d.label,
          reason: 'diferencial',
          currentA: reading.differentialA,
          severity: 'alerta',
          message: `${d.label}: disparo diferencial — |ΣI| = ${formatCurrent(reading.differentialA)} ≥ IΔn = ${rp.residualCurrentMA} mA.`,
        });
      }
    }
  }
  // Mantém apenas o dispositivo mais a jusante de cada tipo de atuação
  return candidates.filter(
    (c) =>
      !candidates.some(
        (o) => o !== c && o.reason === c.reason && (topo.devices.get(o.deviceId)?.upstream ?? []).includes(c.deviceId),
      ),
  );
}

export interface SettleResult {
  project: Project;
  events: TripEvent[];
  snapshot: SimulationSnapshot;
}

/** Resolve o circuito e aplica atuações instantâneas até estabilizar. */
export function settleSimulation(project: Project, topo: TopologyAnalysis, maxIter = 8): SettleResult {
  let current = project;
  let snap = readSimulation(current, topo);
  const events: TripEvent[] = [];
  if (!project.simulation.energized) return { project: current, events, snapshot: snap };
  for (let i = 0; i < maxIter; i++) {
    const trips = findInstantaneousTrips(current, snap, topo);
    if (!trips.length) break;
    events.push(...trips);
    const ids = new Set(trips.map((t) => t.deviceId));
    current = { ...current, devices: current.devices.map((d) => (ids.has(d.id) ? { ...d, state: 'tripped' as const } : d)) };
    snap = readSimulation(current, topo);
  }
  const upstreamAlso = events.filter((e) => e.reason === 'magnetico');
  if (upstreamAlso.length) {
    events.push({
      deviceId: upstreamAlso[0].deviceId,
      label: upstreamAlso[0].label,
      reason: 'magnetico',
      currentA: upstreamAlso[0].currentA,
      severity: 'info',
      message:
        'Seletividade não modelada: dispositivos a montante também podem ter sido solicitados; a coordenação real exige tabelas do fabricante.',
    });
  }
  return { project: current, events, snapshot: snap };
}

/** Avança o modelo térmico didático por dt segundos. */
export function stepThermal(
  project: Project,
  snap: SimulationSnapshot,
  thermal: Record<string, number>,
  dtS: number,
): { thermal: Record<string, number>; trips: TripEvent[] } {
  const next: Record<string, number> = {};
  const trips: TripEvent[] = [];
  const th2 = THERMAL_MODEL.thresholdMultiple ** 2;
  const decay = Math.exp(-dtS / THERMAL_MODEL.tauS);
  for (const d of project.devices) {
    const bp = breakerParams(d);
    if (!bp) continue;
    const prev = thermal[d.id] ?? 0;
    if (d.state !== 'on' || bp.ratedCurrentA === null || !project.simulation.energized) {
      next[d.id] = prev * decay;
      continue;
    }
    const r = (snap.devices.get(d.id)?.maxCurrentA ?? 0) / bp.ratedCurrentA;
    const theta = r * r + (prev - r * r) * decay;
    next[d.id] = theta;
    if (theta >= th2) {
      trips.push({
        deviceId: d.id,
        label: d.label,
        reason: 'termico',
        currentA: r * bp.ratedCurrentA,
        severity: 'alerta',
        message: `${d.label}: disparo térmico por sobrecarga (I = ${(r).toFixed(2)}·In). Modelo térmico didático.`,
      });
      next[d.id] = 0;
    }
  }
  return { thermal: next, trips };
}

/** Tempo de disparo térmico (s) a partir do estado frio para corrente constante (modelo didático). */
export function thermalTripTimeS(multipleOfIn: number): number | null {
  const th2 = THERMAL_MODEL.thresholdMultiple ** 2;
  const r2 = multipleOfIn * multipleOfIn;
  if (r2 <= th2) return null;
  return THERMAL_MODEL.tauS * Math.log(r2 / (r2 - th2));
}

export interface SurgeResult {
  conductor: string;
  protectedBy: string[];
  clampKV: number | null;
  message: string;
}

/** Surto transitório ILUSTRATIVO: verifica se há DPS entre cada condutor vivo e o PE. */
export function simulateSurge(project: Project, topo: TopologyAnalysis, surgeKA: number) {
  const results: SurgeResult[] = [];
  const endOfLife: string[] = [];
  const conductors = ownerTerminals(project, 'entrada')
    .map((t) => t.id)
    .filter((id) => id !== 'PE');
  for (const cond of conductors) {
    const protectedBy: string[] = [];
    let clamp: number | null = null;
    for (const d of project.devices) {
      const item = getCatalogItem(d.catalogId);
      if (!item || item.category !== 'dps' || d.spd?.endOfLife) continue;
      const lineSources = topo.netSources(terminalKey({ owner: d.id, terminal: 'L' }));
      const peSources = topo.netSources(terminalKey({ owner: d.id, terminal: 'PE' }));
      if (lineSources.includes(cond as never) && peSources.includes('PE')) {
        protectedBy.push(d.id);
        const up = (effectiveElectrical(d, item) as { upKV: number | null }).upKV;
        if (up !== null) clamp = clamp === null ? up : Math.min(clamp, up);
      }
    }
    results.push({
      conductor: cond,
      protectedBy,
      clampKV: clamp,
      message: protectedBy.length
        ? `${cond}: surto desviado ao PE; tensão residual limitada a ~${clamp ?? '?'} kV (Up).`
        : `${cond}: sem DPS operante entre ${cond} e PE — o surto atinge os equipamentos (ilustrativo).`,
    });
  }
  for (const d of project.devices) {
    const item = getCatalogItem(d.catalogId);
    if (!item || item.category !== 'dps') continue;
    const e = effectiveElectrical(d, item) as { imaxKA: number | null; iimpKA: number | null };
    const limit = e.imaxKA ?? e.iimpKA;
    if (limit !== null && surgeKA > limit && results.some((r) => r.protectedBy.includes(d.id))) endOfLife.push(d.id);
  }
  return { results, endOfLife };
}
