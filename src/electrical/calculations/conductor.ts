/** Resistência de condutores. */
import type { ConductorMaterial, Insulation } from '../../model/schema';
import { findConductor, insulationMaxTemp } from '../../catalog/conductors';
import { ALPHA_20C, RESISTIVITY_20C } from '../core/constants';

export interface ConductorResistance {
  ohmPerM: number;
  temperatureC: number;
  basis: 'catalogo-iec60228' | 'resistividade-nominal';
  note: string;
}

/**
 * Resistência por metro na temperatura indicada.
 * Usa a resistência máxima a 20 °C do catálogo (IEC 60228) quando conhecida;
 * caso contrário, estima por ρ20/S e informa a base usada.
 * Correção: R(θ) = R20 · [1 + α20 · (θ − 20)].
 */
export function conductorResistance(params: {
  sectionMm2: number;
  material: ConductorMaterial;
  insulation: Insulation;
  temperatureC?: number;
}): ConductorResistance {
  const { sectionMm2, material, insulation } = params;
  if (!(sectionMm2 > 0)) throw new RangeError('seção deve ser positiva');
  const temperatureC = params.temperatureC ?? insulationMaxTemp(insulation);
  const spec = findConductor(sectionMm2, material, insulation);
  const fromCatalog = spec?.r20OhmPerKm ?? null;
  const r20 = fromCatalog !== null ? fromCatalog / 1000 : RESISTIVITY_20C[material] / sectionMm2;
  const ohmPerM = r20 * (1 + ALPHA_20C[material] * (temperatureC - 20));
  return {
    ohmPerM,
    temperatureC,
    basis: fromCatalog !== null ? 'catalogo-iec60228' : 'resistividade-nominal',
    note:
      fromCatalog !== null
        ? `R20 = ${fromCatalog} Ω/km (IEC 60228, ${spec?.strandingClass}); corrigida para ${temperatureC} °C`
        : `R20 estimada por ρ20/S (ρ20 = ${RESISTIVITY_20C[material]} Ω·mm²/m); corrigida para ${temperatureC} °C`,
  };
}
