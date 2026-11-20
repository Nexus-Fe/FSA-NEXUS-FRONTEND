# Nexus role UI and API audit

Audited: 2026-10-29  
Frontend revision: `24e7054` (`feat/UI-enhancement`)  
Audit branch: `VU/UI-customer`

## Scope and verification limits

- Reviewed the current Nexus routes, role shells, auth/API client, FSD guidance, existing design plans, and the adjacent `fsa-nexus-be` source.
- No product source or backend source was edited. This file is the only audit artifact added by this review.
- `npm run lint` completed with 0 errors and 3 warnings. Two warnings are in `RoleGate.tsx` for the unused role checker; one is an unused `busy` variable in Buyer reports.
- `npm run typecheck` passed.
- Docker Engine is not running in this environment (`docker ps` could not connect to `dockerDesktopLinuxEngine`). Consequently, this review confirms source contracts, not live service responses, email delivery, or persisted workflows.
- The checkout has pre-existing local changes from skill installation (`package-lock.json`, `skills-lock.json`, skill folders, and `.idea/`). They were preserved.

## Current route coverage

| Area | Route pages | Readiness note |
| --- | ---: | --- |
| Buyer dashboard | 11 | Several API-backed flows have no downstream business API yet. |
| Seller dashboard | 16 | Order, shipment, auction, inventory and seller-profile paths are partly unavailable. |
| Staff dashboard | 8 | Seller review is partly supported; report and queue APIs are incomplete. |
| Admin dashboard | 12 | User list/detail and health/log surfaces are partly supported; RBAC/config/catalog APIs are incomplete. |
| Shared auth/account | 6 | Login, register, forgot/reset/change password and profile; no sessions page in the current route tree. |
| Public storefront | 5 | Home, catalog, product detail, auction list and auction detail. |
| **Total** | **58** | A route existing does not mean its API-backed flow is operational. |

## Findings requiring attention

| Priority | Area | Evidence | Recommendation / owner |
| --- | --- | --- | --- |
| P1 | Role names hide dashboard links | `Shells.tsx` recognizes only `admin`, `staff`, `seller`. UserService derives roles from seeded display names and returns lowercased values such as `administrator` and `support staff`. The Seller alias matches; Admin and Staff do not. | **FE logic:** normalize known aliases or consume stable role codes. **BE contract:** return stable role codes consistently, separate from display names. This is likely why Admin/Staff can log in but do not see their dashboard button. |
| P1 | RoleGate does not enforce `allowedRoles` | The role comparison and denial branch in `RoleGate.tsx` are commented out; any authenticated user renders any role dashboard route. Gateway authorization must still protect data, but the FE route guard is currently login-only. | **FE logic:** restore role check and normalize the same role aliases as navigation. Keep Gateway authorization as the security boundary. |
| P1 | BFF reports a mode it did not verify | The upstream `X-Gateway-Mode` / `X-Gateway-Auth` check is commented out in `src/app/api/gateway/[...path]/route.ts`; the response always stamps `Real` and `Enforce`. | **FE logic:** validate the actual upstream headers and reject anything other than Real/Enforce; only forward verified mode values. Current responses can make Mock/Bypass look like a live backend. |
| P1 | Forgot-password resend uses registration OTP | FE sends `type: FORGOT_PASSWORD` to `/api/v1/auth/otp/resend`. UserService's `ResendOtpApiRequest` accepts only Email and `ResendOtpAsync` creates a registration OTP; it rejects already-active users. Forgot-password creates a separate `password_reset` OTP. | **BE contract:** add a purpose-aware password-reset resend operation that issues the same OTP purpose as forgot-password. **FE:** call that contract after it exists. The initial forgot/reset routes align; this resend action does not. |
| P1 | SMTP can claim success without sending mail | No actual `.env` file exists in the backend checkout. Compose defaults SMTP credentials to empty; the mail sender logs simulation mode and returns `true` when credentials are absent. Register/forgot-password can therefore report success while no email arrives. | **BE/runtime:** configure SMTP credentials through an untracked secret source, make non-development startup fail or return an explicit delivery failure when SMTP is absent, and verify a mailbox end-to-end. `NotificationService/.env.example` also contains a credential-like SMTP value; replace it with placeholders and rotate it if it is valid. |
| P1 | OTP values are written to logs | UserService logs OTP codes for registration/resend/password reset and logs OTP values when message publishing fails. | **BE/security:** remove OTP values from all logs; keep event IDs/recipient-safe diagnostics only. Treat any currently valid credential in the example file as exposed and rotate it. |
| P1 | Core downstream APIs are absent | Gateway controllers define product/category, cart/order, auction and shipment routes. The corresponding `Catalog.Api`, `Commerce.Api`, `Auction.Api`, and `Fulfillment.Api` `Program.cs` files currently map only `/health`; no business controllers or endpoint maps exist in those service trees. | **BE:** implement and register the required REST endpoints, or add an approved Gateway adapter to existing application/gRPC contracts. Until then, screens must not imply these operations succeed. |
| P1 | User operations are only partly implemented | UserService has auth/current profile, admin user list/detail, and seller-registration list/approve/reject. It does not expose the FE's seller profile GET/PATCH, seller-registration detail GET, RBAC roles/permissions, user reports, reputation/penalties, or staff report queue operations. Gateway routes for some of these do not establish a downstream implementation. | **BE:** add the missing User API contracts and authorization, or remove/disable the corresponding Gateway routes. **FE:** keep these actions unavailable until a real response contract is verified. |
| P1 | Wallet API exists but runtime is not ready | Unlike older audit notes, Wallet now maps REST endpoints for balance, transactions, top-up, direct checkout, withdrawal and withdrawal processing, matching most Gateway paths. Wallet compose requires `CONNECTION_STRING`; there is no service `.env` here, and Docker is currently unavailable. FE wallet forms are disabled with copy saying no REST endpoint exists. | **BE/runtime:** supply Wallet connection configuration and start/verify it. **FE:** update the stale explanation; enable those forms only after successful Real/Enforce runtime verification. |
| P2 | FSD service boundary is inconsistent | Feature guidance says screens import feature services and services call the shared API client. Current Seller, Staff, Admin, Commerce and some profile/auth screens call generic `api` directly inside screen components. | **FE:** move API calls/DTO mapping into each owning `features/*/services/` and keep screens as composition/state presentation. No visual redesign is needed. |
| P2 | Mobile dashboard entry labels disappear | In `globals.css`, `@media (max-width: 560px)` hides `.header-actions span`. Role dashboard links then show only icons; their title is a hover tooltip and is not a visible touch label. | **FE/UI:** retain a visible concise role label or put the dashboard entry in the account menu on mobile. No screenshot-based visual acceptance was possible while the local app/API runtime was unavailable. |

## API status by role

### Buyer / customer

- **Auth:** Gateway and UserService routes exist for register, OTP verify/resend, login, refresh, forgot-password and reset. Refresh is supported by UserService at both `/refresh` and `/refresh-token`; the old report saying refresh is mismatched is stale. OTP purpose on resend and SMTP delivery remain blockers described above.
- **Catalog:** Gateway routes exist, but Catalog API currently exposes only health. Product listing/detail/search/category and product write calls cannot be accepted as live service-backed flows from source alone.
- **Cart, checkout, orders, reviews:** Gateway contract exists for several operations, but Commerce API has only health and no business HTTP routes. User/Catalog review/report downstream routes are also absent.
- **Auctions:** Gateway has auction routes; Auction API currently maps only health.
- **Wallet:** REST routes exist in Wallet and Gateway; runtime is unverified because required connection configuration is absent and Docker is down.

### Seller

- Product/catalog, inventory, orders and auctions are blocked by Catalog/Commerce/Auction downstream APIs.
- Shipment list/detail/tracking is blocked because Fulfillment API maps only health; create shipment is also not available in FE.
- Seller profile FE calls `/api/v1/seller/profile`, but UserService only has registration/review endpoints, not profile GET/PATCH.
- Wallet/withdrawal contracts exist in source, but Wallet runtime is unverified.

### Staff

- Seller-registration list and approve/reject are present in UserService; the FE detail page requests a detail GET not exposed by the current User controller.
- Report queue/resolution has Gateway routes but no UserService report endpoints.
- Withdrawal processing PATCH exists in Wallet, but the Gateway/Wallet source has no staff withdrawal-list endpoint for the FE queue.
- Product moderation and transaction discrepancy queues have no confirmed downstream service endpoints.
- Auction operations are blocked by Auction API having only health.

### Admin

- User list/detail are present in UserService and their FE routes align with Gateway paths.
- Role/permission management and system-config FE calls have Gateway paths but no matching UserService business endpoints.
- Category routes exist in Gateway but Catalog API has no business routes. Coupon and ledger FE routes have no corresponding Gateway/business endpoint found in source.
- Audit-log routes are present through Gateway/LogService; health-check routes exist through CheckHealService/Gateway. Runtime remains unverified.

## UI simplification recommendations

Do not delete role tasks solely because their backend endpoint is absent: the design plans list these as intended flows. For a cleaner interface without changing the intended UI direction:

1. Keep the Buyer navigation focused on storefront, auctions, wallet and reports; do not remove “Đấu giá trực tiếp” or “Đấu giá của tôi” as they represent different tasks. Hide or clearly gate report/review/payment actions until their real endpoints are available.
2. Temporarily hide or group Seller links whose current page is only an ID lookup or unavailable-state shell (`Đơn bán`, shipment creation, shop profile, wallet/withdrawal) until the corresponding API is ready; keep product/inventory/auction tasks when their APIs become available.
3. Temporarily hide/group Staff queues with no list API (reports, withdrawals, moderation, discrepancies); retain seller review only after adding the missing detail endpoint.
4. Keep Admin user management and health/log surfaces; hide or mark unavailable Categories, RBAC, system config, coupons and ledger until their exact downstream contracts are live.
5. Preserve the current shared visual system and role shell. Visual consistency, spacing, and redundant content cannot be safely judged from source inventory alone; compare the current route renders against the canonical Stitch frames before changing those parts.

## Branch and merge note

The branch is `VU/UI-customer`. It was created from the current checkout's `24e7054` commit, whose parent is local `dev` at `c09db94`; that existing feature commit contains 24 changed files relative to local `dev`. Local `dev` was reported as two commits behind `origin/dev`. This audit has no product-code changes to merge. Before future FE changes are merged, update/fetch `origin/dev` and decide whether the existing `24e7054` feature changes are intended to merge with them.
