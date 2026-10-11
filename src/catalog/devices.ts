/**
 * Catálogo de dispositivos GENÉRICOS DIDÁTICOS.
 *
 * Nenhum item abaixo representa produto de fabricante. Os valores são
 * conjuntos didáticos explicitamente identificados (source.status = 'didatico'),
 * escolhidos dentro das faixas preferenciais das normas de produto citadas
 * em TECHNICAL_SOURCES.md. Itens comerciais reais podem ser adicionados via
 * importação JSON, desde que tragam ficha técnica verificável (ver schema).
 */
import type { CatalogItem, TerminalDef, InternalLink } from './schema';

export const MODULE_MM = 18;
const REVIEWED = '2026-10-11';

const didacticSource = (reference: string, notes?: string) => ({
  kind: 'didatico' as const,
  reference,
  reviewedAt: REVIEWED,
  status: 'didatico' as const,
  notes,
});

const STANDARD_IN = [2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63];

function polesTerminals(poles: number, accepts: TerminalDef['accepts'], maxSection: number) {
  const terminals: TerminalDef[] = [];
  const internal: InternalLink[] = [];
  for (let k = 0; k < poles; k++) {
    const x = MODULE_MM / 2 + k * MODULE_MM;
    terminals.push({ id: `T${k + 1}`, label: String(2 * k + 1), side: 'top', xMm: x, accepts, maxSectionMm2: maxSection });
    terminals.push({ id: `B${k + 1}`, label: String(2 * k + 2), side: 'bottom', xMm: x, accepts, maxSectionMm2: maxSection });
    internal.push({ kind: 'pole', pole: k, a: `T${k + 1}`, b: `B${k + 1}` });
  }
  return { terminals, internal };
}

function genericBreaker(poles: 1 | 2 | 3 | 4): CatalogItem {
  // Disjuntores multipolares aceitam N em um polo (seccionamento do neutro junto com as fases).
  const accepts: TerminalDef['accepts'] = poles === 1 ? ['L'] : ['L', 'N'];
  const { terminals, internal } = polesTerminals(poles, accepts, 25);
  return {
    id: `disj-generico-${poles}p`,
    name: `Disjuntor termomagnético ${poles}P (genérico didático)`,
    category: 'disjuntor',
    origin: 'generico-didatico',
    manufacturer: null,
    model: null,
    description:
      'Minidisjuntor modular para proteção contra sobrecargas e curtos-circuitos. Corrente nominal, curva e capacidade de interrupção são configuráveis entre valores preferenciais da norma de produto.',
    keywords: ['disjuntor', 'minidisjuntor', 'termomagnético', `${poles}p`, 'curva', 'mcb'],
    dimensions: { widthModules: poles, widthMm: poles * MODULE_MM, heightMm: 85, depthMm: 72 },
    appearance: { bodyColor: '#eceeef', accentColor: '#2b2f36', material: 'termoplastico' },
    terminals,
    internal,
    electrical: {
      category: 'disjuntor',
      standard: 'ABNT NBR NM 60898 (disjuntores para instalações domésticas e similares)',
      poles,
      ratedCurrentA: 16,
      curve: 'C',
      ratedVoltageV: poles === 1 ? 230 : 400,
      breakingCapacityKA: 4.5,
      frequencyHz: 60,
    },
    configurable: {
      ratedCurrentA: STANDARD_IN,
      curve: ['B', 'C', 'D'],
      breakingCapacityKA: [3, 4.5, 6, 10],
    },
    compatibility: { mounting: 'trilho-din-35', combCompatible: true, maxConductorsPerTerminal: 2 },
    source: didacticSource(
      'Conjunto didático EletriLab — valores preferenciais de In, curvas B/C/D e Icn típicos de minidisjuntores (IEC 60898-1 / ABNT NBR NM 60898)',
      'Não representa produto de fabricante. Curva de atuação simulada por modelo didático.',
    ),
  };
}

const unknownBreaker: CatalogItem = {
  ...genericBreaker(1),
  id: 'disj-desconhecido-1p',
  name: 'Disjuntor 1P sem ficha técnica (dados incompletos)',
  description:
    'Dispositivo sem documentação: curva e capacidade de interrupção desconhecidas. Usado para demonstrar verificações inconclusivas — o simulador não presume valores ausentes.',
  keywords: ['disjuntor', 'desconhecido', 'sem dados', 'inconclusivo'],
  appearance: { bodyColor: '#d9d4c7', accentColor: '#4a4a4a', material: 'termoplastico' },
  electrical: {
    category: 'disjuntor',
    standard: 'desconhecida',
    poles: 1,
    ratedCurrentA: 20,
    curve: null,
    ratedVoltageV: null,
    breakingCapacityKA: null,
    frequencyHz: null,
  },
  configurable: {},
  source: {
    kind: 'didatico',
    reference: 'Item didático para demonstração de dados desconhecidos',
    reviewedAt: REVIEWED,
    status: 'pendente',
    notes: 'Curva, tensão e capacidade de interrupção propositalmente desconhecidas.',
  },
};

function genericRcd(poles: 2 | 4): CatalogItem {
  const phaseCount = poles - 1;
  const terminals: TerminalDef[] = [];
  const internal: InternalLink[] = [];
  for (let k = 0; k < phaseCount; k++) {
    const x = MODULE_MM / 2 + k * MODULE_MM;
    terminals.push({ id: `T${k + 1}`, label: String(2 * k + 1), side: 'top', xMm: x, accepts: ['L'], maxSectionMm2: 25 });
    terminals.push({ id: `B${k + 1}`, label: String(2 * k + 2), side: 'bottom', xMm: x, accepts: ['L'], maxSectionMm2: 25 });
    internal.push({ kind: 'pole', pole: k, a: `T${k + 1}`, b: `B${k + 1}` });
  }
  const xn = MODULE_MM / 2 + phaseCount * MODULE_MM;
  terminals.push({ id: 'TN', label: 'N', side: 'top', xMm: xn, accepts: ['N'], maxSectionMm2: 25 });
  terminals.push({ id: 'BN', label: "N'", side: 'bottom', xMm: xn, accepts: ['N'], maxSectionMm2: 25 });
  internal.push({ kind: 'pole', pole: phaseCount, a: 'TN', b: 'BN' });
  return {
    id: `dr-generico-${poles}p`,
    name: `Interruptor DR ${poles}P (genérico didático)`,
    category: 'dr',
    origin: 'generico-didatico',
    manufacturer: null,
    model: null,
    description:
      'Interruptor diferencial residual (sem proteção contra sobrecorrentes). Detecta a diferença entre as correntes que entram e saem pelos seus polos. Exige proteção contra sobrecorrente a montante ou a jusante.',
    keywords: ['dr', 'idr', 'diferencial', 'residual', '30ma', 'choque', `${poles}p`, 'rccb'],
    dimensions: { widthModules: poles, widthMm: poles * MODULE_MM, heightMm: 85, depthMm: 72 },
    appearance: { bodyColor: '#eceeef', accentColor: '#1f5fa8', material: 'termoplastico' },
    terminals,
    internal,
    electrical: {
      category: 'dr',
      standard: 'ABNT NBR NM 61008 (interruptores DR sem proteção de sobrecorrente)',
      poles,
      ratedCurrentA: 40,
      residualCurrentMA: 30,
      rcdType: 'A',
      ratedVoltageV: poles === 2 ? 230 : 400,
      frequencyHz: 60,
    },
    configurable: {
      ratedCurrentA: [25, 40, 63, 80],
      residualCurrentMA: [10, 30, 100, 300],
      rcdType: ['AC', 'A', 'F', 'B'],
    },
    compatibility: { mounting: 'trilho-din-35', combCompatible: false, maxConductorsPerTerminal: 2 },
    source: didacticSource(
      'Conjunto didático EletriLab — valores preferenciais de In e IΔn (IEC 61008-1 / ABNT NBR NM 61008)',
      'Atuação simulada com limiar determinístico em IΔn (a norma de produto admite atuação entre 0,5 IΔn e IΔn).',
    ),
  };
}

function genericSpd(kind: 'tipo2' | 'tipo1' | 'tipo3'): CatalogItem {
  const isT1 = kind === 'tipo1';
  if (kind === 'tipo3') {
    const t2 = genericSpd('tipo2');
    return {
      ...t2,
      id: 'dps-generico-t3',
      name: 'DPS Tipo 3 (genérico didático)',
      description:
        'DPS de proteção fina, próximo aos equipamentos sensíveis, coordenado com DPS a montante. Ensaiado com onda combinada (Uoc) — grandeza não modelada pelo simulador. Não substitui disjuntor, DR nem aterramento.',
      keywords: ['dps', 'surto', 'tipo 3', 'proteção fina', 'spd'],
      electrical: {
        category: 'dps',
        standard: 'ABNT NBR IEC 61643-11 (DPS conectados a sistemas de baixa tensão)',
        spdClass: '3',
        ucV: 275,
        upKV: 1.2,
        inKA: null,
        imaxKA: null,
        iimpKA: null,
        poles: 1,
        endOfLifeIndicator: true,
      },
      configurable: { ucV: [175, 275] },
      source: {
        ...t2.source,
        notes: 'Valores didáticos. Correntes de descarga não informadas (desconhecidas) — o ensaio de Tipo 3 usa onda combinada (Uoc).',
      },
    };
  }
  return {
    id: isT1 ? 'dps-generico-t1' : 'dps-generico-t2',
    name: isT1 ? 'DPS Tipo 1 (genérico didático)' : 'DPS Tipo 2 (genérico didático)',
    category: 'dps',
    origin: 'generico-didatico',
    manufacturer: null,
    model: null,
    description: isT1
      ? 'Dispositivo de proteção contra surtos ensaiado com corrente de impulso (Iimp), para pontos expostos a correntes parciais de descarga direta. Não substitui disjuntor, DR nem aterramento.'
      : 'Dispositivo de proteção contra surtos para sobretensões transitórias induzidas. Liga-se entre o condutor vivo e o PE. Não substitui disjuntor, DR nem aterramento.',
    keywords: ['dps', 'surto', 'raio', 'sobretensão', isT1 ? 'tipo 1' : 'tipo 2', 'spd'],
    dimensions: { widthModules: 1, widthMm: MODULE_MM, heightMm: 90, depthMm: 68 },
    appearance: { bodyColor: '#e9e6df', accentColor: '#c45a12', material: 'termoplastico' },
    terminals: [
      { id: 'L', label: 'L/N', side: 'top', xMm: 9, accepts: ['L', 'N'], maxSectionMm2: 25 },
      { id: 'PE', label: 'PE', side: 'bottom', xMm: 9, accepts: ['PE'], maxSectionMm2: 25 },
    ],
    internal: [],
    electrical: {
      category: 'dps',
      standard: 'ABNT NBR IEC 61643-11 (DPS conectados a sistemas de baixa tensão)',
      spdClass: isT1 ? '1' : '2',
      ucV: 275,
      upKV: isT1 ? 2.5 : 1.5,
      inKA: isT1 ? 25 : 20,
      imaxKA: isT1 ? null : 40,
      iimpKA: isT1 ? 12.5 : null,
      poles: 1,
      endOfLifeIndicator: true,
    },
    configurable: isT1
      ? { ucV: [175, 275, 320] }
      : { ucV: [175, 275, 320, 385, 440], upKV: [1.2, 1.5, 1.8], inKA: [5, 10, 20], imaxKA: [12, 20, 40] },
    compatibility: { mounting: 'trilho-din-35', combCompatible: false, maxConductorsPerTerminal: 1 },
    source: didacticSource(
      'Conjunto didático EletriLab — grandezas definidas na ABNT NBR IEC 61643-11:2021 (Uc, Up, In, Imax, Iimp)',
      'Valores numéricos didáticos, não pertencem a nenhum produto. A seleção real depende do esquema de aterramento, da exposição a surtos e das instruções do fabricante.',
    ),
  };
}

function genericBusbar(fn: 'N' | 'PE'): CatalogItem {
  const terminals: TerminalDef[] = [];
  for (let k = 0; k < 4; k++) {
    const x = 9 + k * 18;
    terminals.push({ id: `T${k + 1}`, label: `${fn}${k + 1}`, side: 'top', xMm: x, accepts: [fn], maxSectionMm2: 16 });
    terminals.push({ id: `B${k + 1}`, label: `${fn}${k + 5}`, side: 'bottom', xMm: x, accepts: [fn], maxSectionMm2: 16 });
  }
  return {
    id: fn === 'N' ? 'barra-n-din' : 'barra-pe-din',
    name: fn === 'N' ? 'Barramento de neutro isolado (trilho DIN, 8 bornes)' : 'Barramento de proteção PE (trilho DIN, 8 bornes)',
    category: 'barramento',
    origin: 'generico-didatico',
    manufacturer: null,
    model: null,
    description:
      fn === 'N'
        ? 'Barramento isolado para distribuir o neutro de um grupo de circuitos — por exemplo, o neutro de saída de um DR. Não deve ser interligado ao PE a jusante da origem.'
        : 'Barramento de proteção para distribuição do PE. Os condutores de proteção nunca passam por dispositivos de manobra.',
    keywords: ['barramento', fn === 'N' ? 'neutro' : 'terra', fn.toLowerCase(), 'distribuição'],
    dimensions: { widthModules: 4, widthMm: 72, heightMm: 40, depthMm: 45 },
    appearance: {
      bodyColor: fn === 'N' ? '#2f6db5' : '#2e8b3e',
      accentColor: '#c9a23a',
      material: 'latao',
    },
    terminals,
    internal: [{ kind: 'bonded', terminals: terminals.map((t) => t.id) }],
    electrical: { category: 'barramento', function: fn, ratedCurrentA: 63 },
    configurable: {},
    compatibility: { mounting: 'trilho-din-35', combCompatible: false, maxConductorsPerTerminal: 2 },
    source: didacticSource('Conjunto didático EletriLab — barramento modular genérico'),
  };
}

function terminalBlock(kind: 'passagem' | 'terra' | 'neutro'): CatalogItem {
  const accepts: TerminalDef['accepts'] = kind === 'terra' ? ['PE'] : kind === 'neutro' ? ['N'] : ['L', 'N', 'R'];
  const color = kind === 'terra' ? '#3c9a4a' : kind === 'neutro' ? '#3b82c4' : '#9aa0a6';
  const name =
    kind === 'terra' ? 'Borne de proteção PE (verde-amarelo)' : kind === 'neutro' ? 'Borne de passagem azul (neutro)' : 'Borne de passagem cinza';
  return {
    id: `borne-${kind}`,
    name,
    category: 'borne',
    origin: 'generico-didatico',
    manufacturer: null,
    model: null,
    description: 'Borne de passagem: interliga o condutor de entrada (superior) ao de saída (inferior).',
    keywords: ['borne', 'passagem', 'conector', kind],
    dimensions: { widthModules: 1, widthMm: MODULE_MM, heightMm: 55, depthMm: 48 },
    appearance: { bodyColor: color, accentColor: '#c9a23a', material: 'poliamida' },
    terminals: [
      { id: 'A', label: 'A', side: 'top', xMm: 9, accepts, maxSectionMm2: 10 },
      { id: 'B', label: 'B', side: 'bottom', xMm: 9, accepts, maxSectionMm2: 10 },
    ],
    internal: [{ kind: 'bonded', terminals: ['A', 'B'] }],
    electrical: { category: 'borne', blockKind: kind === 'terra' ? 'terra' : 'passagem', ratedCurrentA: 57 },
    configurable: {},
    compatibility: { mounting: 'trilho-din-35', combCompatible: false, maxConductorsPerTerminal: 1 },
    source: didacticSource('Conjunto didático EletriLab — borne modular genérico'),
  };
}

const distributionBlock: CatalogItem = {
  id: 'borne-distribuicao',
  name: 'Borne de distribuição 1 entrada / 4 saídas',
  category: 'borne',
  origin: 'generico-didatico',
  manufacturer: null,
  model: null,
  description: 'Distribui um condutor de entrada para até quatro saídas (todos os bornes interligados).',
  keywords: ['borne', 'distribuição', 'derivação', 'bloco'],
  dimensions: { widthModules: 2, widthMm: 36, heightMm: 60, depthMm: 50 },
  appearance: { bodyColor: '#80868b', accentColor: '#c9a23a', material: 'poliamida' },
  terminals: [
    { id: 'IN', label: 'IN', side: 'top', xMm: 18, accepts: ['L', 'N', 'PE', 'R'], maxSectionMm2: 25 },
    { id: 'O1', label: '1', side: 'bottom', xMm: 4.5, accepts: ['L', 'N', 'PE', 'R'], maxSectionMm2: 10 },
    { id: 'O2', label: '2', side: 'bottom', xMm: 13.5, accepts: ['L', 'N', 'PE', 'R'], maxSectionMm2: 10 },
    { id: 'O3', label: '3', side: 'bottom', xMm: 22.5, accepts: ['L', 'N', 'PE', 'R'], maxSectionMm2: 10 },
    { id: 'O4', label: '4', side: 'bottom', xMm: 31.5, accepts: ['L', 'N', 'PE', 'R'], maxSectionMm2: 10 },
  ],
  internal: [{ kind: 'bonded', terminals: ['IN', 'O1', 'O2', 'O3', 'O4'] }],
  electrical: { category: 'borne', blockKind: 'distribuicao', ratedCurrentA: 80 },
  configurable: {},
  compatibility: { mounting: 'trilho-din-35', combCompatible: false, maxConductorsPerTerminal: 1 },
  source: didacticSource('Conjunto didático EletriLab — bloco de distribuição genérico'),
};

function comb(phases: 1 | 2 | 3): CatalogItem {
  return {
    id: `pente-${phases}f`,
    name: `Barramento pente ${phases === 1 ? 'monofásico' : phases === 2 ? 'bifásico' : 'trifásico'}`,
    category: 'pente',
    origin: 'generico-didatico',
    manufacturer: null,
    model: null,
    description:
      'Barramento tipo pente: interliga os bornes de linha (superiores) dos disjuntores que cobre. No pente multifásico os dentes alternam as fases a cada módulo.',
    keywords: ['pente', 'barramento', 'distribuição', 'fase'],
    dimensions: { widthModules: 1, widthMm: MODULE_MM, heightMm: 12, depthMm: 10 },
    appearance: { bodyColor: '#c4532a', accentColor: '#b87333', material: 'cobre' },
    terminals: [],
    internal: [],
    electrical: { category: 'pente', phases, ratedCurrentA: 63 },
    configurable: {},
    compatibility: { mounting: 'pente', combCompatible: true, maxConductorsPerTerminal: 1 },
    source: didacticSource('Conjunto didático EletriLab — pente genérico (compatível apenas com disjuntores)'),
  };
}

export const DEVICE_CATALOG: CatalogItem[] = [
  genericBreaker(1),
  genericBreaker(2),
  genericBreaker(3),
  genericBreaker(4),
  unknownBreaker,
  genericRcd(2),
  genericRcd(4),
  genericSpd('tipo2'),
  genericSpd('tipo1'),
  genericSpd('tipo3'),
  genericBusbar('N'),
  genericBusbar('PE'),
  terminalBlock('passagem'),
  terminalBlock('neutro'),
  terminalBlock('terra'),
  distributionBlock,
  comb(1),
  comb(2),
  comb(3),
];
