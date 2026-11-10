"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { invalidateInFlightAuth } from "@/lib/api/client";
import { BooklyApiError } from "@/lib/api/client";
import { twoFactorApi, type TwoFactorSetup, type TwoFactorStatus } from "@/lib/api/twoFactor";
import { toUserMessage } from "@/lib/auth/messages";
import { useAuthStore } from "@/lib/auth/store";
import { postAuthLoggedOut } from "@/lib/auth/auth-channel";

const button =
  "rounded-lg border border-[#DEDDE3] px-4 py-2 text-sm font-semibold disabled:opacity-50";

export default function TwoFactorSettings() {
  const router = useRouter();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [action, setAction] = useState<"disable" | "regenerate" | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  /** P2.2.7.3 — only a server "sign in again" answer shows the re-authentication link. */
  const [reauthRequired, setReauthRequired] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const load = () =>
    twoFactorApi
      .status()
      .then(setStatus)
      .catch((error) => setError(toUserMessage(error)));
  useEffect(() => {
    let mounted = true;
    twoFactorApi
      .status()
      .then((value) => {
        if (mounted) setStatus(value);
      })
      .catch((error) => {
        if (mounted) setError(toUserMessage(error));
      });
    return () => {
      mounted = false;
    };
  }, []);
  const leave = () => {
    setCodes(null);
    setSetup(null);
    setCode("");
    invalidateInFlightAuth();
    useAuthStore.getState().clearAuth();
    postAuthLoggedOut();
    router.replace("/professional/auth");
  };
  const run = async (work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setReauthRequired(false);
    try {
      await work();
    } catch (error) {
      setError(toUserMessage(error));
      setReauthRequired(
        error instanceof BooklyApiError && error.code === "TWO_FACTOR_REAUTH_REQUIRED",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const finish = (recoveryCodes: string[]) => {
    setSetup(null);
    setCode("");
    setAction(null);
    setCodes(recoveryCodes);
    setSaved(false);
  };

  if (codes !== null)
    return (
      <section className="space-y-4 rounded-xl border p-5" aria-label="Save recovery codes">
        <h3 className="font-semibold">Security settings updated</h3>
        {codes.length > 0 && (
          <>
            <p>
              Save these recovery codes securely. Each code works once. They are shown only now and
              cannot be retrieved later.
            </p>
            <ul className="grid gap-2 break-all font-mono text-sm sm:grid-cols-2">
              {codes.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={saved}
                onChange={(event) => setSaved(event.target.checked)}
              />
              I have saved my recovery codes securely
            </label>
          </>
        )}
        <p>
          All previous sessions have ended. Sign in again to continue. Wait for a new authenticator
          code if you just used one.
        </p>
        <button
          type="button"
          className={button}
          disabled={codes.length > 0 && !saved}
          onClick={leave}
        >
          Continue to sign in
        </button>
      </section>
    );

  return (
    <section className="space-y-4 rounded-xl border p-5" aria-label="Two-factor authentication">
      <h3 className="font-semibold">
        Two-factor authentication: {status ? (status.enabled ? "On" : "Off") : "Loading…"}
      </h3>
      <p className="text-sm text-gray-600">
        Use an authenticator app (Google Authenticator or any compatible TOTP app) for every new
        sign-in. Security changes require a complete sign-in
        within the last five minutes and end all existing sessions.
      </p>
      {reauthRequired && (
        <a className="inline-block text-sm underline" href="/professional/auth">
          Sign in again, then return to Security
        </a>
      )}
      {!status && !error && <p>Loading security settings…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          {!status && (
            <button className={button} onClick={() => void load()}>
              Retry
            </button>
          )}
        </div>
      )}
      {/* Fail closed: only an explicit server `true` offers setup (a missing field means an
          older or unconfirmed API, never "available"). */}
      {status && !status.enabled && !setup && status.enrollmentAvailable !== true && (
        <p className="text-sm text-gray-700" data-testid="two-factor-unavailable">
          {status.enrollmentAvailable === false
            ? "Authenticator setup isn't available on this server yet. Two-factor authentication is built into Bookly and will appear here once it's switched on. Your account and sign-in are not affected."
            : "Bookly couldn't confirm that authenticator setup is available right now, so setup is not offered. Refresh this page later. Your account and sign-in are not affected."}
        </p>
      )}
      {status && !status.enabled && !setup && status.enrollmentAvailable === true && (
        <button
          type="button"
          className={button}
          disabled={pending}
          onClick={() =>
            void run(async () => {
              try {
                setSetup(await twoFactorApi.enroll());
                setCode("");
              } catch (error) {
                // Availability changed since the status was read: re-read the authoritative state.
                if (error instanceof BooklyApiError && error.code === "TWO_FACTOR_ENROLLMENT_UNAVAILABLE")
                  void load();
                throw error;
              }
            })
          }
        >
          {pending ? "Starting…" : "Enable 2FA"}
        </button>
      )}
      {setup && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () =>
              finish((await twoFactorApi.activate(setup.setupId, code)).recoveryCodes),
            );
          }}
        >
          <p>Scan this QR code in your authenticator app, or enter the manual setup key.</p>
          {/* Generated locally by the API. Keeping it in memory avoids persisting the setup secret. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrDataUrl} alt="Authenticator setup QR code" width={240} height={240} />
          <p className="break-all">
            Manual setup key: <code>{setup.manualKey}</code>
          </p>
          <p className="text-sm">
            Setup expires at {new Date(setup.expiresAt).toLocaleTimeString()}. Your account stays
            off until verified.
          </p>
          <label className="block">
            Authenticator code
            <input
              className="mt-1 block w-full rounded-lg border p-2"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button className={button} disabled={pending}>
            {pending ? "Verifying…" : "Verify and enable"}
          </button>
          <button
            type="button"
            className={button}
            disabled={pending}
            onClick={() => {
              setSetup(null);
              setCode("");
            }}
          >
            Cancel setup
          </button>
        </form>
      )}
      {status?.enabled && !action && (
        <>
          <p>{status.recoveryCodesRemaining} recovery codes remaining.</p>
          <div className="flex flex-wrap gap-3">
            <button
              className={button}
              onClick={() => {
                setAction("regenerate");
                setCode("");
              }}
            >
              Regenerate recovery codes
            </button>
            <button
              className={button}
              onClick={() => {
                setAction("disable");
                setCode("");
              }}
            >
              Disable 2FA
            </button>
          </div>
        </>
      )}
      {action && (
        <form
          role="alertdialog"
          aria-label={action === "disable" ? "Disable 2FA" : "Replace recovery codes"}
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => finish((await twoFactorApi.manage(action, code)).recoveryCodes));
          }}
        >
          <p>
            {action === "disable"
              ? "Disable two-factor authentication? Your authenticator and recovery codes will stop working."
              : "Replace all recovery codes? Your previous unused codes will stop working."}{" "}
            All sessions will end. This requires a valid factor and a recent complete sign-in.
          </p>
          <label className="block">
            Authenticator or recovery code
            <input
              className="mt-1 block w-full rounded-lg border p-2 font-mono"
              autoComplete="one-time-code"
              required
              maxLength={32}
              value={code}
              onChange={(event) => setCode(event.target.value.trim())}
            />
          </label>
          <button className={button} disabled={pending}>
            {pending ? "Updating…" : "Confirm security change"}
          </button>
          <button
            type="button"
            className={button}
            disabled={pending}
            onClick={() => {
              setAction(null);
              setCode("");
            }}
          >
            Cancel
          </button>
        </form>
      )}
      <p className="text-xs text-gray-600">
        If you lose both your authenticator and recovery codes, contact support. There is no
        password-only or administrator bypass.
      </p>
    </section>
  );
}
