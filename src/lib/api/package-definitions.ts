import { apiRequest } from "@/lib/api/client";

export type DefinitionStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type EditableDefinitionStatus = Exclude<DefinitionStatus, "ARCHIVED">;
export type DefinitionValidity = { mode: "FINITE"; months: 6 | 12 } | { mode: "FOREVER" };
export type DefinitionOwnerTerms = { validityMonths: 6 | 12 } | { validity: DefinitionValidity };
export type DefinitionTerms =
  | { version: 1; validityMonths: 6 | 12; penaltyPolicyVersion: 1 }
  | { version: 2; validity: DefinitionValidity; penaltyPolicyVersion: 1 };
export interface DefinitionItemInput {
  itemId?: string;
  serviceId: string;
  includedSessions: number;
  referenceUnitPriceCents?: number;
  penaltyBasisCents?: number;
}
export interface DefinitionInput {
  name: string;
  description?: string;
  status: EditableDefinitionStatus;
  isFeatured: boolean;
  serviceCategoryId?: string;
  subcategory?: string;
  bundlePriceCents?: number;
  contractTerms?: DefinitionOwnerTerms;
  items: DefinitionItemInput[];
}
export interface PackageDefinition
  extends Omit<DefinitionInput, "status" | "contractTerms" | "items"> {
  id: string;
  businessId: string;
  category: string;
  revision: number;
  status: DefinitionStatus;
  contractTerms?: DefinitionTerms;
  items: (DefinitionItemInput & { itemId: string })[];
  totalSessions: number;
  referenceTotalCents: number | null;
  savingsCents: number | null;
  discountPercent: number | null;
  sellable: boolean;
  newContractReady: boolean;
  dependencyIssues: { itemId?: string; code: string }[];
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}
// A single selection cannot send both status and archived filters.
export type DefinitionFilter = "ALL" | "ARCHIVED" | EditableDefinitionStatus;
const base = (businessId: string) => `/businesses/${businessId}/packages`;
export const packageDefinitionsApi = {
  list: (businessId: string, filter: DefinitionFilter = "ALL") =>
    apiRequest<{ packages: PackageDefinition[] }>({
      method: "GET",
      url: base(businessId),
      params:
        filter === "ARCHIVED" ? { archived: true } : filter === "ALL" ? {} : { status: filter },
    }),
  detail: (businessId: string, id: string) =>
    apiRequest<PackageDefinition>({
      method: "GET",
      url: `${base(businessId)}/${id}`,
    }),
  create: (businessId: string, input: DefinitionInput) =>
    apiRequest<PackageDefinition>({
      method: "POST",
      url: base(businessId),
      data: input,
    }),
  update: (businessId: string, id: string, input: DefinitionInput & { expectedRevision: number }) =>
    apiRequest<PackageDefinition>({
      method: "PATCH",
      url: `${base(businessId)}/${id}`,
      data: input,
    }),
  status: (
    businessId: string,
    id: string,
    status: EditableDefinitionStatus,
    expectedRevision: number,
  ) =>
    apiRequest<PackageDefinition>({
      method: "PATCH",
      url: `${base(businessId)}/${id}/status`,
      data: { status, expectedRevision },
    }),
  archive: (businessId: string, id: string, expectedRevision: number) =>
    apiRequest<void>({
      method: "DELETE",
      url: `${base(businessId)}/${id}`,
      params: { expectedRevision },
    }),
  restore: (
    businessId: string,
    id: string,
    status: "ACTIVE" | "INACTIVE",
    expectedRevision: number,
  ) =>
    apiRequest<PackageDefinition>({
      method: "POST",
      url: `${base(businessId)}/${id}/restore`,
      data: { status, expectedRevision },
    }),
};
