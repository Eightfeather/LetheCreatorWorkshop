#!/usr/bin/env node
/**
 * 本地产物版本库：保存/列出/切换历史构建（不需要重新编译即可回退）
 *   node tools/switch-build.mjs list
 *   node tools/switch-build.mjs save [版本]      # 从 dist/app 归档（默认用 package.json 版本）
 *   node tools/switch-build.mjs use  <版本>      # 把该版本 exe 复制到项目根
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(DEV, '..');            // 编辑器正式稿
const REL = join(ROOT, 'releases');
const APP = join(DEV, 'dist', 'app', 'TheLetheWorkbench.exe');
const SRV = join(DEV, 'dist', 'server', 'LetheWorkbenchServer.exe');
const ROOT_EXE = join(ROOT, 'TheLetheWorkbench.exe');

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
const ver = () => JSON.parse(readFileSync(join(DEV, 'package.json'), 'utf8')).version;
const die = (m) => { console.error(m); process.exit(1); };

const cmd = process.argv[2] || 'list';
const arg = process.argv[3];

if (cmd === 'save') {
  if (!existsSync(APP)) die(`没有找到构建产物：${APP}\n请先运行 node tools/build-app.mjs`);
  const v = arg || ver();
  const dir = join(REL, v);
  mkdirSync(dir, { recursive: true });
  cpSync(APP, join(dir, 'TheLetheWorkbench.exe'));
  if (existsSync(SRV)) cpSync(SRV, join(dir, 'LetheWorkbenchServer.exe'));
  const meta = {
    version: v,
    savedAt: new Date().toISOString(),
    app: { file: 'TheLetheWorkbench.exe', bytes: statSync(APP).size, sha256_16: sha(APP) },
    server: existsSync(SRV) ? { file: 'LetheWorkbenchServer.exe', bytes: statSync(SRV).size, sha256_16: sha(SRV) } : null,
  };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`已归档 v${v} → ${dir}（app ${mb(meta.app.bytes)}，sha ${meta.app.sha256_16}）`);
} else if (cmd === 'use') {
  if (!arg) die('用法：node tools/switch-build.mjs use <版本>');
  const src = join(REL, arg, 'TheLetheWorkbench.exe');
  if (!existsSync(src)) die(`没有归档版本：${arg}\n${(existsSync(REL) ? readdirSync(REL) : []).join('  ') || '（releases/ 为空）'}`);
  // 先把当前根 exe 归档，避免切走后丢失
  if (existsSync(ROOT_EXE)) {
    const cur = ver();
    const curDir = join(REL, cur + '-root-backup');
    if (!existsSync(curDir)) {
      mkdirSync(curDir, { recursive: true });
      cpSync(ROOT_EXE, join(curDir, 'TheLetheWorkbench.exe'));
    }
  }
  cpSync(src, ROOT_EXE);
  console.log(`已切换根目录 exe → v${arg}（新 sha ${sha(ROOT_EXE)}）；请重启编辑器生效`);
} else {
  if (!existsSync(REL)) die('还没有归档（先 build-app.mjs 再 switch-build.mjs save）');
  const rows = readdirSync(REL).filter((n) => existsSync(join(REL, n, 'meta.json'))).map((n) => {
    const m = JSON.parse(readFileSync(join(REL, n, 'meta.json'), 'utf8'));
    return `${n.padEnd(14)} ${mb(m.app.bytes).padStart(9)}  ${m.savedAt.slice(0, 19).replace('T', ' ')}  sha ${m.app.sha256_16}`;
  });
  console.log('本地产物库 ' + REL);
  console.log(rows.length ? rows.join('\n') : '（空）');
  if (existsSync(ROOT_EXE)) console.log(`\n当前根目录 exe：${mb(statSync(ROOT_EXE).size)}  sha ${sha(ROOT_EXE)}`);
}
