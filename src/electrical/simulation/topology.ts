/**
 * Análise estrutural (topológica) da montagem, considerando todos os
 * dispositivos fechados: caminhos de cada condutor de circuito até a
 * alimentação, dispositivos atravessados, redes elétricas, curtos de montagem.
 */
import { getCatalogItem } from '../../catalog';
import type { Category } from '../../catalog/schema';
import { circuitOwnerId, terminalKey, type PhaseId, type Project } from '../../model/schema';
import { listAllTerminals, ownerTerminals } from '../../model/terminals';
import {
  SOURCE_BY_KEY,
  SOURCE_KEYS,
  UnionFind,
  adjacency,
  bfsPath,
  buildPanelEdges,
  combPins,
  type CombPinInfo,
  type GraphEdge,
  type SourceName,
} from './graph';

export interface PathDevice {
  deviceId: string;
  pole: number;
  category: Category;
}

export interface ConductorTrace {
  terminalId: string;
  expected: 'L' | 'N' | 'PE';
  reachedSource: SourceName | null;
  netSources: SourceName[];
  devices: PathDevice[];
  wires: string[];
}

export interface CircuitTopology {
  circuitId: string;
  conductors: ConductorTrace[];
  connected: boolean;
  protectiveBreakerId: string | null;
  breakerIds: string[];
  rcdIds: string[];
  rcdNeutralMismatch: string[];
  phasesReached: (PhaseId | null)[];
  /** Fases alimentadas por disjuntores distintos não interligados (circuito multipolar). */
  splitPhaseProtection: boolean;
}

export interface DeviceTopology {
  deviceId: string;
  lineSide: 'top' | 'bottom' | null;
  upstream: string[];
  downstreamCircuits: string[];
  /** Para DPS: fonte/condutor ao qual o borne de linha está ligado. */
  connectedSources: SourceName[];
}

export type ShortKind = 'fase-fase' | 'fase-neutro' | 'fase-pe' | 'neutro-pe';

export interface TopologyAnalysis {
  edges: GraphEdge[];
  circuits: Map<string, CircuitTopology>;
  devices: Map<string, DeviceTopology>;
  netOf: (key: string) => string;
  netSources: (key: string) => SourceName[];
  wireFunction: Map<string, { fn: 'L' | 'N' | 'PE' | null; phase: PhaseId | null; conflict: boolean }>;
  shorts: Array<{ netId: string; sources: SourceName[]; kind: ShortKind }>;
  loops: number;
  combs: CombPinInfo[];
}

const PHASES: SourceName[] = ['L1', 'L2', 'L3'];
const isPhase = (s: SourceName) => PHASES.includes(s);

function classifyShort(sources: SourceName[]): ShortKind | null {
  const ph = sources.filter(isPhase);
  if (ph.length > 1) return 'fase-fase';
  if (ph.length === 1 && sources.includes('N')) return 'fase-neutro';
  if (ph.length === 1 && sources.includes('PE')) return 'fase-pe';
  if (sources.includes('N') && sources.includes('PE')) return 'neutro-pe';
  return null;
}

export function analyzeTopology(project: Project): TopologyAnalysis {
  const edges = buildPanelEdges(project, true);
  const isPen = (e: GraphEdge) => e.ref.kind === 'pen';
  const adj = adjacency(edges);

  // Redes (sem a ligação PEN da origem, para enxergar interligações N-PE indevidas)
  const uf = new UnionFind();
  for (const t of listAllTerminals(project)) uf.find(t.key);
  for (const k of Object.values(SOURCE_KEYS)) uf.find(k);
  for (const e of edges) if (e.closed && !isPen(e)) uf.union(e.a, e.b);
  const sourcesByNet = new Map<string, Set<SourceName>>();
  for (const [key, name] of SOURCE_BY_KEY) {
    const net = uf.find(key);
    if (!sourcesByNet.has(net)) sourcesByNet.set(net, new Set());
    // fontes de fase inexistentes no tipo de alimentação não são consideradas
    if (isPhase(name) && !ownerTerminals(project, 'entrada').some((t) => t.id === name)) continue;
    sourcesByNet.get(net)!.add(name);
  }
  const netSources = (key: string) => [...(sourcesByNet.get(uf.find(key)) ?? [])];

  const shorts: TopologyAnalysis['shorts'] = [];
  for (const [netId, set] of sourcesByNet) {
    const kind = classifyShort([...set]);
    if (kind) shorts.push({ netId, sources: [...set], kind });
  }

  // Laços (ciclos) no grafo: E − V + C
  const ufLoop = new UnionFind();
  let e = 0;
  let cycles = 0;
  for (const edge of edges) {
    if (!edge.closed) continue;
    e++;
    if (ufLoop.find(edge.a) === ufLoop.find(edge.b)) cycles++;
    ufLoop.union(edge.a, edge.b);
  }
  void e;

  const wireFunction: TopologyAnalysis['wireFunction'] = new Map();
  for (const w of project.wires) {
    const set = new Set([...netSources(terminalKey(w.from)), ...netSources(terminalKey(w.to))]);
    const arr = [...set];
    const phases = arr.filter(isPhase) as PhaseId[];
    const conflict = classifyShort(arr) !== null;
    let fn: 'L' | 'N' | 'PE' | null = null;
    if (phases.length) fn = 'L';
    else if (set.has('N') && !set.has('PE')) fn = 'N';
    else if (set.has('PE') && !set.has('N')) fn = 'PE';
    wireFunction.set(w.id, { fn, phase: phases.length === 1 ? phases[0] : null, conflict });
  }

  const pathDevices = (path: GraphEdge[]): PathDevice[] =>
    path
      .filter((p) => p.ref.kind === 'pole')
      .map((p) => {
        const ref = p.ref as { kind: 'pole'; deviceId: string; pole: number };
        const dev = project.devices.find((d) => d.id === ref.deviceId);
        const cat = (dev && getCatalogItem(dev.catalogId)?.category) ?? 'disjuntor';
        return { deviceId: ref.deviceId, pole: ref.pole, category: cat };
      });

  const circuits = new Map<string, CircuitTopology>();
  for (const c of project.circuits) {
    const owner = circuitOwnerId(c.id);
    const traces: ConductorTrace[] = ownerTerminals(project, owner).map((t) => {
      const expected: ConductorTrace['expected'] = t.id === 'N' ? 'N' : t.id === 'PE' ? 'PE' : 'L';
      const start = terminalKey({ owner, terminal: t.id });
      const targets =
        expected === 'L'
          ? new Set([SOURCE_KEYS.L1, SOURCE_KEYS.L2, SOURCE_KEYS.L3])
          : new Set([expected === 'N' ? SOURCE_KEYS.N : SOURCE_KEYS.PE]);
      const path = bfsPath(adj, start, (n) => targets.has(n as never), isPen);
      const reached = path ? SOURCE_BY_KEY.get(path.target) ?? null : null;
      return {
        terminalId: t.id,
        expected,
        reachedSource: reached && (expected !== 'L' || netSources(start).includes(reached)) ? reached : null,
        netSources: netSources(start),
        devices: path ? pathDevices(path.edges) : [],
        wires: path ? path.edges.filter((p) => p.ref.kind === 'wire').map((p) => (p.ref as { wireId: string }).wireId) : [],
      };
    });
    const phaseTraces = traces.filter((t) => t.expected === 'L');
    const nTrace = traces.find((t) => t.expected === 'N');
    const firstBreakers = phaseTraces.map((t) => t.devices.find((d) => d.category === 'disjuntor')?.deviceId ?? null);
    const breakerIds = [...new Set(phaseTraces.flatMap((t) => t.devices.filter((d) => d.category === 'disjuntor').map((d) => d.deviceId)))];
    const rcdOnPhase = new Set(phaseTraces.flatMap((t) => t.devices.filter((d) => d.category === 'dr').map((d) => d.deviceId)));
    const rcdOnNeutral = new Set((nTrace?.devices ?? []).filter((d) => d.category === 'dr').map((d) => d.deviceId));
    const mismatch = nTrace
      ? [...new Set([...rcdOnPhase, ...rcdOnNeutral])].filter((id) => rcdOnPhase.has(id) !== rcdOnNeutral.has(id))
      : [];
    circuits.set(c.id, {
      circuitId: c.id,
      conductors: traces,
      connected: traces.every((t) => t.reachedSource !== null),
      protectiveBreakerId: firstBreakers[0] ?? null,
      breakerIds,
      rcdIds: [...rcdOnPhase],
      rcdNeutralMismatch: mismatch,
      phasesReached: phaseTraces.map((t) => (t.reachedSource && isPhase(t.reachedSource) ? (t.reachedSource as PhaseId) : null)),
      splitPhaseProtection: new Set(firstBreakers.filter(Boolean)).size > 1,
    });
  }

  const devices = new Map<string, DeviceTopology>();
  const phaseTargets = new Set<string>([SOURCE_KEYS.L1, SOURCE_KEYS.L2, SOURCE_KEYS.L3]);
  for (const d of project.devices) {
    const item = getCatalogItem(d.catalogId);
    if (!item) continue;
    const ownSkip = (e: GraphEdge) => isPen(e) || (e.ref.kind === 'pole' && e.ref.deviceId === d.id);
    let lineSide: DeviceTopology['lineSide'] = null;
    let upstream: string[] = [];
    let connectedSources: SourceName[] = [];
    if (item.category === 'disjuntor' || item.category === 'dr') {
      const poles = item.internal.filter((l) => l.kind === 'pole') as Array<{ kind: 'pole'; pole: number; a: string; b: string }>;
      for (const side of ['top', 'bottom'] as const) {
        for (const p of poles) {
          const term = side === 'top' ? p.a : p.b;
          const def = item.terminals.find((t) => t.id === term);
          if (!def || !def.accepts.includes('L')) continue;
          const path = bfsPath(adj, terminalKey({ owner: d.id, terminal: term }), (n) => phaseTargets.has(n), ownSkip);
          if (path) {
            lineSide = side;
            upstream = [...new Set(pathDevices(path.edges).map((x) => x.deviceId))];
            break;
          }
        }
        if (lineSide) break;
      }
    } else if (item.category === 'dps') {
      const k = terminalKey({ owner: d.id, terminal: 'L' });
      connectedSources = netSources(k);
      const path = bfsPath(adj, k, (n) => SOURCE_BY_KEY.has(n), isPen);
      if (path) upstream = [...new Set(pathDevices(path.edges).map((x) => x.deviceId))];
    }
    const downstreamCircuits = [...circuits.values()]
      .filter((ct) => ct.conductors.some((tr) => tr.devices.some((x) => x.deviceId === d.id)))
      .map((ct) => ct.circuitId);
    devices.set(d.id, { deviceId: d.id, lineSide, upstream, downstreamCircuits, connectedSources });
  }

  return {
    edges,
    circuits,
    devices,
    netOf: (k) => uf.find(k),
    netSources,
    wireFunction,
    shorts,
    loops: cycles,
    combs: combPins(project),
  };
}
