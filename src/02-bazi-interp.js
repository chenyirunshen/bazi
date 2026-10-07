/* =============================================================
 *  八字分析判断：强弱 · 调候 · 格局 · 用神 · 岁运 · 批语
 *  说明：量化打分为启发式辅助工具，用于建立直观感受，
 *        不替代传统命理师的综合判断。
 * ============================================================= */
(function (global) {
  'use strict';

  var B = global.BaziCore;
  var GAN = B.GAN, ZHI = B.ZHI, WX = B.WX, YY = B.YY, ZHI_WX = B.ZHI_WX;
  var WXLIST = ['木', '火', '土', '金', '水'];

  /* 各五行当令月 */
  var LING = { 木: [2, 3], 火: [5, 6], 土: [4, 7, 8, 11], 金: [8, 9], 水: [0, 1] };
  /* 十二长生所代表的当令：寅卯木旺、巳午火旺、申酉金旺、亥子水旺、辰戌丑未土旺 */
  function wangOfZhi(z) {
    if (z === 2 || z === 3) return '木';
    if (z === 5 || z === 6) return '火';
    if (z === 8 || z === 9) return '金';
    if (z === 0 || z === 1) return '水';
    return '土';
  }
  /* 旺相休囚死：以日主为「我」，看月令五行对我的作用 */
  function relationOf(wxDay, wxMonth) {
    var i = WXLIST.indexOf(wxDay), j = WXLIST.indexOf(wxMonth);
    var d = (((j - i) % 5) + 5) % 5;
    // 0 同我=当令  1 我生=相(泄气)  2 我克=死  3 克我=囚  4 生我=休(得生)
    return ['当令', '相·泄气', '死·耗身', '囚·受克', '休·得生'][d];
  }

  /* ---------- 十神现代含义 ---------- */
  var SS_MEAN = {
    bs: { title: '比肩', mean: '同辈、伙伴、竞争者、自我意识', traits: '独立自主、不服输，也容易固执、与人分利' },
    jc: { title: '劫财', mean: '争夺、冲动、合作又分利', traits: '行动快、敢冲，财来财去、需注意合作纠纷' },
    ss: { title: '食神', mean: '表达、技艺、口福、安全感', traits: '温和乐观、有创造力，偏安、行动力略缓' },
    sg: { title: '伤官', mean: '才华、反叛、口才、创意', traits: '聪明外露、不服管，易与权威冲突，宜走专业路线' },
    zc: { title: '正财', mean: '稳定收入、固定资产、务实', traits: '勤俭守成、重实际，易流于保守计较' },
    pc: { title: '偏财', mean: '投资、经营、人脉资源、意外财', traits: '大方灵活、善抓机会，花钱也快' },
    zg: { title: '正官', mean: '规则、职位、名誉、体制内身份', traits: '守规矩、有责任感，压力来自自我要求' },
    qs: { title: '七杀', mean: '竞争、魄力、风险、压力', traits: '果断敢拼、抗压能力强，需注意过劳与冲突' },
    zy: { title: '正印', mean: '学历、贵人、庇护、证书资质', traits: '好学仁厚、得长辈缘，易依赖、行动偏慢' },
    py: { title: '偏印', mean: '冷门学问、偏门技术、独处', traits: '钻研深、思路异于常人，易孤僻、想法多而杂' }
  };

  /* ---------- 一、日主强弱（四看量化）---------- */
  function analyzeStrength(chart) {
    var dm = chart.dayMaster.gan;
    var dmWx = WX[dm];
    var items = [], total = 0;

    /* 1. 得令 */
    var monthWx = ZHI_WX[chart.pillars[1].zhi];
    var rel = relationOf(dmWx, monthWx); // 月令五行对日主
    var lingScore = { 当令: 30, '休·得生': 15, '相·泄气': -5, '囚·受克': -18, '死·耗身': -28 }[rel] || 0;
    items.push({
      name: '得令', desc: '日主' + dmWx + '生于' + monthWx + '旺之月（' + rel + '）',
      score: lingScore, detail: '月令是提纲，分量最重'
    });
    total += lingScore;

    /* 2. 得地（通根）*/
    var rootScore = 0, roots = [];
    chart.pillars.forEach(function (p, i) {
      B.CANGGAN[p.zhi].forEach(function (c) {
        if (WX[c.g] !== dmWx) return;
        var w = c.d === '本' ? 12 : (c.d === '中' ? 6 : 3);
        var pos = (i === 1 || i === 2) ? 1.5 : 1;   // 月支、日支根更重
        var s = w * pos;
        rootScore += s;
        roots.push({ year: p.title, zhi: ZHI[p.zhi], gan: GAN[c.g], degree: c.d, score: Math.round(s) });
      });
    });
    items.push({
      name: '得地', desc: roots.length ? '通根于 ' + roots.map(function (r) { return r.zhi + '(' + r.gan + r.degree + '气)'; }).join('、') : '全局无本气根',
      score: Math.round(rootScore), detail: '根是日主的立足之本'
    });
    total += rootScore;

    /* 3. 得生（印星）*/
    var shengScore = 0, shengList = [];
    chart.pillars.forEach(function (p, i) {
      if (i === 2) return;
      if (p.ss.key === 'zy' || p.ss.key === 'py') {
        shengScore += 8; shengList.push(p.title + p.ss.name);
      }
      p.canggan.forEach(function (c) {
        if (c.ss.key === 'zy' || c.ss.key === 'py') { shengScore += 3; shengList.push(p.title + '藏' + c.ss.name); }
      });
    });
    items.push({ name: '得生', desc: shengList.length ? '印星：' + shengList.join('、') : '无明显印星生扶', score: shengScore, detail: '印星生日主' });
    total += shengScore;

    /* 4. 得势（比劫）*/
    var shiScore = 0, shiList = [];
    chart.pillars.forEach(function (p, i) {
      if (i === 2) return;
      if (p.ss.key === 'bs' || p.ss.key === 'jc') { shiScore += 8; shiList.push(p.title + p.ss.name); }
      p.canggan.forEach(function (c) {
        if (c.ss.key === 'bs' || c.ss.key === 'jc') { shiScore += 3; shiList.push(p.title + '藏' + c.ss.name); }
      });
    });
    items.push({ name: '得势', desc: shiList.length ? '比劫：' + shiList.join('、') : '无比劫帮扶', score: shiScore, detail: '同党越多越强' });
    total += shiScore;

    /* 5. 克泄耗（反向扣分）*/
    var drain = 0, drainList = [];
    chart.pillars.forEach(function (p, i) {
      if (i === 2) return;
      var k = p.ss.key;
      var s = { qs: -9, zg: -7, sg: -7, ss: -6, pc: -6, zc: -5, py: 0, zy: 0, bs: 0, jc: 0 }[k] || 0;
      if (s) { drain += s; drainList.push(p.title + p.ss.name + '(' + s + ')'); }
    });
    items.push({ name: '克泄耗', desc: drainList.length ? drainList.join('、') : '耗身力量不明显', score: drain, detail: '官杀克、食伤泄、财星耗' });
    total += drain;

    var level;
    if (total >= 30) level = '身强';
    else if (total >= 10) level = '偏强';
    else if (total > -10) level = '中和';
    else if (total > -30) level = '偏弱';
    else level = '身弱';

    return {
      score: Math.round(total), level: level, items: items, roots: roots,
      comment: LEVEL_COMMENT[level]
    };
  }
  var LEVEL_COMMENT = {
    身强: '日主得令得地，承载力强。宜泄宜克——用食伤泄秀、财星耗身、官杀制身，顺势向外发挥。',
    偏强: '日主略强，能担财官。宜适度疏导，不宜再加重印比。',
    中和: '强弱均衡，五行流通较顺。此类命局不必硬套扶抑，顺着流通方向安排即可。',
    偏弱: '日主偏弱，承载力有限。宜印星生身、比劫帮扶，忌财官杀过重。',
    身弱: '日主失令少根，需印比撑持。若全局无根无生扶，需考虑是否入从格（另论）。'
  };

  /* ---------- 二、调候（《穷通宝鉴》十干逐月，120 条） ---------- */
  function analyzeTiaohou(chart) {
    var dm = chart.dayMaster.gan;      // 日干索引
    var mz = chart.pillars[1].zhi;     // 月支索引
    var T = global.Tiaohou;
    var rule = T ? T.look(dm, mz) : null;
    var climate = T ? T.CLIMATE[mz] : '';
    var season = T ? T.SEASON[mz] : '';

    /* 兜底：数据缺失时退回季节法（不应发生，仅为保险） */
    if (!rule) {
      var cold = (mz === 0 || mz === 1 || mz === 11);
      var hot = (mz === 5 || mz === 6 || mz === 7);
      if (!cold && !hot) {
        return { needed: false, text: '生于春、秋之月，寒暖适中，一般不需专门调候，回到生克格局即可。' };
      }
      return {
        needed: true, urgent: true, element: cold ? '火' : '水', has: false,
        season: cold ? '冬' : '夏', climate: climate, month: ZHI[mz] + '月',
        detail: '', text: cold ? '冬月生人，需火暖局。' : '夏月生人，需水润泽。'
      };
    }

    var has = T.hasGan(chart, rule.main);       // 局中（含藏干）是否有这个调候用神
    var el = B.WX[GAN.indexOf(rule.main)];      // 用神的五行
    var urgent = (season === '冬' || season === '夏');

    var text = '《穷通宝鉴》：' + GAN[dm] + '（' + (T ? T.WX[dm] : WX[dm]) + '）日主生于'
      + ZHI[mz] + '月（' + climate + '），调候用神取「' + rule.main + '」(' + el + ')。'
      + rule.text + '。'
      + (has
        ? ' 局中（含藏干）已有「' + rule.main + '」，调候到位。'
        : ' 局中未见「' + rule.main + '」，调候不足——'
          + (urgent ? '此为寒暖燥湿之偏，调候为急，优先级常高于扶抑。'
                    : '所幸非寒暖极端之月，影响较冬夏为轻，但仍属缺憾。'));

    return {
      needed: true, urgent: urgent, element: el, main: rule.main, has: has,
      season: season, climate: climate, month: ZHI[mz] + '月',
      dayMaster: GAN[dm] + (T ? T.WX[dm] : WX[dm]),
      detail: rule.text, text: text
    };
  }

  /* ---------- 六亲与宫位 ---------- */
  /* 十神 → 六亲。male / female 不同则分列，相同则用 common */
  var LIUQIN = {
    zy: { common: '母亲、长辈、师长、学历文凭、庇护', note: '无正印则看偏印' },
    py: { common: '继母、庶母、偏门学问与技艺', note: '正统以外的一切「生我」之力' },
    zc: { male: '妻子、固定资产、稳定收入', female: '钱财、务实经营', note: '男命正财为正妻' },
    pc: { common: '父亲、投资经营、人脉资源、意外之财', note: '偏财为父，古今通用；无偏财看正财' },
    zg: { male: '女儿、职位、规则、名誉', female: '丈夫、职位、规则、名誉', note: '女命正官为正夫，无正官看七杀' },
    qs: { male: '儿子、压力、竞争、魄力', female: '偏夫、情人、压力、竞争', note: '男命七杀为儿子' },
    ss: { male: '才华表达、口福、技艺', female: '女儿、福寿、才艺、温和', note: '女命食神为女儿' },
    sg: { male: '才华、反叛、创意、技艺', female: '儿子、才华、傲气', note: '女命伤官为儿子' },
    bs: { male: '兄弟、同辈、朋友、竞争者', female: '姐妹、同辈、朋友、竞争者' },
    jc: { male: '姐妹、合作伙伴、分利者', female: '兄弟、合作伙伴、分利者' }
  };

  /* 四柱宫位：谁住在哪里 */
  var GONGWEI = {
    year: { name: '祖上宫', scope: '祖辈、根基、童年环境、与父母家族的缘分', age: '1–16 岁' },
    month: { name: '父母兄弟宫', scope: '父母、兄弟姐妹、青年环境、事业起步的平台', age: '17–32 岁' },
    day: { name: '夫妻宫', scope: '自己与配偶。日干是我，日支是配偶的位置', age: '33–48 岁' },
    hour: { name: '子女宫', scope: '子女、晚辈、晚年归宿、成果与输出', age: '49 岁以后' }
  };

  /* 取某十神在本命性别下的六亲含义 */
  function liuqinOf(key, sex) {
    var v = LIUQIN[key];
    if (!v) return { kin: '—', note: '' };
    var kin = v.common || (sex === 'M' ? v.male : v.female) || v.male || '';
    return { kin: kin, note: v.note || '' };
  }

  /* ---------- 三、格局 ---------- */
  var GE_NAME = { zg: '正官格', qs: '七杀格', zc: '正财格', pc: '偏财格', zy: '正印格', py: '偏印格', ss: '食神格', sg: '伤官格' };
  var SHUNYONG = {
    zg: { type: '顺用', like: '喜财生官、印护官', hate: '忌伤官克官、忌七杀混官（官杀混杂）' },
    zc: { type: '顺用', like: '喜食伤生财、官星护财', hate: '忌比劫夺财' },
    pc: { type: '顺用', like: '喜食伤生财、官星护财', hate: '忌比劫夺财、忌印星倒食' },
    zy: { type: '顺用', like: '喜官杀生印、比劫护印', hate: '忌财星破印' },
    ss: { type: '顺用', like: '喜比劫生食、财星泄秀', hate: '忌偏印夺食（枭神夺食）' },
    qs: { type: '逆用', like: '喜食伤制杀、印星化杀、合杀', hate: '忌财生杀而无制（杀重身轻）' },
    sg: { type: '逆用', like: '喜印制伤（伤官配印）、财星泄伤（伤官生财）', hate: '忌见正官（伤官见官）' },
    py: { type: '逆用', like: '喜财星制枭、比劫泄枭', hate: '忌食神被夺' },
    bs: { type: '逆用', like: '取财官食伤为用', hate: '比劫重重无情' },
    jc: { type: '逆用', like: '取财官食伤为用', hate: '劫财重重争财' }
  };

  function analyzeGeju(chart) {
    var dm = chart.dayMaster.gan;
    var mp = chart.pillars[1];
    var cgs = B.CANGGAN[mp.zhi];

    /* 天干是否透出某字（日干为「我」，不计） */
    function touGan(g) {
      return chart.pillars.filter(function (p) { return p.key !== 'day' && p.gan === g; }).length > 0;
    }

    var benqi = cgs[0].g;
    var benSS = B.shishen(dm, benqi);
    var isLuRen = benSS.key === 'bs' || benSS.key === 'jc';

    var chosen = null, reason = '', name = null, note = '';

    if (isLuRen) {
      /* 月令本气为比劫 —— 不入八格，判建禄 / 月刃，另寻财官食伤 */
      name = benSS.key === 'bs' ? '建禄格' : '月刃格';
      reason = '月令本气为' + benSS.name + '（与日主同气），不入八格。《子平真诠》：「建禄生提月，财官喜透天」，须另寻财官食伤为用。';
      var alt = null;
      chart.pillars.forEach(function (p) {
        if (p.key === 'day') return;
        var s2 = B.shishen(dm, p.gan);
        if (!alt && ['zg', 'qs', 'zc', 'pc', 'ss', 'sg'].indexOf(s2.key) >= 0) {
          alt = { ss: s2, from: p.title };
        }
      });
      note = alt
        ? ('天干' + alt.from + '见' + alt.ss.name + '透出，可兼取为用，称为「建禄用' + (alt.ss.name.replace('正', '').replace('偏', '') || alt.ss.name) + '」。')
        : '天干无财官食伤透出，须看地支能否成食伤生财或官杀制刃之势，或从旺另论。';
    } else {
      /* 1. 本气入八格 → 取本气（透干更佳，不透亦可以本气为格） */
      if (GE_NAME[benSS.key]) {
        chosen = benqi;
        reason = touGan(benqi) ? '月令本气透干，取其定格' : '月令本气为八格之神，虽未透干，仍以本气定格（力量在支）';
      }
      /* 2. 本气不透且非八格：退求中气 / 余气透干且成格者 */
      if (!chosen) {
        for (var i = 1; i < cgs.length; i++) {
          var s1 = B.shishen(dm, cgs[i].g);
          if (touGan(cgs[i].g) && GE_NAME[s1.key]) {
            chosen = cgs[i].g;
            reason = '本气未成八格，月令' + cgs[i].d + '气透干且入格，取其定格';
            break;
          }
        }
      }
      /* 3. 月令无可成格者：从天干另寻八格之神 */
      if (!chosen) {
        for (var k = 0; k < chart.pillars.length; k++) {
          var pk = chart.pillars[k];
          if (pk.key === 'day') continue;
          var s3 = B.shishen(dm, pk.gan);
          if (GE_NAME[s3.key]) { chosen = pk.gan; reason = '月令所藏无成格之神，改从' + pk.title + '透出的' + s3.name + '定格'; break; }
        }
      }
      if (!chosen) {
        name = '无明显正格';
        reason = '月令所藏与四柱天干皆未见八格之神，属于「不入格」的平常命局，须以扶抑、调候、刑冲合会综合论断';
      }
    }

    var ss = chosen !== null ? B.shishen(dm, chosen) : benSS;
    if (!name) name = GE_NAME[ss.key] || '无明显正格';

    var rule = SHUNYONG[ss.key] || { type: '—', like: '—', hate: '—' };

    /* 破格线索 */
    var broke = [];
    var allCG = [];
    chart.pillars.forEach(function (p) {
      allCG.push({ src: p.title, k: p.ss.key });
      p.canggan.forEach(function (c) { allCG.push({ src: p.title, k: c.ss.key }); });
    });
    function hasKey(k) { return allCG.some(function (x) { return x.k === k; }); }
    if (ss.key === 'zg') {
      if (hasKey('sg')) broke.push('伤官见官——正官格第一破格，主是非与职途波折');
      if (hasKey('qs')) broke.push('官杀混杂——贵气不清，宜合杀留官或去官留杀');
    }
    if (ss.key === 'zc' && hasKey('jc')) broke.push('劫财夺财——正财格遇劫，财来财去');
    if (ss.key === 'zy' && (hasKey('zc') || hasKey('pc'))) broke.push('财星破印——正印格遇旺财，学业贵人受损');
    if (ss.key === 'ss' && hasKey('py')) broke.push('枭神夺食——食神格遇偏印，才华与福气被压制');
    if (ss.key === 'sg' && hasKey('zg')) broke.push('伤官见官——伤官格最忌，主与权威冲突');
    if (ss.key === 'qs') {
      if (hasKey('ss') || hasKey('py')) broke.push('七杀有制化，反成大格（食伤制杀 / 印星化杀）');
      else broke.push('七杀无制：压力与小人之象，需岁运逢制化方安');
    }

    return {
      name: name, ss: ss, reason: reason, note: note,
      type: rule.type, like: rule.like, hate: rule.hate,
      broke: broke,
      isStandard: !!GE_NAME[ss.key]
    };
  }

  /* ---------- 四、用神 ---------- */
  function analyzeYongshen(chart, strength, tiaohou, geju) {
    var dmWx = WX[chart.dayMaster.gan];
    var ways = [];
    var lvl = strength.level;
    var strong = lvl === '身强' || lvl === '偏强';
    var weak = lvl === '身弱' || lvl === '偏弱';

    /* 调候：《穷通宝鉴》十干逐月。冬夏寒暖极端者为「急」，其余为常 */
    if (tiaohou.needed && !tiaohou.has) {
      ways.push({
        way: '调候', element: tiaohou.element,
        priority: tiaohou.urgent ? 1 : 2,
        text: ('生于' + tiaohou.month + '（' + tiaohou.climate + '），《穷通宝鉴》取「'
          + tiaohou.main + '」(' + tiaohou.element + ')为调候用神：' + tiaohou.detail + '。')
          + (tiaohou.urgent
            ? ' 此月寒暖燥湿偏差明显，调候为急，优先级高于扶抑。'
            : ' 此月寒暖非极端，重要程度略低于扶抑，但局中缺之终属不足。')
      });
    } else if (tiaohou.needed && tiaohou.has) {
      ways.push({
        way: '调候', element: tiaohou.element, priority: 5,
        text: '局中已有调候用神「' + tiaohou.main + '」，' + tiaohou.month + '（'
          + tiaohou.climate + '）的寒暖燥湿已经到位，不必再补。'
      });
    }
    /* 通关：两行交战 */
    var elems = {};
    chart.pillars.forEach(function (p) {
      elems[WX[p.gan]] = (elems[WX[p.gan]] || 0) + 1.5;
      elems[ZHI_WX[p.zhi]] = (elems[ZHI_WX[p.zhi]] || 0) + 1;
    });
    var pairs = [['金', '木', '水'], ['水', '火', '木'], ['火', '金', '土'], ['土', '水', '火'], ['木', '土', '金']];
    pairs.forEach(function (t) {
      if ((elems[t[0]] || 0) >= 2.5 && (elems[t[1]] || 0) >= 2.5) {
        ways.push({
          way: '通关', element: t[2], priority: 2,
          text: t[0] + t[1] + '交战势均力敌，取' + t[2] + '通关化解，转争斗为相生。'
        });
      }
    });
    /* 扶抑 */
    var di = WXLIST.indexOf(dmWx);
    var shengWo = WXLIST[(di + 4) % 5];   // 生我（印）
    var woSheng = WXLIST[(di + 1) % 5];   // 我生（食伤）
    var woKe = WXLIST[(di + 2) % 5];      // 我克（财）
    var keWo = WXLIST[(di + 3) % 5];      // 克我（官杀）

    if (strong || weak) {
      var fuEl, fuTxt;
      if (strong) {
        fuEl = woSheng;
        fuTxt = '身强宜抑宜泄：首选食伤（' + woSheng + '）泄秀发越，次取财星（' + woKe + '）耗身'
          + '、官杀（' + keWo + '）制身，使气势归于中和。';
      } else {
        fuEl = shengWo;
        fuTxt = '身弱宜扶宜生：首选印星（' + shengWo + '）生身，次取比劫（' + dmWx + '）帮扶分担攻伐，方能担起命中财官。';
      }
      ways.push({
        way: '扶抑', element: fuEl, priority: 3,
        optionGroups: strong
          ? [{ gs: '食伤泄秀', w: woSheng }, { gs: '财星耗身', w: woKe }, { gs: '官杀制身', w: keWo }]
          : [{ gs: '印星生身', w: shengWo }, { gs: '比劫帮扶', w: dmWx }],
        groupTitle: strong ? '身强宜抑宜泄' : '身弱宜扶宜生',
        text: fuTxt
      });
    } else {
      ways.push({ way: '扶抑', element: null, priority: 3, text: '中和之局，不必硬套扶抑，顺五行流通即为用。' });
    }
    /* 病药提示 */
    var counts = Object.keys(elems).map(function (k) { return { w: k, n: elems[k] }; }).sort(function (a, b) { return b.n - a.n; });
    if (counts[0] && counts[0].n >= 4) {
      ways.push({ way: '病药', element: null, priority: 4, text: '局中' + counts[0].w + '过旺为病，能制伏它的五行即为药（《神峰通考》：有病方为贵）。' });
    }

    ways.sort(function (a, b) { return a.priority - b.priority; });
    var primary = ways[0];

    /* 喜忌推算 */
    /* 喜忌推算：用神所在五行为喜，生用神者为次喜；泄、克用神者为忌 */
    var xi = [], ji = [];
    if (primary.element && WXLIST.indexOf(primary.element) >= 0) {
      var j0 = WXLIST.indexOf(primary.element);
      xi.push(primary.element);
      xi.push(WXLIST[(j0 + 4) % 5]);
      ji.push(WXLIST[(j0 + 1) % 5]);
      ji.push(WXLIST[(j0 + 3) % 5]);
    }
    return {
      primary: primary, ways: ways, elems: counts, xi: xi, ji: ji,
      caveat: '「用神」各家定义不同，此处按《子平真诠》月令格局为总纲、调候次之、扶抑再次的顺序给出。请与你选定的流派口径对照使用。'
    };
  }

  /* ---------- 五、综合批语 ---------- */
  function buildReading(chart, strength, tiaohou, geju, ys) {
    var lines = [];
    var dm = chart.dayMaster;
    var topSS = Object.keys(chart.ssStat).sort(function (a, b) { return chart.ssStat[b] - chart.ssStat[a]; });

    lines.push({
      t: '命局骨架',
      c: '日主' + GAN[dm.gan] + '（' + WX[dm.gan] + '），生于' + chart.monthOrder + '，' + strength.level
        + '（量化 ' + strength.score + ' 分）。' + strength.comment
    });
    if (topSS.length) {
      var t1 = SS_MEAN[topSS[0]];
      lines.push({
        t: '最重的力量',
        c: '局中' + t1.title + '最重（' + chart.ssStat[topSS[0]] + ' 处），' + t1.mean + '。' + t1.traits + '。'
      });
    }
    lines.push({ t: '格局定位', c: '定为「' + geju.name + '」（' + geju.ss.name + '，' + geju.type + '）：' + geju.reason + '。' + geju.note });
    lines.push({ t: '吉凶条件', c: geju.like + '；' + geju.hate + '。' });
    if (geju.broke.length) lines.push({ t: '格局警报', c: geju.broke.join('；') + '。' });
    lines.push({ t: '调候', c: tiaohou.text });
    lines.push({ t: '用神', c: '首选' + ys.primary.way + '用神' + (ys.primary.element ? '：' + ys.primary.element : '') + '。' + ys.primary.text });

    /* 刑冲合会 */
    var inter = B.analyzeInteractions(chart.pillars);
    if (inter.length) {
      inter.sort(function (a, b) { return b.weight - a.weight; });
      lines.push({
        t: '结构张力',
        c: inter.slice(0, 6).map(function (x) { return x.type + '·' + x.names + '（' + x.desc + '）'; }).join('；')
          + '。这些位置是大运流年最容易被引动的地方。'
      });
    }
    return lines;
  }

  /* ---------- 六、岁运 ---------- */
  function analyzeYun(chart, year) {
    var ln = B.liunian(chart, year);
    var dm = chart.dayMaster.gan;
    var cur = null;
    var age = year - chart.input.year;
    chart.dayun.list.forEach(function (d) {
      if (age >= d.startAge) cur = d;
    });
    var before = (cur === null);
    return {
      year: year, liunian: ln, dayun: cur, beforeQiYun: before,
      text: (before
        ? year + ' 年尚未起运（' + chart.dayun.years + ' 岁 ' + chart.dayun.months + ' 个月起运），一般以小运参看，此处从略。'
        : year + ' 年走' + cur.ganzhi + '大运（' + cur.startAge + '–' + (cur.startAge + 9) + ' 岁），流年' + ln.ganzhi
        + '，流年对日主为' + ln.ss.name + '。')
    };
  }

  function analyzeAll(chart) {
    var strength = analyzeStrength(chart);
    var tiaohou = analyzeTiaohou(chart);
    var geju = analyzeGeju(chart);
    var ys = analyzeYongshen(chart, strength, tiaohou, geju);
    var reading = buildReading(chart, strength, tiaohou, geju, ys);
    var inter = B.analyzeInteractions(chart.pillars);
    return {
      strength: strength, tiaohou: tiaohou, geju: geju, yongshen: ys,
      reading: reading, interactions: inter, SS_MEAN: SS_MEAN
    };
  }

  global.BaziInterp = {
    analyzeAll: analyzeAll, analyzeStrength: analyzeStrength, analyzeTiaohou: analyzeTiaohou,
    analyzeGeju: analyzeGeju, analyzeYongshen: analyzeYongshen, analyzeYun: analyzeYun,
    SS_MEAN: SS_MEAN, LEVEL_COMMENT: LEVEL_COMMENT,
    LIUQIN: LIUQIN, GONGWEI: GONGWEI, liuqinOf: liuqinOf
  };
})(window);
