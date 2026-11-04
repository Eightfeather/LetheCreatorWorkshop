#!/usr/bin/env node
/**
 * 冒烟回归：启动真机（TheLetheWorkbench.exe + 内置后端），用 CDP 跑 18 条断言。
 * 前置：沙箱私服 E:\辅助文件\Mod编辑器\数据缓存\e2e-root\BepInEx\plugins\Lethe
 * 用法：node test/smoke.mjs [--keep]   （--keep 保留进程，便于人工看现场）
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(DEV, '..');
const EXE = join(ROOT, 'TheLetheWorkbench.exe');
const SANDBOX = 'E:\\辅助文件\\Mod编辑器\\数据缓存\\e2e-root\\BepInEx\\plugins\\Lethe';
const CFG_DIR = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'LetheWorkbench');
const CFG = join(CFG_DIR, 'config.json');
const PORT = 9333;
const KEEP = process.argv.includes('--keep');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 160) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? '  ← ' + detail : ''}`);
}

async function cdpTargets() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* not up yet */ }
    await wait(300);
  }
  throw new Error('CDP 未就绪（9333）');
}

function makeClient(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  });
  const open = new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', (e) => rej(new Error('ws error: ' + (e.message || 'unknown'))));
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };
  return { open, send, evalJs, events, close: () => ws.close() };
}

const exists = (p) => existsSync(p);

async function main() {
  if (!exists(EXE)) throw new Error('缺少 ' + EXE);
  if (!exists(SANDBOX)) throw new Error('缺少沙箱私服 ' + SANDBOX);
  const cfgBackup = exists(CFG) ? readFileSync(CFG, 'utf8') : null;

  const child = spawn(EXE, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: 'ignore',
  });

  let client;
  try {
    const target = await cdpTargets();
    client = makeClient(target.webSocketDebuggerUrl);
    await client.open;
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    const consoleErrors = [];
    client.events.push = (...a) => { for (const e of a) if (e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')) consoleErrors.push(JSON.stringify(e.params).slice(0, 200)); return Array.prototype.push.apply(client.events, a); };

    // 等前端就绪
    let ready = false;
    for (let i = 0; i < 60; i++) {
      ready = await client.evalJs('Boolean(window.__WBS && window.__WBS.status && window.__WBS.status.letheRoot)');
      if (ready) break;
      await wait(400);
    }
    check('01 应用启动且前端就绪', ready);

    const version = await client.evalJs('(async()=>{const r=await fetch("/api/health");return (await r.json()).version;})()');
    const pkg = JSON.parse(readFileSync(join(DEV, 'package.json'), 'utf8')).version;
    check('02 后端版本与 package.json 一致', version === pkg, `${version} vs ${pkg}`);

    const switched = await client.evalJs('(async()=>{const r=await fetch("/api/root",{method:"POST",headers:{"content-type":"application/json","x-wb-token":window.__WB_TOKEN__},body:JSON.stringify({path:' + JSON.stringify(SANDBOX) + '})});const st=await (await fetch("/api/status",{headers:{"x-wb-token":window.__WB_TOKEN__}})).json();return {ok:r.ok,root:st.letheRoot,game:st.gameRoot};})()');
    check('03 已切到沙箱私服', switched.ok && String(switched.root).includes('e2e-root'), JSON.stringify(switched));
    await client.evalJs('window.__WBS.status.letheRoot=' + JSON.stringify(SANDBOX) + '; window.__WBS.mods=[]; document.querySelector(\'.dock-item[data-view="mods"]\').click(); true');
    await wait(1200);
    check('04 底栏 5 项', (await client.evalJs('document.querySelectorAll(".dock-item").length')) === 5);

    // 镜牢编辑
    await client.evalJs('document.querySelector(\'.dock-item[data-view="md"]\').click(); true');
    await wait(600);
    check('05 镜牢页 6 张表卡', (await client.evalJs('document.querySelectorAll(".wiz[data-act=\'md-kind\']").length')) === 6);
    await client.evalJs('document.querySelector(".wiz[data-act=\'md-kind\']").click(); true');
    await wait(700);
    const mdState = await client.evalJs('({mdKind: window.__WBS.mdKind, editKind: window.__WBS.editKind})');
    check('06 选表后只写 mdKind（D1）', mdState.mdKind === 'cardpack' && mdState.editKind === null, JSON.stringify(mdState));

    // 关键回归：镜牢 → 编辑页不能空白
    await client.evalJs('document.querySelector(\'.dock-item[data-view="edit"]\').click(); true');
    await wait(700);
    const editBlank = await client.evalJs('({wiz: document.querySelectorAll(".wiz").length, grid: Boolean(document.querySelector(".wiz-grid")), mdKind: window.__WBS.mdKind})');
    check('07 镜牢→编辑不空白（D1 回归）', editBlank.wiz === 5 && editBlank.grid, JSON.stringify(editBlank));

    // 各编辑器：以 S.editKind + 容器为准（人格先说罪人页，不要求已选人格）
    const openKind = async (kind, sel) => {
      // 先回向导首页（人格/技能等编辑器进入后，向导卡不在 DOM 里）
      await client.evalJs('document.querySelector(\'.dock-item[data-view="edit"]\').click(); true');
      await wait(450);
      await client.evalJs(`(document.querySelector('.wiz[data-kind="${kind}"]') || {click(){}}).click(); true`);
      await wait(900);
      return client.evalJs(`({ek: window.__WBS.editKind, has: Boolean(document.querySelector('${sel}')), n: document.querySelectorAll('${sel}').length})`);
    };
    const p = await openKind('personality', '[data-act="pick-sinner"]');
    check('08 人格编辑器打开', p.ek === 'personality' && p.n > 0, JSON.stringify(p));
    const sk = await openKind('skill', '.skill-wrap');
    check('09 技能编辑器打开', sk.ek === 'skill' && sk.has, JSON.stringify(sk));
    const pa = await openKind('passive', '.skill-wrap');
    check('10 被动编辑器打开', pa.ek === 'passive' && pa.has, JSON.stringify(pa));
    const bf = await openKind('buff', '.skill-wrap');
    check('11 Buff 编辑器打开', bf.ek === 'buff' && bf.has, JSON.stringify(bf));
    const md = await openKind('module', '[data-act="open-module"], .module-form, .mb-canvas');
    check('12 模块编辑器打开', md.ek === 'module' && md.n > 0, JSON.stringify(md));

    // 底栏同项点击 = 回区域顶层
    await client.evalJs('document.querySelector(\'.dock-item[data-view="edit"]\').click(); true');
    await wait(600);
    check('13 底栏同项点击回向导首页', await client.evalJs('Boolean(document.querySelector(".wiz-grid")) && window.__WBS.editKind === null'));

    // 镜牢列表刷新链（D3）
    await client.evalJs('document.querySelector(\'.dock-item[data-view="md"]\').click(); true');
    await wait(500);
    await client.evalJs('document.querySelector(".wiz[data-act=\'md-kind\']").click(); true');
    await wait(500);
    const before = await client.evalJs('window.__WBS.mdList ? window.__WBS.mdList.length : -1');
    await client.evalJs('(async()=>{ const items=[...document.querySelectorAll(\'[data-act="select-mod"]\')]; if(items.length>1) items[1].click(); })(); true');
    await wait(900);
    const after = await client.evalJs('({len: window.__WBS.mdList ? window.__WBS.mdList.length : -1, mdKind: window.__WBS.mdKind})');
    check('14 切 Mod 后镜牢列表重载（D3）', after.mdKind === 'cardpack' && after.len >= 0, `before=${before} after=${JSON.stringify(after)}`);

    // reveal 插件目录（D4）
    const revealPath = await client.evalJs('window.__WBS.status.letheRoot.replace(/[\\\\/][^\\\\/]+$/, "")');
    const reveal = await client.evalJs('(async()=>{const r=await fetch("/api/reveal",{method:"POST",headers:{"content-type":"application/json","x-wb-token":window.__WB_TOKEN__},body:JSON.stringify({path:' + JSON.stringify(revealPath) + '})});return r.status;})()');
    check('15 reveal 放行插件目录（D4）', reveal === 200 || reveal === 0, `status=${reveal}`);

    // 状态不变量：人为塞非法 editKind，render 后应被重置
    const guard = await client.evalJs('(async()=>{ const S=window.__WBS; S.editKind="cardpack"; S.view="edit"; if(window.__wbRender) window.__wbRender(); document.querySelector(\'.dock-item[data-view="edit"]\').click(); await new Promise(r=>setTimeout(r,300)); return S.editKind; })()');
    check('16 非法 editKind 被重置（L2）', guard === null || guard === undefined, `editKind=${guard}`);

    check('17 无控制台异常', consoleErrors.length === 0, consoleErrors.join(' | '));
    check('18 主页可回', await client.evalJs('(document.querySelector(\'.dock-item[data-view="home"]\').click(), true)'));
  } finally {
    try { if (client) await client.evalJs('fetch("/api/root",{method:"POST",headers:{"content-type":"application/json","x-wb-token":window.__WB_TOKEN__},body:JSON.stringify({path:"D:\\\\私服"})})'); } catch { /* ignore */ }
    try { client && client.close(); } catch { /* ignore */ }
    if (!KEEP) { try { child.kill(); } catch { /* ignore */ } }
    if (cfgBackup !== null) writeFileSync(CFG, cfgBackup, 'utf8');
  }

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 通过`);
  if (bad.length) { console.log('失败项：\n' + bad.map((b) => '- ' + b.name + ' ' + b.detail).join('\n')); process.exit(1); }
}

main().catch((e) => { console.error('SMOKE ERROR:', e.message); process.exit(1); });