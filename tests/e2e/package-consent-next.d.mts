export function runConsentNextE2E(options: {
  clientRoot: string; apiOrigin: string; businessId: string; packageId: string;
  startAt: string; email: string; password: string; artifacts: string;
  openBrowser: (url: string, artifacts: string) => Promise<{
    command: (method: string, params?: object) => Promise<unknown>;
    debuggingPort: string;
    evaluate: (expression: string) => Promise<unknown>;
    waitFor: (expression: string, timeoutMs?: number) => Promise<void>;
    screenshot: (width: number, name: string) => Promise<void>;
    press: (key: "Space" | "Enter") => Promise<void>;
    close: () => void;
  }>;
  verifyPersistence: (stage: string, text?: string) => Promise<void>;
  setApiEnabled: (enabled: boolean) => void;
  setUiOrigin: (origin: string) => void;
  holdAcceptance: (held: boolean) => void;
}): Promise<{ sandbox: string; values: object[] }>;
