/** Exportação/importação de projetos com validação completa antes de carregar na cena. */
import { getCatalogItem } from '../catalog';
import { canPlace } from '../model/geometry';
import { ProjectSchema, type Project } from '../model/schema';
import { resolveTerminal } from '../model/terminals';

export const FILE_FORMAT = 'eletrilab-3d-project';

export interface ProjectFile {
  format: typeof FILE_FORMAT;
  exportedAt: string;
  disclaimer: string;
  project: Project;
}

export const PROJECT_DISCLAIMER =
  'Projeto didático gerado pelo EletriLab 3D. Não constitui projeto executivo validado e não substitui profissional habilitado, inspeções ou ensaios de campo.';

export function exportProjectJson(project: Project): string {
  const file: ProjectFile = {
    format: FILE_FORMAT,
    exportedAt: new Date().toISOString(),
    disclaimer: PROJECT_DISCLAIMER,
    project,
  };
  return JSON.stringify(file, null, 2);
}

/** Verificações de integridade referencial que o schema sozinho não cobre. */
export function integrityErrors(project: Project): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const dup = (kind: string, id: string) => {
    if (ids.has(id)) errors.push(`${kind}: id duplicado "${id}"`);
    ids.add(id);
  };
  for (const d of project.devices) {
    dup('dispositivo', d.id);
    const item = getCatalogItem(d.catalogId);
    if (!item) {
      errors.push(`dispositivo ${d.label}: item de catálogo inexistente "${d.catalogId}"`);
      continue;
    }
    const place = canPlace(project, d.catalogId, d.row, d.module, d.id);
    if (!place.ok) errors.push(`dispositivo ${d.label}: posição inválida (${place.reason})`);
    for (const key of Object.keys(d.config)) {
      if (!(key in item.configurable)) errors.push(`dispositivo ${d.label}: parâmetro "${key}" não é configurável neste item`);
    }
  }
  for (const c of project.combs) {
    dup('pente', c.id);
    if (getCatalogItem(c.catalogId)?.category !== 'pente') errors.push(`pente ${c.id}: item de catálogo inválido`);
    if (c.row >= project.enclosure.rows || c.startModule + c.lengthModules > project.enclosure.modulesPerRow) {
      errors.push(`pente ${c.id}: fora dos limites do trilho`);
    }
  }
  const numbers = new Set<number>();
  for (const c of project.circuits) {
    dup('circuito', c.id);
    if (numbers.has(c.number)) errors.push(`circuito C${c.number}: número duplicado`);
    numbers.add(c.number);
    const loadIds = new Set<string>();
    for (const l of c.loads) {
      if (loadIds.has(l.id)) errors.push(`circuito C${c.number}: carga com id duplicado`);
      loadIds.add(l.id);
    }
  }
  const circuitIds = new Set(project.circuits.map((c) => c.id));
  for (const f of project.simulation.faults) {
    if (!circuitIds.has(f.circuitId)) errors.push(`falha ${f.id}: circuito inexistente`);
  }
  for (const w of project.wires) {
    dup('condutor', w.id);
    for (const end of [w.from, w.to]) {
      if (!resolveTerminal(project, end)) errors.push(`condutor ${w.id}: borne inexistente ${end.owner}:${end.terminal}`);
    }
    if (w.from.owner === w.to.owner && w.from.terminal === w.to.terminal) errors.push(`condutor ${w.id}: origem e destino iguais`);
  }
  return errors;
}

export type ImportResult = { ok: true; project: Project; warnings: string[] } | { ok: false; errors: string[] };

export function parseProject(data: unknown): ImportResult {
  const candidate =
    data && typeof data === 'object' && (data as { format?: string }).format === FILE_FORMAT ? (data as ProjectFile).project : data;
  const parsed = ProjectSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`),
    };
  }
  const errors = integrityErrors(parsed.data);
  if (errors.length) return { ok: false, errors };
  return { ok: true, project: parsed.data, warnings: [] };
}

export function importProjectJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`JSON inválido: ${(e as Error).message}`] };
  }
  return parseProject(data);
}
