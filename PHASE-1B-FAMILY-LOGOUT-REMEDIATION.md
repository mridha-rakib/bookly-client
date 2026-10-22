# Phase 1B intended-family logout remediation

14 October 2026, Asia/Dhaka. **The reproduced wrong-family revocation and false-confirmation blocker is corrected. Phase 1B overall remains FAIL; Phase 1C readiness is NO because complete newer-cookie preservation is not established.**

## 1. Executive result

Logout now targets the family captured from the in-memory access JWT before local sign-out. The backend independently resolves the presented HttpOnly cookie through its stored hash, matches its actual family, performs the existing transactional revocation, and acknowledges the exact intent and family. Missing/unknown cookies, mismatches, and arbitrary HTTP 200 responses cannot confirm the original intention. Logout responses never write or clear cookies, removing the delayed logout-header race.

The original two-tab A/500/B-cookie/old-retry case passes with actual Next.js, Chrome, Express handlers, and isolated MongoDB for Google, Facebook, and Apple; it also passes with Web Locks disabled. B's JWT and actual browser refresh cookie remain usable, and A stays explicitly unconfirmed. A separate controlled old-refresh-response ordering still overwrites B's cookie under the shared cookie name. That remaining availability limitation is verified and prevents unconditional acceptance. No broader cookie architecture was implemented.

## 2. Exact original cause and corrected locations

The original intent contained no family, retry eligibility checked only the existence of any intent, the server revoked whichever cookie family arrived, and any HTTP success cleared the shared marker. The acceptance evidence reproduced A=200/B=401 with a confirmed UI. A second problem was unconditional logout `clearRefreshCookie`: an A response delayed after B's login could erase B's current cookie. AJAX Web Locks cannot encompass external provider redirects.

Current correction references:

- [JWT family extraction](C:/Users/rakib_bro/sta-projects/bookly-cy/client/src/lib/auth/token-memory.ts:6).
- [Persistent intent and scoped receipts](C:/Users/rakib_bro/sta-projects/bookly-cy/client/src/lib/auth/logout-intent.ts:14).
- [Exact request ownership and acknowledgement handling](C:/Users/rakib_bro/sta-projects/bookly-cy/client/src/lib/auth/store.ts:182).
- [Capture before discarding auth](C:/Users/rakib_bro/sta-projects/bookly-cy/client/src/lib/auth/store.ts:277).
- [HTTP request and response correlation](C:/Users/rakib_bro/sta-projects/bookly-cy/client/src/lib/api/client.ts:213).
- [Mandatory HTTP contract; no logout Set-Cookie](C:/Users/rakib_bro/sta-projects/bookly-cy/api/src/modules/auth/auth.controller.ts:182).
- [Trusted cookie-family comparison before mutation](C:/Users/rakib_bro/sta-projects/bookly-cy/api/src/modules/auth/token.service.ts:188).

The before-fix reproduction is retained in [the independent acceptance report](C:/Users/rakib_bro/AppData/Local/Temp/bookly-phase1b-acceptance-8466570cfac4487fbcc75692849c53e3/ACCEPTANCE-REPORT.md). That is prior executed evidence, not a newly rerun defective checkout.

## 3. Frontend/backend HTTP contract

`POST /api/v1/auth/logout` requires JSON `{ intentId, familyId }`. Family IDs must be UUIDs; intent IDs are bounded nonempty strings. The controller validates this contract even when mounted directly in an integration fixture. The existing public route still reaches this controller; it has no legacy unbound success fallback.

Only a committed matching revocation returns HTTP 200 with envelope data `{ intentId, familyId, outcome: 'revoked' }`. The frontend validates all three fields at runtime and checks that the same intent still owns the shared pending state. Typed `authApi.logout` also requires the bound request; all current UI logout callers use the store's lifecycle primitive.

HTTP 409 `LOGOUT_FAMILY_MISMATCH` and `LOGOUT_UNVERIFIABLE` remain unconfirmed, with manual retry only. Invalid request metadata returns HTTP 400 `LOGOUT_INTENT_REQUIRED`. HTTP 429 preserves Retry-After; 5xx, network loss, and timeout remain bounded retryable failures. No error creates an acknowledgement or logout cookie mutation.

## 4. Intended identity and persistence

The client decodes only `sid` from its in-memory access JWT. This is correlation, not signature verification or authorization. The intent stores only its random ID, family ID, creation time, and retry metadata. Access/refresh tokens and credentials are never persisted.

Retries and duplicate clicks are owned by an exact ID/family pair. Creation, timer dispatch, response handling, and login-override completion recheck this pair. An older promise cannot resolve a newer intent or update its retry deadline. A new explicit logout invalidates outstanding authentication operations, while repeated pending restoration retains the existing idempotent cache behavior.

Resolution uses `bookly:logout-resolved:<intentId>` receipts rather than deleting the shared pointer. Deadlines use `bookly:logout-retry:<intentId>`. This avoids localStorage's non-atomic compare/delete and compare/write races even without Web Locks. `readLogoutIntent()` is authoritative: the raw `bookly:logout-pending` key can physically retain a resolved record. A subsequent intent replaces the pointer and cleans the prior ID's auxiliary records. Confirmed and deliberately abandoned intents use the same local resolution mechanism, but only server-proven revocation produces a confirmation broadcast or confirmed UI.

Legacy markers without a family remain blocked and cannot learn a target from a newer cookie. Corrupt markers always fail closed, including when an older unreadable receipt exists. They require explicit browser-state recovery rather than fabricated server confirmation.

## 5. Backend revocation semantics

`AuthService.logoutIntended` calls `TokenService.revokeIntendedFamily`. The latter hashes the actual cookie, loads its trusted session row, compares the stored family to the expected family, then invokes the unchanged majority-committed transactional `SessionRepository.revokeFamily`.

| Presented cookie | Result |
|---|---|
| Known live row, matching family | Revoke the whole intended family and acknowledge |
| Rotated/consumed ancestor or successor, matching family | Same family revocation; rotation does not change `sid` |
| Already-revoked matching row | Repeat the transaction and acknowledge; safe after a lost response |
| Retained expired matching row | Possession can prove a revocation target, never authenticate; revoke and acknowledge |
| Missing/unknown row, including a TTL-deleted row | 409 unverifiable; no confirmation |
| Known cookie from another family, including the same account | 409 mismatch before any revocation; preserve that cookie |
| Database read/transaction failure | Error/unconfirmed; no fabricated success |

The expected family alone never authorizes revocation. Other users and other device families remain independent. Refresh rotation, reuse detection, JWT TTL, session schemas, and the transactional consume/insert conflict protection are unchanged. The existing internal cookie-based `AuthService.logout`/`TokenService.revokeRefreshToken` primitives remain for existing direct service tests; the public HTTP controller exclusively uses the bound contract.

## 6. HTTP response ordering: passes and verified limit

The existing cookie remains `bookly_refresh_token`, HttpOnly, path `/api/v1/auth`, configurable domain, SameSite and Secure. Local Chrome used host-only cookies, SameSite=Lax, Secure=false; production flags were not changed. Cookie matching depends on name/path/domain, so a late expiry header for that same tuple previously erased whichever value was current.

Logout now emits no Set-Cookie on either success or failure. Its original revoked cookie may remain until expiry or a later login replaces it; server-side revocation immediately rejects both access JWT and refresh. This is intentional and necessary to avoid unconditional shared-cookie deletion.

Real Chrome tested both required orders:

| Controlled order | A JWT | B JWT | Browser refresh |
|---|---:|---:|---|
| B cookie arrives before delayed A logout response | 401 | 200 | 200, still B's family |
| A logout response arrives before delayed B login cookie | 401 | 200 | 200, still B's family |

**Verified remaining limitation:** hold an actual A rotation response, revoke A, issue B's new cookie through a real login response, then release A's old rotation Set-Cookie. Chrome installs A's stale cookie. A JWT=401, B JWT=200, browser refresh=401; B's database family remains live but its cookie is no longer usable. The test records this as a limitation, not a passing preservation result. Authentication-generation checks cannot conditionally prevent browsers applying response headers. External provider responses bypass JavaScript locks.

The smallest robust architectural alternative is to isolate refresh cookies by immutable family name, with a current-family selector written only on new-session creation; refresh and logout must never overwrite/clear another family's cookie or selector. Selection must still require the corresponding trusted opaque cookie, and must never fall back to an older family after revocation. Another option for supported Web Locks browsers is to replace provider callback cookie issuance with a single-use, verified completion grant exchanged through the existing serialized frontend session-creation path. That option alone cannot guarantee cross-tab ordering without Web Locks. Neither alternative was implemented or asserted verified. No generic auth rewrite, phase expansion, or frontend workaround is substituted for this limitation.

## 7. Cross-tab, OAuth, and session creation

Pending and confirmed broadcasts carry non-secret intent/family correlation. Unscoped or mismatched confirmation cannot resolve another intent. Storage notifications also react to intent-scoped receipts/deadlines; storage-only recovery remains covered. An accidental external B-cookie replacement leaves A's intent pending. A deliberate override is scoped to the particular intent approved before dispatch and only resolves it after a successful matching new-session operation; it does not claim old-family revocation.

Password login for customer/professional/admin, customer registration completion, owner registration completion, and staff password invitation acceptance continue through the shared preflight. That preflight rechecks permission inside the cookie lock and after the HTTP response; a newer intent prevents applying stale login auth. `setAuth` also refuses authentication while an intent remains pending. All issuance paths use the existing `issueAuthSession` family-bound JWT machinery.

Google/Facebook/Apple callbacks retain their existing finite recovery screen and callback interruption latch. They do not replay provider codes, trust success URL parameters as authentication, or automatically resolve a possibly replaced cookie. An older tab may retry, but the server rejects its family mismatch before mutation. Cache retirement and stale refresh-generation rejection remain covered by the existing actual Providers tests. No provider-specific security branch was added.

## 8. Exact changed files/functions

Frontend source:

- `src/lib/auth/token-memory.ts`: `getSessionFamilyId`.
- `src/lib/auth/logout-intent.ts`: parsing/reading, `beginLogoutIntent`, `sameLogoutIntent`, scoped retry/resolution persistence, remote intent memory and storage subscriptions.
- `src/lib/auth/store.ts`: `startLogout`, `resolvePendingLogout`, timer ownership, pending synchronization, `setAuth`, session-establishment hooks, correlated broadcast handling.
- `src/lib/auth/auth-channel.ts`: correlated event types and pending/confirmation posts.
- `src/lib/api/client.ts`: `sendLogoutRequest`, session-establishment context and pre/post permission checks.
- `src/lib/api/auth.ts`: bound logout request/result signature.
- `src/components/auth/LogoutPendingNotice.tsx`: honest mismatch/unverifiable explanations.

Frontend tests: `tests/logout-pending.test.tsx`, `tests/session-recovery.test.tsx`, `tests/oauth-callback-lifecycle.test.tsx`. Auth fixtures now contain a realistic non-secret `sid`; success fixtures acknowledge the actual request.

Backend: `src/modules/auth/auth.schema.ts` (`logoutBodySchema`), `auth.errors.ts` (distinguishable errors), `auth.controller.ts` (`logout`), `auth.service.ts` (`logoutIntended`), `token.service.ts` (`revokeIntendedFamily`); tests `tests/integration/database/auth-database.integration.test.ts` and `tests/helpers/session-binding.ts`.

New documentation: this report. Existing remediation reports and `next.config.ts` were preserved.

## 9. Before/after original High-severity case

| Same controlled two-tab sequence | Before (retained independent evidence) | After (new Chrome verification) |
|---|---|---|
| A logout receives 500, B receives new provider-style cookie | A pending | A pending, bound to A family |
| Old tab retries with B cookie | HTTP 200, revokes B | HTTP 409 mismatch, no cookie header |
| A's original JWT | 200 | 200; honestly unconfirmed |
| B's JWT | 401 | 200 |
| B browser refresh cookie | Cleared by logout | Refresh 200, B family retained |
| A intent/UI | Cleared; “You're signed out.” | Pending; “Sign-out not confirmed” |
| Callback UI | Finite recovery | Finite recovery, no silent restoration |

After results passed for Google, Facebook, and Apple. The Google case also passed after disabling `navigator.locks` in both tabs before document initialization. Provider completed-cookie/redirect boundaries were simulated with actual Bookly login responses and real new database families. External provider handshakes were not executed.

## 10. Validation and browser evidence

Commands newly run from the corresponding repository:

```text
# client
pnpm exec vitest run
# 161/161: logout pending 49, session recovery 88, OAuth lifecycle 24
pnpm exec vitest run tests/oauth-callback-lifecycle.test.tsx
# 24/24
pnpm exec tsc --noEmit --incremental false
# exit 0
pnpm exec eslint src/lib/api/auth.ts src/lib/api/client.ts src/lib/auth/token-memory.ts src/lib/auth/logout-intent.ts src/lib/auth/store.ts src/lib/auth/auth-channel.ts src/components/auth/LogoutPendingNotice.tsx tests/logout-pending.test.tsx tests/session-recovery.test.tsx tests/oauth-callback-lifecycle.test.tsx
# exit 0

# api, MONGOMS_RUNTIME_DOWNLOAD=false
pnpm exec vitest run tests/unit/auth.middleware.test.ts tests/unit/auth.cookies.test.ts tests/unit/auth.service.test.ts tests/unit/token-service.test.ts tests/integration/database/auth-database.integration.test.ts tests/integration/database/auth-session-outage.integration.test.ts tests/integration/database/customer-google-auth-http-database.integration.test.ts tests/integration/database/customer-facebook-auth-http-database.integration.test.ts tests/integration/database/customer-apple-auth-http-database.integration.test.ts tests/integration/database/professional-google-auth-http-database.integration.test.ts tests/integration/database/professional-facebook-auth-http-database.integration.test.ts tests/integration/database/professional-apple-auth-http-database.integration.test.ts tests/integration/database/staff-invitation-http-database.integration.test.ts tests/unit/auth.schema.test.ts tests/integration/health-routes.test.ts --fileParallelism=false
# 282/282 in 15 files; previous targeted baseline 275
pnpm exec vitest run tests/integration/database/auth-database.integration.test.ts --fileParallelism=false
# 81/81 during focused development
pnpm exec tsc --noEmit -p tsconfig.typecheck.json
# exit 0
pnpm exec biome lint src/modules/auth/auth.controller.ts src/modules/auth/auth.errors.ts src/modules/auth/auth.schema.ts src/modules/auth/auth.service.ts src/modules/auth/token.service.ts tests/helpers/session-binding.ts tests/integration/database/auth-database.integration.test.ts
# exit 0; existing useOptionalChain warning in token.service.ts, now line 220

# workspace
git -C client diff --check
git -C api diff --check
# both exit 0
```

The initial broad backend run had 10 newly incompatible old HTTP logout fixtures returning 400; the shared session-binding helper was updated to send and validate the bound contract, then the full targeted command passed. The frontend fixture incompatibilities were similarly corrected and the full suite passed. These intermediate failures were not counted as successes. One UI browser probe initially required `/customer` on reload; the actual configured customer guard redirects to `/select-role`. Its corrected signed-out checks and recorded routes pass. No load testing or limiter thresholds were changed.

Git also reports LF/CRLF conversion advisories for dirty working files; both whitespace checks exit 0. The existing optional-chain lint warning was not changed. The final frontend source comparison against the browser copy reports zero mismatches, and `preservation-verification.json` reports zero unexpected changes or missing baseline files.

Final browser observations include four A/B mismatch runs (three providers plus no-Web-Locks), two logout/login header arrival orders, five UI logout/recovery/reload cases (normal, 429, 503, network, lost response), and corrupt-marker finite callback recovery with zero automatic auth requests. The old-refresh ordering is a separate verified negative result. Earlier duplicate exploratory runs are not added to these counts.

Evidence directory: `C:\Users\rakib_bro\AppData\Local\Temp\bookly-family-remediation-18383d8f316f44df881a7399f0f146d5` (the short `RAKIB_~1` path resolves to the same directory).

Reproducible probes: `run-targeted.mjs`, `two-tab-intent.mjs`, `transport.mjs`, `ui-recovery.mjs`, `corrupt-marker.mjs`. Supporting isolated runtime: `backend.mts`, `proxy.mjs`, `cdp.mjs`, exact frontend copy in `client/`. Results: `two-tab-intent-results.jsonl`, `transport-results.jsonl`, `ui-results.jsonl`, `corrupt-marker-results.jsonl`, sanitized `http.jsonl`, per-provider `family-mismatch-*.png`. JWT/cookie values are retained only in test-process memory and are not exported in these results. Cookie evidence includes presence and attributes; family evidence includes IDs, account labels, expiry, and revocation status.

## 11. Phase 1 regression assessment

New and existing tests pass for same-account independent families, trusted matching before mutation, R0/R1 family stability, matching revoked-cookie retries, retained expired rows, missing/unknown rows, transaction failure, concurrent logout/rotation, immediate access JWT rejection, token reuse detection, independent devices, refresh/session database outages, all five frontend role guards, all provider/session-creation integrations, cache isolation, stale refresh responses, bounded retries, timeout/cancellation, Retry-After, reload, storage-only cross-tab handling, explicit password override, Strict Mode, and finite OAuth callbacks.

No regression of the Phase 1A family validator is established. In the corrected mismatch A remains live because its cookie is absent; the UI states this accurately. On matching confirmed logout A's JWT is rejected immediately. In the residual old-refresh header case A also stays revoked: the demonstrated effect is loss of B's usable browser cookie, not authentication by A or revocation of B.

## 12. Remaining risks and boundaries

Full newer-cookie preservation is LIMITED because cookie rotation and external OAuth still share a cookie name. This is a verified browser limitation requiring the architectural correction described above, not a frontend state problem. The mandatory full preservation requirement is therefore not accepted even though the original High-severity attribution/revocation defect is fixed. No remaining High/Critical exploit was established in this run; the demonstrated residual consequence is session availability/restart.

Without usable storage, persistence across reload/new tabs cannot be guaranteed; the existing warning remains. Intent-scoped metadata protects available storage without needing atomic localStorage deletion. Web Locks remain necessary for reliable cross-tab refresh serialization; disabling them does not break backend family ownership, but concurrent refresh reuse can still end the same family under the unchanged security policy. BroadcastChannel is a same-origin coordination mechanism, never an authentication proof. Corrupt metadata deliberately remains blocked. Live provider credentials/handshakes and production deployment/browser combinations were not tested.

## 13. Compatibility, preservation, and stopping point

Deploy backend and frontend contract updates together; backend-first safely rejects old unbound logout calls with 400. Reload older tabs to acquire the new client. Existing valid legacy pending records without `familyId` remain unconfirmed and can only be deliberately superseded by the existing authorized sign-in override; they must not be retroactively bound to whichever cookie is now present. Legacy JWTs lacking `sid` similarly cannot supply a verifiable frontend target. Corrupt records require explicit browser-state recovery. Consumers must use `readLogoutIntent` rather than raw key absence to interpret scoped receipts.

No dependencies, rate thresholds, JWT expiry, rotation/reuse guarantees, session database schemas, booking/payment/staff/business behavior, `next.config.ts`, or unrelated existing work were changed. No commit or push was made. Hash comparison identifies only the 17 intended existing source/test files listed above plus this new report. Owned isolated services are stopped at completion; the user's existing application servers are preserved. No Phase 1C or Phase 2 work was performed.

## Mandatory verdict

| Area | Verdict |
|---|---|
| Intended-family logout binding | PASS |
| Backend authoritative family matching | PASS |
| Wrong-family revocation prevention | PASS |
| False logout confirmation prevention | PASS |
| Newer-session cookie preservation | LIMITED — both logout arrival orders pass; old refresh header can overwrite B |
| Google callback integration | PASS for the corrected logout contract and finite lifecycle; transport limitation above remains |
| Facebook callback integration | PASS for the corrected logout contract and finite lifecycle; transport limitation above remains |
| Apple callback integration | PASS for the corrected logout contract and finite lifecycle; transport limitation above remains |
| Cross-tab safety | LIMITED — exact intent/family ownership passes, including no Web Locks; global cookie-header ordering remains limited |
| Phase 1A immediate JWT revocation | PASS |
| Original HTTP 429 recovery | PASS |
| Remaining High/Critical blockers | NO established remaining High/Critical finding; verified cookie availability limitation remains |
| Phase 1B overall | FAIL — mandatory complete newer-cookie preservation is not met; do not close Phase 1B |
| Phase 1C readiness | NO |
