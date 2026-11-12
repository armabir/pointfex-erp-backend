# Pointfex ERP — Enterprise Authorization Operations Guide

This guide explains how to extend and operate the Pointfex RBAC + ABAC + Delegation + Approval/SoD authorization system (`AuthorizationService`).

---

## 1. Adding a New Permission

Permissions live in [`docs/permissions_master.md`](./permissions_master.md) as the single source of truth (`permission_categories` + `permissions`).

1. Open [`docs/permissions_master.md`](./permissions_master.md) and locate the target module (`## 00.` – `## 20.`).
2. Add a new row to that module's table:
   ```markdown
   | `invoices:void` | Void Issued Invoice | ⚠ |
   ```
   - Leave the `Critical` column blank for normal (delegable) permissions.
   - Put `⚠` if the action is critical: it will be marked `isCritical = true`, `isDelegable = false`, excluded from domain wildcards unless `includeCritical = true`, and subject to Dual Approval + Step-Up Re-Auth.
3. Update Section F totals if adding new codes permanently.
4. Run the idempotent catalog seeder (never deletes existing permissions or clears `isSensitive`):
   ```bash
   cd pointfex-erp-backend-main
   npx ts-node prisma/seed-permission-catalog.ts
   ```
5. Use the permission on routes or in services without editing the engine:
   - Controller route: `@RequiresPermission('invoices:void')` or `@RequireAnyPermission(...)` with `@UseGuards(PermissionsGuard)`.
   - Service resource-level check:
     ```ts
     await this.authz.assert(actor, 'invoices:void', { projectId: invoice.projectId })
     ```
6. **Deprecating an old permission:** Never delete a code in use. Mark `isDeprecated = true` and add an entry in `permission_aliases` (`legacyCode -> targetCode`).

---

## 2. Creating & Managing Dynamic Roles

Roles are database records (`roles`, `role_versions`, `role_templates`, `user_role_assignments`) editable at runtime by authorized administrators or CEO (`system:root`).

- **From UI (`Governance & Access`):**
  - Use **Custom Role Creator** (`Advanced` 21-module view or `Simple` department view) and select domain wildcards (`admin:*`, `hr:*`, `finance:*`, `engineering:*`, `product:*`, `sales:*`, `ops:*`).
  - Domain wildcards expand non-critical (`isCritical = false`) permissions in categories whose `permission_categories.domains` array matches the domain. `⚠` critical codes are excluded unless `includeCritical = true`.
  - Use **Lifecycle, Templates & Debugger** to instantiate roles from Section C **Authority Templates** (`CTO`, `CFO`, `PM`, `SENIOR_DEVELOPER`, `QA_OFFICER`, etc.), clone existing roles, activate/deactivate roles, or inspect `RoleVersion` history.
- **Assigning with Scope:**
  - `POST /api/rbac/users/:employeeId/roles` accepts:
    - `scope`: `SELF` | `ASSIGNED` | `SQUAD` | `DEPARTMENT` | `PROJECT` | `ORG` | `GLOBAL`
    - `scopeIds`: array of allowed container IDs (e.g., `["proj_01", "proj_02"]`).
- **`system:root` Rules:**
  - Held solely by the active CEO bootstrap role (`isRootRole = true`).
  - Hidden from normal role editors, cannot be cloned, deactivated, or attached to custom roles, and transfers only via `POST /api/governance/transfer-ceo`.
  - Startup invariant (`CeoBootstrapService`) guarantees exactly one active non-suspended holder at all times.

---

## 3. Delegation, SoD & Approval Policies

### Temporary Delegations (`/api/rbac/delegations`)
Enforced server-side in `DelegationService` (Rules 1–10):
- Duration requires `startsAt` + `expiresAt`, capped by `authorization_policies.max_delegation_days` (default `30` days).
- Max re-delegation depth (`allow_redelegation_depth`, default `1`).
- Every `⚠` (`isCritical = true`) and `system:root` code is strictly non-delegable.
- Sensitive delegations (`isSensitive = true`) enter `PENDING_APPROVAL` and require `delegations:approve` from a third party.
- Expiry is enforced at **check time** in `AuthorizationService` + swept every 60s; delegator suspension/demotion/permission loss triggers cascading revocation automatically.

### Updating Delegation or Authorization Policies
Modify values in `authorization_policies` (or via `AuthorizationService.setPolicyValue`):
- `max_delegation_days`: numeric max days (default `30`)
- `allow_redelegation_depth`: numeric depth limit (default `1`)
- `default_fallback_role_slug`: role slug assigned on demotion (`"developer"`)
- `critical_dual_approval_required`: boolean (`true`)
- `critical_reauth_required`: boolean (`true`)
- `executive_mfa_required`: boolean (`true`)

### SoD Rules & Multi-Step Workflows
- Conflicting actions live in `sod_rules` (`SOD-PAYROLL`, `SOD-PO`, `SOD-EXPENSE`, `SOD-INVOICE`, `SOD-BILL`, `SOD-TASK`, `SOD-DEPLOY`, `SOD-XP`, `SOD-BONUS`, `SOD-SALARY`).
- Conditional/sequential/parallel approval flows and amount thresholds live in `approval_policies`.

---

## 4. Operating `AUTHZ_MODE` & Lockout Safety Switch

Configured via environment variable `AUTHZ_MODE` in `pointfex-erp-backend-main/.env`:

| Value | Behavior |
| :--- | :--- |
| `enforce` *(Active Production Default)* | `AuthorizationService` decides every request across RBAC, scopes, domain wildcards, aliases, delegations, explicit denials, and `system:root`. |
| `shadow` *(Rollout / Audit Mode)* | Legacy checks decide requests while `AuthorizationService` evaluates in parallel and writes every discrepancy to `authz_shadow_logs`. |
| `legacy` *(Emergency Rollback)* | Falls back strictly to legacy `@Roles` / flat `EmployeeRole` checks without enforcing scoped/wildcard engine rules. |

Run the shadow-mode discrepancy report anytime:
```bash
cd pointfex-erp-backend-main
npm run authz:diff-report
```

---

## 5. Cloud PostgreSQL (Neon) Connection & Least-Privilege Operations

- **Split Connection Roles (`schema.prisma`):**
  - `DIRECT_URL` (unpooled direct endpoint, **database owner role**): used exclusively by Prisma CLI (`npx prisma migrate deploy` and `SEED_PROFILE=production npm run prisma:seed`). Never use `prisma migrate reset` or `prisma migrate dev` against Neon (guarded by `scripts/guard-prisma-dev.js`).
  - `DATABASE_URL` (pooled endpoint with `?sslmode=require&pgbouncer=true&connect_timeout=15`, **`pointfex_app` role**): used by the NestJS API server at runtime.
- **Least-Privilege Application Role ([`scripts/neon-setup-app-role.sql`](../pointfex-erp-backend-main/scripts/neon-setup-app-role.sql)):**
  - `pointfex_app` holds `LOGIN`, `NOSUPERUSER`, zero table ownership, zero `TRIGGER`/`TRUNCATE`/DDL rights, and `SELECT` + `INSERT` only (no `UPDATE` or `DELETE`) on `audit_logs`, `financial_transactions`, and `xp_ledger_entries`.
  - PostgreSQL triggers (`trg_*_immutable`, `trg_*_no_truncate`) enforce append-only immutability at the engine layer alongside `PrismaService` runtime blocks.
- **Production Seed & First-Login Lock:**
  - `SEED_PROFILE=production` seeds **only** the permission catalog, categories, aliases, default roles/templates, SoD rules, approval policies, authorization policies, and the single CEO bootstrap account (`CEO_EMAIL`, `CEO_INITIAL_PASSWORD`) flagged `mustChangePassword = true` and `mustEnrollMfa = true`.
  - First login enforces `/api/auth/change-password` (min 12 chars) and `/api/rbac/security/mfa/enroll` + `/api/rbac/security/mfa/verify` (RFC 6238 TOTP) before releasing full workspace access.


## Login Allowlist, Google Sign-In & Onboarding Governance

### Who Manages the Login Allowlist
- **CEO (`system:root`) only**: Only the holder of `system:root` can add, bulk-import, enable, disable, or remove entries in `login_allowlist` (Admin & Governance > **Login access**).
- `login_allowlist:manage` cannot be granted to any custom role, direct permission grant, or delegation (enforced server-side in `RbacService`, `EmployeeAccessService`, and `DelegationService`).
- `login_allowlist:read` provides a read-only view of the allowlist without write access.
- The CEO's own email can never be removed or disabled. Disabling or removing any other email immediately revokes that user's active `SecuritySession` and `RefreshToken` rows.
- Every allowlist mutation requires a fresh 6-digit TOTP code (`@RequiresFreshMfa('login_allowlist:manage')`) and a written reason (`>= 10` characters), and is audited with masked email addresses.

### Requesting an Email (Non-CEO Onboarding Flow)
- Any user with `employees:create` sees an email picker containing only active allowlisted emails not yet linked to an employee.
- If the needed email is not on the list, they click **Request an email** (`POST /api/auth/allowlist/requests`). The request appears in the CEO's **Unified Inbox** (`email_request`).
- Approving the request with the CEO's fresh MFA code adds the email to `login_allowlist` so onboarding can proceed.

### Required Environment Variables
| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend API key for transactional welcome, reset-password, and admin-reset emails |
| `MAIL_FROM` | Sender address (e.g. Resend verified domain or test sender) |
| `FRONTEND_URL` | Frontend origin used for email links and OAuth callback redirects |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | Callback URL registered with Google (`/api/auth/google/callback`) |
| `LOGIN_ALLOWLIST_REQUIRED` | When `true`, enforces default-deny allowlist checks on password login, Google login, forgot-password, token refresh, and JWT requests |
| `ALLOW_DOMAIN_RULES` | Keep `false` to enforce exact verified email matching (never strip `+tags` or Gmail dots) |
| `TEMP_PASSWORD_TTL_HOURS` | Lifetime in hours for temporary onboarding and admin-reset passwords (default `24`) |
