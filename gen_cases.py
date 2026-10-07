# -*- coding: utf-8 -*-
"""生成参考八字测试用例：用 lunar-python 独立算出四柱，供 JS 端交叉验证。
注意：此处输入的时间已是「真太阳时」（预先校正），因为 lunar-python 不做太阳时校正。
两种子时口径都输出：sect2=日柱不变/时柱按次日（默认），sect1=晚子时换日。
"""
import os, io, json, random
from lunar_python import Solar

BASE = os.path.dirname(os.path.abspath(__file__))

# (年,月,日,时,分, 说明)
CASES = [
    (1990, 5, 15, 14, 30, '常规'),
    (2024, 2, 4, 16, 0, '立春前 27 分'),
    (2024, 2, 4, 17, 0, '立春后 33 分'),
    (2000, 1, 1, 0, 30, '早子时'),
    (2000, 1, 1, 23, 30, '晚子时'),
    (1985, 6, 6, 12, 0, '芒种当日'),
    (1985, 6, 6, 11, 0, '芒种前一小时'),
    (1949, 10, 1, 15, 0, '国庆'),
    (1900, 3, 1, 8, 0, '支持下限'),
    (2100, 11, 20, 20, 0, '支持上限'),
    (2026, 4, 5, 2, 30, '清明前 40 分'),
    (2026, 4, 5, 3, 10, '清明后 30 分'),
    (1976, 7, 28, 3, 42, '唐山地震时刻'),
    (2008, 8, 8, 20, 0, '奥运开幕'),
    (1966, 1, 1, 1, 1, '随机边界'),
    (1999, 12, 31, 23, 59, '世纪之交'),
]

random.seed(42)
for _ in range(20):
    y = random.randint(1901, 2099)
    m = random.randint(1, 12)
    d = random.randint(1, 28)
    h = random.choice([0, 3, 7, 11, 13, 17, 21, 23])
    mi = random.randint(0, 59)
    CASES.append((y, m, d, h, mi, '随机'))

out = []
for (y, mo, d, h, mi, note) in CASES:
    row = {'in': [y, mo, d, h, mi], 'note': note}
    for sect in (2, 1):
        s = Solar.fromYmdHms(y, mo, d, h, mi, 0)
        lunar = s.getLunar()
        ec = lunar.getEightChar()
        ec.setSect(sect)
        try:
            yq = ec.getQiYun(True) if hasattr(ec, 'getQiYun') else None
        except Exception:
            yq = None
        row['sect%d' % sect] = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()]
    # 大运（用 sect2）
    s = Solar.fromYmdHms(y, mo, d, h, mi, 0)
    ec = s.getLunar().getEightChar()
    row['sex'] = {}
    for gender in (1, 2):  # 1男 2女
        row['sex'][str(gender)] = {}
        for s in (1, 2):   # sect: 1=一时辰折十日(古法), 2=三日折一岁(线性)
            s2 = Solar.fromYmdHms(y, mo, d, h, mi, 0)
            yun2 = s2.getLunar().getEightChar().getYun(gender, s)
            try:
                dy = yun2.getDaYun()
                row['sex'][str(gender)][str(s)] = {
                    'dayun': [x.getGanZhi() for x in dy[:5]],
                    'ages': [x.getStartAge() for x in dy[:5]],
                    'y': yun2.getStartYear(), 'm': yun2.getStartMonth(), 'd': yun2.getStartDay()
                }
            except Exception:
                row['sex'][str(gender)][str(s)] = {'dayun': [], 'ages': [], 'y': 0, 'm': 0, 'd': 0}
    out.append(row)

with io.open(os.path.join(BASE, 'cases.json'), 'w', encoding='utf-8') as f:
    f.write(json.dumps(out, ensure_ascii=False, indent=1))

print('生成 %d 条用例' % len(out))
for r in out[:8]:
    print(r['note'], r['in'], 'sect2=', r['sect2'], 'sect1=', r['sect1'])
