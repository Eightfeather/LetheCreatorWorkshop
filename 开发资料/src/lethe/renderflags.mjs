// 渲染兼容开关（与宿主 host/MainForm.cs 共用 %LOCALAPPDATA%\LetheWorkbench\flags.json）
// 宿主在启动 WebView2 前读这个文件；改了之后需要重启编辑器才生效。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { USER_DATA_DIR } from '../paths.mjs';

export function flagsPath() {
  return join(USER_DATA_DIR, 'flags.json');
}

const DEFAULTS = { disableGpu: false };

export function readRenderFlags() {
  const p = flagsPath();
  try {
    if (!existsSync(p)) return { ...DEFAULTS, path: p, exists: false };
    const raw = readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      disableGpu: Boolean(parsed && parsed.disableGpu),
      updatedAt: parsed && parsed.updatedAt ? String(parsed.updatedAt) : null,
      path: p,
      exists: true,
    };
  } catch (err) {
    return { ...DEFAULTS, path: p, exists: true, error: String(err && err.message ? err.message : err) };
  }
}

export function writeRenderFlags(patch = {}) {
  const p = flagsPath();
  const cur = readRenderFlags();
  const next = {
    disableGpu: patch.disableGpu === undefined ? Boolean(cur.disableGpu) : Boolean(patch.disableGpu),
    updatedAt: new Date().toISOString(),
  };
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return { ...next, path: p, exists: true, restartRequired: true };
}
