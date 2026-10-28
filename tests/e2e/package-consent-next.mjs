import { spawn, execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/** Runs byte-copied application source in an audit-owned checkout. No auth, route,
 * component or API mocks. Only Google font CSS is stubbed to avoid external IO.
 * The caller supplies an isolated real auth/consent API and local Chrome driver.
 */
export async function runConsentNextE2E({ clientRoot, apiOrigin, businessId, packageId,
  startAt, email, password, artifacts, openBrowser, verifyPersistence, setApiEnabled, setUiOrigin, holdAcceptance }) {
  const sandbox = await mkdtemp(join(tmpdir(), "bookly-consent-next-v1-"));
  const files = execFileSync("git", ["-C", clientRoot, "ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/);
  for (const name of new Set(files)) {
    if (name.startsWith(".env") || name.startsWith("node_modules/") || name.startsWith(".next/")) continue;
    const target = join(sandbox, name);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(clientRoot, name), target);
  }
  await symlink(resolve(clientRoot, "node_modules"), join(sandbox, "node_modules"), "junction");
  const mockFont = join(sandbox, "consent-test-font.cjs");
  await writeFile(mockFont, `module.exports=new Proxy({}, {get:()=>"@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 400; src: local('Arial'); }"});`);
  const children = [];
  const browsers = [];
  const stopped = new Set();
  function stop(child) {
    if (!child.pid || stopped.has(child.pid)) return;
    stopped.add(child.pid);
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === "win32") {
      try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); }
      catch (error) {
        try { process.kill(child.pid, 0); } catch { return; }
        throw error;
      }
    } else child.kill();
  }
  async function next(enabled, label) {
    const log = createWriteStream(join(artifacts, `next-${label}.log`));
    const child = spawn(process.execPath, [join(clientRoot, "node_modules/next/dist/bin/next"), "dev", sandbox, "--webpack", "--hostname", "127.0.0.1", "--port", "0"], {
      cwd: sandbox, windowsHide: true,
      env: { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", WATCHPACK_POLLING: "1000", CHOKIDAR_USEPOLLING: "true", NEXT_PUBLIC_API_BASE_URL: `${apiOrigin}/api/v1`, PACKAGE_CONSENT_UI_ENABLED: enabled ? "true" : "false", NEXT_FONT_GOOGLE_MOCKED_RESPONSES: mockFont },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    let output = "";
    child.stdout.on("data", (data) => { output += data; log.write(data); });
    child.stderr.on("data", (data) => { output += data; log.write(data); });
    child.on("close", () => log.end());
    for (let i = 0; i < 400; i++) {
      const port = output.match(/127\.0\.0\.1:(\d+)/)?.[1];
      if (port && /Ready in/.test(output)) {
        const origin = `http://127.0.0.1:${port}`;
        setUiOrigin(origin);
        return { origin, child };
      }
      if (child.exitCode !== null) throw new Error(`Next exited: ${output.slice(-6000)}`);
      await delay(100);
    }
    throw new Error(`Next readiness timeout: ${output.slice(-6000)}`);
  }
  const ensure = (ok, message) => { if (!ok) throw new Error(message); };
  const values = [];
  const path = `/customer/package-consent/${businessId}/${packageId}`;
  try {
    const server = await next(true, "enabled");
    // Compile the actual routes before driving navigation so development HMR does
    // not replace the root layout in the middle of the first auth redirect.
    for (const route of [path, "/select-role", "/customer", `/customer/password?email=${encodeURIComponent(email)}`]) {
      const response = await fetch(server.origin + route, { signal: AbortSignal.timeout(90000) });
      ensure(response.ok, `Next route compilation failed: ${route}`);
      await response.text();
    }
    await delay(1000);
    const page = await openBrowser(server.origin + path, artifacts);
    browsers.push(page);
    await page.waitFor("location.pathname === '/select-role'", 180000);
    ensure(!(await page.evaluate("document.body.innerText.includes('Exact Package terms')")), "Unauthenticated consent exposed");
    await page.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Continue').click()");
    await page.waitFor("location.pathname === '/customer' && document.querySelector('input[type=email]')", 180000);
    const fill = (selector, value) => `(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`;
    await page.evaluate(fill("input[type=email]", email));
    await page.evaluate("document.querySelector('form').requestSubmit()");
    await page.waitFor("location.pathname === '/customer/password' && document.querySelector('input[type=password]')", 180000);
    await page.evaluate(fill("input[type=password]", password));
    await page.evaluate("document.querySelector('form').requestSubmit()");
    await page.waitFor("location.pathname.includes('/customer/package-consent/') && Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Add Hair'))", 180000);
    values.push({ stage: "real-login-destination-recovered", path: await page.evaluate("location.pathname") });
    await verifyPersistence("passive");
    await page.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Add Hair')).click()");
    await page.waitFor("document.querySelector('select')");
    await page.evaluate("(()=>{const el=document.querySelector('select');el.value=el.options[1].value;el.dispatchEvent(new Event('change',{bubbles:true}));})()");
    const localDate = await page.evaluate(`(()=>{const d=new Date(${JSON.stringify(startAt)});const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());})()`);
    await page.evaluate(fill("input[type=date]", localDate.slice(0, 10)));
    await page.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Find available times')).click()");
    await page.waitFor("document.querySelector('[aria-label=\"Package appointment time\"]').options.length > 1");
    await page.evaluate(`(()=>{const s=document.querySelector('[aria-label="Package appointment time"]');s.value=${JSON.stringify(startAt)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await page.evaluate("document.querySelector('form').requestSubmit()");
    await page.waitFor("document.querySelector('[aria-label=\"Exact Package terms\"]')", 180000);
    const text = await page.evaluate("document.querySelector('[aria-label=\"Exact Package terms\"]').textContent");
    await verifyPersistence("presented", text);
    ensure(await page.evaluate("!document.querySelector('input[type=checkbox]').checked && Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Accept these terms')).disabled"), "Checkbox is not initially unchecked/disabled");
    ensure(text.includes("PLUS") && text.includes("EUR 25.00") && text.includes("expiry alone never charges money"), "Required canonical terms omitted");
    ensure(!(await page.evaluate("Boolean(document.querySelector('[aria-label=\"Exact Package terms\"] script'))")), "Terms interpreted as HTML");
    const beforeReviewReload = await page.evaluate("performance.timeOrigin");
    await page.command("Page.reload");
    await page.waitFor(`performance.timeOrigin !== ${beforeReviewReload} && document.readyState === 'complete' && document.querySelector('input[type=checkbox]')`, 180000);
    await verifyPersistence("presented-reload", await page.evaluate("document.querySelector('[aria-label=\"Exact Package terms\"]').textContent"));
    ensure(await page.evaluate("!document.querySelector('input[type=checkbox]').checked"), "Review reload carried implicit agreement");
    await page.evaluate("Date.now = () => 0");
    const reviewUrl = await page.evaluate("location.href");
    // Same Chrome profile/cookie jar; a separate target has independent JS/query memory.
    const target = await fetch(`http://127.0.0.1:${page.debuggingPort}/json/new?${encodeURIComponent(reviewUrl)}`, { method: "PUT" }).then(r => r.json());
    const tab = await attach(target.webSocketDebuggerUrl);
    browsers.push(tab);
    await tab.waitFor("document.querySelector('[aria-label=\"Exact Package terms\"]')", 180000);
    ensure(await tab.evaluate("!document.querySelector('input[type=checkbox]').checked"), "Sibling tab implicitly accepted");
    await page.evaluate("document.querySelector('input[type=checkbox]').focus()");
    await page.press("Space");
    await page.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Accept these terms')).focus()");
    holdAcceptance(true);
    await page.press("Enter");
    await page.waitFor("document.body.innerText.includes('Recording acceptance')");
    ensure(await page.evaluate("document.querySelector('input[type=checkbox]').disabled && Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Recording acceptance')).disabled"), "Pending controls are not disabled");
    await page.evaluate("document.querySelector('form').requestSubmit()");
    holdAcceptance(false);
    await page.waitFor("document.body.innerText.includes('Terms accepted')");
    await verifyPersistence("accepted");
    await tab.evaluate("document.querySelector('input[type=checkbox]').click();document.querySelector('form').requestSubmit()");
    await tab.waitFor("document.querySelector('[role=alert]')");
    ensure(!(await tab.evaluate("document.body.innerText.includes('Terms accepted')")), "Conflicting tab reported success");
    const tabOrigin = await tab.evaluate("performance.timeOrigin");
    await tab.command("Page.reload");
    await tab.waitFor(`performance.timeOrigin !== ${tabOrigin} && document.readyState === 'complete' && document.body.innerText.includes('Terms accepted')`, 180000);
    const pageOrigin = await page.evaluate("performance.timeOrigin");
    await page.command("Page.reload");
    await page.waitFor(`performance.timeOrigin !== ${pageOrigin} && document.readyState === 'complete' && document.body.innerText.includes('Terms accepted')`, 180000);
    ensure(await page.evaluate("document.body.innerText.includes('No Package purchase has been made')"), "Purchase success misreported");
    await verifyPersistence("reloaded");
    await page.screenshot(390, "next-consent-mobile.png");
    values.push({ stage: "same-family-tabs-conflict-reload", result: "PASS", clientClock: "Date.now=0", duplicatePendingSubmit: "attempted" });
    setApiEnabled(false);
    await page.command("Page.navigate", { url: server.origin + path });
    await page.waitFor("document.querySelector('[role=alert]')", 180000);
    ensure(!(await page.evaluate("Boolean(document.querySelector('input[type=checkbox]'))")), "API gate was bypassed");
    stop(server.child);
    await delay(500);
    const off = await next(false, "disabled");
    const offResponse = await fetch(off.origin + path);
    ensure((await offResponse.text()).includes("Package terms review is unavailable"), "UI gate off exposed review");
    values.push({ stage: "both-independent-gates", result: "PASS" });
    await writeFile(join(artifacts, "next-e2e-results.json"), JSON.stringify({ sandbox, values }, null, 2));
    return { sandbox, values };
  } catch (error) {
    await writeFile(join(artifacts, "next-e2e-failure.json"), JSON.stringify({ values, error: String(error), stack: error.stack }, null, 2));
    throw error;
  } finally {
    for (const browser of browsers.reverse()) browser.close();
    // Only PIDs returned by our own spawn; tree termination includes Next's own worker.
    for (const child of children) stop(child);
  }
}

async function attach(url) {
  if (!url.startsWith("ws://127.0.0.1:")) throw new Error("Nonlocal browser target");
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", event => { const data = JSON.parse(String(event.data)); const promise = pending.get(data.id); if (promise) { pending.delete(data.id); if (data.error) promise.reject(new Error(data.error.message)); else promise.resolve(data.result); } });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  await command("Page.enable");
  await command("Network.enable");
  await command("Network.setBlockedURLs", { urls: ["https://*", "http://*.com/*", "http://*.net/*", "http://*.org/*"] });
  const evaluate = async expression => { const r = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  return { command, evaluate, waitFor: async (expression, timeout = 10000) => { const end = Date.now() + timeout; while (Date.now() < end) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); } throw new Error(`Tab timeout: ${await evaluate("document.body.innerText")}`); }, close: () => socket.close() };
}
