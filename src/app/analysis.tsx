/**
 * Análise derivada do projeto (topologia, validação, leituras de simulação),
 * calculada UMA vez por versão do projeto e compartilhada por cena 3D,
 * diagrama, painéis e instrumentos — garantindo coerência entre eles.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { analyzeTopology, type TopologyAnalysis } from '../electrical/simulation/topology';
import { validateProject, type ValidationReport } from '../electrical/validation/validate';
import { readSimulation, type SimulationSnapshot } from '../electrical/simulation/engine';
import { useProjectStore } from './projectStore';
import type { Project } from '../model/schema';

export interface Analysis {
  project: Project;
  topology: TopologyAnalysis;
  report: ValidationReport;
  snapshot: SimulationSnapshot;
  error: string | null;
}

const Ctx = createContext<Analysis | null>(null);

export function computeAnalysis(project: Project): Analysis {
  const topology = analyzeTopology(project);
  const report = validateProject(project, topology);
  let snapshot: SimulationSnapshot;
  let error: string | null = null;
  try {
    snapshot = readSimulation(project, topology);
  } catch (e) {
    error = `Falha no solver: ${(e as Error).message}`;
    snapshot = readSimulation({ ...project, simulation: { ...project.simulation, energized: false } }, topology);
  }
  return { project, topology, report, snapshot, error };
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const project = useProjectStore((s) => s.project);
  const value = useMemo(() => computeAnalysis(project), [project]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalysis(): Analysis {
  const v = useContext(Ctx);
  if (!v) throw new Error('AnalysisProvider ausente');
  return v;
}
