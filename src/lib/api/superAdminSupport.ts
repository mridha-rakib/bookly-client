import { apiRequest } from "@/lib/api/client";
import type { SupportMessage, SupportMessageListResult, SupportTicketStatus } from "@/lib/api/support";

/** Batch 15B — Super Admin Support. SUPER_ADMIN-only on the backend (see
 * api/src/modules/super-admin/super-admin.route.ts). Matches
 * api/src/modules/super-admin/super-admin-support.service.ts's DTOs exactly. */

export interface SuperAdminSupportTicketRow {
  id: string;
  reference: string;
  subject: string;
  status: SupportTicketStatus;
  requesterUserId: string;
  requesterRole: "CUSTOMER" | "BUSINESS_OWNER" | "SUPERVISOR" | "STAFF";
  requesterDisplayName: string;
  requesterEmail: string;
  businessId?: string;
  businessName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SuperAdminSupportStatusHistoryEntry {
  action: "CREATED" | "STATUS_CHANGED" | "REOPENED";
  actorRole: string;
  previousStatus: SupportTicketStatus | null;
  resultingStatus: SupportTicketStatus;
  createdAt: string;
}

export interface SuperAdminSupportTicketDetail extends SuperAdminSupportTicketRow {
  bookingId?: string;
  bookingReference?: string;
  bookingStatus?: string;
  statusHistory: SuperAdminSupportStatusHistoryEntry[];
}

export interface SuperAdminSupportListResult {
  tickets: SuperAdminSupportTicketRow[];
  pagination: { page: number; limit: number; total: number };
}

export interface ListSuperAdminSupportParams {
  status?: SupportTicketStatus;
  q?: string;
  page?: number;
  limit?: number;
}

export const superAdminSupportApi = {
  list: (params: ListSuperAdminSupportParams = {}) =>
    apiRequest<SuperAdminSupportListResult>({
      method: "GET",
      url: "/super-admin/support/tickets",
      params: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  getById: (ticketId: string) =>
    apiRequest<SuperAdminSupportTicketDetail>({
      method: "GET",
      url: `/super-admin/support/tickets/${ticketId}`,
    }),

  listMessages: (ticketId: string, pagination: { page?: number; limit?: number } = {}) =>
    apiRequest<SupportMessageListResult>({
      method: "GET",
      url: `/super-admin/support/tickets/${ticketId}/messages`,
      params: {
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),

  reply: (ticketId: string, message: string) =>
    apiRequest<SupportMessage>({
      method: "POST",
      url: `/super-admin/support/tickets/${ticketId}/messages`,
      data: { message },
    }),

  changeStatus: (ticketId: string, status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED") =>
    apiRequest<SuperAdminSupportTicketDetail>({
      method: "POST",
      url: `/super-admin/support/tickets/${ticketId}/status`,
      data: { status },
    }),

  reopen: (ticketId: string) =>
    apiRequest<SuperAdminSupportTicketDetail>({
      method: "POST",
      url: `/super-admin/support/tickets/${ticketId}/reopen`,
    }),
};
