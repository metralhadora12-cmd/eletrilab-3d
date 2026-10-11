/**
 * Regras NORMATIVAS implementadas (NBR 5410 e referências análogas).
 *
 * Nenhuma regra está marcada como 'verificado-fonte-primaria': o texto oficial
 * não foi acessado. Os itens foram conferidos em fontes técnicas secundárias
 * (ver TECHNICAL_SOURCES.md). Numerações não confirmadas são indicadas.
 */
import type { Finding, ValidationContext } from '../../electrical/validation/context';
import type { Criterion } from '../../electrical/calculations/conductorSizing';
import { protectiveConductorMinSection } from '../../electrical/calculations/protection';
import { voltageDrop } from '../../electrical/calculations/voltageDrop';
import { colorAllowsFunction, FUNCTION_LABEL, WIRE_COLORS } from '../../catalog/colors';
import { formatNumberBR } from '../../electrical/core/units';
import { TOUCH_VOLTAGE_LIMIT_V } from '../../electrical/core/constants';
import type { Location } from '../../model/schema';
import { isCircuitOwner } from '../../model/schema';
import type { NormativeRule } from '../types';

const REV = '2026-10-11';
const secondary = (notes: string) => ({ status: 'fonte-secundaria' as const, notes, reviewedAt: REV });

function criterion(ctx: ValidationContext, circuitId: string, id: Criterion['id']) {
  return ctx.sizing.get(circuitId)?.chosen?.criteria.find((c) => c.id === id) ?? null;
}

function fromCriterion(
  ctx: ValidationContext,
  ruleId: string,
  id: Criterion['id'],
  failSeverity: 'erro' | 'alerta',
  hint: string,
): Finding[] {
  const out: Finding[] = [];
  for (const c of ctx.project.circuits) {
    if (c.sectionMm2 === null) continue;
    const cr = criterion(ctx, c.id, id);
    if (!cr || cr.status === 'ok' || cr.status === 'nao-avaliado') continue;
    out.push({
      ruleId,
      severity: cr.status === 'falha' ? failSeverity : 'inconclusivo',
      message: `${ctx.circuitLabel(c.id)} — ${cr.label}: ${cr.detail}`,
      targetKind: 'circuit',
      targetId: c.id,
      hint: cr.status === 'falha' ? hint : undefined,
    });
  }
  return out;
}

export const DR_REQUIRED_LOCATIONS: Location[] = [
  'banheiro',
  'cozinha',
  'area-servico',
  'lavanderia',
  'garagem',
  'area-externa',
];

export const NORMATIVE_RULES: NormativeRule[] = [
  {
    id: 'NBR5410-SECAO-MINIMA',
    kind: 'normativa',
    title: 'Seção mínima dos condutores de fase',
    description: 'Circuitos de iluminação: 1,5 mm² (cobre). Circuitos de força, incluindo tomadas: 2,5 mm² (cobre).',
    source: { document: 'NBR5410', clause: '6.2.6.1.1 e tabela de seções mínimas', clauseConfirmed: false },
    applicability: 'Circuitos terminais em corrente alternada com condutores de cobre.',
    parameters: { iluminacaoMm2: 1.5, forcaMm2: 2.5 },
    severity: 'erro',
    didacticMessage:
      'A seção mínima garante resistência mecânica e uma margem básica de segurança; ela não dispensa os demais critérios de dimensionamento.',
    verification: secondary('Valores consistentes em múltiplas fontes; numeração da tabela não confirmada.'),
    validate: (ctx) => {
      const out = fromCriterion(ctx, 'NBR5410-SECAO-MINIMA', 'secao-minima', 'erro', 'Aumente a seção do circuito.');
      for (const c of ctx.project.circuits) {
        if (c.sectionMm2 === null) {
          out.push({
            ruleId: 'NBR5410-SECAO-MINIMA',
            severity: 'inconclusivo',
            message: `${ctx.circuitLabel(c.id)}: seção dos condutores não definida — verificações de dimensionamento não executadas.`,
            targetKind: 'circuit',
            targetId: c.id,
            hint: 'Defina a seção no editor de circuitos (use a seção mínima calculada como referência).',
          });
        }
      }
      return out;
    },
  },
  {
    id: 'NBR5410-CAPACIDADE',
    kind: 'normativa',
    title: 'Capacidade de condução de corrente',
    description: 'A corrente de projeto não pode exceder a capacidade de condução corrigida do condutor (Iz ≥ Ib).',
    source: { document: 'NBR5410', clause: '6.2.5', clauseConfirmed: false },
    applicability: 'Todos os circuitos com seção definida e condições de instalação informadas.',
    parameters: { referenciaAmbienteC: 30 },
    severity: 'erro',
    didacticMessage:
      'A capacidade de condução depende do método de instalação, da temperatura ambiente e do agrupamento — não existe valor fixo por seção.',
    verification: secondary('Princípio consolidado; valores de I0 do conjunto de referência são de fonte secundária.'),
    validate: (ctx) => fromCriterion(ctx, 'NBR5410-CAPACIDADE', 'capacidade', 'erro', 'Aumente a seção ou melhore as condições de instalação.'),
  },
  {
    id: 'NBR5410-SOBRECARGA',
    kind: 'normativa',
    title: 'Coordenação entre condutor e proteção contra sobrecarga',
    description: 'Ib ≤ In ≤ Iz e I2 ≤ 1,45·Iz.',
    source: { document: 'NBR5410', clause: '5.3.4.1', clauseConfirmed: false },
    applicability: 'Circuitos protegidos por disjuntor com In conhecida.',
    parameters: { fatorI2: 1.45 },
    severity: 'erro',
    didacticMessage:
      'O disjuntor protege o CONDUTOR: sua corrente nominal deve ser maior que a corrente de projeto e menor que a capacidade do cabo.',
    verification: secondary('Condição clássica de coordenação, idêntica à IEC 60364-4-43 (433.1).'),
    validate: (ctx) =>
      fromCriterion(ctx, 'NBR5410-SOBRECARGA', 'sobrecarga', 'erro', 'Ajuste In do disjuntor e/ou aumente a seção do condutor.'),
  },
  {
    id: 'NBR5410-QUEDA-TERMINAL',
    kind: 'normativa',
    title: 'Queda de tensão em circuito terminal',
    description: 'Em nenhum caso a queda de tensão nos circuitos terminais pode ser superior a 4 %.',
    source: { document: 'NBR5410', clause: '6.2.7.2', clauseConfirmed: false },
    applicability: 'Circuitos terminais com comprimento informado (não se aplica ao período de partida de motores).',
    parameters: { limitePct: 4 },
    severity: 'erro',
    didacticMessage: 'Queda de tensão excessiva reduz o desempenho dos equipamentos e aumenta as perdas.',
    verification: secondary('Item e limite transcritos de forma consistente em fontes técnicas secundárias.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      for (const c of ctx.project.circuits) {
        const sz = ctx.sizing.get(c.id);
        if (c.sectionMm2 === null || !sz?.designCurrentA || !sz.load) continue;
        const vd = voltageDrop({
          currentA: sz.designCurrentA,
          lengthM: c.lengthM,
          sectionMm2: c.sectionMm2,
          material: c.material,
          insulation: c.insulation,
          powerFactor: sz.load.powerFactor,
          connection: c.connection,
          voltages: ctx.voltages,
          limitPct: 4,
        });
        if (vd.status === 'inconclusivo') {
          out.push({
            ruleId: 'NBR5410-QUEDA-TERMINAL',
            severity: 'inconclusivo',
            message: `${ctx.circuitLabel(c.id)}: queda de tensão não verificável — ${vd.message}.`,
            targetKind: 'circuit',
            targetId: c.id,
          });
        } else if (vd.status === 'ok' && !vd.value.pass) {
          out.push({
            ruleId: 'NBR5410-QUEDA-TERMINAL',
            severity: 'erro',
            message: `${ctx.circuitLabel(c.id)}: queda de ${formatNumberBR(vd.value.percent)} % > 4 % (limite normativo).`,
            targetKind: 'circuit',
            targetId: c.id,
            hint: 'Aumente a seção ou reduza o comprimento do circuito.',
          });
        }
      }
      return out;
    },
  },
  {
    id: 'NBR5410-QUEDA-TOTAL',
    kind: 'normativa',
    title: 'Queda de tensão total desde o ponto de entrega',
    description: 'Fornecimento em tensão secundária de distribuição: queda máxima de 5 % a partir do ponto de entrega.',
    source: { document: 'NBR5410', clause: '6.2.7.1 c)', clauseConfirmed: false },
    applicability: 'Unidades alimentadas diretamente pela rede pública de baixa tensão.',
    parameters: { limitePct: 5 },
    severity: 'erro',
    didacticMessage: 'A queda acumulada (alimentador + circuito terminal) deve respeitar o limite total.',
    verification: secondary('Limite transcrito em fontes secundárias; outras alíneas (7 %) aplicam-se a transformador próprio.'),
    validate: (ctx) => {
      const out = fromCriterion(ctx, 'NBR5410-QUEDA-TOTAL', 'queda-total', 'erro', 'Reduza a queda no alimentador ou no circuito.');
      if (ctx.project.supply.upstreamVoltageDropPct === null && ctx.project.circuits.length && ctx.profile !== 'aprendizado') {
        out.push({
          ruleId: 'NBR5410-QUEDA-TOTAL',
          severity: 'inconclusivo',
          message: 'Queda de tensão a montante do quadro não informada: o limite total (5 %) não pode ser verificado.',
          targetKind: 'project',
          targetId: null,
        });
      }
      return out;
    },
  },
  {
    id: 'NBR5410-CURTO-CIRCUITO',
    kind: 'normativa',
    title: 'Proteção contra curtos-circuitos',
    description:
      'O dispositivo deve interromper qualquer curto-circuito antes que os condutores atinjam a temperatura limite (I²t ≤ k²S²).',
    source: { document: 'NBR5410', clause: '5.3.5', clauseConfirmed: false },
    applicability: 'Requer Icc presumida, comprimento do circuito, curva e In do dispositivo.',
    parameters: { kCuPVC: 115, kCuXLPE: 143 },
    severity: 'erro',
    didacticMessage:
      'Sem a energia I²t de passagem informada pelo fabricante, o simulador só consegue concluir em casos com folga; nos demais, o resultado é inconclusivo.',
    verification: secondary('Critério adiabático e fatores k análogos à IEC 60364-4-43.'),
    validate: (ctx) => fromCriterion(ctx, 'NBR5410-CURTO-CIRCUITO', 'curto-circuito', 'erro', ''),
  },
  {
    id: 'NBR5410-CAPACIDADE-INTERRUPCAO',
    kind: 'normativa',
    title: 'Capacidade de interrupção',
    description: 'A capacidade de interrupção do dispositivo deve ser no mínimo igual à corrente de curto-circuito presumida no ponto de instalação.',
    source: { document: 'NBR5410', clause: '5.3.5', clauseConfirmed: false },
    applicability: 'Dispositivos de proteção contra curto-circuito; requer Icc presumida no quadro.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Um disjuntor com Icn insuficiente pode não extinguir o arco com segurança.',
    verification: secondary('Princípio consolidado (IEC 60364-4-43, 434.5.1).'),
    validate: (ctx) =>
      fromCriterion(ctx, 'NBR5410-CAPACIDADE-INTERRUPCAO', 'capacidade-interrupcao', 'erro', 'Escolha disjuntor com Icn maior.'),
  },
  {
    id: 'NBR5410-DR-30MA',
    kind: 'normativa',
    title: 'DR de alta sensibilidade em locais específicos',
    description:
      'Circuitos que servem locais com banheira ou chuveiro, áreas externas, cozinhas, copas-cozinhas, lavanderias, áreas de serviço, garagens e áreas internas molhadas devem ser protegidos por DR com IΔn ≤ 30 mA.',
    source: { document: 'NBR5410', clause: '5.1.3.2.2', clauseConfirmed: false },
    applicability: 'Locais de habitação. O simulador usa os ambientes informados no circuito; tomadas internas que possam alimentar equipamentos externos devem ser marcadas como "área externa".',
    parameters: { idnMaxMA: 30, locais: DR_REQUIRED_LOCATIONS.join(', ') },
    severity: 'erro',
    didacticMessage: 'O DR de 30 mA é proteção adicional contra choques em locais de maior risco.',
    verification: secondary('Item 5.1.3.2.2 transcrito de forma consistente em fontes secundárias. A revisão em andamento pode ampliar a exigência.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      for (const c of ctx.project.circuits) {
        const needs = c.kind === 'chuveiro' || c.locations.some((l) => DR_REQUIRED_LOCATIONS.includes(l));
        if (!needs) continue;
        const topo = ctx.topology.circuits.get(c.id);
        if (!topo?.connected) continue;
        const rcds = topo.rcdIds.map((id) => ({ id, p: ctx.rcd(id) }));
        if (!rcds.length) {
          out.push({
            ruleId: 'NBR5410-DR-30MA',
            severity: 'erro',
            message: `${ctx.circuitLabel(c.id)} atende ${c.kind === 'chuveiro' ? 'local com chuveiro' : c.locations.join(', ')} e não está protegido por DR.`,
            targetKind: 'circuit',
            targetId: c.id,
            hint: 'Passe fase(s) e neutro do circuito por um DR de 30 mA.',
          });
          continue;
        }
        const ok = rcds.some((r) => r.p?.residualCurrentMA != null && r.p.residualCurrentMA <= 30);
        const unknown = rcds.every((r) => r.p?.residualCurrentMA == null);
        if (!ok) {
          out.push({
            ruleId: 'NBR5410-DR-30MA',
            severity: unknown ? 'inconclusivo' : 'erro',
            message: unknown
              ? `${ctx.circuitLabel(c.id)}: IΔn do DR desconhecida.`
              : `${ctx.circuitLabel(c.id)}: DR com IΔn > 30 mA não atende à proteção adicional exigida.`,
            targetKind: 'circuit',
            targetId: c.id,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'NBR5410-IDENTIFICACAO-CORES',
    kind: 'normativa',
    title: 'Identificação dos condutores por cor',
    description: 'Neutro: azul-claro. Proteção (PE): verde-amarelo ou verde. Fase: qualquer cor, exceto as reservadas.',
    source: { document: 'NBR5410', clause: '6.1.5.3', clauseConfirmed: false },
    applicability: 'Condutores isolados e cabos unipolares identificados por cor.',
    parameters: { neutro: 'azul-claro', pe: 'verde-amarelo | verde' },
    severity: 'erro',
    didacticMessage:
      'A cor é a primeira informação de segurança para quem fará manutenção. A função real do condutor é obtida pelas ligações, não pela cor.',
    verification: secondary('Regras de cor consistentes em fontes secundárias; subitens 6.1.5.3.1 a 6.1.5.3.4 não conferidos no texto primário.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      for (const w of ctx.project.wires) {
        const f = ctx.topology.wireFunction.get(w.id);
        if (!f || !f.fn || f.conflict) continue;
        if (!colorAllowsFunction(w.color, f.fn)) {
          out.push({
            ruleId: 'NBR5410-IDENTIFICACAO-CORES',
            severity: 'erro',
            message: `Condutor ${WIRE_COLORS[w.color].name.toLowerCase()} está ligado como ${FUNCTION_LABEL[f.fn].toLowerCase()}${f.phase ? ` (${f.phase})` : ''}.`,
            targetKind: 'wire',
            targetId: w.id,
            hint:
              f.fn === 'N' ? 'Use azul-claro para o neutro.' : f.fn === 'PE' ? 'Use verde-amarelo (ou verde) para o PE.' : 'Fase não pode ser azul-claro, verde ou verde-amarelo.',
          });
        }
      }
      return out;
    },
  },
  {
    id: 'NBR5410-SECAO-PE',
    kind: 'normativa',
    title: 'Seção mínima do condutor de proteção',
    description: 'PE do mesmo material da fase: S ≤ 16 mm² → igual à fase; 16 < S ≤ 35 → 16 mm²; S > 35 → S/2.',
    source: { document: 'NBR5410', clause: 'tabela de seção mínima do condutor de proteção (6.4.3 — numeração a confirmar)', clauseConfirmed: false },
    applicability: 'Condutores PE dedicados a um circuito, mesmo material da fase.',
    parameters: { limiteIgual: 16 },
    severity: 'erro',
    didacticMessage: 'O PE precisa conduzir a corrente de falta até a atuação da proteção sem se danificar.',
    verification: secondary('Relação análoga à IEC 60364-5-54 Tabela 54.2.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      for (const c of ctx.project.circuits) {
        if (c.sectionMm2 === null) continue;
        const min = protectiveConductorMinSection(c.sectionMm2);
        const trace = ctx.topology.circuits.get(c.id)?.conductors.find((t) => t.expected === 'PE');
        for (const wid of trace?.wires ?? []) {
          const w = ctx.project.wires.find((x) => x.id === wid);
          const dedicated = w && (isCircuitOwner(w.from.owner) || isCircuitOwner(w.to.owner));
          if (w && dedicated && w.sectionMm2 < min) {
            out.push({
              ruleId: 'NBR5410-SECAO-PE',
              severity: 'erro',
              message: `${ctx.circuitLabel(c.id)}: PE de ${formatNumberBR(w.sectionMm2)} mm² < mínimo de ${formatNumberBR(min)} mm².`,
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
    id: 'NBR5410-NEUTRO',
    kind: 'normativa',
    title: 'Condutor neutro: seção e exclusividade',
    description:
      'O neutro de circuito monofásico deve ter a mesma seção da fase, e o neutro não pode ser comum a mais de um circuito.',
    source: { document: 'NBR5410', clause: '6.2.6.2', clauseConfirmed: false },
    applicability: 'Circuitos com neutro.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Neutro compartilhado mistura correntes de circuitos diferentes e impede o funcionamento correto do DR.',
    verification: secondary('Princípios consistentes em fontes secundárias; subitens não conferidos.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      for (const c of ctx.project.circuits) {
        const trace = ctx.topology.circuits.get(c.id)?.conductors.find((t) => t.expected === 'N');
        if (!trace) continue;
        for (const wid of trace.wires) {
          const w = ctx.project.wires.find((x) => x.id === wid);
          if (!w) continue;
          const owners = [w.from.owner, w.to.owner].filter(isCircuitOwner);
          if (owners.some((o) => o !== `circ:${c.id}`)) {
            out.push({
              ruleId: 'NBR5410-NEUTRO',
              severity: 'erro',
              message: `${ctx.circuitLabel(c.id)}: o neutro é derivado da saída de outro circuito (neutro comum).`,
              targetKind: 'wire',
              targetId: w.id,
              hint: 'Ligue o neutro de cada circuito diretamente ao barramento de neutro correspondente.',
            });
          }
          if (c.sectionMm2 !== null && owners.includes(`circ:${c.id}`) && w.sectionMm2 < c.sectionMm2 && c.connection === 'F-N') {
            out.push({
              ruleId: 'NBR5410-NEUTRO',
              severity: 'erro',
              message: `${ctx.circuitLabel(c.id)}: neutro de ${formatNumberBR(w.sectionMm2)} mm² menor que a fase (${formatNumberBR(c.sectionMm2)} mm²).`,
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
    id: 'NBR5410-TT-SECCIONAMENTO',
    kind: 'normativa',
    title: 'Esquema TT: seccionamento automático por DR (RA·IΔn ≤ UL)',
    description: 'No esquema TT, a proteção por seccionamento automático é feita por DR, com RA·IΔn ≤ 50 V (situação 1).',
    source: { document: 'NBR5410', clause: '5.1.2.2.4 (esquema TT — subitem a confirmar)', clauseConfirmed: false },
    applicability: 'Somente esquema TT.',
    parameters: { ULV: TOUCH_VOLTAGE_LIMIT_V },
    severity: 'erro',
    didacticMessage: 'Em TT a corrente de falta passa pelo solo e costuma ser baixa demais para o disjuntor: o DR é quem garante o seccionamento.',
    verification: secondary('Condição análoga à IEC 60364-4-41 (411.5.3).'),
    validate: (ctx) => {
      if (ctx.project.supply.earthing !== 'TT') return [];
      const out: Finding[] = [];
      const ra = ctx.project.supply.earthElectrodeResistanceOhm;
      for (const c of ctx.project.circuits) {
        const topo = ctx.topology.circuits.get(c.id);
        if (!topo?.connected) continue;
        if (!topo.rcdIds.length) {
          out.push({
            ruleId: 'NBR5410-TT-SECCIONAMENTO',
            severity: 'erro',
            message: `${ctx.circuitLabel(c.id)}: esquema TT sem DR a montante — seccionamento automático não assegurado.`,
            targetKind: 'circuit',
            targetId: c.id,
          });
          continue;
        }
        if (ra === null) {
          out.push({
            ruleId: 'NBR5410-TT-SECCIONAMENTO',
            severity: 'inconclusivo',
            message: `${ctx.circuitLabel(c.id)}: RA não informada — condição RA·IΔn ≤ 50 V não verificável.`,
            targetKind: 'circuit',
            targetId: c.id,
          });
          continue;
        }
        const idn = Math.max(...topo.rcdIds.map((id) => ctx.rcd(id)?.residualCurrentMA ?? Infinity)) / 1000;
        if (ra * idn > TOUCH_VOLTAGE_LIMIT_V) {
          out.push({
            ruleId: 'NBR5410-TT-SECCIONAMENTO',
            severity: 'erro',
            message: `${ctx.circuitLabel(c.id)}: RA·IΔn = ${formatNumberBR(ra * idn)} V > 50 V.`,
            targetKind: 'circuit',
            targetId: c.id,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'NBR5410-PE-SEM-SECCIONAMENTO',
    kind: 'normativa',
    title: 'Condutor de proteção não pode ser seccionado',
    description: 'Nenhum dispositivo de manobra ou proteção pode ser inserido no condutor de proteção.',
    source: { document: 'IEC60364-5-54', clause: '543.3 (correspondente na NBR 5410 a confirmar)', clauseConfirmed: false },
    applicability: 'Todos os condutores PE.',
    parameters: {},
    severity: 'erro',
    didacticMessage: 'Se o PE pudesse ser aberto, as massas ficariam sem aterramento sem que ninguém percebesse.',
    verification: secondary('Requisito da IEC 60364-5-54; equivalente na NBR 5410 não conferido.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      for (const c of ctx.project.circuits) {
        const pe = ctx.topology.circuits.get(c.id)?.conductors.find((t) => t.expected === 'PE');
        if (pe?.devices.length) {
          out.push({
            ruleId: 'NBR5410-PE-SEM-SECCIONAMENTO',
            severity: 'erro',
            message: `${ctx.circuitLabel(c.id)}: o PE passa por ${pe.devices.map((d) => ctx.device(d.deviceId)?.label).join(', ')}.`,
            targetKind: 'circuit',
            targetId: c.id,
            hint: 'Ligue o PE diretamente ao barramento de proteção.',
          });
        }
      }
      return out;
    },
  },
  {
    id: 'NBR5410-CIRCUITO-INDEPENDENTE',
    kind: 'normativa',
    title: 'Circuito independente para equipamentos acima de 10 A',
    description: 'Ponto de utilização destinado a equipamento com corrente nominal superior a 10 A deve constituir circuito independente.',
    source: { document: 'NBR5410', clause: '9.5.3 (subitem a confirmar)', clauseConfirmed: false },
    applicability: 'Locais de habitação.',
    parameters: { limiteA: 10 },
    severity: 'alerta',
    didacticMessage: 'Equipamentos de maior potência devem ter circuito próprio para não sobrecarregar outros pontos.',
    verification: secondary('Exigência citada em fontes secundárias; numeração não confirmada.'),
    validate: (ctx) => {
      const out: Finding[] = [];
      for (const c of ctx.project.circuits) {
        const units = c.loads.reduce((a, l) => a + l.quantity, 0);
        if (units <= 1) continue;
        const u = c.connection === 'F-N' ? ctx.voltages.u0 : ctx.voltages.u;
        const big = c.loads.find((l) => l.powerW / l.efficiency / l.powerFactor / (c.connection.startsWith('3') ? Math.sqrt(3) * u : u) > 10);
        if (big) {
          out.push({
            ruleId: 'NBR5410-CIRCUITO-INDEPENDENTE',
            severity: 'alerta',
            message: `${ctx.circuitLabel(c.id)}: "${big.name}" passa de 10 A e divide o circuito com outras cargas.`,
            targetKind: 'circuit',
            targetId: c.id,
            hint: 'Crie um circuito exclusivo para esse equipamento.',
          });
        }
      }
      return out;
    },
  },
];
