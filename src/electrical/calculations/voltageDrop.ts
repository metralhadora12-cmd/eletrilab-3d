/**
 * Queda de tensão em regime permanente.
 *
 *   ΔU = b · Ib · L · (R·cos φ + X·sin φ)
 *     b = 2   para circuitos de dois condutores (F-N e F-F)
 *     b = √3  para circuitos trifásicos equilibrados (queda fase-fase)
 *   ΔU% = 100 · ΔU / Uref   (Uref = U0 para F-N; U para F-F e trifásico)
 *
 * Forma consistente com o Anexo G (informativo) da IEC 60364-5-52.
 * R é tomada na temperatura máxima de serviço da isolação (hipótese conservadora).
 */
import type { CircuitConnection, ConductorMaterial, Insulation } from '../../model/schema';
import type { SystemVoltages } from '../core/systems';
import { DEFAULT_REACTANCE_OHM_PER_M } from '../core/constants';
import { conductorResistance } from './conductor';
import { type CalcResult, inconclusive, invalid, ok } from './result';

export interface VoltageDropInput {
  currentA: number;
  lengthM: number | null;
  sectionMm2: number;
  material: ConductorMaterial;
  insulation: Insulation;
  powerFactor: number;
  connection: CircuitConnection;
  voltages: SystemVoltages;
  conductorTempC?: number;
  reactanceOhmPerM?: number;
  limitPct?: number;
}

export interface VoltageDropResult {
  volts: number;
  percent: number;
  referenceVoltageV: number;
  rOhmPerM: number;
  xOhmPerM: number;
  b: number;
  formula: string;
  limitPct: number | null;
  pass: boolean | null;
}

export function voltageDrop(input: VoltageDropInput): CalcResult<VoltageDropResult> {
  if (input.lengthM === null) return inconclusive('Comprimento do circuito não informado', ['comprimento']);
  const errors: string[] = [];
  if (!(input.currentA >= 0)) errors.push('corrente deve ser ≥ 0');
  if (!(input.lengthM > 0)) errors.push('comprimento deve ser positivo');
  if (!(input.sectionMm2 > 0)) errors.push('seção deve ser positiva');
  if (!(input.powerFactor > 0 && input.powerFactor <= 1)) errors.push('fator de potência em (0; 1]');
  if (errors.length) return invalid(...errors);

  const r = conductorResistance({
    sectionMm2: input.sectionMm2,
    material: input.material,
    insulation: input.insulation,
    temperatureC: input.conductorTempC,
  });
  const x = input.reactanceOhmPerM ?? DEFAULT_REACTANCE_OHM_PER_M;
  const cos = input.powerFactor;
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const threePhase = input.connection === '3F' || input.connection === '3F-N';
  const b = threePhase ? Math.sqrt(3) : 2;
  const ref = input.connection === 'F-N' ? input.voltages.u0 : input.voltages.u;
  const volts = b * input.currentA * input.lengthM * (r.ohmPerM * cos + x * sin);
  const percent = (100 * volts) / ref;
  const limitPct = input.limitPct ?? null;
  return ok(
    {
      volts,
      percent,
      referenceVoltageV: ref,
      rOhmPerM: r.ohmPerM,
      xOhmPerM: x,
      b,
      formula: threePhase
        ? 'ΔU = √3 · Ib · L · (R·cos φ + X·sen φ);  ΔU% = 100·ΔU/U'
        : `ΔU = 2 · Ib · L · (R·cos φ + X·sen φ);  ΔU% = 100·ΔU/${input.connection === 'F-N' ? 'U0' : 'U'}`,
      limitPct,
      pass: limitPct === null ? null : percent <= limitPct,
    },
    [r.note, `X = ${(x * 1000).toFixed(2)} mΩ/m (valor típico, IEC 60364-5-52 Anexo G)`],
  );
}
