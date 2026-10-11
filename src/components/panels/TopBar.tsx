import {
  BookOpen,
  Box,
  Download,
  FilePlus2,
  FolderOpen,
  GitBranch,
  GraduationCap,
  HelpCircle,
  PanelLeft,
  PanelRight,
  Play,
  Redo2,
  Save,
  Scale,
  Settings,
  Undo2,
  Upload,
  Wrench,
  Zap,
} from 'lucide-react';
import { useProjectStore } from '../../app/projectStore';
import { useUiStore, type Mode } from '../../app/uiStore';
import { repo } from '../../app/repo';
import { exportProjectJson, importProjectJson } from '../../persistence/serialize';
import { buildEmptyExample } from '../../persistence/examples';
import { useSimStore } from '../../app/simStore';
import { downloadText, pickFile, safeFileName } from '../download';

export function saveProject() {
  const st = useProjectStore.getState();
  const ui = useUiStore.getState();
  try {
    const saved = repo.save({ ...st.project, simulation: { ...st.project.simulation, thermal: useSimStore.getState().thermal } });
    st.markSaved(saved);
    ui.toast('ok', `Projeto "${saved.name}" salvo localmente.`);
  } catch (e) {
    ui.toast('error', (e as Error).message);
  }
}

export async function importProjectFile() {
  const ui = useUiStore.getState();
  const file = await pickFile('.json,application/json');
  if (!file) return;
  const r = importProjectJson(await file.text());
  if (!r.ok) {
    ui.toast('error', `Arquivo rejeitado: ${r.errors.slice(0, 3).join(' | ')}`);
    ui.addLog('error', `Importação rejeitada (${file.name}): ${r.errors.join(' | ')}`);
    return;
  }
  useProjectStore.getState().load(r.project);
  ui.select(null);
  ui.requestCamera('frame');
  ui.toast('ok', `Projeto "${r.project.name}" importado e validado.`);
}

export function exportProjectFile() {
  const p = useProjectStore.getState().project;
  downloadText(`${safeFileName(p.name)}.eletrilab.json`, exportProjectJson(p));
}

export function switchMode(mode: Mode) {
  const ui = useUiStore.getState();
  const st = useProjectStore.getState();
  if (mode === 'montagem' && st.project.simulation.energized) {
    st.setEnergized(false);
    ui.addLog('info', 'Instalação desenergizada ao voltar para o modo montagem.');
  }
  ui.set({
    mode,
    tool: 'select',
    placing: null,
    wireStart: null,
    ghost: null,
    instrument: null,
    probes: [],
    ...(mode === 'simulacao' ? { bottomTab: 'simulacao' as const, coverOn: false } : {}),
    ...(mode === 'aprendizagem' ? { leftTab: 'academia' as const, leftOpen: true } : {}),
    ...(mode === 'montagem' ? { leftTab: 'biblioteca' as const } : {}),
  });
}

export function TopBar() {
  const name = useProjectStore((s) => s.project.name);
  const dirty = useProjectStore((s) => s.dirty);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const mode = useUiStore((s) => s.mode);
  const centerView = useUiStore((s) => s.centerView);
  const set = useUiStore((s) => s.set);
  const leftOpen = useUiStore((s) => s.leftOpen);
  const rightOpen = useUiStore((s) => s.rightOpen);

  const newProject = () => {
    if (dirty && !window.confirm('Descartar alterações não salvas e iniciar um novo projeto?')) return;
    useProjectStore.getState().load(buildEmptyExample());
    useUiStore.getState().select(null);
    useUiStore.getState().requestCamera('frame');
  };

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-logo">
          <Zap size={16} />
        </div>
        EletriLab 3D <small>laboratório virtual</small>
      </div>
      <div className="sep" />
      <button className="btn ghost icon" title="Novo projeto (Ctrl+N)" onClick={newProject}>
        <FilePlus2 size={16} />
      </button>
      <button className="btn ghost icon" title="Abrir projeto (Ctrl+O)" onClick={() => set({ dialog: 'projetos' })}>
        <FolderOpen size={16} />
      </button>
      <button className="btn ghost icon" title="Salvar (Ctrl+S)" onClick={saveProject}>
        <Save size={16} />
      </button>
      <button className="btn ghost icon" title="Exportar JSON" onClick={exportProjectFile}>
        <Download size={16} />
      </button>
      <button className="btn ghost icon" title="Importar JSON" onClick={importProjectFile}>
        <Upload size={16} />
      </button>
      <div className="sep" />
      <button className="btn ghost icon" title="Desfazer (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
        <Undo2 size={16} />
      </button>
      <button className="btn ghost icon" title="Refazer (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
        <Redo2 size={16} />
      </button>
      <div className="sep" />
      <div className="seg" role="tablist" aria-label="Modo">
        <button className={mode === 'montagem' ? 'on' : ''} onClick={() => switchMode('montagem')} title="Modo montagem">
          <Wrench size={14} /> Montagem
        </button>
        <button className={mode === 'simulacao' ? 'on' : ''} onClick={() => switchMode('simulacao')} title="Modo simulação">
          <Play size={14} /> Simulação
        </button>
        <button className={mode === 'aprendizagem' ? 'on' : ''} onClick={() => switchMode('aprendizagem')} title="Academia Elétrica">
          <GraduationCap size={14} /> Aprendizagem
        </button>
      </div>
      <div className="seg" aria-label="Visualização">
        <button className={centerView === '3d' ? 'on' : ''} onClick={() => set({ centerView: '3d' })} title="Quadro 3D (U alterna)">
          <Box size={14} /> 3D
        </button>
        <button className={centerView === 'unifilar' ? 'on' : ''} onClick={() => set({ centerView: 'unifilar' })} title="Diagrama unifilar (U alterna)">
          <GitBranch size={14} /> Unifilar
        </button>
      </div>
      <div className="spacer" />
      <div className="project-name" title={name}>
        <b>{name}</b>
        {dirty ? ' •' : ''}
      </div>
      <button className={`btn ghost icon ${leftOpen ? '' : 'active'}`} title="Mostrar/ocultar painel esquerdo" onClick={() => set({ leftOpen: !leftOpen })}>
        <PanelLeft size={16} />
      </button>
      <button className={`btn ghost icon ${rightOpen ? '' : 'active'}`} title="Mostrar/ocultar painel direito" onClick={() => set({ rightOpen: !rightOpen })}>
        <PanelRight size={16} />
      </button>
      <button className="btn ghost icon" title="Regras técnicas e fontes" onClick={() => set({ dialog: 'regras' })}>
        <Scale size={16} />
      </button>
      <button className="btn ghost icon" title="Relatório de desempenho" onClick={() => set({ dialog: 'relatorio' })}>
        <BookOpen size={16} />
      </button>
      <button className="btn ghost icon" title="Configurações" onClick={() => set({ dialog: 'configuracoes' })}>
        <Settings size={16} />
      </button>
      <button className="btn ghost icon" title="Ajuda e atalhos (F1)" onClick={() => set({ dialog: 'ajuda' })}>
        <HelpCircle size={16} />
      </button>
    </header>
  );
}
