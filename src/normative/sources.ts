/**
 * Registro dos documentos técnicos de referência e de suas edições.
 *
 * Situação das edições verificada em 2026-10-11 por consulta a catálogos de
 * normas e à imprensa técnica (ver TECHNICAL_SOURCES.md). O texto integral das
 * normas NÃO foi acessado: por isso nenhuma regra recebe o status
 * 'verificado-fonte-primaria'.
 */

export interface TechnicalDocument {
  id: DocumentId;
  title: string;
  edition: string;
  editionStatus: string;
  scope: string;
}

export type DocumentId =
  | 'NBR5410'
  | 'NBRIEC61643-11'
  | 'NBRNM60898'
  | 'NBRIEC60947-2'
  | 'NBRNM61008'
  | 'NBRIEC61009-1'
  | 'IEC60364-5-52'
  | 'IEC60364-4-43'
  | 'IEC60364-5-54'
  | 'IEC60228'
  | 'ELETRILAB';

export const DOCUMENTS: Record<DocumentId, TechnicalDocument> = {
  NBR5410: {
    id: 'NBR5410',
    title: 'ABNT NBR 5410 — Instalações elétricas de baixa tensão',
    edition: '2004, Versão Corrigida 2008',
    editionStatus:
      'Vigente. Revisão em andamento (1ª consulta nacional nov/2023–fev/2024; 2ª consulta prevista). Regras podem mudar na nova edição.',
    scope: 'Projeto, execução e verificação de instalações de baixa tensão.',
  },
  'NBRIEC61643-11': {
    id: 'NBRIEC61643-11',
    title: 'ABNT NBR IEC 61643-11 — DPS conectados aos sistemas de baixa tensão: requisitos e métodos de ensaio',
    edition: '03/2021 (errata e edição corrigida em 05/2022)',
    editionStatus:
      'Vigente segundo catálogo consultado. A IEC 61643-11:2025 (Ed. 2) foi publicada internacionalmente; adoção pela ABNT não confirmada.',
    scope: 'Norma de produto: grandezas Uc, Up, In, Imax, Iimp e ensaios de DPS.',
  },
  NBRNM60898: {
    id: 'NBRNM60898',
    title: 'ABNT NBR NM 60898 — Disjuntores para proteção de sobrecorrentes para instalações domésticas e similares (IEC 60898:1995 MOD)',
    edition: '07/2004 (confirmada em 2022)',
    editionStatus:
      'Vigente segundo catálogo consultado. Não foi localizada uma "ABNT NBR IEC 60898-1"; as partes 2 (2019) e 3 (2021) existem como NBR IEC.',
    scope: 'Norma de produto de minidisjuntores: curvas B, C, D; correntes convencionais; Icn.',
  },
  'NBRIEC60947-2': {
    id: 'NBRIEC60947-2',
    title: 'ABNT NBR IEC 60947-2 — Dispositivos de manobra e comando de baixa tensão — Parte 2: Disjuntores',
    edition: 'Edição não confirmada nesta revisão',
    editionStatus: 'Aplicável a disjuntores de uso industrial/profissional; não usada nas regras do simulador.',
    scope: 'Disjuntores industriais (Icu, Ics).',
  },
  NBRNM61008: {
    id: 'NBRNM61008',
    title: 'ABNT NBR NM 61008 — Interruptores a corrente diferencial-residual sem proteção de sobrecorrentes (RCCB)',
    edition: 'Parte 2-1: 08/2005 (parte 1: edição a confirmar)',
    editionStatus: 'Referência nacional encontrada para interruptores DR.',
    scope: 'Norma de produto: IΔn, tempos de atuação, tipos AC/A.',
  },
  'NBRIEC61009-1': {
    id: 'NBRIEC61009-1',
    title: 'ABNT NBR IEC 61009-1 — Disjuntores a corrente diferencial-residual com proteção de sobrecorrentes (RCBO)',
    edition: '06/2023 (IEC 61009-1:2010 + AMD1:2012 + AMD2:2013)',
    editionStatus: 'Vigente segundo catálogo consultado.',
    scope: 'Norma de produto para DR com proteção de sobrecorrente incorporada.',
  },
  'IEC60364-5-52': {
    id: 'IEC60364-5-52',
    title: 'IEC 60364-5-52 — Low-voltage electrical installations — Selection and erection — Wiring systems',
    edition: '2009 + AMD1:2011',
    editionStatus: 'Referência internacional análoga à NBR 5410 (métodos de referência, fórmula de queda de tensão).',
    scope: 'Métodos de instalação, capacidade de condução, Anexo G (queda de tensão).',
  },
  'IEC60364-4-43': {
    id: 'IEC60364-4-43',
    title: 'IEC 60364-4-43 — Protection for safety — Protection against overcurrent',
    edition: '2008',
    editionStatus: 'Referência internacional análoga (coordenação Ib ≤ In ≤ Iz; I²t ≤ k²S²; fator k).',
    scope: 'Proteção contra sobrecorrentes.',
  },
  'IEC60364-5-54': {
    id: 'IEC60364-5-54',
    title: 'IEC 60364-5-54 — Earthing arrangements and protective conductors',
    edition: '2011',
    editionStatus: 'Referência internacional análoga (condutores de proteção).',
    scope: 'Aterramento e condutores de proteção.',
  },
  IEC60228: {
    id: 'IEC60228',
    title: 'IEC 60228 / ABNT NBR NM 280 — Condutores de cabos isolados',
    edition: 'IEC 60228:2004 / NBR NM 280:2011 (a confirmar)',
    editionStatus: 'Resistências máximas em CC a 20 °C por classe de encordoamento.',
    scope: 'Resistência elétrica dos condutores.',
  },
  ELETRILAB: {
    id: 'ELETRILAB',
    title: 'Heurística educacional EletriLab',
    edition: 'v1',
    editionStatus: 'Critério didático — NÃO é requisito normativo.',
    scope: 'Boas práticas e verificações de consistência do modelo.',
  },
};
