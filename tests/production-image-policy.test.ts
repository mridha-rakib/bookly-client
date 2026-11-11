import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const load = async (mode: "production" | "development" | "test") => {
  vi.stubEnv("NODE_ENV", mode);
  vi.resetModules();
  return (await import("../next.config")).default.images!;
};

describe("Next image origin policy", () => {
  it.each(["production", "test"] as const)("blocks private image origins in %s", async (mode) => {
    const images = await load(mode);
    expect(images.dangerouslyAllowLocalIP).toBe(false);
    for (const host of ["127.0.0.1", "localhost", "169.254.169.254", "10.0.0.1"]) {
      expect(hasRemoteMatch([], images.remotePatterns ?? [], new URL(`http://${host}:9000/image.png`))).toBe(false);
    }
    expect(hasRemoteMatch([], images.remotePatterns ?? [], new URL("https://unapproved.example/image.png"))).toBe(false);
  });

  it("keeps public flag and signed Hetzner media origins available in production", async () => {
    const images = await load("production");
    for (const url of ["https://flagcdn.com/cy.svg", "https://hel1.your-objectstorage.com/bucket/media.png?X-Amz-Signature=fixture"]) {
      expect(hasRemoteMatch([], images.remotePatterns ?? [], new URL(url))).toBe(true);
    }
  });

  it("preserves explicitly development-only MinIO support", async () => {
    const images = await load("development");
    expect(images.dangerouslyAllowLocalIP).toBe(true);
    for (const host of ["127.0.0.1", "localhost"]) {
      expect(hasRemoteMatch([], images.remotePatterns ?? [], new URL(`http://${host}:9000/image.png`))).toBe(true);
    }
  });
});
