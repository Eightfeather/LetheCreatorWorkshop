const fs = require('fs');
const P = 'src/web/app.js';
let s = fs.readFileSync(P, 'utf8');
const anchor = 'function mbMissingInfo() {';
if (!s.includes(anchor)) { console.error('anchor miss'); process.exit(1); }
const add = `/** 兼容旧名：返回 { list, ids }（缺模块状态时安全返回空） */
function mbPendingMissing() {
  try { return mbMissingInfo(); } catch (e) { return { list: [], ids: new Set() }; }
}

function mbMissingInfo() {`;
s = s.split(anchor).join(add);
fs.writeFileSync(P, s, 'utf8');
console.log('已补 mbPendingMissing');
