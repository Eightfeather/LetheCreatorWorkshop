/* The Lethe Workbench · 前端主程序 v0.2 */
const TOKEN = window.__WB_TOKEN__ || '';

const S = {
  pAppOpen: false,
  pAppCatalog: [],
  pAppQ: '',
  loading: true,
  locating: false,
  autoLocated: false,
  status: null,
  home: null,
  mods: [],
  dlls: [],
  view: 'home',
  selected: null,          // 当前选中的 Mod（管理页 / 编辑页同步）
  modDetail: null,
  detailTab: 'current',    // 'current' | 备份 label
  backupView: null,
  selectedDll: null,
  dllDetail: null,
  dllTab: 'current',
  editKind: null,
  mdKind: null,
  mdSchemas: null,
  mdList: [],
  md: null,
  mdId: null,
  mdDirty: false,
  mdSearch: '',
  pick: { kind: '', cb: null, q: '', items: [], total: 0 },
  pkTimer: 0,
  sinner: null,
  personalityId: null,
  personality: null,
  vanilla: null,
  showVanilla: false,
  session: null,
  sessionKey: '',
  autoAt: '',
  dirty: false,
  // ---- v0.3 技能编辑 ----
  skills: [],
  modules: [],
  skillDefaults: null,
  skill: null,
  skillId: null,
  skillTab: 'code',
  skillSearch: '',
  moduleSearch: '',
  keywords: null,
  dragging: null,
  descCheck: null,
  imp: null,
  // ---- v0.5 界面 ----
  sinnerPicked: false,     // 人格编辑：false = 12 罪人立绘卡；true = 该罪人的人格卡列表
  listCollapsed: false,    // 编辑页左侧 Mod 列表收起；持久化在 config.json 的 ui.listCollapsed（端口每次随机，不能用 localStorage）
};
window.__WBS = S; // 调试用：CDP 里可直接检查前端状态

const $ = (sel, root = document) => root.querySelector(sel);const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtBytes = (n) => {
  const v = Number(n) || 0;
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2)} GB`;
  if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)} MB`;
  if (v >= 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${v} B`;
};
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/* ---------------------------------- 基础 ---------------------------------- */

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'x-wb-token': TOKEN,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { data = { ok: false, error: '服务器返回的不是 JSON' }; }
  if (!res.ok) {
    const err = new Error(data.error || `请求失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  // 业务上 ok:false 但没有 error（例如“没找到私服”）交给调用方判断，不算异常
  if (data.ok === false && data.error) {
    const err = new Error(data.error);
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(message, kind = 'info', ms = 4200) {
  const root = $('#toasts');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('gone'); setTimeout(() => el.remove(), 300); }, ms);
}

function wip() { toast('该功能正在维修', 'warn'); }

let MODAL = null;
function modal({ title, body, footer, wide = false }) {
  closeModal();
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-back';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><strong>${esc(title)}</strong><button class="modal-x" data-act="close-modal">×</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  root.appendChild(wrap);
  MODAL = wrap;
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeModal(); });
  return wrap;
}
function closeModal() {
  if (MODAL) { MODAL.remove(); MODAL = null; }
}

/* -------------------------------- 数据加载 -------------------------------- */

async function loadStatus() {
  S.status = await api('/api/status');
  S.listCollapsed = Boolean(S.status.ui?.listCollapsed);
  $('#st-version').textContent = `v${S.status.version}`;
}

async function loadHome() {
  S.home = await api('/api/home');
}

async function loadMods() {
  const res = await api('/api/mods');
  S.mods = res.mods || [];
  if (S.selected && !S.mods.some((m) => m.name === S.selected)) S.selected = null;
  if (!S.selected && S.mods.length) S.selected = S.mods[0].name;
}

async function loadDlls() {
  const res = await api('/api/dlls');
  S.dlls = res.dlls || [];
}

async function loadModDetail(name = S.selected) {
  if (!name) { S.modDetail = null; return; }
  S.modDetail = await api(`/api/mod?name=${encodeURIComponent(name)}`);
}

async function loadPersonalities(name = S.selected) {
  const res = await api(`/api/personalities?name=${encodeURIComponent(name || '')}`);
  S.vanilla = res;
  return res;
}

async function loadVanilla(characterId) {
  const res = await api(`/api/vanilla${characterId ? `?characterId=${characterId}` : ''}`);
  // 没有原版数据时接口会回空罪人表，别让它盖掉已有的 12 罪人兜底
  const keepChars = !(res.characters && res.characters.length) && S.vanilla?.characters?.length;
  S.vanilla = { ...(S.vanilla || {}), ...res, ...(keepChars ? { characters: S.vanilla.characters } : {}) };
  return res;
}

async function loadPersonality(name, id) {
  const res = await api(`/api/personality?name=${encodeURIComponent(name)}&id=${encodeURIComponent(id)}`);
  S.personality = res.personality;
  S.pReadonly = Boolean(S.pForceReadonly);
  S.pForceReadonly = false;
  S.personalityId = id;
  S.sessionKey = `personality:${id}`;
  S.pSearch = {};
  S.pSkillQ = '';
  S.pDefQ = '';
  S.pBuffQ = '';
  await refreshSession(name);
  await loadPersonalityExtra();
  return S.personality;
}

async function refreshSession(name = S.selected) {
  if (!name) { S.session = null; return; }
  try {
    const q = `name=${encodeURIComponent(name)}${S.sessionKey ? `&key=${encodeURIComponent(S.sessionKey)}` : ''}`;
    const res = await api(`/api/session?${q}`);
    S.session = res.session;
    S.autoAt = res.autoSave?.at || S.autoAt;
  } catch { /* 未定位时不报错 */ }
}

/* --------------------------------- 渲染骨架 -------------------------------- */

function scrollSelector(el) {
  if (!el || el.id === 'view') return '#view';
  const parts = [];
  let cur = el;
  while (cur && cur !== document.body) {
    if (cur.id === 'view') { parts.unshift('#view'); break; }
    const parent = cur.parentElement;
    if (!parent) return null;
    const idx = [...parent.children].indexOf(cur) + 1;
    parts.unshift(cur.tagName.toLowerCase() + ':nth-child(' + idx + ')');
    cur = parent;
  }
  return parts.join(' > ');
}

// 记录 #view 内可滚动容器的 scrollTop（带 CSS 路径），重绘后按路径还原；详情面板不还原，切换对象时应回到顶部
function captureScrollMap() {
  const map = [];
  for (const el of document.querySelectorAll('#view, #view *')) {
    if (el.classList.contains('detail-body')) continue;
    if (!el.scrollTop) continue;
    if (el.scrollHeight - el.clientHeight <= 2) continue;
    const oy = getComputedStyle(el).overflowY;
    if (oy !== 'auto' && oy !== 'scroll') continue;
    const sel = scrollSelector(el);
    if (sel) map.push({ sel, top: el.scrollTop });
  }
  return map;
}

function restoreScrollMap(map) {
  if (!map || !map.length) return;
  for (const it of map) {
    try { const el = document.querySelector(it.sel); if (el) el.scrollTop = it.top; } catch (e) { /* 结构变化则忽略 */ }
  }
}

function assertState() {
  // 不变量：视图状态只允许落在各自的枚举里（0.9.0 的“镜牢→编辑空白”就是因为 editKind 被复用）
  const wizKinds = WIZARDS.map((w) => w.kind);
  if (S.editKind && !wizKinds.includes(S.editKind)) {
    console.warn('[state] editKind 非法，已重置为向导首页：', S.editKind);
    S.editKind = null; S.personalityId = null; S.personality = null;
    S.moduleEditing = null; S.mb = null; S.mbDoc = null;
  }
  if (S.mdKind && !MD_UI.includes(S.mdKind)) {
    console.warn('[state] mdKind 非法，已重置为镜牢表列表：', S.mdKind);
    S.mdKind = null; S.md = null; S.mdId = null;
  }
  return true;
}

function render() {
  assertState();
  const view = $('#view');
  if (!view) return;
  if (!S.status) {
    view.innerHTML = `<div class="boot-screen"><div class="boot-mark">L</div><p>正在载入工作台…</p></div>`;
    updateDock();
    return;
  }
  if (!S.status.letheRoot && (S.locating || !S.autoLocated)) {
    view.innerHTML = renderSearching();
    updateDock();
    return;
  }
  if (!S.status.letheRoot) {
    view.innerHTML = renderSetup();
    updateDock();
    return;
  }
  // 状态已是新页面：先算出切换类型，并在重绘前把旧画面拓一份“残影”，用来播放退场
  const snap = navSnapshot();
  const tr = transitionFor(S._navSnap, snap);
  const ghost = captureGhost(tr);
  const scrollMap = S._lastView === S.view ? captureScrollMap() : null;
  S._lastView = S.view;
  if (S.view === 'home') view.innerHTML = renderHome();
  else if (S.view === 'mods') view.innerHTML = renderMods();
  else if (S.view === 'edit') view.innerHTML = renderEdit();
  else if (S.view === 'md') view.innerHTML = renderMdView();
  else view.innerHTML = renderImport();
  updateDock();
  restoreScrollMap(scrollMap);
  S._navSnap = snap;
  if (tr) playEnter(tr, ghost);
  /* restore-scroll */
  if (S.pRestoreScroll) { const t = S.pRestoreScroll; S.pRestoreScroll = 0; const el = document.querySelector('.p-main'); if (el && t) el.scrollTop = t; }
}

/* ------------------------------ 界面切换动画 ------------------------------ */
// 只给“新进来的内容”播入场动画；方向表示去向：底栏/页签按顺序左右滑，进入下一层从下方升起，返回上一层从上方落下

const VIEW_ORDER = ['home', 'mods', 'edit', 'import', 'md'];

function navDepth() {
  if (S.view !== 'edit' || !S.editKind) return 0;
  if (S.editKind === 'personality') return S.personality ? 3 : (S.sinnerPicked ? 2 : 1);
  // 模块：列表 1 → 积木画布 2 → 输出代码页 3（画布内拖拽、改参数不改变深度，不会触发切页动画）
  if (S.editKind === 'module') return S.moduleEditing ? (S.mb && S.mb.codePage ? 3 : 2) : 1;
  return 1;
}

function navSnapshot() {
  return {
    view: S.view,
    kind: S.view === 'edit' ? S.editKind : null,
    depth: navDepth(),
    detail: S.view === 'mods' ? `${S.selectedDll || S.selected || ''}|${S.selectedDll ? S.dllTab : S.detailTab}` : null,
  };
}

function transitionFor(prev, next) {
  if (!prev) return null;
  if (prev.view !== next.view) {
    return { scope: 'view', dir: VIEW_ORDER.indexOf(next.view) > VIEW_ORDER.indexOf(prev.view) ? 'right' : 'left' };
  }
  if (next.view === 'mods' && prev.detail !== next.detail) return { scope: 'detail', dir: 'fade' };
  if (next.view !== 'edit') return null;
  if (prev.kind !== next.kind) {
    if (!prev.kind) return { scope: 'pane', dir: 'deeper' };
    if (!next.kind) return { scope: 'pane', dir: 'back' };
    const a = WIZARDS.findIndex((w) => w.kind === prev.kind);
    const b = WIZARDS.findIndex((w) => w.kind === next.kind);
    return { scope: 'pane', dir: b > a ? 'right' : 'left' };
  }
  if (prev.depth !== next.depth) return { scope: 'pane', dir: next.depth > prev.depth ? 'deeper' : 'back' };
  return null;
}

/*
 * 仿原版切页三段式（录屏实测约 0.45s）：
 *   1) 旧画面被“抽走”：残影上收、略缩、压暗（≈130ms）
 *   2) 短暂暗场：新内容延迟 ~120ms 才出现，底栏始终不动
 *   3) 新画面“砸下”：主面板从略大偏上落到略小再回弹；两侧配件分别从左右滑入；卡片逐张错开弹出
 * 小切换（Mod 管理里换选中项）只做轻淡入，避免频繁黑场。
 */
const reducedMotion = () => Boolean(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const ENTER_DELAY = 120;

function captureGhost(tr) {
  if (!tr || tr.scope === 'detail' || reducedMotion()) return null;
  const src = tr.scope === 'view' ? $('#view') : $('#view .edit-pane');
  if (!src) return null;
  const r = src.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const clone = src.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.add('view');
  clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  // 旧画面里还没播完的入场动画不能带进残影，否则残影会重播一遍
  clone.querySelectorAll('.anim-in').forEach((n) => { n.className = n.className.replace(/\banim-in\b|\bfrom-[\w-]+/g, ''); n.style.animationDelay = ''; });
  if (tr.scope === 'pane') clone.querySelector('.kind-tabs')?.style.setProperty('visibility', 'hidden');
  Object.assign(clone.style, { width: '100%', height: '100%', margin: '0', overflow: 'hidden' });
  const ghost = document.createElement('div');
  ghost.className = 'wb-ghost';
  Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  ghost.appendChild(clone);
  ghost._scroll = src.scrollTop;
  return ghost;
}

/** 给元素挂一段入场动画，结束后清理（最小化时 animationend 可能不触发，用定时兜底） */
function animateIn(el, kind, delay = 0) {
  if (!el) return;
  const cls = ['anim-in', 'from-' + kind];
  el.style.animationDelay = delay + 'ms';
  el.classList.add(...cls);
  const done = () => { el.classList.remove(...cls); el.style.animationDelay = ''; };
  el.addEventListener('animationend', done, { once: true });
  setTimeout(done, delay + 700);
}

/** 卡片 / 向导格逐张错开弹出 */
function staggerIn(list, base, step = 30, max = 14) {
  list.forEach((el, i) => animateIn(el, 'pop', base + Math.min(i, max) * step));
}

/** 三栏布局：左栏从左、中间砸下、右栏从右 */
function enterColumns(cols, base) {
  if (!cols.length) return;
  if (cols.length === 1) { animateIn(cols[0], 'slam', base); return; }
  animateIn(cols[0], 'side-left', base + 50);
  cols.slice(1, -1).forEach((c) => animateIn(c, 'slam', base));
  animateIn(cols[cols.length - 1], cols.length === 2 ? 'slam' : 'side-right', base + (cols.length === 2 ? 0 : 60));
}

function enterPaneContent(base, dir) {
  // 只在 #view 里找：残影里也有一份同名结构
  const parts = $$('#view .edit-pane > :not(.kind-tabs):not(#session-hint):not(.dock-mini)');
  for (const el of parts) {
    if (el.classList.contains('skill-wrap') || el.classList.contains('module-wrap')) enterColumns([...el.children], base);
    else if (el.classList.contains('sinner-split')) {
      animateIn(el.querySelector('.sinner-rail'), 'side-left', base + 40);
      staggerIn($$('.p-grid > .p-card', el), base + 60);
    } else if (el.classList.contains('sinner-board')) staggerIn([...el.children], base, 28);
    else if (el.classList.contains('wiz-grid')) staggerIn([...el.children], base, 30);
    else animateIn(el, dir === 'back' ? 'slam-up' : 'slam', base);
  }
}

function playEnter({ scope, dir }, ghost) {
  if (reducedMotion()) return;
  if (scope === 'detail') {
    $$('#view .detail-pane > .detail-body, #view .detail-pane .detail-head .meta-row').forEach((el) => animateIn(el, 'fade'));
    return;
  }
  if (ghost) {
    document.body.appendChild(ghost);
    ghost.firstElementChild.scrollTop = ghost._scroll || 0;
    ghost.classList.add(dir === 'back' ? 'out-down' : 'out-up');
    setTimeout(() => ghost.remove(), 220);
  }
  const base = ghost ? ENTER_DELAY : 0;
  if (scope === 'pane') { enterPaneContent(base, dir); return; }
  const root = $('#view')?.firstElementChild;
  if (!root) return;
  if (root.classList.contains('layout') && root.classList.contains('edit')) {
    animateIn(root.querySelector('.list-panel'), 'side-left', base + 50);
    const pane = root.querySelector('.edit-pane');
    animateIn(pane, 'slam', base);
    return;
  }
  if (root.classList.contains('layout')) { enterColumns([...root.children], base); return; }
  if (root.classList.contains('home')) {
    animateIn(root.querySelector('.home-cover'), 'slam', base);
    animateIn(root.querySelector('.home-side'), 'side-right', base + 60);
    return;
  }
  animateIn(root, 'slam', base);
}

function syncDockHeight() {
  const dock = $('.dock');
  if (!dock) return;
  const h = Math.ceil(dock.getBoundingClientRect().height);
  if (h > 0) document.documentElement.style.setProperty('--dock-h', `${h + 12}px`);
}

function updateDock() {
  $$('.dock-item').forEach((el) => el.classList.toggle('active', el.dataset.view === S.view));
  const root = S.status?.letheRoot || '';
  $('#root-dot')?.classList.toggle('ok', Boolean(root));
  $('#st-root').textContent = root ? `Lethe · ${root}` : '尚未定位私服';
  $('#st-root').title = root || '';
  $('#st-mod').textContent = S.selected || '—';
  const dirty = Boolean(S.session?.dirty);
  const d = $('#st-dirty');
  d.textContent = dirty ? `有未保存改动（撤销 ${S.session?.undo || 0} 步）` : '已保存';
  d.className = dirty ? 'dirty' : 'calm';
  const auto = $('#st-auto');
  if (auto) {
    auto.textContent = S.autoAt ? `自动快照 ${new Date(S.autoAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '自动快照 —';
  }
  // 名片（底栏主行，5 格 / 10×3 网格）
  const st = S.home?.stats || {};
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('#nc-name', S.home?.editorName || st.editorName || '但丁');
  set('#nc-mod', st.modCount ?? '—');
  set('#nc-dll', st.dllCount ?? '—');
  set('#nc-editor', String(st.editorTitle || '边狱工作台').split(' ')[0]); // 徽章框只放中文名，英文名是固定副标题
  set('#nc-size', fmtBytes(st.bytes));
  syncDockHeight();
}

/* ---------------------------------- 主页 ---------------------------------- */

function renderSearching() {
  return `<section class="home searching">
    <div class="scan-box">
      <div class="scan-ring"></div>
      <h2>正在寻找私服</h2>
      <p>自动扫描常见位置与磁盘目录，查找 <code>BepInEx\\plugins\\Lethe</code></p>
      <p class="muted">如果找不到，可以在“设置”里手动指定目录。</p>
    </div>
  </section>`;
}

function renderSetup() {
  return `<section class="home searching">
    <div class="scan-box">
      <h2>还没有指定私服</h2>
      <p>请选择游戏的安装目录（含 <code>LimbusCompany.exe</code>）或 Lethe 目录（含 <code>mods</code> / <code>dumpedData</code>）。</p>
      <div class="row gap center">
        <button class="btn primary" data-act="open-settings">打开设置</button>
        <button class="btn ghost" data-act="locate-deep">深度扫描磁盘</button>
      </div>
    </div>
  </section>`;
}

function renderHome() {
  return `<section class="home">
    <div class="home-cover">
      <div class="cover-inner">
        <div class="cover-kicker">LIMBUS COMPANY · MOD WORKBENCH</div>
        <h1>THE LETHE<br>WORKBENCH</h1>
        <div class="cover-line"></div>
        <p>边狱公司 · 更简单的模组工作台</p>
        <div class="cover-placeholder">封面占位 · 后续接入原画</div>
      </div>
    </div>

    <div class="home-side">
      <div class="round-actions">
        <button class="round-btn" data-act="open-settings" title="设置"><span>⚙</span><small>设置</small></button>
        <button class="round-btn" data-act="wip-guide" title="指南"><span>?</span><small>指南</small></button>
        <button class="round-btn" data-act="wip-cover" title="封面"><span>▣</span><small>封面</small></button>
        <button class="round-btn" data-act="wip-thanks" title="鸣谢"><span>♥</span><small>鸣谢</small></button>
      </div>
      <div class="panel notice">
        <div class="panel-head">公告栏 <span class="tag">NOTICE</span></div>
        <div class="panel-body"><div class="placeholder">公告占位 · 后续接入更新说明</div></div>
      </div>
    </div>
  </section>`;
}

/* -------------------------------- Mod 管理 -------------------------------- */

const modRow = (m) => `<button class="item ${S.selected === m.name ? 'active' : ''} ${m.enabled ? '' : 'disabled'}" data-act="select-mod" data-name="${esc(m.name)}">
  <span class="state-dot ${m.enabled ? 'on' : 'off'}"></span>
  <span class="item-main"><strong>${esc(m.name)}</strong><small>${m.personalityCount ?? 0} 人格 · ${m.files ?? 0} 文件 · ${fmtBytes(m.bytes)}</small></span>
  ${m.enabled ? '' : '<span class="x-badge">✕</span>'}
</button>`;

const dllRow = (d) => `<button class="item ${S.selectedDll === d.file ? 'active' : ''} ${d.enabled ? '' : 'disabled'}" data-act="select-dll" data-file="${esc(d.file)}">
  <span class="state-dot ${d.enabled ? 'on' : 'off'}"></span>
  <span class="item-main"><strong>${esc(d.base)}</strong><small>${fmtBytes(d.size)} · ${d.backups?.length || 0} 个备份</small></span>
  ${d.enabled ? '' : '<span class="x-badge">✕</span>'}
</button>`;

function renderMods() {
  const enabled = S.mods.filter((m) => m.enabled).length;
  const dllOn = S.dlls.filter((d) => d.enabled).length;
  return `<div class="layout mods">
    <section class="panel">
      <div class="panel-head">已加载 MOD <span class="count">${enabled} / ${S.mods.length}</span></div>
      <div class="panel-body list">${S.mods.map(modRow).join('') || '<div class="list-empty">mods 目录是空的</div>'}</div>
      <div class="panel-foot"><button class="btn ghost block" data-act="create-mod">＋ 创建 Mod</button></div>
    </section>
    <section class="panel detail-pane">${renderModDetail()}</section>
    <section class="panel">
      <div class="panel-head">已加载 DLL <span class="count">${dllOn} / ${S.dlls.length}</span></div>
      <div class="panel-body list">${S.dlls.map(dllRow).join('') || '<div class="list-empty">plugins 目录里没有 DLL</div>'}</div>
      <div class="panel-foot"><button class="btn ghost block" data-act="reveal-plugins">打开插件目录</button></div>
    </section>
  </div>`;
}

function versionBar(items, active, act) {
  return `<div class="version-bar">${items.map((it) => `<button class="vtab ${it.value === active ? 'active' : ''}" data-act="${act}" data-label="${esc(it.value)}">${esc(it.label)}</button>`).join('')}</div>`;
}

function renderModDetail() {
  if (S.selectedDll && S.dllDetail) return renderDllDetail();
  const d = S.modDetail;
  if (!d) return `<div class="empty-state"><div class="empty-mark">◆</div><p>从左侧选择一个 Mod 查看详情</p><small class="muted">禁用的 Mod 也能编辑，改动仍会写入磁盘</small></div>`;

  const tabs = [{ label: '当前版本', value: 'current' }, ...(d.backups || []).map((b) => ({ label: b.label, value: b.label }))];
  const active = S.detailTab === 'current' ? 'current' : S.detailTab;
  const isBackup = active !== 'current';
  return `<div class="detail-head">
    <div class="detail-title">${esc(d.name)} <span class="badge ${d.enabled ? 'ok' : 'off'}">${d.enabled ? '已启用' : '已禁用'}</span></div>
    <div class="detail-sub">${esc(d.dir)}</div>
    <div class="meta-row">
      <span>人格 ${(d.personalities || []).length}</span>
      <span>贴图 ${(d.sprites || []).length}</span>
      <span>数据类目 ${(d.dataCategories || []).length}</span>
      <span>备份 ${(d.backups || []).length}</span>
      ${d.autoSave ? `<span>自动快照 ${new Date(d.autoSave.at).toLocaleString('zh-CN', { hour12: false })}</span>` : '<span class="muted">暂无自动快照</span>'}
    </div>
    ${versionBar(tabs, active, 'pick-mod-version')}
  </div>
  <div class="detail-body">${isBackup ? renderBackupView() : renderCurrentMod(d)}</div>
  <div class="detail-actions">
    <button class="btn ok" data-act="enable-mod" ${d.enabled ? 'disabled' : ''}>启用</button>
    <button class="btn warn" data-act="backup-mod">备份</button>
    ${d.enabled
      ? '<button class="btn danger" data-act="disable-mod">禁用</button>'
      : '<button class="btn danger ghosted" data-act="arm-delete" title="已禁用 · 连续点 3 次可永久删除这个 Mod">禁用 · 连点 3 次删除</button>'}
  </div>`;
}

function renderCurrentMod(d) {
  const cats = (d.dataCategories || []).map((c) => `<span class="chip">${esc(c)}</span>`).join('');
  const persons = (d.personalities || []).slice(0, 12).map((p) => `<div class="mini-person"><strong>${esc(p.name || p.id)}</strong><small>${esc(p.title || '')}</small><span class="muted">${esc(p.id)}</span></div>`).join('');
  return `<div class="detail-section">
    <h4>数据类目</h4>
    <div class="chips">${cats || '<span class="muted">这个 Mod 还没有数据文件</span>'}</div>
  </div>
  <div class="detail-section">
    <h4>人格预览</h4>
    <div class="mini-grid">${persons || '<span class="muted">还没有人格</span>'}</div>
  </div>
  ${d.enabled ? '' : `<div class="banner red">该 Mod 正在被禁用的状态 · 修改仍会保存到磁盘，但不会在游戏中生效</div>`}`;
}

function renderBackupView() {
  const b = S.backupView;
  if (!b) return `<div class="empty-state"><p>正在读取备份…</p></div>`;
  const persons = (b.personalities || []).map((p) => `<div class="mini-person"><strong>${esc(p.name || p.id)}</strong><small>${esc(p.title || '')}</small><span class="muted">${esc(p.id)}</span></div>`).join('');
  return `<div class="readonly-note">备份为只读。若要回到这个版本，使用下方「替换当前版本」——两者会互换，操作无法撤销。</div>
  <div class="detail-section"><h4>人格</h4><div class="mini-grid">${persons || '<span class="muted">这个备份里没有人格</span>'}</div></div>
  <div class="detail-actions inner">
    <button class="btn danger" data-act="swap-version" data-label="${esc(b.label)}">替换当前版本</button>
  </div>`;
}

function renderDllDetail() {
  const d = S.dllDetail;
  if (!d) return `<div class="empty-state"><div class="empty-mark">◆</div><p>从右侧选择一个 DLL 查看详情</p></div>`;
  const tabs = [{ label: '当前版本', value: 'current' }, ...(d.backups || []).map((b) => ({ label: b.label, value: b.label }))];
  return `<div class="detail-head">
    <div class="detail-title">${esc(d.base)} <span class="badge ${d.enabled ? 'ok' : 'off'}">${d.enabled ? '已启用' : '已禁用'}</span></div>
    <div class="detail-sub">${esc(d.file)}</div>
    ${versionBar(tabs, S.dllTab, 'pick-dll-version')}
  </div>
  <div class="detail-body">
    <div class="detail-section"><h4>文件</h4>
      <div class="meta-row"><span>${fmtBytes(d.size)}</span><span class="muted">${esc(d.dir || '')}</span></div>
    </div>
    <div class="detail-section"><h4>备份</h4>
      <div class="chips">${(d.backups || []).map((b) => `<span class="chip">${esc(b.label)}</span>`).join('') || '<span class="muted">还没有备份</span>'}</div>
    </div>
    ${S.dllTab !== 'current' ? '<div class="readonly-note">DLL 备份为只读文件，恢复请在文件管理器中手动替换。</div>' : ''}
  </div>
  <div class="detail-actions">
    <button class="btn ok" data-act="enable-dll" ${d.enabled ? 'disabled' : ''}>启用</button>
    <button class="btn warn" data-act="backup-dll">备份</button>
    <button class="btn danger" data-act="disable-dll" ${d.enabled ? '' : 'disabled'}>禁用</button>
  </div>`;
}

/* -------------------------------- Mod 编辑 -------------------------------- */

const WIZARDS = [
  { kind: 'module', name: '模块编辑', sub: 'MODULE', ico: '▤' },
  { kind: 'personality', name: '人格编辑', sub: 'IDENTITY', ico: '◈' },
  { kind: 'passive', name: '被动编辑', sub: 'PASSIVE', ico: '◇' },
  { kind: 'skill', name: '技能编辑', sub: 'SKILL', ico: '✦' },
  { kind: 'buff', name: 'Buff 编辑', sub: 'BUFF', ico: '❖' },
];

/* ---- 镜牢编辑（移植自清欣版；本块 UI 依赖下面的 md 辅助函数） ---- */
const MD_UI = ['cardpack', 'egogift', 'battle', 'enemy', 'mob', 'part'];
// 这些表支持「载入现有」：从游戏原版 / 已加载 Mod 的记录克隆一条成新草稿
const CLONE_FROM = { enemy: 'unit', mob: 'unit', part: 'part', egogift: 'gift', cardpack: 'pack', battle: 'battle' };
const PICK_ZH = { skill: '技能', unit: '敌人', part: '敌人部位', gift: '饰品', pack: '卡包', battle: '战斗' };


// 收起态的 Mod 列表：只留首字 + 启停点，悬停显示全名
const modRowMini = (m) => `<button class="item mini ${S.selected === m.name ? 'active' : ''} ${m.enabled ? '' : 'disabled'}" data-act="select-mod" data-name="${esc(m.name)}" title="${esc(m.name)}${m.enabled ? '' : '（已禁用）'}">
  <span class="mini-glyph">${esc(Array.from(m.name)[0] || '?')}</span>
  <span class="state-dot ${m.enabled ? 'on' : 'off'}"></span>
</button>`;

function renderEdit() {
  // v0.9.8：模块是全局资源，进「模块编辑」时不需要左侧 Mod 列表
  if (S.editKind === 'module') {
    return `<div class="layout edit module-only">
      <section class="panel edit-pane">
        ${renderKindTabs() + renderKindArea()}
      </section>
    </div>`;
  }
  // 完整列表与收起窄条两层常驻，切换时只换类名：完整层向左滑出、窄条随后滑入（见 style.css v0.5「滑入滑出」）
  return `<div class="layout edit ${S.listCollapsed ? 'list-collapsed' : ''}">
    <section class="panel list-panel">
      <div class="lp-full">
        <div class="panel-head">MOD 列表 <span class="count">${S.mods.length}</span><button class="fold-btn" data-act="toggle-modlist" title="收起 Mod 列表">«</button></div>
        <div class="panel-body list">${S.mods.map(modRow).join('') || '<div class="list-empty">mods 目录是空的</div>'}</div>
      </div>
      <div class="lp-mini">
        <div class="panel-head"><button class="fold-btn" data-act="toggle-modlist" title="展开 Mod 列表">»</button></div>
        <div class="panel-body list">${S.mods.map(modRowMini).join('')}</div>
      </div>
    </section>
    <section class="panel edit-pane">
      ${S.editKind ? renderKindTabs() + renderKindArea() : renderWizardHome()}
      <div class="dock-mini" id="session-hint"></div>
    </section>
  </div>`;
}

/** 编辑区顶部的子页签：进入任意编辑器后常驻，可直接跳到其他编辑器，不必逐层返回 */
function renderKindTabs() {
  return `<nav class="kind-tabs">${WIZARDS.map((w) => `<button class="kind-tab ${w.kind === S.editKind ? 'active' : ''} ${w.wip ? 'wip' : ''}" data-act="open-kind" data-kind="${w.kind}" title="${w.wip ? w.name + '（维修中）' : '切换到' + w.name}">
      <span class="kt-ico">${w.ico}</span><span>${w.name.replace('编辑', '')}</span>
    </button>`).join('')}</nav>`;
}

function renderWizardHome() {
  const cards = WIZARDS.map((w) => `<button class="wiz ${w.wip ? 'wip' : ''}" data-act="open-kind" data-kind="${w.kind}">
    <span class="wiz-ico">${w.ico}</span>
    <strong>${w.name}</strong>
    <small>${w.sub}${w.wip ? ' · 维修中' : ''}</small>
  </button>`).join('');
  return `<div class="pane-head">
    <div><h2>Mod 编辑</h2><p class="muted">${S.selected ? esc(S.selected) : '先从左侧选一个 Mod'}</p></div>
  </div>
  <div class="wiz-grid">${cards}</div>`;
}

function renderKindArea() {
  const back = `<button class="btn ghost sm" data-act="back-wizard">← 返回</button>`;
  if (S.editKind === 'skill') return renderSkillArea(back);
  if (S.editKind === 'module') return renderModuleArea(back);
  if (S.editKind === 'passive') return renderPassiveArea(back);
  if (S.editKind === 'buff') return renderBuffArea(back);
  if (S.editKind !== 'personality') {
    return `<div class="pane-head">${back}<h2>维修中</h2></div><div class="empty-state"><p>该功能正在维修</p></div>`;
  }
  if (S.personality) return renderPersonalityDetail();
  if (S.pLoading) {
    return '<div class="pane-head"><h2>载入人格…</h2></div>'
      + '<div class="panel" style="margin:12px"><div class="panel-body">'
      + '<div class="hint muted">正在读取人格数据、脚本与本地化，请稍等…</div>'
      + '<div class="p-loadbar"><i></i></div></div></div>';
  }
  return `${renderSinnerArea()}`;
}

function sinnerCharacters() {
  // 只保留 12 罪人（1–12）；角色表里可能混入 NPC（如 400005 贾惜春），不进人格编辑
  return (S.vanilla?.characters || []).filter((c) => Number(c.id) >= 1 && Number(c.id) <= 12);
}

// 罪人编号 1–12 → 原版切图（定义在 ui-assets.css 的 CSS 变量里：立绘卡、徽记）
const sinnerNo = (id) => String(Math.max(1, Math.min(12, Number(id) || 1))).padStart(2, '0');
const sinnerCard = (id) => `var(--ui-sinner-card-${sinnerNo(id)})`;
const sinnerEmblem = (id) => `var(--ui-sinner-emblem-${sinnerNo(id)})`;

function renderSinnerArea() {
  const list = S.mods.find((m) => m.name === S.selected);
  const banner = list && !list.enabled ? '<div class="banner red">该 Mod 正在被禁用的状态 · 修改仍会保存到磁盘，但不会在游戏中生效</div>' : '';
  return S.sinnerPicked ? renderSinnerPersonalities(banner) : renderSinnerPicker(banner);
}

/** 第一步：12 罪人立绘卡（6×2，仿原版编队） */
function renderSinnerPicker(banner) {
  const cards = sinnerCharacters().map((c) => `<button class="sinner-card ${Number(S.sinner) === Number(c.id) ? 'active' : ''}" data-act="pick-sinner" data-id="${c.id}" title="${esc(c.name)}">
      <span class="sc-art" style="background-image:${sinnerCard(c.id)}"></span>
      <span class="sc-emblem" style="background-image:${sinnerEmblem(c.id)}"></span>
      <span class="sc-name">${esc(c.name)}</span>
    </button>`).join('');
  return `<div class="pane-head">
    <button class="btn ghost sm" data-act="back-wizard">← 返回</button>
    <div><h2>人格编辑</h2><p class="muted">${esc(S.selected || '')} · 选择要编辑的罪人</p></div>
  </div>
  ${banner}
  <div class="sinner-board">${cards}</div>`;
}

/** 第二步：左侧罪人小头像 + 人格卡列表（原版折叠卡 → 自定义 → ＋新建） */
function renderSinnerPersonalities(banner) {
  const chars = sinnerCharacters();
  const cur = chars.find((c) => Number(c.id) === Number(S.sinner));
  const all = S.vanilla?.custom || [];
  // 仿原版编队左栏：方形头像，左上角 = 本 Mod 该罪人的自定义人格数（原版此处是同步等级），右下角 = 罪人名（原版是 Lv）
  const rail = chars.map((c) => {
    const n = all.filter((p) => Number(p.characterId) === Number(c.id)).length;
    return `<button class="sinner-face ${Number(S.sinner) === Number(c.id) ? 'active' : ''}" data-act="pick-sinner" data-id="${c.id}" title="${esc(c.name)} · 自定义人格 ${n} 个">
      <span class="sf-art" style="background-image:${sinnerCard(c.id)}"></span>
      ${n ? `<span class="sf-count">${n}</span>` : ''}
      <span class="sf-name">${esc(c.name)}</span>
    </button>`;
  }).join('');
  const custom = all.filter((p) => Number(p.characterId) === Number(S.sinner));
  const vanilla = S.vanillaList || [];
  const card = (p, { kind, act }) => {
    const on = String(p.id) === String(S.personalityId || '');
    const r = Math.max(1, Math.min(3, Number(p.rank) || 1));
    return `<${act ? 'button' : 'div'} class="p-card ${kind}${on ? ' active' : ''}" ${act ? `data-act="${act}" data-id="${esc(p.id)}"` : ''} title="${esc((p.name || p.id) + (p.title ? ' · ' + p.title : '') + ' · 稀有度 ' + pRankLabel(p.rank))}">
      <span class="pc-art" style="background-image:${sinnerCard(S.sinner)}"></span>
      <span class="pc-slot"><span class="pc-rank rank-${r}" title="稀有度 ${esc(pRankLabel(p.rank))}"></span></span>
      <span class="pc-plate"><strong>${esc(p.name || p.id)}</strong><small>${esc(p.title || '')}</small><em>${esc(p.id)}</em></span>
      ${kind === 'vanilla' ? '<span class="pc-tag">原版</span>' : ''}
    </${act ? 'button' : 'div'}>`;
  };
  const toggle = `<button class="p-card toggle ${S.showVanilla ? 'open' : ''}" data-act="toggle-vanilla">
      <span class="pc-art" style="background-image:${sinnerCard(S.sinner)}"></span>
      <span class="pc-toggle"><strong>原版人格列表</strong><small>${vanilla.length} 个 · 点击${S.showVanilla ? '收起' : '展开'}</small><span class="pc-arrow">${S.showVanilla ? '◂' : '▸'}</span></span>
    </button>`;
  const vanillaCards = S.showVanilla ? vanilla.map((p) => card(p, { kind: 'vanilla', act: 'open-vanilla-personality' })).join('') : '';
  const customCards = custom.map((p) => card(p, { kind: 'custom', act: 'open-personality' })).join('');
  const create = `<button class="p-card create" data-act="create-personality" title="新建人格"><span class="pc-plus"></span><span class="pc-create-label">新建人格</span></button>`;
  return `<div class="pane-head">
    <button class="btn ghost sm" data-act="sinner-home">← 罪人</button>
    <span class="pane-emblem" style="background-image:${sinnerEmblem(S.sinner)}"></span>
    <div><h2>${esc(cur?.name || '人格编辑')}</h2><p class="muted">${esc(S.selected || '')} · 本 Mod 自定义 ${custom.length} 个</p></div>
  </div>
  ${banner}
  <div class="sinner-split">
    <nav class="sinner-rail">
      <button class="rail-all" data-act="sinner-home" title="回到 12 罪人总览">ALL</button>
      <div class="rail-grid">${rail}</div>
    </nav>
    <div class="p-grid">${toggle}${vanillaCards}${customCards}${create}</div>
  </div>`;
}

/* ============================ 人格编辑（v0.8.0） ============================ */

const ATK_LIST = ['SLASH', 'PENETRATE', 'HIT'];
const ATK_ZH = { SLASH: '斩击', PENETRATE: '突刺', HIT: '打击' };

async function loadPersonalityExtra() {
  await loadAppCatalog((S.personality && S.personality.entity) || null);
  await loadPortrait();
  if (!S.selected || !S.personalityId) return;
  try {
    if (!S.pI18n) { const r = await api('/api/personality/i18n'); S.pI18n = r.tables; }
  } catch { /* 未定位时忽略 */ }
  try {
    const r = await api(`/api/personality/stats?name=${encodeURIComponent(S.selected)}&id=${encodeURIComponent(S.personalityId)}`);
    S.pStats = r.stats;
  } catch { /* 忽略 */ }
}

function pTables() {
  return S.pI18n || { sins: [], skillKeywords: [], rankLabel: { 1: '0', 2: '00', 3: '000' }, unitKeyword: {}, association: {} };
}

function pRankLabel(rank) {
  const t = pTables();
  return (t.rankLabel && t.rankLabel[String(rank)]) || String(rank ?? '');
}

function pRankBadge(rank) {
  const r = Math.max(1, Math.min(3, Number(rank) || 1));
  return `<span class="p-rank-img rank-${r}" title="稀有度 ${esc(pRankLabel(rank))}"></span>`;
}

function pSinnerLogo(characterId) {
  const found = ((S.vanilla && S.vanilla.characters) || []).find((c) => Number(c.id) === Number(characterId));
  const zh = found ? found.name : '';
  const letter = zh ? zh.slice(0, 1) : String(characterId ?? '?');
  return `<span class="ph-logo" title="罪人 ${esc(zh || characterId)}">${esc(letter)}</span>`;
}

/* 主属性（罪孽）：游戏罪孽表是「暴怒/色欲…」，人格主属性按属性名显示（暴怒→愤怒） */
const SIN_ATTR_NAME = { CRIMSON: '愤怒', SCARLET: '色欲', AMBER: '怠惰', SHAMROCK: '暴食', AZURE: '忧郁', INDIGO: '傲慢', VIOLET: '嫉妒', WHITE: '疯狂', BLACK: '哀叹' };
function pSinZh(id) {
  const t = pTables();
  const hit = (t.sins || []).find((s) => s.id === id);
  return SIN_ATTR_NAME[id] || (hit && hit.zh) || String(id || '');
}
function pSinChip(e) {
  const v = e && e.uniqueAttribute;
  return `<span class="p-chip p-sin" title="主属性（罪孽）：${esc(v || '未设置')}">${esc(v ? pSinZh(v) : '—')}</span>`;
}
/* 词条短标签（文档 17 第 4 条）：去掉 <color>/<s> 之类富文本，长名截断 */
function pShort(text, n = 12) {
  const s = String(text || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}
const DEF_RULE_TEXT = '修正值 >1.5 致命 · >1 脆弱 · =1 普通 · <1 耐性 · ≤0.5 抵抗';
function pHpTitle(e) {
  const d = Number(e.hp?.defaultStat ?? S.personality?.entity?.hp?.defaultStat);
  const inc = Number(e.hp?.incrementByLevel ?? S.personality?.entity?.hp?.incrementByLevel) || 0;
  if (!Number.isFinite(d)) return '先填基础血量';
  const lv = [1, 10, 20, 30, 40, 50, 65].map((n) => `Lv${n}: ${Math.round(d + inc * (n - 1))}`).join('  ');
  return '按等级换算血量（Lv1 到 Lv65）  ' + lv;
}

const P_THR_COLORS = ['#E8C15A', '#D05A4A', '#4FA3B8', '#8C6BD0', '#6BAF6B', '#C97AA6', '#B9A25C', '#7FA9D0', '#C77F4F'];

function pPortraitHtml() {
  const sp = S.pPortrait || {};
  const pick = sp.cg || sp.profile;
  if (pick && pick.dataUrl) {
    return '<div class="pp-art has-img" title="' + esc(pick.file) + '"><img class="pp-img" src="' + pick.dataUrl + '" alt="立绘"></div>';
  }
  return '<div class="pp-art pp-noimg"><span>请输入图片</span></div>';
}

async function loadPortrait() {
  S.pPortrait = null;
  if (!S.personality || !S.selected) return;
  try {
    const r = await api('/api/personality/portrait?name=' + encodeURIComponent(S.selected) + '&id=' + encodeURIComponent(S.personality.id));
    S.pPortrait = (r && r.sprites) || null;
  } catch (e) { S.pPortrait = null; }
}

function pAppPanel(e) {
  if (!S.pAppOpen) return '';
  const list = S.pAppCatalog || [];
  const q = String(S.pAppQ || '').toLowerCase();
  const rows = list.filter((x) => !q || String(x.appearance).toLowerCase().includes(q) || String(x.zh || '').toLowerCase().includes(q));
  const body = rows.length
    ? rows.map((x) => '<button class="p-app-row" data-act="p-app-pick" data-app="' + esc(x.appearance) + '"><span class="p-app-en">' + esc(x.appearance) + '</span><span class="p-app-zh">' + (x.zh ? esc(x.zh) : '<i class="muted">未登记名称</i>') + '</span></button>').join('')
    : '<div class="p-app-empty muted">没有匹配的外观</div>';
  return '<div class="p-app-panel">'
    + '<input class="p-search p-app-q" id="p-app-q" placeholder="搜索资源名 / 中文名" value="' + esc(S.pAppQ || '') + '" autocomplete="off">'
    + '<div class="p-app-list2">' + body + '</div>'
    + '<div class="p-app-note muted">共 ' + list.length + ' 条（含仅皮肤外观与 EGO 同化皮肤）；点一条即写入上面的输入框。</div>'
    + '</div>';
}

async function loadAppCatalog(e) {
  S.pAppCatalog = [];
  const cid = Number((e && e.characterId) || 0);
  if (!cid) return;
  try {
    const r = await api('/api/personality/appearance-catalog?characterId=' + cid);
    S.pAppCatalog = (r && r.items) || [];
  } catch (err) { S.pAppCatalog = []; }
}

function pHeadBar(st) {
  const hp = Number(st.hp65) || 0;
  const th = (st.thresholds || []).slice(0, 9);
  const order = th.map((x, i) => ({ pct: Number(x.pct) || 0, i })).sort((a, b) => b.pct - a.pct);
  const rankOf = (i) => order.findIndex((o) => o.i === i) + 1;
  const marks = th.map((x, i) => { const rank = rankOf(i); return `<span class="pb-mark" style="left:${Math.max(0, Math.min(100, Number(x.pct)))}%;background:${P_THR_COLORS[(rank - 1) % P_THR_COLORS.length]}" title="第 ${rank} 档：${x.pct}% 血量（${x.hp} 点）"></span>`; }).join('');
  return `<div class="p-bar-wrap">
    <div class="p-bar" title="Lv.65 血量 ${hp}"><span class="pb-fill"></span>${marks}</div>
    <span class="pb-total" title="Lv.65 血量上限">♥${hp}</span>
  </div>`;
}

function pResistChips(e) {
  const rows = (e.resistInfo && e.resistInfo.atkResistList) || [];
  return ATK_LIST.map((k) => {
    const hit = rows.find((r) => r && r.type === k);
    const v = hit ? Number(hit.value) : '';
    const cls = v === '' ? '' : v >= 2 ? 'bad' : v > 0 && v < 1 ? 'good' : '';
    return `<span class="p-res ${cls}">${ATK_ZH[k]} ${v === '' ? '—' : v}</span>`;
  }).join('');
}

function pSection(title, body, extra = '') {
  return `<section class="p-sec">
    <div class="p-sec-head"><h3>${title}</h3>${extra}</div>
    <div class="p-sec-body">${body}</div>
  </section>`;
}

function pRow(label, inner, hint = '') {
  return `<label class="p-row"><span class="p-label">${label}</span><span class="p-input">${inner}</span>${hint ? `<span class="p-hint">${hint}</span>` : ''}</label>`;
}

function pSearchBox(id, placeholder, value) {
  return `<input class="p-search" id="${id}" placeholder="${esc(placeholder)}" value="${esc(value || '')}" autocomplete="off">`;
}

function pRememberSkillName(el) {
  const id = String((el && el.dataset && el.dataset.id) || '');
  const nm = String((el && el.dataset && el.dataset.name) || '').trim();
  if (!id || !nm) return;
  S.skillNameCache = S.skillNameCache || {};
  S.skillNameCache[id] = nm;
}

function pSkillNameHtml(id) {
  const map = (S.personality && S.personality.skillNames) || {};
  const cache = S.skillNameCache || {};
  const nm = map[String(id)] || cache[String(id)];
  return nm ? '<span class="pi-name" title="' + esc(nm) + '">· ' + esc(nm) + '</span>' : '<span class="pi-name muted">· 未登记</span>';
}

function pPassiveNameHtml(id) {
  const map = (S.personality && S.personality.passiveNames) || {};
  const nm = map[String(id)];
  return nm ? '<span class="pi-name" title="' + esc(nm) + '">· ' + esc(nm) + '</span>' : '';
}

function pSkillRows(e) {
  const rows = e.attributeList || [];
  const min = Math.max(0, Number(S.pSkillSlots) || 0);
  const items = [];
  for (let i = 0; i < Math.max(min, rows.length); i += 1) {
    const r = rows[i];
    if (!r) {
      items.push(`<div class="p-item p-slot-empty"><span class="muted">空位 ${i + 1}</span><span class="p-slot-note muted">搜索技能后点结果填入</span></div>`);
      continue;
    }
    items.push(`<div class="p-item">
      <span class="pi-id">${esc(r.skillId)}</span>${pSkillNameHtml(r.skillId)}
      <label class="pi-inline">数量 <input class="pi-num" type="number" min="0" max="99" data-skill-num="${i}" value="${esc(r.number ?? 1)}"></label>
      <button class="icon-btn" data-act="p-jump-skill" data-id="${esc(r.skillId)}" title="打开技能编辑">🖊</button>
      <button class="icon-btn rm" data-act="p-skill-rm" data-idx="${i}" title="移除">✕</button>
    </div>`);
  }
  return items.join('');
}

function pDefRows(e) {
  const rows = e.defenseSkillIDList || [];
  const min = Math.max(0, Number(S.pDefSlots) || 0);
  const items = [];
  for (let i = 0; i < Math.max(min, rows.length); i += 1) {
    const id = rows[i];
    if (!id) {
      items.push(`<div class="p-item p-slot-empty"><span class="muted">空位 ${i + 1}</span><span class="p-slot-note muted">搜索守备技能后点结果填入</span></div>`);
      continue;
    }
    items.push(`<div class="p-item">
      <span class="pi-id">${esc(id)}</span>${pSkillNameHtml(id)}
      <button class="icon-btn" data-act="p-jump-skill" data-id="${esc(id)}" title="打开技能编辑">🖊</button>
      <button class="icon-btn rm" data-act="p-def-rm" data-idx="${i}" title="移除">✕</button>
    </div>`);
  }
  return items.join('');
}

function pBreakRows(e) {
  const src = (e.breakSection && e.breakSection.sectionList) || [];
  const list = src.slice().sort((a, b) => (Number(b) || 0) - (Number(a) || 0));
  const hp65 = (S.pStats && S.pStats.hp65) || 0;
  if (!list.length) return '<div class="p-empty muted">没有混乱阈值（不会被混乱）</div>';
  const order = list.map((v, i) => ({ pct: Number(v) || 0, i })).sort((a, b) => b.pct - a.pct);
  const rankOf = (i) => order.findIndex((o) => o.i === i) + 1;
  return list.map((v, i) => {
    const rank = rankOf(i);
    return `<div class="p-item">
      <span class="thr-dot" style="background:${P_THR_COLORS[(rank - 1) % P_THR_COLORS.length]}"></span>
      <span class="pi-tag">第 ${rank} 档</span>
      <input class="pi-num wide" type="number" min="0" max="100" data-break="${i}" value="${esc(v)}"><span class="pi-unit">%</span>
      <span class="muted pi-note">＝ ${Math.round(((Number(v) || 0) / 100) * hp65)} HP</span>
      <button class="icon-btn rm" data-act="p-break-rm" data-idx="${i}" title="删除这一档">✕</button>
    </div>`;
  }).join('');
}

function pBuffRows(e) {
  const groups = e.initBuffList || [];
  if (!groups.length) return '<div class="p-empty muted">没有初始 Buff</div>';
  return groups.map((g, gi) => `<div class="p-buff-group">
      ${(g.list || []).map((b, bi) => `<div class="p-item">
        <span class="pi-id">${esc(b.buff)}</span>
        <label class="pi-inline">强度 <input class="pi-num" type="number" min="0" max="999" data-buff-stack="${gi}:${bi}" value="${esc(b.stack ?? 0)}"></label>
        <label class="pi-inline">层数 <input class="pi-num" type="number" min="0" max="999" data-buff-turn="${gi}:${bi}" value="${esc(b.turn ?? '')}" placeholder="—"></label>
        <button class="icon-btn rm" data-act="p-buff-rm" data-idx="${gi}:${bi}" title="移除">✕</button>
      </div>`).join('')}
    </div>`).join('');
}

/* 词条三组（文档 17 第 7 条）：可下拉、已有内容进入选项、每组最多 10 行、只保存已注册值 */
const P_TAG_FIELDS = { unit: 'unitKeywordList', assoc: 'associationList', kw: 'skillKeywordList' };
const P_TAG_TITLES = {
  unit: '单位词条（unitKeywordList）',
  assoc: '阵营词条（associationList）',
  kw: '自身户口 / 技能属性（skillKeywordList · 7 种）',
};

function pTagChoices(kind) {
  const t = pTables();
  if (kind === 'kw') return (t.skillKeywords || []).map((k) => ({ id: String(k.id), zh: k.zh || k.id, n: 0, dep: false }));
  const map = kind === 'unit' ? (t.unitKeyword || {}) : (t.association || {});
  const use = (kind === 'unit' ? t.unitUse : t.assocUse) || {};
  const dep = new Set((kind === 'unit' ? t.unitDeprecated : t.assocDeprecated) || []);
  return Object.keys(map)
    .map((id) => ({ id, zh: map[id] || '', n: Number(use[id]) || 0, dep: dep.has(id) }))
    .sort((a, b) => (b.n - a.n) || String(a.zh || a.id).localeCompare(String(b.zh || b.id), 'zh'));
}

function pTagLabel(c) {
  const name = c.zh || c.id;
  return c.n ? name + '（' + c.n + '）' : name;
}

function pTagChips(list, kind) {
  const cur = (list || []).map((x) => String(x || '').trim()).filter(Boolean);
  const choices = pTagChoices(kind);
  const zh = new Map(choices.map((c) => [String(c.id), c.zh || c.id]));
  return `<span class="p-chips">${cur.length
    ? cur.map((v) => `<span class="p-chip p-tagchip" title="${esc(v)}">${esc(pShort(zh.get(v) || v))}<button class="chip-x" data-act="p-tag-rm2" data-kind="${kind}" data-id="${esc(v)}" title="移除">✕</button></span>`).join('')
    : '<span class="muted">未设置</span>'}</span>`;
}

/* 自身户口：7 个基础属性关键词，点击亮/暗切换（用户指定恢复第一版交互） */
function pKwChips(list) {
  const cur = new Set((list || []).map((x) => String(x || '').trim()).filter(Boolean));
  const choices = pTagChoices('kw');
  return `<div class="p-tag-block">
    <div class="p-tag-line"><span class="p-tag-mini">属性</span><span class="p-tag-body p-chips p-kwchips">${choices.map((c) => `<button type="button" class="p-kwchip${cur.has(String(c.id)) ? ' on' : ''}" data-act="p-kw-toggle" data-id="${esc(c.id)}" title="${esc(c.id)}">${esc(pShort(c.zh || c.id, 10))}</button>`).join('')}</span></div>
    <div class="p-tag-line"><span class="p-tag-mini"></span><span class="p-tag-body muted">点击亮/暗切换这 7 个基础属性词条</span></div>
  </div>`;
}

/* 单位/阵营词条：输入 + 模糊搜索，选中即加（最多 10 条） */
function pTagHitsHtml(kind) {
  const e = (S.personality && S.personality.entity) || {};
  const list = kind === 'unit' ? (e.unitKeywordList || []) : (e.associationList || []);
  const used = new Set(list.map((x) => String(x || '').trim()).filter(Boolean));
  const q = String((S.pTagQ && S.pTagQ[kind]) || '').trim().toLowerCase();
  const pool = pTagChoices(kind)
    .filter((c) => !used.has(String(c.id)))
    .filter((c) => !q || String(c.id).toLowerCase().includes(q) || String(c.zh || '').toLowerCase().includes(q));
  const hits = pool.slice(0, 12);
  const btns = hits.map((c) => '<button type="button" class="p-taghit' + (c.dep ? ' dep' : '') + '" data-act="p-tag-add2" data-kind="' + kind + '" data-id="' + esc(c.id) + '" title="' + esc(c.id) + (c.dep ? ' · 原版已废弃' : '') + '">' + esc(pShort(pTagLabel(c), 16)) + '</button>').join('');
  const more = pool.length > hits.length ? '<span class="muted">还有 ' + (pool.length - hits.length) + ' 个，继续输入可筛选</span>' : '';
  return btns + (pool.length ? more : (q ? '<span class="muted">没有匹配（只能选已注册词条）</span>' : ''));
}

function pRefreshTagHits(kind) {
  const box = document.getElementById('p-taghits-' + kind);
  if (box) box.innerHTML = pTagHitsHtml(kind);
}

function pTagSearch(list, kind) {
  const cur = (list || []).map((x) => String(x || '').trim()).filter(Boolean);
  const q = String((S.pTagQ && S.pTagQ[kind]) || '').trim();
  const label = kind === 'unit' ? '单位' : '阵营';
  const full = cur.length >= 10;
  return `<div class="p-tag-block">
    <div class="p-tag-line"><span class="p-tag-mini">已带</span><span class="p-tag-body">${pTagChips(cur, kind)}</span></div>
    <div class="p-tag-line"><span class="p-tag-mini">搜索</span><span class="p-tag-body"><input class="p-search p-tagq" id="p-tagq-${kind}" data-tagq="${kind}" placeholder="输入${label}词条名称或 id（已选 ${cur.length}/10）" value="${esc(q)}" autocomplete="off" ${full ? 'disabled' : ''}></span></div>
    <div class="p-tag-line"><span class="p-tag-mini">备选</span><span class="p-tag-body p-chips p-taghits" id="p-taghits-${kind}">${pTagHitsHtml(kind)}</span></div>
  </div>`;
}

/* 被动并入人格页（文档 17 第 6 条）：战斗被动 / 支援被动 · 同步等级 N，加入前用下拉切级别 */
function pPassiveSection(st, resHtml) {
  const groups = [
    ...(((st.passives && st.passives.battle) || []).map((g) => ({ kind: 'battle', g }))),
    ...(((st.passives && st.passives.supporter) || []).map((g) => ({ kind: 'supporter', g }))),
  ];
  const item = (id, kind, level) => `<span class="p-pid"><span>${esc(id)}</span>${pPassiveNameHtml(id)}
      <button class="icon-btn" data-act="p-jump-passive" data-id="${esc(id)}" title="打开被动编辑">🖊</button>
      <button class="icon-btn rm" data-act="p-passive-rm" data-kind="${kind}" data-level="${esc(level)}" data-id="${esc(id)}" title="移除">✕</button>
    </span>`;
  const body = groups.length
    ? `<div class="p-passive-groups">${groups.map(({ kind, g }) => `<div class="p-passive-group">
        <b>${kind === 'battle' ? '战斗被动' : '支援被动'} · 同步等级 ${esc(g.level)}</b>
        <div>${(g.ids || []).map((id) => item(id, kind, g.level)).join('') || '<span class="muted">（空）</span>'}</div>
      </div>`).join('')}</div>`
    : '<div class="p-empty muted">还没有挂接被动；用下面的搜索框添加</div>';
  const kindSel = `<select id="p-passive-kind" title="被动类别"><option value="battle">战斗被动</option><option value="supporter">支援被动</option></select>`;
  const lvlSel = '';
  return pSection('被动', `${body}
    <div class="p-search-row">${pSearchBox('p-passive-q', '输入被动 id 或名称搜索', S.pPassiveQ)}</div>
    <div class="p-res-list" id="p-passive-res">${resHtml || ''}</div>
    <div class="p-add-row">${kindSel}${lvlSel}<button class="btn ghost sm" data-act="p-passive-add">＋ 加入</button></div>
    <div class="hint muted">被动默认写入同步等级 4（私服默认全员同步 4）。</div>`);
}

/* 查看源代码：整块替换式页面，显示两份原版文件（人格数据 / 被动挂接） */
async function openPersonalitySource() {
  if (!S.personality) return;
  const scroller = document.querySelector('.p-main');
  S.pSourceScroll = scroller ? scroller.scrollTop : 0;
  const res = await api('/api/personality/source?name=' + encodeURIComponent(S.selected) + '&id=' + encodeURIComponent(S.personality.id));
  S.pSource = {
    id: S.personality.id,
    mode: 'view',
    tab: 'entity',
    locked: Boolean(res.locked),
    entityDocRel: res.entityDocRel || ('custom_limbus_data/personality/' + res.id + '.json'),
    passiveDocRel: res.passiveDocRel || ('custom_limbus_data/personality-passive/' + res.id + '.json'),
    docs: { entity: res.entityDocText || '{}', passive: res.passiveDocText || '{"list":[]}' },
  };
  render();
}
function renderPersonalitySourcePage() {
  const sc = S.pSource;
  const editing = sc.mode === 'edit' && !sc.locked;
  const state = sc.locked ? '已锁定：源码被手动改过，表单编辑已停用' : editing ? '编辑中（未保存）' : '只读预览';
  const tab = sc.tab === 'passive' ? 'passive' : 'entity';
  const rel = tab === 'entity' ? sc.entityDocRel : sc.passiveDocRel;
  return `<div class="p-source-page">
  <div class="ps-head">
    <button class="btn ghost sm" data-act="p-source-back">← 返回人格编辑</button>
    <span class="ps-title">源代码 <b>${esc(S.selected)}</b> · ${esc(sc.id)}</span>
    <span class="ps-state ${sc.locked ? 'lock' : editing ? 'edit' : ''}">${state}</span>
    <span class="ps-acts">${editing
      ? '<button class="btn ghost sm" data-act="p-source-cancel">取消修改</button><button class="btn primary sm" data-act="p-source-save">保存两份文件</button>'
      : (sc.locked ? '' : '<button class="btn primary sm" data-act="p-source-edit">手动修改</button>')}</span>
  </div>
  <div class="ps-tabs">
    <button class="ps-tab${tab === 'entity' ? ' on' : ''}" data-act="p-source-tab" data-tab="entity">人格数据</button>
    <button class="ps-tab${tab === 'passive' ? ' on' : ''}" data-act="p-source-tab" data-tab="passive">被动挂接</button>
    <span class="ps-path muted">${esc(rel)}</span>
  </div>
  <div class="ps-body">
    <textarea id="p-source-text" class="ps-text" spellcheck="false" wrap="off"${editing ? '' : ' readonly'}>${esc(sc.docs[tab])}</textarea>
  </div>
  <div class="ps-foot muted">这两份就是 Mod 里的原版文件：<b>人格数据</b> <code>custom_limbus_data/personality/&lt;id&gt;.json</code>（{&quot;list&quot;:[…]}）、<b>被动挂接</b> <code>custom_limbus_data/personality-passive/&lt;id&gt;.json</code>。保存时字段校验仍生效；保存后该人格标记为「源码已手改」，表单编辑被锁定。</div>
</div>`;
}

async function refreshPersonalityQuiet() {
  if (!S.personality) return;
  try {
    await loadPersonality(S.selected, S.personality.id);
    await loadPersonalityExtra();
  } catch (e) { toast(e.message, 'error'); }
}
async function closeSourcePage() {
  S.pSource = null;
  await refreshPersonalityQuiet();
  render();
  S.pRestoreScroll = Number(S.pSourceScroll) || 0;
  render();
}
function renderPersonalityDetail() {
  const p = S.personality;
  if (!p) return '';
  if (S.pSource && String(S.pSource.id) === String(p.id)) return renderPersonalitySourcePage();
  const e = p.entity || {};
  const l = p.locale || {};
  const st = S.pStats || {};
  const sess = S.session || {};
  const dirty = Boolean(sess.dirty);
  const modEnabled = S.mods.find((m) => m.name === S.selected)?.enabled !== false;
  const name = l.name || String(p.id);
  const vanilla = Boolean(p.vanilla);
  const ro = Boolean(S.pReadonly);
  const passiveCounts = (st.passives && st.passives.counts) || { battle: 0, supporter: 0 };
  const skillCount = (e.attributeList || []).length;
  const res = S.pSearch || {};
  const results = (kind) => (res[kind] || []).slice(0, 20).map((r) => `<button class="p-res-item" data-act="p-pick-${kind}" data-id="${esc(r.id)}" data-name="${esc(r.name || '')}">
      <span>${esc(r.name || r.id)}</span><small>${esc(r.id)} · ${esc(r.source)}</small></button>`).join('');
  const rankList = (() => { const cur = Number(e.rank); const list = [1, 2, 3]; if (Number.isFinite(cur) && cur > 0 && !list.includes(cur)) list.push(cur); return list; })();
  const rankPicker = `<span class="p-rank-pick">${[1, 2, 3].map((r) => `<button type="button" class="p-rank-opt rank-${r}${Number(e.rank) === r ? ' on' : ''}" data-act="p-rank-set" data-rank="${r}" title="稀有度 ${esc(pRankLabel(r))}"></button>`).join('')}</span>`;
  const minSp = (e.minSpeedList || [])[0] ?? '';
  const maxSp = (e.maxSpeedList || [])[0] ?? '';
  const apps = (S.pAppOptions || []).filter((a) => !S.pAppQ || String(a).toLowerCase().includes(String(S.pAppQ).toLowerCase()));
  const locked = Boolean(p.locked);
  const hpTitle = pHpTitle(e);

  return `<div class="p-edit" id="personality-form">
    <aside class="p-portrait">
      <div class="pp-frame">${pPortraitHtml()}</div>
      <button class="btn ghost sm" data-act="p-portrait">编辑立绘</button>
      <div class="pp-id">${esc(p.id)}${vanilla ? ' · 原版' : ''}</div>
      ${ro ? '<button class="btn primary sm" data-act="p-export-edit" data-id="' + esc(p.id) + '" title="导出到本 Mod 并编辑">导出到本 Mod 并编辑</button>' : ''}
    </aside>
    <div class="p-main${locked ? ' p-locked' : ''}${ro ? ' p-readonly' : ''}">
      ${ro ? '<div class="p-ro-banner">只读查看：这是原版人格，改动不会写入。要修改请点「导出到本 Mod 并编辑」。</div>' : ''}
      <header class="p-head">
        <div class="ph-row ph-row1">
          <button class="btn ghost sm" data-act="p-back" title="返回人格列表">← 退出</button>
          ${pSinnerLogo(e.characterId)}
          <h2>${esc(name)}</h2>
          <span class="spacer"></span>
          <span class="session-state ${dirty ? 'dirty' : ''}" id="session-state">${dirty ? '有未保存改动' : '已保存'}</span>
        </div>
        <div class="ph-row ph-row2">
          ${pRankBadge(e.rank)}
          ${pSinChip(e)}
          <span class="p-chip">防御修正值 ${esc(e.defCorrection ?? '—')}</span>
          <span class="p-chip">速度区间 ${esc(minSp === '' ? '—' : minSp)} ~ ${esc(maxSp === '' ? '—' : maxSp)}</span>
          ${pResistChips(e)}
        </div>
        <div class="ph-row ph-row3">
          ${pHeadBar(st)}
          <span class="ph-counts">技能 ${skillCount} · 被动 ${passiveCounts.battle + passiveCounts.supporter}</span>
        </div>
        <div class="ph-row ph-row4">
          <button class="btn ghost sm" data-act="undo" ${!locked && sess.undo ? '' : 'disabled'}>撤销</button>
          <button class="btn ghost sm" data-act="redo" ${!locked && sess.redo ? '' : 'disabled'}>重做</button>
          <button class="btn primary sm" data-act="save-personality"${locked ? ' disabled' : ''}>保存</button>
          <button class="btn ghost sm" data-act="p-source">查看源代码</button>
          <span class="spacer"></span>
          <button class="btn danger sm" data-act="p-del">删除人格</button>
        </div>
      </header>
      ${modEnabled ? '' : '<div class="banner red">该 Mod 正在被禁用的状态 · 修改仍会保存到磁盘，但不会在游戏中生效</div>'}
      ${locked ? '<div class="banner lock">🔒 该人格的源码已被手动修改并锁定：表单已锁定，只能通过「查看源代码」修改（删除人格可解除）。</div>' : ''}

      ${pSection('基础数值', `
        ${pRow('人格名称', `<input data-field="locale.name" value="${esc(l.name ?? '')}" placeholder="必填">`)}
        ${pRow('稀有度', rankPicker + `<select class="sr-only" data-field="entity.rank" tabindex="-1" aria-hidden="true">${rankList.map((r) => `<option value="${r}" ${Number(e.rank) === r ? 'selected' : ''}>${r}</option>`).join('')}</select>`)}
        <div class="p-grid2">
          ${pRow('防御修正值', `<input type="text" inputmode="decimal" data-num="1" data-field="entity.defCorrection" value="${esc(e.defCorrection ?? '')}" placeholder="-999 ~ +999">`, '-999 ~ +999')}
          ${pRow('速度区间', `<span class="p-speed-pair"><input type="text" inputmode="decimal" data-num="1" step="1" data-field="entity.speedMin" value="${esc(minSp)}" placeholder="最小"><span class="p-speed-tilde">~</span><input type="text" inputmode="decimal" data-num="1" step="1" data-field="entity.speedMax" value="${esc(maxSp)}" placeholder="最大"></span>`)}
        </div>
        ${pRow('外观资源名', `<input id="p-app" data-field="entity.appearance" value="${esc(e.appearance ?? '')}" placeholder="可手输任意资源名，或点右侧展开挑选" autocomplete="off"><button class="btn ghost sm p-app-toggle" data-act="p-app-toggle">${S.pAppOpen ? '收起' : '展开'}</button>` + pAppPanel(e))}
      `)}

      ${pSection('血量与混乱阈值', `
        <div class="p-grid2">
          ${pRow('基础血量', `<input type="text" inputmode="decimal" data-num="1" step="0.5" data-field="entity.hp.defaultStat" value="${esc(e.hp?.defaultStat ?? '')}" title="${esc(hpTitle)}">`)}
          ${pRow('每级成长', `<input type="text" inputmode="decimal" data-num="1" step="0.01" data-field="entity.hp.incrementByLevel" value="${esc(e.hp?.incrementByLevel ?? '')}" title="${esc(hpTitle)}">`, 'Lv.65 血量＝基础＋成长×64（悬浮看各等级）')}
        </div>
        <div class="p-sub-head">混乱阈值（从右往左计数，最多 9 档）</div>
        ${pBreakRows(e)}
        <button class="btn ghost sm" data-act="p-break-add" ${((e.breakSection && e.breakSection.sectionList) || []).length >= 9 ? 'disabled' : ''}>＋ 增加一档</button>
      `)}

      ${pSection('物理抗性', ATK_LIST.map((k) => {
        const hit = ((e.resistInfo && e.resistInfo.atkResistList) || []).find((r) => r && r.type === k);
        return pRow(ATK_ZH[k], `<input type="text" inputmode="decimal" data-num="1" step="0.05" min="0" max="10" data-field="entity.resist.${k}" value="${esc(hit ? hit.value : '')}" placeholder="倍率">`);
      }).join(''))}

      ${pSection('技能', `<div class="p-search-row">${pSearchBox('p-skill-q', '输入技能 id 或名称搜索（原版 + 全部 Mod）', S.pSkillQ)}</div>
        <div class="p-res-list" id="p-skill-res">${results('skill')}</div>
        ${pSkillRows(e)}
        <div class="p-divider"><span>守备技能</span></div>
        <div class="p-search-row">${pSearchBox('p-def-q', '输入守备技能 id 搜索', S.pDefQ)}</div>
        <div class="p-res-list" id="p-def-res">${results('def')}</div>
        ${pDefRows(e)}`)}

      ${pPassiveSection(st, results('passive'))}

      ${pSection('上场初始 Buff', `<div class="p-search-row">${pSearchBox('p-buff-q', '输入 buff id 搜索（原版 + 全部 Mod）', S.pBuffQ)}</div>
        <div class="p-res-list" id="p-buff-res">${results('buff')}</div>
        ${pBuffRows(e)}
        <div class="p-hint muted">进入战斗时按默认强度生效；用上面的搜索框添加条目。</div>`)}

      ${pSection('词条', `
        <div class="p-tag-group"><div class="p-sub-head">${P_TAG_TITLES.unit}<span class="muted"> · 只能选已注册词条</span></div>${pTagSearch(e.unitKeywordList, 'unit')}</div>
        <div class="p-tag-group"><div class="p-sub-head">${P_TAG_TITLES.assoc}<span class="muted"> · 只能选已注册词条</span></div>${pTagSearch(e.associationList, 'assoc')}</div>
        <div class="p-tag-group"><div class="p-sub-head">${P_TAG_TITLES.kw}</div>${pKwChips(e.skillKeywordList)}</div>
      `)}

      
    </div>
  </div>`;
}

/* ---- 立绘 / 源代码 / 删除 三个弹窗 ---- */

/* 立绘区骨架（文档 17 第 11 条）：左侧显示数据，右侧留空（候选本轮不接入） */
function portraitBody() {
  const f = S.pf || { kind: 'profile', dataUrl: '' };
  const label = f.kind === 'profile' ? '一破（profile）' : '三破（cg）';
  const p = S.personality || {};
  const e = p.entity || {};
  const pid = esc(String(p.id ?? ''));
  const sinner = ((S.vanilla && S.vanilla.characters) || []).find((c) => Number(c.id) === Number(e.characterId));
  const rows = [
    ['人格 id', pid || '—'],
    ['罪人', esc(sinner ? sinner.name : (e.characterId ?? '—'))],
    ['外观资源名', esc(e.appearance || '—')],
    ['一破文件', 'custom_sprites/profile_' + pid + '.png'],
    ['三破文件', 'custom_sprites/cg_' + pid + '.png'],
    ['当前选项卡', esc(label)],
  ];
  const apps = (S.pAppOptions || []).filter((a) => !S.pfAppQ || String(a).toLowerCase().includes(String(S.pfAppQ).toLowerCase())).slice(0, 8);
  return `<div class="pf-split">
    <div class="pf-left">
      <div class="pf-col-title">立绘数据</div>
      <div class="pf-data">${rows.map(([k, v]) => `<div class="pf-datarow"><span class="pf-datak">${esc(k)}</span><span class="pf-datav">${v}</span></div>`).join('')}</div>
      <div class="pf-tabs">
        <button class="pf-tab ${f.kind === 'profile' ? 'on' : ''}" data-act="p-portrait-kind" data-kind="profile">一破</button>
        <button class="pf-tab ${f.kind === 'cg' ? 'on' : ''}" data-act="p-portrait-kind" data-kind="cg">三破</button>
      </div>
      <div class="pf-frame"><img id="pf-preview" class="pf-img" ${f.dataUrl ? `src="${f.dataUrl}"` : 'src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="' } alt="${esc(label)}"></div>
      <div class="pf-hint muted">只接受 .png；保存后写入 <code>custom_sprites/${f.kind}_${pid}.png</code>（同名旧图会被替换）。</div>
      <label class="btn ghost sm pf-pick">选择图片<input id="pf-file" type="file" accept="image/png" hidden></label>
    </div>
  </div>`;
}

function renderPfApps() {
  const host = document.querySelector('.pf-apphits');
  if (!host) return;
  const apps = (S.pAppOptions || []).filter((a) => !S.pfAppQ || String(a).toLowerCase().includes(String(S.pfAppQ).toLowerCase())).slice(0, 8);
  host.innerHTML = apps.map((a) => `<button class="pf-apphit" data-act="p-app-use" data-app="${esc(a)}">${esc(a)}</button>`).join('') || '<div class="pf-empty muted">没有匹配</div>';
}

let pAppsPromise = null;
async function ensureAppOptions() {
  if (Array.isArray(S.pAppOptions) && S.pAppOptions.length) return S.pAppOptions;
  if (!pAppsPromise) {
    pAppsPromise = api('/api/personality/appearance-options')
      .then((res) => { S.pAppOptions = (res && res.options) || []; return S.pAppOptions; })
      .catch((e) => { pAppsPromise = null; throw e; });
  }
  return pAppsPromise;
}

async function openPortraitModal() {
  if (!S.personality) return;
  try { await ensureAppOptions(); } catch (e) { toast(e.message, 'error'); }
  const sp = S.pPortrait || {};
  const kind = sp.profile ? 'profile' : (sp.cg ? 'cg' : 'profile');
  S.pf = { kind, dataUrl: (sp[kind] || {}).dataUrl || '' };
  S.pfAppQ = '';
  modal({
    title: '编辑立绘',
    body: `<div class="pf-host">${portraitBody()}</div>`,
    footer: '<button class="btn ghost" data-act="close-modal">返回</button><button class="btn primary" data-act="p-portrait-save">确认写入</button>',
  });
}

/* --------------------------- 人格编辑：数据交互层 --------------------------- */

async function pPatch(patch) {
  if (!S.personality || !S.selected) return null;
  if (S.pReadonly) {
    toast('这个原版人格当前是只读查看；要修改请点「导出到本 Mod 并编辑」', 'warn');
    return null;
  }
  const res = await api('/api/personality/patch', {
    method: 'POST',
    body: { name: S.selected, id: S.personalityId, ...patch },
  });
  S.session = res.session;
  if (res.changed) {
    if (patch.entity) S.personality.entity = { ...(S.personality.entity || {}), ...patch.entity };
    if (patch.locale) S.personality.locale = { ...(S.personality.locale || {}), ...patch.locale };
  }
  return res;
}

function pEntity() { return (S.personality && S.personality.entity) || {}; }

function pCollectDynamic() {
  const e = pEntity();
  const patch = {};
  const skillNums = $$('[data-skill-num]');
  if (skillNums.length) {
    const list = (e.attributeList || []).map((r, i) => ({ ...r }));
    skillNums.forEach((el) => { const i = Number(el.dataset.skillNum); if (list[i]) list[i].number = num(el.value); });
    patch.attributeList = list;
  }
  const breaks = $$('[data-break]');
  if (breaks.length) {
    const list = breaks.map((el) => num(el.value)).filter((v) => v !== null && v !== undefined && !Number.isNaN(v)).sort((a, b) => b - a).slice(0, 9);
    patch.breakSection = { sectionList: list };
  }
  const stacks = $$('[data-buff-stack]');
  const turns = $$('[data-buff-turn]');
  if (stacks.length || turns.length) {
    const groups = JSON.parse(JSON.stringify(e.initBuffList || []));
    stacks.forEach((el) => { const [gi, bi] = el.dataset.buffStack.split(':').map(Number); if (groups[gi]?.list?.[bi]) groups[gi].list[bi].stack = num(el.value); });
    turns.forEach((el) => { const [gi, bi] = el.dataset.buffTurn.split(':').map(Number); const v = String(el.value).trim(); if (groups[gi]?.list?.[bi]) { if (v === '') delete groups[gi].list[bi].turn; else groups[gi].list[bi].turn = num(v); } });
    patch.initBuffList = groups;
  }
  return Object.keys(patch).length ? { entity: patch } : null;
}

let pDynTimer = null;
function pScheduleDyn() {
  clearTimeout(pDynTimer);
  pDynTimer = setTimeout(async () => {
    try {
      const patch = pCollectDynamic();
      if (!patch) return;
      await pPatch(patch);
      await loadPersonalityExtra();
      render();
    } catch (err) { toast(err.message, 'error'); }
  }, 700);
}

/* 描述区自动保存（文档 17 第 9 条）：单独走 /api/personality/meta，不碰 locale */
let pMetaTimer = null;
const pSearchTimers = {};function pSearchUnits(kind, q) {
  clearTimeout(pSearchTimers[kind]);
  pSearchTimers[kind] = setTimeout(async () => {
    if (!q) { S.pSearch = { ...(S.pSearch || {}), [kind]: [] }; pRefreshRes(kind); return; }
    try {
      const map = { skill: 'skill', def: 'skill', buff: 'buff', passive: 'passive' };
      const res = await api(`/api/unit-search?kind=${map[kind]}&q=${encodeURIComponent(q)}&limit=8`);
      S.pSearch = { ...(S.pSearch || {}), [kind]: res.results || res.rows || [] };
      pRefreshRes(kind);
    } catch (err) { toast(err.message, 'error'); }
  }, 260);
}

function pResHtml(kind) {
  const rows = (S.pSearch || {})[kind] || [];
  if (!rows.length) return '';
  return rows.map((r) => `<button class="p-res-item" data-act="p-pick-${kind}" data-id="${esc(r.id)}" data-name="${esc(r.name || '')}">
      <span>${esc(r.name || r.id)}</span><small>${esc(r.id)} · ${esc(r.source)}</small></button>`).join('');
}

function pRefreshRes(kind) {
  const box = document.getElementById(`p-${kind}-res`);
  if (box) box.innerHTML = pResHtml(kind);
}
/* -------------------------------- 编辑写入 -------------------------------- */

let patchTimer = null;
let patching = false;

function readFieldPatch() {
  const form = $('#personality-form');
  if (!form) return null;
  const entity = {};
  const locale = {};
  const resist = {};
  const baseHp = { ...((S.personality && S.personality.entity && S.personality.entity.hp) || {}) };
  let hasResist = false;
  let hpDefault; let hpInc;
  let speedMin; let speedMax;
  let speedRaw;
  $$('[data-field]', form).forEach((el) => {
    const path = el.dataset.field;
    const raw = el.value;
    if (!path || path.startsWith('search.')) return;
    if (path.startsWith('locale.')) { locale[path.slice(7)] = raw; return; }
    const key = path.slice(7);
    if (key === 'rank') { if (raw !== '') entity.rank = num(raw); }
    else if (key === 'defCorrection') entity.defCorrection = num(raw);
    else if (key === 'uniqueAttribute') { entity.uniqueAttribute = raw; }
    else if (key === 'appearance') entity.appearance = raw.trim();
    else if (key === 'hp.defaultStat') hpDefault = num(raw);
    else if (key === 'hp.incrementByLevel') hpInc = num(raw);
    else if (key === 'speed') speedRaw = String(raw).trim();
    else if (key === 'speedMin') speedMin = num(raw);
    else if (key === 'speedMax') speedMax = num(raw);
    else if (key.startsWith('resist.')) { resist[key.slice(7)] = num(raw); hasResist = true; }
  });
  if (hpDefault !== undefined || hpInc !== undefined) {
    entity.hp = {
      ...baseHp,
      ...(hpDefault !== undefined ? { defaultStat: hpDefault } : {}),
      ...(hpInc !== undefined ? { incrementByLevel: hpInc } : {}),
    };
  }
  if (speedRaw !== undefined) {
    // 速度只保留「区间」单输入：3~7 或单个数字
    const m = speedRaw.match(/^(-?\d+(?:\.\d+)?)\s*[~～\-–]\s*(-?\d+(?:\.\d+)?)$/);
    const lo = m ? num(m[1]) : num(speedRaw);
    const hi = m ? num(m[2]) : lo;
    if (lo !== null && lo !== undefined && !Number.isNaN(lo)) entity.minSpeedList = [lo, lo, lo, lo];
    if (hi !== null && hi !== undefined && !Number.isNaN(hi)) entity.maxSpeedList = [hi, hi, hi, hi];
  }
  if (speedMin !== undefined && speedMin !== null) entity.minSpeedList = [speedMin, speedMin, speedMin, speedMin];
  if (speedMax !== undefined && speedMax !== null) entity.maxSpeedList = [speedMax, speedMax, speedMax, speedMax];
  if (hasResist) {
    const old = ((S.personality && S.personality.entity && S.personality.entity.resistInfo && S.personality.entity.resistInfo.atkResistList) || []);
    entity.resistInfo = {
      atkResistList: ['SLASH', 'PENETRATE', 'HIT'].map((k) => {
        const prev = old.find((r) => r && r.type === k);
        const v = resist[k] !== undefined ? resist[k] : (prev ? prev.value : 1);
        return { type: k, value: v };
      }),
    };
  }
  return { entity, locale };
}

function schedulePatch() {
  clearTimeout(patchTimer);
  patchTimer = setTimeout(() => { flushPatch().catch((e) => toast(e.message, 'error')); }, 450);
}

async function flushPatch() {
  if (!S.personality || !S.selected || patching) return;
  const patch = readFieldPatch();
  if (!patch) return;
  patching = true;
  try {
    const res = await api('/api/personality/patch', {
      method: 'POST',
      body: { name: S.selected, id: S.personalityId, ...patch },
    });
    S.session = res.session;
    if (S.session?.firstDirtyAt) S.autoAt = S.autoAt || S.session.firstDirtyAt;
    updateDock();
    const hint = $('#session-state');
    if (hint) { hint.textContent = S.session?.dirty ? '有未保存改动' : '已保存'; hint.className = `session-state ${S.session?.dirty ? 'dirty' : ''}`; }
    const undoBtn = $('[data-act="undo"]');
    const redoBtn = $('[data-act="redo"]');
    if (undoBtn) undoBtn.disabled = !(Number(S.session?.undo) > 0);
    if (redoBtn) redoBtn.disabled = !(Number(S.session?.redo) > 0);
    if (!res.changed) return;
  } finally { patching = false; }
}

/* ---------------------------------- 导入 ---------------------------------- */

function renderImport() {
  return `<div class="layout single">
    <section class="panel">
      <div class="panel-head">MOD 导入 <span class="tag">WIP</span></div>
      <div class="panel-body">
        <div class="empty-state"><div class="empty-mark">⇩</div><p>该功能正在维修</p><small class="muted">后续会支持从压缩包 / 文件夹导入并自动检查结构。</small></div>
      </div>
    </section>
  </div>`;
}

/* --------------------------------- 弹窗流程 -------------------------------- */

function openSettings() {
  const st = S.status || {};
  modal({
    title: '设置',
    wide: true,
    body: `
      <div class="grid-2">
        <label class="field"><span>编辑者名称</span><input id="set-editor" value="${esc(st.editorName || '但丁')}" placeholder="但丁"></label>
        <label class="field"><span>界面主题</span>
          <select id="set-theme">
            <option value="dark" ${(st.theme || 'dark') === 'dark' ? 'selected' : ''}>深色（默认）</option>
            <option value="light" ${st.theme === 'light' ? 'selected' : ''}>浅色</option>
          </select>
        </label>
      </div>
      <label class="field"><span>私服路径（游戏目录或 Lethe 目录）</span><input id="set-root" value="${esc(st.gameRoot || st.letheRoot || '')}" placeholder="D:\\私服"></label>
      <div class="row gap">
        <button class="btn primary sm" data-act="apply-root">使用这个目录</button>
        <button class="btn ghost sm" data-act="locate-quick">自动定位</button>
        <button class="btn ghost sm" data-act="locate-deep">深度扫描磁盘</button>
      </div>
      <div class="grid-2" style="margin-top:10px">
        <label class="field check"><input type="checkbox" id="set-delguard-on" ${deleteGuard().enabled ? 'checked' : ''}><span>永久删除前显示冷静倒计时</span></label>
        <label class="field"><span>冷静时长（秒，0–60）</span><input type="text" inputmode="decimal" data-num="1" id="set-delguard-sec" value="${String(deleteGuard().seconds)}"></label>
      </div>
      <div class="hint muted">当前 Lethe：${esc(st.letheRoot || '（未定位）')}<br>配置文件：${esc(st.configPath || '')}</div>`,
    footer: `<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="save-settings">保存设置</button>`,
  });
  $('#set-editor')?.focus();
}

function openCreateMod() {
  modal({
    title: '创建一个 Mod',
    body: `<label class="field"><span>Mod 名称</span><input id="new-mod-name" placeholder="例如：我的第一个 Mod"></label>
      <div class="hint muted">会在 mods 下建立 <code>custom_limbus_data</code> 与 <code>custom_limbus_locale</code> 两个空目录，其余目录用到时再生成。</div>`,
    footer: `<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="submit-create-mod">创建</button>`,
  });
  setTimeout(() => $('#new-mod-name')?.focus(), 30);
}

function openCreatePersonality() {
  const sinner = (S.vanilla?.characters || []).find((c) => c.id === S.sinner);
  modal({
    title: '新建人格',
    body: `<div class="hint muted">罪人：${esc(sinner?.name || '未选择')} · Mod：${esc(S.selected || '')}</div>
      <label class="field"><span>人格名称（必填）</span><input id="np-name" placeholder="例如：测试人格"></label>
      <label class="field"><span>人格 id（必填，不得与任何单位重复）</span><input id="np-id" placeholder="例如：10199"><span class="p-hint" id="np-id-hint"></span></label>
      <div class="grid-2">
      </div>
      <div class="hint muted">如果这个 id 属于原版人格，请回上一页从「原版人格列表」里选该人格（那样会把原版数据完整复制过来，并覆盖原版 id）。</div>`,
    footer: `<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="submit-create-personality">创建</button>`,
  });
  setTimeout(() => $('#np-name')?.focus(), 30);
}

async function checkPersonalityId(raw) {
  const hint = $('#np-id-hint');
  if (!hint) return;
  const id = String(raw || '').trim();
  if (!id) { hint.textContent = ''; hint.className = 'p-hint'; return; }
  if (!/^\d{4,10}$/.test(id)) { hint.textContent = 'id 需要 4–10 位数字'; hint.className = 'p-hint bad'; return; }
  try {
    const res = await api(`/api/personality/id-taken?id=${encodeURIComponent(id)}`);
    if (res.taken) {
      hint.textContent = res.taken.source === 'vanilla'
        ? `已被原版人格占用（${res.taken.name || ''}）：若要改原版，请回列表从「原版人格列表」里选它`
        : `已被 ${res.taken.source} 的 ${res.taken.name || ''} 占用`;
      hint.className = 'p-hint bad';
    } else {
      hint.textContent = '这个 id 可用';
      hint.className = 'p-hint good';
    }
  } catch (err) { hint.textContent = err.message; hint.className = 'p-hint bad'; }
}

async function confirmSwap(label) {
  const cur = S.modDetail?.dir || `mods\\${S.selected}`;
  modal({
    title: '替换当前版本',
    body: `<p>即将把当前版本与备份 <strong>${esc(label)}</strong> 互换。</p>
      <div class="hint muted">当前：${esc(cur)}<br>备份：${esc(label)}</div>
      <p class="danger-text">该操作无法撤销，也不会进入撤销历史。</p>`,
    footer: `<button class="btn ghost" data-act="close-modal">取消</button><button class="btn danger" data-act="submit-swap" data-label="${esc(label)}">确认互换</button>`,
  });
}

function openRecover(check) {
  const list = check.mods.map((m) => `<button class="person-row" data-act="recover-mod" data-name="${esc(m.name)}">
      <strong>${esc(m.name)}</strong><small>快照 ${new Date(m.at).toLocaleString('zh-CN', { hour12: false })}</small><span class="muted">${m.files} 文件 · ${fmtBytes(m.bytes)}</span>
    </button>`).join('');
  modal({
    title: '检测到软件未被正常关闭',
    body: `<p>上一次运行没有正常结束。是否尝试恢复自动快照？</p>
      <div class="person-list">${list || '<div class="list-empty">没有可用的自动快照</div>'}</div>
      <div class="hint muted">恢复会先用当前内容做一份内部存档，再覆盖为快照内容。</div>`,
    footer: `<button class="btn ghost" data-act="close-modal">忽略</button>`,
  });
}

/* ---------------------------------- 动作 ---------------------------------- */

const actions = {
  'p-back': async () => {
    S.personality = null; S.personalityId = null; S.sessionKey = ''; S.pStats = null; S.pSearch = {};
    await loadPersonalities(S.selected); render();
  },
  'p-source': async () => { try { await openPersonalitySource(); } catch (e) { toast(e.message, 'error'); } },
  'p-source-back': async () => { await closeSourcePage(); },
  'p-source-cancel': async () => { await closeSourcePage(); },
  'p-source-edit': () => {
    if (!S.pSource || S.pSource.locked) return;
    S.pSource.mode = 'edit';
    render();
    const ta = $('#p-source-text');
    if (ta) { ta.focus(); ta.setSelectionRange(0, 0); }
    toast('已进入编辑：保存时会写回实体与本地化', 'warn');
  },
  'p-source-tab': (el) => {
    if (!S.pSource) return;
    const ta = $('#p-source-text');
    if (ta) S.pSource.docs[S.pSource.tab === 'passive' ? 'passive' : 'entity'] = ta.value;
    S.pSource.tab = el.dataset.tab === 'passive' ? 'passive' : 'entity';
    render();
  },
  'p-source-save': async () => {
    const ta = $('#p-source-text');
    if (!ta) return;
    if (S.pSource) S.pSource.docs[S.pSource.tab === 'passive' ? 'passive' : 'entity'] = ta.value;
    const docs = (S.pSource && S.pSource.docs) || {};
    for (const k of ['entity', 'passive']) {
      try { JSON.parse(docs[k] || ''); } catch { toast((k === 'entity' ? '人格数据' : '被动挂接') + ' JSON 解析失败，请检查括号与引号', 'error'); return; }
    }
    try {
      await api('/api/personality/source', { method: 'POST', body: {
        name: S.selected, id: S.personality.id,
        entityText: docs.entity, passiveText: docs.passive,
      } });
      toast('两份文件已写回并保存', 'ok');
      S.pSource = null;
      await loadPersonality(S.selected, S.personality.id);
      await loadPersonalityExtra();
      render();
    } catch (e) { toast(e.message, 'error'); }
  },
  'p-del': () => {
    if (!S.personality) return;
    modal({
      title: '删除人格',
      body: '<div class="danger-box"><b>这个操作不可撤销。</b><div class="muted">将删除人格 <code>' + esc(S.personality.id) + '</code> 的实体、全部本地化条目、被动挂接与已导入的立绘贴图。</div></div>',
      footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn danger" data-act="p-del-ok">确认删除</button>',
    });
  },
  'p-del-ok': async () => {
    const id = S.personality && S.personality.id;
    if (!id) return;
    try {
      await api('/api/personality/delete', { method: 'POST', body: { name: S.selected, id } });
      closeModal(); S.personality = null; S.personalityId = null; S.sessionKey = '';
      await loadPersonalities(S.selected); render(); toast('人格已删除', 'ok');
    } catch (e) { toast(e.message, 'error'); }
  },
  'p-app-toggle': () => {
    S.pAppOpen = !S.pAppOpen;
    render();
  },
  'p-app-pick': async (el) => {
    const v = String(el.dataset.app || '');
    S.pAppOpen = false;
    if (!S.personality) { render(); return; }
    await pPatch({ entity: { appearance: v } });
    await loadPersonality(S.selected, S.personalityId);
    toast('已填入外观资源名', 'ok');
    render();
  },
  'p-slot-add': (el) => {
    if (el.dataset.kind === 'skill') S.pSkillSlots = Number(S.pSkillSlots) || 0;
    else S.pDefSlots = Number(S.pDefSlots) || 0;
    render();
  },
  'p-passive-add': async () => {
    const pid = String(S.pPassiveQ || '').trim();
    if (!pid) { toast('先在搜索框里填被动 id，或点结果里的一条', 'warn'); return; }
    const kind = document.getElementById('p-passive-kind')?.value || 'battle';
    const level = 4;
    try {
      await api('/api/personality/passive', { method: 'POST', body: { name: S.selected, id: S.personality.id, kind, op: 'add', passiveId: pid, level } });
      await loadPersonality(S.selected, S.personality.id); render(); toast(`已加入（${kind === 'battle' ? '战斗被动' : '支援被动'} · 同步等级 ${level}）`, 'ok');
    } catch (e) { toast(e.message, 'error'); }
  },
  'p-passive-rm': async (el) => {
    try {
      await api('/api/personality/passive', { method: 'POST', body: { name: S.selected, id: S.personality.id, kind: el.dataset.kind, op: 'rm', passiveId: el.dataset.id, level: Number(el.dataset.level) || 4 } });
      await loadPersonality(S.selected, S.personality.id); render(); toast('已移除', 'ok');
    } catch (e) { toast(e.message, 'error'); }
  },
  'p-edit-passives': () => actions['open-kind']({ dataset: { kind: 'passive' } }),
  'p-pick-passive': (el) => { S.pPassiveQ = el.dataset.id; pSearchUnits('passive', el.dataset.id); toast('已选中 ' + el.dataset.id + '，点「＋ 加入」写入', 'ok'); },
  'p-app-use': async (el) => {
    await pPatch({ entity: { appearance: el.dataset.app } });
    closeModal();
    render();
    toast('已改用原版立绘：' + el.dataset.app, 'ok');
  },
  'p-app-set': (el) => { pPatch({ entity: { appearance: el.dataset.app } }).then(() => render()).catch((e) => toast(e.message, 'error')); },
  'close-modal': () => closeModal(),
  'wip-guide': wip,
  'wip-cover': wip,
  'wip-thanks': wip,
  'open-settings': () => openSettings(),
  'create-mod': () => openCreateMod(),
  'select-mod': async (el) => {
    if (S.view === 'md') {
      const nm = el.dataset.name;
      S.selected = nm;
      S.md = null;
      S.mdId = null;
      await ensureMdSchemas();
      if (S.mdKind) await loadMdList(nm, S.mdKind);
      render();
      return;
    }
    const name = el.dataset.name;
    const prev = S.selected;
    const same = prev === name;
    S.selected = name;
    S.selectedDll = null;
    S.dllDetail = null;
    S.detailTab = 'current';
    S.backupView = null;
    // 点同一个 Mod 时只刷新详情，不清空编辑状态（此前会清空却不重载，列表与内容一起变空）
    if (!same) {
      S.sessionKey = '';
      S.skill = null;
      S.skillId = null;
      S.skills = [];
      S.modules = [];
      S.descCheck = null;
      S.descChecks = null;
      S.passive = null;
      S.passiveId = null;
      S.passives = [];
      S.buff = null;
      S.buffId = null;
      S.buffs = [];
      S.pDescCheck = null;
      S.bDescCheck = null;
    }
    if (S.status.letheRoot) {
      await loadModDetail(name);
      await refreshSession(name);
      // 切换 Mod 时同步刷新当前向导页的内容（此前只换了名字，列表/详情仍是上一个 Mod 的）
      if (prev !== name && S.editKind === 'skill') {
        await ensureKeywords();
        await loadSkillList(name);
      } else if (prev !== name && S.editKind === 'passive') {
        await ensureKeywords();
        await loadPassiveList(name);
      } else if (prev !== name && S.editKind === 'buff') {
        await ensureKeywords();
        await loadBuffList(name);
      } else if (prev !== name && S.editKind === 'module') {
        await loadModules(true);
      } else if (prev !== name && S.editKind === 'personality') {
        S.personality = null;
        S.personalityId = null;
        await loadPersonalities(name);
      }
    }
    render();
  },
  'select-dll': async (el) => {
    S.selectedDll = el.dataset.file;
    S.dllDetail = S.dlls.find((d) => d.file === S.selectedDll) || null;
    S.dllTab = 'current';
    render();
  },
  'pick-mod-version': (el) => {
    S.detailTab = el.dataset.label;
    S.backupView = null;
    render();
    if (S.detailTab !== 'current') {
      api(`/api/backup/read?name=${encodeURIComponent(S.selected)}&label=${encodeURIComponent(S.detailTab)}`)
        .then((res) => { S.backupView = { ...res.backup, label: S.detailTab }; render(); })
        .catch((e) => toast(e.message, 'error'));
    }
  },
  'pick-dll-version': (el) => { S.dllTab = el.dataset.label; render(); },
  'enable-mod': async () => {
    await api('/api/mod/enable', { method: 'POST', body: { name: S.selected } });
    toast('已启用', 'ok');
    await refreshModsAndDetail();
  },
  'disable-mod': async () => {
    await api('/api/mod/disable', { method: 'POST', body: { name: S.selected } });
    toast('已禁用（仍可编辑）', 'warn');
    await refreshModsAndDetail();
  },
  'backup-mod': async () => {
    const res = await api('/api/mod/backup', { method: 'POST', body: { name: S.selected } });
    toast(`已备份：${res.backup.label}`, 'ok');
    await refreshModsAndDetail();
  },
  'swap-version': (el) => confirmSwap(el.dataset.label),
  'submit-swap': async (el) => {
    closeModal();
    await api('/api/mod/swap', { method: 'POST', body: { name: S.selected, label: el.dataset.label } });
    toast('已互换版本', 'ok');
    S.detailTab = 'current';
    S.backupView = null;
    await refreshModsAndDetail();
  },
  'enable-dll': async () => {
    await api('/api/dll/toggle', { method: 'POST', body: { file: S.selectedDll, enabled: true } });
    toast('DLL 已启用', 'ok');
    await refreshDlls();
  },
  'disable-dll': async () => {
    await api('/api/dll/toggle', { method: 'POST', body: { file: S.selectedDll, enabled: false } });
    toast('DLL 已禁用', 'warn');
    await refreshDlls();
  },
  'backup-dll': async () => {
    const res = await api('/api/dll/backup', { method: 'POST', body: { file: S.selectedDll } });
    toast(`DLL 已备份：${res.backup.label}`, 'ok');
    await refreshDlls();
  },
  'reveal-plugins': () => api('/api/reveal', { method: 'POST', body: { path: S.home?.stats?.pluginsDir || '' } }).catch((e) => toast(e.message, 'error')),
  'open-kind': (el) => {
    const kind = el.dataset.kind;
    const w = WIZARDS.find((x) => x.kind === kind);
    if (!w || w.wip) { wip(); return; }
    const same = S.editKind === kind;
    // 正在编辑模块画布时切到别的编辑器：先走原有的“未保存/必填未填”拦截，确认后再切
    if (!same && S.moduleEditing && S.mb && !el._guarded) {
      mbLeaveGuard(() => { S.moduleEditing = null; S.mb = null; S.mbDoc = null; el._guarded = true; actions['open-kind'](el); el._guarded = false; });
      return;
    }
    if (!same) {
      S.moduleEditing = null; S.mb = null; S.mbDoc = null;
      // 从别的编辑器切过来时清掉上一个的选中态，避免旧详情残留在新面板里
      S.personality = null; S.personalityId = null; S.sinnerPicked = false;
      S.skill = null; S.skillId = null; S.descChecks = null; S.descCheck = null;
      S.passive = null; S.passiveId = null; S.pDescCheck = null;
      S.buff = null; S.buffId = null; S.bDescCheck = null;
    }
    S.editKind = kind;
    (async () => {
      if (kind === 'module') {
        await Promise.all([loadModules(true), ensureKeywords()]);
        render();
        return;
      }
      if (kind === 'passive') {
        await Promise.all([loadPassiveList(S.selected), ensureKeywords()]);
        render();
        return;
      }
      if (kind === 'buff') {
        await Promise.all([loadBuffList(S.selected), ensureKeywords()]);
        render();
        return;
      }
      if (kind === 'skill') {
        await Promise.all([loadSkillList(S.selected), ensureKeywords()]);
        render();
        return;
      }
      S.sinnerPicked = false;
      if (S.status.letheRoot) {
        await loadPersonalities(S.selected);
        if (!S.sinner || Number(S.sinner) < 1 || Number(S.sinner) > 12) {
          S.sinner = Number(sinnerCharacters()[0]?.id || 1);
        }
        const res = await loadVanilla(S.sinner);
        S.vanillaList = res.personalities || [];
      }
      render();
    })().catch((e) => toast(e.message, 'error'));
  },
  'back-wizard': () => { S.editKind = null; S.personality = null; S.personalityId = null; S.skill = null; S.skillId = null; S.passive = null; S.passiveId = null; S.buff = null; S.buffId = null; render(); },
  'back-personalities': () => { flushPatch().catch(() => {}); S.personality = null; S.personalityId = null; render(); },
  'pick-sinner': async (el) => {
    S.sinner = Number(el.dataset.id);
    S.sinnerPicked = true;
    const res = await loadVanilla(S.sinner);
    S.vanillaList = res.personalities || [];
    render();
  },
  'sinner-home': () => { S.sinnerPicked = false; render(); },
  'toggle-modlist': () => {
    S.listCollapsed = !S.listCollapsed;
    // 两层都已渲染，只在现有节点上切类名，滑动动画才能完整播放（重绘会重建 DOM、打断过渡）
    const live = $('.layout.edit');
    if (live) live.classList.toggle('list-collapsed', S.listCollapsed);
    else render();
    const ui = { ...(S.status?.ui || {}), listCollapsed: S.listCollapsed };
    if (S.status) S.status.ui = ui;
    api('/api/config', { method: 'POST', body: { ui } }).catch(() => { /* 写不进配置时只在本次生效 */ });
  },
  'toggle-vanilla': () => { S.showVanilla = !S.showVanilla; render(); },
  'open-vanilla-personality': (el) => {
    const id = el.dataset.id;
    modal({
      title: '原版人格',
      body: `<p class="muted">原版人格 \`${esc(id)}\` 可以只读查看，或导出到当前 Mod 后再编辑。导出后游戏内该原版人格会被本 Mod 覆盖。</p>`,
      footer: `<button class="btn ghost" data-act="close-modal">取消</button>
        <button class="btn" data-act="p-view-vanilla" data-id="${esc(id)}">只读查看</button>
        <button class="btn primary" data-act="confirm-vanilla-personality" data-id="${esc(id)}">导出到本 Mod 并编辑</button>`,
    });
  },
  'p-view-vanilla': async (el) => {
    closeModal();
    S.pForceReadonly = true;
    await loadPersonality(S.selected, el.dataset.id);
    render();
    toast('已进入只读查看；要修改请点左侧「导出到本 Mod 并编辑」', 'warn');
  },
  'p-export-edit': async (el) => {
    const res = await api('/api/personality/copy-vanilla', { method: 'POST', body: { name: S.selected, id: el.dataset.id } });
    toast(`已导出为自定义人格 ${res.personality?.id || el.dataset.id}`, 'ok');
    await loadPersonalities(S.selected);
    S.pForceReadonly = false;
    await loadPersonality(S.selected, res.personality?.id || el.dataset.id);
    await refreshSession(S.selected);
    render();
  },
  'confirm-vanilla-personality': async (el) => {
    const res = await api('/api/personality/copy-vanilla', { method: 'POST', body: { name: S.selected, id: el.dataset.id } });
    closeModal();
    toast(`已从原版复制为自定义人格 ${res.personality?.id || el.dataset.id}`, 'ok');
    await loadPersonalities(S.selected);
    S.vanillaList = S.vanilla?.personalities || [];
    await loadPersonality(S.selected, el.dataset.id);
    render();
  },
  'p-name-edit': () => {
    const view = $('#p-name-view');
    if (!view) return;
    const input = document.createElement('input');
    input.id = 'p-name-input';
    input.className = 'p-name-input';
    input.value = view.textContent.trim();
    view.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (!v) { render(); return; }
      try { await pPatch({ locale: { name: v } }); render(); } catch (err) { toast(err.message, 'error'); }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      else if (e.key === 'Escape') { done = true; render(); }
    });
    input.addEventListener('blur', () => { commit(); });
  },
  'p-pick-skill': async (el) => {
    pRememberSkillName(el);
    const id = Number(el.dataset.id);
    const list = (pEntity().attributeList || []).map((r) => ({ ...r }));
    if (list.some((r) => Number(r.skillId) === id)) { toast('这个技能已经在列表里了', 'warn'); return; }
    list.push({ skillId: id, number: 1 });
    S.pSkillQ = ''; S.pSearch = { ...(S.pSearch || {}), skill: [] };
    await pPatch({ entity: { attributeList: list } });
    await loadPersonalityExtra();
    render();
  },
  'p-skill-rm': async (el) => {
    const list = (pEntity().attributeList || []).filter((_, i) => i !== Number(el.dataset.idx)).map((r) => ({ ...r }));
    await pPatch({ entity: { attributeList: list } });
    await loadPersonalityExtra();
    render();
  },
  'p-pick-def': async (el) => {
    pRememberSkillName(el);
    const id = Number(el.dataset.id);
    const list = (pEntity().defenseSkillIDList || []).map(Number);
    if (list.includes(id)) { toast('这个守备技能已经在列表里了', 'warn'); return; }
    list.push(id);
    S.pDefQ = ''; S.pSearch = { ...(S.pSearch || {}), def: [] };
    await pPatch({ entity: { defenseSkillIDList: list } });
    await loadPersonalityExtra();
    render();
  },
  'p-def-rm': async (el) => {
    const list = (pEntity().defenseSkillIDList || []).filter((_, i) => i !== Number(el.dataset.idx));
    await pPatch({ entity: { defenseSkillIDList: list } });
    await loadPersonalityExtra();
    render();
  },
  'p-break-add': async () => {
    const domList = Array.from(document.querySelectorAll('[data-break]')).map((el) => Number(el.value)).filter((n) => !Number.isNaN(n));
    const list = [...new Set((domList.length ? domList : ((pEntity().breakSection && pEntity().breakSection.sectionList) || []).map(Number)).filter((n) => !Number.isNaN(n)))].sort((a, b) => b - a);
    if (list.length >= 9) { toast('混乱阈值最多 9 档', 'warn'); return; }
    const min = list.length ? list[list.length - 1] : 100;
    let next = Math.max(1, Math.floor(min / 2));
    while (list.includes(next) && next > 1) next -= 1;
    if (list.includes(next) || next <= 0) { toast('已经无法再加入更低的阈值档位', 'warn'); return; }
    list.push(next);
    list.sort((a, b) => b - a);
    await pPatch({ entity: { breakSection: { sectionList: list } } });
    await loadPersonalityExtra();
    render();
  },
  'p-break-rm': async (el) => {
    const list = ((pEntity().breakSection && pEntity().breakSection.sectionList) || []).filter((_, i) => i !== Number(el.dataset.idx));
    await pPatch({ entity: { breakSection: { sectionList: list } } });
    await loadPersonalityExtra();
    render();
  },
  'p-tag-add': async (el) => {
    const kind = el.dataset.kind;
    const key = kind === 'unit' ? 'unitKeywordList' : 'associationList';
    const input = $('#p-tag-' + kind);
    const v = input?.value?.trim();
    if (!v) { toast('先输入词条', 'warn'); return; }
    const list = (pEntity()[key] || []).slice();
    if (!list.includes(v)) list.push(v);
    await pPatch({ entity: { [key]: list } });
    render();
  },
  'p-tag-rm': async (el) => {
    const kind = el.dataset.kind;
    const key = P_TAG_FIELDS[kind] || 'unitKeywordList';
    const list = (pEntity()[key] || []).filter((_, i) => i !== Number(el.dataset.idx));
    await pPatch({ entity: { [key]: list } });
    render();
  },
  'p-kw-toggle': async (el) => {
    const kw = el.dataset.kw;
    const cur = new Set(pEntity().skillKeywordList || []);
    if (cur.has(kw)) cur.delete(kw); else cur.add(kw);
    await pPatch({ entity: { skillKeywordList: [...cur] } });
    render();
  },
  'p-pick-buff': async (el) => {
    const id = el.dataset.id;
    const groups = JSON.parse(JSON.stringify(pEntity().initBuffList || []));
    let g4 = groups.find((g) => Number(g.level) === 4);
    if (!g4) { g4 = { level: 4, list: [] }; groups.push(g4); }
    const last = g4;
    if (!Array.isArray(last.list)) last.list = [];
    last.list.push({ buff: id, stack: 1 });
    await pPatch({ entity: { initBuffList: groups } });
    render();
  },
  'p-buff-rm': async (el) => {
    const [gi, bi] = String(el.dataset.idx).split(':').map(Number);
    const groups = JSON.parse(JSON.stringify(pEntity().initBuffList || []));
    if (groups[gi] && groups[gi].list) groups[gi].list.splice(bi, 1);
    if (groups[gi] && (!groups[gi].list || !groups[gi].list.length)) groups.splice(gi, 1);
    await pPatch({ entity: { initBuffList: groups } });
    render();
  },
  'p-tag-add2': async (el) => {
    const kind = el.dataset.kind;
    const field = P_TAG_FIELDS[kind];
    const list = (pEntity()[field] || []).map(String);
    const id = String(el.dataset.id);
    if (list.includes(id)) return;
    if (list.length >= 10) { toast('最多 10 条', 'warn'); return; }
    list.push(id);
    await pPatch({ entity: { [field]: list } });
    if (S.pTagQ) S.pTagQ[kind] = '';
    render();
    const box = document.getElementById('p-tagq-' + kind);
    if (box) box.focus();
  },
  'p-tag-rm2': async (el) => {
    const kind = el.dataset.kind;
    const field = P_TAG_FIELDS[kind];
    const list = (pEntity()[field] || []).map(String).filter((x) => x !== String(el.dataset.id));
    await pPatch({ entity: { [field]: list } });
    render();
  },
  'p-kw-toggle': async (el) => {
    const cur = new Set((pEntity().skillKeywordList || []).map(String));
    const id = String(el.dataset.id);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    await pPatch({ entity: { skillKeywordList: [...cur] } });
    render();
  },
  'p-rank-set': async (el) => {
    const rank = Number(el.dataset.rank) || 1;
    await pPatch({ entity: { rank } });
    render();
  },
  'p-portrait': async () => { try { await openPortraitModal(); } catch (e) { toast(e.message, 'error'); } },
  'p-portrait-kind': (el) => {
    if (!S.pf) return;
    S.pf.kind = el.dataset.kind;
    S.pf.dataUrl = '';
    const host = $('.pf-host');
    if (host) host.innerHTML = portraitBody();
  },
  'p-portrait-save': async () => {
    if (!S.pf || !S.pf.dataUrl) { toast('先选择一张 .png 图片', 'warn'); return; }
    try {
      const res = await api('/api/personality/portrait', { method: 'POST', body: { name: S.selected, id: S.personality.id, kind: S.pf.kind, dataUrl: S.pf.dataUrl } });
      closeModal();
      await loadPortrait();
      toast('已写入 ' + (res.rel || ('custom_sprites/' + S.pf.kind + '_' + S.personality.id + '.png')), 'ok');
    } catch (e) { toast(e.message, 'error'); }
  },
  'p-jump-skill': async (el) => {
    const id = el.dataset.id;
    try {
      S.personality = null;
      S.personalityId = null;
      S.editKind = 'skill';
      await ensureKeywords();
      await loadSkillList(S.selected);
      await openSkill(id);
      render();
    } catch (err) { toast('这个技能不在当前 Mod 里：' + id, 'warn'); }
  },
  'p-jump-passive': async (el) => {
    const id = el.dataset.id;
    try {
      S.personality = null;
      S.personalityId = null;
      S.editKind = 'passive';
      await ensureKeywords();
      await loadPassiveList(S.selected);
      await openPassive(id);
      render();
    } catch (err) { toast('这个被动不在当前 Mod 里：' + id, 'warn'); }
  },
  'open-personality': async (el) => {
    const id = el.dataset.id;
    S.pLoading = true; S.personalityId = id; S.personality = null; render();
    try {
      await loadPersonality(S.selected, id);
    } catch (err) {
      toast(err && err.message ? err.message : '打开人格失败', 'error');
      S.personalityId = null;
    } finally {
      S.pLoading = false;
      render();
    }
  },
  'create-personality': () => openCreatePersonality(),
  'submit-create-mod': async () => {
    const name = $('#new-mod-name')?.value?.trim();
    if (!name) { toast('请填写 Mod 名称', 'warn'); return; }
    const res = await api('/api/mod/create', { method: 'POST', body: { name } });
    closeModal();
    toast(`已创建 Mod：${res.mod.name}`, 'ok');
    S.selected = res.mod.name;
    await refreshModsAndDetail();
    S.view = 'mods';
    render();
  },
  'submit-create-personality': async () => {
    const name = S.selected;
    const id = $('#np-id')?.value?.trim() || '';
    const displayName = $('#np-name')?.value?.trim() || '';
    if (!name) { toast('请先选择 Mod', 'warn'); return; }
    if (!displayName) { toast('请填写人格名称', 'warn'); return; }
    if (!id) { toast('请填写人格 id', 'warn'); return; }
    const taken = await api(`/api/personality/id-taken?id=${encodeURIComponent(id)}`).catch(() => null);
    if (taken && taken.taken) {
      toast(taken.taken.source === 'vanilla' ? '这个 id 属于原版人格：请回列表从「原版人格列表」里选它' : `id 已被 ${taken.taken.source} 占用`, 'warn');
      return;
    }
    const body = {
      name,
      characterId: S.sinner,
      displayName,

      id,
    };
    const res = await api('/api/personality/create', { method: 'POST', body });
    closeModal();
    toast(`人格 ${res.personality.id} 已创建`, 'ok');
    await loadPersonalities(name);
    S.vanillaList = S.vanilla?.personalities || [];
    await loadPersonality(name, res.personality.id);
    render();
  },
  'save-personality': () => saveCurrent(),
  undo: () => doUndo(),
  redo: () => doRedo(),
  'open-skill': (el) => openSkill(el.dataset.id),
  'skill-tab': (el) => { S.skillTab = el.dataset.tab; render(); },
  'new-skill': () => openCreateSkill(),
  'import-skill': () => openImportSkill(),
  'submit-create-skill': () => submitCreateSkill(),
  'import-kind': (el) => { S.imp.kind = el.dataset.kind; renderImportBody(); },
  'import-pick-sinner': (el) => { S.imp.characterId = el.value; loadImportPersonalities(el.value); },
  'import-pick-personality': (el) => { S.imp.personalityId = el.value; loadImportSkillsVanilla(el.value); },
  'import-pick-mod': (el) => { S.imp.mod = el.value; loadImportSkillsMod(el.value); },
  'submit-import-skill': () => submitImportSkill(),
  'remove-placed': (el) => removePlaced(el.dataset.zone, el.dataset.index, el.dataset.mid),
  'risk-save-skill': () => riskSave(),
  'search-skill': (el) => { S.skillSearch = el.value; render(); refocus(el.id, el.value.length); },
  'search-module': (el) => { S.moduleSearch = el.value; render(); refocus(el.id, el.value.length); },
  'save-settings': async () => {
    const dgOn = document.getElementById('set-delguard-on');
    const dgSec = document.getElementById('set-delguard-sec');
    if (dgOn || dgSec) saveDeleteGuard({ enabled: dgOn ? dgOn.checked : true, seconds: dgSec ? dgSec.value : 5 });
    const editorName = $('#set-editor')?.value || '但丁';
    const theme = $('#set-theme')?.value || 'dark';
    const res = await api('/api/config', { method: 'POST', body: { editorName, theme } });
    S.status = { ...S.status, editorName, theme };
    document.documentElement.dataset.theme = theme;
    closeModal();
    await loadHome();
    render();
    toast('设置已保存', 'ok');
  },
  'apply-root': async () => {
    const path = $('#set-root')?.value?.trim();
    if (!path) { toast('请填写路径', 'warn'); return; }
    try {
      await api('/api/root', { method: 'POST', body: { path } });
      closeModal();
      await bootData();
      toast('已切换私服目录', 'ok');
    } catch (e) { toast(e.message, 'error'); }
  },
  'locate-quick': () => locateAction({ quick: true }),
  'locate-deep': () => locateAction({ quick: false }),
  'recover-mod': async (el) => {
    const name = el.dataset.name;
    await api('/api/recover', { method: 'POST', body: { name } });
    closeModal();
    toast(`已从快照恢复：${name}`, 'ok');
    await bootData();
  },
  'autosave-now': async () => {
    const res = await api('/api/autosave/now', { method: 'POST', body: { name: S.selected } });
    if (res.ok) toast(`已自动快照：${res.result.files} 文件`, 'ok');
    else toast(res.result?.reason === 'clean' ? '当前没有未保存改动' : '快照未执行', 'warn');
  },
  'open-md': async (el) => {
    S.md = null;
    S.mdId = String(el.dataset.id);
    S.mdDirty = false;
    const res = await api(`/api/md/one?kind=${S.mdKind}&name=${encodeURIComponent(S.selected)}&id=${encodeURIComponent(S.mdId)}`);
    S.md = { entity: res.entity || {}, locale: res.locale || {}, applied: res.applied, appliedAt: res.appliedAt || '' };
    render();
  },
  'new-md': async () => {
    const res = await api(`/api/md/next?kind=${S.mdKind}&name=${encodeURIComponent(S.selected)}`);
    const spec = mdSpec(S.mdKind);
    S.mdId = String(res.id);
    S.md = { entity: JSON.parse(JSON.stringify(spec.defaults || {})), locale: { name: '', desc: '' }, applied: false };
    S.mdDirty = true;
    render();
  },
  'save-md': async () => {
    if (!S.md) return;
    const body = { name: S.selected, kind: S.mdKind, id: S.mdId, entity: S.md.entity, locale: S.md.locale };
    await api('/api/md/save', { method: 'POST', body });
    const spec = mdSpec(S.mdKind);
    toast(`已保存${spec.zh.replace('镜牢', '')} ${S.mdId}`, 'ok');
    S.mdDirty = false;
    await loadMdList(S.selected, S.mdKind);
    render();
  },
  'apply-md': async () => {
    if (!S.md) return;
    await api('/api/md/apply', { method: 'POST', body: { name: S.selected, kind: S.mdKind, id: S.mdId } });
    toast(`已落地到游戏文件（${mdSpec(S.mdKind).zh} ${S.mdId}）`, 'ok');
    S.md = { ...S.md, applied: true, appliedAt: new Date().toISOString() };
    await loadMdList(S.selected, S.mdKind);
    render();
  },
  'apply-md-all': async () => {
    const res = await api('/api/md/apply-all', { method: 'POST', body: { name: S.selected, kind: S.mdKind } });
    toast(`批量落地：成功 ${res.landed.length}，失败 ${res.failed.length}`, res.failed.length ? 'warn' : 'ok');
    await loadMdList(S.selected, S.mdKind);
    render();
  },
  'delete-md': () => {
    if (!S.md) return;
    const spec = mdSpec(S.mdKind);
    modal({
      title: `删除${spec.zh}`,
      body: `<div class="danger-box"><b>只删编辑器里的草稿，不动游戏文件。</b><div class="muted">${esc(spec.zh)} <code>${esc(S.mdId)}</code> 的草稿会被彻底删除；已经落地到 Mod 的文件保留。</div></div>`,
      footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn danger" data-act="confirm-delete-md">确认删除</button>',
    });
  },
  'confirm-delete-md': async () => {
    await api('/api/md/delete', { method: 'POST', body: { name: S.selected, kind: S.mdKind, id: S.mdId } });
    closeModal();
    toast('草稿已删除', 'warn');
    S.md = null;
    S.mdId = null;
    await loadMdList(S.selected, S.mdKind);
    render();
  },
  'md-add-node': () => {
    if (!S.md) return;
    (S.md.entity.nodeList ||= []).push({ type: 'BATTLE', count: 1 });
    S.mdDirty = true; render();
  },
  'md-del-node': (el) => {
    if (!S.md) return;
    S.md.entity.nodeList = (S.md.entity.nodeList || []).filter((_, i) => i !== Number(el.dataset.index));
    S.mdDirty = true; render();
  },
  'md-add-row': (el) => {
    if (!S.md) return;
    const key = el?.dataset?.list || 'upgradeList';
    const spec = mdSpec(S.mdKind);
    const f = (spec.fields || []).find((x) => x.key === key);
    const row = {};
    if (f?.type === 'mental') { row.group = 'add'; row.level = 1; row.conditionIDs = []; }
    for (const c of f?.cols || []) {
      if (c.type === 'number') row[c.key] = 0;
      else if (c.type === 'nums') row[c.key] = [];
      else if (c.type === 'enum') row[c.key] = Array.isArray(c.options) ? (c.options[0]?.id || '') : ((mdEnumOptions(c)[0] || {}).id || '');
      else row[c.key] = '';
    }
    (S.md.entity[key] ||= []).push(row);
    S.mdDirty = true; render();
  },
  pick: (el) => {
    if (!S.md) return;
    const kind = el.dataset.pick;
    const apply = (it) => {
      const id = Number(it.id);
      if (!Number.isFinite(id)) return;
      if (el.dataset.wave !== undefined && el.dataset.wave !== '') {
        const w = (S.md.entity.waveList || [])[Number(el.dataset.wave)];
        const slot = el.dataset.slot || 'units';
        const u = w && (w[slot] || [])[Number(el.dataset.uindex)];
        if (u) u[el.dataset.col || 'unitID'] = id;
      } else if (el.dataset.list) {
        const row = (S.md.entity[el.dataset.list] || [])[Number(el.dataset.index)];
        if (row) row[el.dataset.col || 'skillId'] = id;
      } else if (el.dataset.field) {
        const key = el.dataset.field;
        const cur = Array.isArray(S.md.entity[key]) ? S.md.entity[key].map(Number) : [];
        if (!cur.includes(id)) cur.push(id);
        S.md.entity[key] = cur;
      }
      S.mdDirty = true;
      render();
    };
    openPicker(kind, apply);
  },
  'pk-use': (el) => {
    const one = (S.pick.items || []).find((x) => String(x.id) === String(el.dataset.id));
    const cb = S.pick && S.pick.cb;
    closeModal();
    if (one && cb) cb(one);
  },
  'md-kind': async (el) => {
    S.mdKind = el.dataset.kind;
    S.md = null;
    S.mdId = null;
    S.mdDirty = false;
    await ensureMdSchemas();
    if (S.selected) await loadMdList(S.selected, S.mdKind);
    else toast('先从左侧选一个 Mod，再挑这张表', 'warn');
    render();
  },
  'md-back': () => {
    S.mdKind = null;
    S.md = null;
    S.mdId = null;
    render();
  },
  'md-clone': () => {
    const from = CLONE_FROM[S.mdKind];
    if (!from) return;
    openPicker(from, async (it) => {
      const label = it.name || it.nameZh || '';
      const res = await api('/api/md/clone', { method: 'POST', body: { kind: S.mdKind, name: S.selected, fromId: it.id, cat: it.cat || '', label } });
      toast(`已载入 ${label || it.id} → 新草稿 #${res.id}`, 'ok');
      await loadMdList();
      const one = await api(`/api/md/one?kind=${S.mdKind}&name=${encodeURIComponent(S.selected)}&id=${res.id}`);
      S.md = { entity: one.entity || {}, locale: one.locale || {}, applied: Boolean(one.applied), appliedAt: one.appliedAt || '' };
      S.mdId = String(res.id);
      S.mdDirty = false;
      render();
    });
  },
  'md-remove-landed': async () => {
    if (!S.md) return;
    if (!S.md.applied) { toast('这条还没落地过', 'error'); return; }
    const res = await api('/api/md/remove-landed', { method: 'POST', body: { kind: S.mdKind, name: S.selected, id: S.mdId } });
    toast(`已撤掉落地：搬走 ${res.moved.length} 个文件（备份在 LCW/backups/md-remove）`, 'ok');
    S.md = res.doc || { ...S.md, applied: false, appliedAt: '' };
    await loadMdList();
    render();
  },
  'md-del-row': (el) => {
    if (!S.md) return;
    const key = el?.dataset?.list || 'upgradeList';
    S.md.entity[key] = (S.md.entity[key] || []).filter((_, i) => i !== Number(el.dataset.index));
    S.mdDirty = true; render();
  },
  'md-add-wave': () => {
    if (!S.md) return;
    (S.md.entity.waveList ||= []).push({ mapName: '', mapSize: 0, bgm: '', enemyPositionID: 0, units: [{ unitID: 0, unitCount: 1, unitLevel: 1 }], subUnits: [] });
    S.mdDirty = true; render();
  },
  'md-del-wave': (el) => {
    if (!S.md) return;
    S.md.entity.waveList = (S.md.entity.waveList || []).filter((_, i) => i !== Number(el.dataset.wave));
    S.mdDirty = true; render();
  },
  'md-add-unit': (el) => {
    if (!S.md) return;
    const w = (S.md.entity.waveList || [])[Number(el.dataset.wave)];
    if (!w) return;
    const slot = el.dataset.slot || 'units';
    (w[slot] ||= []).push({ unitID: 0, unitCount: 1, unitLevel: 1 });
    S.mdDirty = true; render();
  },
  'md-del-unit': (el) => {
    if (!S.md) return;
    const w = (S.md.entity.waveList || [])[Number(el.dataset.wave)];
    if (!w) return;
    const slot = el.dataset.slot || 'units';
    w[slot] = (w[slot] || []).filter((_, i) => i !== Number(el.dataset.uindex));
    S.mdDirty = true; render();
  },
};

/* ------------------------------ 数据刷新辅助 ------------------------------ */

async function refreshModsAndDetail() {
  await loadMods();
  S.selected = S.selected || S.mods[0]?.name || null;
  if (S.selected) await loadModDetail(S.selected);
  await refreshSession(S.selected);
  render();
}

async function refreshDlls() {
  await loadDlls();
  if (S.selectedDll) S.dllDetail = S.dlls.find((d) => d.name === S.selectedDll) || null;
  render();
}

async function locateAction({ quick }) {
  S.locating = true;
  render();
  try {
    const res = await api('/api/locate', { method: 'POST', body: { quick } });
    S.autoLocated = true;
    if (!res.ok) { toast('没有找到私服，请在设置里手动指定', 'warn', 6000); }
    else toast(`已定位：${res.best.letheRoot}`, 'ok');
    await bootData();
  } catch (e) {
    toast(e.message, 'error');
    S.locating = false;
    render();
  }
}

async function bootData() {
  try {
    await loadStatus();
    if (!S.status.letheRoot) { S.locating = false; render(); return; }
    S.autoLocated = true;
    await Promise.all([loadHome(), loadMods(), loadDlls()]);
    await loadModDetail(S.selected);
    await refreshSession(S.selected);
    S.loading = false;
    S.locating = false;
    render();
  } catch (e) {
    S.loading = false;
    S.locating = false;
    render();
    toast(e.message, 'error', 6000);
  }
}

async function pollAutosave() {
  setInterval(async () => {
    if (!S.status?.letheRoot || !S.selected) return;
    try {
      const res = await api(`/api/autosave?name=${encodeURIComponent(S.selected)}`);
      const at = res.slot?.at;
      if (at && at !== S.autoAt && at !== S.lastSeenAuto) {
        S.lastSeenAuto = at;
        S.autoAt = at;
        toast(`已自动快照 ${S.selected}（${res.slot.files} 文件 · ${fmtBytes(res.slot.bytes)}）`, 'info', 6000);
        updateDock();
      }
    } catch { /* ignore */ }
  }, 20000);
}

async function checkRecover() {
  try {
    const res = await api('/api/recover-check');
    if (res.unclean && (res.mods || []).length) openRecover(res);
  } catch { /* ignore */ }
}

function leaveToAreaTop(view) {
  if (view === 'edit') {
    S.editKind = null; S.personalityId = null; S.personality = null; S.pSource = null;
    S.moduleEditing = null; S.mb = null; S.mbDoc = null;
    S.skill = null; S.skillId = null; S.passive = null; S.passiveId = null;
    S.buff = null; S.buffId = null;
  } else if (view === 'mods') {
    S.modDetail = null; S.selectedDll = null; S.detailTab = 'overview'; S.backupView = null;
  } else if (view === 'md') {
    S.mdKind = null; S.md = null; S.mdId = null; S.mdDirty = false;
  }
  S.pSourceScroll = 0;
}

/* --------------------------------- 事件绑定 -------------------------------- */

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-view]');
  if (nav && nav.classList.contains('dock-item') && S.view === nav.dataset.view) {
    if (mbIsDirty() || mbPendingMissing().list.length) { mbLeaveGuard(() => { leaveToAreaTop(S.view); render(); }); return; }
    leaveToAreaTop(S.view);
    render();
    return;
  }
  if (nav && (nav.classList.contains('dock-item') || nav.classList.contains('nav-key'))) {
    if (mbIsDirty() || mbPendingMissing().list.length) { mbLeaveGuard(() => { S.view = nav.dataset.view; S.moduleEditing = null; S.mb = null; S.mbDoc = null; render(); }); return; }
    S.view = nav.dataset.view;
    if (S.view === 'md') { enterMdView().catch((err) => toast(err.message, 'error')); return; }
    if (S.view === 'mods' && S.status?.letheRoot) loadModDetail(S.selected).then(() => render()).catch(() => render());
    else render();
    return;
  }
  const el = e.target.closest('[data-act]');
  if (el) {
    const fn = actions[el.dataset.act];
    if (fn) { Promise.resolve(fn(el)).catch((err) => toast(err.message, 'error')); }
  }
});

let imeComposing = false;
document.addEventListener('compositionstart', () => { imeComposing = true; }, true);
document.addEventListener('compositionend', (e) => {
  imeComposing = false;
  const t = e.target;
  if (t && t.dispatchEvent) t.dispatchEvent(new Event('input', { bubbles: true }));
}, true);
document.addEventListener('input', (e) => {
  if (imeComposing || e.isComposing) return;
  const t = e.target;

  /* ---- 镜牢编辑：输入即写回草稿（不重绘，避免打断输入） ---- */
  if (t.id === 'pk-q') {
    const kw = t.value;
    clearTimeout(S.pkTimer);
    S.pkTimer = setTimeout(() => { pkLoad(kw).catch((err) => toast(err.message, 'error')); }, 200);
    return;
  }
  if (t.id === 'md-search') { S.mdSearch = t.value; render(); refocus('md-search', t.value.length); return; }
  if (t.id === 'md-name') {
    if (S.md) {
      S.md.locale.name = t.value;
      S.mdDirty = true;
      const ttl = document.querySelector('.skill-title strong');
      if (ttl) ttl.textContent = t.value || '未命名草稿';
      const hint = document.getElementById('session-state');
      if (hint) { hint.className = 'session-state dirty'; hint.textContent = '有未保存改动'; }
    }
    return;
  }
  if (t.id === 'md-name-zh') { if (S.md) { S.md.locale.nameZh = t.value; S.mdDirty = true; } return; }
  if (t.id === 'md-desc') { if (S.md) { S.md.locale.desc = t.value; S.mdDirty = true; } return; }
  if (t.id === 'md-desc-zh') { if (S.md) { S.md.locale.descZh = t.value; S.mdDirty = true; } return; }
  if (t.dataset && t.dataset.mdpool && S.md) {
    const key = t.dataset.mdpool;
    const box = (S.md.entity.mapGenOption ||= {});
    box[key] = t.value.split(/[\s,，]+/).filter(Boolean).map((x) => Number(x)).filter((n) => Number.isFinite(n));
    S.mdDirty = true;
    return;
  }
  if (t.dataset && t.dataset.mdinfo) { mdSetField(t); return; }
  if (t.dataset && t.dataset.mdobj && S.md) {
    const key = t.dataset.mdobj;
    const box = (S.md.entity[key] ||= {});
    box[t.dataset.col] = t.type === 'number' ? (Number(t.value) || 0) : t.value;
    S.mdDirty = true;
    return;
  }
  if (t.dataset && t.dataset.mdwave && S.md) {
    const w = (S.md.entity.waveList || [])[Number(t.dataset.wave)];
    if (w) { w[t.dataset.mdwave] = t.type === 'number' ? (Number(t.value) || 0) : t.value; S.mdDirty = true; }
    return;
  }
  if (t.dataset && t.dataset.mdunit && S.md) {
    const w = (S.md.entity.waveList || [])[Number(t.dataset.wave)];
    const u = w?.[t.dataset.slot || 'units']?.[Number(t.dataset.uindex)];
    if (u) { u[t.dataset.mdunit] = Math.max(t.dataset.mdunit === 'unitID' ? 0 : 1, Number(t.value) || 0); S.mdDirty = true; }
    return;
  }
  if (t.dataset && t.dataset.mdrow !== undefined && S.md) {
    const i = Number(t.dataset.index);
    const key = t.dataset.list || 'upgradeList';
    const row = S.md.entity[key]?.[i];
    if (row) { row[t.dataset.mdrow] = mdRowValue(key, t.dataset.mdrow, t.value, t.type === 'number'); S.mdDirty = true; }
    return;
  }
  if (t.dataset && t.dataset.mdnodeCount !== undefined && S.md) {
    const i = Number(t.dataset.index);
    if (S.md.entity.nodeList?.[i]) S.md.entity.nodeList[i].count = Math.max(1, Number(t.value) || 1);
    S.mdDirty = true;
    return;
  }
  /* 立绘弹窗在 #modal-root 里（不在 #personality-form 内），这两条必须放在最前面 */
  if (t.id === 'pf-app-q') { S.pfAppQ = t.value; renderPfApps(); return; }
  if (t.id === 'p-app') { S.pAppQ = t.value; const box = $('#p-app-list'); if (box) box.innerHTML = (S.pAppOptions || []).filter((a) => !t.value || String(a).toLowerCase().includes(t.value.toLowerCase())).slice(0, 8).map((a) => '<button class="p-app-item" data-act="p-app-set" data-app="' + esc(a) + '">' + esc(a) + '</button>').join(''); return; }
  const bxEl = t.closest('[data-buff-extra]');
  if (bxEl && S.buff) {
    const i = Number(bxEl.dataset.buffExtra);
    if (Number.isInteger(i)) {
      S.buffExtras = Array.isArray(S.buffExtras) ? S.buffExtras.slice() : [];
      while (S.buffExtras.length <= i) S.buffExtras.push(null);
      S.buffExtras[i] = bxEl.value;
      const sv = document.querySelector('[data-act=buff-script-save]');
      if (sv) sv.disabled = false;
    }
    return;
  }
  const bfEl = t.closest('[data-bfield]');
  if (bfEl && S.buff) {
    scheduleBuffFields();
    return;
  }
  const bsEl = t.closest('[data-buff-script]');
  if (bsEl && S.buff) {
    const i = Number(bsEl.dataset.buffScript);
    if (Number.isInteger(i)) {
      const list = (Array.isArray(S.buffScripts) ? S.buffScripts
        : ((S.buff.fileInfo && Array.isArray(S.buff.fileInfo.listEntries)) ? S.buff.fileInfo.listEntries.slice() : [])).slice();
      while (list.length <= i) list.push('');
      list[i] = bsEl.value;
      S.buffScripts = list;
      const saveBtn = document.querySelector('[data-act=buff-script-save]');
      const resetBtn = document.querySelector('[data-act=buff-script-reset]');
      if (saveBtn) saveBtn.disabled = false;
      if (resetBtn) resetBtn.disabled = false;
    }
    return;
  }
  if (t.id === 'p-app-q') { S.pAppQ = t.value; render(); refocus('p-app-q', t.value.length); return; }
  if (t.closest('#personality-form')) {
    if (t.dataset && t.dataset.num) return;
    if (t.dataset && (t.dataset.skillNum !== undefined || t.dataset.break !== undefined || t.dataset.buffStack !== undefined || t.dataset.buffTurn !== undefined)) return;
    if (t.id === 'p-skill-q') { S.pSkillQ = t.value; pSearchUnits('skill', t.value); return; }
    if (t.id === 'p-def-q') { S.pDefQ = t.value; pSearchUnits('def', t.value); return; }
    if (t.id === 'p-buff-q') { S.pBuffQ = t.value; pSearchUnits('buff', t.value); return; }
    if (t.id === 'p-passive-q') { S.pPassiveQ = t.value; pSearchUnits('passive', t.value); return; }
    if (t.dataset && t.dataset.tagq) {
      S.pTagQ = { ...(S.pTagQ || {}), [t.dataset.tagq]: t.value };
      pRefreshTagHits(t.dataset.tagq);
      return;
    }
    if (t.id === 'np-id') { checkPersonalityId(t.value).catch(() => {}); }
    schedulePatch();
    return;
  }
  if (t.id === 'np-id') { checkPersonalityId(t.value).catch(() => {}); return; }
  if (t.id === 'skill-desc') { scheduleDesc(); return; }
  if (t.classList && t.classList.contains('coin-desc')) { scheduleCoinDesc(Number(t.dataset.index) || 0); return; }
  if (t.id === 'skill-search') { S.skillSearch = t.value; render(); refocus('skill-search', t.value.length); return; }
  if (t.id === 'module-search') { S.moduleSearch = t.value; render(); refocus('module-search', t.value.length); return; }
  if (t.id === 'p-name') { schedulePInfo(); return; }
  if (t.id === 'p-desc') { schedulePInfo(); return; }
  if (t.dataset && t.dataset.pcondVal !== undefined) { schedulePInfo(); return; }
  if (t.id === 'buff-desc') { scheduleBDesc(); return; }
  if (t.id === 'passive-search') { S.passiveSearch = t.value; render(); refocus('passive-search', t.value.length); return; }
  if (t.id === 'buff-search') { S.buffSearch = t.value; render(); refocus('buff-search', t.value.length); return; }
  if (t.id === 'module-search2') { S.moduleSearch2 = t.value; render(); refocus('module-search2', t.value.length); return; }
  if (t.id === 'mb-search') { S.mb.search = t.value; render(); refocus('mb-search', t.value.length); return; }
  if (t.dataset && t.dataset.pinfo) { schedulePInfo(); return; }
  if (t.dataset && t.dataset.binfo) { scheduleBInfo(); return; }
  if (t.dataset && t.dataset.info) { scheduleInfo(); }
});

document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'pf-file') {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/\.png$/i.test(f.name) && f.type !== 'image/png') { toast('只接受 .png 图片', 'error'); return; }
    const rd = new FileReader();
    rd.onload = () => { S.pf = { ...(S.pf || { kind: 'profile' }), dataUrl: String(rd.result) }; const img = document.getElementById('pf-preview'); if (img) img.src = String(rd.result); };
    rd.readAsDataURL(f);
    return;
  }

  /* ---- 人格编辑：数字/文本在 change（失焦）时落盘，避免逐键重绘 ---- */
  if (e.target && e.target.closest && e.target.closest('#personality-form')) {
    const et = e.target;
    if (et.dataset && (et.dataset.num || et.dataset.field)) schedulePatch();
    if (et.dataset && (et.dataset.skillNum !== undefined || et.dataset.break !== undefined || et.dataset.buffStack !== undefined || et.dataset.buffTurn !== undefined)) pScheduleDyn();
  }

  /* ---- 镜牢编辑：选择类控件（下拉/复选） ---- */
  if (t.dataset && t.dataset.mdinfo && S.md) { mdSetField(t); return; }
  if (t.dataset && t.dataset.mdnodeType !== undefined && S.md) {
    const i = Number(t.dataset.index);
    if (S.md.entity.nodeList?.[i]) S.md.entity.nodeList[i].type = t.value;
    S.mdDirty = true;
    return;
  }
  if (t.dataset && t.dataset.mdrow !== undefined && S.md) {
    const i = Number(t.dataset.index);
    const key = t.dataset.list || 'upgradeList';
    const row = S.md.entity[key]?.[i];
    if (row) { row[t.dataset.mdrow] = mdRowValue(key, t.dataset.mdrow, t.value, t.type === 'number'); S.mdDirty = true; }
    return;
  }
  const t = e.target;
  if (t.dataset && t.dataset.pcond) { schedulePInfo(); return; }
  if (t.dataset && t.dataset.tagsel) { pApplyTag(t.dataset.tagsel).catch((err) => toast(err.message, 'error')); return; }
  if (t.dataset && t.dataset.info) { scheduleInfo(); return; }
  if (t.dataset && t.dataset.pinfo) { schedulePInfo(); return; }
  if (t.dataset && t.dataset.binfo) { scheduleBInfo(); return; }
  if (t.dataset && t.dataset.coin !== undefined && t.dataset.key) {
    const i = Number(t.dataset.coin);
    const c = (S.skill?.code?.coins || [])[i];
    if (!c) return;
    if (t.dataset.key === 'value') c.value = Number(t.value) || 0;
    if (t.dataset.key === 'color') c.color = t.value;
    saveCode().catch((err) => toast(err.message, 'error'));
  }
});

/* 拖拽置入（模块 → 技能区 / 硬币区） */

/* 指针拖拽：WebView2 里 HTML5 拖放不可靠，改用鼠标事件实现（模块列表 → 置入区） */
let pdrag = null;
let dragEndedAt = 0;
function clearDragVisual() {
  document.body.classList.remove('drag-active');
  document.querySelectorAll('.drop-zone.drop-hot').forEach((z) => z.classList.remove('drop-hot'));
  const g = document.getElementById('drag-ghost');
  if (g) g.remove();
  document.querySelectorAll('.module-item.selected').forEach((x) => x.classList.remove('selected'));
}
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const it = e.target.closest('.module-item');
  if (!it) return;
  pdrag = { id: it.dataset.module, x0: e.clientX, y0: e.clientY, started: false, el: it };
});
document.addEventListener('mousemove', (e) => {
  if (!pdrag) return;
  if (!pdrag.started) {
    if (Math.hypot(e.clientX - pdrag.x0, e.clientY - pdrag.y0) < 5) return;
    pdrag.started = true;
    S.dragging = pdrag.id;
    document.body.classList.add('drag-active');
    pdrag.el.classList.add('selected');
    const g = document.createElement('div');
    g.id = 'drag-ghost';
    g.className = 'drag-ghost';
    g.textContent = (pdrag.el.querySelector('strong') || {}).textContent || '\u6a21\u5757';
    document.body.appendChild(g);
  }
  e.preventDefault();
  const g = document.getElementById('drag-ghost');
  if (g) { g.style.left = (e.clientX + 14) + 'px'; g.style.top = (e.clientY + 10) + 'px'; }
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const zone = hit && hit.closest ? hit.closest('.drop-zone') : null;
  document.querySelectorAll('.drop-zone.drop-hot').forEach((z) => { if (z !== zone) z.classList.remove('drop-hot'); });
  if (zone) zone.classList.add('drop-hot');
});
document.addEventListener('mouseup', (e) => {
  if (!pdrag) return;
  const st = pdrag;
  pdrag = null;
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const zone = hit && hit.closest ? hit.closest('.drop-zone') : null;
  clearDragVisual();
  if (!st.started) { if (S.dragging === st.id) S.dragging = null; return; }
  dragEndedAt = Date.now();
  S.dragging = null;
  if (zone) placeModule(st.id, zone.dataset.drop, zone.dataset.index);
});
document.addEventListener('click', (e) => {
  if (Date.now() - dragEndedAt < 300) return;
  const it = e.target.closest('.module-item');
  if (it) {
    const id = it.dataset.module;
    const on = S.dragging !== id;
    document.querySelectorAll('.module-item.selected').forEach((x) => x.classList.remove('selected'));
    S.dragging = on ? id : null;
    if (on) { it.classList.add('selected'); toast('\u5df2\u9009\u4e2d\u6a21\u5757\uff0c\u70b9\u51fb\u7f6e\u5165\u533a\u653e\u5165', 'ok'); }
    return;
  }
  const z = e.target.closest('.drop-zone');
  if (z && S.dragging) {
    const id = S.dragging;
    S.dragging = null;
    clearDragVisual();
    placeModule(id, z.dataset.drop, z.dataset.index);
  }
});

document.addEventListener('dragstart', (e) => {
  const it = e.target.closest('.module-item');
  if (!it) return;
  S.dragging = it.dataset.module;
  try { e.dataTransfer.setData('text/plain', S.dragging); e.dataTransfer.effectAllowed = 'copy'; } catch { /* ignore */ }
});
document.addEventListener('dragover', (e) => {
  const z = e.target.closest('.drop-zone');
  if (!z || !S.dragging) return;
  e.preventDefault();
  z.classList.add('drop-hot');
});
document.addEventListener('dragleave', (e) => {
  const z = e.target.closest('.drop-zone');
  if (z) z.classList.remove('drop-hot');
});
document.addEventListener('drop', (e) => {
  const z = e.target.closest('.drop-zone');
  if (!z) return;
  e.preventDefault();
  z.classList.remove('drop-hot');
  const mid = S.dragging || e.dataTransfer.getData('text/plain');
  S.dragging = null;
  if (!mid) return;
  placeModule(mid, z.dataset.drop, z.dataset.index);
});

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  const editing = Boolean(S.personality)
    || Boolean(S.editKind === 'skill' && S.skill)
    || Boolean(S.editKind === 'passive' && S.passive)
    || Boolean(S.editKind === 'buff' && S.buff)
    || Boolean(S.editKind === 'module');
  if (k === 's' && editing) { e.preventDefault(); saveCurrent(); }
  else if (k === 'z' && editing) { e.preventDefault(); (e.shiftKey ? doRedo : doUndo)(); }
  else if (k === 'y' && editing) { e.preventDefault(); doRedo(); }
});

window.addEventListener('beforeunload', (e) => {
  if (S.session?.dirty) { e.preventDefault(); e.returnValue = '您有已执行的操作未保存，是否保存该改动？'; }
});

$('#btn-locate')?.addEventListener('click', () => locateAction({ quick: true }));
$('#btn-settings')?.addEventListener('click', () => openSettings());
window.addEventListener('resize', () => syncDockHeight());
window.addEventListener('load', () => syncDockHeight());

/* ---------------------------------- 启动 ---------------------------------- */

async function boot() {
  try {
    await loadStatus();
    document.documentElement.dataset.theme = S.status.theme || 'dark';
    if (!S.status.letheRoot) {
      S.autoLocated = true;
      S.locating = true;
      render();
      const res = await api('/api/locate', { method: 'POST', body: { quick: false } });
      if (!res.ok) { S.locating = false; S.autoLocated = true; render(); toast('没有自动找到私服，请在设置里手动指定', 'warn', 6000); return; }
      await bootData();
    } else {
      await bootData();
    }
    await checkRecover();
    pollAutosave();
  } catch (e) {
    toast(e.message, 'error', 8000);
    S.loading = false;
    render();
  }
}

boot();

/* ============================ v0.3 技能编辑 ============================ */

function refocus(id, pos) {
  const el = document.getElementById(id);
  if (!el) return;
  el.focus();
  try { el.setSelectionRange(pos, pos); } catch { /* number 输入不支持选区 */ }
}

async function ensureKeywords() {
  if (S.keywords) return S.keywords;
  try { S.keywords = await api('/api/keywords'); }
  catch { S.keywords = { timings: [], tags: [], buffs: [], keywords: [], physical: [], sin: [], coinColors: [] }; }
  return S.keywords;
}

async function loadSkillList(name = S.selected) {
  if (!name) return;
  const res = await api('/api/skills?name=' + encodeURIComponent(name));
  S.skills = res.skills || [];
  S.modules = res.modules || [];
  S.skillDefaults = res.defaults || S.skillDefaults;
}

function pNormalizeSkill(sk) {
  if (!sk) return sk;
  const out = { ...sk };
  const coinN = (out.code && Array.isArray(out.code.coins)) ? out.code.coins.length : 0;
  if (!String(out.description || '') && out.localeText) {
    out.description = out.localeText;
    out.descSource = 'locale';
  }
  const fi = out.fileInfo || null;
  if (fi) {
    const keep = { ...(out.info || {}) };
    ['defType', 'skillType'].forEach((k) => { delete keep[k]; });
    out.info = Object.assign(keep, {
      basePower: fi.basePower,
      atkCorrection: fi.atkCorrection,
      targetNum: fi.targetNum,
      physical: fi.physical || keep.physical,
      sin: fi.sin || keep.sin,
      sign: fi.sign || keep.sign,
    });
    out.infoSource = 'file';
  }
  const total = Number(out.coinTotal || 0);
  if (out.code && Array.isArray(out.code.coins) && total > 0) {
    const coins = out.code.coins.slice(0, total).map((c) => ({ ...c }));
    while (coins.length < total) coins.push({ color: 'GREY', value: 0, modules: [] });
    out.code = { ...out.code, coins };
  }
  if (out.info && total > 0) out.info.coinCount = total;
  const base = Array.isArray(out.coinDescs) ? out.coinDescs.slice() : [];
  const loc = Array.isArray(out.localeCoinTexts) ? out.localeCoinTexts : [];
  const filled = [];
  for (let i = 0; i < Math.max(coinN, base.length, loc.length, Number(out.coinTotal || 0), Number((out.info && out.info.coinCount) || 0)); i += 1) {
    const mine = String(base[i] == null ? '' : base[i]);
    filled.push(mine || String(loc[i] == null ? '' : loc[i]));
  }
  if (filled.some((x) => x) && !base.some((x) => String(x || ''))) out.descSource = 'locale';
  out.coinDescs = filled;
  return out;
}

async function reloadSkill() {
  if (!S.selected || !S.skillId) return;
  const res = await api('/api/skill?name=' + encodeURIComponent(S.selected) + '&id=' + encodeURIComponent(S.skillId));
  S.skill = pNormalizeSkill(res.skill);
  await refreshSession(S.selected);
  await checkDesc();
}

async function openSkill(id) {
  const res = await api('/api/skill?name=' + encodeURIComponent(S.selected) + '&id=' + encodeURIComponent(id));
  S.skill = pNormalizeSkill(res.skill);
  S.skillId = String(id);
  S.sessionKey = 'skill:' + id;
  S.descCheck = null;
  S.descChecks = null;
  await refreshSession(S.selected);
  await checkDesc();
  render();
}

function filteredModules() {
  const q = (S.moduleSearch || '').trim().toLowerCase();
  return (S.modules || []).filter((m) => !q
    || String(m.description || '').toLowerCase().includes(q)
    || String(m.name || '').toLowerCase().includes(q)
    || String(m.id || '').toLowerCase().includes(q));
}

function moduleName(id) {
  const m = (S.modules || []).find((x) => x.id === id);
  return m ? (m.name || m.id) : id;
}

function renderSkillArea(back) {
  const skills = S.skills || [];
  const q = (S.skillSearch || '').trim().toLowerCase();
  const shown = skills.filter((sk) => !q || String(sk.id).includes(q) || String(sk.name || '').toLowerCase().includes(q));
  const rows = shown.map((sk) => '<button class="item skill-item ' + (S.skillId === String(sk.id) ? 'active' : '') + '" data-act="open-skill" data-id="' + esc(sk.id) + '">'
    + '<div class="item-main"><strong>' + esc(sk.name || sk.id) + '</strong><small>' + esc(sk.id)
    + (sk.override ? ' · 原版覆盖' : '') + (sk.coins ? ' · ' + sk.coins + ' 硬币' : '') + '</small></div>'
    + '<span class="state-dot ' + (sk.updatedAt ? 'on' : '') + '"></span></button>').join('');
  const mods = filteredModules().map((m) => '<div class="module-item" data-module="' + esc(m.id) + '">'
    + '<div class="m-head"><span class="tag ' + (m.test ? 'warn' : '') + '">' + (m.test ? '测试' : '模块') + '</span><strong>' + esc(m.name || m.id) + '</strong></div>'
    + '<p class="m-desc">' + esc(m.description || '') + '</p></div>').join('');
  const disabled = S.mods.find((m) => m.name === S.selected)?.enabled === false;
  return '<div class="pane-head">' + back
    + '<div><h2>技能编辑</h2><p class="muted">' + esc(S.selected || '') + '</p></div></div>'
    + (disabled ? '<div class="banner red">该 Mod 正在被禁用的状态 · 修改仍会保存到磁盘，但不会在游戏中生效</div>' : '')
    + '<div class="skill-wrap">'
    + '<section class="panel skill-list"><div class="panel-head">技能 <span class="count">' + skills.length + '</span></div>'
    + '<div class="panel-search"><input id="skill-search" class="search" placeholder="搜索 id / 名称" value="' + esc(S.skillSearch) + '"></div>'
    + '<div class="panel-body list">' + (rows || '<div class="list-empty">还没有自定义技能</div>') + '</div>'
    + '<div class="panel-foot two"><button class="btn ghost sm" data-act="new-skill">＋ 新建</button><button class="btn ghost sm" data-act="import-skill">⇩ 导入</button></div></section>'
    + renderSkillMain()
    + '<section class="panel module-list"><div class="panel-head">模块列表 <span class="count">' + (S.modules || []).length + '</span></div>'
    + '<div class="panel-search"><input id="module-search" class="search" placeholder="搜索 [命中时] / 描述" value="' + esc(S.moduleSearch) + '"></div>'
    + '<div class="panel-body mods">' + (mods || '<div class="list-empty">没有模块</div>') + '</div>'
    + '<div class="panel-foot"><span class="hint muted">模块编辑尚未开放 · 3 个测试模块仅供拖拽演示，不产生实际效果</span></div></section>'
    + '</div>';
}

function renderSkillMain() {
  if (!S.skill) {
    return '<section class="panel skill-main"><div class="panel-head">技能</div><div class="panel-body">'
      + '<div class="empty-state"><div class="empty-mark">✦</div><p>从左侧选一个技能</p><small class="muted">或新建 / 从原版人格导入</small></div></div></section>';
  }
  const sk = S.skill;
  const info = sk.info || {};
  const code = sk.code || {};
  const sess = S.session || {};
  const optList = (arr, v) => (arr || []).map((x) => '<option value="' + esc(x.id) + '"' + (String(x.id) === String(v) ? ' selected' : '') + '>' + esc(x.zh || x.id) + '</option>').join('');
  const field = (label, key, type, extra) => '<label class="field"><span>' + label + '</span><input type="' + (type || 'number') + '" data-info="' + key + '" value="' + esc(info[key]) + '" ' + (extra || '') + '></label>';
  const sel = (label, key, arr) => '<label class="field"><span>' + label + '</span><select data-info="' + key + '">' + optList(arr, info[key]) + '</select></label>';
  return '<section class="panel skill-main"><div class="panel-head skill-head">'
    + '<div class="skill-title"><strong>' + esc(sk.name || sk.id) + '</strong><small>' + esc(sk.id) + (sk.override ? ' · 原版覆盖' : '') + '</small></div>'
    + '<span class="spacer"></span>'
    + '<button class="btn ghost sm" data-act="undo"' + (sess.undo ? '' : ' disabled') + '>撤销</button>'
    + '<button class="btn ghost sm" data-act="redo"' + (sess.redo ? '' : ' disabled') + '>重做</button>'
    + '<button class="btn primary sm" data-act="save-personality">保存</button>'
    + '<span class="session-state ' + (sess.dirty ? 'dirty' : '') + '" id="session-state">' + (sess.dirty ? '有未保存改动' : '已保存') + '</span></div>'
    + '<div class="skill-body"><div class="info-card skill-info"><div class="col-title">基础信息</div>'
    + (sk.infoSource === 'file' ? '<div class="hint muted" style="margin:-2px 0 8px">以下数值直接取自技能文件；改动会写回技能文件并记入撤销历史。</div>' : '')
    + '<div class="grid-2">'
    + field('基础威力', 'basePower') + field('硬币数量', 'coinCount', 'number', 'min="1" max="12"')
    + field('攻击修正值', 'atkCorrection') + field('攻击容量', 'targetNum')
    + sel('物理属性', 'physical', S.keywords?.physical || []) + sel('罪孽属性', 'sin', S.keywords?.sin || [])
    + sel('正负硬币技能', 'sign', [{ id: 'positive', zh: '正面硬币' }, { id: 'negative', zh: '反面硬币' }])
    + '</div><div class="hint muted">技能名与 id 在创建时确定；名称本地化维护在后续版本提供。</div></div>'
    + '<div class="editor-card"><div class="tabs">'
    + '<button class="tab ' + (S.skillTab === 'code' ? 'active' : '') + '" data-act="skill-tab" data-tab="code">代码</button>'
    + '<button class="tab ' + (S.skillTab === 'desc' ? 'active' : '') + '" data-act="skill-tab" data-tab="desc">描述</button></div>'
    + (S.skillTab === 'desc' ? renderSkillDesc(sk) : renderSkillCode(code))
    + '</div></div></section>';
}

function chipHtml(arr, zone, idx) {
  return (arr || []).map((mid) => '<span class="chip">' + esc(moduleName(mid))
    + '<button class="chip-x" data-act="remove-placed" data-zone="' + zone + '" data-index="' + idx + '" data-mid="' + esc(mid) + '">×</button></span>').join('');
}

function renderSkillScriptCards(group) {
  const rows = (group.parsed && group.parsed.rows) || [];
  if (!rows.length) { return ''; }
  const matched = group.matchedModules || [];
  const modOf = (mid) => {
    const m = (S.modules || []).find((x) => x.id === mid);
    return m ? (m.name || mid) : mid;
  };
  const cards = rows.map((r, i) => {
    const mod = matched[i] ? modOf(matched[i]) : '';
    return '<div class="pr-card">'
      + '<div class="pr-head">'
      + '<span class="pr-hat">' + (r.timing ? '⚑ ' + esc(pTimingLabel(r.timing)) : '未识别时点') + '</span>'
      + (r.loop ? '<span class="pr-tag">遍历 ' + esc(pTargetLabel(r.loop.n)) + (r.loop.c ? ' × ' + r.loop.c : '') + '</span>' : '')
      + '<span class="pr-tag">' + (r.blockCount || 0) + ' 个块</span>'
      + (mod ? '<span class="pr-tag pr-mod">模块：' + esc(mod) + '</span>' : '<span class="pr-tag pr-raw">外部脚本</span>')
      + '</div>'
      + (mod ? '' : '<div class="pr-tree">' + pParsedTree(r.stmts, 0) + '</div>')
      + '<details class="pr-code"><summary>脚本原文</summary><pre>' + esc(r.code) + '</pre></details>'
      + '</div>';
  }).join('');
  return cards;
}

function renderSkillGroups(doc) {
  const groups = Array.isArray(doc.scriptGroups) ? doc.scriptGroups : [];
  const total = groups.reduce((n, g) => n + ((g.parsed && g.parsed.rows.length) || 0), 0);
  if (!total) { return ''; }
  const blocks = groups.map((g) => {
    const cards = renderSkillScriptCards(g);
    const plain = (g.plain || []).length
      ? '<div class="hint muted">非模块脚本（游戏内置效果，不在编辑器里编辑）：' + g.plain.map((x) => '「' + x + '」').join(' ') + '</div>'
      : '';
    return '<div class="sg-block"><div class="col-title">' + esc(g.label) + ' <span class="muted">（' + ((g.parsed && g.parsed.rows.length) || 0) + ' 条 Modular 脚本）</span></div>'
      + plain + cards + '</div>';
  }).join('');
  return '<div class="pr-wrap"><div class="col-title">已识别的脚本 <span class="muted">（技能级与每枚硬币，共 ' + total + ' 条）</span></div>'
    + '<div class="hint muted">这里只做识别：改脚本请用上方的置入区，或到模块编辑里改模块。</div>'
    + blocks + '</div>';
}

function renderSkillCode(code) {
  const colors = S.keywords?.coinColors || [{ id: 'GREY', zh: '灰' }];
  const skillZone = '<div class="drop-zone skill-zone" data-drop="skill">'
    + (chipHtml(code.skill, 'skill', -1) || '<span class="dz-hint">把模块拖到这里：作用于技能本身</span>') + '</div>'
    + renderSkillGroups(S.skill || code)
    ;
  const coins = (code.coins || []).map((c, i) => '<div class="coin-card"><div class="coin-head"><strong>硬币 ' + (i + 1) + '</strong>'
    + '<select data-coin="' + i + '" data-key="color">'
    + colors.map((x) => '<option value="' + esc(x.id) + '"' + (String(c.color) === String(x.id) ? ' selected' : '') + '>' + esc(x.zh || x.id) + '</option>').join('')
    + '</select><label class="inline-field">变动值 <input type="text" inputmode="decimal" data-num="1" data-coin="' + i + '" data-key="value" value="' + esc(c.value ?? 0) + '"></label></div>'
    + '<div class="drop-zone coin-zone" data-drop="coin" data-index="' + i + '">'
    + (chipHtml(c.modules, 'coin', i) || '<span class="dz-hint">拖入模块：作用于这枚硬币</span>') + '</div></div>').join('');
  return '<div class="code-wrap"><div class="code-col"><div class="col-title">技能置入区</div>' + skillZone + '</div>'
    + '<div class="coin-col"><div class="col-title">硬币置入区 <span class="muted">（数量由「硬币数量」决定）</span></div>'
    + (coins || '<div class="list-empty">硬币数量至少为 1</div>') + '</div></div>'
    + '<div class="hint muted">从右侧模块列表拖入。硬币颜色与变动值目前是占位数据，编辑器↔游戏映射留待后续版本。</div>';
}

function highlightText(text, tokens) {
  if (!tokens || !tokens.length) return esc(text);
  let out = '';
  let idx = 0;
  for (const t of tokens) {
    const at = text.indexOf(t.raw, idx);
    if (at < 0) continue;
    out += esc(text.slice(idx, at));
    const cls = t.kind === 'unknown' ? 'kw-bad'
      : t.kind === 'timing' ? 'kw-timing'
        : t.kind === 'tag' ? 'kw-tag'
          : t.kind === 'keyword' ? 'kw-kw' : 'kw-buff';
    out += '<span class="' + cls + '" title="' + esc(t.id || '未识别') + '">' + esc(t.raw) + '</span>';
    idx = at + t.raw.length;
  }
  return out + esc(text.slice(idx));
}

function descTextOf(sk) {
  if (!sk) return '';
  return typeof sk.description === 'string' ? sk.description : '';
}
function coinDescOf(sk, i) {
  const arr = (sk && Array.isArray(sk.coinDescs)) ? sk.coinDescs : [];
  return typeof arr[i] === 'string' ? arr[i] : '';
}
function coinDescCount(sk) {
  const n = (sk && sk.code && Array.isArray(sk.code.coins)) ? sk.code.coins.length : 0;
  const d = (sk && Array.isArray(sk.coinDescs)) ? sk.coinDescs.length : 0;
  const g = (sk && Array.isArray(sk.localeCoinSegs)) ? sk.localeCoinSegs.length : 0;
  return Math.max(0, n, d, g);
}
function descStateOf(kind, i) {
  const all = S.descChecks || {};
  if (kind === 'skill') return all.skill || { tokens: [], unknown: [], game: '' };
  return (all.coins && all.coins[i]) || { tokens: [], unknown: [], game: '' };
}
function descCheckHtml(st) {
  const unk = st.unknown || [];
  const okCount = (st.tokens || []).filter((t) => t.kind !== 'unknown').length;
  return '<div class="desc-check ' + (unk.length ? 'bad' : 'ok') + '">'
    + (unk.length ? '⚠ 有 ' + unk.length + ' 个关键词未识别：' + unk.map((u) => '[' + u + ']').join(' ')
      : '✓ 关键词检查通过（' + okCount + ' 个）')
    + '</div>';
}
function descKwListHtml() {
  const timings = (S.keywords && S.keywords.timings) || [];
  const buffs = (S.keywords && S.keywords.buffs) || [];
  const items = timings.map((t) => String(t.zh || '').trim()).filter(Boolean)
    .concat(buffs.map((b) => String(b.zh || '').trim()).filter(Boolean));
  const uniq = Array.from(new Set(items));
  return '<datalist id="desc-kw-list">' + uniq.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>';
}
function descKwToolsHtml() {
  return '<div class="desc-tools"><input id="desc-kw" list="desc-kw-list" class="mb-logic" placeholder="关键词中文名（时点 / Buff）"><button class="btn ghost sm" data-act="desc-kw-insert">插入到光标处</button><span class="muted">插入后会写成 [关键词]，保存时转成游戏英文 id</span></div>';
}
function renderSkillDesc(sk) {
  const text = descTextOf(sk);
  const st = descStateOf('skill');
  const n = coinDescCount(sk);
  const coins = [];
  for (let i = 0; i < n; i += 1) {
    const ct = coinDescOf(sk, i);
    const cst = descStateOf('coin', i);
    coins.push('<div class="coin-desc-card">'
      + (() => {
        const segs = Array.isArray(sk.localeCoinSegs) ? Number(sk.localeCoinSegs[i] || 0) : 0;
        const lines = String(ct || '').split('\n').filter((x) => x.trim()).length;
        const rows = Math.max(3, Math.min(8, lines + 1));
        const tip = segs > 1
          ? '这一枚硬币有 <b>' + segs + '</b> 段描述（每行一段，保存时按行拆回文件）'
          : '这一枚硬币命中/使用时显示的描述';
        return '<div class="coin-desc-head"><span class="cd-tag">硬币 ' + (i + 1) + '</span>'
          + (segs > 1 ? '<span class="seg-badge">' + segs + ' 段</span>' : '')
          + '<span class="muted">' + tip + '</span></div>'
          + '<textarea id="coin-desc-' + i + '" class="desc-input coin-desc" data-index="' + i + '" spellcheck="false" rows="' + rows + '" placeholder="例如：[命中时]对目标施加1层[烧伤]">' + esc(ct) + '</textarea>';
      })()
      + '<div class="desc-preview" id="coin-preview-' + i + '">' + highlightText(ct, cst.tokens || []) + '</div>'
      + '<div class="coin-check" id="coin-check-' + i + '">' + descCheckHtml(cst) + '</div>'
      + '</div>');
  }
  const gameAll = [st.game || '', ...Array.from({ length: n }, (_, i) => descStateOf('coin', i).game || '')].filter(Boolean).join('\n');
  const fromFile = (sk.descSource === 'locale') && !String(sk.descriptionEdited || '');
  return '<div class="desc-wrap">'
    + (fromFile ? '<div class="banner soft">以下描述是从技能文件里的游戏写法还原的（[英文id] → 中文名）；改动并保存后会按游戏写法写回 locale。</div>' : '')
    + '<div class="desc-block"><div class="desc-block-head"><strong>技能描述</strong><span class="muted">技能本体（非硬币）的说明文本，用 [关键词] 书写</span></div>'
    + descKwToolsHtml()
    + '<textarea id="skill-desc" class="desc-input" spellcheck="false" rows="6" placeholder="例如：[使用时]使本技能的硬币威力+1">' + esc(text) + '</textarea>'
    + '<div class="desc-preview" id="desc-preview">' + highlightText(text, st.tokens || []) + '</div>'
    + '<div id="desc-check">' + descCheckHtml(st) + '</div></div>'
    + (() => {
      const nc = (sk.code && Array.isArray(sk.code.coins)) ? sk.code.coins.length : 0;
      const nd = coinDescCount(sk);
      return nc < nd
        ? '<div class="banner soft">文件里只有 ' + nc + ' 枚硬币数据，但描述有 ' + nd + ' 段；下面按描述段数列出，保存时会写回文件里已有的段落。</div>'
        : '';
    })()
    + '<div class="desc-block"><div class="desc-block-head"><strong>硬币描述</strong><span class="muted">数量跟随「硬币数量」，每枚硬币一段；同一枚硬币的多段描述请分多行写</span></div>'
    + '<div class="coin-desc-grid">' + (coins.join('') || '<div class="muted" style="padding:8px 2px">当前技能还没有硬币；把「硬币数量」调到 1 以上即可</div>') + '</div></div>'
    + '<details class="game-text"><summary>游戏内文本预览（关键词已转为英文 id）</summary><pre id="game-text">' + esc(gameAll) + '</pre></details>'
    + '<div class="hint muted">描述改动在停止输入后写入磁盘并记入撤销历史；代码区（拖拽）不进撤销。</div></div>' + descKwListHtml();
}
let descTimer = null;
let coinTimer = null;
let infoTimer = null;

function scheduleDesc() {
  clearTimeout(descTimer);
  descTimer = setTimeout(() => flushDesc().catch((e) => toast(e.message, 'error')), 700);
}

async function flushDesc() {
  if (!S.skill) return;
  const ta = $('#skill-desc');
  const text = ta ? ta.value : descTextOf(S.skill);
  if (ta && text === descTextOf(S.skill)) return;
  const res = await api('/api/skill/meta', { method: 'POST', body: { name: S.selected, id: S.skillId, description: text } });
  S.skill = { ...S.skill, description: text, coinDescs: res.meta.coinDescs || S.skill.coinDescs };
  S.session = res.session;
  await analyzeAll();
  updateSkillDom();
}

function scheduleCoinDesc(index) {
  clearTimeout(coinTimer);
  coinTimer = setTimeout(() => flushCoinDesc(index).catch((e) => toast(e.message, 'error')), 700);
}

async function flushCoinDesc(index) {
  if (!S.skill) return;
  const all = Array.from({ length: coinDescCount(S.skill) }, (_, i) => {
    const ta = document.getElementById('coin-desc-' + i);
    return ta ? ta.value : coinDescOf(S.skill, i);
  });
  const res = await api('/api/skill/meta', { method: 'POST', body: { name: S.selected, id: S.skillId, coinDescs: all } });
  S.skill = { ...S.skill, coinDescs: res.meta.coinDescs || all };
  S.session = res.session;
  await analyzeAll();
  updateSkillDom(index);
}

async function checkText(text) {
  if (!text) return { tokens: [], unknown: [], game: '' };
  const res = await api('/api/description/check', { method: 'POST', body: { text } });
  return { tokens: res.tokens || [], unknown: res.unknown || [], game: res.game || '' };
}

async function analyzeAll() {
  if (!S.skill) return;
  const skillText = descTextOf(S.skill);
  const n = coinDescCount(S.skill);
  const [skillState, ...coinStates] = await Promise.all([
    checkText(skillText),
    ...Array.from({ length: n }, (_, i) => checkText(coinDescOf(S.skill, i))),
  ]);
  S.descChecks = { skill: skillState, coins: coinStates };
  S.descCheck = skillState;
}

function checkDesc() { return analyzeAll(); }

function scheduleInfo() {
  clearTimeout(infoTimer);
  infoTimer = setTimeout(() => flushInfo().catch((e) => toast(e.message, 'error')), 400);
}

async function flushInfo() {
  if (!S.skill) return;
  const card = $('.skill-info');
  if (!card) return;
  const info = {};
  $$('[data-info]', card).forEach((el) => {
    const k = el.dataset.info;
    info[k] = el.tagName === 'SELECT' ? el.value : Number(el.value);
  });
  const before = (S.skill.code?.coins || []).length;
  const res = await api('/api/skill/state', { method: 'POST', body: { name: S.selected, id: S.skillId, info } });
  S.skill = { ...S.skill, info: res.info, infoSource: 'file' };
  const total = Number(res.info.coinCount) || before;
  const coins = (S.skill.code?.coins || []).slice(0, total).map((c) => ({ ...c }));
  while (coins.length < total) coins.push({ color: 'GREY', value: 0, modules: [] });
  S.skill = { ...S.skill, code: { ...(S.skill.code || {}), coins } };
  S.session = res.session;
  updateSkillDom();
  if (coins.length !== before) render();
}

function updateSkillDom() {
  const sess = S.session || {};
  const hint = $('#session-state');
  if (hint) {
    hint.textContent = sess.dirty ? '有未保存改动' : '已保存';
    hint.className = 'session-state ' + (sess.dirty ? 'dirty' : '');
  }
  const undoBtn = $('[data-act="undo"]');
  const redoBtn = $('[data-act="redo"]');
  if (undoBtn) undoBtn.disabled = !(Number(sess.undo) > 0);
  if (redoBtn) redoBtn.disabled = !(Number(sess.redo) > 0);
  const prev = $('#desc-preview');
  if (prev && S.skill) prev.innerHTML = highlightText(descTextOf(S.skill), descStateOf('skill').tokens || []);
  const chk = $('#desc-check');
  if (chk) chk.innerHTML = descCheckHtml(descStateOf('skill'));
  const n = S.skill ? coinDescCount(S.skill) : 0;
  for (let i = 0; i < n; i += 1) {
    const pv = document.getElementById('coin-preview-' + i);
    if (pv) pv.innerHTML = highlightText(coinDescOf(S.skill, i), descStateOf('coin', i).tokens || []);
    const ck = document.getElementById('coin-check-' + i);
    if (ck) ck.innerHTML = descCheckHtml(descStateOf('coin', i));
  }
  const game = $('#game-text');
  if (game) {
    const all = [descStateOf('skill').game || '', ...Array.from({ length: n }, (_, i) => descStateOf('coin', i).game || '')].filter(Boolean);
    game.textContent = all.join('\n');
  }
  updateDock();
}

function placeModule(mid, zone, index) {
  if (zone === 'passive') return placeModuleSimple(mid, 'passive');
  if (zone === 'buff') return placeModuleSimple(mid, 'buff');
  if (!S.skill) { toast('请先选择一个技能', 'warn'); return; }
  const code = S.skill.code || (S.skill.code = { skill: [], coins: [] });
  if (zone === 'skill') {
    code.skill = code.skill || [];
    if (code.skill.includes(mid)) { toast('这个模块已经在技能区了', 'warn'); return; }
    code.skill.push(mid);
  } else {
    const c = (code.coins || [])[Number(index)];
    if (!c) return;
    c.modules = c.modules || [];
    if (c.modules.includes(mid)) { toast('这个模块已经在这枚硬币里了', 'warn'); return; }
    c.modules.push(mid);
  }
  toast('已置入：' + moduleName(mid), 'ok');
  saveCode().catch((e) => toast(e.message, 'error'));
}

function removePlaced(zone, index, mid) {
  if (zone === 'passive' || zone === 'buff') {
    const doc = zone === 'passive' ? S.passive : S.buff;
    if (!doc) return;
    doc.code = doc.code || { modules: [] };
    doc.code.modules = (doc.code.modules || []).filter((x) => x !== mid);
    saveSimpleCode(zone).catch((e) => toast(e.message, 'error'));
    return;
  }
  if (!S.skill) return;
  const code = S.skill.code || {};
  if (zone === 'skill') code.skill = (code.skill || []).filter((x) => x !== mid);
  else {
    const c = (code.coins || [])[Number(index)];
    if (c) c.modules = (c.modules || []).filter((x) => x !== mid);
  }
  saveCode().catch((e) => toast(e.message, 'error'));
}

async function saveCode() {
  if (!S.skill) return;
  const code = S.skill.code || {};
  const res = await api('/api/skill/code', {
    method: 'POST',
    body: { name: S.selected, id: S.skillId, code: { skill: code.skill || [], coins: code.coins || [] } },
  });
  S.skill = { ...S.skill, code: res.meta.code, info: res.meta.info };
  render();
}

async function saveCurrent() {
  if (S.editKind === 'passive' && S.passive) { await savePassiveCurrent(); return; }
  if (S.editKind === 'buff' && S.buff) { await saveBuffCurrent(); return; }
  if (S.editKind === 'skill' && S.skill) {
    await flushDesc();
    await checkDesc();
    const unknownAll = collectUnknown();
    if (unknownAll.length) { openRiskSave(unknownAll); return; }
    await commitSkill();
    return;
  }
  if (!S.personality) return;
  await flushPatch();
  const res = await api('/api/personality/save', { method: 'POST', body: { name: S.selected, id: S.personalityId } });
  S.session = res.session;
  S.pReadonly = false;
  toast('已保存，撤销历史已清空', 'ok');
  await loadPersonalities(S.selected);
  await loadPersonality(S.selected, S.personalityId);
  render();
}

async function commitSkill() {
  const res = await api('/api/skill/save', { method: 'POST', body: { name: S.selected, id: S.skillId } });
  S.session = res.session;
  const applied = await api('/api/skill/apply', { method: 'POST', body: { name: S.selected, id: S.skillId } });
  toast('已保存并写入游戏文件（' + (applied.applied || 0) + ' 条脚本' + ((applied.missing || []).length ? '，缺 ' + applied.missing.length + ' 个模块' : '') + '）', 'ok');
  render();
}

function collectUnknown() {
  const out = [];
  const ds = S.descChecks || {};
  (ds.skill && ds.skill.unknown ? ds.skill.unknown : []).forEach((u) => out.push({ where: '技能描述', word: u }));
  (ds.coins || []).forEach((c, i) => (c && c.unknown ? c.unknown : []).forEach((u) => out.push({ where: '硬币 ' + (i + 1) + ' 描述', word: u })));
  return out;
}

function openRiskSave(items) {
  const unk = items || collectUnknown();
  modal({
    title: '保存检查',
    body: '<p><strong>有错误的关键词输入，请检查拼写。</strong></p>'
      + '<div class="person-list">' + unk.map((u) => '<div class="check-row"><span class="kw-bad">[' + esc(u.word) + ']</span><small>' + esc(u.where) + ' · 未在时点表 / Buff 表中找到</small></div>').join('') + '</div>'
      + '<div class="hint muted">无视风险保存后，未命中的关键词不做翻译处理，游戏内会按原文显示。</div>',
    footer: '<button class="btn ghost" data-act="close-modal">返回修改</button><button class="btn warn" data-act="risk-save-skill">无视风险保存</button>',
  });
}

async function riskSave() {
  closeModal();
  await commitSkill();
}

async function doUndo() {
  if (!S.selected || !S.sessionKey) return;
  try {
    await api('/api/undo', { method: 'POST', body: { name: S.selected, key: S.sessionKey } });
    if (S.editKind === 'skill' && S.skill) await reloadSkill();
    else if (S.editKind === 'passive' && S.passive) await reloadPassive();
    else if (S.editKind === 'buff' && S.buff) await reloadBuff();
    else if (S.personality) await loadPersonality(S.selected, S.personalityId);
    toast('已撤销', 'info');
    render();
  } catch (e) { toast(e.message, 'error'); }
}

async function doRedo() {
  if (!S.selected || !S.sessionKey) return;
  try {
    await api('/api/redo', { method: 'POST', body: { name: S.selected, key: S.sessionKey } });
    if (S.editKind === 'skill' && S.skill) await reloadSkill();
    else if (S.editKind === 'passive' && S.passive) await reloadPassive();
    else if (S.editKind === 'buff' && S.buff) await reloadBuff();
    else if (S.personality) await loadPersonality(S.selected, S.personalityId);
    toast('已重做', 'info');
    render();
  } catch (e) { toast(e.message, 'error'); }
}

function openCreateSkill() {
  modal({
    title: '新建技能',
    body: '<div class="form">'
      + '<label class="field"><span>技能 id（必填，编辑器会与游戏内全部技能查重）</span><input id="ns-id" placeholder="例如 2090111" autocomplete="off"></label>'
      + '<label class="field"><span>技能名（显示名）</span><input id="ns-name" placeholder="例如 灼热斩击" autocomplete="off"></label>'
      + '<div class="hint muted">写入 ' + esc(S.selected || '') + ' 的 custom_limbus_data/skill 与 custom_limbus_locale/EN/skillList。要修改原版技能请用「导入」而不是新建同 id 技能。</div>'
      + '</div>',
    footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="submit-create-skill">创建</button>',
  });
}

async function submitCreateSkill() {
  const id = ($('#ns-id')?.value || '').trim();
  const displayName = ($('#ns-name')?.value || '').trim();
  if (!id) { toast('请填写技能 id', 'warn'); return; }
  const res = await api('/api/skill/create', { method: 'POST', body: { name: S.selected, id, displayName } });
  closeModal();
  toast('技能 ' + id + ' 已创建', 'ok');
  await loadSkillList();
  await openSkill(id);
}

async function openImportSkill() {
  if (!S.vanilla?.characters) { try { await loadVanilla(1); } catch { /* ignore */ } }
  S.imp = { kind: 'vanilla', characterId: 1, personalityId: '', mod: '', personalities: [], skills: [] };
  modal({
    title: '导入技能',
    wide: true,
    body: '<div class="tabs import-tabs">'
      + '<button class="tab active" data-act="import-kind" data-kind="vanilla" id="imp-tab-vanilla">从原版人格导入</button>'
      + '<button class="tab" data-act="import-kind" data-kind="mod" id="imp-tab-mod">从自定义文件导入</button>'
      + '</div><div id="import-body">加载中…</div>',
    footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="submit-import-skill">导入所选</button>',
  });
  renderImportBody();
  await loadImportPersonalities(1);
}

function renderImportBody() {
  const imp = S.imp;
  const el = $('#import-body');
  if (!imp || !el) return;
  if (imp.kind === 'vanilla') {
    const chars = (S.vanilla?.characters || []).filter((c) => Number(c.id) >= 1 && Number(c.id) <= 12);
    el.innerHTML = '<div class="grid-2">'
      + '<label class="field"><span>罪人</span><select id="imp-sinner">'
      + chars.map((c) => '<option value="' + c.id + '"' + (Number(imp.characterId) === Number(c.id) ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('')
      + '</select></label><label class="field"><span>人格</span><select id="imp-personality">'
      + ((imp.personalities || []).map((p) => '<option value="' + esc(p.id) + '"' + (String(imp.personalityId) === String(p.id) ? ' selected' : '') + '>' + esc(p.name || p.id) + '</option>').join('') || '<option value="">（先选罪人）</option>')
      + '</select></label></div><div class="person-list">'
      + ((imp.skills || []).map((sk) => '<label class="check-row"><input type="checkbox" data-import-id="' + esc(sk.id) + '"><strong>' + esc(sk.name || sk.id) + '</strong><small>' + esc(sk.id) + '</small></label>').join('') || '<div class="list-empty">没有可选技能</div>')
      + '</div><div class="hint muted">原版技能导入后保持原 id，在游戏中会覆盖原版技能。</div>';
  } else {
    const others = (S.mods || []).filter((m) => m.name !== S.selected);
    el.innerHTML = '<label class="field"><span>来源 Mod</span><select id="imp-mod">'
      + (others.map((m) => '<option value="' + esc(m.name) + '"' + (imp.mod === m.name ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') || '<option value="">（没有其他 Mod）</option>')
      + '</select></label><div class="person-list">'
      + ((imp.skills || []).map((sk) => '<label class="check-row"><input type="checkbox" data-import-id="' + esc(sk.id) + '"><strong>' + esc(sk.name || sk.id) + '</strong><small>' + esc(sk.id) + (sk.override ? ' · 原版覆盖' : '') + '</small></label>').join('') || '<div class="list-empty">没有可选技能</div>')
      + '</div><div class="hint muted">从其他 Mod 复制技能实体与本地化条目；id 保持不变。</div>';
  }
  const tv = $('#imp-tab-vanilla');
  const tm = $('#imp-tab-mod');
  if (tv) tv.className = 'tab' + (imp.kind === 'vanilla' ? ' active' : '');
  if (tm) tm.className = 'tab' + (imp.kind === 'mod' ? ' active' : '');
}

async function loadImportPersonalities(characterId) {
  const res = await api('/api/vanilla?characterId=' + encodeURIComponent(characterId));
  S.imp.characterId = Number(characterId);
  S.imp.personalities = res.personalities || [];
  S.imp.personalityId = S.imp.personalities[0]?.id || '';
  renderImportBody();
  if (S.imp.personalityId) await loadImportSkillsVanilla(S.imp.personalityId);
}

async function loadImportSkillsVanilla(personalityId) {
  const res = await api('/api/vanilla-skills?personalityId=' + encodeURIComponent(personalityId));
  S.imp.personalityId = String(personalityId);
  S.imp.skills = res.skills || [];
  renderImportBody();
}

async function loadImportSkillsMod(mod) {
  if (!mod) { S.imp.skills = []; renderImportBody(); return; }
  const res = await api('/api/skills?name=' + encodeURIComponent(mod));
  S.imp.mod = mod;
  S.imp.skills = res.skills || [];
  renderImportBody();
}

async function submitImportSkill() {
  const ids = $$('[data-import-id]').filter((el) => el.checked).map((el) => el.dataset.importId);
  if (!ids.length) { toast('请先勾选要导入的技能', 'warn'); return; }
  const src = { kind: S.imp.kind, mod: S.imp.kind === 'mod' ? S.imp.mod : undefined };
  if (S.imp.kind === 'vanilla' && !(await confirmOverwrite(ids))) return;
  const res = await api('/api/skill/import', { method: 'POST', body: { name: S.selected, ids, source: src } });
  closeModal();
  toast('已导入 ' + (res.imported?.length || ids.length) + ' 个技能', 'ok');
  await loadSkillList();
  const first = res.imported && res.imported[0];
  if (first) await openSkill(first);
}

function confirmOverwrite(ids) {
  return new Promise((resolve) => {
    const m = modal({
      title: '覆盖原版技能',
      body: '<p>以下技能会以原 id 写入当前 Mod，游戏内将<strong>覆盖原版技能</strong>：</p><div class="person-list">'
        + ids.map((id) => '<div class="check-row"><strong>' + esc(id) + '</strong></div>').join('') + '</div>'
        + '<div class="hint muted">导入不改变原版 id。</div>',
      footer: '<button class="btn ghost" data-act="cancel-import">取消</button><button class="btn primary" data-act="confirm-import">确认导入</button>',
    });
    void m;
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.dataset.act === 'confirm-import') { closeModal(); resolve(true); }
      else if (el.dataset.act === 'cancel-import' || el.dataset.act === 'close-modal') { closeModal(); resolve(false); }
    }, { once: false });
  });
}

document.addEventListener('change', (e) => {
  const t = e.target;
  if (!S.imp || !t.id) return;
  if (t.id === 'imp-sinner') { S.imp.characterId = Number(t.value); loadImportPersonalities(Number(t.value)).catch((err) => toast(err.message, 'error')); }
  else if (t.id === 'imp-personality') { S.imp.personalityId = t.value; loadImportSkillsVanilla(t.value).catch((err) => toast(err.message, 'error')); }
  else if (t.id === 'imp-mod') { S.imp.mod = t.value; loadImportSkillsMod(t.value).catch((err) => toast(err.message, 'error')); }
});
/* ====================== v0.4 模块 / 被动 / Buff 编辑 ====================== */

Object.assign(S, {
  modulesLoaded: false,
  moduleEditing: null,
  moduleSearch2: '',
  passives: [], passive: null, passiveId: null, passiveTab: 'code', passiveSearch: '',
  passiveDefaults: null, pDescCheck: null,
  buffs: [], buff: null, buffId: null, buffTab: 'code', buffSearch: '',
  buffDefaults: null, bDescCheck: null,
});

async function loadModules(force = false) {
  if (S.modulesLoaded && !force) return;
  const res = await api('/api/modules');
  S.modules = res.modules || [];
  S.modulesLoaded = true;
  try {
    const u = await api('/api/module/usage');
    S.moduleUsage = u.usage || {};
  } catch { S.moduleUsage = {}; }
}

async function loadPassiveList(name = S.selected) {
  if (!name) return;
  const res = await api('/api/passives?name=' + encodeURIComponent(name));
  S.passives = res.passives || [];
  S.modules = res.modules || [];
  S.passiveDefaults = res.defaults || S.passiveDefaults;
  S.modulesLoaded = true;
}

async function loadBuffList(name = S.selected) {
  if (!name) return;
  const res = await api('/api/buffs?name=' + encodeURIComponent(name));
  S.buffs = res.buffs || [];
  S.modules = res.modules || [];
  S.buffDefaults = res.defaults || S.buffDefaults;
  S.modulesLoaded = true;
}

function pNormalizePassive(passive) {
  if (!passive) return passive;
  const info = { ...(passive.info || {}) };
  const cond = passive.conditions || {};
  const stock = Array.isArray(info.stockConditions) ? info.stockConditions : [];
  const reso = Array.isArray(info.resonanceConditions) ? info.resonanceConditions : [];
  if (!stock.length && !reso.length) {
    if (Array.isArray(cond.stock) && cond.stock.length) {
      info.conditionMode = 'stock';
      info.stockConditions = cond.stock.map((c) => ({ type: String(c.type || 'CRIMSON'), value: Number(c.value) || 1 }));
    } else if (Array.isArray(cond.resonance) && cond.resonance.length) {
      info.conditionMode = 'resonance';
      info.resonanceConditions = cond.resonance.slice(0, 1).map((c) => ({ type: String(c.type || 'CRIMSON'), value: Number(c.value) || 1 }));
    }
  }
  if (!['none', 'stock', 'resonance'].includes(info.conditionMode)) info.conditionMode = 'none';
  info.stockConditions = Array.isArray(info.stockConditions) ? info.stockConditions : [];
  info.resonanceConditions = Array.isArray(info.resonanceConditions) ? info.resonanceConditions : [];
  return { ...passive, info };
}

async function openPassive(id) {
  const res = await api('/api/passive?name=' + encodeURIComponent(S.selected) + '&id=' + encodeURIComponent(id));
  S.passive = pNormalizePassive(res.passive);
  S.passiveId = String(id);
  S.sessionKey = 'passive:' + id;
  S.pDescCheck = null;
  await refreshSession(S.selected);
  await checkPDesc();
  render();
}

async function reloadPassive() {
  if (!S.selected || !S.passiveId) return;
  const res = await api('/api/passive?name=' + encodeURIComponent(S.selected) + '&id=' + encodeURIComponent(S.passiveId));
  S.passive = pNormalizePassive(res.passive);
  await refreshSession(S.selected);
  await checkPDesc();
}

function pNormalizeBuff(buff) {
  if (!buff) return buff;
  const out = { ...buff };
  const fi = out.fileInfo || null;
  if (fi) {
    out.info = Object.assign({}, out.info || {}, {
      buffClass: fi.buffClass || (out.info || {}).buffClass,
      buffType: fi.buffType || (out.info || {}).buffType,
      canBeDespelled: fi.canBeDespelled !== false,
      maxStack: fi.maxStack == null ? (out.info || {}).maxStack : fi.maxStack,
      maxTurn: fi.maxTurn == null ? (out.info || {}).maxTurn : fi.maxTurn,
      iconId: fi.iconId || (out.info || {}).iconId || '',
    });
    out.infoSource = 'file';
  }
  if (!String(out.description || '') && out.localeDesc) {
    out.description = out.localeDesc;
    out.descriptionSource = 'locale';
  }
  return out;
}

async function openBuff(id) {
  const res = await api('/api/buff?name=' + encodeURIComponent(S.selected) + '&id=' + encodeURIComponent(id));
  S.buff = pNormalizeBuff(res.buff);
  S.buffScripts = null;
  S.buffId = String(id);
  S.sessionKey = 'buff:' + id;
  S.bDescCheck = null;
  await refreshSession(S.selected);
  await checkBDesc();
  render();
}

async function reloadBuff() {
  S.buffExtras = null;
  if (!S.selected || !S.buffId) return;
  const res = await api('/api/buff?name=' + encodeURIComponent(S.selected) + '&id=' + encodeURIComponent(S.buffId));
  S.buff = pNormalizeBuff(res.buff);
  S.buffScripts = null;
  await refreshSession(S.selected);
  await checkBDesc();
}

function filteredModules2() {
  const q = (S.moduleSearch2 || '').trim().toLowerCase();
  return (S.modules || []).filter((m) => !q
    || String(m.description || '').toLowerCase().includes(q)
    || String(m.name || '').toLowerCase().includes(q)
    || String(m.id || '').toLowerCase().includes(q));
}

function renderModulePanel(searchId, value) {
  const mods = filteredModules2().map((m) => '<div class="module-item" data-module="' + esc(m.id) + '">'
    + '<div class="m-head"><span class="tag ' + (m.test ? 'warn' : '') + '">' + (m.test ? '测试' : '模块') + '</span><strong>' + esc(m.name || m.id) + '</strong></div>'
    + '<p class="m-desc">' + esc(m.description || '') + '</p></div>').join('');
  return '<section class="panel module-list"><div class="panel-head">模块列表 <span class="count">' + (S.modules || []).length + '</span></div>'
    + '<div class="panel-search"><input id="' + searchId + '" class="search" placeholder="搜索 [命中时] / 描述" value="' + esc(value) + '"></div>'
    + '<div class="panel-body mods">' + (mods || '<div class="list-empty">没有模块</div>') + '</div>'
    + '<div class="panel-foot"><span class="hint muted">模块由「模块编辑」制作；测试模块仅供拖拽演示，不产生实际效果</span></div></section>';
}

/* ------------------------------ 模块编辑 ------------------------------ */

function renderModuleArea(back) {
  if (S.moduleEditing && S.mb && S.mbDoc) return renderModuleEditor(back);
  const scopes = (S.scopeTables && S.scopeTables.list) || [];
  const scopeLabel = (id) => {
    const hit = scopes.find((x) => x.id === (id || 'common'));
    return hit ? hit.zh : (id || '通用');
  };
  const rows = (S.modules || []).map((m) => '<div class="module-row' + (m.test ? ' test' : '') + '">'
    + '<button class="mod-open" data-act="open-module" data-id="' + esc(m.id) + '">'
    + '<span class="mod-name">' + esc(m.name || m.id) + '</span>'
    + '<span class="mod-meta"><span class="tag">' + esc(scopeLabel(m.scope)) + '</span>'
    + (m.test ? '<span class="tag warn">测试</span>' : '')
    + '<span class="muted">' + (m.blockCount || 0) + ' 块</span>'
    + (S.moduleUsage && S.moduleUsage[m.id] ? '<span class="tag ok" title="被技能/被动/Buff 引用">被引用 ' + S.moduleUsage[m.id] + '</span>' : '')
    + '</span></button>'
    + '<button class="mod-gear" data-act="mb-props" data-id="' + esc(m.id) + '" title="模块信息 / 删除">⚙</button>'
    + '</div>').join('');
  const count = (S.modules || []).length;
  return '<div class="pane-head">' + back + '<div><h2>模块编辑</h2><p class="muted">积木式脚本 · 由技能 / 被动 / Buff 引用</p></div></div>'
    + '<div class="module-wrap"><section class="panel"><div class="panel-head">模块 <span class="count">' + count + '</span></div>'
    + '<div class="panel-body list module-list">' + (rows || '<div class="list-empty">还没有模块</div>') + '</div>'
    + '<div class="panel-foot"><button class="btn ghost block" data-act="new-module">＋ 新建</button></div></section></div>';
}

async function openModuleProps(id) {
  const mid = String(id || (S.mbDoc && S.mbDoc.id) || '');
  if (!mid) return;
  let m = (S.modules || []).find((x) => x.id === mid) || null;
  if (!m) {
    const d = await api('/api/module?id=' + encodeURIComponent(mid));
    m = d.module;
  }
  const scopes = (S.scopeTables && S.scopeTables.list) || [{ id: 'common', zh: '通用', desc: '' }];
  const ro = m.test ? ' disabled' : '';
  modal({
    title: '模块信息',
    body: '<div class="form">'
      + '<label class="field"><span>模块名称</span><input id="mp-name" value="' + esc(m.name || '') + '"' + ro + '></label>'
      + '<label class="field"><span>用途</span><select id="mp-scope"' + ro + '>' + scopes.map((k) => '<option value="' + esc(k.id) + '"' + (String(k.id) === String(m.scope || 'common') ? ' selected' : '') + '>' + esc(k.zh) + (k.desc ? ' · ' + esc(k.desc) : '') + '</option>').join('') + '</select></label>'
      + '<label class="field"><span>描述（可执行词条）</span><textarea id="mp-desc" rows="4" class="desc-input">' + esc(m.desc || '') + '</textarea></label>'
      + '<div class="hint muted">模块 id：' + esc(m.id) + ' · 积木 ' + (m.blockCount || 0) + ' 块</div>'
      + '</div>',
    footer: '<button class="btn ghost" data-act="close-modal">关闭</button>'
      + (m.test ? '<button class="btn danger" data-act="mb-props-delete" data-id="' + esc(m.id) + '" data-test="1">删除测试模块</button>' : '<button class="btn danger" data-act="mb-props-delete" data-id="' + esc(m.id) + '">删除模块</button><button class="btn ok" data-act="mb-props-save" data-id="' + esc(m.id) + '">保存</button>'),
  });
}

/* ============================ 模块积木编辑器（Scratch 式） ============================ */

const MB_TARGETS = [
  // 单目标（教程「目标参数 / 单目标」）
  { n: 'Self', zh: '自身', g: 'single' },
  { n: 'SelfCore', zh: '自身核心（部位取其本体）', g: 'single' },
  { n: 'Target', zh: '当前目标', g: 'single' },
  { n: 'TargetCore', zh: '当前目标的核心', g: 'single' },
  { n: 'MainTarget', zh: '主目标', g: 'single' },
  { n: 'Victim', zh: '受害者', g: 'single' },
  { n: 'Killer', zh: '击杀者', g: 'single' },
  { n: 'adjLeft', zh: '左侧相邻单位', g: 'single' },
  { n: 'adjRight', zh: '右侧相邻单位', g: 'single' },
  // 多目标
  { n: 'EveryTarget', zh: '所有目标', g: 'multi' },
  { n: 'SubTarget', zh: '副目标（技能命中列表）', g: 'multi' },
  { n: 'EveryAlly', zh: '所有友方', g: 'multi' },
  { n: 'EveryEnemy', zh: '所有敌方', g: 'multi' },
  { n: 'EveryCoreAlly', zh: '所有友方（含本体）', g: 'multi' },
  { n: 'EveryCoreEnemy', zh: '所有敌方（含本体）', g: 'multi' },
  { n: 'EveryAbnoCoreAlly', zh: '所有友方异想体', g: 'multi' },
  { n: 'EveryAbnoCoreEnemy', zh: '所有敌方异想体', g: 'multi' },
  { n: 'All', zh: '所有上场单位', g: 'multi' },
  { n: 'SkillTargets', zh: '本技能的目标列表', g: 'multi' },
  { n: 'SkillSubTargets', zh: '本技能的副目标列表', g: 'multi' },
  // 修饰标签（用 + 连接到基础选择器后）
  { n: 'Ally', zh: '仅友方', g: 'tag' },
  { n: 'Enemy', zh: '仅敌方', g: 'tag' },
  { n: 'NoAbnos', zh: '排除异想体', g: 'tag' },
  { n: 'AbnoOnly', zh: '只要异想体', g: 'tag' },
  { n: 'NoCores', zh: '排除核心', g: 'tag' },
  { n: 'NoParts', zh: '排除部位', g: 'tag' },
  { n: 'Assist', zh: '包含支援单位', g: 'tag' },
  { n: 'ExceptSelf', zh: '排除自身', g: 'tag' },
  { n: 'ExceptTarget', zh: '排除当前目标', g: 'tag' },
  { n: 'Random', zh: '随机排序', g: 'tag' },
  { n: 'Deploy', zh: '按上场顺序排序', g: 'tag' },
  { n: 'Reversedeploy', zh: '按登场逆序排序', g: 'tag' },
  { n: 'Slowest', zh: '最慢优先', g: 'tag' },
  { n: 'Fastest', zh: '最快优先', g: 'tag' },
  { n: 'HighestHPRatio', zh: 'HP 比例最高优先', g: 'tag' },
  { n: 'LowestHPRatio', zh: 'HP 比例最低优先', g: 'tag' },
  { n: 'HighestHP', zh: 'HP 最高优先', g: 'tag' },
  { n: 'LowestHP', zh: 'HP 最低优先', g: 'tag' },
  { n: 'HighestMaxHP', zh: '最大 HP 最高优先', g: 'tag' },
  { n: 'LowestMaxHP', zh: '最大 HP 最低优先', g: 'tag' },
  { n: 'HighestMP', zh: 'SP 最高优先', g: 'tag' },
  { n: 'LowestMP', zh: 'SP 最低优先', g: 'tag' },
  { n: 'Deads', zh: '只取已阵亡单位', g: 'tag' },
  { n: 'Retreats', zh: '只取已撤退单位', g: 'tag' },
];
const MB_TARGET_TAGS = MB_TARGETS.filter((t) => t.g === 'tag');
const MB_TAG_SET = new Set(MB_TARGET_TAGS.map((t) => t.n));
const MB_TYPE_ZH = { target: '目标', buff: 'Buff 关键词', num: '整数', var: 'VALUE 寄存器', op: '运算符', text: '文本', any: '任意' };
// 常见函数的参数类型（下标从 0 起）；未列出的按文档关键词推断
const MB_ARG_OVERRIDES = {
  'consequence:buff': ['target', 'buff', 'num', 'num', 'num', 'text'],
  'consequence:healhp': ['target', 'num'],
  'consequence:healsp': ['target', 'num'],
  'consequence:gainshield': ['target', 'num'],
  'consequence:consume-buff': ['target', 'buff', 'num'],
  'consequence:modify-power': ['target', 'num'],
  'consequence:modify-damage': ['target', 'num'],
  'consequence:scale': ['num', 'op', 'num'],
  'consequence:base': ['num'],
  'consequence:final': ['num'],
  'consequence:clash': ['num'],
  'consequence:dmgadd': ['num'],
  'consequence:skillreuse': ['target'],
  'consequence:insertskill': ['target', 'text'],
  'consequence:setmaxhp': ['target', 'num'],
  'consequence:changecolor': ['target', 'text', 'text', 'text'],
  'acquirer:getbuff': ['target', 'buff', 'text', 'text', 'text'],
  'acquirer:getbuffcount': ['target', 'buff'],
  'acquirer:resource': ['num', 'num', 'num'],
  'acquirer:gbturn': ['target', 'buff'],
  'acquirer:stack': ['target', 'buff'],
  'acquirer:turn': ['target', 'buff'],
  'acquirer:getskillid': [],
  'acquirer:gbstack': ['text'],
};

function mbArgType(kind, name, i) {
  const ov = MB_ARG_OVERRIDES[kind + ':' + name];
  if (ov && ov[i]) return ov[i];
  const row = (S.mbTables || []).find((r) => r.kind === kind && r.name === name);
  const doc = row && row.params && row.params[i] ? String(row.params[i].doc || '') : '';
  if (/目标|多目标/.test(doc)) return 'target';
  if (/[Bb]uff\s*关键词|关键词/.test(doc)) return 'buff';
  if (/\bADD\b|\bSUB\b|\bMUL\b/.test(doc)) return 'op';
  if (/\buse\b|文本|名称|字符串/.test(doc)) return 'text';
  if (/整数|数值|数量|层数|强度|回合|倍率|%/.test(doc)) return 'num';
  return 'any';
}

function mbValueType(node) {
  if (!node) return 'empty';
  if (node.t === 'target') return 'target';
  if (node.t === 'var') return 'var';
  if (node.t === 'n') return 'num';
  if (node.t === 's') return 'text';
  if (node.t === 'acq') return 'acq';
  if (node.t === 'math') return 'num';
  return 'any';
}

function mbCompatible(slotType, valueType) {
  const t = slotType || 'any';
  if (t === 'any') return true;
  if (t === 'num') return valueType === 'num' || valueType === 'var' || valueType === 'acq';
  if (t === 'target') return valueType === 'target';
  if (t === 'buff') return valueType === 'text' || valueType === 'any';
  if (t === 'op') return valueType === 'text';
  if (t === 'text') return valueType === 'text' || valueType === 'num';
  return true;
}

const MB_VARS = Array.from({ length: 10 }, (_, i) => 'VALUE_' + i);
const MB_MATH_OPS = [['+', '加 +'], ['-', '减 -'], ['*', '乘 *'], ['%', '除 %'], ['!', '取小 !'], ['¡', '取大 ¡'], ['?', '取余 ?']];

function mbTargetZh(n) { return (MB_TARGETS.find((t) => t.n === n) || {}).zh || n; }
function mbTargetLabel(v) {
  if (!v) return '';
  const c = v.c === null || v.c === undefined || v.c === '' ? '' : String(v.c);
  const parts = String(v.n || '').split('+');
  const label = parts.map((x) => mbTargetZh(x) || x).join(' + ');
  return label + (c ? ' × ' + c : '');
}

async function loadModularTables() {
  if (S.mbTablesReady) return S.mbTables;
  const res = await api('/api/modular-tables');
  S.mbTables = res.rows || [];
  S.mbTablesReady = true;
  return S.mbTables;
}

function mbRows(kind) { return (S.mbTables || []).filter((r) => r.kind === kind); }

async function ensureScopes() {
  if (S.scopeTables) return S.scopeTables;
  try {
    const res = await api('/api/scopes');
    S.scopeTables = { list: res.scopes || [], timing: res.timingContainers || {}, command: res.commandContainers || {}, timingScope: res.timingScope || {}, commandScope: res.commandScope || {} };
  } catch (e) {
    S.scopeTables = { list: [{ id: 'common', zh: '通用' }], timing: {}, command: {} };
  }
  return S.scopeTables;
}

function curScope() {
  return (S.mbDoc && S.mbDoc.scope) || 'common';
}

function scopeAllowsOne(map, key) {
  const set = map ? map[String(key)] : undefined;
  if (!set || !set.length) return true;
  const has = (k) => set.includes(k) || set.includes("unit");
  const scope = curScope();
  if (scope === "common") return ["buff", "passive", "skill"].every(has);
  return has(scope);
}

function scopeAllowsTiming(en) {
  return scopeAllowsOne(S.scopeTables && S.scopeTables.timing, en);
}

function scopeAllowsCommand(name) {
  return scopeAllowsOne(S.scopeTables && S.scopeTables.command, name);
}

function scopeZhOf(id) {
  const one = (S.scopeTables && S.scopeTables.list ? S.scopeTables.list : []).find((x) => x.id === id);
  return one ? one.zh : '通用';
}

async function openModuleEditor(id) {
  await ensureScopes();
  await ensureKeywords();
  const res = await api('/api/module?id=' + encodeURIComponent(id));
  await loadModularTables();
  const doc = res.module;
  S.moduleEditing = id;
  S.mbDoc = doc;
  S.mb = {
    program: { version: 1, blocks: mbMigrateLegacy(mbNestFlat(doc.program && Array.isArray(doc.program.blocks) ? doc.program.blocks : [])) }, sel: null,
    search: '', cat: 'timing', carry: null, drag: null, showProps: false, showScript: false,
    showMissing: false, missingIds: null,
    hist: [], redo: [], savedAt: doc.updatedAt || '', forceSave: false,
  };
  render();
}

/* ---------------- 取路径 ---------------- */

function selCls(idStr) {
  return S.mb && S.mb.sel === idStr ? ' sel' : '';
}

function mbDeepHost(list) {
  let host = null;
  let cur = list;
  while (cur && cur.length) {
    const last = cur[cur.length - 1];
    if (!last || (last.k !== 'timing' && last.k !== 'loop')) break;
    host = last;
    cur = last.body;
  }
  return host;
}

function mbMigrateLegacy(list) {
  const out = [];
  for (const raw of list || []) {
    if (!raw) continue;
    const b = raw;
    if (b.k === 'loop') {
      const host = out.length ? out[out.length - 1] : null;
      const body = Array.isArray(b.body) ? mbMigrateLegacy(b.body) : [];
      if (host && host.k === 'timing') {
        host.loop = { t: 'target', n: String(b.v || 'Target'), c: null };
        host.body = (host.body || []).concat(body);
      } else if (body.length) {
        out.push(...body);
      }
      continue;
    }
    if (b.k === 'if' || b.k === 'ifnot' || b.k === 'continueif') {
      if (!Array.isArray(b.conds) || !b.conds.length) b.conds = [{ left: b.left || null, op: b.op || '>', right: b.right || null }];
      delete b.left; delete b.right; delete b.op;
      if (!['none', 'and', 'or', 'xor'].includes(b.logic)) b.logic = 'none';
    }
    if (Array.isArray(b.body)) b.body = mbMigrateLegacy(b.body);
    out.push(b);
  }
  return out;
}
function mbNestFlat(list) {
  const out = [];
  for (const raw of list || []) {
    const b = JSON.parse(JSON.stringify(raw));
    if (b.k === 'timing') {
      b.body = mbNestFlat(Array.isArray(b.body) ? b.body : []);
      out.push(b);
      continue;
    }
    if (b.k === 'loop' || b.k === 'if') {
      b.body = mbNestFlat(Array.isArray(b.body) ? b.body : []);
      const h = mbDeepHost(out);
      if (h) h.body.push(b); else out.push(b);
      continue;
    }
    const host = mbDeepHost(out);
    if (host) host.body.push(b); else out.push(b);
  }
  return out;
}

function mbBackspace() {
  const sel = S.mb && S.mb.sel;
  if (!sel) return;
  const p = String(sel).split('.').map(Number);
  const parent = mbStackAt(p.slice(0, -1));
  if (!parent || !parent[p[p.length - 1]]) { S.mb.sel = null; render(); return; }
  if (p.length === 1) {
    parent.splice(p[0], 1);
    S.mb.sel = null;
    render();
    toast('\u5df2\u5220\u9664\u8be5\u4ee3\u7801\u5757', 'warn');
    return;
  }
  const node = parent.splice(p[p.length - 1], 1)[0];
  const hatPath = p.slice(0, -2);
  const hatIdx = p[p.length - 2];
  const hatStack = mbStackAt(hatPath);
  if (!hatStack) { render(); return; }
  hatStack.splice(hatIdx + 1, 0, node);
  S.mb.sel = (hatPath.length ? hatPath.join('.') + '.' : '') + (hatIdx + 1);
  render();
  toast('\u5df2\u53d6\u6d88\u4e00\u7ea7\u7f29\u8fdb', 'info');
}

function mbStackAt(pathArr) {
  let list = S.mb.program.blocks;
  for (const idx of pathArr) {
    const node = list && list[idx];
    if (!node) return null;
    if (!Array.isArray(node.body)) {
      if (node.k === 'if' || node.k === 'timing' || node.k === 'loop') node.body = [];
      else return null;
    }
    list = node.body;
  }
  return list;
}
function mbStmt(idStr) {
  const p = String(idStr || '').split('.').filter((x) => x !== '').map(Number);
  if (!p.length) return null;
  return mbStackAt(p.slice(0, -1))?.[p[p.length - 1]] || null;
}

/* ---------------- 渲染 ---------------- */

function mbValHtml(v, chain, slotType, opt) {
  const st = slotType || 'any';
  const stAttr = ' data-slot-type="' + esc(st) + '" title="' + esc((MB_TYPE_ZH[st] || MB_TYPE_ZH.any) + (opt ? ' · 可选参数，可留空' : '')) + '"';
  if (!v) return '<span class="slot' + (opt ? ' slot-opt' : ' slot-req') + ' slot-t-' + esc(st) + '"' + stAttr + ' data-mb-empty="1" data-mb-slot="' + esc(chain) + '"><i><b class="' + (opt ? 'slot-flag-opt">可选' : 'slot-flag-req">必填') + '</b>' + esc(MB_TYPE_ZH[st] || '.') + '</i></span>';
  const inner = (() => {
    if (v.t === 'target') return esc(mbTargetLabel(v));
    if (v.t === 'var') return esc(v.n);
    if (v.t === 'n') return esc(String(v.v));
    if (v.t === 's') return '"' + esc(String(v.v)) + '"';
    if (v.t === 'acq') {
      const args = (v.a || []).map((x, i) => mbArgHtml(x, chain + '>' + i, mbArgType('acquirer', v.n, i), 'acquirer', v.n, i)).join('<span class="vb-comma">,</span>');
      return esc(v.n) + '(' + args + ')';
    }
    if (v.t === 'math') {
      let html = '<span class="vb-math-op">math(</span>' + mbValHtml(v.first, chain + '>f', 'num');
      for (let i = 0; i < (v.tail || []).length; i++) {
        const t = v.tail[i];
        html += '<select class="mb-mathop" data-mb-mathop="' + esc(chain) + '" data-mb-idx="' + i + '">'
          + MB_MATH_OPS.map(([o, label]) => '<option value="' + o + '"' + (o === (t.op || '+') ? ' selected' : '') + '>' + esc(label) + '</option>').join('')
          + '</select>' + mbValHtml(t.val, chain + '>t' + i, 'num');
      }
      html += '<span class="vb-math-op">)</span>'
        + '<button class="vb-edit" data-mb-mathadd="' + esc(chain) + '" title="加一项">＋</button>'
        + '<button class="vb-edit" data-mb-mathdel="' + esc(chain) + '" title="去掉最后一项">－</button>';
      return html;
    }
    return esc(JSON.stringify(v));
  })();
  const edit = v.t === 'n' ? '<button class="vb-edit" data-mb-edit="' + esc(chain) + '" title="修改数字">✎</button>' : '';
  const vt = mbValueType(v);
  return '<span class="vb vb-' + esc(v.t) + ' vb-t-' + esc(vt) + '" data-chain="' + esc(chain) + '" data-mb-slot="' + esc(chain) + '"' + stAttr + '>' + inner + edit + '</span>';
}

function mbCondsOf(b) {
  if (b && Array.isArray(b.conds) && b.conds.length) return b.conds;
  if (b && (b.left !== undefined || b.right !== undefined)) return [{ left: b.left || null, op: b.op || '>', right: b.right || null }];
  return [{ left: null, op: '>', right: null }];
}

function mbIfHint(logic) {
  if (logic === 'and') return '所有条件都成立，才执行下方积木';
  if (logic === 'or') return '任意一个条件成立，就执行下方积木';
  if (logic === 'xor') return 'XOR 的引擎实现较特殊：2 个条件时只看第 2 个；3 个以上要求后续条件与第 2 个结果一致。建议改用 AND / OR，或拆成两条 IF';
  return '只判断这一个条件';
}

function mbCondRow(c, idStr, i, total) {
  const op = (c && c.op) || '>';
  const opHtml = ['>', '<', '='].map((o) => '<option value="' + o + '"' + (o === op ? ' selected' : '') + '>' + (o === '>' ? '&gt;' : o === '<' ? '&lt;' : '=') + '</option>').join('');
  return '<div class="if-cond">'
    + mbValHtml(c && c.left, idStr + ':c' + i + ':left', 'num')
    + '<select class="mb-op" data-mb-op="' + esc(idStr) + ':c' + i + '">' + opHtml + '</select>'
    + mbValHtml(c && c.right, idStr + ':c' + i + ':right', 'num')
    + '<span class="if-cond-idx">条件 ' + (i + 1) + '</span>'
    + (total > 1 ? '<button class="if-cond-x" data-act="mb-cond-del" data-chain="' + esc(idStr) + ':' + i + '" title="删除这条条件">×</button>' : '')
    + '</div>';
}

function mbStmtHtml(b, idStr) {
  if (!b) return '';
  if (b.k === 'timing') {
    const t = (S.keywords?.timings || []).find((x) => x.en === b.v || String(x.id) === String(b.v));
    const zh = t?.zh || b.v;
    const args = (S.keywords && S.keywords.timingArgs && S.keywords.timingArgs[b.v]) || [];
    const sel = (attr, cur, opts) => '<select class="mb-hat-sel" ' + attr + '="' + esc(idStr) + '">'
      + opts.map(([v, label]) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>').join('')
      + '</select>';
    let argHtml = '';
    if (args.includes('face')) argHtml += sel('data-mb-face', b.face || 'None', [['None', '不限面'], ['Head', '正面'], ['Tail', '反面']]);
    if (args.includes('crit')) argHtml += sel('data-mb-crit', b.crit || 'None', [['None', '不限暴击'], ['Crit', '暴击'], ['NoCrit', '非暴击']]);
    if (args.includes('keyword')) argHtml += '<input class="mb-hat-sel" data-mb-kw="' + esc(idStr) + '" list="mb-kw-list" placeholder="关键词" value="' + esc(b.kw || '') + '">';
    if (args.includes('key')) argHtml += '<input class="mb-hat-sel" data-mb-key="' + esc(idStr) + '" list="mb-key-list" placeholder="按键" value="' + esc(b.key || '') + '">';
    const kids = (b.body || []).map((x, i) => mbStmtHtml(x, idStr + '.' + i)).join('');
    const loopNode = b.loop && (b.loop.t === 'target' || b.loop.v) ? b.loop : null;
    const loopLabel = loopNode ? (mbTargetLabel(loopNode) + (loopNode.c ? ' · 数量 ' + loopNode.c : '')) : '无';
    const locked = mbIsLocked(idStr);
    return '<div class="bk hat bk-timing' + selCls(idStr) + (locked ? ' locked' : '') + '" data-mb-bk="' + esc(idStr) + '"' + (locked ? ' title="这一行已被手动改写：积木已锁定，只能整块移动或删除"' : '') + '>' + mbDotHtml(idStr)
      + (locked ? '<span class="bk-lock" title="已被手改锁定">🔒</span>' : '')
      + '<div class="bk-hat-head"><span class="bk-hat-ico">⚑</span><span class="bk-hat-name">' + esc(zh) + '</span>'
      + '<span class="mb-loop-wrap"><span class="mb-loop-label">遍历</span>'
      + '<button class="mb-loop-slot' + (loopNode ? ' on' : '') + '" data-act="mb-loop-slot" data-mb-loop="' + esc(idStr) + ':loop" data-chain="' + esc(idStr) + ':loop" title="本行整段脚本的 Target 会被逐个替换（引擎的 LOOP 是整条脚本级）；点一下清空">' + esc(loopLabel) + '</button></span>'
      + '<span class="bk-tag">TIMING</span></div>'
      + (argHtml ? '<div class="mb-hat-args">' + argHtml + '</div>' : '')
      + '<div class="bk-body" data-stack="' + esc(idStr) + '">' + (kids || '<div class="mb-stack-empty">把积木拖到这里（与此时点同属一段代码）</div>') + '</div></div>';
  }
  if (b.k === 'if' || b.k === 'ifnot') {
    const isNot = b.k === 'ifnot';
    const logic = ['none', 'and', 'or', 'xor'].includes(b.logic) ? b.logic : 'none';
    const conds = mbCondsOf(b);
    const logicSel = '<select class="mb-logic" data-mb-logic="' + esc(idStr) + '">'
      + [['none', '无'], ['and', 'AND'], ['or', 'OR'], ['xor', 'XOR']].map(([v, l]) => '<option value="' + v + '"' + (v === logic ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
    const rows = conds.map((c, i) => mbCondRow(c, idStr, i, conds.length)).join('');
    const add = (logic !== 'none' && conds.length < 8) ? '<button class="btn ghost sm if-add" data-act="mb-cond-add" data-chain="' + esc(idStr) + '">＋ 条件</button>' : '';
    const kids = (b.body || []).map((x, i) => mbStmtHtml(x, idStr + '.' + i)).join('') || '<div class="mb-stack-empty">拖动效果函数到这里</div>';
    return '<div class="bk bk-if' + (isNot ? ' bk-ifnot' : '') + selCls(idStr) + '" data-mb-bk="' + esc(idStr) + '">' + mbDotHtml(idStr)
      + '<div class="bk-if-head"><span class="bk-if-label">' + (isNot ? '如果不' : '如果') + '</span>' + logicSel
      + '<span class="bk-tag">' + (isNot ? 'IFNOT' : 'IF') + '</span></div>'
      + '<div class="bk-if-conds">' + rows + add + '</div>'
      + '<div class="bk-if-hint">' + esc(mbIfHint(logic)) + '</div>'
      + '<div class="bk-body" data-stack="' + esc(idStr) + '">' + kids + '</div></div>';
  }
  if (b.k === 'continueif') {
    const logic = ['none', 'and', 'or', 'xor'].includes(b.logic) ? b.logic : 'none';
    const conds = mbCondsOf(b);
    const logicSel = '<select class="mb-logic" data-mb-logic="' + esc(idStr) + '">'
      + [['none', '无'], ['and', 'AND'], ['or', 'OR'], ['xor', 'XOR']].map(([v, l]) => '<option value="' + v + '"' + (v === logic ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
    const rows = conds.map((c, i) => mbCondRow(c, idStr, i, conds.length)).join('');
    const add = (logic !== 'none' && conds.length < 8) ? '<button class="btn ghost sm if-add" data-act="mb-cond-add" data-chain="' + esc(idStr) + '">＋ 条件</button>' : '';
    return '<div class="bk bk-if bk-continueif' + selCls(idStr) + '" data-mb-bk="' + esc(idStr) + '">' + mbDotHtml(idStr)
      + '<div class="bk-if-head"><span class="bk-if-label">继续如果</span>' + logicSel + '<span class="bk-tag">CONTINUEIF</span></div>'
      + '<div class="bk-if-conds">' + rows + add + '</div>'
      + '<div class="bk-if-hint">条件不成立时停止本条脚本的后续指令；有遍历时跳到下一个目标</div></div>';
  }
  if (b.k === 'assign') {
    const vars = MB_VARS.map((v) => '<option value="' + v + '"' + (v === (b.var || 'VALUE_0') ? ' selected' : '') + '>' + v + '</option>').join('');
    return '<div class="bk bk-assign' + selCls(idStr) + '" data-mb-bk="' + esc(idStr) + '">' + mbDotHtml(idStr)
      + '<span class="bk-name">把</span><select class="mb-var" data-mb-var="' + esc(idStr) + '">' + vars + '</select>'
      + '<span class="bk-name">设为</span>' + mbValHtml(b.val, idStr + ':val', 'num')
      + '<span class="bk-tag">SET</span></div>';
  }
  const row = (S.mbTables || []).find((r) => r.kind === 'consequence' && r.name === b.n);
  const label = row ? row.summary || b.n : b.n;
  const argsHtml = (b.a || []).map((v, i) => mbArgHtml(v, idStr + ':a:' + i, mbArgType('consequence', b.n, i), 'consequence', b.n, i)).join('<span class="vb-comma">,</span>');
  return '<div class="bk bk-cons' + selCls(idStr) + '" data-mb-bk="' + esc(idStr) + '" title="' + esc(label) + '">' + mbDotHtml(idStr)
    + '<span class="bk-name">' + esc(b.n) + '</span><span class="bk-paren">(</span>' + argsHtml + '<span class="bk-paren">)</span>'
    + '</div>';
}

function mbStackHtml(pathId) {
  const list = mbStackAt(pathId === 'root' ? [] : pathId.split('.').map(Number));
  if (!list) return '';
  return list.map((x, i) => mbStmtHtml(x, (pathId === 'root' ? '' : pathId + '.') + i)).join('');
}

function mbPaletteHtml() {
  const q = (S.mb.search || '').trim().toLowerCase();
  const cat = S.mb.cat;
  const chips = { timing: '时点', target: '目标', action: '效果', acq: '获取', cond: 'IF', var: 'VALUE', buff: 'Buff' };
  const tabs = Object.entries(chips).map(([k, label]) => '<button class="mb-cat' + (cat === k ? ' active' : '') + '" data-act="mb-cat" data-cat="' + k + '">' + label + '</button>').join('');
  let items = [];
  const match = (s) => !q || String(s || '').toLowerCase().includes(q);
  if (cat === 'timing') {
    items = (S.keywords?.timings || []).filter((t) => scopeAllowsTiming(t.en) && (match(t.en) || match(t.zh)))
      .map((t) => '<button class="mb-item mi-timing" data-mb-drag="stmt" data-mb-kind="timing" data-mb-val="' + esc(t.en) + '"><b>' + esc(t.zh || t.en) + '</b><small>' + esc(t.en) + '</small></button>');
  } else if (cat === 'target') {
    const groups = [['single', '单目标'], ['multi', '多目标'], ['tag', '修饰标签（可多选，用 + 连接）']];
    for (const [g, label] of groups) {
      const rows = MB_TARGETS.filter((t) => t.g === g && (match(t.n) || match(t.zh)));
      if (!rows.length) continue;
      items.push('<div class="mb-group">' + label + '</div>');
      for (const t of rows) {
        items.push('<button class="mb-item mi-target" data-mb-drag="value" data-mb-kind="target" data-mb-val="' + esc(t.n) + '"><b>' + esc(t.zh) + '</b><small>' + esc(t.n) + '</small></button>');
      }
    }
    items.push('<button class="mb-item mi-target" data-act="mb-custom-target"><b>自定义目标…</b><small>基础选择器 + 排序 / 队伍 / 排除 / 数量</small></button>');
    const lt = S.mb.loopTarget;
    const ltHtml = lt ? esc(mbTargetLabel(lt)) : '<i><b class="slot-flag-req">必填</b>目标</i>';
    items.unshift('<div class="mb-item mi-loop' + (lt ? ' has-target' : '') + '" data-mb-drag="value" data-mb-kind="loop" role="button" tabindex="0">'
      + '<div class="mi-loop-head"><b>遍历（自定义目标）</b><small>拖到时点右侧「遍历」槽 · 目标拖进下面空位</small></div>'
      + '<span class="slot slot-req slot-loop-card" data-mb-slot="palette:loop" title="拖一个目标积木到这里">' + ltHtml + '</span></div>');
  } else if (cat === 'var') {
    items = MB_VARS.filter((v) => match(v))
      .map((v) => '<button class="mb-item mi-var" data-mb-drag="value" data-mb-kind="var" data-mb-val="' + esc(v) + '"><b>' + esc(v) + '</b><small>通用数值寄存器</small></button>');
    items.unshift('<button class="mb-item mi-math" data-mb-drag="value" data-mb-kind="math"><b>运算 math( )</b><small>加减乘除 / 取小取大取余</small></button>');
    items.unshift('<button class="mb-item mi-assign" data-mb-drag="stmt" data-mb-kind="assign"><b>赋值：VALUE_x 设为 …</b><small>把结果存进寄存器</small></button>');
    items.push('<button class="mb-item mi-var" data-mb-drag="value" data-mb-kind="s" data-mb-val=""><b>文本</b><small>放进去后再点文字修改</small></button>');
  } else if (cat === 'action') {
    items = mbRows('consequence').filter((r) => scopeAllowsCommand(r.name) && (match(r.name) || match(r.summary) || (r.aliasOf || []).some((a) => match(a))))
      .map((r) => '<button class="mb-item mi-cons" data-mb-drag="stmt" data-mb-kind="cons" data-mb-val="' + esc(r.name) + '"><b>' + esc(r.name) + '</b><small>' + esc((r.summary || '（英文原文档未收录说明）') + ((r.aliasOf && r.aliasOf.length) ? '（旧称：' + r.aliasOf.join(' / ') + '）' : '')) + '</small></button>');
  } else if (cat === 'cond') {
    items = [];
    if (match('if') || match('如果') || match('条件')) items.push('<button class="mb-item mi-cond" data-mb-drag="stmt" data-mb-kind="if"><b>如果 … 则</b><small>IF(条件)：成立时执行里面的块</small></button>');
    if (match('ifnot') || match('如果否') || match('条件')) items.push('<button class="mb-item mi-cond" data-mb-drag="stmt" data-mb-kind="ifnot"><b>如果 … 则不</b><small>IFNOT(条件)：不成立时执行里面的块</small></button>');
    if (match('continueif') || match('继续') || match('条件')) items.push('<button class="mb-item mi-cond" data-mb-drag="stmt" data-mb-kind="continueif"><b>继续如果</b><small>CONTINUEIF(条件)：不成立时停止本条脚本后续指令</small></button>');
  } else if (cat === 'buff') {
    const all = (S.keywords?.buffs || []).flatMap((b) => (Array.isArray(b.ids) ? b.ids : [b.id]).map((id) => ({ id: String(id || ''), zh: b.zh || '', native: b.native || '', source: b.source || 'vanilla', mod: b.mod || '', panic: !!b.panic, icon: b.icon || null })));
    const infoOf = new Map();
    for (const b of S.keywords?.buffs || []) for (const id of (Array.isArray(b.ids) ? b.ids : [b.id])) if (id && !infoOf.has(String(id))) infoOf.set(String(id), b);
    const seen = new Set();
    const uniq = all.filter((b) => { if (!b.id || b.panic || seen.has(b.id)) return false; seen.add(b.id); return true; });
    const iconHtml = (b) => b.icon
      ? '<img class="mb-bicon" loading="lazy" alt="" src="/api/sprite?mod=' + encodeURIComponent(b.icon.mod) + '&file=' + encodeURIComponent(b.icon.file) + '&t=' + encodeURIComponent(window.__WB_TOKEN__ || '') + '">'
      : '<span class="mb-bicon ph">' + esc(String(b.zh || b.native || b.id || '?').slice(0, 1)) + '</span>';
    const pick = (b) => '<button class="mb-item mi-buff" data-mb-drag="value" data-mb-kind="s" data-mb-val="' + esc(b.id) + '" title="' + esc(b.id + ' · ' + buffOwnerTag(b.id, b.mod, b.source)) + '">' + iconHtml(b) + '<span class="mb-btxt"><b>' + esc(b.zh || b.native || b.id) + '</b><small>' + esc(b.id + ' · ' + buffOwnerTag(b.id, b.mod, b.source)) + '</small></span></button>';
    const vis = uniq.filter((b) => match(b.id) || match(b.zh) || match(b.native));

    const fold = (label, list, open) => list.length
      ? '<details class="mb-fold"' + (open ? ' open' : '') + '><summary>' + label + '（' + list.length + '）</summary>' + list.map(pick).join('') + '</details>'
      : '';
    const modOrder = (S.mods || []).map((m) => m.name);
    const cmpName = (a, b) => String(a.zh || a.native || a.id).localeCompare(String(b.zh || b.native || b.id), 'zh');
    const modIdx = (name) => { const i = modOrder.indexOf(name); return i < 0 ? 9999 : i; };
    const custom = [];
    const seenCustom = new Set();
    for (const grp of S.keywords?.modBuffs || []) {
      for (const id of grp.ids || []) {
        const key = String(id || '');
        if (!key || seenCustom.has(key)) continue;
        const info = infoOf.get(key) || {};
        if (info.panic && !S.mb.showPanic) continue;
        if (!(match(key) || match(info.zh) || match(info.native))) continue;
        seenCustom.add(key);
        custom.push({ id: key, zh: info.zh || '', native: info.native || '', mod: grp.mod, icon: info.icon || null, panic: !!info.panic });
      }
    }
    custom.sort((a, b) => {
      const sa = a.mod === S.selected ? 0 : 1; const sb = b.mod === S.selected ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const byMod = modIdx(a.mod) - modIdx(b.mod);
      return byMod || cmpName(a, b);
    });
    const customIds = new Set(custom.map((b) => b.id));
    const vanilla = vis.filter((b) => !customIds.has(b.id) && b.source !== 'mod' && !(S.keywords?.buffOwners || []).some((o) => o.id === b.id));
    items = [fold('自定义Buff', custom.map((b) => ({ ...b, source: 'mod' })), true), fold('原版 Buff', vanilla, false)];
    if (!custom.length && !vanilla.length) items = ['<div class="mb-empty2">没有匹配的 Buff</div>'];
  } else {
    items = mbRows('acquirer').filter((r) => r.name !== 'math' && scopeAllowsCommand(r.name) && (match(r.name) || match(r.summary) || (r.aliasOf || []).some((a) => match(a))))
      .map((r) => '<button class="mb-item mi-acq" data-mb-drag="value" data-mb-kind="acq" data-mb-val="' + esc(r.name) + '"><b>' + esc(r.name) + '()</b><small>' + esc((r.summary || '（英文原文档未收录说明）') + ((r.aliasOf && r.aliasOf.length) ? '（旧称：' + r.aliasOf.join(' / ') + '）' : '')) + '</small></button>');
  }
  const carry = S.mb.carry ? '<div class="mb-carry">拿着：' + (S.mb.carry.type === 'value' ? '数值块' : '语句块') + ' · 点击画布或空位放下（Esc 取消）</div>' : '';
  return '<div class="mb-pal-body">'
    + '<nav class="mb-cats" aria-label="积木分类">' + tabs + '</nav>'
    + '<div class="mb-pal-main"><div class="mb-legend">金色=必填参数；灰色虚线=可选（可留空，游戏按默认处理）</div>'
    + '<div class="mb-pal-head"><input id="mb-search" class="search" placeholder="搜索函数 / 时点" value="' + esc(S.mb.search) + '"></div>' + carry
    + '<div class="mb-items" id="mb-items">' + (items.join('') || '<div class="mb-empty2">没有匹配项</div>') + '</div>'
    + '</div></div>';
}

function mbToolbarHtml() {
  const m = S.mbDoc || {};
  return '<div class="pane-head mb-h"><div class="mb-crumb"><button class="btn ghost sm" data-act="close-module">← 返回</button>'
    + '<h2>' + esc(m.name || m.id) + '</h2>'
    + '<span class="tag">用途：' + esc(scopeZhOf(m.scope || 'common')) + '</span>'
    + (m.test ? '<span class="tag warn">测试模块 · 只读</span>' : '')
    + '</div><span class="spacer"></span>'
    + '<button class="btn ghost sm" data-act="mb-code">查看输出代码</button>'
    + '<button class="btn ghost sm" data-act="mb-undo"' + ((S.mb.hist || []).length ? '' : ' disabled') + ' title="撤销 (Ctrl+Z)">↶ 撤销</button>'
    + '<button class="btn ghost sm" data-act="mb-redo"' + ((S.mb.redo || []).length ? '' : ' disabled') + ' title="重做 (Ctrl+Y)">↷ 重做</button>'
    + '<button class="btn ghost sm" data-act="mb-clear">清空</button>'
    + '<button class="btn primary sm" data-act="mb-save"' + (m.test ? ' disabled' : '') + '>保存模块</button></div>';
}

function mbPropsHtml() {
  const m = S.mbDoc || {};
  const timings = S.keywords?.timings || [];
  const scopes = (S.scopeTables && S.scopeTables.list) || [{ id: 'common', zh: '通用', desc: '' }];
  const opts = timings.map((t) => '<option value="' + esc(t.en) + '"' + (t.en === m.prefix ? ' selected' : '') + '>' + esc((t.zh ? t.zh + ' · ' : '') + t.en) + '</option>').join('');
  return '<div class="mb-props"><label class="field"><span>名称</span><input id="mb-name" value="' + esc(m.name || '') + '"></label>'
    + '<label class="field"><span>前缀（时点）</span><select id="mb-prefix"><option value="">（未指定）</option>' + opts + '</select></label>'
    + '<label class="field"><span>用途</span><select id="mod-scope">' + scopes.map((k) => '<option value="' + esc(k.id) + '"' + (k.id === (m.scope || 'common') ? ' selected' : '') + '>' + esc(k.zh) + (k.desc ? ' · ' + esc(k.desc) : '') + '</option>').join('') + '</select></label>'
    + '<label class="field"><span>描述（可执行词条）</span><textarea id="mb-desc" rows="3" class="desc-input">' + esc(m.desc || '') + '</textarea></label></div>';
}

/** 兼容旧名：返回 { list, ids }（缺模块状态时安全返回空） */
function mbPendingMissing() {
  try { return mbMissingInfo(); } catch (e) { return { list: [], ids: new Set() }; }
}

function mbMissingInfo() {
  const list = [];
  const ids = new Set();
  const push = (idStr, text) => { list.push(text); if (idStr !== null && idStr !== undefined && idStr !== '') ids.add(String(idStr)); };
  const checkVal = (v, idStr) => {
    if (!v || !v.a) return;
    for (let k = 0; k < v.a.length; k++) { if (!v.a[k] && !mbArgOptional('acquirer', v.n, k)) push(idStr, v.n + ' 第 ' + (k + 1) + ' 个参数'); }
  };
  const walk = (blocks, prefix) => {
    (blocks || []).forEach((b, i) => {
      if (!b) return;
      const idStr = prefix ? prefix + '.' + i : String(i);
      if (b.k === 'cons') {
        for (let k = 0; k < (b.a || []).length; k++) {
          const v = b.a[k];
          if (!v && !mbArgOptional('consequence', b.n, k)) push(idStr, b.n + ' 第 ' + (k + 1) + ' 个参数');
          else if (v && v.t === 'acq') checkVal(v, idStr);
        }
      }
      if (b.k === 'if' || b.k === 'ifnot' || b.k === 'continueif') {
        (b.conds || []).forEach((c, ci) => {
          if (!c || !c.left) push(idStr, '第 ' + (ci + 1) + ' 个条件的左侧');
          if (!c || !c.right) push(idStr, '第 ' + (ci + 1) + ' 个条件的右侧');
        });
      }
      if (b.k === 'assign' && !b.val) push(idStr, '赋值的结果值');
      if (b.body) walk(b.body, idStr);
    });
  };
  walk((S.mb && S.mb.program && S.mb.program.blocks) || [], '');
  return { list, ids };
}
function mbDotHtml(idStr) {
  const ids = S.mb && S.mb.missingIds;
  if (!ids || !ids.size) return '';
  if (!ids.has(String(idStr))) return '';
  return '<i class="bk-dot" title="该控件未填写必填参数，很可能无法正确执行"></i>';
}
let mbFlashTimer = 0;
function mbFlashMissing() {
  const stage = document.getElementById('mb-stage') || document;
  const slots = Array.from(stage.querySelectorAll('.slot[data-mb-empty="1"]:not(.slot-opt)'));
  if (mbFlashTimer) { clearTimeout(mbFlashTimer); mbFlashTimer = 0; }
  for (const el of slots) el.classList.remove('flash');
  void (stage.offsetWidth || 0);
  for (const el of slots) el.classList.add('flash');
  mbFlashTimer = setTimeout(() => { for (const el of slots) el.classList.remove('flash'); mbFlashTimer = 0; }, 1600);
}

const MB_HIST_MAX = 80;
function mbSnapshot() {
  if (!S.mb) return;
  const now = JSON.stringify(S.mb.program);
  S.mb.hist = S.mb.hist || [];
  const top = S.mb.hist.length ? S.mb.hist[S.mb.hist.length - 1] : null;
  if (top === now) return;
  S.mb.hist.push(now);
  if (S.mb.hist.length > MB_HIST_MAX) S.mb.hist.shift();
  S.mb.redo = [];
}
function mbUndo() {
  if (!S.mb) return;
  if (!S.mb.hist || !S.mb.hist.length) { toast('没有可撤销的操作', 'warn'); return; }
  S.mb.redo = S.mb.redo || [];
  S.mb.redo.push(JSON.stringify(S.mb.program));
  S.mb.program = JSON.parse(S.mb.hist.pop());
  S.mb.sel = null;
  render();
  toast('已撤销');
}
function mbRedo() {
  if (!S.mb) return;
  if (!S.mb.redo || !S.mb.redo.length) { toast('没有可重做的操作', 'warn'); return; }
  S.mb.hist = S.mb.hist || [];
  S.mb.hist.push(JSON.stringify(S.mb.program));
  S.mb.program = JSON.parse(S.mb.redo.pop());
  S.mb.sel = null;
  render();
  toast('已重做');
}
function mbLoopRowCount() {
  return ((S.mb && S.mb.program && S.mb.program.blocks) || []).filter((b) => b && b.k === 'timing' && b.loop && b.loop.n).length;
}

/* 底部状态检查（文档 17 第 12 条）：孤儿块 / 空壳 / 多循环 / 多时点 / 必填未填。只读，不改 S.mb。 */
function mbStatusInfo() {
  const blocks = (((S.mb && S.mb.program && S.mb.program.blocks) || [])).filter(Boolean);
  const bad = [];
  const stray = blocks.filter((b) => b.k !== 'timing');
  if (stray.length) bad.push(`${stray.length} 个块在时点外（不会写进脚本）`);
  const emptyTiming = blocks.filter((b) => b.k === 'timing' && !((b.body || []).length));
  if (emptyTiming.length) bad.push(`${emptyTiming.length} 个时点没有内容`);
  const loopNoN = blocks.filter((b) => b.k === 'timing' && b.loop && (b.loop.t === 'target' || b.loop.v) && !b.loop.n);
  if (loopNoN.length) bad.push(`${loopNoN.length} 行设了遍历但没填次数`);
  const loopRows = mbLoopRowCount();
  if (loopRows > 1) bad.push(`${loopRows} 行设了遍历（LOOP 模块级，只有最后一段生效）`);
  const hatKey = (b) => String(b.v) + '(' + [b.face, b.crit, b.kw, b.key]
    .map((x) => (x === undefined || x === null ? '' : String(x))).join(',') + ')';
  const seen = new Map();
  blocks.filter((b) => b.k === 'timing').forEach((b) => { const k = hatKey(b); seen.set(k, (seen.get(k) || 0) + 1); });
  const dups = [...seen.entries()].filter(([, n]) => n > 1);
  if (dups.length) bad.push(`${dups.reduce((a, [, n]) => a + n, 0)} 行落在 ${dups.length} 个重复时点`);
  let missing = 0;
  try { missing = (mbMissingInfo().list || []).length; } catch { missing = 0; }
  if (missing) bad.push(`${missing} 处必填未填`);
  return { bad, missing, loopRows, dups };
}

function mbStatusHtml() {
  const info = mbStatusInfo();
  if (!info.bad.length) {
    return '<div class="mb-status" id="mb-status"><span class="mb-dot ok"></span><span>状态检查：未发现结构问题</span></div>';
  }
  return '<div class="mb-status warn" id="mb-status"><span class="mb-dot bad"></span><span>状态检查：' + esc(info.bad.join(' · ')) + '</span></div>';
}

/** 只改参数（不整页重绘）的路径要单独刷新状态行 */
function refreshMbStatus() {
  const box = document.getElementById('mb-status');
  if (!box) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = mbStatusHtml();
  const next = tmp.firstElementChild;
  if (next) box.replaceWith(next);
}

function mbCompileRows() {
  const val = (v, nested) => {
    if (!v) return '_';
    if (v.t === 'target') {
      const tn = String(v.n || '');
      const cnt = v.c === null || v.c === undefined || v.c === '' ? '' : String(v.c);
      if (!cnt) return tn;
      const k = tn.indexOf('$');
      return k < 0 ? tn + cnt : tn.slice(0, k) + cnt + tn.slice(k);
    }
    if (v.t === 'var') return v.n;
    if (v.t === 'n') return String(v.v);
    if (v.t === 's') return String(v.v);
    if (v.t === 'acq') {
      const list = (v.a || []).map((x) => (x ? val(x, true) : ''));
      while (list.length && (list[list.length - 1] === '' || list[list.length - 1] === '_')) list.pop();
      return nested ? 'G' + v.n + '{' + list.join('-') + '}' : v.n + '(' + list.join(',') + ')';
    }
    if (v.t === 'math') {
      const head = v.first ? val(v.first, true) : '0';
      const rest = (v.tail || []).map((t) => (t.op || '+') + (t.val ? val(t.val, true) : '0')).join('');
      return 'math(' + head + rest + ')';
    }
    return '_';
  };
  const logicOf = (b) => (['and', 'or', 'xor'].includes(b.logic) ? b.logic : 'none');
  const condText = (c) => (c && c.left ? val(c.left, true) : 'VALUE_0') + ((c && c.op) || '>') + (c && c.right ? val(c.right, true) : 'VALUE_0');
  const condsText = (b) => {
    const list = Array.isArray(b.conds) && b.conds.length ? b.conds : [{ left: b.left, op: b.op, right: b.right }];
    const head = logicOf(b) === 'none' ? '' : logicOf(b).toUpperCase() + ',';
    return head + list.map(condText).join(',');
  };
  const stmt = (b) => {
    if (!b) return '';
    if (b.k === 'cons') {
      const list = (b.a || []).map((x) => (x ? val(x, true) : ''));
      while (list.length && (list[list.length - 1] === '' || list[list.length - 1] === '_')) list.pop();
      return b.n + '(' + list.join(',') + ')';
    }
    if (b.k === 'assign') return (b.var || 'VALUE_0') + ':' + val(b.val);
    if (b.k === 'if' || b.k === 'ifnot') {
      const kw = b.k === 'ifnot' ? 'IFNOT' : 'IF';
      const kids = (b.body || []).map(stmt).filter(Boolean).join(':');
      return kw + '(' + condsText(b) + ')' + (kids ? ':' + kids : '');
    }
    if (b.k === 'continueif') return 'CONTINUEIF(' + condsText(b) + ')';
    return '';
  };
  const hatText = (b) => {
    const args = (S.keywords && S.keywords.timingArgs && S.keywords.timingArgs[b.v]) || [];
    const parts = [];
    if (args.includes('face') || args.includes('crit')) {
      parts.push(args.includes('face') ? (b.face || 'None') : 'None');
      parts.push(args.includes('crit') ? (b.crit || 'None') : 'None');
    }
    if (args.includes('keyword') && b.kw) parts.push(b.kw);
    if (args.includes('key') && b.key) parts.push(b.key);
    const nonEmpty = parts.filter((x) => x && x !== 'None').length > 0;
    return 'TIMING:' + b.v + (nonEmpty ? '(' + parts.join(',') + ')' : '');
  };
  const groups = [];
  const blocks = (S.mb.program && S.mb.program.blocks) || [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    if (!b) continue;
    if (b.k === 'timing') { groups.push({ key: String(bi), hat: b, items: (b.body || []).slice() }); continue; }
    if (!groups.length) groups.push({ key: null, hat: null, items: [] });
    groups[groups.length - 1].items.push(b);
  }
  const manual = (S.mb.program && S.mb.program.manual) || {};
  const out = [];
  for (const r of groups) {
    const override = r.key !== null && manual[r.key] !== undefined ? String(manual[r.key]) : '';
    if (override) { out.push({ key: r.key, text: override, manual: true }); continue; }
    const parts = [];
    if (r.hat) {
      parts.push(hatText(r.hat));
      if (r.hat.loop && r.hat.loop.n) parts.push('LOOP:' + val(r.hat.loop, true));
    }
    for (const it of r.items) { const t = stmt(it); if (t) parts.push(t); }
    if (!parts.length) continue;
    out.push({ key: r.key, text: 'Modular/' + parts.join('/'), manual: false });
  }
  return out;
}

/** 兼容旧调用：把每行脚本用换行拼起来（每行都是一条完整脚本） */
function mbCompileScript() {
  const rows = mbCompileRows();
  return rows.length ? rows.map((r) => r.text).join('\n') : '// 还没有积木';
}

/** 该行（根层时点块）是否已被手改锁定 */
function mbIsLocked(idStr) {
  const key = String(idStr || '');
  if (!/^\d+$/.test(key)) return false;
  const manual = (S.mb && S.mb.program && S.mb.program.manual) || {};
  return manual[key] !== undefined && manual[key] !== '';
}

function mbLockRow(key) {
  const row = mbCompileRows().find((r) => String(r.key) === String(key));
  if (!row) return;
  mbSnapshot();
  const manual = { ...(S.mb.program.manual || {}) };
  manual[String(key)] = row.text;
  S.mb.program = { ...S.mb.program, manual };
  render();
  toast('这一行已改为手改模式，对应积木已锁定', 'warn');
}

async function saveModuleProgram(quiet) {
  const info = mbMissingInfo();
  let res = null;
  const body = { id: S.moduleEditing, program: S.mb.program, expectUpdatedAt: S.mb.savedAt || '', force: !!S.mb.forceSave };
  try { res = await api('/api/module/program', { method: 'POST', body }); }
  catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (/已被修改/.test(msg) && !S.mb.forceSave) {
      if (!confirm('模块文件在磁盘上已被修改（可能别的窗口/别的程序动过）。要用当前画布覆盖吗？')) return false;
      S.mb.forceSave = true;
      return saveModuleProgram(quiet);
    }
    toast(msg, 'bad');
    return false;
  }
  S.mb.forceSave = false;
  S.mb.savedAt = (res.module && res.module.updatedAt) || '';
  S.mb.saved = JSON.stringify(S.mb.program);
  S.mb.hist = [];
  S.mb.redo = [];
  S.modules = (await api('/api/modules')).modules;
  if (!quiet) {
    if (info.list.length) {
      S.mb.showMissing = true;
      toast('已保存；有 ' + info.list.length + ' 处必填参数未填，可能无法正确执行', 'warn');
      mbFlashMissing();
    } else {
      S.mb.showMissing = false;
      toast('模块已保存', 'ok');
    }
  }
  render();
  return true;
}

function renderMbCodePage() {
  const rows = mbCompileRows();
  const manual = (S.mb.program && S.mb.program.manual) || {};
  const body = rows.map((r, i) => {
    const key = r.key === null || r.key === undefined ? '' : String(r.key);
    const locked = key !== '' && manual[key] !== undefined;
    return '<div class="code-row">'
      + '<div class="code-row-head"><span class="code-row-idx">第 ' + (i + 1) + ' 行</span>'
      + (locked
        ? '<span class="tag warn">已手改 · 积木已锁定</span>'
        : '<button class="btn ghost sm" data-act="mb-code-lock" data-key="' + esc(key) + '">手动修改</button>')
      + '</div>'
      + '<textarea class="code-text" data-key="' + esc(key) + '" rows="2" spellcheck="false"' + (locked ? '' : ' readonly') + '>' + esc(r.text) + '</textarea>'
      + '</div>';
  }).join('') || '<div class="list-empty">还没有积木</div>';
  return '<div class="pane-head mb-h"><div class="mb-crumb"><button class="btn ghost sm" data-act="mb-code-back">← 返回积木</button><h2>输出代码</h2></div><span class="spacer"></span>'
    + '<button class="btn primary sm" data-act="mb-code-save">保存代码</button></div>'
    + '<div class="code-page"><div class="code-hint">每行是一条独立脚本（可直接核对游戏里看到的样子）。点「手动修改」后该行对应的时点积木会被锁定，只能在积木页整块移动或删除。</div>'
    + body + '</div>';
}

function renderModuleEditor(back) {
  if (S.mb && S.mb.codePage) return renderMbCodePage();
  return renderModuleEditorInner(back);
}

function renderModuleEditorInner(back) {
  if (!S.mb || !S.mbDoc) {
    return '<div class="pane-head">' + back + '<div><h2>模块编辑</h2></div></div><div class="mb-loading">正在载入模块…</div>';
  }
  if (S.mb && S.mb.saved === undefined) S.mb.saved = JSON.stringify(S.mb.program);
  S.mb.missingIds = S.mb.showMissing ? mbMissingInfo().ids : null;
  const kwList = (S.keywords?.buffs || []).map((b) => String(b.id || (b.ids && b.ids[0]) || '')).filter(Boolean);
  const keyList = ['LeftControl', 'LeftShift', 'LeftAlt', 'Space', 'Tab', 'E', 'Q', 'R', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
  const datalists = '<datalist id="mb-kw-list">' + kwList.map((k) => '<option value="' + esc(k) + '">').join('') + '</datalist>'
    + '<datalist id="mb-key-list">' + keyList.map((k) => '<option value="' + k + '">').join('') + '</datalist>';
  const script = S.mb.showScript ? '<pre class="mb-script" id="mb-script">' + esc(mbCompileScript()) + '</pre>' : '';
  const loopRows = mbLoopRowCount();
  const loopWarn = loopRows > 1
    ? '<div class="mb-warn">有 ' + loopRows + ' 行都设置了遍历：引擎的 LOOP 是模块级字段，同一模块只会应用最后一段，请只保留一行。</div>'
    : '';
  return mbToolbarHtml() + loopWarn
    + (S.mb.showProps ? mbPropsHtml() : '')
    + '<div class="mb-body"><aside class="mb-pal">' + mbPaletteHtml() + '</aside>'
    + '<section class="mb-stage"><div class="mb-stage-head"><span>积木画布</span><span class="muted">从上到下拼接；带括号的块可以往括号里拖数值块</span></div>'
    + '<div class="mb-canvas" id="mb-canvas"><div class="mb-stack" data-stack="root">' + mbStackHtml('root') + '</div>'
    + (S.mb.program.blocks.length ? '' : '<div class="mb-empty">拖一个「时点」积木进来开始</div>') + '</div>' + '<div class="mb-trash" id="mb-trash" title="拖到这里删除"><span>🗑</span><small>拖此删除</small></div>' + script + '</section></div>' + mbStatusHtml() + datalists;
}
/* ---------------- 程序变更 ---------------- */

// 固定取值集合 → 下拉；其余仍走积木槽
function mbArgHtml(v, chain, slotType, kind, name, i) {
  const en = mbArgEnum(kind, name, i);
  const opt = mbArgOptional(kind, name, i);
  if (!en) return mbValHtml(v, chain, slotType, opt);
  const scalar = !v || v.t === 's' || v.t === 'n' || v.t === 'var';
  if (!scalar) return mbValHtml(v, chain, slotType, opt);
  let cur = '';
  if (v) cur = v.t === 'var' ? String(v.n) : String(v.v);
  const has = en.values.some(([val]) => String(val) === cur);
  const extra = cur && !has ? '<option value="' + esc(cur) + '" selected>（原值）' + esc(cur) + '</option>' : '';
  const opts = en.values.map(([val, label]) => '<option value="' + esc(val) + '"' + (String(val) === cur ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  return '<select class="mb-arg-enum" data-mb-arg="' + esc(chain) + '" title="' + esc(en.zh || '') + '">'
    + '<option value=""' + (cur ? '' : ' selected') + '>（空）</option>' + extra + opts + '</select>';
}

function mbArgOptional(kind, name, i) {
  const map = S.keywords && S.keywords.argOptional && S.keywords.argOptional[kind];
  const list = map && map[name];
  if (Array.isArray(list) && list.includes(i)) return true;
  const r = (S.mbTables || []).find((x) => x.kind === kind && x.name === name);
  const p = r && Array.isArray(r.params) ? r.params[i] : null;
  return /^opt/i.test(String((p && p.name) || ''));
}
function mbArgCount(kind, name) {
  const ac = S.keywords && S.keywords.argCounts && S.keywords.argCounts[kind];
  if (ac && typeof ac[name] === 'number') return ac[name];
  const r = (S.mbTables || []).find((x) => x.kind === kind && x.name === name);
  return r && Array.isArray(r.args) ? r.args.length : 0;
}

function mbPayloadFrom(el) {
  const kind = el.dataset.mbKind;
  const val = el.dataset.mbVal || '';
  if (el.dataset.mbDrag === 'stmt') {
    if (kind === 'timing') return { type: 'stmt', node: { k: 'timing', v: val, body: [], loop: null } };
    if (kind === 'if') return { type: 'stmt', node: { k: 'if', logic: 'none', conds: [{ left: null, op: '>', right: null }], body: [] } };
    if (kind === 'ifnot') return { type: 'stmt', node: { k: 'ifnot', logic: 'none', conds: [{ left: null, op: '>', right: null }], body: [] } };
    if (kind === 'continueif') return { type: 'stmt', node: { k: 'continueif', logic: 'none', conds: [{ left: null, op: '>', right: null }] } };
    if (kind === 'cons') return { type: 'stmt', node: { k: 'cons', n: val, a: new Array(mbArgCount('consequence', val)).fill(null) } };
    if (kind === 'assign') return { type: 'stmt', node: { k: 'assign', var: 'VALUE_0', val: null } };
  } else {
    if (kind === 'loop') return { type: 'value', loop: true, node: (S.mb && S.mb.loopTarget) ? S.mb.loopTarget : null };
    if (kind === 'target') return { type: 'value', node: { t: 'target', n: val, c: null } };
    if (kind === 'var') return { type: 'value', node: { t: 'var', n: val } };
    if (kind === 'n') return { type: 'value', node: { t: 'n', v: Number(val) || 0 } };
    if (kind === 's') return { type: 'value', node: { t: 's', v: String(val || '') } };
    if (kind === 'acq') return { type: 'value', node: { t: 'acq', n: val, a: new Array(mbArgCount('acquirer', val)).fill(null) } };
    if (kind === 'math') return { type: 'value', node: { t: 'math', first: null, tail: [{ op: '+', val: null }] } };
  }
  return null;
}

function mbAccess(chain) {
  // 兼容两种链式写法：`0:a:3`（参数槽）与 `0:a3`、`0:c0:left`（条件槽）
  const parts = String(chain || '').split(':');
  const all = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'a' && /^\d+$/.test(parts[i + 1] || '')) { all.push('a' + parts[i + 1]); i++; }
    else all.push(parts[i]);
  }
  if (all.length < 2) return null;
  const stmt = mbStmt(all[0]);
  if (!stmt) return null;
  const steps = [];
  for (let i = 1; i < all.length; i++) {
    const raw = all[i];
    const pieces = raw.split('>');
    const head = pieces[0];
    const rest = pieces.slice(1).map((x) => Number(x)).filter((x) => !isNaN(x));
    let arr = null, idx = null, field = null;
    let m = /^a(\d+)$/.exec(head);
    if (m) { arr = 'a'; idx = Number(m[1]); }
    else if ((m = /^c(\d+)$/.exec(head))) { arr = 'conds'; idx = Number(m[1]); }
    else if ((m = /^t(\d+)$/.exec(head))) { arr = 'tail'; idx = Number(m[1]); }
    else if (['loop', 'val', 'left', 'right', 'op', 'f'].includes(head)) field = head;
    else return null;
    steps.push({ arr, idx, field, rest });
  }
  const readStep = (node, st) => {
    if (!node) return null;
    if (st.field === 'f') return node.first || null;
    if (st.arr === 'conds') { const c = (node.conds || [])[st.idx] || null; return c; }
    if (st.arr === 'a') return (node.a || [])[st.idx] || null;
    if (st.arr === 'tail') { const e = (node.tail || [])[st.idx] || null; return e ? e.val || null : null; }
    return node[st.field] === undefined ? null : node[st.field];
  };
  const writeStep = (node, st, v) => {
    if (!node) return false;
    if (st.field === 'f') { node.first = v; return true; }
    if (st.arr === 'conds') { node.conds = node.conds || []; const c = node.conds[st.idx]; if (!c) return false; return true; }
    if (st.arr === 'a') { node.a = node.a || []; node.a[st.idx] = v; return true; }
    if (st.arr === 'tail') { node.tail = node.tail || []; const e = node.tail[st.idx]; if (!e) return false; e.val = v; return true; }
    node[st.field] = v; return true;
  };
  const lastSt = steps[steps.length - 1];
  const descend = (v, idxs) => { let cur = v; for (const k of idxs) { if (!cur) return null; cur = (cur.a || [])[k] || null; } return cur; };
  const get = () => {
    let cur = stmt;
    for (let i = 0; i < steps.length - 1; i++) { cur = readStep(cur, steps[i]); if (!cur) return null; }
    const v = readStep(cur, lastSt);
    return lastSt.rest.length ? descend(v, lastSt.rest) : v;
  };
  const set = (v) => {
    let cur = stmt;
    for (let i = 0; i < steps.length - 1; i++) { cur = readStep(cur, steps[i]); if (!cur) return false; }
    if (lastSt.rest.length) {
      let holder = readStep(cur, lastSt);
      for (let k = 0; k < lastSt.rest.length - 1; k++) holder = (holder && holder.a ? holder.a[lastSt.rest[k]] : null);
      if (!holder) return false;
      holder.a = holder.a || [];
      holder.a[lastSt.rest[lastSt.rest.length - 1]] = v;
      return true;
    }
    return writeStep(cur, lastSt, v);
  };
  return { get, set };
}

function mbIsDirty() {
  if (!S.mb || S.mb.saved === undefined) return false;
  try { return JSON.stringify(S.mb.program) !== S.mb.saved; } catch { return false; }
}
function mbLeaveGuard(then) {
  const info = mbPendingMissing();
  if (info.list.length) {
    S.mb.leave = then;
    const sample = info.list.slice(0, 3).join('、');
    modal({
      title: '有未填的必填参数',
      body: '<p>还有 <b>' + info.list.length + '</b> 处必填参数没有填：' + esc(sample) + (info.list.length > 3 ? ' 等' : '') + '。</p>'
        + '<p class="muted">现在退出仍会把当前改动保存下来，但保存后这些控件右上角会出现红点，游戏里很可能无法正确执行。</p>',
      footer: '<button class="btn ghost" data-act="close-modal">返回修改</button><button class="btn danger" data-act="mb-leave-missing-ok">仍然退出</button>',
    });
    return;
  }
  mbGuardDirty(then);
}
function mbGuardDirty(then) {
  if (!mbIsDirty()) { then(); return; }
  S.mb.leave = then;
  modal({ title: '模块尚未保存', body: '<p>当前模块有未保存的改动。</p>', footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn danger" data-act="mb-leave-discard">放弃更改</button><button class="btn primary" data-act="mb-leave-save">保存并离开</button>' });
}
function mbSetSlot(chain, value) { const ref = mbAccess(chain); if (!ref) return false; ref.set(value); return true; }
function mbClearSlot(chain) { const ref = mbAccess(chain); if (!ref) return; mbSnapshot(); ref.set(null); }
function mbKindName(node) {
  const k = node && node.k;
  return k === 'if' ? '如果' : k === 'ifnot' ? '如果否' : k === 'continueif' ? '继续如果' : k === 'assign' ? '赋值' : '效果块';
}
function mbHasTimingAncestor(stackId) {
  const p = String(stackId || 'root');
  if (!p || p === 'root') return false;
  let list = (S.mb && S.mb.program && S.mb.program.blocks) || [];
  for (const seg of p.split('.')) {
    const node = list[Number(seg)];
    if (!node) return false;
    if (node.k === 'timing') return true;
    list = node.body || [];
  }
  return false;
}
function mbAllowsPlace(stackId, index, node) {
  if (!node) return { ok: false, msg: '' };
  const root = String(stackId || 'root') === 'root';
  if (node.k === 'timing') {
    if (!root) return { ok: false, msg: '时点块只能放在最外层' };
    return { ok: true, msg: '' };
  }
  if (root) return { ok: false, msg: mbKindName(node) + '必须放进某个时点块里面（最外层只放时点）' };
  if (!mbHasTimingAncestor(stackId)) return { ok: false, msg: '只能放在时点块内部' };
  return { ok: true, msg: '' };
}
function mbInsert(stackId, index, node) {
  try {
    const host = document.querySelector('[data-stack="' + String(stackId) + '"]');
    if (host && host.closest('.bk.locked')) { toast('这一行已被手改锁定：只能整块移动或删除', 'warn'); return false; }
  } catch (e) {}
  if (!node) return false;
  const root = String(stackId || 'root') === 'root';
  const list = root ? ((S.mb && S.mb.program && S.mb.program.blocks) || []) : mbStackAt(String(stackId).split('.').map(Number));
  if (!list) return false;
  const i = Math.max(0, Math.min(Number(index) || 0, list.length));
  const gate = mbAllowsPlace(stackId, i, node);
  if (!gate.ok) { toast(gate.msg, 'warn'); return false; }
  mbSnapshot();
  list.splice(i, 0, node);
  return true;
}
function mbRemove(idStr) {
  const p = String(idStr).split('.').map(Number);
  const list = mbStackAt(p.slice(0, -1));
  if (!list) return;
  mbSnapshot();
  list.splice(p[p.length - 1], 1);
}

function mbIndexAt(stackEl, y) {
  const kids = [...stackEl.children].filter((c) => c.classList && c.classList.contains('bk'));
  for (let i = 0; i < kids.length; i++) {
    const r = kids[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return kids.length;
}

/* ---------------- 拖拽与点选 ---------------- */

function mbGhost(text, x, y) {
  let g = document.getElementById('mb-ghost');
  if (!g) { g = document.createElement('div'); g.id = 'mb-ghost'; document.body.appendChild(g); }
  g.textContent = text;
  g.style.left = x + 12 + 'px';
  g.style.top = y + 10 + 'px';
  g.hidden = false;
}

function mbClearHighlight() {
  document.querySelectorAll('.mb-hot').forEach((el) => el.classList.remove('mb-hot'));
}

function mbInlineEdit(el, chain, type, cur) {
  if (!el || el.querySelector('input.mb-inline')) return;
  const isNum = type === 'num';
  const original = el.innerHTML;
  const inp = document.createElement('input');
  inp.className = 'mb-inline';
  inp.type = isNum ? 'number' : 'text';
  inp.value = cur === null || cur === undefined ? '' : String(cur);
  el.innerHTML = '';
  el.appendChild(inp);
  inp.focus();
  try { inp.select(); } catch {}
  let done = false;
  // 空输入 = 取消：只把本槽恢复原样，不做整页重绘（否则会顺手把另一个正在编辑的输入框重建掉）
  const finishEmpty = () => {
    if (el.isConnected) el.innerHTML = original;
    if (!document.querySelector('input.mb-inline')) setTimeout(() => { if (!document.querySelector('input.mb-inline')) render(); }, 0);
  };
  const commit = () => {
    if (done) return;
    done = true;
    const raw = String(inp.value == null ? '' : inp.value).trim();
    if (raw === '') { finishEmpty(); return; }
    mbSnapshot();
    if (isNum) {
      const num = Number(raw);
      if (!Number.isFinite(num)) { finishEmpty(); return; }
      mbSetSlot(chain, { t: 'n', v: Math.trunc(num) });
    } else {
      mbSetSlot(chain, { t: 's', v: raw });
    }
    // 若还有别的槽在编辑，先不重绘（等它结束时的重绘一起显示新值）
    if (document.querySelectorAll('input.mb-inline').length > 1) { if (el.isConnected) el.innerHTML = original; return; }
    setTimeout(render, 0);
  };
  const cancel = () => {
    if (done) return;
    done = true;
    finishEmpty();
  };
  inp.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
  });
  inp.addEventListener('blur', commit);
}
function mbSlotChain(el) {
  if (!el) return '';
  return el.dataset.mbSlot || el.dataset.chain || '';
}

function mbSlotAt(x, y) {
  for (const el of document.querySelectorAll('.slot, [data-mb-slot]')) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el;
  }
  return null;
}

function mbDropResolve(x, y, payload) {
  const el = document.elementFromPoint(x, y);
  if (!el) return false;
  const geoSlot = mbSlotAt(x, y);
  if (payload.loop) {
    if (!payload.node) { toast('先往「遍历（自定义目标）」卡片里拖一个目标，再把它拖进时点右侧的遍历槽', 'warn'); return false; }
    const slotEl = el.closest('[data-mb-loop]') || (geoSlot && geoSlot.closest('[data-mb-loop]'));
    if (!slotEl) { toast('遍历块只能放到时点块右侧的「遍历」槽里', 'warn'); return false; }
    return mbSetSlot(slotEl.dataset.mbLoop, payload.node);
  }
  const slot = el.closest('.slot') || el.closest('[data-mb-slot]') || geoSlot;
  if (slot && mbSlotChain(slot) === 'palette:loop') {
    const node = payload && payload.node ? payload.node : null;
    if (!node || mbValueType(node) !== 'target') { toast('这里只能放目标积木（把「目标」里的任意一个拖进来）', 'warn'); return false; }
    S.mb.loopTarget = node;
    render();
    toast('遍历目标已设为 ' + mbTargetLabel(node), 'ok');
    return true;
  }
  if (payload.type === 'value') {
    if (!slot) return false;
    const want = slot.dataset.slotType || 'any';
    if (!mbCompatible(want, mbValueType(payload.node))) { toast('这个位置只能放「' + (MB_TYPE_ZH[want] || want) + '」', 'warn'); return false; }
    return mbSetSlot(mbSlotChain(slot), payload.node);
  }
  const stackEl = el.closest('[data-stack]');
  if (slot && !stackEl) return false;
  if (stackEl) return mbInsert(stackEl.dataset.stack, mbIndexAt(stackEl, y), payload.node);
  if (el.closest('.mb-canvas')) {
    const root = document.querySelector('.mb-canvas .mb-stack');
    if (root) { mbInsert('root', mbIndexAt(root, y), payload.node); return true; }
  }
  return false;
}

function mbOverTrash(x, y) {
  const t = document.getElementById('mb-trash');
  if (!t) return false;
  const r = t.getBoundingClientRect();
  return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6;
}

function mbBindDrag() {
  document.addEventListener('mousedown', (e) => {
    if (!S.mb || !S.mbDoc) return;
    if (e.button !== 0) return;
    // 原生控件（下拉、输入框）优先处理，绝不能被拖拽拦截（否则 preventDefault 会吃掉下拉与聚焦）
    if (e.target.closest('input, select, textarea, option, [contenteditable="true"], label')) {
      if (!e.target.closest('[data-mb-drag]')) return;
    }
    if (e.target.closest('.bk-x, .vb-x, .vb-edit, .no-drag')) return;
    if (e.target.closest('button') && !e.target.closest('[data-mb-drag]')) return;
    const pal = e.target.closest('[data-mb-drag]');
    const bk = e.target.closest('[data-mb-bk]');
    const vb = e.target.closest('.vb');
    if (!pal && !bk && !vb) return;
    if (!pal && !vb && e.target.closest('.slot')) return;
    let payload = null; let label = '';
    if (pal) { payload = mbPayloadFrom(pal); label = (pal.querySelector('b') || {}).textContent || '积木'; if (payload) payload.fromPalette = true; }
    else if (vb) { const chain = vb.dataset.chain || (vb.parentElement && vb.parentElement.closest('[data-mb-slot]')?.dataset.mbSlot) || ''; if (!chain) return; const ref = mbAccess(chain); if (!ref || !ref.get()) return; payload = { type: 'value', node: JSON.parse(JSON.stringify(ref.get())), fromChain: chain }; label = '数值块'; }
    else if (bk) { const id = bk.dataset.mbBk; const cur = mbStmt(id); if (!cur) return; payload = { type: 'stmt', node: JSON.parse(JSON.stringify(cur)), fromId: id }; label = cur.k === 'if' ? '如果' : (cur.n || cur.k); }
    if (!payload) return;
    S.mb.drag = { payload, label, x0: e.clientX, y0: e.clientY, active: false };
    e.preventDefault();
  }, true);

  document.addEventListener('mousemove', (e) => {
    const d = S.mb && S.mb.drag;
    if (!d) return;
    if (!d.active) {
      if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < 6) return;
      d.active = true;
      document.body.classList.add('mb-dragging');
    }
    mbGhost(d.label, e.clientX, e.clientY);
    mbClearHighlight();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slot = el && el.closest('.slot');
    const stackEl = el && el.closest('[data-stack]');
    const trashEl = document.getElementById('mb-trash');
    if (trashEl) { if (mbOverTrash(e.clientX, e.clientY)) trashEl.classList.add('hot'); else trashEl.classList.remove('hot'); }
    if (d.payload.type === 'value') { if (slot) slot.classList.add('mb-hot'); }
    else if (stackEl) stackEl.classList.add('mb-hot');
  });

  document.addEventListener('mouseup', (e) => {
    const d = S.mb && S.mb.drag;
    if (!d) return;
    S.mb.drag = null;
    const g = document.getElementById('mb-ghost'); if (g) g.hidden = true;
    document.body.classList.remove('mb-dragging');
    mbClearHighlight();
    if (d.active) {
      S.mb.suppressClick = Date.now();
      const dropEl = document.elementFromPoint(e.clientX, e.clientY);
      const onTrash = mbOverTrash(e.clientX, e.clientY);
      const onPal = dropEl && dropEl.closest && dropEl.closest('.mb-pal');
      if ((onTrash || onPal) && (d.payload.fromId || d.payload.fromChain)) {
        if (d.payload.fromId) mbRemove(d.payload.fromId); else mbClearSlot(d.payload.fromChain);
        toast(onTrash ? '已删除该积木' : '已移出画布', 'warn');
        render();
        return;
      }
      const ok = mbDropResolve(e.clientX, e.clientY, d.payload);
      if (!ok) { toast('这里放不下这个块', 'warn'); }
      else if (d.payload.fromId) mbRemove(d.payload.fromId);
      else if (d.payload.fromChain) {
        const up = document.elementFromPoint(e.clientX, e.clientY);
        const tgt = up && up.closest ? (up.closest('[data-mb-slot]') || up.closest('.slot')) : null;
        if (mbSlotChain(tgt) !== d.payload.fromChain) mbClearSlot(d.payload.fromChain);
      }
      render();
      return;
    }
    // 未拖动 = 点击
    if (d.payload.fromPalette) {
      S.mb.carry = d.payload;
      toast(d.payload.type === 'value' ? '已选中数值块：点一个空位放进去' : '已选中语句块：点画布放下');
      render();
      return;
    }
    if (S.mb.carry) {
      const ok = mbDropResolve(e.clientX, e.clientY, S.mb.carry);
      if (ok) { S.mb.carry = null; render(); }
    }
  });
}

function mbBindEmptySlot() {
  if (S.__slotBound) return;
  S.__slotBound = true;
  document.addEventListener('click', (e) => {
    if (!S.mb || !S.mbDoc || S.mb.carry) return;
    const slot = e.target && e.target.closest ? e.target.closest('.slot[data-mb-empty]') : null;
    if (!slot) return;
    e.preventDefault();
    e.stopPropagation();
    const st = slot.dataset.slotType || 'any';
    if (st === 'num' || st === 'text' || st === 'any') { mbInlineEdit(slot, mbSlotChain(slot), st === 'text' ? 'text' : 'num', null); return; }
    toast('从左侧把「' + (MB_TYPE_ZH[st] || '对应类型') + '」积木拖进这个空位（或点左侧条目后点这里）');
  }, true);
}

function mbPaletteClick(e) {
  const pal = e.target.closest('[data-mb-drag]');
  if (!pal) return false;
  const payload = mbPayloadFrom(pal);
  if (!payload) return false;
  S.mb.carry = payload;
  render();
  return true;
}

function mbCanvasClick(e) {
  if (!S.mb || !S.mb.carry) return false;
  const carry = S.mb.carry;
  const geoSlot = mbSlotAt(e.clientX, e.clientY);
  if (carry.loop) {
    const slotEl = e.target.closest('[data-mb-loop]') || (geoSlot && geoSlot.closest('[data-mb-loop]'));
    if (!slotEl) { toast('先点时点块右侧的「遍历」槽', 'warn'); return false; }
    if (!mbSetSlot(slotEl.dataset.mbLoop, carry.node)) return false;
    S.mb.carry = null; render(); return true;
  }
  const slot = e.target.closest('.slot') || e.target.closest('[data-mb-slot]') || geoSlot;
  const stackEl = e.target.closest('[data-stack]');
  if (slot && mbSlotChain(slot) === 'palette:loop') {
    const node = carry && carry.node ? carry.node : null;
    if (!node || mbValueType(node) !== 'target') { toast('这里只能放目标积木', 'warn'); return false; }
    S.mb.loopTarget = node; S.mb.carry = null; render(); toast('遍历目标已设为 ' + mbTargetLabel(node), 'ok'); return true;
  }
  if (carry.loop && !carry.node) { toast('先往「遍历（自定义目标）」卡片里拖一个目标', 'warn'); return false; }
  if (carry.type === 'value') {
    if (!slot) return false;
    const want = slot.dataset.slotType || 'any';
    if (!mbCompatible(want, mbValueType(carry.node))) { toast('这个位置只能放「' + (MB_TYPE_ZH[want] || want) + '」', 'warn'); return false; }
    mbSetSlot(mbSlotChain(slot), carry.node);
  } else {
    let ok = false;
    if (stackEl) ok = mbInsert(stackEl.dataset.stack, stackEl.children.length, carry.node);
    else {
      const root = document.querySelector('.mb-canvas .mb-stack');
      if (!root) return false;
      ok = mbInsert('root', root.children.length, carry.node);
    }
    if (!ok) { render(); return false; }
  }
  S.mb.carry = null;
  render();
  return true;
}

/* ---------- Buff 归属标签（v0.8.4：Buff 属于哪个 Mod） ---------- */
/** 单个 Buff 的归属：本 Mod / 原版 / 具体 Mod 名；同 id 还被别的 Mod 定义时追加「另见 …」。 */
function buffOwnerTag(id, mod, source) {
  const key = String(id || '');
  const sel = String(S.selected || '');
  const ownMod = String(mod || '');
  const own = ownMod ? (ownMod === sel ? '本 Mod' : ownMod) : (source === 'mod' ? '其他 Mod' : '原版');
  const rec = (S.keywords?.buffOwners || []).find((o) => String(o.id) === key);
  const extra = ((rec && rec.mods) || []).filter((m) => String(m) !== ownMod && String(m) !== sel);
  return own + (extra.length ? '／另见 ' + extra.join('、') : '');
}

/** Buff 列表排序权重：本 Mod → 原版 → 其他 Mod。 */
function buffOwnerRank(mod, source) {
  const ownMod = String(mod || '');
  if (ownMod && ownMod === String(S.selected || '')) return 0;
  return source === 'vanilla' ? 1 : 2;
}

/* ---------- 槽位下拉选择器（v0.5.3 实参类型化） ---------- */
function mbBuffChoices() {
  const list = S.keywords?.buffs || [];
  const out = [];
  for (const b of list) {
    const ids = Array.isArray(b.ids) ? b.ids : [b.id || b.n];
    const zh = String(b.zh || b.native || b.name || '');
    for (const id of ids.slice(0, 3)) if (id) out.push({ id: String(id), zh, mod: b.mod || '', source: b.source || 'vanilla' });
  }
  return out.sort((a, b) => buffOwnerRank(a.mod, a.source) - buffOwnerRank(b.mod, b.source));
}

function mbPickButton(chain, kind, val, label, sub) {
  return '<button class="mb-pick" data-act="mb-pick" data-chain="' + esc(chain) + '" data-kind="' + esc(kind) + '" data-val="' + esc(val) + '">'
    + '<b>' + esc(label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</button>';
}

function mbPickApply(chain, node) {
  if (!mbSetSlot(chain, node)) return;
  closeModal();
  render();
}

Object.assign(actions, {
  'mb-pick': (el) => {
    const kind = el.dataset.kind;
    const val = el.dataset.val;
    const node = kind === 'target' ? { t: 'target', n: val, c: null }
      : kind === 'var' ? { t: 'var', n: val }
        : kind === 'n' ? { t: 'n', v: Number(val) || 0 }
          : { t: 's', v: val };
    mbPickApply(el.dataset.chain, node);
  },
  'mb-pick-math': (el) => {
    mbPickApply(el.dataset.chain, { t: 'math', first: null, tail: [{ op: '+', val: null }] });
  },
  'mb-pick-num': (el) => {
    const raw = (document.getElementById('mb-pick-num')?.value || '').trim();
    if (!/^-?\d+$/.test(raw)) { toast('请输入整数', 'warn'); return; }
    mbPickApply(el.dataset.chain, { t: 'n', v: Number(raw) });
  },
  'mb-pick-buff': (el) => {
    const v = document.getElementById('mb-pick-buff')?.value || '';
    if (!v) { toast('请选择 Buff 关键词', 'warn'); return; }
    mbPickApply(el.dataset.chain, { t: 's', v });
  },
  'mb-pick-text': (el) => {
    const v = document.getElementById('mb-pick-text')?.value || '';
    mbPickApply(el.dataset.chain, { t: 's', v });
  },
});
function mbTargetModalBody(cur) {
  const curN = String(cur.n || '');
  const bases = MB_TARGETS.filter((t) => t.g !== 'tag');
  const noDollar = curN.split('$')[0];
  const head = noDollar.split('+')[0];
  const idHit = /^id(\d+)$/.exec(head);
  const instHit = /^inst(\d+)$/.exec(head);
  const baseHit = (idHit || instHit) ? null : (bases.find((t) => head.startsWith(t.n)) || null);
  const base = baseHit ? baseHit.n : '';
  const rest = baseHit ? head.slice(baseHit.n.length) : '';
  const tail = noDollar.split('+').slice(1).join('+');
  const tagPool = MB_TARGET_TAGS.map((t) => t.n);
  const tags = tagPool.filter((n) => rest.includes(n) || tail.split('+').includes(n));
  const dollar = curN.includes('$') ? curN.slice(curN.indexOf('$') + 1) : '';
  const expr = (baseHit || idHit || instHit) ? (tail && !tags.length ? tail : '') : noDollar;
  const baseOpts = ['single', 'multi'].map((g) => {
    const label = g === 'single' ? '单目标' : '多目标';
    const rows = MB_TARGETS.filter((t) => t.g === g);
    return '<optgroup label="' + label + '">' + rows.map((t) => '<option value="' + esc(t.n) + '"' + (t.n === base ? ' selected' : '') + '>' + esc(t.zh + ' · ' + t.n) + '</option>').join('') + '</optgroup>';
  }).join('');
  const tagHtml = MB_TARGET_TAGS.map((t) => '<label class="chk"><input type="checkbox" class="mb-tag" value="' + esc(t.n) + '"' + (tags.includes(t.n) ? ' checked' : '') + '><span>' + esc(t.zh) + '</span></label>').join('');
  const count = cur.c === null || cur.c === undefined || cur.c === '' ? '' : String(cur.c);
  const seenBuff = new Set();
  const buffNames = [];
  for (const b of (S.keywords?.buffs || [])) {
    const zh = String(b.zh || b.native || b.name || '');
    for (const id of (Array.isArray(b.ids) ? b.ids : [b.id])) { if (!id || seenBuff.has(id)) continue; seenBuff.add(id); buffNames.push({ id: String(id), zh, mod: b.mod || '', source: b.source || 'vanilla' }); }
  }
  const buffOpts = buffNames.slice(0, 5000).map((b) => '<option value="' + esc(b.id) + '" label="' + esc((b.zh ? b.zh + ' · ' : '') + b.id + ' · ' + buffOwnerTag(b.id, b.mod, b.source)) + '">' + esc((b.zh ? b.zh + ' · ' : '') + b.id + ' · ' + buffOwnerTag(b.id, b.mod, b.source)) + '</option>').join('');
  return '<div class="mb-t-form">'
    + '<label class="field"><span>基础选择器</span><select id="mb-t-base"><option value="">（自定义表达式）</option>' + baseOpts + '</select></label>'
    + '<div class="grid-2"><label class="field"><span>单位 ID（id####，留空不用）</span><input id="mb-t-id" value="' + esc(idHit ? idHit[1] : '') + '" placeholder="例如 10101"></label>'
    + '<label class="field"><span>实例 ID（inst####，留空不用）</span><input id="mb-t-inst" value="' + esc(instHit ? instHit[1] : '') + '" placeholder="例如 123"></label></div>'
    + '<label class="field"><span>数量（留空 = 1；多目标可填 1–999 或 VALUE_0）</span><input id="mb-t-count" value="' + esc(count) + '" placeholder="例如 3 或 VALUE_0"></label>'
    + '<div class="field"><span>修饰标签（可多选）</span><div class="mb-t-tags">' + tagHtml + '</div></div>'
    + '<label class="field"><span>$ 关键词检查（可选，只保留带该 Buff 的单位）</span><input id="mb-t-buff" list="mb-t-bufflist" value="' + esc(dollar) + '" placeholder="例如 Combustion"></label>'
    + '<datalist id="mb-t-bufflist">' + buffOpts + '</datalist>'
    + '<label class="field"><span>自定义表达式（填了就忽略上面的基础选择器，例如 EveryAlly+ExceptSelf）</span><input id="mb-t-expr" value="' + esc(expr) + '" placeholder="EveryAlly+ExceptSelf"></label>'
    + '<div class="hint muted">数量直接拼在目标名末尾（EveryAlly3）；标签直接连写；+ 用于并集，$关键词 放在最后。</div>'
    + '</div>';
}

function mbReadTargetModal() {
  const base = document.getElementById('mb-t-base')?.value || '';
  const expr = (document.getElementById('mb-t-expr')?.value || '').trim();
  const countRaw = (document.getElementById('mb-t-count')?.value || '').trim();
  const idRaw = (document.getElementById('mb-t-id')?.value || '').trim();
  const instRaw = (document.getElementById('mb-t-inst')?.value || '').trim();
  const dollar = (document.getElementById('mb-t-buff')?.value || '').trim();
  const tags = [...document.querySelectorAll('.mb-tag:checked')].map((el) => el.value);
  let n = expr;
  if (!n) {
    if (/^\d+$/.test(idRaw)) n = 'id' + idRaw;
    else if (/^\d+$/.test(instRaw)) n = 'inst' + instRaw;
    else n = base + tags.join('');
  }
  if (dollar && n.indexOf('$') < 0) n += '$' + dollar.replace(/^\$/, '');
  return { t: 'target', n, c: countRaw === '' ? null : countRaw };
}
function openMbEdit(chain) {
  const ref = mbAccess(chain);
  if (!ref) return;
  const cur = ref.get() || {};
  const isTarget = cur.t === 'target';
  if (isTarget) {
    modal({
      title: '编辑目标选择器',
      body: mbTargetModalBody(cur),
      footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="mb-edit-ok" data-chain="' + esc(chain) + '">确定</button>',
    });
    return;
  }
  const value = cur.v ?? '';
  modal({
    title: '修改数值',
    body: '<label class="field"><span>值</span><input id="mb-edit-input" value="' + esc(String(value)) + '"></label>',
    footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="mb-edit-ok" data-chain="' + esc(chain) + '">确定</button>',
  });
  setTimeout(() => { const i = document.getElementById('mb-edit-input'); if (i) { i.focus(); i.select(); } }, 30);
}

Object.assign(actions, {
  'close-module': () => { mbLeaveGuard(() => { S.moduleEditing = null; S.mb = null; S.mbDoc = null; render(); }); },
  'mb-leave-discard': () => { S.mb.saved = JSON.stringify(S.mb.program); const t = S.mb.leave; closeModal(); if (t) t(); },
  'mb-leave-missing-ok': () => { const t = S.mb && S.mb.leave; closeModal(); mbGuardDirty(t); },
  'mb-leave-save': async () => {
    const t = S.mb && S.mb.leave;
    let ok = false; try { ok = await actions['mb-save'](); } catch (err) { toast('保存失败：' + (err && err.message ? err.message : err), 'err'); return; }
    if (ok === false) return;
    closeModal(); if (t) t();
  },
  'mb-cat': (el) => { S.mb.cat = el.dataset.cat; render(); },
  'mb-props': async (el) => { await openModuleProps(el && el.dataset ? el.dataset.id : ''); },
  'mb-props-save': async (el) => {
    const id = el.dataset.id;
    const res = await api('/api/module/save', { method: 'POST', body: {
      id, name: $('#mp-name').value, scope: $('#mp-scope').value, desc: $('#mp-desc').value,
    } });
    S.modules = (await api('/api/modules')).modules;
    if (S.mbDoc && S.mbDoc.id === id) { S.mbDoc = res.module; S.mb = { ...S.mb, doc: res.module }; }
    closeModal();
    toast('模块信息已保存', 'ok');
    render();
  },
  'mb-props-delete': async (el) => {
    const id = el.dataset.id;
    const isTest = el.dataset.test === '1';
    if (!confirm(isTest ? '删除这个测试模块？（删除后不会再自动生成）' : '删除这个模块？此操作不能撤销。')) return;
    await api('/api/module/delete', { method: 'POST', body: { id, allowTest: isTest } });
    S.modules = (await api('/api/modules')).modules;
    closeModal();
    if (S.moduleEditing === id) { S.moduleEditing = null; S.mb = null; S.mbDoc = null; }
    toast('模块已删除', 'warn');
    render();
  },
  'mb-code': () => { S.mb.codePage = true; render(); },
  'mb-code-back': () => { S.mb.codePage = false; render(); },
  'mb-code-save': async () => {
    const boxes = Array.from(document.querySelectorAll('.code-text'));
    const manual = {};
    for (const box of boxes) {
      const key = box.dataset.key;
      if (!key || box.readOnly) continue;
      manual[key] = box.value;
    }
    S.mb.program = { ...S.mb.program, manual };
    S.mb.codePage = false;
    await actions['mb-save']();
  },
  'mb-code-lock': (el) => {
    const key = String(el.dataset.key || '');
    if (!/^\d+$/.test(key)) return;
    const row = mbCompileRows().find((r) => String(r.key) === key);
    if (!row) return;
    if (!S.mb.manualWarned) {
      modal({
        title: '手动修改这一行代码',
        body: '<p><strong>你正在手动修改「' + esc(row.text.slice(0, 40)) + '…」这一行的输出代码。</strong></p>'
          + '<div class="person-list"><div class="check-row"><span>· 手动修改后，这一行对应的时点积木会被<b>锁定</b>，在积木页只能整块移动或删除，不能再改里面的参数。</span></div>'
          + '<div class="check-row"><span>· 编辑器不会再用积木内容覆盖这一行；改错了只能自己改回来（没有一键还原）。</span></div>'
          + '<div class="check-row"><span>· 建议只有在积木表达不了时才手改。</span></div></div>'
          + '<label class="field check"><input type="checkbox" id="mb-manual-skip"> 本次打开编辑器内不再提示</label>',
        footer: '<button class="btn ghost" data-act="close-modal">返回</button><button class="btn warn" data-act="mb-code-lock-ok" data-key="' + esc(key) + '">我明白，手动修改</button>',
      });
      return;
    }
    mbLockRow(key);
  },
  'mb-code-lock-ok': (el) => {
    const skip = document.getElementById('mb-manual-skip');
    if (skip && skip.checked) S.mb.manualWarned = true;
    const key = String(el.dataset.key || '');
    closeModal();
    mbLockRow(key);
  },
  'mb-script': () => { S.mb.showScript = !S.mb.showScript; render(); },
  'mb-toggle-panic': () => { S.mb.showPanic = !S.mb.showPanic; render(); },
  'mb-clear': () => {
    if (!confirm('清空这个模块里的全部积木？（清空后可以用撤销还原）')) return;
    mbSnapshot();
    S.mb.program = { version: 1, blocks: [] };
    render();
  },
  'mb-save': async () => {
    const info = mbMissingInfo();
    let res = null;
    const body = { id: S.moduleEditing, program: S.mb.program, expectUpdatedAt: S.mb.savedAt || '', force: !!S.mb.forceSave };
    try { res = await api('/api/module/program', { method: 'POST', body }); }
    catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (!S.mb.forceSave && /已被修改/.test(msg) && window.confirm('模块文件在磁盘上已被修改（可能是另一个窗口，或有人直接改了文件）。要用当前内容覆盖吗？')) {
        S.mb.forceSave = true;
        return actions['mb-save']();
      }
      throw err;
    }
    if (!res || res.ok === false) { toast((res && res.error) || '保存失败', 'err'); return false; }
    S.mb.saved = JSON.stringify(S.mb.program);
    S.mb.savedAt = (res.module && res.module.updatedAt) || '';
    S.mb.hist = [];
    S.mb.redo = [];
    S.mb.forceSave = false;
    S.mb.dirty = false;
    S.mb.showMissing = info.list.length > 0;
    S.mb.missingIds = info.ids;
    S.mbDoc = res.module;
    S.modules = (await api('/api/modules')).modules;
    render();
    if (info.list.length) {
      toast('已保存；有 ' + info.list.length + ' 处必填参数未填，游戏里很可能无法正确执行（控件右上角有红点）', 'warn');
      mbFlashMissing();
    } else {
      toast('模块已保存');
    }
    return true;
  },
  'mb-del': (el) => { mbRemove(el.dataset.mbDel); render(); },
  'mb-clear-slot': (el) => { mbClearSlot(el.dataset.mbClear); render(); },
  'mb-edit': (el) => {
    const chain = el.dataset.mbEdit;
    const ref = mbAccess(chain);
    const cur = ref && ref.get();
    if (!cur || cur.t !== 'n') return;
    openMbEdit(chain);
  },
  'mb-custom-target': (el) => {
    const mode = el.dataset.mbMode;
    const chain = el.dataset.chain || '';
    const blank = { t: 'target', n: '', c: null };
    modal({
      title: mode === 'loop' ? '自定义循环目标' : '自定义目标选择器',
      body: mbTargetModalBody(blank),
      footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="mb-custom-target-ok" data-mode="' + esc(mode || 'target') + '" data-chain="' + esc(chain) + '">确定</button>',
    });
  },
  'mb-custom-target-ok': (el) => {
    const picked = mbReadTargetModal();
    if (!picked.n) { toast('目标不能为空', 'warn'); return; }
    if (el.dataset.chain) { if (mbSetSlot(el.dataset.chain, picked)) { closeModal(); render(); } return; }
    if (el.dataset.mode === 'loop') S.mb.carry = { type: 'stmt', node: { k: 'loop', v: picked.n + (picked.c === null ? '' : String(picked.c)) } };
    else S.mb.carry = { type: 'value', node: picked };
    closeModal();
    render();
  },
  'mb-edit-ok': (el) => {
    const chain = el.dataset.chain;
    const ref = mbAccess(chain);
    if (ref) {
      const cur = ref.get() || {};
      if (cur.t === 'target') ref.set(mbReadTargetModal());
      else {
        const raw = document.getElementById('mb-edit-input')?.value ?? '';
        if (cur.t === 'n') ref.set({ ...cur, v: Math.trunc(Number(raw) || 0) });
        else ref.set({ ...cur, v: raw });
      }
    }
    closeModal();
    render();
  },
});

mbBindDrag();
mbBindEmptySlot();
const mbClickBind = true;
document.addEventListener('click', (e) => {
  if (!S.mb || !S.mbDoc) return;
  if (S.mb.suppressClick && Date.now() - S.mb.suppressClick < 350) return;
  const vbox = e.target.closest('.vb');
  if (vbox && !e.target.closest('[data-mb-del],[data-mb-edit],[data-mb-mathadd],[data-mb-mathdel],select,input')) {
    const vchain = vbox.dataset.chain || '';
    const vref = vchain ? mbAccess(vchain) : null;
    const vcur = vref && vref.get();
    if (vcur && (vcur.t === 'n' || vcur.t === 's')) {
      e.preventDefault();
      mbInlineEdit(vbox, vchain, vcur.t === 'n' ? 'num' : 'text', vcur.v);
      return;
    }
  }
  const del = e.target.closest('[data-mb-del]');
  if (del) { e.preventDefault(); mbRemove(del.dataset.mbDel); render(); return; }
  const mAdd = e.target.closest('[data-mb-mathadd]');
  if (mAdd) {
    const ref = mbAccess(mAdd.dataset.mbMathadd);
    const node = ref && ref.get();
    if (node && node.t === 'math') { node.tail = node.tail || []; if (node.tail.length < 8) node.tail.push({ op: '+', val: null }); render(); }
    return;
  }
  const mDel = e.target.closest('[data-mb-mathdel]');
  if (mDel) {
    const ref = mbAccess(mDel.dataset.mbMathdel);
    const node = ref && ref.get();
    if (node && node.t === 'math' && node.tail && node.tail.length) { node.tail.pop(); render(); }
    return;
  }
  const clr = e.target.closest('[data-mb-clear]');
  if (clr) { e.preventDefault(); mbClearSlot(clr.dataset.mbClear); render(); return; }
  const ed = e.target.closest('[data-mb-edit]');
  if (ed) { e.preventDefault(); openMbEdit(ed.dataset.mbEdit); return; }
  if (!S.mb.carry && !e.target.closest('button,select,input,.slot,.vb,.bk-body')) {
    const bk = e.target.closest('[data-mb-bk]');
    if (bk) { S.mb.sel = bk.dataset.mbBk; render(); return; }
  }
  if (e.target.closest('[data-mb-drag]')) { mbPaletteClick(e); return; }
  if (S.mb.carry) { mbCanvasClick(e); return; }
  const slotEl = e.target.closest('[data-mb-slot]');
  if (slotEl && slotEl.classList.contains('slot')) {
    const st = slotEl.dataset.slotType || 'any';
    if (st === 'num' || st === 'text') { mbInlineEdit(slotEl, slotEl.dataset.mbSlot, st, null); return; }
    toast('从左侧把「' + (MB_TYPE_ZH[st] || '对应类型') + '」积木拖进这个空位');
    return;
  }
}, true);

document.addEventListener('keydown', (e) => {
  const inField = e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"]');
  if (S.mb && !inField && (e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'z') {
    e.preventDefault(); if (e.shiftKey) mbRedo(); else mbUndo(); return;
  }
  if (S.mb && !inField && (e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'y') {
    e.preventDefault(); mbRedo(); return;
  }
  if (e.key === 'Backspace' && S.mb && S.mb.sel && !inField) {
    e.preventDefault(); mbBackspace(); return;
  }
  if (e.key !== 'Escape') return;
  if (!S.mb) return;
  let changed = false;
  if (S.mb.carry) { S.mb.carry = null; changed = true; }
  if (S.mb.drag) { S.mb.drag = null; changed = true; }
  if (changed) { render(); toast('\u5df2\u53d6\u6d88', 'warn'); }
});

document.addEventListener('change', (e) => {
  if (!S.mb || !S.mbDoc) return;
    const argSel = e.target.closest('[data-mb-arg]');
    if (argSel) {
      const ref = mbAccess(argSel.dataset.mbArg);
      if (ref) {
        const val = argSel.value;
        ref.set(val === '' ? null : { t: 's', v: val });
        refreshMbScript();
      }
      return;
    }
  const op = e.target.closest('[data-mb-op]');
  if (op) { const n = mbStmt(op.dataset.mbOp); if (n) n.op = op.value; render(); return; }
  const faceEl = e.target.closest('[data-mb-face]');
  if (faceEl) { const n = mbStmt(faceEl.dataset.mbFace); if (n) n.face = faceEl.value; render(); return; }
  const critEl = e.target.closest('[data-mb-crit]');
  if (critEl) { const n = mbStmt(critEl.dataset.mbCrit); if (n) n.crit = critEl.value; render(); return; }
  const kwEl = e.target.closest('[data-mb-kw]');
  if (kwEl) { const n = mbStmt(kwEl.dataset.mbKw); if (n) n.kw = kwEl.value.trim(); refreshMbScript(); return; }
  const varEl = e.target.closest('[data-mb-var]');
  if (varEl) { const n = mbStmt(varEl.dataset.mbVar); if (n) n.var = varEl.value; render(); return; }
  const mathOp = e.target.closest('[data-mb-mathop]');
  if (mathOp) {
    const ref = mbAccess(mathOp.dataset.mbMathop);
    const node = ref && ref.get();
    if (node && node.tail && node.tail[Number(mathOp.dataset.mbIdx)]) {
      node.tail[Number(mathOp.dataset.mbIdx)].op = mathOp.value;
      refreshMbScript(); return;
    }
  }
  const keyEl = e.target.closest('[data-mb-key]');
  if (keyEl) { const n = mbStmt(keyEl.dataset.mbKey); if (n) n.key = keyEl.value.trim(); refreshMbScript(); return; }
});

function refreshMbScript() {
  const el = document.getElementById('mb-script');
  if (el) el.textContent = mbCompileScript();
  refreshMbStatus();
}

function renderPassiveArea(back) {
  const q = (S.passiveSearch || '').trim().toLowerCase();
  const rows = (S.passives || []).filter((p) => !q || String(p.id).includes(q) || String(p.name || '').toLowerCase().includes(q))
    .map((p) => '<button class="item ' + (S.passiveId === String(p.id) ? 'active' : '') + '" data-act="open-passive" data-id="' + esc(p.id) + '">'
      + '<div class="item-main"><strong>' + esc(p.name || p.id) + '</strong><small>' + esc(p.id)
      + (p.override ? ' · 原版覆盖' : '') + (p.scripts ? ' · ' + p.scripts + ' 模块' : '') + '</small></div>'
      + '<span class="state-dot ' + (p.updatedAt ? 'on' : '') + '"></span></button>').join('');
  const disabled = S.mods.find((m) => m.name === S.selected)?.enabled === false;
  return '<div class="pane-head">' + back + '<div><h2>被动编辑</h2><p class="muted">' + esc(S.selected || '') + '</p></div></div>'
    + (disabled ? '<div class="banner red">该 Mod 正在被禁用的状态 · 修改仍会保存到磁盘，但不会在游戏中生效</div>' : '')
    + '<div class="skill-wrap">'
    + '<section class="panel"><div class="panel-head">被动 <span class="count">' + (S.passives || []).length + '</span></div>'
    + '<div class="panel-search"><input id="passive-search" class="search" placeholder="搜索 id / 被动名" value="' + esc(S.passiveSearch) + '"></div>'
    + '<div class="panel-body list">' + (rows || '<div class="list-empty">还没有自定义被动</div>') + '</div>'
    + '<div class="panel-foot two"><button class="btn ghost sm" data-act="new-passive">＋ 新建</button><button class="btn ghost sm" data-act="import-passive">⇩ 导入</button></div></section>'
    + renderPassiveMain()
    + renderModulePanel('module-search2', S.moduleSearch2)
    + '</div>';
}

function pSinOptions(current) {
  const sins = (S.keywords && S.keywords.sins) || [];
  const list = sins.length ? sins : [
    { id: 'CRIMSON', zh: '暴怒' }, { id: 'SCARLET', zh: '色欲' }, { id: 'AMBER', zh: '怠惰' },
    { id: 'SHAMROCK', zh: '暴食' }, { id: 'AZURE', zh: '忧郁' }, { id: 'INDIGO', zh: '傲慢' },
    { id: 'VIOLET', zh: '嫉妒' }, { id: 'WHITE', zh: '疯狂' }, { id: 'BLACK', zh: '哀叹' },
  ];
  return list.map((x) => '<option value="' + esc(x.id) + '"' + (String(x.id) === String(current) ? ' selected' : '') + '>' + esc(x.zh || x.id) + '</option>').join('');
}

function pCondRows(which, list) {
  const rows = (list || []).map((c, i) => '<div class="p-cond-row">'
    + '<select data-pcond="' + which + '" data-idx="' + i + '">' + pSinOptions(c.type) + '</select>'
    + '<input type="text" inputmode="decimal" data-num="1" min="1" max="99" step="1" inputmode="numeric" data-pcond-val="' + which + '" data-idx="' + i + '" value="' + esc(c.value ?? 1) + '">'
    + '<button class="icon-btn" data-act="p-cond-del" data-which="' + which + '" data-idx="' + i + '" title="删除这条条件">✕</button>'
    + '</div>').join('');
  return rows || '<div class="hint muted">还没有条件，点下面的「＋ 添加条件」。</div>';
}

function renderPassiveInfo(p) {
  const info = p.info || {};
  const mode = info.conditionMode || 'none';
  const seg = (id, label) => '<button class="seg' + (mode === id ? ' active' : '') + '" data-act="p-mode" data-p-mode="' + id + '">' + label + '</button>';
  const addBtn = mode === 'none'
    ? ''
    : (mode === 'resonance' && (info.resonanceConditions || []).length >= 1
      ? '<div class="hint muted">资源共鸣只支持 1 条条件。</div>'
      : '<button class="btn ghost sm" data-act="p-cond-add" data-which="' + (mode === 'stock' ? 'stock' : 'resonance') + '">＋ 添加条件</button>');
  return '<div class="info-card"><div class="col-title">被动基础信息</div>'
    + '<div class="seg-row">' + seg('none', '无条件') + seg('stock', '资源拥有') + seg('resonance', '资源共鸣') + '</div>'
    + (mode === 'none'
      ? '<div class="hint muted">这份被动没有启动条件（原版 2,801 个被动里 2,275 个都属于这一类）。</div>'
      : (mode === 'stock'
        ? '<div class="p-cond-list">' + pCondRows('stock', info.stockConditions) + '</div>'
          + '<div class="hint muted">资源拥有：拥有 N 个某罪孽资源时生效（原版最多 3 条，可叠加不同罪孽）。</div>'
        : '<div class="p-cond-list">' + pCondRows('resonance', info.resonanceConditions) + '</div>'
          + '<div class="hint muted">资源共鸣：某罪孽共鸣达到 N 时生效（原版只有 1 条）。</div>'))
    + addBtn
    + '</div>';
}

function renderPassiveDesc(p) {
  const name = typeof p.localeName === 'string' ? p.localeName : (p.name || '');
  const text = typeof p.description === 'string' ? p.description : '';
  const st = S.pDescCheck || { tokens: [], unknown: [] };
  const fromFile = p.descriptionSource === 'locale' && !String(p.localeDescEdited || '');
  return '<div class="desc-wrap"><div class="desc-block"><div class="desc-block-head"><strong>被动名字与描述</strong><span class="muted">直接写入游戏本地化</span></div>'
    + (fromFile ? '<div class="banner soft">以下描述是从被动文件里的游戏写法还原的（[英文id] → 中文名）；改动并保存后会按游戏写法写回 locale。</div>' : '')
    + '<label class="field"><span>被动名字</span><input id="p-name" class="desc-input slim" autocomplete="off" placeholder="例如 灼热抗性" value="' + esc(name) + '"></label>'
    + '<label class="field"><span>被动描述</span><textarea id="p-desc" class="desc-input" spellcheck="false" rows="7" placeholder="例如：[回合开始时]获得1层[烧伤]">' + esc(text) + '</textarea></label>'
    + '<div class="desc-preview" id="p-desc-preview">' + highlightText(text, st.tokens || []) + '</div>'
    + '<div class="desc-check ' + ((st.unknown || []).length ? 'bad' : 'ok') + '" id="p-desc-check">'
    + ((st.unknown || []).length ? '⚠ 有 ' + st.unknown.length + ' 个关键词未识别：' + st.unknown.map((u) => '[' + u + ']').join(' ') : '✓ 关键词检查通过')
    + '</div><div class="hint muted">保存时把 [中文关键词] 转成游戏用的英文写法写入 locale；这里显示的中文原文只存在编辑器里。</div></div></div>';
}

function renderPassiveMain() {
  if (!S.passive) {
    return '<section class="panel skill-main"><div class="panel-head">被动</div><div class="panel-body">'
      + '<div class="empty-state"><div class="empty-mark">◇</div><p>从左侧选一个被动</p><small class="muted">或新建 / 导入</small></div></div></section>';
  }
  const p = S.passive;
  const sess = S.session || {};
  return '<section class="panel skill-main"><div class="panel-head skill-head">'
    + '<div class="skill-title"><strong>' + esc(p.localeName || p.name || p.id) + '</strong><small>' + esc(p.id) + (p.override ? ' · 原版覆盖' : '') + '</small></div>'
    + '<span class="spacer"></span>'
    + '<button class="btn ghost sm" data-act="undo"' + (sess.undo ? '' : ' disabled') + '>撤销</button>'
    + '<button class="btn ghost sm" data-act="redo"' + (sess.redo ? '' : ' disabled') + '>重做</button>'
    + '<button class="btn primary sm" data-act="save-passive">保存</button>'
    + '<span class="session-state ' + (sess.dirty ? 'dirty' : '') + '" id="session-state">' + (sess.dirty ? '有未保存改动' : '已保存') + '</span></div>'
    + '<div class="skill-body passive-body">'
    + '<div class="editor-card"><div class="tabs">'
    + '<button class="tab ' + (S.passiveTab === 'code' ? 'active' : '') + '" data-act="passive-tab" data-tab="code">代码</button>'
    + '<button class="tab ' + (S.passiveTab === 'desc' ? 'active' : '') + '" data-act="passive-tab" data-tab="desc">描述</button></div>'
    + (S.passiveTab === 'desc' ? renderPassiveDesc(p) : (renderPassiveInfo(p) + renderSimpleCode('passive', p)))
    + '</div></div></section>';
}

/* ------------------------------ Buff 编辑 ------------------------------ */

/* ------------------------- 镜牢卡包 / 镜牢饰品（schema 驱动） ------------------------- */

const SIN_OPTS = [
  { id: 'CRIMSON', zh: '暴怒' }, { id: 'SCARLET', zh: '色欲' }, { id: 'AMBER', zh: '怠惰' },
  { id: 'SHAMROCK', zh: '暴食' }, { id: 'AZURE', zh: '忧郁' }, { id: 'INDIGO', zh: '傲慢' },
  { id: 'VIOLET', zh: '嫉妒' }, { id: 'WHITE', zh: '疯狂' }, { id: 'BLACK', zh: '哀叹' },
  { id: 'NEUTRAL', zh: '无属性' },
];
const PHYS_OPTS = [
  { id: 'SLASH', zh: '斩击' }, { id: 'HIT', zh: '打击' }, { id: 'PENETRATE', zh: '突刺' }, { id: 'NONE', zh: '无' },
];

async function ensureMdSchemas() {
  if (S.mdSchemas) return S.mdSchemas;
  const res = await api('/api/md/kinds');
  S.mdSchemas = res.kinds || [];
  return S.mdSchemas;
}

function mdSpec(kind) {
  return (S.mdSchemas || []).find((s) => s.kind === kind) || { kind, zh: '镜牢表', fields: [], nodeTypes: [], defaults: {} };
}

async function loadMdList(name, kind) {
  name = name || S.selected;
  kind = kind || S.mdKind;
  if (!name || !kind) return;
  const res = await api(`/api/md/list?kind=${kind}&name=${encodeURIComponent(name)}`);
  S.mdList = res.items || [];
}

/** 行内单元格写回：按列声明的类型清洗（nums 列必须存数组，否则渲染时 .join 会炸） */
function mdRowValue(key, colKey, raw, isNumberInput) {
  const spec = mdSpec(S.mdKind);
  const f = (spec.fields || []).find((x) => x.key === key);
  const c = f && Array.isArray(f.cols) ? f.cols.find((x) => x.key === colKey) : null;
  const type = c ? c.type : (isNumberInput ? 'number' : 'text');
  if (type === 'nums') {
    return String(raw || '').split(/[\s,，]+/).filter(Boolean)
      .map((x) => Number(x)).filter((n) => Number.isFinite(n));
  }
  if (type === 'number') return Number(raw) || 0;
  return raw;
}

/** 输入写回内存（不重绘，避免输入过程光标跳动） */
function mdSetField(el) {
  if (!S.md) return;
  const key = el.dataset.mdinfo;
  const spec = mdSpec(S.mdKind);
  const f = (spec.fields || []).find((x) => x.key === key);
  const type = f ? f.type : 'text';
  let v;
  if (type === 'bool') v = el.checked;
  else if (type === 'boolstr') v = el.checked ? 'true' : 'false';
  else if (type === 'number') v = Number(el.value) || 0;
  else if (type === 'nums') v = el.value.split(/[\s,，]+/).filter(Boolean).map((x) => Number(x)).filter((n) => Number.isFinite(n));
  else if (type === 'ids') v = el.value.split(/[\s,，]+/).filter(Boolean);
  else if (type === 'tags') v = el.value.split(/[\s,，]+/).filter(Boolean).map((x) => x.toUpperCase());
  else if (type === 'scripts') v = el.value.split(/[\n,，]+/).map((x) => x.trim()).filter(Boolean);
  else if (type === 'nodes' || type === 'rows' || type === 'pools' || type === 'mental') return;
  else v = el.value;
  S.md.entity[key] = v;
  S.mdDirty = true;
}

function mdEnumOptions(f) {
  if (Array.isArray(f.options)) return f.options;
  if (f.options === 'SIN') return SIN_OPTS;
  if (f.options === 'PHYSICAL') return PHYS_OPTS;
  return [];
}

function mdFieldHtml(f, entity) {
  const val = entity[f.key];
  const hint = f.hint ? `<div class="hint muted">${esc(f.hint)}</div>` : '';
  if (f.type === 'bool' || f.type === 'boolstr') {
    const on = f.type === 'boolstr' ? (val === true || val === 'true') : Boolean(val);
    return `<label class="field check"><input type="checkbox" data-mdinfo="${f.key}"${on ? ' checked' : ''}><span>${esc(f.zh)}</span></label>`;
  }
  if (f.type === 'enum') {
    const opts = mdEnumOptions(f).map((o) => `<option value="${o.id}"${String(o.id) === String(val) ? ' selected' : ''}>${esc(o.zh)}${o.id && o.id !== o.zh ? '（' + esc(o.id) + '）' : ''}</option>`).join('');
    return `<label class="field"><span>${esc(f.zh)}</span><select data-mdinfo="${f.key}">${opts}</select>${hint}</label>`;
  }
  if (f.type === 'object') {
    const cols = f.cols || [];
    const cells = cols.map((c) => `<label class="inline-field"><span>${esc(c.zh)}</span>${c.type === 'number'
      ? `<input type="text" inputmode="decimal" data-num="1" data-mdobj="${f.key}" data-col="${c.key}" value="${esc(val?.[c.key] ?? 0)}">`
      : `<input type="text" data-mdobj="${f.key}" data-col="${c.key}" value="${esc(val?.[c.key] ?? '')}">`}</label>`).join('');
    return `<div class="field wide"><span>${esc(f.zh)}</span><div class="md-row">${cells}</div>${hint}</div>`;
  }
  if (f.type === 'waves') {
    const unitBlock = (w, i, slot, label) => {
      const rows = (w[slot] || []).map((u, ui) => `<div class="md-row">
        <input type="text" inputmode="decimal" data-num="1" data-mdunit="unitID" data-wave="${i}" data-slot="${slot}" data-uindex="${ui}" value="${Number(u.unitID) || 0}" title="单位 id">
        <button class="btn ghost xs" data-act="pick" data-pick="unit" data-wave="${i}" data-slot="${slot}" data-uindex="${ui}" data-col="unitID" title="从游戏 / Mod 里挑敌人">挑</button>
        <input type="text" inputmode="decimal" data-num="1" min="1" data-mdunit="unitCount" data-wave="${i}" data-slot="${slot}" data-uindex="${ui}" value="${Number(u.unitCount) || 1}" title="数量">
        <input type="text" inputmode="decimal" data-num="1" min="1" data-mdunit="unitLevel" data-wave="${i}" data-slot="${slot}" data-uindex="${ui}" value="${Number(u.unitLevel) || 1}" title="等级">
        <button class="btn ghost sm" data-act="md-del-unit" data-wave="${i}" data-slot="${slot}" data-uindex="${ui}">×</button></div>`).join('');
      return `<div class="md-sub"><div class="col-title">${label}</div>${rows || '<div class="hint muted">还没有单位</div>'}
        <button class="btn ghost sm" data-act="md-add-unit" data-wave="${i}" data-slot="${slot}">＋ 加单位</button></div>`;
    };
    const waves = (val || []).map((w, i) => `<div class="md-wave">
      <div class="md-row"><span class="col-title">第 ${i + 1} 波</span><span class="muted">地图</span>
        <input type="text" data-mdwave="mapName" data-wave="${i}" value="${esc(w.mapName ?? '')}" placeholder="LCorpEntrance">
        <span class="muted">尺寸</span><input type="text" inputmode="decimal" data-num="1" data-mdwave="mapSize" data-wave="${i}" value="${esc(w.mapSize ?? 0)}">
        <span class="muted">敌人站位</span><input type="text" inputmode="decimal" data-num="1" data-mdwave="enemyPositionID" data-wave="${i}" value="${esc(w.enemyPositionID ?? 0)}">
        <button class="btn ghost sm" data-act="md-del-wave" data-wave="${i}">×</button></div>
      <div class="md-row"><span class="muted">BGM（逗号分隔）</span><input type="text" class="grow" data-mdwave="bgm" data-wave="${i}" value="${esc(w.bgm ?? '')}" placeholder="Battle_Cp1_Enemy_2"></div>
      ${unitBlock(w, i, 'units', '出场单位')}
      ${unitBlock(w, i, 'subUnits', '副单位')}</div>`).join('');
    return `<div class="field wide"><span>${esc(f.zh)}</span><div class="md-rows">${waves || '<div class="hint muted">还没有波次</div>'}</div>
      <button class="btn ghost sm" data-act="md-add-wave">＋ 加一波</button>${hint}</div>`;
  }
  if (f.type === 'nodes') {
    const rows = (val || []).map((n, i) => `<div class="md-row">
      <select data-mdnode-type data-index="${i}">${(mdSpec(S.mdKind).nodeTypes || []).map((t) => `<option value="${t.id}"${t.id === n.type ? ' selected' : ''}>${esc(t.zh)}</option>`).join('')}</select>
      <input type="text" inputmode="decimal" data-num="1" min="1" data-mdnode-count data-index="${i}" value="${Number(n.count) || 1}">
      <button class="btn ghost sm" data-act="md-del-node" data-index="${i}">×</button></div>`).join('');
    return `<div class="field wide"><span>${esc(f.zh)}</span><div class="md-rows">${rows || '<div class="hint muted">还没有节点</div>'}</div>
      <button class="btn ghost sm" data-act="md-add-node">＋ 加一个节点</button>${hint}</div>`;
  }
  if (f.type === 'rows') {
    const cols = f.cols || [];
    const cell = (c, row, i) => {
      if (c.type === 'number') {
        const pk = c.key === 'skillId' ? `<button class="btn ghost xs" data-act="pick" data-pick="skill" data-list="${f.key}" data-index="${i}" data-col="${c.key}" title="从游戏 / Mod 里挑技能">挑</button>`
          : c.key === 'rewardId' ? `<button class="btn ghost xs" data-act="pick" data-pick="gift" data-list="${f.key}" data-index="${i}" data-col="${c.key}" title="从饰品表里挑">挑</button>` : '';
        return `<input type="text" inputmode="decimal" data-num="1" data-mdrow="${c.key}" data-list="${f.key}" data-index="${i}" value="${esc(row[c.key] ?? '')}" title="${esc(c.zh)}">${pk}`;
      }
      if (c.type === 'nums') return `<input type="text" data-mdrow="${c.key}" data-list="${f.key}" data-index="${i}" value="${esc((row[c.key] || []).join(','))}" title="${esc(c.zh)}（逗号分隔）" placeholder="${esc(c.zh)}">`;
      if (c.type === 'enum') {
        const opts = mdEnumOptions(c).map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(row[c.key]) ? ' selected' : ''}>${esc(o.zh)}</option>`).join('');
        return `<select data-mdrow="${c.key}" data-list="${f.key}" data-index="${i}" title="${esc(c.zh)}">${opts}</select>`;
      }
      return `<input type="text" data-mdrow="${c.key}" data-list="${f.key}" data-index="${i}" value="${esc(row[c.key] ?? '')}" title="${esc(c.zh)}">`;
    };
    const rows = (val || []).map((row, i) => `<div class="md-row">${cols.map((c) => cell(c, row, i)).join('')}
      <button class="btn ghost sm" data-act="md-del-row" data-list="${f.key}" data-index="${i}">×</button></div>`).join('');
    return `<div class="field wide"><span>${esc(f.zh)}</span><div class="md-rows">${rows || '<div class="hint muted">还没有条目</div>'}</div>
      <button class="btn ghost sm" data-act="md-add-row" data-list="${f.key}">＋ 加一条</button>${hint}</div>`;
  }
  if (f.type === 'pools') {
    const cells = (f.cols || []).map((c) => `<label class="inline-field"><span>${esc(c.zh)}</span>
      <input type="text" data-mdpool="${c.key}" value="${esc(((val || {})[c.key] || []).join(','))}" placeholder="id, id"></label>`).join('');
    return `<div class="field wide"><span>${esc(f.zh)}</span><div class="md-row">${cells}</div>${hint}</div>`;
  }
  if (f.type === 'mental') {
    const rows = (val || []).map((row, i) => `<div class="md-row">
      <select data-mdrow="group" data-list="${f.key}" data-index="${i}">
        <option value="add"${row.group === 'add' ? ' selected' : ''}>加成</option>
        <option value="min"${row.group === 'min' ? ' selected' : ''}>减益</option></select>
      <input type="text" inputmode="decimal" data-num="1" data-mdrow="level" data-list="${f.key}" data-index="${i}" value="${esc(row.level ?? 1)}" title="等级">
      <input type="text" class="grow" data-mdrow="conditionIDs" data-list="${f.key}" data-index="${i}" value="${esc((row.conditionIDs || []).join(','))}" placeholder="条件 id，逗号分隔">
      <button class="btn ghost sm" data-act="md-del-row" data-list="${f.key}" data-index="${i}">×</button></div>`).join('');
    return `<div class="field wide"><span>${esc(f.zh)}</span><div class="md-rows">${rows || '<div class="hint muted">还没有条目</div>'}</div>
      <button class="btn ghost sm" data-act="md-add-row" data-list="${f.key}">＋ 加一条</button>${hint}</div>`;
  }
  if (f.type === 'ids' || f.type === 'tags' || f.type === 'nums') {
    const pk = f.key === 'abnormalityPartList' ? `<button class="btn ghost xs" data-act="pick" data-pick="part" data-field="${f.key}" title="从游戏 / Mod 里挑部位">挑</button>`
      : (f.key === 'egoGiftPool' || f.key === 'fixedRewardEgoGifts') ? `<button class="btn ghost xs" data-act="pick" data-pick="gift" data-field="${f.key}" title="从饰品表里挑">挑</button>` : '';
    return `<label class="field"><span>${esc(f.zh)}</span><span class="inline-field"><input type="text" data-mdinfo="${f.key}" value="${esc((val || []).join(', '))}">${pk}</span>${hint}</label>`;
  }
  if (f.type === 'scripts') {
    return `<label class="field wide"><span>${esc(f.zh)}</span><textarea data-mdinfo="${f.key}" rows="4" spellcheck="false">${esc((val || []).join('\n'))}</textarea>${hint}</label>`;
  }
  if (f.type === 'number') {
    return `<label class="field"><span>${esc(f.zh)}</span><input type="text" inputmode="decimal" data-num="1" data-mdinfo="${f.key}" value="${esc(val ?? '')}">${hint}</label>`;
  }
  return `<label class="field"><span>${esc(f.zh)}</span><input type="text" data-mdinfo="${f.key}" value="${esc(val ?? '')}">${hint}</label>`;
}

/* ---------------------------- 挑选器（挑一个 id） ---------------------------- */

function pkRowHtml(it) {
  const name = esc(it.name || it.nameZh || ('#' + it.id));
  const zh = it.nameZh && it.nameZh !== it.name ? `<span class="muted">${esc(it.nameZh)}</span>` : '';
  const meta = [it.id, it.meta, it.source === 'mod' ? 'Mod:' + it.mod : ''].filter(Boolean).map(esc).join(' · ');
  return `<button class="item" data-act="pk-use" data-id="${esc(it.id)}">
    <span class="item-name">${name}</span>${zh}
    <span class="muted">${meta}</span></button>`;
}

function pkRender() {
  const list = document.getElementById('pk-list');
  if (!list) return;
  const items = S.pick.items || [];
  list.innerHTML = items.length ? items.map(pkRowHtml).join('') : '<div class="hint muted">没有匹配</div>';
  const count = document.getElementById('pk-count');
  if (count) count.textContent = `共 ${S.pick.total || items.length} 条${items.length < (S.pick.total || 0) ? `（显示前 ${items.length} 条）` : ''}`;
}

async function pkLoad(q) {
  const kw = q === undefined ? S.pick.q : q;
  S.pick.q = kw || '';
  const res = await api(`/api/pick/list?kind=${S.pick.kind}&q=${encodeURIComponent(S.pick.q)}&limit=80`);
  S.pick.items = res.items || [];
  S.pick.total = res.total || 0;
  pkRender();
}

function openPicker(kind, cb) {
  S.pick = { kind, cb, q: '', items: [], total: 0 };
  modal({
    title: '挑一个' + (PICK_ZH[kind] || kind),
    body: '<div class="sd-wrap">'
      + '<div class="sd-bar"><input class="p-search" id="pk-q" placeholder="搜名字 / 中文名 / id，例如 骨斩 或 Iori 或 9001" autocomplete="off"></div>'
      + '<div class="sd-list" id="pk-list"><div class="muted">载入中…</div></div>'
      + '<div class="muted" id="pk-count"></div>'
      + '<div class="hint muted">列表包含游戏原版与已经加载的 Mod；点一条就填进当前字段。</div>'
      + '</div>',
    footer: '<button class="btn ghost" data-act="close-modal">关闭</button>',
  });
  pkLoad('').catch((err) => toast(err && err.message ? err.message : '读取列表失败', 'error'));
  setTimeout(() => { const i = document.getElementById('pk-q'); if (i) i.focus(); }, 30);
}

function renderMdArea(back, kind) {
  const spec = mdSpec(kind);
  const q = (S.mdSearch || '').trim().toLowerCase();
  const rows = (S.mdList || []).filter((r) => !q || String(r.id).includes(q) || String(r.name || '').toLowerCase().includes(q))
    .map((r) => `<button class="item ${S.mdId === String(r.id) ? 'active' : ''}" data-act="open-md" data-id="${esc(r.id)}" title="${esc(String(r.id) + ' · ' + (r.name || '未命名'))}">
      <div class="item-main"><strong>${esc(r.name || '未命名')}</strong><small>${esc(r.id)}${r.applied ? ' · 已落地' : ' · 草稿'}</small></div>
      <span class="state-dot ${r.applied ? 'on' : ''}"></span></button>`).join('');
  const disabled = S.mods.find((m) => m.name === S.selected)?.enabled === false;
  return `<div class="pane-head">${back}<div><h2>${esc(spec.zh)}</h2><p class="muted">${esc(S.selected || '')}</p></div></div>`
    + (disabled ? '<div class="banner red">该 Mod 正在被禁用的状态 · 修改仍会保存到磁盘，但不会在游戏中生效</div>' : '')
    + '<div class="skill-wrap">'
    + `<section class="panel"><div class="panel-head">${esc(spec.zh)} <span class="count">${(S.mdList || []).length}</span></div>`
    + `<div class="panel-search"><input id="md-search" class="search" placeholder="搜索 id / 名称" value="${esc(S.mdSearch || '')}"></div>`
    + `<div class="panel-body list">${rows || `<div class="list-empty">还没有自定义${esc(spec.zh)}</div>`}</div>`
    + `<div class="panel-foot two"><button class="btn ghost sm" data-act="new-md">＋ 新建</button><button class="btn ghost sm" data-act="apply-md-all">⇪ 批量落地</button></div></section>`
    + renderMdMain(spec, kind)
    + '</div>';
}

function renderMdMain(spec, kind) {
  if (!S.md) {
    return `<section class="panel skill-main"><div class="panel-head">${esc(spec.zh)}</div><div class="panel-body">`
      + `<div class="empty-state"><div class="empty-mark">${esc(spec.ico || '▦')}</div><p>从左侧选一个${esc(spec.zh)}</p><small class="muted">或新建</small></div></div></section>`;
  }
  const ent = S.md.entity || {};
  const loc = S.md.locale || {};
  const fields = (spec.fields || []).map((f) => mdFieldHtml(f, ent)).join('');
  return `<section class="panel skill-main"><div class="panel-head skill-head">`
    + `<div class="skill-title"><strong>${loc.name ? esc(loc.name) : '<span class="muted">未命名草稿</span>'}</strong><small>${esc(S.mdId)}${S.md.applied ? ' · 已落地' : ' · 仅草稿'}</small></div>`
    + '<span class="spacer"></span>'
    + (CLONE_FROM[kind] ? `<button class="btn ghost sm" data-act="md-clone" title="从游戏原版或已加载 Mod 里挑一条载入成新草稿">载入现有${esc(spec.zh)}</button>` : '')
    + `<button class="btn ghost sm" data-act="delete-md">删除草稿</button>`
    + (S.md.applied ? `<button class="btn ghost sm" data-act="md-remove-landed">撤掉落地</button>` : '')
    + `<button class="btn ghost sm" data-act="apply-md">落地到游戏文件</button>`
    + `<button class="btn primary sm" data-act="save-md">保存</button>`
    + `<span class="session-state ${S.mdDirty ? 'dirty' : ''}">${S.mdDirty ? '有未保存改动' : '已保存'}</span></div>`
    + '<div class="skill-body"><div class="info-card"><div class="col-title">基础信息</div><div class="grid-2">'
    + `<label class="field"><span>名称（EN）<em class="muted">必填，写进 EN 本地化</em></span><input type="text" id="md-name" value="${esc(loc.name || '')}" placeholder="游戏里显示的名字"></label>`
    + `<label class="field"><span>名称（CN）</span><input type="text" id="md-name-zh" value="${esc(loc.nameZh || '')}" placeholder="留空＝与 EN 相同"></label>`
    + `<label class="field"><span>id</span><input type="text" value="${esc(S.mdId)}" disabled></label>`
    + '</div>'
    + `<label class="field"><span>描述（EN）</span><textarea id="md-desc" rows="3">${esc(loc.desc || '')}</textarea></label>`
    + `<label class="field"><span>描述（CN）</span><textarea id="md-desc-zh" rows="2" placeholder="留空＝与 EN 相同">${esc(loc.descZh || '')}</textarea></label>`
    + `<div class="hint muted">${spec.localeCat === null ? '这张表不写 locale：名称/描述只留在编辑器草稿里，游戏里按 id 引用。' : '名称与描述只写 custom_limbus_locale/EN（游戏默认只加载 EN）。'}</div></div>`
    + `<div class="editor-card"><div class="col-title">${esc(spec.zh)}字段</div><div class="grid-2">${fields}</div>`
    + '<div class="hint muted">字段表在服务端 lethe/mdtables.mjs 的 MD_KINDS 里；游戏侧字段名一旦确认，只改那一处即可。</div></div>'
    + '</div></section>';
}


/* ---------------------------- 镜牢编辑（顶层页） ---------------------------- */

async function enterMdView() {
  await ensureMdSchemas();
  S.mdKind = null; S.md = null; S.mdId = null; S.mdDirty = false;
  render();
}

function renderMdView() {
  const kinds = S.mdSchemas || [];
  const kind = S.mdKind && MD_UI.includes(S.mdKind) ? S.mdKind : null;
  const body = kind
    ? renderMdArea('<button class="btn ghost sm" data-act="md-back">← 返回</button>', kind)
    : '<div class="pane-head"><div><h2>镜牢编辑</h2><p class="muted">'
      + esc(S.selected || '先从左侧选一个 Mod') + ' · 共 ' + kinds.length + ' 类数据</p></div></div>'
      + '<div class="wiz-grid">' + kinds.map((k) => '<button class="wiz" data-act="md-kind" data-kind="' + esc(k.kind) + '"><span class="wiz-ico">' + esc(k.ico || '▦') + '</span><strong>' + esc(k.zh) + '</strong><small>' + esc(k.sub || '') + '</small></button>').join('') + '</div>';
  return '<div class="layout edit ' + (S.listCollapsed ? 'list-collapsed' : '') + '">'
    + '<section class="panel list-panel"><div class="lp-full">'
    + '<div class="panel-head">MOD 列表 <span class="count">' + S.mods.length + '</span></div>'
    + '<div class="panel-body list">' + (S.mods.map(modRow).join('') || '<div class="list-empty">mods 目录是空的</div>') + '</div></div>'
    + '<div class="lp-mini"><div class="panel-body list">' + S.mods.map(modRowMini).join('') + '</div></div></section>'
    + '<section class="panel edit-pane">' + body + '<div class="dock-mini" id="session-hint"></div></section></div>';
}

function renderBuffArea(back) {
  const q = (S.buffSearch || '').trim().toLowerCase();
  const rows = (S.buffs || []).filter((b) => !q || String(b.id).toLowerCase().includes(q) || String(b.name || '').toLowerCase().includes(q))
    .map((b) => '<button class="item ' + (S.buffId === String(b.id) ? 'active' : '') + '" data-act="open-buff" data-id="' + esc(b.id) + '" title="' + esc(String(b.id) + ' · ' + buffOwnerTag(b.id, S.selected, 'mod')) + '">'
      + '<div class="item-main"><strong>' + esc(b.name || b.id) + '</strong><small>' + esc(b.id)
      + (b.override ? ' · 原版覆盖' : '') + (b.maxStack ? ' · ' + b.maxStack + ' 层' : '') + ' · ' + esc(buffOwnerTag(b.id, S.selected, 'mod')) + '</small></div>'
      + '<span class="state-dot ' + (b.updatedAt ? 'on' : '') + '"></span></button>').join('');
  const disabled = S.mods.find((m) => m.name === S.selected)?.enabled === false;
  return '<div class="pane-head">' + back + '<div><h2>Buff 编辑</h2><p class="muted">' + esc(S.selected || '') + '</p></div></div>'
    + (disabled ? '<div class="banner red">该 Mod 正在被禁用的状态 · 修改仍会保存到磁盘，但不会在游戏中生效</div>' : '')
    + '<div class="skill-wrap">'
    + '<section class="panel"><div class="panel-head">Buff <span class="count">' + (S.buffs || []).length + '</span></div>'
    + '<div class="panel-search"><input id="buff-search" class="search" placeholder="搜索 id / Buff 名" value="' + esc(S.buffSearch) + '"></div>'
    + '<div class="panel-body list">' + (rows || '<div class="list-empty">还没有自定义 Buff</div>') + '</div>'
    + '<div class="panel-foot two"><button class="btn ghost sm" data-act="new-buff">＋ 新建</button><button class="btn ghost sm" data-act="import-buff">⇩ 导入</button></div></section>'
    + renderBuffMain()
    + renderModulePanel('module-search2', S.moduleSearch2)
    + '</div>';
}

function buffFieldInput(b, key, label, type, extra) {
  const fi = b.fileInfo || {};
  const val = fi[key] == null ? '' : fi[key];
  return '<label class="field"><span>' + esc(label) + '</span><input type="' + (type || 'number') + '" data-bfield="' + esc(key) + '" value="' + esc(val) + '" ' + (extra || '') + '></label>';
}

function buffFieldCheck(b, key, label) {
  const fi = b.fileInfo || {};
  return '<label class="field check"><input type="checkbox" data-bfield="' + esc(key) + '"' + (fi[key] ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
}

function buffFieldList(b, key, label, hint) {
  const fi = b.fileInfo || {};
  const arr = Array.isArray(fi[key]) ? fi[key] : [];
  return '<label class="field"><span>' + esc(label) + '</span><input type="text" data-bfield="' + esc(key) + '" data-bfield-list="1" value="' + esc(arr.join(', ')) + '" placeholder="' + esc(hint || '多个值用英文逗号分隔') + '"></label>';
}

function buffFileFields(b) {
  const fi = b.fileInfo || null;
  if (!fi) return '<div class="hint muted">这个 Buff 在文件里还没有实体字段。</div>';
  const sins = (S.keywords && S.keywords.sins) || [];
  const sinOpts = '<option value="">（未设置）</option>' + sins.map((x) => '<option value="' + esc(x.id) + '"' + (String(x.id) === String(fi.attributeType || '') ? ' selected' : '') + '>' + esc(x.zh || x.id) + '</option>').join('');
  const sinSel = '<label class="field"><span>罪孽属性</span><select data-bfield="attributeType">' + sinOpts + '</select></label>';
  return '<div class="grid-2">'
    + buffFieldCheck(b, 'destroyableOnZero', '销毁条件 · 强度归零')
    + buffFieldCheck(b, 'destroyableOnZeroTurn', '销毁条件 · 层数归零')
    + buffFieldCheck(b, 'destroyableOnDie', '销毁条件 · 携带者死亡')
    + buffFieldCheck(b, 'destroyableOnRetreat', '销毁条件 · 撤退')
    + buffFieldCheck(b, 'destroyableOnBothZero', '销毁条件 · 两者同时归零')
    + sinSel
    + buffFieldInput(b, 'stackLimitPerTurn', '每回合叠加上限', 'number', 'min="0" max="9999"')
    + buffFieldInput(b, 'totalStack', '总层数上限', 'number', 'min="0" max="9999"')
    + buffFieldList(b, 'subIdList', '子 Buff（subIdList）', '例如：SubA, SubB')
    + buffFieldList(b, 'categoryKeywordList', '分类关键词（categoryKeywordList）', '例如：LACERATION, BLEED')
    + '</div>'
    + '<div class="meta-row"><span class="muted">脚本条数（list）</span><b>' + String(fi.listCount || 0) + '</b></div>'
    + '<div class="hint muted">留空写回时会删掉该字段（游戏用默认值）；数字范围 0–9999。</div>';
}

function buffScriptList(b) {
  const fromFile = (b && b.fileInfo && Array.isArray(b.fileInfo.listEntries)) ? b.fileInfo.listEntries.slice() : [];
  const draft = Array.isArray(S.buffScripts) ? S.buffScripts : null;
  return draft || fromFile;
}

function buffScriptKind(text) {
  const t = String(text || '').trim();
  if (!t) return { zh: '空', cls: 'pr-raw' };
  if (/TIMING:/.test(t)) return { zh: 'Modular 积木脚本', cls: 'pr-mod' };
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(t)) return { zh: '原生脚本名', cls: 'pr-tag' };
  return { zh: '其它文本', cls: 'pr-raw' };
}

/** 脚本条目里除 ability 之外的其它 JSON 字段（原样展示、可编辑）。 */
function bsExtraOf(b, i) {
  const raw = b && b.fileInfo && Array.isArray(b.fileInfo.listRaw) ? b.fileInfo.listRaw[i] : null;
  const obj = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  Object.keys(obj).forEach((k) => { if (k !== 'ability') out[k] = obj[k]; });
  return out;
}

function bsExtraBlock(b, i) {
  const fromDraft = Array.isArray(S.buffExtras) && typeof S.buffExtras[i] === 'string' ? S.buffExtras[i] : null;
  const obj = bsExtraOf(b, i);
  const text = fromDraft != null ? fromDraft : (Object.keys(obj).length ? JSON.stringify(obj, null, 2) : '{}');
  const empty = fromDraft == null && !Object.keys(obj).length;
  return '<details class="bs-extra"' + (fromDraft != null ? ' open' : '') + '><summary>其他字段（JSON）' + (empty ? ' · 无' : '') + '</summary>'
    + '<textarea class="desc-input bs-json" data-buff-extra="' + i + '" spellcheck="false" rows="4">' + esc(text) + '</textarea>'
    + '<div class="hint muted">这条脚本在文件里除 ability 以外的字段（例如 value / turnLimit / buffData）。写 {} 表示清空这些字段。</div>'
    + '</details>';
}

function renderBuffScriptsEditor(b) {
  const list = buffScriptList(b);
  const dirty = Array.isArray(S.buffScripts);
  const cards = list.map((raw, i) => {
    const k = buffScriptKind(raw);
    const lines = String(raw || '').split('\n').length;
    return '<div class="pr-card">'
      + '<div class="pr-head"><span class="pr-hat">脚本 ' + (i + 1) + '</span>'
      + '<span class="pr-tag ' + k.cls + '">' + esc(k.zh) + '</span>'
      + (String(raw || '').length ? '<span class="pr-tag">' + String(raw || '').length + ' 字符</span>' : '')
      + '<button class="btn ghost sm" data-act="buff-script-del" data-i="' + i + '">删除</button></div>'
      + '<textarea class="desc-input bs-text" data-buff-script="' + i + '" spellcheck="false" rows="' + Math.max(2, Math.min(10, lines + 1)) + '" placeholder="留空表示删除这条脚本">' + esc(String(raw || '')) + '</textarea>'
      + bsExtraBlock(b, i)
      + '</div>';
  }).join('');
  const empty = list.length ? '' : '<div class="muted" style="padding:8px 2px">这个 Buff 在文件里还没有脚本；可以新建一条，或从右侧模块拖入后保存生成。</div>';
  return '<div class="editor-card" style="margin-top:10px">'
    + '<div class="col-title">脚本（可编辑）<span class="muted"> · ' + list.length + ' 条' + (dirty ? ' · 有未保存的脚本改动' : '') + '</span></div>'
    + '<div class="hint muted">这里直接读写 Buff 实体里的 <code>list[].ability</code>：Modular 积木脚本会解析成上面的卡片；原生脚本名（如 <code>MinSpeedAdder</code>）是游戏内置效果，可改名但不能在这里展开。</div>'
    + empty
    + '<div class="bs-list">' + cards + '</div>'
    + '<div class="row-actions" style="display:flex;gap:8px;margin-top:8px">'
    + '<button class="btn ghost sm" data-act="buff-script-add">＋ 新增一条</button>'
    + '<button class="btn primary sm" data-act="buff-script-save"' + (dirty ? '' : ' disabled') + '>保存脚本</button>'
    + '<button class="btn ghost sm" data-act="buff-script-reset"' + (dirty ? '' : ' disabled') + '>还原</button>'
    + '</div></div>';
}

function renderBuffMain() {
  if (!S.buff) {
    return '<section class="panel skill-main"><div class="panel-head">Buff</div><div class="panel-body">'
      + '<div class="empty-state"><div class="empty-mark">❖</div><p>从左侧选一个 Buff</p><small class="muted">或新建 / 导入</small></div></div></section>';
  }
  const b = S.buff;
  const info = b.info || {};
  const sess = S.session || {};
  const classes = S.keywords?.buffClasses || [{ id: 'NonvolatileBuff', zh: '常驻（NonvolatileBuff）' }, { id: 'VolatileBuff', zh: '挥发（VolatileBuff）' }];
  const types = S.keywords?.buffTypes || [{ id: 'Positive', zh: '增益' }, { id: 'Negative', zh: '减益' }, { id: 'Neutral', zh: '中性' }];
  const opt = (arr, v) => arr.map((x) => '<option value="' + esc(x.id) + '"' + (String(x.id) === String(v) ? ' selected' : '') + '>' + esc(x.zh || x.id) + '</option>').join('');
  const field = (label, key, type, extra) => '<label class="field"><span>' + label + '</span><input type="' + (type || 'number') + '" data-binfo="' + key + '" value="' + esc(info[key] ?? '') + '" ' + (extra || '') + '></label>';
  const sel = (label, key, arr) => '<label class="field"><span>' + label + '</span><select data-binfo="' + key + '">' + opt(arr, info[key]) + '</select></label>';
  return '<section class="panel skill-main"><div class="panel-head skill-head">'
    + '<div class="skill-title"><strong>' + esc(b.name || b.id) + '</strong><small>' + esc(b.id) + (b.override ? ' · 原版覆盖' : '') + '</small></div>'
    + '<span class="spacer"></span>'
    + '<button class="btn ghost sm" data-act="undo"' + (sess.undo ? '' : ' disabled') + '>撤销</button>'
    + '<button class="btn ghost sm" data-act="redo"' + (sess.redo ? '' : ' disabled') + '>重做</button>'
    + '<button class="btn primary sm" data-act="save-buff">保存</button>'
    + '<span class="session-state ' + (sess.dirty ? 'dirty' : '') + '" id="session-state">' + (sess.dirty ? '有未保存改动' : '已保存') + '</span></div>'
    + '<div class="skill-body"><div class="info-card"><div class="col-title">Buff 基础信息</div><div class="grid-2">'
    + sel('Buff 种类', 'buffClass', classes) + sel('正负 Buff', 'buffType', types)
    + field('最大强度', 'maxStack') + field('最大层数', 'maxTurn', 'number')
    + field('Buff 图像', 'iconId', 'text') + field('所属', 'special', 'text')
    + '</div>'
    + '<label class="field check"><input type="checkbox" data-binfo="canBeDespelled"' + (info.canBeDespelled !== false ? ' checked' : '') + '><span>可被净化</span></label>'
    + '<div class="hint muted">「所属」留空表示普通 Buff；填关键词表示该 Buff 的特殊归属。</div>'
    + '<div class="col-title" style="margin-top:14px">文件字段 <span class="muted">（改动即时写盘）</span></div>'
    + buffFileFields(b)
    + '</div>'
    + '<div class="editor-card"><div class="tabs">'
    + '<button class="tab ' + (S.buffTab === 'code' ? 'active' : '') + '" data-act="buff-tab" data-tab="code">代码</button>'
    + '<button class="tab ' + (S.buffTab === 'desc' ? 'active' : '') + '" data-act="buff-tab" data-tab="desc">描述</button></div>'
    + (S.buffTab === 'desc' ? renderSimpleDesc('buff', b) : (renderSimpleCode('buff', b) + renderBuffScriptsEditor(b)))
    + '</div></div></section>';
}

/* --------------------------- 被动 / Buff 共用块 --------------------------- */


/* -------------------- 被动：识别文件里已有的模块脚本 -------------------- */
const P_TARGET_ZH_LITE = {
  Self: '自身', Target: '目标', MainTarget: '主目标', SubTarget: '副目标', Victim: '被击倒者', Killer: '击杀者',
  EveryAlly: '所有友方', EveryEnemy: '所有敌方', EveryTarget: '所有目标', All: '全体', RandomAlly: '随机友方',
  RandomEnemy: '随机敌方', AllyExceptSelf: '除自身外友方', EnemyExceptSelf: '除自身外敌方', ExceptSelf: '除自身',
  ExceptTarget: '除目标', SelfCore: '自身本体', SelfParts: '自身部位', TargetCore: '目标本体', TargetParts: '目标部位',
};

function pTargetLabel(n) {
  const raw = String(n || '');
  const base = raw.replace(/\$[A-Za-z0-9_]+$/, '');
  const kw = raw.slice(base.length);
  const zh = P_TARGET_ZH_LITE[base];
  return (zh ? zh + (base !== 'Self' && base !== 'Target' ? '（' + base + '）' : '') : base)
    + (kw ? ' · ' + kw.slice(1) : '');
}

function pValueLabel(v) {
  if (!v) return '<空>';
  if (v.t === 'target') return pTargetLabel(v.n) + (v.c === null || v.c === undefined ? '' : ' × ' + v.c);
  if (v.t === 'var') return String(v.n);
  if (v.t === 'n') return String(v.v);
  if (v.t === 's') return String(v.v);
  if (v.t === 'math') {
    const head = pValueLabel(v.first);
    return 'math(' + head + (v.tail || []).map((t) => ' ' + t.op + ' ' + pValueLabel(t.val)).join('') + ')';
  }
  if (v.t === 'acq') {
    const args = (v.a || []).filter(Boolean).map(pValueLabel);
    return v.n + '(' + args.join(', ') + ')';
  }
  return '?';
}

function pCondLabel(b) {
  const logic = b.logic && b.logic !== 'none' ? b.logic.toUpperCase() + ' ' : '';
  const list = (b.conds || []).map((c) => pValueLabel(c.left) + ' ' + (c.op || '>') + ' ' + pValueLabel(c.right));
  return logic + list.join('，');
}

function pStmtLabel(b) {
  if (!b) return '';
  if (b.k === 'cons') return b.n + '(' + (b.a || []).map((x) => pValueLabel(x)).join(', ') + ')';
  if (b.k === 'assign') return b.var + ' ← ' + pValueLabel(b.val);
  if (b.k === 'if') return '如果 ' + pCondLabel(b);
  if (b.k === 'ifnot') return '如果不 ' + pCondLabel(b);
  if (b.k === 'continueif') return '否则跳过（' + pCondLabel(b) + '）';
  if (b.k === 'raw') return b.text;
  return '';
}

function pParsedTree(list, depth) {
  const d = depth || 0;
  return (list || []).map((b) => '<div class="pr-line" style="padding-left:' + (d * 16) + 'px">'
    + '<span class="pr-dot"></span>' + esc(pStmtLabel(b)) + '</div>'
    + (Array.isArray(b.body) && b.body.length ? pParsedTree(b.body, d + 1) : '')).join('');
}

function pTimingLabel(en) {
  const list = (S.keywords && S.keywords.timings) || [];
  const hit = list.find((x) => String(x.en) === String(en));
  return hit && hit.zh ? hit.zh + ' · ' + en : String(en || '');
}

function renderPassiveScripts(p) {
  const parsed = p.parsed || { rows: [] };
  const rows = parsed.rows || [];
  if (!rows.length) { return ''; }
  const matched = p.matchedModules || [];
  const modName = (mid) => {
    const m = (S.modules || []).find((x) => x.id === mid);
    return m ? (m.name || mid) : mid;
  };
  const cards = rows.map((r, i) => {
    const mod = matched[i] ? modName(matched[i]) : '';
    return '<div class="pr-card">'
      + '<div class="pr-head">'
      + '<span class="pr-hat">' + (r.timing ? '⚑ ' + esc(pTimingLabel(r.timing)) : '未识别时点') + '</span>'
      + (r.loop ? '<span class="pr-tag">遍历 ' + esc(pTargetLabel(r.loop.n)) + (r.loop.c ? ' × ' + r.loop.c : '') + '</span>' : '')
      + '<span class="pr-tag">' + (r.blockCount || 0) + ' 个块</span>'
      + (mod ? '<span class="pr-tag pr-mod">模块：' + esc(mod) + '</span>' : '<span class="pr-tag pr-raw">外部脚本</span>')
      + '</div>'
      + (mod ? '' : '<div class="pr-tree">' + pParsedTree(r.stmts, 0) + '</div>')
      + '<details class="pr-code"><summary>脚本原文</summary><pre>' + esc(r.code) + '</pre></details>'
      + '</div>';
  }).join('');
  return '<div class="pr-wrap"><div class="col-title">已识别的脚本 <span class="muted">（' + rows.length + ' 条，来自被动文件 requireIDList）</span></div>'
    + '<div class="hint muted">这里只做识别：改脚本请用上方的模块置入区或到模块编辑里改模块。</div>'
    + cards + '</div>';
}

function renderSimpleCode(kind, doc) {
  const code = doc.code || { modules: [] };
  const chips = chipHtml(code.modules, kind, -1);
  return '<div class="code-wrap code-simple"><div class="code-col"><div class="col-title">' + (kind === 'passive' ? '被动' : 'Buff') + '置入区</div>'
    + '<div class="drop-zone ' + kind + '-zone" data-drop="' + kind + '">'
    + (chips || '<span class="dz-hint">把右侧模块拖到这里</span>') + '</div></div>'
    + '<div class="hint muted">从右侧模块列表拖入；这里只记录排布，尚未落到游戏脚本（映射留待后续版本）。</div>'
    + renderPassiveScripts(doc) + '</div>';
}

function renderSimpleDesc(kind, doc) {
  const id = kind === 'passive' ? 'passive-desc' : 'buff-desc';
  const text = typeof doc.description === 'string' ? doc.description : '';
  const st = kind === 'passive' ? (S.pDescCheck || { tokens: [], unknown: [] }) : (S.bDescCheck || { tokens: [], unknown: [] });
  const fromFile = Boolean(doc) && doc.descriptionSource === 'locale';
  const fromVanilla = Boolean(doc) && doc.descriptionSource === 'vanilla';
  const fileWord = kind === 'passive' ? '被动' : 'Buff';
  return '<div class="desc-wrap"><div class="desc-block"><div class="desc-block-head"><strong>描述</strong><span class="muted">用 [关键词] 书写，保存时转游戏格式</span></div>'
    + (fromFile ? '<div class="banner soft">这份描述是从' + fileWord + '文件里的游戏写法还原出来的（[英文id] → 中文名）；保存后会再转回英文写进 locale。</div>' : '')
+ (fromVanilla ? '<div class="banner soft">本 Mod 没有写这份' + fileWord + '的描述，下面是从游戏原版文案还原的（[英文id] → 中文名）；修改并保存后会写进本 Mod 的 locale，形成覆盖。</div>' : '')
    + '<textarea id="' + id + '" class="desc-input" spellcheck="false" rows="10" placeholder="例如：[回合开始时]获得1层[烧伤]">' + esc(text) + '</textarea>'
    + '<div class="desc-preview" id="' + id + '-preview">' + highlightText(text, st.tokens || []) + '</div>'
    + '<div class="desc-check ' + ((st.unknown || []).length ? 'bad' : 'ok') + '" id="' + id + '-check">'
    + ((st.unknown || []).length ? '⚠ 有 ' + st.unknown.length + ' 个关键词未识别：' + st.unknown.map((u) => '[' + u + ']').join(' ') : '✓ 关键词检查通过')
    + '</div></div></div>';
}

let pDescTimer = null;
let bDescTimer = null;
let pInfoTimer = null;
let bInfoTimer = null;

function readBuffFields() {
  const out = {};
  document.querySelectorAll('[data-bfield]').forEach((el) => {
    const key = el.dataset.bfield;
    if (!key) return;
    if (el.type === 'checkbox') out[key] = el.checked;
    else if (el.dataset.bfieldList === '1') out[key] = String(el.value || '').split(',').map((x) => x.trim()).filter(Boolean);
    else if (el.type === 'number') out[key] = el.value === '' ? null : Number(el.value);
    else out[key] = el.value;
  });
  return out;
}

async function flushBuffFields() {
  if (!S.buff) return;
  const fields = readBuffFields();
  if (!Object.keys(fields).length) return;
  const res = await api('/api/buff/fields', { method: 'POST', body: { name: S.selected, id: S.buffId, fields } });
  if (res && res.session) { S.session = res.session; pSessionDom(); }
  if (res && res.changed) {
    await reloadBuff();
  }
}

function scheduleBInfo() { clearTimeout(bInfoTimer); bInfoTimer = setTimeout(() => flushBInfo().catch((e) => toast(e.message, 'error')), 400); }

async function checkPDesc() {
  if (!S.passive) return;
  S.pDescCheck = await checkText(S.passive.description || '');
}
async function checkBDesc() {
  if (!S.buff) return;
  S.bDescCheck = await checkText(S.buff.description || '');
}

async function flushPDesc() {
  await flushPInfo();
}

async function flushBDesc() {
  if (!S.buff) return;
  const ta = document.getElementById('buff-desc');
  if (!ta || ta.value === (S.buff.description || '')) return;
  const res = await api('/api/buff/meta', { method: 'POST', body: { name: S.selected, id: S.buffId, description: ta.value } });
  S.buff = { ...S.buff, description: ta.value };
  S.session = res.session;
  await checkBDesc();
  render();
}

function readPInfo() {
  const info = { ...(S.passive?.info || {}) };
  const modeEl = document.querySelector('.seg.active[data-p-mode]');
  info.conditionMode = modeEl ? String(modeEl.dataset.pMode) : (info.conditionMode || 'none');
  const collect = (which) => {
    const rows = Array.from(document.querySelectorAll('[data-pcond="' + which + '"]'));
    const seen = new Set();
    const out = [];
    for (const sel of rows) {
      const i = sel.dataset.idx;
      const type = String(sel.value || 'CRIMSON');
      const valEl = document.querySelector('[data-pcond-val="' + which + '"][data-idx="' + i + '"]');
      const value = Math.max(1, Math.min(99, Number(valEl && valEl.value) || 1));
      if (seen.has(type)) continue;
      seen.add(type);
      out.push({ type, value });
    }
    return out;
  };
  info.stockConditions = info.conditionMode === 'stock' ? collect('stock') : [];
  info.resonanceConditions = info.conditionMode === 'resonance' ? collect('resonance').slice(0, 1) : [];
  return info;
}

function readBInfo() {
  const info = { ...(S.buff?.info || {}) };
  document.querySelectorAll('[data-binfo]').forEach((el) => {
    const k = el.dataset.binfo;
    if (el.type === 'checkbox') info[k] = el.checked;
    else if (el.type === 'number') info[k] = Number(el.value) || 0;
    else info[k] = el.value;
  });
  return info;
}

function pSessionDom() {
  const el = document.getElementById('session-state');
  if (el) {
    const dirty = Boolean(S.session && S.session.dirty);
    el.className = 'session-state' + (dirty ? ' dirty' : '');
    el.textContent = dirty ? '有未保存改动' : '已保存';
  }
}

async function flushPInfo() {
  if (!S.passive) return;
  const info = readPInfo();
  const nameEl = document.getElementById('p-name');
  const descEl = document.getElementById('p-desc');
  const displayName = nameEl ? nameEl.value : (S.passive.localeName || S.passive.name || '');
  const description = descEl ? descEl.value : (S.passive.description || '');
  const res = await api('/api/passive/state', {
    method: 'POST',
    body: { name: S.selected, id: S.passiveId, info, displayName, description },
  });
  S.passive = {
    ...S.passive,
    info,
    name: displayName,
    localeName: displayName,
    description,
    conditions: res.passive.conditions,
  };
  S.session = res.session;
  await checkPDesc();
  pSessionDom();
}

async function flushBInfo() {
  if (!S.buff) return;
  const info = readBInfo();
  const res = await api('/api/buff/meta', { method: 'POST', body: { name: S.selected, id: S.buffId, info } });
  S.buff = { ...S.buff, info: res.meta.info };
  S.session = res.session;
  render();
}

async function placeModuleSimple(mid, kind) {
  const doc = kind === 'passive' ? S.passive : S.buff;
  if (!doc) { toast('请先在左侧选一个对象', 'warn'); return; }
  const code = doc.code || (doc.code = { modules: [] });
  code.modules = code.modules || [];
  if (code.modules.includes(mid)) { toast('这个模块已经放进去了', 'warn'); return; }
  code.modules.push(mid);
  await saveSimpleCode(kind);
  toast('已置入：' + moduleName(mid), 'ok');
}

async function saveSimpleCode(kind) {
  const doc = kind === 'passive' ? S.passive : S.buff;
  if (!doc) return;
  const id = kind === 'passive' ? S.passiveId : S.buffId;
  const res = await api(kind === 'passive' ? '/api/passive/code' : '/api/buff/code', {
    method: 'POST',
    body: { name: S.selected, id, code: { modules: doc.code?.modules || [] } },
  });
  if (kind === 'passive') S.passive = { ...S.passive, code: res.meta.code, info: res.meta.info };
  else S.buff = { ...S.buff, code: res.meta.code, info: res.meta.info };
  render();
}

async function savePassiveCurrent() {
  await flushPDesc();
  await checkPDesc();
  const unk = (S.pDescCheck?.unknown || []).map((u) => ({ where: '被动描述', word: u }));
  if (unk.length) { openRiskGeneric(unk, commitPassive); return; }
  await commitPassive();
}

async function commitPassive() {
  await flushPInfo();
  const res = await api('/api/passive/save', { method: 'POST', body: { name: S.selected, id: S.passiveId } });
  S.session = res.session;
  const applied = await api('/api/passive/apply', { method: 'POST', body: { name: S.selected, id: S.passiveId } });
  toast('已保存并写入游戏文件（' + (applied.applied || 0) + ' 条被动脚本）', 'ok');
  render();
}

async function saveBuffCurrent() {
  await flushBDesc();
  await checkBDesc();
  const unk = (S.bDescCheck?.unknown || []).map((u) => ({ where: 'Buff 描述', word: u }));
  if (unk.length) { openRiskGeneric(unk, commitBuff); return; }
  await commitBuff();
}

async function commitBuff() {
  await flushBInfo();
  const res = await api('/api/buff/save', { method: 'POST', body: { name: S.selected, id: S.buffId } });
  S.session = res.session;
  const applied = await api('/api/buff/apply', { method: 'POST', body: { name: S.selected, id: S.buffId } });
  toast('已保存并写入游戏文件（' + (applied.applied || 0) + ' 条 Buff 脚本）', 'ok');
  render();
}

function openRiskGeneric(items, commit) {
  modal({
    title: '保存检查',
    body: '<p><strong>有错误的关键词输入，请检查拼写。</strong></p>'
      + '<div class="person-list">' + items.map((u) => '<div class="check-row"><span class="kw-bad">[' + esc(u.word) + ']</span><small>' + esc(u.where) + ' · 未在时点表 / Buff 表中找到</small></div>').join('') + '</div>'
      + '<div class="hint muted">无视风险保存后，未命中的关键词不做翻译处理。</div>',
    footer: '<button class="btn ghost" data-act="close-modal">返回修改</button><button class="btn warn" data-act="risk-save-ok">无视风险保存</button>',
  });
  actions['risk-save-ok'] = async () => { closeModal(); await commit(); };
}

/* --------------------------- 模块 / 被动 / Buff 创建 --------------------------- */

async function openNewModule() {
  await ensureScopes();
  const order = ['passive', 'skill', 'buff', 'common'];
  const scopes = ((S.scopeTables && S.scopeTables.list) || [{ id: 'common', zh: '通用', desc: '' }]).slice()
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const scopePick = scopes.map((x) => '<label class="scope-opt"><input type="radio" name="nm-scope" value="' + esc(x.id) + '"' + (x.id === 'common' ? ' checked' : '') + '><b>' + esc(x.zh) + '</b><span>' + esc(x.desc || '') + '</span></label>').join('');
  modal({
    title: '新建模块',
    body: '<div class="form">'
      + '<div class="field"><span>为谁创建（决定可用的时点 / 函数）</span><div class="scope-pick">' + scopePick + '</div></div>'
      + '<label class="field"><span>名称</span><input id="nm-name" placeholder="例如：施加烧伤" autocomplete="off"></label>'
      + '<label class="field"><span>描述（可执行词条）</span><textarea id="nm-desc" class="desc-input" rows="4" placeholder="例如：[使用时]对目标施加2层[烧伤]"></textarea></label>'
      + '<div class="hint muted">模块目前只存在于编辑器内，不落到游戏脚本。</div></div>',
    footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="submit-create-module">创建</button>',
  });
}

async function submitCreateModule() {
  const name = document.getElementById('nm-name')?.value?.trim() || '';
  const desc = document.getElementById('nm-desc')?.value || '';
  const scope = document.querySelector('input[name="nm-scope"]:checked')?.value || 'common';
  if (!name) { toast('请填模块名称', 'warn'); return; }
  try {
    const res = await api('/api/module/create', { method: 'POST', body: { name, desc, scope } });
    closeModal();
    S.modulesLoaded = false;
    await loadModules(true);
    toast('模块已创建', 'ok');
    await openModuleEditor(res.module.id);
  } catch (e) { toast(e.message, 'error'); }
}

async function saveModule() {
  const m = (S.modules || []).find((x) => x.id === S.moduleEditing);
  if (!m || m.test) return;
  const name = document.getElementById('mod-name')?.value?.trim() || '';
  const desc = document.getElementById('mod-desc')?.value || '';
  const prefix = document.getElementById('mod-prefix')?.value || '';
  const scope = document.getElementById('mod-scope')?.value || (m.scope || 'common');
  try {
    await api('/api/module/save', { method: 'POST', body: { id: m.id, name, desc, prefix, scope } });
    await loadModules(true);
    toast('模块已保存', 'ok');
    render();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteModule() {
  const m = (S.modules || []).find((x) => x.id === S.moduleEditing);
  if (!m) return;
  const isTest = !!m.test;
  modal({
    title: isTest ? '删除测试模块' : '删除模块',
    body: '<p>确定删除' + (isTest ? '测试模块' : '模块') + '「' + esc(m.name || m.id) + '」？</p><div class="hint muted">' + (isTest ? '删除后会写入「不再自动生成测试模块」标记，之后启动不会再冒出来。' : '已引用它的技能 / 被动 / Buff 会显示成一个空引用。') + '</div>',
    footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn danger" data-act="confirm-delete-module" data-id="' + esc(m.id) + '" data-test="' + (isTest ? '1' : '0') + '">删除</button>',
  });
}

async function confirmDeleteModule(el) {
  await api('/api/module/delete', { method: 'POST', body: { id: el.dataset.id, allowTest: el.dataset.test === '1' } });
  closeModal();
  S.moduleEditing = null;
  await loadModules(true);
  toast('模块已删除', 'ok');
  render();
}

function openNewPassive() {
  modal({
    title: '新建被动',
    body: '<div class="form">'
      + '<label class="field"><span>被动 id（必填，4–10 位数字，编辑器会查重）</span><input id="np-id" placeholder="例如 2090111" autocomplete="off"></label>'
      + '<label class="field"><span>被动名（写入游戏本地化）</span><input id="np-name" placeholder="例如 灼热抗性" autocomplete="off"></label>'
      + '<div class="hint muted">描述与启动条件在打开被动后，于中间的「描述」页与「被动基础信息」里填。</div>'
      + '</div>',
    footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="submit-create-passive">创建</button>',
  });
}

async function submitCreatePassive() {
  const id = document.getElementById('np-id')?.value?.trim() || '';
  const displayName = document.getElementById('np-name')?.value?.trim() || '';
  try {
    const res = await api('/api/passive/create', { method: 'POST', body: { name: S.selected, id, displayName } });
    closeModal();
    await loadPassiveList(S.selected);
    S.passive = null;
    await openPassive(res.passive.id);
    toast('被动 ' + res.passive.id + ' 已创建', 'ok');
  } catch (e) { toast(e.message, 'error'); }
}

function openNewBuff() {
  const classes = S.keywords?.buffClasses || [];
  const types = S.keywords?.buffTypes || [];
  const opt = (arr, v) => arr.map((x) => '<option value="' + esc(x.id) + '"' + (String(x.id) === String(v) ? ' selected' : '') + '>' + esc(x.zh || x.id) + '</option>').join('');
  modal({
    title: '新建 Buff',
    body: '<div class="form">'
      + '<label class="field"><span>Buff id（必填，英文字母开头）</span><input id="nb-id" placeholder="例如 TestBurn" autocomplete="off"></label>'
      + '<label class="field"><span>Buff 名</span><input id="nb-name" placeholder="例如 测试烧伤" autocomplete="off"></label>'
      + '<div class="grid-2"><label class="field"><span>种类</span><select id="nb-class">' + opt(classes, 'NonvolatileBuff') + '</select></label>'
      + '<label class="field"><span>正负</span><select id="nb-type">' + opt(types, 'Negative') + '</select></label></div>'
      + '<label class="field"><span>描述</span><textarea id="nb-desc" class="desc-input" rows="3" placeholder="例如：[回合结束时]受到 1 点伤害"></textarea></label>'
      + '<div class="hint muted">创建会同时写入实体、本地化与 0 字节关键词文件（custom_buffs/&lt;id&gt;.txt）。</div></div>',
    footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn primary" data-act="submit-create-buff">创建</button>',
  });
}

async function submitCreateBuff() {
  const id = document.getElementById('nb-id')?.value?.trim() || '';
  const displayName = document.getElementById('nb-name')?.value?.trim() || '';
  const desc = document.getElementById('nb-desc')?.value || '';
  const info = {
    buffClass: document.getElementById('nb-class')?.value || 'NonvolatileBuff',
    buffType: document.getElementById('nb-type')?.value || 'Negative',
  };
  try {
    const res = await api('/api/buff/create', { method: 'POST', body: { name: S.selected, id, displayName, desc, info } });
    closeModal();
    await loadBuffList(S.selected);
    S.buff = null;
    await openBuff(res.buff.id);
    toast('Buff ' + res.buff.id + ' 已创建', 'ok');
  } catch (e) { toast(e.message, 'error'); }
}

/* --------------------------------- 导入 --------------------------------- */

function openImportPassive() {
  modal({
    title: '导入被动',
    body: '<div class="form"><label class="field"><span>搜索 id 或名称</span><input id="ip-q" class="search" placeholder="例如 90001 / 虫" autocomplete="off"></label>'
      + '<div class="import-list" id="ip-list"><div class="muted" style="padding:8px">输入关键词后回车搜索</div></div>'
      + '<div class="hint muted">导入保持原 id（原版被动会在游戏内覆盖原版）。</div></div>',
    footer: '<button class="btn ghost" data-act="close-modal">关闭</button>',
  });
  const q = document.getElementById('ip-q');
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchImportPassive(q.value.trim()); });
  q.focus();
}

async function searchImportPassive(q) {
  const box = document.getElementById('ip-list');
  if (!box) return;
  if (!q) return;
  const res = await api('/api/passive-search?q=' + encodeURIComponent(q));
  const rows = (res.results || []).map((r) => '<button class="import-row" data-act="pick-import-passive" data-id="' + esc(r.id) + '">'
    + '<strong>' + esc(r.name || r.id) + '</strong><small>' + esc(r.id) + (r.source === 'vanilla' ? ' · 原版' : ' · ' + esc(r.mod || 'Mod')) + '</small></button>').join('');
  box.innerHTML = rows || '<div class="muted" style="padding:8px">没有匹配结果</div>';
}

async function pickImportPassive(el) {
  const id = el.dataset.id;
  try {
    const res = await api('/api/passive/import', { method: 'POST', body: { name: S.selected, ids: [id], source: { kind: 'vanilla' } } });
    closeModal();
    await loadPassiveList(S.selected);
    S.passive = null;
    await openPassive(id);
    toast('已导入被动 ' + id + (res && res.overridden ? '（覆盖原版）' : ''), 'ok');
  } catch (e) { toast(e.message, 'error'); }
}

function openImportBuff() {
  modal({
    title: '导入 Buff',
    body: '<div class="form"><label class="field"><span>搜索 id 或名称</span><input id="ib-q" class="search" placeholder="例如 Burn / 烧伤" autocomplete="off"></label>'
      + '<div class="import-list" id="ib-list"><div class="muted" style="padding:8px">输入关键词后回车搜索</div></div>'
      + '<div class="hint muted">导入保持原 id（原版 Buff 会在游戏内覆盖原版）。</div></div>',
    footer: '<button class="btn ghost" data-act="close-modal">关闭</button>',
  });
  const q = document.getElementById('ib-q');
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchImportBuff(q.value.trim()); });
  q.focus();
}

async function searchImportBuff(q) {
  const box = document.getElementById('ib-list');
  if (!box || !q) return;
  const res = await api('/api/buff-search?q=' + encodeURIComponent(q));
  const rows = (res.results || []).map((r) => '<button class="import-row" data-act="pick-import-buff" data-id="' + esc(r.id) + '">'
    + '<strong>' + esc(r.name || r.id) + '</strong><small>' + esc(r.id) + (r.source === 'vanilla' ? ' · 原版' : ' · ' + esc(r.mod || 'Mod')) + '</small></button>').join('');
  box.innerHTML = rows || '<div class="muted" style="padding:8px">没有匹配结果</div>';
}

async function pickImportBuff(el) {
  const id = el.dataset.id;
  try {
    const res = await api('/api/buff/import', { method: 'POST', body: { name: S.selected, ids: [id], source: { kind: 'vanilla' } } });
    closeModal();
    await loadBuffList(S.selected);
    S.buff = null;
    await openBuff(id);
    toast('已导入 Buff ' + id + (res && res.overridden ? '（覆盖原版）' : ''), 'ok');
  } catch (e) { toast(e.message, 'error'); }
}

/* --------------------------------- 动作注册 --------------------------------- */

Object.assign(actions, {
  'open-module': async (el) => { await openModuleEditor(el.dataset.id); },
  'new-module': () => openNewModule(),
  'submit-create-module': () => submitCreateModule(),
  'save-module': () => saveModule(),
  'delete-module': () => deleteModule(),
  'confirm-delete-module': (el) => confirmDeleteModule(el),

  'open-passive': (el) => openPassive(el.dataset.id).catch((e) => toast(e.message, 'error')),
  'passive-tab': (el) => { S.passiveTab = el.dataset.tab; render(); },
  'buff-script-add': () => {
    if (!S.buff) return;
    const list = buffScriptList(S.buff).slice();
    list.push('');
    S.buffScripts = list;
    render();
  },
  'buff-script-del': (el) => {
    if (!S.buff) return;
    const i = Number(el.dataset.i);
    const list = buffScriptList(S.buff).slice();
    if (!Number.isInteger(i) || i < 0 || i >= list.length) return;
    list.splice(i, 1);
    S.buffScripts = list;
    render();
  },
  'buff-script-reset': () => {
    S.buffScripts = null;
    render();
  },
  'buff-script-save': async () => {
    if (!S.buff) return;
    const abs = buffScriptList(S.buff);
    const extras = Array.isArray(S.buffExtras) ? S.buffExtras : [];
    const list = [];
    for (let i = 0; i < abs.length; i += 1) {
      const ability = String(abs[i] || '');
      let extra = null;
      const draft = typeof extras[i] === 'string' ? extras[i] : null;
      if (draft != null) {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== '{}') {
          try {
            const obj = JSON.parse(trimmed);
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('not object');
            extra = obj;
          } catch { toast('第 ' + (i + 1) + ' 条脚本的「其他字段」不是合法 JSON 对象', 'error'); return; }
        } else if (trimmed === '{}') {
          const keys = Object.keys(bsExtraOf(S.buff, i));
          if (keys.length) { extra = {}; keys.forEach((k) => { extra[k] = null; }); }
        }
      }
      list.push(extra ? { ability, extra } : ability);
    }
    const res = await api('/api/buff/scripts', { method: 'POST', body: { name: S.selected, id: S.buffId, list } });
    S.buffScripts = null;
    S.buffExtras = null;
    await reloadBuff();
    toast('已写回 ' + res.count + ' 条脚本');
    render();
  },
  'p-mode': async (el) => {
    if (!S.passive) return;
    const mode = String(el.dataset.pMode || 'none');
    const info = { ...(S.passive.info || {}), conditionMode: mode };
    if (mode === 'stock' && !(info.stockConditions || []).length) info.stockConditions = [{ type: 'CRIMSON', value: 1 }];
    if (mode === 'resonance' && !(info.resonanceConditions || []).length) info.resonanceConditions = [{ type: 'CRIMSON', value: 1 }];
    info.stockConditions = Array.isArray(info.stockConditions) ? info.stockConditions : [];
    info.resonanceConditions = Array.isArray(info.resonanceConditions) ? info.resonanceConditions : [];
    S.passive = { ...S.passive, info };
    render();
    await flushPInfo().catch((e) => toast(e.message, 'error'));
  },
  'p-cond-add': (el) => {
    if (!S.passive) return;
    const which = el.dataset.which === 'resonance' ? 'resonance' : 'stock';
    const info = { ...(S.passive.info || {}) };
    const key = which === 'stock' ? 'stockConditions' : 'resonanceConditions';
    const list = Array.isArray(info[key]) ? info[key].slice() : [];
    if (which === 'resonance' && list.length >= 1) { toast('资源共鸣只支持 1 条条件', 'warn'); return; }
    const used = new Set(list.map((c) => c.type));
    const sins = ['CRIMSON', 'SCARLET', 'AMBER', 'SHAMROCK', 'AZURE', 'INDIGO', 'VIOLET', 'WHITE', 'BLACK'];
    list.push({ type: sins.find((x) => !used.has(x)) || 'CRIMSON', value: 1 });
    info[key] = list;
    S.passive = { ...S.passive, info };
    render();
    flushPInfo().catch((e) => toast(e.message, 'error'));
  },
  'p-cond-del': async (el) => {
    if (!S.passive) return;
    const which = el.dataset.which === 'resonance' ? 'resonance' : 'stock';
    const key = which === 'stock' ? 'stockConditions' : 'resonanceConditions';
    const info = { ...(S.passive.info || {}) };
    const list = Array.isArray(info[key]) ? info[key].slice() : [];
    list.splice(Number(el.dataset.idx) || 0, 1);
    info[key] = list;
    S.passive = { ...S.passive, info };
    render();
    await flushPInfo().catch((e) => toast(e.message, 'error'));
  },
  'new-passive': () => openNewPassive(),
  'submit-create-passive': () => submitCreatePassive(),
  'save-passive': () => savePassiveCurrent().catch((e) => toast(e.message, 'error')),
  'import-passive': () => openImportPassive(),
  'pick-import-passive': (el) => pickImportPassive(el),

  'open-buff': (el) => openBuff(el.dataset.id).catch((e) => toast(e.message, 'error')),
  'buff-tab': (el) => { S.buffTab = el.dataset.tab; render(); },
  'new-buff': () => openNewBuff(),
  'submit-create-buff': () => submitCreateBuff(),
  'save-buff': () => saveBuffCurrent().catch((e) => toast(e.message, 'error')),
  'import-buff': () => openImportBuff(),
  'pick-import-buff': (el) => pickImportBuff(el),
});

Object.assign(actions, {
  'desc-kw-insert': () => {
    const pick = document.getElementById('desc-kw');
    const ta = document.getElementById('skill-desc');
    const word = pick ? String(pick.value || '').trim() : '';
    if (!word) { toast('先选一个关键词（时点或 Buff 的中文名）', 'warn'); return; }
    if (!ta) return;
    const token = '[' + word.replace(/[\[\]\r\n]/g, '') + ']';
    const start = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
    const end = ta.selectionEnd == null ? start : ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + token + ta.value.slice(end);
    ta.focus();
    const pos = start + token.length;
    try { ta.setSelectionRange(pos, pos); } catch {}
    if (pick) pick.value = '';
    scheduleDesc();
  },
  'mb-undo': () => mbUndo(),
  'mb-redo': () => mbRedo(),
  'mb-loop-slot': (el) => {
    const chain = el.dataset.chain || '';
    const ref = mbAccess(chain);
    const cur = ref && ref.get();
    if (cur && (cur.t === 'target' || cur.v)) {
      mbSnapshot();
      ref.set(null);
      render();
      toast('已清空遍历目标；需要时从左侧「目标」分类把「遍历（自定义目标）」拖回来');
      return;
    }
    toast('从左侧「目标」分类把「遍历（自定义目标）」拖到这个槽里');
  },
  'mb-cond-add': (el) => {
    const st = mbStmt(el.dataset.chain);
    if (!st) return;
    mbSnapshot();
    st.conds = Array.isArray(st.conds) && st.conds.length ? st.conds : [{ left: null, op: '>', right: null }];
    if (st.conds.length >= 8) { toast('最多 8 个条件', 'warn'); return; }
    st.conds.push({ left: null, op: '>', right: null });
    render();
  },
  'mb-cond-del': (el) => {
    const raw = String(el.dataset.chain || '');
    const k = raw.lastIndexOf(':');
    const st = mbStmt(raw.slice(0, k));
    const idx = Number(raw.slice(k + 1));
    if (!st || !Array.isArray(st.conds) || st.conds.length <= 1) return;
    mbSnapshot();
    st.conds.splice(idx, 1);
    render();
  },
});

document.addEventListener('change', (e) => {
  const el = e.target && e.target.closest ? e.target.closest('[data-mb-logic]') : null;
  if (!el || !S.mb) return;
  const st = mbStmt(el.dataset.mbLogic);
  if (!st) return;
  mbSnapshot();
  st.logic = ['none', 'and', 'or', 'xor'].includes(el.value) ? el.value : 'none';
  if (!Array.isArray(st.conds) || !st.conds.length) st.conds = [{ left: null, op: '>', right: null }];
  render();
});

/* ===================== v0.9.8：Mod 拖动排序 / 永久删除 / 冷静期 ===================== */
let modDragEndAt = 0;

/** 永久删除的冷静期设置（编辑器本地，存 localStorage） */
function deleteGuard() {
  var cfg = null;
  try { cfg = JSON.parse(localStorage.getItem('lcw.deleteGuard') || 'null'); } catch (e) { cfg = null; }
  var enabled = !cfg || cfg.enabled !== false;
  var seconds = cfg && Number.isFinite(Number(cfg.seconds)) ? Number(cfg.seconds) : 5;
  seconds = Math.max(0, Math.min(60, Math.round(seconds)));
  return { enabled: enabled, seconds: seconds };
}

function saveDeleteGuard(cfg) {
  var next = { enabled: Boolean(cfg.enabled), seconds: Math.max(0, Math.min(60, Math.round(Number(cfg.seconds) || 0))) };
  localStorage.setItem('lcw.deleteGuard', JSON.stringify(next));
  return next;
}

/* ---- Mod 列表拖动排序（只改编辑器显示顺序，写进 LCW/state.json） ---- */
function bindModDrag() {
  var drag = null;
  function itemsOf(list) { return Array.prototype.slice.call(list.querySelectorAll('.item[data-act="select-mod"]')); }
  document.addEventListener('mousedown', function (e) {
    if (S.view !== 'mods' && S.view !== 'edit') return;
    var it = e.target && e.target.closest ? e.target.closest('.panel.list .item[data-act="select-mod"]') : null;
    if (!it) return;
    drag = { el: it, name: it.dataset.name, y0: e.clientY, started: false, list: it.parentElement };
  }, true);
  document.addEventListener('mousemove', function (e) {
    if (!drag) return;
    if (!drag.started && Math.abs(e.clientY - drag.y0) < 6) return;
    if (!drag.started) {
      drag.started = true;
      drag.el.classList.add('dragging');
      document.body.classList.add('mod-reordering');
    }
    e.preventDefault();
    var others = itemsOf(drag.list).filter(function (x) { return x !== drag.el; });
    others.forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); });
    var placed = false;
    for (var i = 0; i < others.length; i += 1) {
      var r = others[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { others[i].classList.add('drop-before'); placed = true; break; }
    }
    if (!placed && others.length) others[others.length - 1].classList.add('drop-after');
  }, true);
  document.addEventListener('mouseup', function () {
    if (!drag) return;
    var d = drag; drag = null;
    document.body.classList.remove('mod-reordering');
    d.el.classList.remove('dragging');
    if (!d.started) return;
    modDragEndAt = Date.now();
    var others = itemsOf(d.list).filter(function (x) { return x !== d.el; });
    var beforeEl = others.filter(function (x) { return x.classList.contains('drop-before'); })[0] || null;
    var afterEl = others.filter(function (x) { return x.classList.contains('drop-after'); })[0] || null;
    others.forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); });
    var names = others.map(function (x) { return x.dataset.name; });
    var idx = names.length;
    if (beforeEl) idx = Math.max(0, names.indexOf(beforeEl.dataset.name));
    else if (afterEl) idx = Math.max(0, names.indexOf(afterEl.dataset.name) + 1);
    names.splice(idx, 0, d.name);
    api('/api/mods/order', { method: 'POST', body: { order: names } })
      .then(function (res) {
        if (res && Array.isArray(res.mods)) S.mods = res.mods;
        return refreshModsAndDetail();
      })
      .then(function () { render(); toast('已调整显示顺序'); })
      .catch(function (err) { toast(err && err.message ? err.message : '保存顺序失败', 'error'); });
  }, true);
}

/** 连点已经灰掉的「禁用」3 次 → 永久删除确认 */
function armDelete(name) {
  var now = Date.now();
  var st = (S.deleteArm && S.deleteArm.name === name && now - S.deleteArm.at < 2500) ? S.deleteArm : { name: name, n: 0, at: now };
  st.n += 1; st.at = now;
  S.deleteArm = st;
  if (st.n < 3) {
    toast('再点 ' + (3 - st.n) + ' 次可永久删除这个 Mod（' + name + '）', 'warn');
    return;
  }
  S.deleteArm = null;
  openDeleteModModal(name);
}

function openDeleteModModal(name) {
  var g = deleteGuard();
  var lines = [
    'Mod 本体目录（mods 或 LCW/disabled 下的 ' + name + '）',
    'LCW/backups/用户保存 里以 ' + name + ' 开头的全部备份',
    'LCW/backups/自动保存/' + name,
    'LCW/journal/' + name + '（操作流水）',
    'LCW/projects/{modules,personalities,skills,passives,buffs}/' + name
  ];
  modal({
    title: '永久删除 Mod',
    body: '<p><strong>这会永久删除「' + esc(name) + '」在本地的一切数据，无法撤销。</strong></p>'
      + '<div class="person-list">' + lines.map(function (t) { return '<div class="check-row"><span class="kw-bad">✕</span><small>' + esc(t) + '</small></div>'; }).join('') + '</div>'
      + (g.enabled
        ? '<div class="hint muted" id="del-countdown">为防误删，删除按钮将在 ' + g.seconds + ' 秒后开放。</div>'
        : '<div class="hint muted">冷静期已在设置中关闭。</div>'),
    footer: '<button class="btn ghost" data-act="close-modal">取消</button><button class="btn danger" data-act="confirm-delete-mod" data-name="' + esc(name) + '" disabled>永久删除</button>'
  });
  if (!g.enabled || g.seconds <= 0) { enableDeleteNow(); return; }
  var left = g.seconds;
  var timer = setInterval(function () {
    left -= 1;
    var cd = document.getElementById('del-countdown');
    if (cd) cd.textContent = left > 0 ? ('为防误删，删除按钮将在 ' + left + ' 秒后开放。') : '现在可以点了。';
    if (left <= 0) { clearInterval(timer); enableDeleteNow(); }
  }, 1000);
}

function enableDeleteNow() {
  var btn = document.querySelector('[data-act="confirm-delete-mod"]');
  if (btn) { btn.disabled = false; btn.textContent = '永久删除'; }
}

Object.assign(actions, {
  'arm-delete': function (el) { armDelete(el.dataset.name || S.selected); },
  'confirm-delete-mod': async function (el) {
    var name = el.dataset.name;
    try {
      var res = await api('/api/mod/delete', { method: 'POST', body: { name: name, confirm: 'DELETE' } });
      closeModal();
      toast('已永久删除：' + name + '（' + ((res && res.removed) || []).length + ' 个路径）', 'ok');
      if (S.selected === name) { S.selected = null; S.modDetail = null; }
      await loadMods();
      await refreshModsAndDetail();
      render();
    } catch (err) { toast(err && err.message ? err.message : '删除失败', 'error'); }
  },
  'save-delete-guard': function () {
    var on = document.getElementById('set-delguard-on');
    var sec = document.getElementById('set-delguard-sec');
    var cfg = saveDeleteGuard({ enabled: on ? on.checked : true, seconds: sec ? sec.value : 5 });
    toast('已保存：冷静期' + (cfg.enabled ? cfg.seconds + ' 秒' : '关闭'));
  }
});

bindModDrag();
document.addEventListener('click', function (e) {
  if (modDragEndAt && Date.now() - modDragEndAt < 320) { e.stopPropagation(); e.preventDefault(); }
}, true);
