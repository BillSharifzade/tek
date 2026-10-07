// Full-page screenshot via Chrome DevTools Protocol.
// usage: bun shot.ts <out.png> <url> [--width 1512] [--height 0(full)] [--wait 2500] [--auth email:pass] [--scroll N] [--js "code"]
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const out = args[0];
const url = args[1];
const opt = (k: string, d?: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const width = Number(opt("--width", "1512"));
const fixedH = Number(opt("--height", "0"));
const wait = Number(opt("--wait", "2500"));
const auth = opt("--auth");
const scroll = Number(opt("--scroll", "0"));
const js = opt("--js");
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "tekshot-"));
// Chrome: $CHROME, иначе стандартный путь на macOS или google-chrome-stable (Linux)
const chromeBin = process.env.CHROME || (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "google-chrome-stable");
const chrome = spawn(chromeBin, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--force-device-scale-factor=1", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${width},1000`, "about:blank",
], { stdio: "ignore" });

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
let wsUrl = "";
for (let i = 0; i < 100; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/list`);
    const j = (await r.json()) as { type: string; webSocketDebuggerUrl: string }[];
    const p = j.find((t) => t.type === "page");
    if (p) { wsUrl = p.webSocketDebuggerUrl; break; }
  } catch {}
  await sleep(100);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map<number, (v: any) => void>();
const events: ((m: any) => void)[] = [];
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && pending.has(m.id)) { pending.get(m.id)!(m); pending.delete(m.id); }
  else events.forEach((f) => f(m));
};
const send = (method: string, params: any = {}) =>
  new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const loaded = () => new Promise<void>((r) => { const f = (m: any) => { if (m.method === "Page.loadEventFired") r(); }; events.push(f); });

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
const origin = new URL(url).origin;
if (auth) {
  const [email, password] = auth.split(":");
  let l = loaded(); await send("Page.navigate", { url: origin + "/" }); await l;
  const api = process.env.API ?? "http://127.0.0.1:8181/api/v1";
  const r = await fetch(api + "/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: email, password }) });
  const j: any = await r.json();
  const stored = JSON.stringify({ access: j.access_token, refresh: j.refresh_token, user: j.user });
  // persist auth exactly like src/lib/auth-storage.ts
  await send("Runtime.evaluate", { expression: `localStorage.setItem("tek_auth_v1", ${JSON.stringify(stored)}); document.cookie = "tek_access=" + encodeURIComponent(${JSON.stringify(j.access_token)}) + "; Path=/; Max-Age=2592000; SameSite=Lax";` });
}
let l = loaded();
await send("Page.navigate", { url });
await l;
await sleep(wait);
if (js) { await send("Runtime.evaluate", { expression: js, awaitPromise: true }); await sleep(600); }
let h = fixedH;
if (!h) {
  const m = await send("Page.getLayoutMetrics");
  h = Math.ceil(m.result.cssContentSize?.height ?? m.result.contentSize.height);
}
await send("Emulation.setDeviceMetricsOverride", { width, height: fixedH || Math.min(h, 16000), deviceScaleFactor: 1, mobile: false });
if (scroll) { await send("Runtime.evaluate", { expression: `window.scrollTo(0, ${scroll})` }); }
await sleep(700);
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(out, width + "x" + h);
ws.close();
chrome.kill("SIGKILL");
process.exit(0);
