import { apiRequest } from "@/lib/api/client";

type Portal = "customer" | "professional";
type Recovery = { email: string; challenge: string; resetToken?: string };
const key = (portal: Portal) => `bookly-password-recovery-${portal}`;
export const getRecovery = (portal: Portal): Recovery | null => {
  try { return JSON.parse(sessionStorage.getItem(key(portal)) ?? "null") as Recovery | null; } catch { return null; }
};
const save = (portal: Portal, value: Recovery) => sessionStorage.setItem(key(portal), JSON.stringify(value));
export const requestRecovery = async (portal: Portal, email: string) => {
  const current = getRecovery(portal);
  const previousChallenge = current?.challenge && !current.resetToken && current.email.trim().toLowerCase() === email.trim().toLowerCase() ? current.challenge : undefined;
  const result = await apiRequest<{ challenge: string }>({ method: "POST", url: `/auth/${portal}/password-recovery/request`, data: { email, ...(previousChallenge ? { previousChallenge } : {}) } });
  if (!result.challenge) return false;
  save(portal, { email, challenge: result.challenge });
  return true;
};
export const resendRecovery = async (portal: Portal) => {
  const current = getRecovery(portal);
  if (!current?.challenge) throw new Error("Recovery session missing");
  await apiRequest({ method: "POST", url: `/auth/${portal}/password-recovery/resend`, data: { challenge: current.challenge } });
};
export const verifyRecovery = async (portal: Portal, code: string) => {
  const current = getRecovery(portal);
  if (!current?.challenge) throw new Error("Recovery session missing");
  const result = await apiRequest<{ resetToken: string }>({ method: "POST", url: `/auth/${portal}/password-recovery/verify`, data: { challenge: current.challenge, code } });
  save(portal, { ...current, resetToken: result.resetToken });
};
export const completeRecovery = async (portal: Portal, newPassword: string) => {
  const current = getRecovery(portal);
  if (!current?.resetToken) throw new Error("Recovery session missing");
  await apiRequest({ method: "POST", url: `/auth/${portal}/password-recovery/complete`, data: { resetToken: current.resetToken, newPassword } });
  sessionStorage.removeItem(key(portal));
};
