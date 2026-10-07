"""SVG иконки из геометрии векторов Figma (без images API — у него жёсткий лимит на тарифе Starter).

usage: python3 scripts/figma/node2svg.py <node-id> [out.svg]
  Берёт /v1/files/{KEY}/nodes?ids=<id>&geometry=paths (кеш — .figma/nodes-<id>.json), собирает пути всех видимых
  векторов узла с их трансформациями относительно корня, заливки и обводки (strokeGeometry — уже контур обводки).
  Маски (isMask) не рисуются. Дальше — svg2tsx.py для React-компонента.
"""
from __future__ import annotations

import json, os, sys, urllib.parse, urllib.request

KEY = "2EemNmum4LHAE4hx14kjGU"
ROOT = os.path.join(os.path.dirname(__file__), "..", "..", ".figma")


def load(nid: str) -> dict:
    cache = os.path.join(ROOT, f"nodes-{nid.replace(':', '-')}.json")
    if not os.path.exists(cache):
        token = open(os.path.expanduser("~/.config/figma_token")).read().strip()
        url = f"https://api.figma.com/v1/files/{KEY}/nodes?ids={urllib.parse.quote(nid)}&geometry=paths"
        data = urllib.request.urlopen(urllib.request.Request(url, headers={"X-Figma-Token": token}), timeout=120).read()
        os.makedirs(ROOT, exist_ok=True)
        open(cache, "wb").write(data)
    return json.load(open(cache))["nodes"][nid]["document"]


def mul(a, b):
    """2×3 аффинные матрицы Figma [[a, c, e], [b, d, f]]: a·b."""
    return [
        [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1], a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2]],
        [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1], a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2]],
    ]


IDENT = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]


def color(paint) -> tuple[str, float] | None:
    if paint.get("visible") is False or paint.get("type") != "SOLID":
        return None
    c = paint["color"]
    hexc = "#%02X%02X%02X" % (round(c["r"] * 255), round(c["g"] * 255), round(c["b"] * 255))
    return hexc, c.get("a", 1) * paint.get("opacity", 1)


def num(v: float) -> str:
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def walk(node, m, out, root=False):
    if node.get("visible") is False or node.get("isMask"):
        return
    t = m if root else mul(m, node.get("relativeTransform", IDENT))
    op = node.get("opacity", 1)
    tr = f'matrix({num(t[0][0])} {num(t[1][0])} {num(t[0][1])} {num(t[1][1])} {num(t[0][2])} {num(t[1][2])})'
    if not root:
        for paints, geom in ((node.get("fills") or [], node.get("fillGeometry") or []), (node.get("strokes") or [], node.get("strokeGeometry") or [])):
            for p in paints:
                c = color(p)
                if not c:
                    continue
                for g in geom:
                    rule = ' fill-rule="evenodd"' if g.get("windingRule") == "EVENODD" else ""
                    alpha = c[1] * op
                    fo = f' fill-opacity="{num(alpha)}"' if alpha < 0.999 else ""
                    out.append(f'<path d="{g["path"]}" transform="{tr}" fill="{c[0]}"{fo}{rule}/>')
    for ch in node.get("children", []):
        walk(ch, t, out)


def main():
    nid = sys.argv[1]
    node = load(nid)
    w, h = node["size"]["x"], node["size"]["y"]
    out: list[str] = []
    walk(node, IDENT, out, root=True)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{num(w)}" height="{num(h)}" viewBox="0 0 {num(w)} {num(h)}" fill="none">\n' + "\n".join(out) + "\n</svg>\n"
    if len(sys.argv) > 2:
        open(sys.argv[2], "w").write(svg)
        print(sys.argv[2], len(out), "paths")
    else:
        print(svg)


if __name__ == "__main__":
    main()
