/**
 * Repositório local de projetos (localStorage ou armazenamento injetado, para testes).
 * Cada projeto é salvo validado; leituras corrompidas são descartadas com erro explícito.
 */
import type { Project } from '../model/schema';
import { uid } from '../model/factory';
import { parseProject } from './serialize';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements KeyValueStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  circuits: number;
  devices: number;
}

const INDEX_KEY = 'eletrilab.v1.index';
const PROJECT_KEY = (id: string) => `eletrilab.v1.project.${id}`;
const AUTOSAVE_KEY = 'eletrilab.v1.autosave';

export interface AutosaveRecord {
  savedAt: string;
  project: Project;
}

export class ProjectRepository {
  constructor(private storage: KeyValueStorage) {}

  list(): ProjectSummary[] {
    try {
      const raw = this.storage.getItem(INDEX_KEY);
      const arr = raw ? (JSON.parse(raw) as ProjectSummary[]) : [];
      return Array.isArray(arr) ? arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
    } catch {
      return [];
    }
  }

  private writeIndex(list: ProjectSummary[]) {
    this.storage.setItem(INDEX_KEY, JSON.stringify(list));
  }

  save(project: Project): Project {
    const stamped = { ...project, updatedAt: new Date().toISOString() };
    const check = parseProject(stamped);
    if (!check.ok) throw new Error(`Projeto inválido, não salvo: ${check.errors.join('; ')}`);
    this.storage.setItem(PROJECT_KEY(stamped.id), JSON.stringify(stamped));
    const summary: ProjectSummary = {
      id: stamped.id,
      name: stamped.name,
      updatedAt: stamped.updatedAt,
      circuits: stamped.circuits.length,
      devices: stamped.devices.length,
    };
    this.writeIndex([summary, ...this.list().filter((p) => p.id !== stamped.id)]);
    return stamped;
  }

  load(id: string): { ok: true; project: Project } | { ok: false; errors: string[] } {
    const raw = this.storage.getItem(PROJECT_KEY(id));
    if (!raw) return { ok: false, errors: ['Projeto não encontrado no armazenamento local'] };
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, errors: ['Arquivo salvo corrompido (JSON inválido)'] };
    }
    const r = parseProject(data);
    return r.ok ? { ok: true, project: r.project } : r;
  }

  delete(id: string) {
    this.storage.removeItem(PROJECT_KEY(id));
    this.writeIndex(this.list().filter((p) => p.id !== id));
  }

  duplicate(id: string): Project | null {
    const r = this.load(id);
    if (!r.ok) return null;
    const now = new Date().toISOString();
    return this.save({ ...r.project, id: uid('proj'), name: `${r.project.name} (cópia)`, createdAt: now, updatedAt: now });
  }

  autosave(project: Project) {
    const rec: AutosaveRecord = { savedAt: new Date().toISOString(), project };
    this.storage.setItem(AUTOSAVE_KEY, JSON.stringify(rec));
  }

  loadAutosave(): AutosaveRecord | null {
    const raw = this.storage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    try {
      const rec = JSON.parse(raw) as AutosaveRecord;
      const r = parseProject(rec.project);
      return r.ok ? { savedAt: rec.savedAt, project: r.project } : null;
    } catch {
      return null;
    }
  }

  clearAutosave() {
    this.storage.removeItem(AUTOSAVE_KEY);
  }
}

export function browserStorage(): KeyValueStorage {
  try {
    const k = '__eletrilab_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return new MemoryStorage();
  }
}
