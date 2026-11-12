# Pointfex ERP — Access Control Guide (Hybrid PBAC + DAC)

This document explains Pointfex ERP's dynamic **Permission-Based Access Control (PBAC)** and **Discretionary Access Control (DAC)** architecture, how to protect backend routes and services, how permission caching works, and how C-level temporary delegation is enforced.

---

## 1. Architecture Overview (Hybrid PBAC + DAC)

Instead of hardcoding role strings (`if (role === 'cto')`) across controllers and UI components, Pointfex ERP resolves every employee's effective permissions dynamically as the union of **Role-Based Grants (PBAC)** and **Direct User Overrides (DAC)**:

$$\text{Effective Permissions}(e) = \left(\bigcup_{r \in \text{ActiveRoles}(e)} \text{Permissions}(r)\right) \;\cup\; \text{ActiveDirectOverrides}(e)$$

### Core Relational Models (`pointfex-erp-backend-main/prisma/schema.prisma`)
| Model | Table | Purpose |
| :--- | :--- | :--- |
| `Permission` | `permissions` | Canonical capabilities (`code`, `resource`, `action`, `module`, `description`, `isSensitive`). Seeded with 78 granular permissions in `prisma/seed-rbac.ts`. |
| `Role` | `roles` | System default roles (`ceo`, `cto`, `cfo`, `chro`, `pm`, `developer`) and dynamic custom roles created via the CEO dashboard. |
| `RolePermission` | `role_permissions` | Many-to-many mapping between `Role` and `Permission`. |
| `EmployeeRole` | `employee_roles` | Assigns one or more roles to an `Employee` (with optional `expiresAt` and `isActive`). |
| `EmployeePermission` | `employee_permissions` | Direct ad-hoc permission overrides granted to a specific `Employee` (with `grantedById`, `reason`, `expiresAt`, `isActive`). |

### Hybrid Redis / In-Memory Caching (`src/rbac/permission-cache.service.ts`)
- **Cache-Aside Read Path:** [`PermissionsGuard`](../pointfex-erp-backend-main/src/common/permissions.guard.ts) looks up `pbac:perms:v1:<employeeId>` in [`PermissionCacheService`](../pointfex-erp-backend-main/src/rbac/permission-cache.service.ts) before hitting PostgreSQL.
- **Redis + Fallback:** When `REDIS_URL` is configured, permissions are cached in Redis for multi-instance consistency. When `REDIS_URL` is absent (local dev), it automatically falls back to an in-memory TTL `Map`.
- **Write-Through Invalidation:** Every mutation in [`RbacService`](../pointfex-erp-backend-main/src/rbac/rbac.service.ts) (updating a role's permissions, toggling/deleting a role, assigning/revoking an `EmployeeRole`, or granting/revoking an `EmployeePermission`) immediately invalidates all affected `employeeId` keys.
- **Auto-Expiring TTLs:** When computing permissions, `PermissionsGuard` finds the earliest upcoming `expiresAt` across the employee's active roles and direct overrides and caps the cache entry's TTL (`min(300s, secondsUntilExpiry)`), guaranteeing temporary delegations never remain active in cache past their deadline.

### Rollout Modes (`PBAC_MODE`)
Set `PBAC_MODE` in `.env`:
- `enforce` *(default)*: Enforces `@RequirePermissions` / `@RequireAnyPermission` against cached DB grants (with no hardcoded CEO bypass; the `ceo` role holds all permissions in DB).
- `shadow`: Evaluates both legacy `@Roles(...)` and dynamic PBAC in parallel, logging `[PBAC SHADOW MISMATCH]` warnings without blocking traffic.
- `legacy`: Evaluates legacy `@Roles(...)` only.

---

## 2. How to Protect Routes & Services

### A. Require ALL Listed Permissions (`@RequirePermissions`)
Use `@RequirePermissions(...)` when the endpoint requires every listed capability:

```ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common'
import { DemoIdentityGuard, DemoUser } from '../common/demo-identity.guard'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('projects')
@UseGuards(DemoIdentityGuard, PermissionsGuard)
export class ProjectsController {
  @Post()
  @RequirePermissions('projects:create')
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto)
  }
}
```

### B. Require ANY Listed Permission (`@RequireAnyPermission`)
Use `@RequireAnyPermission(...)` when multiple scope tiers share an endpoint (`*_own` vs `*_team` vs `*_all`), then inspect `actor.permissions` inside the service to scope the query:

```ts
@Controller('tasks')
@UseGuards(DemoIdentityGuard, PermissionsGuard)
export class TasksController {
  @Get()
  @RequireAnyPermission('tasks:read_own', 'tasks:read_team', 'tasks:read_all')
  findAll(@CurrentUser() actor: DemoUser) {
    return this.tasksService.findAllForActor(actor)
  }
}
```

### C. Service-Level Permission Checks (`actor.permissions`)
`PermissionsGuard` attaches the resolved `string[]` permissions onto `request.user.permissions`. Use that array in services instead of checking `actor.role`:

```ts
// Example: Enforce completion capability inside TasksService.updateStatus
if (dto.status === 'completed' && !actor.permissions?.includes('tasks:approve')) {
  throw new ForbiddenException('Permission denied: Requires "tasks:approve" to mark tasks completed')
}

// Example: Confidentiality gating inside ReportsService / AuditLogsService
const canReadConfidential = actor.permissions?.includes('grievances:read_confidential') ?? false
if (!canReadConfidential) {
  where.isConfidential = false
  where.confidentialTo = null
}
```

---

## 3. Discretionary Delegation (DAC) & Security Constraints

C-level executives (`CEO`, `CTO`, `CFO`, `CHRO`) and `PM`s (holders of `permissions:delegate`) can temporarily delegate individual permissions directly to subordinates via:
- `GET /api/rbac/delegatable-permissions` — lists only the permissions the acting user currently holds.
- `POST /api/rbac/users/:employeeId/direct-permissions` — grants a direct `EmployeePermission` override (`{ permissionCode, expiresAt?, reason? }`).
- `DELETE /api/rbac/users/:employeeId/direct-permissions/:permissionId` — revokes an active direct override.

### Business Rules & Safeguards
1. **Strict Anti-Escalation Constraint:**
   In `RbacService.grantDirectPermission`, the server resolves the **delegator's** live effective permission set (`(EmployeeRoles) ∪ (EmployeePermissions)`). Attempting to grant any permission not present in the delegator's own set (e.g., a PM delegating `budgets:approve_request`, or a CTO delegating `treasury:read`) throws `403 ForbiddenException`.
2. **Temporal Expiry (`expiresAt`):**
   Optional ISO timestamps must be strictly in the future. Expired rows are excluded by both database queries (`OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]`) and bounded cache TTLs.
3. **Audit Trail:**
   Every grant and revocation writes an immutable `AuditLog` entry (`DIRECT_PERMISSION_DELEGATED` / `DIRECT_PERMISSION_REVOKED`) capturing actor, target employee, `permissionCode`, `expiresAt`, and `reason`.

---

## 4. Administration UI (`pointfex-erp-frontend-main`)

- **CEO Role & Permission Matrix (`src/pages/ceo/CeoRoleMatrixPage.tsx` & `src/components/ceo/PermissionCartBuilder.tsx`):**
  - **Role Permission Matrix:** Edit permissions on any role, inspect sensitive flags, and assign/revoke dynamic roles for staff.
  - **Permission Cart Role Builder:** Browse all 78 permissions by module, add/remove cards in the sticky **Selected Permissions Cart** (or clone a template role), and check out a brand-new dynamic role in PostgreSQL without code deployments.
- **Direct Permissions & Delegation Panel (`src/pages/cto/CtoPeoplePage.tsx`):**
  - Available in the **People** directory Inspect/Delegate modal for C-Suite leaders; lists active direct overrides and scopes the delegation dropdown to `GET /api/rbac/delegatable-permissions`.

