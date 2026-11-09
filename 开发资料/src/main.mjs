import { spawn } from 'node:child_process';
import { APP_ROOT, IS_SEA, USER_DATA_DIR } from './paths.mjs';
import { loadConfig, rememberRoot } from './config.mjs';
import { locate } from './locate.mjs';
import { listMods } from './lethe/mods.mjs';
import { listDlls } from './lethe/dlls.mjs';
import { listPersonalities } from './lethe/personality.mjs';
import { startServer, VERSION } from './server/index.mjs';

function arg(name, dflt = '') {
  const argv = process.argv.slice(2);
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return dflt;
  const hit = argv[i];
  if (hit.includes('=')) return hit.slice(hit.indexOf('=') + 1);
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : dflt;
}
const has = (name) => process.argv.includes(`--${name}`);
const json = has('json');

function out(data) { process.stdout.write(`${JSON.stringify(data, null, 2)}\n`); }

async function main() {
  const cmd = (process.argv[2] || 'serve').toLowerCase();
  const config = loadConfig();

  if (cmd === 'version' || cmd === '--version') {
    const info = { name: 'the-lethe-workbench', version: VERSION, appRoot: APP_ROOT, userDataDir: USER_DATA_DIR, configPath: config.configPath, node: process.version, standalone: IS_SEA };
    json ? out(info) : console.log(JSON.stringify(info, null, 2));
    return info;
  }

  if (cmd === 'locate') {
    const found = locate({ explicit: arg('root'), config, quick: has('quick'), budgetMs: Number(arg('budget', '8000')) });
    const result = { ok: Boolean(found.best), best: found.best, candidates: found.candidates.map((c) => ({ root: c.letheRoot, score: c.score, from: c.from, mods: c.modCount })), tried: found.tried };
    if (found.best) rememberRoot(found.best.gameRoot || found.best.letheRoot);
    json ? out(result) : console.log(JSON.stringify(result, null, 2));
    return result;
  }

  if (cmd === 'mods' || cmd === 'list') {
    const found = locate({ explicit: arg('root'), config, quick: true });
    if (!found.best) throw new Error('未定位到私服，请用 --root=<Lethe 根> 指定');
    const result = listMods(found.best.letheRoot).map((m) => ({ name: m.name, enabled: m.enabled, personalities: m.personalityCount, files: m.files, bytes: m.bytes }));
    json ? out({ ok: true, letheRoot: found.best.letheRoot, mods: result }) : console.log(JSON.stringify(result, null, 2));
    return result;
  }

  if (cmd === 'dlls') {
    const found = locate({ explicit: arg('root'), config, quick: true });
    if (!found.best) throw new Error('未定位到私服');
    const result = listDlls(found.best.gameRoot);
    json ? out({ ok: true, dlls: result }) : console.log(JSON.stringify(result, null, 2));
    return result;
  }

  if (cmd === 'personalities') {
    const found = locate({ explicit: arg('root'), config, quick: true });
    if (!found.best) throw new Error('未定位到私服');
    const result = listPersonalities(found.best.letheRoot, arg('mod'));
    json ? out({ ok: true, personalities: result }) : console.log(JSON.stringify(result, null, 2));
    return result;
  }

  if (cmd === 'serve' || cmd === 'app') {
    const started = await startServer({
      port: Number(arg('port', '3081')),
      explicit: arg('root'),
      log: (m) => console.log(`[wb] ${m}`),
    });
    if (!has('no-open')) openBrowser(started.url);
    return started;
  }

  console.error(`未知命令：${cmd}`);
  process.exitCode = 2;
  return null;
}

function openBrowser(url) {
  try {
    const p = spawn('cmd.exe', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' });
    p.unref();
  } catch { /* ignore */ }
}

export { main };
