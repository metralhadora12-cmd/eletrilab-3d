/** Pontuação, histórico de tentativas, dicas graduais e relatório de desempenho. */
import { z } from 'zod';
import type { KeyValueStorage } from '../persistence/storage';
import { CHALLENGES, type Challenge } from './challenges';
import { LEVELS } from './content';

export const AttemptSchema = z.object({
  challengeId: z.string(),
  at: z.string(),
  passed: z.boolean(),
  score: z.number(),
  notes: z.array(z.string()),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const ProgressSchema = z.object({
  attempts: z.array(AttemptSchema),
  hintsUsed: z.record(z.number().int().min(0)),
  completed: z.record(z.object({ score: z.number(), at: z.string() })),
  lessonsRead: z.array(z.string()),
  unlockAll: z.boolean(),
});
export type Progress = z.infer<typeof ProgressSchema>;

const KEY = 'eletrilab.v1.academy';

export const emptyProgress = (): Progress => ({ attempts: [], hintsUsed: {}, completed: {}, lessonsRead: [], unlockAll: false });

export function loadProgress(storage: KeyValueStorage): Progress {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptyProgress();
    const r = ProgressSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(storage: KeyValueStorage, p: Progress) {
  storage.setItem(KEY, JSON.stringify(p));
}

/**
 * Pontuação: pontos base − 15 % por dica usada − 10 % por tentativa anterior
 * sem sucesso; mínimo de 30 % dos pontos.
 */
export function computeScore(ch: Challenge, progress: Progress): number {
  const hints = progress.hintsUsed[ch.id] ?? 0;
  const failures = progress.attempts.filter((a) => a.challengeId === ch.id && !a.passed).length;
  const factor = Math.max(0.3, 1 - 0.15 * hints - 0.1 * failures);
  return Math.round(ch.points * factor);
}

export function recordAttempt(progress: Progress, ch: Challenge, passed: boolean, notes: string[]): Progress {
  const score = passed ? computeScore(ch, progress) : 0;
  const attempt: Attempt = { challengeId: ch.id, at: new Date().toISOString(), passed, score, notes: notes.slice(0, 12) };
  const completed = { ...progress.completed };
  if (passed && (!completed[ch.id] || completed[ch.id].score < score)) completed[ch.id] = { score, at: attempt.at };
  return { ...progress, attempts: [...progress.attempts, attempt], completed };
}

export function takeHint(progress: Progress, ch: Challenge): Progress {
  const n = Math.min((progress.hintsUsed[ch.id] ?? 0) + 1, ch.hints.length);
  return { ...progress, hintsUsed: { ...progress.hintsUsed, [ch.id]: n } };
}

/** Um nível é liberado quando pelo menos metade dos desafios do nível anterior foi concluída. */
export function isLevelUnlocked(level: number, progress: Progress): boolean {
  if (level <= 1 || progress.unlockAll) return true;
  const prev = CHALLENGES.filter((c) => c.level === level - 1);
  const done = prev.filter((c) => progress.completed[c.id]).length;
  return done >= Math.ceil(prev.length / 2);
}

export function performanceReport(progress: Progress) {
  const total = CHALLENGES.reduce((a, c) => a + c.points, 0);
  const earned = Object.values(progress.completed).reduce((a, c) => a + c.score, 0);
  const levels = LEVELS.map((l) => {
    const chs = CHALLENGES.filter((c) => c.level === l.id);
    return {
      level: l.id,
      title: l.title,
      completed: chs.filter((c) => progress.completed[c.id]).length,
      total: chs.length,
      lessonsRead: l.lessons.filter((x) => progress.lessonsRead.includes(x.id)).length,
      lessons: l.lessons.length,
    };
  });
  const failures = progress.attempts.filter((a) => !a.passed);
  const noteCount = new Map<string, number>();
  for (const a of failures) for (const n of a.notes) noteCount.set(n, (noteCount.get(n) ?? 0) + 1);
  const frequentIssues = [...noteCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    earned,
    total,
    percent: total ? (100 * earned) / total : 0,
    attempts: progress.attempts.length,
    successRate: progress.attempts.length ? (100 * progress.attempts.filter((a) => a.passed).length) / progress.attempts.length : 0,
    hintsUsed: Object.values(progress.hintsUsed).reduce((a, b) => a + b, 0),
    levels,
    frequentIssues,
  };
}
