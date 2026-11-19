import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// usePWAInstall reads module-level state (the stashed beforeinstallprompt event), so each test
// imports a fresh copy of the module after registering its window listener.
type Hook = typeof import("@/hooks/usePWAInstall").usePWAInstall;

const fireInstallPrompt = (outcome: "accepted" | "dismissed" = "accepted") => {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string; platform: string }>;
    platforms: string[];
  };
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome, platform: "web" });
  event.platforms = ["web"];
  window.dispatchEvent(event);
  return event;
};

describe("usePWAInstall", () => {
  let host: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<Hook>;
  let usePWAInstall: Hook;

  function Probe() {
    latest = usePWAInstall();
    return createElement("span", null, latest.isInstallable ? "installable" : "not-installable");
  }

  beforeEach(async () => {
    vi.resetModules();
    ({ usePWAInstall } = await import("@/hooks/usePWAInstall"));
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("is not installable until the browser offers an install prompt", async () => {
    await act(async () => root.render(createElement(Probe)));
    expect(latest.isInstallable).toBe(false);
    expect(host.textContent).toBe("not-installable");
  });

  it("becomes installable when beforeinstallprompt fires after mount", async () => {
    await act(async () => root.render(createElement(Probe)));
    let event!: ReturnType<typeof fireInstallPrompt>;
    act(() => {
      event = fireInstallPrompt();
    });
    expect(event.defaultPrevented).toBe(true);
    expect(latest.isInstallable).toBe(true);
    expect(host.textContent).toBe("installable");
  });

  it("is installable on mount when the prompt was stashed before the component mounted", async () => {
    fireInstallPrompt();
    await act(async () => root.render(createElement(Probe)));
    expect(latest.isInstallable).toBe(true);
  });

  it("shows the stashed prompt once, then is no longer installable", async () => {
    await act(async () => root.render(createElement(Probe)));
    let event!: ReturnType<typeof fireInstallPrompt>;
    act(() => {
      event = fireInstallPrompt("accepted");
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await act(async () => {
      await latest.installPWA();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(latest.isInstallable).toBe(false);
    expect(host.textContent).toBe("not-installable");
    log.mockRestore();
  });

  it("falls back to browser instructions when no prompt is available", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    await act(async () => root.render(createElement(Probe)));
    await act(async () => {
      await latest.installPWA();
    });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(latest.isInstallable).toBe(false);
  });
});
