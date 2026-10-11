/**
 * HEURÍSTICAS EDUCACIONAIS do EletriLab.
 * São verificações de consistência do modelo e boas práticas didáticas —
 * NÃO são apresentadas como requisitos normativos.
 */
import { getCatalogItem } from '../../catalog';
import { FUNCTION_LABEL, WIRE_COLORS } from '../../catalog/colors';
import { conductorAmpacity } from '../../electrical/calculations/ampacity';
import { formatNumberBR } from '../../electrical/core/units';
import type { Finding, ValidationContext } from '../../electrical/validation/context';
import { terminalKey } from '../../model/schema';
import { resolveTerminal, terminalOccupancy } from '../../model/terminals';
import type { NormativeRule } from '../types';

const REV = '2026-10-11';
const didactic = (notes: string) => ({ status: 'didatico' as const, notes, reviewedAt: REV });
const SRC = (clause: string) => ({ document: 'ELETRILAB' as const, clause, clauseConfirmed: true });

const SHORT_LABEL = {
  'fase-fase': 'curto-circuito fase-fase',
  'fase-neutro': 'curto-circuito fase-neutro',
  'fase-pe': 'curto-circuito fase-PE (falta à terra)',
  'neutro-pe': 'interligação indevida entre neutro e PE a jusante da origem',
} as const;

function strict(ctx: ValidationContext) {
  return ctx.profile !== 'aprendizado';
}

export const HEURISTIC_RULES: NormativeRule[] = [
  {
    id: 'H-CONEXAO',
    kind: 'heuristica',
    title: 'Conexões ausentes nos circuitos',
    description: 'Cada condutor de saída do circuito deve alcançar o condutor correspondente da alimentação.',
    source: SRC('consistência do modelo'),
    applicability: 'Todos os circuitos cadastrados.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Uma ligação ausente deixa o circuito sem alimentação, sem retorno ou sem proteção das massas.',
    verification: didactic('Verificação topológica do modelo.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      for (const c of ctx.project.circuits) {
        const topo = ctx.topology.circuits.get(c.id);
        if (!topo) continue;
        for (const t of topo.conductors) {
          if (t.reachedSource) continue;
          const wrong = t.netSources.filter((s) => (t.expected === 'L' ? !s.startsWith('L') : s !== t.expected));
          out.push({
            ruleId: 'H-CONEXAO',
            severity: 'erro',
            message: wrong.length
              ? `${ctx.circuitLabel(c.id)}: borne ${t.terminalId} (${FUNCTION_LABEL[t.expected]}) está ligado a ${wrong.join('/')}.`
              : `${ctx.circuitLabel(c.id)}: borne ${t.terminalId} (${FUNCTION_LABEL[t.expected]}) não está conectado à alimentação.`,
            targetKind: 'circuit',
            targetId: c.id,
            hint:
              t.expected === 'PE'
                ? 'Ligue o borne PE ao barramento de proteção.'
                : t.expected === 'N'
                  ? 'Ligue o borne N ao barramento de neutro (do DR correspondente, se houver).'
                  : 'Ligue o borne de fase à saída do disjuntor do circuito.',
          });
        }
      }
      return out;
    },
  },
  {
    id: 'H-SEM-PROTECAO',
    kind: 'heuristica',
    title: 'Circuito sem dispositivo de proteção contra sobrecorrente',
    description: 'A fase de cada circuito deve passar por um disjuntor.',
    source: SRC('consistência do modelo'),
    applicability: 'Circuitos cujas fases alcançam a alimentação.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Sem disjuntor, nada interrompe sobrecargas e curtos-circuitos no condutor.',
    verification: didactic('Verificação topológica.'),
    validate: (ctx) =>
      ctx.project.circuits.flatMap((c) => {
        const topo = ctx.topology.circuits.get(c.id);
        const phaseOk = topo?.conductors.filter((t) => t.expected === 'L').every((t) => t.reachedSource);
        if (!topo || !phaseOk || topo.protectiveBreakerId) return [];
        return [
          {
            ruleId: 'H-SEM-PROTECAO',
            severity: 'erro' as const,
            message: `${ctx.circuitLabel(c.id)}: fase alimentada sem passar por disjuntor.`,
            targetKind: 'circuit' as const,
            targetId: c.id,
          },
        ];
      }),
  },
  {
    id: 'H-DR-NEUTRO',
    kind: 'heuristica',
    title: 'Fase e neutro devem passar pelo mesmo DR',
    description: 'O DR compara as correntes de todos os seus polos; o neutro do circuito precisa voltar pelo mesmo DR.',
    source: SRC('princípio de funcionamento do DR'),
    applicability: 'Circuitos com neutro protegidos por DR.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Neutro "misturado" entre grupos de DR provoca disparos indevidos ou deixa o circuito sem proteção diferencial.',
    verification: didactic('Consequência direta do princípio de medição diferencial.'),
    validate: (ctx) =>
      ctx.project.circuits.flatMap((c) => {
        const topo = ctx.topology.circuits.get(c.id);
        if (!topo?.rcdNeutralMismatch.length) return [];
        return [
          {
            ruleId: 'H-DR-NEUTRO',
            severity: 'erro' as const,
            message: `${ctx.circuitLabel(c.id)}: fase e neutro não passam pelo(s) mesmo(s) DR (${topo.rcdNeutralMismatch.map((id) => ctx.device(id)?.label).join(', ')}).`,
            targetKind: 'circuit' as const,
            targetId: c.id,
            hint: "Ligue o neutro do circuito ao barramento alimentado pelo borne N' do mesmo DR.",
          },
        ];
      }),
  },
  {
    id: 'H-CURTO-MONTAGEM',
    kind: 'heuristica',
    title: 'Curto-circuito ou interligação indevida na montagem',
    description: 'Condutores de funções diferentes não podem ser interligados.',
    source: SRC('consistência do modelo'),
    applicability: 'Análise estrutural com todos os dispositivos fechados.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Ao energizar, uma ligação assim provoca curto-circuito ou correntes indevidas no PE.',
    verification: didactic('Verificação topológica.'),
    validate: (ctx) =>
      ctx.topology.shorts.map((s) => ({
        ruleId: 'H-CURTO-MONTAGEM',
        severity: 'erro' as const,
        message: `Montagem com ${SHORT_LABEL[s.kind]} (${s.sources.join(' + ')}).`,
        targetKind: 'project' as const,
        targetId: null,
        hint: 'Revise os condutores que interligam esses barramentos/bornes.',
      })),
  },
  {
    id: 'H-BORNE-COMPATIVEL',
    kind: 'heuristica',
    title: 'Compatibilidade entre condutor e borne',
    description: 'Cada borne aceita funções específicas (ex.: barra de neutro só aceita neutro).',
    source: SRC('dados de terminais do catálogo'),
    applicability: 'Todos os condutores. Em validação rigorosa a ligação é bloqueada na montagem.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Neutro e PE não são intercambiáveis: cada um tem barramento e bornes próprios.',
    verification: didactic('Baseada nos terminais declarados no catálogo.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      for (const w of ctx.project.wires) {
        const fn = ctx.topology.wireFunction.get(w.id)?.fn;
        for (const end of [w.from, w.to]) {
          const t = resolveTerminal(ctx.project, end);
          if (!t) {
            out.push({
              ruleId: 'H-BORNE-COMPATIVEL',
              severity: 'erro',
              message: `Condutor ligado a borne inexistente (${end.owner}:${end.terminal}).`,
              targetKind: 'wire',
              targetId: w.id,
            });
            continue;
          }
          if (fn && !t.def.accepts.includes(fn)) {
            out.push({
              ruleId: 'H-BORNE-COMPATIVEL',
              severity: strict(ctx) ? 'erro' : 'alerta',
              message: `${t.ownerLabel} · ${t.def.label}: borne para ${t.def.accepts.map((a) => FUNCTION_LABEL[a]).join('/')} recebeu ${FUNCTION_LABEL[fn]}.`,
              targetKind: 'wire',
              targetId: w.id,
            });
          }
          if (w.sectionMm2 > t.def.maxSectionMm2) {
            out.push({
              ruleId: 'H-BORNE-COMPATIVEL',
              severity: 'erro',
              message: `${t.ownerLabel} · ${t.def.label}: condutor de ${formatNumberBR(w.sectionMm2)} mm² acima da capacidade do borne (${t.def.maxSectionMm2} mm²).`,
              targetKind: 'wire',
              targetId: w.id,
            });
          }
        }
      }
      return out;
    },
  },
  {
    id: 'H-OCUPACAO-BORNE',
    kind: 'heuristica',
    title: 'Quantidade de condutores por borne',
    description: 'Respeitar o número máximo de condutores por borne indicado para o dispositivo.',
    source: SRC('dados do catálogo; instruções de fabricantes'),
    applicability: 'Bornes de dispositivos.',
    parameters: {},
    severity: 'alerta',
    didacticMessage: 'Condutores demais no mesmo borne geram mau contato e aquecimento.',
    verification: didactic('Limite didático declarado no catálogo.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      const occ = terminalOccupancy(ctx.project);
      for (const d of ctx.project.devices) {
        const item = getCatalogItem(d.catalogId);
        if (!item) continue;
        for (const t of item.terminals) {
          const n = occ.get(terminalKey({ owner: d.id, terminal: t.id })) ?? 0;
          if (n > item.compatibility.maxConductorsPerTerminal) {
            out.push({
              ruleId: 'H-OCUPACAO-BORNE',
              severity: 'alerta',
              message: `${d.label} · borne ${t.label}: ${n} condutores (máximo ${item.compatibility.maxConductorsPerTerminal}).`,
              targetKind: 'device',
              targetId: d.id,
              hint: 'Use barramento pente ou borne de distribuição.',
            });
          }
        }
      }
      return out;
    },
  },
  {
    id: 'H-CONDUTOR-SEM-ORIGEM',
    kind: 'heuristica',
    title: 'Condutor sem origem energizável ou interrompido',
    description: 'Todo condutor instalado deve pertencer a um trecho ligado à alimentação.',
    source: SRC('consistência do modelo'),
    applicability: 'Todos os condutores.',
    parameters: {},
    severity: 'alerta',
    didacticMessage: 'Condutores "soltos" indicam ligações incompletas ou sobras de montagem.',
    verification: didactic('Verificação topológica.'),
    validate: (ctx) =>
      ctx.project.wires.flatMap((w) => {
        if (w.broken) {
          return [
            {
              ruleId: 'H-CONDUTOR-SEM-ORIGEM',
              severity: 'alerta' as const,
              message: `Condutor ${w.label ?? WIRE_COLORS[w.color].name} marcado como interrompido (falha didática).`,
              targetKind: 'wire' as const,
              targetId: w.id,
            },
          ];
        }
        const f = ctx.topology.wireFunction.get(w.id);
        if (f && f.fn === null && !f.conflict) {
          return [
            {
              ruleId: 'H-CONDUTOR-SEM-ORIGEM',
              severity: 'alerta' as const,
              message: `Condutor ${WIRE_COLORS[w.color].name.toLowerCase()} não está ligado a nenhum trecho alimentado.`,
              targetKind: 'wire' as const,
              targetId: w.id,
            },
          ];
        }
        return [];
      }),
  },
  {
    id: 'H-PENTE',
    kind: 'heuristica',
    title: 'Pente sobre dispositivo incompatível',
    description: 'O barramento pente só se encaixa em disjuntores compatíveis.',
    source: SRC('compatibilidade mecânica do catálogo'),
    applicability: 'Barramentos pente.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Um pente sobre DR ou DPS ligaria fases a bornes de neutro ou de terra.',
    verification: didactic('Compatibilidade declarada no catálogo.'),
    validate: (ctx) =>
      ctx.topology.combs.flatMap((info) =>
        info.incompatible.map((id) => ({
          ruleId: 'H-PENTE',
          severity: 'erro' as const,
          message: `Pente posicionado sobre ${ctx.device(id)?.label ?? id}, que não é compatível.`,
          targetKind: 'comb' as const,
          targetId: info.combId,
        })),
      ),
  },
  {
    id: 'H-DISJUNTOR-NO-NEUTRO',
    kind: 'heuristica',
    title: 'Disjuntor unipolar no neutro',
    description: 'O neutro não deve ser seccionado isoladamente por um disjuntor unipolar.',
    source: SRC('boa prática; NBR 5410 trata do seccionamento do neutro (item a confirmar)'),
    applicability: 'Disjuntores unipolares.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Abrir só o neutro deixa o equipamento energizado pela fase — situação perigosa na manutenção.',
    verification: { status: 'pendente', notes: 'Fundamentação normativa específica a confirmar.', reviewedAt: REV },
    validate: (ctx) =>
      ctx.project.devices.flatMap((d) => {
        const item = getCatalogItem(d.catalogId);
        if (!item || item.category !== 'disjuntor' || item.dimensions.widthModules !== 1) return [];
        const s = ctx.topology.netSources(terminalKey({ owner: d.id, terminal: 'T1' }));
        if (s.length === 1 && s[0] === 'N') {
          return [
            {
              ruleId: 'H-DISJUNTOR-NO-NEUTRO',
              severity: 'erro' as const,
              message: `${d.label}: disjuntor unipolar instalado no neutro.`,
              targetKind: 'device' as const,
              targetId: d.id,
            },
          ];
        }
        return [];
      }),
  },
  {
    id: 'H-PROTECAO-DEDICADA',
    kind: 'heuristica',
    title: 'Disjuntor dedicado por circuito',
    description: 'Cada circuito terminal deve ter seu próprio dispositivo de proteção.',
    source: SRC('boa prática de projeto'),
    applicability: 'Circuitos terminais.',
    parameters: {},
    severity: 'alerta',
    didacticMessage: 'Circuitos que compartilham o disjuntor terminal são desligados juntos e dificultam o dimensionamento.',
    verification: didactic('Boa prática.'),
    validate: (ctx) => {
      const counts = new Map<string, string[]>();
      for (const [id, t] of ctx.topology.circuits) {
        if (!t.protectiveBreakerId) continue;
        counts.set(t.protectiveBreakerId, [...(counts.get(t.protectiveBreakerId) ?? []), id]);
      }
      return [...counts]
        .filter(([, ids]) => ids.length > 1)
        .map(([dev, ids]) => ({
          ruleId: 'H-PROTECAO-DEDICADA',
          severity: 'alerta' as const,
          message: `${ctx.device(dev)?.label} protege diretamente ${ids.map((i) => ctx.circuitLabel(i)).join(' e ')}.`,
          targetKind: 'device' as const,
          targetId: dev,
        }));
    },
  },
  {
    id: 'H-MULTIPOLAR',
    kind: 'heuristica',
    title: 'Circuitos com duas ou três fases devem usar disjuntor multipolar',
    description: 'Todas as fases do circuito devem ser seccionadas simultaneamente.',
    source: SRC('boa prática; disjuntores multipolares com acionamento conjunto'),
    applicability: 'Circuitos F-F e trifásicos.',
    parameters: {},
    severity: 'alerta',
    didacticMessage: 'Com disjuntores unipolares independentes, uma fase pode continuar energizada após o disparo da outra.',
    verification: didactic('Boa prática.'),
    validate: (ctx) =>
      ctx.project.circuits.flatMap((c) => {
        const t = ctx.topology.circuits.get(c.id);
        return t?.splitPhaseProtection
          ? [
              {
                ruleId: 'H-MULTIPOLAR',
                severity: 'alerta' as const,
                message: `${ctx.circuitLabel(c.id)}: fases protegidas por disjuntores independentes.`,
                targetKind: 'circuit' as const,
                targetId: c.id,
              },
            ]
          : [];
      }),
  },
  {
    id: 'H-FASES-DISTINTAS',
    kind: 'heuristica',
    title: 'Circuito bifásico/trifásico ligado à mesma fase',
    description: 'Os bornes de fase de um circuito F-F ou trifásico precisam receber fases diferentes.',
    source: SRC('consistência elétrica'),
    applicability: 'Circuitos F-F e trifásicos.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Duas pontas na mesma fase resultam em tensão nula sobre a carga.',
    verification: didactic('Consistência elétrica.'),
    validate: (ctx) =>
      ctx.project.circuits.flatMap((c) => {
        const ph = ctx.topology.circuits.get(c.id)?.phasesReached.filter(Boolean) ?? [];
        return new Set(ph).size < ph.length
          ? [
              {
                ruleId: 'H-FASES-DISTINTAS',
                severity: 'erro' as const,
                message: `${ctx.circuitLabel(c.id)}: bornes de fase ligados à mesma fase (${ph.join(', ')}).`,
                targetKind: 'circuit' as const,
                targetId: c.id,
              },
            ]
          : [];
      }),
  },
  {
    id: 'H-DPS-LIGACAO',
    kind: 'heuristica',
    title: 'Ligação do DPS',
    description: 'O DPS deve estar entre um condutor vivo (fase ou neutro) e o PE.',
    source: SRC('princípio de funcionamento do DPS'),
    applicability: 'Todos os DPS.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Sem ligação ao PE o DPS não tem para onde desviar o surto. Ele não substitui disjuntor, DR nem aterramento.',
    verification: didactic('Princípio de funcionamento.'),
    validate: (ctx) =>
      ctx.project.devices.flatMap((d) => {
        if (ctx.spd(d.id) === null) return [];
        const out: Finding[] = [];
        const line = ctx.topology.netSources(terminalKey({ owner: d.id, terminal: 'L' }));
        const pe = ctx.topology.netSources(terminalKey({ owner: d.id, terminal: 'PE' }));
        if (!pe.includes('PE')) {
          out.push({ ruleId: 'H-DPS-LIGACAO', severity: 'erro', message: `${d.label}: borne de terra não ligado ao PE.`, targetKind: 'device', targetId: d.id });
        }
        if (!line.length) {
          out.push({ ruleId: 'H-DPS-LIGACAO', severity: 'erro', message: `${d.label}: borne de linha sem ligação.`, targetKind: 'device', targetId: d.id });
        }
        if (d.spd?.endOfLife) {
          out.push({
            ruleId: 'H-DPS-LIGACAO',
            severity: 'alerta',
            message: `${d.label}: indicador de fim de vida acionado — substituir o DPS.`,
            targetKind: 'device',
            targetId: d.id,
          });
        }
        return out;
      }),
  },
  {
    id: 'H-DPS-UC',
    kind: 'heuristica',
    title: 'Tensão máxima de operação contínua do DPS (critério simplificado)',
    description: 'Critério simplificado: Uc ≥ 1,1·U0. O valor mínimo real depende do esquema de aterramento e do modo de ligação.',
    source: { document: 'NBR5410', clause: '6.3.5 e tabela de Uc mínimo (valores por esquema não conferidos)', clauseConfirmed: false },
    applicability: 'DPS ligados entre fase e PE ou neutro e PE.',
    parameters: { fator: 1.1 },
    severity: 'alerta',
    didacticMessage: 'Uc baixa demais faz o DPS conduzir em regime normal e envelhecer prematuramente.',
    verification: { status: 'pendente', notes: 'A tabela da NBR 5410 varia com o esquema (TT, TN, IT); verificação pendente.', reviewedAt: REV },
    validate: (ctx) =>
      ctx.project.devices.flatMap((d): Finding[] => {
        const p = ctx.spd(d.id);
        if (!p) return [];
        if (p.ucV === null) {
          return [{ ruleId: 'H-DPS-UC', severity: 'inconclusivo' as const, message: `${d.label}: Uc desconhecida.`, targetKind: 'device' as const, targetId: d.id }];
        }
        const min = 1.1 * ctx.voltages.u0;
        return p.ucV < min
          ? [
              {
                ruleId: 'H-DPS-UC',
                severity: 'alerta' as const,
                message: `${d.label}: Uc = ${p.ucV} V < 1,1·U0 = ${formatNumberBR(min, 0)} V (critério simplificado).`,
                targetKind: 'device' as const,
                targetId: d.id,
              },
            ]
          : [];
      }),
  },
  {
    id: 'H-DR-SOBRECORRENTE',
    kind: 'heuristica',
    title: 'Interruptor DR protegido contra sobrecorrentes',
    description: 'O interruptor DR não tem proteção de sobrecorrente própria; precisa de disjuntor a montante com In compatível.',
    source: SRC('instruções usuais de fabricantes; norma de produto do DR'),
    applicability: 'Interruptores DR (sem proteção de sobrecorrente).',
    parameters: {},
    severity: 'alerta',
    didacticMessage: 'Sem disjuntor coordenado, uma sobrecarga pode danificar os contatos do DR.',
    verification: didactic('Critério didático simplificado: In do disjuntor a montante ≤ In do DR.'),
    validate: (ctx) =>
      ctx.project.devices.flatMap((d) => {
        const p = ctx.rcd(d.id);
        if (!p) return [];
        const topo = ctx.topology.devices.get(d.id);
        if (!topo?.lineSide) return [];
        const up = topo.upstream.find((id) => ctx.breaker(id));
        if (!up) {
          return [{ ruleId: 'H-DR-SOBRECORRENTE', severity: 'alerta' as const, message: `${d.label}: sem disjuntor a montante.`, targetKind: 'device' as const, targetId: d.id }];
        }
        const b = ctx.breaker(up)!;
        if (b.ratedCurrentA !== null && p.ratedCurrentA !== null && b.ratedCurrentA > p.ratedCurrentA) {
          return [
            {
              ruleId: 'H-DR-SOBRECORRENTE',
              severity: 'alerta' as const,
              message: `${d.label} (${p.ratedCurrentA} A) está a jusante de ${ctx.device(up)?.label} de ${b.ratedCurrentA} A.`,
              targetKind: 'device' as const,
              targetId: d.id,
              hint: 'Escolha DR com In ≥ In do disjuntor a montante.',
            },
          ];
        }
        return [];
      }),
  },
  {
    id: 'H-SELETIVIDADE',
    kind: 'heuristica',
    title: 'Indicação de seletividade entre disjuntores',
    description: 'Condição necessária (não suficiente): In a montante maior que In a jusante.',
    source: SRC('princípio de coordenação'),
    applicability: 'Disjuntores em série.',
    parameters: {},
    severity: 'alerta',
    didacticMessage: 'Seletividade real exige tabelas de coordenação do fabricante; o simulador só verifica a condição necessária.',
    verification: didactic('Condição necessária simplificada.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      for (const d of ctx.project.devices) {
        const b = ctx.breaker(d.id);
        if (!b || b.ratedCurrentA === null) continue;
        const up = ctx.topology.devices.get(d.id)?.upstream.find((id) => ctx.breaker(id));
        if (!up) continue;
        const bu = ctx.breaker(up)!;
        if (bu.ratedCurrentA !== null && bu.ratedCurrentA <= b.ratedCurrentA) {
          out.push({
            ruleId: 'H-SELETIVIDADE',
            severity: 'alerta',
            message: `${ctx.device(up)?.label} (${bu.ratedCurrentA} A) a montante de ${d.label} (${b.ratedCurrentA} A): não há seletividade.`,
            targetKind: 'device',
            targetId: d.id,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'H-FIACAO-INTERNA',
    kind: 'heuristica',
    title: 'Fiação interna protegida pelo dispositivo a montante',
    description:
      'Condutores internos de distribuição devem ter capacidade de condução compatível com o disjuntor que os protege (hipótese didática: método B1, 30 °C, 2 condutores carregados, sem agrupamento).',
    source: SRC('hipótese didática de instalação da fiação interna'),
    applicability: 'Condutores de fase ou neutro a montante dos disjuntores terminais.',
    parameters: { metodo: 'B1', ambienteC: 30 },
    severity: 'alerta',
    didacticMessage: 'Um condutor interno fino demais pode aquecer antes que o disjuntor geral atue.',
    verification: didactic('Hipótese de instalação didática, não normativa.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      const protectedBy = new Map<string, string>();
      for (const t of ctx.topology.circuits.values()) {
        for (const tr of t.conductors) {
          if (tr.expected === 'PE') continue;
          // os condutores do caminho entre o disjuntor terminal e a fonte são protegidos pelo próximo disjuntor a montante
          const breakers = tr.devices.filter((x) => x.category === 'disjuntor');
          if (breakers.length < 2) continue;
          const upstream = breakers[1].deviceId;
          for (const wid of tr.wires) {
            const w = ctx.project.wires.find((x) => x.id === wid);
            if (!w) continue;
            const isTerminal = w.from.owner.startsWith('circ:') || w.to.owner.startsWith('circ:');
            if (!isTerminal && !protectedBy.has(wid)) protectedBy.set(wid, upstream);
          }
        }
      }
      for (const [wid, devId] of protectedBy) {
        const w = ctx.project.wires.find((x) => x.id === wid)!;
        const b = ctx.breaker(devId);
        if (!b || b.ratedCurrentA === null) continue;
        const amp = conductorAmpacity({
          sectionMm2: w.sectionMm2,
          material: w.material,
          insulation: w.insulation,
          method: 'B1',
          loadedConductors: 2,
          ambientTempC: 30,
          groupedCircuits: 1,
        });
        if (amp.status === 'ok' && amp.value.izA < b.ratedCurrentA) {
          out.push({
            ruleId: 'H-FIACAO-INTERNA',
            severity: 'alerta',
            message: `Condutor interno de ${formatNumberBR(w.sectionMm2)} mm² (Iz ≈ ${formatNumberBR(amp.value.izA)} A) protegido por ${ctx.device(devId)?.label} de ${b.ratedCurrentA} A.`,
            targetKind: 'wire',
            targetId: wid,
            hint: 'Use seção compatível com a corrente nominal do disjuntor a montante.',
          });
        }
      }
      return out;
    },
  },
  {
    id: 'H-DEMANDA',
    kind: 'heuristica',
    title: 'Soma das correntes de projeto por fase × disjuntor geral',
    description: 'Comparação sem fatores de demanda (que não são modelados): indica possível subdimensionamento do geral.',
    source: SRC('estimativa didática sem fator de demanda'),
    applicability: 'Quadros com disjuntor geral.',
    parameters: {},
    severity: 'info',
    didacticMessage: 'O cálculo real da demanda usa fatores de simultaneidade definidos pela concessionária e pelo projeto.',
    verification: didactic('Estimativa simplificada.'),
    validate: (ctx) => {
      const perPhase = new Map<string, number>();
      for (const c of ctx.project.circuits) {
        const ib = ctx.sizing.get(c.id)?.designCurrentA;
        if (!ib) continue;
        for (const ph of ctx.topology.circuits.get(c.id)?.phasesReached ?? []) if (ph) perPhase.set(ph, (perPhase.get(ph) ?? 0) + ib);
      }
      const roots = ctx.project.devices.filter((d) => ctx.breaker(d.id) && ctx.topology.devices.get(d.id)?.lineSide && !ctx.topology.devices.get(d.id)?.upstream.length);
      const main = roots.sort((a, b) => (ctx.breaker(b.id)?.ratedCurrentA ?? 0) - (ctx.breaker(a.id)?.ratedCurrentA ?? 0))[0];
      if (!main || !perPhase.size) return [];
      const inA = ctx.breaker(main.id)?.ratedCurrentA;
      const max = Math.max(...perPhase.values());
      return [
        {
          ruleId: 'H-DEMANDA',
          severity: 'info',
          message: `Soma de Ib por fase: ${[...perPhase].map(([p, v]) => `${p} = ${formatNumberBR(v, 1)} A`).join('; ')}. Geral ${main.label}: ${inA ?? '?'} A${inA && max > inA ? ' — soma excede o geral (sem considerar demanda).' : '.'}`,
          targetKind: 'device',
          targetId: main.id,
        },
      ];
    },
  },
  {
    id: 'H-QUEDA-META',
    kind: 'heuristica',
    title: 'Meta de queda de tensão do exercício',
    description: 'Algumas atividades definem metas mais rigorosas que o limite normativo.',
    source: SRC('meta didática configurada no circuito'),
    applicability: 'Circuitos cuja meta é do tipo "exercício".',
    parameters: {},
    severity: 'alerta',
    didacticMessage: 'Metas didáticas não são limites normativos.',
    verification: didactic('Meta configurável.'),
    validate: (ctx) =>
      ctx.project.circuits.flatMap((c) => {
        if (c.voltageDropLimitSource !== 'exercicio' || c.sectionMm2 === null) return [];
        const cr = ctx.sizing.get(c.id)?.chosen?.criteria.find((x) => x.id === 'queda-tensao');
        return cr?.status === 'falha'
          ? [{ ruleId: 'H-QUEDA-META', severity: 'alerta' as const, message: `${ctx.circuitLabel(c.id)}: ${cr.detail}`, targetKind: 'circuit' as const, targetId: c.id }]
          : [];
      }),
  },
  {
    id: 'H-LACOS',
    kind: 'heuristica',
    title: 'Laços e caminhos paralelos',
    description: 'Condutores em paralelo ou laços dificultam a análise e podem dividir correntes de forma indesejada.',
    source: SRC('consistência do modelo'),
    applicability: 'Toda a montagem.',
    parameters: {},
    severity: 'alerta',
    didacticMessage: 'Em quadros residenciais a distribuição é radial: cada trecho tem um único caminho até a fonte.',
    verification: didactic('Contagem de ciclos no grafo.'),
    validate: (ctx) =>
      ctx.topology.loops > 0
        ? [
            {
              ruleId: 'H-LACOS',
              severity: 'alerta',
              message: `A montagem possui ${ctx.topology.loops} laço(s)/caminho(s) paralelo(s).`,
              targetKind: 'project',
              targetId: null,
            },
          ]
        : [],
  },
  {
    id: 'H-DADOS-DESCONHECIDOS',
    kind: 'heuristica',
    title: 'Dispositivos com dados desconhecidos',
    description: 'Parâmetros desconhecidos não são presumidos; as verificações que dependem deles ficam inconclusivas.',
    source: SRC('política de dados do simulador'),
    applicability: 'Dispositivos com campos nulos.',
    parameters: {},
    severity: 'inconclusivo',
    didacticMessage: 'Sem ficha técnica não há como afirmar que a proteção é adequada.',
    verification: didactic('Política de dados.'),
    validate: (ctx) =>
      ctx.project.devices.flatMap((d) => {
        const b = ctx.breaker(d.id);
        const r = ctx.rcd(d.id);
        const missing: string[] = [];
        if (b) {
          if (b.ratedCurrentA === null) missing.push('In');
          if (b.curve === null) missing.push('curva');
          if (b.breakingCapacityKA === null) missing.push('Icn');
        }
        if (r) {
          if (r.residualCurrentMA === null) missing.push('IΔn');
          if (r.rcdType === null) missing.push('tipo');
        }
        return missing.length
          ? [
              {
                ruleId: 'H-DADOS-DESCONHECIDOS',
                severity: 'inconclusivo' as const,
                message: `${d.label}: dados desconhecidos (${missing.join(', ')}).`,
                targetKind: 'device' as const,
                targetId: d.id,
              },
            ]
          : [];
      }),
  },
  {
    id: 'H-FALHAS-ATIVAS',
    kind: 'heuristica',
    title: 'Falhas didáticas ativas',
    description: 'Lista falhas injetadas pelo modo de demonstração.',
    source: SRC('modo seguro de demonstração'),
    applicability: 'Quando há falhas simuladas.',
    parameters: {},
    severity: 'info',
    didacticMessage: 'Falhas são simuladas apenas virtualmente.',
    verification: didactic('Informativo.'),
    validate: (ctx) =>
      ctx.project.simulation.faults.map((f) => ({
        ruleId: 'H-FALHAS-ATIVAS',
        severity: 'info' as const,
        message: `Falha simulada ativa em ${ctx.circuitLabel(f.circuitId)}: ${f.kind}.`,
        targetKind: 'circuit' as const,
        targetId: f.circuitId,
      })),
  },
];
