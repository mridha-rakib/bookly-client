# Phase 1B OAuth callback loop remediation

Verified 14 October 2026, Asia/Dhaka. The focused loop and countdown corrections pass local application verification. Full Phase 1B verdict: **CONDITIONAL PASS**; live provider authentication and broader provider/cookie race ordering remain unverified.

## 1. Exact root cause

Before this change, pending `restoreSession()` called `enterLocalSignedOut()`, which unconditionally called `clearAuth()`. `clearAuth()` always retired the query client and incremented `cacheEpoch`, including when the tab was already signed out. `Providers` keys its `QueryClientProvider` by that epoch, so the entire child subtree remounted. Each OAuth callback's mount effect then called restoration again.

The loop was therefore an interaction between the store and the real provider boundary, rather than an authorization-code replay. It could also repeat on a terminal callback refresh failure because repeated `clearAuth()` calls produced additional identity boundaries.

Current correction references: [store.ts:138](src/lib/auth/store.ts#L138), [store.ts:275](src/lib/auth/store.ts#L275), [store.ts:294](src/lib/auth/store.ts#L294), [providers.tsx:23](src/app/providers.tsx#L23).

## 2. Why the old tests missed it

The original callback recovery tests mounted callbacks directly. They did not mount callbacks inside the actual `Providers` component whose key changes on cache retirement. The existing provider/cache test exercised a separate account-data viewer. Each side passed separately while their combined lifecycle failed.

The new pending-callback tests were also executed against the retained pre-remediation source copy. Its store hash matched the pre-change snapshot. Google, Facebook, and Apple all failed with `OAuth callback remount loop` after exceeding the diagnostic render bound. That bound exists only in tests; production restoration has no artificial render/retry counter.

## 3. Files and functions changed

| File | Focused change |
|---|---|
| `src/lib/auth/store.ts` | Idempotent local pending teardown; cache epochs change only for a real signed-out transition; `restoreSession({ resolveLogout: false })` locally blocks without automatically resolving logout; shared retry-metadata synchronization |
| `src/lib/auth/oauth-callback.ts` — new | Shared `useOAuthCallbackSession` lifecycle and callback-path recognition |
| `src/components/auth/OAuthCallbackRecovery.tsx` — new | Shared finite recovery screen and “Back to sign in” action |
| `src/app/providers.tsx` | Callback-aware boot restoration; retain the keyed query boundary for genuine identity transitions |
| `src/app/auth/google/callback/page.tsx` | Shared lifecycle/recovery; block completion and onboarding navigation while interrupted |
| `src/app/auth/facebook/callback/page.tsx` | Same shared policy |
| `src/app/auth/apple/callback/page.tsx` | Same shared policy |
| `tests/oauth-callback-lifecycle.test.tsx` — new | 24 focused regression cases |
| `tests/session-recovery.test.tsx` | Add `usePathname` to its existing navigation mock |
| This report — new | Implementation and verification evidence |

No backend, JWT, refresh-token, rate-limit, booking, payment, service, or staff-module source was changed. `logout-intent.ts`, `api/client.ts`, `query-client.ts`, and `LogoutPendingNotice` retain their existing persistence, refresh blocker, generation checks, cache ownership, and override semantics.

## 4. Before and after callback behavior

With pending logout, callbacks now enter the local signed-out state once, retain the marker, block refresh, and show **“Start sign-in again”** with **“Back to sign in.”** The shared lifecycle remembers that the mounted callback was interrupted even if the user subsequently resolves logout. It does not resume the consumed callback or replay a code.

Callback boot cancels scheduled automatic logout retries. A provider may already have replaced the shared cookie; an older callback must not automatically revoke the family named by that newer cookie. Manual sign-out and the existing deliberate override controls remain user actions. Returning to the sign-in route uses the ordinary pending-resolution policy and starts a fresh login flow.

Normal callbacks without pending intent still authenticate through the backend refresh cookie. A `status=success` parameter alone grants nothing: all three invalid-cookie success-URL tests stayed unauthenticated, made one refresh attempt, and displayed the ordinary failure path. Professional onboarding redirects are also blocked while logout is pending.

References: [shared lifecycle:13](src/lib/auth/oauth-callback.ts#L13), [provider boot:16](src/app/providers.tsx#L16), [Google:103](src/app/auth/google/callback/page.tsx#L103), [Facebook:94](src/app/auth/facebook/callback/page.tsx#L94), [Apple:90](src/app/auth/apple/callback/page.tsx#L90), [recovery screen:8](src/components/auth/OAuthCallbackRecovery.tsx#L8).

## 5. Idempotency and cache verification

Twenty repeated pending restoration calls under Strict Mode did not advance the signed-out cache epoch or auth generation again and dispatched no refresh/logout request. The initial cold pending transition retired old protected cache data once. Duplicate broadcasts and storage events also preserved epochs/generations.

Actual account changes and role changes still advanced epochs, retired query clients, and discarded old protected data. Explicit `clearAuth()` still invalidates outstanding generations even when it does not need to retire an already-signed-out cache. Stale callback refresh responses after account switching were discarded for all three providers and could not overwrite the newer account/token.

Regression references: [pending lifecycle:91](tests/oauth-callback-lifecycle.test.tsx#L91), [stale responses:155](tests/oauth-callback-lifecycle.test.tsx#L155), [ordinary repeated restoration:177](tests/oauth-callback-lifecycle.test.tsx#L177), [identity changes:184](tests/oauth-callback-lifecycle.test.tsx#L184).

## 6. All three callback results

| Provider | Pending callback / Strict Mode | Normal local cookie callback | Stale response / invalid cookie |
|---|---|---|---|
| Google | PASS — bounded, signed out, finite recovery | PASS — one refresh, correct destination | PASS |
| Facebook | PASS — bounded, signed out, finite recovery | PASS — one refresh, correct destination | PASS |
| Apple | PASS — bounded, signed out, finite recovery | PASS — one refresh, correct destination | PASS |

These results include actual Next.js pages in Chrome. They are not live provider authorization-code exchange verification.

## 7. Actual Next.js Chrome verification

Ran Next.js 16.2.9 with webpack in an isolated source copy on localhost:3100, using the installed dependencies. Google Chrome used fresh temporary profiles and native CDP/Web Locks. A local fault proxy forwarded real HTTP and browser cookies to the unchanged Bookly `ExpressApplication`, route handlers, auth services, and isolated MongoDB replica sets. Runtime MongoDB downloads were disabled. Unrelated external object-storage bootstrap was not invoked.

Fresh application/database instances isolated the three test groups. Existing rate limits remained unchanged: global 100 / 900,000 ms, login 10, refresh 30. The user's original services on ports 3000/3001 were preserved.

| Browser observation | Result |
|---|---|
| Pending logout → Google/Facebook/Apple callbacks | PASS for all three |
| Responsiveness, visible recovery, no automatic restoration | PASS — rendered DOM inspected and screenshots captured |
| New valid cookie family present during an old pending callback | PASS — zero automatic refresh/logout requests; newer family remained live |
| Original scheduled retry windows | PASS — first callback remained stable beyond both the 2-second and subsequent 10-second retry interval |
| Explicit logout resolution while callback mounted | PASS — recovery screen remained finite after confirmation/notice dismissal |
| Recovery button navigation | PASS — returned to sign-in route |
| Normal local callbacks without pending intent | PASS for all three — exactly one refresh each, no logout, authenticated home |
| Normal password login → logout → reload | PASS — authenticated avatar, confirmed notice, then anonymous reload |
| Logout 429 → reload → deadline recovery | PASS — marker/cookie retained during failure, then real logout 200 cleared both |
| Two-tab pending/confirmed synchronization | PASS — authenticated UI hidden; shared completion converged |

There were 15 recorded PASS observations across these three groups. Controlled callback fixtures used a real local password login only to model the backend's completed cookie/redirect boundary. **Live Google/Facebook/Apple provider authentication was not performed.**

Raw DOM snapshots, sanitized cookie metadata, session-family evidence, HTTP traces, and screenshots are retained at `C:/Users/rakib_bro/AppData/Local/Temp/bookly-phase1b-remediation-f43b8b6e5dfa49b2b34f7827babb263f/`. Main files: `browser-results.jsonl`, `browser-results-callbacks.json`, `browser-results-normal.json`, `browser-results-logout.json`, and `http.jsonl`. Access/refresh token values were not exported.

## 8. Retry-After and cross-tab correction

Previously, storage updates only invoked remote-pending handling when a tab's logout phase was idle. Once pending, it did not hydrate another tab's updated retry deadline. The correction always handles a pending storage update, performs teardown only when necessary, and synchronizes `retryAt`, persistence, and the rate-limited reason from the shared intent. It preserves local in-progress ownership.

In Chrome, both tabs displayed a disabled “Retry sign-out in …s” button after the injected 429. Reload retained the restriction; recovery occurred after the controlled deadline. Duplicate notifications did not cause identity remounts or premature requests. Server rate-limit behavior was unchanged.

References: [metadata synchronization:146](src/lib/auth/store.ts#L146), [remote handling:405](src/lib/auth/store.ts#L405), [regression:196](tests/oauth-callback-lifecycle.test.tsx#L196).

## 9. Validation commands and counts

| Command / check | Result |
|---|---|
| `pnpm exec vitest run` in client | **146/146 PASS**, 3 files: original 122 plus 24 new cases |
| `pnpm exec vitest run tests/oauth-callback-lifecycle.test.tsx -t 'remains bounded and signed out'` against matched pre-change source | **3/3 expected failures**, confirming the old remount loop |
| Targeted backend `pnpm exec vitest run ... --fileParallelism=false`, `MONGOMS_RUNTIME_DOWNLOAD=false` | **275/275 PASS**, 15 files; same targeted baseline selections |
| Client `pnpm exec tsc --noEmit --incremental false` | PASS |
| API `pnpm exec tsc --noEmit -p tsconfig.typecheck.json` | PASS |
| `pnpm exec eslint` on changed auth/store/callback/provider files and affected tests | PASS |
| API `pnpm exec biome lint` on targeted auth/session files | PASS with the existing optional-chain warning at `token.service.ts:205` |
| `git diff --check` in both repositories | PASS |

The backend selection included auth middleware/cookies/service/schema, token service, auth database/outage integration, all six customer/professional provider integrations, staff invitation integration, and health routes. Existing backend CRLF formatting findings from the earlier audit were not changed; this remediation ran lint without applying formatting fixes. Existing Next.js image aspect-ratio warnings appeared during browser testing and remain unrelated to authentication.

## 10. Security regression assessment

All original frontend tests passed, including all five protected-route guards, Phase 1 refresh 429 recovery, Phase 1B logout failures/retries, persistence/storage errors, explicit override behavior, stale generation checks, and query isolation. Backend tests passed session-family-aware Access JWT revocation, rotation/reuse detection, family revocation, authentication outage handling, provider-local integrations, and invitation flows.

Markers remain restrictions and are cleared only by existing acknowledged logout or successful deliberate session-replacement paths. Cookie replacement is still **not proof that the previous family was revoked**. No persistent credentials, relaxed refresh blocker, weakened guard, or backend authentication exception was introduced.

Before/after file hashes show only the six intended existing frontend files changed; the helper, recovery component, new test, and this report are additions. All pre-existing unrelated files, including `next.config.ts`, retained their hashes. Every existing backend file and its working diff remained unchanged. No reset, discard, dependency install, commit, push, deployment, Phase 1C, or Phase 2 work occurred.

## 11. Remaining risks and final verdict

Live external provider exchanges remain unverified. This focused change prevents automatic callback-driven logout of the cookie supplied to the callback, and that behavior was verified with a newer real local session. It does not introduce server-side correlation between an older pending intent and a family replaced by an already-in-flight external OAuth exchange, nor establish every cross-tab provider/cookie race. The documented storage-unavailable and old-family override limitations remain unchanged; browsers without Web Locks retain the existing fallback limitations.

| Required verdict | Result |
|---|---|
| Google callback | PASS — local integration and actual Next.js Chrome |
| Facebook callback | PASS — local integration and actual Next.js Chrome |
| Apple callback | PASS — local integration and actual Next.js Chrome |
| Infinite loop eliminated | PASS |
| Pending logout security | PASS in the tested paths |
| React Query cache isolation | PASS |
| Original 429 recovery | PASS |
| Real Next.js browser verification | PASS |
| Phase 1B overall | CONDITIONAL PASS — focused blockers fixed; external provider/race verification remains limited |
| Phase 1C readiness | NO for unconditional readiness while those integration gaps remain |

Stopped after the focused Phase 1B correction and verification.
