// 重新生成 src/web/ui-assets/coin-icons.css（从 src/web/ui-assets/skill/coins/*.png）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const dir = path.join(ROOT, 'src/web/ui-assets/skill/coins');
const keys = ['grey', 'green', 'red', 'purple'];
const rules = keys.map((k) => {
  const b64 = fs.readFileSync(path.join(dir, k + '.png')).toString('base64');
  return '.coin-ico.c-' + k.toUpperCase() + '{background-image:url(data:image/png;base64,' + b64 + ')}';
});
const css = '/* 硬币四色贴图（生成：tools/gen-coin-assets.cjs，勿手改） */\n'
  + '.coin-ico{display:inline-block;background-repeat:no-repeat;background-position:center;background-size:contain}\n'
  + rules.join('\n') + '\n';
fs.writeFileSync(path.join(ROOT, 'src/web/ui-assets/coin-icons.css'), css, 'utf8');
console.log('coin-icons.css ' + css.length + ' B');
