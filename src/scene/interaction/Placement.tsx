/**
 * Posicionamento no trilho DIN com encaixe magnético (módulos de 18 mm):
 * inserção a partir da biblioteca e movimentação de dispositivos existentes.
 */
import type { ThreeEvent } from '@react-three/fiber';
import { getCatalogItem } from '../../catalog';
import { canPlace, MODULE_M, RAIL_Z, type BoardLayout } from '../../model/geometry';
import type { Project } from '../../model/schema';
import { useUiStore } from '../../app/uiStore';
import { useProjectStore } from '../../app/projectStore';
import { slotFromPoint } from '../sceneApi';

function evaluateGhost(project: Project, layout: BoardLayout, catalogId: string, x: number, y: number, moveId?: string) {
  const item = getCatalogItem(catalogId);
  if (!item) return null;
  const isComb = item.category === 'pente';
  const w = isComb ? 1 : item.dimensions.widthModules;
  const slot = slotFromPoint(x, y, layout, w);
  if (!slot) return null;
  const ok = isComb ? true : canPlace(project, catalogId, slot.row, slot.module, moveId).ok;
  return { catalogId, row: slot.row, module: slot.module, ok, moveId };
}

/**
 * Inicia o arrasto de um dispositivo. O ouvinte de soltura é registrado
 * imediatamente (não em um efeito), para não perder cliques rápidos.
 */
export function beginMove(deviceId: string) {
  const ui = useUiStore.getState();
  ui.set({ moving: deviceId, dragging: true, ghost: null });
  const up = () => {
    const s = useUiStore.getState();
    const g = s.ghost;
    if (g && g.moveId === deviceId && g.ok) {
      const r = useProjectStore.getState().moveDevice(deviceId, g.row, g.module);
      if (!r.ok) s.toast('warn', r.message ?? 'Posição inválida');
    } else if (g && g.moveId === deviceId && !g.ok) {
      s.toast('warn', 'Posição ocupada ou fora do trilho.');
    }
    s.set({ moving: null, dragging: false, ghost: null });
  };
  window.addEventListener('pointerup', up, { once: true });
}

export function PlacementPlane({ project, layout }: { project: Project; layout: BoardLayout }) {
  const tool = useUiStore((s) => s.tool);
  const placing = useUiStore((s) => s.placing);
  const moving = useUiStore((s) => s.moving);

  const active = (tool === 'place' && placing) || moving;
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const ui = useUiStore.getState();
    if (ui.moving) {
      const dev = project.devices.find((d) => d.id === ui.moving);
      if (!dev) return;
      ui.set({ ghost: evaluateGhost(project, layout, dev.catalogId, e.point.x, e.point.y, dev.id) });
    } else if (ui.tool === 'place' && ui.placing) {
      ui.set({ ghost: evaluateGhost(project, layout, ui.placing, e.point.x, e.point.y) });
    }
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const ui = useUiStore.getState();
    if (ui.tool !== 'place' || !ui.placing) return;
    e.stopPropagation();
    const g = evaluateGhost(project, layout, ui.placing, e.point.x, e.point.y);
    if (!g) return;
    placeFromGhost(g);
  };
  return (
    <mesh position={[0, 0, RAIL_Z + 0.002]} onPointerMove={active ? onMove : undefined} onClick={active ? onClick : undefined} onPointerLeave={() => !useUiStore.getState().moving && useUiStore.getState().set({ ghost: null })}>
      <planeGeometry args={[layout.width, layout.height]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export function placeFromGhost(g: { catalogId: string; row: number; module: number; ok: boolean }) {
  const ui = useUiStore.getState();
  const store = useProjectStore.getState();
  const item = getCatalogItem(g.catalogId);
  if (!item) return;
  if (item.category === 'pente') {
    const len = Math.min(6, store.project.enclosure.modulesPerRow - g.module);
    const r = store.addComb(g.catalogId, g.row, g.module, Math.max(2, len));
    if (r.ok) {
      ui.select({ kind: 'comb', id: r.id! });
      ui.toast('ok', 'Pente instalado — ajuste o comprimento nas propriedades.');
    } else ui.toast('warn', r.message ?? 'Não foi possível instalar');
    return;
  }
  const r = store.addDevice(g.catalogId, g.row, g.module);
  if (r.ok) {
    ui.select({ kind: 'device', id: r.id! });
    ui.addLog('info', `${item.name} instalado no trilho ${g.row + 1}, módulo ${g.module + 1}.`);
  } else {
    ui.toast('warn', `Não foi possível posicionar: ${r.message}`);
  }
}

export function Ghost({ layout }: { layout: BoardLayout }) {
  const ghost = useUiStore((s) => s.ghost);
  if (!ghost) return null;
  const item = getCatalogItem(ghost.catalogId);
  if (!item) return null;
  const isComb = item.category === 'pente';
  const w = (isComb ? 6 : item.dimensions.widthModules) * MODULE_M;
  const h = isComb ? 0.012 : item.dimensions.heightMm / 1000;
  const d = isComb ? 0.012 : item.dimensions.depthMm / 1000;
  const y = layout.rowY(ghost.row) + (isComb ? 0.05 : 0);
  return (
    <mesh position={[layout.railLeftX + ghost.module * MODULE_M + w / 2, y, RAIL_Z + d / 2]}>
      <boxGeometry args={[w, h, d]} />
      <meshBasicMaterial color={ghost.ok ? '#3fe07f' : '#ff4a3d'} transparent opacity={0.35} depthWrite={false} />
    </mesh>
  );
}
