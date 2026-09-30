"""Compact, precise dump of a Figma frame: coords relative to the frame root.
usage: dump.py <node-id> [maxdepth]   -> prints tree; icons collapsed (marked ICON)"""
import json, os, sys
d = json.load(open(os.environ.get('FIGMA_JSON', os.path.join(os.path.dirname(__file__), '..', '..', '.figma', 'file.json'))))
idx = {}
def index(n):
    idx[n['id']] = n
    for c in n.get('children', []): index(c)
index(d['document'])
VEC = {'VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'LINE', 'STAR', 'REGULAR_POLYGON', 'RECTANGLE'}
def hexc(c, o=1):
    a = c.get('a', 1) * o
    h = '#%02X%02X%02X' % (round(c['r'] * 255), round(c['g'] * 255), round(c['b'] * 255))
    return h if a >= 0.995 else f"{h}/{a:.2f}"
def is_icon(n):
    if n['type'] in ('TEXT',): return False
    bb = n.get('absoluteBoundingBox') or {}
    if not bb or bb.get('width', 999) > 72 or bb.get('height', 999) > 72: return False
    ok = [True]
    def w(m):
        if m.get('visible') is False: return
        if m['type'] == 'TEXT': ok[0] = False
        for f in m.get('fills', []) or []:
            if f.get('type') == 'IMAGE': ok[0] = False
        if m is not n and m['type'] not in VEC | {'GROUP', 'FRAME', 'INSTANCE', 'COMPONENT'}: ok[0] = False
        for c in m.get('children', []): w(c)
    w(n)
    has_vec = any(True for _ in iter_vec(n))
    return ok[0] and has_vec and n['type'] not in ('RECTANGLE', 'ELLIPSE', 'LINE') 
def iter_vec(n):
    for c in n.get('children', []):
        if c['type'] in ('VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'REGULAR_POLYGON'): yield c
        else: yield from iter_vec(c)
def paints(ps):
    out = []
    for f in ps or []:
        if f.get('visible') is False: continue
        t = f['type']
        if t == 'SOLID': out.append(hexc(f['color'], f.get('opacity', 1)))
        elif t == 'IMAGE': out.append(f"IMG({f.get('imageRef','')[:10]} {f.get('scaleMode')})")
        elif t.startswith('GRADIENT'):
            out.append(t[9:13] + '(' + ','.join(hexc(s['color']) + '@' + str(round(s['position'], 2)) for s in f['gradientStops']) + ')')
    return out
icons = []
def fmt(n, ox, oy):
    bb = n.get('absoluteBoundingBox') or {}
    x = round(bb.get('x', 0) - ox, 1); y = round(bb.get('y', 0) - oy, 1)
    w = round(bb.get('width', 0), 1); h = round(bb.get('height', 0), 1)
    s = f"{n['type'][:4]} '{n['name'][:40]}' @{x:g},{y:g} {w:g}x{h:g}"
    if n.get('layoutMode') and n['layoutMode'] != 'NONE':
        s += f" AL[{n['layoutMode'][0]} gap={n.get('itemSpacing',0):g} pad={n.get('paddingTop',0):g},{n.get('paddingRight',0):g},{n.get('paddingBottom',0):g},{n.get('paddingLeft',0):g} {n.get('primaryAxisAlignItems','')[:3]}/{n.get('counterAxisAlignItems','')[:3]}]"
    f = paints(n.get('fills'))
    if f and n['type'] != 'TEXT': s += ' bg=' + '+'.join(f)
    st = paints(n.get('strokes'))
    if st: s += f" border={'+'.join(st)}/{n.get('strokeWeight',1):g}{'' if n.get('strokeAlign')=='INSIDE' else ':'+str(n.get('strokeAlign','')[:3])}" + (f" dash={n['strokeDashes']}" if n.get('strokeDashes') else '')
    if n.get('rectangleCornerRadii') and len(set(n['rectangleCornerRadii'])) > 1: s += f" r={n['rectangleCornerRadii']}"
    elif n.get('cornerRadius'): s += f" r={n['cornerRadius']:g}"
    for e in n.get('effects', []) or []:
        if e.get('visible', True) and 'color' in e:
            s += f" {e['type'][:4]}({e['offset']['x']:g},{e['offset']['y']:g},{e['radius']:g},{e.get('spread',0):g},{hexc(e['color'])})"
        elif e.get('visible', True): s += f" {e['type']}({e.get('radius')})"
    if n.get('opacity', 1) < 1: s += f" op={n['opacity']:.2f}"
    if n['type'] == 'TEXT':
        st = n.get('style', {})
        txt = n.get('characters', '').replace('\n', '⏎')
        s += f" \"{txt[:140]}\" {st.get('fontFamily')} {st.get('fontWeight')} {st.get('fontSize'):g}/{round(st.get('lineHeightPx',0),1):g}"
        if st.get('letterSpacing'): s += f" ls={st['letterSpacing']:g}"
        if st.get('textAlignHorizontal') not in (None, 'LEFT'): s += f" {st['textAlignHorizontal'][:3]}"
        if st.get('textDecoration'): s += f" {st['textDecoration']}"
        if st.get('textCase'): s += f" {st['textCase']}"
        s += ' c=' + '+'.join(paints(n.get('fills')))
        ov = n.get('styleOverrideTable') or {}
        if ov:
            parts = []
            for k, v in ov.items():
                p = []
                if 'fontWeight' in v: p.append(f"w{v['fontWeight']}")
                if 'fontSize' in v: p.append(f"s{v['fontSize']:g}")
                if 'fills' in v: p.append('c' + '+'.join(paints(v['fills'])))
                if 'textDecoration' in v: p.append(v['textDecoration'])
                if p: parts.append(f"{k}:{','.join(p)}")
            # show which chars use overrides
            ids = n.get('characterStyleOverrides') or []
            segs = []; cur = None; buf = ''
            for ch, i in zip(n.get('characters', ''), ids + [0] * (len(n.get('characters', '')) - len(ids))):
                if i != cur:
                    if buf and cur: segs.append(f"[{cur}]{buf}")
                    buf = ''; cur = i
                buf += ch
            if buf and cur: segs.append(f"[{cur}]{buf}")
            if parts: s += ' OVR{' + ' '.join(parts) + '} ' + ' '.join(segs)[:160]
    return s
def walk(n, depth, ox, oy, maxd, out):
    if n.get('visible') is False: return
    if depth > 0 and is_icon(n):
        icons.append(n['id'])
        out.append('  ' * depth + 'ICON ' + n['id'] + ' ' + fmt(n, ox, oy)); return
    line = '  ' * depth + fmt(n, ox, oy)
    if n.get('clipsContent') and n['type'] != 'TEXT' and depth > 0: line += ' clip'
    out.append(line + f"  #{n['id']}")
    if depth >= maxd: return
    for c in n.get('children', []): walk(c, depth + 1, ox, oy, maxd, out)
if __name__ == '__main__':
    nid = sys.argv[1]; maxd = int(sys.argv[2]) if len(sys.argv) > 2 else 99
    root = idx[nid]; bb = root['absoluteBoundingBox']
    out = []; walk(root, 0, bb['x'], bb['y'], maxd, out)
    print('\n'.join(out))
    print('ICONS:', ','.join(icons), file=sys.stderr)
