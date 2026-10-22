# Bookly Phase 1: HTTP 429 and session recovery

Implemented only Phase 1. No backend source, rate-limit threshold, limiter architecture, or token-rotation changes. The pre-existing uncommitted `next.config.ts` changes were preserved.

## Inspection and root cause

The workspace contains one authentication store, five protected-route guards, three OAuth callback pages, and a shared Axios refresh primitive. No separate Phase 0 findings document was found, including in hidden project documentation. Existing auto-logout audit comments and the areas identified in the request were reviewed; an unavailable Phase 0 report could not be independently checked.

1. `src/lib/api/client.ts`: `classifyRefreshFailure()` previously classified every response below 500 as terminal, except `401 / REFRESH_TOKEN_REUSED`. A refresh 429 therefore cleared the in-memory token and invoked `onSessionExpired`. Its store callback cleared the user/session metadata and broadcast `AUTH_LOGGED_OUT` to other tabs. Guards then redirected to login.
2. `src/lib/auth/store.ts`: `restoreSession()` separately cleared authentication for every error except a stale generation, including 429, network errors, and 5xx. This path cleared local state without broadcasting logout.
3. `src/lib/query-client.ts`: unconditional `retry: 1` retried non-retryable 4xx. The professional registration-progress hook also explicitly set `retry: 1`. The interceptor returned the original protected-request 401 after a temporary refresh failure, hiding the actual refresh status from callers.
4. Guards relied on store status, so wrongly marking temporary failures unauthenticated produced login redirects. Simply preserving authenticated status would allow protected children to continue rendering despite unsuccessful verification. OAuth callback timeouts also offered a return to sign-in after a temporary failure.
5. Existing generation protection checked successful refresh results only. An old failed refresh could clear a newer cross-tab session; its finalizer could also erase a newer in-flight refresh promise. A session-change event during initialization did not release the old initialization flag before starting its replacement restore.

## Files and logic changed

| Files | Change |
| --- | --- |
| `src/lib/api/client.ts` | Shared failure classifier: 401/403 remain terminal, reuse remains a separate bounded-retry security path, and non-auth failures including 429 preserve credentials. Temporary refresh errors are returned to callers. Added callbacks to mark verification unavailable and apply successful interceptor recovery. Generation checks now cover failures and queued Web Locks callbacks; promise cleanup respects the active generation. |
| `src/lib/auth/store.ts` | Added `unverified` status. Temporary restoration failures retain user, token, and expiry metadata, release initialization, and send no auth broadcast. Successful verification restores authenticated status. Cross-tab session changes can begin a new restore immediately while stale results are discarded. |
| `src/lib/query-client.ts` | Query retries stop on all 4xx, including 429. Network failures and 5xx retain one retry. Mutation retries remain disabled. |
| `src/lib/auth/hooks.ts` | Removed the registration-progress retry override so it inherits the shared policy. |
| `src/components/auth/SessionRecovery.tsx` | Shared temporary-verification screen with an explicit retry button, disabled while verification is running. |
| `src/components/auth/RequireBusinessOwner.tsx`, `RequireCustomer.tsx`, `RequireStaff.tsx`, `RequireSupervisor.tsx`, `RequireSuperAdmin.tsx` | Unverified sessions render recovery instead of protected children. Existing terminal-login and wrong-role redirects remain. No automatic retries while unverified. |
| `src/app/super-admin/login/page.tsx` | Offers session recovery after temporary verification failure. |
| `src/app/auth/google/callback/page.tsx`, `facebook/callback/page.tsx`, `apple/callback/page.tsx` | Temporary verification failure renders recovery even after the existing timeout. Successful recovery follows the existing destination logic without showing a timeout failure. |
| `tests/session-recovery.test.tsx` | 66 focused tests using actual Axios interceptors, Zustand store, React Query, and mounted React guards/callbacks with simulated HTTP and broadcast events. |
| `vitest.config.mts`, `package.json`, `pnpm-lock.yaml` | Added reproducible frontend testing with Vitest and jsdom and a `pnpm test` command. |

## Before and after

| Situation | Before | After |
| --- | --- | --- |
| Protected request 401 followed by refresh 429 | Session cleared, logout broadcast, login redirect; refresh status hidden | Credentials retained, session unverified, protected content hidden, actual 429 returned, no logout broadcast or automatic query retry |
| Initial restore 429/network/5xx | Local session cleared and marked unauthenticated | Unverified recovery screen; no access granted and no revocation claim |
| Explicit retry after temporary 429 | Usually already redirected to sign-in | Successful refresh restores auth and role-appropriate access |
| Invalid/expired/revoked refresh, deleted account, suspended user | Terminal auth teardown | Preserved terminal teardown |
| Refresh-token reuse | One interceptor retry; repeated reuse terminal | Preserved bounded retry and terminal security handling; a 429 on the second attempt remains temporary |
| Remote logout during refresh | Successful stale results discarded | Both successful and failed stale results discarded; queued stale refreshes never sent |

## Validation

Executed from `client`:

- `pnpm test`: **66 passed**, one test file. Covers refresh 429, retained credentials, cold-start denial, explicit and interceptor recovery, other non-auth errors, invalid/deleted/suspended credentials, reuse handling, broadcasts, logout races, Web Locks, single-flight generations, retry counts, all five guards, wrong-role denial, OAuth timeouts, and Super Admin recovery.
- `pnpm exec tsc --noEmit --incremental false`: **passed**.
- Targeted `pnpm exec eslint` across every changed TypeScript/TSX file and the test configuration: **passed**.
- `git diff --check`: **passed**.

Executed from `api`:

- `pnpm test tests/unit/token-service.test.ts tests/unit/auth.service.test.ts tests/unit/auth.middleware.test.ts tests/unit/auth.cookies.test.ts`: **65 passed**, four test files. Includes existing rotation, token-reuse, concurrent-rotation, revocation, middleware, and cookie checks.

The final API working tree remains unchanged. The existing `next.config.ts` diff remains unchanged.

## Security, regressions, and remaining risks

Unverified status fails closed: protected children never render until a successful refresh establishes authentication and the guard accepts the role. Retained credentials alone do not grant access; backend authorization remains authoritative. A session-change broadcast still drops the previous account's token/user before verifying the shared cookie. Broadcasts continue to carry events only. Explicit logout and terminal interceptor failures still end auth and broadcast logout; a refresh 429 does neither.

The HttpOnly refresh cookie, rotation, invalid-token detection, family revocation, existing bounded reuse retry, same-tab single-flight, and cross-tab Web Locks model remain in place. No failed protected request is replayed after unsuccessful refresh. No protected data is returned by the failed request in the tests.

Remaining limits:

- Tests simulate HTTP responses and tab events in jsdom. A live browser/multiple-tab end-to-end test against the deployed limiter and a production build were not run.
- Browsers without Web Locks retain the existing same-tab-only fallback and its cross-tab refresh-race risk.
- Recovery is explicit. Pressing retry before the server's rate-limit window resets can produce another 429; no automatic cooldown or limiter change was introduced.
- Existing uncertainty when a network/server failure happens after server-side rotation remains governed by the existing rotation/reuse model.
- Separate Phase 0 findings were unavailable for comparison.

Phase 2 was not started.
