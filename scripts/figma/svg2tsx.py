"""svg2tsx.py <file.svg> <ComponentName> [--keep-colors]
Prints a React component. By default black/#000 fills & strokes become currentColor so the icon
inherits text color (hover → #000 etc.). Width/height preserved from Figma; override via props."""
import re, sys
src = open(sys.argv[1]).read(); name = sys.argv[2]; keep = '--keep-colors' in sys.argv
m = re.search(r'<svg([^>]*)>(.*)</svg>', src, re.S)
attrs, body = m.group(1), m.group(2).strip()
w = re.search(r'width="([\d.]+)"', attrs).group(1); h = re.search(r'height="([\d.]+)"', attrs).group(1)
vb = re.search(r'viewBox="([^"]+)"', attrs).group(1)
if not keep:
    body = re.sub(r'(fill|stroke)="(black|#000000|#000)"', r'\1="currentColor"', body)
# unique ids per component to avoid clashes between inlined svgs
ids = set(re.findall(r'id="([^"]+)"', body))
for i in ids:
    body = body.replace(f'id="{i}"', f'id="{name}_{i}"').replace(f'url(#{i})', f'url(#{name}_{i})')
def camel(mo):
    k = mo.group(1); parts = k.split('-'); return parts[0] + ''.join(p.title() for p in parts[1:]) + '='
body = re.sub(r'\b(clip-path|fill-rule|clip-rule|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit|stroke-dasharray|stop-color|stop-opacity|fill-opacity|stroke-opacity|color-interpolation-filters|flood-opacity)=', camel, body)
body = body.replace('xlink:href', 'href')
body = re.sub(r'\n\s*', '\n      ', body)
print(f'''export function {name}(props: React.SVGProps<SVGSVGElement>) {{
  return (
    <svg width={{{w}}} height={{{h}}} viewBox="{vb}" fill="none" aria-hidden="true" {{...props}}>
      {body}
    </svg>
  );
}}
''')
