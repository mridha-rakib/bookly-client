import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Extends the existing S6 Chrome/CDP harness with the actual Venue page composition.
export async function runVenueServicesBrowser({ command, evaluate, origin, output, before, evidence }) {
  const ensure = (value, message) => { if (!value) throw Error(message); };
  async function waitFor(expression) {
    for (let i = 0; i < 200; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(50); }
    throw Error(`Venue did not settle: ${expression}; ${await evaluate("document.body.innerText.slice(0,5000)")}`);
  }
  const click = async (label) => {
    await evaluate(`(()=>{const button=Array.from(document.querySelectorAll('#services button')).find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!button)throw Error('Filter missing');button.click()})()`);
    await delay(100);
  };
  const names = () => evaluate("Array.from(document.querySelectorAll('#services h4')).map(n=>n.textContent)");
  async function screenshot(key, width) {
    const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    const file = `${before ? "before" : "after"}-${key}-${width}.png`;
    await writeFile(join(output, file), Buffer.from(result.data, "base64"));
    evidence.push({ scenario: key, width, screenshot: file, result: "PASS", source: before ? "exact pre-task Venue source" : "actual updated Venue page", fixtureOnly: true });
  }
  for (const width of [1440, 1024, 768, 390, 360]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await command("Page.navigate", { url: `${origin}/venue?id=aaaaaaaaaaaaaaaaaaaaaaaa` });
    await waitFor("document.querySelector('#services') && document.body.innerText.includes('Featured treatment')");
    await waitFor("window.__venueRequests?.some(r=>r.url.startsWith('/package-views/'))");
    await delay(300);
    if (before) {
      ensure(await evaluate("Array.from(document.querySelectorAll('#services h2')).some(h=>h.textContent==='Multi-service packages')"), "Before source did not reproduce the separate block");
      await screenshot("default-featured", width);
      await click("Packages"); await screenshot("packages", width);
      continue;
    }
    ensure(await evaluate("document.querySelector('#services').firstElementChild.getAttribute('aria-label')==='Service filters'"), "Filters are not the first Services child");
    ensure(await evaluate("!Array.from(document.querySelectorAll('#services h2')).some(h=>h.textContent==='Multi-service packages')"), "Separate discovery heading survived");
    ensure(JSON.stringify(await names()) === JSON.stringify(["Featured treatment", "Legacy package"]), "Default Featured composition changed");
    await screenshot("default-featured", width);
    const cases = [
      ["All", ["Featured treatment", "Legacy package", "Movement appointment", "Complete wellbeing — Massage, Facial and Group Movement with a long package name", "Forever wellbeing package"]],
      ["Featured", ["Featured treatment", "Legacy package"]],
      ["Packages", ["Legacy package", "Complete wellbeing — Massage, Facial and Group Movement with a long package name", "Forever wellbeing package"]],
      ["Massage", ["Featured treatment", "Legacy package"]],
      ["Movement", ["Movement appointment"]],
    ];
    for (const [filter, expected] of cases) {
      await click(filter); ensure(JSON.stringify(await names()) === JSON.stringify(expected), `Wrong ${filter} composition at ${width}`);
      ensure(!await evaluate("document.documentElement.scrollWidth>innerWidth"), `Horizontal overflow in ${filter} at ${width}`);
      await screenshot(filter.toLowerCase(), width);
    }
    await click("Packages");
    const packageRequestsBefore = await evaluate("window.__venueRequests.filter(r=>r.url.startsWith('/package-views/')).length");
    for (let i = 0; i < 3; i++) { await click("Packages"); await click("Featured"); await click("Packages"); }
    ensure(await evaluate("document.querySelectorAll('#services [data-offering-kind=\"first-class\"]').length===2"), "Duplicate package cards after switching");
    ensure(await evaluate("window.__venueRequests.filter(r=>r.url.startsWith('/package-views/')).length") === packageRequestsBefore && packageRequestsBefore === 1, "Filtering refetched the package catalogue");
    const allowedHref = await evaluate("document.querySelector('#services [data-offering-kind=\"first-class\"] a').getAttribute('href')");
    ensure(allowedHref === "/customer/package-consent/aaaaaaaaaaaaaaaaaaaaaaaa/111111111111111111111111", "Package used the wrong destination");
    const layout = await evaluate("(()=>{const left=document.querySelector('#services').closest('div.flex-grow');const right=left.parentElement.children[1];const l=left.getBoundingClientRect(),r=right.getBoundingClientRect();return {left:l.left,right:l.right,leftTop:l.top,rightLeft:r.left,rightTop:r.top,rightBottom:r.bottom}})()");
    ensure(width >= 1024 ? layout.rightLeft >= layout.right : layout.rightTop < layout.leftTop, `Sidebar ordering/alignment changed at ${width}`);
    await click("See all"); ensure((await names()).length === 5, "See all did not reset to All");
    await evaluate("Array.from(document.querySelectorAll('#services button')).find(b=>b.textContent==='Movement').focus()");
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
    await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await delay(100); ensure(JSON.stringify(await names()) === JSON.stringify(["Movement appointment"]), "Keyboard filter selection failed");
    ensure(await evaluate("document.activeElement?.textContent==='Movement' && document.activeElement.getAttribute('aria-pressed')==='true'"), "Keyboard focus was not preserved");
    await click("All");
    await evaluate("document.querySelector('#services button[aria-label=\"Book Featured treatment\"]').click()");
    await waitFor("document.body.innerText.includes('Select Add-ons')");
    ensure(await evaluate("window.__venueRequests.some(r=>r.url.endsWith('/services/111111111111111111111111/addons'))"), "Ordinary Book used the wrong Service ID");
    ensure(await evaluate("!window.__venueRequests.some(r=>r.method!=='GET')"), "Ordinary booking click performed a write");
    evidence.push({ scenario: "keyboard-request-navigation-sidebar", width, result: "PASS", packageReads: packageRequestsBefore, sidebar: layout, fixtureOnly: true });
    await command("Page.navigate", { url: `${origin}/venue?id=aaaaaaaaaaaaaaaaaaaaaaaa` });
    await waitFor("document.querySelector('#services button[aria-label=\"Book Legacy package\"]')");
    await click("Packages");
    await evaluate("document.querySelector('#services button[aria-label=\"Book Legacy package\"]').click()");
    await waitFor("document.body.innerText.includes('Select Add-ons') && window.__venueRequests.some(r=>r.url.endsWith('/services/legacy/addons'))");
    ensure(await evaluate("!window.__venueRequests.some(r=>r.method!=='GET')"), "Legacy booking entry performed a write");
    evidence.push({ scenario: "legacy-book-entry", width, result: "PASS", source: "actual existing handler", fixtureOnly: true });
  }
  if (before) return;
  for (const state of ["loading", "503", "429", "empty", "anonymous"]) {
    for (const width of [1440, 390]) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
      await command("Page.navigate", { url: `${origin}/venue?id=aaaaaaaaaaaaaaaaaaaaaaaa&state=${state}` });
      await waitFor("document.querySelector('#services [aria-label=\"Service filters\"]') && document.body.innerText.includes('Featured treatment')");
      await click("Packages");
      await waitFor("document.querySelector('#services h4')?.textContent==='Legacy package'");
      if (state === "loading") await waitFor("document.querySelector('#services [role=status]')");
      if (["429", "503"].includes(state)) await waitFor("document.querySelector('#services [role=alert]')");
      ensure(!await evaluate("document.documentElement.scrollWidth>innerWidth"), `State overflow ${state} ${width}`);
      await screenshot(state, width);
      await click("All"); ensure((await names()).includes("Featured treatment"), "Scoped package state hid ordinary Services");
      await delay(350);
      ensure(await evaluate("window.__venueRequests.filter(r=>r.url.startsWith('/package-views/')).length") === (state === "anonymous" ? 0 : 1), `Unexpected retry/request in ${state}`);
    }
  }
}
