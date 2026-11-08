/** 打包形态下的虚拟资源（单文件 exe 里没有 src/web 目录可读） */
let VIRTUAL = null;

export function setAssets(map) { VIRTUAL = map || null; }

export function hasVirtualAssets() { return Boolean(VIRTUAL && Object.keys(VIRTUAL).length); }

export function assetKeys() { return VIRTUAL ? Object.keys(VIRTUAL) : []; }

/** 二进制资源（打包时以 base64: 前缀存放） */
export function assetBase64(key) {
  if (!VIRTUAL) return null;
  const v = VIRTUAL[key];
  if (typeof v !== 'string') return null;
  const i = v.indexOf('base64:');
  return i === 0 ? v.slice(7) : null;
}

/** key 例如 web/index.html / data/timings.json */
export function assetText(key) {
  if (!VIRTUAL) return null;
  const v = VIRTUAL[key];
  return typeof v === 'string' ? v : null;
}