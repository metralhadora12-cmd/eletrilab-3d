/**
 * Geometria do quadro (em metros), independente de Three.js.
 *
 * Usada por: cena 3D (posições), roteamento dos condutores (traçado e
 * comprimento), solver elétrico (resistência dos fios internos) e testes.
 * Origem: centro da chapa de montagem; +y para cima; +z para a frente.
 */
import { getCatalogItem } from '../catalog';
import { MODULE_MM } from '../catalog/devices';
import type { DeviceInstance, Enclosure, Project, TerminalRef, Wire } from './schema';
import { FIXED_OWNERS, circuitIdFromOwner } from './schema';
import { OUTPUT_PITCH_MM, entryTerminals, mainBarTerminals, ownerKind, ownerTerminals } from './terminals';

export type Vec3 = [number, number, number];

export const MODULE_M = MODULE_MM / 1000;
export const ROW_PITCH = 0.15;
export const MARGIN_X = 0.075;
export const TOP_AREA = 0.13;
export const RAIL_Z = 0.012;
const BAR_AREA = 0.07;
const OUTPUT_ROW_H = 0.04;
const OUTPUT_GROUP_GAP = 0.012;

export interface BoardLayout {
  width: number;
  height: number;
  depth: number;
  railLeftX: number;
  railRightX: number;
  rows: number;
  modulesPerRow: number;
  outputRows: number;
  bottomArea: number;
  rowY: (r: number) => number;
  channelY: (k: number) => number;
}

function outputGroupWidth(nTerminals: number) {
  return nTerminals * (OUTPUT_PITCH_MM / 1000) + OUTPUT_GROUP_GAP;
}

/** Distribuição das saídas de circuito em fileiras na parte inferior do quadro. */
export function outputPlacement(project: Project) {
  const usable = project.enclosure.modulesPerRow * MODULE_M + 2 * (MARGIN_X - 0.02);
  const placements = new Map<string, { row: number; x0: number }>();
  let row = 0;
  let cursor = 0;
  for (const c of project.circuits) {
    const n = ownerTerminals(project, `circ:${c.id}`).length;
    const w = outputGroupWidth(n);
    if (cursor + w > usable && cursor > 0) {
      row++;
      cursor = 0;
    }
    placements.set(c.id, { row, x0: cursor });
    cursor += w;
  }
  return { placements, rows: project.circuits.length ? row + 1 : 1, usable };
}

export function boardLayout(project: Project): BoardLayout {
  const enc: Enclosure = project.enclosure;
  const outputRows = outputPlacement(project).rows;
  const bottomArea = BAR_AREA + outputRows * OUTPUT_ROW_H + 0.03;
  const width = enc.modulesPerRow * MODULE_M + 2 * MARGIN_X;
  const height = TOP_AREA + enc.rows * ROW_PITCH + bottomArea;
  const depth = enc.mounting === 'embutir' ? 0.1 : 0.115;
  const railLeftX = -(enc.modulesPerRow * MODULE_M) / 2;
  const top = height / 2;
  const rowY = (r: number) => top - TOP_AREA - (r + 0.5) * ROW_PITCH;
  return {
    width,
    height,
    depth,
    railLeftX,
    railRightX: -railLeftX,
    rows: enc.rows,
    modulesPerRow: enc.modulesPerRow,
    outputRows,
    bottomArea,
    rowY,
    channelY: (k: number) => top - TOP_AREA - k * ROW_PITCH,
  };
}

export function entryBlockOrigin(layout: BoardLayout): Vec3 {
  return [layout.railLeftX + 0.005, layout.height / 2 - 0.06, 0.03];
}

export function barOrigin(layout: BoardLayout, fn: 'N' | 'PE'): Vec3 {
  const y = layout.channelY(layout.rows) - 0.045;
  const len = mainBarTerminals('N').length * 0.014;
  const x = fn === 'PE' ? layout.railLeftX : layout.railRightX - len;
  return [x, y, 0.025];
}

export function outputOrigin(project: Project, layout: BoardLayout, circuitId: string): Vec3 | null {
  const p = outputPlacement(project).placements.get(circuitId);
  if (!p) return null;
  const bottom = -layout.height / 2;
  const y = bottom + 0.035 + (layout.outputRows - 1 - p.row) * OUTPUT_ROW_H;
  return [layout.railLeftX - (MARGIN_X - 0.02) + p.x0, y, 0.025];
}

/** Centro e dimensões (m) de um dispositivo no trilho. */
export function deviceBox(device: DeviceInstance, layout: BoardLayout) {
  const item = getCatalogItem(device.catalogId);
  const w = (item?.dimensions.widthMm ?? MODULE_MM) / 1000;
  const h = (item?.dimensions.heightMm ?? 85) / 1000;
  const d = (item?.dimensions.depthMm ?? 70) / 1000;
  const left = layout.railLeftX + device.module * MODULE_M;
  return {
    left,
    width: w,
    height: h,
    depth: d,
    center: [left + w / 2, layout.rowY(device.row), RAIL_Z + d / 2] as Vec3,
  };
}

export interface TerminalPose {
  position: Vec3;
  /** Direção de saída do condutor (+1 para cima, −1 para baixo). */
  exitDir: 1 | -1;
  /** Canal horizontal (entre trilhos) em que o condutor é conduzido. */
  channel: number;
}

export function terminalPose(project: Project, ref: TerminalRef, layout = boardLayout(project)): TerminalPose | null {
  const kind = ownerKind(ref.owner);
  if (kind === 'device') {
    const dev = project.devices.find((d) => d.id === ref.owner);
    if (!dev) return null;
    const def = ownerTerminals(project, ref.owner).find((t) => t.id === ref.terminal);
    if (!def) return null;
    const box = deviceBox(dev, layout);
    const top = def.side === 'top';
    const y = layout.rowY(dev.row) + (top ? 1 : -1) * (box.height / 2 - 0.004);
    return {
      position: [box.left + def.xMm / 1000, y, RAIL_Z + Math.min(0.034, box.depth * 0.5)],
      exitDir: top ? 1 : -1,
      channel: top ? dev.row : dev.row + 1,
    };
  }
  if (kind === 'entry') {
    const def = entryTerminals(project.supply).find((t) => t.id === ref.terminal);
    if (!def) return null;
    const [x0, y0, z0] = entryBlockOrigin(layout);
    return { position: [x0 + def.xMm / 1000, y0 - 0.022, z0], exitDir: -1, channel: 0 };
  }
  if (kind === 'bar-n' || kind === 'bar-pe') {
    const fn = kind === 'bar-n' ? 'N' : 'PE';
    const def = mainBarTerminals(fn).find((t) => t.id === ref.terminal);
    if (!def) return null;
    const [x0, y0, z0] = barOrigin(layout, fn);
    return { position: [x0 + def.xMm / 1000, y0 + 0.012, z0 + 0.006], exitDir: 1, channel: layout.rows };
  }
  const circuitId = circuitIdFromOwner(ref.owner);
  const o = outputOrigin(project, layout, circuitId);
  const def = ownerTerminals(project, ref.owner).find((t) => t.id === ref.terminal);
  if (!o || !def) return null;
  return { position: [o[0] + def.xMm / 1000, o[1] + 0.012, o[2] + 0.006], exitDir: 1, channel: layout.rows };
}

export interface WireRoute {
  points: Vec3[];
  lengthM: number;
}

const STUB = 0.016;

/**
 * Traçado ortogonal do condutor: sai do borne, segue até o canal entre trilhos,
 * percorre o canal (ou a calha lateral, se mudar de canal) e entra no borne de destino.
 * Cada condutor recebe uma "faixa" (lane) para reduzir sobreposições.
 */
export function routeWire(project: Project, wire: Wire, lane: number, layout = boardLayout(project)): WireRoute | null {
  const a = terminalPose(project, wire.from, layout);
  const b = terminalPose(project, wire.to, layout);
  if (!a || !b) return null;
  const dy = ((lane % 5) - 2) * 0.0055;
  const slack = Math.min(wire.slackMm / 1000, 0.4);
  const z = 0.045 + (lane % 4) * 0.007 + slack * 0.25;
  const pa = a.position;
  const pb = b.position;
  const a1: Vec3 = [pa[0], pa[1] + a.exitDir * STUB, pa[2]];
  const b1: Vec3 = [pb[0], pb[1] + b.exitDir * STUB, pb[2]];
  const yA = layout.channelY(a.channel) + dy;
  const yB = layout.channelY(b.channel) + dy;
  const pts: Vec3[] = [pa, a1, [pa[0], yA, z]];
  if (a.channel === b.channel) {
    pts.push([pb[0], yB, z]);
  } else {
    const mid = (pa[0] + pb[0]) / 2;
    const side = mid < 0 ? -1 : 1;
    const gx = (side < 0 ? layout.railLeftX : layout.railRightX) + side * (0.022 + (lane % 4) * 0.007);
    pts.push([gx, yA, z], [gx, yB, z], [pb[0], yB, z]);
  }
  pts.push(b1, pb);
  // Remove pontos coincidentes consecutivos
  const clean = pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 1e-6);
  let length = 0;
  for (let i = 1; i < clean.length; i++) length += dist(clean[i], clean[i - 1]);
  return { points: clean, lengthM: length + wire.slackMm / 1000 };
}

function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Comprimento (m) de todos os condutores, coerente com o traçado 3D. */
export function computeWireLengths(project: Project): Map<string, number> {
  const layout = boardLayout(project);
  const out = new Map<string, number>();
  project.wires.forEach((w, i) => {
    const r = routeWire(project, w, i, layout);
    out.set(w.id, r ? r.lengthM : 0.3);
  });
  return out;
}

/** Verifica se um dispositivo cabe no trilho sem sobrepor outros. */
export function canPlace(
  project: Project,
  catalogId: string,
  row: number,
  module: number,
  ignoreDeviceId?: string,
): { ok: boolean; reason?: string } {
  const item = getCatalogItem(catalogId);
  if (!item) return { ok: false, reason: 'Item inexistente' };
  if (item.compatibility.mounting !== 'trilho-din-35') return { ok: false, reason: 'Item não é montado em trilho DIN' };
  const w = item.dimensions.widthModules;
  if (row < 0 || row >= project.enclosure.rows) return { ok: false, reason: 'Trilho inexistente' };
  if (module < 0 || module + w > project.enclosure.modulesPerRow) return { ok: false, reason: 'Fora dos limites do trilho' };
  for (const d of project.devices) {
    if (d.id === ignoreDeviceId || d.row !== row) continue;
    const dw = getCatalogItem(d.catalogId)?.dimensions.widthModules ?? 1;
    if (module < d.module + dw && d.module < module + w) return { ok: false, reason: `Sobrepõe ${d.label}` };
  }
  return { ok: true };
}

/** Primeira posição livre (varredura por trilho) para um item. */
export function findFreeSlot(project: Project, catalogId: string): { row: number; module: number } | null {
  for (let r = 0; r < project.enclosure.rows; r++) {
    for (let m = 0; m < project.enclosure.modulesPerRow; m++) {
      if (canPlace(project, catalogId, r, m).ok) return { row: r, module: m };
    }
  }
  return null;
}

export { FIXED_OWNERS };
