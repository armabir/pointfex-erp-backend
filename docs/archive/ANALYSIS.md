# Pointfex ERP — Full-Stack Codebase Analysis (Frontend & Backend)

**Scope:** Complete architectural, functional, security, and code-quality analysis of both repositories in `/home/udnfahim/Downloads/pointfex`:
- **Backend:** `pointfex-erp-backend-main/` (NestJS 11 + TypeScript + Prisma 6 + PostgreSQL)
- **Frontend:** `pointfex-erp-frontend-main/` (React 19 + TypeScript + Vite 8 + Tailwind CSS v4)

> **Environment Note:** Neither repository currently has `node_modules` installed or a `.env` file configured, so runtime builds, linters, and Jest/TypeScript CLI checks were not executed; all findings below come from direct static inspection of the source files.

---

## 1. Executive Summary

Pointfex ERP models a software engineering organization with **6 operational roles** (Developer, Project Manager, CTO, CFO, CHRO, CEO), **6 engineering squads**, **12 active projects**, and **34 personnel** (24 developers, 6 PMs, 4 C-Suite executives).

At present, **the frontend and backend are completely disconnected**:
1. **Frontend (`pointfex-erp-frontend-main`)** is a **100% client-side in-memory prototype**. It contains zero `fetch`/`axios`/WebSocket calls, no API service layer, and no Vite proxy. All state resides in `AppContext.tsx` seeded from static arrays (`src/data/*.ts`) and resets on refresh (except role/route/theme preferences in `localStorage`).
2. **Backend (`pointfex-erp-backend-main`)** is a **modular-monolith REST API** (12 domain modules, 27 Prisma models) implementing server-side RBAC guards, Prisma `$transaction` financial invariants, and audit logging—yet it uses a header/query-based **`DemoIdentityGuard`** with no real authentication, has several **critical DTO/validation bugs** that break `POST` endpoints or allow privilege/confidentiality bypasses, and is tested exclusively against **mocked `PrismaService`** rather than a real database or HTTP pipeline.
3. **Cross-Stack Divergence:** The two apps currently diverge on currency (**USD `$`** in frontend vs **BDT `৳`** in backend), persona/seed datasets (Western names & `user_*` IDs in frontend vs Bangladeshi names & `emp_*` IDs in backend), role naming (`cpo` vs `chro`), and several data models (`BudgetRequest`, `PullRequest`, `BugBountyItem`, `Position`, `Announcement`, `Notification`).

---

## 2. Repository & Tech Stack Overview

| Dimension | Backend (`pointfex-erp-backend-main`) | Frontend (`pointfex-erp-frontend-main`) |
| :--- | :--- | :--- |
| **Framework** | NestJS `^11.0.10` (`@nestjs/platform-express`) | React `^19.3.1` + Vite `^8.3.5` |
| **Language & TS Config** | TypeScript `^5.7.3` (**loose**: `strictNullChecks: false`, `noImplicitAny: false`) | TypeScript `^7.0.2` (**strict**: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`) |
| **Data / State** | Prisma `^6.4.0` + PostgreSQL (Neon target) | React Context (`AppContext.tsx`, 2,291 lines) + static `src/data/*.ts` |
| **Validation / Linting** | `class-validator`, `class-transformer` | `oxlint ^1.89.0` (no form/schema validation library) |
| **Styling / UI** | N/A (REST JSON API; no Swagger installed) | Tailwind CSS `^4.3.4` + `lucide-react` |
| **Auth Mechanism** | `DemoIdentityGuard` (`x-demo-user-id` / `x-demo-role` or query params) | Client-side `RoleSwitcher` stored in `localStorage` |
| **Currency** | `BDT` (`৳`) with `Prisma.Decimal(14, 2)` | `USD` (`$`) with JS `number` |
| **Tests** | 5 Jest `*.spec.ts` files (mocked Prisma only; no e2e tests) | None |

---

## 3. Backend Analysis (`pointfex-erp-backend-main`)

### 3.1 Bootstrap, Middleware & Security (`src/main.ts`, `src/app.module.ts`, `src/common/*`)
- **Global Prefix (`src/main.ts:28`):** All routes are mounted under `/api`. Port defaults to `3000` (`src/main.ts:42`).
- **CORS (`src/main.ts:10-25`):** Parses `CORS_ORIGIN`, **but** the `else` branch at `src/main.ts:19-21` calls `callback(null, true)` anyway ("Permissive fallback"), effectively allowing **any origin with `credentials: true`**.
- **Global `ValidationPipe` (`src/main.ts:31-40`):** Uses `{ whitelist: true, transform: true, forbidNonWhitelisted: false, transformOptions: { enableImplicitConversion: true } }`.
  - Any DTO property missing a `class-validator` decorator is silently stripped (`whitelist: true`).
  - `enableImplicitConversion: true` coerces query/body strings unpredictably (e.g., `"false"` -> `Boolean("false") === true` when unvalidated).
- **Identity & RBAC (`src/common/demo-identity.guard.ts`, `src/common/roles.guard.ts`):**
  - `DemoIdentityGuard` reads `x-demo-user-id` / `query.demoUserId` (default `'emp_dev_01'`) and `x-demo-role` / `query.demoRole` (default `'developer'`). It **never verifies** that the employee exists in PostgreSQL or holds the claimed role in `PositionAssignment`. Any caller can spoof `x-demo-role: ceo`.
  - `RolesGuard` grants access if `user.role` is in `@Roles(...)` **or if `user.role === 'ceo'`** (`roles.guard.ts:29`).
  - No `APP_GUARD` is configured globally; controllers apply `@UseGuards(DemoIdentityGuard, RolesGuard)` individually (except `EmployeesController`, which omits `RolesGuard`).

### 3.2 Database Schema & Seed (`prisma/schema.prisma`, `prisma/seed.ts`)
- **27 Models, 0 Prisma Enums:** All status, role, category, and severity columns are plain `String` fields.
- **Organizational Decoupling:** `Employee` (person) is cleanly decoupled from `Position` (seat: `CEO`, `CTO`, `CFO`, `CHRO`, `PM-01`..`PM-06`, `DEV-01`..`DEV-24`) via temporal `PositionAssignment` (`startDate`, `endDate`, `isActive`). `Team.pmPositionId` is a non-nullable `@unique` FK to `Position`, binding 1 PM seat to 1 squad.
- **Schema Integrity Gaps:**
  - **Missing `@relation` Foreign Keys:** `TaskSubmission.reviewedById`, `BudgetRequest.requesterId`/`reviewedById`, `FinancialTransaction.employeeId`/`milestoneId`, `Report.projectId`/`forwardedBy`, `SecurityAlert.assignedPmId`, `ExecutiveDirective.assigneeId`/`projectId`/`issuedById`, and `ExecutiveDecision.ratifiedById` are raw strings without DB FK enforcement.
  - **Missing Partial Unique Constraints:** Nothing in Postgres prevents multiple active (`isActive: true`) `PositionAssignment` rows per `positionId`, multiple active `TeamMembership` rows per `employeeId`, or multiple `isLead: true` members per team if modified outside the service.
  - **Orphaned Models:** `Announcement` (`schema.prisma:590`) and `Notification` (`schema.prisma:603`) have no NestJS modules, services, or endpoints.
- **Seed Data (`prisma/seed.ts`):**
  - Idempotent `upsert` script seeding 34 positions, 34 employees, 6 teams, 12 projects, 8 milestones, 27 wallets (missing wallets for `emp_ceo_01`, `emp_chro_01`, `emp_pm_02`..`06`), 6 tasks, 4 transactions (`tx_alloc_01` omits `walletId`), 2 budget requests, 4 reports (including 2 confidential grievances), 2 performance records, 12 code quality records, 1 security alert, 1 test run, 1 consultancy request, 1 directive, and 1 decision.
  - **Numeric Discrepancy:** `CompanyTreasury.totalClientRevenue` is seeded as `740000`, whereas the sum of `clientRevenue` across the 12 seeded projects is `667000`.

### 3.3 Backend Modules & Endpoint Inventory

| Module | Controller Base Route | Endpoints & Role Guards | Persistence & Audit |
| :--- | :--- | :--- | :--- |
| **Employees** | `/api/employees` | `GET /`, `GET /:id`, `PATCH /:id` (No `RolesGuard`) | No audit log |
| **Positions** | `/api/positions` | `GET /`, `GET /:id`, `POST /assignments` (`cto`, `chro`, `ceo`) | `$transaction`, no audit log |
| **Teams** | `/api/teams` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/members`, `DELETE /:id/members/:employeeId` (`cto`, `ceo` on writes) | `$transaction` on `addMember`, no audit log |
| **Projects** | `/api/projects` | `GET /`, `GET /:id`, `POST /` (`cto`, `ceo`), `PATCH /:id` (`cto`, `pm`, `ceo`), `POST /:id/milestones` (`cto`, `pm`, `ceo`), `PATCH /:id/milestones/:milestoneId` (`cto`, `pm`, `ceo`), `POST /:id/assign-team` (`cto`, `ceo`) | `$transaction` on `create` & `assignTeam`, no audit log |
| **Tasks** | `/api/tasks` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id/status`, `PATCH /:id/checklist/:itemId`, `POST /:id/submissions`, `POST /:id/comments` (open to all); `POST /:id/approve`, `POST /:id/reject`, `POST /:id/reassign` (`pm`, `cto`, `ceo`) | `$transaction` + `AuditLog` on `create`, `approve`, `reject`, `reassign`; `AuditLog` on `updateStatus` |
| **Finance** | `/api/finance` | `GET /treasury`, `GET /wallets`, `GET /wallets/:employeeId`, `GET /transactions`, `GET /budget-requests` (open to all); `POST /allocate-developer`, `POST /request-budget` (`pm`, `cto`, `ceo`); `POST /allocate-project`, `POST /approve-budget/:requestId`, `POST /reject-budget/:requestId`, `POST /client-revenue-share` (`cfo`, `ceo`); `POST /adjustment` (`cfo`, `chro`, `ceo`) | `$transaction` + `AuditLog` on all writes |
| **Performance** | `/api/performance` | `GET /`, `GET /:employeeId` (open to all); `POST /evaluations`, `POST /recognition`, `POST /discipline` (`chro`, `ceo`) | `$transaction` + `AuditLog` (split transaction on bonus/penalty) |
| **Reports** | `/api/reports` | `GET /`, `GET /:id`, `POST /` (service-level confidentiality filter); `PATCH /:id/status` (`pm`, `cto`, `cfo`, `chro`, `ceo`); `POST /:id/forward` (`pm`, `cto`, `ceo`); `PATCH /:id/confidential` (`chro`, `ceo`) | `$transaction` + `AuditLog` on all writes |
| **Audit Logs** | `/api/audit-logs` | `GET /`, `GET /:id` (`cto`, `cfo`, `chro`, `ceo`) | Read-only (limit 100) |
| **Engineering** | `/api/engineering` | `GET /quality-gates`, `GET /quality-gates/:projectId`, `GET /security-alerts`, `GET /test-runs` (open to all); `POST /security-alerts`, `PATCH /security-alerts/:id/status` (`cto`, `pm`, `ceo`) | `$transaction` + `AuditLog` on alert writes |
| **Consultancy** | `/api/consultancy` | `GET /`, `GET /:id`, `POST /` (open to all); `PATCH /:id` (`cto`, `ceo`) | `$transaction` + `AuditLog` on writes |
| **Governance** | `/api/governance` | `GET /directives`, `GET /decisions` (open to all); `POST /directives` (`ceo`, `cto`); `POST /ratify` (`ceo`) | `$transaction` + `AuditLog` on writes |

### 3.4 Critical Backend Bugs, Security Issues & Validation Gaps

#### P0 — Broken Endpoints & Financial Integrity Bugs
1. **Broken DTO Validation on `POST /api/projects` & `POST /api/teams`:**
   - `CreateProjectDto.id` (`src/projects/dto/project.dto.ts:4-6`) and `CreateTeamDto.id` (`src/teams/dto/team.dto.ts:4-6`) are typed as `id?: string` but decorated with `@IsNotEmpty()` instead of `@IsOptional()`. Omitting `id` causes `400 Bad Request`, making the auto-ID fallbacks (`proj_${Date.now()}`, `team_${Date.now()}`) unreachable.
2. **`AddTeamMemberDto.isLead` Stripped by `ValidationPipe` (`src/teams/dto/team.dto.ts:68-69`):**
   - `isLead?: boolean` has `@IsOptional()` but **no `@IsBoolean()`** decorator. Because `whitelist: true` is enabled, NestJS strips `isLead` from every request, making it impossible to assign a lead developer via API.
3. **Double-Approval / Re-Adjudication of `BudgetRequest` (`src/finance/finance.service.ts:296-400`):**
   - `approveBudgetRequest` and `rejectBudgetRequest` do not check `if (req.status !== 'pending')`. Approving the same request twice repeatedly increments `project.budget` and `treasury.totalApprovedBudgets` and decrements `treasury.unallocatedReserves`.
4. **`IssueFinancialAdjustmentDto.type` Silent Penalty Fallthrough (`src/finance/dto/finance.dto.ts:83-85`, `src/finance/finance.service.ts:412, 446`):**
   - `type: 'bonus' | 'penalty'` has only `@IsString()` (missing `@IsIn(['bonus', 'penalty'])`). Any unrecognized string (e.g., `"Bonus"` or `"stipend"`) fails `dto.type === 'bonus'` and silently executes the **penalty** deduction branch.
5. **Unbounded Payout & Budget Bypass in `TasksService.approve` (`src/tasks/tasks.service.ts:228-282`):**
   - Accepts client-supplied `dto.payoutAmount` (or `task.milestone.payoutAmount`) and increments `treasury.totalDistributedToDevs` and the developer's wallet **without checking or incrementing `project.allocatedBudget`** and **without checking `project.budget` or `treasury.unallocatedReserves`**.
   - Idempotency relies on `description: { contains: task.id }` combined with `employeeId: task.assigneeId` (`L232-238`): reassigning a task after approval and calling `approve` again pays a second time, and multiple tasks linked to the same milestone each pay the full `milestone.payoutAmount`.
6. **Missing `walletId` on `FinancialTransaction` (`src/finance/finance.service.ts:468-477, 557-597`, `src/tasks/tasks.service.ts:262-272`):**
   - `issueAdjustment`, `processClientRevenueShare`, and `TasksService.approve` insert `FinancialTransaction` rows with `walletId: null`. Since `FinanceService.getWallet()` (`L38`) and `EmployeesService.findOne()` (`L67`) load `EmployeeWallet.transactions` via the `walletId` FK, bonuses, penalties, revenue-share payouts, and task milestone payouts **are invisible in wallet transaction histories**.
7. **Project Budget Reduction Below Already-Allocated (`src/finance/finance.service.ts:186-252`):**
   - `allocateProjectBudget` does not reject `newBudgetDecimal < project.allocatedBudget`, allowing negative remaining project budgets and inflating `unallocatedReserves` with already-disbursed funds.
8. **`ProjectsService.create` Bypasses Treasury (`src/projects/projects.service.ts:162`):**
   - Creating a project with a non-zero `budget` does not verify `CompanyTreasury.unallocatedReserves` or update `totalApprovedBudgets` / `unallocatedReserves`.
9. **Concurrency Race Conditions:**
   - Financial `$transaction` blocks use default `ReadCommitted` isolation without `SELECT ... FOR UPDATE` row locks, allowing concurrent requests to exceed `unallocatedReserves` or `project.budget`.

#### P1 — Access Control, Confidentiality Leaks & Data Consistency
10. **Confidential Grievance Leak via `AuditLog` (`src/reports/reports.service.ts:112-128, 226-242` + `src/audit-logs/audit-logs.controller.ts:13`):**
    - Confidential grievances write `actorId` and `entityTitle: report.title` into `AuditLog`, which `CTO` and `CFO` can read via `GET /api/audit-logs`.
11. **`confidentialTo` Bypass in `ReportsService` (`src/reports/reports.service.ts:39-43, 74, 100`):**
    - `ReportsService` only gates on `isConfidential === true`. If a report is submitted with `confidentialTo: 'chro'` without `isConfidential: true`, it is returned to all roles (contrary to `SYSTEM_SRS.md` §8.4.3). Also `findAll` hides a developer's own confidential submission while `findOne` allows the author to view it.
12. **IDOR & Unprotected Sensitive Reads:**
    - `PATCH /api/employees/:id` (`employees.controller.ts:24-27`) has **no `RolesGuard` and no ownership check**—any caller can edit any employee's profile.
    - `GET /api/employees` (`employees.service.ts:43-47`) exposes every employee's `wallet` and `performanceRecords` (including `disciplinaryNotes`).
    - `GET /api/finance/*` (treasury, all wallets, full ledger, budget requests) and `GET /api/performance/*` have **no `@Roles` restriction**.
    - `PATCH /api/tasks/:id/status` (`tasks.service.ts:163`) only blocks `actor.role === 'developer'` from setting `completed`; `cfo`/`chro`/arbitrary role headers can complete tasks and bypass `approve()`.
    - PMs are not scoped to their own teams/projects on `allocateDeveloperBudget`, `PATCH /api/projects/:id`, or `TasksController` mutations.
13. **Split Transactions & Silent Drops in `PerformanceService` (`src/performance/performance.service.ts:68, 124-204`):**
    - `issueRecognition` and `issueDisciplinary` commit financial bonuses/penalties in a separate transaction before recording the HR audit/performance update.
    - `issueDisciplinary` silently skips updating `PerformanceRecord` if none exists yet (32 of 34 seeded employees lack a `PerformanceRecord`).
    - `recordEvaluation` (`L68`) overwrites `codeQuality` with `overallScore`.
14. **Miscellaneous Backend Defects:**
    - **Collision-prone IDs:** `Date.now()` IDs in `TasksService`, `ProjectsService`, `TeamsService`, `ReportsService`, `EngineeringService`, `ConsultancyService`, `GovernanceService` collide under same-millisecond requests.
    - **Raw Prisma 500s:** Missing pre-checks for FK existence (`ConsultancyService.create`, `ReportsService.create`, `GovernanceService.dispatchDirective`, `TasksService.create` with `milestoneId`) and unique constraints (`TeamsService.update` `pmPositionId`, `ProjectsService.create` `code`).
    - **Synthetic Audit Actor Info:** All services hardcode `actorName: actor.id` and `actorEmail: `${actor.id}@pointfex.internal`` rather than reading the `Employee` record.
    - **Stale Submission Status:** `TasksService.approve`/`reject` never update `TaskSubmission.status`, `reviewedById`, or `reviewedAt`.
    - **SRS vs Code Discrepancy:** `SYSTEM_SRS.md:276` documents `PATCH /api/engineering/security-alerts/:id`, whereas `EngineeringController:45` implements `PATCH /api/engineering/security-alerts/:id/status`.
    - **Unused `RatifyDecision` Side Effects:** `GovernanceService.ratifyDecision` only logs `ExecutiveDecision` + `AuditLog` without mutating the target entity.

### 3.5 Backend Test Suite Assessment
- All 5 test files (`finance.service.spec.ts`, `reports.service.spec.ts`, `tasks.service.spec.ts`, `teams.service.spec.ts`, `workflows.spec.ts`) **mock `PrismaService` completely**.
- **Zero** controller, HTTP, `ValidationPipe`, `RolesGuard`, `DemoIdentityGuard`, or real PostgreSQL integration tests exist (the `test/` folder referenced in `SYSTEM_SRS.md:58` does not exist).
- `EmployeesService`, `ConsultancyService`, and `AuditLogsService` have zero unit tests.

---

## 4. Frontend Analysis (`pointfex-erp-frontend-main`)

### 4.1 Architecture, Routing & State (`src/App.tsx`, `src/context/AppContext.tsx`, `src/hooks/*`)
- **Zero Backend Connectivity:** No API client, no `.env`, no Vite proxy. `getInitialSeedData()` (`src/data/index.ts`) clones static TS arrays into React state on mount.
- **Role & Route Switching (`src/App.tsx`, `src/config/navigation.ts`):**
  - Uses `currentRole` + `currentRoute` `switch` statements synced via `window.location.hash` and `localStorage`.
  - **Shared Page Reuse:** `CFO` (7 of 9 routes), `CHRO` (7 of 9 routes), and `CEO` (14 of 15 routes) reuse CTO page components (`CtoTasksPage`, `CtoTaskManagementPage`, `CtoTeamManagementPage`, `CtoPeoplePage`, `CtoReportsPage`, `CtoSettingsPage`, `CtoAuditLogPage`).
  - `ROLE_NAVIGATION` maps `'chro'` -> `'cpo'` internally via `getNavigationForRole()`.
- **Global State (`src/context/AppContext.tsx`, 2,291 lines):** Monolithic provider containing all seed state, 40+ mutation handlers, modal state, search state, theme, and toast notifications.

### 4.2 Workspace Implementation Status

| Role | Total Nav Panels | Truly Implemented | Partial / Hardcoded Metrics | Static Placeholder ("Coming Soon") |
| :--- | :---: | :---: | :--- | :--- |
| **Developer** | 7 | 6 | `DeveloperEarningsPage` (hardcoded deadlines/pts, missing perk store) | — |
| **PM** | 9 | 8 | `PmEarningsPage` (hardcoded metrics, missing perk store) | — |
| **CTO** | 13 | 9 | `CtoDashboard`, `CtoCodeQualityPage`, `CtoEarningsPage` (hardcoded KPIs) | **`CtoSecurityTestingPage`**, **`CtoConsultancyPage`** |
| **CFO** | 9 | 8 (7 shared CTO) | `CfoDashboard`, `CfoBudgetPage` (affected by hook bugs) | — |
| **CHRO (`cpo`)** | 9 | 7 (7 shared CTO) | `ChroDashboard`, `ChroPerformancePage` (evaluation update bug + missing fields) | — |
| **CEO** | 15 | 13 (14 shared) | `CeoDashboard` (hardcoded `pendingDecisions` queue & headcount) | Inherits CTO's 2 placeholder pages |

> **Documentation vs. Code Discrepancy:** `PROJECT_STATUS.md` (lines 6, 99–100) claims *"ALL 6 WORKSPACES FULLY IMPLEMENTED & INTEGRATED"* and describes Security & Testing and Consultancy as functional trackers, whereas `CtoSecurityTestingPage.tsx` (49 lines) and `CtoConsultancyPage.tsx` (49 lines) are static **"Coming Soon in Next Release"** cards—even though `src/data/securityAlerts.ts`, `src/data/testingSuites.ts`, `src/data/consultancy.ts`, and `AppContext` handlers for them already exist.

### 4.3 Critical Frontend Bugs & Anti-Patterns

#### P0 — Broken Workflows, State Mutations & Confidentiality Leaks
1. **Direct React State Mutations (No `setData`):**
   - `TaskDetailModal.tsx:46-52`: `handleAddComment` calls `data.comments.push(...)` directly without `setData` (and hardcodes `authorId: 'user_dev_01'`).
   - `QuickTaskCreateModal.tsx:55-56`: Calls `data.tasks.unshift(...)` and `data.activityLogs.unshift(...)` directly without `setData` (and hardcodes `'user_dev_01'` and only 2 project options `proj_01`, `proj_02`).
2. **CHRO Performance Evaluation & Disciplinary Update Broken (`AppContext.tsx:1873, 1987`):**
   - `handleRecordPerformanceEvaluation` and `handleIssueDisciplinaryAction` search `prev.performanceRecords.findIndex((r) => r.developerId === userId)`. However, all seeded records in `src/data/performance.ts` only set `userId` (no `developerId`). Thus `findIndex` always returns `-1`: evaluations append duplicate records (while `getDeveloperPerformance` keeps reading the old first match), and disciplinary actions silently fail to update `disciplinaryNotes` or `performanceTier`.
   - In addition, `ChroPerformancePage.tsx:411-412` reads `perf.deliverySpeed` and `perf.codeQuality`, which are `undefined` on all seeded records (`performance.ts` uses `codeQualityScore` and omits `deliverySpeed`), rendering blank `%` cells.
3. **PM Confidential Grievance Exposure (`PmReportsPage.tsx:68-75`):**
   - `devComplaintsToPm` filters `teamMemberIds.includes(r.userId)` **without excluding `r.isConfidential`**. Consequently, `cmp_confidential_01` (filed confidentially to CHRO by `user_dev_04` in `team_01`) is visible to PM Sarah Jenkins.
4. **CFO Budget Queue & Ledger Bugs (`useExecutiveData.ts:249-255`):**
   - `pendingBudgetRequests` does not filter out `resolved` or `dismissed` statuses, keeping already-adjudicated requests in the pending queue.
   - `financialTransactions` filters `t.type` for `'budget_allocation' | 'payout' | 'penalty' | 'bonus'`, excluding `'deduction'`—which is the exact type emitted by `AppContext.handleIssueFinancialAdjustment` (`L1822`) for penalties. Penalties issued by CFO/CHRO therefore vanish from the CFO ledger (and from `DeveloperEarningsPage.tsx:30-31`, which only checks `'penalty'`).
   - `CfoBudgetPage.tsx:112` parses the requested budget amount from `req.title` using a regex `/\$([0-9,]+)/` with a `5000` fallback.
5. **CEO Pending Decisions Queue Is Non-Interactive Static Data (`CeoDashboard.tsx:102-124`):**
   - `pendingDecisions` (`dec_01`, `dec_02`, `dec_03`) is a hardcoded local array; clicking Authorize logs an audit event (`authorizeCeoAction`) but never removes or updates the decision item.

#### P1 — Role-Leakage, Stale State, Hardcoded UI & Type Mismatches
6. **Hardcoded / Mismatched Cross-Role Context:**
   - `Sidebar.tsx:117-119`: Hardcodes `'Senior Frontend'` subtitle for all 6 roles.
   - `NotificationDropdown.tsx:11`: Displays `data.notifications` unfiltered across all roles (everyone sees `user_dev_01`'s notifications).
   - `CtoTaskManagementPage.tsx` (reused by CFO, CHRO, CEO) only shows `ctoEngineeringTasks` (`creatorId === 'user_cto_01'`).
   - `CtoEarningsPage.tsx` (reused by CEO in `App.tsx:205`) reads `ctoWallet`/`ctoTransactions` instead of the current executive's wallet.
   - `CtoReportsPage.tsx`: Seeded reports in `src/data/reports.ts` omit `authorName`, `authorRole`, and `createdAt`, causing blank author labels and `'—'` dates.
   - `AppContext.tsx`: `handleUpdateTaskStatus` (`L218`) logs `userId: CURRENT_DEV_ID`; `handleUpdateUserProfile` (`L242`) updates `currentDevId` rather than `currentUser.id`; CTO handlers (`L824-1589`) hardcode `'user_cto_01'` / `'CTO Arthur Sterling'` even when used by CEO/CFO/CHRO.
7. **Broken Audit Log Sorting (`useCtoData.ts:223-225`):**
   - Sorts by `new Date(b.timestamp).getTime()`, while `AppContext.tsx` writes `timestamp: 'Just now'` (`NaN` timestamp).
8. **Duplicate `act_${Date.now()}` IDs:**
   - `handleIssueEmployeeRecognition` and `handleIssueDisciplinaryAction` call `handleIssueFinancialAdjustment` and then `setData` in the same millisecond, generating identical `act_${Date.now()}` keys.
9. **Inconsistent Revenue Split Logic:**
   - `useExecutiveData.ts:231-233` calculates `0.3` Company / `0.4` Squad / `0.3` Reserve, whereas `CfoDashboard.tsx:75-76` and `CfoBudgetPage.tsx:230` display `"70% Company / 20% Squad / 10% Capital Reserve"` (and `SYSTEM_SRS.md:205` specifies 50% acquirer / 50% squad).
10. **Other Notable UI/Type Issues:**
    - **Type Mismatch:** `AppContext.handleAllocateBudget` returns `boolean`, while `AppContextType` (`src/types/index.ts:611`) declares `void`.
    - **Stale Hooks/State:** `AppContext.handleCreateCtoPersonalTask` (`L965`) omits `currentUser` and `currentRole` from its `useCallback` dependency array; `PmTaskManagementPage` and `PmBudgetFinancePage` `useState` project/member selectors don't reset when switching PM personas; `updateTeam` in `AppContext` doesn't sync `user.teamId`.
    - **Dark Mode & Mobile Layout:** `UserMenu.tsx`, `QuickTaskCreateModal.tsx`, and `EmptyState.tsx` have broken light/dark styling; `Shell.tsx:44-46` applies `pl-20`/`pl-64` unconditionally on mobile.
    - **Personal Placeholder Data:** `src/data/activityLogs.ts:7-8, 31-32, 56` and `CtoAuditLogPage.tsx:35-38` contain real-looking university emails (`2023100000176@seu.edu.bd`, `noon@seu.edu.bd`) and `'ARM Abir Hasan'`.
    - **Hardcoded `<title>` (`index.html:7`):** Always `"Pointfex ERP — Developer Workspace"`.
    - **Unstyled Status Badges (`src/utils/formatters.ts:102-125`):** `'pending_review'`, `'dismissed'`, `'forwarded_to_c_level'`, `'allocated'`, and `'investigating'` are missing from `STATUS_CONFIG`.

---

## 5. Frontend ↔ Backend Integration & Contract Gap Analysis

If wiring `pointfex-erp-frontend-main` to `pointfex-erp-backend-main`, the following **breaking contract mismatches** must be resolved:

| Area | Frontend Expectation | Backend Implementation | Impact |
| :--- | :--- | :--- | :--- |
| **Currency** | `USD` (`$`), `formatCurrency` defaults to `'USD'` | `BDT` (`৳`), `feeBDT` on consultancy | All monetary UI displays wrong currency symbol/scale |
| **Seeded IDs & Personas** | `user_dev_01`, `user_pm_01`, `user_cto_01`, `user_cfo_01`, `user_cpo_01`, `user_ceo_01` (Western names, `Quantum Core`) | `emp_dev_01`, `emp_pm_01`, `emp_cto_01`, `emp_cfo_01`, `emp_chro_01`, `emp_ceo_01` (Bangladeshi names, `Team Alpha`) | Header identity `x-demo-user-id` & hardcoded UI lookups fail |
| **CHRO Role Key** | Uses `'cpo'` internally (`ROLE_NAVIGATION.cpo`, `user_cpo_01`) | Uses `'chro'` (`RolesGuard`, `ReportsService`, `Positions`) | `x-demo-role: cpo` will fail `@Roles('chro', 'ceo')` checks (`403 Forbidden`) |
| **Budget Requests** | Stored as `Report` (`type: 'pm_report', category: 'Budget Request'`), amount regex-parsed from title | Dedicated `BudgetRequest` table + `/api/finance/budget-requests`, `/request-budget`, `/approve-budget/:id`, `/reject-budget/:id` | Completely incompatible payloads & endpoints |
| **Report Author / Date** | `Report.userId`, `Report.date` | `Report.authorId`, `Report.submittedAt` | Frontend components reading `r.userId` / `r.date` break |
| **User / Team Shape** | Flat `user.role`, `user.teamId`, `user.avatar`; `team.pmId`, `team.memberIds`, `team.projectIds` | Derived via `positionAssignments`, `teamMemberships`, `teamProjects`, `employee.avatarUrl` | Requires response DTO mapping or frontend adapter layer |
| **Missing Backend Models** | Uses `PullRequest` (`src/data/pullRequests.ts`) and `BugBountyItem` (`src/data/securityAlerts.ts`) | **No `PullRequest` or `BugBounty` models/endpoints** | PR review & bug bounty features cannot persist |
| **Unused Backend Models** | `announcements.ts` & `notifications.ts` are active UI widgets | `Announcement` & `Notification` exist in `schema.prisma` with **no modules/endpoints** | Announcements & notifications cannot be fetched/updated via API |
| **Client Revenue Split** | `0.3 / 0.4 / 0.3` in hook vs `70% / 20% / 10%` in CFO UI | `50%` acquirer / `50%` squad developers (`processClientRevenueShare`) | Business logic conflict across CFO UI, hook, and API |
| **Penalty Transaction Type** | Emits `type: 'deduction'` in `AppContext` (but `useExecutiveData` checks `'penalty'`) | Emits `type: 'penalty'` | Minor alignment needed (`'penalty'` everywhere) |

---

## 6. Prioritized Actionable Recommendations

### Phase A — Critical Fixes (Before Any Live Use or Integration)
1. **Fix Broken Backend DTOs:**
   - Replace `@IsNotEmpty()` with `@IsOptional()` on `CreateProjectDto.id` and `CreateTeamDto.id`.
   - Add `@IsBoolean()` to `AddTeamMemberDto.isLead`.
   - Add `@IsIn(['bonus', 'penalty'])` to `IssueFinancialAdjustmentDto.type` and `@IsIn(...)` across all status/role/severity/tier DTOs.
2. **Close Backend Financial & Confidentiality Bugs:**
   - Enforce `req.status === 'pending'` inside `approveBudgetRequest` and `rejectBudgetRequest`.
   - Always pass `walletId: wallet.id` in every `FinancialTransaction.create` (`issueAdjustment`, `processClientRevenueShare`, `TasksService.approve`).
   - Enforce project budget & treasury checks (or remove arbitrary `payoutAmount`) in `TasksService.approve`, and add `SELECT ... FOR UPDATE` or serializable transactions on reserve/budget updates.
   - Prevent `allocateProjectBudget` from reducing `project.budget` below `project.allocatedBudget`, and route `ProjectsService.create` budget through treasury accounting.
   - Gate `ReportsService` on **both** `isConfidential || Boolean(confidentialTo)`, and redact/exclude confidential grievance titles & author IDs from `AuditLog` entries visible to `CTO`/`CFO`.
   - Lock down `GET /api/finance/*`, `GET /api/performance/*`, and `PATCH /api/employees/:id` with `@Roles` / ownership checks, and enforce full role checks on `PATCH /api/tasks/:id/status`.
3. **Fix Critical Frontend State & Confidentiality Bugs:**
   - Replace direct array mutations in `TaskDetailModal.tsx` and `QuickTaskCreateModal.tsx` with proper `AppContext` `setData` handlers.
   - Fix `findIndex((r) => r.userId === userId || r.developerId === userId)` in `AppContext.tsx` (`L1873, L1987`) and align `deliverySpeed`/`codeQualityScore` fields in `ChroPerformancePage.tsx`.
   - Filter `!r.isConfidential` in `PmReportsPage.tsx` (`devComplaintsToPm`).
   - Filter `pendingBudgetRequests` by `status === 'pending'` and unify `'penalty'` transaction type in `useExecutiveData.ts` & `AppContext.tsx`.

### Phase B — Integration & Contract Alignment
4. **Standardize Canonical Domain Contract:** Align on `BDT (৳)`, `'chro'` role key, canonical `User`/`Project`/`Report`/`BudgetRequest` DTOs, and a single documented client-revenue-sharing rule.
5. **Replace Demo Auth & Hardcoded CORS:** Implement JWT authentication + password hashing (resolving actor identity/role from DB `PositionAssignment`) and remove the permissive `callback(null, true)` CORS fallback in `src/main.ts`.
6. **Build Frontend API Client & Missing Backend Endpoints:** Introduce a typed API client (`fetch`/React Query) with `VITE_API_BASE_URL` / Vite proxy, implement `Announcement`, `Notification`, `PullRequest` (or deprecate), and `ExecutiveDirective` update endpoints, and replace the two CTO "Coming Soon" placeholders (`CtoSecurityTestingPage`, `CtoConsultancyPage`) + `CeoDashboard` static `pendingDecisions` with real API-backed views.

### Phase C — Verification & Hygiene
7. **Add Real Integration / E2E Tests:** Add NestJS `@nestjs/testing` + `supertest` HTTP tests against a test PostgreSQL DB exercising `ValidationPipe`, `RolesGuard`, concurrency, and `prisma/seed.ts`.
8. **Clean Up Frontend Code Quality:** Fix `AppContextType.allocateBudget` return type, `useCallback` dependencies, ISO timestamps on `ActivityLog` (`new Date().toISOString()`), UUID/crypto IDs instead of `Date.now()`, dark-mode classes on `UserMenu`/`EmptyState`/`QuickTaskCreateModal`, and remove student personal emails from `src/data/activityLogs.ts`.

