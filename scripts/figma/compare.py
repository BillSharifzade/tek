"""compare.py <figma.png> <shot.png> <out_prefix> [chunk=900]
Writes side-by-side chunks (figma | site | diff) and prints mean abs diff per chunk."""
import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB'); pre = sys.argv[3]
ch = int(sys.argv[4]) if len(sys.argv) > 4 else 900
w = max(a.width, b.width); h = max(a.height, b.height)
A = Image.new('RGB', (w, h), 'white'); A.paste(a, (0, 0))
B = Image.new('RGB', (w, h), 'white'); B.paste(b, (0, 0))
D = ImageChops.difference(A, B)
print(f"figma {a.size} site {b.size}")
i = 0
for y in range(0, h, ch):
    box = (0, y, w, min(h, y + ch))
    ca, cb, cd = A.crop(box), B.crop(box), D.crop(box)
    px = list(cd.convert('L').getdata()); score = sum(px) / max(1, len(px))
    # overlay: figma 50% + site 50% makes misalignments visible as ghosting
    ov = Image.blend(ca, cb, 0.5)
    out = Image.new('RGB', (w * 2, box[3] - box[1]), 'white')
    out.paste(ca, (0, 0)); out.paste(cb, (w, 0))
    out.save(f"{pre}_{i:02d}_side.png"); ov.save(f"{pre}_{i:02d}_overlay.png")
    print(f"{pre}_{i:02d} y={y} diff={score:.2f}")
    i += 1
