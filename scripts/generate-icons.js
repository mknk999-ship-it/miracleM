// 아이콘 생성 스크립트 (외부 이미지 라이브러리 없이 순수 Node로 PNG 인코딩)
// 실행: node scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NAVY = [0x0b, 0x11, 0x1f]; // 딥네이비 배경
const AMBER = [0xf0, 0xb03d]; // placeholder, replaced below
const AMBER_RGB = [0xf3, 0xb0, 0x3f];
const AMBER_DARK = [0xc8, 0x8a, 0x1f];

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

// 배경: 딥네이비, 중앙에 앰버 색 상승하는 초승달/해 느낌의 원 + "D" 모노그램 느낌의 링
function drawIcon(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const r = w * 0.5;

  // rounded-square mask (squircle-ish) via superellipse approximation
  const nx = Math.abs(dx) / (w / 2);
  const ny = Math.abs(dy) / (h / 2);
  const superellipse = Math.pow(nx, 4) + Math.pow(ny, 4);
  if (superellipse > 1) {
    return [0, 0, 0, 0]; // transparent outside rounded square
  }

  // background gradient navy
  const t = (y / h);
  const bg = [
    Math.round(lerp(0x0a, 0x12, t)),
    Math.round(lerp(0x10, 0x1c, t)),
    Math.round(lerp(0x1c, 0x2c, t)),
  ];

  // amber ring (progress-ring style) around center
  const ringOuter = w * 0.34;
  const ringInner = w * 0.24;
  if (dist < ringOuter && dist > ringInner) {
    return [...AMBER_RGB, 255];
  }
  // amber dot in center (sun)
  if (dist < w * 0.14) {
    return [...AMBER_RGB, 255];
  }
  return [...bg, 255];
}

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
function drawMaskable(x, y, w, h) {
  const c = drawIcon(x, y, w, h);
  if (c[3] === 0) {
    const t = (y / h);
    return [
      Math.round(lerp(0x0a, 0x12, t)),
      Math.round(lerp(0x10, 0x1c, t)),
      Math.round(lerp(0x1c, 0x2c, t)),
      255,
    ];
  }
  return c;
}
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), makePng(512, drawMaskable));
console.log('wrote icon-maskable-512.png 512');
