import { keywordTables } from './keywords.mjs';
import { i18nTables } from '../knowledge/personality-i18n.mjs';
import { allAppearanceStrings } from './personality.mjs';

/**
 * 启动预热（v0.9.9）：把「第一次打开某页才付的冷启动成本」提前到定位成功后，
 * 让后续所有页面都不再出现「正在加载」。
 * - i18nTables：罪孽 / 基础属性 / 词条表（含汉化包兜底）
 * - keywordTables：时点与 Buff 词表（模块调色板 + 描述校验）
 * - allAppearanceStrings：外观资源名全量扫描（原 4.6s，是人格页首慢的根因）
 * 全部失败都不影响主流程，只写日志。
 */
let last = null;
let running = false;

export function warmupState() {
  return last;
}

export async function warmupCaches(letheRoot, log = () => {}) {
  if (!letheRoot || running) return last;
  running = true;
  const t0 = Date.now();
  const out = { at: new Date().toISOString(), root: letheRoot, steps: [] };
  const step = (name, fn) => {
    const s = Date.now();
    try {
      const r = fn();
      const ms = Date.now() - s;
      const size = (r && typeof r === 'object') ? Object.keys(r).length : 0;
      out.steps.push({ name, ms, ok: true, size });
      return r;
    } catch (e) {
      out.steps.push({ name, ms: Date.now() - s, ok: false, error: String(e && e.message || e) });
      return null;
    }
  };
  step('i18n', () => i18nTables(letheRoot, true));
  step('keywords', () => keywordTables(letheRoot, true));
  step('appearances', () => allAppearanceStrings(letheRoot, true));
  out.totalMs = Date.now() - t0;
  last = out;
  running = false;
  try {
    const ok = out.steps.filter((s) => s.ok).length;
    log('预热完成：' + ok + '/' + out.steps.length + ' 项，共 ' + out.totalMs + ' ms');
  } catch { /* ignore */ }
  return out;
}
