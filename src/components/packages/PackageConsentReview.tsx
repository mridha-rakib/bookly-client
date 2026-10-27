"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { packagePrimaryCta } from "./package-cta";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptConsentTerms,
  consentAction,
  getConsentOffer,
  getConsentPresentation,
  matchesConsentAcceptance,
  retainConsentQuote,
  type ConsentAction,
  type ConsentAccepted,
  type ConsentIntent,
  type ConsentPresentation,
} from "@/lib/api/package-consent";

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white p-3 text-[#020305] focus:outline-2 focus:outline-[#240183]";
const buttonClass = packagePrimaryCta;
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Terms review is unavailable. Please try again later.";

/** Consent-only UI: no card setup, payment controls or purchase continuation. */
export default function PackageConsentReview({
  businessId,
  packageId,
  initialOperationId,
}: {
  businessId: string;
  packageId: string;
  initialOperationId?: string;
}) {
  const queryClient = useQueryClient();
  const [operationId, setOperationId] = useState(initialOperationId);
  const [selections, setSelections] = useState<ConsentIntent["selections"]>([]);
  const [presentation, setPresentation] = useState<ConsentPresentation>();
  const [checked, setChecked] = useState(false);
  const [accepted, setAccepted] = useState<ConsentAccepted>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const action = useRef<ConsentAction | undefined>(undefined);
  const quoteAttempt = useRef<{ signature: string; operationId: string } | undefined>(undefined);
  const offer = useQuery({
    queryKey: ["packageConsent", businessId, packageId],
    queryFn: () => getConsentOffer(businessId, packageId),
    enabled: !initialOperationId,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });
  const retained = useQuery({
    queryKey: ["packageConsentPresentation", businessId, initialOperationId],
    queryFn: () => getConsentPresentation(businessId, initialOperationId!),
    enabled: Boolean(initialOperationId),
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });
  const displayed = presentation ?? retained.data;
  const candidate = accepted ?? displayed?.accepted;
  const confirmation =
    candidate &&
    displayed &&
    matchesConsentAcceptance(displayed, { eventId: candidate.eventId } as ConsentAction, candidate)
      ? candidate
      : undefined;
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
      if (!offer.data || !selections.length) return;
      const intent = { packageId, expectedRevision: offer.data.revision, selections };
      const signature = JSON.stringify(intent);
      if (quoteAttempt.current?.signature !== signature)
        quoteAttempt.current = { signature, operationId: crypto.randomUUID() };
      const id = quoteAttempt.current.operationId;
      // Persist only the operation selector before dispatch, including a lost quote response.
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?operation=${encodeURIComponent(id)}`,
      );
      await retainConsentQuote(businessId, id, intent);
      const p = await getConsentPresentation(businessId, id);
      setOperationId(id);
      setPresentation(p);
      setChecked(false);
      action.current = undefined;
      queryClient.setQueryData(["packageConsentPresentation", businessId, id], p);
    });
  const submit = () =>
    run(async () => {
      if (!displayed || !checked || !operationId || confirmation) return;
      action.current ??= consentAction(displayed);
      const result = await acceptConsentTerms(businessId, operationId, action.current);
      if (!matchesConsentAcceptance(displayed, action.current, result))
        throw new Error("Acceptance confirmation does not match the displayed terms.");
      setAccepted(result);
      queryClient.setQueryData(["packageConsentPresentation", businessId, operationId], {
        ...displayed,
        accepted: result,
      });
    });
  const failure =
    error ??
    (offer.error ? message(offer.error) : retained.error ? message(retained.error) : undefined);
  return (
    <main className="min-h-screen bg-[#FDFBF9] px-4 py-10 font-poppins sm:px-8">
      <section
        className="mx-auto max-w-3xl space-y-6 rounded-3xl bg-white p-5 shadow-sm sm:p-8"
        aria-labelledby="package-consent-title"
      >
        <Link href="/customer/packages" className="text-sm text-[#240183] underline">
          Back to My Packages
        </Link>
        <h1 id="package-consent-title" className="font-manrope text-3xl font-bold text-[#020305]">
          Review Package terms
        </h1>
        <p className="text-gray-600">
          Review and accept the terms for your selected appointments. This does not purchase a
          Package, reserve appointments or take payment.
        </p>
        {(offer.isLoading || retained.isLoading) && <p role="status">Loading Package terms…</p>}
        {failure && (
          <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
            <p>{failure}</p>
            <a href={`/customer/package-consent/${businessId}/${packageId}`} className="underline">
              Start a fresh terms review
            </a>
          </div>
        )}
        {!displayed && offer.data && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void prepare();
            }}
            className="space-y-5"
          >
            <h2 className="text-xl font-semibold">{offer.data.name}</h2>
            <p>
              Select at least one initial appointment. Times use your device&apos;s local timezone;
              the terms will show the Business timezone ({offer.data.timezone}). Availability is
              checked when you request the terms.
            </p>
            {selections.map((row, index) => {
              const item = offer.data.items.find(
                (i) => i.definitionItemId === row.definitionItemId,
              );
              return (
                <fieldset
                  key={row.selectionId}
                  disabled={busy}
                  className="space-y-3 rounded-xl border border-gray-200 p-4"
                >
                  <legend className="px-2 font-semibold">
                    Appointment {index + 1}: {item?.name}
                  </legend>
                  <label className="block">
                    Professional
                    <select
                      aria-label={`Professional for appointment ${index + 1}`}
                      required
                      className={inputClass}
                      value={row.staffMembershipId}
                      onChange={(e) =>
                        setSelections(
                          selections.map((s) =>
                            s.selectionId === row.selectionId
                              ? { ...s, staffMembershipId: e.target.value }
                              : s,
                          ),
                        )
                      }
                    >
                      <option value="">Choose a professional</option>
                      {item?.providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    Date and time
                    <input
                      aria-label={`Date and time for appointment ${index + 1}`}
                      type="datetime-local"
                      required
                      className={inputClass}
                      onChange={(e) => {
                        if (e.target.value)
                          setSelections(
                            selections.map((s) =>
                              s.selectionId === row.selectionId
                                ? { ...s, startAt: new Date(e.target.value).toISOString() }
                                : s,
                            ),
                          );
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-[#240183] underline"
                    onClick={() =>
                      setSelections(selections.filter((s) => s.selectionId !== row.selectionId))
                    }
                  >
                    Remove appointment {index + 1}
                  </button>
                </fieldset>
              );
            })}
            <div className="flex flex-wrap gap-3">
              {offer.data.items.map((item) => (
                <button
                  type="button"
                  key={item.definitionItemId}
                  className="rounded-full border border-[#240183] px-4 py-2 text-[#240183] disabled:opacity-50"
                  disabled={
                    busy ||
                    selections.filter((s) => s.definitionItemId === item.definitionItemId).length >=
                      item.quantity ||
                    !item.providers.length
                  }
                  onClick={() =>
                    setSelections([
                      ...selections,
                      {
                        selectionId: Array.from(crypto.getRandomValues(new Uint8Array(12)))
                          .map((v) => v.toString(16).padStart(2, "0"))
                          .join(""),
                        definitionItemId: item.definitionItemId,
                        serviceId: item.serviceId,
                        staffMembershipId: "",
                        startAt: "",
                        addonIds: [],
                      },
                    ])
                  }
                >
                  Add {item.name} appointment ({item.quantity} included)
                </button>
              ))}
            </div>
            <button className={buttonClass} disabled={busy || !selections.length}>
              {busy ? "Preparing terms…" : "Review selected terms"}
            </button>
          </form>
        )}
        {displayed && (
          <>
            <div
              className="whitespace-pre-wrap break-words rounded-xl border border-gray-200 p-4 leading-7 text-gray-800"
              aria-label="Exact Package terms"
            >
              {displayed.text}
            </div>
            <p className="text-sm text-gray-500">Disclosure version {displayed.templateVersion}</p>
            {confirmation ? (
              <div role="status" className="rounded-xl bg-green-50 p-4 text-green-900">
                <h2 className="font-semibold">Terms accepted</h2>
                <p>
                  Booking and payment activation is not complete. No Package purchase has been made.
                </p>
              </div>
            ) : (
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    className="mt-1 h-5 w-5 accent-[#240183]"
                    onChange={(e) => setChecked(e.target.checked)}
                  />
                  <span>
                    I have reviewed and agree to the Package validity, cancellation, no-show, credit
                    forfeiture and applicable monetary penalty terms.
                  </span>
                </label>
                <button type="submit" disabled={!checked || busy} className={buttonClass}>
                  {busy ? "Recording acceptance…" : "Accept these terms"}
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
