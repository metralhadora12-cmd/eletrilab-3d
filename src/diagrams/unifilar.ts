/**
 * Geração do diagrama unifilar a partir do MESMO modelo da montagem 3D
 * (análise topológica). Não há estado próprio: qualquer alteração no quadro
 * altera o diagrama, e edições feitas a partir do diagrama alteram o modelo.
 */
import { effectiveElectrical, getCatalogItem } from '../catalog';
import type { BreakerElectrical, RcdElectrical, SpdElectrical } from '../catalog/schema';
import type { DeviceState, Project } from '../model/schema';
import { CONNECTION_LABEL, systemVoltages } from '../electrical/core/systems';
import { formatNumberBR } from '../electrical/core/units';
import { analyzeTopology, type TopologyAnalysis } from '../electrical/simulation/topology';
import type { SizingResult } from '../electrical/calculations/conductorSizing';

export type DiagramNodeKind = 'supply' | 'breaker' | 'rcd' | 'spd' | 'circuit';

export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  refId: string | null;
  label: string;
  details: string[];
  x: number;
  y: number;
  depth: number;
  parent: string | null;
  state?: DeviceState;
  connected: boolean;
}

export interface DiagramEdge {
  from: string;
  to: string;
  points: Array<[number, number]>;
}

export interface UnifilarDiagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  width: number;
  height: number;
  unconnected: DiagramNode[];
  title: string;
}

export const LAYOUT = { colW: 150, rowH: 120, marginX: 40, marginTop: 70 };

const SUPPLY_LABEL = { monofasico: 'Monofásico (F+N+PE)', bifasico: 'Bifásico (2F+N+PE)', trifasico: 'Trifásico (3F+N+PE)' };

export function buildUnifilar(
  project: Project,
  topo: TopologyAnalysis = analyzeTopology(project),
  sizing?: Map<string, SizingResult>,
): UnifilarDiagram {
  const v = systemVoltages(project.supply.systemVoltage);
  const nodes = new Map<string, DiagramNode>();
  const children = new Map<string, string[]>();
  const addChild = (parent: string, child: string) => children.set(parent, [...(children.get(parent) ?? []), child]);

  nodes.set('supply', {
    id: 'supply',
    kind: 'supply',
    refId: null,
    label: `Alimentação ${project.supply.systemVoltage} V`,
    details: [
      `${SUPPLY_LABEL[project.supply.type]} · ${project.supply.earthing} · ${project.supply.frequencyHz} Hz`,
      project.supply.prospectiveShortCircuitKA !== null ? `Icc presumida ${formatNumberBR(project.supply.prospectiveShortCircuitKA)} kA` : 'Icc presumida não informada',
    ],
    x: 0,
    y: 0,
    depth: 0,
    parent: null,
    connected: true,
  });

  const unconnected: DiagramNode[] = [];
  for (const d of project.devices) {
    const item = getCatalogItem(d.catalogId);
    if (!item) continue;
    const dt = topo.devices.get(d.id);
    let kind: DiagramNodeKind | null = null;
    const details: string[] = [];
    if (item.category === 'disjuntor') {
      kind = 'breaker';
      const e = effectiveElectrical(d, item) as BreakerElectrical;
      details.push(`${e.curve ?? '?'}${e.ratedCurrentA ?? '?'} · ${e.poles}P`, `Icn ${e.breakingCapacityKA !== null ? `${formatNumberBR(e.breakingCapacityKA)} kA` : 'desconhecida'}`);
    } else if (item.category === 'dr') {
      kind = 'rcd';
      const e = effectiveElectrical(d, item) as RcdElectrical;
      details.push(`${e.ratedCurrentA ?? '?'} A · IΔn ${e.residualCurrentMA ?? '?'} mA`, `Tipo ${e.rcdType ?? '?'} · ${e.poles}P`);
    } else if (item.category === 'dps') {
      kind = 'spd';
      const e = effectiveElectrical(d, item) as SpdElectrical;
      details.push(`Tipo ${e.spdClass ?? '?'} · Uc ${e.ucV ?? '?'} V`, `Up ${e.upKV ?? '?'} kV · ${dt?.connectedSources.join('/') || 'sem ligação'}`);
    }
    if (!kind) continue;
    const connected = kind === 'spd' ? (dt?.connectedSources.length ?? 0) > 0 : dt?.lineSide != null;
    const parent = connected ? dt?.upstream[0] ?? 'supply' : null;
    const node: DiagramNode = { id: d.id, kind, refId: d.id, label: d.label, details, x: 0, y: 0, depth: 0, parent, state: d.state, connected };
    nodes.set(d.id, node);
    if (parent) addChild(parent, d.id);
    else unconnected.push(node);
  }

  for (const c of project.circuits) {
    const ct = topo.circuits.get(c.id);
    const firstDevice = ct?.conductors.find((t) => t.expected === 'L')?.devices[0]?.deviceId ?? null;
    const phaseOk = ct?.conductors.filter((t) => t.expected === 'L').every((t) => t.reachedSource) ?? false;
    const sz = sizing?.get(c.id);
    const power = c.loads.reduce((a, l) => a + l.powerW * l.quantity, 0);
    const node: DiagramNode = {
      id: `c:${c.id}`,
      kind: 'circuit',
      refId: c.id,
      label: `C${c.number} — ${c.name}`,
      details: [
        `${CONNECTION_LABEL[c.connection].split(' (')[0]} ${ct?.phasesReached.filter(Boolean).join('-') || ''} · ${c.connection === 'F-N' ? v.u0 : v.u} V`,
        `${c.sectionMm2 !== null ? `${formatNumberBR(c.sectionMm2)} mm²` : 'seção ?'} · ${formatNumberBR(power, 0)} W`,
        sz?.designCurrentA ? `Ib ${formatNumberBR(sz.designCurrentA)} A` : 'Ib —',
      ],
      x: 0,
      y: 0,
      depth: 0,
      parent: phaseOk ? firstDevice ?? 'supply' : null,
      connected: !!ct?.connected,
    };
    nodes.set(node.id, node);
    if (node.parent && nodes.has(node.parent)) addChild(node.parent, node.id);
    else {
      node.parent = null;
      unconnected.push(node);
    }
  }

  // Layout em árvore: folhas da esquerda para a direita; pais centralizados sobre os filhos.
  let leafX = 0;
  let maxDepth = 0;
  const order = (id: string) => {
    const n = nodes.get(id)!;
    return n.kind === 'spd' ? 0 : n.kind === 'circuit' ? 2 : 1;
  };
  const place = (id: string, depth: number): number => {
    const n = nodes.get(id)!;
    n.depth = depth;
    maxDepth = Math.max(maxDepth, depth);
    const kids = (children.get(id) ?? []).sort((a, b) => order(a) - order(b));
    if (!kids.length) {
      n.x = leafX++;
      return n.x;
    }
    const xs = kids.map((k) => place(k, depth + 1));
    n.x = (Math.min(...xs) + Math.max(...xs)) / 2;
    return n.x;
  };
  place('supply', 0);
  const toPx = (n: DiagramNode) => {
    n.x = LAYOUT.marginX + n.x * LAYOUT.colW + LAYOUT.colW / 2;
    n.y = LAYOUT.marginTop + n.depth * LAYOUT.rowH;
  };
  const placed = [...nodes.values()].filter((n) => n.parent !== null || n.id === 'supply');
  placed.forEach(toPx);
  unconnected.forEach((n, i) => {
    n.x = LAYOUT.marginX + i * LAYOUT.colW + LAYOUT.colW / 2;
    n.y = LAYOUT.marginTop + (maxDepth + 1.6) * LAYOUT.rowH;
  });

  const edges: DiagramEdge[] = [];
  for (const n of placed) {
    if (!n.parent) continue;
    const p = nodes.get(n.parent)!;
    const busY = p.y + LAYOUT.rowH * 0.55;
    edges.push({
      from: p.id,
      to: n.id,
      points: [
        [p.x, p.y + 28],
        [p.x, busY],
        [n.x, busY],
        [n.x, n.y - 30],
      ],
    });
  }

  const width = LAYOUT.marginX * 2 + Math.max(leafX, unconnected.length, 3) * LAYOUT.colW;
  const height = LAYOUT.marginTop + (maxDepth + (unconnected.length ? 2.6 : 1)) * LAYOUT.rowH + 60;
  return { nodes: placed, edges, width, height, unconnected, title: project.name };
}
