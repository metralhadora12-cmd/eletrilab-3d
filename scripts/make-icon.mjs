// Gera build/icon.png (256×256) a partir da mesma geometria do favicon (public/favicon.svg),
// sem dependências: rasterização com supersampling 4×4 e codificação PNG via zlib.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZE = 256;
const SS = 4;
const UNIT = SIZE / 32; // o favicon é desenhado em 32×32
const BG = [0x1b, 0x24, 0x30];
const BOLT = [0xf2, 0xb6, 0x32];
const RADIUS = 6;
// "M18 3 8 18h7l-2 11 11-16h-7z"
const POLY = [
  [18, 3],
  [8, 18],
  [15, 18],
  [13, 29],
  [24, 13],
  [17, 13],
];

function insideRoundedRect(x, y) {
  const cx = Math.min(Math.max(x, RADIUS), 32 - RADIUS);
  const cy = Math.min(Math.max(y, RADIUS), 32 - RADIUS);
  return (x - cx) ** 2 + (y - cy) ** 2 <= RADIUS ** 2 && x >= 0 && y >= 0 && x <= 32 && y <= 32;
}

function insidePolygon(x, y) {
  let inside = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i];
    const [xj, yj] = POLY[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let py = 0; py < SIZE; py++) {
  raw[py * (SIZE * 4 + 1)] = 0; // filtro "None"
  for (let px = 0; px < SIZE; px++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = (px + (sx + 0.5) / SS) / UNIT;
        const y = (py + (sy + 0.5) / SS) / UNIT;
        if (!insideRoundedRect(x, y)) continue;
        const c = insidePolygon(x, y) ? BOLT : BG;
        r += c[0];
        g += c[1];
        b += c[2];
        a += 1;
      }
    }
    const o = py * (SIZE * 4 + 1) + 1 + px * 4;
    if (a > 0) {
      raw[o] = Math.round(r / a);
      raw[o + 1] = Math.round(g / a);
      raw[o + 2] = Math.round(b / a);
    }
    raw[o + 3] = Math.round((255 * a) / (SS * SS));
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // profundidade de bits
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icon.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`Ícone gerado: build/icon.png (${png.length} bytes)`);
