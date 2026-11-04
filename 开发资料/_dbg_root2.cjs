const fs = require('fs');
const s = fs.readFileSync('src/server/api.mjs', 'utf8');
let idx = -1;
const hits = [];
while ((idx = s.indexOf('/api/root', idx + 1)) >= 0) hits.push(idx);
console.log('命中', hits.length);
for (const i of hits.slice(0, 2)) console.log('---\n' + s.slice(Math.max(0, i - 120), i + 700));
