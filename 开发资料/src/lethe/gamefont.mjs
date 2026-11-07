// 游戏字体定位：从 Lethe 根向上找 LimbusCompany_Data\Lang\*\Font\Context\*.ttf
import fs from 'node:fs';
import path from 'node:path';

const EXACT = ['LimbusCompany_Data', 'Lang', 'LLC_zh-CN', 'Font', 'Context', 'ChineseFont.ttf'];
let cache = { key: null, at: 0, hit: null };

function upRoots(start, maxUp = 6) {
  const out = [];
  let cur = path.resolve(start || '.');
  for (let i = 0; i <= maxUp; i++) {
    out.push(cur);
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return out;
}

function scanLangTtf(root) {
  const langRoot = path.join(root, 'LimbusCompany_Data', 'Lang');
  const found = [];
  let dirs = [];
  try { dirs = fs.readdirSync(langRoot); } catch (e) { return found; }
  for (const d of dirs) {
    const ctx = path.join(langRoot, d, 'Font', 'Context');
    let files = [];
    try { files = fs.readdirSync(ctx); } catch (e) { continue; }
    for (const f of files) if (/\.(ttf|otf)$/i.test(f)) found.push({ file: path.join(ctx, f), score: /ChineseFont/i.test(f) ? 0 : 1 });
  }
  return found.sort((a, b) => a.score - b.score).map((x) => x.file);
}

export function findGameFont(letheRoot, { ttl = 30000 } = {}) {
  const now = Date.now();
  if (cache.hit && cache.key === letheRoot && now - cache.at < ttl) return cache.hit;
  let hit = null;
  const roots = upRoots(letheRoot);
  for (const r of roots) {
    const p = path.join(r, ...EXACT);
    try {
      const st = fs.statSync(p);
      if (st.isFile() && st.size > 1024) { hit = { path: p, size: st.size, mtime: st.mtimeMs, source: 'exact' }; break; }
    } catch (e) { /* next */ }
  }
  if (!hit) {
    for (const r of roots) {
      for (const p of scanLangTtf(r)) {
        try {
          const st = fs.statSync(p);
          hit = { path: p, size: st.size, mtime: st.mtimeMs, source: 'scan' };
          break;
        } catch (e) { /* next */ }
      }
      if (hit) break;
    }
  }
  cache = { key: letheRoot, at: now, hit };
  return hit;
}

export function clearFontCache() { cache = { key: null, at: 0, hit: null }; }
