import * as fs from 'node:fs';
import { markEntity, recordManifest } from './lethe/mark.mjs';
import { basename, dirname, join, sep } from 'node:path';
import { MAX_FILE_BYTES } from './safety.mjs';

export const BACKUP_KEEP = 20;

export function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

export function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

export function readJsonFile(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return { raw, data: JSON.parse(raw) };
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

/** 单文件原子写：同目录临时文件 → fsync → rename */
export function writeFileAtomic(abs, content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
  if (buf.length > MAX_FILE_BYTES) throw new Error(`单个文件超过上限（${MAX_FILE_BYTES} 字节）`);
  ensureDir(dirname(abs));
  const tmp = join(dirname(abs), `.${basename(abs)}.tmp-${process.pid}-${Date.now()}`);
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, buf);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, abs);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
    throw err;
  }
  return abs;
}

export function backupFile(abs, backupDir, rel) {
  if (!fs.existsSync(abs)) return null;
  const dest = join(backupDir, rel);
  ensureDir(dirname(dest));
  fs.copyFileSync(abs, dest);
  return dest;
}

/** 只清理内部回滚记录（journal/rollback），用户备份与自动保存永不自动删除 */
export function pruneRollback(rootDir, keep = BACKUP_KEEP) {
  const base = join(rootDir, 'LCW', 'journal', 'rollback');
  if (!fs.existsSync(base)) return [];
  const removed = [];
  for (const mod of fs.readdirSync(base, { withFileTypes: true })) {
    if (!mod.isDirectory()) continue;
    const dir = join(base, mod.name);
    let runs = [];
    try {
      runs = fs.readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
        .reverse();
    } catch { continue; }
    for (const old of runs.slice(keep)) {
      fs.rmSync(join(dir, old), { recursive: true, force: true });
      removed.push(`${mod.name}/${old}`);
    }
  }
  return removed;
}

/**
 * 事务写盘：全部落 tmp → 备份旧文件到 journal/rollback → 逐个 rename → 失败整批回滚。
 * 返回 changes（每个文件的 before/after 文本），供编辑器会话记录撤销/重做。
 * files: [{ rel, content }]
 */
export function writeFilesTransactional({ modDir, files, root, mod, backup = true }) {
  if (!Array.isArray(files) || !files.length) return { written: [], backups: [], snapshot: null, changes: [] };
  const journalDir = join(root, 'LCW', 'journal');
  const rollbackDir = join(journalDir, 'rollback', mod || 'mod', stamp());
  const staged = [];
  const backups = [];

  const manifestHits = [];
  for (let f of files) {
    const rel = String(f.rel).split('/').join(sep);
    const relPosix = String(f.rel).split('\\').join('/');
    const m = relPosix.match(/^custom_limbus_data\/(personality|skill|passive|buff)\/(.+)\.json$/);
    if (m && f.content !== null && typeof f.content === 'string') {
      try {
        const parsed = JSON.parse(f.content);
        const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.list) ? parsed.list : null);
        if (arr && arr.length) {
          let touched = false;
          for (const ent of arr) {
            if (!ent || typeof ent !== 'object' || ent.id == null) continue;
            markEntity(ent, { kind: m[1], mod: mod || '', id: ent.id });
            manifestHits.push({ kind: m[1], id: String(ent.id), rel: relPosix, name: ent.name != null ? ent.name : '' });
            touched = true;
          }
          if (touched) {
            f = Object.assign({}, f, { content: JSON.stringify(Array.isArray(parsed) ? arr : Object.assign({}, parsed, { list: arr }), null, 2) });
          }
        }
      } catch { /* 非严格 JSON：原样写入 */ }
    }
    const abs = join(modDir, rel);
    let before = null;
    try { if (fs.existsSync(abs)) before = fs.readFileSync(abs); } catch { before = null; }
    // content === null 表示删除该文件（人格删除等场景）
    if (f.content === null) {
      staged.push({ abs, tmp: null, rel: f.rel, before, after: null, fresh: false, del: true });
      continue;
    }
    const buf = Buffer.isBuffer(f.content) ? f.content : Buffer.from(String(f.content), 'utf8');
    if (buf.length > MAX_FILE_BYTES) throw new Error(`文件过大：${f.rel}`);
    ensureDir(dirname(abs));
    const tmp = join(dirname(abs), `.${basename(abs)}.tmp-${process.pid}-${Date.now()}-${staged.length}`);
    const fd = fs.openSync(tmp, 'w');
    try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    staged.push({ abs, tmp, rel: f.rel, before, after: buf, fresh: before === null });
  }

  if (backup) {
    for (const s of staged) {
      if (s.before === null) continue;
      const dest = join(rollbackDir, s.rel.split('/').join(sep));
      ensureDir(dirname(dest));
      fs.copyFileSync(s.abs, dest);
      backups.push(dest);
    }
  }

  const done = [];
  try {
    for (const s of staged) {
      if (s.del) { fs.rmSync(s.abs, { force: true }); done.push(s); continue; }
      fs.renameSync(s.tmp, s.abs);
      done.push(s);
    }
  } catch (err) {
    for (const s of done.slice().reverse()) {
      try {
        if (s.before === null) fs.rmSync(s.abs, { force: true });
        else fs.writeFileSync(s.abs, s.before);
      } catch { /* ignore */ }
    }
    for (const s of staged) { if (s.tmp) { try { fs.rmSync(s.tmp, { force: true }); } catch { /* ignore */ } } }
    throw err;
  }
  if (manifestHits.length) {
    try { recordManifest(root, manifestHits, mod || ''); } catch { /* 清单失败不影响写盘 */ }
  }
  pruneRollback(root);
  return {
    written: staged.map((s) => s.rel),
    backups,
    changes: staged.map((s) => ({
      rel: s.rel,
      before: s.before === null ? null : s.before.toString('utf8'),
      after: s.after === null ? null : s.after.toString('utf8'),
      fresh: s.fresh,
    })),
  };
}