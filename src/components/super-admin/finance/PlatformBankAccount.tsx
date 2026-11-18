"use client";

import { usePlatformBankAccountQuery } from "@/lib/superAdminFinance/hooks";

/** The platform legal entity's destination. Stripe owns all changes and verification. */
export default function PlatformBankAccount() {
  const query = usePlatformBankAccountQuery();
  const summary = query.data;
  const unavailable = query.isError || summary?.state === "UNAVAILABLE";
  const ambiguousCurrencies = [...new Set(summary?.destinations.filter(bank => bank.currency && bank.defaultForCurrency === true && summary.destinations.filter(other => other.currency === bank.currency && other.defaultForCurrency === true).length > 1).map(bank => bank.currency) ?? [])];
  return (
    <section aria-label="Platform bank account" className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3">
      <h3 className="font-semibold text-lg text-[#111827]">Platform Bank Account</h3>
      <p className="text-sm text-gray-600">Bookly&apos;s legal-entity payout destination, managed by Stripe. Business payout accounts are separate.</p>
      {summary?.mode && <p className="text-xs font-semibold">{summary.mode} Stripe credential context</p>}
      {query.isLoading ? <p role="status">Loading platform bank account...</p> : unavailable ? (
        <div role="alert">
          <p>Platform bank details are unavailable. This does not confirm whether a bank account is configured. Check Stripe account settings.</p>
          {summary?.unavailableReason === "PERMISSIONS" && <p>The Stripe API key cannot read the platform bank accounts. Review account permissions in Stripe.</p>}
          {summary?.unavailableReason === "INCOMPLETE" && <p>Stripe returned incomplete bank-account data.</p>}
          {summary?.mode === "TEST" && summary.unavailableReason === "TEST_MODE_RESTRICTED" && (
            <p>Stripe TEST default destination — bank details unavailable in TEST mode. Stripe does not list bank accounts to a TEST key; a TEST withdrawal is sent to the TEST account&apos;s default destination, chosen by Stripe.</p>
          )}
          <button type="button" onClick={() => void query.refetch()} className="text-sm underline mt-2">Try again</button>
        </div>
      ) : summary?.state === "NOT_CONFIGURED" ? (
        <p>Stripe is not configured in this deployment. Platform bank-account status is unknown.</p>
      ) : summary?.state === "NO_DESTINATION" ? (
        <p>No platform payout bank account was returned by Stripe. Add or verify the account in the authorized Stripe account settings.</p>
      ) : summary?.state === "CONFIGURED" ? (
        <>
          <p className="text-sm">{summary.mode === "TEST" ? "Test-mode destinations; live bank setup is not confirmed." : "Configured in Stripe; this does not authorize a withdrawal."}</p>
          {summary.inventoryComplete === false && <p role="status">Only part of the bank-account inventory is available. Default destination selection is unavailable; check Stripe for the complete list.</p>}
          {summary.inventoryComplete === false && summary.unavailableReason === "PERMISSIONS" && <p>Stripe API permissions prevented retrieval of the complete bank-account list.</p>}
          {ambiguousCurrencies.length > 0 && <p>Multiple default bank accounts were reported for {ambiguousCurrencies.join(", ").toUpperCase()}. Default selection is not confirmed.</p>}
          <ul className="flex flex-col gap-3">
            {summary.destinations.map((bank, index) => (
              <li key={index} className="border border-gray-100 rounded-lg p-3 text-sm">
                <p className="font-semibold">{bank.bankName ?? "Bank name unavailable"} · {bank.last4 ? `•••• ${bank.last4}` : "Masked identifier unavailable"}</p>
                <p>Settlement currency: {bank.currency?.toUpperCase() || "Unavailable"} · Country: {bank.country || "Unavailable"} · Stripe status: {bank.status || "Unavailable"}</p>
                <p>{bank.defaultForCurrency === true ? "Default for this currency" : bank.defaultForCurrency === false ? "Not the default for this currency" : "Default designation unavailable"}</p>
                {(!bank.last4 || !bank.currency || !bank.country || !bank.status || bank.defaultForCurrency === null) && <p>Destination data is incomplete. Review this bank account in Stripe.</p>}
                {bank.status === "verification_failed" && <p className="text-amber-800">Bank verification failed. Review the required action in Stripe.</p>}
                {bank.status === "errored" && <p className="text-amber-800">Stripe reports a bank-account error. Review this destination in Stripe.</p>}
              </li>
            ))}
          </ul>
        </>
      ) : <p>Platform bank-account status has not been confirmed.</p>}
      {summary && !unavailable && summary.state !== "NOT_CONFIGURED" && <>
        {summary.payoutsEnabled === false && <p>Payouts are disabled by Stripe. Check Stripe for the reason and any required verification.</p>}
        {summary.payoutsEnabled === true && <p>Stripe reports payouts enabled. Bookly withdrawal approval remains separate.</p>}
        {summary.payoutsEnabled === null && <p>Stripe payout-enabled status is unavailable.</p>}
      </>}
      <p className="text-xs text-gray-500">In Stripe Dashboard, select Bookly&apos;s platform account, then Settings → Bank accounts and currencies. Verify the bank and settlement currency, and complete any outstanding Stripe verification requirements. Changes and verification take place there.</p>
      <a href="https://dashboard.stripe.com/settings/payouts" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline self-start">Manage platform bank account in Stripe</a>
      <p className="text-xs text-gray-500">Withdrawals are limited to the eligible amount Bookly calculates from its ledger and Stripe evidence. LIVE withdrawals also require explicit enablement for this deployment.</p>
    </section>
  );
}
