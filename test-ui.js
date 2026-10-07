/* UI 层 DOM 测试（jsdom）
 * 跑法：
 *   node test-ui.js              → 测开发版（index.html + src/）
 *   node test-ui.js dist         → 测打包版单文件（八字排盘分析系统.html）
 */
const path = require('path');
const fs = require('fs');
const { JSDOM } = require(path.join('C:/Users/LENOVO/.workbuddy/binaries/node/workspace', 'node_modules', 'jsdom'));

const dir = __dirname;
const DIST = path.join(dir, '八字排盘分析系统.html');
const target = (process.argv[2] === 'dist') ? DIST : path.join(dir, 'index.html');
if (process.argv[2] === 'dist' && !fs.existsSync(DIST)) {
  console.error('打包文件不存在，请先运行 build.py');
  process.exit(1);
}
console.log('被测文件：' + path.basename(target) + '\n');

const html = fs.readFileSync(target, 'utf8');

const dom = new JSDOM(html, {
  url: 'file:///' + dir.replace(/\\/g, '/') + '/' + path.basename(target),
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true
});
const win = dom.window;
win.Element.prototype.scrollIntoView = function () { };
win.alert = function (m) { console.log('[alert] ' + m); };

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('✓ ' + name); }
  else { fail++; console.log('✗ ' + name + (extra ? ' → ' + extra : '')); }
}

const errors = [];
win.addEventListener('error', e => errors.push(e.message));

win.addEventListener('load', () => setTimeout(run, 400));

/* 辅助：设置下拉并触发联动 */
function set(doc, id, val) {
  const el = doc.getElementById(id);
  el.value = val;
  if (id === 'mo' || id === 'y' || id === 'lmo' || id === 'ly' || id === 'lLeap') {
    el.dispatchEvent(new win.Event('change', { bubbles: true }));
  }
}
function pillarsOf(doc) {
  return Array.from(doc.querySelectorAll('#bzGrid .bz-col')).map(
    c => c.querySelector('.bz-gan').textContent + c.querySelector('.bz-zhi').textContent);
}
/* 用标准时、关闭真太阳时，便于精确测边界 */
function useStandardTime(doc) {
  doc.getElementById('useTST').checked = false;
  doc.getElementById('useDST').checked = false;
  set(doc, 'city', '120'); doc.getElementById('lng').value = '120';
}

function run() {
  const doc = win.document;
  try {
    /* 1. 初始化 */
    ck('城市下拉已填充', doc.getElementById('city').options.length >= 20,
      doc.getElementById('city').options.length + '');
    ck('年份下拉 1900-2100', doc.getElementById('y').options.length === 201,
      doc.getElementById('y').options.length + '');
    ck('年份首末项正确',
      doc.getElementById('y').options[0].value === '1900' &&
      doc.getElementById('y').options[200].value === '2100');
    ck('时辰下拉 24 项', doc.getElementById('h').options.length === 24);
    ck('农历月下拉 12 项', doc.getElementById('lmo').options.length === 12);
    ck('理论页已静态渲染', doc.getElementById('pane-theory').innerHTML.length > 3000,
      doc.getElementById('pane-theory').innerHTML.length + ' chars');

    /* 2. 起盘（示例） */
    doc.getElementById('btnDemo').click();
    ck('结果区已显示', doc.getElementById('result').style.display !== 'none');
    ck('四柱渲染 4 列', doc.querySelectorAll('#bzGrid .bz-col').length === 4);
    ck('日柱高亮标记存在', doc.querySelectorAll('#bzGrid .bz-col.is-day').length === 1);
    ck('每柱都有藏干区', doc.querySelectorAll('#bzGrid .bz-cang').length === 4);

    const demo = pillarsOf(doc);
    ck('示例盘四柱非空', demo.every(s => s && s.length === 2), demo.join(' '));

    const info = doc.getElementById('infoList').textContent;
    ck('信息栏含日主', info.includes('日主'));
    ck('信息栏含月令', info.includes('月令'));
    ck('信息栏含起运', info.includes('起运'));
    ck('信息栏含真太阳时', info.includes('真太阳时'));

    /* 3. 九个页签都有内容 */
    ['zong', 'sizhu', 'qiangruo', 'geju', 'yongshen', 'dayun', 'shensha', 'theory'].forEach(t => {
      const p = doc.getElementById('pane-' + t);
      ck('页签 ' + t + ' 有内容', p && p.innerHTML.length > 200,
        p ? p.innerHTML.length + ' chars' : 'missing');
    });
    ck('流年内容已渲染', doc.getElementById('lnContent').innerHTML.length > 200);

    /* 4. 总论关键内容 */
    const zong = doc.getElementById('pane-zong').textContent;
    ck('总论含命局骨架', zong.includes('命局骨架'));
    ck('总论含格局定位', zong.includes('格局定位'));
    ck('总论含用神', zong.includes('用神'));
    ck('总论含当前大运', zong.includes('大运'));

    /* 5. 强弱页 */
    const qr = doc.getElementById('pane-qiangruo');
    ck('强弱页有判定徽章', qr.querySelectorAll('.lvl-badge').length === 1);
    ck('强弱页四看明细 5 项', qr.querySelectorAll('.score-row').length === 5,
      qr.querySelectorAll('.score-row').length + '');
    ck('强弱页有得分条', qr.querySelectorAll('.score-bar').length === 5);

    /* 6. 格局/用神页 */
    ck('格局页有八格对照表', doc.getElementById('pane-geju').textContent.includes('正官格'));
    const ysPane = doc.getElementById('pane-yongshen').textContent;
    ck('用神页含调候', ysPane.includes('调候'));
    ck('用神页含喜忌', ysPane.includes('喜用') && ysPane.includes('忌神'));

    /* 7. 大运页 */
    const dyItems = doc.querySelectorAll('#pane-dayun .dy-item');
    ck('大运排布 8 条', dyItems.length === 8, dyItems.length + '');
    ck('大运有当前 highlighting', doc.querySelectorAll('#pane-dayun .dy-item.cur').length <= 1);
    ck('大运页有逐运表', doc.querySelectorAll('#pane-dayun table.grid tbody tr').length === 8);

    /* 8. 流年切换 */
    doc.getElementById('lny').value = String(+doc.getElementById('lny').options[5].value);
    doc.getElementById('btnLn').click();
    const lnY = doc.getElementById('lny').value;
    ck('流年查询成功', doc.getElementById('lnContent').textContent.includes(lnY), lnY);
    const before = doc.getElementById('lnContent').textContent;
    doc.getElementById('btnLnNext').click();
    ck('下一年按钮生效', doc.getElementById('lnContent').textContent !== before);

    /* 9. 四柱详解切换 */
    const picks = doc.querySelectorAll('#pane-sizhu .palace-pick span');
    ck('四柱详解有 4 个选择项', picks.length === 4, picks.length + '');
    picks[0].click();
    ck('切到年柱详解', doc.getElementById('sizhuBody').textContent.includes('年柱'));
    doc.querySelectorAll('#pane-sizhu .palace-pick span')[3].click();
    ck('切到时柱详解', doc.getElementById('sizhuBody').textContent.includes('时柱'));

    /* 10. 点击大盘柱跳转 */
    doc.querySelectorAll('#bzGrid .bz-col')[1].click();
    ck('点击月柱跳到四柱详解页', doc.querySelector('.tab[data-tab="sizhu"]').classList.contains('on'));
    ck('且选中的是月柱', doc.getElementById('sizhuBody').textContent.includes('月柱'));

    /* 11. 立春换年边界（核心校验） */
    useStandardTime(doc);
    set(doc, 'y', '2026'); set(doc, 'mo', '2');
    set(doc, 'd', '4'); set(doc, 'h', '4'); set(doc, 'mi', '2');
    doc.getElementById('btnCalc').click();
    let p1 = pillarsOf(doc);
    ck('2026-02-04 04:02（立春当刻）→ 年柱丙午', p1[0] === '丙午', p1.join(' '));
    ck('且月柱已换寅', p1[1].charAt(1) === '寅', p1[1]);

    set(doc, 'mi', '1');
    doc.getElementById('btnCalc').click();
    let p2 = pillarsOf(doc);
    ck('2026-02-04 04:01（立春前一分钟）→ 年柱乙巳', p2[0] === '乙巳', p2.join(' '));
    ck('且月柱仍为丑', p2[1].charAt(1) === '丑', p2[1]);

    /* 12. 换月只看「节」：2026 芒种 = 6月5日 23:48（打到分钟边界） */
    set(doc, 'y', '2026'); set(doc, 'mo', '6'); set(doc, 'd', '5');
    set(doc, 'h', '23'); set(doc, 'mi', '47');
    doc.getElementById('btnCalc').click();
    ck('2026-06-05 23:47（芒种前 1 分）月支仍为巳', pillarsOf(doc)[1].charAt(1) === '巳', pillarsOf(doc)[1]);
    set(doc, 'mi', '48');
    doc.getElementById('btnCalc').click();
    ck('2026-06-05 23:48（芒种当刻）月支换午', pillarsOf(doc)[1].charAt(1) === '午', pillarsOf(doc)[1]);
    set(doc, 'mo', '7'); set(doc, 'd', '15'); set(doc, 'h', '12'); set(doc, 'mi', '0');
    doc.getElementById('btnCalc').click();
    ck('「气」不换月：小暑后 7-15 仍为未月', pillarsOf(doc)[1].charAt(1) === '未', pillarsOf(doc)[1]);

    /* 13. 夏令时 */
    doc.getElementById('useDST').checked = true;
    doc.getElementById('useTST').checked = false;
    set(doc, 'city', '120'); doc.getElementById('lng').value = '120';
    set(doc, 'y', '1988'); set(doc, 'mo', '7'); set(doc, 'd', '15'); set(doc, 'h', '9'); set(doc, 'mi', '30');
    doc.getElementById('btnCalc').click();
    let infoDst = doc.getElementById('infoList').textContent;
    ck('1988-07-15 被识别为夏令时', infoDst.includes('夏令时'), infoDst.slice(0, 120));
    const withDst = pillarsOf(doc);
    doc.getElementById('useDST').checked = false;
    doc.getElementById('btnCalc').click();
    const noDst = pillarsOf(doc);
    ck('夏令时回拨使时柱由巳→辰（跨时辰）',
      withDst[3].charAt(1) === '辰' && noDst[3].charAt(1) === '巳',
      '开=' + withDst[3] + ' / 关=' + noDst[3]);
    set(doc, 'y', '2020'); set(doc, 'mo', '7'); set(doc, 'd', '15');
    doc.getElementById('useDST').checked = true;
    doc.getElementById('btnCalc').click();
    ck('非夏令时年份不被误判', !doc.getElementById('infoList').textContent.includes('夏令时'));

    /* 14. 晚子时两种口径 */
    doc.getElementById('useDST').checked = false;
    set(doc, 'y', '2000'); set(doc, 'mo', '6'); set(doc, 'd', '15'); set(doc, 'h', '23'); set(doc, 'mi', '30');
    doc.getElementById('ziSwap').value = '0';
    doc.getElementById('btnCalc').click();
    const zi0 = pillarsOf(doc);
    doc.getElementById('ziSwap').value = '1';
    doc.getElementById('btnCalc').click();
    const zi1 = pillarsOf(doc);
    ck('晚子时两种口径结果不同', zi0[2] !== zi1[2] || zi0[3] !== zi1[3],
      '古法 ' + zi0.join(' ') + ' / 换日 ' + zi1.join(' '));

    /* 15. 起运两种口径 */
    doc.getElementById('ziSwap').value = '0';
    set(doc, 'y', '1990'); set(doc, 'mo', '5'); set(doc, 'd', '20'); set(doc, 'h', '12'); set(doc, 'mi', '0');
    doc.getElementById('qiyunMode').value = 'linear';
    doc.getElementById('btnCalc').click();
    const yL = doc.getElementById('pane-dayun').querySelector('.card-text').textContent;
    doc.getElementById('qiyunMode').value = 'shichen';
    doc.getElementById('btnCalc').click();
    const yS = doc.getElementById('pane-dayun').querySelector('.card-text').textContent;
    ck('起运口径切换可用且都有数值', /相差\s*\d+\s*天/.test(yL) && /相差\s*\d+\s*天/.test(yS));
    ck('两种口径文案区分明显',
      yL.includes('三日折一岁') && yS.includes('一时辰折十日'),
      yL.includes('三日折一岁') + '/' + yS.includes('一时辰折十日'));

    /* 16. 农历输入模式 */
    doc.getElementById('calL').checked = true;
    doc.getElementById('calL').dispatchEvent(new win.Event('change', { bubbles: true }));
    ck('切换到农历输入面板', doc.getElementById('lunarBox').style.display !== 'none');
    set(doc, 'ly', '1990'); set(doc, 'lmo', '4');
    set(doc, 'ld', '26'); set(doc, 'lh', '12'); set(doc, 'lmi', '0');
    doc.getElementById('btnCalc').click();
    ck('农历输入可起盘', doc.querySelectorAll('#bzGrid .bz-col').length === 4);
    ck('农历四月廿六 → 公历 1990-05-20',
      doc.getElementById('infoList').textContent.includes('四月廿六') &&
      doc.getElementById('infoList').textContent.includes('1990-05-20'),
      doc.getElementById('infoList').textContent.slice(0, 120));

    /* 17. 闰月 */
    set(doc, 'ly', '2020'); set(doc, 'lmo', '4');
    const cb = doc.getElementById('lLeap');
    ck('2020 年闰四月复选框可用', !cb.disabled);
    cb.checked = true; cb.dispatchEvent(new win.Event('change', { bubbles: true }));
    set(doc, 'ld', '15'); set(doc, 'lh', '8');
    doc.getElementById('btnCalc').click();
    ck('闰四月可起盘', doc.querySelectorAll('#bzGrid .bz-col').length === 4);

    /* 18. 性别影响大运顺逆 */
    doc.getElementById('calS').checked = true;
    doc.getElementById('calS').dispatchEvent(new win.Event('change', { bubbles: true }));
    set(doc, 'y', '1990'); set(doc, 'mo', '5'); set(doc, 'd', '20'); set(doc, 'h', '12'); set(doc, 'mi', '0');
    doc.getElementById('sexM').checked = true;
    doc.getElementById('btnCalc').click();
    const male = doc.getElementById('pane-dayun').querySelector('.card-text').textContent;
    const maleDir = /顺行|逆行/.exec(male)[0];
    doc.getElementById('sexF').checked = true;
    doc.getElementById('btnCalc').click();
    const female = doc.getElementById('pane-dayun').querySelector('.card-text').textContent;
    const femaleDir = /顺行|逆行/.exec(female)[0];
    ck('1990 庚午年男女大运方向相反', maleDir !== femaleDir, maleDir + ' / ' + femaleDir);

    /* 19. 理论速查内容 */
    const th = doc.getElementById('pane-theory').textContent;
    ck('理论页含立春换年铁律', th.includes('立春'));
    ck('理论页含十神表', th.includes('比肩') && th.includes('七杀') && th.includes('正印'));
    ck('理论页含藏干表', th.includes('本气'));
    ck('理论页含旺相休囚死', th.includes('当令'));
    ck('理论页含用神五法', th.includes('扶抑') && th.includes('调候') && th.includes('通关'));
    ck('理论页含断盘六步', th.includes('第 1 步'));
    ck('理论页含书目', th.includes('子平真诠'));
    ck('理论页含流派差异', th.includes('早晚子时'));
    ck('十神对照表 10x10', doc.querySelectorAll('#pane-theory table.grid').length >= 4);

    /* 20. 越界保护 */
    doc.getElementById('useTST').checked = true;
    set(doc, 'y', '2100'); set(doc, 'mo', '12'); set(doc, 'd', '31'); set(doc, 'h', '23'); set(doc, 'mi', '0');
    doc.getElementById('btnCalc').click();
    ck('上界 2100-12-31 不崩溃', doc.querySelectorAll('#bzGrid .bz-col').length === 4);

    /* 21. 单文件自包含检查（仅 dist 模式） */
    if (process.argv[2] === 'dist') {
      ck('无外链 script', html.indexOf('<script src=') === -1);
      ck('无外链 css', html.indexOf('<link rel="stylesheet"') === -1);
      const stats = fs.statSync(DIST);
      ck('文件体积合理（100KB–1MB）', stats.size > 100000 && stats.size < 1000000,
        (stats.size / 1024).toFixed(0) + ' KB');
      ck('已内联节气数据', html.indexOf('JIEQI_DATA') > 0);
      ck('已内联农历数据', html.indexOf('LUNAR_DATA') > 0);
    }

    console.log('\nJS 运行时错误: ' + (errors.length ? errors.join(' | ') : '无'));
    if (errors.length) fail++;
    console.log('通过: ' + pass + ' / 失败: ' + fail);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('✗ 测试异常: ' + e.message);
    console.log(e.stack.split('\n').slice(0, 8).join('\n'));
    process.exit(1);
  }
}
