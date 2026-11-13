# Pointfex ERP (`v3.13.0`)

Production-grade, Zero-Trust Enterprise Resource Planning (ERP) platform built with **NestJS + TypeScript + Prisma + PostgreSQL (Neon)** and **React 19 + TypeScript + Vite + Tailwind CSS**.

Engineered for strict organizational governance, server-enforced role tiers, executive voting, maker-checker segregation of duties (SoD), time-boxed authority delegations, tamper-evident audit logging, and resilient serverless deployment on Vercel.

---

## 1. System Architecture

```text
                               ┌───────────────────────────────────────────────┐
                               │           Client Browser (React 19 SPA)      │
                               │  - Cross-Tab BroadcastChannel Logout Sync     │
                               │  - 30-min Idle Timeout with 60s Warning Modal │
                               │  - Live Password Strength Meter (Policy Rules)│
                               └──────────────────────┬────────────────────────┘
                                                      │ HTTPS / HttpOnly SameSite=Strict Cookies
                                                      │ X-MFA-Code, X-MFA-Action, X-MFA-Target
                                                      ▼
                               ┌───────────────────────────────────────────────┐
                               │            Vercel Edge / SPA Router           │
                               │  - SPA Fallback: /index.html (no-cache)       │
                               │  - Static Assets: /assets/* (immutable 1 yr)  │
                               │  - API Rewrites: /api/(.*) -> Backend Origin  │
                               └──────────────────────┬────────────────────────┘
                                                      │
                                                      ▼
                               ┌───────────────────────────────────────────────┐
                               │         NestJS Serverless API Engine          │
                               │  ├── Authentication Guards:                   │
                               │  │   ├── JwtAuthGuard (Family Refresh Token)  │
                               │  │   ├── FreshMfaGuard (±1 step TOTP & Replay)│
                               │  │   └── PermissionsGuard (Dynamic PBAC)      │
                               │  ├── Governance & Authorization:              │
                               │  │   ├── Tier Ceiling (CEO > EXEC > MGR > STF)│
                               │  │   ├── CEO Direct Power (Instant Apply)     │
                               │  │   ├── Executive Voting Engine (50%+ Pass)  │
                               │  │   ├── Project Creation Stepper (BDT Budget)│
                               │  │   └── Developer Proposals (HR Grievance)   │
                               │  ├── Security & Automation:                   │
                               │  │   ├── Automated Sweeper (/api/cron/sweep)  │
                               │  │   ├── Allowlist Engine (CEO Exact Emails)  │
                               │  │   └── Hash-Chained Audit Trail (SHA-256)   │
                               └──────────────────────┬────────────────────────┘
                                                      │
                                                      ▼
                               ┌───────────────────────────────────────────────┐
                               │          PostgreSQL (Neon Serverless)         │
                               │  - Runtime Pool: PgBouncer (pointfex_app)     │
                               │  - Direct Owner URL: Prisma additive migrates │
                               └───────────────────────────────────────────────┘
```

---

## 2. Key Capabilities (`v3.13.0`)

### A. Role Authority Tiers & Server-Enforced Ceiling
- **Four Standard Tiers:** `CEO` (implicit for `system:root`), `EXECUTIVE` (C-level: CTO, CFO, CHRO, COO, CPO, CRO), `MANAGER` (PM, Squad Lead), and `STAFF` (Developers, Designers, Operations).
- **Strict Tier Ceiling Law:** Implemented server-side in guards and domain services. An actor may only inspect access details or modify personnel in a **strictly lower tier** (`isStrictlyLowerTier`).
- **Executive Restrictions:**
  - Executives cannot change or request changes for peers (`EXECUTIVE`), the `CEO`, or themselves (403 Forbidden).
  - Executives can only submit requests for `MANAGER` and `STAFF` users, routing directly to the CEO.

### B. Fixed CEO & Zero-Trust Governance
- **Immutable CEO Anchor:** Exactly one active holder of `system:root` matching `CEO_EMAIL`, verified at startup. The `system:root` user cannot be deleted, suspended, demoted, or edited via application endpoints.
- **CEO Transfer Disabled:** Governed by `CEO_TRANSFER_ENABLED=false` (default). In-app CEO transfer cards, modals, and succession endpoints return `404 Not Found`.
- **CEO Direct Authority:** Actions taken by the CEO (role creation, permission edits, user assignments, suspensions, team updates) take effect **immediately**. No approval requests are spawned for the CEO. Mandatory: fresh 6-digit MFA, written reason (min 10 chars), audit log, and history entry.
- **CEO Identity Update (`PATCH /api/employees/:id/identity`):** CEO can update any user's legal name and email. Requires fresh MFA; auto-adds email to allowlist, revokes active sessions, unlinks external Google accounts, and notifies both addresses.
- **Offline Emergency Recovery:** Database-level CLI procedure `npm run ceo:reset-mfa` documented in [docs/security-runbook.md](docs/security-runbook.md).

### C. Executive Voting Engine & Project Lifecycle
- **Voting Engine (`VoteEngineService`):**
  - Eligible voters = active holders of `votes:cast` excluding the requester.
  - Finalizes as `APPROVED` when strictly more than half of all eligible voters approve (`> Math.floor(N/2)`).
  - Finalizes as `REJECTED` early when approval is mathematically unreachable.
  - Automatic expiration on `voteDeadline` (default 7 days).
  - Executives verify votes via fresh MFA (`votes:cast` bound to request ID).
  - CEO holds direct override authority (approve/reject with MFA + reason).
- **Project Creation Stepper (`/project-requests`):**
  - 5-step wizard: Details & Scope, Deliverables & Timeline, Team Staffing, Risks & Success Criteria, Budget & Justification.
  - **Single Source of Truth for Budget:** This stepper is the ONLY place where an initial project budget in BDT is set. Upon approval, automatically provisions the project in Planning.
- **Developer Proposals & Confidential Grievances (`/proposals`):**
  - Any developer can submit ideas (problem, solution, benefits) to their PM.
  - PM triage: Forward to Executive Vote (crediting developer), Return for revisions, or Decline.
  - **Confidential Grievance Mode:** Bypasses PM and squad entirely, routing confidentially to HR leadership.

### D. Unified Inbox & Approval Hardening
- **Shared `MfaConfirmModal`:** Standardized across button clicks and keyboard shortcuts (`a` approve, `r` reject). Auto-focuses 6-digit input, supports clipboard paste, auto-submits, and enforces written reason (min 10 characters).
- **TOTP Tolerance:** Accepts ±1 step clock tolerance (±30s skew) with single-use replay protection and clear messages.
- **Non-Stale State:** On approval/rejection, items animate out immediately from local state without full-page reload. Errors keep the modal open displaying attempts remaining.
- **Bulk Action Safety:** Bulk actions allowed strictly for non-sensitive tasks. Sensitive items (access, budget, approvals, allowlist) require individual MFA codes.
- **Approval Engine Admin Console:** Renamed and restricted to users with `approvals:manage` or `system:root`. Hidden from ordinary users.
- **Self-Approval Blocked:** Blocked across all services with friendly notification.

### E. Access History Ledger (`/access-history`)
- Gated by `access_history:read` (CEO and Executives only).
- Immutable, searchable timeline of grants, revocations, tier changes, delegations, and identity changes.
- Live summary stats, filters by change type, pagination, and one-click JSON/CSV export.

### F. Password Hardening & Session Security
- **Strict Password Policy:** 8–128 characters, uppercase, lowercase, number, symbol, dictionary blacklist validation, no user name or email containment, no reuse of last 5 hashes (`PasswordHistory`).
- **Live Strength Meter:** Real-time visual feedback checklist in My Account.
- **Cross-Tab Logout:** Connected `BroadcastChannel('pointfex-auth')` so logging out in one window instantly signs out all other open tabs.
- **Log Out of All Devices:** New button in My Account revoking all active security sessions and refresh token families.
- **30-Minute Idle Timeout:** Global activity monitor with 1-minute countdown warning modal. Any activity resets the timer.
- **Permanent Google Link:** Removed unlink endpoint. Displays read-only green badge *"Google Account Linked"*.

### G. Production Vercel Deployment & Sweeper
- **Frontend Vercel Config:** Removed permanent 301/308 redirects on `/`. Single-page-app rewrite to `/index.html`. Security headers and immutable asset caching.
- **Backend Vercel Config:** Bundles Prisma Client via `@vercel/node`.
- **Automated Sweeper (`/api/cron/sweep`):** Runs every 5 minutes via Vercel Cron. Cancels expired votes, revokes expired delegations, unfreezes accounts, clears expired sessions, and validates audit hash chain integrity.

---

## 3. Role & Access Matrix (Tier Hierarchy)

| Function | CEO (`system:root`) | Executive (CTO, CFO, CHRO, etc.) | Manager (PM, Squad Lead) | Staff (Developer, Designer) |
| --- | :---: | :---: | :---: | :---: |
| **Authority Tier** | `CEO` | `EXECUTIVE` | `MANAGER` | `STAFF` |
| **People Directory** | Full Profile & History | Full Profile & History | Minimal DTO + Squad Access | Minimal Public DTO |
| **Inspect Access Details** | Anyone | Lower Tiers (Read-Only) | Assigned Squad Devs (Read-Only) | Self Only |
| **Access History Ledger** | Full Read & Export | Full Read & Export | ❌ Hidden (403) | ❌ Hidden (403) |
| **Role Assignment / Revoke** | Direct (Immediate) | Request-Only (for Lower Tiers) | ❌ None | ❌ None |
| **Delegation Controls** | See All & Revoke Any | Delegate Held & Revoke Own | Receive Only | Receive Only |
| **Edit Name & Work Email** | Direct (MFA + Audit) | ❌ None | ❌ None | ❌ None |
| **Teams & Squads** | Manage Mode | Manage Mode | Read-Only (Assigned Squad) | Read-Only (Assigned Squad) |
| **Project Creation** | Direct / Stepper | Stepper & Cast Vote | Request-Only | Submit Proposals |
| **Executive Voting Engine** | Override (Approve/Reject)| Cast Vote (`votes:cast`) | ❌ None | ❌ None |

---

## 4. Environment Variables Checklist

### Backend (`backend/.env`)
```bash
# --- Application ---
NODE_ENV="production"
PORT=3000
FRONTEND_URL="https://your-frontend.vercel.app"

# --- Database (Neon) ---
DATABASE_URL="postgresql://pointfex_app:PASSWORD@ep-xyz-pooler.neon.tech/pointfex_erp?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://db_owner:PASSWORD@ep-xyz.neon.tech/pointfex_erp?sslmode=require"

# --- Authentication & Session Hardening ---
JWT_SECRET="<generate-random-64-character-string>"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_DAYS="7"
COOKIE_SECURE="true"
COOKIE_SAME_SITE="strict"

# --- Governance & Security Invariants ---
CEO_EMAIL="ceo@pointfex.com"
CEO_TRANSFER_ENABLED="false"
CRON_SECRET="<generate-random-32-character-secret>"
VOTE_DEADLINE_DAYS="7"
AUTHZ_MODE="enforce"
PBAC_MODE="enforce"
CORS_ORIGIN="https://your-frontend.vercel.app"

# --- Email & OAuth ---
RESEND_API_KEY="re_..."
MAIL_FROM="Pointfex ERP <no-reply@pointfex.com>"
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="https://your-backend.vercel.app/api/auth/google/callback"
```

### Frontend (`frontend/.env`)
```bash
VITE_API_BASE_URL="/api"
```

---

## 5. Deployment & Production Operations

### A. Deploy Database Migrations to Neon (Additive Only)
Run this single command from your terminal:
```bash
cd backend && npx prisma migrate deploy
```
*(Never run `prisma migrate reset` or `prisma migrate dev` against production).*

### B. Google Cloud Console Redirect URI
Register the exact redirect URI in **Google Cloud Console > Credentials > OAuth 2.0 Web Client**:
```
https://backend-erp-pointfex.vercel.app/api/auth/google/callback
```

### C. Verification Test Suite
Run comprehensive verification across both packages:
```bash
# Backend unit, integration, and governance test suites (22 suites, 112 passed)
npm --prefix backend test -- --runInBand

# Backend build
npm --prefix backend run build

# Frontend typecheck & test suite (18 passed)
npm --prefix frontend run typecheck
npm --prefix frontend test -- --watchAll=false

# Frontend lint & production build
npm --prefix frontend run lint
npm --prefix frontend run build
```

---

## 6. Complete Documentation Catalog

- [LOCAL_SETUP.md](LOCAL_SETUP.md) — Local development and Docker test container guide
- [docs/vercel-deployment.md](docs/vercel-deployment.md) — Detailed Vercel deployment, Cron sweep, and OAuth guide
- [docs/security-runbook.md](docs/security-runbook.md) — Key rotation, emergency CEO MFA reset CLI, and incident response
- [docs/permissions_master.md](docs/permissions_master.md) — Complete 608+ permission catalog, packs, and rules
- [docs/authorization.md](docs/authorization.md) — PBAC/DAC, scopes, delegations, and maker-checker SoD
- [docs/api.md](docs/api.md) — Backend REST API endpoints and payload reference
- [docs/known-issues.md](docs/known-issues.md) — Deferred enhancements and known non-blocking items

---

## License
Proprietary & Confidential — Pointfex Engineering. All Rights Reserved.
