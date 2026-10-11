/**
 * Conjuntos de dados de referência usados no dimensionamento.
 *
 * IMPORTANTE (direitos autorais e rastreabilidade):
 *  - As normas ABNT/IEC são documentos protegidos. Este arquivo NÃO reproduz
 *    tabelas completas: contém apenas o subconjunto mínimo de valores numéricos
 *    necessário ao funcionamento didático (cobre; métodos A1, A2, B1 e C;
 *    seções de 1,5 a 35 mm²), valores amplamente publicados em guias técnicos
 *    de fabricantes de cabos.
 *  - Status: 'fonte-secundaria' — não conferidos no documento primário.
 *  - O método B2 e o método D foram EXCLUÍDOS porque os valores divergem entre
 *    edições (IEC 60364-5-523:1999 × IEC 60364-5-52:2009) e não foi possível
 *    confirmar qual corresponde à NBR 5410:2004 sem o texto primário.
 *  - O conjunto pode ser substituído por dados licenciados via `setAmpacityDataset`.
 */
import { z } from 'zod';
import type { InstallationMethod, Insulation, ConductorMaterial } from '../../model/schema';
import type { VerificationStatus } from '../../catalog/schema';

export interface DatasetInfo {
  id: string;
  description: string;
  reference: string;
  status: VerificationStatus;
  notes: string;
}

type Row = Record<string, number>;

const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35];
const row = (values: number[]): Row => Object.fromEntries(SECTIONS.map((s, i) => [String(s), values[i]]));

/**
 * Capacidade de condução de referência I0 (A), cobre, 30 °C ambiente,
 * indexada por isolação → condutores carregados → método.
 */
export const AmpacityDatasetSchema = z.object({
  info: z.object({
    id: z.string(),
    description: z.string(),
    reference: z.string(),
    status: z.enum(['verificado-fonte-primaria', 'fonte-secundaria', 'didatico', 'pendente']),
    notes: z.string(),
  }),
  referenceAmbientC: z.number(),
  material: z.literal('cobre'),
  values: z.record(
    z.enum(['PVC', 'EPR/XLPE']),
    z.record(z.enum(['2', '3']), z.record(z.enum(['A1', 'A2', 'B1', 'B2', 'C']), z.record(z.string(), z.number().positive()))),
  ),
});
export type AmpacityDataset = z.infer<typeof AmpacityDatasetSchema>;

const DEFAULT_DATASET: AmpacityDataset = {
  info: {
    id: 'eletrilab-ampacidade-cobre-v1',
    description: 'Capacidade de condução de referência — cobre, 30 °C, métodos A1/A2/B1/C',
    reference:
      'Valores análogos às tabelas de capacidade de condução da ABNT NBR 5410:2004 (cobre, PVC 70 °C e EPR/XLPE 90 °C) e da IEC 60364-5-52, conforme publicados em guias técnicos de fabricantes de cabos.',
    status: 'fonte-secundaria',
    notes:
      'Não conferidos no documento primário. B2 e D excluídos por divergência entre edições. Temperatura de referência do ar: 30 °C.',
  },
  referenceAmbientC: 30,
  material: 'cobre',
  values: {
    PVC: {
      '2': {
        A1: row([14.5, 19.5, 26, 34, 46, 61, 80, 99]),
        A2: row([14, 18.5, 25, 32, 43, 57, 75, 92]),
        B1: row([17.5, 24, 32, 41, 57, 76, 101, 125]),
        C: row([19.5, 27, 36, 46, 63, 85, 112, 138]),
      },
      '3': {
        A1: row([13.5, 18, 24, 31, 42, 56, 73, 89]),
        A2: row([13, 17.5, 23, 29, 39, 52, 68, 83]),
        B1: row([15.5, 21, 28, 36, 50, 68, 89, 110]),
        C: row([17.5, 24, 32, 41, 57, 76, 96, 119]),
      },
    },
    'EPR/XLPE': {
      '2': {
        A1: row([19, 26, 35, 45, 61, 81, 106, 131]),
        A2: row([18.5, 25, 33, 42, 57, 76, 99, 121]),
        B1: row([23, 31, 42, 54, 75, 100, 133, 164]),
        C: row([24, 33, 45, 58, 80, 107, 138, 171]),
      },
      '3': {
        A1: row([17, 23, 31, 40, 54, 73, 95, 117]),
        A2: row([16.5, 22, 30, 38, 51, 68, 89, 109]),
        B1: row([20, 28, 37, 48, 66, 88, 117, 144]),
        C: row([22, 30, 40, 52, 71, 96, 119, 147]),
      },
    },
  },
};

let activeDataset: AmpacityDataset = AmpacityDatasetSchema.parse(DEFAULT_DATASET);

export function getAmpacityDataset(): AmpacityDataset {
  return activeDataset;
}

/** Substitui o conjunto de capacidade de condução (ex.: dados licenciados). */
export function setAmpacityDataset(data: unknown): { ok: true } | { ok: false; errors: string[] } {
  const r = AmpacityDatasetSchema.safeParse(data);
  if (!r.success) return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  activeDataset = r.data;
  return { ok: true };
}

export function resetAmpacityDataset() {
  activeDataset = AmpacityDatasetSchema.parse(DEFAULT_DATASET);
}

/** Retorna I0 (A) ou null se a combinação não existir no conjunto ativo. */
export function lookupReferenceAmpacity(
  material: ConductorMaterial,
  insulation: Insulation,
  loaded: 2 | 3,
  method: InstallationMethod,
  sectionMm2: number,
): number | null {
  if (material !== activeDataset.material) return null;
  const ins = insulation === 'PVC' ? 'PVC' : 'EPR/XLPE';
  const v = activeDataset.values[ins]?.[String(loaded) as '2' | '3']?.[method]?.[String(sectionMm2)];
  return typeof v === 'number' ? v : null;
}

/**
 * Fatores de correção para agrupamento — circuitos em feixe ou em conduto
 * fechado (linha "agrupamento em feixe / embutidos / em conduto").
 * Valores análogos à tabela correspondente da NBR 5410 / IEC 60364-5-52 B.52.17 (fonte secundária).
 */
export const GROUPING_FACTORS_BUNCHED: Array<{ maxCircuits: number; factor: number }> = [
  { maxCircuits: 1, factor: 1.0 },
  { maxCircuits: 2, factor: 0.8 },
  { maxCircuits: 3, factor: 0.7 },
  { maxCircuits: 4, factor: 0.65 },
  { maxCircuits: 5, factor: 0.6 },
  { maxCircuits: 6, factor: 0.57 },
  { maxCircuits: 7, factor: 0.54 },
  { maxCircuits: 8, factor: 0.52 },
  { maxCircuits: 11, factor: 0.5 },
  { maxCircuits: 15, factor: 0.45 },
  { maxCircuits: 19, factor: 0.41 },
  { maxCircuits: 20, factor: 0.38 },
];

export const GROUPING_INFO: DatasetInfo = {
  id: 'eletrilab-agrupamento-feixe-v1',
  description: 'Fator de agrupamento — circuitos em feixe/conduto fechado',
  reference: 'Análogo à tabela de fatores de agrupamento da NBR 5410:2004 e IEC 60364-5-52 Tabela B.52.17 (linha 1)',
  status: 'fonte-secundaria',
  notes: 'Aplica-se a condutores de mesma seção e igualmente carregados. Outras disposições (bandejas, camadas) não estão incluídas.',
};

export const TEMPERATURE_FACTOR_INFO: DatasetInfo = {
  id: 'eletrilab-fator-temperatura-v1',
  description: 'Fator de correção de temperatura ambiente (ar)',
  reference:
    'Calculado por k = √((θp − θa)/(θp − 30)), relação física de aquecimento (I² ∝ Δθ) que reproduz os fatores tabelados da NBR 5410 / IEC 60364-5-52 B.52.14 com duas casas decimais.',
  status: 'fonte-secundaria',
  notes: 'θp = 70 °C (PVC) ou 90 °C (EPR/XLPE); referência 30 °C no ar. Não aplicável a instalações enterradas.',
};

/** Seções mínimas de condutores de fase (cobre) por tipo de circuito. */
export const MINIMUM_SECTION_COPPER = {
  iluminacao: 1.5,
  forca: 2.5,
};

export const MINIMUM_SECTION_INFO: DatasetInfo = {
  id: 'nbr5410-secao-minima',
  description: 'Seção mínima dos condutores de fase em cobre: iluminação 1,5 mm²; força (inclui tomadas) 2,5 mm²',
  reference: 'ABNT NBR 5410:2004, 6.2.6.1.1 e tabela de seções mínimas (numeração da tabela a confirmar)',
  status: 'fonte-secundaria',
  notes: 'Valores consistentes em múltiplas fontes técnicas.',
};
