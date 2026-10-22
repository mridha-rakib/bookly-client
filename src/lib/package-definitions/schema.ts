import { z } from "zod";
import type { DefinitionInput, PackageDefinition } from "@/lib/api/package-definitions";

const safe = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positive = safe.min(1);
const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identity");
const months = z.union([z.literal(6), z.literal(12)]);
const ownerTerms = z.union([
  z.object({ validityMonths: months }).strict(),
  z
    .object({
      validity: z.discriminatedUnion("mode", [
        z.object({ mode: z.literal("FINITE"), months }).strict(),
        z.object({ mode: z.literal("FOREVER") }).strict(),
      ]),
    })
    .strict(),
]);
export const definitionInputSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a Package name").max(200),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
    isFeatured: z.boolean(),
    serviceCategoryId: id.optional(),
    subcategory: z.string().trim().min(1).optional(),
    bundlePriceCents: safe.optional(),
    contractTerms: ownerTerms.optional(),
    items: z.array(
      z
        .object({
          itemId: id.optional(),
          serviceId: id,
          includedSessions: positive,
          referenceUnitPriceCents: positive.optional(),
          penaltyBasisCents: safe.max(5000).optional(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    for (const key of ["serviceId", "itemId"] as const) {
      const ids = value.items.flatMap((item) => (item[key] ? [item[key]!.toLowerCase()] : []));
      if (new Set(ids).size !== ids.length) issue(["items"], `Duplicate ${key}`);
    }
    const total = value.items.reduce((sum, item) => sum + BigInt(item.includedSessions), 0n);
    const reference = value.items.reduce(
      (sum, item) =>
        sum + BigInt(item.includedSessions) * BigInt(item.referenceUnitPriceCents ?? 0),
      0n,
    );
    if (total > BigInt(Number.MAX_SAFE_INTEGER) || reference > BigInt(Number.MAX_SAFE_INTEGER))
      issue(["items"], "Package totals exceed the supported range");
    if (
      value.items.length &&
      value.items.every((item) => item.referenceUnitPriceCents !== undefined) &&
      value.bundlePriceCents !== undefined &&
      BigInt(value.bundlePriceCents) > reference
    )
      issue(["bundlePriceCents"], "Selling price cannot exceed the comparison total");
    if (value.status !== "DRAFT") {
      for (const key of ["serviceCategoryId", "subcategory", "bundlePriceCents"] as const)
        if (value[key] === undefined) issue([key], "Required for publication");
      if (!value.items.length) issue(["items"], "Include at least one Service");
      value.items.forEach((item, i) => {
        if (item.referenceUnitPriceCents === undefined)
          issue(["items", i, "referenceUnitPriceCents"], "Required for publication");
      });
    }
  });

/** Parse decimal text exactly, with no float multiplication, rounding or clamping. */
export function euroToCents(text: string): number | undefined {
  if (text === "") return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Enter EUR with up to two decimal places");
  const [whole, fraction = ""] = text.split(".");
  const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Amount exceeds the supported range");
  return Number(value);
}
export function centsToEuro(cents: number | undefined): string {
  if (cents === undefined) return "";
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid stored amount");
  const value = BigInt(cents);
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
export type ValidityChoice = "UNCONFIGURED" | "6" | "12" | "FOREVER";
export interface DefinitionFormState {
  name: string;
  description: string;
  descriptionPresent: boolean;
  serviceCategoryId: string;
  subcategory: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  isFeatured: boolean;
  bundlePrice: string;
  validity: ValidityChoice;
  validityVersion: 1 | 2;
  items: {
    itemId?: string;
    serviceId: string;
    includedSessions: string;
    referencePrice: string;
    penaltyBasis: string;
  }[];
}
export function definitionToForm(dto?: PackageDefinition): DefinitionFormState {
  const terms = dto?.contractTerms;
  return {
    name: dto?.name ?? "",
    description: dto?.description ?? "",
    descriptionPresent: dto?.description !== undefined,
    serviceCategoryId: dto?.serviceCategoryId ?? "",
    subcategory: dto?.subcategory ?? "",
    status: dto?.status === "ARCHIVED" ? "DRAFT" : (dto?.status ?? "DRAFT"),
    isFeatured: dto?.isFeatured ?? false,
    bundlePrice: centsToEuro(dto?.bundlePriceCents),
    validity: !terms
      ? "UNCONFIGURED"
      : terms.version === 1
        ? (String(terms.validityMonths) as "6" | "12")
        : terms.validity.mode === "FOREVER"
          ? "FOREVER"
          : (String(terms.validity.months) as "6" | "12"),
    validityVersion: terms?.version ?? 2,
    items:
      dto?.items.map((item) => ({
        itemId: item.itemId,
        serviceId: item.serviceId,
        includedSessions: String(item.includedSessions),
        referencePrice: centsToEuro(item.referenceUnitPriceCents),
        penaltyBasis: centsToEuro(item.penaltyBasisCents),
      })) ?? [],
  };
}
export function formToDefinition(form: DefinitionFormState): DefinitionInput {
  const money = (text: string, label: string) => {
    try {
      return euroToCents(text);
    } catch (error) {
      throw new Error(`${label}: ${(error as Error).message}`);
    }
  };
  const terms =
    form.validity === "UNCONFIGURED"
      ? undefined
      : form.validity === "FOREVER"
        ? { validity: { mode: "FOREVER" as const } }
        : form.validityVersion === 1
          ? { validityMonths: Number(form.validity) as 6 | 12 }
          : {
              validity: {
                mode: "FINITE" as const,
                months: Number(form.validity) as 6 | 12,
              },
            };
  const body = {
    name: form.name,
    ...(form.description || form.descriptionPresent ? { description: form.description } : {}),
    status: form.status,
    isFeatured: form.isFeatured,
    ...(form.serviceCategoryId ? { serviceCategoryId: form.serviceCategoryId } : {}),
    ...(form.subcategory ? { subcategory: form.subcategory } : {}),
    ...(terms ? { contractTerms: terms } : {}),
    bundlePriceCents: money(form.bundlePrice, "Selling price"),
    items: form.items.map((item, i) => ({
      ...(item.itemId ? { itemId: item.itemId } : {}),
      serviceId: item.serviceId,
      includedSessions: /^\d+$/.test(item.includedSessions) ? Number(item.includedSessions) : NaN,
      referenceUnitPriceCents: money(item.referencePrice, `Service ${i + 1} reference price`),
      penaltyBasisCents: money(item.penaltyBasis, `Service ${i + 1} penalty basis`),
    })),
  };
  return definitionInputSchema.parse(body);
}
