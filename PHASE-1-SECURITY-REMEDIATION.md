# Phase 1 security blocker remediation

Date: 2026-10-13 (Asia/Dhaka). Scope: the supplied Phase 1 remediation request only.

## 1. Executive summary

The three reproduced root causes have been corrected: account changes retire the previous query cache and its observers; local login invalidates pending authentication operations; logout revokes the cookie's entire refresh-token family atomically against rotation.

The refresh-family fix passed real MongoDB, HTTP, and two-tab Chrome tests, including Chrome applying a delayed successor cookie after an acknowledged logout. That cookie cannot refresh a session.

**Final security acceptance remains blocked by the literal stronger “no token” invariant in the request.** The current architecture uses stateless access JWTs without a session/family claim. An integration test demonstrates that an access JWT issued by the delayed refresh can still call `/auth/me` after logout. Immediate access-token revocation would require changes to token issuance and access-token validation across authentication flows. Those changes were not implemented as a speculative expansion of this focused remediation.

No dependencies, commits, pushes, rate-limit changes, or Phase 2 work were introduced. Existing uncommitted frontend work, including `next.config.ts`, was preserved. The active `.env` was not edited or printed.

## 2. Root cause analysis

1. **Cache leakage:** private keys such as `["auth", "me"]` and `["businesses", "profile"]` had no identity ownership. Cleanup occurred only on explicit logout. Login, cross-tab switches, refresh returning a different user, and terminal invalidation could reuse the previous account's cache. Removing a few keys would also leave observer results, component copies, mutation callbacks, and other private domains exposed.
2. **Login/refresh race:** `setAuth()` did not advance the existing authentication generation. A previously started refresh could overwrite a new login, or its terminal failure could clear the new session and broadcast logout. Request/interceptor and restoration continuations needed their own generation checks as well.
3. **Logout/rotation race:** logout revoked a single token row. Rotation consumed an ancestor, then inserted its successor separately. Even switching logout to an ordinary family `updateMany` would leave a consume/insert gap where revocation could miss a successor.

The initial existing suites were run before edits: frontend **66/66**, backend authentication baseline **65/65**. The before-behavior examples below are the supplied independently reproduced findings and inspected root causes; they are not represented as new browser reproductions of the old code.

## 3. Implementation details and exact files

References are to the final working files, not repository HEAD (which predates the user's uncommitted Phase 1 work).

| Changed file | Functions / locations | Purpose |
|---|---|---|
| `client/src/lib/auth/store.ts` | `applyAuth` line 43; `setAuth` 70; `clearAuth` 81; `restoreSession` 96; `logout` 127; restoration callback 165; broadcast subscriber 176 | Cache ownership before publishing identity; generation-safe restoration; immediate local logout teardown; guarded broadcasts. |
| `client/src/lib/api/client.ts` | generation accessor 97; cookie-mutation classifier 114; Web Lock helper 133; `refreshSession` 152; request interceptor 223; response interceptor 238; `apiRequest` 322 | Request epochs; stale response/retry rejection; callback checks; cookie mutation serialization. |
| `client/src/lib/query-client.ts` | `shouldRetryQuery` 5; `rotateQueryClient` 30; public-key predicate 43 | Separate client per identity boundary; cancellation and retirement; explicitly public cache preservation; no retries of stale operations. |
| `client/src/app/providers.tsx` | cache epoch subscription 12; provider boundary 19 | Recreate observers and account-local component state when cache ownership changes. |
| `client/tests/session-recovery.test.tsx` | identity-security regressions start at 330 | Account isolation, role coverage, pending operations, observer/avatar rendering, and cookie-operation lock coverage. |
| `api/src/modules/auth/token.service.ts` | `rotateRefreshToken` 75; `revokeRefreshToken` 114 | Family revocation on logout and on a concurrent consumed-token replay. |
| `api/src/modules/session/session.repository.ts` | `revokeFamily` 33; `rotate` 72 | Majority-acknowledged transactions; shared ancestor writes force conflicting rotation/revocation to retry safely. |
| `api/src/modules/session/session.model.ts` | `revocationVersion` declaration 10 and schema 26 | Ensure repeated revocations are real writes even within the same millisecond; compatible with existing rows. |
| `api/tests/integration/database/auth-database.integration.test.ts` | regressions 1190; access-token contract 1211; real Chrome 1234; logout-first 1324; consume/insert gap 1333; rollback 1375; concurrent orderings 1394; delayed HTTP cookie 1432 | Real persistence, concurrency, actual HTTP, browser-cookie verification, and explicit evidence of the remaining access-JWT limitation. |
| `api/tests/integration/database/browser-cdp-helper.ts` | browser availability 11; `startTestBrowser` 13 | Native Node WebSocket/CDP fixture; fresh temporary Chrome profile; two real tabs; cleanup; no dependency added. |
| `client/PHASE-1-SECURITY-REMEDIATION.md` | this report | Implementation, evidence, limitations, and verdict. |

`auth-channel.ts`, route guards, OAuth callback pages, and API logout/cookie controllers were inspected. They did not need additional production edits for these root causes.

## 4. Authentication architecture

**Identity/cache policy.** Cache ownership is a QueryClient instance. Initial authenticated restoration, login to another user, a role change, refresh returning another identity, logout, terminal invalidation, and remote session changes retire the previous instance. Same-user/same-role verification retains normal caches. A remote session change retires caches immediately before verifying its cookie; a subsequent 429 therefore cannot expose the old identity.

The previous client is cancelled and cleared; a delayed callback holding it cannot populate the new instance. The keyed provider boundary remounts observers and component state at identity boundaries, preventing `keepPreviousData`, old avatars, and copied query results from crossing accounts. This resets state below that boundary on an account change; it does not reload the application, disable caching, or reset normal navigation/same-identity refreshes.

**Complete cache scope.** All keys default to identity-dependent, including future keys. Inspected domains cover auth/profile, businesses/media/calendar/travel settings, staff/schedules/services, bookings/customer bookings, clients, availability, add-ons, services/booking settings, catalog, dashboards/analytics, favorites, packages/package actions, reviews, promos, finance/payout destinations, support, all Super Admin domains, taxonomy, invitations, and registration progress. Discovery includes optional personalized home sections, so its cache is conservatively retired. Admin content and private platform settings are also retired.

Only audited anonymous FAQ, published blog, public static-page keys, and public booking configuration are copied across boundaries, retaining their update timestamps. No `content` or `platformSettings` root is broadly exempted. Query keys and mutation invalidation prefixes remain unchanged inside each client.

**Operation policy.** Local login advances the generation even for the same user. Logout advances it before HTTP completion. Requests carry their dispatch generation; stale success, 401 responses, refresh waiters, queued lock callbacks, restoration continuations, and interceptor failure handlers cannot act in a newer generation. Promise cleanup still checks promise identity. Refresh detecting a different identity advances the generation and rejects replay of the previous identity's request. Stale errors are not query-retryable.

**Cross-tab policy.** Broadcasts continue to carry only events and tab identifiers. Remote events invalidate operations before cache/token changes. The shared Web Lock now covers refresh plus login, registration completion, staff password acceptance, logout, and account closure cookie writes. These cookie mutations cannot recursively refresh after a 401 while holding that lock. No new broadcast credential or persistence layer was added.

**Backend logout contract.** An acknowledged logout revokes the family identified by the supplied refresh cookie, including consumed ancestors and rotated successors. Other device families and other users remain independent. Missing/unknown tokens remain idempotent no-ops. Existing access JWTs remain stateless and valid until expiry (default TTL: 15 minutes).

Rotation consumes, inserts, and links the successor in one transaction. Family revocation writes every family member, including consumed ancestors, with a monotonic write counter. Thus concurrent transactions contend on a common document; a retry observes either the committed successor or committed revocation. Both use majority write concern. This relies on MongoDB's documented [transaction write-conflict behavior](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/); it was also tested against an isolated replica set. Standalone MongoDB cannot support this transactional path and fails rather than falling back to unsafe rotation.

## 5. Before/after behavior

| Original reproduction | After remediation | Evidence |
|---|---|---|
| B authenticated while A's profile/business/avatar remains cached | B owns a new client; A's observer result, local copy, arbitrary cache keys, and late writes do not appear in B's cache | Cache, all-five-role, A→B→A, and rendered observer/avatar tests |
| A refresh succeeds after B login and restores A | A's response/generation is stale; B's token/user/status remain current | Deferred same-tab restoration and interceptor success tests |
| A refresh returns 401 after B login and logs out B/broadcasts logout | Stale failure cannot invoke terminal callbacks or broadcast logout | Deferred restoration/interceptor failure and old-request-401 tests |
| R0 rotates to R1; logout R0 leaves R1 usable | Logout revokes the complete family; R1/R2 and delayed cookie refreshes return 401 | Database successor, concurrent gap, HTTP delay, and real Chrome tests |
| Delayed refresh access JWT used after logout | **Still usable until expiry under the existing architecture** | Actual `/auth/me` middleware integration test; unresolved stronger invariant |

## 6. Security verification

Frontend evidence covers cache isolation, arbitrary keys, public/private content separation, all roles, role changes, repeated account switches, rendered active observers with `keepPreviousData`, component copies, delayed API/query responses, same-tab login versus refresh success/401/429, refresh returning a different account, cross-tab invalidation, initial/restored auth states, logout during refresh, single-flight cleanup, queued Web Lock cancellation, all five fail-closed route guards, OAuth callback recovery, 429 recovery, and bounded token-reuse retry.

Backend evidence covers refresh-before-logout, logout-before-refresh, twelve concurrent alternating orderings, logout inside the consume/insert gap, failed successor insertion rollback, R0→R1→R2 family revocation, delayed HTTP cookies, repeated logout, invalid/expired/revoked tokens, concurrent refresh reuse revoking the winner's family, and independent device/user families.

**Real-browser evidence:** the Chrome test starts a fresh profile and two tabs against actual AuthController/AuthService/TokenService endpoints and an isolated MongoDB replica set. Password login creates the real HttpOnly cookie. Tab A starts refresh; only its response is deliberately held after real rotation. Tab B receives logout 200. The response is released, and Chrome itself applies R1 through `Set-Cookie`. Both tabs subsequently send R1 and receive 401; captured service arguments prove these were R1 requests, not missing-cookie rejections. This was executed successfully, not skipped or simulated with an Axios adapter.

The fixture omits production route rate-limit/middleware composition and the Next.js UI; it uses actual authentication handlers, real HTTP, real cookies, and real persistence. Frontend observer/guard tests use React with jsdom and controlled Axios adapters. Full Next.js browser account-switching and live third-party OAuth handshakes were not run.

## 7. Executed checks and results

Commands are relative to the stated repository. Repeated checks are not added together as unique test totals.

| Repository | Command | Result |
|---|---|---|
| client | `pnpm test` | **86 passed**, 1 file; baseline was 66 |
| api | `pnpm exec vitest run tests/unit/token-service.test.ts tests/unit/auth.service.test.ts tests/unit/auth.middleware.test.ts tests/unit/auth.cookies.test.ts tests/integration/database/auth-database.integration.test.ts --pool=forks --fileParallelism=false` | **122 passed**, 5 files: 65 baseline unit tests + 57 database tests, including real Chrome |
| api | `$authTestFiles = @(rg --files tests/unit \| Where-Object { $_ -match 'auth\|token-service' }); pnpm exec vitest run @authTestFiles` | **231 passed**, 19 files; includes the preceding 65 unit tests |
| api | `$oauthTestFiles = @(rg --files tests/integration/database \| Where-Object { $_ -match '(customer\|professional)-(google\|facebook\|apple)-auth-http' }); pnpm exec vitest run @oauthTestFiles --pool=forks --fileParallelism=false` | **70 passed**, 6 files |
| client | `pnpm exec tsc --noEmit` | PASS |
| api | `pnpm typecheck` | PASS |
| client | `pnpm exec eslint src/lib/auth/store.ts src/lib/api/client.ts src/lib/query-client.ts src/app/providers.tsx tests/session-recovery.test.tsx` | PASS |
| api | `pnpm exec biome check src/modules/auth/token.service.ts src/modules/session/session.repository.ts src/modules/session/session.model.ts tests/integration/database/auth-database.integration.test.ts tests/integration/database/browser-cdp-helper.ts` | Exit 0; no errors; one existing optional-chain warning in `revokeOtherSessionsForUser` |
| both | `git diff --check` | PASS; Git emits only line-ending conversion notices |

Distinct executed totals: **86 frontend + 358 backend tests** (231 unit + 57 auth database + 70 OAuth HTTP/database). Zero final test failures. Backend lint-warning provenance was checked with `git show HEAD:src/modules/auth/token.service.ts`; the warned expression exists unchanged in HEAD. Intermediate formatting/type/test issues introduced during implementation were corrected before final checks.

## 8. Regression assessment

Existing 429/nonterminal failure classification, explicit recovery, fail-closed `unverified` guards, refresh rotation, HttpOnly cookie configuration, expiration, and independent device sessions remain supported by the executed tests. Rate-limit thresholds and architecture, booking/payment/business functionality, and existing frontend edits were not changed.

The concurrent-refresh loser now revokes its winning successor family, matching reuse detection rather than leaving a usable winner after a proven replay. Legitimate tabs lacking Web Locks can therefore lose their session during a same-cookie race; relaxing reuse detection would weaken security and was not done.

Transactions increase refresh/revocation database work and require the replica-set/sharded transactional capability already used elsewhere in authentication. The small `revocationVersion` field works with existing documents through `$inc`; no data rewrite is required. Cache boundary remounts discard account-local form/component state on actual identity changes, deliberately preventing old-account state from persisting.

## 9. Remaining issues and limits

1. **Literal all-token logout invariant remains unmet.** The observed post-logout access-JWT `/auth/me` response is 200. Proposed design for review: bind access JWTs to the refresh session/family at every minting path and validate authoritative family revocation in required and optional authentication middleware, with an explicit legacy-token migration policy. This can use the existing session storage, but changes cross-flow access-token semantics and must be reviewed rather than partially implemented here.
2. **No-Web-Locks fallback:** generation checks and same-tab refresh single-flight remain, but transport/cookie writes are not serialized across tabs (or competing login/refresh calls without the API). Concurrent reuse remains fail-closed. A late old-family cookie can also supersede a newer login cookie when transport serialization is unavailable; memory-epoch protection does not eliminate that cookie-level limitation. Full cookie convergence is therefore not claimed for such environments.
3. **No BroadcastChannel:** the existing application has no equivalent cross-tab event fallback. Old tabs learn a cookie change through a later server interaction; immediate cross-tab convergence is not claimed in this unsupported configuration.
4. OAuth top-level navigation cannot participate in the frontend HTTP Web Lock. Actual external-provider navigation races, full Next.js multi-tab avatar switching, browser 429 UI recovery, production deployment topology, and unrelated API suites were not independently browser-verified in this run. The existing route/handler/database tests and UI recovery tests passed as described above.
5. Failed/logout-rate-limited HTTP requests do not acknowledge backend revocation. Local teardown still occurs, as in the existing behavior; no claim of server revocation is made for a failed logout request.

## 10. Final verdict

| Item | Verdict |
|---|---|
| Blocker 1: cross-account query cache leakage | **PASS** — cache/observer/request isolation verified in focused frontend tests |
| Blocker 2: pending refresh overwrites or logs out a newer local login | **PASS** — generation-based state and callback protections verified; cookie fallback limits remain explicit above |
| Blocker 3: logout/rotation | **FAIL for the request's literal all-token invariant** — the reproduced refresh-family/successor defect is fixed and real-browser verified, but delayed access JWTs remain usable until expiry |
| Original HTTP 429 recovery | **PASS** in frontend regression coverage; new live-browser 429 UI verification was not executed |
| Authentication security regression | **PASS within the executed suites and existing access-JWT contract**; no universal unsupported-browser or immediate JWT-revocation guarantee |
| Phase 1 overall | **FAIL final security acceptance** under the supplied stronger invariant; implemented root-cause fixes are ready for review |
| Phase 2 readiness | **NO** |

Stop here for review. No commit, push, or Phase 2 implementation was performed.
