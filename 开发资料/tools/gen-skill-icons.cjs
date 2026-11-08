// 生成 src/web/ui-assets/skill-icons.css：22 档技能框（等级层 + 属性层）+ 两枚小图标（硬币、攻击修正值）
// 用法：node tools/gen-skill-icons.cjs
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FR = process.env.LCW_FRAMES || path.join(ROOT, 'src/web/ui-assets/skill/frames3');
const ICON_DIR = path.join(ROOT, 'src/web/ui-assets/skill');
const OUT = path.join(ROOT, 'src/web/ui-assets/skill-icons.css');

const b64 = (p) => 'url("data:image/png;base64,' + fs.readFileSync(p).toString('base64') + '")';
const files = fs.readdirSync(FR).filter((f) => f.endsWith('.png'));
const sins = new Set(), lvls = new Set();
for (const f of files) { const k = f.replace(/\.png$/, ''); if (k.endsWith('_sin')) sins.add(k.slice(0, -4)); if (k.endsWith('_level')) lvls.add(k.slice(0, -6)); }
const combos = [...lvls].filter((k) => sins.has(k)).sort();

const lines = [
  '/* 技能图标框：每档 = 等级底板(底) + 七边形图标(中) + 属性框(顶)；来源 limbuscompany.huijiwiki「技能图标DIY」',
  '   另含技能预览用的小图标（硬币 / 攻击修正值）。生成脚本：tools/gen-skill-icons.cjs —— 不要手改本文件。 */',
];
for (const c of combos) {
  lines.push('.sk-frame-' + c + '{--sk-lvl:' + b64(path.join(FR, c + '_level.png')) + ';--sk-sin:' + b64(path.join(FR, c + '_sin.png')) + '}');
}
const coin = path.join(ICON_DIR, 'coin.png');
const atk = path.join(ICON_DIR, 'atk-correction.png');
if (!fs.existsSync(coin)) throw new Error('缺少 coin.png');
if (!fs.existsSync(atk)) throw new Error('缺少 atk-correction.png');
lines.push('.sk-ico-coin,.sk-coin{background-image:' + b64(coin) + '}');
lines.push('.sk-ico-atk{background-image:' + b64(atk) + '}');
fs.writeFileSync(OUT, lines.join('\n'));
console.log('frames', combos.length, '->', OUT, fs.statSync(OUT).size, 'bytes');
