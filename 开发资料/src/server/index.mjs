import * as http from 'node:http';
import { warmupCaches } from '../lethe/warmup.mjs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { cleanName, resolveInside, safeRel } from '../safety.mjs';
import { APP_ROOT, SRC_DIR } from '../paths.mjs';
import { loadConfig } from '../config.mjs';
import { locate } from '../locate.mjs';
import { buildApi } from './api.mjs';
import { checkHost, checkToken, readBody, sendError, sendJson, serveStatic } from './http.mjs';
import { EditSession } from '../lethe/session.mjs';
import { AutoSaver } from '../lethe/autosave.mjs';
import { markCleanExit, markRunning } from '../lethe/state.mjs';
import { migrateToLcw } from '../lethe/lcw.mjs';

export const VERSION = '0.9.10';
const WEB_ROOT = join(SRC_DIR, 'web');

export function createServer({ token, state, log, session, autosave } = {}) {
  const ctx = { version: VERSION, state, log, session, autosave };
  const dispatch = buildApi(ctx);

  return http.createServer(async (req, res) => {
    try {
      if (!checkHost(req)) { sendJson(res, 403, { ok: false, error: 'host/origin 不被允许' }); return; }
      const url = new URL(req.url, 'http://127.0.0.1');
      const pathname = url.pathname;

      if (pathname === '/api/health') { sendJson(res, 200, { ok: true, app: 'The Lethe Workbench', version: VERSION }); return; }

      if (pathname === '/api/sprite') {
        if (!checkToken(req, token)) { sendJson(res, 401, { ok: false, error: '令牌无效' }); return; }
        const mod = String(url.searchParams.get('mod') || '');
        const file = String(url.searchParams.get('file') || '');
        const ext = (file.split('.').pop() || '').toLowerCase();
        if (!/^(png|webp|jpg|jpeg|gif)$/.test(ext)) { sendJson(res, 400, { ok: false, error: '不支持的图片类型' }); return; }
        if (!state.letheRoot) { sendJson(res, 428, { ok: false, error: '还没有定位到私服' }); return; }
        let abs;
        try {
          abs = resolveInside(join(state.letheRoot, 'mods'), join(cleanName(mod, 'Mod 名'), 'custom_sprites', safeRel(file)));
        } catch (e) { sendJson(res, 400, { ok: false, error: e.message }); return; }
        if (!existsSync(abs)) { sendJson(res, 404, { ok: false, error: 'not found' }); return; }
        const buf = readFileSync(abs);
        res.writeHead(200, { 'content-type': ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg', 'content-length': buf.length, 'cache-control': 'private, max-age=86400' });
        res.end(buf);
        return;
      }

      if (pathname.startsWith('/api/')) {
        if (!checkToken(req, token)) { sendJson(res, 401, { ok: false, error: '令牌无效' }); return; }
        if (req.method !== 'GET' && req.headers['content-type']?.includes('application/json') === false) {
          sendJson(res, 415, { ok: false, error: '需要 application/json' }); return;
        }
        const body = req.method === 'GET' ? {} : await readBody(req);
        const result = await dispatch(req.method, pathname, url.searchParams, body);
        if (result && result.__miss) { sendJson(res, 404, { ok: false, error: `没有这个接口：${req.method} ${pathname}` }); return; }
        sendJson(res, 200, result);
        return;
      }

      if (serveStatic(req, res, WEB_ROOT, pathname, { token })) return;
      sendJson(res, 404, { ok: false, error: 'not found' });
    } catch (err) {
      log?.(`${req.method} ${req.url} -> ${err.message}`);
      sendError(res, err);
    }
  });
}

export function startServer({ port = 3081, host = '127.0.0.1', explicit, locateNow = true, log, token: givenToken } = {}) {
  const config = loadConfig();
  const state = {
    config,
    letheRoot: config.letheRoot || '',
    gameRoot: config.gameRoot || '',
    locatedAt: config.letheRoot ? 'config' : '',
    source: config.letheRoot ? 'config' : '',
  };
  if (explicit || locateNow) {
    const found = locate({ explicit, config, quick: !explicit, budgetMs: 6000 });
    if (found.best) {
      state.letheRoot = found.best.letheRoot;
      state.gameRoot = found.best.gameRoot;
      state.locatedAt = new Date().toISOString();
      state.source = found.best.from;
    }
  }

  const session = new EditSession(() => state.letheRoot);
  const autosave = new AutoSaver({ session, getLetheRoot: () => state.letheRoot, log });

  // 存储迁移：旧位置（.lethe-workbench、C 盘 projects）→ <Lethe>/LCW
  if (state.letheRoot) { try { migrateToLcw(state.letheRoot, log); } catch { /* 迁移失败不阻塞 */ } }

  // 启动预热：把词表/外观扫描提前做掉，后续页面不再出现「正在加载」
  if (state.letheRoot) warmupCaches(state.letheRoot, log).catch(() => {});

  // 运行标记：下次启动可检测“未被正常关闭”
  if (state.letheRoot) markRunning(state.letheRoot);
  const finish = () => { try { if (state.letheRoot) markCleanExit(state.letheRoot); } catch { /* ignore */ } };
  process.once('SIGINT', () => { finish(); process.exit(0); });
  process.once('SIGTERM', () => { finish(); process.exit(0); });
  process.once('exit', finish);

  const token = givenToken || randomBytes(18).toString('hex');
  const server = createServer({ token, state, log, session, autosave });

  return new Promise((resolve, reject) => {
    let attempt = 0;
    const tryListen = () => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempt < 20) { attempt += 1; setTimeout(() => tryListen(), 40); return; }
        reject(err);
      });
      server.listen(port, host, () => {
        const actual = server.address().port;
        log?.(`服务已启动：http://${host}:${actual}  Lethe=${state.letheRoot || '(未定位)'}`);
        if (process.env.LETHE_WB_HANDSHAKE === '1') {
          process.stdout.write(`WB-READY ${JSON.stringify({ port: actual, token, letheRoot: state.letheRoot, version: VERSION })}\n`);
        }
        resolve({ server, port: actual, url: `http://${host}:${actual}/`, token, state, session, autosave });
      });
    };    tryListen();
  });
}

export { APP_ROOT };