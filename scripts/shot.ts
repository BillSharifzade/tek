// Скриншот страницы через CDP (headless Chrome) с опциональной авторизацией и наполнением корзины.
// Usage: bun scripts/shot.ts <out.png> <url> [--auth client@tec.tj:Client1234] [--cart] [--w 1440] [--h 1200] [--wait 5000] [--debug] [--script "js"]
const args = process.argv.slice(2);
const out = args[0]; const url = args[1];
const opt = (k: string, d?: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const W = Number(opt("--w", "1440")), H = Number(opt("--h", "1200")), WAIT = Number(opt("--wait", "2500"));
const auth = opt("--auth"); const seedCart = args.includes("--cart"); const script = opt("--script");
const API = "http://127.0.0.1:8181/api/v1";
const port = 9222 + Math.floor(Math.random() * 500);
const profile = `${process.env.TMPDIR ?? "/tmp"}/tek-chrome-shot-${port}`;
const chrome = Bun.spawn(["google-chrome-stable", "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, "about:blank"], { stdout: "ignore", stderr: "ignore" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let wsUrl = "";
for (let i = 0; i < 50 && !wsUrl; i++) { try { const j = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); wsUrl = j.find((t: any) => t.type === "page")?.webSocketDebuggerUrl ?? ""; } catch { await sleep(200); } }
if (!wsUrl) { console.error("chrome did not start"); chrome.kill(); process.exit(1); }
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map<number, (v: any) => void>();
await new Promise((r) => (ws.onopen = r));
const debug = args.includes("--debug");
ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id && pending.has(m.id)) { pending.get(m.id)!(m); pending.delete(m.id); }
  if (debug && m.method === "Runtime.consoleAPICalled") console.log("[console." + m.params.type + "]", m.params.args.map((a: any) => a.value ?? a.description ?? JSON.stringify(a)).join(" "));
  if (debug && m.method === "Runtime.exceptionThrown") console.log("[exception]", m.params.exceptionDetails.text, m.params.exceptionDetails.exception?.description);
  if (debug && m.method === "Network.responseReceived" && m.params.response.url.includes("8181")) console.log("[net]", m.params.response.status, m.params.response.url);
  if (debug && m.method === "Network.loadingFailed") console.log("[netfail]", m.params.errorText, m.params.requestId); };
const send = (method: string, params: any = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr: string) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
const origin = new URL(url).origin;
if (auth || seedCart) {
  await send("Page.navigate", { url: origin + "/favicon.ico" }); await sleep(600);
  if (auth) {
    const [login, password] = auth.split(":");
    const r = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login, password }) })).json();
    if (!r.access_token) { console.error("login failed", r); }
    else {
      await evalJs(`localStorage.setItem('tek_auth_v1', ${JSON.stringify(JSON.stringify({ access: r.access_token, refresh: r.refresh_token, user: r.user }))}); document.cookie='tek_access=${r.access_token}; Path=/; Max-Age=86400; SameSite=Lax'; 'ok'`);
    }
  }
  if (seedCart) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const stored = await evalJs("localStorage.getItem('tek_auth_v1')");
    if (stored) headers.Authorization = `Bearer ${JSON.parse(stored).access}`;
    const list = await (await fetch(`${API}/catalog/products?category=kabelnye-lotki-dks&per_page=3`)).json();
    let token: string | null = null;
    for (const [i, p] of list.items.entries()) {
      const h = { ...headers }; if (token) h["X-Cart-Token"] = token;
      const c = await (await fetch(`${API}/cart/items`, { method: "POST", headers: h, body: JSON.stringify({ product_id: p.id, qty: i === 0 ? 3 : 1 }) })).json();
      token = c.cart_token ?? token;
    }
    if (token) await evalJs(`localStorage.setItem('tek_cart_token_v1', '${token}'); document.cookie='tek_cart=${token}; Path=/; Max-Age=86400; SameSite=Lax'; 'ok'`);
  }
}
await send("Page.navigate", { url }); await sleep(WAIT);
if (script) { await evalJs(script); await sleep(800); }
const { result } = await send("Page.getLayoutMetrics", {});
const m = await send("Page.getLayoutMetrics", {});
const full = m.result?.cssContentSize ?? m.result?.contentSize;
const height = Math.min(Math.ceil(full?.height ?? H), 6000);
await send("Emulation.setDeviceMetricsOverride", { width: W, height, deviceScaleFactor: 1, mobile: false });
await sleep(300);
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
await Bun.write(out, Buffer.from(shot.result.data, "base64"));
console.log(`saved ${out} ${W}x${height}`);
ws.close(); chrome.kill(); await sleep(200);
try { await Bun.$`rm -rf ${profile}`.quiet(); } catch {}
process.exit(0);
