import * as fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { normalizePath } from './paths.mjs';

const MARK_DIRS = ['BepInEx/plugins/Lethe', 'plugins/Lethe'];
const HINTS = /lethe|limbus|边狱|私服|mod/i;

function dirExists(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function fileExists(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }

/** 某个目录是否像一个 Lethe 根（含 mods 或 dumpedData） */
export function isLetheRoot(dir) {
  return dirExists(join(dir, 'mods')) || dirExists(join(dir, 'dumpedData'));
}

function findUp(start, target, maxDepth = 6) {
  let cur = start;
  for (let i = 0; i < maxDepth; i += 1) {
    if (fileExists(join(cur, target)) || dirExists(join(cur, target))) return cur;
    const up = dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  return '';
}

/**
 * 给一个候选目录打分，返回 Lethe 根 / 游戏根 / 证据
 */
export function inspectRoot(input) {
  const given = normalizePath(input);
  let letheRoot = '';
  let gameRoot = '';

  for (const rel of MARK_DIRS) {
    const p = join(given, ...rel.split('/'));
    if (dirExists(p)) { letheRoot = p; gameRoot = given; break; }
  }
  if (!letheRoot && isLetheRoot(given)) {
    letheRoot = given;
    gameRoot = findUp(dirname(given), 'LimbusCompany.exe') || findUp(dirname(given), 'LimbusCompany_Data') || '';
  }
  if (!letheRoot) {
    // 用户可能选了 mods 目录或 mods 下的某个 mod
    if (isLetheRoot(dirname(given)) && !isLetheRoot(given)) {
      letheRoot = dirname(given);
      gameRoot = findUp(dirname(letheRoot), 'LimbusCompany.exe') || '';
    }
  }

  const marks = {
    lethe: Boolean(letheRoot),
    mods: letheRoot ? dirExists(join(letheRoot, 'mods')) : false,
    dumpedData: letheRoot ? dirExists(join(letheRoot, 'dumpedData')) : false,
    template: letheRoot ? dirExists(join(letheRoot, 'ModTemplate')) : false,
    exe: Boolean(findUp(given, 'LimbusCompany.exe', 3)),
    data: Boolean(findUp(given, 'LimbusCompany_Data', 3)),
  };

  let score = 0;
  if (marks.lethe) score += 4;
  if (marks.mods) score += 3;
  if (marks.dumpedData) score += 2;
  if (marks.template) score += 1;
  if (marks.exe) score += 2;
  if (marks.data) score += 1;

  return {
    input: given,
    acceptable: Boolean(letheRoot) && score >= 6,
    score,
    letheRoot,
    gameRoot: gameRoot || (letheRoot ? dirname(dirname(letheRoot)) : ''),
    modsDir: letheRoot ? join(letheRoot, 'mods') : '',
    dumpedData: letheRoot ? join(letheRoot, 'dumpedData') : '',
    modCount: letheRoot && dirExists(join(letheRoot, 'mods'))
      ? fs.readdirSync(join(letheRoot, 'mods'), { withFileTypes: true }).filter((d) => d.isDirectory()).length
      : 0,
    marks,
  };
}

/** 枚举存在的盘符 */
function drives() {
  const out = [];
  for (let c = 67; c <= 90; c += 1) {
    const d = `${String.fromCharCode(c)}:\\`;
    try { fs.statSync(d); out.push(d); } catch { /* not present */ }
  }
  return out;
}

/** 有限深度扫描（找“长得像私服”的目录）；返回候选，不要求全部命中 */
export const scanStats = { drives: 0, visited: 0, errors: 0, budgetMs: 0, reason: '' };

export function scanForLethe({ maxDepth = 3, budgetMs = 12000, onProgress } = {}) {
  const started = Date.now();
  const found = [];
  const roots = drives();
  scanStats.drives = roots.length;
  scanStats.visited = 0;
  scanStats.errors = 0;
  scanStats.budgetMs = budgetMs;
  scanStats.reason = '';
  const queue = roots.map((d) => ({ dir: d, depth: 0 }));
  while (queue.length) {
    if (Date.now() - started > budgetMs) { scanStats.reason = 'timeout'; break; }
    const { dir, depth } = queue.shift();
    let entries = [];
    scanStats.visited += 1;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { scanStats.errors += 1; continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const p = join(dir, e.name);
      if (e.name.startsWith('$') || e.name === 'Windows' || e.name === 'System Volume Information') continue;
      if (isLetheRoot(p) || dirExists(join(p, 'BepInEx', 'plugins', 'Lethe'))) {
        found.push(inspectRoot(p));
        onProgress?.(found.length, p);
      } else if (depth < maxDepth && HINTS.test(e.name)) {
        queue.push({ dir: p, depth: depth + 1 });
      }
    }
  }
  return found;
}

/**
 * 定位：显式 → 配置 → 最近使用 → 有限扫描
 * quick = 不扫盘（只认配置/显式/程序邻居）
 */
export function locate({ explicit, config = {}, quick = false, budgetMs = 8000, onProgress } = {}) {
  const tried = [];
  const candidates = [];
  const push = (input, from) => {
    if (!input) return;
    if (!dirExists(String(input))) return;
    const p = normalizePath(input);
    if (!p) return;
    if (tried.some((t) => t.toLowerCase() === p.toLowerCase())) return;
    tried.push(p);
    const info = inspectRoot(p);
    info.from = from;
    candidates.push(info);
  };

  push(explicit, 'explicit');
  const explicitOk = candidates.find((c) => c.from === 'explicit' && c.acceptable);
  if (explicitOk) return { best: explicitOk, candidates, tried, scanned: false };
  push(config.letheRoot, 'config.letheRoot');
  const configOk = candidates.find((c) => c.from === 'config.letheRoot' && c.acceptable);
  if (configOk) return { best: configOk, candidates, tried, scanned: false };
  push(config.gameRoot, 'config.gameRoot');
  const gameOk = candidates.find((c) => c.from === 'config.gameRoot' && c.acceptable);
  if (gameOk) return { best: gameOk, candidates, tried, scanned: false };
  for (const r of config.recentRoots || []) push(r, 'recent');

  if (!quick) {
    for (const c of scanForLethe({ budgetMs, onProgress })) {
      if (!candidates.some((x) => x.letheRoot.toLowerCase() === c.letheRoot.toLowerCase())) {
        c.from = 'scan';
        candidates.push(c);
      }
    }
  }

  const ranked = candidates.filter((c) => c.acceptable).sort((a, b) => b.score - a.score);
  return { best: ranked[0] || null, candidates, tried, scanned: !quick };
}