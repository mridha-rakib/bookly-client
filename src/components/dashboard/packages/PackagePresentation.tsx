"use client";

import type { ReactNode } from "react";
import { ZodError } from "zod";
import { normalizeApiError } from "@/lib/api/client";
import type { PackageDefinition } from "@/lib/api/package-definitions";
import { toUserMessage } from "@/lib/auth/messages";
import { centsToEuro } from "@/lib/package-definitions/schema";

export const inputClass =
  "min-h-[41px] w-full min-w-0 rounded-[12px] border border-[#111111]/20 bg-white px-3 py-2 font-poppins text-sm text-[#111111] placeholder:text-[#757575] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] disabled:bg-[#F5F5F4] disabled:text-[#757575]";
export const buttonClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-[#D3D1C7] bg-white px-4 py-2 font-manrope text-sm font-semibold text-[#111111] hover:bg-[#F5F4EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] disabled:cursor-not-allowed disabled:opacity-50";
export const primaryClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#111111] px-4 py-2 font-manrope text-sm font-semibold text-white shadow-sm hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-2 font-poppins text-xs font-normal leading-[18px] text-[#111111]">
      {label}
      {children}
    </label>
  );
}
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-medium uppercase tracking-[0.55px] text-[#111111]">{title}</h3>
      {children}
    </section>
  );
}
export function validityLabel(definition: PackageDefinition): string {
  const terms = definition.contractTerms;
  return !terms
    ? "Unconfigured"
    : terms.version === 1
      ? `${terms.validityMonths} Months`
      : terms.validity.mode === "FOREVER"
        ? "Forever"
        : `${terms.validity.months} Months`;
}
export function DefinitionStatus({ status }: { status: PackageDefinition["status"] }) {
  const style =
    status === "ACTIVE"
      ? "bg-[#DFFDDF] text-[#176117]"
      : status === "DRAFT"
        ? "bg-[#F5F4EE] text-[#655E37] border border-[#C6C19F]"
        : "bg-neutral-100 text-[#57534D]";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
const issueText: Record<string, string> = {
  PACKAGE_GROUPING_REQUIRED: "Choose a service category and subcategory.",
  PACKAGE_CATEGORY_INVALID: "The service category is unavailable or inactive.",
  PACKAGE_SUBCATEGORY_INVALID: "Choose a current Business subcategory.",
  PACKAGE_ITEMS_REQUIRED: "Include at least one Service.",
  PACKAGE_PRICING_INCOMPLETE: "Complete the selling price and comparison prices.",
  PACKAGE_SERVICE_INVALID: "An included Service is missing or unavailable for this Business.",
  PACKAGE_SERVICE_NOT_FIXED: "Only ordinary FIXED Services can be included.",
  PACKAGE_FIXED_CONFIG_INVALID: "An included Service needs valid FIXED pricing and duration.",
  PACKAGE_SERVICE_INACTIVE: "An included Service is not active.",
  PACKAGE_PROVIDER_REQUIRED: "An included Service needs an active assigned provider.",
  PACKAGE_TRAVEL_CITY_REQUIRED: "An included Service needs a supported active travel city.",
};
export function DefinitionError({ error, retry }: { error: unknown; retry?: () => void }) {
  const api = normalizeApiError(error);
  const details =
    error instanceof ZodError
      ? error.issues.map((item) => `${item.path.join(".")}: ${item.message}`)
      : api.errors.map(
          (item) =>
            `${item.path ? `${item.path}: ` : ""}${issueText[item.code ?? ""] ?? item.message}`,
        );
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
    >
      <p>{error instanceof ZodError ? "Please check the Package fields." : toUserMessage(error)}</p>
      {details.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {details.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      )}
      {retry && (
        <button type="button" className={`${buttonClass} mt-3`} onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export const euro = (value: number | null | undefined) =>
  value == null ? "Not configured" : `€${centsToEuro(value)}`;
export function DefinitionQualification({ definition }: { definition: PackageDefinition }) {
  return (
    <div className="space-y-3 text-xs text-[#757575]">
      <DefinitionIssues definition={definition} />
      <details className="rounded-xl border border-[#F5F5F4] bg-white p-4">
        <summary className="cursor-pointer font-medium text-[#57534D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7]">
          Definition setup details
        </summary>
        <p className="mt-3">
          Revision {definition.revision} · Catalog sellable: {definition.sellable ? "Yes" : "No"} ·
          New contract terms complete: {definition.newContractReady ? "Yes" : "No"}
        </p>
      </details>
    </div>
  );
}
export function DefinitionIssues({ definition }: { definition: PackageDefinition }) {
  return definition.dependencyIssues.length > 0 ? (
    <ul className="list-disc pl-5 text-amber-900">
      {definition.dependencyIssues.map((issue, i) => (
        <li key={i}>
          {issueText[issue.code] ?? issue.code}
          {issue.itemId ? ` (item ${issue.itemId})` : ""}
        </li>
      ))}
    </ul>
  ) : null;
}
export function DefinitionSummary({ definition }: { definition: PackageDefinition }) {
  const terms = definition.contractTerms;
  const validity = !terms
    ? "Unconfigured"
    : terms.version === 1
      ? `${terms.validityMonths} months`
      : terms.validity.mode === "FOREVER"
        ? "Forever"
        : `${terms.validity.months} months`;
  return (
    <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
      <h3 className="font-semibold">
        {definition.name} · revision {definition.revision}
      </h3>
      <p>{definition.description || "No description"}</p>
      <p>
        {definition.category} / {definition.subcategory || "No subcategory"} · Group:{" "}
        {definition.serviceCategoryId || "Unconfigured"} · Featured:{" "}
        {definition.isFeatured ? "Yes" : "No"}
      </p>
      <p>
        Selling price: {euro(definition.bundlePriceCents)} · Validity: {validity}
      </p>
      <ul className="space-y-1">
        {definition.items.map((item) => (
          <li key={item.itemId}>
            Service {item.serviceId}: {item.includedSessions} sessions · Reference{" "}
            {euro(item.referenceUnitPriceCents)} · Penalty basis {euro(item.penaltyBasisCents)}
          </li>
        ))}
      </ul>
      <DefinitionQualification definition={definition} />
    </div>
  );
}
