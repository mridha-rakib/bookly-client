import { apiRequest } from "@/lib/api/client";
import type { BusinessCity } from "@/lib/constants/cities";

// Matches api/src/modules/client/client.types.ts
export const CLIENT_PROPERTY_TYPES = ["Apartment", "Villa", "House", "Hotel", "Office", "Other"] as const;
export type ClientPropertyType = (typeof CLIENT_PROPERTY_TYPES)[number];

export const CLIENT_TAGS = ["VIP", "Regular", "New", "No-show"] as const;
export type ClientTag = (typeof CLIENT_TAGS)[number];

export type ClientLinkState = "UNLINKED" | "LINKED" | "IDENTITY_CONFLICT";

export interface ClientPhone {
  countryCode: string;
  nationalNumber: string;
  e164: string;
}

export interface ClientAddress {
  city: BusinessCity;
  propertyType: ClientPropertyType;
  area: string;
  streetName: string;
  streetNumber: string;
  floorUnit?: string;
  aptRoom?: string;
  additionalDirections?: string;
}

// Matches api/src/modules/client/client.service.ts BusinessClientDto.
export interface BusinessClientDto {
  id: string;
  businessId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: ClientPhone;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  address: ClientAddress;
  notes?: string;
  tag?: ClientTag;
  linkState: ClientLinkState;
  /** false only when LINKED — identity fields (name/email/phone/gender) are read-only. */
  isIdentityEditable: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface ClientListStats {
  totalClients: number;
  newThisMonth: number;
}

export interface ClientListResponse {
  clients: BusinessClientDto[];
  pagination: { page: number; limit: number; total: number };
  stats: ClientListStats;
}

export interface ListClientsParams {
  q?: string;
  tag?: ClientTag;
  archived?: boolean;
  page?: number;
  limit?: number;
}

export interface ClientPhoneInput {
  countryCode: string;
  nationalNumber: string;
}

export interface CreateClientInput {
  firstName: string;
  lastName?: string;
  email: string;
  phone: ClientPhoneInput;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  address: ClientAddress;
  notes?: string;
  tag?: ClientTag;
}

export type UpdateClientInput = Partial<CreateClientInput>;

const buildQuery = (params: ListClientsParams): Record<string, string> => {
  const query: Record<string, string> = {};
  if (params.q) query["q"] = params.q;
  if (params.tag) query["tag"] = params.tag;
  if (params.archived !== undefined) query["archived"] = String(params.archived);
  if (params.page !== undefined) query["page"] = String(params.page);
  if (params.limit !== undefined) query["limit"] = String(params.limit);
  return query;
};

export const clientsApi = {
  listClients: (businessId: string, params: ListClientsParams = {}) =>
    apiRequest<ClientListResponse>({
      method: "GET",
      url: `/businesses/${businessId}/clients`,
      params: buildQuery(params),
    }),

  getClient: (businessId: string, clientId: string) =>
    apiRequest<BusinessClientDto>({
      method: "GET",
      url: `/businesses/${businessId}/clients/${clientId}`,
    }),

  createClient: (businessId: string, input: CreateClientInput) =>
    apiRequest<BusinessClientDto>({
      method: "POST",
      url: `/businesses/${businessId}/clients`,
      data: input,
    }),

  updateClient: (businessId: string, clientId: string, input: UpdateClientInput) =>
    apiRequest<BusinessClientDto>({
      method: "PATCH",
      url: `/businesses/${businessId}/clients/${clientId}`,
      data: input,
    }),

  archiveClient: (businessId: string, clientId: string) =>
    apiRequest<undefined>({
      method: "DELETE",
      url: `/businesses/${businessId}/clients/${clientId}`,
    }),

  restoreClient: (businessId: string, clientId: string) =>
    apiRequest<BusinessClientDto>({
      method: "POST",
      url: `/businesses/${businessId}/clients/${clientId}/restore`,
    }),
};
