const fs = require('fs');
const s = fs.readFileSync('src/server/api.mjs', 'utf8');
const i = s.indexOf("'/api/reveal'");
console.log(s.slice(i, i + 900));
