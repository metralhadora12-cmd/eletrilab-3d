/**
 * Schemas do catálogo de componentes.
 *
 * Princípios:
 *  - Componentes "generico-didatico" NÃO representam nenhum fabricante.
 *  - Componentes "comercial" exigem fabricante, modelo e fonte verificável.
 *  - Valores desconhecidos são `null` e nunca são substituídos silenciosamente.
 */
import { z } from 'zod';
import {
  BreakerCurveSchema,
  ConductorFunctionSchema,
  ConductorMaterialSchema,
  InsulationSchema,
  RcdTypeSchema,
  SpdClassSchema,
} from '../model/schema';

export const VerificationStatusSchema = z.enum([
  /** Conferido diretamente no documento primário (norma/ficha técnica). */
  'verificado-fonte-primaria',
  /** Consistente em fontes técnicas secundárias; requer conferência na edição vigente. */
  'fonte-secundaria',
  /** Conjunto didático explicitamente identificado; não representa produto real. */
  'didatico',
  /** Necessita verificação antes de qualquer uso técnico. */
  'pendente',
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const DataSourceSchema = z.object({
  kind: z.enum(['didatico', 'catalogo-fabricante', 'norma', 'literatura']),
  reference: z.string().min(3),
  url: z.string().url().optional(),
  /** Data de revisão dos dados (AAAA-MM-DD). */
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: VerificationStatusSchema,
  notes: z.string().optional(),
});
export type DataSource = z.infer<typeof DataSourceSchema>;

export const CategorySchema = z.enum(['disjuntor', 'dr', 'dps', 'barramento', 'borne', 'pente']);
export type Category = z.infer<typeof CategorySchema>;

export const TerminalDefSchema = z.object({
  id: z.string().min(1),
  /** Identificação impressa no dispositivo (ex.: "1", "2", "N"). */
  label: z.string(),
  /** Face pela qual o condutor entra no borne. */
  side: z.enum(['top', 'bottom']),
  /** Posição horizontal do borne a partir da borda esquerda do dispositivo (mm). */
  xMm: z.number().min(0),
  /** Funções de condutor aceitas (validação rigorosa). */
  accepts: z.array(ConductorFunctionSchema).min(1),
  /** Seção máxima admitida pelo borne (mm²). */
  maxSectionMm2: z.number().positive(),
});
export type TerminalDef = z.infer<typeof TerminalDefSchema>;

export const InternalLinkSchema = z.discriminatedUnion('kind', [
  /** Contato de um polo (fechado quando o dispositivo está ligado). */
  z.object({ kind: z.literal('pole'), pole: z.number().int().min(0), a: z.string(), b: z.string() }),
  /** Terminais permanentemente interligados (barra, borne de distribuição). */
  z.object({ kind: z.literal('bonded'), terminals: z.array(z.string()).min(2) }),
]);
export type InternalLink = z.infer<typeof InternalLinkSchema>;

export const DimensionsSchema = z.object({
  widthModules: z.number().int().min(1).max(12),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  depthMm: z.number().positive(),
});

export const AppearanceSchema = z.object({
  bodyColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  material: z.enum(['termoplastico', 'latao', 'cobre', 'poliamida']),
});

const BreakerElectricalSchema = z.object({
  category: z.literal('disjuntor'),
  standard: z.string(),
  poles: z.number().int().min(1).max(4),
  ratedCurrentA: z.number().positive().nullable(),
  curve: BreakerCurveSchema.nullable(),
  ratedVoltageV: z.number().positive().nullable(),
  breakingCapacityKA: z.number().positive().nullable(),
  frequencyHz: z.number().positive().nullable(),
});

const RcdElectricalSchema = z.object({
  category: z.literal('dr'),
  standard: z.string(),
  poles: z.union([z.literal(2), z.literal(4)]),
  ratedCurrentA: z.number().positive().nullable(),
  residualCurrentMA: z.number().positive().nullable(),
  rcdType: RcdTypeSchema.nullable(),
  ratedVoltageV: z.number().positive().nullable(),
  frequencyHz: z.number().positive().nullable(),
});

const SpdElectricalSchema = z.object({
  category: z.literal('dps'),
  standard: z.string(),
  spdClass: SpdClassSchema.nullable(),
  ucV: z.number().positive().nullable(),
  upKV: z.number().positive().nullable(),
  inKA: z.number().positive().nullable(),
  imaxKA: z.number().positive().nullable(),
  iimpKA: z.number().positive().nullable(),
  poles: z.literal(1),
  endOfLifeIndicator: z.boolean(),
});

const BusbarElectricalSchema = z.object({
  category: z.literal('barramento'),
  function: z.enum(['N', 'PE']),
  ratedCurrentA: z.number().positive().nullable(),
});

const TerminalBlockElectricalSchema = z.object({
  category: z.literal('borne'),
  blockKind: z.enum(['passagem', 'distribuicao', 'terra']),
  ratedCurrentA: z.number().positive().nullable(),
});

const CombElectricalSchema = z.object({
  category: z.literal('pente'),
  phases: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  ratedCurrentA: z.number().positive().nullable(),
});

export const ElectricalDataSchema = z.discriminatedUnion('category', [
  BreakerElectricalSchema,
  RcdElectricalSchema,
  SpdElectricalSchema,
  BusbarElectricalSchema,
  TerminalBlockElectricalSchema,
  CombElectricalSchema,
]);
export type ElectricalData = z.infer<typeof ElectricalDataSchema>;
export type BreakerElectrical = z.infer<typeof BreakerElectricalSchema>;
export type RcdElectrical = z.infer<typeof RcdElectricalSchema>;
export type SpdElectrical = z.infer<typeof SpdElectricalSchema>;

/** Opções de configuração permitidas para itens genéricos didáticos. */
export const ConfigurableSchema = z
  .object({
    ratedCurrentA: z.array(z.number().positive()),
    curve: z.array(BreakerCurveSchema),
    breakingCapacityKA: z.array(z.number().positive()),
    residualCurrentMA: z.array(z.number().positive()),
    rcdType: z.array(RcdTypeSchema),
    spdClass: z.array(SpdClassSchema),
    ucV: z.array(z.number().positive()),
    upKV: z.array(z.number().positive()),
    inKA: z.array(z.number().positive()),
    imaxKA: z.array(z.number().positive()),
  })
  .partial();
export type Configurable = z.infer<typeof ConfigurableSchema>;

export const CatalogItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: CategorySchema,
    origin: z.enum(['generico-didatico', 'comercial']),
    manufacturer: z.string().nullable(),
    model: z.string().nullable(),
    description: z.string(),
    keywords: z.array(z.string()),
    dimensions: DimensionsSchema,
    appearance: AppearanceSchema,
    terminals: z.array(TerminalDefSchema),
    internal: z.array(InternalLinkSchema),
    electrical: ElectricalDataSchema,
    configurable: ConfigurableSchema,
    compatibility: z.object({
      mounting: z.enum(['trilho-din-35', 'pente']),
      combCompatible: z.boolean(),
      maxConductorsPerTerminal: z.number().int().min(1).max(4),
    }),
    source: DataSourceSchema,
  })
  .superRefine((item, ctx) => {
    if (item.category !== item.electrical.category) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'categoria inconsistente com os dados elétricos' });
    }
    if (item.origin === 'comercial') {
      if (!item.manufacturer || !item.model) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'item comercial exige fabricante e modelo' });
      }
      if (item.source.kind !== 'catalogo-fabricante' || !item.source.url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'item comercial exige ficha técnica do fabricante com URL verificável',
        });
      }
      if (Object.keys(item.configurable).length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'item comercial não pode ter parâmetros livres' });
      }
    } else if (item.manufacturer !== null || item.model !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'item genérico didático não pode declarar fabricante/modelo',
      });
    }
    const ids = new Set<string>();
    for (const t of item.terminals) {
      if (ids.has(t.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `terminal duplicado: ${t.id}` });
      ids.add(t.id);
    }
  });
export type CatalogItem = z.infer<typeof CatalogItemSchema>;

/** Especificação de condutor (cabo/fio isolado). */
export const ConductorSpecSchema = z.object({
  id: z.string(),
  sectionMm2: z.number().positive(),
  material: ConductorMaterialSchema,
  insulation: InsulationSchema,
  /** Classe de encordoamento (IEC 60228 / ABNT NBR NM 280). */
  strandingClass: z.enum(['classe-2', 'classe-5']),
  /** Temperatura máxima em serviço contínuo (°C) — característica da isolação. */
  maxOperatingTempC: z.number().positive(),
  /** Temperatura máxima em curto-circuito (°C). */
  maxShortCircuitTempC: z.number().positive(),
  /** Resistência máxima em CC a 20 °C (Ω/km). null = desconhecida. */
  r20OhmPerKm: z.number().positive().nullable(),
  /** Diâmetro externo aproximado — usado apenas para a representação gráfica. */
  approxOuterDiameterMm: z.number().positive(),
  source: DataSourceSchema,
});
export type ConductorSpec = z.infer<typeof ConductorSpecSchema>;
