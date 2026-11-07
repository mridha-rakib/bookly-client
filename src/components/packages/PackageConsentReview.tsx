"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { packagePrimaryCta, packageSecondaryCta } from "./package-cta";
import { PackagePurchaseContinuation } from "./PackagePurchaseContinuation";
import { FirstClassBookingConfirmation } from "./FirstClassBookingConfirmation";
import type { PackagePurchaseResult } from "@/lib/api/package-purchase";
import { PackageUnavailable } from "./FirstClassPackageViews";
import type { PackageOffer } from "@/lib/api/package-views";
import type { AvailabilitySlot } from "@/lib/api/catalog";
import type { BusinessCity } from "@/lib/constants/cities";
import { useBusinessCatalogQuery } from "@/lib/catalog/hooks";
import CheckoutSummaryAside, { type WizardStep } from "@/app/venue/components/CheckoutSummaryAside";
import BookingOnboarding from "@/app/venue/components/BookingOnboarding";
import AddonsStep from "@/app/venue/components/AddonsStep";
import TravelAddressStep from "@/app/venue/components/TravelAddressStep";
import ProfessionalsStep from "@/app/venue/components/ProfessionalsStep";
import PaymentStep from "@/app/venue/components/PaymentStep";
import type { BookingSelection } from "@/app/venue/components/BookingSelectionSummary";
import {
  AppointmentSwitcher, FirstClassServicesStep, FirstClassTimeStep, addressFields, durationLabel, eligibleStaff,
  intentSelections, minutesLabel, rowAddress, stepComplete, type FirstClassStep, type Selection,
} from "./FirstClassSelectionSteps";
import { useAuthStore } from "@/lib/auth/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptConsentTerms,
  consentAction,
  getConsentOffer,
  getConsentPresentation,
  getRetainedConsentQuote,
  matchesConsentAcceptance,
  retainConsentQuote,
  type ConsentAction,
  type ConsentAccepted,
  type ConsentIntent,
  type ConsentPresentation,
  type RetainedQuoteAppointment,
} from "@/lib/api/package-consent";

const buttonClass = packagePrimaryCta;
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Terms review is unavailable. Please try again later.";

interface PackageConsentProps {
  businessId: string;
  packageId: string;
  initialOperationId?: string;
  offerSummary?: PackageOffer;
}

/** A different retained operation needs fresh view state. Publishing a newly created
 * operation into this flow's own URL keeps its in-flight intent mounted. */
export default function PackageConsentReview(props: PackageConsentProps) {
  const [createdOperation, setCreatedOperation] = useState<string>();
  const actor = useAuthStore((state) => `${state.user?.id}:${state.cacheEpoch}`);
  const identity = props.initialOperationId && props.initialOperationId !== createdOperation ? props.initialOperationId : "new";
  return <PackageConsentFlow key={`${actor}:${identity}`} {...props} onOperationStarted={setCreatedOperation} />;
}

const addressText = (address: Partial<Record<string, string>> | undefined) =>
  address ? [address["streetName"], address["streetNumber"], address["area"], address["city"], address["floorUnit"], address["aptRoom"],
    address["propertyType"], address["additionalDirections"]].filter(Boolean).join(", ") : "";

const without = <T,>(record: Record<string, T>, id: string) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
const stepOrder = (travel: boolean): FirstClassStep[] => ["services", "addons", ...(travel ? ["travel" as const] : []), "professionals", "time", "payment"];

/** The Normal Booking wizard steps driven by the original consent flow plus separately gated
 * purchase continuation. Quote, consent and purchase state stay in this component only. */
function PackageConsentFlow({
  businessId,
  packageId,
  initialOperationId: requestedOperationId,
  offerSummary,
  onOperationStarted,
}: PackageConsentProps & { onOperationStarted: (operation: string) => void }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const epoch = useAuthStore((s) => s.cacheEpoch);
  // An unaccepted quote the Customer explicitly discarded never re-enters recovery from a stale URL prop.
  const [discarded, setDiscarded] = useState<string[]>([]);
  const initialOperationId = requestedOperationId && !discarded.includes(requestedOperationId) ? requestedOperationId : undefined;
  const presentationKey = (id: string | undefined) => ["packageConsentPresentation", userId, epoch, businessId, id];
  const [operationId, setOperationId] = useState(initialOperationId);
  const [selections, setSelections] = useState<ConsentIntent["selections"]>([]);
  const [presentation, setPresentation] = useState<ConsentPresentation>();
  const [checked, setChecked] = useState(false);
  const [accepted, setAccepted] = useState<ConsentAccepted>();
  const [completedPurchase, setCompletedPurchase] = useState<PackagePurchaseResult>();
  const [showPolicy, setShowPolicy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const action = useRef<ConsentAction | undefined>(undefined);
  const quoteAttempt = useRef<{ operationId: string; intent: ConsentIntent } | undefined>(undefined);
  const [quoteAttemptId, setQuoteAttemptId] = useState<string>();
  const [acceptanceSent, setAcceptanceSent] = useState(false);
  // Updating the URL to retain identity must not switch this mounted in-flight form into a
  // competing presentation read before its quote has finished being retained.
  const localQuoteAttempt = Boolean(initialOperationId && quoteAttemptId === initialOperationId);
  const restored = Boolean(initialOperationId) && !localQuoteAttempt;
  // Wizard selection state. A restored operation opens on Payment: its selections are fixed by the quote.
  const [step, setStep] = useState<FirstClassStep>(restored ? "payment" : "services");
  const [activeId, setActiveId] = useState<string>();
  const [dates, setDates] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Record<string, AvailabilitySlot>>({});
  const [visibleMonth, setVisibleMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [hasSavedCard, setHasSavedCard] = useState(false);
  const [isReplacingCard, setIsReplacingCard] = useState(false);
  const offer = useQuery({
    queryKey: ["packageConsent", userId, epoch, businessId, packageId],
    queryFn: () => getConsentOffer(businessId, packageId),
    enabled: !initialOperationId || localQuoteAttempt,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });
  const retained = useQuery({
    queryKey: presentationKey(initialOperationId),
    queryFn: () => getConsentPresentation(businessId, initialOperationId!),
    enabled: Boolean(initialOperationId) && !localQuoteAttempt,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });
  const displayed = presentation ?? retained.data;
  // Fallback read of the original quote only (never reissued) when the presentation cannot be
  // shown here, e.g. another sign-in session or a passed deadline.
  const original = useQuery({
    queryKey: ["packageConsentOriginalQuote", userId, epoch, businessId, initialOperationId],
    queryFn: () => getRetainedConsentQuote(businessId, initialOperationId!),
    enabled: Boolean(initialOperationId) && retained.isError,
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const catalog = useBusinessCatalogQuery(businessId);
  const travel = (offer.data?.fulfilmentMode ?? offerSummary?.fulfilmentMode ?? catalog.data?.business.visitType) === "TRAVEL_TO_CUSTOMER";
  const timezone = offer.data?.timezone ?? catalog.data?.business.timezone ?? "UTC";
  const selectedPackage = offerSummary ?? (offer.data ? {
    name: offer.data.name, bundlePriceCents: offer.data.bundlePriceCents, fulfilmentMode: offer.data.fulfilmentMode ?? "AT_BUSINESS_LOCATION",
    items: offer.data.items.map((item) => ({ itemId: item.definitionItemId, serviceId: item.serviceId, name: item.name, quantity: item.quantity })),
  } : undefined);
  const itemFor = (row: Selection) => offer.data?.items.find((candidate) => candidate.definitionItemId === row.definitionItemId);
  const itemName = (row: Selection) => itemFor(row)?.name ?? selectedPackage?.items.find((candidate) => candidate.itemId === row.definitionItemId)?.name ?? "Selected included service";
  // Read-only original quote (presentation or quote read). Its appointments come from the server's
  // retained terms, so a refresh, another tab or a later reopening shows the same selections.
  const currentQuote = displayed?.quote ?? original.data?.quote;
  const quotedRows = currentQuote?.appointments;
  const staffName = (staffId: string, definitionItemId?: string) => {
    const provider = offer.data?.items.find((candidate) => candidate.definitionItemId === definitionItemId)?.providers.find((p) => p.id === staffId);
    const member = catalog.data?.staff.find((candidate) => candidate.id === staffId);
    return { professional: provider?.name ?? ([member?.firstName, member?.lastName].filter(Boolean).join(" ") || "Selected professional"),
      ...(member?.avatarUrl ? { avatarUrl: member.avatarUrl } : {}) };
  };
  const quotedAppointment = (row: RetainedQuoteAppointment, timeZone: string): BookingSelection["appointments"][number] => {
    const duration = row.durationMin !== undefined ? minutesLabel(row.durationMin) : durationLabel(row.serviceId, catalog.data);
    const address = addressText(row.location?.address);
    return { id: row.selectionId,
      name: row.serviceName ?? selectedPackage?.items.find((candidate) => candidate.itemId === row.definitionItemId)?.name ?? "Selected included service",
      ...staffName(row.staffMembershipId, row.definitionItemId),
      ...(duration !== undefined ? { durationLabel: `${duration} per session` } : {}),
      startAt: row.startAt, timezone: timeZone,
      ...(row.location ? { locationLabel: row.location.mode === "TRAVEL_TO_CUSTOMER" ? "Professional visits your location" : "Visit the business",
        ...(address ? { address } : {}) } : {}),
      addons: row.addons ?? [], quoted: true,
      ...(row.financials ? { amounts: [{ label: "Upfront", cents: row.financials.upfrontCents }, { label: "At appointment", cents: row.financials.manualVenueDuesCents }] } : {}),
      status: "Quoted · not booked until the purchase is verified",
    };
  };
  const rowCount = quotedRows?.length ?? selections.length;
  const packageName = selectedPackage?.name ?? currentQuote?.name;
  const includedSessions = selectedPackage ? selectedPackage.items.reduce((count, item) => count + item.quantity, 0)
    : currentQuote?.items?.reduce((count, item) => count + item.quantity, 0);
  const selectionSummary: BookingSelection | undefined = packageName ? {
    name: packageName,
    quantityLabel: `${rowCount} initial appointment${rowCount === 1 ? "" : "s"} selected${includedSessions !== undefined ? ` · ${includedSessions} included sessions · ${includedSessions - rowCount} kept as credits` : ""}`,
    ...(!currentQuote && selectedPackage?.bundlePriceCents !== undefined ? { indicativePriceCents: selectedPackage.bundlePriceCents } : {}),
    appointments: quotedRows && currentQuote ? quotedRows.map((row) => quotedAppointment(row, currentQuote.timezone)) : selections.map((row) => {
      const staff = itemFor(row)?.providers.find((provider) => provider.id === row.staffMembershipId);
      const member = catalog.data?.staff.find((candidate) => candidate.id === row.staffMembershipId);
      const address = row.travelAddress;
      const businessAddress = catalog.data?.business.address;
      const duration = durationLabel(row.serviceId, catalog.data);
      return { id: row.selectionId, name: itemName(row),
        ...(staff || member ? { professional: staff?.name ?? [member?.firstName, member?.lastName].filter(Boolean).join(" "), ...(member?.avatarUrl ? { avatarUrl: member.avatarUrl } : {}) } : row.staffMembershipId ? { professional: "Selected professional" } : {}),
        ...(duration !== undefined ? { durationLabel: `${duration} per session` } : {}),
        ...(row.startAt ? { startAt: row.startAt, timezone } : {}),
        ...(travel ? { locationLabel: "Professional visits your location", ...(address?.city ? { address: [address.streetName, address.streetNumber, address.area, address.city, address.floorUnit, address.aptRoom, address.propertyType, address.additionalDirections].filter(Boolean).join(", ") } : {}) }
          : businessAddress ? { locationLabel: "Visit the business", address: [businessAddress.streetName, businessAddress.streetNumber, businessAddress.area, businessAddress.city, businessAddress.floorUnit, businessAddress.aptRoom].filter(Boolean).join(", ") } : {}),
        addons: (itemFor(row)?.addons ?? []).filter((addon) => row.addonIds.includes(addon.id)).map((addon) => ({ id: addon.id, name: addon.name, priceCents: addon.priceCents })),
      };
    }),
  } : undefined;
  const candidate = accepted ?? displayed?.accepted;
  const confirmation =
    candidate &&
    displayed &&
    matchesConsentAcceptance(displayed, { eventId: candidate.eventId } as ConsentAction, candidate)
      ? candidate
      : undefined;
  const allComplete = selections.length > 0 && selections.every((row) =>
    (["travel", "professionals", "time"] as const).every((required) => stepComplete(required, row, travel)));
  const run = async (work: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch (failure) {
      setError(message(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const prepare = () =>
    run(async () => {
      if (!offer.data || !allComplete || (!quoteAttempt.current && offer.data.checkoutAvailable === false)) return;
      const intent = { packageId, expectedRevision: offer.data.revision, selections: intentSelections(selections, travel) };
      quoteAttempt.current ??= { operationId: crypto.randomUUID(), intent };
      const id = quoteAttempt.current.operationId;
      setQuoteAttemptId(id);
      onOperationStarted(id);
      // Persist only the operation selector before dispatch, including a lost quote response.
      const operationUrl = new URL(window.location.href);
      operationUrl.searchParams.set("operation", id);
      window.history.replaceState(
        window.history.state,
        "",
        `${operationUrl.pathname}${operationUrl.search}${operationUrl.hash}`,
      );
      await retainConsentQuote(businessId, id, quoteAttempt.current.intent);
      const p = await getConsentPresentation(businessId, id);
      setOperationId(id);
      setPresentation(p);
      setChecked(false);
      action.current = undefined;
      queryClient.setQueryData(presentationKey(id), p);
    });
  function recordAcceptance(p: ConsentPresentation, result: ConsentAccepted) {
    const next = { ...p, certification: result.certification, purchaseAvailable: result.purchaseAvailable,
      ...(p.quote ? { quote: { ...p.quote, certification: result.certification ?? "UNRESOLVED" as const, purchaseAvailable: result.purchaseAvailable === true } } : {}), accepted: result };
    setAccepted(result);
    setPresentation(next);
    queryClient.setQueryData(presentationKey(operationId), next);
  }
  const actionKey = (id: string) => `bookly:package-consent-action:${userId}:${businessId}:${id}`;
  const submit = () =>
    run(async () => {
      if (!displayed || !checked || !operationId || confirmation) return;
      const key = actionKey(operationId);
      if (!action.current) {
        try {
          const saved = sessionStorage.getItem(key);
          if (saved) {
            const retained = JSON.parse(saved) as ConsentAction;
            if (retained.presentationId !== displayed.presentationId || retained.quoteHash !== displayed.quoteHash || retained.disclosureHash !== displayed.disclosureHash)
              throw Error("Original acceptance identity differs; check its status");
            action.current = retained;
          }
        } catch (failure) {
          if (failure instanceof SyntaxError) throw failure;
          // Storage access may be unavailable; no server authority is inferred from it.
          if (failure instanceof Error && failure.message.startsWith("Original acceptance")) throw failure;
        }
      }
      action.current ??= consentAction(displayed);
      setAcceptanceSent(true);
      try { sessionStorage.setItem(key, JSON.stringify(action.current)); } catch { /* Mounted retries retain the same event. */ }
      const result = await acceptConsentTerms(businessId, operationId, action.current);
      if (!matchesConsentAcceptance(displayed, action.current, result))
        throw new Error("Acceptance confirmation does not match the displayed terms.");
      recordAcceptance(displayed, result);
    });
  // Only a quote this mounted flow issued, with no affirmative action ever dispatched, may be
  // abandoned so different appointments can be quoted under a new operation.
  const acceptanceAttempted = () => {
    if (action.current || !quoteAttemptId) return true;
    try { return sessionStorage.getItem(actionKey(quoteAttemptId)) !== null; } catch { return true; }
  };
  const canChangeSelections = !restored && Boolean(quoteAttemptId) && !confirmation && !busy && !acceptanceSent;
  const changeSelections = () => {
    if (!canChangeSelections || !quoteAttemptId || acceptanceAttempted()) return;
    const abandoned = quoteAttemptId;
    quoteAttempt.current = undefined;
    action.current = undefined;
    setDiscarded((current) => [...current, abandoned]);
    setQuoteAttemptId(undefined);
    setOperationId(undefined);
    setPresentation(undefined);
    setChecked(false);
    setError(undefined);
    const url = new URL(window.location.href);
    url.searchParams.delete("operation");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    setStep("services");
  };
  const failure =
    error ??
    (offer.error && (!initialOperationId || localQuoteAttempt) ? message(offer.error)
      // When the original quote itself is readable, the notice below explains the state instead.
      : retained.error && !original.data && !original.isFetching ? message(retained.error) : undefined);
  const presentationUnavailable = Boolean(retained.isError && original.data && !original.data.acceptanceRecorded);

  const order = stepOrder(travel);
  const locked = restored || Boolean(quoteAttemptId) || Boolean(displayed);
  const active = selections.find((row) => row.selectionId === activeId) ?? selections[0];
  const updateRow = (id: string, change: (row: Selection) => Selection) => {
    if (locked) return;
    setSelections((current) => current.map((row) => row.selectionId === id ? change(row) : row));
  };
  const clearTime = useCallback((id: string) => {
    setSlots((current) => without(current, id));
    setSelections((current) => current.map((row) => row.selectionId === id && row.startAt ? { ...row, startAt: "" } : row));
  }, []);
  const activate = (id: string) => {
    setActiveId(id);
    const date = dates[id];
    if (date) { const [year, month] = date.split("-").map(Number); setVisibleMonth(new Date(year!, month! - 1, 1)); }
  };
  const goTo = (target: FirstClassStep) => {
    setStep(target);
    // Open the first appointment that still needs this step, so the next required action is in view.
    const first = selections.find((row) => !stepComplete(target, row, travel)) ?? selections[0];
    if (first && target !== "services" && target !== "payment") activate(first.selectionId);
  };
  const perAppointment = step !== "services" && step !== "payment";
  const activeComplete = Boolean(active) && stepComplete(step, active!, travel);
  const activeIndex = active ? selections.indexOf(active) : -1;
  const nextIncomplete = perAppointment ? selections.find((row, index) => index !== activeIndex && !stepComplete(step, row, travel)) : undefined;
  const stayInStep = perAppointment && (activeIndex < selections.length - 1 || Boolean(nextIncomplete));
  const canContinue = step === "services" ? selections.length > 0 : perAppointment ? activeComplete : false;
  const onContinue = () => {
    if (!canContinue) return;
    if (stayInStep) { activate((activeIndex < selections.length - 1 ? selections[activeIndex + 1] : nextIncomplete)!.selectionId); return; }
    goTo(order[order.indexOf(step) + 1]!);
  };
  const statusFor = (row: Selection) => {
    const complete = stepComplete(step, row, travel);
    if (step === "addons") return row.addonIds.length ? `${row.addonIds.length} add-on${row.addonIds.length === 1 ? "" : "s"} added` : "No add-ons (optional)";
    if (step === "travel") return complete ? "Address added" : "Needs an address";
    if (step === "professionals") return complete ? "Professional chosen" : "Needs a professional";
    return complete ? "Time chosen" : "Needs a time";
  };
  const appointmentContext = <AppointmentSwitcher locked={locked} activeId={active?.selectionId} onSelect={activate}
    appointments={selections.map((row) => ({ id: row.selectionId, name: itemName(row), complete: stepComplete(step, row, travel), status: statusFor(row) }))} />;
  const nextAppointment = stayInStep ? (activeIndex < selections.length - 1 ? activeIndex + 1 : selections.indexOf(nextIncomplete!)) : -1;
  const stepLabels: Record<FirstClassStep, string> = { services: "Services", addons: "Add-ons", travel: "Location", professionals: "Professionals", time: "Time", payment: "Payment" };
  const nextStep = order[order.indexOf(step) + 1];
  const continueLabel = stayInStep ? `Next: Appointment ${nextAppointment + 1} →` : nextStep ? `Continue to ${stepLabels[nextStep]} →` : undefined;
  const showCard = (currentQuote?.financials?.requiredUpfrontCents ?? 0) > 0 && !completedPurchase;

  if (completedPurchase) return <section className="min-h-screen bg-[#FCFAF9] font-poppins pb-8">
    <div className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-16 py-10 flex items-center justify-center relative"><div className="w-full">
      <FirstClassBookingConfirmation businessId={businessId} progressId={completedPurchase.packageProgressId!} bookingIds={completedPurchase.bookingIds!} primaryBookingId={completedPurchase.primaryBookingId} kind="PURCHASE" classification={currentQuote?.financials.classification} />
    </div></div>
  </section>;

  const steps = [{ id: "services", label: "Services" }, { id: "addons", label: "Add-ons" }, ...(travel ? [{ id: "travel", label: "Location" }] : []),
    { id: "professionals", label: "Professionals" }, { id: "time", label: "Time" }, { id: "payment", label: "Payment" }, { id: "confirmed", label: "Confirm" }];
  const item = active ? itemFor(active) : undefined;
  return (
    <BookingOnboarding steps={steps} current={step}
      onBack={() => { if (step === "services" || restored) window.history.back(); else goTo(order[order.indexOf(step) - 1]!); }}
      onClose={() => window.history.back()}
      onStep={restored ? undefined : (target) => { const index = order.indexOf(target as FirstClassStep); if (index >= 0 && index < order.indexOf(step)) goTo(target as FirstClassStep); }}
      summary={<CheckoutSummaryAside bookingStep={(step === "services" ? "addons" : step) as WizardStep} selection={selectionSummary} packageQuote={currentQuote}
        business={catalog.data?.business} showPolicy={showPolicy} setShowPolicy={setShowPolicy}
        policyContent={<div className="space-y-3">
          <p>This Package uses its own First-Class agreement, covering payment, validity, cancellation, no-show and penalty terms. It is shown once, in full, in the Payment step{displayed ? "" : " after the server issues your original quote"}.</p>
          {currentQuote && <p>Original quote deadline: {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: currentQuote.timezone }).format(new Date(currentQuote.expiresAt))} ({currentQuote.timezone}).</p>}
          {displayed?.text && <button type="button" className="min-h-11 font-semibold text-[#240183] underline" onClick={() => {
            if (step !== "payment") goTo("payment");
            requestAnimationFrame(() => { const box = document.getElementById("package-agreement-text"); box?.scrollIntoView({ behavior: "smooth", block: "center" }); box?.focus({ preventScroll: true }); });
          }}>Read the full agreement in the Payment step</button>}
        </div>}
        hideContinue={step === "payment"} continueLabel={continueLabel}
        onContinue={onContinue} canContinue={canContinue} />}>
      {!failure && (offer.isLoading || retained.isLoading || original.isLoading) && <div role="status" className="flex min-h-24 items-center gap-3 rounded-xl border border-neutral-200 bg-white p-5 text-base text-[#45474B]">
        <span aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#2E9DA7] border-t-transparent" />Loading Package details…
      </div>}
      {failure && (
        <div role="alert" className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-800 [&_button]:min-h-11 [&_button]:font-semibold">
          <p className="font-semibold">{failure}</p>
          <p className="text-sm">Keep the original operation identity while acceptance, payment or purchase remains unconfirmed.</p>
          {!initialOperationId && offer.isError && <button className="mt-3 underline" type="button" disabled={offer.isFetching} onClick={() => void offer.refetch()}>Retry Package details</button>}
          {initialOperationId && retained.isError && <button className="mt-3 underline" type="button" disabled={retained.isFetching} onClick={() => void retained.refetch()}>Retry original terms review</button>}
          {initialOperationId && retained.isError && !original.data && <button className="mt-3 underline" type="button" disabled={original.isFetching} onClick={() => void original.refetch()}>Retry original quote read</button>}
        </div>
      )}

      {step === "services" && offer.data && <FirstClassServicesStep offer={offer.data} offerSummary={offerSummary} catalog={catalog.data}
        selections={selections} locked={locked} onChange={(next) => { if (!locked) setSelections(next); }} />}

      {step === "addons" && active && <AddonsStep addons={item?.addons ?? []} context={appointmentContext} selectedAddonIds={active.addonIds}
        setSelectedAddonIds={(next) => updateRow(active.selectionId, (row) => ({ ...row, addonIds: typeof next === "function" ? next(row.addonIds) : next }))} />}

      {step === "travel" && active && <TravelAddressStep servedCities={(item?.travelCities ?? []) as BusinessCity[]} context={appointmentContext}
        customerCity={(rowAddress(active).city || undefined) as BusinessCity | undefined}
        // A different city changes the server's availability and travel quote, so its time is re-chosen.
        setCustomerCity={(city) => { if (locked) return; updateRow(active.selectionId, (row) => ({ ...row, startAt: "", travelAddress: { ...rowAddress(row), city } })); setSlots((current) => without(current, active.selectionId)); }}
        address={addressFields(active)}
        setAddress={(patch) => updateRow(active.selectionId, (row) => ({ ...row, travelAddress: { ...rowAddress(row), ...patch } }))} />}

      {step === "professionals" && active && item && <ProfessionalsStep allowNoPreference={false} context={appointmentContext}
        staff={eligibleStaff(item, catalog.data)} selectedProfessional={active.staffMembershipId || null}
        setSelectedProfessional={(staffId) => {
          if (locked || !staffId || staffId === active.staffMembershipId) return;
          updateRow(active.selectionId, (row) => ({ ...row, staffMembershipId: staffId, startAt: "" }));
          setSlots((current) => without(current, active.selectionId));
        }} />}

      {step === "time" && active && <FirstClassTimeStep key={active.selectionId} businessId={businessId} row={active} travel={travel} timezone={timezone}
        context={appointmentContext} visibleMonth={visibleMonth} dateIso={dates[active.selectionId]} slot={slots[active.selectionId]}
        onStale={() => clearTime(active.selectionId)}
        onMonth={(delta) => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + delta, 1))}
        onDate={(dateIso) => { if (locked) return; setDates((current) => ({ ...current, [active.selectionId]: dateIso })); clearTime(active.selectionId); }}
        onSlot={(slot) => {
          if (locked) return;
          setSlots((current) => ({ ...current, [active.selectionId]: slot }));
          updateRow(active.selectionId, (row) => ({ ...row, startAt: slot.startAt }));
        }} />}

      {step === "payment" && <>
        {showCard ? <PaymentStep hasSavedCard={hasSavedCard} setHasSavedCard={setHasSavedCard} isReplacingCard={isReplacingCard}
          setIsReplacingCard={setIsReplacingCard} setBookingStep={(target) => { if (target && target !== "confirmed" && !restored) goTo(target); }} />
          : <h1 className="font-semibold text-3xl md:text-4xl text-[#1C1B1C] font-poppins">Payment</h1>}
        <ol aria-label="Payment steps" className="w-full lg:w-[714px] grid gap-2 sm:grid-cols-3 text-sm">
          {([["Get your quote", Boolean(displayed || original.data)], ["Accept the agreement", Boolean(confirmation || original.data?.acceptanceRecorded)], ["Purchase the Package", false]] as const).map(([label, done], index) =>
            <li key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${done ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]" : "border-neutral-200 bg-white text-[#1C1B1C]"}`}>
              <span aria-hidden="true" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold border border-current">{done ? "✓" : index + 1}</span>
              <span className="font-medium">{label}{done && <span className="sr-only"> (done)</span>}</span>
            </li>)}
        </ol>

        {presentationUnavailable && <div role="status" className="w-full lg:w-[714px] space-y-2 rounded-xl border border-[#F5D48A] bg-[#FEF8CF] p-4 text-base text-[#322509]">
          <p className="font-semibold">The agreement for this quote could not be shown here.</p>
          <p className="text-sm">{retained.error ? `${message(retained.error)} ` : ""}This happens when it was issued in another sign-in session, its original deadline has passed, or the connection failed. The original quote and appointments are shown for reference only; they are not reserved and the deadline is not renewed.</p>
          <button className="inline-flex min-h-11 items-center font-semibold underline" type="button" disabled={retained.isFetching} onClick={() => void retained.refetch()}>Retry original terms review</button>
          <Link className="inline-flex min-h-11 items-center font-semibold underline" href={`/customer/package-consent/${encodeURIComponent(businessId)}/${encodeURIComponent(packageId)}`}>Start a new booking instead</Link>
        </div>}

        {!displayed && !original.data && !restored && offer.data && <section aria-label="Package quote request" className="w-full lg:w-[714px] space-y-4 rounded-xl border border-[#ECEBEF] bg-white p-5 shadow-sm">
          <h2 className="text-[#1E293B] font-semibold text-xl font-inter">Package quote and agreement</h2>
          <p className="text-base leading-7 text-[#1C1B1C]">
            Request the authoritative quote for your {selections.length} initial appointment{selections.length === 1 ? "" : "s"}. The server returns the Package price,
            FIRST or RETURNING classification, upfront payment, venue dues and the exact First-Class agreement. Its original 30-minute deadline starts when it is issued and is never renewed on retry.
          </p>
          <p className="text-sm text-[#45474B]">A quote does not reserve appointments, purchase the Package or take payment.</p>
          {offer.data.checkoutAvailable === false && !quoteAttemptId && <PackageUnavailable reason={offer.data.checkoutUnavailableReason} />}
          {!allComplete && <p role="status" className="rounded-lg bg-[#FEF8CF] p-3 text-sm text-[#322509]">Choose the location, professional and time for every initial appointment before requesting the quote.</p>}
          <button type="button" className={`${buttonClass} w-full sm:w-auto`} disabled={busy || (!quoteAttemptId && offer.data.checkoutAvailable === false) || !allComplete} onClick={() => void prepare()}>
            {busy ? "Preparing terms…" : quoteAttemptId ? "Retry original terms request" : "Get quote & review terms"}
          </button>
        </section>}

        {displayed && <section aria-labelledby="package-agreement-title" className="w-full lg:w-[714px] space-y-4 rounded-xl border border-[#ECEBEF] bg-white p-5 shadow-sm">
          <h2 id="package-agreement-title" className="text-[#1E293B] font-semibold text-xl font-inter">First-Class Package agreement</h2>
          <p className="text-base text-[#45474B]">Read the complete agreement. It includes the Package payment, validity, cancellation, no-show and penalty terms for this quote. Scroll inside the box to read all of it.</p>
          {currentQuote && <p className="rounded-lg bg-[#F5F4EE] px-3 py-2 text-sm text-[#1C1B1C]">
            <span className="font-semibold">Original quote deadline:</span> {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: currentQuote.timezone }).format(new Date(currentQuote.expiresAt))} ({currentQuote.timezone}). It is not renewed by retrying.
          </p>}
          <div id="package-agreement-text" tabIndex={0} className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-[#C6C6CB] bg-[#FCFAF9] p-4 sm:p-5 text-base leading-7 text-[#1C1B1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7]" aria-label="Exact Package terms">{displayed.text}</div>
          <p className="text-sm text-[#45474B]">Disclosure version {displayed.templateVersion}</p>
          {confirmation ? (
            <div role="status" className="space-y-1 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-4 text-[#065F46] [&_button]:min-h-11 [&_button]:font-semibold">
              <h3 className="font-semibold">Terms accepted ({displayed.certification === "CERTIFIED" ? "durable commit certified" : "recorded action; certification pending"})</h3>
              <p>Acceptance alone does not confirm a purchase. Check the original purchase status below.</p>
              {displayed.certification !== "CERTIFIED" && <button type="button" className="mt-2 underline" disabled={busy} onClick={() => void run(async () => {
                const exact = { ...consentAction(displayed), eventId: confirmation.eventId };
                const result = await acceptConsentTerms(businessId, operationId!, exact);
                if (!matchesConsentAcceptance(displayed, exact, result)) throw Error("Acceptance identity changed");
                recordAcceptance(displayed, result);
              })}>Check original consent certification</button>}
            </div>
          ) : (
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-base text-[#1C1B1C] ${checked ? "border-[#2E9DA7] bg-[#2E9DA7]/5" : "border-[#C6C6CB] bg-white"}`}>
                <input type="checkbox" checked={checked} disabled={busy} aria-describedby="package-agreement-hint" className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-[#2E9DA7]" onChange={(e) => setChecked(e.target.checked)} />
                <span>I have reviewed and agree to the Package validity, cancellation, no-show, credit forfeiture and applicable monetary penalty terms.</span>
              </label>
              <p id="package-agreement-hint" className={`text-sm ${checked ? "text-[#45474B]" : "text-[#8A3B00]"}`} aria-live="polite">
                {checked ? "Your acceptance is recorded only when you press Accept these terms." : "Tick the box to confirm you have read and agree to the full agreement above."}
              </p>
              <button type="submit" disabled={!checked || busy} aria-describedby="package-agreement-hint" className={`${buttonClass} w-full sm:w-auto`}>{busy ? "Recording acceptance…" : "Accept these terms"}</button>
            </form>
          )}
        </section>}

        {displayed && operationId && <PackagePurchaseContinuation businessId={businessId} operationId={operationId}
          quote={displayed.quote} accepted={Boolean(confirmation)} available={displayed.purchaseAvailable === true}
          onVerified={setCompletedPurchase} showSavedCard={false} paymentMethodReady={!showCard || hasSavedCard}
          recoverOnMount={Boolean(initialOperationId) && !localQuoteAttempt && Boolean(confirmation) && !accepted} />}
        {!displayed && original.data && initialOperationId && <PackagePurchaseContinuation businessId={businessId}
          operationId={initialOperationId} quote={original.data.quote} accepted={original.data.acceptanceRecorded}
          available={original.data.quote.purchaseAvailable === true} recoverOnMount={original.data.acceptanceRecorded} onVerified={setCompletedPurchase}
          showSavedCard={false} paymentMethodReady={!showCard || hasSavedCard} />}

        {canChangeSelections && <button type="button" className={`${packageSecondaryCta} w-full sm:w-auto`} onClick={changeSelections}>
          Change appointments (discards this unaccepted quote)
        </button>}
      </>}
    </BookingOnboarding>
  );
}
