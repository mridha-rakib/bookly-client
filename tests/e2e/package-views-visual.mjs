import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, basename, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

// Test-only static bundle; never a production Next route. No Next/Vite .env loading.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const venueMode = process.argv.includes("--venue-services");
const beforeRoot = process.argv.find((arg) => arg.startsWith("--before-root="))?.slice("--before-root=".length);
const require = createRequire(realpathSync(join(root, "../api/node_modules/tsx/package.json")));
const { build } = require("esbuild");
const cssRequire = createRequire(realpathSync(join(root, "node_modules/@tailwindcss/postcss/package.json")));
const postcss = cssRequire("postcss");
const tailwind = createRequire(join(root, "package.json"))("@tailwindcss/postcss");
const output = resolve(process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? await mkdtemp(join(tmpdir(), "bookly-s6-visual-")));
await mkdir(output, { recursive: true });
await build({ absWorkingDir: root, entryPoints: [join(root, venueMode ? "tests/visual/venue-services.tsx" : "tests/visual/package-views.tsx")],
  nodePaths: [join(root, "node_modules")],
  outfile: join(output, "fixture.js"), bundle: true, platform: "browser", format: "esm", jsx: "automatic",
  alias: { "@": join(root, "src"), "next/link": join(root, "tests/visual/link.tsx"),
    ...(venueMode ? { "next/navigation": join(root, "tests/visual/venue-navigation.ts"), "next/image": join(root, "tests/visual/venue-image.tsx"), "@/lib/api/client": join(root, "tests/visual/venue-api.ts"), "@/lib/auth/store": join(root, "tests/visual/venue-auth.ts") } : {}),
  },
  define: { "process.env": "{}" }, plugins: [{ name: "separate-test-css", setup(b) {
    b.onLoad({ filter: /globals\.css$/ }, () => ({ contents: "", loader: "css" }));
    if (venueMode) b.onResolve({ filter: /^\.\/client$/ }, (args) => args.importer.replaceAll("\\", "/").includes("/src/lib/api/") ? { path: join(root, "tests/visual/venue-api.ts") } : undefined);
    if (venueMode && beforeRoot) b.onResolve({ filter: /src[\/]app[\/]venue[\/]page$|\.\.\/\.\.\/src\/app\/venue\/page$/ }, () => ({ path: join(resolve(beforeRoot), "src/app/venue/page.tsx") }));
  } }],
});
const globals = (await readFile(join(root, "src/app/globals.css"), "utf8")).replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../../src/components/packages";\n@source "../../src/app/venue";\n@source "../../src/components";\n@source "../../tests/visual";');
const css = await postcss([tailwind({ base: root })]).process(globals, { from: join(root, "tests/visual/style.css") });
await writeFile(join(output, "fixture.css"), css.css);
const html = (await readFile(join(root, "tests/visual/index.html"), "utf8")).replace('/tests/visual/package-views.tsx', '/fixture.js').replace('</head>', '<link rel="stylesheet" href="/fixture.css"/></head>');
const httpServer = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const publicFile = resolve(root, "public", `.${pathname}`);
  if (venueMode && publicFile.startsWith(resolve(root, "public") + sep) && existsSync(publicFile)) {
    response.setHeader("Content-Type", pathname.endsWith(".svg") ? "image/svg+xml" : pathname.endsWith(".png") ? "image/png" : pathname.endsWith(".webp") ? "image/webp" : "image/jpeg");
    response.end(await readFile(publicFile)); return;
  }
  response.setHeader("Content-Type", pathname === "/fixture.js" ? "text/javascript" : pathname === "/fixture.css" ? "text/css" : "text/html");
  response.end(pathname === "/fixture.js" ? await readFile(join(output, "fixture.js")) : pathname === "/fixture.css" ? css.css : html);
});
await new Promise((ok) => httpServer.listen(0, "127.0.0.1", ok));
const server = { close: () => new Promise((ok) => { httpServer.closeAllConnections(); httpServer.close(ok); }) };
const origin = `http://127.0.0.1:${httpServer.address().port}`;
console.log(`Isolated fixture preview: ${origin}${venueMode ? "/venue?id=aaaaaaaaaaaaaaaaaaaaaaaa" : "/tests/visual/index.html"}`);
if (process.argv.includes("--serve")) {
  console.log("VISUAL FIXTURE — NOT LIVE PURCHASE DATA. Stop with Ctrl+C.");
} else {
  const executable = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  if (!existsSync(executable)) { await server.close(); throw Error("Local Chrome not found; screenshots NOT RUN"); }
  const profile = await mkdtemp(join(tmpdir(), "bookly-s6-chrome-"));
  const chrome = spawn(executable, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket;
  const evidence = [];
  const errors = [];
  try {
    let port;
    for (let i = 0; i < 150; i++) { try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; if (port) break; } catch {} await delay(100); }
    if (!port) throw Error("Chrome debugging unavailable");
    const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok, fail) => { socket.addEventListener("open", ok, { once: true }); socket.addEventListener("error", fail, { once: true }); });
    let sequence = 0;
    const pending = new Map();
    socket.addEventListener("message", ({ data }) => { const value = JSON.parse(String(data)); if (value.method === "Runtime.exceptionThrown") errors.push(value.params.exceptionDetails); const promise = pending.get(value.id); if (promise) { pending.delete(value.id); value.error ? promise.reject(Error(value.error.message)) : promise.resolve(value.result); } });
    const command = (method, params = {}) => new Promise((ok, fail) => { const id = ++sequence; pending.set(id, { resolve: ok, reject: fail }); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async (expression) => { const value = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw Error(JSON.stringify(value.exceptionDetails)); return value.result.value; };
    await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable");
    await command("Network.setBlockedURLs", { urls: ["https://*", "http://localhost:3000/*"] });
    if (venueMode) {
      const { runVenueServicesBrowser } = await import("./venue-services-browser.mjs");
      await runVenueServicesBrowser({ command, evaluate, origin, output, before: Boolean(beforeRoot), evidence });
    } else for (const scenario of ["catalogue", "detail", "owned", "empty", "redeem", "dues", "cancel", "payment", "settlement", "denied", "initial-one", "initial-mixed", "initial-empty", "stale", "error", "loading"]) {
      for (const width of [1440, 390]) {
        await command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
        await command("Page.navigate", { url: `${origin}/tests/visual/index.html?scenario=${scenario}` });
        let ready = false;
        for (let n = 0; n < 300; n++) { if (await evaluate(`document.body.innerText.includes('VISUAL FIXTURE') && document.body.innerText.includes('Bookly Package review · ${scenario}')`)) { ready = true; break; } await delay(100); }
        if (!ready) throw Error(`Fixture did not render: ${scenario}`);
        await delay(250);
        const overflow = await evaluate("document.documentElement.scrollWidth > innerWidth");
        if (overflow) throw Error(`Horizontal overflow: ${scenario} at ${width}`);
        if (scenario === "dues") {
          if (!await evaluate("!document.querySelector('input[type=checkbox]').checked && document.querySelector('button').disabled")) throw Error("Review control falsely authorizes booking");
          await evaluate("document.querySelector('input').focus()");
          await command("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
          await command("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
          if (!await evaluate("document.querySelector('input').checked && document.querySelector('button').disabled")) throw Error("Keyboard review or denial failed");
        }
        const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        const file = `${scenario}-${width}.png`;
        await writeFile(join(output, file), Buffer.from(screenshot.data, "base64"));
        evidence.push({ scenario, width, result: "PASS", overflow, screenshot: file, fixtureOnly: true });
      }
    }
    if (errors.length) throw Error(`Browser runtime exceptions: ${JSON.stringify(errors)}`);
    await writeFile(join(output, "visual-results.json"), JSON.stringify({ origin, evidence, errors, realBackendE2E: false, serverStoppedAfterRun: true }, null, 2));
    console.log(`PASS ${evidence.length} rendered desktop/mobile fixture checks; screenshots: ${output}`);
  } finally {
    socket?.close();
    const exited = new Promise((ok) => chrome.once("exit", ok)); chrome.kill(); await Promise.race([exited, delay(3000)]);
    await server.close();
    if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith("bookly-s6-chrome-")) throw Error("Unsafe profile cleanup refused");
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
