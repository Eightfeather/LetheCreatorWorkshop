import * as fs from 'node:fs';
import { basename, join } from 'node:path';
import { readJson, stamp } from '../atomic.mjs';
import { cleanName, isInside, SafetyError } from '../safety.mjs';
import { ensureLayout } from './layout.mjs';
import { disabledModsDir, readState, updateState, userBackupsDir, autoBackupsDir, journalDir, workbenchDir } from './state.mjs';

export function modsRoot(letheRoot) { return join(letheRoot, 'mods'); }
export function modDir(letheRoot, name) { return join(modsRoot(letheRoot), cleanName(name, 'Mod 名称')); }

export function resolveModDir(letheRoot, name) {
  const clean = cleanName(name, 'Mod 名称');
  const active = join(modsRoot(letheRoot), clean);
  if (fs.existsSync(active)) return { dir: active, disabled: false, name: clean };
  const off = join(disabledModsDir(letheRoot), clean);
  if (fs.existsSync(off)) return { dir: off, disabled: true, name: clean };
  throw new SafetyError("Mod 不存在：" + name);
}

export function modDirSafe(letheRoot, name) {
  return resolveModDir(letheRoot, name).dir;
}
export function entitiesOf(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.list)) return data.list;
  if (data && typeof data === 'object' && data.id != null) return [data];
  return [];
}

export function localeEntriesOf(data) {
  const out = [];
  if (!data || typeof data !== 'object') return out;
  if (Array.isArray(data.list)) {
    for (const entry of data.list) {
      if (entry && entry.id != null) out.push({ key: String(entry.id), entry });
    }
    return out;
  }
  for (const [key, entry] of Object.entries(data)) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) out.push({ key, entry });
  }
  return out;
}

export function localeCategory(dirName) {
  return String(dirName).replace(/List$/, '');
}

function jsonFiles(dir) {
  let out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(jsonFiles(p));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.json')) out.push(p);
  }
  return out;
}

function relOf(modDirPath, abs) {
  return abs.slice(modDirPath.length + 1).split('\\').join('/');
}

function sizeOf(dir) {
  let total = 0;
  let count = 0;
  const walk = (p) => {
    let entries = [];
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = join(p, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) {
        try { total += fs.statSync(abs).size; count += 1; } catch { /* ignore */ }
      }
    }
  };
  walk(dir);
  return { bytes: total, files: count };
}

/**
 * 读一个 Mod：数据实体 + 本地化 + 贴图 + 人格索引。
 * 实体 ≠ 文件：这里按“类目 → 实体”建索引，同时保留所属文件用于写回。
 */
export function readModPayload(modDirPath) {
  const data = {};
  const locales = {};

  const dataRoot = join(modDirPath, 'custom_limbus_data');
  for (const catEntry of safeDirs(dataRoot)) {
    const cat = catEntry.name;
    for (const file of jsonFiles(join(dataRoot, cat))) {
      const parsed = readJson(file, null);
      if (!parsed) continue;
      const rel = relOf(modDirPath, file);
      entitiesOf(parsed).forEach((entity, index) => {
        if (!entity) return;
        // personality-passive 这类实体用 personalityID 而不是 id
        const key = entity.id != null ? entity.id : entity.personalityID;
        if (key == null) return;
        (data[cat] ||= []).push({ id: key, rel, index, entity });
      });
    }
  }

  const localeRoot = join(modDirPath, 'custom_limbus_locale');
  for (const langEntry of safeDirs(localeRoot)) {
    const lang = langEntry.name;
    for (const catEntry of safeDirs(join(localeRoot, lang))) {
      const cat = localeCategory(catEntry.name);
      for (const file of jsonFiles(join(localeRoot, lang, catEntry.name))) {
        const parsed = readJson(file, null);
        if (!parsed) continue;
        const rel = relOf(modDirPath, file);
        for (const { key, entry } of localeEntriesOf(parsed)) {
          (((locales[lang] ||= {})[cat] ||= []).push({ key, rel, entry }));
        }
      }
    }
  }

  const spritesDir = join(modDirPath, 'custom_sprites');
  const sprites = safeDirs(spritesDir).length
    ? fs.readdirSync(spritesDir, { withFileTypes: true })
      .filter((d) => d.isFile() && /\.(png|webp|jpe?g|gif)$/i.test(d.name))
      .map((d) => d.name)
    : [];

  const personalities = (data.personality || []).map((p) => {
    const loc = findLocaleEntry(locales.EN?.personality, p.id) || {};
    return {
      id: p.id,
      rel: p.rel,
      name: loc.name || '',
      title: loc.title || '',
      desc: loc.desc || '',
      characterId: Number(p.entity.characterId) || 0,
      appearance: p.entity.appearance || '',
      rank: p.entity.rank,
      inLocale: Boolean(loc.name !== undefined),
    };
  });

  return { data, locales, sprites, personalities };
}

function safeDirs(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return []; }
}

export function findLocaleEntry(list, id) {
  if (!Array.isArray(list)) return null;
  return list.find((x) => String(x.key) === String(id))?.entry || null;
}

/** 轻量摘要：只扫数据目录与人格文件，避免每次列 Mod 都全量解析 */
export function readModSummary(modDirPath, extra = {}) {
  const { bytes, files } = sizeOf(modDirPath);
  const cats = safeDirs(join(modDirPath, 'custom_limbus_data')).map((d) => d.name);
  const personalityFiles = jsonFiles(join(modDirPath, 'custom_limbus_data', 'personality'));
  let personalityCount = 0;
  let personalities = [];
  if (personalityFiles.length) {
    const payload = readModPayload(modDirPath);
    personalityCount = payload.personalities.length;
    personalities = payload.personalities.slice(0, 12);
  }
  let mtime = 0;
  try { mtime = fs.statSync(modDirPath).mtimeMs; } catch { /* ignore */ }
  return {
    name: basename(modDirPath),
    dir: modDirPath,
    enabled: extra.enabled !== false,
    bytes,
    files,
    categories: cats,
    personalityCount,
    personalities,
    mtime,
    disabledAt: extra.disabledAt || null,
  };
}

export function listMods(letheRoot) {
  const root = modsRoot(letheRoot);
  const state = readState(letheRoot);
  const out = [];
  for (const d of safeDirs(root)) {
    out.push(readModSummary(join(root, d.name), { enabled: true }));
  }
  const disabledDir = disabledModsDir(letheRoot);
  for (const d of safeDirs(disabledDir)) {
    const meta = state.disabledMods[d.name] || {};
    out.push(readModSummary(join(disabledDir, d.name), { enabled: false, disabledAt: meta.at || null }));
  }
  const order = Array.isArray(state.modOrder) ? state.modOrder : [];
  const rank = (n) => { const i = order.indexOf(n); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
  return out.sort((a, b) => {
    const ra = rank(a.name); const rb = rank(b.name);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });
}

/** 保存「Mod 显示顺序」（只影响编辑器内展示，不改变游戏加载顺序） */
export function saveModOrder(letheRoot, order) {
  const known = new Set(listMods(letheRoot).map((m) => m.name));
  const clean = [];
  for (const raw of Array.isArray(order) ? order : []) {
    const n = String(raw || '').trim();
    if (known.has(n) && !clean.includes(n)) clean.push(n);
  }
  updateState(letheRoot, (s) => ({ ...s, modOrder: clean }));
  return clean;
}

/**
 * 永久删除一个 Mod：Mod 本体（无论启用/禁用）+ LCW 里与它相关的所有数据。
 * 返回被删除的绝对路径列表（供 UI 展示）。
 */
export function deleteModEverywhere(letheRoot, name) {
  const found = resolveModDir(letheRoot, name);
  const modName = found.name;
  const removed = [];
  const rm = (p) => { if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); removed.push(p); } };

  rm(found.dir);

  for (const dir of [userBackupsDir(letheRoot), autoBackupsDir(letheRoot), journalDir(letheRoot)]) {
    if (!fs.existsSync(dir)) continue;
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.name === modName || d.name.startsWith(modName + '_')) rm(join(dir, d.name));
    }
  }
  const projects = join(workbenchDir(letheRoot), 'projects');
  for (const sub2 of ['modules', 'personalities', 'skills', 'passives', 'buffs', 'enemy', 'md']) {
    rm(join(projects, sub2, modName));
  }
  updateState(letheRoot, (s) => {
    const next = { ...s };
    if (next.disabledMods) { next.disabledMods = { ...next.disabledMods }; delete next.disabledMods[modName]; }
    if (Array.isArray(next.modOrder)) next.modOrder = next.modOrder.filter((n) => n !== modName);
    if (next.autoSave) { next.autoSave = { ...next.autoSave }; delete next.autoSave[modName]; }
    return next;
  });
  return { name: modName, removed };
}

export function createMod(letheRoot, { name, folder }) {
  const modName = cleanName(name, 'Mod 名称');
  const dirName = cleanName(folder || modName, '文件夹名');
  const root = modsRoot(letheRoot);
  fs.mkdirSync(root, { recursive: true });
  const target = join(root, dirName);
  if (fs.existsSync(target)) throw new SafetyError(`已存在同名 Mod 文件夹：${dirName}`);
  fs.mkdirSync(target, { recursive: true });
  fs.mkdirSync(join(target, 'custom_limbus_data'), { recursive: true });
  fs.mkdirSync(join(target, 'custom_limbus_locale'), { recursive: true });
  return { name: modName, folder: dirName, dir: target, created: ['custom_limbus_data/', 'custom_limbus_locale/'] };
}

/** 创建一个“只含所需类目”的 Mod（用于测试/无模板导入时） */
export function growMod(letheRoot, name, kinds) {
  const dir = modDir(letheRoot, name);
  if (!fs.existsSync(dir)) throw new SafetyError(`Mod 不存在：${name}`);
  const created = [];
  for (const kind of kinds) created.push(...ensureLayout(dir, kind));
  return { dir, created };
}

export function disableMod(letheRoot, name) {
  const dirName = cleanName(name, 'Mod 名称');
  const src = join(modsRoot(letheRoot), dirName);
  if (!fs.existsSync(src) || !isInside(modsRoot(letheRoot), src)) throw new SafetyError(`Mod 不存在或未启用：${name}`);
  const dest = join(disabledModsDir(letheRoot), dirName);
  if (fs.existsSync(dest)) throw new SafetyError(`禁用区里已有同名目录：${dirName}`);
  fs.mkdirSync(disabledModsDir(letheRoot), { recursive: true });
  const files = sizeOf(src).files;
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    // 跨卷/被占用时退化为复制后删除
    fs.cpSync(src, dest, { recursive: true });
    fs.rmSync(src, { recursive: true, force: true });
  }
  updateState(letheRoot, (st) => ({
    ...st,
    disabledMods: { ...st.disabledMods, [dirName]: { at: new Date().toISOString(), files } },
  }));
  return { name: dirName, dir: dest, enabled: false };
}

export function enableMod(letheRoot, name) {
  const dirName = cleanName(name, 'Mod 名称');
  const src = join(disabledModsDir(letheRoot), dirName);
  if (!fs.existsSync(src)) throw new SafetyError(`禁用区里没有这个 Mod：${name}`);
  const dest = join(modsRoot(letheRoot), dirName);
  if (fs.existsSync(dest)) throw new SafetyError(`Mod 目录已存在同名文件夹：${dirName}`);
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    fs.cpSync(src, dest, { recursive: true });
    fs.rmSync(src, { recursive: true, force: true });
  }
  updateState(letheRoot, (st) => {
    const next = { ...st, disabledMods: { ...st.disabledMods } };
    delete next.disabledMods[dirName];
    return next;
  });
  return { name: dirName, dir: dest, enabled: true };
}

/** Mod 的实际位置（启用区或禁用区），用于统计与只读查看 */
export function dirOf(letheRoot, name) {
  return resolveModDir(letheRoot, name);
}

export { stamp };
