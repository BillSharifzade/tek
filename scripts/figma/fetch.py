"""Download the Figma file JSON and PNG renders of frames into <repo>/.figma/ (gitignored).

usage: python3 scripts/figma/fetch.py [node-id ...]
  token: ~/.config/figma_token (personal access token, never commit it)
  no ids → all top-level frames of page 1. The images endpoint is rate limited: on 429 wait a minute.
"""
import json, os, sys, time, urllib.parse, urllib.request

KEY = "2EemNmum4LHAE4hx14kjGU"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", ".figma")
TOKEN = open(os.path.expanduser("~/.config/figma_token")).read().strip()


def get(url: str) -> bytes:
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"X-Figma-Token": TOKEN})
            return urllib.request.urlopen(req, timeout=120).read()
        except Exception as e:  # 429 / flaky TLS
            print("retry", attempt, e, file=sys.stderr)
            time.sleep(10 * (attempt + 1))
    raise SystemExit("figma api unavailable")


os.makedirs(os.path.join(OUT, "renders"), exist_ok=True)
data = get(f"https://api.figma.com/v1/files/{KEY}")
open(os.path.join(OUT, "file.json"), "wb").write(data)
doc = json.loads(data)
ids = sys.argv[1:] or [n["id"] for n in doc["document"]["children"][0]["children"]]
for i in range(0, len(ids), 20):
    chunk = ids[i : i + 20]
    q = urllib.parse.quote(",".join(chunk))
    imgs = json.loads(get(f"https://api.figma.com/v1/images/{KEY}?ids={q}&format=png&scale=1"))["images"]
    for nid, url in imgs.items():
        if url:
            open(os.path.join(OUT, "renders", nid.replace(":", "-") + ".png"), "wb").write(urllib.request.urlopen(url).read())
            print("render", nid)
