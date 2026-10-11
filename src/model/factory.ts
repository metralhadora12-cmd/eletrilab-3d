/** Funções de criação de entidades do modelo com valores iniciais explícitos. */
import { getCatalogItem, requireCatalogItem } from '../catalog';
import type {
  Circuit,
  CircuitConnection,
  CircuitKind,
  DeviceConfig,
  DeviceInstance,
  Load,
  Location,
  Project,
  Supply,
  TerminalRef,
  Wire,
  WireColor,
} from './schema';
import { SCHEMA_VERSION } from './schema';

let counter = 0;
export function uid(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const DEFAULT_SUPPLY: Supply = {
  type: 'bifasico',
  systemVoltage: '127/220',
  frequencyHz: 60,
  earthing: 'TN-S',
  prospectiveShortCircuitKA: null,
  earthElectrodeResistanceOhm: null,
  sourceEarthResistanceOhm: null,
  upstreamVoltageDropPct: null,
};

export function createEmptyProject(name = 'Novo projeto', overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid('proj'),
    name,
    description: '',
    createdAt: now,
    updatedAt: now,
    supply: { ...DEFAULT_SUPPLY },
    enclosure: { mounting: 'sobrepor', rows: 3, modulesPerRow: 18, label: 'QDC' },
    devices: [],
    combs: [],
    wires: [],
    circuits: [],
    simulation: { energized: false, faults: [], timeScale: 20, thermal: {} },
    validationProfile: 'aprendizado',
    lastValidation: null,
    ...overrides,
  };
}

/** Configuração inicial: valores padrão do catálogo para os campos configuráveis. */
export function defaultConfig(catalogId: string): DeviceConfig {
  const item = requireCatalogItem(catalogId);
  const cfg: Record<string, unknown> = {};
  const e = item.electrical as Record<string, unknown>;
  for (const key of Object.keys(item.configurable)) cfg[key] = e[key] ?? null;
  return cfg as DeviceConfig;
}

const LABEL_PREFIX: Record<string, string> = {
  disjuntor: 'Q',
  dr: 'DR',
  dps: 'DPS',
  barramento: 'BN',
  borne: 'X',
  pente: 'P',
};

export function nextLabel(project: Project, catalogId: string): string {
  const item = requireCatalogItem(catalogId);
  let prefix = LABEL_PREFIX[item.category] ?? 'D';
  if (item.category === 'barramento' && item.electrical.category === 'barramento' && item.electrical.function === 'PE') prefix = 'BPE';
  let n = 1;
  const used = new Set(project.devices.map((d) => d.label));
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function createDevice(catalogId: string, row: number, module: number, label: string): DeviceInstance {
  const item = requireCatalogItem(catalogId);
  return {
    id: uid('dev'),
    catalogId,
    row,
    module,
    label,
    state: item.category === 'disjuntor' || item.category === 'dr' ? 'off' : 'on',
    config: defaultConfig(catalogId),
    spd: item.category === 'dps' ? { endOfLife: false, surges: 0 } : undefined,
  };
}

export function createWire(
  from: TerminalRef,
  to: TerminalRef,
  color: WireColor,
  sectionMm2: number,
  extra: Partial<Wire> = {},
): Wire {
  return {
    id: uid('w'),
    from,
    to,
    sectionMm2,
    color,
    material: 'cobre',
    insulation: 'PVC',
    slackMm: 20,
    broken: false,
    ...extra,
  };
}

const KIND_TEMPLATES: Record<CircuitKind, { name: string; loads: Omit<Load, 'id'>[]; locations: Location[] }> = {
  iluminacao: {
    name: 'Iluminação',
    loads: [{ name: 'Luminárias LED', kind: 'iluminacao', powerW: 10, powerFactor: 0.92, efficiency: 1, quantity: 8 }],
    locations: ['sala'],
  },
  tug: {
    name: 'Tomadas de uso geral',
    loads: [{ name: 'Previsão de tomadas', kind: 'misto', powerW: 100, powerFactor: 0.9, efficiency: 1, quantity: 6 }],
    locations: ['sala'],
  },
  tue: {
    name: 'Tomada de uso específico',
    loads: [{ name: 'Equipamento', kind: 'misto', powerW: 1500, powerFactor: 0.9, efficiency: 1, quantity: 1 }],
    locations: ['outro'],
  },
  chuveiro: {
    name: 'Chuveiro elétrico',
    loads: [{ name: 'Chuveiro', kind: 'resistiva', powerW: 5500, powerFactor: 1, efficiency: 1, quantity: 1 }],
    locations: ['banheiro'],
  },
  'ar-condicionado': {
    name: 'Ar-condicionado',
    loads: [{ name: 'Condicionador (potência absorvida)', kind: 'motor', powerW: 1100, powerFactor: 0.9, efficiency: 1, quantity: 1 }],
    locations: ['quarto'],
  },
  forno: {
    name: 'Forno elétrico',
    loads: [{ name: 'Forno', kind: 'resistiva', powerW: 2000, powerFactor: 1, efficiency: 1, quantity: 1 }],
    locations: ['cozinha'],
  },
  'maquina-lavar': {
    name: 'Máquina de lavar',
    loads: [{ name: 'Lavadora (potência absorvida)', kind: 'motor', powerW: 1000, powerFactor: 0.8, efficiency: 1, quantity: 1 }],
    locations: ['area-servico'],
  },
  outro: {
    name: 'Circuito',
    loads: [{ name: 'Carga', kind: 'resistiva', powerW: 1000, powerFactor: 1, efficiency: 1, quantity: 1 }],
    locations: ['outro'],
  },
};

/**
 * Cria um circuito com cargas de EXEMPLO (editáveis). Seção, método de instalação
 * e comprimento começam indefinidos: o dimensionamento depende dos dados do usuário,
 * não do nome do equipamento.
 */
export function createCircuit(project: Project, kind: CircuitKind, overrides: Partial<Circuit> = {}): Circuit {
  const t = KIND_TEMPLATES[kind];
  const number = Math.max(0, ...project.circuits.map((c) => c.number)) + 1;
  const connection: CircuitConnection = 'F-N';
  return {
    id: uid('c'),
    number,
    name: t.name,
    kind,
    connection,
    locations: [...t.locations],
    loads: t.loads.map((l) => ({ ...l, id: uid('ld') })),
    lengthM: null,
    method: null,
    ambientTempC: null,
    groupedCircuits: null,
    material: 'cobre',
    insulation: 'PVC',
    sectionMm2: null,
    voltageDropLimitPct: 4,
    voltageDropLimitSource: 'normativo',
    ...overrides,
  };
}

export function newLoad(): Load {
  return { id: uid('ld'), name: 'Nova carga', kind: 'resistiva', powerW: 100, powerFactor: 1, efficiency: 1, quantity: 1 };
}

export function catalogName(catalogId: string) {
  return getCatalogItem(catalogId)?.name ?? catalogId;
}
