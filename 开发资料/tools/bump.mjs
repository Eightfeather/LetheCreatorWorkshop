#!/usr/bin/env node
/**
 * 版本号同步：package.json + src/server/index.mjs(VERSION) + docs/CHANGELOG.md 一条
 * 用法：node tools/bump.mjs 0.9.4 ["本次变更的一句话说明"]
 * 选项：--no-changelog 只改版本号
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = resolve(ROOT, 'package.json');
const SRV = resolve(ROOT, 'src/server/index.mjs');
const CHG = resolve(ROOT, '..', 'docs', 'CHANGELOG.md');

const args = process.argv.slice(2);
const ver = args.find((a) => /^\d+\.\d+\.\d+$/.test(a));
const note = args.filter((a) => a !== ver && !a.startsWith('--')).join(' ') || '';
if (!ver) {
  console.error('用法：node tools/bump.mjs <x.y.z> ["说明"] [--no-changelog]');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
const old = pkg.version;
pkg.version = ver;
writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let srv = readFileSync(SRV, 'utf8');
if (!/const VERSION = '[^']+';/.test(srv)) {
  console.error('src/server/index.mjs 里找不到 VERSION 常量，已中止（package.json 已改，请手动核对）');
  process.exit(1);
}
srv = srv.replace(/const VERSION = '[^']+';/, `const VERSION = '${ver}';`);
writeFileSync(SRV, srv, 'utf8');

// 校验两处一致
const check = readFileSync(SRV, 'utf8').match(/const VERSION = '([^']+)';/)[1];
const pkg2 = JSON.parse(readFileSync(PKG, 'utf8')).version;
if (check !== ver || pkg2 !== ver) {
  console.error(`版本号不一致：package.json=${pkg2} server=${check}`);
  process.exit(1);
}

if (!args.includes('--no-changelog')) {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const head = existsSync(CHG)
    ? readFileSync(CHG, 'utf8')
    : '# 变更日志\n\n> 由 `tools/bump.mjs` 维护；每条对应一个 git 提交与一次构建。\n';
  const lines = head.split('\n');
  // 在首个二级标题前插入新条目
  let at = lines.findIndex((l) => l.startsWith('## '));
  if (at < 0) at = lines.length;
  lines.splice(at, 0, `## v${ver} · ${day}`, `- ${note || '（未填写说明）'}`, '');
  writeFileSync(CHG, lines.join('\n'), 'utf8');
}

console.log(`版本号：${old} → ${ver}（package.json / server VERSION 已同步${args.includes('--no-changelog') ? '' : '，CHANGELOG 已追加'}）`);
