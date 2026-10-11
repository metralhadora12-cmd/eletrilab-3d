/** Estado transitório da simulação (não entra no histórico). */
import { create } from 'zustand';

interface SimState {
  thermal: Record<string, number>;
  clockS: number;
  set: (patch: Partial<Omit<SimState, 'set'>>) => void;
}

export const useSimStore = create<SimState>((set) => ({
  thermal: {},
  clockS: 0,
  set: (patch) => set(patch),
}));
