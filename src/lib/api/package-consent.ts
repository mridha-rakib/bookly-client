import { apiRequest } from "@/lib/api/client";

export type ConsentOffer = {
  businessId: string;
  packageId: string;
  name: string;
  revision: number;
  timezone: string;
  items: {
    definitionItemId: string;
    serviceId: string;
    name: string;
    quantity: number;
    providers: { id: string; name: string }[];
  }[];
};
export type ConsentIntent = {
  packageId: string;
  expectedRevision: number;
  selections: {
    selectionId: string;
    definitionItemId: string;
    serviceId: string;
    staffMembershipId: string;
    startAt: string;
    addonIds: string[];
  }[];
};
export type ConsentPresentation = {
  version: 1;
  presentationId: string;
  challenge: string;
  templateVersion: 1;
  quoteHash: string;
  disclosureHash: string;
  text: string;
  accepted?: ConsentAccepted;
};
export type ConsentAction = Omit<ConsentPresentation, "text" | "accepted"> & {
  action: "ACCEPT_PACKAGE_CHECKOUT_TERMS";
  eventId: string;
};
export type ConsentAccepted = {
  state: "ACCEPTED_IMMUTABLE";
  acceptanceId: string;
  acceptedAt: string;
  presentationId: string;
  quoteHash: string;
  disclosureHash: string;
  eventId: string;
};
const base = (businessId: string) => `/package-consent/${encodeURIComponent(businessId)}`;
export const getConsentOffer = (businessId: string, packageId: string) =>
  apiRequest<ConsentOffer>({
    url: `${base(businessId)}/offers/${encodeURIComponent(packageId)}`,
    method: "GET",
  });
export const retainConsentQuote = (
  businessId: string,
  operationId: string,
  intent: ConsentIntent,
) =>
  apiRequest<{ operationId: string }>({
    url: `${base(businessId)}/quotes`,
    method: "POST",
    data: { operationId, intent },
  });
export const getConsentPresentation = (businessId: string, operationId: string) =>
  apiRequest<ConsentPresentation>({
    url: `${base(businessId)}/operations/${encodeURIComponent(operationId)}/presentation`,
    method: "POST",
    data: {},
  });
export const acceptConsentTerms = (
  businessId: string,
  operationId: string,
  action: ConsentAction,
) =>
  apiRequest<ConsentAccepted>({
    url: `${base(businessId)}/operations/${encodeURIComponent(operationId)}/acceptance`,
    method: "POST",
    data: action,
  });
export const consentAction = (p: ConsentPresentation): ConsentAction => ({
  version: 1,
  action: "ACCEPT_PACKAGE_CHECKOUT_TERMS",
  eventId: crypto.randomUUID(),
  presentationId: p.presentationId,
  challenge: p.challenge,
  templateVersion: p.templateVersion,
  quoteHash: p.quoteHash,
  disclosureHash: p.disclosureHash,
});
export const matchesConsentAcceptance = (
  p: ConsentPresentation,
  action: ConsentAction,
  accepted: ConsentAccepted,
) =>
  accepted.state === "ACCEPTED_IMMUTABLE" &&
  accepted.presentationId === p.presentationId &&
  accepted.eventId === action.eventId &&
  accepted.quoteHash === p.quoteHash &&
  accepted.disclosureHash === p.disclosureHash;
