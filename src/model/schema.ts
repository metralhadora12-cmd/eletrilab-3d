/**
 * Modelo de domínio do EletriLab 3D.
 *
 * Os schemas Zod abaixo são a fonte única de verdade para:
 *  - o estado do projeto em memória;
 *  - os arquivos salvos/importados (validação antes de carregar na cena);
 *  - os tipos TypeScript (inferidos com z.infer).
 *
 * Unidades são explícitas nos nomes dos campos (A, V, W, mm2, M, Ohm, KA, MA ...).
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Enumerações elétricas
// ---------------------------------------------------------------------------
export const PhaseIdSchema = z.enum(['L1', 'L2', 'L3']);
export type PhaseId = z.infer<typeof PhaseIdSchema>;

/** Função elétrica de um condutor/terminal. R = retorno de interruptor. */
export const ConductorFunctionSchema = z.enum(['L', 'N', 'PE', 'R']);
export type ConductorFunction = z.infer<typeof ConductorFunctionSchema>;

export const EarthingSystemSchema = z.enum(['TN-S', 'TN-C-S', 'TT']);
export type EarthingSystem = z.infer<typeof EarthingSystemSchema>;

export const SupplyTypeSchema = z.enum(['monofasico', 'bifasico', 'trifasico']);
export type SupplyType = z.infer<typeof SupplyTypeSchema>;

/** Tensões nominais do sistema: U0 (fase-neutro) / U (fase-fase). */
export const SystemVoltageSchema = z.enum(['127/220', '220/380']);
export type SystemVoltage = z.infer<typeof SystemVoltageSchema>;

export const InsulationSchema = z.enum(['PVC', 'EPR', 'XLPE']);
export type Insulation = z.infer<typeof InsulationSchema>;

export const ConductorMaterialSchema = z.enum(['cobre', 'aluminio']);
export type ConductorMaterial = z.infer<typeof ConductorMaterialSchema>;

/**
 * Métodos de referência de instalação suportados pelo conjunto de dados
 * de capacidade de condução (ver normative/data/ampacityReference.ts).
 */
export const InstallationMethodSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C']);
export type InstallationMethod = z.infer<typeof InstallationMethodSchema>;

export const WireColorSchema = z.enum([
  'preto',
  'vermelho',
  'marrom',
  'branco',
  'cinza',
  'amarelo',
  'laranja',
  'violeta',
  'azul-claro',
  'verde',
  'verde-amarelo',
]);
export type WireColor = z.infer<typeof WireColorSchema>;

export const LocationSchema = z.enum([
  'sala',
  'quarto',
  'circulacao',
  'escritorio',
  'banheiro',
  'cozinha',
  'area-servico',
  'lavanderia',
  'garagem',
  'area-externa',
  'outro',
]);
export type Location = z.infer<typeof LocationSchema>;

export const CircuitKindSchema = z.enum([
  'iluminacao',
  'tug',
  'tue',
  'chuveiro',
  'ar-condicionado',
  'forno',
  'maquina-lavar',
  'outro',
]);
export type CircuitKind = z.infer<typeof CircuitKindSchema>;

/** Tipo de ligação do circuito terminal. */
export const CircuitConnectionSchema = z.enum(['F-N', 'F-F', '3F', '3F-N']);
export type CircuitConnection = z.infer<typeof CircuitConnectionSchema>;

export const LoadKindSchema = z.enum(['resistiva', 'motor', 'iluminacao', 'eletronica', 'misto']);
export type LoadKind = z.infer<typeof LoadKindSchema>;

export const ValidationProfileSchema = z.enum(['aprendizado', 'tecnico', 'desafio']);
export type ValidationProfile = z.infer<typeof ValidationProfileSchema>;

// ---------------------------------------------------------------------------
// Alimentação e quadro
// ---------------------------------------------------------------------------
export const SupplySchema = z.object({
  type: SupplyTypeSchema,
  systemVoltage: SystemVoltageSchema,
  frequencyHz: z.union([z.literal(60), z.literal(50)]),
  earthing: EarthingSystemSchema,
  /** Corrente de curto-circuito presumida na origem do quadro (kA). null = desconhecida. */
  prospectiveShortCircuitKA: z.number().positive().max(100).nullable(),
  /** RA — resistência do eletrodo de aterramento das massas (Ω). Relevante em TT. */
  earthElectrodeResistanceOhm: z.number().positive().max(10000).nullable(),
  /** RB — resistência de aterramento da fonte (Ω). Ilustrativo. */
  sourceEarthResistanceOhm: z.number().positive().max(1000).nullable(),
  /** Queda de tensão já existente entre o ponto de entrega e o quadro (%). */
  upstreamVoltageDropPct: z.number().min(0).max(10).nullable(),
});
export type Supply = z.infer<typeof SupplySchema>;

export const EnclosureSchema = z.object({
  mounting: z.enum(['embutir', 'sobrepor']),
  rows: z.number().int().min(1).max(5),
  modulesPerRow: z.number().int().min(8).max(36),
  label: z.string().max(60),
});
export type Enclosure = z.infer<typeof EnclosureSchema>;

// ---------------------------------------------------------------------------
// Dispositivos instalados (instâncias de itens do catálogo)
// ---------------------------------------------------------------------------
export const BreakerCurveSchema = z.enum(['B', 'C', 'D']);
export type BreakerCurve = z.infer<typeof BreakerCurveSchema>;

export const RcdTypeSchema = z.enum(['AC', 'A', 'F', 'B']);
export type RcdType = z.infer<typeof RcdTypeSchema>;

export const SpdClassSchema = z.enum(['1', '2', '3']);
export type SpdClass = z.infer<typeof SpdClassSchema>;

/**
 * Parâmetros configuráveis de uma instância. Só são aceitos para itens
 * genéricos didáticos que declaram a opção em `configurable` no catálogo.
 * null = valor desconhecido (não pode ser usado silenciosamente em cálculos).
 */
export const DeviceConfigSchema = z
  .object({
    ratedCurrentA: z.number().positive().nullable(),
    curve: BreakerCurveSchema.nullable(),
    breakingCapacityKA: z.number().positive().nullable(),
    residualCurrentMA: z.number().positive().nullable(),
    rcdType: RcdTypeSchema.nullable(),
    spdClass: SpdClassSchema.nullable(),
    ucV: z.number().positive().nullable(),
    upKV: z.number().positive().nullable(),
    inKA: z.number().positive().nullable(),
    imaxKA: z.number().positive().nullable(),
  })
  .partial();
export type DeviceConfig = z.infer<typeof DeviceConfigSchema>;

export const DeviceStateSchema = z.enum(['on', 'off', 'tripped']);
export type DeviceState = z.infer<typeof DeviceStateSchema>;

export const DeviceInstanceSchema = z.object({
  id: z.string().min(1),
  catalogId: z.string().min(1),
  /** Índice do trilho DIN (0 = superior). */
  row: z.number().int().min(0),
  /** Posição inicial no trilho, em módulos de 18 mm (0 = extremidade esquerda). */
  module: z.number().int().min(0),
  label: z.string().max(24),
  state: DeviceStateSchema,
  config: DeviceConfigSchema,
  spd: z
    .object({
      endOfLife: z.boolean(),
      surges: z.number().int().min(0),
    })
    .optional(),
});
export type DeviceInstance = z.infer<typeof DeviceInstanceSchema>;

/** Barramento pente: conecta os bornes de linha (superiores) dos dispositivos que cobre. */
export const CombSchema = z.object({
  id: z.string().min(1),
  catalogId: z.string().min(1),
  row: z.number().int().min(0),
  startModule: z.number().int().min(0),
  lengthModules: z.number().int().min(2).max(36),
  phases: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type Comb = z.infer<typeof CombSchema>;

// ---------------------------------------------------------------------------
// Condutores (fios dentro do quadro)
// ---------------------------------------------------------------------------
/**
 * Referência a um terminal. `owner` pode ser:
 *  - id de dispositivo no trilho;
 *  - 'entrada'  (bornes de entrada da alimentação);
 *  - 'barra-n'  (barramento de neutro principal);
 *  - 'barra-pe' (barramento de proteção principal);
 *  - 'circ:<circuitId>' (bornes de saída do circuito).
 */
export const TerminalRefSchema = z.object({
  owner: z.string().min(1),
  terminal: z.string().min(1),
});
export type TerminalRef = z.infer<typeof TerminalRefSchema>;

export const WireSchema = z.object({
  id: z.string().min(1),
  from: TerminalRefSchema,
  to: TerminalRefSchema,
  sectionMm2: z.number().positive().max(300),
  color: WireColorSchema,
  material: ConductorMaterialSchema,
  insulation: InsulationSchema,
  /** Folga adicional do condutor (mm). Afeta o traçado 3D e o comprimento. */
  slackMm: z.number().min(0).max(400),
  /** Falha didática: condutor interrompido. */
  broken: z.boolean(),
  label: z.string().max(40).optional(),
});
export type Wire = z.infer<typeof WireSchema>;

// ---------------------------------------------------------------------------
// Circuitos e cargas
// ---------------------------------------------------------------------------
export const LoadSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(60),
  kind: LoadKindSchema,
  /** Potência nominal por unidade (W). Para motores: potência mecânica de saída. */
  powerW: z.number().positive().max(100000),
  powerFactor: z.number().min(0.1).max(1),
  /** Rendimento (1 para cargas resistivas). */
  efficiency: z.number().min(0.1).max(1),
  quantity: z.number().int().min(1).max(200),
});
export type Load = z.infer<typeof LoadSchema>;

export const CircuitSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().min(1).max(99),
  name: z.string().max(60),
  kind: CircuitKindSchema,
  connection: CircuitConnectionSchema,
  locations: z.array(LocationSchema),
  loads: z.array(LoadSchema),
  /** Comprimento do percurso do circuito (m). null = não informado. */
  lengthM: z.number().positive().max(2000).nullable(),
  method: InstallationMethodSchema.nullable(),
  ambientTempC: z.number().min(-10).max(80).nullable(),
  /** Número de circuitos agrupados no mesmo conduto/feixe (incluindo este). */
  groupedCircuits: z.number().int().min(1).max(20).nullable(),
  material: ConductorMaterialSchema,
  insulation: InsulationSchema,
  /** Seção escolhida para os condutores do circuito (mm²). null = ainda não escolhida. */
  sectionMm2: z.number().positive().max(300).nullable(),
  voltageDropLimitPct: z.number().positive().max(10),
  voltageDropLimitSource: z.enum(['normativo', 'exercicio']),
});
export type Circuit = z.infer<typeof CircuitSchema>;

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------
export const FaultSchema = z.discriminatedUnion('kind', [
  z.object({ id: z.string(), kind: z.literal('overload'), circuitId: z.string(), factor: z.number().min(1).max(20) }),
  z.object({
    id: z.string(),
    kind: z.literal('short-circuit'),
    circuitId: z.string(),
    between: z.enum(['L-N', 'L-PE', 'L-L']),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('leakage'),
    circuitId: z.string(),
    /** Resistência de isolamento degradada entre fase e massa (Ω). */
    resistanceOhm: z.number().positive().max(1e7),
  }),
  z.object({ id: z.string(), kind: z.literal('pe-open'), circuitId: z.string() }),
  z.object({ id: z.string(), kind: z.literal('neutral-open'), circuitId: z.string() }),
  z.object({
    id: z.string(),
    kind: z.literal('touch'),
    circuitId: z.string(),
    /** Resistência do corpo humano adotada no modelo didático (Ω). */
    bodyResistanceOhm: z.number().positive().max(100000),
  }),
]);
export type Fault = z.infer<typeof FaultSchema>;

export const SimulationStateSchema = z.object({
  energized: z.boolean(),
  faults: z.array(FaultSchema),
  /** Aceleração do tempo na simulação térmica (1 = tempo real). */
  timeScale: z.number().min(1).max(600),
  /** Estado térmico normalizado de cada disjuntor (modelo didático). */
  thermal: z.record(z.number()),
});
export type SimulationState = z.infer<typeof SimulationStateSchema>;

export const FindingSeveritySchema = z.enum(['erro', 'alerta', 'inconclusivo', 'info']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const StoredFindingSchema = z.object({
  ruleId: z.string(),
  severity: FindingSeveritySchema,
  message: z.string(),
  targetId: z.string().nullable(),
});

export const ValidationSnapshotSchema = z.object({
  at: z.string(),
  profile: ValidationProfileSchema,
  counts: z.object({
    erro: z.number().int(),
    alerta: z.number().int(),
    inconclusivo: z.number().int(),
    info: z.number().int(),
  }),
  findings: z.array(StoredFindingSchema),
});
export type ValidationSnapshot = z.infer<typeof ValidationSnapshotSchema>;

// ---------------------------------------------------------------------------
// Projeto
// ---------------------------------------------------------------------------
export const ProjectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000),
  createdAt: z.string(),
  updatedAt: z.string(),
  supply: SupplySchema,
  enclosure: EnclosureSchema,
  devices: z.array(DeviceInstanceSchema),
  combs: z.array(CombSchema),
  wires: z.array(WireSchema),
  circuits: z.array(CircuitSchema),
  simulation: SimulationStateSchema,
  validationProfile: ValidationProfileSchema,
  lastValidation: ValidationSnapshotSchema.nullable(),
});
export type Project = z.infer<typeof ProjectSchema>;

/** Dono de terminais fixos do invólucro. */
export const FIXED_OWNERS = {
  entry: 'entrada',
  neutralBar: 'barra-n',
  peBar: 'barra-pe',
} as const;

export const CIRCUIT_OWNER_PREFIX = 'circ:';
export const circuitOwnerId = (circuitId: string) => `${CIRCUIT_OWNER_PREFIX}${circuitId}`;
export const isCircuitOwner = (owner: string) => owner.startsWith(CIRCUIT_OWNER_PREFIX);
export const circuitIdFromOwner = (owner: string) => owner.slice(CIRCUIT_OWNER_PREFIX.length);
export const terminalKey = (ref: TerminalRef) => `${ref.owner}::${ref.terminal}`;
