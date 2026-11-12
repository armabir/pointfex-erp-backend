# Pointfex ERP — Step 0 Authorization Audit & Migration Plan

**Generated:** 2026-11-12  
**Master Spec:** [`docs/permissions_master.md`](./permissions_master.md) (file on disk uses underscore; **21 modules `00`–`20`, 606 parsed permission codes, 57 flagged `⚠`** — note Section F in the master doc estimates "~900 codes / ~70 `⚠`")  
**Status:** Read-only Step 0 audit complete. **No application code modified yet.**

---

## 1. Detected Stack & Conventions

| Layer | Technology / Version | Location & Conventions |
| :--- | :--- | :--- |
| **Backend Framework** | **NestJS 11** (`@nestjs/core` `^11.0.10`, Express) + **TypeScript** (`^5.7.3`) | `pointfex-erp-backend-main/src/` (modular controllers, services, DTOs with `class-validator`) |
| **ORM & Migration Tool** | **Prisma** (`^6.4.0` CLI & Client), `prisma migrate dev` / `deploy` | `pointfex-erp-backend-main/prisma/schema.prisma`, `8` migrations in `prisma/migrations/` |
| **Database** | **PostgreSQL** (`postgres:15-alpine` local Docker, `postgres:16-alpine` Compose prod) | 34 relational models across HR, Finance, Delivery, Engineering, PBAC, Audit |
| **Authentication** | `@nestjs/passport` + `passport-jwt` + `@nestjs/jwt` (`^12.0.4`) + `bcrypt` (`^6.0.0`) | `HttpOnly`, `SameSite=Strict` cookies (`pointfex_access_token` 15m, `pointfex_refresh_token` 7d SHA-256 rotated) |
| **Cache & Validation** | `ioredis` (`^6.0.0`, in-memory TTL fallback), `joi` (`^18.3.2`), `@nestjs/throttler` (`^6.7.1`) | `PermissionCacheService` (`pbac:perms:v1:{employeeId}`, TTL 300s), `envValidationSchema` |
| **Frontend Framework** | **React 19** (`^19.3.1`), **TypeScript** (`^7.0.2`), **Vite** (`^8.3.5`), **Tailwind CSS v4** (`^4.3.4`) | `pointfex-erp-frontend-main/src/` (`AppContext`, `usePermissions`, custom state/hash router in `App.tsx`) |
| **Testing & Tooling** | **Jest 29** + `ts-jest`, **oxlint**, **Prettier** | `pointfex-erp-backend-main/src/**/*.spec.ts` (6 suites, 40 unit tests) |

---

## 2. What Currently Exists (Auth, RBAC, DAC & Governance)

### 2.1 Authentication & JWT Payload
- **Global Guard Order (`app.module.ts`):** `IpBlocklistGuard` -> `ProxyThrottlerGuard` -> `JwtAuthGuard` (all `APP_GUARD`) + `PermissionsGuard` (controller/method-level `@UseGuards(PermissionsGuard)`).
- **JWT Payload ([`auth.service.ts#L135-L140`](../pointfex-erp-backend-main/src/auth/auth.service.ts#L135-L140), [`jwt.strategy.ts#L12-L17`](../pointfex-erp-backend-main/src/auth/jwt.strategy.ts#L12-L17)):**
  - Contains `{ sub: employeeId, employeeId, email, role: primaryRole }` with short 15-minute expiry (`JWT_EXPIRES_IN=15m`) stored in `HttpOnly` cookie `pointfex_access_token`.
  - Refresh tokens (`RefreshToken` table) store SHA-256 hashes, `familyId`, `expiresAt`, `revokedAt`, `replacedByTokenHash`, `ipAddress`, `userAgent` with token-reuse family revocation.
  - **Important finding:** The JWT intentionally does **not** hold the full permission array (good!). However, on every authenticated request `JwtStrategy.validate` queries PostgreSQL and recomputes `user.role` dynamically from `EmployeeRole` / `PositionAssignment` using `resolveCanonicalRoleSlug` (which hardcodes `ROLE_PRIORITY = ['ceo', 'cto', 'cfo', 'chro', 'cpo', 'pm', 'developer']`). There is **no session list/revoke API (`security_sessions`)** beyond refresh token records, and **no MFA / hardware TOTP verification** yet (`verifyStepUpAuth` only checks `passwordConfirm`).

### 2.2 Existing RBAC / DAC Tables (`prisma/schema.prisma`)
Currently **8 security/RBAC-related models** exist (`lines 631–769` + `AuditLog` lines `441–474`):
- `Permission` (`code`, `resource`, `action`, `module`, `description`, `isSensitive`) — **80 seeded rows**.
- `Role` (`slug`, `name`, `description`, `isSystemDefault`, `isActive`) — **6 seeded system roles** (`ceo`, `cto`, `cfo`, `chro`, `pm`, `developer`).
- `RolePermission` (`roleId`, `permissionId`, `grantedById`, `grantedAt`).
- `EmployeeRole` (`employeeId`, `roleId`, `assignedById`, `assignedAt`, `expiresAt`, `isActive`) — **no `scope` or `scope_ids` column**.
- `EmployeePermission` (`employeeId`, `permissionId`, `grantedById`, `reason`, `grantedAt`, `expiresAt`, `isActive`) — acts as both direct grants and ad-hoc delegations. Missing `startsAt`, max duration limit, depth/re-delegation tracking, `delegation_scopes`, delegator cascading revocation, and explicit **denials** (`user_permission_denials`).
- `AccessChangeRequest` (`requesterId`, `targetEmployeeId`, `requestedRoleId`, `status`, `reason`, `approvedById`, `reviewedAt`, `reviewNotes`) — covers single-step role-change Maker-Checker only (not generic dual approval for `⚠` codes, delegations, or business workflows like payroll/PO/expense/invoice).
- `RefreshToken` and `AuditLog` (note `AuditLog` is plain relational rows with **no `prevHash` / `entryHash` cryptographic tamper-evident chain**, and includes neither acting `permissionSource` / `delegationId` nor before/after diff columns consistently across all tables).

### 2.3 Existing Enforcement & Caching
- **`PermissionsGuard` ([`permissions.guard.ts`](../pointfex-erp-backend-main/src/common/permissions.guard.ts)):** Resolves `(Active EmployeeRoles -> RolePermissions) ∪ (Active Unexpired EmployeePermissions)` and caches plain `string[]` permission codes in `PermissionCacheService` (`pbac:perms:v1:{employeeId}`, TTL 300s). Supports `PBAC_MODE` (`legacy` | `shadow` | `enforce`).
- **Missing Engine Capabilities Required by Spec:**
  1. No `system:root` mother-permission bypass logic.
  2. No domain wildcard expansion (`admin:*`, `hr:*`, `finance:*`, `engineering:*`, `product:*`, `sales:*`, `ops:*`) or `permission_categories` table.
  3. No ABAC resource scopes (`SELF`, `ASSIGNED`, `SQUAD`, `DEPARTMENT`, `PROJECT`, `ORG`, `GLOBAL`).
  4. No explicit denial subtraction (`user_permission_denials`).
  5. No `AuthorizationService` callable from business services (authorization is partly controller guard annotations, partly service-level role checks).
  6. No `sod_rules` table/validator or multi-step `ApprovalService`.
  7. `PermissionCacheService` stores `string[]` without a version counter (`authVersion` / `roleVersion`) to reject stale cache races, and invalidation covers user/role mutations but not scope- or delegation-cascade triggers.
  8. **Unprotected / Open `GET` and `POST`/`PATCH` Controller Endpoints:** Many read endpoints (`EmployeesController`, `TeamsController`, `ProjectsController`, `TasksController`, `PositionsController`, `ConsultancyController`, `EngineeringController`, `ReportsController`, `CommunicationsController`, `GovernanceController` `directives`/`decisions`) have `JwtAuthGuard` only and **lack `@RequirePermissions(...)`**; employee self/other writes (`employees:update_own_profile` vs `employees:update_any`, `tasks` create/status/submit/comment, `reports` create) also lack `@RequirePermissions(...)`.

### 2.4 Existing Frontend Checks
- `AppContext` polls `GET /api/rbac/me/permissions` every 10s + on route change + on tab focus, storing `rolePermissions`, `myPermissions`, and `directPermissions`.
- `Sidebar.tsx` (`navigation.ts`) renders navigation from `rolePermissions`; `AdditionalGrantedAccessCard.tsx` acts as a DAC Launchpad using `permission-routes.ts`; `App.tsx` (`MainContentRouter`) uses `hasPermission` / `hasAnyPermission` with legacy role-based fallback switch blocks.
- Existing `PermissionCartBuilder.tsx` & `CeoRoleMatrixPage.tsx` operate on flat ~80 codes without scope pickers, `system:root` exclusion rules, wildcard domains, delegation center (created/received/revoke/countdown), approval inbox, or audit hash-chain verifier.

---

## 3. Mapping of Existing 80 Permission Codes to Master Catalog (`docs/permissions_master.md`)

**Summary:** Out of the **80** existing permission codes in `pointfex-erp-backend-main/prisma/seed-rbac.ts`:
- **78 codes (97.5%) exist verbatim** in `docs/permissions_master.md`.
- **2 legacy codes do not exist in the master catalog** (`employees:suspend`, `permissions:delegate`) and must be deprecated/aliased during migration.
- **Risk Flag (`⚠`) Reclassification:** Existing `seed-rbac.ts` marked **26** codes `isSensitive: true` (including non-critical operational powers like `tasks:approve`, `treasury:read`, `employees:create`, `roles:*`). In `docs/permissions_master.md`, **`⚠` is strictly non-delegable + dual-approval**, applied to only **4** of those 78 matching codes (`revenue_share:process`, `performance:discipline`, `grievances:read_confidential`, `grievances:adjudicate_confidential`, `audit_logs:read_confidential` — actually **5** of the 78!) plus 52 additional high-risk master codes (`system:root`, `users:offboard`, `governance:transfer_ceo`, `payroll:approve_batch`, `treasury:transfer`, etc.).

### 3.1 Legacy Codes Requiring Aliasing / Split

| Old Code (`seed-rbac.ts`) | Used By (Existing Code) | New Master Catalog Target(s) | Migration Action |
| :--- | :--- | :--- | :--- |
| `employees:suspend` | `UsersLifecycleController` (`suspend`, `unsuspend`, `demote`), `CtoPeoplePage.tsx` | `users:suspend`, `users:reactivate`, `users:demote` (Module `01. Identity & Access`) | Seed new codes into `CHRO`/`CEO` roles; keep alias in `AuthorizationService` during Phase 1–3, deprecate after UI/controllers migrate to `users:suspend`, `users:reactivate`, `users:demote`. |
| `permissions:delegate` | `RbacController` (`delegatable-permissions`, `grantDirectPermission`, `revokeDirectPermission`), `CtoPeoplePage.tsx` | `delegations:create`, `permissions:grant_direct` (plus `delegations:revoke`) (Modules `01` & `02`) | Grant `delegations:create`, `delegations:read_own`, `delegations:revoke` to `PM`/`CTO`/`CFO`/`CHRO`; bridge legacy decorator until Phase 4 Delegation API replaces it. |

### 3.2 Legacy Suffix to ABAC Scope Mapping (Preserved for Compatibility)

| Old Code Pattern | Count | Target Master Code(s) | Mapped Scope |
| :--- | :---: | :--- | :--- |
| `employees:read_directory` | 1 | `employees:read_directory` (`04`) | `ORG` (directory summary; peer-filtering policy applied separately) |
| `employees:update_own_profile` | 1 | `employees:update_own_profile` (`04`) | `SELF` |
| `employees:update_any` | 1 | `employees:update_any` (`04`) | `ORG` |
| `teams:read_own`, `projects:read_own`, `tasks:read_own`, `wallets:read_own`, `transactions:read_own`, `performance:read_own`, `notifications:read_own` | 7 | Identical codes in Modules `04`, `07`, `10`, `11`, `12`, `19` | `SELF` / `ASSIGNED` |
| `tasks:read_team`, `performance:read_team` | 2 | Identical codes in Modules `04`, `12` | `SQUAD` |
| `teams:read_all`, `projects:read_all`, `tasks:read_all`, `wallets:read_all`, `transactions:read_all`, `performance:read_all` | 6 | Identical codes in Modules `04`, `07`, `10`, `11`, `12` | `ORG` |

### 3.3 Full 80 Existing Code Mapping by Module

| Existing Module (`seed-rbac.ts`) | Old Codes -> Master Code Status | Master Module | Master `⚠` Flag Differences (`seed` `isSensitive` -> Master `⚠`) |
| :--- | :--- | :--- | :--- |
| **Employees & Positions** (`7`) | `employees:read_directory`, `employees:create`, `employees:update_own_profile`, `employees:update_any`, `positions:read`, `positions:assign` (**exact**); `employees:suspend` -> **split to `users:suspend` / `users:reactivate` / `users:demote`** | `04. Human Resources` (`employees:*`, `positions:*`) & `01. Identity & Access` (`users:*`) | `employees:create`, `employees:update_any`, `positions:assign` drop from `⚠` (become delegable) |
| **Teams & Projects** (`12`) | `teams:read_own`, `teams:read_all`, `teams:create`, `teams:update`, `teams:manage_members`, `projects:read_own`, `projects:read_all`, `projects:create`, `projects:update`, `projects:assign_team`, `milestones:create`, `milestones:update` (all 12 **exact**) | `10. Organization & Squads` & `11. Projects & Portfolio` | None flagged `⚠` |
| **Tasks** (`12`) | `tasks:read_own`, `tasks:read_team`, `tasks:read_all`, `tasks:create_personal`, `tasks:create_assign`, `tasks:update_status`, `tasks:approve`, `tasks:reject`, `tasks:reassign`, `tasks:toggle_checklist`, `tasks:submit_work`, `tasks:comment` (all 12 **exact**) | `12. Work Management (Jira-style)` | `tasks:approve` is **normal** in master (enforced via `SOD-TASK`, not `⚠`) |
| **Finance, Budgets & Wallets** (`13`) | `treasury:read`, `wallets:read_own`, `wallets:read_all`, `transactions:read_own`, `transactions:read_all`, `budgets:read_requests`, `budgets:allocate_developer`, `budgets:allocate_project`, `budgets:request_increase`, `budgets:approve_request`, `budgets:reject_request` (11 **exact** in `07`); `finance:issue_adjustment`, `revenue_share:process` (**exact** in `06`) | `07. Finance, Accounting & Treasury` & `06. Payroll & Compensation` | **`revenue_share:process` stays `⚠`**; `treasury:read`, `wallets:read_all`, `transactions:read_all`, `budgets:allocate_*`, `budgets:approve_request`, `finance:issue_adjustment` drop `⚠` (new `treasury:transfer`, `treasury:withdraw`, `transactions:reverse`, `payroll:*` carry `⚠`) |
| **Performance & Grievances** (`9` + `4` reports = `13`) | `performance:read_own`, `performance:read_team`, `performance:read_all`, `performance:evaluate`, `performance:recognize`, `performance:discipline`, `grievances:submit_confidential`, `grievances:read_confidential`, `grievances:adjudicate_confidential` (9 **exact** in `04`); `reports:create`, `reports:read_standard`, `reports:triage`, `reports:forward` (4 **exact** in `20`) | `04. Human Resources` & `20. Reporting, Audit, Compliance & System` | **`performance:discipline`, `grievances:read_confidential`, `grievances:adjudicate_confidential` stay `⚠`**; `performance:read_all`, `performance:evaluate`, `performance:recognize` drop `⚠` |
| **Engineering & Consultancy** (`8`) | `quality_gates:read`, `test_runs:read` (in `13`); `security_alerts:read`, `security_alerts:create`, `security_alerts:update_status` (in `14`); `consultancy:read`, `consultancy:create`, `consultancy:manage` (in `12`) — all 8 **exact** | `13. Development & DevOps`, `14. QA & Security`, `12. Work Management` | None flagged `⚠` |
| **Governance, Audit & Comms** (`8`) | `directives:read`, `directives:dispatch`, `decisions:read`, `decisions:ratify` (in `03`); `audit_logs:read`, `audit_logs:read_confidential` (in `20`); `announcements:read`, `notifications:read_own` (in `19`) — all 8 **exact** | `03. Corporate Governance`, `20. Reporting & Audit`, `19. Communication` | **`audit_logs:read_confidential` stays `⚠`**; `directives:dispatch`, `decisions:ratify`, `audit_logs:read` drop `⚠` (`governance:transfer_ceo` carries `⚠`) |
| **Dynamic RBAC Admin** (`7`) | `roles:read`, `roles:create`, `roles:update`, `roles:delete`, `permissions:read`, `users:assign_role` (6 **exact** in `01`); `permissions:delegate` -> **map to `delegations:create` / `permissions:grant_direct`** | `01. Identity & Access` & `02. Delegation & Approval Engine` | `roles:create`, `roles:update`, `roles:delete`, `users:assign_role` drop `⚠` (`permissions:register` carries `⚠`) |

---

## 4. Hardcoded Role Checks & Policy Coupling to Replace

### 4.1 Backend Hardcoded Role Checks

| File & Lines | Current Hardcoded Check / Coupling | Target Replacement |
| :--- | :--- | :--- |
| [`src/common/roles.guard.ts`](../pointfex-erp-backend-main/src/common/roles.guard.ts) & [`roles.decorator.ts`](../pointfex-erp-backend-main/src/common/roles.decorator.ts) | Checks `user.role` against `@Roles(...)` and hardcodes `roleNormalized === 'ceo'` | Remove all usages, delete `RolesGuard` once `GovernanceController` moves to `@RequiresPermission` + `AuthorizationService` |
| [`src/common/permissions.guard.ts#L63-L91`](../pointfex-erp-backend-main/src/common/permissions.guard.ts#L63-L91) | `legacy` / `shadow` modes fall back to `@Roles` & `roleNorm === 'ceo'` | Delegate entirely to central `AuthorizationService` (supports `system:root`, domain wildcards, scopes, explicit denials) |
| [`src/auth/jwt.strategy.ts#L19-L39`](../pointfex-erp-backend-main/src/auth/jwt.strategy.ts#L19-L39) | Hardcodes `ROLE_PRIORITY = ['ceo', 'cto', 'cfo', 'chro', 'cpo', 'pm', 'developer']` & `'cpo' -> 'chro'` | Resolve user metadata without trusting role slug priority for auth decisions |
| [`src/governance/governance.controller.ts#L16-L88`](../pointfex-erp-backend-main/src/governance/governance.controller.ts#L16-L88) | Entire controller still uses `@UseGuards(RolesGuard)` with `@Roles('ceo', 'cto')`, `@Roles('ceo')`, `@Roles('ceo', 'chro')`, `@Roles('cto', 'cfo', 'chro', 'ceo')` | Migrate every route to `@RequiresPermission(...)`: `directives:read`, `decisions:read`, `directives:dispatch`, `decisions:ratify`, `governance:transfer_ceo`, `governance:read`, `access_requests:submit`, `governance:approve_request` |
| [`src/common/security-policy.util.ts#L5-L59`](../pointfex-erp-backend-main/src/common/security-policy.util.ts#L5-L59) | Hardcodes `C_LEVEL_ROLE_SLUGS`, `CORE_ROLE_SLUGS`, `emp.id === 'emp_ceo_01'`, `isEmployeeCeo`, `isEmployeeChro`, `isEmployeeCLevel` | Replace CEO checks with `hasRootPermission(userId)` (`system:root`) and replace rank checks with `AuthorizationPolicy` / dual-approval / `users:assign_role` / tier metadata on DB `Role` |
| [`src/rbac/rbac.service.ts#L21-L36`](../pointfex-erp-backend-main/src/rbac/rbac.service.ts#L21-L36) & `#L99`, `#L134`, `#L198`, `#L326` | Hardcodes `CEO_LOCKED_PERMISSIONS` array and `role.slug === 'ceo'` checks | Lock **`system:root`** cleanly via `isRootRole` / immutable root-permission guard in `AuthorizationService` |
| [`src/rbac/employee-lifecycle.service.ts#L54`](../pointfex-erp-backend-main/src/rbac/employee-lifecycle.service.ts#L54) | Demote hardcodes lookup for `{ slug: 'developer' }` | Make default fallback role configurable in `authorization_policies` (seeded as `employee` / `developer`) |
| [`src/employees/employees.service.ts#L74-L77`](../pointfex-erp-backend-main/src/employees/employees.service.ts#L74-L77) | Hardcodes `C_LEVEL_ROLE_SLUGS.has(normalizedSlug) && !actorIsCeo` | Enforce via `AuthorizationService` role-tier / critical-assignment policy & `governance:appoint_executive` |
| [`src/governance/governance.service.ts#L183, #L434, #L473, #L555`](../pointfex-erp-backend-main/src/governance/governance.service.ts#L183) | Checks `isEmployeeCeo`, `isEmployeeChro`, `CORE_ROLE_SLUGS`, `role.slug === 'ceo'` | Replace with `system:root` transfer (`governance:transfer_ceo`) & `ApprovalService` + `governance:approve_request` |
| [`src/audit-logs/audit-logs.service.ts#L24-L28, #L62-L66`](../pointfex-erp-backend-main/src/audit-logs/audit-logs.service.ts#L24-L28) | Falls back to `actor?.role === 'chro' \|\| actor?.role === 'ceo'` alongside `audit_logs:read_confidential` | Call `AuthorizationService.check(actor, 'audit_logs:read_confidential')` solely |
| [`src/finance/finance.service.ts#L40, #L77`](../pointfex-erp-backend-main/src/finance/finance.service.ts#L40) | Falls back to `['cfo', 'ceo'].includes(actor.role.toLowerCase())` | Call `AuthorizationService.check(actor, 'wallets:read_all' / 'transactions:read_all', { ownerId })` |
| [`src/performance/performance.service.ts#L24, #L30, #L79`](../pointfex-erp-backend-main/src/performance/performance.service.ts#L24) | Falls back to `['chro', 'cpo', 'ceo', 'cto', 'cfo']` & `'pm'` | Call `AuthorizationService.resolveScope(actor, 'performance:read')` |
| [`src/reports/reports.service.ts#L26-L30, #L71-L75, #L223-L227`](../pointfex-erp-backend-main/src/reports/reports.service.ts#L26) | Falls back to `actor.role === 'chro' \|\| actor.role === 'ceo'` | Call `AuthorizationService.check(actor, 'grievances:read_confidential' / 'grievances:adjudicate_confidential')` |
| [`src/tasks/tasks.service.ts#L167`](../pointfex-erp-backend-main/src/tasks/tasks.service.ts#L167) | Falls back to `actor.role !== 'developer'` | Enforce `AuthorizationService.check(actor, 'tasks:approve', { resource: task })` + SoD check (`SOD-TASK`: submitter ≠ approver) |
| **Missing Endpoint Guards** (11 controllers) | `GET` routes in `Employees`, `Teams`, `Projects`, `Tasks`, `Positions`, `Consultancy`, `Engineering`, `Reports`, `Communications`, `Governance` plus some `POST`/`PATCH` routes only run `JwtAuthGuard` | Bind `@RequiresPermission(...)` + scoped filtering via `AuthorizationService` across every module in Phase 8 |

### 4.2 Frontend Hardcoded Role Checks & Stale Abstractions

| File & Lines | Current Hardcoded Check / Pattern | Target Replacement |
| :--- | :--- | :--- |
| [`src/App.tsx#L162-L335`](../pointfex-erp-frontend-main/src/App.tsx#L162-L335) | Falls back from universal permission routes to `if (currentRole === 'developer' \| 'pm' \| 'cto' \| 'cfo' \| 'cpo' \| 'ceo') switch (currentRoute)` | Replace role-keyed `switch` blocks with capability + layout routing via `can(code, scope)` |
| [`src/context/AppContext.tsx#L211-L218, #L258, #L431, #L455, #L1615`](../pointfex-erp-frontend-main/src/context/AppContext.tsx#L258) | Maps `chro -> cpo`, looks up users by `.role === 'cto' / 'ceo'`, keeps legacy `handleSetRole` / `ROLE_FALLBACK_PERMISSIONS` | Replace with server-driven `authContext` (`effectivePermissions`, `scopedGrants`, `isRoot`, `activeRoles`) using `can(code, scope)` |
| [`src/data/roles.ts`](../pointfex-erp-frontend-main/src/data/roles.ts) & [`src/utils/role-permissions-fallback.ts`](../pointfex-erp-frontend-main/src/utils/role-permissions-fallback.ts) | Hardcoded static 6-role metadata and stale permission baseline array | Remove hardcoded permission fallbacks once dynamic Role DB + `GET /api/rbac/me/permissions` carries full scoped summary |
| [`src/config/navigation.ts#L24-L180`](../pointfex-erp-frontend-main/src/config/navigation.ts#L24-L180) & [`Sidebar.tsx`](../pointfex-erp-frontend-main/src/components/layout/Sidebar.tsx) | `ROLE_NAVIGATION_PRIORITY` & `ROLE_LABELS` keyed by hardcoded `'developer'..'ceo'` | Drive nav grouping & visibility solely by `can(code, scope)` & dynamic role metadata |
| [`src/pages/cto/CtoPeoplePage.tsx`](../pointfex-erp-frontend-main/src/pages/cto/CtoPeoplePage.tsx) (`#L40, #L381, #L395-L397, #L520-L558, #L1269-L1322`) | Checks `'emp_ceo_01'`, `user.role === 'ceo'`, `['ceo', 'cto', 'cfo', 'chro', 'cpo']` for directory visibility, card badges & CEO protection warnings | Check `hasRoot` (`system:root`), `role.tier`, and `can('employees:read_directory', 'ORG')` / `can('users:suspend')` / `can('users:demote')` |
| [`src/pages/chro/ChroPerformancePage.tsx#L97, #L514`](../pointfex-erp-frontend-main/src/pages/chro/ChroPerformancePage.tsx#L97) | Filters squad view by `user.role === 'developer'` | Filter by squad membership / position rather than hardcoded `'developer'` slug |
| [`src/hooks/useCtoData.ts`](../pointfex-erp-frontend-main/src/hooks/useCtoData.ts), [`useExecutiveData.ts`](../pointfex-erp-frontend-main/src/hooks/useExecutiveData.ts), [`usePmData.ts`](../pointfex-erp-frontend-main/src/hooks/usePmData.ts) | `.find(u => u.role === 'cto' / 'ceo' / 'pm')` and `.filter(u => u.role === 'developer')` | Query by `teamMembership`, position category, or assigned task/project ownership |

---

## 5. Non-Breaking Migration Plan (Step 1 → Step 8)

To ensure existing accounts (`34` employees across `Noor`, `Abir`, `Rahid`, `Naim`, `Jihad`, `Fahim`, etc.), active UI screens, and Jest workflows continue operating smoothly at every stage:

1. **Additive-Only Prisma Migrations (Zero Destructive Drops Early):**
   - Keep existing `permissions`, `roles`, `role_permissions`, `employee_roles`, `employee_permissions`, `access_change_requests`, `audit_logs` intact initially while creating the new normalized authorization tables (`permission_categories`, `role_versions`, `role_templates`, `user_role_assignments`, `user_permission_grants`, `user_permission_denials`, `delegations`, `delegation_permissions`, `delegation_scopes`, `approval_policies`, `approval_requests`, `approval_steps`, `sod_rules`, `authorization_policies`, `access_reviews`, `security_sessions`) + hash-chain columns on `audit_logs`.
   - Write an idempotent **Phase 1 + Phase 2 backfill script** inside migrations/seeders that:
     1) Parses `docs/permissions_master.md` into `permission_categories` (`domains`, module order `00`–`20`) and `permissions` (606 codes with `isCritical`, `isDelegable = !isCritical`, `isDeprecated`). Marks `employees:suspend` and `permissions:delegate` as `isDeprecated = true` rather than deleting them so existing FKs remain intact.
     2) Copies existing `EmployeeRole` -> `user_role_assignments` (`scope = ORG` for executives, `PROJECT`/`SQUAD` for PMs, `SELF` for developers) and existing `EmployeePermission` -> `user_permission_grants` (or `delegations` where `expiresAt` is set).
     3) Ensures CEO (`emp_ceo_01`) holds a `system_root` protected role containing **`system:root`** (`include_critical = true`), preserving full supreme authority while mapping `CTO`/`CFO`/`CHRO`/`PM`/`Developer` default authority templates from Section C of `docs/permissions_master.md`.
2. **Dual Compatibility Inside `AuthorizationService` (Phase 3):**
   - Compute `effective = (role perms (including domain wildcards & root) ∪ direct grants ∪ valid delegations) − denials`, then verify scope hierarchy (`GLOBAL > ORG > DEPARTMENT > PROJECT > SQUAD > ASSIGNED > SELF`).
   - Automatically map legacy codes (`employees:suspend` -> `users:suspend` + `users:reactivate` + `users:demote`; `permissions:delegate` -> `delegations:create`) and `_own`/`_team`/`_dept`/`_all` suffixes to scopes so existing endpoints and frontend checks never break mid-rollout.
   - Cache normalized effective capability snapshots per `userId` with an incrementing `permissionVersion` (and Redis `pbac:authz:v2:{userId}`), invalidating synchronously on role edits, grants, denials, delegations, revocations, or suspension.
3. **Rule-Enforced Services Before UI Overhaul (Phases 4–6):**
   - Deploy Delegation Engine (Rules 1–10 + expiry worker + cascading revocation), SoD + Approval Engine (10 seeded `SOD-*` rules + dual approval for `⚠`), tamper-evident SHA-256 hash-chained `AuditLog` + `verify` endpoint, and `security_sessions` + re-authentication for `⚠` actions alongside backwards-compatible controller adapters.
4. **Frontend Upgrade & Module-by-Module Lockdown (Phases 7–8):**
   - Introduce `can(code, scope)` in `AppContext`, dynamic CEO Admin UI (Role Builder w/ domains & `⚠` badges, Scope Assignment, Delegation Center, Approval Inbox, Effective Permissions Debugger, Hash-Verified Audit Viewer), then lock down every backend module (`payroll`/`finance`, `engineering`/`secrets`/`deployments`, `hr`, `projects`/`tasks`, `kpis`/`xp`, `crm`, `comms`/`reports`) endpoint-by-endpoint with full security & integration test coverage before retiring `RolesGuard`.

---

**Ready for your review.** Reply **`continue`** (or approve the plan) to begin **Phase 1: Permission Catalog migrations & markdown parser seeder**.

