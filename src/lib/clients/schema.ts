import { z } from "zod";

import type { CreateClientInput } from "@/lib/api/clients";
import { CLIENT_PROPERTY_TYPES, CLIENT_TAGS } from "@/lib/api/clients";
import { BUSINESS_CITIES } from "@/lib/constants/cities";

// Client-side mirror of api/src/modules/client/client.schema.ts — for immediate inline UX
// feedback only. The server remains the authority; nothing here replaces that validation.
const addressSchema = z.object({
  city: z.enum(BUSINESS_CITIES),
  propertyType: z.enum(CLIENT_PROPERTY_TYPES),
  area: z.string().trim().min(1, "Required"),
  streetName: z.string().trim().min(1, "Required"),
  streetNumber: z.string().trim().min(1, "Required"),
  floorUnit: z.string().trim().optional(),
  aptRoom: z.string().trim().optional(),
  additionalDirections: z.string().trim().optional(),
});

export const clientInputSchema = z.object({
  firstName: z.string().trim().min(1, "Required"),
  lastName: z.string().trim().optional(),
  email: z.string().trim().min(1, "Required").email("Enter a valid email"),
  phone: z.object({
    countryCode: z.string().trim().min(1, "Required"),
    nationalNumber: z.string().trim().min(4, "Enter a valid phone number"),
  }),
  dateOfBirth: z.string().trim().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  address: addressSchema,
  notes: z.string().trim().optional(),
  tag: z.enum(CLIENT_TAGS).optional(),
});

export type ClientFormErrors = Record<string, string>;

/** Flattens a ZodError into `{ "address.city": "message" }` for simple field lookup. */
export const flattenClientErrors = (error: z.ZodError): ClientFormErrors => {
  const errors: ClientFormErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
};

export const validateClientInput = (
  input: CreateClientInput,
): { success: true; data: CreateClientInput } | { success: false; errors: ClientFormErrors } => {
  const result = clientInputSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as CreateClientInput };
  }
  return { success: false, errors: flattenClientErrors(result.error) };
};
