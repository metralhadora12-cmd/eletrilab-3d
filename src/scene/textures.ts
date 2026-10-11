/** Texturas geradas em canvas (rótulos, listras) — sem fontes ou arquivos externos. */
import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

export interface LabelLine {
  text: string;
  size: number;
  bold?: boolean;
  color?: string;
  mono?: boolean;
}

export function labelTexture(
  lines: LabelLine[],
  opts: { w: number; h: number; bg: string; border?: string; align?: 'center' | 'left' },
): THREE.CanvasTexture {
  const key = JSON.stringify([lines, opts]);
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = opts.w;
  canvas.height = opts.h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, opts.w, opts.h);
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, opts.w - 3, opts.h - 3);
  }
  const total = lines.reduce((a, l) => a + l.size * 1.18, 0);
  let y = (opts.h - total) / 2;
  for (const l of lines) {
    ctx.font = `${l.bold ? '700' : '500'} ${l.size}px ${l.mono ? 'Consolas, monospace' : 'Segoe UI, Arial, sans-serif'}`;
    ctx.fillStyle = l.color ?? '#1b1f24';
    ctx.textBaseline = 'top';
    ctx.textAlign = opts.align === 'left' ? 'left' : 'center';
    ctx.fillText(l.text, opts.align === 'left' ? 10 : opts.w / 2, y, opts.w - 8);
    y += l.size * 1.18;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (cache.size > 400) cache.clear();
  cache.set(key, tex);
  return tex;
}

const stripeCache = new Map<string, THREE.CanvasTexture>();
/** Listras diagonais (condutor verde-amarelo). */
export function stripeTexture(base: string, stripe: string): THREE.CanvasTexture {
  const key = base + stripe;
  const hit = stripeCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 32);
  ctx.fillStyle = stripe;
  for (let x = -64; x < 128; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 32, 32);
    ctx.lineTo(x + 16, 32);
    ctx.closePath();
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  stripeCache.set(key, t);
  return t;
}
