const fs = require('fs');
let a = fs.readFileSync('src/web/app.js', 'utf8');
const before = a;
a = a.split("  'md-back': () => {\n    S.editKind = null;").join("  'md-back': () => {\n    S.mdKind = null;");
fs.writeFileSync('src/web/app.js', a, 'utf8');
console.log('md-back 修正:', before.length, '→', a.length);
