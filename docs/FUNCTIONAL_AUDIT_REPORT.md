# Functional Audit Report

## 2026-10-28 — Functional audit and fixes

### Objective and scope

Audited the existing BudgetFlow frontend for confirmed route, action, filtering, CRUD, and mock-data consistency defects. Changes were limited to existing frontend features; no backend, dependency, authentication-system, or role-routing redesign was introduced.

### Confirmed findings before changes

1. **Routes and record details:** Unknown URLs redirected to the home page instead of showing a not-found state. Some missing or out-of-scope detail IDs could fall through to unrelated mock records.
2. **Client transactions:** Lists and dashboard data were not consistently restricted to the signed-in client; category filtering, empty-result/page counts, and pagination boundaries were inconsistent. Create/edit validation and ownership were incomplete. Deleting a transaction changed the array but did not invalidate the memoized visible list.
3. **Budgets and categories:** Budget lists/details and creation did not consistently scope records to the current client. Create/delete validation and state updates were incomplete. Category totals/counts used static or randomized values, and deleting a category could leave related records inconsistent.
4. **Calendar and profile:** Calendar month/date controls did not consistently update the selected month/date or show the correct user's transactions. Profile edits did not update the active session identity.
5. **Admin actions and lists:** Transaction status filtering, user search/list coverage, status changes, record deletion, and related-record counts did not consistently reflect the underlying mock data. Admin budget views used a separate unrelated dataset. Category/user deletion lacked adequate protection for referenced records.
6. **Misleading unavailable operations:** Password reset/email, exports, some create/edit/view actions, analytics/report controls, and password changes could imply successful operations despite there being no backend/service to perform them.
7. **Other functional inconsistencies:** Settings controls did not persist their state; transaction amount formatting omitted the negative sign for negative values; dashboard statistics included static/illustrative data presented alongside live mock-record metrics.

### Root causes and fixes performed

- Added an explicit not-found page and transaction edit route; detail screens now handle missing or unauthorized records without silently substituting another record.
- Scoped client transaction and budget views/actions to the current user's records, added required-field/numeric validation, and connected existing edit/delete flows to the current mock-data state. Transaction deletion now invalidates the displayed list.
- Corrected transaction filters, empty states, result counts, and page bounds. Made the existing calendar month navigation and date selection update the displayed records.
- Derived category counts/totals and admin statistics from current mock records. Admin user and transaction lists now include/filter the relevant mock and registered records; status changes and supported deletes update the visible state.
- Prevented deletion of users/categories when current mock records reference them.
- Updated profile identity for the active session and added truthful messaging where data resets or operations need backend support.
- Removed success-shaped behavior for unavailable email/password reset, exports, and other unsupported server-dependent operations; unavailable controls are clearly labeled or disabled.
- Made existing settings switches persist locally, corrected negative currency formatting, and separated registered-user storage helpers into `src/data/registeredUsers.js` rather than exporting them from the auth context.

### Files changed

- Routing/authentication and shared utilities: `src/App.jsx`, `src/contexts/AuthContext.jsx`, `src/data/registeredUsers.js`, `src/pages/auth/NotFound.jsx`, `src/pages/auth/ForgotPassword.jsx`, `src/pages/auth/Register.jsx`, `src/pages/auth/ResetPassword.jsx`, `src/utils/formatters.js`.
- Shared controls: `src/components/ui/Modal.jsx`, `src/components/ui/Select.jsx`.
- Client pages: `src/pages/client/Analytics.jsx`, `src/pages/client/BudgetDetails.jsx`, `src/pages/client/BudgetNew.jsx`, `src/pages/client/Budgets.jsx`, `src/pages/client/Calendar.jsx`, `src/pages/client/Categories.jsx`, `src/pages/client/Dashboard.jsx`, `src/pages/client/Notifications.jsx`, `src/pages/client/Profile.jsx`, `src/pages/client/Settings.jsx`, `src/pages/client/TransactionDetails.jsx`, `src/pages/client/TransactionNew.jsx`, `src/pages/client/Transactions.jsx`.
- Admin pages: `src/pages/admin/ActivityLogs.jsx`, `src/pages/admin/Budgets.jsx`, `src/pages/admin/Categories.jsx`, `src/pages/admin/Dashboard.jsx`, `src/pages/admin/Reports.jsx`, `src/pages/admin/Settings.jsx`, `src/pages/admin/Transactions.jsx`, `src/pages/admin/UserDetail.jsx`, `src/pages/admin/Users.jsx`.
- This report: `docs/FUNCTIONAL_AUDIT_REPORT.md`.

### Verification performed

- `pnpm run build` — passed; Vite completed production build.
- `git diff --check` — passed.
- Automated tests — none run: `package.json` has no test script and no matching `*.test.*` or `*.spec.*` files were found.
- Browser verification was performed with the available browser tools:
  - Client/admin login identity, logout, protected-route behavior, and unauthenticated redirect.
  - Client transaction invalid input, create, edit, and delete (including list refresh after deletion); transaction and budget missing-ID handling.
  - Client budget invalid input, create, and delete; category deletion blocked when records reference it.
  - Admin transaction status filtering/search empty state; registered-user list, status change, detail, and deletion; referenced user/category deletion protection.
  - Calendar month navigation and date selection; profile name update in the active session.
  - Forgot/reset-password pages accurately state that no email/password change occurred.
  - Admin budget list uses the shared mock records; unknown URL displays the not-found page.
  - Client/admin identity and role protection, logout, and mobile drawer open/Escape behavior.
  - After separating registered-user storage helpers, a fresh browser page rendered the admin dashboard and an unknown URL rendered the not-found page.
- A transient `useAuth must be used within an AuthProvider` error appeared in a previously hot-reloaded browser tab during source edits. It did not reproduce in the fresh-page check after the helper extraction. This is recorded as a development HMR observation, not as a verified production failure.

### Failed or unverified behavior

- No automated test suite is configured.
- The full set of browser flows was not exhaustively repeated after the final storage-helper extraction; the production build and fresh-page admin/not-found checks were performed after it.
- The app has no backend, so persistence of transaction/budget/category mock-array mutations across refresh, real email delivery, password changes/resets, server-side filtering, real exports, and historical analytics remain unavailable. Registered accounts and device settings use local storage; profile edits are session-only.
- A pre-existing SVG path parsing error was observed on categories/budget pages. It was unrelated to the functional fixes and was not changed.

### Recommended next steps

1. Add focused automated tests for route guards, user-scoped CRUD, filters, pagination, and missing-record states when a test framework is adopted.
2. When backend APIs exist, connect currently marked unavailable operations and define durable persistence/authorization rules.
3. Investigate the existing SVG path parsing error separately.

### Documentation and Git safety

- `docs/CHANGELOG_DEV.md` was intentionally left untouched.
- `docs/FRONTEND_AUDIT.md` was not restored or overwritten.
- The pre-existing local `docs/ACCESSIBILITY_TASK_REPORT.md` was preserved and not modified for this task.
- Branch remained `firstversion`; no commit was created and no push was performed.
