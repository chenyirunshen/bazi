/* =============================================================
 *  UI 逻辑：输入 → 排盘 → 渲染九个页签（含理论速查）
 * ============================================================= */
(function () {
  'use strict';

  var LK = window.LunarKit, B = window.BaziCore, I = window.BaziInterp;

  var CITIES = [
    ['北京', 116.41], ['上海', 121.47], ['广州', 113.26], ['深圳', 114.06],
    ['宿迁', 118.28], ['沭阳', 118.79], ['泗洪', 118.21], ['南京', 118.78],
    ['杭州', 120.15], ['成都', 104.07], ['重庆', 106.55], ['西安', 108.94],
    ['武汉', 114.30], ['长沙', 112.94], ['郑州', 113.63], ['天津', 117.20],
    ['沈阳', 123.43], ['哈尔滨', 126.53], ['昆明', 102.83], ['乌鲁木齐', 87.62],
    ['拉萨', 91.11], ['台北', 121.56], ['香港', 114.17], ['澳门', 113.55],
    ['东京', 139.69], ['纽约', -74.01], ['东经120°(标准时)', 120]
  ];

  /* 中国大陆夏令时区间（1986-1991），起止当日 02:00 */
  var DST_RANGE = [
    [1986, 5, 4, 1986, 9, 14], [1987, 4, 12, 1987, 9, 13],
    [1988, 4, 10, 1988, 9, 4], [1989, 4, 16, 1989, 9, 17],
    [1990, 4, 15, 1990, 9, 16], [1991, 4, 14, 1991, 9, 15]
  ];

  var SS_CLS = { zy: 'yin', py: 'yin', zg: 'guan', qs: 'guan', zc: 'cai', pc: 'cai', ss: 'shi', sg: 'shi', bs: 'bi', jc: 'bi' };
  var WXLIST = ['木', '火', '土', '金', '水'];

  var state = { chart: null, A: null, curPillar: 'day', lnYear: new Date().getFullYear() };

  /* ---------------- 小工具 ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fill(sel, from, to, def, fmt) {
    var s = $(sel); s.innerHTML = '';
    for (var i = from; i <= to; i++) {
      var o = document.createElement('option');
      o.value = i; o.textContent = fmt ? fmt(i) : i;
      s.appendChild(o);
    }
    if (def !== undefined) s.value = def;
  }
  function daysInMonth(y, m) {
    if (m === 2) return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : 28;
    return [4, 6, 9, 11].indexOf(m) >= 0 ? 30 : 31;
  }
  function isDST(y, m, d, h) {
    for (var i = 0; i < DST_RANGE.length; i++) {
      var r = DST_RANGE[i];
      if (y !== r[0]) continue;
      var cur = m * 100 + d;
      if (cur > r[1] * 100 + r[2] && cur < r[4] * 100 + r[5]) return true;
      if (cur === r[1] * 100 + r[2] && h >= 2) return true;
      if (cur === r[4] * 100 + r[5] && h < 2) return true;
    }
    return false;
  }
  function ssCls(k) { return SS_CLS[k] || ''; }

  /* ---------------- 初始化 ---------------- */
  function init() {
    var sel = $('city');
    CITIES.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c[1]; o.textContent = c[0]; sel.appendChild(o);
    });
    sel.value = '118.28';
    sel.addEventListener('change', function () { $('lng').value = sel.value; });

    fill('y', 1900, 2100, 1990);
    fill('mo', 1, 12, 5, function (i) { return i + '月'; });
    fill('d', 1, 31, 20, function (i) { return i + '日'; });
    fill('h', 0, 23, 12, function (i) { return pad(i) + '时'; });
    fill('mi', 0, 59, 0, function (i) { return pad(i) + '分'; });
    fill('lh', 0, 23, 12, function (i) { return pad(i) + '时'; });
    fill('lmi', 0, 59, 0, function (i) { return pad(i) + '分'; });
    fill('ly', 1900, 2100, 1990);
    fill('lmo', 1, 12, 4, function (i) { return i + '月'; });
    fill('ld', 1, 30, 26, function (i) { return i + '日'; });

    $('mo').addEventListener('change', syncSolarDays);
    $('y').addEventListener('change', function () { syncSolarDays(); syncLeap(); });
    $('lmo').addEventListener('change', syncLunarDays);
    $('ly').addEventListener('change', function () { syncLunarDays(); syncLeap(); });
    $('lLeap').addEventListener('change', syncLunarDays);

    document.querySelectorAll('input[name=cal]').forEach(function (r) {
      r.addEventListener('change', function () {
        var isS = $('calS').checked;
        $('solarBox').style.display = isS ? '' : 'none';
        $('lunarBox').style.display = isS ? 'none' : '';
        isS ? syncSolarEcho() : syncLunarEcho();
      });
    });

    $('btnCalc').addEventListener('click', calc);
    $('btnDemo').addEventListener('click', loadDemo);
    $('btnNow').addEventListener('click', loadNow);
    $('btnLn').addEventListener('click', function () {
      state.lnYear = parseInt($('lny').value, 10);
      renderLiunian();
    });
    $('lny').addEventListener('change', function () {
      state.lnYear = parseInt($('lny').value, 10); $('lnyInput').value = state.lnYear; renderLiunian();
    });
    $('btnLnPrev').addEventListener('click', function () { state.lnYear--; syncLnYear(); renderLiunian(); });
    $('btnLnNext').addEventListener('click', function () { state.lnYear++; syncLnYear(); renderLiunian(); });

    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); });
        document.querySelectorAll('.tabpane').forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        $('pane-' + t.getAttribute('data-tab')).classList.add('on');
      });
    });

    syncLeap();
    renderTheory();
  }

  function syncSolarDays() {
    var y = +$('y').value, m = +$('mo').value, keep = +$('d').value;
    var n = daysInMonth(y, m);
    fill('d', 1, n, Math.min(keep, n), function (i) { return i + '日'; });
    syncSolarEcho();
  }
  function syncSolarEcho() {
    var y = +$('y').value, m = +$('mo').value, d = +$('d').value;
    var lu = LK.solarToLunar(y, m, d);
    $('lunarEcho').textContent = lu ? ('农历 ' + lu.monthCN + lu.dayCN) : '';
  }
  function syncLunarDays() {
    var ly = +$('ly').value, lm = +$('lmo').value, keep = +$('ld').value;
    var leap = $('lLeap').checked;
    var n = LK.lunarMonthDays(ly, lm, leap) || 30;
    fill('ld', 1, n, Math.min(keep, n), function (i) { return i + '日'; });
    syncLunarEcho();
  }
  function syncLunarEcho() {
    var ly = +$('ly').value, lm = +$('lmo').value, ld = +$('ld').value;
    var s = LK.lunarToSolar(ly, lm, ld, $('lLeap').checked);
    $('lunarEcho').textContent = s ? ('公历 ' + s[0] + '-' + pad(s[1]) + '-' + pad(s[2])) : '该年无此闰月';
  }
  function syncLeap() {
    var ly = +$('ly').value, lm = LK.lunarLeapMonth(ly);
    $('lLeap').disabled = !lm;
    if (!lm) $('lLeap').checked = false;
  }
  function syncLnYear() {
    $('lny').value = state.lnYear; $('lnyInput').value = state.lnYear;
  }

  function loadDemo() {
    $('calS').checked = true;
    $('solarBox').style.display = ''; $('lunarBox').style.display = 'none';
    $('sexM').checked = true;
    $('city').value = '118.28'; $('lng').value = '118.28';
    $('y').value = 1990; $('mo').value = 5;
    syncSolarDays();
    $('d').value = 20; $('h').value = 12; $('mi').value = 0;
    $('useTST').checked = true; $('useDST').checked = true;
    $('ziSwap').value = '0'; $('qiyunMode').value = 'linear';
    syncSolarEcho();
    calc();
  }
  function loadNow() {
    var n = new Date();
    $('calS').checked = true;
    $('solarBox').style.display = ''; $('lunarBox').style.display = 'none';
    $('y').value = n.getFullYear(); $('mo').value = n.getMonth() + 1;
    syncSolarDays();
    $('d').value = n.getDate(); $('h').value = n.getHours(); $('mi').value = n.getMinutes();
    syncSolarEcho();
    calc();
  }

  /* ---------------- 取输入 ---------------- */
  function readInput() {
    var y, m, d, h, mi;
    if ($('calS').checked) {
      y = +$('y').value; m = +$('mo').value; d = +$('d').value;
      h = +$('h').value; mi = +$('mi').value;
    } else {
      var s = LK.lunarToSolar(+$('ly').value, +$('lmo').value, +$('ld').value, $('lLeap').checked);
      if (!s) { alert('日期超出支持范围'); return null; }
      y = s[0]; m = s[1]; d = s[2];
      h = +$('lh').value; mi = +$('lmi').value;
    }
    var dst = $('useDST').checked && isDST(y, m, d, h);
    return {
      year: y, month: m, day: d, hour: h, minute: mi,
      sex: $('sexM').checked ? 'M' : 'F',
      lng: parseFloat($('lng').value) || 120,
      useTST: $('useTST').checked,
      dst: dst,
      ziSwap: $('ziSwap').value === '1',
      qiyunMode: $('qiyunMode').value
    };
  }

  /* ---------------- 主流程 ---------------- */
  function calc() {
    var inp = readInput();
    if (!inp) return;
    var chart, A;
    try {
      chart = B.paipan(inp);
      A = I.analyzeAll(chart);
    } catch (e) {
      alert('排盘失败：' + e.message); return;
    }
    state.chart = chart; state.A = A;
    $('result').style.display = '';
    renderGrid(chart);
    renderInfo(chart);
    renderZong(chart, A);
    renderSizhu(chart, A);
    renderQiangruo(chart, A);
    renderGeju(chart, A);
    renderYongshen(chart, A);
    renderDayun(chart, A);
    fill('lny', inp.year + 1, inp.year + 100, Math.max(new Date().getFullYear(), inp.year + 1));
    state.lnYear = +$('lny').value; $('lnyInput').value = state.lnYear;
    renderLiunian();
    renderShensha(chart, A);
  }

  /* ---------------- 四柱盘 ---------------- */
  function renderGrid(chart) {
    var html = chart.pillars.map(function (p) {
      var isDay = p.key === 'day';
      var ssTop = isDay ? '日主' : p.ss.name;
      var clsTop = isDay ? 'hl' : ssCls(p.ss.key);
      var ben = p.canggan[0];
      var cg = p.canggan.map(function (c) {
        return '<b>' + B.GAN[c.gan] + '</b>' + '<span class="' + ssCls(c.ss.key) + '" style="color:inherit;opacity:.75">' + c.ss.name + '</span>';
      }).join(' · ');
      var atSSH = chart.shensha.filter(function (s) { return s.at.indexOf(p.title) >= 0; });
      var chips = atSSH.map(function (s) {
        var c = /贵|文昌|禄神|将星|天德|月德/.test(s.name) ? 'hl' : (/刃|劫|亡|空|破/.test(s.name) ? 'bad' : '');
        return '<span class="chip ' + c + '">' + esc(s.name) + '</span>';
      }).join('');
      return '<div class="bz-col' + (isDay ? ' is-day' : '') + '" data-key="' + p.key + '" style="cursor:pointer">'
        + '<div class="bz-col-head">' + esc(p.title) + '<div class="bz-col-tag">' + esc(p.tag) + '</div></div>'
        + '<div class="bz-gan">' + B.GAN[p.gan] + '</div>'
        + '<div class="bz-ss ' + clsTop + '">' + ssTop + '</div>'
        + '<div class="bz-zhi">' + B.ZHI[p.zhi] + '</div>'
        + '<div class="bz-ss ' + ssCls(ben.ss.key) + '">' + (isDay && ben.ss.key === 'bs' ? '通根' : ben.ss.name) + '</div>'
        + '<div class="bz-cang">藏干 ' + cg + '</div>'
        + '<div class="bz-meta">' + esc(p.nayin) + '<br>天干' + B.WX[p.gan] + ' · 地支' + p.zhiWx + '</div>'
        + (chips ? '<div class="bz-chips">' + chips + '</div>' : '')
        + '</div>';
    }).join('');
    var g = $('bzGrid');
    g.innerHTML = html;
    g.querySelectorAll('.bz-col').forEach(function (c) {
      c.addEventListener('click', function () {
        state.curPillar = c.getAttribute('data-key');
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); });
        document.querySelectorAll('.tabpane').forEach(function (x) { x.classList.remove('on'); });
        document.querySelector('.tab[data-tab=sizhu]').classList.add('on');
        $('pane-sizhu').classList.add('on');
        renderSizhu(state.chart, state.A);
        $('pane-sizhu').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    $('bzTitle').textContent = chart.pillars.map(function (p) { return p.ganzhi; }).join(' ');
  }

  function renderInfo(chart) {
    var s = chart.solar, t = chart.trueSolar;
    var lu = LK.solarToLunar(s.y, s.m, s.d);
    var rows = [
      ['四柱', chart.pillars.map(function (p) { return p.ganzhi; }).join(' ')],
      ['日主', B.GAN[chart.dayMaster.gan] + '（' + B.WX[chart.dayMaster.gan] + '）'],
      ['月令', chart.monthOrder],
      ['生肖', chart.zodiac + '（年支' + B.ZHI[chart.pillars[0].zhi] + '）'],
      ['公历', s.y + '-' + pad(s.m) + '-' + pad(s.d) + ' ' + pad(s.h) + ':' + pad(s.mi)],
      ['真太阳时', t.year + '-' + pad(t.month) + '-' + pad(t.day) + ' ' + pad(t.hour) + ':' + pad(t.minute)
        + '（Δ ' + (t.totalDelta >= 0 ? '+' : '') + t.totalDelta + ' 分）'],
      ['时辰', chart.shichen.label + (chart.isLateZi ? '（晚子时）' : '')],
      ['农历', lu ? (lu.monthCN + lu.dayCN) : '—'],
      ['起运', chart.dayun.years + ' 岁 ' + chart.dayun.months + ' 个月'
        + (chart.dayun.days ? ' 零 ' + chart.dayun.days + ' 天' : '') + '（' + (chart.dayun.forward ? '顺' : '逆') + '行）']
    ];
    if (chart.input.dst) rows.splice(6, 0, ['夏令时', '已回拨 1 小时（1986–1991）']);
    rows.push(['21:00 后的口径', chart.input.ziSwap ? '晚子时换日' : '晚子时不换日']);
    rows.push(['起运口径', chart.dayun.mode === 'shichen' ? '古法·一时辰折十日' : '三日折一岁']);
    $('infoList').innerHTML = rows.map(function (r) {
      return '<div><b>' + esc(r[0]) + '：</b>' + esc(r[1]) + '</div>';
    }).join('');
  }

  /* ---------------- 一、命局总论 ---------------- */
  function renderZong(chart, A) {
    var html = '';
    html += '<div class="sec"><h3>一句话看这个盘</h3>'
      + '<div class="ni"><b>' + esc(GANWANG(chart, A)) + '</b></div></div>';
    html += '<div class="sec"><h3>逐层批语</h3>';
    A.reading.forEach(function (l) {
      html += '<div class="card"><div class="card-title">' + esc(l.t) + '</div>'
        + '<div class="card-text">' + esc(l.c) + '</div></div>';
    });
    html += '</div>';
    html += '<div class="sec"><h3>当前所处大运</h3><div id="zongYun"></div></div>';
    $('pane-zong').innerHTML = html;
    renderCurYun(chart, A, 'zongYun');
  }

  function GANWANG(chart, A) {
    var dm = chart.dayMaster;
    return B.GAN[dm.gan] + B.ZHI[dm.zhi] + '日主，' + B.WX[dm.gan] + '命，生于' + chart.monthOrder.replace('（', '（') + '，'
      + A.strength.level + '，入' + A.geju.name + '；用神取' + (A.yongshen.primary.element || '（顺五行流通）') + '。';
  }

  function renderCurYun(chart, A, targetId) {
    var now = new Date();
    var y = I.analyzeYun(chart, now.getFullYear());
    var box = $(targetId);
    if (!box) return;
    if (y.beforeQiYun) {
      box.innerHTML = '<div class="card"><div class="card-text">' + esc(y.text) + '</div></div>';
      return;
    }
    var d = y.dayun;
    box.innerHTML = '<div class="card"><div class="card-title">' + esc(d.ganzhi) + '大运'
      + '<span class="tag main">' + d.startAge + '–' + (d.startAge + 9) + ' 岁</span>'
      + '<span class="tag">' + d.startYear + '–' + d.endYear + ' 年</span></div>'
      + '<div class="card-text">' + esc(y.text) + '</div></div>';
  }

  /* ---------------- 二、四柱详解 ---------------- */
  function renderSizhu(chart, A) {
    var pick = '<div class="palace-pick">' + chart.pillars.map(function (p) {
      return '<span data-key="' + p.key + '" class="' + (p.key === state.curPillar ? 'on' : '') + '">'
        + esc(p.title) + ' ' + p.ganzhi + '</span>';
    }).join('') + '</div>';
    $('pane-sizhu').innerHTML = pick + '<div id="sizhuBody"></div>';
    $('pane-sizhu').querySelectorAll('.palace-pick span').forEach(function (s) {
      s.addEventListener('click', function () {
        state.curPillar = s.getAttribute('data-key');
        renderSizhu(chart, A);
      });
    });
    renderSizhuBody(chart, A);
  }

  function renderSizhuBody(chart, A) {
    var p = null;
    chart.pillars.forEach(function (x) { if (x.key === state.curPillar) p = x; });
    if (!p) p = chart.pillars[2];
    var isDay = p.key === 'day';
    var mean = I.SS_MEAN[p.ss.key];
    var gw = I.GONGWEI[p.key];
    var sex = chart.input.sex;
    var lq = I.liuqinOf(p.ss.key, sex);
    var html = '';

    html += '<div class="sec"><h3>' + esc(p.title) + ' · ' + p.ganzhi + '（' + esc(p.tag) + '）</h3>';

    /* 宫位：这一柱管什么 */
    html += '<div class="card"><div class="card-title">' + esc(gw.name)
      + '<span class="tag main">' + esc(gw.age) + '</span></div>'
      + '<div class="card-text">' + esc(gw.scope) + '。</div></div>';

    /* 天干 */
    html += '<div class="card"><div class="card-title">天干 ' + B.GAN[p.gan]
      + '<span class="tag ' + (isDay ? 'main' : '') + '">' + (isDay ? '日主·我' : p.ss.name) + '</span>'
      + '<span class="tag">' + B.WX[p.gan] + '行</span></div>'
      + '<div class="card-text">'
      + (isDay
        ? '这是「我」本人。日干代表命主自己，全局十神关系都以它为中心展开；日支是配偶的位置。'
        : ('此干对日主（' + B.GAN[chart.dayMaster.gan] + '）而言是' + esc(mean.title) + '。'
          + esc(mean.mean) + '。心性上：' + esc(mean.traits) + '。'))
      + (isDay ? '' : '<div style="margin-top:8px"><b>六亲：</b>' + esc(lq.kin)
        + (lq.note ? '<span style="color:var(--ink3);font-size:12.5px">（' + esc(lq.note) + '）</span>' : '') + '</div>')
      + '</div></div>';

    /* 地支 */
    html += '<div class="card"><div class="card-title">地支 ' + B.ZHI[p.zhi]
      + '<span class="tag">' + p.zhiWx + '行</span><span class="tag">' + esc(p.nayin) + '</span>'
      + (isDay ? '<span class="tag main">夫妻宫</span>' : '') + '</div>'
      + '<div class="card-text">六十甲子纳音 ' + esc(p.nayin) + '。地支是天干的根，'
      + '藏干才是这一柱真正的力量来源'
      + (isDay ? '；<b>日支是配偶宫</b>，看婚姻主要看这里。' : '。') + '</div></div>';

    /* 藏干表（含六亲） */
    html += '<table class="grid"><thead><tr><th style="width:60px">藏干</th><th style="width:78px">力量</th>'
      + '<th style="width:48px">五行</th><th style="width:78px">十神</th><th style="width:150px">六亲</th>'
      + '<th>说明</th></tr></thead><tbody>';
    p.canggan.forEach(function (c) {
      var deg = c.degree === '本' ? '本气（主）' : (c.degree === '中' ? '中气（次）' : '余气（弱）');
      var lq2 = I.liuqinOf(c.ss.key, sex);
      html += '<tr><td><b>' + B.GAN[c.gan] + '</b></td><td>' + deg + '</td><td>' + B.WX[c.gan] + '</td>'
        + '<td class="' + ssCls(c.ss.key) + '">' + c.ss.name + '</td>'
        + '<td>' + esc(lq2.kin) + '</td>'
        + '<td>' + esc(I.SS_MEAN[c.ss.key].mean) + '</td></tr>';
    });
    html += '</tbody></table>';

    var atSSH = chart.shensha.filter(function (s) { return s.at.indexOf(p.title) >= 0; });
    if (atSSH.length) {
      html += '</div><div class="sec"><h3>落在这一柱的神煞</h3>';
      atSSH.forEach(function (s) {
        html += '<div class="card"><div class="card-title">' + esc(s.name)
          + '<span class="tag">' + esc(s.zhi) + '</span></div>'
          + '<div class="card-text">' + esc(s.desc) + '</div></div>';
      });
    } else {
      html += '</div><div class="sec"><h3>落在这一柱的神煞</h3><div class="empty">此柱无主要神煞</div>';
    }
    $('sizhuBody').innerHTML = html;
  }

  /* ---------------- 三、日主强弱 ---------------- */
  function renderQiangruo(chart, A) {
    var st = A.strength;
    var lvlCls = (st.level === '身强' || st.level === '偏强') ? 'qiang' : ((st.level === '中和') ? 'zhong' : 'ruo');
    var maxAbs = 10;
    st.items.forEach(function (it) { if (Math.abs(it.score) > maxAbs) maxAbs = Math.abs(it.score); });

    var html = '';
    html += '<div class="sec"><h3>综合判定</h3>'
      + '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">'
      + '<span class="lvl-badge ' + lvlCls + '">' + esc(st.level) + '</span>'
      + '<span style="color:var(--ink2)">量化得分 <b style="font-size:18px;color:var(--ink)">' + st.score + '</b> 分'
      + '（参考区间：≥30 身强 · 10~30 偏强 · −10~10 中和 · −30~−10 偏弱 · ≤−30 身弱）</span></div>'
      + '<div class="ni">' + esc(st.comment) + '</div></div>';

    html += '<div class="sec"><h3>四看明细（量化过程）</h3>';
    st.items.forEach(function (it) {
      var w = Math.min(50, Math.abs(it.score) / maxAbs * 50);
      html += '<div class="score-row">'
        + '<div class="score-name">' + esc(it.name) + '</div>'
        + '<div class="score-bar-wrap"><div class="score-bar ' + (it.score >= 0 ? 'pos' : 'neg') + '" style="width:' + w + '%"></div></div>'
        + '<div class="score-val">' + (it.score > 0 ? '+' : '') + it.score + '</div></div>'
        + '<div style="font-size:12.5px;color:var(--ink3);margin:0 0 10px 68px">' + esc(it.desc)
        + ' <span style="opacity:.7">· ' + esc(it.detail) + '</span></div>';
    });
    html += '</div>';

    html += '<div class="sec"><h3>通根明细</h3>';
    if (st.roots.length) {
      html += '<table class="grid"><thead><tr><th>位置</th><th>地支</th><th>藏干</th><th>气</th><th>计分</th></tr></thead><tbody>';
      st.roots.forEach(function (r) {
        html += '<tr><td>' + esc(r.year) + '</td><td>' + r.zhi + '</td><td>' + B.GAN[r.gan] + '</td>'
          + '<td>' + r.degree + '气</td><td>' + r.score + '</td></tr>';
      });
      html += '</tbody></table>';
      html += '<div class="ni">月支、日支的根计 1.5 倍权重——离日主越近，根越有力。</div>';
    } else {
      html += '<div class="empty">全局无本气根，日主虚浮。若再无印生扶，须考虑是否入从格（另论）。</div>';
    }
    html += '</div>';

    html += '<div class="sec"><h3>这套分数怎么来的（口径说明）</h3>'
      + '<div class="card"><div class="card-text">'
      + '强弱没有标准答案，各家权重不同。本系统的口径：<br>'
      + '· <b>得令</b> 30/15/−5/−18/−28（当令/相/休/囚/死），月令最重；<br>'
      + '· <b>得地</b> 本气根 12 分、中气 6 分、余气 3 分，月支日支再乘 1.5；<br>'
      + '· <b>得生</b> 印星透干 8 分、藏干 3 分；<b>得势</b> 比劫同理；<br>'
      + '· <b>克泄耗</b> 反向扣分：七杀 −9、正官/伤官 −7、食神/偏财 −6、正财 −5。<br>'
      + '这套权重只能给出相对位置，不能替代通盘权衡。把它当作「定位工具」，不当作「判决」。'
      + '</div></div></div>';

    $('pane-qiangruo').innerHTML = html;
  }

  /* ---------------- 四、格局 ---------------- */
  function renderGeju(chart, A) {
    var g = A.geju;
    var isBroke = g.broke.length > 0;
    var html = '';
    html += '<div class="sec"><h3>格局判定</h3>'
      + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">'
      + '<span class="lvl-badge ' + (g.isStandard ? 'zhong' : 'ruo') + '">' + esc(g.name) + '</span>'
      + '<span class="tag ' + (g.type === '顺用' ? 'good' : 'bad') + '">' + esc(g.type) + '</span>'
      + '<span class="tag">' + esc(g.ss.name) + '</span></div>'
      + '<div class="card"><div class="card-text">' + esc(g.reason) + (g.note ? ' ' + esc(g.note) : '') + '</div></div></div>';

    html += '<div class="sec"><h3>顺用还是逆用</h3>'
      + '<div class="card"><div class="card-title">' + esc(g.type)
      + '<span class="tag ' + (g.type === '顺用' ? 'good' : 'bad') + '">' + esc(g.ss.name) + '</span></div>'
      + '<div class="card-text"><b style="color:var(--jade)">宜：</b>' + esc(g.like) + '<br>'
      + '<b style="color:var(--cinnabar)">忌：</b>' + esc(g.hate) + '</div></div>'
      + '<div class="ni">《子平真诠》的规矩：<b>财官印食四吉神宜顺用</b>（要生要护），'
      + '<b>杀伤枭刃四凶神宜逆用</b>（要制要化）。顺逆一乱，格局就废了一半。</div></div>';

    if (isBroke) {
      html += '<div class="sec"><h3>格局警报（破格线索）</h3>';
      g.broke.forEach(function (b) {
        html += '<div class="card" style="border-color:#F0D5D0;background:#FDF7F5">'
          + '<div class="card-text" style="color:#8A3B30">' + esc(b) + '</div></div>';
      });
      html += '</div>';
    }

    html += '<div class="sec"><h3>八格对照（顺用 / 逆用一览）</h3>'
      + '<table class="grid"><thead><tr><th style="width:90px">格局</th><th style="width:60px">用法</th>'
      + '<th>宜</th><th>忌</th></tr></thead><tbody>' + GE_TABLE() + '</tbody></table></div>';

    html += '<div class="sec"><h3>取格的优先级</h3><div class="card"><div class="card-text">'
      + '1. 月令<b>本气</b>为八格之神 → 取本气定格<br>'
      + '2. 本气为<b>比劫</b> → 入建禄 / 月刃，<b>不入八格</b>，须另寻财官食伤为用<br>'
      + '3. 本气不成格 → 看中气、余气<b>透干</b>且成格者<br>'
      + '4. 月令所藏全不成格 → 从四柱天干另寻八格之神<br>'
      + '5. 皆无 → 「无明显正格」，改以扶抑、调候、刑冲合会综合论断'
      + '</div></div></div>';

    $('pane-geju').innerHTML = html;
  }

  function GE_TABLE() {
    var rows = [
      ['正官格', '顺用', '喜财生官、印护官', '忌伤官克官、忌七杀混官'],
      ['七杀格', '逆用', '喜食伤制杀、印星化杀、合杀', '忌财生杀而无制（杀重身轻）'],
      ['正财格', '顺用', '喜食伤生财、官星护财', '忌比劫夺财'],
      ['偏财格', '顺用', '喜食伤生财、官星护财', '忌比劫夺财、忌印星倒食'],
      ['正印格', '顺用', '喜官杀生印、比劫护印', '忌财星破印'],
      ['偏印格', '逆用', '喜财星制枭、比劫泄枭', '忌食神被夺（枭神夺食）'],
      ['食神格', '顺用', '喜比劫生食、财星泄秀', '忌偏印夺食'],
      ['伤官格', '逆用', '喜印制伤（伤官配印）、财星泄伤（伤官生财）', '忌见正官（伤官见官）']
    ];
    return rows.map(function (r) {
      return '<tr><td><b>' + r[0] + '</b></td>'
        + '<td><span class="tag ' + (r[1] === '顺用' ? 'good' : 'bad') + '">' + r[1] + '</span></td>'
        + '<td>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
    }).join('');
  }

  /* 某日主的十二月调候速查表（高亮本命月令） */
  function tiaohouTable(dmGanIdx, curZhi) {
    var T = window.Tiaohou;
    if (!T) return '';
    var order = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];   // 寅→丑 自然年序
    var html = '<table class="grid"><thead><tr><th style="width:78px">月令</th>'
      + '<th style="width:88px">气候</th><th style="width:80px">调候用神</th><th>要旨</th></tr></thead><tbody>';
    order.forEach(function (z) {
      var r = T.look(dmGanIdx, z);
      if (!r) return;
      var isCur = (z === curZhi);
      html += '<tr' + (isCur ? ' style="background:#FDF6E8"' : '') + '>'
        + '<td><b>' + T.ZHI[z] + '月</b>' + (isCur ? ' <span class="tag main">本命</span>' : '') + '</td>'
        + '<td>' + esc(T.CLIMATE[z]) + '</td>'
        + '<td><b style="font-size:15px">' + r.main + '</b></td>'
        + '<td>' + esc(r.text) + '</td></tr>';
    });
    return html + '</tbody></table>';
  }

  /* ---------------- 五、调候 · 用神 ---------------- */
  function renderYongshen(chart, A) {
    var th = A.tiaohou, ys = A.yongshen;
    var html = '';

    var thCard;
    if (th.needed) {
      thCard = '<div class="card" style="border-color:var(--gold);background:#FDF8EC">'
        + '<div class="card-title">调候用神：<b style="font-size:17px">' + esc(th.main) + '</b>'
        + '<span class="tag ' + (th.has ? 'good' : 'bad') + '">' + (th.has ? '局中已有·到位' : '局中未见·不足') + '</span>'
        + '<span class="tag">' + esc(th.month) + '·' + esc(th.climate) + '</span>'
        + (th.urgent
          ? '<span class="tag main">寒暖极端·调候为急</span>'
          : '<span class="tag">非极端月·次于扶抑</span>')
        + '</div>'
        + '<div class="card-text">' + esc(th.text) + '</div>'
        + '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line2);font-size:12.5px;color:var(--ink3)">'
        + '<b>《穷通宝鉴》原文要旨：</b>' + esc(th.detail) + '</div></div>';
    } else {
      thCard = '<div class="card"><div class="card-text">' + esc(th.text) + '</div></div>';
    }

    html += '<div class="sec"><h3>调候（《穷通宝鉴》十干逐月）</h3>' + thCard
      + '<div class="ni">《滴天髓》「天道有寒暖，地道有燥湿」。<b>调候的优先级常高于扶抑</b>——'
      + '冬月无火、夏月无水，格局再好也多身心煎熬。先看寒暖，再论生克。<br>'
      + '<b>注意：调候不是简单的「冬火夏水」——「冬天生人一律补火」是外行话。</b>'
      + '《穷通宝鉴》的规则是<b>十天干 × 十二月令</b>共 120 条：同样是子月出生，'
      + '甲木要丁、丙火要壬、癸水要庚、辛金要丙，四个完全不同的答案。</div></div>';

    html += '<div class="sec"><h3>' + B.GAN[chart.dayMaster.gan] + '日主 · 十二个月调候速查</h3>'
      + tiaohouTable(chart.dayMaster.gan, chart.pillars[1].zhi) + '</div>';

    html += '<div class="sec"><h3>用神五路</h3>';
    ys.ways.forEach(function (w, i) {
      var main = i === 0;
      html += '<div class="card"' + (main ? ' style="border-color:var(--gold);background:#FDF8EC"' : '') + '>'
        + '<div class="card-title">' + esc(w.way)
        + (w.element ? '<span class="tag main">' + w.element + '</span>' : '')
        + (main ? '<span class="tag good">首选</span>' : '<span class="tag">参考</span>') + '</div>'
        + '<div class="card-text">' + esc(w.text) + '</div>';
      if (w.optionGroups) {
        html += '<div class="bz-chips" style="justify-content:flex-start;margin-top:8px">'
          + w.optionGroups.map(function (o) {
            return '<span class="chip' + (w.element === o.w ? ' hl' : '') + '">' + o.gs + ' → ' + o.w + '</span>';
          }).join('') + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="sec"><h3>五行分布与喜忌</h3>';
    if (ys.elems.length) {
      html += '<table class="grid"><thead><tr><th>五行</th><th>权重计数</th><th>占比条</th></tr></thead><tbody>';
      var mx = ys.elems[0].n || 1;
      ys.elems.forEach(function (e) {
        html += '<tr><td><b>' + e.w + '</b></td><td>' + e.n.toFixed(1) + '</td>'
          + '<td><div style="height:12px;background:#F1EDE3;border-radius:3px;position:relative">'
          + '<div style="position:absolute;left:0;top:0;bottom:0;width:' + (e.n / mx * 100).toFixed(0) + '%;background:var(--gold);border-radius:3px;opacity:.7"></div></div></td></tr>';
      });
      html += '</tbody></table>';
    }
    var chip = function (arr, cls) {
      return arr.map(function (w) { return '<span class="chip ' + cls + '">' + w + '</span>'; }).join('');
    };
    html += '<div class="card" style="margin-top:12px"><div class="card-title">喜用</div>'
      + '<div class="bz-chips" style="justify-content:flex-start">'
      + (ys.xi.length ? chip(ys.xi, 'hl') : '<span class="chip">中和之局，顺流通</span>') + '</div>'
      + '<div class="card-title" style="margin-top:10px">忌神</div>'
      + '<div class="bz-chips" style="justify-content:flex-start">'
      + (ys.ji.length ? chip(ys.ji, 'bad') : '<span class="chip">—</span>') + '</div>'
      + '<div class="card-text" style="margin-top:8px;font-size:12.5px;color:var(--ink3)">'
      + '推算规则：用神所在五行为喜，<b>生</b>用神者为次喜；<b>泄、克</b>用神者为忌。</div></div>';
    html += '</div>';

    html += '<div class="warn" style="margin-top:16px">' + esc(ys.caveat) + '</div>';
    $('pane-yongshen').innerHTML = html;
  }

  /* ---------------- 六、大运 ---------------- */
  function renderDayun(chart, A) {
    var dy = chart.dayun;
    var nowY = new Date().getFullYear();
    var html = '';

    html += '<div class="sec"><h3>排运规则</h3>'
      + '<div class="card"><div class="card-text">'
      + '年干<b>阳</b>（甲丙戊庚壬）：<b>男顺女逆</b>；年干<b>阴</b>（乙丁己辛癸）：<b>男逆女顺</b>。<br>'
      + '本命：' + B.GAN[chart.pillars[0].gan] + '年属' + (dy.yang ? '阳' : '阴')
      + '，' + (chart.input.sex === 'M' ? '男' : '女') + '命 → <b>' + (dy.forward ? '顺行' : '逆行') + '</b>。<br>'
      + '起运：出生时刻距' + (dy.forward ? '下一个「节」' : '上一个「节」') + '（' + esc(dy.jieqi.name) + '）'
      + esc(dy.jieqi.month + '月' + dy.jieqi.day + '日 ' + pad(dy.jieqi.hour) + ':' + pad(dy.jieqi.minute) + '）')
      + '相差 <b>' + Math.floor(dy.deltaMin / 1440) + ' 天 ' + Math.floor((dy.deltaMin % 1440) / 60) + ' 小时</b>，'
      + '按「' + (dy.mode === 'shichen' ? '一时辰折十日' : '三日折一岁') + '」折算得 '
      + '<b>' + dy.years + ' 岁 ' + dy.months + ' 个月' + (dy.days ? ' 零 ' + dy.days + ' 天' : '') + '</b>起运。</div></div></div>';

    html += '<div class="sec"><h3>大运排布（每运十年）</h3><div class="dy-wrap">';
    dy.list.forEach(function (d) {
      var tag1 = d.startYear, curAge = nowY - chart.solar.y;
      var isCur = curAge >= d.startAge && curAge < d.startAge + 10;
      html += '<div class="dy-item' + (isCur ? ' cur' : '') + '">'
        + '<div class="dy-gz">' + d.ganzhi + '</div>'
        + '<div class="dy-age">' + d.startAge + ' 岁起</div>'
        + '<div class="dy-ny">' + tag1 + '–' + d.endYear + '</div></div>';
    });
    html += '</div></div>';

    html += '<div class="sec"><h3>逐运干支与十神</h3>'
      + '<table class="grid"><thead><tr><th style="width:44px">序</th><th style="width:70px">大运</th>'
      + '<th style="width:60px">纳音</th><th style="width:80px">运干十神</th><th style="width:80px">运支</th>'
      + '<th style="width:80px">起运岁</th><th>年份</th></tr></thead><tbody>';
    dy.list.forEach(function (d) {
      var ssg = B.shishen(chart.dayMaster.gan, d.gan);
      var cg = B.CANGGAN[d.zhi];
      html += '<tr><td>' + d.order + '</td><td><b>' + d.ganzhi + '</b></td><td>' + esc(d.nayin) + '</td>'
        + '<td class="' + ssCls(ssg.key) + '">' + ssg.name + '</td>'
        + '<td>' + B.ZHI[d.zhi] + '（' + cg.map(function (c) { return B.GAN[c.g]; }).join('') + '）</td>'
        + '<td>' + d.startAge + '</td><td>' + d.startYear + '–' + d.endYear + '</td></tr>';
    });
    html += '</tbody></table>'
      + '<div class="ni">读运口诀：<b>运干管前五年、运支管后五年</b>（一说干支各五年参看）。'
      + '运支刑冲命中某一柱，那一步就容易出事；运干透出的十神，决定这十年的主旋律。</div></div>';

    $('pane-dayun').innerHTML = html;
  }

  /* ---------------- 七、流年 ---------------- */
  function renderLiunian() {
    var chart = state.chart, A = state.A;
    if (!chart) return;
    var y = I.analyzeYun(chart, state.lnYear);
    var ln = y.liunian;
    var html = '';
    html += '<div class="sec"><h3>' + state.lnYear + ' 年（' + ln.ganzhi + '）</h3>'
      + '<div class="card"><div class="card-title">' + esc(ln.ganzhi)
      + '<span class="tag main">' + esc(ln.ss.name) + '</span>'
      + '<span class="tag">立春 ' + esc(ln.lichun) + '</span></div>'
      + '<div class="card-text">' + esc(y.text) + '</div></div>'
      + '<div class="ni">注意：<b>流年也以立春为界</b>。' + state.lnYear
      + ' 年立春之前的日子，在命理上仍属上一年。</div></div>';

    var mean = I.SS_MEAN[ln.ss.key];
    html += '<div class="sec"><h3>流年天干十神含义</h3><div class="card">'
      + '<div class="card-title">' + esc(mean.title) + '<span class="tag">' + esc(ln.ss.cat) + '</span></div>'
      + '<div class="card-text">' + esc(mean.mean) + '。心性上：' + esc(mean.traits) + '。<br>'
      + '<span style="color:var(--ink3);font-size:12.5px">这一年外部给你的主要刺激类型，就是这一个' + esc(mean.title) + '。</span></div></div></div>';

    /* 流年地支与命局的作用 */
    var hits = [];
    chart.pillars.forEach(function (p) {
      var pair = [p.zhi, ln.zhi], key = pair.slice().sort(function (a, b) { return a - b; }).join(',');
      var m = {};
      [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]].forEach(function (t) { m[t.join(',')] = '六冲'; });
      [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]].forEach(function (t) { m[t.join(',')] = '六合'; });
      [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]].forEach(function (t) { m[t.join(',')] = '六害'; });
      if (m[key]) hits.push({ p: p, rel: m[key] });
    });
    if (hits.length) {
      html += '<div class="sec"><h3>流年地支动到了哪里</h3>';
      hits.forEach(function (h) {
        html += '<div class="card"><div class="card-title">' + esc(h.p.title) + '（' + B.ZHI[h.p.zhi] + '）'
          + '<span class="tag ' + (h.rel === '六合' ? 'good' : 'bad') + '">' + h.rel + '</span></div>'
          + '<div class="card-text">' + B.ZHI[h.p.zhi] + B.ZHI[ln.zhi] + h.rel
          + '——' + esc(h.p.tag) + '这一块今年会被重点引动，人事起伏多集中在此。</div></div>';
      });
      html += '</div>';
    }

    html += '<div class="sec"><h3>怎么看流年</h3><div class="card"><div class="card-text">'
      + '· 流年干管天时大势、外部机会；流年支管地利人事、具体落点。<br>'
      + '· 流年太岁与命局某柱<b>冲</b> → 变动；<b>合</b> → 牵绊结缘；<b>刑害</b> → 内耗纠缠。<br>'
      + '· 关键：<b>先看大运，再看流年</b>。同一年的吉凶，在不同大运背景下完全不是一回事。<br>'
      + '· 如果流年干是你命中<b>忌神</b>，再好的流年支也只是缓冲，别盲目乐观。'
      + '</div></div></div>';

    $('lnContent').innerHTML = html;
  }

  /* ---------------- 八、神煞 · 刑冲 ---------------- */
  function renderShensha(chart, A) {
    var html = '';
    html += '<div class="sec"><h3>神煞一览</h3>';
    if (chart.shensha.length) {
      html += '<table class="grid"><thead><tr><th style="width:100px">神煞</th><th style="width:70px">在地支</th>'
        + '<th style="width:130px">落处</th><th>含义</th></tr></thead><tbody>';
      chart.shensha.forEach(function (s) {
        var good = /贵|文昌|禄神|将星|天德|月德/.test(s.name);
        html += '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.zhi) + '</td><td>' + esc(s.at) + '</td>'
          + '<td>' + esc(s.desc) + '</td></tr>';
      });
      html += '</tbody></table>';
      html += '<div class="ni">神煞是「点缀」，不是「主线」。<b>格局、用神、刑冲合会才是主结构</b>，'
        + '神煞只用来做细节补充——见了吉煞不必得意，格局破了照样不吉。</div>';
    } else {
      html += '<div class="empty">本命局未触发主要神煞</div>';
    }
    html += '</div>';

    html += '<div class="sec"><h3>刑冲合会（结构张力）</h3>';
    if (A.interactions.length) {
      var sorted = A.interactions.slice().sort(function (a, b) { return b.weight - a.weight; });
      sorted.forEach(function (x) {
        var isSoft = x.type.indexOf('合') >= 0 || x.type.indexOf('会') >= 0;
        html += '<div class="card"><div class="card-title">' + esc(x.names)
          + '<span class="tag ' + (isSoft ? 'good' : 'bad') + '">' + esc(x.type) + '</span></div>'
          + '<div class="card-text">' + esc(x.desc) + '</div></div>';
      });
    } else {
      html += '<div class="empty">四柱地支之间无明显的刑冲合会</div>';
    }
    html += '</div>';

    html += '<div class="sec"><h3>作用关系速查</h3><table class="grid">'
      + '<thead><tr><th style="width:80px">类型</th><th>组合</th><th style="width:120px">含义</th></tr></thead><tbody>'
      + REL_ROWS() + '</tbody></table></div>';

    $('pane-shensha').innerHTML = html;
  }

  function REL_ROWS() {
    var r = [
      ['六合', '子丑、寅亥、卯戌、辰酉、巳申、午未', '牵绊、结缘、和解'],
      ['六冲', '子午、丑未、寅申、卯酉、辰戌、巳亥', '变动、离散、冲击'],
      ['三合局', '申子辰合水、寅午戌合火、巳酉丑合金、亥卯未合木', '成局力量大'],
      ['三会方', '寅卯辰会木、巳午未会火、申酉戌会金、亥子丑会水', '一方正气'],
      ['六害', '子未、丑午、寅巳、卯辰、申亥、酉戌', '内耗、暗中损耗'],
      ['相刑', '寅巳申无恩、丑戌未恃势、子卯无礼、辰午酉亥自刑', '纠缠、官非、自困'],
      ['天干五合', '甲己合土、乙庚合金、丙辛合水、丁壬合木、戊癸合火', '合则有情、合去则有变']
    ];
    return r.map(function (x) {
      return '<tr><td><b>' + x[0] + '</b></td><td>' + x[1] + '</td><td>' + x[2] + '</td></tr>';
    }).join('');
  }

  /* ---------------- 九、理论速查 ---------------- */
  function renderTheory() {
    var html = '';

    html += sec('排盘三条铁律', [
      ni('<b>一、换年在立春，不在正月初一。</b>八字用的是「节气太阳历」——立春那一刻才换年。'
        + '2026 年立春是 2 月 4 日 04:02，此前的 2 月 3 日出生的人，年柱仍是<b>乙巳</b>不是丙午。'
        + '这一点和紫微斗数（按农历正月初一换年）完全不同，是两个系统最容易互相搞混的地方。'),
      ni('<b>二、换月只看「节」不看「气」。</b>二十四节气里，只有十二个「节」才是月与月的分界：'
        + '立春·惊蛰·清明·立夏·芒种·小暑·立秋·白露·寒露·立冬·大雪·小寒。'
        + '雨水、春分这些「气」只管气候，不管排盘。'),
      ni('<b>三、必须换算真太阳时。</b>北京时间只是东经 120° 的标准时。'
        + '真太阳时 = 北京时间 + 经度差（每偏1°约4分）+ 均时差（±16分）。'
        + '新疆乌鲁木齐和北京的经度差近 33°，时差超过 2 小时——不换算，时柱整个错。'
        + '另外 1986–1991 年中国实行过夏令时，那几年出生的人要回拨 1 小时。')
    ]);

    html += '<div class="sec"><h3>十神速查表</h3>' + ssTable() + '</div>';

    html += '<div class="sec"><h3>十神对照（日主 × 天干）</h3>'
      + '<div class="hint" style="margin-bottom:8px">横向是日主，纵向是遇到的天干，交叉处即十神。这张表是整个八字体系的地基。</div>'
      + ganTable() + '</div>';

    html += '<div class="sec"><h3>地支藏干表</h3>' + cangTable() + '</div>';

    html += '<div class="sec"><h3>旺相休囚死（月令对日主）</h3>' + wxTable() + '</div>';

    html += '<div class="sec"><h3>十干逐月调候用神速查（《穷通宝鉴》）</h3>'
      + '<div class="hint" style="margin-bottom:8px">横列是月令，纵列是日主，交叉处即该月第一调候用神。'
      + '这张表是《穷通宝鉴》的核心，也是「调候派」区别于「格局派」「扶抑派」的标志。</div>'
      + qiongtongTable()
      + '<div class="ni">读法举例：同为冬月生，<b>甲木子月要丁</b>、<b>庚金子月要丁丙</b>、<b>丙火子月要壬</b>、'
      + '<b>癸水子月要庚辛</b>——四个完全不同的答案。「冬天生人一律补火」是外行话，'
      + '真正的调候要看日主是谁。</div></div>';

    html += '<div class="sec"><h3>八格成格条件（《子平真诠》· 论用神成败救应）</h3>'
      + '<table class="grid"><thead><tr><th style="width:96px">格局</th><th>成格条件（原文要旨）</th></tr></thead><tbody>'
      + CHENGGE_ROWS() + '</tbody></table>'
      + '<div class="ni" style="margin-top:12px"><b>相神</b>：保护格神的那个字。'
      + '《子平真诠》极重相神——<b>相神受伤，比格神受伤危害还大</b>。'
      + '比如官格的相神是印（印能制伤官、护住官星），印被财破，官格就立不住。</div>'
      + '<div style="margin-top:12px"><b>吉神顺用 / 凶神逆用（原文）</b></div>'
      + '<div class="card"><div class="card-text" style="line-height:1.9">'
      + '「是以善而顺用之，则财喜食神以相生，生官以护财；官喜透财以相生，生印以护官；'
      + '印喜官煞以相生，劫才以护印；食喜身旺以相生，生财以护食。<br>'
      + '不善而逆用之，则七煞喜食神以制伏，忌财印以资扶；伤官喜佩印以制伏，生财以化伤；'
      + '阳刃喜官煞以制伏，忌官煞之俱无；月劫喜透官以制伏，利用财而透食以化劫。」'
      + '</div></div></div>';

    html += sec('格局定贵贱，扶抑定安危（两套体系别硬套）', [
      card('格局法（子平真诠体系）', '以<b>月令格神</b>为中心，看格局成破。'
        + '吉神顺用（生之护之），凶神逆用（制之化之）。'
        + '<b>格局优先看格神成败，身强身弱是次要。</b>哪怕日主身弱，只要格局保全，依然可以有贵；'
        + '反之格局破了，就算日主平衡，也多波折。'),
      card('扶抑法（旺衰平衡体系）', '以<b>日主</b>为中心，追求五行平衡。'
        + '身旺则泄、克、耗（抑）；身弱则生、帮（扶）。'
        + '这是现代最流行的一套，长于判断承载力、健康、抗压能力。'),
      card('为什么不能混', '两套体系的<b>立足点不同</b>：一个问「这个结构成立不成立」，'
        + '一个问「这个人扛不扛得住」。同一个八字，格局法可能说「贵」，扶抑法可能说「身弱」——'
        + '这两句话并不矛盾，说的是两件事。<br>'
        + '<b>实务上的用法</b>：格局判层次高低，扶抑判安危起伏，调候判身心舒泰，三者合看。')
    ]);

    html += sec('取用神五法', [
      card('扶抑', '最常用。身强则抑之泄之（食伤、财、官杀），身弱则扶之生之（印、比劫）。目的是把命局调回中和。'),
      card('调候', '《滴天髓》一脉。<b>冬月生人需火，夏月生人需水</b>，专治寒暖燥湿偏差。优先级常高于扶抑——无调候则格局难发。'),
      card('通关', '局中两行交战、势均力敌时，取能沟通双方的五行为用，转相克为相生。例：金木交战，取水通关。'),
      card('病药', '《神峰通考》：<b>有病方为贵</b>。某一行过旺即为病，能制伏它的五行就是药。'),
      card('从旺', '日主极弱、全局无根无生扶时，不必勉强扶，反而顺势从之（从财、从杀、从儿），另立一格。')
    ]);

    html += sec('断盘六步法', [
      card('第 1 步 · 排盘核对', '核对历法：公历农历转换、立春换年、节换月、真太阳时、夏令时、早晚子时口径。这一步错，后面全错。'),
      card('第 2 步 · 看日主强弱', '得令（月令）、得地（通根）、得生（印星）、得势（比劫）四看，再看克泄耗。定出身强 / 偏强 / 中和 / 偏弱 / 身弱。'),
      card('第 3 步 · 看调候', '冬月找火、夏月找水。先看寒暖燥湿，再论生克格局。'),
      card('第 4 步 · 定格局', '月令本气 → 八格（正官、七杀、正财、偏财、正印、偏印、食神、伤官）；本气为比劫 → 建禄 / 月刃；皆无 → 不入格。'),
      card('第 5 步 · 取用神', '按调候 → 通关 → 扶抑的顺序取。同时排出喜神与忌神（用神为喜，生用神者次喜，泄克用神者为忌）。'),
      card('第 6 步 · 排岁运', '起运岁数 → 大运顺逆 → 每十年一运。再叠加流年：<b>先看大运背景，再看流年具体</b>。')
    ]);

    html += '<div class="sec"><h3>六亲：十神对应谁</h3>' + liuqinTable()
      + '<div class="ni">六亲要<b>「十星 + 宫位 + 运程」三者合看</b>：'
      + '十神决定是谁，宫位决定住在哪里，大运决定什么时候应事。'
      + '父亲看偏财（无偏财看正财），母亲看正印（无正印看偏印）。'
      + '父母看幼运，夫妻兄弟看中运，子女看老运。</div></div>';

    html += '<div class="sec"><h3>宫位：谁住在哪里</h3>' + gongweiTable() + '</div>';

    html += sec('流派口径差异（本系统全部开放给你选）', [
      card('早晚子时', '<b>古法</b>：23:00–24:00 仍算当日子时，日柱不变，时干按「次日日干」起子时。'
        + '<b>换日法</b>（大宗现代做法）：23:00 起日柱顺延一天。两种口径会导致日柱、时柱同时改变，必须先确认自己跟哪一派。'),
      card('起运折算', '<b>三日折一岁</b>（线性）：出生时刻到换运节气的总分钟 ÷ 4320 得年数，一日折四月。'
        + '<b>一时辰折十日</b>（古法）：日差折四月之外，另把时辰差折算成日数再除以三得月。'
        + '两者结果可能相差一整年，这也是各家起运岁数对不上的主要原因。'),
      card('用神定义', '「用神」这个词各家含义并不统一：<b>格局派</b>以月令格局成败为用神，'
        + '<b>调候派</b>以寒暖所需为用神，<b>扶抑派</b>（现代书房派）以平衡日主强弱为用神。'
        + '遇到结论冲突，先问「你说的是哪一派的用神」。')
    ]);

    html += sec('现代学术视角：它站得住脚吗', [
      card('陆致极：唯一有计算语言学背景的命理学者',
        '1949 年生于上海，1981 年复旦中文系硕士，1991 年美国伊利诺大学语言学博士，'
        + '出版过《计算语言学导论》。他的价值在于<b>用学术方法做命理</b>：<br>'
        + '· 考证出「纳音古法 → 过渡形态 → 正五行子平今法」的完整演变链，'
        + '填补了四柱源流研究的关键缺口；<br>'
        + '· 提出<b>「时空基因」假说</b>：出生时空结构如同天地赋予的另一种基因，'
        + '对应先天体质禀赋；用逻辑回归、聚类统计挖掘四柱与体质、易发疾病的相关性；<br>'
        + '· 明确反对把旺衰当唯一标准——「旺衰是结构分析的重要视角之一」，但不是第一性。'),
      card('四条站不住的地方（科学哲学层面）',
        '<b>① 不可证伪</b>：同一件事可以多种解法——创业失败既可说「财星被劫」也可说「官杀攻身」，'
        + '成功又可套「食神生财」。一个能解释一切的理论，等于什么都没预测。<br>'
        + '<b>② 不可重复</b>：同一八字，不同命师结论迥异；「早年奔波、中年有贵人」这类话放之四海皆准。<br>'
        + '<b>③ 无物理机制</b>：五行生克是<b>符号关系</b>，不是物质相互作用；'
        + '基因决定禀赋，家庭资本、教育、社会结构决定阶层。<br>'
        + '<b>④ 大样本无显著因果</b>：香港大学 2005 年研究显示八字与 MBTI 性格无显著相关；'
        + '明清科举上榜者的八字也没有共性。'),
      card('那为什么那么多人觉得「准」',
        '<b>巴纳姆效应</b>：笼统而正反兼顾的描述，让人误以为是专属定制；<br>'
        + '<b>确认偏误</b>：只记住说中的，忽略没说的；<br>'
        + '<b>自我实现预言</b>：信「今年利财」便更敢决策，成功归给八字；<br>'
        + '<b>幸存者偏差</b>：命馆只展示应验案例，反例不被传播。'),
      card('那它还值得学吗',
        '值得，但要换一个定位：<br>'
        + '· 作为<b>人格隐喻工具</b>——日主强弱、十神配置可当「本土化的大五人格」，类似 MBTI 的启发式；<br>'
        + '· 作为<b>决策叙事框架</b>——「身弱宜守、身强宜拓」与战略管理的资源基础观互为印证，'
        + '帮自己在关键节点做自我反思；<br>'
        + '· 作为<b>中国思维的样本</b>——阴阳辩证、动态平衡，是理解中医、农学、本土管理的一把钥匙。<br>'
        + '<b>王德峰的说法最中肯：命理是「安顿人心的形而上」，可当文化，不可当科学。</b>')
    ]);

    html += '<div class="sec"><h3>进阶书目（按读的顺序）</h3>' + bookTable() + '</div>';

    html += '<div class="sec"><h3>六个坑（初学者最常踩）</h3>'
      + '<div class="card"><div class="card-text">'
      + '1. <b>把正月初一当换年</b>——八字换年在立春。<br>'
      + '2. <b>忽略真太阳时</b>——新疆、西藏出生的人不做校正，时柱必错。<br>'
      + '3. <b>只看神煞不看格局</b>——神煞是点缀，不是主线。<br>'
      + '4. <b>把格局和强弱混为一谈</b>——格局是「结构」，强弱是「体力」，两回事。<br>'
      + '5. <b>拿用神当万能钥匙</b>——不同流派定义不同，先确认口径。<br>'
      + '6. <b>用它做重大决策</b>——它是自我觉察工具，不是判决文书。'
      + '</div></div></div>';

    $('pane-theory').innerHTML = html;
  }

  function sec(title, blocks) {
    return '<div class="sec"><h3>' + esc(title) + '</h3>' + blocks.join('') + '</div>';
  }
  function ni(s) { return '<div class="ni">' + s + '</div>'; }
  function card(t, c) {
    return '<div class="card"><div class="card-title">' + esc(t) + '</div><div class="card-text">' + c + '</div></div>';
  }

  function ssTable() {
    var order = ['bs', 'jc', 'ss', 'sg', 'zc', 'pc', 'zg', 'qs', 'zy', 'py'];
    var html = '<table class="grid"><thead><tr><th style="width:70px">十神</th><th style="width:60px">关系</th>'
      + '<th>现代所指</th><th>心性</th></tr></thead><tbody>';
    order.forEach(function (k) {
      var m = I.SS_MEAN[k];
      html += '<tr><td class="' + ssCls(k) + '"><b>' + m.title + '</b></td>'
        + '<td>' + B.SS[k].cat + '</td><td>' + m.mean + '</td><td>' + m.traits + '</td></tr>';
    });
    return html + '</tbody></table>';
  }

  function ganTable() {
    var html = '<table class="grid" style="font-size:12px"><thead><tr><th style="width:44px">日主＼见</th>';
    for (var j = 0; j < 10; j++) html += '<th>' + B.GAN[j] + '</th>';
    html += '</tr></thead><tbody>';
    for (var i = 0; i < 10; i++) {
      html += '<tr><th style="background:#F7F2E8">' + B.GAN[i] + '</th>';
      for (var jj = 0; jj < 10; jj++) {
        var s = B.shishen(i, jj);
        html += '<td class="' + ssCls(s.key) + '">' + s.name + '</td>';
      }
      html += '</tr>';
    }
    return html + '</tbody></table>';
  }

  function cangTable() {
    var html = '<table class="grid"><thead><tr><th style="width:50px">地支</th><th style="width:50px">五行</th>'
      + '<th>本气</th><th>中气</th><th>余气</th><th>说明</th></tr></thead><tbody>';
    var note = {
      0: '纯水之位', 1: '湿土库金之墓', 2: '木之禄地，火土长生', 3: '纯木之旺',
      4: '湿土水库', 5: '火之禄地，庚金长生', 6: '火之旺地', 7: '燥土木库',
      8: '金之禄地，壬水长生', 9: '纯金之旺', 10: '燥土火库', 11: '水之禄地，甲木长生'
    };
    for (var z = 0; z < 12; z++) {
      html += '<tr><td><b>' + B.ZHI[z] + '</b></td><td>' + B.ZHI_WX[z] + '</td>';
      ['本', '中', '余'].forEach(function (dg) {
        var f = B.CANGGAN[z].filter(function (c) { return c.d === dg; });
        html += '<td>' + (f.length ? f.map(function (c) { return B.GAN[c.g] + '(' + B.WX[c.g] + ')'; }).join(' ') : '—') + '</td>';
      });
      html += '<td>' + note[z] + '</td></tr>';
    }
    return html + '</tbody></table>';
  }

  function wxTable() {
    var rows = [
      ['当令（同我）', '最旺。日主与月令同气', '+30'],
      ['相 · 泄气（我生）', '我生月令，泄己之气', '−5'],
      ['休 · 得生（生我）', '月令生我，得母气之助', '+15'],
      ['囚 · 受克（克我）', '月令克我，受压制', '−18'],
      ['死 · 耗身（我克）', '我克月令，耗我之力', '−28']
    ];
    var html = '<table class="grid"><thead><tr><th style="width:150px">关系</th><th>含义</th><th style="width:70px">权重</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var neg = r[2].indexOf('−') >= 0;
      html += '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td>'
        + '<td style="color:' + (neg ? 'var(--cinnabar)' : 'var(--jade)') + '">' + r[2] + '</td></tr>';
    });
    return html + '</tbody></table>';
  }

  /* 八格成格条件（子平真诠 · 论用神成败救应） */
  function CHENGGE_ROWS() {
    var rows = [
      ['正官格', '官逢财印，又无刑冲破害'],
      ['财格', '财旺生官；或财逢食生而身强带比；或财格透印而位置妥适，两不相克'],
      ['印格', '印轻逢煞；或官印双全；或身印两旺而用食伤泄气；或印多逢财而财透根轻'],
      ['食神格', '食神生财；或食带煞而无财，弃食就煞而透印'],
      ['七杀格', '身强七煞逢制伏'],
      ['伤官格', '伤官生财；或伤官佩印而伤官旺、印有根；或伤官旺、身主弱而透煞印；或伤官带煞而无财'],
      ['阳刃格', '透官煞而露财印，不见伤官'],
      ['建禄月劫格', '透官而逢财印；透财而逢食伤；透煞而遇制伏']
    ];
    return rows.map(function (r) {
      return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td></tr>';
    }).join('');
  }

  /* 十干 × 十二月 第一调候用神 */
  function qiongtongTable() {
    var T = window.Tiaohou;
    if (!T) return '';
    var order = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];
    var html = '<table class="grid" style="font-size:12.5px"><thead><tr><th style="width:58px">日主＼月</th>';
    order.forEach(function (z) { html += '<th style="text-align:center">' + T.ZHI[z] + '</th>'; });
    html += '</tr></thead><tbody>';
    for (var g = 0; g < 10; g++) {
      html += '<tr><th style="background:#F7F2E8;text-align:center">' + T.GAN[g] + '</th>';
      order.forEach(function (z) {
        var r = T.look(g, z);
        html += '<td style="text-align:center">' + (r ? '<b>' + r.main + '</b>' : '—') + '</td>';
      });
      html += '</tr>';
    }
    return html + '</tbody></table>';
  }

  /* 六亲表 */
  function liuqinTable() {
    var order = ['zy', 'py', 'bs', 'jc', 'ss', 'sg', 'zc', 'pc', 'zg', 'qs'];
    var html = '<table class="grid"><thead><tr><th style="width:64px">十神</th>'
      + '<th>男命</th><th>女命</th><th style="width:170px">备注</th></tr></thead><tbody>';
    order.forEach(function (k) {
      var v = I.LIUQIN[k];
      if (!v) return;
      var m = v.common || v.male || '';
      var f = v.common || v.female || '';
      html += '<tr><td class="' + ssCls(k) + '"><b>' + I.SS_MEAN[k].title + '</b></td>'
        + '<td>' + esc(m) + '</td><td>' + esc(f) + '</td>'
        + '<td style="color:var(--ink3);font-size:12.5px">' + esc(v.note || '') + '</td></tr>';
    });
    return html + '</tbody></table>';
  }

  /* 宫位表 */
  function gongweiTable() {
    var order = [['year', '年柱'], ['month', '月柱'], ['day', '日柱'], ['hour', '时柱']];
    var html = '<table class="grid"><thead><tr><th style="width:62px">宫位</th><th style="width:110px">名称</th>'
      + '<th>主管</th><th style="width:92px">大致年龄段</th></tr></thead><tbody>';
    order.forEach(function (o) {
      var g = I.GONGWEI[o[0]];
      if (!g) return;
      html += '<tr><td><b>' + o[1] + '</b></td><td>' + esc(g.name) + '</td>'
        + '<td>' + esc(g.scope) + '</td><td>' + esc(g.age) + '</td></tr>';
    });
    return html + '</tbody></table>';
  }

  function bookTable() {
    var books = [
      ['《渊海子平》', '宋·徐子升辑', '子平法第一部系统著作', '案头工具书，随时翻查，不必通读'],
      ['《三命通会》', '明·万民英', '明代集大成，资料最全', '当百科全书用，查阅为主'],
      ['《子平真诠》', '清·沈孝瞻', '格局理论最清晰，专讲用神成败', '<b>本系统的主要理论依据，推荐精读</b>'],
      ['《滴天髓》', '传宋·京图 / 清·任铁樵注', '调候与五行气势，偏重思辨', '任铁樵注本必读，原文太简'],
      ['《穷通宝鉴》', '清·余春台辑', '调候专书，按月令逐日主讲', '学完扶抑后接着啃'],
      ['《命理探原》', '民国·袁树珊', '近代转型之作，体系清楚', '入门友好'],
      ['《子平基础概要》', '梁湘润', '现代教学体系，条理分明', '适合从头建立框架']
    ];
    var html = '<table class="grid"><thead><tr><th style="width:130px">书名</th><th style="width:120px">作者</th>'
      + '<th style="width:170px">特点</th><th>建议读法</th></tr></thead><tbody>';
    books.forEach(function (b) {
      html += '<tr><td><b>' + b[0] + '</b></td><td>' + b[1] + '</td><td>' + b[2] + '</td><td>' + b[3] + '</td></tr>';
    });
    return html + '</tbody></table>';
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
