import { describe, expect, it } from 'vitest';
import { buildResidenceExample } from '../persistence/examples';
import { analyzeTopology } from '../electrical/simulation/topology';
import { readSimulation, settleSimulation, stepThermal, thermalTripTimeS } from '../electrical/simulation/engine';
import { clampCircuit, measureResistance, measureVoltage, peContinuity, rcdTest } from '../electrical/simulation/instruments';
import { loadNode } from '../electrical/simulation/solver';
import type { Fault, Project } from '../model/schema';

function energized(p: Project, faults: Fault[] = []): Project {
  return { ...p, simulation: { ...p.simulation, energized: true, faults } };
}
const byNum = (p: Project, n: number) => p.circuits.find((c) => c.number === n)!;
const dev = (p: Project, label: string) => p.devices.find((d) => d.label === label)!;

describe('modelo térmico didático (pontos convencionais)', () => {
  it('1,13·In não dispara; 1,45·In dispara em < 1 h; 2,55·In entre 1 s e 60 s', () => {
    expect(thermalTripTimeS(1.13)).toBeNull();
    const t145 = thermalTripTimeS(1.45)!;
    expect(t145).toBeGreaterThan(0);
    expect(t145).toBeLessThan(3600);
    const t255 = thermalTripTimeS(2.55)!;
    expect(t255).toBeGreaterThan(1);
    expect(t255).toBeLessThan(60);
  });
});

describe('energização, abertura e fechamento', () => {
  it('desenergizado: nenhum circuito alimentado', () => {
    const p = buildResidenceExample();
    const snap = readSimulation(p);
    for (const c of p.circuits) expect(snap.circuits.get(c.id)!.energized).toBe(false);
  });

  it('energizado: tensões e correntes coerentes com as cargas', () => {
    const p = energized(buildResidenceExample());
    const snap = readSimulation(p, analyzeTopology(p));
    const c1 = snap.circuits.get(byNum(p, 1).id)!;
    expect(c1.energized).toBe(true);
    expect(c1.voltageV).toBeGreaterThan(125);
    expect(c1.voltageV).toBeLessThan(127.01);
    // carga de impedância constante: I ≈ S/U0 = 130,4/127 ≈ 1,03 A
    expect(c1.currentA).toBeCloseTo(1.027, 1);
    const c4 = snap.circuits.get(byNum(p, 4).id)!;
    expect(c4.voltageV).toBeGreaterThan(210);
    expect(c4.currentA).toBeGreaterThan(23.5);
    expect(c4.currentA).toBeLessThan(25.01);
  });

  it('abrir o disjuntor desenergiza apenas o seu circuito', () => {
    const p = energized(buildResidenceExample());
    dev(p, 'Q1').state = 'off';
    const snap = readSimulation(p);
    expect(snap.circuits.get(byNum(p, 1).id)!.energized).toBe(false);
    expect(snap.circuits.get(byNum(p, 2).id)!.energized).toBe(true);
    dev(p, 'Q1').state = 'on';
    expect(readSimulation(p).circuits.get(byNum(p, 1).id)!.energized).toBe(true);
  });

  it('multímetro: tensão na carga e bloqueio de ohmímetro energizado', () => {
    const p = energized(buildResidenceExample());
    const c1 = byNum(p, 1);
    const snap = readSimulation(p);
    const v = measureVoltage(snap, loadNode(c1.id, 'L1'), loadNode(c1.id, 'N'));
    expect(v.volts).toBeGreaterThan(125);
    expect(measureResistance(p, loadNode(c1.id, 'L1'), loadNode(c1.id, 'N')).blocked).toBe(true);
  });

  it('continuidade do PE: contínuo no exemplo, aberto no quadro com defeitos', () => {
    const ok = buildResidenceExample();
    const r1 = peContinuity(ok, byNum(ok, 1).id);
    expect(r1.blocked).toBe(false);
    if (!r1.blocked) expect(r1.ohm).toBeLessThan(1);
    const bad = buildResidenceExample({ defects: true });
    const r2 = peContinuity(bad, byNum(bad, 5).id);
    if (!r2.blocked) expect(r2.ohm).toBe(Infinity);
  });
});

describe('atuação didática das proteções', () => {
  it('curto-circuito no C1: atua o disjuntor do circuito (magnético), não o geral', () => {
    const base = buildResidenceExample();
    const c1 = byNum(base, 1);
    const p = energized(base, [{ id: 'f1', kind: 'short-circuit', circuitId: c1.id, between: 'L-N' }]);
    const r = settleSimulation(p, analyzeTopology(p));
    const q1 = r.project.devices.find((d) => d.label === 'Q1')!;
    const dg = r.project.devices.find((d) => d.label === 'DG')!;
    expect(q1.state).toBe('tripped');
    expect(dg.state).toBe('on');
    expect(r.events.some((e) => e.deviceId === q1.id && e.reason === 'magnetico')).toBe(true);
  });

  it('fuga de 63,5 mA (2 kΩ) no C3 dispara o DR; os circuitos fora do DR continuam', () => {
    const base = buildResidenceExample();
    const c3 = byNum(base, 3);
    const p = energized(base, [{ id: 'f1', kind: 'leakage', circuitId: c3.id, resistanceOhm: 2000 }]);
    const r = settleSimulation(p, analyzeTopology(p));
    expect(r.project.devices.find((d) => d.label === 'DR1')!.state).toBe('tripped');
    expect(r.snapshot.circuits.get(c3.id)!.energized).toBe(false);
    expect(r.snapshot.circuits.get(byNum(p, 1).id)!.energized).toBe(true);
  });

  it('fuga de 12,7 mA (10 kΩ) não dispara o DR de 30 mA; alicate em fase+neutro mede a fuga', () => {
    const base = buildResidenceExample();
    const c3 = byNum(base, 3);
    const p = energized(base, [{ id: 'f1', kind: 'leakage', circuitId: c3.id, resistanceOhm: 10000 }]);
    const r = settleSimulation(p, analyzeTopology(p));
    expect(r.project.devices.find((d) => d.label === 'DR1')!.state).toBe('on');
    const leak = clampCircuit(p, r.snapshot, c3.id, 'vivos').amps;
    expect(leak).toBeGreaterThan(0.011);
    expect(leak).toBeLessThan(0.0135);
    expect(clampCircuit(p, r.snapshot, c3.id, 'fase').amps).toBeGreaterThan(14);
  });

  it('neutro fora do DR (quadro com defeitos): o DR dispara ao energizar', () => {
    const p = energized(buildResidenceExample({ defects: true }));
    const r = settleSimulation(p, analyzeTopology(p));
    const ev = r.events.find((e) => e.label === 'DR1');
    expect(ev?.reason).toBe('diferencial');
  });

  it('PE interrompido + fuga: massa energizada; toque de pessoa dispara o DR', () => {
    const base = buildResidenceExample();
    const c5 = byNum(base, 5);
    const p = energized(base, [
      { id: 'f1', kind: 'pe-open', circuitId: c5.id },
      { id: 'f2', kind: 'leakage', circuitId: c5.id, resistanceOhm: 500 },
    ]);
    const topo = analyzeTopology(p);
    const r = settleSimulation(p, topo);
    expect(r.project.devices.find((d) => d.label === 'DR1')!.state).toBe('on');
    expect(r.snapshot.circuits.get(c5.id)!.touchVoltageV).toBeGreaterThan(100);
    const touch = energized(base, [...p.simulation.faults, { id: 'f3', kind: 'touch', circuitId: c5.id, bodyResistanceOhm: 1000 }]);
    const r2 = settleSimulation(touch, analyzeTopology(touch));
    expect(r2.project.devices.find((d) => d.label === 'DR1')!.state).toBe('tripped');
  });

  it('sobrecarga: disparo térmico após tempo coerente com o modelo', () => {
    const base = buildResidenceExample();
    const c2 = byNum(base, 2);
    // carga de impedância constante: com a queda no cabo, fator 4 resulta em ≈ 1,6·In
    const p = energized(base, [{ id: 'f1', kind: 'overload', circuitId: c2.id, factor: 4 }]);
    const topo = analyzeTopology(p);
    const settled = settleSimulation(p, topo);
    const q2 = settled.project.devices.find((d) => d.label === 'Q2')!;
    expect(q2.state).toBe('on');
    const i = settled.snapshot.devices.get(q2.id)!.maxCurrentA;
    expect(i / 16).toBeGreaterThan(1.45);
    let thermal: Record<string, number> = {};
    let t = 0;
    let tripped = false;
    while (t < 3600 && !tripped) {
      const s = stepThermal(settled.project, settled.snapshot, thermal, 1);
      thermal = s.thermal;
      t += 1;
      tripped = s.trips.some((x) => x.deviceId === q2.id);
    }
    expect(tripped).toBe(true);
    const expected = thermalTripTimeS(i / 16)!;
    expect(Math.abs(t - expected)).toBeLessThanOrEqual(2);
  });

  it('testador de DR: atua em 1×IΔn e não atua em 0,5×IΔn', () => {
    const p = energized(buildResidenceExample());
    const topo = analyzeTopology(p);
    const snap = readSimulation(p, topo);
    const c3 = byNum(p, 3);
    const a = rcdTest(p, snap, topo, c3.id, 1);
    expect(a.ok && a.tripped).toBe(true);
    expect(a.maxTimeMs).toBe(300);
    const b = rcdTest(p, snap, topo, c3.id, 0.5);
    expect(b.ok && !b.tripped).toBe(true);
    const c1 = rcdTest(p, snap, topo, byNum(p, 1).id, 1);
    expect(c1.ok).toBe(false);
  });
});
