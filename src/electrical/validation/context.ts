/** Contexto de validação: tudo o que as regras precisam, calculado uma única vez. */
import { effectiveElectrical, getCatalogItem } from '../../catalog';
import type { BreakerElectrical, RcdElectrical, SpdElectrical } from '../../catalog/schema';
import type { DeviceInstance, FindingSeverity, Project, ValidationProfile } from '../../model/schema';
import { systemVoltages, type SystemVoltages } from '../core/systems';
import { sizeCircuit, type ProtectionInfo, type SizingResult } from '../calculations/conductorSizing';
import { analyzeTopology, type TopologyAnalysis } from '../simulation/topology';

export type TargetKind = 'circuit' | 'device' | 'wire' | 'project' | 'comb';

export interface Finding {
  ruleId: string;
  severity: FindingSeverity;
  message: string;
  targetKind: TargetKind;
  targetId: string | null;
  hint?: string;
}

export interface ValidationContext {
  project: Project;
  profile: ValidationProfile;
  topology: TopologyAnalysis;
  voltages: SystemVoltages;
  protection: Map<string, ProtectionInfo | null>;
  sizing: Map<string, SizingResult>;
  device: (id: string) => DeviceInstance | undefined;
  breaker: (id: string) => BreakerElectrical | null;
  rcd: (id: string) => RcdElectrical | null;
  spd: (id: string) => SpdElectrical | null;
  circuitLabel: (id: string) => string;
}

export function protectionInfoFor(project: Project, deviceId: string | null): ProtectionInfo | null {
  if (!deviceId) return null;
  const d = project.devices.find((x) => x.id === deviceId);
  const item = d && getCatalogItem(d.catalogId);
  if (!d || !item || item.category !== 'disjuntor') return null;
  const e = effectiveElectrical(d, item) as BreakerElectrical;
  return {
    deviceId: d.id,
    label: d.label,
    ratedCurrentA: e.ratedCurrentA,
    curve: e.curve,
    breakingCapacityKA: e.breakingCapacityKA,
  };
}

export function buildValidationContext(project: Project, topology = analyzeTopology(project)): ValidationContext {
  const protection = new Map<string, ProtectionInfo | null>();
  const sizing = new Map<string, SizingResult>();
  for (const c of project.circuits) {
    const p = protectionInfoFor(project, topology.circuits.get(c.id)?.protectiveBreakerId ?? null);
    protection.set(c.id, p);
    sizing.set(c.id, sizeCircuit({ circuit: c, supply: project.supply, protection: p }));
  }
  const byId = new Map(project.devices.map((d) => [d.id, d]));
  const typed = <T>(id: string, cat: string): T | null => {
    const d = byId.get(id);
    const item = d && getCatalogItem(d.catalogId);
    if (!d || !item || item.category !== cat) return null;
    return effectiveElectrical(d, item) as T;
  };
  return {
    project,
    profile: project.validationProfile,
    topology,
    voltages: systemVoltages(project.supply.systemVoltage),
    protection,
    sizing,
    device: (id) => byId.get(id),
    breaker: (id) => typed<BreakerElectrical>(id, 'disjuntor'),
    rcd: (id) => typed<RcdElectrical>(id, 'dr'),
    spd: (id) => typed<SpdElectrical>(id, 'dps'),
    circuitLabel: (id) => {
      const c = project.circuits.find((x) => x.id === id);
      return c ? `C${c.number} (${c.name})` : id;
    },
  };
}
