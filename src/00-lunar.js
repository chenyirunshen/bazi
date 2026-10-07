/* =============================================================
 *  历法模块（八字专用）：公历 ⇄ 农历、干支、节气（分钟级）、真太阳时
 *  节气数据由 lunar-python（寿星万年历）生成，覆盖 1900-2100
 * ============================================================= */
(function (global) {
  'use strict';

  var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  var MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  var DAY_CN = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

  /* 二十四节气（按年内自然顺序），下标即序号 */
  var JIEQI = ['小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
    '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'];

  /* 十二「节」的下标 —— 换月只看节，不看气 */
  /* 小寒→丑 立春→寅 惊蛰→卯 清明→辰 立夏→巳 芒种→午 */
  /* 小暑→未 立秋→申 白露→酉 寒露→戌 立冬→亥 大雪→子 */
  var JIE_IDX = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  var JIE_ZHI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0]; // 丑寅卯辰巳午未申酉戌亥子

  var LICHUN = 2;   // 立春下标
  var START_Y = 1900, END_Y = 2100;

  /* ---------- 儒略日 ---------- */
  function jdn(y, m, d) {
    var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
      - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  function jdnToDate(j) {
    var a = j + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4);
    var d1 = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d1 / 4), m1 = Math.floor((5 * e + 2) / 153);
    var day = e - Math.floor((153 * m1 + 2) / 5) + 1;
    var month = m1 + 3 - 12 * Math.floor(m1 / 10);
    var year = 100 * b + d1 - 4800 + Math.floor(m1 / 10);
    return [year, month, day];
  }
  function diffDays(y1, m1, d1, y2, m2, d2) { return jdn(y1, m1, d1) - jdn(y2, m2, d2); }
  function absMin(y, m, d, h, mi) { return jdn(y, m, d) * 1440 + h * 60 + mi; }
  function addDays(y, m, d, n) { return jdnToDate(jdn(y, m, d) + n); }
  function dayOfYear(y, m, d) { return diffDays(y, m, d, y, 1, 1) + 1; }

  /* ---------- 干支 ---------- */
  function ganzhi(i) { return GAN[i % 10] + ZHI[i % 12]; }
  function dayGanzhi(y, m, d) {
    var idx = ((jdn(y, m, d) + 49) % 60 + 60) % 60;
    return { idx: idx, gan: idx % 10, zhi: idx % 12, name: GAN[idx % 10] + ZHI[idx % 12] };
  }
  /* 农历年干支（立春后属当年）：甲子序号 = (Y-4) mod 60 */
  function yearGanzhiIdx(lunarYear) { return ((lunarYear - 4) % 60 + 60) % 60; }

  /* ---------- 均时差（Spencer 1971，精度 <0.5 分钟）---------- */
  function equationOfTime(y, m, d) {
    var N = dayOfYear(y, m, d);
    var G = 2 * Math.PI * (N - 1) / 365;
    var e = 229.18 * (0.000075 + 0.001868 * Math.cos(G) - 0.032077 * Math.sin(G)
      - 0.014615 * Math.cos(2 * G) - 0.040849 * Math.sin(2 * G));
    return e; // 分钟
  }

  /* ---------- 真太阳时校正 ---------- */
  /* 输入钟表时间（北京时间基准），返回校正后的日期时间 */
  function trueSolarTime(y, mo, d, h, mi, lng, dstFlag) {
    var total = h * 60 + mi;
    var log = [];
    var dstMin = 0;
    if (dstFlag) { total -= 60; dstMin = -60; log.push('夏令时回拨 −60 分'); }
    var lngMin = (lng - 120) * 4;
    total += lngMin;
    log.push('经度差 ' + lng.toFixed(2) + '° → ' + (lngMin >= 0 ? '+' : '') + lngMin.toFixed(1) + ' 分');
    var n = dayOfYear(y, mo, d);
    var eot = equationOfTime(y, mo, d);
    total += eot;
    log.push('均时差 ' + (eot >= 0 ? '+' : '') + eot.toFixed(1) + ' 分');
    // 跨日归一
    var dayOffset = 0;
    while (total < 0) { total += 1440; dayOffset -= 1; }
    while (total >= 1440) { total -= 1440; dayOffset += 1; }
    var dt = addDays(y, mo, d, dayOffset);
    return {
      year: dt[0], month: dt[1], day: dt[2],
      hour: Math.floor(total / 60), minute: Math.round(total % 60),
      dayOffset: dayOffset, lngMin: lngMin, eot: eot, totalDelta: Math.round(lngMin + eot + dstMin),
      log: log
    };
  }

  /* ---------- 节气序列（懒构建 + 二分）---------- */
  var SEQ = null;
  function buildSeq() {
    if (SEQ) return SEQ;
    SEQ = [];
    var data = global.JIEQI_DATA;
    if (!data) throw new Error('节气数据未加载');
    for (var y = START_Y; y <= END_Y; y++) {
      var rows = data[String(y)] || [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        SEQ.push({
          idx: r[0], name: JIEQI[r[0]], year: y, month: r[1], day: r[2],
          hour: r[3], minute: r[4], abs: absMin(y, r[1], r[2], r[3], r[4])
        });
      }
    }
    SEQ.sort(function (a, b) { return a.abs - b.abs; });
    return SEQ;
  }
  function isJie(idx) { return JIE_IDX.indexOf(idx) >= 0; }

  /* 找到 <= target 的最后一个节气 */
  function lastJieqiBefore(target) {
    var S = buildSeq(), lo = 0, hi = S.length - 1, res = null;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (S[mid].abs <= target) { res = S[mid]; lo = mid + 1; } else { hi = mid - 1; }
    }
    return res;
  }
  /* 找到 > target 的第一个节气 */
  function firstJieqiAfter(target) {
    var S = buildSeq(), lo = 0, hi = S.length - 1, res = null;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (S[mid].abs > target) { res = S[mid]; hi = mid - 1; } else { lo = mid + 1; }
    }
    return res;
  }
  /* 上一个「节」（换月用） */
  function lastJieBefore(target) {
    var S = buildSeq();
    for (var i = S.length - 1; i >= 0; i--) {
      if (S[i].abs <= target && isJie(S[i].idx)) return S[i];
    }
    return null;
  }
  /* 下一个「节」（起运用） */
  function firstJieAfter(target) {
    var S = buildSeq();
    for (var i = 0; i < S.length; i++) {
      if (S[i].abs > target && isJie(S[i].idx)) return S[i];
    }
    return null;
  }
  /* 上一个立春（定年柱） */
  function lastLichunBefore(target) {
    var S = buildSeq();
    for (var i = S.length - 1; i >= 0; i--) {
      if (S[i].abs <= target && S[i].idx === LICHUN) return S[i];
    }
    return null;
  }
  /* 当前所属节气（最近的、已过的节气） */
  function currentJieqi(target) { return lastJieqiBefore(target); }

  /* 某节气在某年的时刻 */
  function jieqiOf(year, name) {
    var S = buildSeq();
    for (var i = 0; i < S.length; i++) {
      if (S[i].year === year && S[i].name === name) return S[i];
    }
    return null;
  }

  /* ---------- 公历 → 农历 ---------- */
  function solarToLunar(y, m, d) {
    var L = global.LUNAR_DATA;
    if (!L) return null;
    if (y < START_Y || y > END_Y) return null;
    var ly = y, ny = L[String(y)].ny;
    if (diffDays(y, m, d, ny[0], ny[1], ny[2]) < 0) { ly = y - 1; ny = L[String(ly)].ny; }
    var data = L[String(ly)];
    var offset = diffDays(y, m, d, ny[0], ny[1], ny[2]);
    var blocks = [];
    for (var mm = 1; mm <= 12; mm++) {
      blocks.push({ m: mm, leap: false });
      if (data.leap === mm) blocks.push({ m: mm, leap: true });
    }
    var lm = 1, ld = 1, isLeap = false;
    for (var i = 0; i < blocks.length; i++) {
      var dc = data.days[i] || 29;
      if (offset < dc) { lm = blocks[i].m; ld = offset + 1; isLeap = blocks[i].leap; break; }
      offset -= dc;
    }
    return {
      lunarYear: ly, lunarMonth: lm, lunarDay: ld, isLeap: isLeap,
      monthCN: (isLeap ? '闰' : '') + MONTH_CN[lm - 1] + '月',
      dayCN: DAY_CN[ld - 1] || ('三十' + (ld - 30))
    };
  }

  /* ---------- 农历 → 公历 ---------- */
  function lunarToSolar(ly, lm, ld, isLeap) {
    var L = global.LUNAR_DATA;
    if (!L || ly < START_Y || ly > END_Y) return null;
    var data = L[String(ly)];
    if (!data) return null;
    var blocks = [];
    for (var mm = 1; mm <= 12; mm++) {
      blocks.push({ m: mm, leap: false });
      if (data.leap === mm) blocks.push({ m: mm, leap: true });
    }
    var need = isLeap && data.leap === lm;
    var found = -1;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].m === lm) {
        if (need) { if (blocks[i].leap) { found = i; break; } }
        else { if (!blocks[i].leap) { found = i; break; } }
      }
    }
    /* 该年无此闰月 → 退回平月 */
    if (found < 0) {
      for (var j = 0; j < blocks.length; j++) {
        if (blocks[j].m === lm && !blocks[j].leap) { found = j; break; }
      }
    }
    if (found < 0) return null;
    var maxDay = data.days[found] || 29;
    if (ld > maxDay) ld = maxDay;
    var offset = 0;
    for (var k = 0; k < found; k++) offset += (data.days[k] || 29);
    var ny = data.ny;
    return addDays(ny[0], ny[1], ny[2], offset + ld - 1);
  }

  /* 某农历年每月的天数序列，用于联动日期下拉 */
  function lunarMonthDays(ly, lm, isLeap) {
    var L = global.LUNAR_DATA;
    if (!L || !L[String(ly)]) return 30;
    var data = L[String(ly)];
    var blocks = [];
    for (var mm = 1; mm <= 12; mm++) {
      blocks.push({ m: mm, leap: false });
      if (data.leap === mm) blocks.push({ m: mm, leap: true });
    }
    var need = isLeap && data.leap === lm;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].m !== lm) continue;
      if (need && blocks[i].leap) return data.days[i] || 29;
      if (!need && !blocks[i].leap) return data.days[i] || 29;
    }
    return data.days[(lm - 1)] || 29;
  }

  /* 某农历年是否有闰月、闰几月 */
  function lunarLeapMonth(ly) {
    var L = global.LUNAR_DATA;
    if (!L || !L[String(ly)]) return 0;
    return L[String(ly)].leap || 0;
  }

  global.LunarKit = {
    GAN: GAN, ZHI: ZHI, ZODIAC: ZODIAC, JIEQI: JIEQI, JIE_IDX: JIE_IDX, JIE_ZHI: JIE_ZHI,
    START_Y: START_Y, END_Y: END_Y,
    jdn: jdn, jdnToDate: jdnToDate, diffDays: diffDays, absMin: absMin, addDays: addDays,
    dayOfYear: dayOfYear, ganzhi: ganzhi, dayGanzhi: dayGanzhi, yearGanzhiIdx: yearGanzhiIdx,
    equationOfTime: equationOfTime, trueSolarTime: trueSolarTime,
    buildSeq: buildSeq, lastJieqiBefore: lastJieqiBefore, firstJieqiAfter: firstJieqiAfter,
    lastJieBefore: lastJieBefore, firstJieAfter: firstJieAfter,
    lastLichunBefore: lastLichunBefore, currentJieqi: currentJieqi, jieqiOf: jieqiOf,
    solarToLunar: solarToLunar, lunarToSolar: lunarToSolar,
    lunarMonthDays: lunarMonthDays, lunarLeapMonth: lunarLeapMonth
  };
})(window);
