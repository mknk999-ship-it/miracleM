// 아이콘 생성 스크립트 (외부 이미지 라이브러리 없이 순수 Node로 PNG 인코딩)
// 실행: node scripts/generate-icons.js
// 디자인: 딥네이비 라운드 스퀘어 배경 + 크롬(은색) 별 3개 — "솔리드 크롬" 계급장 배지 시안
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 앱의 실제 다크 테마 톤 (css/style.css --bg → --surface-2)
const BG_TOP = [0x11, 0x11, 0x13];
const BG_BOTTOM = [0x21, 0x21, 0x24];

// 계급장 별의 크롬 그라데이션 (css/style.css --chrome-hi / --chrome-base / --chrome-mid)
const CHROME_HI = [0xf5, 0xf6, 0xf8];
const CHROME_BASE = [0xc7, 0xcb, 0xd3];
const CHROME_MID = [0x91, 0x95, 0x9e];

// 별 폴리곤 정점 (css/style.css .mark-star 의 clip-path 와 동일한 비율)
const STAR_PTS = [
  [0.50, 0.00], [0.61, 0.35], [0.98, 0.35], [0.68, 0.57], [0.79, 0.91],
  [0.50, 0.70], [0.21, 0.91], [0.32, 0.57], [0.02, 0.35], [0.39, 0.35],
];

const STAR_SIZE_RATIO = 0.213;
const GAP_RATIO = 0.06;

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size, draw) {
  const width = size, height = size;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = draw(x, y, width, height);
      const off = rowStart + 1 + x * 4;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = a;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function chromeGradient(t) {
  if (t <= 0.5) return lerpColor(CHROME_HI, CHROME_BASE, t / 0.5);
  return lerpColor(CHROME_BASE, CHROME_MID, (t - 0.5) / 0.5);
}

function pointInPolygon(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i][0], yi = verts[i][1];
    const xj = verts[j][0], yj = verts[j][1];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function starVerts(cx, cy, size) {
  return STAR_PTS.map(([px, py]) => [cx - size / 2 + px * size, cy - size / 2 + py * size]);
}

// 배경 + 별 3개를 항상 불투명(alpha 255)으로 그리는 "내용물" 샘플러.
// 라운드 스퀘어 마스크는 이 함수를 쓰는 쪽(sampleStandard)에서 별도로 적용한다.
function sampleContent(px, py, w, h) {
  const t = py / h;
  let [r, g, b] = lerpColor(BG_TOP, BG_BOTTOM, t);

  const starSize = w * STAR_SIZE_RATIO;
  const gap = w * GAP_RATIO;
  const totalW = starSize * 3 + gap * 2;
  const startX = w / 2 - totalW / 2 + starSize / 2;
  const starCy = h / 2 + starSize * 0.045; // 폴리곤이 위로 치우쳐 있어 살짝 아래로 보정

  for (let i = 0; i < 3; i++) {
    const starCx = startX + i * (starSize + gap);

    const verts = starVerts(starCx, starCy, starSize);
    if (pointInPolygon(px, py, verts)) {
      const localT = clamp((py - (starCy - starSize / 2)) / starSize, 0, 1);
      return [...chromeGradient(localT), 255];
    }

    // 별 주위의 은은한 그림자(depth)
    const haloVerts = starVerts(starCx, starCy, starSize * 1.14);
    if (pointInPolygon(px, py, haloVerts)) {
      r = lerp(r, 0, 0.3); g = lerp(g, 0, 0.3); b = lerp(b, 0, 0.3);
    }
  }

  return [Math.round(r), Math.round(g), Math.round(b), 255];
}

function maskAlpha(px, py, w, h) {
  const cx = w / 2, cy = h / 2;
  const nx = Math.abs(px - cx) / (w / 2);
  const ny = Math.abs(py - cy) / (h / 2);
  return Math.pow(nx, 4) + Math.pow(ny, 4) <= 1 ? 255 : 0;
}

function sampleStandard(px, py, w, h) {
  if (maskAlpha(px, py, w, h) === 0) return [0, 0, 0, 0];
  return sampleContent(px, py, w, h);
}

function sampleMaskable(px, py, w, h) {
  return sampleContent(px, py, w, h); // full-bleed, no rounded-square cutout
}

// 픽셀당 3x3 서브샘플링으로 가장자리를 부드럽게(anti-alias) 만든다.
function supersample(x, y, w, h, sampleFn) {
  const N = 3;
  let rA = 0, gA = 0, bA = 0, aA = 0;
  for (let sy = 0; sy < N; sy++) {
    for (let sx = 0; sx < N; sx++) {
      const px = x + (sx + 0.5) / N;
      const py = y + (sy + 0.5) / N;
      const [r, g, b, a] = sampleFn(px, py, w, h);
      rA += r * a; gA += g * a; bA += b * a; aA += a;
    }
  }
  const alpha = aA / (N * N);
  if (alpha <= 0.0001) return [0, 0, 0, 0];
  return [Math.round(rA / aA), Math.round(gA / aA), Math.round(bA / aA), Math.round(alpha)];
}

function drawIcon(x, y, w, h) { return supersample(x, y, w, h, sampleStandard); }
function drawMaskable(x, y, w, h) { return supersample(x, y, w, h, sampleMaskable); }

const outDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
  ['favicon-16.png', 16],
];

for (const [name, size] of sizes) {
  const png = makePng(size, drawIcon);
  fs.writeFileSync(path.join(outDir, name), png);
  console.log('wrote', name, size);
}

// maskable icon: full-bleed (no transparent corners), for Android adaptive icons
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), makePng(512, drawMaskable));
console.log('wrote icon-maskable-512.png 512');
