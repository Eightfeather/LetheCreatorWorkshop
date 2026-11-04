const fs = require('fs');
const s = fs.readFileSync('src/web/app.js', 'utf8');
for (const n of ['mbIsDirty','mbPendingMissing','mbMissingInfo','mbLeaveGuard','leaveToAreaTop','enterMdView','MB_UI']) {
  const defs = (s.match(new RegExp('function ' + n + '\\(', 'g')) || []).length;
  const uses = (s.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
  console.log(n.padEnd(18), 'def=' + defs, 'refs=' + uses);
}
