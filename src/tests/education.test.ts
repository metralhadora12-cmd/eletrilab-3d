import { describe, expect, it } from 'vitest';
import { CHALLENGES, evaluateProjectChallenge, type Challenge } from '../education/challenges';
import { computeScore, emptyProgress, isLevelUnlocked, performanceReport, recordAttempt, takeHint } from '../education/progress';
import { buildResidenceExample } from '../persistence/examples';
import { createWire } from '../model/factory';

const project = (id: string) => CHALLENGES.find((c) => c.id === id) as Extract<Challenge, { type: 'project' }>;
const numeric = (id: string) => CHALLENGES.find((c) => c.id === id) as Extract<Challenge, { type: 'numeric' }>;

describe('desafios', () => {
  it('respostas numéricas vêm do motor e conferem com cálculo manual', () => {
    expect(numeric('n1-corrente').answer()).toBeCloseTo(10, 9);
    expect(numeric('n2-curva').answer()).toBe(160);
    expect(numeric('n4-secao').answer()).toBe(6);
    // 1500/127 = 11,811 A; ΔU = 2·11,811·25·0,0095481 = 5,6386 V → 4,440 %
    expect(numeric('n4-queda').answer()).toBeCloseTo(4.44, 2);
  });

  it('montagem incompleta não é aprovada; a solução é aprovada', () => {
    const ch = project('n3-iluminacao');
    const p = ch.setup();
    expect(evaluateProjectChallenge(ch, p).passed).toBe(false);
    const c = `circ:${p.circuits[0].id}`;
    const dg = p.devices.find((d) => d.label === 'DG')!.id;
    const q1 = p.devices.find((d) => d.label === 'Q1')!.id;
    p.wires.push(
      createWire({ owner: dg, terminal: 'B1' }, { owner: q1, terminal: 'T1' }, 'preto', 10),
      createWire({ owner: q1, terminal: 'B1' }, { owner: c, terminal: 'L1' }, 'preto', 1.5),
      createWire({ owner: 'barra-n', terminal: 'N2' }, { owner: c, terminal: 'N' }, 'azul-claro', 1.5),
      createWire({ owner: 'barra-pe', terminal: 'PE2' }, { owner: c, terminal: 'PE' }, 'verde-amarelo', 1.5),
    );
    const r = evaluateProjectChallenge(ch, p);
    expect(r.critical).toEqual([]);
    expect(r.passed).toBe(true);
  });

  it('não aprova atividade com falha crítica, mesmo que o circuito funcione', () => {
    const ch = project('n3-iluminacao');
    const p = ch.setup();
    const c = `circ:${p.circuits[0].id}`;
    const dg = p.devices.find((d) => d.label === 'DG')!.id;
    const q1 = p.devices.find((d) => d.label === 'Q1')!.id;
    p.wires.push(
      createWire({ owner: dg, terminal: 'B1' }, { owner: q1, terminal: 'T1' }, 'preto', 10),
      createWire({ owner: q1, terminal: 'B1' }, { owner: c, terminal: 'L1' }, 'preto', 1.5),
      // neutro com cor errada: funciona eletricamente, mas é erro de identificação
      createWire({ owner: 'barra-n', terminal: 'N2' }, { owner: c, terminal: 'N' }, 'branco', 1.5),
      createWire({ owner: 'barra-pe', terminal: 'PE2' }, { owner: c, terminal: 'PE' }, 'verde-amarelo', 1.5),
    );
    const r = evaluateProjectChallenge(ch, p);
    expect(r.goals.find((g) => g.id === 'energizados')!.met).toBe(true);
    expect(r.passed).toBe(false);
  });

  it('forno: solução 4 mm² com In 25 A é aprovada', () => {
    const ch = project('n4-forno');
    const p = ch.setup();
    expect(evaluateProjectChallenge(ch, p).passed).toBe(false);
    p.circuits[0].sectionMm2 = 4;
    p.devices.find((d) => d.label === 'Q1')!.config.ratedCurrentA = 25;
    expect(evaluateProjectChallenge(ch, p).passed).toBe(true);
  });

  it('diagnóstico: quadro com defeitos reprova; quadro corrigido aprova', () => {
    const ch = project('n5-diagnostico');
    expect(evaluateProjectChallenge(ch, ch.setup()).passed).toBe(false);
    expect(evaluateProjectChallenge(ch, buildResidenceExample()).passed).toBe(true);
  });

  it('projeto completo: a residência exemplo atende a todos os objetivos', () => {
    const ch = project('n6-residencia');
    expect(evaluateProjectChallenge(ch, ch.setup()).passed).toBe(false);
    const r = evaluateProjectChallenge(ch, buildResidenceExample());
    expect(r.goals.every((g) => g.met)).toBe(true);
    expect(r.passed).toBe(true);
  });
});

describe('progresso e pontuação', () => {
  it('dicas e tentativas sem sucesso reduzem a pontuação', () => {
    const ch = CHALLENGES[0];
    let p = emptyProgress();
    expect(computeScore(ch, p)).toBe(ch.points);
    p = takeHint(p, ch);
    expect(computeScore(ch, p)).toBe(Math.round(ch.points * 0.85));
    p = recordAttempt(p, ch, false, ['erro X']);
    expect(computeScore(ch, p)).toBe(Math.round(ch.points * 0.75));
    p = recordAttempt(p, ch, true, []);
    expect(p.completed[ch.id].score).toBe(Math.round(ch.points * 0.75));
    const rep = performanceReport(p);
    expect(rep.attempts).toBe(2);
    expect(rep.frequentIssues[0][0]).toBe('erro X');
  });

  it('níveis são liberados progressivamente', () => {
    let p = emptyProgress();
    expect(isLevelUnlocked(1, p)).toBe(true);
    expect(isLevelUnlocked(2, p)).toBe(false);
    p = recordAttempt(p, CHALLENGES.find((c) => c.id === 'n1-quiz')!, true, []);
    expect(isLevelUnlocked(2, p)).toBe(true);
  });
});
