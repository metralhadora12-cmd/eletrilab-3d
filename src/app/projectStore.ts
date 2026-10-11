/**
 * Estado global do projeto (Zustand + Immer) com histórico de desfazer/refazer.
 * Toda alteração passa por `commit`, que registra o estado anterior no histórico
 * (exceto ações de simulação, marcadas com history: false).
 */
import { create } from 'zustand';
import { produce } from 'immer';
import { getCatalogItem } from '../catalog';
import { colorAllowsFunction } from '../catalog/colors';
import { canPlace } from '../model/geometry';
import { createCircuit, createDevice, createWire, newLoad, nextLabel, uid } from '../model/factory';
import { resolveTerminal, terminalOccupancy } from '../model/terminals';
import {
  circuitOwnerId,
  terminalKey,
  type Circuit,
  type CircuitKind,
  type Comb,
  type DeviceConfig,
  type DeviceInstance,
  type DeviceState,
  type Enclosure,
  type Fault,
  type Load,
  type Project,
  type Supply,
  type TerminalRef,
  type ValidationProfile,
  type ValidationSnapshot,
  type Wire,
  type WireColor,
} from '../model/schema';
import { buildResidenceExample } from '../persistence/examples';

const HISTORY_LIMIT = 100;

/** Omit distributivo: preserva a união discriminada das falhas. */
export type FaultInput = Fault extends infer F ? (F extends Fault ? Omit<F, 'id'> : never) : never;

export interface ActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

interface ProjectState {
  project: Project;
  past: Project[];
  future: Project[];
  savedId: string | null;
  dirty: boolean;
  lastChange: string;
  /** Histórico legível das alterações registradas (para o painel de eventos). */
  changeLog: Array<{ at: string; label: string }>;
  commit: (label: string, mutator: (draft: Project) => void, opts?: { history?: boolean }) => void;
  load: (p: Project, opts?: { saved?: boolean }) => void;
  markSaved: (p: Project) => void;
  undo: () => void;
  redo: () => void;

  addDevice: (catalogId: string, row: number, module: number) => ActionResult;
  moveDevice: (id: string, row: number, module: number) => ActionResult;
  removeDevice: (id: string) => void;
  updateDevice: (id: string, patch: Partial<Pick<DeviceInstance, 'label' | 'state'>>) => void;
  updateDeviceConfig: (id: string, patch: DeviceConfig) => void;
  setDeviceState: (id: string, state: DeviceState) => void;

  addComb: (catalogId: string, row: number, start: number, length: number) => ActionResult;
  updateComb: (id: string, patch: Partial<Comb>) => ActionResult;
  removeComb: (id: string) => void;

  addWire: (from: TerminalRef, to: TerminalRef, color: WireColor, sectionMm2: number, strict: boolean) => ActionResult;
  updateWire: (id: string, patch: Partial<Wire>) => void;
  removeWire: (id: string) => void;

  addCircuit: (kind: CircuitKind) => string;
  updateCircuit: (id: string, patch: Partial<Circuit>) => void;
  removeCircuit: (id: string) => void;
  duplicateCircuit: (id: string) => void;
  addLoad: (circuitId: string) => void;
  updateLoad: (circuitId: string, loadId: string, patch: Partial<Load>) => void;
  removeLoad: (circuitId: string, loadId: string) => void;

  updateSupply: (patch: Partial<Supply>) => void;
  updateEnclosure: (patch: Partial<Enclosure>) => ActionResult;
  rename: (name: string, description?: string) => void;
  setValidationProfile: (p: ValidationProfile) => void;
  storeValidation: (s: ValidationSnapshot) => void;

  setEnergized: (on: boolean) => void;
  addFault: (f: FaultInput) => void;
  removeFault: (id: string) => void;
  clearFaults: () => void;
  applyTrips: (deviceIds: string[]) => void;
  resetTripped: () => void;
  setTimeScale: (n: number) => void;
  setSpdEndOfLife: (ids: string[], surgeCountInc: boolean) => void;
}

/** Remove condutores cujos bornes deixaram de existir (ex.: mudança de alimentação). */
function pruneDanglingWires(draft: Project) {
  const before = draft.wires.length;
  draft.wires = draft.wires.filter((w) => resolveTerminal(draft, w.from) && resolveTerminal(draft, w.to));
  return before - draft.wires.length;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  const commit: ProjectState['commit'] = (label, mutator, opts) => {
    const prev = get().project;
    const next = produce(prev, (d) => {
      mutator(d);
      d.updatedAt = new Date().toISOString();
    });
    if (next === prev) return;
    const history = opts?.history !== false;
    set((s) => ({
      project: next,
      past: history ? [...s.past, prev].slice(-HISTORY_LIMIT) : s.past,
      future: history ? [] : s.future,
      dirty: true,
      lastChange: label,
      changeLog: history ? [...s.changeLog, { at: new Date().toLocaleTimeString('pt-BR'), label }].slice(-200) : s.changeLog,
    }));
  };

  return {
    project: buildResidenceExample(),
    past: [],
    future: [],
    savedId: null,
    dirty: false,
    lastChange: 'Projeto de exemplo carregado',
    changeLog: [],
    commit,
    load: (p, opts) =>
      set({
        project: p,
        past: [],
        future: [],
        savedId: opts?.saved ? p.id : null,
        dirty: false,
        lastChange: 'Projeto aberto',
        changeLog: [{ at: new Date().toLocaleTimeString('pt-BR'), label: `Projeto aberto: ${p.name}` }],
      }),
    markSaved: (p) => set({ project: p, savedId: p.id, dirty: false }),
    undo: () => {
      const { past, project, future } = get();
      if (!past.length) return;
      set((s) => ({
        project: past[past.length - 1],
        past: past.slice(0, -1),
        future: [project, ...future],
        dirty: true,
        lastChange: 'Desfazer',
        changeLog: [...s.changeLog, { at: new Date().toLocaleTimeString('pt-BR'), label: 'Desfazer' }].slice(-200),
      }));
    },
    redo: () => {
      const { past, project, future } = get();
      if (!future.length) return;
      set((s) => ({
        project: future[0],
        future: future.slice(1),
        past: [...past, project],
        dirty: true,
        lastChange: 'Refazer',
        changeLog: [...s.changeLog, { at: new Date().toLocaleTimeString('pt-BR'), label: 'Refazer' }].slice(-200),
      }));
    },

    addDevice: (catalogId, row, module) => {
      const p = get().project;
      const place = canPlace(p, catalogId, row, module);
      if (!place.ok) return { ok: false, message: place.reason };
      const dev = createDevice(catalogId, row, module, nextLabel(p, catalogId));
      commit(`Adicionar ${dev.label}`, (d) => {
        d.devices.push(dev);
      });
      return { ok: true, id: dev.id };
    },
    moveDevice: (id, row, module) => {
      const p = get().project;
      const dev = p.devices.find((d) => d.id === id);
      if (!dev) return { ok: false, message: 'Dispositivo inexistente' };
      if (dev.row === row && dev.module === module) return { ok: true };
      const place = canPlace(p, dev.catalogId, row, module, id);
      if (!place.ok) return { ok: false, message: place.reason };
      commit(`Mover ${dev.label}`, (d) => {
        const x = d.devices.find((y) => y.id === id)!;
        x.row = row;
        x.module = module;
      });
      return { ok: true };
    },
    removeDevice: (id) =>
      commit('Remover dispositivo', (d) => {
        d.devices = d.devices.filter((x) => x.id !== id);
        d.wires = d.wires.filter((w) => w.from.owner !== id && w.to.owner !== id);
      }),
    updateDevice: (id, patch) =>
      commit('Editar dispositivo', (d) => {
        Object.assign(d.devices.find((x) => x.id === id)!, patch);
      }),
    updateDeviceConfig: (id, patch) =>
      commit('Configurar dispositivo', (d) => {
        const dev = d.devices.find((x) => x.id === id);
        const item = dev && getCatalogItem(dev.catalogId);
        if (!dev || !item) return;
        for (const [k, v] of Object.entries(patch)) {
          if (k in item.configurable) (dev.config as Record<string, unknown>)[k] = v;
        }
      }),
    setDeviceState: (id, state) =>
      commit(
        'Manobra',
        (d) => {
          const dev = d.devices.find((x) => x.id === id);
          if (dev) dev.state = state;
        },
        { history: false },
      ),

    addComb: (catalogId, row, start, length) => {
      const item = getCatalogItem(catalogId);
      const p = get().project;
      if (!item || item.electrical.category !== 'pente') return { ok: false, message: 'Item não é pente' };
      if (row >= p.enclosure.rows || start + length > p.enclosure.modulesPerRow) return { ok: false, message: 'Fora do trilho' };
      const comb: Comb = { id: uid('comb'), catalogId, row, startModule: start, lengthModules: length, phases: item.electrical.phases };
      commit('Adicionar pente', (d) => {
        d.combs.push(comb);
      });
      return { ok: true, id: comb.id };
    },
    updateComb: (id, patch) => {
      const p = get().project;
      const c = p.combs.find((x) => x.id === id);
      if (!c) return { ok: false };
      const n = { ...c, ...patch };
      if (n.row >= p.enclosure.rows || n.startModule + n.lengthModules > p.enclosure.modulesPerRow || n.lengthModules < 2) {
        return { ok: false, message: 'Fora do trilho' };
      }
      commit('Editar pente', (d) => {
        Object.assign(d.combs.find((x) => x.id === id)!, patch);
      });
      return { ok: true };
    },
    removeComb: (id) =>
      commit('Remover pente', (d) => {
        d.combs = d.combs.filter((x) => x.id !== id);
      }),

    addWire: (from, to, color, sectionMm2, strict) => {
      const p = get().project;
      if (terminalKey(from) === terminalKey(to)) return { ok: false, message: 'Origem e destino iguais' };
      const a = resolveTerminal(p, from);
      const b = resolveTerminal(p, to);
      if (!a || !b) return { ok: false, message: 'Borne inexistente' };
      const dup = p.wires.some(
        (w) =>
          (terminalKey(w.from) === terminalKey(from) && terminalKey(w.to) === terminalKey(to)) ||
          (terminalKey(w.from) === terminalKey(to) && terminalKey(w.to) === terminalKey(from)),
      );
      if (dup) return { ok: false, message: 'Já existe um condutor entre esses bornes' };
      if (strict) {
        const accepted = a.def.accepts.filter((f) => b.def.accepts.includes(f));
        if (!accepted.length) {
          return { ok: false, message: `Bornes incompatíveis: ${a.def.accepts.join('/')} × ${b.def.accepts.join('/')}` };
        }
        if (!accepted.some((f) => colorAllowsFunction(color, f))) {
          return { ok: false, message: `Cor ${color} incompatível com a função do borne (${accepted.join('/')})` };
        }
        const maxSec = Math.min(a.def.maxSectionMm2, b.def.maxSectionMm2);
        if (sectionMm2 > maxSec) return { ok: false, message: `Seção acima da capacidade do borne (${maxSec} mm²)` };
        const occ = terminalOccupancy(p);
        for (const t of [a, b]) {
          if (t.ownerKind !== 'device') continue;
          const dev = p.devices.find((d) => d.id === t.ref.owner)!;
          const max = getCatalogItem(dev.catalogId)?.compatibility.maxConductorsPerTerminal ?? 2;
          if ((occ.get(t.key) ?? 0) >= max) return { ok: false, message: `${t.ownerLabel} · ${t.def.label}: borne já tem ${max} condutor(es)` };
        }
      }
      const w = createWire(from, to, color, sectionMm2);
      commit('Ligar condutor', (d) => {
        d.wires.push(w);
      });
      return { ok: true, id: w.id };
    },
    updateWire: (id, patch) =>
      commit(patch.broken !== undefined ? 'Falha em condutor' : 'Editar condutor', (d) => {
        Object.assign(d.wires.find((x) => x.id === id)!, patch);
      }),
    removeWire: (id) =>
      commit('Remover condutor', (d) => {
        d.wires = d.wires.filter((x) => x.id !== id);
      }),

    addCircuit: (kind) => {
      const c = createCircuit(get().project, kind);
      commit(`Adicionar circuito C${c.number}`, (d) => {
        d.circuits.push(c);
      });
      return c.id;
    },
    updateCircuit: (id, patch) =>
      commit('Editar circuito', (d) => {
        Object.assign(d.circuits.find((x) => x.id === id)!, patch);
        if (patch.connection) pruneDanglingWires(d);
      }),
    removeCircuit: (id) =>
      commit('Remover circuito', (d) => {
        const owner = circuitOwnerId(id);
        d.circuits = d.circuits.filter((x) => x.id !== id);
        d.wires = d.wires.filter((w) => w.from.owner !== owner && w.to.owner !== owner);
        d.simulation.faults = d.simulation.faults.filter((f) => f.circuitId !== id);
      }),
    duplicateCircuit: (id) =>
      commit('Duplicar circuito', (d) => {
        const c = d.circuits.find((x) => x.id === id);
        if (!c) return;
        const number = Math.max(...d.circuits.map((x) => x.number)) + 1;
        d.circuits.push({ ...JSON.parse(JSON.stringify(c)), id: uid('c'), number, name: `${c.name} (cópia)`, loads: c.loads.map((l) => ({ ...l, id: uid('ld') })) });
      }),
    addLoad: (circuitId) =>
      commit('Adicionar carga', (d) => {
        d.circuits.find((x) => x.id === circuitId)?.loads.push(newLoad());
      }),
    updateLoad: (circuitId, loadId, patch) =>
      commit('Editar carga', (d) => {
        const l = d.circuits.find((x) => x.id === circuitId)?.loads.find((y) => y.id === loadId);
        if (l) Object.assign(l, patch);
      }),
    removeLoad: (circuitId, loadId) =>
      commit('Remover carga', (d) => {
        const c = d.circuits.find((x) => x.id === circuitId);
        if (c) c.loads = c.loads.filter((l) => l.id !== loadId);
      }),

    updateSupply: (patch) =>
      commit('Editar alimentação', (d) => {
        Object.assign(d.supply, patch);
        if (patch.type) pruneDanglingWires(d);
      }),
    updateEnclosure: (patch) => {
      const p = get().project;
      const n = { ...p.enclosure, ...patch };
      const outside = p.devices.find((dv) => {
        const w = getCatalogItem(dv.catalogId)?.dimensions.widthModules ?? 1;
        return dv.row >= n.rows || dv.module + w > n.modulesPerRow;
      });
      if (outside) return { ok: false, message: `${outside.label} ficaria fora do trilho` };
      commit('Editar quadro', (d) => {
        Object.assign(d.enclosure, patch);
        d.combs = d.combs.filter((c) => c.row < n.rows && c.startModule + c.lengthModules <= n.modulesPerRow);
      });
      return { ok: true };
    },
    rename: (name, description) =>
      commit('Renomear projeto', (d) => {
        d.name = name || d.name;
        if (description !== undefined) d.description = description;
      }),
    setValidationProfile: (prof) =>
      commit('Perfil de validação', (d) => {
        d.validationProfile = prof;
      }),
    storeValidation: (s) =>
      commit(
        'Validação registrada',
        (d) => {
          d.lastValidation = s;
        },
        { history: false },
      ),

    setEnergized: (on) =>
      commit(
        on ? 'Energizar' : 'Desenergizar',
        (d) => {
          d.simulation.energized = on;
        },
        { history: false },
      ),
    addFault: (f) =>
      commit(
        'Inserir falha',
        (d) => {
          d.simulation.faults.push({ ...f, id: uid('f') } as Fault);
        },
        { history: false },
      ),
    removeFault: (id) =>
      commit(
        'Remover falha',
        (d) => {
          d.simulation.faults = d.simulation.faults.filter((x) => x.id !== id);
        },
        { history: false },
      ),
    clearFaults: () =>
      commit(
        'Limpar falhas',
        (d) => {
          d.simulation.faults = [];
          for (const w of d.wires) w.broken = false;
        },
        { history: false },
      ),
    applyTrips: (ids) =>
      commit(
        'Atuação de proteção',
        (d) => {
          for (const dv of d.devices) if (ids.includes(dv.id) && dv.state === 'on') dv.state = 'tripped';
        },
        { history: false },
      ),
    resetTripped: () =>
      commit(
        'Rearmar dispositivos',
        (d) => {
          for (const dv of d.devices) if (dv.state === 'tripped') dv.state = 'off';
        },
        { history: false },
      ),
    setTimeScale: (n) =>
      commit(
        'Escala de tempo',
        (d) => {
          d.simulation.timeScale = n;
        },
        { history: false },
      ),
    setSpdEndOfLife: (ids, inc) =>
      commit(
        'Surto simulado',
        (d) => {
          for (const dv of d.devices) {
            if (!dv.spd) continue;
            if (inc) dv.spd.surges += 1;
            if (ids.includes(dv.id)) dv.spd.endOfLife = true;
          }
        },
        { history: false },
      ),
  };
});
