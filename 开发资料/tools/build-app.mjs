// 组装桌面单文件：内嵌后端的 gzip + WebView2 运行时 + net48 宿主
import { execFileSync } from 'node:child_process';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = join(ROOT, 'host');
const BUILD = join(ROOT, 'build');
const PAYLOAD = join(BUILD, 'payload');
const SERVER_EXE = join(ROOT, 'dist', 'server', 'LetheWorkbenchServer.exe');
const OUT = join(ROOT, 'dist', 'app');
const PKG = join(process.env.USERPROFILE, '.nuget', 'packages', 'microsoft.web.webview2', '1.0.3351.48');
const DOTNET = process.env.DOTNET_EXE || 'C:\\Program Files\\dotnet\\dotnet.exe';

if (!existsSync(SERVER_EXE)) throw new Error('先跑 tools/build-server.mjs');
if (!existsSync(PKG)) {
  throw new Error(
    '缺少 WebView2 NuGet 包：' + PKG + '\n' +
    '请执行：dotnet restore host/TheLetheWorkbench.csproj（需要联网）'
  );
}

mkdirSync(PAYLOAD, { recursive: true });
rmSync(PAYLOAD, { recursive: true, force: true });
mkdirSync(PAYLOAD, { recursive: true });

async function gzipServer() {
  const target = join(PAYLOAD, 'payload.server.exe.gz');
  await pipeline(createReadStream(SERVER_EXE), createGzip({ level: 9 }), createWriteStream(target));
  return statSync(target).size;
}

function copyRuntime() {
  const pairs = [
    [join(PKG, 'lib', 'net462', 'Microsoft.Web.WebView2.Core.dll'), 'Microsoft.Web.WebView2.Core.dll'],
    [join(PKG, 'lib', 'net462', 'Microsoft.Web.WebView2.WinForms.dll'), 'Microsoft.Web.WebView2.WinForms.dll'],
    [join(PKG, 'runtimes', 'win-x64', 'native', 'WebView2Loader.dll'), 'WebView2Loader.dll'],
  ];
  for (const [src, name] of pairs) {
    if (!existsSync(src)) throw new Error('缺少：' + src);
    copyFileSync(src, join(PAYLOAD, name));
  }
}

function makeIcon() {
  const ico = join(HOST, 'app.ico');
  if (existsSync(ico)) return 'exists';
  const script = join(BUILD, 'make-icon.ps1');
  const ps = [
    'Add-Type -AssemblyName System.Drawing',
    '$bmp = New-Object System.Drawing.Bitmap 256,256',
    '$g = [System.Drawing.Graphics]::FromImage($bmp)',
    '$g.SmoothingMode = "AntiAlias"',
    '$g.Clear([System.Drawing.ColorTranslator]::FromHtml("#12100E"))',
    '$gold = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#C6A15B"))',
    '$pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#C6A15B")), 8',
    '$g.DrawRectangle($pen, 18, 18, 220, 220)',
    '$font = New-Object System.Drawing.Font("Georgia", 150, ([System.Drawing.FontStyle]::Bold))',
    '$fmt = New-Object System.Drawing.StringFormat',
    '$fmt.Alignment = "Center"',
    '$fmt.LineAlignment = "Center"',
    '$g.DrawString("L", $font, $gold, (New-Object System.Drawing.RectangleF 0,0,256,256), $fmt)',
    '$g.Dispose()',
    '$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())',
    '$fs = [System.IO.File]::Create($Out)',
    '$icon.Save($fs)',
    '$fs.Close()',
  ].join('; ');
  const src = 'param([string]$Out)' + String.fromCharCode(10) + ps;
  writeFileSync(script, src, 'utf8');
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ico], { stdio: 'inherit' });
  return 'generated';
}

function buildHost() {
  rmSync(OUT, { recursive: true, force: true });
  // 先 restore：接手人机器 NuGet 缓存为空时，直接 build 会报 NETSDK1064
try {
  execFileSync(DOTNET, ['restore', join(HOST, 'TheLetheWorkbench.csproj'), '-v', 'minimal'], { stdio: 'inherit' });
} catch (e) {
  console.log('[build-app] dotnet restore 失败，继续尝试 build：' + e.message);
}
execFileSync(DOTNET, ['build', join(HOST, 'TheLetheWorkbench.csproj'), '-c', 'Release', '-o', OUT, '-v', 'minimal', '-nologo'], { stdio: 'inherit' });
  return join(OUT, 'TheLetheWorkbench.exe');
}

const gz = await gzipServer();
console.log('[build-app] 后端已压缩：' + gz + ' B');
copyRuntime();
console.log('[build-app] WebView2 运行时已就位');
console.log('[build-app] 图标：' + makeIcon());
const exe = buildHost();
const ROOT_EXE = join(ROOT, '..', 'TheLetheWorkbench.exe');
let copied = false;
try { copyFileSync(exe, ROOT_EXE); copied = true; } catch (e) { console.log('[build-app] 复制到项目根失败（可能正在运行，请先关闭编辑器）：' + e.message); }
console.log('[build-app] 完成：' + exe + ' (' + statSync(exe).size + ' B)');
if (copied) console.log('[build-app] 已复制到项目根：' + ROOT_EXE);