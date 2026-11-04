const fs = require('fs');
const s = fs.readFileSync('src/server/api.mjs', 'utf8');
const i = s.indexOf("'/api/root'");
console.log('--- /api/root ---');
console.log(s.slice(i - 10, i + 800));
