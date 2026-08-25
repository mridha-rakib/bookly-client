import { apiRequest } from "@/lib/api/client";

/**
 * Batch 15B — Support & Issues. Matches api/src/modules/support/support.dto.ts exactly. Requester
 * (CUSTOMER/BUSINESS_OWNER/SUPERVISOR/STAFF) endpoints live under `/me` — same "own-resource,
 * cross-Business" convention as lib/api/review.ts's Customer endpoints.
 */

export type SupportTicketStatus = "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";

export interface SupportTicketStatusHistoryEntry {
  previousStatus: SupportTicketStatus | null;
  resultingStatus: SupportTicketStatus;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  reference: string;
  subject: string;
  status: SupportTicketStatus;
  businessId?: string;
  bookingId?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: SupportTicketStatusHistoryEntry[];
}

export interface SupportTicketListResult {
  tickets: SupportTicket[];
  pagination: { page: number; limit: number; total: number };
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderRole: "CUSTOMER" | "BUSINESS_OWNER" | "SUPERVISOR" | "STAFF" | "SUPER_ADMIN";
  message: string;
  createdAt: string;
}

export interface SupportMessageListResult {
  messages: SupportMessage[];
  pagination: { page: number; limit: number; total: number };
}

export interface CreateSupportTicketInput {
  subject: string;
  message: string;
  bookingId?: string;
}

export const supportApi = {
  create: (input: CreateSupportTicketInput) =>
    apiRequest<SupportTicket>({ method: "POST", url: "/me/support/tickets", data: input }),

  list: (pagination: { page?: number; limit?: number } = {}) =>
    apiRequest<SupportTicketListResult>({
      method: "GET",
      url: "/me/support/tickets",
      params: {
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),

  getById: (ticketId: string) =>
    apiRequest<SupportTicket>({ method: "GET", url: `/me/support/tickets/${ticketId}` }),

  listMessages: (ticketId: string, pagination: { page?: number; limit?: number } = {}) =>
    apiRequest<SupportMessageListResult>({
      method: "GET",
      url: `/me/support/tickets/${ticketId}/messages`,
      params: {
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),

  reply: (ticketId: string, message: string) =>
    apiRequest<SupportMessage>({
      method: "POST",
      url: `/me/support/tickets/${ticketId}/messages`,
      data: { message },
    }),

  reopen: (ticketId: string) =>
    apiRequest<SupportTicket>({ method: "POST", url: `/me/support/tickets/${ticketId}/reopen` }),
};
