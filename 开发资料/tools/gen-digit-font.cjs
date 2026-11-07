// 把 Mikodacs.woff2 内联成 @font-face，只给「基础威力 / 变动值」两个数字上字体
// 字体来自 E:\巴士解包\Font\Mikodacs.otf，转 woff2 后再内联（Chrome/WebView2 对 OTF data-URI 解析不稳）
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'src/web/ui-assets/fonts');
const FONT = path.join(DIR, 'mikodacs-digits.woff2');
const CSS = path.join(ROOT, 'src/web/style.css');
const START = '/* @digit-font:start */';
const END = '/* @digit-font:end */';
if (!fs.existsSync(FONT)) throw new Error('缺少字体文件：' + FONT);
const b64 = fs.readFileSync(FONT).toString('base64');
const block = [
  START,
  '@font-face{font-family:"LCWDigit";src:url(data:font/woff2;base64,' + b64 + ') format("woff2");font-display:block;font-weight:400}',
  '.sk-base,.sk-coinval{font-family:"LCWDigit",var(--serif)}',
  '.sk-base{letter-spacing:.5px}',
  END,
].join('\n');
let css = fs.readFileSync(CSS, 'utf8');
const i = css.indexOf(START);
if (i >= 0) {
  const j = css.indexOf(END, i);
  if (j < 0) throw new Error('style.css 里 @digit-font 起止标记不配对');
  css = css.slice(0, i) + block + css.slice(j + END.length);
} else {
  css = css.replace(/\s*$/, '') + '\n\n' + block + '\n';
}
fs.writeFileSync(CSS, css);
console.log('digit font inlined (woff2) ->', CSS, fs.statSync(CSS).size, 'bytes');
