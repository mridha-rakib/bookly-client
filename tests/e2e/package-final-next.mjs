import { spawn, execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/** Actual unmodified Next pages and HTTP reads; positive authority is closed before this starts. */
export async function runPackageFinalNext(options) {
  const { clientRoot, apiOrigin, businessId, packageId, progressId, initialBookingId, bookingId,
    expected, accounts, password, artifacts, openBrowser, setUiOrigin, revokeSupervisor } = options;
  const sandbox = await mkdtemp(join(tmpdir(), "bookly-s6-final-next-"));
  const files = execFileSync("git", ["-C", clientRoot, "ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/);
  for (const file of new Set(files)) {
    if (file.split(/[\\/]/).some((part) => part.startsWith(".env"))) continue;
    const target = join(sandbox, file); await mkdir(dirname(target), { recursive: true }); await copyFile(join(clientRoot, file), target);
  }
  await symlink(join(clientRoot, "node_modules"), join(sandbox, "node_modules"), "junction");
  const font = join(sandbox, "offline-font.cjs");
  await writeFile(font, `module.exports=new Proxy({}, {get:()=>"@font-face { font-family: Poppins; font-style: normal; font-weight: 400; src: local(Arial); }"});`);
  const log = createWriteStream(join(artifacts, "next-final.log"));
  const child = spawn(process.execPath, [join(clientRoot, "node_modules/next/dist/bin/next"), "dev", sandbox, "--webpack", "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: sandbox, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", WATCHPACK_POLLING: "1000", CHOKIDAR_USEPOLLING: "true", NEXT_PUBLIC_API_BASE_URL: `${apiOrigin}/api/v1`, NEXT_FONT_GOOGLE_MOCKED_RESPONSES: font },
  });
  let output = "", browser;
  child.stdout.on("data", (data) => { output += data; log.write(data); });
  child.stderr.on("data", (data) => { output += data; log.write(data); });
  child.on("close", () => log.end());
  const evidence = [], ctaInteractionChecks = [];
  const ensure = (value, message) => { if (!value) throw Error(message); };
  let stage = "start";
  try {
    let origin;
    for (let n = 0; n < 500; n++) { const port = output.match(/127\.0\.0\.1:(\d+)/)?.[1]; if (port && /Ready in/.test(output)) { origin = `http://127.0.0.1:${port}`; break; } if (child.exitCode !== null) throw Error(output); await delay(100); }
    if (!origin) throw Error(output.slice(-4000)); setUiOrigin(origin);
    const definition = `/customer/package-consent/${businessId}/${packageId}`;
    const owned = `/customer/packages/${progressId}?kind=first-class`;
    const booked = `/customer/bookings/view?id=${bookingId}`;
    for (const route of [definition, owned, booked, "/select-role", "/customer", `/customer/password?email=${accounts.customer}`, `/professional/password?email=${accounts.owner}`, "/professional/auth", "/customer/bookings?view=packages", "/customer/packages", `/venue?id=${businessId}`, "/business-dashboard?section=all-bookings", "/supervisor-dashboard", "/staff-dashboard"]) {
      const res = await fetch(origin + route, { signal: AbortSignal.timeout(120000) }); ensure(res.ok, `Compilation ${route}: ${res.status}`); await res.text();
    }
    browser = await openBrowser(origin + definition, artifacts);
    const evaluate = (expression) => browser.evaluate(expression);
    const wait = (expression) => browser.waitFor(expression, 120000);
    const navigate = async (path) => {
      const previous = await evaluate("performance.timeOrigin");
      await browser.command("Page.navigate", { url: origin + path });
      await wait(`performance.timeOrigin !== ${previous} && document.readyState === 'complete'`);
    };
    const click = async (text) => { await evaluate(`(()=>{const b=Array.from(document.querySelectorAll('button,a')).find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing control: '+${JSON.stringify(text)});b.click()})()`); };
    const fill = async (selector, value) => {
      // Chrome can lose document focus when another owned headless preview exits.
      // Retry only local keyboard entry; never repeat a submitted auth/API action.
      for (let attempt = 0; attempt < 3; attempt++) {
        await browser.command("Page.bringToFront");
        await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus();document.querySelector(${JSON.stringify(selector)}).select()`);
        await browser.command("Input.insertText", { text: value });
        await delay(100);
        if (await evaluate(`document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)}`)) return;
      }
      throw Error("Input did not retain keyboard text before submission");
    };
    const submit = () => evaluate("document.querySelector('form').requestSubmit()");
    const viewport = (width) => browser.command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    const shot = async (key, route, role) => {
      for (const width of [1440, 390]) {
        await viewport(width); await delay(250);
        if (await evaluate("Boolean(document.querySelector('aside img[alt=\"Toggle Sidebar\"]'))")) {
          const collapsed = await evaluate("document.querySelector('aside').getBoundingClientRect().width < 100");
          if ((width < 600) !== collapsed) {
            await evaluate("document.querySelector('aside img[alt=\"Toggle Sidebar\"]').closest('button').click()");
            await delay(350);
          }
          if (await evaluate("Array.from(document.querySelectorAll('aside button')).some(b=>b.textContent.trim()==='Logout')")) {
            await evaluate("document.querySelector('img[alt=\"User Profile\"]').parentElement.click()");
          }
          ensure(await evaluate("document.querySelector('[aria-label=\"Package venue settlement\"]')?.getBoundingClientRect().width >= 200 || !document.querySelector('[aria-label=\"Package venue settlement\"]')"), "Settlement compressed into an unreadable column");
        }
        const overflow = await evaluate("document.documentElement.scrollWidth>innerWidth");
        ensure(!overflow, `Horizontal overflow ${key} ${width}`);
        await browser.screenshot(width, `${key}-${width}.png`);
        evidence.push({ page: key, route, role, width, data: "actual persisted disposable F2/lifecycle records", status: "PASS", overflow, screenshot: `${key}-${width}.png` });
        if (["owner-booking-detail", "supervisor-booking-detail"].includes(key)) {
          await evaluate("document.querySelector('[aria-label=\"Package venue settlement\"]').scrollIntoView({block:'end'})");
          await delay(100);
          await browser.screenshot(width, `${key}-settlement-${width}.png`);
          evidence.push({ page: `${key}-settlement`, route, role, width, data: "actual persisted disposable F2/lifecycle records", status: "PASS", screenshot: `${key}-settlement-${width}.png` });
        }
      }
      await viewport(1440);
    };
    const login = async (account, professional = false) => {
      stage = `login-${account}`;
      await writeFile(join(artifacts, "browser-progress.json"), JSON.stringify({ stage }));
      await viewport(1440);
      const target = professional ? "/professional/auth" : "/customer";
      if (await evaluate("location.pathname") !== target) await navigate(target);
      await wait("document.querySelector('input[type=email]') && Object.keys(document.querySelector('form')).some(k=>k.startsWith('__reactProps'))");
      await writeFile(join(artifacts, "browser-progress.json"), JSON.stringify({ stage, step: "email-ready" }));
      await fill("input[type=email]", accounts[account]);
      await writeFile(join(artifacts, "browser-progress.json"), JSON.stringify({ stage, step: "email-filled" }));
      await submit();
      await writeFile(join(artifacts, "browser-progress.json"), JSON.stringify({ stage, step: "email-submitted" }));
      await wait("document.querySelector('input[type=password]') && Object.keys(document.querySelector('form')).some(k=>k.startsWith('__reactProps'))"); await fill("input[type=password]", password); await submit();
      await wait(professional ? "location.pathname.includes('dashboard')" : "!['/customer','/customer/password','/select-role'].includes(location.pathname)");
    };
    const menu = async () => {
      await wait("document.querySelector('img[alt=\"User Avatar\"]')");
      await evaluate("document.querySelector('img[alt=\"User Avatar\"]').closest('button').click()");
    };
    // Logout keeps an intent-scoped pointer plus a matching resolved receipt for cross-tab safety.
    // Observe that existing protocol; never clear or replace authentication storage in this test.
    const logoutResolved = "(()=>{const raw=localStorage.getItem('bookly:logout-pending');if(!raw)return true;const intent=JSON.parse(raw);return localStorage.getItem('bookly:logout-resolved:'+intent.id)===JSON.stringify({familyId:intent.familyId})})()";
    const customerLogout = async () => {
      await viewport(1440); await menu(); await click("Logout");
      await wait(`location.pathname === '/select-role' && ${logoutResolved}`);
    };
    const managementLogout = async () => {
      await viewport(1440);
      if (!await evaluate("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Logout')")) {
        await evaluate("document.querySelector('img[alt=\"User Profile\"]').parentElement.click()");
      }
      await click("Logout");
      await wait(`location.pathname === '/professional/auth' && ${logoutResolved}`);
    };
    const authorizedRead = async (url) => evaluate(`(async()=>{const auth=await fetch(${JSON.stringify(apiOrigin + "/api/v1/auth/refresh")},{method:'POST',credentials:'include'}).then(r=>r.json());const r=await fetch(${JSON.stringify(apiOrigin + "/api/v1" + url)},{credentials:'include',headers:{Authorization:'Bearer '+auth.data.accessToken}});return {status:r.status,body:await r.json()}})()`);
    const deniedAction = async () => evaluate(`(async()=>{const auth=await fetch(${JSON.stringify(apiOrigin + "/api/v1/auth/refresh")},{method:'POST',credentials:'include'}).then(r=>r.json());const r=await fetch(${JSON.stringify(apiOrigin + "/api/v1/package-views/actions/purchase")},{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.data.accessToken},body:'{}'});return r.status})()`);
    await wait("location.pathname === '/select-role'");
    await click("Continue");
    await wait("location.pathname === '/customer' && document.querySelector('input[type=email]')");
    stage = "customer"; await login("customer");
    await navigate(definition); await wait("document.body.innerText.includes('Checkout unavailable')");
    ensure(await evaluate("document.querySelector('button').disabled && document.querySelectorAll('button').length===1 && getComputedStyle(document.querySelector('button')).color==='rgb(13, 13, 13)'"), "Approved CTA changed");
    for (const width of [1440, 390]) {
      await viewport(width);
      const before = await evaluate("(()=>{const b=document.querySelector('button');b.scrollIntoView({block:'center'});window.__disabledClicks=0;b.addEventListener('click',()=>window.__disabledClicks++);const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,requests:performance.getEntriesByType('resource').filter(r=>r.name.includes('/package-views')).length}})()");
      await browser.command("Input.dispatchMouseEvent", { type: "mousePressed", x: before.x, y: before.y, button: "left", clickCount: 1 });
      await browser.command("Input.dispatchMouseEvent", { type: "mouseReleased", x: before.x, y: before.y, button: "left", clickCount: 1 });
      await evaluate("document.querySelector('button').click();document.querySelector('button').focus()");
      await browser.press("Enter"); await browser.press("Space");
      const after = await evaluate("({clicks:window.__disabledClicks,focused:document.activeElement===document.querySelector('button'),disabled:document.querySelector('button').disabled,requests:performance.getEntriesByType('resource').filter(r=>r.name.includes('/package-views')).length,radius:getComputedStyle(document.querySelector('button')).borderRadius})");
      ensure(after.clicks === 0 && !after.focused && after.disabled && after.requests === before.requests && after.radius === "12px", "Disabled CTA responded to interaction");
      ctaInteractionChecks.push({ width, before, after, status: "PASS" });
    }
    await shot("package-definition", definition, "CUSTOMER");
    ensure(await deniedAction() === 503, "Shipped purchase denial lost");
    await click("← Back to venue"); await wait("document.querySelector('#services [aria-label=\"Service filters\"]')");
    await click("Packages"); await wait(`document.querySelector('#services').innerText.includes(${JSON.stringify(expected.name)})`);
    ensure(await evaluate("document.querySelector('#services').firstElementChild.getAttribute('aria-label')==='Service filters'"), "Approved filters moved");
    await shot("venue-services", `/venue?id=${businessId}`, "CUSTOMER");
    stage = "menu-list"; await menu(); await click("My Packages");
    await wait("location.pathname==='/customer/bookings' && location.search.includes('view=packages') && document.body.innerText.includes('View sessions and balances')");
    await shot("my-bookings-packages", "/customer/bookings?view=packages", "CUSTOMER");
    await click("View sessions and balances"); await wait("document.body.innerText.includes('Session history')");
    stage = "owned-detail";
    const actualCounters = await evaluate("Array.from(document.querySelectorAll('section[aria-label]')).filter(s=>s.querySelector('dl')).map(s=>({name:s.querySelector('h4').textContent,counters:Array.from(s.querySelectorAll('dl>div')).map(d=>({label:d.querySelector('dt').textContent,value:Number(d.querySelector('dd').textContent)}))}))");
    for (const item of expected.items) {
      const actual = actualCounters.find((row) => row.name === item.name); ensure(Boolean(actual), `Item missing ${item.name}`);
      for (const key of ["total", "remaining", "scheduled", "completed", "forfeited", "expired"]) ensure(actual.counters.find((c) => c.label.toLowerCase() === key)?.value === item[key], `Counter mismatch ${item.name} ${key}`);
    }
    ensure(await evaluate("document.body.innerText.includes('Original initial appointment') && document.body.innerText.includes('Later redeemed appointment') && document.body.innerText.includes('Group · One credit = one participant / seat') && document.body.innerText.includes('Add-ons €5.00')"), "Owned roles/dues/Group omitted");
    await shot("owned-package-detail", owned, "CUSTOMER");
    const redemptionSection = await evaluate(`(()=>{const link=Array.from(document.querySelectorAll('a')).find(a=>a.getAttribute('href')===${JSON.stringify(booked)});if(!link)throw Error('Booking link missing');link.click();return true})()`); ensure(redemptionSection, "Navigation absent");
    await wait("document.body.innerText.includes('Later redeemed Package appointment')");
    ensure(await evaluate("document.body.innerText.includes('Independent session amount') && document.body.innerText.includes('Cancellation unavailable')"), "Booking financial/action context missing");
    await shot("customer-booking-detail", booked, "CUSTOMER");
    await navigate(`/customer/bookings/view?id=${initialBookingId}`); await wait("document.body.innerText.includes('Original initial Package appointment')");
    await shot("initial-customer-booking", `/customer/bookings/view?id=${initialBookingId}`, "CUSTOMER");
    await navigate("/customer/packages"); await wait("document.body.innerText.includes('View sessions and balances')"); await shot("my-packages", "/customer/packages", "CUSTOMER");
    const own = await authorizedRead(`/package-views/owned/${progressId}`); ensure(own.status === 200 && own.body.data.hasMore === false, "Owned identity/pagination mismatch");
    ensure(!/clientSecret|providerPaymentIntentId|sessionFamilyId|challenge|intentHash/.test(JSON.stringify(own.body)), "Sensitive claim leaked");
    await customerLogout(); await login("other"); await navigate("/customer/bookings?view=packages");
    await wait("document.body.innerText.includes('no purchased first-class')");
    ensure(!await evaluate(`document.body.innerText.includes(${JSON.stringify(expected.name)})`), "Account-switch cache leakage");
    ensure((await authorizedRead(`/package-views/owned/${progressId}`)).status === 404, "Foreign Customer adopted progress");
    await navigate(owned); await wait("document.querySelector('[role=alert]')"); await shot("foreign-customer-denied", owned, "OTHER_CUSTOMER");
    // The protected error page has no Navbar; use the actual shared listing to sign out.
    await navigate("/customer/packages"); await wait("document.body.innerText.includes('no purchased first-class')"); await customerLogout();
    const management = async (role) => {
      await login(role, true); stage = `management-${role}`;
      if (role === "owner") await navigate("/business-dashboard?section=all-bookings");
      else { await wait("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='All Bookings')"); await click("All Bookings"); }
      await wait("document.querySelector('input[placeholder=\"Search by client or reference...\"]')");
      const list = await authorizedRead(`/businesses/${businessId}/bookings`); ensure(list.status === 200, "Management list denied");
      const rows = list.body.data.bookings ?? list.body.data.items;
      const selected = rows?.find((b) => b.id === bookingId); ensure(selected, "Redeemed Booking absent from management list");
      await fill("input[placeholder=\"Search by client or reference...\"]", selected.reference);
      await wait("document.querySelectorAll('tbody tr').length===1 && document.querySelector('tbody').innerText.includes('Action')");
      await evaluate("Array.from(document.querySelectorAll('tbody button')).find(b=>b.textContent.trim()==='Action').click()"); await click("View details");
      await wait("document.querySelector('[aria-label=\"Package venue settlement\"]')");
      ensure(await evaluate(`document.querySelector('[aria-label="Package venue settlement"]').innerText.includes(${JSON.stringify(expected.originBookingId)}) && document.querySelector('[aria-label="Package venue settlement"]').innerText.includes('Later redeemed appointment')`), "Permanent origin/session role absent");
      ensure(await evaluate("Array.from(document.querySelectorAll('[aria-label=\"Package venue settlement\"] button')).every(b=>b.disabled)"), "Settlement mutation enabled");
      const financial = await authorizedRead(`/package-views/settlement/${businessId}/${bookingId}`);
      ensure(financial.status === 200 && financial.body.data.purchaseFinancials.outstandingBalanceCents === expected.purchaseFinancials.outstandingBalanceCents && financial.body.data.session.booking.addonsSubtotalCents === 500, "Original versus session finance mismatch");
      await shot(`${role}-booking-detail`, role === "owner" ? "/business-dashboard?section=all-bookings" : "/supervisor-dashboard", role.toUpperCase());
    };
    await management("owner");
    await managementLogout();
    await management("supervisor");
    await revokeSupervisor();
    ensure((await authorizedRead(`/package-views/settlement/${businessId}/${bookingId}`)).status === 403, "Revoked Supervisor retained access");
    await navigate("/supervisor-dashboard"); await wait("document.body.innerText.includes('Calendar') || document.body.innerText.includes('unavailable')");
    // Refreshing revoked membership removes the manageable Business context; no settlement can be re-opened.
    await managementLogout();
    await login("staff", true);
    ensure((await authorizedRead(`/package-views/settlement/${businessId}/${bookingId}`)).status === 403, "Staff obtained settlement authority");
    await shot("staff-no-settlement", "/staff-dashboard", "STAFF");
    await writeFile(join(artifacts, "page-e2e-results.json"), JSON.stringify({ origin, sandbox, evidence, ctaInteractionChecks, accountSwitch: "PASS", supervisorRevocation: "PASS", staffDenied: "PASS", authorityClosedBeforeHttp: true, stoppedAfterRun: true }, null, 2));
  } catch (error) {
    await writeFile(join(artifacts, "page-e2e-failure.json"), JSON.stringify({ stage, evidence, error: String(error), stack: error.stack }, null, 2)); throw error;
  } finally {
    browser?.close();
    if (child.pid && child.exitCode === null) { try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch {} }
  }
}
