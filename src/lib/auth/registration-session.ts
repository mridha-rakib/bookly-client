import type { Portal, VisitType } from "@/lib/api/auth";

const storageKey = "bookly.registrationSession";

export interface RegistrationSessionMetadata {
  portal: Portal;
  email: string;
  sessionId: string;
  currentStep?: string;
  visitType?: VisitType;
}

const canUseSessionStorage = () => typeof window !== "undefined" && Boolean(window.sessionStorage);

export const saveRegistrationSession = (metadata: RegistrationSessionMetadata): void => {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(storageKey, JSON.stringify(metadata));
};

export const getRegistrationSession = (
  portal: Portal,
  email?: string,
): RegistrationSessionMetadata | null => {
  if (!canUseSessionStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(storageKey);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RegistrationSessionMetadata>;

    if (parsed.portal !== portal || !parsed.sessionId || !parsed.email) {
      return null;
    }

    if (email && parsed.email.toLowerCase() !== email.toLowerCase()) {
      return null;
    }

    return {
      portal: parsed.portal,
      email: parsed.email,
      sessionId: parsed.sessionId,
      currentStep: parsed.currentStep,
      visitType: parsed.visitType,
    };
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
};

export const clearRegistrationSession = (): void => {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(storageKey);
};
