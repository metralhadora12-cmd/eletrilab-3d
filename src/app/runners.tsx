/** Processos de fundo: estabilização da simulação, relógio térmico e salvamento automático. */
import { useEffect, useRef } from 'react';
import { settleSimulation, stepThermal } from '../electrical/simulation/engine';
import { useAnalysis } from './analysis';
import { useProjectStore } from './projectStore';
import { useSimStore } from './simStore';
import { useUiStore } from './uiStore';
import { repo } from './repo';

const TICK_MS = 250;

export function SimulationRunner() {
  const analysis = useAnalysis();
  const latest = useRef(analysis);
  latest.current = analysis;
  const energized = analysis.project.simulation.energized;

  // Atuações instantâneas sempre que o projeto muda com a instalação energizada
  useEffect(() => {
    const { project, topology } = analysis;
    if (!project.simulation.energized) return;
    let result;
    try {
      result = settleSimulation(project, topology);
    } catch (e) {
      useUiStore.getState().addLog('error', `Simulação: ${(e as Error).message}`);
      return;
    }
    const ids = [...new Set(result.events.filter((e) => e.severity !== 'info').map((e) => e.deviceId))];
    if (ids.length) {
      useProjectStore.getState().applyTrips(ids);
      useUiStore.getState().logTrips(result.events);
      useUiStore.getState().toast('warn', result.events[0].message);
    }
  }, [analysis]);

  // Projeto aberto/recuperado energizado: a interface acompanha no modo Simulação
  useEffect(() => {
    if (energized && useUiStore.getState().mode === 'montagem') {
      useUiStore.getState().set({ mode: 'simulacao', tool: 'select', placing: null, wireStart: null, bottomTab: 'simulacao' });
    }
  }, [energized]);

  // Relógio do modelo térmico didático
  useEffect(() => {
    if (!energized) {
      useSimStore.getState().set({ thermal: {}, clockS: 0 });
      return;
    }
    const h = setInterval(() => {
      const { project, snapshot } = latest.current;
      const dt = (TICK_MS / 1000) * project.simulation.timeScale;
      const sim = useSimStore.getState();
      const r = stepThermal(project, snapshot, sim.thermal, dt);
      sim.set({ thermal: r.thermal, clockS: sim.clockS + dt });
      if (r.trips.length) {
        useProjectStore.getState().applyTrips(r.trips.map((t) => t.deviceId));
        useUiStore.getState().logTrips(r.trips);
        useUiStore.getState().toast('warn', r.trips[0].message);
      }
    }, TICK_MS);
    return () => clearInterval(h);
  }, [energized]);

  return null;
}

export function AutosaveRunner() {
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  useEffect(() => {
    if (!dirty) return;
    const h = setTimeout(() => {
      try {
        repo.autosave({ ...project, simulation: { ...project.simulation, thermal: useSimStore.getState().thermal } });
      } catch {
        /* armazenamento indisponível: ignorado (sessão continua em memória) */
      }
    }, 1500);
    return () => clearTimeout(h);
  }, [project, dirty]);
  return null;
}
