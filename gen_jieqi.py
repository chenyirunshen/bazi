# -*- coding: utf-8 -*-
"""生成 1900-2100 年二十四节气精确时刻（北京时间），供八字排盘 JS 端查表。
数据源：lunar-python（寿星万年历移植），精度到分钟。
"""
import os, io, json, datetime
from lunar_python import Solar

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'src')

# 二十四节气固定顺序（从小寒起，按年内自然顺序）
JIEQI = ['小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
         '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
         '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至']
IDX = {n: i for i, n in enumerate(JIEQI)}

START, END = 1900, 2100

# 用每月 1 日取节气表，去重后按时间排序
seen = {}
for y in range(START, END + 1):
    for m in range(1, 13):
        try:
            tbl = Solar.fromYmd(y, m, 1).getLunar().getJieQiTable()
        except Exception:
            continue
        for name, s in tbl.items():
            if name not in IDX:
                continue
            y0, mo, dd, hh, mi = (s.getYear(), s.getMonth(), s.getDay(), s.getHour(), s.getMinute())
            if y0 < START or y0 > END:
                continue
            key = (y0, IDX[name])
            if key in seen:
                continue
            seen[key] = [mo, dd, hh, mi]

# 按年组织
data = {}
for y in range(START, END + 1):
    rows = []
    for i in range(24):
        v = seen.get((y, i))
        if v:
            rows.append([i] + v)
    data[str(y)] = rows

out = os.path.join(SRC, 'jieqi-data.js')
payload = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
with io.open(out, 'w', encoding='utf-8') as f:
    f.write(u'/* 二十四节气精确时刻 1900-2100（北京时间），由 lunar-python(寿星万年历) 生成 */\n')
    f.write(u'/* 每年: [节气序号, 月, 日, 时, 分]，序号对应 JIEQI 数组下标 */\n')
    f.write(u'window.JIEQI_DATA=' + payload + u';\n')

print('生成:', out, os.path.getsize(out), 'bytes')
print('覆盖年份:', len(data), '总条数:', sum(len(v) for v in data.values()))

# ---- 抽样校验 ----
print('\n=== 抽样校验（应与权威万年历一致）===')
for y in [1900, 1949, 1985, 2000, 2024, 2026, 2100]:
    row = {r[0]: r for r in data[str(y)]}
    parts = []
    for name in ['立春', '清明', '立夏', '中秋' if False else '秋分', '冬至']:
        if name in IDX and IDX[name] in row:
            r = row[IDX[name]]
            parts.append('%s:%02d-%02d %02d:%02d' % (name, r[1], r[2], r[3], r[4]))
    print(y, ' | '.join(parts))
