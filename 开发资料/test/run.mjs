/* The Lethe Workbench · 自测（node test/run.mjs） */
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { cleanName, safeRel, resolveInside, SafetyError } from '../src/safety.mjs';
import { writeFilesTransactional, readJson } from '../src/atomic.mjs';
import { EditSession } from '../src/lethe/session.mjs';
import { mirrorMod, restoreFromSlot, slotInfo } from '../src/lethe/snapshot.mjs';
import { createUserBackup, listUserBackups, swapBackup } from '../src/lethe/backups.mjs';
import { readState, writeState, userBackupsDir, autoBackupsDir } from '../src/lethe/state.mjs';
import { homeStats } from '../src/lethe/stats.mjs';
import { inspectRoot } from '../src/locate.mjs';

let pass = 0;
let fail = 0;
const failures = [];
function ok(cond, name) {
  if (cond) { pass += 1; console.log(`  ok   ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL ${name}`); }
}
function throws(fn, name, needle = '') {
  try { fn(); ok(false, `${name}（应当抛错）`); } catch (err) {
    ok(err instanceof SafetyError || err instanceof Error, name);
    if (needle) ok(String(err.message).includes(needle), `${name} · 错误信息含「${needle}」`);
  }
}

const work = fs.mkdtempSync(join(tmpdir(), 'wb-test-'));
const lethe = join(work, 'BepInEx', 'plugins', 'Lethe');
const mods = join(lethe, 'mods');
const mod = join(mods, '测试Mod');
fs.mkdirSync(join(mod, 'custom_limbus_data', 'personality'), { recursive: true });
fs.mkdirSync(join(lethe, 'dumpedData'), { recursive: true });
fs.writeFileSync(join(work, 'LimbusCompany.exe'), '');
fs.writeFileSync(join(mod, 'custom_limbus_data', 'personality', '1.json'), JSON.stringify({ list: [{ id: 10101, rank: 1 }] }, null, 2));

console.log('\n[safety]');
ok(cleanName('金笠Mod') === '金笠Mod', '正常名称通过');
throws(() => cleanName('..'), '拒绝 ..', '不合法');
throws(() => cleanName('CON'), '拒绝 Windows 保留名', '保留名');
throws(() => cleanName('a/b'), '拒绝路径分隔符', '非法字符');
throws(() => cleanName('name.'), '拒绝结尾点号', '结尾');
ok(safeRel('a/b.json') === 'a/b.json', 'safeRel 正常');
throws(() => safeRel('a/../../x'), 'safeRel 拒绝 ..', '..');
throws(() => safeRel('C:\\x'), 'safeRel 拒绝盘符');
throws(() => resolveInside(work, '..\\x'), 'resolveInside 拒绝越界', '不能包含');
ok(resolveInside(work, 'a/b').endsWith('b'), 'resolveInside 正常');

console.log('\n[atomic]');
const r1 = writeFilesTransactional({
  modDir: mod, root: lethe, mod: '测试Mod',
  files: [{ rel: 'custom_limbus_data/personality/1.json', content: JSON.stringify({ list: [{ id: 10101, rank: 3 }] }, null, 2) }],
});
ok(r1.written.length === 1, '事务写入 1 个文件');
ok(readJson(join(mod, 'custom_limbus_data/personality/1.json')).list[0].rank === 3, '内容已更新');
ok(fs.existsSync(join(r1.backups[0])), '回滚副本存在');
ok(r1.changes[0].before.includes('"rank": 1') && r1.changes[0].after.includes('"rank": 3'), 'changes 带 before/after');

console.log('\n[session]');
const session = new EditSession(() => lethe);
session.record('测试Mod', 'personality:10101', '测试', r1.changes);
ok(session.state('测试Mod').dirty === true, 'record 后 dirty');
ok(session.canUndo('测试Mod', 'personality:10101'), 'canUndo');
session.undo('测试Mod', 'personality:10101');
ok(readJson(join(mod, 'custom_limbus_data/personality/1.json')).list[0].rank === 1, '撤销恢复旧内容');
session.redo('测试Mod', 'personality:10101');
ok(readJson(join(mod, 'custom_limbus_data/personality/1.json')).list[0].rank === 3, '重做恢复新内容');
session.clear('测试Mod', 'personality:10101');
ok(session.state('测试Mod').dirty === false, 'clear 后回到已保存');
ok(fs.existsSync(join(lethe, 'LCW', 'journal', '测试Mod', 'ops.jsonl')), '操作流水已落盘');

console.log('\n[snapshot]');
const slot = join(autoBackupsDir(lethe), '测试Mod');
fs.writeFileSync(join(mod, 'big.bin'), Buffer.alloc(9 * 1024 * 1024, 1));
fs.writeFileSync(join(mod, 'small.txt'), 'v1');
const m1 = mirrorMod(mod, slot);
ok(m1.files >= 3, `首次镜像 ${m1.files} 个文件`);
ok(slotInfo(slot)?.files >= 3, 'slotInfo 读到清单');
fs.writeFileSync(join(mod, 'small.txt'), 'v2');
const m2 = mirrorMod(mod, slot);
ok(m2.copied >= 1, '改动文件被复制');
ok(m2.kept >= 1, '未改动文件保留');
fs.writeFileSync(join(mod, 'small.txt'), 'broken');
restoreFromSlot(slot, mod);
ok(fs.readFileSync(join(mod, 'small.txt'), 'utf8') === 'v2', '从快照还原');

console.log('\n[backups]');
const b1 = createUserBackup(lethe, '测试Mod');
ok(/^测试Mod_\d{8}$/.test(b1.label), `备份名 ${b1.label} 含日期`);
const b2 = createUserBackup(lethe, '测试Mod');
ok(b2.label === `${b1.label}_2`, '同一天第二次备份加 _2');
ok(listUserBackups(lethe, '测试Mod').length >= 2, '备份列表');
fs.writeFileSync(join(mod, 'small.txt'), 'current');
swapBackup(lethe, '测试Mod', b1.label);
ok(fs.readFileSync(join(mod, 'small.txt'), 'utf8') === 'v2', '互换后当前版本变为备份内容');
const st = readState(lethe);
writeState(lethe, { ...st, editorName: '测试员' });
ok(readState(lethe).editorName === '测试员', 'state 读写');
ok(userBackupsDir(lethe).includes('用户保存'), '用户保存目录');

console.log('\n[stats/locate]');
const stats = homeStats(lethe, work);
ok(stats.modCount === 1, '统计 Mod 数');
ok(stats.dllCount === 0, '统计 DLL 数');
ok(stats.bytes > 0, '统计体积');
const info = inspectRoot(work);
ok(info.acceptable === true, 'inspectRoot 认出假私服');
ok(info.modsDir.toLowerCase().endsWith('mods'), 'modsDir 正确');

console.log('\n────────────────────────');
console.log(`通过 ${pass} · 失败 ${fail}`);
if (fail) { console.log('失败项：\n- ' + failures.join('\n- ')); process.exitCode = 1; }
try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
