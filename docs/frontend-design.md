# Pointfex ERP Frontend Design System & Architecture

## Design System
- **Single source of truth**: `src/design/` CSS variables (`--bg`, `--surface`, `--border`, `--text`, `--muted`, `--primary`) supporting Light (`#F7F8FA` / `#FFFFFF`) and Dark (`#0B1220` / `#111A2E`) themes, remembered per user.
- **Formatting**: All currency values route through `src/utils/money.ts` (`formatBDT`, `formatBDTCompact`) using `en-BD` South Asian lakh/crore grouping (`৳`). Dates display in `Asia/Dhaka` (`UTC+6`).
- **Accessibility**: 44px touch targets on primary auth/action controls, AA contrast, keyboard navigation, and `prefers-reduced-motion` support.

## Workspaces & Navigation
- **Workspaces** (`src/config/workspaces.ts`, `src/config/nav-registry.ts`): Home, My Work, People & Culture, Delivery, Engineering Ops, Finance, Operations, Product & Clients, Company Hub, and Admin & Governance.
- Visibility is strictly permission-gated plus a `built` feature flag per item. No role names are used for access gating.
- **My Account** (`src/pages/account/MyAccountPage.tsx`): Unified account page for all users (profile, password rotation, Google link/unlink, MFA status, 10 recovery codes, active sessions, theme & density). Old `settings` routes render `MyAccountPage`.
- **Login & First-Login** (`src/components/auth/AuthShell.tsx`, `src/pages/auth/LoginPage.tsx`, `src/pages/auth/FirstLoginSecurityPage.tsx`): Zero demo accounts or hardcoded credentials; Google OAuth via Vite `/api` proxy; 6-digit TOTP with auto-focus/paste/auto-submit and single-use recovery code fallback.

## Code Splitting & Performance
- All workspace pages are lazy-loaded with `React.lazy` in `src/App.tsx` and split into `react-vendor`, `icons-vendor`, and per-route chunks.

