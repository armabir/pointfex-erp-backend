# Pointfex ERP — Enterprise Software Requirements Specification (SRS)

**Document Version:** 1.1 (Production Release — Full DAC Launchpad, Cookie Auth & Hardening)  
**Target Audience:** Executives, Product Managers, Engineering Staff, Security Auditors, and New Team Members  
**Workspace Root:** `/home/udnfahim/Downloads/pointfex`

---

## 1. System Overview: Hybrid PBAC + DAC Architecture

**Pointfex ERP** is a full-stack Enterprise Resource Planning platform built on **NestJS**, **Prisma ORM**, **PostgreSQL**, **React 19**, **TypeScript**, and **Tailwind CSS**.

Unlike rigid legacy software that hardcodes screens and API endpoints to static job titles (for example, checking `if (user.role === 'CTO')`), Pointfex ERP implements a **Hybrid Permission-Based Access Control (PBAC) and Discretionary Access Control (DAC)** security model backed by **JWT Authentication** and **Zero-Trust Security Policies**.

### Core Architectural Layers
1. **Authentication Layer (`AuthModule`, HttpOnly Cookie Session & Refresh Rotation)**
   - Every API endpoint under `/api` (except `POST /api/auth/login`, `POST /api/auth/refresh`, and `POST /api/auth/logout`) is protected by a global NestJS guard (`APP_GUARD` -> `JwtAuthGuard`).
   - Authentication uses **`HttpOnly`, `Secure`, `SameSite=Strict` cookies**—zero tokens are returned in login JSON responses or stored in `localStorage` (eliminating XSS token theft and CSRF cross-site leakage):
     - **Access Token (`pointfex_access_token`):** Short-lived **15-minute** signed JWT scoped to `/api`.
     - **Refresh Token (`pointfex_refresh_token`):** Long-lived **7-day** cryptographically random opaque token scoped exclusively to `/api/auth`, stored as a salted SHA-256 hash in the PostgreSQL `RefreshToken` table with `familyId` rotation tracking.
   - **Silent Refresh & Reuse Detection:** When an access cookie expires mid-session, `src/api/client.ts` transparently triggers a single-flight `POST /api/auth/refresh` rotation. If an already-rotated refresh token is ever replayed, `AuthService.refresh` revokes the entire token family immediately (`SECURITY_REFRESH_REUSE_DETECTED`).
   - Passwords are stored exclusively as salted `bcrypt` cryptographic hashes (`passwordHash`) in PostgreSQL and stripped from all HTTP JSON payloads globally via `SanitizeResponseInterceptor`.
   - Public registration (`/register` or `/signup`) does not exist. Only authorized HR/Executive administrators (`employees:create`) may provision new staff accounts.
2. **Permission-Based Access Control (PBAC)**
   - Users hold one or more active organizational/custom roles via `EmployeeRole`.
   - Each role holds a customizable set of granular capabilities (`Permission` records formatted as `resource:action`, such as `treasury:read` or `budgets:approve_request`) via `RolePermission`.
   - A user's baseline power is the union of permissions attached to their active roles.
3. **Discretionary Access Control (DAC)**
   - Authorized managers and C-Level executives holding `permissions:delegate` can grant time-bounded, single-capability exceptions directly to specific colleagues via `EmployeePermission` without altering organizational job titles.
4. **Effective Permission Resolution & Full-Stack Enforcement**
   - At runtime, `PermissionsGuard` resolves:
     $$\text{Effective Permissions} = (\text{Active Role Permissions}) \cup (\text{Unexpired Direct Delegations})$$
   - All operational API controllers (`audit-logs`, `finance`, `performance`, `reports`, `tasks`, `projects`, `teams`, `consultancy`, `engineering`, `positions`) enforce `@UseGuards(PermissionsGuard)` with `@RequirePermissions` / `@RequireAnyPermission` rather than legacy static role guards, ensuring temporary DAC delegations unlock backend endpoints immediately.
   - Results are cached in `PermissionCacheService` (Redis when configured, with automatic in-memory TTL fallback) and invalidated automatically (`invalidateUser`) after every database transaction committing a role change, Maker-Checker approval, suspension, demotion, delegation, or revocation.
5. **Stable Role Sidebar, Profile Launchpad & Permission-Driven Actions**
   - Technical permission codes are translated into plain-English business capabilities via `src/utils/permission-dictionary.ts` and grouped into four Corporate Departments (*Financial Operations*, *Human Resources*, *Engineering & Delivery*, *Executive Governance*).
   - The main `Sidebar` evaluates baseline organizational `rolePermissions` only so temporary DAC delegations never clutter the user's primary navigation menu.
   - Instead, active direct delegations appear inside `AdditionalGrantedAccessCard` on the user's **Profile & Settings** page, where `src/utils/permission-routes.ts` (`PERMISSION_ROUTES`) renders **Launch {Module}** buttons navigating straight into permission-guarded routes in `App.tsx` (`MainContentRouter`).
   - Page-level action buttons (**Edit**, **Grant Access**, **Suspend**, **Reset Access**, task completion, and grievance visibility) are strictly governed by `usePermissions()` (`hasPermission` / `hasAnyPermission`) rather than static base role checks.
   - Because Pointfex ERP manages dense organizational matrices, ledgers, and Kanban workflows, the frontend renders an initial `DesktopNoticeModal` advising first-time visitors (persisted via `localStorage` key `pointfex_desktop_notice_shown`) to access the ERP from a desktop or laptop workstation.
6. **Corporate Avatar Standard & Clean Seed Data**
   - All seeded accounts (`prisma/seed.ts`) default `avatarUrl` to `''` with zero third-party stock portrait URLs.
   - The shared frontend `<Avatar />` component (`src/components/common/Avatar.tsx`) extracts user initials (e.g., `"Fahim"` → `"F"`, `"Noor"` → `"N"`, `"Nusrat Jahan"` → `"NJ"`) inside a rounded corporate badge (`bg-indigo-600 text-white`) whenever `avatarUrl` is null, empty, or fails to load (`onError`), and `AvatarPickerModal` provides a clean **Use Initials** reset option alongside uploads and custom URLs.
7. **Production Data Immutability (No Reset or Dummy Data):**
   - All client-side dummy data files and prototype "Reset Demo Data" controls have been permanently purged from both frontend and backend. There is no endpoint or RBAC permission to wipe workspace data—every record lives directly in PostgreSQL and is protected by append-only audit trails.

---

## 2. Seeded Organizational Accounts & Roles Hierarchy

### Baseline Accounts
All baseline accounts authenticate at `/login` (`POST /api/auth/login`) using email and `bcrypt`-hashed password configured via environment variables:

| Role | Name | Email | Authority Tier |
| :--- | :--- | :--- | :--- |
| **CEO** | Noor | `noor.ceo@pointfex.internal` | Supreme Authority (Full System Control) |
| **CFO** | Rahid | `rahid.cfo@pointfex.internal` | C-Suite (Financial Operations) |
| **CTO** | Abir | `abir.cto@pointfex.internal` | C-Suite (Engineering & Technical Delivery) |
| **CHRO** | Naim | `naim.chro@pointfex.internal` | C-Suite (Human Resources & People Governance) |
| **PM** | Jihad | `jihad.pm@pointfex.internal` | Squad Management |
| **DEV** | Fahim | `fahim.dev@pointfex.internal` | Standard Engineering Contributor |

---

### Role & Permission Breakdown

1. **Chief Executive Officer (`ceo`) — Supreme Executive Authority**
   - Holds the full system capability catalog (**80 granular permissions**) across all modules.
   - Exclusive power over:
     - Dynamic Role Matrix creation, capability editing, and custom role deletion (`roles:create`, `roles:update`, `roles:delete`).
     - Immediate organizational role application (`users:assign_role`) and final Maker-Checker approval.
     - Strategic CEO Succession Transfer (`POST /api/governance/transfer-ceo`).
     - Modifying C-Level accounts (`CTO`, `CFO`, `CHRO`).
2. **Chief Financial Officer (`cfo`) — Financial Operations**
   - Views corporate treasury reserves and company-wide financial ledgers (`treasury:read`, `wallets:read_all`, `transactions:read_all`).
   - Approves or declines PM project budget increase requests (`budgets:approve_request`, `budgets:reject_request`), allocates project capital (`budgets:allocate_project`), issues payroll bonuses/deductions (`finance:issue_adjustment`), and processes client revenue shares (`revenue_share:process`).
   - Can delegate financial capabilities within their own permission set (`permissions:delegate`).
3. **Chief Technology Officer (`cto`) — Engineering & Delivery**
   - Creates and updates squads and projects (`teams:create`, `teams:update`, `teams:manage_members`, `projects:create`, `projects:assign_team`).
   - Oversees engineering quality gates, CVE security alerts, automated test suites, technical consultancy requests, and strategic directives (`quality_gates:read`, `security_alerts:*`, `consultancy:manage`, `directives:dispatch`).
   - Can view corporate audit logs (`audit_logs:read`) and delegate technical capabilities they hold (`permissions:delegate`).
4. **Chief Human Resources Officer (`chro`) — Human Resources & Lifecycle Governance**
   - Provisions and onboards new employees via `POST /api/employees` (`employees:create`).
   - Edits staff records and organizational seats (`employees:update_any`, `positions:assign`).
   - Suspends, reactivates, and resets employee access levels (`employees:suspend`).
   - Conducts performance evaluations, recognition awards, and disciplinary actions (`performance:*`), and reads/adjudicates confidential whistleblower grievances (`grievances:read_confidential`, `grievances:adjudicate_confidential`).
5. **Project Manager (`pm`) — Squad Delivery Lead**
   - Manages sprint tasks, milestones, task approvals, and squad deliverables (`tasks:create_assign`, `tasks:approve`, `tasks:reject`, `milestones:*`).
   - Allocates approved project funds to squad developers (`budgets:allocate_developer`) and requests additional project budgets from the CFO (`budgets:request_increase`).
   - Views direct squad performance (`performance:read_team`) and delegates task-level permissions they possess (`permissions:delegate`).
6. **Developer (`developer`) — Standard Contributor**
   - Strict data boundary: Can only view and update their own tasks (`tasks:read_own`, `tasks:update_status`, `tasks:submit_work`), personal wallet (`wallets:read_own`), personal transaction ledger (`transactions:read_own`), and own performance record (`performance:read_own`).
   - Cannot access corporate treasury, other staff wallets, executive audit streams, confidential grievances, or C-Level administrative panels (`403 Forbidden` enforced server-side).
   - Directory visibility restricts Developers and PMs to viewing leadership/C-Suite profiles rather than browsing peer developer lists.

---

## 3. Discretionary Access Control (DAC): Temporal Delegation

In fast-moving enterprises, waiting for permanent HR role promotions slows down operations. **Delegation (DAC)** lets authorized leaders lend a specific capability to another employee temporarily—for example, allowing a senior Developer to approve sprint tasks while a PM is on leave, or granting a C-Level executive temporary budget visibility.

### How Delegation Works
1. **Authorization Check:** The delegating actor must hold `permissions:delegate` and invoke `POST /api/rbac/users/:employeeId/direct-permissions`.
2. **Temporal Auto-Expiration:** Every direct grant supports an optional `expiresAt` ISO timestamp in the future. When `PermissionsGuard` or `RbacService` evaluates active permissions, any expired row (`expiresAt <= now`) is automatically ignored without manual cleanup.
3. **Anti-Escalation Rule ("You Can Only Give What You Have"):**
   - Implemented in `EmployeeAccessService.grantDirectPermission`:
     - Before creating an `EmployeePermission` override, the backend resolves the acting user's effective permission set (`this.rbacService.getEmployeeAccessProfile(actor.id)`).
     - If the actor tries to delegate a capability they do **not** currently hold, the server rejects the request immediately with `403 Forbidden`.
   - Furthermore, C-Level executives can grant functional capabilities they hold to other C-Level colleagues (excluding the CEO, whose authority is already absolute), while **Self-Delegation** (`actor.id === targetEmployeeId`) is universally blocked.
4. **Live Access Hot-Reloading & Profile Launchpad UX:**
   - `AppContext` invokes `GET /api/rbac/me/permissions` automatically on route changes, browser tab focus/visibility restoration, and a 10-second background interval—separating baseline `rolePermissions` from active `directPermissions` (`AdditionalGrantedAccessCard`) and effective `permissions`.
   - When effective permissions change mid-session, `AppContext` re-synchronizes unlocked backend datasets seamlessly without requiring sign-out/sign-in.
   - Delegated permissions remain hidden from the baseline `Sidebar` and appear on the user's Profile & Settings **Additional Granted Access** launchpad with expiration timestamps, reasons, and direct **Launch {Module}** buttons mapped via `src/utils/permission-routes.ts` (e.g., `employees:update_any` → `/people`, `treasury:read` → `/finance`, `grievances:create` → `/performance`, `audit_logs:read` → `/audit-log`).
   - Action controls across modules (`CtoPeoplePage`, `DeveloperTasksPage`, `TaskDetailModal`, `UpcomingDeadlines`, `CtoReportsPage`) evaluate `hasPermission` / `hasAnyPermission` directly (e.g., **Edit** via `employees:update_any`, **Grant Access** via `permissions:delegate` / `users:assign_role`, **Suspend** via `employees:suspend`, **Reset to Base Access** via `users:assign_role`) regardless of base role.

---

## 4. Maker-Checker Governance Workflow

Permanent organizational role changes (e.g., promoting a Developer to PM, or changing an employee's core role) present high privilege-escalation risk if executed unilaterally. Pointfex ERP enforces a **Maker-Checker** dual-control model:

1. **The Maker (Requestor):**
   - When a non-CEO executive (`CTO`, `CFO`, `CHRO`) initiates a role assignment via `POST /api/rbac/users/:employeeId/roles` (or edits an employee's role in the People Directory), `EmployeeAccessService` intercepts the action (`!isEmployeeCeo(actorEmployee)`).
   - Instead of changing permissions immediately, the system creates an `AccessChangeRequest` record with `status: 'PENDING'` and logs `MAKER_CHECKER_ROLE_REQUEST` in the corporate audit stream.
2. **The Checker (Approver):**
   - Pending requests appear in the **Access Approvals Queue** (`GET /api/governance/access-requests`).
   - Only **CHRO** or **CEO** (enforced on `POST /api/governance/access-requests/:id/approve` and `/reject` in `GovernanceService`) can approve or decline the request.
   - **Self-Approval Block:** A requestor cannot approve their own pending role request (`requesterId === actor.id` throws `403 Forbidden`).
   - **Anti-Bypass Rule:** Non-CEO callers cannot bypass Maker-Checker by calling `users/:employeeId/roles` directly from Postman/curl—the backend route itself routes non-CEO assignments into `PENDING` requests.
3. **CEO Direct Override:** Only the verified **CEO** can directly assign non-CEO roles immediately without an intermediate pending queue.

---

## 5. Identity Lifecycle Management, Zero-Trust Guards & CEO Shield

### Instant Account Suspension & Reactivation
- **Endpoint:** `POST /api/users/:employeeId/suspend` and `POST /api/users/:employeeId/unsuspend` (permission: `employees:suspend`).
- **Immediate Session Revocation:** Because `JwtStrategy.validate` queries PostgreSQL on **every authenticated API request**, setting `isSuspended = true` takes effect immediately—even if the suspended user still holds an unexpired JWT token, their very next API call is rejected with `403 Forbidden ("Account Suspended. Contact HR.")`.
- **Login Block:** Suspended accounts are also blocked at `POST /api/auth/login`.

### Demotion / Reset to Base Access
- **Endpoint:** `POST /api/users/:employeeId/demote` (permission: `employees:suspend`).
- Atomically deactivates all elevated `EmployeeRole` links, assigns only the base `developer` role, deletes all `EmployeePermission` direct overrides, invalidates the user's permission cache, and records a `CRITICAL` security audit event.

### Zero-Trust Anti-Sabotage Laws (`security-policy.util.ts`)
1. **CEO Protection Shield:**
   - No user—not even the CEO—can delete the `ceo` system role, strip core governance permissions (`CEO_LOCKED_PERMISSIONS`) from the `ceo` role, grant direct overrides to the CEO, suspend the CEO, or demote the CEO (`403 Forbidden`).
   - The `ceo` role can only be transferred cleanly via the atomic **CEO Succession Transfer** protocol (`POST /api/governance/transfer-ceo`), which swaps the CEO seat and role to a non-suspended successor and transitions the outgoing CEO to a fallback role.
2. **Horizontal C-Level Isolation:**
   - C-Level executives (`CTO`, `CFO`, `CHRO`) **cannot** edit profiles, modify roles, suspend, or demote *other* C-Level executives (`assertHorizontalCLevelGuard`). Only the **CEO** may modify another C-Level account.
3. **Self-Modification Block:**
   - No user may edit their own roles, delegate permissions to themselves, suspend themselves, or demote themselves (`assertNotSelfTarget` throws `403 Forbidden`).

### Mandatory Step-Up Authentication (2FA Password Challenge)
- High-risk irreversible or privilege-changing actions—**CEO Succession Transfer**, **Account Suspension**, **Access Reset / Demotion**, and **Custom Role Deletion**—enforce backend `verifyStepUpAuth` in `src/common/security-policy.util.ts`.
- The backend verifies the acting executive's `passwordConfirm` against their live `bcrypt` `passwordHash` stored in PostgreSQL before allowing the transaction to execute. Direct API calls omitting `passwordConfirm` or supplying an incorrect password are rejected with `403 Forbidden`.

### Global Error Handling & Crash Resiliency
- **Backend (`AllExceptionsFilter`):** Registered globally via `APP_FILTER` in `AppModule`. Catches all unhandled runtime, HTTP, and Prisma/PostgreSQL exceptions (`P2002`, `P2003`, `P2025`, validation, initialization errors), logs structured JSON telemetry on the server, and returns sanitized HTTP responses (`400`/`404`/`409`/`500`) without exposing stack traces, table names, or SQL details.
- **Strict Environment Validation (`Joi`):** `ConfigModule.forRoot` validates `JWT_SECRET` (min 16 chars), `DATABASE_URL` (`postgresql://`), `PORT`, and `CORS_ORIGIN` on boot, terminating startup immediately if misconfigured.
- **Global Input Validation:** `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) strips and rejects unexpected payload properties.
- **Frontend (`<ErrorBoundary />`):** Wraps the entire application root in `App.tsx` so any unexpected component exception displays a corporate **System Error** recovery screen rather than crashing to a blank page.

---

## 6. Network & Infrastructure Security

Pointfex ERP protects its API edge against volumetric abuse, credential brute-forcing, and origin spoofing through multi-layered network controls:

1. **Global & Endpoint-Specific Rate Limiting (`@nestjs/throttler` & `THROTTLE_BYPASS`):**
   - Configured globally in `AppModule` via `ThrottlerModule` + `ProxyThrottlerGuard` (`100` requests per minute per client IP) to absorb scraping or denial-of-service floods.
   - `POST /api/auth/login` in `AuthController` applies a strict `@Throttle` limit of **5 login attempts per minute per IP**, returning `429 Too Many Requests` when exceeded to defeat brute-force password guessing.
   - **Dynamic Environment Toggle:** `ProxyThrottlerGuard.handleRequest` reads `THROTTLE_BYPASS` via `ConfigService` / `process.env` (validated as an optional Joi boolean in `envValidationSchema`). Setting `THROTTLE_BYPASS=true` in local `.env` skips rate-limit enforcement during rapid development testing, while `.env.example` and `docker-compose.prod.yml` default safely to `THROTTLE_BYPASS=false`.
   - **Frontend `429` Security Alert UX:** `ApiError` in `src/api/client.ts` preserves HTTP response codes so `LoginPage.tsx` catches `429` and displays: *"Security Alert: Too many login attempts detected. Please wait 60 seconds before trying again."*
2. **Proxy-Aware Client IP Extraction & Audit Tracking:**
   - NestJS `main.ts` enables `app.set('trust proxy', 1)` so reverse proxies (`X-Forwarded-For`) resolve the true originating client IP cleanly without IPv4-mapped `::ffff:` artifacts (`extractClientIp` in `src/common/ip-address.util.ts`).
   - `RequestContextMiddleware` binds each request's normalized IP into `AsyncLocalStorage`, and both `AuditLoggerService` and service-layer `auditLog.create` calls automatically record `ipAddress` onto every `AuditLog` entry in PostgreSQL.
3. **Network Boundary IP Blocklist Guard (`IpBlocklistGuard`):**
   - Registered as the first global `APP_GUARD` in `AppModule` (ahead of throttling and JWT verification) to reject requests from configured `BLOCKED_IPS` or dynamically banned IPs immediately with `403 Forbidden`.
4. **Strict CSP, HTTP Security Headers & CORS Whitelist:**
   - `helmet()` enforces strict Content Security Policy (`default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`) along with hardened response headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Resource-Policy: same-origin`).
   - CORS enforces an explicit origin whitelist (`CORS_ORIGIN`) with `credentials: true`, rejecting wildcard `*` values and denying unrecognized browser origins.

---

## 7. Plain-English Technical Glossary

| Term | Meaning in Pointfex ERP |
| :--- | :--- |
| **JWT (JSON Web Token) & HttpOnly Cookies** | A digitally signed "ID badge" issued upon login and stored inside browser-locked `HttpOnly`, `Secure`, `SameSite=Strict` cookies (`pointfex_access_token` for 15 minutes; `pointfex_refresh_token` rotated over 7 days). Browser scripts cannot read `localStorage` tokens, protecting against XSS theft while authenticating every API request transparently. |
| **bcrypt** | A slow, one-way password scrambling algorithm. Even if a database backup were inspected, plaintext passwords cannot be reversed from the stored `passwordHash`. |
| **RBAC / PBAC** | **Role-Based / Permission-Based Access Control.** Instead of hardcoding pages by job title, users belong to Roles (`CFO`, `PM`), and Roles hold fine-grained Permissions (`treasury:read`, `tasks:approve`) checked on every API request. |
| **DAC (Discretionary Access Control)** | Targeted permission delegation where a manager shares a specific capability they already possess with a teammate—optionally with an automatic expiration timestamp. |
| **DTO (Data Transfer Object)** | A strictly validated TypeScript class (using `class-validator` decorators like `@IsEmail()` and `@IsString()`) that defines the exact shape of incoming API JSON data and blocks unknown or malicious fields before business logic runs. |
| **Guard (`JwtAuthGuard`, `PermissionsGuard`)** | Security checkpoints in NestJS that run before any controller route handler executes, verifying both the caller's identity (JWT + not suspended) and their active capabilities. |
| **Interceptor (`SanitizeResponseInterceptor`)** | A global wrapper that inspects outgoing JSON responses and strips sensitive internal keys (such as `passwordHash`) before data leaves the server. |
| **Maker-Checker** | A two-person governance rule requiring one executive to *request* a sensitive organizational change and a separate senior authority (CHRO or CEO) to *approve* it before it takes effect. |
| **Step-Up Authentication** | Re-verifying the executive's active account password right before executing destructive or supreme actions like suspending an employee, demoting access, or transferring the CEO title. |
| **Zero-Trust Architecture** | A security principle ("never trust, always verify") where the server re-checks account status, role boundaries, and step-up passwords directly against the database on every call rather than trusting client state. |

