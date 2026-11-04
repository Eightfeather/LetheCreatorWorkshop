const fs = require('fs');
const P = 'src/web/app.js';
const dead = ['fieldRow','pSinSelect','openSourceModal','renderModuleForm','mbSlotType','mbSetLoop','mbMissingRequired','mbRowByName','mbInsideLoop','openSlotPicker','mbSaveProps','schedulePDesc'];
let lines = fs.readFileSync(P, 'utf8').split('\n');
const removed = [];
for (const name of dead) {
  const start = lines.findIndex((l) => l.startsWith(`function ${name}(`) || l.startsWith(`async function ${name}(`));
  if (start < 0) { removed.push([name, 'NOT FOUND']); continue; }
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) { if (lines[i] === '}') { end = i; break; } }
  if (end < 0) { removed.push([name, 'NO END']); continue; }
  const count = lines.length - end + start;
  // 删掉函数体 + 紧跟的一个空行
  let cutEnd = end;
  if (lines[end + 1] === '') cutEnd = end + 1;
  lines = [...lines.slice(0, start), ...lines.slice(cutEnd + 1)];
  removed.push([name, `删除 ${cutEnd - start + 1} 行`]);
}
fs.writeFileSync(P, lines.join('\n'), 'utf8');
for (const [n, r] of removed) console.log(n.padEnd(22), r);
console.log('剩余行数', lines.length);
