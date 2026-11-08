// 生成 src/web/ui-assets/skill-icons.css
// 每档 = 等级底板(底) + 七边形插画(中) + 属性框(顶)
// 额外从「属性框」PNG 量出中心空洞，写成 --sk-hw/--sk-hh（相对 .sk-icon-wrap 的百分比），
// 让插画正好塞进框内、不再溢出（用户反馈：插画上方多余部分超出边框）。
// 用法：node tools/gen-skill-icons.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const FR = process.env.LCW_FRAMES || path.join(ROOT, 'src/web/ui-assets/skill/frames3');
const ICON_DIR = path.join(ROOT, 'src/web/ui-assets/skill');
const OUT = path.join(ROOT, 'src/web/ui-assets/skill-icons.css');
// 帧层 inset 见 style.css：.sk-icon-wrap .sk-lvl,.sk-icon-wrap .sk-sin{inset:13.6%} → 帧盒 = 72.8% of wrap
const FRAME_OF_WRAP = 0.728;

const b64 = (p) => 'url("data:image/png;base64,' + fs.readFileSync(p).toString('base64') + '")';

// --- 最小 PNG 解码（8bit RGBA/RGBA16 之外只处理 8bit，用于量空洞） ---
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
  if (depth !== 8 || (ctype !== 6 && ctype !== 4)) return null;
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

// 中心空洞：逐行找「两侧都不透明」的透明段，取并集 bbox
function holeOf(png) {
  if (!png) return null;
  const { w, h, bpp, data } = png;
  let l = 1e9, r = -1, t = -1, b = -1;
  for (let y = 0; y < h; y++) {
    let first = -1, last = -1;
    for (let x = 0; x < w; x++) if (data[(y * w + x) * bpp + 3] > 30) { if (first < 0) first = x; last = x; }
    if (first < 0 || last - first < 8) continue;
    for (let x = first + 1; x < last; x++) {
      if (data[(y * w + x) * bpp + 3] <= 30) {
        if (x < l) l = x; if (x > r) r = x; if (t < 0) t = y; b = y;
      }
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
  '   --sk-hw / --sk-hh = 插画可用尺寸（相对 .sk-icon-wrap 百分比，按属性框中心空洞实测，留 4% 余量）',
  '   生成脚本：tools/gen-skill-icons.cjs —— 不要手改本文件。 */',
];
let measured = 0;
for (const c of combos) {
  const hole = holeOf(decodePNG(path.join(FR, c + '_sin.png')));
  const side = hole ? Math.min(hole.wPct, hole.hPct) * 0.96 * FRAME_OF_WRAP * 100 : null;
  const hw = side;
  const hh = side;
  if (hw && hh) measured++;
  const holeVars = hw && hh
    ? ';--sk-hw:' + hw.toFixed(2) + '%;--sk-hh:' + hh.toFixed(2) + '%;--sk-hx:' + (hole.cx * 100).toFixed(2) + '%;--sk-hy:' + (hole.cy * 100).toFixed(2) + '%'
    : '';
  lines.push('.sk-frame-' + c + '{--sk-lvl:' + b64(path.join(FR, c + '_level.png')) + ';--sk-sin:' + b64(path.join(FR, c + '_sin.png')) + holeVars + '}');
}
const coin = path.join(ICON_DIR, 'coin.png');
const atk = path.join(ICON_DIR, 'atk-correction.png');
if (!fs.existsSync(coin)) throw new Error('缺少 coin.png');
if (!fs.existsSync(atk)) throw new Error('缺少 atk-correction.png');
lines.push('.sk-ico-coin,.sk-coin{background-image:' + b64(coin) + '}');
lines.push('.sk-ico-atk{background-image:' + b64(atk) + '}');
fs.writeFileSync(OUT, lines.join('\n'));
console.log('frames', combos.length, 'measuredHoles', measured, '->', OUT, fs.statSync(OUT).size, 'bytes');
