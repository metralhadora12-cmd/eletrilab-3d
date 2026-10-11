/**
 * Potência e corrente de projeto.
 *
 * Fórmulas (regime senoidal, cargas equilibradas):
 *  - F-N:  Ib = P / (U0 · cos φ)
 *  - F-F:  Ib = P / (U · cos φ)
 *  - 3F:   Ib = P / (√3 · U · cos φ)
 * P é a potência ativa ABSORVIDA da rede: para motores, P = Pútil / η.
 */
import type { CircuitConnection } from '../../model/schema';
import { type SystemVoltages } from '../core/systems';
import { type CalcResult, inconclusive, invalid, ok } from './result';

export interface LoadPowerInput {
  powerW: number;
  powerFactor: number;
  efficiency: number;
  quantity: number;
}

export interface AggregatedLoad {
  activeW: number;
  reactiveVar: number;
  apparentVA: number;
  powerFactor: number;
}

function validateLoad(l: LoadPowerInput, i: number): string[] {
  const errs: string[] = [];
  if (!(Number.isFinite(l.powerW) && l.powerW > 0)) errs.push(`carga ${i + 1}: potência deve ser positiva (W)`);
  if (!(l.powerFactor > 0 && l.powerFactor <= 1)) errs.push(`carga ${i + 1}: fator de potência deve estar em (0; 1]`);
  if (!(l.efficiency > 0 && l.efficiency <= 1)) errs.push(`carga ${i + 1}: rendimento deve estar em (0; 1]`);
  if (!(Number.isInteger(l.quantity) && l.quantity >= 1)) errs.push(`carga ${i + 1}: quantidade deve ser inteira ≥ 1`);
  return errs;
}

/** Potência ativa absorvida por uma carga (W). */
export function inputActivePowerW(l: LoadPowerInput): number {
  return (l.powerW * l.quantity) / l.efficiency;
}

/** Soma vetorial das cargas (P e Q) — fator de potência resultante. */
export function aggregateLoads(loads: LoadPowerInput[]): CalcResult<AggregatedLoad> {
  if (loads.length === 0) return inconclusive('Circuito sem cargas cadastradas', ['cargas']);
  const errors = loads.flatMap(validateLoad);
  if (errors.length) return invalid(...errors);
  let p = 0;
  let q = 0;
  for (const l of loads) {
    const pi = inputActivePowerW(l);
    p += pi;
    q += pi * Math.tan(Math.acos(l.powerFactor));
  }
  const s = Math.hypot(p, q);
  return ok({ activeW: p, reactiveVar: q, apparentVA: s, powerFactor: p / s });
}

export interface DesignCurrent {
  currentA: number;
  voltageV: number;
  apparentVA: number;
  formula: string;
}

export function designCurrent(params: {
  activeW: number;
  powerFactor: number;
  connection: CircuitConnection;
  voltages: SystemVoltages;
}): CalcResult<DesignCurrent> {
  const { activeW, powerFactor, connection, voltages } = params;
  if (!(activeW > 0)) return invalid('potência ativa deve ser positiva');
  if (!(powerFactor > 0 && powerFactor <= 1)) return invalid('fator de potência deve estar em (0; 1]');
  if (!(voltages.u0 > 0 && voltages.u > 0)) return invalid('tensões do sistema devem ser positivas');
  const apparentVA = activeW / powerFactor;
  switch (connection) {
    case 'F-N':
      return ok({
        currentA: apparentVA / voltages.u0,
        voltageV: voltages.u0,
        apparentVA,
        formula: 'Ib = P / (U0 · cos φ)',
      });
    case 'F-F':
      return ok({
        currentA: apparentVA / voltages.u,
        voltageV: voltages.u,
        apparentVA,
        formula: 'Ib = P / (U · cos φ)',
      });
    case '3F':
    case '3F-N':
      return ok(
        {
          currentA: apparentVA / (Math.sqrt(3) * voltages.u),
          voltageV: voltages.u,
          apparentVA,
          formula: 'Ib = P / (√3 · U · cos φ)',
        },
        ['Carga trifásica equilibrada'],
      );
  }
}

/** Potência ativa a partir de tensão e corrente (inverso de designCurrent). */
export function activePowerW(connection: CircuitConnection, voltages: SystemVoltages, currentA: number, pf: number) {
  if (connection === 'F-N') return voltages.u0 * currentA * pf;
  if (connection === 'F-F') return voltages.u * currentA * pf;
  return Math.sqrt(3) * voltages.u * currentA * pf;
}

/** Potência dissipada em uma resistência (W). */
export const dissipatedPowerW = (currentA: number, resistanceOhm: number) => currentA * currentA * resistanceOhm;

/** Lei de Ohm em CC / valor eficaz em carga resistiva. */
export const ohmCurrentA = (voltageV: number, resistanceOhm: number) => voltageV / resistanceOhm;
