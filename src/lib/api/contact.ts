import { apiRequest } from "@/lib/api/client";

/** Batch 15B — the public Contact form's real backend. No auth required (matches
 * api/src/modules/support/contact.route.ts). Deliberately NOT a Support Ticket — see that
 * route's own doc comment. */

export interface SubmitContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const contactApi = {
  submit: (input: SubmitContactInput) =>
    apiRequest<undefined>({ method: "POST", url: "/contact", data: input }),
};
