import { act } from "react";

/** Drives the shared Booking wizard steps for a First-Class purchase in component tests. */
const pad = (value: number) => String(value).padStart(2, "0");
const now = new Date();
const next = new Date(now.getFullYear(), now.getMonth() + 1, 15);
/** A date in next month's calendar page, so it is never in the past for the Business. */
export const wizardDate = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-15`;
export const wizardStartAt = `${wizardDate}T10:00:00.000Z`;

/** `useServiceAvailabilityQuery` stand-in returning one server slot for the requested professional. */
export const availabilityFor = (staffMembershipId?: string) => ({
  data: staffMembershipId ? {
    businessId: "business", serviceId: "service", timezone: "UTC", capacityMax: 1,
    days: [{ date: wizardDate, isOpen: true, slots: [{ startAt: wizardStartAt, endAt: `${wizardDate}T11:00:00.000Z`, eligibleStaffMembershipIds: [staffMembershipId], source: "AUTO" }] }],
  } : undefined,
  isLoading: false, isFetching: false, isError: false, refetch: () => Promise.resolve(),
});

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const buttons = (host: HTMLElement) => [...host.querySelectorAll("button")];
export async function press(host: HTMLElement, find: (button: HTMLButtonElement) => boolean, label: string) {
  const target = buttons(host).find(find);
  if (!target) throw Error(`Missing button: ${label}`);
  await act(async () => target.click());
  await settle();
}
export const continueButton = (host: HTMLElement) => buttons(host).find((b) => /^(Continue →|Continue to .+ →|Next: Appointment \d+ →)$/.test(b.textContent?.trim() ?? ""));

/** Services → Add-ons → Professionals → Time → Payment for one included service. */
export async function selectAndAdvanceToPayment(host: HTMLElement, service: string, professional: string) {
  await press(host, (b) => b.getAttribute("aria-label") === `Book ${service}`, `Book ${service}`);
  await press(host, (b) => b === continueButton(host), "Continue (services)");
  await press(host, (b) => b === continueButton(host), "Continue (add-ons)");
  const card = [...host.querySelectorAll("h4")].find((heading) => heading.textContent === professional)?.closest("div.cursor-pointer") as HTMLElement | null;
  if (!card) throw Error(`Missing professional ${professional}`);
  await act(async () => card.click());
  await press(host, (b) => b === continueButton(host), "Continue (professionals)");
  await press(host, (b) => b.getAttribute("aria-label") === "Show next month", "Show next month");
  await press(host, (b) => b.textContent?.trim() === "15" && !b.disabled, "Date 15");
  await press(host, (b) => b.hasAttribute("aria-pressed") && /\d{1,2}:\d{2}/.test(b.textContent ?? ""), "Slot");
  await press(host, (b) => b === continueButton(host), "Continue (time)");
}
