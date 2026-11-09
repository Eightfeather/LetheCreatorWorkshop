// 把 Node 后端打成单文件 exe（Node SEA）：bundle → sea blob → 注入 node.exe
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// 构建依赖目录：优先用本目录的 node_modules（npm install / npm ci 即可复现），
// 其次向上找历史遗留的「数据缓存\sea-build」，避免项目被挪动后失效。
function findCache(start) {
  if (existsSync(join(start, 'node_modules', 'esbuild'))) return start;
  let dir = start;
  for (let i = 0; i < 4; i += 1) {
    const p = resolve(dir, '数据缓存', 'sea-build');
    if (existsSync(join(p, 'node_modules', 'esbuild'))) return p;
    dir = resolve(dir, '..');
  }
  return resolve(start, '..', '数据缓存', 'sea-build');
}
const CACHE = process.env.LETHE_WB_CACHE || findCache(ROOT);
const BUILD = join(ROOT, 'build');
const DIST = join(ROOT, 'dist', 'server');
const NODE_EXE = process.env.LETHE_WB_NODE || process.execPath;
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

if (!existsSync(join(CACHE, 'node_modules', 'esbuild'))) {
  throw new Error(
    '缺少构建依赖 esbuild/postject。\n' +
    '请在 开发资料 目录执行：npm install（或 npm ci 还原 package-lock.json）\n' +
    '当前查找位置：' + CACHE
  );
}

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) out.push(...walk(abs, base));
    else out.push({ abs, rel: relative(base, abs).split('\\').join('/') });
  }
  return out;
}

const loadDep = createRequire(join(CACHE, 'package.json'));

function buildAssets() {
  const TEXT_EXT = /\.(html|js|mjs|css|json|svg|txt|md)$/i;
  const BIN_EXT = /\.(ttf|otf|woff2?)$/i;
  const web = walk(join(ROOT, 'src', 'web')).filter((f) => TEXT_EXT.test(f.rel) || BIN_EXT.test(f.rel));
  const entries = web.map((f) => ['web/' + f.rel, BIN_EXT.test(f.rel) ? 'base64:' + readFileSync(f.abs).toString('base64') : readFileSync(f.abs, 'utf8')]);
  const src = `// 自动生成：web 资源内联进 exe\nexport const ASSETS = ${JSON.stringify(Object.fromEntries(entries), null, 0)};\n`;
  writeFileSync(join(BUILD, 'assets.gen.mjs'), src, 'utf8');
  return entries.length;
}

function buildEntry() {
  const src = [
    "import { ASSETS } from './assets.gen.mjs';",
    "import { setAssets } from '../src/assets.mjs';",
    "import { main } from '../src/main.mjs';",
    'setAssets(ASSETS);',
    'main().catch((err) => { console.error(err?.stack || err); process.exitCode = 1; });',
    '',
  ].join('\n');
  writeFileSync(join(BUILD, 'sea-entry.mjs'), src, 'utf8');
}

async function bundle() {
  const esbuild = loadDep(join(CACHE, 'node_modules', 'esbuild'));
  await esbuild.build({
    entryPoints: [join(BUILD, 'sea-entry.mjs')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    outfile: join(BUILD, 'bundle.cjs'),
    legalComments: 'none',
    logLevel: 'warning',
  });
}

function sea() {
  writeFileSync(join(BUILD, 'sea-config.json'), JSON.stringify({
    main: 'bundle.cjs',
    output: 'sea-prep.blob',
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
  }, null, 2), 'utf8');
  execFileSync(process.execPath, ['--experimental-sea-config', join(BUILD, 'sea-config.json')], { cwd: BUILD, stdio: 'inherit' });
}

function inject() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  const exe = join(DIST, 'LetheWorkbenchServer.exe');
  copyFileSync(NODE_EXE, exe);
  const postject = join(CACHE, 'node_modules', 'postject', 'dist', 'cli.js');
  const blob = join(BUILD, 'sea-prep.blob');
  execFileSync(process.execPath, [postject, exe, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', FUSE], { stdio: 'inherit' });
  return exe;
}

mkdirSync(BUILD, { recursive: true });
console.log(`[build-server] 内联 web 资源 ${buildAssets()} 个`);
buildEntry();
console.log('[build-server] esbuild 打包…');
await bundle();
console.log('[build-server] 生成 SEA blob…');
sea();
console.log('[build-server] 注入 node.exe…');
const exe = inject();
console.log(`[build-server] 完成：${exe} (${statSync(exe).size} B)`);