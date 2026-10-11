/**
 * Valores de referência calculados manualmente (memória de cálculo nos comentários),
 * independentes da implementação.
 */
import { describe, expect, it } from 'vitest';
import { aggregateLoads, designCurrent, activePowerW, dissipatedPowerW } from '../electrical/calculations/power';
import { voltageDrop } from '../electrical/calculations/voltageDrop';
import { conductorResistance } from '../electrical/calculations/conductor';
import {
  conductorAmpacity,
  groupingCorrectionFactor,
  temperatureCorrectionFactor,
} from '../electrical/calculations/ampacity';
import {
  adiabaticWithstandTimeS,
  checkBreakingCapacity,
  checkOverloadCoordination,
  instantaneousTripRangeA,
  protectiveConductorMinSection,
  rcdMaxBreakTimeS,
  selectRatedCurrent,
} from '../electrical/calculations/protection';
import { estimateShortCircuit } from '../electrical/calculations/shortCircuit';
import { systemVoltages } from '../electrical/core/systems';

const V127 = systemVoltages('127/220');
const V220 = systemVoltages('220/380');

describe('potência e corrente de projeto', () => {
  it('F-N: 1270 W, cos φ = 1, 127 V → 10 A', () => {
    const r = designCurrent({ activeW: 1270, powerFactor: 1, connection: 'F-N', voltages: V127 });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.value.currentA).toBeCloseTo(10, 9);
  });

  it('F-F: chuveiro 5500 W em 220 V → 25 A', () => {
    const r = designCurrent({ activeW: 5500, powerFactor: 1, connection: 'F-F', voltages: V127 });
    if (r.status !== 'ok') throw new Error('esperado ok');
    expect(r.value.currentA).toBeCloseTo(25, 9);
    expect(r.value.voltageV).toBe(220);
  });

  it('trifásico: 10 kW, cos φ = 0,85, 380 V → 17,875 A', () => {
    // 10000 / (√3 · 380 · 0,85) = 10000 / 559,452 = 17,8746 A
    const r = designCurrent({ activeW: 10000, powerFactor: 0.85, connection: '3F', voltages: V220 });
    if (r.status !== 'ok') throw new Error('esperado ok');
    expect(r.value.currentA).toBeCloseTo(17.8746, 3);
  });

  it('motor: potência útil / rendimento entra na potência absorvida', () => {
    // Pútil 1000 W, η 0,8 → Pabs 1250 W; cos φ 0,8 → S = 1562,5 VA; 220 V → 7,102 A
    const agg = aggregateLoads([{ powerW: 1000, powerFactor: 0.8, efficiency: 0.8, quantity: 1 }]);
    if (agg.status !== 'ok') throw new Error('esperado ok');
    expect(agg.value.activeW).toBeCloseTo(1250, 9);
    expect(agg.value.apparentVA).toBeCloseTo(1562.5, 6);
    const r = designCurrent({ activeW: agg.value.activeW, powerFactor: agg.value.powerFactor, connection: 'F-N', voltages: V220 });
    if (r.status !== 'ok') throw new Error('esperado ok');
    expect(r.value.currentA).toBeCloseTo(7.1023, 3);
  });

  it('soma vetorial de cargas com fatores de potência diferentes', () => {
    // 1000 W (cos 1) + 1000 W (cos 0,8): Q = 750 var; S = √(2000² + 750²) = 2135,99 VA; cos = 0,9363
    const agg = aggregateLoads([
      { powerW: 1000, powerFactor: 1, efficiency: 1, quantity: 1 },
      { powerW: 1000, powerFactor: 0.8, efficiency: 1, quantity: 1 },
    ]);
    if (agg.status !== 'ok') throw new Error('esperado ok');
    expect(agg.value.reactiveVar).toBeCloseTo(750, 6);
    expect(agg.value.apparentVA).toBeCloseTo(2135.99, 1);
    expect(agg.value.powerFactor).toBeCloseTo(0.9363, 4);
  });

  it('inverso P = U·I·cos φ e potência dissipada I²R', () => {
    expect(activePowerW('F-N', V127, 10, 1)).toBeCloseTo(1270, 9);
    expect(dissipatedPowerW(10, 0.5)).toBe(50);
  });

  it('entradas inválidas e ausentes são sinalizadas', () => {
    expect(aggregateLoads([]).status).toBe('inconclusivo');
    expect(aggregateLoads([{ powerW: -5, powerFactor: 1, efficiency: 1, quantity: 1 }]).status).toBe('invalido');
    expect(aggregateLoads([{ powerW: 100, powerFactor: 1.2, efficiency: 1, quantity: 1 }]).status).toBe('invalido');
    expect(designCurrent({ activeW: 100, powerFactor: 0, connection: 'F-N', voltages: V127 }).status).toBe('invalido');
  });
});

describe('resistência de condutores', () => {
  it('usa R20 da IEC 60228 (classe 5) e corrige para a temperatura', () => {
    // 2,5 mm²: 7,98 Ω/km a 20 °C; a 70 °C: 7,98 · (1 + 0,00393·50) = 9,5481 Ω/km
    const r = conductorResistance({ sectionMm2: 2.5, material: 'cobre', insulation: 'PVC' });
    expect(r.basis).toBe('catalogo-iec60228');
    expect(r.ohmPerM * 1000).toBeCloseTo(9.5481, 3);
  });
  it('estima pela resistividade quando a seção não está no catálogo', () => {
    const r = conductorResistance({ sectionMm2: 50, material: 'cobre', insulation: 'PVC', temperatureC: 20 });
    expect(r.basis).toBe('resistividade-nominal');
    expect(r.ohmPerM).toBeCloseTo(0.017241 / 50, 9);
  });
});

describe('queda de tensão', () => {
  it('monofásico F-N 127 V, 1000 W, 20 m, 2,5 mm² PVC', () => {
    // I = 7,87402 A; R70 = 9,54807 mΩ/m; ΔU = 2·7,87402·20·0,00954807 = 3,0073 V → 2,368 %
    const r = voltageDrop({
      currentA: 1000 / 127,
      lengthM: 20,
      sectionMm2: 2.5,
      material: 'cobre',
      insulation: 'PVC',
      powerFactor: 1,
      connection: 'F-N',
      voltages: V127,
      limitPct: 4,
    });
    if (r.status !== 'ok') throw new Error('esperado ok');
    expect(r.value.volts).toBeCloseTo(3.0073, 3);
    expect(r.value.percent).toBeCloseTo(2.3679, 3);
    expect(r.value.pass).toBe(true);
  });

  it('trifásico com reatância: 17,875 A, 50 m, 6 mm², cos φ 0,85, 380 V', () => {
    // R70 = 3,30·1,1965 = 3,94845 mΩ/m; X = 0,08 mΩ/m; sen φ = 0,526783
    // ΔU = √3·17,8746·50·(0,00394845·0,85 + 0,00008·0,526783) = 5,2606 V → 1,3844 %
    const r = voltageDrop({
      currentA: 17.8746,
      lengthM: 50,
      sectionMm2: 6,
      material: 'cobre',
      insulation: 'PVC',
      powerFactor: 0.85,
      connection: '3F',
      voltages: V220,
    });
    if (r.status !== 'ok') throw new Error('esperado ok');
    expect(r.value.volts).toBeCloseTo(5.2606, 2);
    expect(r.value.percent).toBeCloseTo(1.3844, 2);
    expect(r.value.pass).toBeNull();
  });

  it('é inconclusiva sem comprimento e inválida com valores fora de faixa', () => {
    const base = {
      currentA: 10,
      sectionMm2: 2.5,
      material: 'cobre' as const,
      insulation: 'PVC' as const,
      powerFactor: 1,
      connection: 'F-N' as const,
      voltages: V127,
    };
    expect(voltageDrop({ ...base, lengthM: null }).status).toBe('inconclusivo');
    expect(voltageDrop({ ...base, lengthM: -3 }).status).toBe('invalido');
  });
});

describe('capacidade de condução e fatores de correção', () => {
  it('fator de temperatura reproduz os valores tabelados (2 casas)', () => {
    const cases: Array<[number, 'PVC' | 'XLPE', number]> = [
      [25, 'PVC', 1.06],
      [35, 'PVC', 0.94],
      [40, 'PVC', 0.87],
      [45, 'PVC', 0.79],
      [50, 'PVC', 0.71],
      [20, 'XLPE', 1.08],
      [40, 'XLPE', 0.91],
      [50, 'XLPE', 0.82],
    ];
    for (const [t, ins, expected] of cases) {
      const r = temperatureCorrectionFactor(t, ins);
      if (r.status !== 'ok') throw new Error('esperado ok');
      expect(Math.abs(r.value - expected)).toBeLessThan(0.006);
    }
    expect(temperatureCorrectionFactor(75, 'PVC').status).toBe('invalido');
  });

  it('fator de agrupamento (feixe)', () => {
    const g = (n: number) => {
      const r = groupingCorrectionFactor(n);
      return r.status === 'ok' ? r.value : NaN;
    };
    expect(g(1)).toBe(1);
    expect(g(3)).toBe(0.7);
    expect(g(9)).toBe(0.5);
    expect(groupingCorrectionFactor(0).status).toBe('invalido');
    expect(groupingCorrectionFactor(25).status).toBe('inconclusivo');
  });

  it('Iz depende das condições de instalação', () => {
    const base = { sectionMm2: 2.5, material: 'cobre' as const, insulation: 'PVC' as const, method: 'B1' as const, loadedConductors: 2 as const };
    const a = conductorAmpacity({ ...base, ambientTempC: 30, groupedCircuits: 1 });
    const b = conductorAmpacity({ ...base, ambientTempC: 30, groupedCircuits: 3 });
    const c = conductorAmpacity({ ...base, ambientTempC: 40, groupedCircuits: 3 });
    if (a.status !== 'ok' || b.status !== 'ok' || c.status !== 'ok') throw new Error('esperado ok');
    expect(a.value.izA).toBeCloseTo(24, 9);
    expect(b.value.izA).toBeCloseTo(16.8, 9);
    expect(c.value.izA).toBeCloseTo(24 * Math.sqrt(30 / 40) * 0.7, 9);
  });

  it('sem método/temperatura/agrupamento o resultado é inconclusivo (não presume)', () => {
    const r = conductorAmpacity({
      sectionMm2: 2.5,
      material: 'cobre',
      insulation: 'PVC',
      method: null,
      loadedConductors: 2,
      ambientTempC: null,
      groupedCircuits: 1,
    });
    expect(r.status).toBe('inconclusivo');
    if (r.status === 'inconclusivo') {
      expect(r.message).toBe('Dimensionamento inconclusivo: informe as condições de instalação');
      expect(r.missing).toEqual(['método de instalação', 'temperatura ambiente']);
    }
  });

  it('métodos fora do conjunto de dados não são inventados', () => {
    const r = conductorAmpacity({
      sectionMm2: 2.5,
      material: 'aluminio',
      insulation: 'PVC',
      method: 'B1',
      loadedConductors: 2,
      ambientTempC: 30,
      groupedCircuits: 1,
    });
    expect(r.status).toBe('inconclusivo');
  });
});

describe('proteção', () => {
  it('coordenação Ib ≤ In ≤ Iz e I2 ≤ 1,45 Iz', () => {
    expect(checkOverloadCoordination({ ibA: 15.75, inA: 16, izA: 16.8 }).ok).toBe(true);
    const fail = checkOverloadCoordination({ ibA: 15.75, inA: 20, izA: 16.8 });
    expect(fail.ok).toBe(false);
    expect(fail.conditions.find((c) => c.id === 'in-iz')?.ok).toBe(false);
    expect(checkOverloadCoordination({ ibA: 18, inA: 16, izA: 24 }).conditions.find((c) => c.id === 'ib-in')?.ok).toBe(false);
  });

  it('corrente nominal do disjuntor isoladamente não garante proteção', () => {
    // In = 20 A < Iz não basta se Ib > In
    expect(checkOverloadCoordination({ ibA: 22, inA: 20, izA: 24 }).ok).toBe(false);
  });

  it('seleção de In padronizada', () => {
    expect(selectRatedCurrent(25, 28.7)).toBe(25);
    expect(selectRatedCurrent(25, 24)).toBeNull();
    expect(selectRatedCurrent(7)).toBe(10);
  });

  it('faixas instantâneas das curvas B, C e D', () => {
    expect(instantaneousTripRangeA('B', 16)).toEqual([48, 80]);
    expect(instantaneousTripRangeA('C', 16)).toEqual([80, 160]);
    expect(instantaneousTripRangeA('D', 16)).toEqual([160, 320]);
  });

  it('suportabilidade adiabática (k·S/I)²', () => {
    // k = 115, S = 2,5, I = 1000 A → (287,5/1000)² = 0,08266 s
    expect(adiabaticWithstandTimeS(115, 2.5, 1000)).toBeCloseTo(0.0826563, 6);
  });

  it('capacidade de interrupção: falha, sucesso e inconclusivo', () => {
    const a = checkBreakingCapacity(4.5, 6);
    expect(a.status === 'ok' && a.value.ok).toBe(false);
    const b = checkBreakingCapacity(6, 3);
    expect(b.status === 'ok' && b.value.ok).toBe(true);
    expect(checkBreakingCapacity(null, 3).status).toBe('inconclusivo');
  });

  it('seção mínima do PE', () => {
    expect(protectiveConductorMinSection(6)).toBe(6);
    expect(protectiveConductorMinSection(25)).toBe(16);
    expect(protectiveConductorMinSection(70)).toBe(35);
  });

  it('tempos máximos do DR (norma de produto)', () => {
    expect(rcdMaxBreakTimeS(0.5)).toBeNull();
    expect(rcdMaxBreakTimeS(1)).toBe(0.3);
    expect(rcdMaxBreakTimeS(2)).toBe(0.15);
    expect(rcdMaxBreakTimeS(5)).toBe(0.04);
  });
});

describe('estimativa de curto-circuito', () => {
  it('Icc mínima no fim do circuito F-N', () => {
    // Zc = 127/3000/2 = 0,021167 Ω; R70(2,5) = 9,54807 mΩ/m; laço = 2·0,00954807·20 = 0,381923 Ω
    // Icc = 127 / (0,042333 + 0,381923) = 299,35 A
    const r = estimateShortCircuit({
      voltages: V127,
      connection: 'F-N',
      prospectiveOriginKA: 3,
      lengthM: 20,
      sectionMm2: 2.5,
      material: 'cobre',
      insulation: 'PVC',
    });
    if (r.status !== 'ok') throw new Error('esperado ok');
    expect(r.value.iccEndMinA).toBeCloseTo(299.35, 0);
  });
  it('sem Icc presumida é inconclusiva', () => {
    const r = estimateShortCircuit({
      voltages: V127,
      connection: 'F-N',
      prospectiveOriginKA: null,
      lengthM: 20,
      sectionMm2: 2.5,
      material: 'cobre',
      insulation: 'PVC',
    });
    expect(r.status).toBe('inconclusivo');
  });
});
