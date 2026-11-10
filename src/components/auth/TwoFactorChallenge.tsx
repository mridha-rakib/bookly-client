"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "./AuthLayout";
import AuthCard from "./AuthCard";
import { invalidateInFlightAuth } from "@/lib/api/client";
import { postAuthLoggedOut } from "@/lib/auth/auth-channel";
import type { AuthResponse } from "@/lib/api/auth";
import { twoFactorApi } from "@/lib/api/twoFactor";
import { toUserMessage } from "@/lib/auth/messages";
import { useAuthStore } from "@/lib/auth/store";
import { clearPostLoginRedirect } from "@/lib/auth/post-login-redirect";
import { getAuthenticatedUserHomePath } from "@/lib/auth/routes";
import { getAccessToken } from "@/lib/auth/token-memory";

/**
 * P2.2.7.4 — the session this page has just established, kept in memory only (never stored).
 * Signing in rotates the identity-scoped query client, and `Providers` re-keys the whole tree on
 * that (`key={cacheEpoch}`), so this page remounts right after a verified sign-in. Without this
 * marker the remount would run the "retire any previous identity" teardown below and wipe the
 * brand-new session, sending the user back to sign-in.
 */
let establishedSession: { accessToken: string; homePath: string } | null = null;

export default function TwoFactorChallenge() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [replaceCodes, setReplaceCodes] = useState(false);
  const [recovered, setRecovered] = useState<{ auth: AuthResponse; codes: string[] } | null>(null);
  const [saved, setSaved] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    const handedOff = establishedSession;
    if (
      handedOff &&
      useAuthStore.getState().status === "authenticated" &&
      getAccessToken() === handedOff.accessToken
    ) {
      // Remounted by the cache rotation of the session verified here: keep it, finish navigating.
      router.replace(handedOff.homePath);
      return;
    }
    establishedSession = null;
    // A first factor is not an authenticated identity. Retire any previous account's cache.
    invalidateInFlightAuth();
    useAuthStore.getState().clearAuth();
    postAuthLoggedOut();
    let mounted = true;
    twoFactorApi
      .challenge()
      .then((result) => {
        if (mounted) setExpiresAt(result.expiresAt);
      })
      .catch((error) => {
        if (mounted) setError(toUserMessage(error));
      });
    return () => {
      mounted = false;
    };
    // Mount-only by design: re-running would repeat the identity teardown (router is stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const finish = (auth: AuthResponse) => {
    setRecovered(null);
    const homePath = getAuthenticatedUserHomePath(auth.user);
    // Recorded before setAuth: setAuth re-keys the tree synchronously-scheduled, remounting this page.
    establishedSession = { accessToken: auth.accessToken, homePath };
    useAuthStore.getState().setAuth(auth);
    clearPostLoginRedirect();
    router.replace(homePath);
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result =
        replaceCodes && recovery
          ? await twoFactorApi.verify(code, true)
          : await twoFactorApi.verify(code);
      const { recoveryCodes, ...auth } = result;
      setCode("");
      if (recoveryCodes) {
        setRecovered({ auth, codes: recoveryCodes });
        setSaved(false);
      } else finish(auth);
    } catch (error) {
      setError(toUserMessage(error));
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  if (recovered)
    return (
      <AuthLayout showBack={false} imageSrc="/img/authImg2.png">
        <AuthCard
          title="Save your new recovery codes"
          subtitle="Your previous recovery codes are invalid. These codes are shown only now."
        >
          <ul className="space-y-2 break-all font-mono text-sm">
            {recovered.codes.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
          <label className="mt-4 flex gap-2">
            <input
              type="checkbox"
              checked={saved}
              onChange={(event) => setSaved(event.target.checked)}
            />
            I have saved my recovery codes securely
          </label>
          <button
            className="mt-4 rounded-xl border p-3 disabled:opacity-50"
            disabled={!saved}
            onClick={() => finish(recovered.auth)}
          >
            Continue to Bookly
          </button>
        </AuthCard>
      </AuthLayout>
    );
  return (
    <AuthLayout showBack={false} imageSrc="/img/authImg2.png">
      <AuthCard
        title="Verify your sign-in"
        subtitle="Additional verification is required before you can access Bookly."
      >
        <form onSubmit={(event) => void verify(event)} className="w-full space-y-4">
          <label className="block">
            {recovery ? "Recovery code" : "Authenticator code"}
            <input
              className="mt-2 block w-full rounded-xl border p-3 font-mono"
              value={code}
              onChange={(event) => setCode(event.target.value.trim())}
              inputMode={recovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              maxLength={recovery ? 32 : 6}
              pattern={recovery ? "[a-f0-9]{32}" : "[0-9]{6}"}
              required
              disabled={pending}
            />
          </label>
          {recovery && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={replaceCodes}
                disabled={pending}
                onChange={(event) => setReplaceCodes(event.target.checked)}
              />
              Replace my recovery codes during this sign-in. All old codes and other sessions will
              be invalidated. Choose this if you lost your authenticator or are using your last
              code.
            </label>
          )}
          {expiresAt && (
            <p className="text-sm">
              Challenge expires at {new Date(expiresAt).toLocaleTimeString()}.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-[#1A1A1A] p-3 font-semibold text-white disabled:opacity-50"
            disabled={pending}
          >
            {pending ? "Verifying…" : "Verify sign-in"}
          </button>
          <button
            type="button"
            disabled={pending}
            className="text-sm underline"
            onClick={() => {
              setRecovery(!recovery);
              setCode("");
              setError("");
            }}
          >
            {recovery ? "Use authenticator code" : "Use a recovery code"}
          </button>
          <button
            type="button"
            disabled={pending}
            className="block text-sm underline"
            onClick={async () => {
              try {
                await twoFactorApi.cancel();
              } catch {
                /* An expired challenge is already unusable. */
              }
              router.replace("/professional/auth");
            }}
          >
            Cancel and return to sign in
          </button>
          <p className="text-xs text-gray-600">
            Expired challenge? Return to sign in and start again. If you just used an authenticator
            code, wait for the next code.
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
