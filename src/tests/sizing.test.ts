/**
 * Dimensionamento com diferentes condições de instalação.
 * Memória de cálculo (chuveiro 5500 W, F-F 220 V → Ib = 25 A; cobre/PVC; B1; 2 condutores carregados):
 *   30 °C, 1 circuito : Iz(2,5) = 24 < 25 ✗ ; Iz(4) = 32 ✓ → 4 mm², In = 25 A
 *   30 °C, 3 circuitos: Iz(4) = 22,4 ✗ ; Iz(6) = 28,7 ✓ → 6 mm²
 *   40 °C, 3 circuitos: kθ = 0,866 → Iz(6) = 24,85 ✗ ; Iz(10) = 34,55 ✓ → 10 mm²
 *   30 °C, 1 circuito, 60 m: ΔU(4) = 8,08 % ✗ ; ΔU(6) = 5,38 % ✗ ; ΔU(10) = 3,12 % ✓ → 10 mm²
 */
import { describe, expect, it } from 'vitest';
import { sizeCircuit } from '../electrical/calculations/conductorSizing';
import { createCircuit, createEmptyProject } from '../model/factory';
import type { Circuit } from '../model/schema';

const project = createEmptyProject('t', { supply: { ...createEmptyProject('x').supply, prospectiveShortCircuitKA: 3 } });

function shower(o: Partial<Circuit>): Circuit {
  return createCircuit(project, 'chuveiro', {
    connection: 'F-F',
    lengthM: 10,
    method: 'B1',
    ambientTempC: 30,
    groupedCircuits: 1,
    ...o,
  });
}

describe('dimensionamento de condutores', () => {
  it('condição de referência → 4 mm² e In 25 A', () => {
    const r = sizeCircuit({ circuit: shower({}), supply: project.supply, protection: null });
    expect(r.designCurrentA).toBeCloseTo(25, 9);
    expect(r.sizingStatus).toBe('ok');
    expect(r.minSectionMm2).toBe(4);
    expect(r.recommendedInA).toBe(25);
    const s25 = r.evaluations.find((e) => e.sectionMm2 === 2.5)!;
    expect(s25.accepted).toBe(false);
    expect(s25.criteria.find((c) => c.id === 'capacidade')?.status).toBe('falha');
  });

  it('agrupamento de 3 circuitos → 6 mm²', () => {
    const r = sizeCircuit({ circuit: shower({ groupedCircuits: 3 }), supply: project.supply, protection: null });
    expect(r.minSectionMm2).toBe(6);
  });

  it('40 °C com agrupamento → 10 mm²', () => {
    const r = sizeCircuit({ circuit: shower({ groupedCircuits: 3, ambientTempC: 40 }), supply: project.supply, protection: null });
    expect(r.minSectionMm2).toBe(10);
    const s6 = r.evaluations.find((e) => e.sectionMm2 === 6)!;
    expect(s6.izA).toBeCloseTo(41 * Math.sqrt(30 / 40) * 0.7, 6);
    expect(s6.accepted).toBe(false);
  });

  it('percurso longo: a queda de tensão determina a seção', () => {
    const r = sizeCircuit({ circuit: shower({ lengthM: 60 }), supply: project.supply, protection: null });
    expect(r.minSectionMm2).toBe(10);
    const s4 = r.evaluations.find((e) => e.sectionMm2 === 4)!;
    expect(s4.criteria.find((c) => c.id === 'capacidade')?.status).toBe('ok');
    expect(s4.criteria.find((c) => c.id === 'queda-tensao')?.status).toBe('falha');
    expect(s4.dropPct).toBeCloseTo(8.077, 2);
  });

  it('dispositivo existente maior que Iz força seção maior', () => {
    // Com disjuntor de 32 A instalado: Iz ≥ 32 → 4 mm² (Iz 32) atende; 2,5 não
    const r = sizeCircuit({
      circuit: shower({}),
      supply: project.supply,
      protection: { deviceId: 'x', label: 'Q', ratedCurrentA: 32, curve: 'C', breakingCapacityKA: 6 },
    });
    expect(r.minSectionMm2).toBe(4);
    const r2 = sizeCircuit({
      circuit: shower({}),
      supply: project.supply,
      protection: { deviceId: 'x', label: 'Q', ratedCurrentA: 40, curve: 'C', breakingCapacityKA: 6 },
    });
    expect(r2.minSectionMm2).toBe(6);
  });

  it('sem condições de instalação → inconclusivo com a mensagem exigida', () => {
    const r = sizeCircuit({ circuit: shower({ method: null, ambientTempC: null }), supply: project.supply, protection: null });
    expect(r.sizingStatus).toBe('inconclusivo');
    expect(r.minSectionMm2).toBeNull();
    expect(r.summary).toContain('Dimensionamento inconclusivo: informe as condições de instalação');
  });

  it('seção mínima por tipo de circuito', () => {
    const light = createCircuit(project, 'iluminacao', { lengthM: 10, method: 'B1', ambientTempC: 30, groupedCircuits: 1 });
    expect(sizeCircuit({ circuit: light, supply: project.supply, protection: null }).minSectionMm2).toBe(1.5);
    const tug = createCircuit(project, 'tug', { lengthM: 10, method: 'B1', ambientTempC: 30, groupedCircuits: 1 });
    expect(sizeCircuit({ circuit: tug, supply: project.supply, protection: null }).minSectionMm2).toBe(2.5);
  });

  it('seção escolhida reprovada informa o motivo', () => {
    const r = sizeCircuit({
      circuit: shower({ sectionMm2: 2.5 }),
      supply: project.supply,
      protection: { deviceId: 'x', label: 'Q', ratedCurrentA: 25, curve: 'C', breakingCapacityKA: 4.5 },
    });
    expect(r.chosenStatus).toBe('falha');
    const cap = r.chosen!.criteria.find((c) => c.id === 'capacidade')!;
    expect(cap.status).toBe('falha');
    expect(cap.detail).toContain('Ib');
  });

  it('dispositivo com curva e Icn desconhecidas → verificações de curto inconclusivas', () => {
    const r = sizeCircuit({
      circuit: shower({ sectionMm2: 4 }),
      supply: project.supply,
      protection: { deviceId: 'x', label: 'Q', ratedCurrentA: 25, curve: null, breakingCapacityKA: null },
    });
    const sc = r.chosen!.criteria.find((c) => c.id === 'curto-circuito')!;
    const bc = r.chosen!.criteria.find((c) => c.id === 'capacidade-interrupcao')!;
    expect(sc.status).toBe('inconclusivo');
    expect(bc.status).toBe('inconclusivo');
    expect(r.chosenStatus).toBe('inconclusivo');
  });

  it('ligação incompatível com a alimentação', () => {
    const mono = { ...project.supply, type: 'monofasico' as const };
    const r = sizeCircuit({ circuit: shower({}), supply: mono, protection: null });
    expect(r.sizingStatus).toBe('reprovado');
  });
});
