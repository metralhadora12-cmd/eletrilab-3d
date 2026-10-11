/** Sincronização entre o modelo da montagem (3D) e o diagrama unifilar. */
import { describe, expect, it } from 'vitest';
import { buildUnifilar } from '../diagrams/unifilar';
import { buildResidenceExample } from '../persistence/examples';
import { boardLayout, computeWireLengths, deviceBox, routeWire, terminalPose } from '../model/geometry';
import { getCatalogItem } from '../catalog';

describe('diagrama unifilar acompanha a montagem', () => {
  it('cada circuito aparece sob o seu disjuntor, e o DR sob o geral', () => {
    const p = buildResidenceExample();
    const d = buildUnifilar(p);
    const byRef = (id: string) => d.nodes.find((n) => n.refId === id);
    const dg = p.devices.find((x) => x.label === 'DG')!;
    const dr = p.devices.find((x) => x.label === 'DR1')!;
    const q3 = p.devices.find((x) => x.label === 'Q3')!;
    expect(byRef(dg.id)!.parent).toBe('supply');
    expect(byRef(dr.id)!.parent).toBe(dg.id);
    expect(byRef(q3.id)!.parent).toBe(dr.id);
    expect(byRef(p.circuits[2].id)!.parent).toBe(q3.id);
    expect(d.unconnected).toEqual([]);
    // DPS das fases ficam a jusante do geral; o DPS do neutro liga-se ao neutro da origem (não seccionado pelo DG)
    expect(byRef(p.devices.find((x) => x.label === 'DPS1')!.id)!.parent).toBe(dg.id);
    expect(byRef(p.devices.find((x) => x.label === 'DPS2')!.id)!.parent).toBe(dg.id);
    expect(byRef(p.devices.find((x) => x.label === 'DPS3')!.id)!.parent).toBe('supply');
  });

  it('remover um condutor no quadro desconecta o circuito no diagrama', () => {
    const p = buildResidenceExample();
    const c1 = p.circuits[0];
    p.wires = p.wires.filter((w) => !(w.to.owner === `circ:${c1.id}` && w.to.terminal === 'L1'));
    const d = buildUnifilar(p);
    expect(d.unconnected.some((n) => n.refId === c1.id)).toBe(true);
  });

  it('alterar o disjuntor no modelo altera os dados exibidos no diagrama', () => {
    const p = buildResidenceExample();
    const q1 = p.devices.find((x) => x.label === 'Q1')!;
    q1.config.ratedCurrentA = 6;
    q1.config.curve = 'B';
    const node = buildUnifilar(p).nodes.find((n) => n.refId === q1.id)!;
    expect(node.details[0]).toContain('B6');
  });

  it('mover um dispositivo reposiciona bornes e recalcula o traçado dos fios', () => {
    const p = buildResidenceExample();
    const q1 = p.devices.find((x) => x.label === 'Q1')!;
    const before = terminalPose(p, { owner: q1.id, terminal: 'T1' })!.position;
    const lenBefore = computeWireLengths(p);
    q1.row = 2;
    q1.module = 10;
    const after = terminalPose(p, { owner: q1.id, terminal: 'T1' })!.position;
    expect(after[1]).toBeLessThan(before[1]);
    const lenAfter = computeWireLengths(p);
    const w = p.wires.find((x) => x.to.owner === q1.id || x.from.owner === q1.id)!;
    expect(lenAfter.get(w.id)).not.toBeCloseTo(lenBefore.get(w.id)!, 3);
  });

  it('bornes 3D coincidem com a geometria dos dispositivos', () => {
    const p = buildResidenceExample();
    const layout = boardLayout(p);
    for (const d of p.devices) {
      const box = deviceBox(d, layout);
      for (const t of getCatalogItem(d.catalogId)!.terminals) {
        const pose = terminalPose(p, { owner: d.id, terminal: t.id }, layout)!;
        expect(pose.position[0]).toBeGreaterThanOrEqual(box.left - 1e-9);
        expect(pose.position[0]).toBeLessThanOrEqual(box.left + box.width + 1e-9);
      }
    }
    for (const [i, w] of p.wires.entries()) {
      const r = routeWire(p, w, i, layout)!;
      expect(r.points.length).toBeGreaterThanOrEqual(4);
      expect(r.lengthM).toBeGreaterThan(0.02);
      expect(r.lengthM).toBeLessThan(3);
    }
  });
});
