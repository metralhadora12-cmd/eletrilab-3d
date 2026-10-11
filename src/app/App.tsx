import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { AnalysisProvider } from './analysis';
import { AutosaveRunner, SimulationRunner } from './runners';
import { useProjectStore } from './projectStore';
import { useUiStore } from './uiStore';
import { repo } from './repo';
import { TopBar, saveProject, switchMode } from '../components/panels/TopBar';
import { LeftPanel } from '../components/panels/LeftPanel';
import { PropertiesPanel } from '../components/panels/PropertiesPanel';
import { BottomPanel } from '../components/panels/BottomPanel';
import { Viewport } from '../components/panels/Viewport';
import { Dialogs, RecoverDialog } from '../components/panels/Dialogs';
import type { AutosaveRecord } from '../persistence/storage';

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useProjectStore.getState();
      const ui = useUiStore.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveProject();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        ui.set({ dialog: 'projetos' });
        return;
      }
      if (isTyping(e)) return;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        st.undo();
        return;
      }
      if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        st.redo();
        return;
      }
      if (ctrl) return;
      switch (e.key) {
        case 'Escape':
          if (ui.wireStart) ui.set({ wireStart: null });
          else if (ui.tool !== 'select') ui.set({ tool: 'select', placing: null, ghost: null, instrument: null, probes: [] });
          else ui.select(null);
          break;
        case 'Delete':
        case 'Backspace': {
          const s = ui.selection;
          if (!s) break;
          if (s.kind === 'device' && ui.mode === 'montagem') st.removeDevice(s.id);
          else if (s.kind === 'wire') st.removeWire(s.id);
          else if (s.kind === 'comb') st.removeComb(s.id);
          else break;
          ui.select(null);
          break;
        }
        case 'F1':
          e.preventDefault();
          ui.set({ dialog: 'ajuda' });
          break;
        default: {
          const k = e.key.toLowerCase();
          if (k === 'v') ui.set({ tool: 'select', placing: null, wireStart: null, instrument: null, probes: [], ghost: null });
          else if (k === 'w' && ui.mode === 'montagem') ui.set({ tool: 'wire', placing: null, coverOn: false, doorOpen: true, instrument: null, probes: [] });
          else if (k === 'i') ui.set({ tool: 'instrument', instrument: ui.instrument ?? 'multimetro-v', coverOn: false, doorOpen: true, probes: [] });
          else if (k === 'f') (ui.set({ ortho: false }), ui.requestCamera('frame'));
          else if (k === '1') (ui.set({ ortho: false }), ui.requestCamera('perspective'));
          else if (k === '2') (ui.set({ ortho: true }), ui.requestCamera('front'));
          else if (k === '3') (ui.set({ ortho: false }), ui.requestCamera('terminals'));
          else if (k === '4') (ui.set({ ortho: false }), ui.requestCamera('side'));
          else if (k === 'd') ui.set({ doorOpen: !ui.doorOpen });
          else if (k === 'c') ui.set({ coverOn: !ui.coverOn });
          else if (k === 't') ui.set({ transparent: !ui.transparent });
          else if (k === 'x') ui.set({ cutaway: !ui.cutaway });
          else if (k === 'u') ui.set({ centerView: ui.centerView === '3d' ? 'unifilar' : '3d' });
          else if (k === 'e') {
            if (ui.mode !== 'simulacao') switchMode('simulacao');
            const on = !useProjectStore.getState().project.simulation.energized;
            useProjectStore.getState().setEnergized(on);
            ui.addLog('info', on ? 'Alimentação energizada (simulação virtual).' : 'Alimentação desligada.');
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === 'ok' ? <CheckCircle2 size={16} color="#3fb26f" /> : t.kind === 'error' ? <XCircle size={16} color="#e5534b" /> : t.kind === 'warn' ? <AlertTriangle size={16} color="#e3a72f" /> : <Info size={16} color="#5aa9e6" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function App() {
  useShortcuts();
  const leftOpen = useUiStore((s) => s.leftOpen);
  const rightOpen = useUiStore((s) => s.rightOpen);
  const [recover, setRecover] = useState<AutosaveRecord | null>(null);

  useEffect(() => {
    const rec = repo.loadAutosave();
    if (rec) setRecover(rec);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useProjectStore.getState().dirty) {
        repo.autosave(useProjectStore.getState().project);
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    useUiStore.getState().addLog('info', 'EletriLab 3D iniciado com o projeto de exemplo. Ferramenta educacional — não substitui projeto elétrico.');
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return (
    <AnalysisProvider>
      <div className="app">
        <TopBar />
        <div className={`workspace ${leftOpen ? '' : 'no-left'} ${rightOpen ? '' : 'no-right'}`}>
          <LeftPanel />
          <main className="center">
            <Viewport />
            <BottomPanel />
          </main>
          <PropertiesPanel />
        </div>
      </div>
      <SimulationRunner />
      <AutosaveRunner />
      <Dialogs />
      <Toasts />
      {recover && <RecoverDialog record={recover} onClose={() => setRecover(null)} />}
    </AnalysisProvider>
  );
}
