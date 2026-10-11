import { create } from 'zustand';
import { storage } from '../app/repo';
import { loadProgress, saveProgress, type Progress } from './progress';

interface AcademyState {
  progress: Progress;
  activeChallenge: string | null;
  openLesson: string | null;
  update: (fn: (p: Progress) => Progress) => void;
  set: (patch: Partial<Pick<AcademyState, 'activeChallenge' | 'openLesson'>>) => void;
}

export const useAcademyStore = create<AcademyState>((set, get) => ({
  progress: loadProgress(storage),
  activeChallenge: null,
  openLesson: null,
  update: (fn) => {
    const next = fn(get().progress);
    try {
      saveProgress(storage, next);
    } catch {
      /* armazenamento indisponível */
    }
    set({ progress: next });
  },
  set: (patch) => set(patch),
}));
