import { z } from 'zod';
import { CatalogItemSchema, ConductorSpecSchema, type CatalogItem, type Category } from './schema';
import { DEVICE_CATALOG } from './devices';
import { CONDUCTOR_CATALOG } from './conductors';
import type { DeviceInstance } from '../model/schema';

// Validação do catálogo embutido na carga do módulo: um catálogo inválido é um erro de programação.
const parsed = z.array(CatalogItemSchema).parse(DEVICE_CATALOG);
z.array(ConductorSpecSchema).parse(CONDUCTOR_CATALOG);

const registry = new Map<string, CatalogItem>(parsed.map((i) => [i.id, i]));

export function getCatalogItem(id: string): CatalogItem | undefined {
  return registry.get(id);
}

export function requireCatalogItem(id: string): CatalogItem {
  const item = registry.get(id);
  if (!item) throw new Error(`Item de catálogo inexistente: ${id}`);
  return item;
}

export function listCatalog(): CatalogItem[] {
  return [...registry.values()];
}

/** Registra itens adicionais (ex.: importados com ficha técnica). Retorna erros de validação. */
export function registerCatalogItems(items: unknown): { added: number; errors: string[] } {
  const result = z.array(CatalogItemSchema).safeParse(items);
  if (!result.success) {
    return { added: 0, errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  for (const item of result.data) registry.set(item.id, item);
  return { added: result.data.length, errors: [] };
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function searchCatalog(query: string, category: Category | 'todos' = 'todos'): CatalogItem[] {
  const q = normalize(query.trim());
  return listCatalog().filter((item) => {
    if (category !== 'todos' && item.category !== category) return false;
    if (!q) return true;
    const hay = normalize([item.name, item.description, ...item.keywords].join(' '));
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });
}

export const CATEGORY_LABEL: Record<Category, string> = {
  disjuntor: 'Disjuntores',
  dr: 'Dispositivos DR',
  dps: 'DPS',
  barramento: 'Barramentos',
  borne: 'Bornes',
  pente: 'Pentes',
};

/**
 * Parâmetros elétricos efetivos de uma instância: dados do catálogo
 * sobrepostos pela configuração da instância (somente campos configuráveis).
 */
export function effectiveElectrical(device: DeviceInstance, item: CatalogItem) {
  const e = { ...item.electrical } as Record<string, unknown>;
  const cfg = device.config as Record<string, unknown>;
  for (const key of Object.keys(item.configurable)) {
    if (key in cfg && cfg[key] !== undefined) e[key] = cfg[key];
  }
  return e as CatalogItem['electrical'];
}

export { DEVICE_CATALOG, CONDUCTOR_CATALOG };
export * from './schema';
