import { describe, expect, it } from 'vitest';
import { buildResidenceExample, EXAMPLES } from '../persistence/examples';
import { exportProjectJson, importProjectJson, parseProject } from '../persistence/serialize';
import { MemoryStorage, ProjectRepository } from '../persistence/storage';

describe('exportação e importação', () => {
  it('ida e volta preserva disposição, conexões, circuitos e estado da simulação', () => {
    const p = buildResidenceExample();
    p.simulation.energized = true;
    p.simulation.faults.push({ id: 'f1', kind: 'leakage', circuitId: p.circuits[0].id, resistanceOhm: 5000 });
    p.lastValidation = {
      at: '2026-10-11T00:00:00.000Z',
      profile: 'tecnico',
      counts: { erro: 0, alerta: 1, inconclusivo: 2, info: 0 },
      findings: [{ ruleId: 'X', severity: 'alerta', message: 'm', targetId: null }],
    };
    const r = importProjectJson(exportProjectJson(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project).toEqual(p);
  });

  it('rejeita JSON inválido', () => {
    const r = importProjectJson('{ isto não é json');
    expect(r.ok).toBe(false);
  });

  it('rejeita dados fora do schema (ex.: seção negativa)', () => {
    const p = buildResidenceExample();
    const data = JSON.parse(exportProjectJson(p));
    data.project.wires[0].sectionMm2 = -2;
    const r = parseProject(data);
    expect(r.ok).toBe(false);
  });

  it('rejeita referências quebradas (borne inexistente, catálogo inexistente, sobreposição)', () => {
    const base = buildResidenceExample();
    const a = structuredClone(base);
    a.wires[0].to = { owner: a.devices[0].id, terminal: 'XYZ' };
    expect(parseProject(a).ok).toBe(false);
    const b = structuredClone(base);
    b.devices[0].catalogId = 'nao-existe';
    expect(parseProject(b).ok).toBe(false);
    const c = structuredClone(base);
    c.devices[1].row = c.devices[0].row;
    c.devices[1].module = c.devices[0].module;
    expect(parseProject(c).ok).toBe(false);
  });

  it('rejeita parâmetro configurado em item que não o permite', () => {
    const p = structuredClone(buildResidenceExample());
    const bn = p.devices.find((d) => d.label === 'BN1')!;
    bn.config = { ratedCurrentA: 999 };
    expect(parseProject(p).ok).toBe(false);
  });

  it('todos os exemplos são projetos válidos', () => {
    for (const ex of EXAMPLES) expect(parseProject(ex.build()).ok).toBe(true);
  });
});

describe('repositório local', () => {
  it('salva, lista, abre, duplica e exclui', () => {
    const repo = new ProjectRepository(new MemoryStorage());
    const p = buildResidenceExample();
    repo.save(p);
    expect(repo.list().map((s) => s.id)).toEqual([p.id]);
    const loaded = repo.load(p.id);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.project.wires.length).toBe(p.wires.length);
    const copy = repo.duplicate(p.id)!;
    expect(copy.id).not.toBe(p.id);
    expect(repo.list()).toHaveLength(2);
    repo.delete(p.id);
    expect(repo.list().map((s) => s.id)).toEqual([copy.id]);
  });

  it('salvamento automático e recuperação de sessão', () => {
    const repo = new ProjectRepository(new MemoryStorage());
    const p = buildResidenceExample();
    repo.autosave(p);
    const rec = repo.loadAutosave();
    expect(rec?.project.id).toBe(p.id);
    repo.clearAutosave();
    expect(repo.loadAutosave()).toBeNull();
  });

  it('dados corrompidos no armazenamento não são carregados', () => {
    const storage = new MemoryStorage();
    const repo = new ProjectRepository(storage);
    const p = repo.save(buildResidenceExample());
    storage.setItem(`eletrilab.v1.project.${p.id}`, '{"broken":');
    expect(repo.load(p.id).ok).toBe(false);
  });

  it('não salva projeto inválido', () => {
    const repo = new ProjectRepository(new MemoryStorage());
    const p = buildResidenceExample();
    p.wires[0].to = { owner: 'nada', terminal: 'x' };
    expect(() => repo.save(p)).toThrow();
  });
});
