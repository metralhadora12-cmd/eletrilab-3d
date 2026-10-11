/**
 * Desafios da Academia Elétrica.
 * Respostas numéricas são calculadas pelo próprio motor elétrico (não são
 * números fixos digitados), e desafios de montagem são avaliados pela mesma
 * validação e simulação usadas no modo técnico.
 */
import type { Project } from '../model/schema';
import { Builder, buildResidenceExample } from '../persistence/examples';
import { designCurrent } from '../electrical/calculations/power';
import { instantaneousTripRangeA } from '../electrical/calculations/protection';
import { sizeCircuit } from '../electrical/calculations/conductorSizing';
import { voltageDrop } from '../electrical/calculations/voltageDrop';
import { createCircuit, createEmptyProject } from '../model/factory';
import { systemVoltages } from '../electrical/core/systems';
import { analyzeTopology } from '../electrical/simulation/topology';
import { settleSimulation } from '../electrical/simulation/engine';
import { validateProject, type ValidationReport } from '../electrical/validation/validate';
import type { SettleResult } from '../electrical/simulation/engine';

export interface QuizQuestion {
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface ProjectGoal {
  id: string;
  description: string;
  check: (ctx: { project: Project; report: ValidationReport; sim: SettleResult }) => boolean;
}

interface ChallengeBase {
  id: string;
  level: number;
  title: string;
  intro: string;
  hints: string[];
  points: number;
}

export type Challenge =
  | (ChallengeBase & { type: 'quiz'; questions: QuizQuestion[] })
  | (ChallengeBase & { type: 'numeric'; prompt: string; unit: string; tolerancePct: number; answer: () => number; explanation: string })
  | (ChallengeBase & { type: 'project'; setup: () => Project; goals: ProjectGoal[] });

const noErrors: ProjectGoal = {
  id: 'sem-erros',
  description: 'Nenhum erro confirmado na validação',
  check: ({ report }) => report.counts.erro === 0,
};

const allEnergized: ProjectGoal = {
  id: 'energizados',
  description: 'Ao energizar, todos os circuitos ficam alimentados sem disparos',
  check: ({ project, sim }) =>
    sim.events.filter((e) => e.severity !== 'info').length === 0 &&
    project.circuits.every((c) => sim.snapshot.circuits.get(c.id)?.energized),
};

function lightingSetup(): Project {
  const b = new Builder('Desafio N3 — ligar a iluminação', 'Complete as ligações do circuito de iluminação.', {
    prospectiveShortCircuitKA: 3,
    earthElectrodeResistanceOhm: 20,
    upstreamVoltageDropPct: 1,
  });
  b.circuit('iluminacao', {
    name: 'Iluminação',
    loads: [{ id: 'ld', name: 'Luminárias LED', kind: 'iluminacao', powerW: 10, powerFactor: 0.92, efficiency: 1, quantity: 10 }],
    lengthM: 15,
    method: 'B1',
    ambientTempC: 30,
    groupedCircuits: 1,
    sectionMm2: 1.5,
  });
  const dg = b.dev('disj-generico-2p', 0, 0, 'DG', { ratedCurrentA: 40, curve: 'C', breakingCapacityKA: 4.5 });
  b.dev('disj-generico-1p', 1, 0, 'Q1', { ratedCurrentA: 10, curve: 'C', breakingCapacityKA: 4.5 });
  b.wire(['entrada', 'L1'], [dg, 'T1'], 'preto', 10);
  b.wire(['entrada', 'L2'], [dg, 'T2'], 'vermelho', 10);
  b.wire(['entrada', 'N'], ['barra-n', 'N1'], 'azul-claro', 10);
  b.wire(['entrada', 'PE'], ['barra-pe', 'PE1'], 'verde-amarelo', 10);
  return b.p;
}

function ovenSetup(): Project {
  const b = new Builder('Desafio N4 — dimensionar o forno', 'Defina a seção do circuito e ajuste o disjuntor.', {
    prospectiveShortCircuitKA: 3,
    earthElectrodeResistanceOhm: 20,
    upstreamVoltageDropPct: 1,
  });
  const c = b.circuit('forno', {
    name: 'Forno elétrico',
    connection: 'F-F',
    locations: ['cozinha'],
    loads: [{ id: 'ld', name: 'Forno 4400 W', kind: 'resistiva', powerW: 4400, powerFactor: 1, efficiency: 1, quantity: 1 }],
    lengthM: 16,
    method: 'B1',
    ambientTempC: 30,
    groupedCircuits: 2,
    sectionMm2: null,
  });
  const dg = b.dev('disj-generico-2p', 0, 0, 'DG', { ratedCurrentA: 40, curve: 'C', breakingCapacityKA: 4.5 });
  const dr = b.dev('dr-generico-4p', 0, 3, 'DR1', { ratedCurrentA: 40, residualCurrentMA: 30, rcdType: 'A' });
  const q1 = b.dev('disj-generico-2p', 1, 0, 'Q1', { ratedCurrentA: 32, curve: 'C', breakingCapacityKA: 4.5 });
  b.wire(['entrada', 'L1'], [dg, 'T1'], 'preto', 10);
  b.wire(['entrada', 'L2'], [dg, 'T2'], 'vermelho', 10);
  b.wire(['entrada', 'N'], ['barra-n', 'N1'], 'azul-claro', 10);
  b.wire(['entrada', 'PE'], ['barra-pe', 'PE1'], 'verde-amarelo', 10);
  b.wire([dg, 'B1'], [dr, 'T1'], 'preto', 10);
  b.wire([dg, 'B2'], [dr, 'T2'], 'vermelho', 10);
  b.wire(['barra-n', 'N2'], [dr, 'TN'], 'azul-claro', 10);
  b.wire([dr, 'B1'], [q1, 'T1'], 'preto', 10);
  b.wire([dr, 'B2'], [q1, 'T2'], 'vermelho', 10);
  b.wire([q1, 'B1'], [c, 'L1'], 'preto', 6);
  b.wire([q1, 'B2'], [c, 'L2'], 'vermelho', 6);
  b.wire(['barra-pe', 'PE2'], [c, 'PE'], 'verde-amarelo', 6);
  return b.p;
}

function fullProjectSetup(): Project {
  const ex = buildResidenceExample();
  const p = createEmptyProject('Desafio N6 — projeto completo', {
    description:
      'Residência fictícia: monte o quadro completo para os cinco circuitos cadastrados. Defina seções e disjuntores, instale DPS e DR onde necessário e ligue tudo.',
    supply: { ...ex.supply },
    enclosure: { ...ex.enclosure },
  });
  p.circuits = ex.circuits.map((c) => ({ ...c, sectionMm2: null }));
  return p;
}

const V127 = systemVoltages('127/220');
const V220 = systemVoltages('220/380');

export const CHALLENGES: Challenge[] = [
  {
    id: 'n1-quiz',
    level: 1,
    type: 'quiz',
    title: 'Identificação de condutores e componentes',
    intro: 'Responda às perguntas sobre fase, neutro, PE e funções dos dispositivos.',
    hints: ['Lembre da cor reservada para cada função.', 'Quem protege o cabo? Quem protege as pessoas?', 'O PE não conduz corrente em funcionamento normal.'],
    points: 100,
    questions: [
      {
        prompt: 'Qual cor identifica o condutor neutro?',
        options: ['Preto', 'Azul-claro', 'Verde-amarelo', 'Vermelho'],
        correct: 1,
        explanation: 'Azul-claro é a cor reservada ao neutro.',
      },
      {
        prompt: 'Qual a função do condutor de proteção (PE)?',
        options: ['Levar energia à carga', 'Retornar a corrente de carga', 'Ligar as massas ao aterramento para escoar correntes de falta', 'Substituir o neutro quando ele falta'],
        correct: 2,
        explanation: 'O PE liga as massas ao aterramento; não é condutor de retorno.',
      },
      {
        prompt: 'Um condutor verde-amarelo pode ser usado como fase?',
        options: ['Sim, se a seção for adequada', 'Não, é reservado ao PE', 'Sim, em circuitos de iluminação', 'Somente com anilhas pretas'],
        correct: 1,
        explanation: 'Verde-amarelo é exclusivo do condutor de proteção.',
      },
      {
        prompt: 'O disjuntor termomagnético protege principalmente…',
        options: ['As pessoas contra choques de 30 mA', 'Os condutores contra sobrecargas e curtos-circuitos', 'Os equipamentos contra surtos', 'O aterramento'],
        correct: 1,
        explanation: 'O disjuntor protege o condutor. Choques são tarefa do DR; surtos, do DPS.',
      },
      {
        prompt: 'Neutro e PE podem ser ligados no mesmo barramento dentro do quadro de distribuição (esquema TN-S)?',
        options: ['Sim, sempre', 'Não: têm barramentos próprios e não são intercambiáveis', 'Sim, desde que o DR seja de 300 mA', 'Só em circuitos de tomadas'],
        correct: 1,
        explanation: 'A jusante da origem, neutro e PE são separados.',
      },
    ],
  },
  {
    id: 'n1-corrente',
    level: 1,
    type: 'numeric',
    title: 'Corrente de um aquecedor',
    intro: 'Calcule a corrente de projeto de uma carga resistiva.',
    prompt: 'Aquecedor resistivo de 2200 W ligado entre fase e neutro em um sistema 220/380 V (cos φ = 1). Qual é a corrente?',
    unit: 'A',
    tolerancePct: 2,
    answer: () => {
      const r = designCurrent({ activeW: 2200, powerFactor: 1, connection: 'F-N', voltages: V220 });
      return r.status === 'ok' ? r.value.currentA : NaN;
    },
    explanation: 'I = P / (U0 · cos φ) = 2200 / 220 = 10 A.',
    hints: ['Fase-neutro em 220/380 → U0 = 220 V.', 'Carga resistiva: cos φ = 1.', 'I = P / U0.'],
    points: 60,
  },
  {
    id: 'n2-quiz',
    level: 2,
    type: 'quiz',
    title: 'Curvas, DR e DPS',
    intro: 'Teste seus conhecimentos sobre os dispositivos de proteção.',
    hints: ['IΔn é a sensibilidade; In é a corrente suportada.', 'O DR soma as correntes de todos os polos.', 'O DPS precisa do PE.'],
    points: 100,
    questions: [
      {
        prompt: 'Faixa de disparo instantâneo de um disjuntor curva C:',
        options: ['3 a 5·In', '5 a 10·In', '10 a 20·In', '1,13 a 1,45·In'],
        correct: 1,
        explanation: 'Curva C: 5 a 10 vezes In.',
      },
      {
        prompt: 'Em um DR "40 A / 30 mA", o que significa 30 mA?',
        options: ['Corrente nominal', 'Sensibilidade diferencial IΔn', 'Capacidade de interrupção', 'Corrente de fuga admissível do circuito'],
        correct: 1,
        explanation: '30 mA é IΔn; 40 A é a corrente nominal.',
      },
      {
        prompt: 'O neutro de um circuito protegido por DR está ligado ao barramento de neutro geral (fora do DR). Ao ligar a carga…',
        options: ['Nada acontece', 'O DR dispara, pois a corrente não retorna por ele', 'O disjuntor geral dispara', 'O DPS atua'],
        correct: 1,
        explanation: 'O DR vê a corrente de ida sem o retorno: diferença ≥ IΔn → disparo.',
      },
      {
        prompt: 'O DPS pode substituir o disjuntor do circuito?',
        options: ['Sim', 'Não; ele só limita sobretensões transitórias e não substitui disjuntor, DR ou aterramento', 'Sim, se for Tipo 1', 'Apenas em sistemas TT'],
        correct: 1,
        explanation: 'Cada dispositivo tem função própria.',
      },
    ],
  },
  {
    id: 'n2-curva',
    level: 2,
    type: 'numeric',
    title: 'Limite de disparo instantâneo',
    intro: 'Use a definição da curva de disparo.',
    prompt: 'Disjuntor C16: a partir de qual corrente o disparo instantâneo é garantido?',
    unit: 'A',
    tolerancePct: 0.5,
    answer: () => instantaneousTripRangeA('C', 16)[1],
    explanation: 'Curva C: limite superior 10·In = 160 A.',
    hints: ['Curva C vai de 5 a 10·In.', 'O limite SUPERIOR garante o disparo.'],
    points: 60,
  },
  {
    id: 'n3-iluminacao',
    level: 3,
    type: 'project',
    title: 'Ligue o circuito de iluminação',
    intro:
      'O quadro já tem entrada, disjuntor geral (DG) e o disjuntor Q1. Ligue: DG → Q1, Q1 → borne L do circuito, barramento de neutro → N, barramento PE → PE. Use cores corretas.',
    hints: [
      'A saída do DG fica nos bornes inferiores (2 e 4).',
      'O fio que sai de Q1 até o circuito pode ser de 1,5 mm².',
      'Neutro: azul-claro ao barramento de neutro. PE: verde-amarelo ao barramento PE.',
    ],
    points: 150,
    setup: lightingSetup,
    goals: [
      {
        id: 'conectado',
        description: 'Circuito C1 com fase, neutro e PE conectados',
        check: ({ project }) => analyzeTopology(project).circuits.get(project.circuits[0].id)?.connected === true,
      },
      noErrors,
      allEnergized,
    ],
  },
  {
    id: 'n4-secao',
    level: 4,
    type: 'numeric',
    title: 'Seção mínima do chuveiro',
    intro: 'Aplique os fatores de correção.',
    prompt:
      'Chuveiro 5500 W, F-F 220 V, cobre/PVC, método B1, 30 °C, 3 circuitos agrupados, 10 m, limite de queda 4 %. Qual a seção mínima (mm²)?',
    unit: 'mm²',
    tolerancePct: 0,
    answer: () => {
      const p = createEmptyProject('x');
      const c = createCircuit(p, 'chuveiro', { connection: 'F-F', lengthM: 10, method: 'B1', ambientTempC: 30, groupedCircuits: 3 });
      return sizeCircuit({ circuit: c, supply: { ...p.supply, systemVoltage: '127/220' }, protection: null }).minSectionMm2 ?? NaN;
    },
    explanation: 'Ib = 25 A. Iz(4 mm²) = 32·0,7 = 22,4 A < 25 A; Iz(6 mm²) = 41·0,7 = 28,7 A ≥ 25 A → 6 mm².',
    hints: ['Calcule Ib = P / U.', 'Fator de agrupamento para 3 circuitos: 0,7.', 'Compare Iz corrigida de cada seção com Ib.'],
    points: 80,
  },
  {
    id: 'n4-queda',
    level: 4,
    type: 'numeric',
    title: 'Queda de tensão percentual',
    intro: 'Calcule a queda de tensão de um circuito monofásico.',
    prompt:
      'Circuito F-N 127 V, 1500 W, cos φ = 1, 25 m, 2,5 mm² cobre (R a 70 °C = 9,548 mΩ/m). Qual a queda percentual?',
    unit: '%',
    tolerancePct: 3,
    answer: () => {
      const r = voltageDrop({
        currentA: 1500 / 127,
        lengthM: 25,
        sectionMm2: 2.5,
        material: 'cobre',
        insulation: 'PVC',
        powerFactor: 1,
        connection: 'F-N',
        voltages: V127,
      });
      return r.status === 'ok' ? r.value.percent : NaN;
    },
    explanation: 'I = 11,81 A; ΔU = 2·11,81·25·0,009548 = 5,64 V → 4,44 % (acima do limite de 4 %).',
    hints: ['b = 2 para circuito de dois condutores.', 'ΔU% = 100·ΔU/127.'],
    points: 80,
  },
  {
    id: 'n4-forno',
    level: 4,
    type: 'project',
    title: 'Dimensione o circuito do forno',
    intro:
      'O forno (4400 W, F-F 220 V) está ligado, mas a seção não foi definida e o disjuntor Q1 está com 32 A. Defina a seção do circuito e ajuste In para atender Ib ≤ In ≤ Iz.',
    hints: ['Ib = 4400/220 = 20 A.', 'Com 2 circuitos agrupados, kg = 0,8.', 'Com In = 32 A é preciso Iz ≥ 32 A; com In = 25 A, 4 mm² pode bastar.'],
    points: 150,
    setup: ovenSetup,
    goals: [
      {
        id: 'secao',
        description: 'Seção do circuito definida',
        check: ({ project }) => project.circuits[0].sectionMm2 !== null,
      },
      {
        id: 'criterios',
        description: 'Capacidade, sobrecarga e queda de tensão atendidas',
        check: ({ report, project }) => {
          const ch = report.ctx.sizing.get(project.circuits[0].id)?.chosen;
          return !!ch && ['capacidade', 'sobrecarga', 'queda-tensao', 'secao-minima'].every((id) => ch.criteria.find((c) => c.id === id)?.status === 'ok');
        },
      },
      noErrors,
    ],
  },
  {
    id: 'n5-quiz',
    level: 5,
    type: 'quiz',
    title: 'Interpretação de medições',
    intro: 'Analise as medições virtuais.',
    hints: ['Neutro aberto deixa o neutro da carga no potencial da fase.', 'O PE carrega a corrente de fuga de volta.'],
    points: 100,
    questions: [
      {
        prompt: 'Com a carga ligada, você mede ~127 V entre o neutro na tomada e o PE. Provável causa:',
        options: ['Neutro interrompido', 'PE interrompido', 'Disjuntor desarmado', 'DPS em fim de vida'],
        correct: 0,
        explanation: 'Com o neutro aberto, o neutro da carga fica no potencial da fase através da própria carga.',
      },
      {
        prompt: 'O alicate envolvendo fase e neutro (sem o PE) indica 12 mA. Isso representa:',
        options: ['A corrente de carga', 'A corrente de fuga para a terra', 'Erro do instrumento', 'A corrente do PE em curto'],
        correct: 1,
        explanation: 'A soma vetorial de fase e neutro é a corrente que não retornou por eles: a fuga.',
      },
      {
        prompt: 'O ohmímetro foi bloqueado pelo simulador. Por quê?',
        options: ['A bateria acabou', 'A instalação está energizada', 'O PE está aberto', 'O DR está desligado'],
        correct: 1,
        explanation: 'Resistência e continuidade só são medidas com a instalação desenergizada.',
      },
    ],
  },
  {
    id: 'n5-diagnostico',
    level: 5,
    type: 'project',
    title: 'Corrija o quadro com defeitos',
    intro:
      'Este quadro tem defeitos de ligação, identificação e dimensionamento. Use o terminal de diagnóstico e os instrumentos para encontrá-los e corrija tudo.',
    hints: [
      'Verifique onde está ligado o neutro do circuito da cozinha.',
      'Há um circuito sem PE e um condutor com cor incompatível.',
      'Confira a seção do circuito de tomadas da sala frente ao disjuntor de 16 A.',
    ],
    points: 200,
    setup: () => buildResidenceExample({ defects: true }),
    goals: [noErrors, allEnergized],
  },
  {
    id: 'n6-residencia',
    level: 6,
    type: 'project',
    title: 'Projeto completo da residência',
    intro:
      'Monte o quadro do zero para os cinco circuitos cadastrados: disjuntor geral, DPS por condutor vivo, DR 30 mA para áreas molhadas, disjuntores terminais, barramentos e todas as ligações. Defina as seções.',
    hints: [
      'Comece pelo disjuntor geral bipolar alimentado pela entrada.',
      'Cozinha, lavanderia e banheiro precisam de DR de 30 mA — com o neutro saindo do próprio DR.',
      'Use bornes de distribuição para derivar a saída do geral e o editor de circuitos para ver a seção mínima.',
    ],
    points: 400,
    setup: fullProjectSetup,
    goals: [
      {
        id: 'secoes',
        description: 'Todos os circuitos com seção definida',
        check: ({ project }) => project.circuits.every((c) => c.sectionMm2 !== null),
      },
      {
        id: 'dps',
        description: 'Cada condutor vivo da entrada protegido por DPS ligado ao PE',
        check: ({ project, report }) => {
          const topo = report.ctx.topology;
          const lives = ['L1', 'L2', 'N'];
          return lives.every((s) =>
            project.devices.some(
              (d) =>
                report.ctx.spd(d.id) !== null &&
                topo.netSources(`${d.id}::L`).includes(s as never) &&
                topo.netSources(`${d.id}::PE`).includes('PE'),
            ),
          );
        },
      },
      noErrors,
      allEnergized,
    ],
  },
];

export function challengesForLevel(level: number) {
  return CHALLENGES.filter((c) => c.level === level);
}

export function evaluateProjectChallenge(ch: Extract<Challenge, { type: 'project' }>, project: Project) {
  const p = { ...project, validationProfile: 'desafio' as const };
  const report = validateProject(p);
  const energized = { ...p, simulation: { ...p.simulation, energized: true, faults: [] } };
  const sim = settleSimulation(energized, analyzeTopology(energized));
  const goals = ch.goals.map((g) => {
    let met = false;
    try {
      met = g.check({ project: p, report, sim });
    } catch {
      met = false;
    }
    return { id: g.id, description: g.description, met };
  });
  const critical = report.findings.filter((f) => f.severity === 'erro').map((f) => f.message);
  return {
    passed: goals.every((g) => g.met) && critical.length === 0,
    goals,
    critical,
    simEvents: sim.events.map((e) => e.message),
  };
}
