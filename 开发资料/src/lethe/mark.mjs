/**
 * 「赛博水印」与清单：
 *  - 编辑器写过的实体文件会在每个实体上加一个 `_lcw` 字段（游戏侧忽略未知字段），
 *    用来区分「哪些文件是编辑器管的、可以不经询问直接改」。
 *  - 同时在 `LCW/projects/manifest.json` 里记一份清单（kind/mod/id/rel/时间），
 *    即使文件被人工改掉或删除，编辑器仍知道自己动过什么。
 */
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';

export const WM_KEY = '_lcw';
export const WM_VERSION = 1;

export function isEditorFile(entity) {
  return Boolean(entity && typeof entity === 'object' && entity[WM_KEY] && entity[WM_KEY].by === 'LCW');
}

/** 给实体盖上水印（已有则保留首次时间，只更新时间与版本） */
export function markEntity(entity, { kind, mod, id, at } = {}) {
  if (!entity || typeof entity !== 'object') return entity;
  const now = at || new Date().toISOString();
  const prev = entity[WM_KEY] && typeof entity[WM_KEY] === 'object' ? entity[WM_KEY] : {};
  entity[WM_KEY] = {
    by: 'LCW',
    v: WM_VERSION,
    kind: String(kind || prev.kind || ''),
    mod: String(mod || prev.mod || ''),
    id: id != null ? String(id) : (prev.id != null ? String(prev.id) : ''),
    firstAt: prev.firstAt || now,
    at: now
  };
  return entity;
}

export function manifestPath(letheRoot) {
  return join(letheRoot, 'LCW', 'projects', 'manifest.json');
}

export function readManifest(letheRoot) {
  try {
    const raw = fs.readFileSync(manifestPath(letheRoot), 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && data.files ? data : { version: 1, files: {} };
  } catch {
    return { version: 1, files: {} };
  }
}

/** 记录一批实体（key = kind/mod/id），并原子写回清单 */
export function recordManifest(letheRoot, entries, mod) {
  if (!letheRoot || !Array.isArray(entries) || !entries.length) return null;
  const doc = readManifest(letheRoot);
  const now = new Date().toISOString();
  for (const e of entries) {
    if (!e || !e.id) continue;
    const key = [e.kind, mod, e.id].join('/');
    const prev = doc.files[key] || {};
    doc.files[key] = {
      kind: String(e.kind || ''),
      mod: String(mod || ''),
      id: String(e.id),
      rel: e.rel ? String(e.rel) : (prev.rel || ''),
      firstAt: prev.firstAt || now,
      at: now,
      name: e.name != null ? String(e.name) : (prev.name || '')
    };
  }
  doc.version = 1;
  doc.updatedAt = now;
  fs.mkdirSync(dirname(manifestPath(letheRoot)), { recursive: true });
  const target = manifestPath(letheRoot);
  const tmp = target + ".tmp-" + process.pid + "-" + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), "utf8");
  fs.renameSync(tmp, target);
  return doc;
}

export function listManifest(letheRoot, filter = {}) {
  const doc = readManifest(letheRoot);
  return Object.entries(doc.files)
    .filter(([, v]) => (!filter.kind || v.kind === filter.kind) && (!filter.mod || v.mod === filter.mod))
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** 该实体（按 kind/mod/id）是否由编辑器管理 */
export function isManaged(letheRoot, kind, mod, id) {
  const doc = readManifest(letheRoot);
  return Boolean(doc.files[[kind, mod, id].join('/')]);
}
