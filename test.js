/* 交叉验证：JS 排盘结果 vs lunar-python 参考结果
 * 跑法：node test.js
 */
const fs = require('fs');
const path = require('path');
global.window = global;

require('./src/lunar-data.js');
require('./src/jieqi-data.js');
require('./src/00-lunar.js');
require('./src/01-bazi-core.js');

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf-8'));
const B = window.BaziCore;

let pass = 0, fail = 0;
const fails = [];

function run(zwSwap) {
  let p = 0, f = 0;
  cases.forEach(c => {
    const [y, mo, d, h, mi] = c.in;
    if (y < 1901 || y > 2099) return; // 节气表边界保护
    const sectKey = zwSwap ? 'sect1' : 'sect2';
    const expect = c[sectKey];
    let got;
    try {
      const chart = B.paipan({
        year: y, month: mo, day: d, hour: h, minute: mi,
        sex: 'M', lng: 120, dst: false, ziSwap: zwSwap, useTST: false
      });
      got = chart.pillars.map(x => x.ganzhi);
    } catch (e) {
      got = ['ERR:' + e.message];
    }
    const ok = JSON.stringify(got) === JSON.stringify(expect);
    if (ok) { p++; } else {
      f++;
      fails.push({ note: c.note, in: c.in, sect: sectKey, expect, got });
    }
  });
  return [p, f];
}

console.log('=== 四柱交叉验证（vs lunar-python 寿星万年历）===\n');

const [p1, f1] = run(false);
console.log('口径一 · 晚子时日柱不变、时柱按次日遁：', p1, '通过 /', f1, '失败');
const [p2, f2] = run(true);
console.log('口径二 · 晚子时日柱换日：                ', p2, '通过 /', f2, '失败');

if (fails.length) {
  console.log('\n--- 失败明细（前 12 条）---');
  fails.slice(0, 12).forEach(x => {
    console.log(x.note, JSON.stringify(x.in), x.sect, '期望', x.expect.join(' '), '实际', x.got.join(' '));
  });
}

/* ---------- 大运验证 ---------- */
console.log('\n=== 大运验证（vs lunar-python，男女双命 × 两种起运口径）===');
let dyPass = 0, dyFail = 0, agePass = 0, ageFail = 0;
const dyFails = [], ageFails = [];
cases.forEach(c => {
  const [y, mo, d, h, mi] = c.in;
  if (y < 1901 || y > 2099) return;
  [['1', 'M'], ['2', 'F']].forEach(([g, sex]) => {
    [['1', 'shichen'], ['2', 'linear']].forEach(([s, mode]) => {
      const ref = c.sex && c.sex[g] && c.sex[g][s];
      if (!ref || !ref.dayun || ref.dayun.length < 5) return;
      const expectYun = ref.dayun.slice(1, 5);   // 跳过童限
      let chart;
      try {
        chart = B.paipan({
          year: y, month: mo, day: d, hour: h, minute: mi,
          sex: sex, lng: 120, dst: false, useTST: false, qiyunMode: mode
        });
      } catch (e) { dyFail++; return; }
      const got = chart.dayun.list.slice(0, 4).map(x => x.ganzhi);
      if (JSON.stringify(got) === JSON.stringify(expectYun)) dyPass++;
      else { dyFail++; dyFails.push({ sex, mode, in: c.in, expect: expectYun, got }); }
      if (chart.dayun.years === ref.y && chart.dayun.months === ref.m) agePass++;
      else {
        ageFail++;
        if (ageFails.length < 6) ageFails.push({ sex, mode, in: c.in, exp: [ref.y, ref.m, ref.d], got: [chart.dayun.years, chart.dayun.months, chart.dayun.days] });
      }
    });
  });
});
console.log('大运干支：', dyPass, '通过 /', dyFail, '失败');
console.log('起运岁数（年+月完全匹配）：', agePass, '通过 /', ageFail, '失败');
if (dyFails.length) {
  console.log('\n--- 大运干支失败明细（前 6 条）---');
  dyFails.slice(0, 6).forEach(x => console.log(x.sex, x.mode, JSON.stringify(x.in), '期望', x.expect.join(' '), '实际', x.got.join(' ')));
}
if (ageFails.length) {
  console.log('\n--- 起运岁数不符明细（前 6 条）---');
  ageFails.forEach(x => console.log(x.sex, x.mode, JSON.stringify(x.in), '期望', x.exp.join('-'), '实际', x.got.join('-')));
}

/* ---------- 自洽性检查 ---------- */
console.log('\n=== 自洽性检查 ===');
let selfOk = 0, selfBad = 0;
cases.forEach(c => {
  const [y, mo, d, h, mi] = c.in;
  if (y < 1901 || y > 2099) return;
  const ch = B.paipan({ year: y, month: mo, day: d, hour: h, minute: mi, sex: 'M', lng: 120, dst: false, useTST: false });
  const [Y, M, D, H] = ch.pillars;
  // 五虎遁：月干应由年干推出
  const mg = B.monthGan(Y.gan, M.zhi);
  // 五鼠遁：时干应由日干推出（非晚子时情形）
  const hg = B.hourGan(D.gan, H.zhi);
  let bad = [];
  if (mg !== M.gan) bad.push('五虎遁不符');
  if (!ch.isLateZi && hg !== H.gan) bad.push('五鼠遁不符');
  if (bad.length) { selfBad++; if (selfBad <= 5) console.log('✗', JSON.stringify(c.in), bad.join('、')); }
  else selfOk++;
});
console.log('自洽：', selfOk, '通过 /', selfBad, '失败');

const totalFail = f1 + f2 + selfBad;
console.log('\n==============================');
console.log(totalFail === 0 ? '全部通过 ✓' : ('总计失败：' + totalFail + ' 处'));
process.exit(totalFail === 0 ? 0 : 1);
