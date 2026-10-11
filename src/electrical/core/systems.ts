/** Modelos de sistema de alimentação e de ligação dos circuitos. */
import type { CircuitConnection, PhaseId, Supply, SupplyType, SystemVoltage } from '../../model/schema';

export interface SystemVoltages {
  /** Tensão fase-neutro (V). */
  u0: number;
  /** Tensão fase-fase (V). */
  u: number;
}

export function systemVoltages(sv: SystemVoltage): SystemVoltages {
  const [u0, u] = sv.split('/').map(Number);
  return { u0, u };
}

export function supplyPhases(type: SupplyType): PhaseId[] {
  switch (type) {
    case 'monofasico':
      return ['L1'];
    case 'bifasico':
      return ['L1', 'L2'];
    case 'trifasico':
      return ['L1', 'L2', 'L3'];
  }
}

/** Ângulo (graus) da tensão de fase em sequência direta. */
export const PHASE_ANGLE_DEG: Record<PhaseId, number> = { L1: 0, L2: -120, L3: 120 };

/** Número de fases exigidas por tipo de ligação do circuito. */
export function connectionPhaseCount(c: CircuitConnection): number {
  return c === 'F-N' ? 1 : c === 'F-F' ? 2 : 3;
}

export function connectionHasNeutral(c: CircuitConnection): boolean {
  return c === 'F-N' || c === '3F-N';
}

/** Tensão nominal aplicada à carga do circuito (V). */
export function connectionVoltage(c: CircuitConnection, sv: SystemVoltages): number {
  return c === 'F-N' ? sv.u0 : sv.u;
}

/**
 * Número de condutores carregados considerado na capacidade de condução.
 * F-N e F-F: 2. Trifásico equilibrado (com ou sem neutro): 3 — o neutro de um
 * circuito trifásico equilibrado sem harmônicas relevantes não é contado.
 */
export function loadedConductors(c: CircuitConnection): 2 | 3 {
  return c === 'F-N' || c === 'F-F' ? 2 : 3;
}

/** Verifica se o tipo de alimentação comporta a ligação do circuito. */
export function supplySupportsConnection(supply: Supply, c: CircuitConnection): boolean {
  const n = supplyPhases(supply.type).length;
  return connectionPhaseCount(c) <= n;
}

export const CONNECTION_LABEL: Record<CircuitConnection, string> = {
  'F-N': 'Fase-neutro (monofásico)',
  'F-F': 'Fase-fase (bifásico, sem neutro)',
  '3F': 'Trifásico (3F)',
  '3F-N': 'Trifásico com neutro (3F+N)',
};

/** Terminais de saída de cada tipo de circuito. */
export function circuitTerminalIds(c: CircuitConnection): string[] {
  switch (c) {
    case 'F-N':
      return ['L1', 'N', 'PE'];
    case 'F-F':
      return ['L1', 'L2', 'PE'];
    case '3F':
      return ['L1', 'L2', 'L3', 'PE'];
    case '3F-N':
      return ['L1', 'L2', 'L3', 'N', 'PE'];
  }
}
