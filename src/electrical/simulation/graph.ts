/**
 * Grafo de conexões do quadro (nós = terminais; arestas = condutores,
 * polos de dispositivos, interligações internas, pentes).
 */
import { getCatalogItem } from '../../catalog';
import { MODULE_MM } from '../../catalog/devices';
import { FIXED_OWNERS, terminalKey, type Project } from '../../model/schema';
import { mainBarTerminals } from '../../model/terminals';

export type EdgeRef =
  | { kind: 'wire'; wireId: string }
  | { kind: 'pole'; deviceId: string; pole: number }
  | { kind: 'bond'; owner: string }
  | { kind: 'comb'; combId: string; phase: number }
  | { kind: 'pen' };

export interface GraphEdge {
  id: string;
  a: string;
  b: string;
  ref: EdgeRef;
  closed: boolean;
}

export const SOURCE_KEYS = {
  L1: terminalKey({ owner: FIXED_OWNERS.entry, terminal: 'L1' }),
  L2: terminalKey({ owner: FIXED_OWNERS.entry, terminal: 'L2' }),
  L3: terminalKey({ owner: FIXED_OWNERS.entry, terminal: 'L3' }),
  N: terminalKey({ owner: FIXED_OWNERS.entry, terminal: 'N' }),
  PE: terminalKey({ owner: FIXED_OWNERS.entry, terminal: 'PE' }),
} as const;
export type SourceName = keyof typeof SOURCE_KEYS;
export const SOURCE_BY_KEY = new Map<string, SourceName>(
  Object.entries(SOURCE_KEYS).map(([k, v]) => [v, k as SourceName]),
);

function chain(keys: string[], ref: EdgeRef, idPrefix: string): GraphEdge[] {
  const out: GraphEdge[] = [];
  for (let i = 1; i < keys.length; i++) {
    out.push({ id: `${idPrefix}#${i}`, a: keys[i - 1], b: keys[i], ref, closed: true });
  }
  return out;
}

export interface CombPinInfo {
  combId: string;
  /** Terminais efetivamente conectados pelo pente, por fase. */
  phases: string[][];
  /** Dispositivos sob o pente que não são compatíveis (dente não inserido). */
  incompatible: string[];
}

export function combPins(project: Project): CombPinInfo[] {
  return project.combs.map((comb) => {
    const phases: string[][] = Array.from({ length: comb.phases }, () => []);
    const incompatible = new Set<string>();
    for (let m = comb.startModule; m < comb.startModule + comb.lengthModules; m++) {
      const dev = project.devices.find((d) => {
        if (d.row !== comb.row) return false;
        const w = getCatalogItem(d.catalogId)?.dimensions.widthModules ?? 1;
        return m >= d.module && m < d.module + w;
      });
      if (!dev) continue;
      const item = getCatalogItem(dev.catalogId);
      if (!item) continue;
      if (!item.compatibility.combCompatible) {
        incompatible.add(dev.id);
        continue;
      }
      const xMm = (m - dev.module) * MODULE_MM + MODULE_MM / 2;
      const t = item.terminals.find((tt) => tt.side === 'top' && Math.abs(tt.xMm - xMm) < 1);
      if (t) phases[(m - comb.startModule) % comb.phases].push(terminalKey({ owner: dev.id, terminal: t.id }));
    }
    return { combId: comb.id, phases, incompatible: [...incompatible] };
  });
}

/**
 * Constrói as arestas do quadro.
 * @param assumeClosed considera todos os polos fechados (análise estrutural).
 */
export function buildPanelEdges(project: Project, assumeClosed: boolean): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (const d of project.devices) {
    const item = getCatalogItem(d.catalogId);
    if (!item) continue;
    for (const link of item.internal) {
      if (link.kind === 'pole') {
        edges.push({
          id: `pole:${d.id}:${link.pole}`,
          a: terminalKey({ owner: d.id, terminal: link.a }),
          b: terminalKey({ owner: d.id, terminal: link.b }),
          ref: { kind: 'pole', deviceId: d.id, pole: link.pole },
          closed: assumeClosed || d.state === 'on',
        });
      } else {
        edges.push(
          ...chain(
            link.terminals.map((t) => terminalKey({ owner: d.id, terminal: t })),
            { kind: 'bond', owner: d.id },
            `bond:${d.id}`,
          ),
        );
      }
    }
  }
  for (const fn of ['N', 'PE'] as const) {
    const owner = fn === 'N' ? FIXED_OWNERS.neutralBar : FIXED_OWNERS.peBar;
    edges.push(
      ...chain(
        mainBarTerminals(fn).map((t) => terminalKey({ owner, terminal: t.id })),
        { kind: 'bond', owner },
        `bond:${owner}`,
      ),
    );
  }
  for (const info of combPins(project)) {
    info.phases.forEach((keys, phase) => edges.push(...chain(keys, { kind: 'comb', combId: info.combId, phase }, `comb:${info.combId}:${phase}`)));
  }
  if (project.supply.earthing === 'TN-C-S') {
    edges.push({ id: 'pen', a: SOURCE_KEYS.N, b: SOURCE_KEYS.PE, ref: { kind: 'pen' }, closed: true });
  }
  for (const w of project.wires) {
    edges.push({
      id: `wire:${w.id}`,
      a: terminalKey(w.from),
      b: terminalKey(w.to),
      ref: { kind: 'wire', wireId: w.id },
      closed: !w.broken,
    });
  }
  return edges;
}

export class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      return x;
    }
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export type Adjacency = Map<string, Array<{ to: string; edge: GraphEdge }>>;

export function adjacency(edges: GraphEdge[], filter: (e: GraphEdge) => boolean = (e) => e.closed): Adjacency {
  const adj: Adjacency = new Map();
  const add = (a: string, b: string, e: GraphEdge) => {
    let l = adj.get(a);
    if (!l) adj.set(a, (l = []));
    l.push({ to: b, edge: e });
  };
  for (const e of edges) {
    if (!filter(e)) continue;
    add(e.a, e.b, e);
    add(e.b, e.a, e);
  }
  return adj;
}

/** Busca em largura até qualquer nó-alvo; retorna o caminho de arestas (origem → alvo). */
export function bfsPath(
  adj: Adjacency,
  start: string,
  isTarget: (node: string) => boolean,
  skip?: (e: GraphEdge) => boolean,
): { target: string; edges: GraphEdge[] } | null {
  if (isTarget(start)) return { target: start, edges: [] };
  const prev = new Map<string, { node: string; edge: GraphEdge }>();
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const n = queue.shift()!;
    for (const { to, edge } of adj.get(n) ?? []) {
      if (seen.has(to) || (skip && skip(edge))) continue;
      seen.add(to);
      prev.set(to, { node: n, edge });
      if (isTarget(to)) {
        const path: GraphEdge[] = [];
        let cur = to;
        while (cur !== start) {
          const p = prev.get(cur)!;
          path.unshift(p.edge);
          cur = p.node;
        }
        return { target: to, edges: path };
      }
      queue.push(to);
    }
  }
  return null;
}

/** Todos os nós alcançáveis a partir de `start`. */
export function reachable(adj: Adjacency, start: string, skip?: (e: GraphEdge) => boolean): Set<string> {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const n = queue.shift()!;
    for (const { to, edge } of adj.get(n) ?? []) {
      if (seen.has(to) || (skip && skip(edge))) continue;
      seen.add(to);
      queue.push(to);
    }
  }
  return seen;
}
