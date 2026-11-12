# Pointfex ERP (`v3.3.0-beta`)

Zero-Trust enterprise resource planning platform built with **NestJS + Prisma + PostgreSQL (Neon)** and **React 19 + TypeScript + Vite + Tailwind CSS**.

---

## Architecture Overview

```text
Browser (React 19 SPA)
   │  HTTPS / HttpOnly SameSite=Strict Cookies + X-MFA-Code
   ▼
Nginx / Vite Proxy (/api/*)
   │
   ▼
NestJS API (/api)
   ├── JwtAuthGuard + PermissionsGuard + FreshMfaGuard
   ├── Dynamic PBAC/DAC Engine (608 permissions, scopes, delegations, SoD approvals)
   ├── CEO-Only Login Allowlist + Google OAuth 2.0 (PKCE) + 24h One-Time Activation Links
   ├── MailService (Gmail/SMTP via Nodemailer + Resend fallback)
   └── Hash-Chained AuditLog + Append-Only EmployeeChangeHistory
   │
   ▼
PostgreSQL / Neon (least-privilege `pointfex_app` role at runtime)
```

---

## Key Capabilities (`v3.3.0-beta`)

- **Zero-Trust Authentication & Onboarding**
  - Email/password login + Google OAuth 2.0 (PKCE) gated by the **CEO-only Login Allowlist** (`login_allowlist`).
  - Newly provisioned employees receive a **24-hour, single-use activation link** (`/reset-password?token=...&onboarding=1`) via **Gmail/SMTP** or **Resend** — no temporary passwords in plaintext.
  - Authorized admins (`employees:create` or `users:reset_password`) can resend the 24h link (invalidating any prior unused link), and the employee profile shows live link usage/delivery status (`Setup link used`, `Setup link pending`, or `Invitation not delivered`).
  - Mandatory TOTP 2FA enrollment (`FirstLoginSecurityPage`) + **Fresh MFA (`X-MFA-Code`)** enforcement on all sensitive and executive actions.
- **Dynamic Authorization & Access Governance**
  - **608 granular permissions** defined in [docs/permissions_master.md](docs/permissions_master.md), grouped into 40 permission packs.
  - **Scope-aware evaluation** (`SELF`, `TEAM`, `DEPARTMENT`, `PROJECT`, `GLOBAL`) with explicit per-user grants/denials, time-boxed temporary **Delegations** (MFA-protected), and **Maker-Checker Segregation of Duties (SoD)** approval workflows.
  - **CEO (`system:root`) & `mfa:manage` Security Controls**: In-app MFA reset (requires fresh MFA + written reason, revokes sessions, logs audit/history, notifies user by email; CEO MFA cannot be reset via the app) and offline CLI `npm run ceo:reset-mfa`.
- **Operations, Engineering & Finance**
  - **People & Culture**: Employee directory, onboarding picker, profile & workload drawer, role promotion proposals, direct capability grants, and MFA security overview.
  - **Squads & Projects**: Create engineering squads with or without an immediate PM (PM can be assigned later), manage squad rosters, projects, milestones, and deliverables.
  - **Treasury & Budgets**: BDT (`৳`) lakh/crore formatting, `Asia/Dhaka` timestamps, project budget requests, CFO approvals/rejections with confirmation dialogs, and bonus/penalty ledger adjustments.

---

## Who Has What Access (Role Summary)

All workspace visibility, navigation items, and API endpoints are enforced by **effective permission codes** rather than hardcoded role names:

| Role / Tier | Core Responsibilities | Key Capabilities & Boundaries |
| --- | --- | --- |
| **CEO (`system:root`)** | Full organization governance | Login allowlist management (`login_allowlist:manage`), custom role & permission matrix (`roles:*`), CEO MFA recovery protections, executive approvals |
| **CTO** | Engineering & technical operations | People & squad management, projects, tasks, code quality, security testing, audit logs (cannot alter CEO MFA or login allowlist) |
| **CFO** | Treasury & financial control | Treasury reserves, budget approvals/rejections, disbursements, payroll/wallets, financial adjustments |
| **CHRO** | People, performance & HR governance | Employee onboarding, role-change approvals (Maker-Checker), performance reviews, attendance/leave |
| **Project Manager (PM)** | Squad delivery & planning | Assigned squad tasks, sprint tracking, project budgets, team workload |
| **Developer** | Delivery & self-service | Assigned tasks, projects, personal wallet/earnings, reports, My Account & MFA |

> For the complete 608-permission catalog and policy rules, see [docs/permissions_master.md](docs/permissions_master.md) and [docs/authorization.md](docs/authorization.md).

---

## Documentation Catalog

- [LOCAL_SETUP.md](LOCAL_SETUP.md) — Step-by-step local development setup guide
- [DEPLOYMENT.md](DEPLOYMENT.md) — Docker, VPS, and Neon PostgreSQL production deployment guide
- [docs/permissions_master.md](docs/permissions_master.md) — Complete 608-permission catalog
- [docs/authorization.md](docs/authorization.md) — PBAC/DAC, scopes, delegations, and SoD rules
- [docs/api.md](docs/api.md) — Backend REST API reference
- [docs/security-runbook.md](docs/security-runbook.md) — Key rotation, incident response, CEO offline MFA recovery, and Neon least-privilege SQL
- [docs/frontend-design.md](docs/frontend-design.md) — Shared design system, BDT money, `Asia/Dhaka` dates, accessibility
- [docs/known-issues.md](docs/known-issues.md) — Tracked issues and status

---

## Verification

Run the full build, typecheck, lint, unit, and security test suites across both backend and frontend:

```bash
npm run verify:all
```

- **Backend**: `nest build` + Jest (`npm --prefix backend run verify`)
- **Frontend**: `tsc --noEmit` + `oxlint` + `node tests/run.mjs` + `vite build` (`npm --prefix frontend run verify`)
