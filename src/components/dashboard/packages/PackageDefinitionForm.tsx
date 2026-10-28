"use client";

import { useState, type FormEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  Delete02Icon,
  PlusSignIcon,
  Layers01Icon,
  Shield01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { PackageDefinition, EditableDefinitionStatus } from "@/lib/api/package-definitions";
import type { Service, ServiceCategory } from "@/lib/api/services";
import { normalizeApiError } from "@/lib/api/client";
import { useBusinessQuery } from "@/lib/business/hooks";
import { useServicesQuery, useServiceCategoriesQuery } from "@/lib/services/hooks";
import { useDefinitionMutation, useDefinitionQuery } from "@/lib/package-definitions/hooks";
import {
  definitionToForm,
  formToDefinition,
  type DefinitionFormState,
  type ValidityChoice,
} from "@/lib/package-definitions/schema";
import { toast } from "@/components/ui/sonner";
import {
  buttonClass,
  primaryClass,
  inputClass,
  selectClass,
  selectArrowStyle,
  Field,
  DefinitionError,
  DefinitionQualification,
  DefinitionSummary,
  euro,
  FormSection,
  DefinitionStatus,
} from "./PackagePresentation";

interface Props {
  businessId: string;
  mode: "create" | "edit" | "view";
  packageId?: string;
  onDone: () => void;
}

export default function PackageDefinitionForm(props: Props) {
  const detail = useDefinitionQuery(props.businessId, props.packageId);
  const services = useServicesQuery(props.businessId);
  const categories = useServiceCategoriesQuery(props.businessId);
  const business = useBusinessQuery(props.businessId);
  const queries = [services, categories, business, ...(props.mode !== "create" ? [detail] : [])];
  const failure = queries.find((query) => query.isError && !query.data);

  return (
    <div className="w-full max-w-[1100px] space-y-6 xl:pl-[110px]">
      <div>
        <button
          type="button"
          aria-label="Back to Packages"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#888780] transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7]"
          onClick={props.onDone}
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          <span>Back to Packages</span>
        </button>
      </div>
      {failure ? (
        <DefinitionError
          error={failure.error}
          retry={() => {
            void failure.refetch();
          }}
        />
      ) : queries.some((query) => query.isPending) ? (
        <p role="status">Loading Package details…</p>
      ) : props.mode !== "create" && !detail.data ? (
        <p role="alert">This Package is unavailable.</p>
      ) : detail.data && detail.data.businessId !== props.businessId ? (
        <p role="alert">This Package belongs to another Business.</p>
      ) : (
        <DefinitionEditor
          key={props.packageId ?? "create"}
          {...props}
          definition={props.mode === "create" ? undefined : detail.data}
          services={services.data?.services ?? []}
          categories={categories.data ?? []}
          businessCategory={business.data?.category ?? ""}
          subcategories={business.data?.subcategories ?? []}
          reload={async () => {
            const result = await detail.refetch();
            if (result.error) throw result.error;
            if (!result.data) throw new Error("Current Package is unavailable.");
            return result.data;
          }}
        />
      )}
    </div>
  );
}

function DefinitionEditor({
  definition: initialDefinition,
  services,
  categories,
  businessCategory,
  subcategories,
  reload,
  ...props
}: Props & {
  definition?: PackageDefinition;
  services: Service[];
  categories: ServiceCategory[];
  businessCategory: string;
  subcategories: string[];
  reload: () => Promise<PackageDefinition>;
}) {
  // Initialize once from complete detail; background refetches never overwrite unsaved edits.
  const [definition, setDefinition] = useState(initialDefinition);
  const [form, setForm] = useState(() => definitionToForm(definition));
  const [revision, setRevision] = useState(definition?.revision);
  const [error, setError] = useState<unknown>();
  const [conflict, setConflict] = useState<PackageDefinition>();
  const [reviewRequired, setReviewRequired] = useState(false);
  const [loadingConflict, setLoadingConflict] = useState(false);
  const [addingService, setAddingService] = useState("");
  const mutation = useDefinitionMutation(props.businessId);
  const readOnly = props.mode === "view";
  const archived = definition?.status === "ARCHIVED";
  const disabled = readOnly || mutation.isPending || loadingConflict;

  const set = <K extends keyof DefinitionFormState>(key: K, value: DefinitionFormState[K]) =>
    setForm((old) => ({ ...old, [key]: value }));

  const setItem = (
    index: number,
    key: "includedSessions" | "referencePrice" | "penaltyBasis",
    value: string,
  ) =>
    setForm((old) => ({
      ...old,
      items: old.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));

  const currentIds = new Set(form.items.map((item) => item.serviceId));
  const choices = services.filter(
    (service) =>
      !service.isPackageDeal && service.pricingMode === "FIXED" && !currentIds.has(service.id),
  );

  const loadConflict = async () => {
    setLoadingConflict(true);
    try {
      setConflict(await reload());
    } catch (failure) {
      setError(failure);
    } finally {
      setLoadingConflict(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || reviewRequired) return;
    setError(undefined);
    try {
      const input = formToDefinition(form);
      await mutation.mutateAsync(
        definition
          ? {
              kind: "update",
              id: definition.id,
              input: { ...input, expectedRevision: revision! },
            }
          : { kind: "create", input },
      );
      toast.success(definition ? "Package updated" : "Package created");
      props.onDone();
    } catch (failure) {
      setError(failure);
      if (normalizeApiError(failure).code === "PACKAGE_REVISION_CONFLICT") {
        setReviewRequired(true);
        await loadConflict();
      }
    }
  };

  const compatibleReview =
    conflict &&
    conflict.businessId === props.businessId &&
    conflict.status === definition?.status &&
    form.items.every(
      (item) =>
        !item.itemId ||
        conflict.items.some(
          (current) => current.itemId === item.itemId && current.serviceId === item.serviceId,
        ),
    );

  return (
    <form onSubmit={submit} className="w-full space-y-8">
      <div className="border-b border-[#E7E5E4] pb-4">
        <h2 className="font-poppins text-lg font-semibold text-[#1C1917]">
          {readOnly ? "Package details" : definition ? "Edit Package" : "Create Package"}
        </h2>
        <p className="mt-1 text-sm text-[#757575]">
          Configure the Package catalog for your Business.{" "}
          {archived
            ? "This definition stays archived until you restore it."
            : "Save a draft or complete the required fields to publish."}
        </p>
      </div>

      {definition && <DefinitionQualification definition={definition} />}

      {readOnly && definition && (
        <p className="text-sm text-[#57534D]">
          Comparison total: {euro(definition.referenceTotalCents)} · Savings:{" "}
          {euro(definition.savingsCents)} · Included sessions: {definition.totalSessions}
        </p>
      )}

      {error !== undefined && <DefinitionError error={error} />}

      {reviewRequired && (
        <section
          aria-label="Revision conflict"
          className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
        >
          <h3 className="font-semibold text-amber-900">This Package changed while you were editing.</h3>
          <p className="text-sm text-amber-800">
            Your unsaved changes remain below. Review the latest saved definition before retrying.
            Keeping your edits will replace its fields.
          </p>
          {conflict && <DefinitionSummary definition={conflict} />}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={loadingConflict}
              onClick={() => void loadConflict()}
            >
              Refresh latest definition
            </button>
            {conflict && (
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  setDefinition(conflict);
                  setForm(definitionToForm(conflict));
                  setRevision(conflict.revision);
                  setReviewRequired(false);
                  setConflict(undefined);
                  setError(undefined);
                }}
              >
                Discard my edits and load latest
              </button>
            )}
            {compatibleReview && (
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  setDefinition(conflict);
                  setRevision(conflict!.revision);
                  setReviewRequired(false);
                  setConflict(undefined);
                  setError(undefined);
                }}
              >
                I reviewed the latest version — keep my edits
              </button>
            )}
          </div>
          {conflict && !compatibleReview && (
            <p className="text-sm text-amber-800">
              The status or item identities changed. Load the latest definition before editing
              again.
            </p>
          )}
        </section>
      )}

      <fieldset disabled={disabled} className="space-y-8">
        <legend className="sr-only">Package definition fields</legend>

        <FormSection title="Basic Package Information">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Package name">
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={200}
                placeholder="e.g. 5-Session Grooming Bundle"
                required
              />
            </Field>
            <Field label="Business category">
              <input
                className={`${inputClass} bg-[#F9F9F8] text-[#57534D] cursor-not-allowed`}
                value={businessCategory}
                readOnly
              />
            </Field>
            <Field label="Service category">
              <select
                className={selectClass}
                style={selectArrowStyle}
                value={form.serviceCategoryId}
                onChange={(e) => set("serviceCategoryId", e.target.value)}
              >
                <option value="">Unconfigured</option>
                {form.serviceCategoryId &&
                  !categories.some((item) => item.id === form.serviceCategoryId) && (
                    <option value={form.serviceCategoryId}>Current unavailable category</option>
                  )}
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {!item.active ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Business subcategory">
              <select
                className={selectClass}
                style={selectArrowStyle}
                value={form.subcategory}
                onChange={(e) => set("subcategory", e.target.value)}
              >
                <option value="">Unconfigured</option>
                {form.subcategory && !subcategories.includes(form.subcategory) && (
                  <option value={form.subcategory}>{form.subcategory} (unavailable)</option>
                )}
                {subcategories.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea
              className={inputClass}
              value={form.description}
              maxLength={2000}
              placeholder="Describe the package bundle, perks, and terms for your clients..."
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </Field>
        </FormSection>

        <section aria-label="Included Services" className="space-y-4">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-[0.55px] text-[#111111]">
              Included Services
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#757575]">
              Choose ordinary FIXED Services. The server checks provider, status and travel
              eligibility. Reference prices are for comparison only.
            </p>
          </div>

          {form.items.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#D3D1C7] bg-white p-6 text-center text-sm text-[#757575]">
              No Services included yet.
            </div>
          )}

          <div className="space-y-4">
            {form.items.map((item, i) => {
              const serviceName =
                services.find((service) => service.id === item.serviceId)?.name ??
                `Unavailable Service ${item.serviceId}`;

              return (
                <div
                  key={item.itemId ?? item.serviceId}
                  className="rounded-xl border border-[#E7E5E4] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F5F5F4] pb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2E9DA7]/10 text-[#195156]">
                        <HugeiconsIcon icon={Layers01Icon} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-poppins font-medium text-sm text-[#111111] truncate">
                          {serviceName}
                        </h4>
                        <span className="text-[11px] text-[#757575]">Fixed service</span>
                      </div>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={`Remove ${serviceName}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-3 py-1.5 font-manrope text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        onClick={() =>
                          set(
                            "items",
                            form.items.filter((_, index) => index !== i),
                          )
                        }
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="h-3.5 w-3.5 shrink-0" />
                        <span>Remove {serviceName}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 pt-1">
                    <Field label="Included sessions">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={item.includedSessions}
                        onChange={(e) => setItem(i, "includedSessions", e.target.value)}
                        placeholder="1"
                        required
                      />
                    </Field>
                    <Field label="Reference unit price (EUR)">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={item.referencePrice}
                        onChange={(e) => setItem(i, "referencePrice", e.target.value)}
                        placeholder="Unconfigured"
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          {!readOnly && (
            <div className="rounded-xl border border-dashed border-[#D3D1C7] bg-[#FAFAF8] p-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 min-w-0">
                  <Field label="Add a FIXED Service">
                    <select
                      className={selectClass}
                      style={selectArrowStyle}
                      value={addingService}
                      onChange={(e) => setAddingService(e.target.value)}
                    >
                      <option value="">Choose a Service</option>
                      {choices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} ({service.status})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <button
                  type="button"
                  className={`${buttonClass} shrink-0`}
                  disabled={!addingService}
                  onClick={() => {
                    const original = definitionToForm(definition).items.find(
                      (item) => item.serviceId === addingService,
                    );
                    set("items", [
                      ...form.items,
                      original ?? {
                        serviceId: addingService,
                        includedSessions: "1",
                        referencePrice: "",
                        penaltyBasis: "",
                      },
                    ]);
                    setAddingService("");
                  }}
                >
                  <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4 mr-1 text-[#195156]" />
                  <span>Add Service</span>
                </button>
              </div>
            </div>
          )}
        </section>

        <FormSection title="Pricing">
          <div className="grid gap-5 md:grid-cols-2 items-start">
            <Field label="Selling price (EUR)">
              <input
                inputMode="decimal"
                className={inputClass}
                value={form.bundlePrice}
                onChange={(e) => set("bundlePrice", e.target.value)}
                placeholder="Unconfigured"
              />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="font-poppins text-xs font-normal leading-[18px] text-[#111111]">
                Price Comparison & Savings
              </span>
              <div className="flex min-h-[41px] flex-col justify-center rounded-xl border border-[#E7E5E4] bg-white p-3.5 text-xs text-[#57534D] shadow-xs">
                <p>Comparison prices are independent of penalty bases.</p>
                {definition && (
                  <p className="mt-1.5 font-medium text-[#111111]">
                    Saved comparison total: {euro(definition.referenceTotalCents)} · Savings:{" "}
                    <span className="text-[#176117] font-semibold">{euro(definition.savingsCents)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Validity">
          <Field label="Package validity">
            <select
              className={selectClass}
              style={selectArrowStyle}
              value={form.validity}
              onChange={(e) => {
                set("validity", e.target.value as ValidityChoice);
                set("validityVersion", 2);
              }}
            >
              <option value="UNCONFIGURED">Unconfigured / clear validity</option>
              <option value="6">6 Months</option>
              <option value="12">12 Months</option>
              <option value="FOREVER">Forever</option>
            </select>
          </Field>
          <p className="text-xs leading-5 text-[#757575]">
            Finite validity is a booking deadline anchored to the original successful purchase;
            later session bookings do not restart it. Forever has no Package time expiry. Ordinary
            Calendar availability and eligibility still apply.
          </p>
        </FormSection>

        <FormSection title="Cancellation / No-show Protection">
          <p className="text-xs leading-5 text-[#757575]">
            Set an independent basis for each included Service. Blank is unconfigured; EUR 0.00 is
            an explicit zero basis. Nothing is allocated from the reference or selling price.
          </p>
          {form.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D3D1C7] bg-white p-6 text-center text-xs text-[#757575]">
              Add services above to configure cancellation and no-show protection.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {form.items.map((item, i) => {
                const serviceName =
                  services.find((service) => service.id === item.serviceId)?.name ??
                  `Unavailable Service ${item.serviceId}`;

                return (
                  <div
                    key={item.itemId ?? item.serviceId}
                    className="min-w-0 space-y-3 rounded-xl border border-[#E7E5E4] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 border-b border-[#F5F5F4] pb-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2E9DA7]/10 text-[#195156]">
                        <HugeiconsIcon icon={Shield01Icon} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block font-poppins font-medium text-sm text-[#111111] truncate">
                          {serviceName}
                        </span>
                        <span className="block text-[11px] text-[#757575]">Penalty protection basis</span>
                      </div>
                    </div>
                    <Field label="Penalty basis (EUR, 0–50)">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={item.penaltyBasis}
                        onChange={(e) => setItem(i, "penaltyBasis", e.target.value)}
                        placeholder="Unconfigured"
                      />
                    </Field>
                  </div>
                );
              })}
            </div>
          )}
          <aside className="flex items-start gap-3 rounded-xl border border-[#C6C19F] bg-[#F5F4EE] p-5 text-xs leading-5 text-[#57534D]">
            <HugeiconsIcon icon={InformationCircleIcon} className="h-5 w-5 shrink-0 text-[#195156] mt-0.5" />
            <div>
              Fixed EUR limits: basis up to EUR 50 per included session; capture up to EUR 25 per
              appointment; purchased lifetime cap is the lower of EUR 100 and 50% of sold Package
              price, rounded down to cents. A zero-price Package has zero cash capacity. Configuring
              these terms does not authorize collecting money or establish customer consent.
            </div>
          </aside>
        </FormSection>

        <FormSection title="Publication / Status">
          <div className="space-y-4 rounded-xl border border-[#C6C19F] bg-[#F5F4EE] p-5">
            {!archived ? (
              <Field label="Definition status">
                <select
                  className={selectClass}
                  style={selectArrowStyle}
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as EditableDefinitionStatus)}
                >
                  {(definition && definition.status !== "DRAFT"
                    ? ["ACTIVE", "INACTIVE"]
                    : ["DRAFT", "ACTIVE", "INACTIVE"]
                  ).map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <DefinitionStatus status="ARCHIVED" />
            )}
            <label className="flex items-center gap-2.5 text-sm font-medium text-[#111111] cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-[#2E9DA7] focus:ring-[#2E9DA7]"
                checked={form.isFeatured}
                onChange={(e) => set("isFeatured", e.target.checked)}
              />
              Featured Package
            </label>
            <p className="text-xs leading-5 text-[#757575]">
              Status controls this catalog definition. Saving an archived definition does not
              restore it.
            </p>
          </div>
        </FormSection>
      </fieldset>

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#E7E5E4] pt-6">
          <button
            type="button"
            className={buttonClass}
            disabled={mutation.isPending}
            onClick={props.onDone}
          >
            Cancel
          </button>
          <button type="submit" className={primaryClass} disabled={disabled || reviewRequired}>
            {mutation.isPending ? "Saving…" : archived ? "Save archived Package" : "Save Package"}
          </button>
        </div>
      )}
    </form>
  );
}
