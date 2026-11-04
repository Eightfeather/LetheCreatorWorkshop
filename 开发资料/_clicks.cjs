const fs = require('fs');
const L = fs.readFileSync('src/web/app.js', 'utf8').split('\n');
L.forEach((l, i) => { if (l.includes("addEventListener('click'")) console.log((i + 1) + ': ' + l.trim().slice(0, 120)); });
