const fs = require('fs');
const P = 'test/smoke.mjs';
let s = fs.readFileSync(P, 'utf8');
const oldBlock = s.slice(s.indexOf("    // 各编辑器"), s.indexOf("    // 底栏同项点击 = 回区域顶层"));
const newBlock = `    // 各编辑器：以 S.editKind + 容器为准（人格先说罪人页，不要求已选人格）
    const openKind = async (kind, sel) => {
      await client.evalJs(\`(document.querySelector('.wiz[data-kind="\${kind}"]') || {click(){}}).click(); true\`);
      await wait(900);
      return client.evalJs(\`({ek: window.__WBS.editKind, has: Boolean(document.querySelector('\${sel}')), n: document.querySelectorAll('\${sel}').length})\`);
    };
    const p = await openKind('personality', '[data-act="pick-sinner"]');
    check('08 人格编辑器打开', p.ek === 'personality' && p.n > 0, JSON.stringify(p));
    const sk = await openKind('skill', '.skill-wrap');
    check('09 技能编辑器打开', sk.ek === 'skill' && sk.has, JSON.stringify(sk));
    const pa = await openKind('passive', '.skill-wrap');
    check('10 被动编辑器打开', pa.ek === 'passive' && pa.has, JSON.stringify(pa));
    const bf = await openKind('buff', '.skill-wrap');
    check('11 Buff 编辑器打开', bf.ek === 'buff' && bf.has, JSON.stringify(bf));
    const md = await openKind('module', '[data-act="open-module"], .module-form, .mb-canvas');
    check('12 模块编辑器打开', md.ek === 'module' && md.n > 0, JSON.stringify(md));

`;
s = s.replace(oldBlock, () => newBlock);
fs.writeFileSync(P, s, 'utf8');
console.log('smoke 8-12 已改为 S.editKind 断言');
