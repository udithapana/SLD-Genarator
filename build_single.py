"""Bundle index.html + css + js into ONE self-contained file: dist/index.html
Usage: python tools/build_single.py"""
import re, os
h = open('index.html', encoding='utf-8').read()
h = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: '<style>' + open(m.group(1), encoding='utf-8').read() + '</style>', h)
h = re.sub(r'<script src="([^"]+)"></script>', lambda m: '<script>' + open(m.group(1), encoding='utf-8').read().replace('</script>', '<\\/script>') + '</script>', h)
os.makedirs('dist', exist_ok=True)
open('dist/index.html', 'w', encoding='utf-8').write(h)
print('dist/index.html', len(h) // 1024, 'KB')
