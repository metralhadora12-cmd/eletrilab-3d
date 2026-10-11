/**
 * Estimativa simplificada de correntes de curto-circuito.
 *
 * Hipóteses (didáticas, explicitadas no resultado):
 *  - A impedância da fonte é puramente resistiva e obtida da corrente presumida
 *    fase-neutro na origem do quadro: Zloop,origem = U0 / Icc,origem,
 *    repartida igualmente entre o condutor de fase e o de retorno.
 *  - Curto mínimo no fim do circuito: fase-neutro (circuitos com neutro) ou
 *    fase-fase (circuitos sem neutro), com os condutores na temperatura máxima
 *    de serviço. Reatâncias desprezadas.
 */
import type { CircuitConnection, ConductorMaterial, Insulation } from '../../model/schema';
import type { SystemVoltages } from '../core/systems';
import { conductorResistance } from './conductor';
import { type CalcResult, inconclusive, invalid, ok } from './result';

export interface ShortCircuitEstimate {
  iccOriginA: number;
  iccEndMinA: number;
  sourcePerConductorOhm: number;
  lineLoopOhm: number;
  faultType: 'F-N' | 'F-F';
}

export function estimateShortCircuit(params: {
  voltages: SystemVoltages;
  connection: CircuitConnection;
  prospectiveOriginKA: number | null;
  lengthM: number | null;
  sectionMm2: number;
  material: ConductorMaterial;
  insulation: Insulation;
}): CalcResult<ShortCircuitEstimate> {
  const missing: string[] = [];
  if (params.prospectiveOriginKA === null) missing.push('corrente de curto-circuito presumida na origem');
  if (params.lengthM === null) missing.push('comprimento do circuito');
  if (missing.length) return inconclusive('Estimativa de curto-circuito requer dados da alimentação e do circuito', missing);
  if (!(params.prospectiveOriginKA! > 0) || !(params.lengthM! > 0)) return invalid('valores devem ser positivos');

  const iccOriginA = params.prospectiveOriginKA! * 1000;
  const zc = params.voltages.u0 / iccOriginA / 2;
  const r = conductorResistance({ sectionMm2: params.sectionMm2, material: params.material, insulation: params.insulation });
  const lineLoop = 2 * r.ohmPerM * params.lengthM!;
  const withNeutral = params.connection === 'F-N' || params.connection === '3F-N';
  const uf = withNeutral ? params.voltages.u0 : params.voltages.u;
  const iccEndMinA = uf / (2 * zc + lineLoop);
  return ok(
    {
      iccOriginA,
      iccEndMinA,
      sourcePerConductorOhm: zc,
      lineLoopOhm: lineLoop,
      faultType: withNeutral ? 'F-N' : 'F-F',
    },
    [
      'Impedância da fonte resistiva, derivada da Icc presumida fase-neutro na origem',
      `Condutores a ${r.temperatureC} °C; reatâncias desprezadas`,
      'Estimativa didática — não substitui cálculo de curto-circuito conforme norma',
    ],
  );
}
