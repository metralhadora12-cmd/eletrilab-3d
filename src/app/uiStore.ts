/** Estado de interface (não entra no histórico nem no arquivo do projeto). */
import { create } from 'zustand';
import type { TerminalRef, WireColor } from '../model/schema';
import type { TripEvent } from '../electrical/simulation/engine';

export type Mode = 'montagem' | 'simulacao' | 'aprendizagem';
export type CenterView = '3d' | 'unifilar';
export type Tool = 'select' | 'wire' | 'place' | 'instrument';
export type SelectionKind = 'device' | 'wire' | 'circuit' | 'comb' | 'supply' | 'enclosure';
export interface Selection {
  kind: SelectionKind;
  id: string;
}
export type InstrumentKind =
  | 'multimetro-v'
  | 'multimetro-ohm'
  | 'multimetro-a'
  | 'alicate'
  | 'testador-dr'
  | 'indicador'
  | 'continuidade-pe'
  | 'wattimetro';
export type CameraRequestKind = 'frame' | 'front' | 'perspective' | 'terminals' | 'side';

export interface Toast {
  id: number;
  kind: 'info' | 'ok' | 'warn' | 'error';
  text: string;
}

export interface LogEntry {
  id: number;
  at: string;
  kind: 'trip' | 'info' | 'warn' | 'error' | 'measure';
  text: string;
}

interface UiState {
  mode: Mode;
  centerView: CenterView;
  tool: Tool;
  selection: Selection | null;
  placing: string | null;
  wireDraft: { color: WireColor; sectionMm2: number };
  wireStart: TerminalRef | null;
  hoverTerminal: string | null;
  doorOpen: boolean;
  coverOn: boolean;
  transparent: boolean;
  cutaway: boolean;
  showLabels: boolean;
  showFlow: boolean;
  cameraRequest: { kind: CameraRequestKind; nonce: number };
  ortho: boolean;
  instrument: InstrumentKind | null;
  probes: string[];
  clampMode: 'fase' | 'vivos';
  bottomTab: 'diagnostico' | 'calculos' | 'simulacao' | 'eventos';
  leftTab: 'biblioteca' | 'circuitos' | 'academia';
  bottomOpen: boolean;
  dialog: null | 'projetos' | 'configuracoes' | 'ajuda' | 'regras' | 'relatorio';
  toasts: Toast[];
  log: LogEntry[];
  dragging: boolean;
  /** Pré-visualização de posicionamento (biblioteca ou movimentação). */
  ghost: { catalogId: string; row: number; module: number; ok: boolean; moveId?: string } | null;
  /** Dispositivo sendo arrastado no trilho. */
  moving: string | null;
  leftOpen: boolean;
  rightOpen: boolean;

  set: (patch: Partial<Omit<UiState, 'set' | 'toast' | 'addLog' | 'select' | 'requestCamera'>>) => void;
  select: (s: Selection | null) => void;
  toast: (kind: Toast['kind'], text: string) => void;
  addLog: (kind: LogEntry['kind'], text: string) => void;
  logTrips: (events: TripEvent[]) => void;
  requestCamera: (kind: CameraRequestKind) => void;
}

let nextId = 1;

export const useUiStore = create<UiState>((set, get) => ({
  mode: 'montagem',
  centerView: '3d',
  tool: 'select',
  selection: null,
  placing: null,
  wireDraft: { color: 'preto', sectionMm2: 2.5 },
  wireStart: null,
  hoverTerminal: null,
  doorOpen: true,
  coverOn: false,
  transparent: false,
  cutaway: false,
  showLabels: true,
  showFlow: true,
  cameraRequest: { kind: 'frame', nonce: 0 },
  ortho: false,
  instrument: null,
  probes: [],
  clampMode: 'fase',
  bottomTab: 'diagnostico',
  leftTab: 'biblioteca',
  bottomOpen: true,
  dialog: null,
  toasts: [],
  log: [],
  dragging: false,
  ghost: null,
  moving: null,
  leftOpen: true,
  rightOpen: true,

  set: (patch) => set(patch),
  select: (selection) => set({ selection }),
  toast: (kind, text) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { id, kind, text }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), kind === 'error' ? 6000 : 3500);
  },
  addLog: (kind, text) =>
    set({ log: [...get().log.slice(-199), { id: nextId++, at: new Date().toLocaleTimeString('pt-BR'), kind, text }] }),
  logTrips: (events) => {
    for (const e of events) get().addLog(e.severity === 'erro' ? 'error' : e.severity === 'info' ? 'info' : 'trip', e.message);
  },
  requestCamera: (kind) => set({ cameraRequest: { kind, nonce: get().cameraRequest.nonce + 1 } }),
}));
