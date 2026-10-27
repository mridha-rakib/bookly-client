import { spawn, execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/** Actual Next source plus actual disposable auth/read API; no UI/HTTP authority mocks. */
export async function runPackageCustomerNext({ clientRoot, apiOrigin, businessId, packageId, name,
  email, password, artifacts, openBrowser, setUiOrigin }) {
  const sandbox = await mkdtemp(join(tmpdir(), "bookly-s6-next-"));
  const files = execFileSync("git", ["-C", clientRoot, "ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/);
  for (const file of new Set(files)) {
    if (file.split(/[\\/]/).some((part) => part.startsWith(".env"))) continue;
    const target = join(sandbox, file); await mkdir(dirname(target), { recursive: true }); await copyFile(join(clientRoot, file), target);
  }
  await symlink(join(clientRoot, "node_modules"), join(sandbox, "node_modules"), "junction");
  const font = join(sandbox, "offline-test-font.cjs");
  await writeFile(font, `module.exports=new Proxy({}, {get:()=>"@font-face { font-family: Poppins; font-style: normal; font-weight: 400; src: local(Arial); }"});`);
  const log = createWriteStream(join(artifacts, "next-customer.log"));
  const child = spawn(process.execPath, [join(clientRoot, "node_modules/next/dist/bin/next"), "dev", sandbox, "--webpack", "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: sandbox, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", WATCHPACK_POLLING: "1000", CHOKIDAR_USEPOLLING: "true", NEXT_PUBLIC_API_BASE_URL: `${apiOrigin}/api/v1`, NEXT_FONT_GOOGLE_MOCKED_RESPONSES: font },
  });
  let output = "", browser;
  child.stdout.on("data", (data) => { output += data; log.write(data); });
  child.stderr.on("data", (data) => { output += data; log.write(data); });
  child.on("close", () => log.end());
  const evidence = [];
  const ensure = (value, message) => { if (!value) throw Error(message); };
  try {
    let origin;
    for (let n = 0; n < 500; n++) { const port = output.match(/127\.0\.0\.1:(\d+)/)?.[1]; if (port && /Ready in/.test(output)) { origin = `http://127.0.0.1:${port}`; break; } if (child.exitCode !== null) throw Error(output); await delay(100); }
    if (!origin) throw Error(`Next did not start: ${output.slice(-4000)}`);
    setUiOrigin(origin);
    const detail = `/customer/package-consent/${businessId}/${packageId}`;
    for (const route of [detail, "/select-role", "/customer", `/customer/password?email=${encodeURIComponent(email)}`, `/venue?id=${businessId}`, "/customer/bookings?view=packages", "/customer/packages"]) {
      const response = await fetch(origin + route, { signal: AbortSignal.timeout(120000) }); ensure(response.ok, `Route compilation ${route}: ${response.status}`); await response.text();
    }
    browser = await openBrowser(origin + detail, artifacts);
    await browser.waitFor("location.pathname === '/select-role'", 120000);
    await browser.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Continue').click()");
    await browser.waitFor("location.pathname === '/customer' && document.querySelector('input[type=email]')", 120000);
    const fill = (selector, value) => `(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`;
    await browser.evaluate(fill("input[type=email]", email)); await browser.evaluate("document.querySelector('form').requestSubmit()");
    await browser.waitFor("location.pathname === '/customer/password' && document.querySelector('input[type=password]')", 120000);
    await browser.evaluate(fill("input[type=password]", password)); await browser.evaluate("document.querySelector('form').requestSubmit()");
    await browser.waitFor(`location.pathname.includes('/customer/package-consent/') && document.body.innerText.includes(${JSON.stringify(name)})`, 120000);
    ensure(await browser.evaluate("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Checkout unavailable') && b.disabled) && !document.querySelector('input[type=checkbox]')"), "Checkout/consent falsely enabled");
    const ctaChecks = [];
    for (const width of [1440, 390]) {
      await browser.command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
      const before = await browser.evaluate(`(()=>{const b=document.querySelector('button');b.scrollIntoView({block:'center'});window.__ctaClickCount=0;b.addEventListener('click',()=>window.__ctaClickCount++);const r=b.getBoundingClientRect(),s=getComputedStyle(b);return {buttons:document.querySelectorAll('button').length,disabled:b.disabled,background:s.backgroundColor,color:s.color,opacity:s.opacity,radius:s.borderRadius,cursor:s.cursor,x:r.x+r.width/2,y:r.y+r.height/2,requests:performance.getEntriesByType('resource').filter(r=>r.name.includes('/package-')).length}})()`);
      ensure(before.buttons === 1 && before.disabled, "Duplicate or enabled checkout CTA");
      ensure(before.color === "rgb(13, 13, 13)" && before.opacity === "1" && before.radius === "12px", "Disabled contrast/radius treatment changed");
      await browser.command("Input.dispatchMouseEvent", { type: "mouseMoved", x: before.x, y: before.y });
      await browser.command("Input.dispatchMouseEvent", { type: "mousePressed", x: before.x, y: before.y, button: "left", clickCount: 1 });
      await browser.command("Input.dispatchMouseEvent", { type: "mouseReleased", x: before.x, y: before.y, button: "left", clickCount: 1 });
      await browser.evaluate("document.querySelector('button').click();document.querySelector('button').focus()");
      await browser.press("Enter"); await browser.press("Space");
      const after = await browser.evaluate("({clicks:window.__ctaClickCount,focused:document.activeElement===document.querySelector('button'),disabled:document.querySelector('button').disabled,requests:performance.getEntriesByType('resource').filter(r=>r.name.includes('/package-')).length,opacity:getComputedStyle(document.querySelector('button')).opacity,overflow:document.documentElement.scrollWidth>innerWidth})");
      ensure(after.clicks === 0 && !after.focused && after.disabled && after.requests === before.requests && after.opacity === "1" && !after.overflow, "Disabled CTA responded to input or made a request");
      ctaChecks.push({ width, before, after, result: "PASS" });
    }
    await browser.screenshot(1440, "next-package-detail-desktop.png"); await browser.screenshot(390, "next-package-detail-mobile.png");
    evidence.push({ route: detail, status: "PASS", realAuthAndRead: true, purchaseData: false });
    const denial = await browser.evaluate(`(async()=>{const auth=await fetch(${JSON.stringify(apiOrigin + "/api/v1/auth/refresh")},{method:'POST',credentials:'include'}).then(r=>r.json());if(!auth.data?.accessToken)return {auth:false};const purchase=await fetch(${JSON.stringify(apiOrigin + "/api/v1/package-views/actions/purchase")},{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.data.accessToken},body:'{}'});return {auth:true,status:purchase.status};})()`);
    ensure(denial.auth && denial.status === 503, "Actual authenticated forbidden purchase was not denied");
    await browser.evaluate(`document.querySelector('a[href="/venue?id=${businessId}"]').click()`);
    await browser.waitFor("location.pathname === '/venue' && document.querySelector('#services [aria-label=\"Service filters\"]')", 120000);
    await browser.evaluate("Array.from(document.querySelectorAll('#services button')).find(b=>b.textContent.trim()==='Packages').click()");
    await browser.waitFor(`document.querySelector('#services').innerText.includes(${JSON.stringify(name)})`, 120000);
    const venueCta = await browser.evaluate("(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Book now');if(!b)throw Error('Venue Book now missing');const s=getComputedStyle(b);return {background:s.backgroundColor,color:s.color,radius:s.borderRadius,font:s.fontFamily,height:s.height}})()");
    ensure(venueCta.background === "rgb(46, 157, 167)" && venueCta.radius === "12px", "Authoritative Venue CTA changed");
    await writeFile(join(artifacts, "package-cta-checks.json"), JSON.stringify({ ctaChecks, venueCta, primaryTeal: "#2E9DA7", duplicateConsentButtonReplacedByStatus: true }, null, 2));
    await browser.screenshot(1440, "next-package-catalogue-desktop.png"); await browser.screenshot(390, "next-package-catalogue-mobile.png");
    evidence.push({ route: `/venue?id=${businessId}`, status: "PASS", realCatalogueRead: true, authenticatedPurchaseDenial: 503 });
    for (const route of ["/customer/bookings?view=packages", "/customer/packages"]) {
      await browser.command("Page.navigate", { url: origin + route });
      await browser.waitFor("document.body.innerText.includes('no purchased first-class multi-service packages')", 120000);
      const key = route.includes("bookings") ? "my-bookings-packages" : "my-packages";
      await browser.screenshot(1440, `next-${key}-desktop.png`); await browser.screenshot(390, `next-${key}-mobile.png`);
      evidence.push({ route, status: "PASS", data: "actual empty database reads" });
    }
    await writeFile(join(artifacts, "next-customer-results.json"), JSON.stringify({ sandbox, origin, evidence, externalFonts: "offline stub", serverStoppedAfterRun: true }, null, 2));
    return evidence;
  } catch (error) {
    await writeFile(join(artifacts, "next-customer-failure.json"), JSON.stringify({ evidence, error: String(error), stack: error.stack }, null, 2)); throw error;
  } finally {
    browser?.close();
    if (child.pid && child.exitCode === null) { try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch {} }
  }
}
