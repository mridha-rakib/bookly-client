import React from "react";
import { createRoot } from "react-dom/client";
import { CancellationReview, InitialAppointmentReview, OfferCard, OwnedPackageCard, PackageReadError, PackageUnavailable, PaymentStatus, SessionReview, SettlementCard } from "../../src/components/packages/FirstClassPackageViews";
import { BooklyApiError } from "../../src/lib/api/client";
import { offer, owned, settlement, terms } from "./package-view-fixtures";
import "../../src/app/globals.css";

const scenario = new URLSearchParams(location.search).get("scenario") ?? "catalogue";
const scenarios = ["catalogue", "detail", "owned", "empty", "redeem", "dues", "cancel", "payment", "settlement", "denied", "initial-one", "initial-mixed", "initial-empty", "stale", "error", "loading"];
function content() {
  switch (scenario) {
    case "catalogue": return <div className="grid gap-5 md:grid-cols-2"><OfferCard offer={offer} /><OfferCard offer={{ ...offer, id: "forever", name: "Forever wellbeing package", validity: { mode: "FOREVER" } }} /></div>;
    case "detail": return <OfferCard offer={offer} detail />;
    case "owned": return <OwnedPackageCard pkg={owned} detail />;
    case "empty": return <section className="rounded-xl border bg-white p-8"><h2 className="text-xl font-bold">My Packages</h2><p className="mt-4">You have no purchased first-class multi-service packages. Checkout is currently unavailable.</p></section>;
    case "redeem": return <SessionReview remainingItems={owned.items} />;
    case "dues": return <SessionReview remainingItems={owned.items} terms={terms} />;
    case "cancel": return <CancellationReview terms={{ classification: "LATE", creditEffect: "FORFEITED", penaltyCents: 200, paymentState: "PROCESSING" }} />;
    case "payment": return <section className="space-y-3 rounded-xl border bg-white p-6"><h2 className="text-xl font-bold">Independent money states</h2>{["CREATED", "REQUIRES_ACTION", "PROCESSING", "UNKNOWN", "REFUND_PENDING", "REFUNDED", "PENDING", "NO_SHOW_CHARGED", "NO_SHOW_WAIVED"].map((s) => <PaymentStatus key={s} state={s} />)}</section>;
    case "settlement": return <SettlementCard view={settlement} />;
    case "denied": return <OfferCard offer={offer} detail />;
    case "initial-one": return <InitialAppointmentReview appointments={[{ id: "1", service: "Massage", professional: "Alex", time: "2 Nov 2026, 12:00 Asia/Nicosia", group: false }]} remainingCredits={9} quoteState="UNAVAILABLE" />;
    case "initial-mixed": return <InitialAppointmentReview appointments={[{ id: "1", service: "Massage", professional: "Alex", time: "2 Nov 2026, 12:00 Asia/Nicosia", group: false }, { id: "2", service: "Movement", professional: "Sam", time: "9 Nov 2026, 12:00 Asia/Nicosia", group: true }]} remainingCredits={8} quoteState="PAYMENT PENDING — activation unavailable" />;
    case "initial-empty": return <InitialAppointmentReview />;
    case "stale": return <SessionReview remainingItems={owned.items} terms={{ ...terms, quoteState: "STALE" }} />;
    case "error": return <PackageReadError error={new BooklyApiError({ status: 503, message: "Private failure" })} />;
    case "loading": return <p role="status" className="animate-pulse rounded-xl border bg-white p-8">Loading your multi-service packages…</p>;
    default: return <PackageUnavailable />;
  }
}
createRoot(document.getElementById("root")!).render(<main className="min-h-screen bg-[#FDFBF9] px-4 py-6 font-poppins text-[#020305] sm:px-8"><div className="mx-auto max-w-[1005px] space-y-6">
  <p className="rounded-xl border-2 border-[#240183] bg-white p-4 font-bold text-[#240183]">VISUAL FIXTURE — NOT LIVE PURCHASE DATA</p>
  <h1 className="font-manrope text-2xl font-bold">Bookly Package review · {scenario}</h1>
  <nav aria-label="Fixture scenarios" className="flex flex-wrap gap-3 text-sm">{scenarios.map((s) => <a key={s} className="text-[#240183] underline focus-visible:outline-2" href={`?scenario=${s}`}>{s}</a>)}</nav>
  {content()}
</div></main>);
