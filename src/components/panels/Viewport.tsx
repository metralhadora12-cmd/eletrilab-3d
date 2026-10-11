import { Suspense, lazy, useMemo } from 'react';
import {
  Cable,
  DoorOpen,
  Eye,
  Focus,
  Gauge,
  Layers,
  MousePointer2,
  Move3d,
  PanelTop,
  Scissors,
  ScanSearch,
  Sparkles,
  Square,
} from 'lucide-react';
import { useUiStore } from '../../app/uiStore';
import { useProjectStore } from '../../app/projectStore';
import { boardLayout } from '../../model/geometry';
import { slotFromClient } from '../../scene/sceneApi';
import { canPlace } from '../../model/geometry';
import { getCatalogItem } from '../../catalog';
import { placeFromGhost } from '../../scene/interaction/Placement';
import { InstrumentHud } from './InstrumentHud';
import { UnifilarView } from '../../diagrams/UnifilarView';

const Scene3D = lazy(() => import('../../scene/Scene3D').then((m) => ({ default: m.Scene3D })));

function hintText(s: ReturnType<typeof useUiStore.getState>, projectEnergized: boolean): string | null {
  if (s.centerView !== '3d') return null;
  if (s.tool === 'place' && s.placing) return `Posicione ${getCatalogItem(s.placing)?.name ?? ''} no trilho DIN (clique). Esc cancela.`;
  if (s.tool === 'wire') return s.wireStart ? 'Clique no borne de destino (verde = compatível). Esc cancela.' : 'Ferramenta Fio: clique no borne de origem.';
  if (s.tool === 'instrument') return 'Instrumento ativo: clique nos pontos de medição (bornes ou pontos de carga).';
  if (s.mode === 'simulacao') return projectEnergized ? 'Clique nas alavancas para manobrar · botão amarelo = teste do DR' : 'Simulação: energize no painel inferior (E).';
  if (s.moving) return 'Arraste para outra posição do trilho e solte.';
  return null;
}

export function Viewport() {
  const ui = useUiStore();
  const energized = useProjectStore((s) => s.project.simulation.energized);
  const hint = hintText(ui, energized);
  // Elemento memoizado: mudanças apenas de interface não re-renderizam o Canvas inteiro.
  const scene = useMemo(
    () => (
      <Suspense fallback={<div className="empty">Carregando cena 3D…</div>}>
        <Scene3D />
      </Suspense>
    ),
    [],
  );
  const isMount = ui.mode === 'montagem';

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/x-eletrilab') || !isMount) return;
    e.preventDefault();
    const project = useProjectStore.getState().project;
    const layout = boardLayout(project);
    const catalogId = useUiStore.getState().placing ?? '';
    // O id do item não é legível durante o dragover em alguns navegadores: usa o último item arrastado.
    const id = (window as unknown as { __eletrilabDrag?: string }).__eletrilabDrag ?? catalogId;
    if (!id) return;
    const slot = slotFromClient(e.clientX, e.clientY, layout, id);
    if (!slot) return ui.set({ ghost: null });
    const isComb = getCatalogItem(id)?.category === 'pente';
    ui.set({ ghost: { catalogId: id, row: slot.row, module: slot.module, ok: isComb || canPlace(project, id, slot.row, slot.module).ok } });
  };
  const onDrop = (e: React.DragEvent) => {
    const id = e.dataTransfer.getData('application/x-eletrilab');
    if (!id || !isMount) return;
    e.preventDefault();
    const layout = boardLayout(useProjectStore.getState().project);
    const slot = slotFromClient(e.clientX, e.clientY, layout, id);
    ui.set({ ghost: null });
    if (!slot) {
      ui.toast('warn', 'Solte o componente sobre um trilho DIN.');
      return;
    }
    placeFromGhost({ catalogId: id, row: slot.row, module: slot.module, ok: true });
  };

  const tool = (t: 'select' | 'wire' | 'instrument') => {
    if (t === 'wire') ui.set({ tool: 'wire', placing: null, ghost: null, coverOn: false, doorOpen: true, instrument: null, probes: [] });
    else if (t === 'instrument') ui.set({ tool: 'instrument', instrument: ui.instrument ?? 'multimetro-v', placing: null, wireStart: null, coverOn: false, doorOpen: true, probes: [] });
    else ui.set({ tool: 'select', placing: null, wireStart: null, instrument: null, probes: [], ghost: null });
  };

  return (
    <div className="viewport" onDragOver={onDragOver} onDrop={onDrop} onDragLeave={() => ui.set({ ghost: null })}>
      {ui.centerView === '3d' ? scene : <UnifilarView />}
      {ui.centerView === '3d' && (
        <>
          <div className="overlay toolbar-v" role="toolbar" aria-label="Ferramentas">
            <button className={`btn icon ${ui.tool === 'select' ? 'active' : ''}`} title="Selecionar / mover (V)" onClick={() => tool('select')}>
              <MousePointer2 size={16} />
            </button>
            <button className={`btn icon ${ui.tool === 'wire' ? 'active' : ''}`} title="Ferramenta Fio (W)" disabled={!isMount} onClick={() => tool('wire')}>
              <Cable size={16} />
            </button>
            <button className={`btn icon ${ui.tool === 'instrument' ? 'active' : ''}`} title="Instrumentos virtuais (I)" onClick={() => tool('instrument')}>
              <Gauge size={16} />
            </button>
            <div style={{ height: 6 }} />
            <button className="btn icon" title="Enquadrar quadro (F)" onClick={() => (ui.set({ ortho: false }), ui.requestCamera('frame'))}>
              <Focus size={16} />
            </button>
            <button className={`btn icon ${!ui.ortho ? 'active' : ''}`} title="Perspectiva de inspeção (1)" onClick={() => (ui.set({ ortho: false }), ui.requestCamera('perspective'))}>
              <Move3d size={16} />
            </button>
            <button className={`btn icon ${ui.ortho ? 'active' : ''}`} title="Vista frontal ortográfica para montagem (2)" onClick={() => (ui.set({ ortho: true }), ui.requestCamera('front'))}>
              <Square size={16} />
            </button>
            <button className="btn icon" title="Aproximar bornes do dispositivo selecionado (3)" onClick={() => (ui.set({ ortho: false }), ui.requestCamera('terminals'))}>
              <ScanSearch size={16} />
            </button>
            <button className="btn icon" title="Vista lateral (4)" onClick={() => (ui.set({ ortho: false }), ui.requestCamera('side'))}>
              <Layers size={16} />
            </button>
            <div style={{ height: 6 }} />
            <button className={`btn icon ${ui.doorOpen ? 'active' : ''}`} title="Abrir/fechar porta (D)" onClick={() => ui.set({ doorOpen: !ui.doorOpen })}>
              <DoorOpen size={16} />
            </button>
            <button className={`btn icon ${ui.coverOn ? 'active' : ''}`} title="Colocar/remover tampa de proteção (C)" onClick={() => ui.set({ coverOn: !ui.coverOn })}>
              <PanelTop size={16} />
            </button>
            <button className={`btn icon ${ui.transparent ? 'active' : ''}`} title="Transparência da caixa (T)" onClick={() => ui.set({ transparent: !ui.transparent })}>
              <Eye size={16} />
            </button>
            <button className={`btn icon ${ui.cutaway ? 'active' : ''}`} title="Corte da caixa (X)" onClick={() => ui.set({ cutaway: !ui.cutaway })}>
              <Scissors size={16} />
            </button>
            <button className={`btn icon ${ui.showFlow ? 'active' : ''}`} title="Fluxo de corrente (simulação)" onClick={() => ui.set({ showFlow: !ui.showFlow })}>
              <Sparkles size={16} />
            </button>
          </div>
          {hint && <div className="overlay hint-bar">{hint}</div>}
          {ui.tool === 'instrument' && <InstrumentHud />}
          {ui.tool === 'wire' && (
            <div className="overlay legend">
              <span>
                <i style={{ background: '#f2b632' }} />
                fase
              </span>
              <span>
                <i style={{ background: '#4b9fe0' }} />
                neutro
              </span>
              <span>
                <i style={{ background: '#3fb26f' }} />
                PE
              </span>
              <span>
                <i style={{ background: '#3fe07f' }} />
                compatível
              </span>
              <span>
                <i style={{ background: '#ff4a3d' }} />
                incompatível
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
