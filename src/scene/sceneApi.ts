/**
 * Ponte entre eventos DOM (arrastar da biblioteca) e a cena 3D:
 * converte coordenadas de tela em posição (trilho, módulo) no quadro.
 */
import * as THREE from 'three';
import { getCatalogItem } from '../catalog';
import { MODULE_M, RAIL_Z, ROW_PITCH, type BoardLayout } from '../model/geometry';

export interface RailSlot {
  row: number;
  module: number;
}

interface Registered {
  camera: THREE.Camera;
  dom: HTMLElement;
}

let reg: Registered | null = null;

export function registerScene(r: Registered | null) {
  reg = r;
}

const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -RAIL_Z);
const ray = new THREE.Raycaster();

export function worldPointFromClient(clientX: number, clientY: number, z = RAIL_Z): THREE.Vector3 | null {
  if (!reg) return null;
  const rect = reg.dom.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, reg.camera);
  plane.constant = -z;
  const out = new THREE.Vector3();
  return ray.ray.intersectPlane(plane, out);
}

/** Converte um ponto no plano do trilho em (trilho, módulo) para um item com a largura dada. */
export function slotFromPoint(x: number, y: number, layout: BoardLayout, widthModules: number): RailSlot | null {
  let best = -1;
  let bestD = Infinity;
  for (let r = 0; r < layout.rows; r++) {
    const d = Math.abs(y - layout.rowY(r));
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  if (best < 0 || bestD > ROW_PITCH * 0.6) return null;
  const raw = Math.round((x - layout.railLeftX) / MODULE_M - widthModules / 2);
  const module = Math.max(0, Math.min(layout.modulesPerRow - widthModules, raw));
  return { row: best, module };
}

export function slotFromClient(clientX: number, clientY: number, layout: BoardLayout, catalogId: string): RailSlot | null {
  const p = worldPointFromClient(clientX, clientY);
  if (!p) return null;
  const w = getCatalogItem(catalogId)?.dimensions.widthModules ?? 1;
  return slotFromPoint(p.x, p.y, layout, w);
}
