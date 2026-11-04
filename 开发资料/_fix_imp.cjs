const fs = require('fs');
const P = 'src/server/api.mjs';
let s = fs.readFileSync(P, 'utf8');
if (s.includes("import { join } from 'node:path';")) {
  s = s.replace("import { join } from 'node:path';", "import { dirname, join } from 'node:path';");
  fs.writeFileSync(P, s, 'utf8');
  console.log('已补 dirname 导入');
} else console.log('导入行已变化，跳过');
