import { z } from "zod";

import type { AddonInput } from "@/lib/api/addons";

// Client-side mirror of api/src/modules/addons/addon.schema.ts's status-aware rules — for
// immediate inline UX feedback only. The server remains the authority; nothing here replaces
// that validation.
const centsSchema = z.number().int("Must be a whole number of cents").min(0);

export const addonInputSchema = z
  .object({
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
    name: z.string().trim().min(1, "Required").max(200),
    description: z.string().trim().max(2000).optional(),
    priceCents: centsSchema.optional(),
    customServiceCategoryId: z.string().min(1).optional(),
    assignedServiceIds: z.array(z.string()).optional()
  })
  .superRefine((value, context) => {
    // DRAFT allows incomplete data — only `name` (checked above) is required.
    if (value.status === "DRAFT") {
      return;
    }

    if (value.priceCents === undefined) {
      context.addIssue({ code: "custom", path: ["priceCents"], message: "Required" });
    }
    if (!value.customServiceCategoryId) {
      context.addIssue({
        code: "custom",
        path: ["customServiceCategoryId"],
        message: "Select a service category"
      });
    }
    if (!value.assignedServiceIds || value.assignedServiceIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["assignedServiceIds"],
        message: "Select at least one service"
      });
    }
  });

export type AddonFormErrors = Record<string, string>;

/** Flattens a ZodError into `{ "priceCents": "message" }` for simple field lookup. */
export const flattenAddonErrors = (error: z.ZodError): AddonFormErrors => {
  const errors: AddonFormErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
};

export const validateAddonInput = (
  input: AddonInput
): { success: true; data: AddonInput } | { success: false; errors: AddonFormErrors } => {
  const result = addonInputSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as AddonInput };
  }
  return { success: false, errors: flattenAddonErrors(result.error) };
};
