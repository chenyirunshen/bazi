/* =============================================================
 *  八字排盘引擎：四柱 · 藏干 · 十神 · 纳音 · 神煞 · 大运
 * ============================================================= */
(function (global) {
  'use strict';

  var K = global.LunarKit;
  var GAN = K.GAN, ZHI = K.ZHI;

  /* ---------- 基础数据 ---------- */
  var WX = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];      // 天干五行
  var YY = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0];                                    // 天干阴阳 1阳 0阴
  var ZHI_WX = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']; // 子丑寅卯辰巳午未申酉戌亥
  var ZHI_YY = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];

  /* 地支藏干：本气 / 中气 / 余气 */
  var CANGGAN = [
    [{ g: 9, d: '本' }],                             // 子 癸
    [{ g: 5, d: '本' }, { g: 9, d: '中' }, { g: 7, d: '余' }],  // 丑 己癸辛
    [{ g: 0, d: '本' }, { g: 2, d: '中' }, { g: 4, d: '余' }],  // 寅 甲丙戊
    [{ g: 1, d: '本' }],                             // 卯 乙
    [{ g: 4, d: '本' }, { g: 1, d: '中' }, { g: 9, d: '余' }],  // 辰 戊乙癸
    [{ g: 2, d: '本' }, { g: 4, d: '中' }, { g: 6, d: '余' }],  // 巳 丙戊庚
    [{ g: 3, d: '本' }, { g: 5, d: '中' }],          // 午 丁己
    [{ g: 5, d: '本' }, { g: 3, d: '中' }, { g: 1, d: '余' }],  // 未 己丁乙
    [{ g: 6, d: '本' }, { g: 8, d: '中' }, { g: 4, d: '余' }],  // 申 庚壬戊
    [{ g: 7, d: '本' }],                             // 酉 辛
    [{ g: 4, d: '本' }, { g: 7, d: '中' }, { g: 3, d: '余' }],  // 戌 戊辛丁
    [{ g: 8, d: '本' }, { g: 0, d: '中' }]           // 亥 壬甲
  ];

  /* 纳音六十甲子 */
  var NAYIN = ['海中金', '海中金', '炉中火', '炉中火', '大林木', '大林木', '路旁土', '路旁土', '剑锋金', '剑锋金',
    '山头火', '山头火', '涧下水', '涧下水', '城头土', '城头土', '白蜡金', '白蜡金', '杨柳木', '杨柳木',
    '泉中水', '泉中水', '屋上土', '屋上土', '霹雳火', '霹雳火', '松柏木', '松柏木', '长流水', '长流水',
    '沙中金', '沙中金', '山下火', '山下火', '平地木', '平地木', '壁上土', '壁上土', '金箔金', '金箔金',
    '覆灯火', '覆灯火', '天河水', '天河水', '大驿土', '大驿土', '钗钏金', '钗钏金', '桑柘木', '桑柘木',
    '大溪水', '大溪水', '沙中土', '沙中土', '天上火', '天上火', '石榴木', '石榴木', '大海水', '大海水'];

  /* 十神代号 */
  var SS = {
    bs: { key: 'bs', name: '比肩', cat: '同我' },
    jc: { key: 'jc', name: '劫财', cat: '同我' },
    ss: { key: 'ss', name: '食神', cat: '我生' },
    sg: { key: 'sg', name: '伤官', cat: '我生' },
    zc: { key: 'zc', name: '正财', cat: '我克' },
    pc: { key: 'pc', name: '偏财', cat: '我克' },
    zg: { key: 'zg', name: '正官', cat: '克我' },
    qs: { key: 'qs', name: '七杀', cat: '克我' },
    zy: { key: 'zy', name: '正印', cat: '生我' },
    py: { key: 'py', name: '偏印', cat: '生我' }
  };
  var SS_ALIAS = { 偏印: '偏印', 枭神: '偏印' };

  /* ---------- 十神：五行生克 + 阴阳异同 ---------- */
  /* 五行关系：按相生序 木(0)→火(1)→土(2)→金(3)→水(4)→木
     diff=0 同我  diff=1 我生  diff=2 我克  diff=3 克我  diff=4 生我 */
  function shengKe(a, b) {
    var MAP = ['木', '火', '土', '金', '水'];
    var ia = MAP.indexOf(a), ib = MAP.indexOf(b);
    if (ia < 0 || ib < 0) return '?';
    return ['同我', '我生', '我克', '克我', '生我'][(((ib - ia) % 5) + 5) % 5];
  }
  function shishen(dayGanIdx, targetGanIdx) {
    if (dayGanIdx === targetGanIdx) return YY[dayGanIdx] === YY[targetGanIdx] ? SS.bs : SS.bs;
    var rel = shengKe(WX[dayGanIdx], WX[targetGanIdx]);
    var same = YY[dayGanIdx] === YY[targetGanIdx];
    if (rel === '同我') return same ? SS.bs : SS.jc;
    if (rel === '我生') return same ? SS.ss : SS.sg;
    if (rel === '我克') return same ? SS.pc : SS.zc;
    if (rel === '克我') return same ? SS.qs : SS.zg;
    if (rel === '生我') return same ? SS.py : SS.zy;
    return null;
  }

  /* ---------- 遁法 ---------- */
  /* 五虎遁：年上起月。寅月天干 = (年干%5)*2+2 */
  function monthGan(yearGanIdx, monthZhiIdx) {
    // 正月建寅，寅月天干基准 = (年干%5)*2+2
    // 月建顺序：寅(1)卯(2)…子(11)丑(12)，故偏移需在 12 支内取正模，再对 10 取余
    var off = (((monthZhiIdx - 2) % 12) + 12) % 12;
    var v = ((yearGanIdx % 5) * 2 + 2 + off) % 10;
    return (v + 10) % 10;
  }
  /* 五鼠遁：日上起时。子时天干 = (日干%5)*2 */
  function hourGan(dayGanIdx, shichenIdx) {
    return (((dayGanIdx % 5) * 2) + shichenIdx) % 10;
  }

  /* ---------- 时辰 ---------- */
  function shichenOf(hour) {
    if (hour === 23) return { zhi: 0, lateZi: true, label: '晚子时' };
    if (hour === 0) return { zhi: 0, lateZi: false, label: '早子时' };
    return { zhi: Math.floor((hour + 1) / 2), lateZi: false, label: ZHI[Math.floor((hour + 1) / 2)] + '时' };
  }

  /* ---------- 主排盘 ---------- */
  /* input: {year,month,day,hour,minute,sex:'M'|'F',lng,dst,ziweiMode:false} */
  function paipan(inp) {
    var abs = K.absMin(inp.year, inp.month, inp.day, inp.hour, inp.minute);
    /* 夏令时回拨独立于真太阳时：它修的是「钟表被人为拨快」，与经度、均时差无关 */
    var bh = inp.hour, bm = inp.minute, bd = { y: inp.year, m: inp.month, d: inp.day };
    if (inp.dst) {
      var t0 = inp.hour * 60 + inp.minute - 60;
      if (t0 < 0) {
        t0 += 1440;
        var pv = K.addDays(inp.year, inp.month, inp.day, -1);
        bd = { y: pv[0], m: pv[1], d: pv[2] };
      }
      bh = Math.floor(t0 / 60); bm = t0 % 60;
    }

    var st;
    if (inp.useTST === false) {
      st = {
        year: bd.y, month: bd.m, day: bd.d, hour: bh, minute: bm,
        dayOffset: bd.y === inp.year && bd.m === inp.month && bd.d === inp.day ? 0 : -1,
        lngMin: 0, eot: 0, totalDelta: inp.dst ? -60 : 0,
        log: (inp.dst ? ['夏令时回拨 −60 分', '未作真太阳时校正'] : ['未作真太阳时校正'])
      };
    } else {
      st = K.trueSolarTime(bd.y, bd.m, bd.d, bh, bm, inp.lng, false);
      if (inp.dst) {
        st.totalDelta -= 60;
        st.dayOffset += (bd.d === inp.day ? 0 : -1);
        st.log.unshift('夏令时回拨 −60 分');
      }
    }
    var sy = st.year, sm = st.month, sd = st.day, sh = st.hour, smi = st.minute;

    /* --- 时辰 --- */
    var sc = shichenOf(sh);

    /* --- 日柱 --- */
    var baseDay = { y: sy, m: sm, d: sd };
    var isLateZi = sc.lateZi && sc.zhi === 0 && sh === 23;
    var useDay = { y: sy, m: sm, d: sd };
    if (isLateZi && inp.ziSwap) {          // 口径二：晚子时换日
      var nx = K.addDays(sy, sm, sd, 1);
      useDay = { y: nx[0], m: nx[1], d: nx[2] };
    }
    var dGz = K.dayGanzhi(useDay.y, useDay.m, useDay.d);

    /* --- 时柱 --- */
    /* 晚子时：日柱不变时，时干按「次日日干」起子时；换日时按次日子时正常起 */
    var hourGanBase = dGz.gan;
    if (isLateZi && !inp.ziSwap) {
      var nx2 = K.addDays(sy, sm, sd, 1);
      hourGanBase = K.dayGanzhi(nx2[0], nx2[1], nx2[2]).gan;
    }
    var hourGanIdx = hourGan(hourGanBase, sc.zhi);

    /* --- 月柱（以上一个「节」定月建）--- */
    var absTrue = K.absMin(sy, sm, sd, sh, smi);
    var lastJie = K.lastJieBefore(absTrue);
    if (!lastJie) throw new Error('超出支持范围（1900-2100）');
    var monthZhiIdx = K.JIE_ZHI[K.JIE_IDX.indexOf(lastJie.idx)];

    /* --- 年柱（以上一个立春定年）--- */
    var lastLc = K.lastLichunBefore(absTrue);
    if (!lastLc) throw new Error('超出支持范围（1900-2100）');
    var lunarYear = lastLc.year;
    var yearGzIdx = K.yearGanzhiIdx(lunarYear);
    var yearGanIdx = yearGzIdx % 10, yearZhiIdx = yearGzIdx % 12;

    /* --- 月干 --- */
    var monthGanIdx = monthGan(yearGanIdx, monthZhiIdx);

    /* --- 组装四柱 --- */
    var dayGanIdx = dGz.gan, dayZhiIdx = dGz.zhi;
    var raw = [
      { key: 'year', title: '年柱', tag: '祖上·根基', gan: yearGanIdx, zhi: yearZhiIdx },
      { key: 'month', title: '月柱', tag: '父母·提纲', gan: monthGanIdx, zhi: monthZhiIdx },
      { key: 'day', title: '日柱', tag: '自己·配偶', gan: dayGanIdx, zhi: dayZhiIdx },
      { key: 'hour', title: '时柱', tag: '子女·归宿', gan: hourGanIdx, zhi: sc.zhi }
    ];
    var pillars = raw.map(function (p) {
      var gzIdx = indexOfGanzhi(p.gan, p.zhi);
      var cg = CANGGAN[p.zhi].map(function (c) {
        return { gan: c.g, degree: c.d, ss: shishen(dayGanIdx, c.g) };
      });
      return {
        key: p.key, title: p.title, tag: p.tag,
        gan: p.gan, zhi: p.zhi,
        ganzhi: GAN[p.gan] + ZHI[p.zhi],
        gzIdx: gzIdx,
        wx: WX[p.gan], nayin: NAYIN[gzIdx],
        ss: shishen(dayGanIdx, p.gan),
        zhiWx: ZHI_WX[p.zhi],
        canggan: cg
      };
    });

    /* --- 大运 --- */
    var dayun = calcDayun(inp, absTrue, { gan: monthGanIdx, zhi: monthZhiIdx }, yearGanIdx, lastJie);

    /* --- 神煞 --- */
    var shensha = calcShensha(yearZhiIdx, dayZhiIdx, dayGanIdx, monthZhiIdx, pillars);

    /* --- 藏干十神统计 --- */
    var ssStat = {};
    pillars.forEach(function (p, i) {
      if (i === 2) return; // 日干本身
      var k = p.ss.key;
      ssStat[k] = (ssStat[k] || 0) + 1;
      p.canggan.forEach(function (c) {
        var k2 = c.ss.key;
        ssStat[k2] = (ssStat[k2] || 0) + 1;
      });
    });

    return {
      input: inp,
      solar: { y: inp.year, m: inp.month, d: inp.day, h: inp.hour, mi: inp.minute },
      trueSolar: st,
      isLateZi: isLateZi,
      shichen: sc,
      pillars: pillars,
      dayMaster: { gan: dayGanIdx, zhi: dayZhiIdx, name: GAN[dayGanIdx] + ZHI[dayZhiIdx], wx: WX[dayGanIdx] },
      monthOrder: lastJie.name + '（' + ZHI[monthZhiIdx] + '月）',
      lunarYear: lunarYear,
      zodiac: K.ZODIAC[yearZhiIdx],
      lastJie: lastJie,
      dayun: dayun,
      shensha: shensha,
      ssStat: ssStat
    };
  }

  function indexOfGanzhi(g, z) {
    for (var i = 0; i < 60; i++) { if (i % 10 === g && i % 12 === z) return i; }
    return 0;
  }

  /* ---------- 大运 ---------- */
  /* 时辰序号：23 点归入亥（11），0-1 点为子（0） */
  function timeZhiIndex(h) {
    if (h === 23) return 11;
    if (h === 0) return 0;
    return Math.floor((h + 1) / 2);
  }

  function calcDayun(inp, absTrue, monthPillar, yearGanIdx, lastJie) {
    var yang = YY[yearGanIdx] === 1;
    var forward = (inp.sex === 'M' && yang) || (inp.sex === 'F' && !yang);
    var target = forward ? K.firstJieAfter(absTrue) : lastJie;
    if (!target) return { forward: forward, list: [], note: '超出数据范围' };

    var deltaMin = Math.abs(target.abs - absTrue);
    var years, months, dayEq = 0;

    if (inp.qiyunMode === 'shichen') {
      /* 古法：三日为一岁，一日为四月，一个时辰为十日（时辰折算） */
      var startAbs = forward ? absTrue : target.abs;
      var endAbs = forward ? target.abs : absTrue;
      var d = K.jdnToDate(Math.floor(startAbs / 1440));
      var d2 = K.jdnToDate(Math.floor(endAbs / 1440));
      var dayDiff = K.diffDays(d2[0], d2[1], d2[2], d[0], d[1], d[2]);
      var sz = timeZhiIndex(Math.floor((startAbs % 1440) / 60));
      var ez = timeZhiIndex(Math.floor((endAbs % 1440) / 60));
      var hourDiff = ez - sz;
      if (hourDiff < 0) { hourDiff += 12; dayDiff -= 1; }
      var monthDiff = Math.floor(hourDiff * 10 / 30);
      var mAll = dayDiff * 4 + monthDiff;
      dayEq = hourDiff * 10 - monthDiff * 30;
      years = Math.floor(mAll / 12);
      months = mAll - years * 12;
    } else {
      /* 线性：三天折一年，一天折四月（现代主流） */
      years = Math.floor(deltaMin / 4320);
      months = Math.floor(((deltaMin % 4320) / 1440) * 4);
      dayEq = Math.floor(((deltaMin % 1440) / 1440) * 30);
    }

    /* 起运日历：命理年折算回真实日 */
    var normYears = years + months / 12 + dayEq / 360;
    var startDate = K.addDays(inp.year, inp.month, inp.day, Math.round(normYears * 365.2422));

    var mIdx = indexOfGanzhi(monthPillar.gan, monthPillar.zhi);
    var list = [];
    for (var i = 1; i <= 8; i++) {
      var idx = forward ? (mIdx + i) % 60 : (mIdx - i + 600) % 60;
      var startY = startDate[0] + (i - 1) * 10;
      list.push({
        idx: idx, gan: idx % 10, zhi: idx % 12,
        ganzhi: GAN[idx % 10] + ZHI[idx % 12],
        nayin: NAYIN[idx],
        order: i,
        startAge: years + (i - 1) * 10,
        startMonth: months,
        startYear: startY,
        endYear: startY + 9
      });
    }
    return {
      forward: forward, yang: yang, mode: inp.qiyunMode || 'linear',
      jieqi: target, deltaMin: deltaMin, deltaDays: deltaMin / 1440,
      years: years, months: months, days: dayEq,
      startDate: startDate,
      list: list
    };
  }

  /* ---------- 神煞 ---------- */
  var TY = { // 天乙贵人
    0: [1, 7], 4: [1, 7], 6: [1, 7],   // 甲戊庚 → 丑未
    1: [0, 8], 5: [0, 8],              // 乙己 → 子申
    2: [11, 9], 3: [11, 9],            // 丙丁 → 亥酉
    8: [3, 5], 9: [3, 5],              // 壬癸 → 卯巳
    7: [2, 6]                          // 辛 → 寅午
  };
  var WC = { 0: [5], 1: [6], 2: [8], 4: [8], 3: [9], 5: [9], 6: [11], 7: [0], 8: [2], 9: [3] }; // 文昌
  var LU = { 0: 2, 1: 3, 2: 5, 4: 5, 3: 6, 5: 6, 6: 8, 7: 9, 8: 11, 9: 0 };  // 禄神
  var YR = { 0: 3, 1: 2, 2: 6, 4: 6, 3: 5, 5: 5, 6: 9, 7: 8, 8: 0, 9: 11 };  // 羊刃
  var TJ = { 0: [0, 6], 1: [0, 6], 2: [3, 9], 3: [3, 9], 4: [4, 10, 1, 7], 5: [4, 10, 1, 7], 6: [2, 11], 7: [2, 11], 8: [5, 8], 9: [5, 8] }; // 太极贵人
  var GY = { 0: 10, 1: 11, 2: 1, 3: 2, 4: 1, 5: 2, 6: 4, 7: 5, 8: 7, 9: 8 }; // 国印贵人
  // 三合局查表：组号 → 驿马/桃花/华盖/将星/劫煞/亡神
  var SANHE = [
    { m: [8, 0, 4], ym: 2, th: 9, hg: 4, jx: 0, js: 5, ws: 11 },  // 申子辰
    { m: [2, 6, 10], ym: 8, th: 3, hg: 10, jx: 6, js: 11, ws: 5 }, // 寅午戌
    { m: [5, 9, 1], ym: 11, th: 6, hg: 1, jx: 9, js: 8, ws: 8 },   // 巳酉丑
    { m: [11, 3, 7], ym: 5, th: 0, hg: 7, jx: 3, js: 2, ws: 2 }    // 亥卯未
  ];
  function sanhe(z) {
    for (var i = 0; i < SANHE.length; i++) { if (SANHE[i].m.indexOf(z) >= 0) return SANHE[i]; }
    return SANHE[0];
  }
  var TDD = { 2: 3, 3: 8, 4: 8, 5: 7, 6: 11, 7: 0, 8: 9, 9: 2, 10: 2, 11: 1, 0: 5, 1: 6 }; // 天德
  var YDD = { 2: 2, 6: 2, 10: 2, 8: 8, 0: 8, 4: 8, 11: 0, 3: 0, 7: 0, 5: 6, 9: 6, 1: 6 };  // 月德

  function calcShensha(yearZhi, dayZhi, dayGan, monthZhi, pillars) {
    var res = [];
    function add(name, desc, zhiHit, pos) {
      var hit = pillars.filter(function (p) { return zhiHit.indexOf(p.zhi) >= 0; });
      if (hit.length) {
        res.push({
          name: name, desc: desc,
          at: hit.map(function (p) { return p.title; }).join('、'),
          zhi: zhiHit.map(function (z) { return ZHI[z]; }).join('')
        });
      }
    }
    add('天乙贵人', '逢凶化吉，遇事有人帮，主聪敏', TY[dayGan] || []);
    add('文昌', '读书、文字、考试、文职禀赋', WC[dayGan] || []);
    add('禄神', '俸禄、自给自足、有实际收益', [LU[dayGan]]);
    add('羊刃', '刚烈果决，权力与血光并存', [YR[dayGan]]);
    add('太极贵人', '好哲学宗教玄学，有钻研癖', TJ[dayGan] || []);
    add('国印贵人', '主掌权柄、公印公信', [GY[dayGan]]);
    var s1 = sanhe(yearZhi), s2 = sanhe(dayZhi);
    add('驿马', '走动、迁移、变动频繁', [s1.ym, s2.ym].filter(function (v, i, a) { return a.indexOf(v) === i; }));
    add('桃花', '人缘好、异性缘、审美力强', [s1.th, s2.th].filter(function (v, i, a) { return a.indexOf(v) === i; }));
    add('华盖', '孤高、宗教艺术玄学缘分', [s1.hg, s2.hg].filter(function (v, i, a) { return a.indexOf(v) === i; }));
    add('将星', '领导欲、组织力、掌权之象', [s1.jx, s2.jx].filter(function (v, i, a) { return a.indexOf(v) === i; }));
    add('劫煞', '损耗、意外、竞争破耗', [s1.js]);
    add('亡神', '心思重、易有隐晦损耗', [s1.ws]);
    if (TDD[monthZhi] !== undefined) add('天德贵人', '多逢庇佑，解危济困', [TDD[monthZhi]]);
    if (YDD[monthZhi] !== undefined) add('月德贵人', '温和有德，化煞增福', [YDD[monthZhi]]);

    // 空亡（以日柱旬空）
    var dayGzIdx = indexOfGanzhi(dayGan, dayZhi);
    var xunStart = Math.floor(dayGzIdx / 10) * 10;
    var kong = [(xunStart % 12 + 10) % 12, (xunStart % 12 + 11) % 12];
    add('空亡', '该宫力量减半，事多落空或看淡', kong);

    return res;
  }

  /* ---------- 刑冲合会害破 ---------- */
  var LIUHE = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  var LIUCHONG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
  var LIUHAI = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
  var SANHE2 = [[8, 0, 4, '水'], [2, 6, 10, '火'], [5, 9, 1, '金'], [11, 3, 7, '木']];
  var SANHUI = [[2, 3, 4, '木'], [5, 6, 7, '火'], [8, 9, 10, '金'], [11, 0, 1, '水']];
  var XING = [[2, 5, 8, '无恩之刑'], [1, 10, 7, '恃势之刑'], [0, 3, '无礼之刑'], [4, 6, 9, 11, '自刑']];
  var GANHE = [[0, 5, '土'], [1, 6, '金'], [2, 7, '水'], [3, 8, '木'], [4, 9, '火']];

  function analyzeInteractions(pillars) {
    var out = [];
    var zs = pillars.map(function (p) { return p.zhi; });
    for (var i = 0; i < pillars.length - 1; i++) {
      for (var j = i + 1; j < pillars.length; j++) {
        var a = pillars[i], b = pillars[j];
        for (var k = 0; k < LIUHE.length; k++) {
          var pair = LIUHE[k];
          if ((a.zhi === pair[0] && b.zhi === pair[1]) || (a.zhi === pair[1] && b.zhi === pair[0])) {
            out.push({ type: '六合', names: a.title + '↔' + b.title, desc: ZHI[a.zhi] + ZHI[b.zhi] + '合', weight: 3 });
          }
        }
        for (var k2 = 0; k2 < LIUCHONG.length; k2++) {
          var pc = LIUCHONG[k2];
          if ((a.zhi === pc[0] && b.zhi === pc[1]) || (a.zhi === pc[1] && b.zhi === pc[0])) {
            out.push({ type: '六冲', names: a.title + '↔' + b.title, desc: ZHI[a.zhi] + ZHI[b.zhi] + '相冲', weight: 4 });
          }
        }
        for (var k3 = 0; k3 < LIUHAI.length; k3++) {
          var ph = LIUHAI[k3];
          if ((a.zhi === ph[0] && b.zhi === ph[1]) || (a.zhi === ph[1] && b.zhi === ph[0])) {
            out.push({ type: '六害', names: a.title + '↔' + b.title, desc: ZHI[a.zhi] + ZHI[b.zhi] + '相害', weight: 2 });
          }
        }
        for (var k4 = 0; k4 < GANHE.length; k4++) {
          var pg = GANHE[k4];
          if ((a.gan === pg[0] && b.gan === pg[1]) || (a.gan === pg[1] && b.gan === pg[0])) {
            out.push({ type: '天干五合', names: a.title + '↔' + b.title, desc: GAN[a.gan] + GAN[b.gan] + '合' + pg[2], weight: 3 });
          }
        }
      }
    }
    // 三合 / 三会（需三字全）
    SANHE2.forEach(function (t) {
      if (t.slice(0, 3).every(function (z) { return zs.indexOf(z) >= 0; })) {
        out.push({ type: '三合局', names: t.slice(0, 3).map(function (z) { return ZHI[z]; }).join(''), desc: '三合' + t[3] + '局', weight: 5 });
      } else if (t.slice(0, 3).filter(function (z) { return zs.indexOf(z) >= 0; }).length === 2) {
        out.push({ type: '半合局', names: t.slice(0, 3).map(function (z) { return ZHI[z]; }).join(''), desc: '半合' + t[3] + '局（待引旺）', weight: 2 });
      }
    });
    SANHUI.forEach(function (t) {
      if (t.slice(0, 3).every(function (z) { return zs.indexOf(z) >= 0; })) {
        out.push({ type: '三会方', names: t.slice(0, 3).map(function (z) { return ZHI[z]; }).join(''), desc: '三会' + t[3] + '方', weight: 6 });
      }
    });
    XING.forEach(function (t) {
      var arr = t.slice(0, -1), name = t[t.length - 1];
      var cnt = arr.filter(function (z) { return zs.indexOf(z) >= 0; }).length;
      if (cnt >= (arr.length >= 3 ? 2 : 2)) {
        out.push({ type: '相刑', names: arr.filter(function (z) { return zs.indexOf(z) >= 0; }).map(function (z) { return ZHI[z]; }).join(''), desc: name, weight: 3 });
      }
    });
    return out;
  }

  /* ---------- 流年 ---------- */
  function liunian(chart, year) {
    var lc = K.jieqiOf(year, '立春');
    // 简化：以立春后属该年
    var idx = ((year - 4) % 60 + 60) % 60;
    var dm = chart.dayMaster.gan;
    return {
      year: year, ganzhi: GAN[idx % 10] + ZHI[idx % 12],
      gan: idx % 10, zhi: idx % 12,
      ss: shishen(dm, idx % 10),
      lichun: lc ? (lc.month + '月' + lc.day + '日 ' + pad(lc.hour) + ':' + pad(lc.minute)) : '—'
    };
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  global.BaziCore = {
    GAN: GAN, ZHI: ZHI, WX: WX, YY: YY, ZHI_WX: ZHI_WX, CANGGAN: CANGGAN, NAYIN: NAYIN, SS: SS,
    shishen: shishen, monthGan: monthGan, hourGan: hourGan, shichenOf: shichenOf,
    paipan: paipan, indexOfGanzhi: indexOfGanzhi, analyzeInteractions: analyzeInteractions,
    liunian: liunian, sanhe: sanhe
  };
})(window);
