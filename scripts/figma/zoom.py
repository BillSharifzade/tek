"""zoom.py figma.png site.png x0 y0 x1 y1 out.png [scale=2] -> stacked: figma / site / overlay(red=figma-only, cyan=site-only)"""
import sys
from PIL import Image, ImageChops, ImageOps
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB')
x0, y0, x1, y1 = map(int, sys.argv[3:7]); out = sys.argv[7]; sc = int(sys.argv[8]) if len(sys.argv) > 8 else 2
ca, cb = a.crop((x0, y0, x1, y1)), b.crop((x0, y0, x1, y1))
ga, gb = ImageOps.grayscale(ca), ImageOps.grayscale(cb)
# overlay: figma ink in red channel, site ink in green/blue → overlap = dark, mismatch = colored
inv_a, inv_b = ImageOps.invert(ga), ImageOps.invert(gb)
ov = Image.merge('RGB', (ImageOps.invert(inv_b), ImageOps.invert(inv_a), ImageOps.invert(inv_a)))
w, h = ca.size
st = Image.new('RGB', (w, h * 3 + 8), 'white')
st.paste(ca, (0, 0)); st.paste(cb, (0, h + 4)); st.paste(ov, (0, 2 * h + 8))
st = st.resize((w * sc, st.height * sc), Image.NEAREST)
st.save(out); print(out, st.size)
