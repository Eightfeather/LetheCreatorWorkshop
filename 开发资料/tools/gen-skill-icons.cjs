// 生成 src/web/ui-assets/skill-icons.css
// 每档 = 等级底板(底) + 七边形插画(中) + 属性框(顶)
// 为避免「框被压扁」：每档记录帧图真实宽高比 --sk-ar（帧盒用 aspect-ratio 保持比例，只改高度不改比例），
// 并按属性框中心空洞实测给出插画尺寸 --sk-iw/--sk-ih（px，基于 FRAME_H=72 的帧盒）。
// 用法：node tools/gen-skill-icons.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const FR = process.env.LCW_FRAMES || path.join(ROOT, 'src/web/ui-assets/skill/frames3');
const ICON_DIR = path.join(ROOT, 'src/web/ui-assets/skill');
const OUT = path.join(ROOT, 'src/web/ui-assets/skill-icons.css');
const FRAME_H = 72; // 与 style.css 的 .sk-lvl/.sk-sin 高度一致

const b64 = (p) => 'url("data:image/png;base64,' + fs.readFileSync(p).toString('base64') + '")';

function decodePNG(file) {
  const b = fs.readFileSync(file);
  let off = 8, w = 0, h = 0, depth = 8, ctype = 6;
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString('ascii', off + 4, off + 8);
    const dat = b.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = dat.readUInt32BE(0); h = dat.readUInt32BE(4); depth = dat[8]; ctype = dat[9]; }
    if (type === 'IDAT') idat.push(dat);
    off += 12 + len;
    if (type === 'IEND') break;
  }
  if (depth !== 8 || (ctype !== 6 && ctype !== 4)) return { w, h, bpp: 0, data: null };
  const bpp = ctype === 6 ? 4 : 2;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp + 1;
  const out = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * stride];
    const line = raw.slice(y * stride + 1, (y + 1) * stride);
    for (let x = 0; x < w * bpp; x++) {
      const a = x >= bpp ? out[y * w * bpp + x - bpp] : 0;
      const bb = y > 0 ? out[(y - 1) * w * bpp + x] : 0;
      const c = y > 0 && x >= bpp ? out[(y - 1) * w * bpp + x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a; else if (ft === 2) v += bb; else if (ft === 3) v += (a + bb) >> 1;
      else if (ft === 4) { const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c); }
      out[y * w * bpp + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}

// 中心空洞（只对属性框有意义；底板是实心剪影，没有空洞）
function holeOf(png) {
  if (!png || !png.data) return null;
  const { w, h, bpp, data } = png;
  let l = 1e9, r = -1, t = -1, b = -1;
  for (let y = 0; y < h; y++) {
    let first = -1, last = -1;
    for (let x = 0; x < w; x++) if (data[(y * w + x) * bpp + 3] > 30) { if (first < 0) first = x; last = x; }
    if (first < 0 || last - first < 8) continue;
    for (let x = first + 1; x < last; x++) {
      if (data[(y * w + x) * bpp + 3] <= 30) { if (x < l) l = x; if (x > r) r = x; if (t < 0) t = y; b = y; }
    }
  }
  if (r < 0) return null;
  return {
    wPct: (r - l + 1) / w, hPct: (b - t + 1) / h,
    cx: (l + r + 1) / 2 / w, cy: (t + b + 1) / 2 / h,
  };
}

const files = fs.readdirSync(FR).filter((f) => f.endsWith('.png'));
const sins = new Set(), lvls = new Set();
for (const f of files) { const k = f.replace(/\.png$/, ''); if (k.endsWith('_sin')) sins.add(k.slice(0, -4)); if (k.endsWith('_level')) lvls.add(k.slice(0, -6)); }
const combos = [...lvls].filter((k) => sins.has(k)).sort();

const lines = [
  '/* 技能图标框：每档 = 等级底板(底) + 七边形插画(中) + 属性框(顶)；来源 limbuscompany.huijiwiki「技能图标DIY」',
  '   --sk-ar    = 帧图真实宽高比（帧盒按它保持比例，避免被压扁）',
  '   --sk-iw/--sk-ih = 插画尺寸（px，基于 ' + FRAME_H + 'px 高的帧盒，按属性框中心空洞实测 ×0.97）',
  '   生成脚本：tools/gen-skill-icons.cjs —— 不要手改本文件。*/',
];
let measured = 0, arCount = 0;
for (const c of combos) {
  const sinPng = decodePNG(path.join(FR, c + '_sin.png'));
  const lvlPng = decodePNG(path.join(FR, c + '_level.png'));
  const ar = sinPng && sinPng.h ? (sinPng.w / sinPng.h) : 1;
  const arLvl = lvlPng && lvlPng.h ? (lvlPng.w / lvlPng.h) : ar;
  const hole = holeOf(sinPng);
  const boxW = FRAME_H * ar;
  const iw = hole ? Math.min(boxW * hole.wPct, FRAME_H * hole.hPct) * 0.97 : FRAME_H * 0.56;
  const ih = iw; // 插画始终正方形（七边形裁切），取 min 后不会溢出空洞
  if (hole) measured++;
  if (sinPng && sinPng.w) arCount++;
  lines.push('.sk-frame-' + c + '{--sk-lvl:' + b64(path.join(FR, c + '_level.png')) + ';--sk-sin:' + b64(path.join(FR, c + '_sin.png'))
    + ';--sk-ar:' + ar.toFixed(4) + ';--sk-arl:' + arLvl.toFixed(4)
    + ';--sk-iw:' + iw.toFixed(1) + 'px;--sk-ih:' + ih.toFixed(1) + 'px}');
}
const coin = path.join(ICON_DIR, 'coin.png');
const atk = path.join(ICON_DIR, 'atk-correction.png');
if (!fs.existsSync(coin)) throw new Error('缺少 coin.png');
if (!fs.existsSync(atk)) throw new Error('缺少 atk-correction.png');
lines.push('.sk-ico-coin,.sk-coin{background-image:' + b64(coin) + '}');
lines.push('.sk-ico-atk{background-image:' + b64(atk) + '}');
fs.writeFileSync(OUT, lines.join('\n'));
console.log('frames', combos.length, 'holes', measured, 'aspects', arCount, 'FRAME_H', FRAME_H, '->', OUT, fs.statSync(OUT).size, 'bytes');
