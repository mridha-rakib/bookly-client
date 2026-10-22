import { describe, expect, it } from "vitest";
import {
  centsToEuro,
  definitionInputSchema,
  definitionToForm,
  euroToCents,
  formToDefinition,
} from "@/lib/package-definitions/schema";
import { dashboardSectionToSlug, slugToDashboardSection } from "@/lib/dashboard/sections";
import { definition, secondServiceId, serviceId } from "./package-definitions-fixtures";

describe("first-class Owner Package contracts", () => {
  it("preserves an existing empty description without fabricating one on older records", () => {
    expect(formToDefinition(definitionToForm(definition({ description: "" }))).description).toBe(
      "",
    );
    expect(
      formToDefinition(definitionToForm(definition({ description: undefined }))).description,
    ).toBeUndefined();
  });
  it("registers a bidirectional Packages slug without disturbing other sections", () => {
    expect(slugToDashboardSection("packages")).toBe("Packages");
    expect(dashboardSectionToSlug("Packages")).toBe("packages");
    expect(slugToDashboardSection("services")).toBe("Services");
    expect(slugToDashboardSection("invented")).toBeNull();
  });
  it.each([
    ["19.99", 1999],
    ["0", 0],
    ["0.01", 1],
    ["50.0", 5000],
    ["90071992547409.91", Number.MAX_SAFE_INTEGER],
  ])("converts %s exactly", (text, cents) => {
    expect(euroToCents(String(text))).toBe(cents);
    expect(euroToCents(centsToEuro(Number(cents)))).toBe(cents);
  });
  it.each([
    "-1",
    "NaN",
    "Infinity",
    "1.001",
    "1e2",
    "19,99",
    " 1",
    ".5",
    "1.",
    "90071992547409.92",
  ])("rejects malformed/unsafe money %s without clamping", (text) =>
    expect(() => euroToCents(text)).toThrow(),
  );
  it("preserves absent versus zero money", () => {
    expect(euroToCents("")).toBeUndefined();
    expect(centsToEuro(undefined)).toBe("");
    expect(centsToEuro(0)).toBe("0.00");
  });
  it.each([6, 12] as const)("keeps version1 finite %i unchanged on unrelated edits", (months) => {
    const form = definitionToForm(
      definition({
        contractTerms: {
          version: 1,
          validityMonths: months,
          penaltyPolicyVersion: 1,
        },
      }),
    );
    form.name = "Renamed";
    expect(formToDefinition(form).contractTerms).toEqual({
      validityMonths: months,
    });
  });
  it.each([6, 12] as const)("maps version2 finite %i", (months) => {
    const dto = definition({
      contractTerms: {
        version: 2,
        validity: { mode: "FINITE", months },
        penaltyPolicyVersion: 1,
      },
    });
    expect(formToDefinition(definitionToForm(dto)).contractTerms).toEqual({
      validity: { mode: "FINITE", months },
    });
  });
  it("maps explicit FOREVER without platform controls or expiry fields", () => {
    expect(formToDefinition(definitionToForm(definition())).contractTerms).toEqual({
      validity: { mode: "FOREVER" },
    });
  });
  it("never defaults missing validity or missing basis", () => {
    const dto = definition({
      contractTerms: undefined,
      items: [{ itemId: "bbbbbbbbbbbbbbbbbbbbbbbb", serviceId, includedSessions: 1 }],
    });
    const form = definitionToForm(dto);
    expect(form.validity).toBe("UNCONFIGURED");
    expect(form.items[0].penaltyBasis).toBe("");
    form.status = "DRAFT";
    expect(formToDefinition(form).contractTerms).toBeUndefined();
    expect(formToDefinition(form).items[0].penaltyBasisCents).toBeUndefined();
  });
  it("retains complete replacement fields, stable IDs, multiple quantities and explicit P0", () => {
    const dto = definition();
    const result = formToDefinition(definitionToForm(dto));
    expect(result).toEqual({
      name: dto.name,
      description: dto.description,
      status: dto.status,
      isFeatured: dto.isFeatured,
      serviceCategoryId: dto.serviceCategoryId,
      subcategory: dto.subcategory,
      bundlePriceCents: dto.bundlePriceCents,
      items: dto.items,
      contractTerms: { validity: { mode: "FOREVER" } },
    });
    expect(result).not.toHaveProperty("revision");
    expect(result).not.toHaveProperty("businessId");
  });
  it("removes terms/basis/items only when explicitly removed in the form", () => {
    const form = definitionToForm(definition());
    form.validity = "UNCONFIGURED";
    form.items[0].penaltyBasis = "";
    form.items.pop();
    form.bundlePrice = "100.00";
    const result = formToDefinition(form);
    expect(result.contractTerms).toBeUndefined();
    expect(result.items[0].penaltyBasisCents).toBeUndefined();
    expect(result.items).toHaveLength(1);
  });
  it.each(["0.00", "50.00"])("accepts P %s without repricing comparison", (penaltyBasis) => {
    const form = definitionToForm(definition());
    form.items[0].penaltyBasis = penaltyBasis;
    const result = formToDefinition(form);
    expect(result.items[0].referenceUnitPriceCents).toBe(5000);
    expect(result.bundlePriceCents).toBe(19999);
  });
  it.each(["50.01", "-1", "0.001", "90071992547410"])("rejects invalid P %s", (value) => {
    const form = definitionToForm(definition());
    form.items[0].penaltyBasis = value;
    expect(() => formToDefinition(form)).toThrow();
  });
  it("supports zero B with independent positive P", () => {
    const form = definitionToForm(definition());
    form.bundlePrice = "0";
    expect(formToDefinition(form).bundlePriceCents).toBe(0);
    expect(formToDefinition(form).items[1].penaltyBasisCents).toBe(5000);
  });
  it.each([
    { version: 2 },
    { penaltyPolicyVersion: 1 },
    { currency: "EUR" },
    { lifetimeCaptureCapCents: 10000 },
    { appointmentCaptureCapCents: 2500 },
    { formula: "B/2" },
  ])("rejects writable platform control %j", (extra) => {
    const input = formToDefinition(definitionToForm(definition()));
    expect(
      definitionInputSchema.safeParse({
        ...input,
        contractTerms: { ...input.contractTerms, ...extra },
      }).success,
    ).toBe(false);
    expect(definitionInputSchema.safeParse({ ...input, ...extra }).success).toBe(false);
  });
  it.each(["0", "1.1", "-1", "9007199254740992"])("rejects invalid session count %s", (value) => {
    const form = definitionToForm(definition());
    form.items[0].includedSessions = value;
    expect(() => formToDefinition(form)).toThrow();
  });
  it("rejects duplicate Services and reused item IDs", () => {
    const form = definitionToForm(definition());
    form.items[1].serviceId = serviceId;
    expect(() => formToDefinition(form)).toThrow();
    form.items[1].serviceId = secondServiceId;
    form.items[1].itemId = form.items[0].itemId;
    expect(() => formToDefinition(form)).toThrow();
  });
  it("checks exact aggregate limits and comparison price independently", () => {
    const form = definitionToForm(definition());
    form.items[0].includedSessions = String(Number.MAX_SAFE_INTEGER);
    expect(() => formToDefinition(form)).toThrow();
    const other = definitionToForm(definition());
    other.bundlePrice = "1000";
    expect(() => formToDefinition(other)).toThrow();
  });
  it("allows incomplete drafts but requires publication fields", () => {
    const form = definitionToForm();
    form.name = "Draft";
    expect(formToDefinition(form).items).toEqual([]);
    form.status = "ACTIVE";
    expect(() => formToDefinition(form)).toThrow();
  });
});
