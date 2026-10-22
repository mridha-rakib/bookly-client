"use client";

import { useState, type FormEvent } from "react";
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
    <div className="space-y-5">
      <button
        type="button"
        aria-label="Back to Packages"
        className="inline-flex items-center gap-2 text-[13px] font-medium text-[#888780] hover:text-black focus-visible:ring-2 focus-visible:ring-[#2E9DA7]"
        onClick={props.onDone}
      >
        <span aria-hidden="true">&#8592;</span>
        <span>Back to Packages</span>
      </button>
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
    <form onSubmit={submit} className="w-full max-w-[1100px] space-y-8 xl:pl-[110px]">
      <div>
        <h2 className="text-lg font-semibold text-[#1C1917]">
          {readOnly ? "Package details" : definition ? "Edit Package" : "Create Package"}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure the Package catalog for your Business.{" "}
          {archived
            ? "This definition stays archived until you restore it."
            : "Save a draft or complete the required fields to publish."}
        </p>
      </div>
      {definition && <DefinitionQualification definition={definition} />}
      {readOnly && definition && (
        <p className="text-sm">
          Comparison total: {euro(definition.referenceTotalCents)} · Savings:{" "}
          {euro(definition.savingsCents)} · Included sessions: {definition.totalSessions}
        </p>
      )}
      {error !== undefined && <DefinitionError error={error} />}
      {reviewRequired && (
        <section
          aria-label="Revision conflict"
          className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4"
        >
          <h3 className="font-semibold">This Package changed while you were editing.</h3>
          <p className="text-sm">
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
            <p className="text-sm">
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
                required
              />
            </Field>
            <Field label="Business category">
              <input className={inputClass} value={businessCategory} readOnly />
            </Field>
            <Field label="Service category">
              <select
                className={inputClass}
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
                className={inputClass}
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
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </Field>
        </FormSection>
        <section aria-label="Included Services" className="space-y-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.55px] text-[#111111]">
            Included Services
          </h3>
          <p className="text-xs leading-5 text-[#757575]">
            Choose ordinary FIXED Services. The server checks provider, status and travel
            eligibility. Reference prices are for comparison only.
          </p>
          {form.items.length === 0 && <p className="text-sm">No Services included yet.</p>}
          {form.items.map((item, i) => (
            <fieldset
              key={item.itemId ?? item.serviceId}
              className="space-y-4 rounded-xl border border-[#F5F5F4] bg-white p-5 shadow-sm"
            >
              <legend className="px-1 font-medium">
                {services.find((service) => service.id === item.serviceId)?.name ??
                  `Unavailable Service ${item.serviceId}`}
              </legend>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Included sessions">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={item.includedSessions}
                    onChange={(e) => setItem(i, "includedSessions", e.target.value)}
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
              {!readOnly && (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() =>
                    set(
                      "items",
                      form.items.filter((_, index) => index !== i),
                    )
                  }
                >
                  Remove{" "}
                  {services.find((service) => service.id === item.serviceId)?.name ?? "Service"}
                </button>
              )}
            </fieldset>
          ))}
          {!readOnly && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Add a FIXED Service">
                <select
                  className={inputClass}
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
              <button
                type="button"
                className={buttonClass}
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
                Add Service
              </button>
            </div>
          )}
        </section>
        <FormSection title="Pricing">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Selling price (EUR)">
              <input
                inputMode="decimal"
                className={inputClass}
                value={form.bundlePrice}
                onChange={(e) => set("bundlePrice", e.target.value)}
                placeholder="Unconfigured"
              />
            </Field>
            <div className="rounded-xl border border-[#F5F5F4] bg-white p-4 text-sm text-[#57534D]">
              <p>Comparison prices are independent of penalty bases.</p>
              {definition && (
                <p className="mt-2">
                  Saved comparison total: {euro(definition.referenceTotalCents)} / Savings:{" "}
                  {euro(definition.savingsCents)}
                </p>
              )}
            </div>
          </div>
        </FormSection>
        <FormSection title="Validity">
          <Field label="Package validity">
            <select
              className={inputClass}
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
          <div className="grid gap-4 md:grid-cols-2">
            {form.items.map((item, i) => (
              <fieldset
                key={item.itemId ?? item.serviceId}
                className="min-w-0 space-y-3 rounded-xl border border-[#F5F5F4] bg-white p-5"
              >
                <legend className="px-1 text-sm font-medium text-[#111111]">
                  {services.find((service) => service.id === item.serviceId)?.name ??
                    `Unavailable Service ${item.serviceId}`}
                </legend>
                <Field label="Penalty basis (EUR, 0–50)">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={item.penaltyBasis}
                    onChange={(e) => setItem(i, "penaltyBasis", e.target.value)}
                    placeholder="Unconfigured"
                  />
                </Field>
              </fieldset>
            ))}
          </div>
          <aside className="rounded-xl border border-[#C6C19F] bg-[#F5F4EE] p-5 text-xs leading-5 text-[#57534D]">
            Fixed EUR limits: basis up to EUR 50 per included session; capture up to EUR 25 per
            appointment; purchased lifetime cap is the lower of EUR 100 and 50% of sold Package
            price, rounded down to cents. A zero-price Package has zero cash capacity. Configuring
            these terms does not authorize collecting money or establish customer consent.
          </aside>
        </FormSection>
        <FormSection title="Publication / Status">
          <div className="space-y-4 rounded-xl border border-[#C6C19F] bg-[#F5F4EE] p-5">
            {!archived ? (
              <Field label="Definition status">
                <select
                  className={inputClass}
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
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
        <div className="flex flex-wrap justify-end gap-3 border-t border-[#F5F5F4] pt-6">
          <button type="submit" className={primaryClass} disabled={disabled || reviewRequired}>
            {mutation.isPending ? "Saving…" : archived ? "Save archived Package" : "Save Package"}
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={mutation.isPending}
            onClick={props.onDone}
          >
            Cancel
          </button>
        </div>
      )}
    </form>
  );
}
