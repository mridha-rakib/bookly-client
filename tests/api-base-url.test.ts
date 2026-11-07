import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it("uses the main development API on port 3001 when no public override exists", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined);
  vi.resetModules();
  const { apiBaseUrl, apiClient } = await import("@/lib/api/client");
  expect(apiBaseUrl).toBe("http://localhost:3001/api/v1");
  expect(apiClient.defaults.baseURL).toBe(apiBaseUrl);
});

it("keeps the explicitly configured API target", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test/api/v1/");
  vi.resetModules();
  const { apiBaseUrl } = await import("@/lib/api/client");
  expect(apiBaseUrl).toBe("https://api.example.test/api/v1");
});
