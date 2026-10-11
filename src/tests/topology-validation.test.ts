import { describe, expect, it } from 'vitest';
import { analyzeTopology } from '../electrical/simulation/topology';
import { validateProject } from '../electrical/validation/validate';
import { buildResidenceExample } from '../persistence/examples';
import { createWire } from '../model/factory';
import { ALL_RULES, NORMATIVE_RULES, HEURISTIC_RULES } from '../normative/registry';
import type { Project } from '../model/schema';

const circuitOwner = (p: Project, n: number) => `circ:${p.circuits.find((c) => c.number === n)!.id}`;
const dev = (p: Project, label: string) => p.devices.find((d) => d.label === label)!;

describe('análise topológica', () => {
  it('exemplo residencial: todos os circuitos conectados e protegidos', () => {
    const p = buildResidenceExample();
    const topo = analyzeTopology(p);
    for (const c of p.circuits) {
      const t = topo.circuits.get(c.id)!;
      expect(t.connected).toBe(true);
      expect(t.protectiveBreakerId).not.toBeNull();
    }
    const c3 = topo.circuits.get(p.circuits[2].id)!;
    expect(c3.rcdIds).toEqual([dev(p, 'DR1').id]);
    expect(c3.rcdNeutralMismatch).toEqual([]);
    expect(topo.shorts).toEqual([]);
    expect(topo.loops).toBe(0);
  });

  it('identifica a fase de cada circuito', () => {
    const p = buildResidenceExample();
    const topo = analyzeTopology(p);
    expect(topo.circuits.get(p.circuits[0].id)!.phasesReached).toEqual(['L1']);
    expect(topo.circuits.get(p.circuits[1].id)!.phasesReached).toEqual(['L2']);
    expect(topo.circuits.get(p.circuits[3].id)!.phasesReached).toEqual(['L1', 'L2']);
  });

  it('detecta conexão ausente', () => {
    const p = buildResidenceExample();
    const owner = circuitOwner(p, 1);
    p.wires = p.wires.filter((w) => !(w.to.owner === owner && w.to.terminal === 'L1'));
    const report = validateProject(p);
    expect(report.findings.some((f) => f.ruleId === 'H-CONEXAO' && f.severity === 'erro')).toBe(true);
  });

  it('detecta curto-circuito de montagem fase-neutro', () => {
    const p = buildResidenceExample();
    p.wires.push(createWire({ owner: 'entrada', terminal: 'L1' }, { owner: 'barra-n', terminal: 'N9' }, 'preto', 10));
    const topo = analyzeTopology(p);
    expect(topo.shorts.map((s) => s.kind)).toContain('fase-neutro');
  });

  it('detecta interligação N-PE a jusante da origem', () => {
    const p = buildResidenceExample();
    p.wires.push(createWire({ owner: 'barra-n', terminal: 'N9' }, { owner: 'barra-pe', terminal: 'PE10' }, 'azul-claro', 10));
    expect(analyzeTopology(p).shorts.map((s) => s.kind)).toContain('neutro-pe');
  });

  it('em TN-C-S a ligação PEN da origem não é tratada como defeito', () => {
    const p = buildResidenceExample();
    p.supply.earthing = 'TN-C-S';
    expect(analyzeTopology(p).shorts).toEqual([]);
  });
});

describe('validação de fase, neutro e PE', () => {
  it('exemplo residencial não possui erros', () => {
    const r = validateProject(buildResidenceExample());
    const errors = r.findings.filter((f) => f.severity === 'erro');
    expect(errors).toEqual([]);
    expect(r.ruleErrors).toEqual([]);
    expect(r.statement).toContain('NÃO declara conformidade');
  });

  it('quadro de diagnóstico: detecta neutro fora do DR, PE ausente, cor errada e subdimensionamento', () => {
    const r = validateProject(buildResidenceExample({ defects: true }));
    const ids = new Set(r.findings.filter((f) => f.severity === 'erro').map((f) => f.ruleId));
    expect(ids.has('H-DR-NEUTRO')).toBe(true);
    expect(ids.has('H-CONEXAO')).toBe(true);
    expect(ids.has('NBR5410-IDENTIFICACAO-CORES')).toBe(true);
    expect(ids.has('NBR5410-SECAO-MINIMA')).toBe(true);
    expect(ids.has('NBR5410-SOBRECARGA')).toBe(true);
  });

  it('PE ligado ao barramento de neutro é detectado (não são intercambiáveis)', () => {
    const p = buildResidenceExample();
    const owner = circuitOwner(p, 1);
    const w = p.wires.find((x) => x.to.owner === owner && x.to.terminal === 'PE')!;
    w.from = { owner: 'barra-n', terminal: 'N9' };
    const r = validateProject(p);
    expect(r.findings.some((f) => f.ruleId === 'H-CONEXAO' && f.message.includes('PE'))).toBe(true);
    expect(r.findings.some((f) => f.ruleId === 'H-BORNE-COMPATIVEL' || f.ruleId === 'NBR5410-IDENTIFICACAO-CORES')).toBe(true);
  });

  it('verde-amarelo usado como fase é erro de identificação', () => {
    const p = buildResidenceExample();
    const owner = circuitOwner(p, 1);
    p.wires.find((x) => x.to.owner === owner && x.to.terminal === 'L1')!.color = 'verde-amarelo';
    const r = validateProject(p);
    expect(r.findings.some((f) => f.ruleId === 'NBR5410-IDENTIFICACAO-CORES' && f.severity === 'erro')).toBe(true);
  });

  it('circuito de cozinha sem DR viola a regra de 30 mA', () => {
    const p = buildResidenceExample();
    // move o C1 (sala) para a cozinha: ele não passa por DR
    p.circuits[0].locations = ['cozinha'];
    const r = validateProject(p);
    expect(r.findings.some((f) => f.ruleId === 'NBR5410-DR-30MA' && f.targetId === p.circuits[0].id)).toBe(true);
  });

  it('parâmetros desconhecidos geram inconclusivo, nunca aprovação silenciosa', () => {
    const p = buildResidenceExample();
    const q1 = dev(p, 'Q1');
    q1.catalogId = 'disj-desconhecido-1p';
    q1.config = {};
    const r = validateProject(p);
    expect(r.findings.some((f) => f.ruleId === 'H-DADOS-DESCONHECIDOS' && f.targetId === q1.id)).toBe(true);
    const sz = r.ctx.sizing.get(p.circuits[0].id)!;
    expect(sz.chosen!.criteria.find((c) => c.id === 'capacidade-interrupcao')!.status).toBe('inconclusivo');
    expect(sz.chosen!.criteria.find((c) => c.id === 'curto-circuito')!.status).toBe('inconclusivo');
  });
});

describe('camada NormativeRules', () => {
  it('toda regra possui metadados de rastreabilidade', () => {
    for (const r of ALL_RULES) {
      expect(r.id).toBeTruthy();
      expect(r.source.document).toBeTruthy();
      expect(r.source.clause).toBeTruthy();
      expect(r.verification.status).toBeTruthy();
      expect(r.didacticMessage.length).toBeGreaterThan(10);
      expect(r.applicability.length).toBeGreaterThan(5);
    }
    expect(new Set(ALL_RULES.map((r) => r.id)).size).toBe(ALL_RULES.length);
  });

  it('separa regras normativas de heurísticas e nenhuma se declara verificada na fonte primária', () => {
    expect(NORMATIVE_RULES.every((r) => r.kind === 'normativa')).toBe(true);
    expect(HEURISTIC_RULES.every((r) => r.kind === 'heuristica')).toBe(true);
    expect(ALL_RULES.some((r) => r.verification.status === 'verificado-fonte-primaria')).toBe(false);
    expect(HEURISTIC_RULES.every((r) => r.verification.status !== 'fonte-secundaria' || r.source.document !== 'ELETRILAB')).toBe(true);
  });
});
