# Backend Readiness Report

## 2026-10-28 — Final frontend verification and backend readiness

### 1. Executive summary

The frontend is **ready to begin incremental backend integration**, starting with API scaffolding, health/readiness endpoints, persistence models, and authentication design. It is **not production-ready for real accounts or financial records**: authentication and records are frontend-only, credential data is kept in browser storage, user ownership is not enforced by a server, and some dashboards/budgets use illustrative or internally inconsistent mock values.

No backend was implemented, no package was installed, and no broad frontend refactor was made. This verification fixed three small, confirmed frontend defects: the malformed heart SVG path, positive signs on expense amounts, and notifications being initialized for a hard-coded user.

### 2. Final frontend verification results

#### Verified in this final verification

- **Authentication and roles:** Client and admin demo sign-in rendered the expected identities and role labels. A client visiting an admin route and an admin visiting a client route each reached `/unauthorized`. Logout followed by a protected client route redirected to `/login`. A client session was restored after a page reload.
- **Transactions:** The client list displayed 10 seeded records; the expense filter displayed 7, and a no-match search displayed the empty state. A seeded expense displayed as `−€86,40` after the sign correction. Submitting the blank transaction form displayed the expected validation error. No sortable table headers were present. The seeded list has 10 rows and page size 10, so a multi-page transition could not be exercised with the current fixture.
- **Admin lists:** Admin transactions showed 10 seeded rows; the Pending filter showed 1 and Completed showed 9. The admin user list showed 5 seeded users. The admin budget page used the shared mock budget dataset with 6 records.
- **Calendar and routing:** The calendar advanced from October to November 2026. An unknown URL displayed the not-found page.
- **SVG/runtime:** The malformed SVG path error was reproduced on the categories/budget route before the fix. After correcting the `heart` path, categories and budgets rendered without that SVG error or other captured runtime/console errors during the checked navigation.
- **Responsive navigation:** At a 390px viewport, the admin navigation drawer opened as a named dialog. Dispatching an Escape `keydown` to the page closed it and restored body overflow. The browser automation `keyboard.press('Escape')` call did not close the drawer in this session, so physical-key behavior was not conclusively confirmed by that input method.

#### Not repeated or not fully verified in this final pass

- Transaction and budget create/edit/delete flows, profile updates, notification actions, settings persistence, category/user deletion guards, and dialog focus cycling were exercised in the earlier functional/accessibility audit, not repeated in full here. Their prior results are recorded in `docs/FUNCTIONAL_AUDIT_REPORT.md` and `docs/ACCESSIBILITY_TASK_REPORT.md`.
- The final browser pass checked invalid transaction input but did not re-run the full CRUD matrix or user-specific notification behavior for a newly registered account.
- Sorting is not exposed by the transaction table. Pagination controls exist, but the current 10-row fixture and 10-row page size prevent meaningful multi-page validation.
- This was representative regression coverage, not exhaustive cross-browser, assistive-technology, or production-backend testing.

### 3. Actual failures and remaining frontend risks

#### Fixed during this task

1. **Malformed SVG path:** `Icon.jsx` supplied invalid path data for the `heart` icon, producing the reported browser SVG parse error on the categories page. Replaced only that path with valid heart geometry. The error was reproduced before the change and was not captured on categories/budget navigation after it.
2. **Expense signs:** transaction amounts are stored as positive magnitudes, and the transaction amount formatter omitted a negative sign for negative input. Client transaction, dashboard, and calendar displays now pass expense amounts as negative values; the shared mock transaction formatter now renders the negative sign. This addresses misleading financial presentation without changing stored amount conventions.
3. **Notification ownership:** the client notifications page initialized from the literal user ID `usr_001` rather than the authenticated user. It now loads notifications for the current authenticated user.

#### Remaining, confirmed risks

- **Mock persistence:** transaction, category, and budget arrays are mutable JavaScript module data. CRUD changes are runtime-only and reset on refresh. They do not provide durable or cross-device persistence.
- **Credential handling:** demo credentials are embedded in frontend source; registered-user records include plaintext passwords in local storage, and the current `budgetflow_session` storage also contains the email/password pair. This is acceptable only as a mock/demo mechanism and must not be used for real credentials. Do not migrate these stored passwords as backend credentials.
- **Inconsistent mock relations:** transactions refer to categories by name, while categories have IDs and owner IDs. Budgets also store a category name and a manually maintained `spent` value. The seeded “Travel” budget is associated with “Shopping”; spending fields do not derive consistently from the transaction list. API integration should replace name-based joins with validated category IDs and derive budget spend from qualifying transactions.
- **Illustrative dashboards:** client dashboard charts and category totals include hard-coded values alongside totals computed from current transactions. Admin historical growth/chart information is explicitly illustrative/unavailable. These values must not be presented as authoritative backend analytics.
- **Owner coverage:** seeded categories, budgets, and transactions are primarily associated with `usr_001`. Newly registered users do not automatically receive matching seed records. Backend queries must scope every client resource to the authenticated user, independent of any submitted owner ID.
- **Incomplete actions:** the global header search and notification buttons have no action handler; the account dropdown Profile and Settings items have empty callbacks even though those destinations are available elsewhere. These do not block backend setup but should be wired or removed before describing those affordances as functional.
- **Deferred UI capabilities:** client category create/edit and admin category create/edit, admin transaction details/create/export, admin budget details, user creation, password change/reset, and real export/report actions are unavailable or disabled. Budget editing is not represented by a current edit form. Do not add corresponding write APIs until the UI and product behavior are defined.
- **Settings and profile:** profile edits update the active session only. Device settings are stored in local storage. Settings JSON parsing is not guarded against malformed local-storage content; it is a resilience issue, not a backend blocker.
- **Activity logs:** the admin activity log page is illustrative/static. Whether it should be durable and which actions it records should be decided before exposing it as an audit trail.
- **Amount presentation:** budget spend/limit cards currently use a formatter that can prefix positive budget amounts with `+`; this is visually unnecessary and may imply a cash inflow. Review during the API/UI integration pass.

### 4. SVG and runtime findings

- The SVG error was **reproduced** before the fix. Its path data originated in the `heart` icon used by category rows, not in the dynamic donut chart path.
- `src/components/ui/Icon.jsx` now contains valid heart path data.
- After the change, browser navigation through the client categories and budgets pages captured no SVG path parsing error and no other runtime/console error.
- `pnpm run build` emitted no warning in the recorded output.
- No other runtime error was observed in the focused routes. This is not a claim that every route or browser has been exhaustively checked.

### 5. Proposed entities and relationships

These are recommendations grounded in the current pages and mock data; they are not implemented.

| Entity | Essential fields and types | Relationships and validation | Milestone |
|---|---|---|---|
| **User** | `_id`, `firstName`, `lastName`, normalized unique `email`, `passwordHash`, `role` (`client`/`admin`), `status` (`active`/`pending`/`suspended`), optional `phone`, `country`, `currency`, `joinedAt` | Authenticated session identifies one user. Validate required names, valid email, allowed currency/role/status. Never accept role/status from public registration. Profile and display preferences may live on this record initially. | First |
| **Category** | `_id`, `name`, `type` (`income`/`expense`), `color`, `icon`, `ownerUserId` or explicit global/system marker, `createdAt` | Personal categories belong to a user; approved defaults may be global. Validate type and supported color/icon format. Transaction type must match category type. Restrict deletion while referenced, or define explicit archive behavior. | First |
| **Transaction** | `_id`, `userId`, `categoryId`, `date`, `description`, positive `amount`, `type`, `paymentMethod`, `status`, optional `note`, `createdAt`, `updatedAt` | Belongs to one user and references a category available to that user. Enforce ownership on every read/update/delete; ignore any client-supplied owner ID. Validate amount > 0, date, enum values, required text, category ownership/type. Store magnitude as positive and derive income/expense display sign from `type`. | First |
| **Budget** | `_id`, `userId`, `categoryId`, `name`, positive `limit`, `period` (currently `monthly`), optional period start/end only if the product defines custom periods, timestamps | Belongs to one user and an expense category. Restrict deletion of referenced category. Calculate `spent` from that user's expense transactions in the budget period rather than persisting the current mock's hand-maintained number. | First |
| **Notification** | `_id`, `userId`, `title`, `message`, `type`, `status` (`unread`/`read`), `createdAt` | Belongs to a user; state changes and delete must be owner-scoped. Budget notifications may be generated from budget thresholds after transaction/budget calculations are reliable. | Later |
| **User settings/preferences** | Initially a validated nested object on User, limited to preferences the interface actually defines (e.g. currency, language/date format, notification preferences) | Current four setting switches only persist device-local booleans and do not have clearly specified platform behavior. Agree their semantics before persisting server-side. | Later |
| **Admin activity log** | `_id`, `actorUserId`, action, target type/ID, timestamp, minimal sanitized metadata | Append-only records for defined sensitive administrative actions; never accept arbitrary client-supplied actor identity. Current page is illustrative and does not establish a definitive event schema. | Later |
| **Dashboard/report aggregates** | No separate entity initially | Calculate from owned transactions and budgets with server-side aggregation and explicit date/currency semantics. Cache only if scale later requires it. | First read endpoint; no stored model |

#### Data migration notes

- Map existing category names to IDs before sending transaction/budget records. Resolve ambiguous or duplicate names explicitly.
- Seed approved global categories separately from personal categories; do not make `usr_001` the owner for every customer's data.
- Reconcile the “Travel” budget/category mismatch and decide whether budget spending is derived from transactions or from manually entered adjustments.
- Map frontend demo roles/statuses to server-controlled values. Do not migrate `password` values from `mockUsers.js` or registered-user local storage; use fresh server-side enrollment/password setup.

### 6. Proposed REST API contract

Prefix: `/api/v1`. Required roles below are server-enforced. “First” means the initial usable backend milestones; “Later” is deferred until the relevant UI or product behavior is defined.

#### Authentication and current user

| Method | Route | Purpose | Role | Milestone |
|---|---|---|---|---|
| `POST` | `/auth/register` | Register a client account | Public; server assigns `client` role | First |
| `POST` | `/auth/login` | Authenticate and establish a server session | Public, rate-limited | First |
| `POST` | `/auth/logout` | Invalidate the current session | Authenticated | First |
| `GET` | `/auth/me` | Return the current safe user/profile projection | Authenticated | First |
| `PATCH` | `/me` | Update allowed profile fields | Authenticated; own account only | First |
| `POST` | `/auth/password/forgot` | Start verified password-reset email flow | Public, rate-limited | Later, requires mail delivery |
| `POST` | `/auth/password/reset` | Consume a one-time reset token and set a new password | Public with valid token | Later |

#### Transactions

| Method | Route | Purpose | Role | Milestone |
|---|---|---|---|---|
| `GET` | `/transactions` | List/search/filter/sort/page the user's transactions; supported query fields include date range, type, category, status, `q`, `sort`, `page`, and `limit` | Client: own rows; Admin: platform rows only if admin review remains in scope | First |
| `POST` | `/transactions` | Create a transaction; server derives owner from session | Client | First |
| `GET` | `/transactions/:id` | Read a transaction | Owner; Admin only under explicit policy | First |
| `PATCH` | `/transactions/:id` | Update an owned transaction | Owner; Admin only under explicit policy | First |
| `DELETE` | `/transactions/:id` | Delete an owned transaction | Owner; Admin only under explicit policy | First |

#### Categories and budgets

| Method | Route | Purpose | Role | Milestone |
|---|---|---|---|---|
| `GET` | `/categories` | List the caller's categories plus allowed global defaults | Client; Admin may inspect platform/global categories | First |
| `POST` | `/categories` | Create a personal category | Client | First, after category UI is enabled |
| `PATCH` | `/categories/:id` | Update an owned category | Owner; Admin only for explicitly global categories | Later, UI currently unavailable |
| `DELETE` | `/categories/:id` | Delete/archive a category if not referenced | Owner/Admin within scope | First, with reference protection |
| `GET` | `/budgets` | List owned budgets with server-derived spent/progress | Client; Admin platform read only if retained | First |
| `POST` | `/budgets` | Create an owned budget | Client | First |
| `PATCH` | `/budgets/:id` | Update a budget | Owner | Later, no current edit form |
| `DELETE` | `/budgets/:id` | Delete an owned budget | Owner | First |

#### Dashboard, notifications, and settings

| Method | Route | Purpose | Role | Milestone |
|---|---|---|---|---|
| `GET` | `/dashboard/summary?period=month` | Return totals, category breakdown, budget progress, and recent transactions for a defined period | Client: own data; Admin dashboard summary only if its separate metric definitions are agreed | First read API |
| `GET` | `/notifications` | List notifications for the caller | Client | Later |
| `PATCH` | `/notifications/:id` | Mark one owned notification read/unread | Client | Later |
| `POST` | `/notifications/read-all` | Mark all caller-owned notifications read | Client | Later |
| `DELETE` | `/notifications/:id` | Delete one owned notification | Client | Later |
| `GET` | `/me/settings` | Read defined account preferences | Authenticated | Later |
| `PATCH` | `/me/settings` | Update allowed preferences | Authenticated; own account only | Later |

#### Admin

| Method | Route | Purpose | Role | Milestone |
|---|---|---|---|---|
| `GET` | `/admin/users` | Search/filter/page users | Admin | Later |
| `GET` | `/admin/users/:id` | Read an account summary | Admin | Later |
| `PATCH` | `/admin/users/:id/status` | Suspend/reactivate according to policy | Admin; protect last/own admin as policy requires | Later |
| `DELETE` | `/admin/users/:id` | Disable/delete an account under retention/reference policy | Admin | Later |
| `GET` | `/admin/transactions` | Search/filter platform-wide transactions | Admin, audited and least-privilege | Later |
| `GET` | `/admin/budgets` | Platform budget monitoring if this view remains a requirement | Admin | Later |
| `GET` | `/admin/activity-logs` | Read persisted administrative events | Admin | Later |

Do not expose an admin endpoint merely because a demo button currently exists. Create/export/report endpoints should follow a defined product requirement and should never return a success response for work not actually completed.

### 7. Authentication, security, and persistence plan

- **Passwords:** Hash with Argon2id or bcrypt using a suitable cost. Never store or log raw passwords. Remove the current browser-stored credentials from the eventual flow; do not import demo plaintext passwords.
- **Authentication:** Prefer server-managed sessions in an HttpOnly, Secure, SameSite cookie backed by a durable session store. Invalidate server-side on logout and enforce expiry/rotation. If token auth is chosen instead, keep short-lived access credentials out of local storage and define refresh/revocation explicitly.
- **CSRF/CORS:** With cookie sessions, use a CSRF defense for state-changing requests. Configure CORS to a strict allowlist of known frontend origins and enable credentials only for those origins; do not use wildcard origins with credentials.
- **Authorization:** Enforce role checks in Express middleware. Frontend route guards are UX only, not a security boundary. The server assigns roles at registration and refuses privilege fields from client payloads.
- **Ownership:** Derive `userId` from the authenticated session for creates. Scope every client query and mutation by both resource ID and authenticated owner. Return a consistent not-found response for absent/foreign records where revealing existence would be unsafe. Validate category ownership and user ID relationships at the server.
- **Validation:** Validate params, query strings, and request bodies with explicit schemas. Enforce positive finite monetary amounts, bounded pagination, valid date ranges, enums, string lengths, and allowed sort fields. Normalize email and avoid arbitrary Mongo query operators from input.
- **Errors:** Use a stable JSON shape such as `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [], "requestId": "..." } }`. Avoid stack traces, credential details, and database internals in production responses; preserve server-side structured diagnostics.
- **Secrets/configuration:** Keep MongoDB URI, session secrets, mail provider credentials, and deployment settings in environment/secret storage, never source control or frontend `VITE_*` variables. Validate required server environment values at startup.
- **Database/availability:** Add unique indexes for normalized email and appropriate owner/date indexes for common list queries. Fail readiness if MongoDB is unavailable; return a clear service-unavailable response rather than pretending writes succeeded. Separate liveness from database readiness and configure connection timeouts/retries intentionally.
- **Sensitive operations:** Rate-limit login/register/reset, apply safe cookie settings, use Helmet and request-size limits, avoid logging PII/passwords, and audit sensitive admin actions. Define backup, retention, and deletion policy before storing financial data.
- **Persistence limitations:** Durable transactions/budgets/categories, cross-device settings/profile, real email/reset flows, server-owned notifications, authentic exports, and historical analytics all require backend support. The current mock application is not a security boundary and must not be exposed as a production finance service.

### 8. Incremental backend implementation roadmap

| Milestone | Scope and dependencies | Expected outcome | Verification |
|---|---|---|---|
| **1. API skeleton and configuration** | Separate JavaScript Node/Express server; environment validation; JSON/error middleware; CORS allowlist; health and readiness endpoints. No frontend conversion. | A locally runnable server that reports liveness and reports database readiness accurately. | Start with missing/valid config; verify health and failure/readiness status; test allowed and rejected origins. |
| **2. MongoDB connection and models** | Mongoose schemas for User, Category, Transaction, Budget; indexes; seed-only development fixtures; decide category ownership and budget spend calculation. Depends on milestone 1. | Validated persistence model with stable ObjectId relationships; no plaintext credential migration. | Schema validation and index tests; confirm invalid references, amounts, enums, and duplicates are rejected. |
| **3. Authentication/session and authorization** | Register, login, logout, `/auth/me`; hash new passwords; session persistence; role middleware. Depends on user model. | Server is the authority for identity and role; frontend can restore safe user identity. | Auth integration tests for bad credentials, session restoration/revocation, role protection, suspended accounts, and password non-disclosure. |
| **4. Categories API** | List defaults/owned categories; create/delete personal categories; reference conflict behavior. Depends on auth and Category model. | Stable category IDs usable by transaction and budget forms. | Client A cannot read/update/delete Client B categories; type/ownership and in-use delete cases tested. |
| **5. Transaction API** | Owner-scoped CRUD; query filters, stable sorting, bounded pagination; category validation. Depends on milestones 2–4. | Main financial data is durable and safely queryable. | Integration tests for CRUD, foreign IDs, filters, sorting, page bounds, validation, status, and owner isolation. |
| **6. Budget API and spending rules** | Create/list/delete budgets; define time period and derive spending from transactions; reconcile existing mock category mismatch. Depends on transaction/category APIs. | Budget progress comes from authoritative, owner-scoped records. | Tests for period boundaries, transaction edits/deletes changing spend, over-budget states, and cross-user isolation. |
| **7. Dashboard aggregation** | Server-side summary using the same definitions as transaction/budget APIs; remove illustrative data from live totals. Depends on milestone 6. | Consistent totals/recent activity for the signed-in user. | Compare API aggregates with fixture transactions; verify date/currency semantics and owner filtering. |
| **8. Profile, settings, and notifications** | Persist profile; define server-backed preferences; notifications CRUD/read state and generation rules. Depends on auth and agreed product semantics. | Profile/preferences/notification state survives refresh and is private to the account. | Owner-isolation, persistence, unread counts, notification creation/read/delete tests. |
| **9. Admin APIs and audit trail** | User search/detail/status, explicitly authorized platform transaction/budget views, and append-only logs for defined admin actions. Depends on role middleware and retention policy. | Least-privilege administrative operations with an actual audit trail. | Admin/client access matrix, last-admin safeguards, referenced account behavior, and audit event assertions. |
| **10. Incremental frontend integration and release preparation** | Add a small frontend API layer; replace one resource at a time (auth, categories, transactions, budgets, dashboard, remaining surfaces); retain React/JSX; remove demo success paths. Depends on stable API contracts. | Frontend uses backend responses without broad UI redesign; loading/errors/empty states are explicit. | Component/API integration tests, end-to-end client/admin regression, accessibility and mobile checks, deployment/configuration and backup review. |

### 9. Features deferred until backend integration

- Durable transaction/category/budget CRUD and server-side filtering/sorting/pagination.
- Server-calculated dashboard, monthly history, and budget spend.
- Real email delivery, password reset/change, and verified registration flows.
- Persistent profile and settings across sessions/devices.
- User-scoped persistent notifications and threshold generation.
- Real exports/reports and durable admin activity logs.
- Admin actions that are currently disabled or illustrative.
- Production authentication, authorization, privacy, and retention for real financial data.

### 10. Exact files modified in this task

- `src/components/ui/Icon.jsx` — replaced malformed `heart` SVG path.
- `src/data/mockTransactions.js` — added the negative sign in the transaction amount formatter.
- `src/pages/client/Dashboard.jsx` — passes expense values with a negative display sign.
- `src/pages/client/Transactions.jsx` — passes expense values with a negative display sign.
- `src/pages/client/Calendar.jsx` — passes expense values with a negative display sign.
- `src/pages/client/Notifications.jsx` — scopes initial notification state to the authenticated user.
- `docs/BACKEND_READINESS_REPORT.md` — added this dated audit and plan.

### 11. Commands, tests, and browser scenarios

- `pnpm run build` — passed after the final SVG/sign/notification edits; Vite transformed 83 modules and emitted no build warning in the output.
- `git diff --check` — passed after the final code and report changes.
- Automated tests — none configured: `package.json` has no test script and the repository search found no `*.test.*` or `*.spec.*` files.
- Browser scenarios actually performed in this final pass:
  - Client/admin demo login identity, role labels, cross-role protection, logout, unauthenticated protected-route redirect, and client session restoration on reload.
  - Client transaction list, expense filter, no-results search, negative display, and blank-form validation.
  - Admin transaction status counts and user list; shared admin budget count.
  - Calendar month advance; unknown route; narrow admin drawer open and Escape keydown handling.
  - Categories/budget navigation before and after the SVG fix, including runtime/console capture.
- Transaction/budget CRUD, profile identity update, admin user status/deletion, and category reference protection were not repeated in this final pass; their earlier results are in the prior functional audit report.

### 12. Git and documentation safety

- Starting branch was `firstversion`; it remained unchanged. No branch switch, commit, or push was performed.
- Existing modified application files and the pre-existing untracked accessibility/functional reports were preserved; this task did not discard or restore user changes.
- `docs/BACKEND_READINESS_REPORT.md` did not exist before this task and was created here.
- `docs/CHANGELOG_DEV.md` was not read or modified. It did not appear in the captured starting or pre-report `git status --short --branch`; a filesystem metadata check showed a nonzero file size, so the user's statement that it is empty/locally modified did not match the observed worktree metadata. Its contents were deliberately left uninspected and untouched.
- `docs/FRONTEND_AUDIT.md` was absent from the current worktree when checked. It was not recreated, restored, or modified.
- `docs/ACCESSIBILITY_TASK_REPORT.md` and `docs/FUNCTIONAL_AUDIT_REPORT.md` were inspected and preserved.
