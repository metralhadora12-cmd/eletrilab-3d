/** Resolução de terminais: dispositivos do catálogo, bornes fixos do quadro e saídas de circuito. */
import { getCatalogItem } from '../catalog';
import type { TerminalDef } from '../catalog/schema';
import { circuitTerminalIds, supplyPhases } from '../electrical/core/systems';
import {
  FIXED_OWNERS,
  circuitIdFromOwner,
  isCircuitOwner,
  terminalKey,
  type Circuit,
  type Project,
  type Supply,
  type TerminalRef,
} from './schema';

export const MAIN_BAR_TERMINALS = 10;
const BAR_PITCH_MM = 14;
const ENTRY_PITCH_MM = 16;
export const OUTPUT_PITCH_MM = 11;

export function entryTerminals(supply: Supply): TerminalDef[] {
  const ids = [...supplyPhases(supply.type), 'N', 'PE'];
  return ids.map((id, i) => ({
    id,
    label: id,
    side: 'bottom' as const,
    xMm: 8 + i * ENTRY_PITCH_MM,
    accepts: id === 'N' ? ['N' as const] : id === 'PE' ? ['PE' as const] : ['L' as const],
    maxSectionMm2: 35,
  }));
}

export function mainBarTerminals(fn: 'N' | 'PE'): TerminalDef[] {
  return Array.from({ length: MAIN_BAR_TERMINALS }, (_, i) => ({
    id: `${fn}${i + 1}`,
    label: `${i + 1}`,
    side: 'top' as const,
    xMm: 7 + i * BAR_PITCH_MM,
    accepts: [fn],
    maxSectionMm2: 25,
  }));
}

export function circuitTerminals(circuit: Circuit): TerminalDef[] {
  return circuitTerminalIds(circuit.connection).map((id, i) => ({
    id,
    label: id === 'L1' && circuit.connection === 'F-N' ? 'L' : id,
    side: 'top' as const,
    xMm: 5.5 + i * OUTPUT_PITCH_MM,
    accepts: id === 'N' ? ['N' as const] : id === 'PE' ? ['PE' as const] : ['L' as const],
    maxSectionMm2: 35,
  }));
}

export type OwnerKind = 'device' | 'entry' | 'bar-n' | 'bar-pe' | 'circuit';

export function ownerKind(owner: string): OwnerKind {
  if (owner === FIXED_OWNERS.entry) return 'entry';
  if (owner === FIXED_OWNERS.neutralBar) return 'bar-n';
  if (owner === FIXED_OWNERS.peBar) return 'bar-pe';
  if (isCircuitOwner(owner)) return 'circuit';
  return 'device';
}

export function ownerTerminals(project: Project, owner: string): TerminalDef[] {
  switch (ownerKind(owner)) {
    case 'entry':
      return entryTerminals(project.supply);
    case 'bar-n':
      return mainBarTerminals('N');
    case 'bar-pe':
      return mainBarTerminals('PE');
    case 'circuit': {
      const c = project.circuits.find((x) => x.id === circuitIdFromOwner(owner));
      return c ? circuitTerminals(c) : [];
    }
    case 'device': {
      const d = project.devices.find((x) => x.id === owner);
      const item = d ? getCatalogItem(d.catalogId) : undefined;
      return item ? item.terminals : [];
    }
  }
}

export function ownerLabel(project: Project, owner: string): string {
  switch (ownerKind(owner)) {
    case 'entry':
      return 'Entrada';
    case 'bar-n':
      return 'Barra N';
    case 'bar-pe':
      return 'Barra PE';
    case 'circuit': {
      const c = project.circuits.find((x) => x.id === circuitIdFromOwner(owner));
      return c ? `Saída C${c.number}` : 'Saída ?';
    }
    case 'device': {
      const d = project.devices.find((x) => x.id === owner);
      return d ? d.label : '?';
    }
  }
}

export interface ResolvedTerminal {
  ref: TerminalRef;
  key: string;
  def: TerminalDef;
  ownerKind: OwnerKind;
  ownerLabel: string;
}

export function resolveTerminal(project: Project, ref: TerminalRef): ResolvedTerminal | null {
  const def = ownerTerminals(project, ref.owner).find((t) => t.id === ref.terminal);
  if (!def) return null;
  return { ref, key: terminalKey(ref), def, ownerKind: ownerKind(ref.owner), ownerLabel: ownerLabel(project, ref.owner) };
}

export function terminalDisplayName(project: Project, ref: TerminalRef): string {
  const r = resolveTerminal(project, ref);
  return r ? `${r.ownerLabel} · ${r.def.label}` : `${ref.owner}:${ref.terminal} (inexistente)`;
}

export function listOwners(project: Project): string[] {
  return [
    FIXED_OWNERS.entry,
    FIXED_OWNERS.neutralBar,
    FIXED_OWNERS.peBar,
    ...project.devices.map((d) => d.id),
    ...project.circuits.map((c) => `circ:${c.id}`),
  ];
}

export function listAllTerminals(project: Project): ResolvedTerminal[] {
  return listOwners(project).flatMap((owner) =>
    ownerTerminals(project, owner).map((def) => ({
      ref: { owner, terminal: def.id },
      key: terminalKey({ owner, terminal: def.id }),
      def,
      ownerKind: ownerKind(owner),
      ownerLabel: ownerLabel(project, owner),
    })),
  );
}

/** Quantidade de condutores ligados a cada terminal. */
export function terminalOccupancy(project: Project): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of project.wires) {
    for (const r of [w.from, w.to]) m.set(terminalKey(r), (m.get(terminalKey(r)) ?? 0) + 1);
  }
  return m;
}
