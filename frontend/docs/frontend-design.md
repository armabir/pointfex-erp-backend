# Pointfex ERP Frontend Design System & Architecture

This guide documents the unified, workspace-oriented, permission-driven frontend architecture of `pointfex-erp-frontend-main`.

---

## 1. Design Tokens (`src/design/`)

All colors, typography, spacing, border radii, and shadows live in [`src/design/tokens.css`](../src/design/tokens.css) and [`src/design/index.ts`](../src/design/index.ts), mapped to Tailwind CSS v4 tokens inside [`src/index.css`](../src/index.css).

### Semantic Color Palette
| Token | Light Theme | Dark Theme | Meaning |
| --- | --- | --- | --- |
| `--bg` | `#F7F8FA` | `#0B1220` | Application canvas |
| `--surface` | `#FFFFFF` | `#111A2E` | Card and modal surface |
| `--border` | `#E5E7EB` | `#1F2A44` | Hairline container & input border |
| `--text` | `#111827` | `#E6EAF2` | Primary readable text |
| `--muted` | `#6B7280` | `#94A3B8` | Secondary labels & metadata |
| `--primary` | `#4F46E5` | `#6366F1` | Primary brand action |
| `--success` | `#16A34A` | `#22C55E` | Positive balances & healthy statuses |
| `--warning` | `#D97706` | `#F59E0B` | Pending items & expiring delegations |
| `--danger` | `#DC2626` | `#EF4444` | Negative balances, denials & critical actions |
| `--info` | `#0284C7` | `#38BDF8` | Informational notices |

Theme defaults to system `prefers-color-scheme`, toggles from the rail/header, and persists per signed-in user in `localStorage` (`pointfex_theme_<userId>`). `@media (prefers-reduced-motion: reduce)` disables non-essential animations globally.

---

## 2. Workspaces & Adding a Page (`src/config/workspaces.ts` + `src/config/nav-registry.ts`)

Navigation is organized into **10 Workspaces** mapped to permission catalog modules `00–20` (`home`, `my_work`, `people`, `delivery`, `engineering`, `finance`, `operations`, `product_clients`, `company_hub`, `admin`).
- Desktop uses a slim workspace icon rail (`w-16`) + a collapsible contextual second panel (`w-56`) grouping pages under at most 3 headings.
- Mobile uses a 5-slot bottom bar (`Home`, `My Work`, `Inbox`, `Search`, `More`) plus a full-screen workspace menu.

### How to add a page to a workspace
1. Add a lazy import and route branch in `src/App.tsx`.
2. Add an entry to `NAV_REGISTRY` in `src/config/nav-registry.ts` with `workspace`, `sectionHeading`, `built: true`, and `requiredPermissions` (never hardcode role slugs).
   - Unbuilt modules stay hidden cleanly with `built: false`.
3. Add the route id to `NAV_REGISTRY` and `src/App.tsx`.

---

## 3. Unified Inbox Sources (`src/services/unified-inbox.ts`)

`UnifiedInboxPage` (`inbox` and `approvals` routes) aggregates items waiting on the user from existing endpoints with zero backend modifications:
- **Workflow approvals**: `erpApi.getApprovalInbox()`
- **Task reviews**: `data.tasks` in `in_review` (when permitted)
- **Access requests**: `erpApi.listAccessRequests({ status: 'PENDING' })`
- **Delegations**: pending approvals (`erpApi.listAllDelegations()`) and received grants expiring within 24 hours (`erpApi.listMyDelegations()`)
- **Budget requests**: `erpApi.getBudgetRequests()`
- **Leave requests & Mentions**: `data.reports` and unread `data.notifications`

Supports type filter chips, inline approve/reject with reason, bulk selection, unread tracking, and `j`/`k`/`a`/`r`/`Enter` keyboard controls.

---

## 4. Permission Packs & Role Builder (`src/config/permission-packs.ts`)

40 plain-English `PERMISSION_PACKS` map workspaces and human capabilities onto verified permission catalog codes.

### How to add a permission pack
1. Add an entry to `PERMISSION_PACKS` in `src/config/permission-packs.ts` with `id`, `name`, one-sentence `description`, `workspace`, `codes`, `riskLevel`, and `criticalCodes`.
2. Any `⚠` critical code from `docs/permissions_master.md` **must** set `riskLevel: 'critical'` and list the code in `criticalCodes` (verified automatically by `npm test`).

---

## 5. Dashboard Widgets (`src/dashboard/widgets.ts`)

`DynamicDashboardPage` renders **My Day** (Dhaka greeting, attendance Clock-In/Out, XP/level, BDT wallet, leave balance, pinned pages, and up to 4 `StatCard`s) plus a 2-column grid of permission-gated widgets. Per-user personalization (`pinnedRoutes`, `widgetOrder`, `hiddenWidgetIds`, `density`, `defaultWorkspace`) persists in `localStorage` (`pointfex_prefs_<userId>`).

---

## 6. Command Palette & Keyboard Shortcuts (`src/services/palette-items.ts`)

- `Ctrl+K` / `Cmd+K`: Opens the permission-filtered Command & Action Palette (pages, quick-create actions, go-to shortcuts, recent items, people, tasks, projects).
- `?`: Opens the Keyboard Shortcuts help modal.
- `g` then `h` (Home), `i` (Inbox), `t` (My Tasks), `e` (Wallet & XP), `d` (Delegations), `b` (Budgets), `r` (Roles), `l` (Audit Trail) — gated by effective permissions.

---

## 7. Dates & Currency (`src/utils/formatters.ts`, `src/utils/money.ts`)

- Dates render in `Asia/Dhaka` (`src/utils/formatters.ts`) while storing ISO strings underneath.
- Currency displays in Bangladeshi Taka (`৳`) with South Asian `3-2-2` lakh/crore grouping (`formatBDT`, `formatBDTCompact`, `<MoneyInput />`).

---

## 8. PWA Shell (`public/manifest.webmanifest`, `public/sw.js`)

Provides an installable app manifest and a read-only shell cache (`GET` non-API static assets only; zero offline writes).
