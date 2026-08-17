import { apiRequest } from "@/lib/api/client";

// Matches api/src/modules/addons/addon.types.ts.
export type AddonStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
/** The subset of statuses a client may set directly when creating/editing an Add-on. */
export type EditableAddonStatus = "DRAFT" | "ACTIVE" | "INACTIVE";

export interface AddonAssignedService {
  serviceId: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
}

export interface Addon {
  id: string;
  businessId: string;
  status: AddonStatus;
  name: string;
  description?: string;
  /** Flat fee in integer cents — never a formatted string, never multiplied by qty/hours. */
  priceCents?: number;
  customServiceCategoryId?: string;
  customServiceCategoryName?: string;
  assignedServices: AddonAssignedService[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface AddonStatusCounts {
  draft: number;
  active: number;
  inactive: number;
  archived: number;
}

export interface AddonListResponse {
  addons: Addon[];
  counts: AddonStatusCounts;
}

export interface ListAddonsParams {
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  archived?: boolean;
}

// Matches api/src/modules/addons/addon.schema.ts's shared create/update body shape — PATCH is
// full-replace semantics, including the assigned-Services set. Validation is status-aware
// there: DRAFT tolerates missing price/category/assignedServiceIds — only `name` + `status`
// are unconditionally required.
export interface AddonInput {
  status: EditableAddonStatus;
  name: string;
  description?: string;
  priceCents?: number;
  customServiceCategoryId?: string;
  assignedServiceIds?: string[];
}

/** Read-only summary used by Service Edit/View's "Assigned Add-ons" section. */
export interface ServiceAssignedAddon {
  addonId: string;
  name: string;
  status: AddonStatus;
  priceCents?: number;
}

export const addonsApi = {
  listAddons: (businessId: string, params: ListAddonsParams = {}) =>
    apiRequest<AddonListResponse>({
      method: "GET",
      url: `/businesses/${businessId}/addons`,
      params: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.archived !== undefined ? { archived: String(params.archived) } : {}),
      },
    }),

  getAddon: (businessId: string, addonId: string) =>
    apiRequest<Addon>({ method: "GET", url: `/businesses/${businessId}/addons/${addonId}` }),

  createAddon: (businessId: string, input: AddonInput) =>
    apiRequest<Addon>({ method: "POST", url: `/businesses/${businessId}/addons`, data: input }),

  updateAddon: (businessId: string, addonId: string, input: AddonInput) =>
    apiRequest<Addon>({
      method: "PATCH",
      url: `/businesses/${businessId}/addons/${addonId}`,
      data: input,
    }),

  updateAddonStatus: (businessId: string, addonId: string, status: "ACTIVE" | "INACTIVE") =>
    apiRequest<Addon>({
      method: "PATCH",
      url: `/businesses/${businessId}/addons/${addonId}/status`,
      data: { status },
    }),

  archiveAddon: (businessId: string, addonId: string) =>
    apiRequest<undefined>({
      method: "DELETE",
      url: `/businesses/${businessId}/addons/${addonId}`,
    }),

  restoreAddon: (businessId: string, addonId: string, status: "ACTIVE" | "INACTIVE") =>
    apiRequest<Addon>({
      method: "POST",
      url: `/businesses/${businessId}/addons/${addonId}/restore`,
      data: { status },
    }),

  listAddonsForService: (businessId: string, serviceId: string) =>
    apiRequest<ServiceAssignedAddon[]>({
      method: "GET",
      url: `/businesses/${businessId}/services/${serviceId}/addons`,
    }),
};
