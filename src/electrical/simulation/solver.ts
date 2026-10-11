/**
 * Solver nodal em regime permanente senoidal (fasores, 60 Hz).
 *
 * Modelo (simplificado, didático — ver README "Limitações"):
 *  - Fonte: tensões de fase U0∠0°, U0∠−120°, U0∠+120° com impedância resistiva
 *    derivada da Icc presumida (ou de um valor ilustrativo, sinalizado).
 *  - Condutores: resistência na temperatura máxima da isolação; reatância desprezada.
 *  - Polos fechados: resistência de contato ilustrativa.
 *  - Cargas: impedância constante calculada na tensão nominal (P + jQ).
 *  - Aterramento: nó TERRA ligado à fonte por RB; PE ligado à TERRA por RA.
 *  - Cada nó possui uma admitância de 1 nS para a referência (isolação),
 *    o que evita singularidade em trechos flutuantes.
 */
import type { Fault, Project } from '../../model/schema';
import { circuitOwnerId, terminalKey } from '../../model/schema';
import { computeWireLengths } from '../../model/geometry';
import { ownerTerminals } from '../../model/terminals';
import { ILLUSTRATIVE_DEFAULTS, POLE_RESISTANCE_OHM } from '../core/constants';
import { C, type Complex, ZERO, cabs, cadd, cconj, cdiv, cmul, cscale, csub, polar, solveComplexLinear } from '../core/complex';
import { PHASE_ANGLE_DEG, connectionHasNeutral, supplyPhases, systemVoltages } from '../core/systems';
import { conductorResistance } from '../calculations/conductor';
import { aggregateLoads } from '../calculations/power';
import { UnionFind, buildPanelEdges, SOURCE_KEYS, type EdgeRef } from './graph';

export const REF = '__REF__';
export const TERRA = '__TERRA__';
const SHUNT_S = 1e-9;
const FAULT_R = 0.01;

export type SimEdgeRef =
  | EdgeRef
  | { kind: 'cable'; circuitId: string; conductor: string }
  | { kind: 'load'; circuitId: string; part: string }
  | { kind: 'fault'; faultId: string; circuitId: string }
  | { kind: 'body'; faultId: string; circuitId: string }
  | { kind: 'source'; name: string }
  | { kind: 'earth'; name: 'RA' | 'RB' | 'N' | 'PE' };

export interface SimEdge {
  id: string;
  a: string;
  b: string;
  y: Complex;
  ref: SimEdgeRef;
}

export const loadNode = (circuitId: string, part: string) => `load:${circuitId}:${part}`;

export interface BuildOptions {
  /** 'operating' = com fontes; 'passive' = instalação isolada da rede (medição de resistência). */
  mode: 'operating' | 'passive';
}

export interface NetworkModel {
  edges: SimEdge[];
  injections: Map<string, Complex>;
  merge: UnionFind;
  notes: string[];
}

export function buildNetwork(project: Project, opts: BuildOptions): NetworkModel {
  const notes: string[] = [];
  const merge = new UnionFind();
  const edges: SimEdge[] = [];
  const injections = new Map<string, Complex>();
  const supply = project.supply;
  const v = systemVoltages(supply.systemVoltage);
  const energized = opts.mode === 'operating' && project.simulation.energized;

  // Arestas do quadro: ligações rígidas são fundidas; fios e polos viram admitâncias.
  const lengths = computeWireLengths(project);
  const wiresById = new Map(project.wires.map((w) => [w.id, w]));
  for (const e of buildPanelEdges(project, false)) {
    if (!e.closed) continue;
    if (e.ref.kind === 'bond' || e.ref.kind === 'comb' || e.ref.kind === 'pen') {
      merge.union(e.a, e.b);
      continue;
    }
    let r: number;
    if (e.ref.kind === 'wire') {
      const w = wiresById.get(e.ref.wireId)!;
      r =
        conductorResistance({ sectionMm2: w.sectionMm2, material: w.material, insulation: w.insulation }).ohmPerM *
        Math.max(lengths.get(w.id) ?? 0.3, 0.05);
    } else {
      r = POLE_RESISTANCE_OHM;
    }
    edges.push({ id: e.id, a: e.a, b: e.b, y: C(1 / r), ref: e.ref });
  }

  // Fonte e aterramento
  const icc = supply.prospectiveShortCircuitKA ?? ILLUSTRATIVE_DEFAULTS.prospectiveShortCircuitKA;
  if (supply.prospectiveShortCircuitKA === null) {
    notes.push(`Icc presumida não informada: simulação usa ${ILLUSTRATIVE_DEFAULTS.prospectiveShortCircuitKA} kA (valor ilustrativo).`);
  }
  const zc = v.u0 / (icc * 1000) / 2;
  const ra = supply.earthElectrodeResistanceOhm ?? ILLUSTRATIVE_DEFAULTS.earthElectrodeResistanceOhm;
  const rb = supply.sourceEarthResistanceOhm ?? ILLUSTRATIVE_DEFAULTS.sourceEarthResistanceOhm;
  if (supply.earthElectrodeResistanceOhm === null) notes.push(`RA não informada: simulação usa ${ra} Ω (ilustrativo).`);
  if (supply.sourceEarthResistanceOhm === null) notes.push(`RB não informada: simulação usa ${rb} Ω (ilustrativo).`);

  if (opts.mode === 'operating') {
    if (energized) {
      for (const ph of supplyPhases(supply.type)) {
        const key = SOURCE_KEYS[ph];
        const ys = C(1 / zc);
        edges.push({ id: `src:${ph}`, a: key, b: REF, y: ys, ref: { kind: 'source', name: ph } });
        injections.set(key, cmul(polar(v.u0, PHASE_ANGLE_DEG[ph]), ys));
      }
    }
    edges.push({ id: 'earth:N', a: SOURCE_KEYS.N, b: REF, y: C(1 / zc), ref: { kind: 'earth', name: 'N' } });
    if (supply.earthing === 'TN-S') {
      edges.push({ id: 'earth:PE', a: SOURCE_KEYS.PE, b: REF, y: C(1 / zc), ref: { kind: 'earth', name: 'PE' } });
    } else if (supply.earthing === 'TN-C-S') {
      merge.union(SOURCE_KEYS.N, SOURCE_KEYS.PE);
    }
    edges.push({ id: 'earth:RA', a: SOURCE_KEYS.PE, b: TERRA, y: C(1 / ra), ref: { kind: 'earth', name: 'RA' } });
    edges.push({ id: 'earth:RB', a: TERRA, b: REF, y: C(1 / rb), ref: { kind: 'earth', name: 'RB' } });
  }

  // Circuitos: cabos até a carga, cargas e falhas
  const faultsByCircuit = new Map<string, Fault[]>();
  for (const f of project.simulation.faults) {
    const l = faultsByCircuit.get(f.circuitId) ?? [];
    l.push(f);
    faultsByCircuit.set(f.circuitId, l);
  }
  for (const c of project.circuits) {
    const owner = circuitOwnerId(c.id);
    const faults = faultsByCircuit.get(c.id) ?? [];
    const lengthM = c.lengthM ?? ILLUSTRATIVE_DEFAULTS.circuitLengthM;
    const section = c.sectionMm2 ?? ILLUSTRATIVE_DEFAULTS.circuitSectionMm2;
    if (c.lengthM === null) notes.push(`C${c.number}: comprimento não informado — simulação usa ${lengthM} m (ilustrativo).`);
    if (c.sectionMm2 === null) notes.push(`C${c.number}: seção não definida — simulação usa ${section} mm² (ilustrativo).`);
    const rCable = conductorResistance({ sectionMm2: section, material: c.material, insulation: c.insulation }).ohmPerM * lengthM;
    for (const t of ownerTerminals(project, owner)) {
      if (t.id === 'N' && faults.some((f) => f.kind === 'neutral-open')) continue;
      if (t.id === 'PE' && faults.some((f) => f.kind === 'pe-open')) continue;
      edges.push({
        id: `cable:${c.id}:${t.id}`,
        a: terminalKey({ owner, terminal: t.id }),
        b: loadNode(c.id, t.id),
        y: C(1 / rCable),
        ref: { kind: 'cable', circuitId: c.id, conductor: t.id },
      });
    }

    const agg = aggregateLoads(c.loads);
    if (agg.status === 'ok') {
      const factor = faults.filter((f) => f.kind === 'overload').reduce((acc, f) => acc * (f.kind === 'overload' ? f.factor : 1), 1);
      const s = C(agg.value.activeW * factor, agg.value.reactiveVar * factor);
      if (c.connection === 'F-N') {
        const z = cdiv(C(v.u0 * v.u0), cconj(s));
        edges.push({ id: `load:${c.id}`, a: loadNode(c.id, 'L1'), b: loadNode(c.id, 'N'), y: cdiv(C(1), z), ref: { kind: 'load', circuitId: c.id, part: 'L1-N' } });
      } else if (c.connection === 'F-F') {
        const z = cdiv(C(v.u * v.u), cconj(s));
        edges.push({ id: `load:${c.id}`, a: loadNode(c.id, 'L1'), b: loadNode(c.id, 'L2'), y: cdiv(C(1), z), ref: { kind: 'load', circuitId: c.id, part: 'L1-L2' } });
      } else {
        const zy = cdiv(C(v.u0 * v.u0), cconj(cscale(s, 1 / 3)));
        const star = c.connection === '3F-N' ? loadNode(c.id, 'N') : loadNode(c.id, 'STAR');
        for (const ph of ['L1', 'L2', 'L3']) {
          edges.push({ id: `load:${c.id}:${ph}`, a: loadNode(c.id, ph), b: star, y: cdiv(C(1), zy), ref: { kind: 'load', circuitId: c.id, part: ph } });
        }
      }
    }

    for (const f of faults) {
      const hasN = connectionHasNeutral(c.connection);
      if (f.kind === 'short-circuit') {
        const other = f.between === 'L-PE' ? 'PE' : f.between === 'L-N' && hasN ? 'N' : 'L2';
        if (other === 'L2' && c.connection === 'F-N') continue;
        edges.push({ id: `fault:${f.id}`, a: loadNode(c.id, 'L1'), b: loadNode(c.id, other), y: C(1 / FAULT_R), ref: { kind: 'fault', faultId: f.id, circuitId: c.id } });
      } else if (f.kind === 'leakage') {
        edges.push({ id: `fault:${f.id}`, a: loadNode(c.id, 'L1'), b: loadNode(c.id, 'PE'), y: C(1 / f.resistanceOhm), ref: { kind: 'fault', faultId: f.id, circuitId: c.id } });
      } else if (f.kind === 'touch' && opts.mode === 'operating') {
        edges.push({ id: `body:${f.id}`, a: loadNode(c.id, 'PE'), b: TERRA, y: C(1 / f.bodyResistanceOhm), ref: { kind: 'body', faultId: f.id, circuitId: c.id } });
      }
    }
  }

  return { edges, injections, merge, notes };
}

export interface SolveResult {
  voltage: (key: string) => Complex;
  edgeCurrent: (edgeId: string) => Complex;
  edges: SimEdge[];
  notes: string[];
  energized: boolean;
}

function assembleAndSolve(model: NetworkModel, extraInjections?: Map<string, Complex>) {
  const rep = (k: string) => (k === REF ? REF : model.merge.find(k));
  const index = new Map<string, number>();
  const idx = (k: string) => {
    const r = rep(k);
    if (r === REF) return -1;
    let i = index.get(r);
    if (i === undefined) {
      i = index.size;
      index.set(r, i);
    }
    return i;
  };
  for (const e of model.edges) {
    idx(e.a);
    idx(e.b);
  }
  for (const k of model.injections.keys()) idx(k);
  if (extraInjections) for (const k of extraInjections.keys()) idx(k);
  const n = index.size;
  const Y: Complex[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => ZERO));
  const I: Complex[] = Array.from({ length: n }, () => ZERO);
  for (let i = 0; i < n; i++) Y[i][i] = C(SHUNT_S);
  for (const e of model.edges) {
    const a = idx(e.a);
    const b = idx(e.b);
    if (a === b) continue;
    if (a >= 0) Y[a][a] = cadd(Y[a][a], e.y);
    if (b >= 0) Y[b][b] = cadd(Y[b][b], e.y);
    if (a >= 0 && b >= 0) {
      Y[a][b] = csub(Y[a][b], e.y);
      Y[b][a] = csub(Y[b][a], e.y);
    }
  }
  const addInj = (m: Map<string, Complex>) => {
    for (const [k, val] of m) {
      const i = idx(k);
      if (i >= 0) I[i] = cadd(I[i], val);
    }
  };
  addInj(model.injections);
  if (extraInjections) addInj(extraInjections);
  const V = n > 0 ? solveComplexLinear(Y, I) : [];
  const voltage = (key: string): Complex => {
    const r = rep(key);
    if (r === REF) return ZERO;
    const i = index.get(r);
    return i === undefined ? ZERO : V[i];
  };
  return voltage;
}

export function solveNetwork(project: Project): SolveResult {
  const model = buildNetwork(project, { mode: 'operating' });
  const voltage = assembleAndSolve(model);
  const byId = new Map(model.edges.map((e) => [e.id, e]));
  const cache = new Map<string, Complex>();
  return {
    voltage,
    edges: model.edges,
    notes: model.notes,
    energized: project.simulation.energized,
    edgeCurrent: (id: string) => {
      const hit = cache.get(id);
      if (hit) return hit;
      const e = byId.get(id);
      if (!e) return ZERO;
      const i = cmul(csub(voltage(e.a), voltage(e.b)), e.y);
      cache.set(id, i);
      return i;
    },
  };
}

/** Resistência entre dois nós com a instalação isolada da rede (injeção de 1 A). */
export function measurePassiveResistance(project: Project, a: string, b: string): number {
  const model = buildNetwork(project, { mode: 'passive' });
  // Em CC, as cargas são representadas apenas pela parte resistiva da impedância.
  model.edges = model.edges.map((e) => {
    if (e.ref.kind !== 'load') return e;
    const z = cdiv(C(1), e.y);
    return { ...e, y: C(z.re > 0 ? 1 / z.re : 0) };
  });
  const inj = new Map<string, Complex>([
    [a, C(1)],
    [b, C(-1)],
  ]);
  if (model.merge.find(a) === model.merge.find(b)) return 0;
  const voltage = assembleAndSolve(model, inj);
  return cabs(csub(voltage(a), voltage(b)));
}
