# -*- coding: utf-8 -*-
"""把 index.html + src/* 打包成单文件 HTML，双击即用、不用装东西、不用联网"""
import re, os, io

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'src')

html = io.open(os.path.join(BASE, 'index.html'), encoding='utf-8').read()

# CSS 内联
css = io.open(os.path.join(SRC, 'style.css'), encoding='utf-8').read()
html = html.replace('<link rel="stylesheet" href="src/style.css">',
                    '<style>\n' + css + '\n</style>')

# JS 按引用顺序内联
order = ['lunar-data.js', 'jieqi-data.js', '00-lunar.js',
         '01-bazi-core.js', '02-bazi-interp.js', '03-app.js']
for f in order:
    js = io.open(os.path.join(SRC, f), encoding='utf-8').read()
    html = html.replace('<script src="src/%s"></script>' % f,
                        '<script>\n' + js + '\n</script>')

left = re.findall(r'<script src="[^"]+"', html)
if left:
    print('警告：仍有未内联引用', left)

# 单文件标记，便于识别是否是打包产物
html = html.replace('<title>', '<!-- 单文件版 · 由 build.py 自动生成，请勿直接编辑 -->\n<title>')

out = os.path.join(BASE, '八字排盘分析系统.html')
io.open(out, 'w', encoding='utf-8').write(html)
print('生成:', out, os.path.getsize(out), 'bytes')
