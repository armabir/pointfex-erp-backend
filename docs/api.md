# Pointfex ERP API Reference

Generated from backend controllers (170 routes).

| Method | Path | Permission / Auth | Fresh MFA |
| --- | --- | --- | --- |
| `GET` | `/api/audit-logs` | 'audit_logs:read', 'audit_logs:read_confidential' | — |
| `GET` | `/api/audit-logs/verify` | 'audit_logs:verify', 'audit_logs:read', 'audit_logs:read_confidential' | — |
| `GET` | `/api/audit-logs/:id` | 'audit_logs:read', 'audit_logs:read_confidential' | — |
| `POST` | `/api/auth/login` | Public | — |
| `POST` | `/api/auth/refresh` | Public | — |
| `POST` | `/api/auth/logout` | Public | — |
| `GET` | `/api/auth/me` | Authenticated | — |
| `GET` | `/api/auth/me/sessions` | Authenticated | — |
| `DELETE` | `/api/auth/me/sessions/:id` | Authenticated | — |
| `POST` | `/api/auth/google/unlink` | Authenticated | — |
| `POST` | `/api/auth/change-password` | Authenticated | — |
| `POST` | `/api/auth/forgot-password` | Public | — |
| `POST` | `/api/auth/reset-password` | Public | — |
| `POST` | `/api/auth/recovery-codes/regenerate` | Authenticated | — |
| `GET` | `/api/auth/google` | Public | — |
| `GET` | `/api/auth/google/callback` | Public | — |
| `POST` | `/api/auth/google/exchange` | Public | — |
| `GET` | `/api/auth/allowlist` | 'login_allowlist:manage', 'login_allowlist:read' | — |
| `GET` | `/api/auth/allowlist/ready-emails` | 'employees:create', 'login_allowlist:manage', 'login_allowlist:read' | — |
| `POST` | `/api/auth/allowlist` | 'login_allowlist:manage' | login_allowlist:manage |
| `POST` | `/api/auth/allowlist/import` | 'login_allowlist:manage' | login_allowlist:manage |
| `PATCH` | `/api/auth/allowlist/:id` | 'login_allowlist:manage' | login_allowlist:manage |
| `DELETE` | `/api/auth/allowlist/:id` | 'login_allowlist:manage' | login_allowlist:manage |
| `GET` | `/api/auth/allowlist/requests` | 'employees:create', 'login_allowlist:manage', 'login_allowlist:read' | — |
| `POST` | `/api/auth/allowlist/requests` | 'employees:create' | — |
| `POST` | `/api/auth/allowlist/requests/:id/approve` | 'login_allowlist:manage' | login_allowlist:manage |
| `POST` | `/api/auth/allowlist/requests/:id/reject` | 'login_allowlist:manage' | login_allowlist:manage |
| `GET` | `/api/announcements` | 'announcements:read' | — |
| `GET` | `/api/notifications` | 'notifications:read_own' | — |
| `PATCH` | `/api/notifications/read-all` | 'notifications:read_own' | — |
| `PATCH` | `/api/notifications/:id/read` | 'notifications:read_own' | — |
| `GET` | `/api/consultancy` | 'consultancy:read' | — |
| `GET` | `/api/consultancy/:id` | 'consultancy:read' | — |
| `POST` | `/api/consultancy` | 'consultancy:create' | — |
| `PATCH` | `/api/consultancy/:id` | 'consultancy:manage' | — |
| `POST` | `/api/employees` | 'employees:create', 'users:assign_role' | users:assign_role |
| `GET` | `/api/employees` | 'employees:read_directory' | — |
| `GET` | `/api/employees/:id` | 'employees:read_directory' | — |
| `POST` | `/api/employees/:id/sensitive-profile/unlock` | 'employees:read_sensitive' | employees:read_sensitive |
| `GET` | `/api/employees/:id/sensitive-profile` | 'employees:read_sensitive' | — |
| `GET` | `/api/employees/:id/change-history` | 'employees:read_directory', 'employees:read_sensitive', 'roles:read' | — |
| `POST` | `/api/employees/:id/promotions/approve` | 'promotions:approve' | promotions:approve |
| `POST` | `/api/employees/:id/resend-invite` | 'employees:create', 'users:reset_password' | users:reset_password |
| `PATCH` | `/api/employees/:id` | 'employees:update_own_profile', 'employees:update_any' | — |
| `GET` | `/api/engineering/quality-gates` | 'quality_gates:read' | — |
| `GET` | `/api/engineering/quality-gates/:projectId` | 'quality_gates:read' | — |
| `GET` | `/api/engineering/security-alerts` | 'security_alerts:read' | — |
| `POST` | `/api/engineering/security-alerts` | 'security_alerts:create' | — |
| `PATCH` | `/api/engineering/security-alerts/:id/status` | 'security_alerts:update_status' | — |
| `GET` | `/api/engineering/test-runs` | 'test_runs:read' | — |
| `GET` | `/api/finance/treasury` | 'treasury:read' | — |
| `GET` | `/api/finance/wallets` | 'wallets:read_all' | — |
| `GET` | `/api/finance/wallets/:employeeId` | 'wallets:read_own', 'wallets:read_all' | — |
| `GET` | `/api/finance/transactions` | 'transactions:read_own', 'transactions:read_all' | — |
| `GET` | `/api/finance/budget-requests` | 'budgets:read_requests' | — |
| `POST` | `/api/finance/allocate-developer` | 'budgets:allocate_developer' | — |
| `POST` | `/api/finance/allocate-project` | 'budgets:allocate_project' | — |
| `POST` | `/api/finance/request-budget` | 'budgets:request_increase' | — |
| `POST` | `/api/finance/approve-budget/:requestId` | 'budgets:approve_request' | treasury:transfer |
| `POST` | `/api/finance/reject-budget/:requestId` | 'budgets:reject_request' | — |
| `POST` | `/api/finance/adjustment` | 'finance:issue_adjustment' | treasury:transfer |
| `POST` | `/api/finance/client-revenue-share` | 'revenue_share:process' | treasury:transfer |
| `POST` | `/api/finance/transactions/:transactionId/reverse` | 'transactions:reverse' | treasury:transfer |
| `GET` | `/api/governance/directives` | 'directives:read' | — |
| `GET` | `/api/governance/decisions` | 'decisions:read' | — |
| `POST` | `/api/governance/directives` | 'directives:dispatch' | — |
| `POST` | `/api/governance/ratify` | 'decisions:ratify' | — |
| `POST` | `/api/governance/transfer-ceo` | 'governance:transfer_ceo' | governance:transfer_ceo |
| `GET` | `/api/governance/access-requests` | 'governance:read' | — |
| `POST` | `/api/governance/access-requests` | 'access_requests:submit' | — |
| `POST` | `/api/governance/access-requests/:id/approve` | 'governance:approve_request' | governance:approve_request |
| `POST` | `/api/governance/access-requests/:id/reject` | 'governance:approve_request' | governance:approve_request |
| `GET` | `/api/health` | Public | — |
| `GET` | `/api/performance` | 'performance:read_all', 'performance:read_team', 'performance:read_own' | — |
| `GET` | `/api/performance/:employeeId` | 'performance:read_all', 'performance:read_team', 'performance:read_own' | — |
| `POST` | `/api/performance/evaluations` | 'performance:evaluate' | — |
| `POST` | `/api/performance/recognition` | 'performance:recognize' | — |
| `POST` | `/api/performance/discipline` | 'performance:discipline' | performance:discipline |
| `GET` | `/api/positions` | 'positions:read' | — |
| `GET` | `/api/positions/:id` | 'positions:read' | — |
| `POST` | `/api/positions/assignments` | 'positions:assign' | positions:assign |
| `POST` | `/api/positions/assignments/:employeeId/remove` | 'positions:assign' | positions:remove |
| `GET` | `/api/projects` | 'projects:read_own', 'projects:read_all' | — |
| `GET` | `/api/projects/:id` | 'projects:read_own', 'projects:read_all' | — |
| `POST` | `/api/projects` | 'projects:create' | — |
| `PATCH` | `/api/projects/:id` | 'projects:update' | — |
| `POST` | `/api/projects/:id/milestones` | 'milestones:create' | — |
| `PATCH` | `/api/projects/:id/milestones/:milestoneId` | 'milestones:update' | — |
| `POST` | `/api/projects/:id/assign-team` | 'projects:assign_team' | — |
| `GET` | `/api/rbac/sod-rules` | 'governance:read', 'audit_logs:read', 'roles:read' | — |
| `GET` | `/api/rbac/approvals/inbox` | Authenticated | — |
| `GET` | `/api/rbac/approvals/mine` | 'approvals:read', 'approvals:create' | — |
| `POST` | `/api/rbac/approvals` | Authenticated | approvals:decide |
| `POST` | `/api/rbac/approvals/:id/approve` | Authenticated | approvals:decide |
| `POST` | `/api/rbac/approvals/:id/reject` | Authenticated | approvals:decide |
| `POST` | `/api/rbac/approvals/escalate-sweep` | 'governance:approve_request', 'audit_logs:read' | approvals:decide |
| `GET` | `/api/rbac/delegations/mine` | Authenticated | — |
| `GET` | `/api/rbac/delegations` | 'delegations:read_all', 'permissions:read', 'audit_logs:read' | — |
| `POST` | `/api/rbac/delegations` | 'delegations:create', 'permissions:delegate' | delegations:create |
| `POST` | `/api/rbac/delegations/:id/approve` | 'delegations:approve' | delegations:approve |
| `POST` | `/api/rbac/delegations/:id/revoke` | Authenticated | delegations:revoke |
| `POST` | `/api/rbac/delegations/expire-sweep` | 'delegations:manage_policy', 'delegations:revoke' | delegations:revoke |
| `GET` | `/api/rbac/me/permissions` | Authenticated | — |
| `GET` | `/api/rbac/delegatable-permissions` | 'delegations:create', 'permissions:delegate' | — |
| `GET` | `/api/rbac/permissions` | 'permissions:read' | — |
| `GET` | `/api/rbac/role-templates` | 'roles:read', 'roles:manage_templates' | — |
| `POST` | `/api/rbac/roles/from-template/:code` | 'roles:create' | roles:create |
| `GET` | `/api/rbac/roles` | 'roles:read' | — |
| `GET` | `/api/rbac/roles/:id` | 'roles:read' | — |
| `GET` | `/api/rbac/roles/:id/versions` | 'roles:read_versions', 'roles:read' | — |
| `POST` | `/api/rbac/roles` | 'roles:create' | roles:create |
| `POST` | `/api/rbac/roles/:id/clone` | 'roles:clone', 'roles:create' | roles:update |
| `PATCH` | `/api/rbac/roles/:id/activate` | 'roles:activate', 'roles:update' | roles:update |
| `PATCH` | `/api/rbac/roles/:id/deactivate` | 'roles:activate', 'roles:update' | roles:update |
| `GET` | `/api/rbac/users/:employeeId/role-assignments` | 'roles:read_assignments', 'users:assign_role' | — |
| `POST` | `/api/rbac/system-root/verify` | 'system:root' | system:root |
| `PATCH` | `/api/rbac/roles/:id` | 'roles:update' | roles:update |
| `DELETE` | `/api/rbac/roles/:id` | 'roles:delete' | roles:delete |
| `PUT` | `/api/rbac/roles/:id/permissions` | 'roles:update' | roles:update |
| `POST` | `/api/rbac/roles/:id/permissions` | 'roles:update' | roles:update |
| `DELETE` | `/api/rbac/roles/:id/permissions/:permissionId` | 'roles:update' | roles:update |
| `GET` | `/api/rbac/users/:employeeId/permissions` | 'users:assign_role', 'permissions:delegate' | — |
| `POST` | `/api/rbac/users/:employeeId/direct-permissions` | 'permissions:delegate' | permissions:grant_direct |
| `DELETE` | `/api/rbac/users/:employeeId/direct-permissions/:permissionId` | 'permissions:delegate', 'users:assign_role' | permissions:grant_direct |
| `POST` | `/api/rbac/users/:employeeId/roles` | 'users:assign_role' | users:assign_role |
| `DELETE` | `/api/rbac/users/:employeeId/roles/:roleId` | 'users:assign_role' | users:assign_role |
| `GET` | `/api/rbac/users/:employeeId/effective` | 'permissions:read', 'users:assign_role', 'audit_logs:read' | — |
| `POST` | `/api/rbac/users/:employeeId/denials` | 'permissions:deny_direct' | permissions:deny_direct |
| `DELETE` | `/api/rbac/denials/:denialId` | 'permissions:deny_direct' | permissions:deny_direct |
| `GET` | `/api/rbac/security-sessions/mine` | 'sessions:read', 'audit_logs:read' | — |
| `GET` | `/api/rbac/security-sessions` | 'sessions:read', 'audit_logs:read' | — |
| `POST` | `/api/rbac/security-sessions/:id/revoke` | 'sessions:revoke', 'governance:approve_request' | sessions:revoke |
| `POST` | `/api/rbac/security/mfa/enroll` | 'mfa:manage', 'mfa:enforce' | — |
| `POST` | `/api/rbac/security/mfa/verify` | 'mfa:manage', 'mfa:enforce' | — |
| `GET` | `/api/rbac/access-reviews` | 'access_reviews:read', 'governance:read', 'audit_logs:read' | — |
| `POST` | `/api/rbac/access-reviews` | 'access_reviews:create', 'governance:approve_request' | governance:approve_request |
| `POST` | `/api/rbac/access-reviews/:id/decide` | 'access_reviews:certify', 'governance:approve_request' | governance:approve_request |
| `GET` | `/api/rbac/xp-ledger/mine` | 'xp:read_own', 'xp:read_all', 'xp:read_ledger' | — |
| `GET` | `/api/rbac/xp-ledger/:employeeId` | 'xp:read_own', 'xp:read_team', 'xp:read_all', 'xp:read_ledger' | — |
| `POST` | `/api/rbac/xp-ledger/award` | 'xp:award', 'xp:adjust' | — |
| `POST` | `/api/rbac/xp-ledger/:entryId/reverse` | 'xp:adjust' | — |
| `POST` | `/api/users/:employeeId/suspend` | 'users:suspend', 'employees:suspend' | users:suspend |
| `POST` | `/api/users/:employeeId/unsuspend` | 'users:reactivate', 'employees:suspend' | users:reactivate |
| `POST` | `/api/users/:employeeId/demote` | 'users:demote', 'employees:suspend' | users:demote |
| `POST` | `/api/users/:employeeId/reset-password` | 'users:reset_password' | users:reset_password |
| `GET` | `/api/users/security/mfa-overview` | 'mfa:manage', 'governance:read', 'audit_logs:read' | — |
| `POST` | `/api/users/:employeeId/mfa/reset` | 'mfa:manage' | mfa:manage |
| `POST` | `/api/users/:employeeId/sessions/revoke` | 'sessions:revoke', 'mfa:manage' | mfa:manage |
| `GET` | `/api/reports` | 'reports:read_standard', 'reports:triage', 'grievances:read_confidential' | — |
| `GET` | `/api/reports/:id` | 'reports:read_standard', 'reports:triage', 'grievances:read_confidential' | — |
| `POST` | `/api/reports` | 'reports:create', 'grievances:submit_confidential' | — |
| `PATCH` | `/api/reports/:id/status` | 'reports:triage' | — |
| `POST` | `/api/reports/:id/forward` | 'reports:forward' | — |
| `PATCH` | `/api/reports/:id/confidential` | 'grievances:adjudicate_confidential' | grievances:adjudicate_confidential |
| `GET` | `/api/tasks` | 'tasks:read_own', 'tasks:read_team', 'tasks:read_all' | — |
| `GET` | `/api/tasks/:id` | 'tasks:read_own', 'tasks:read_team', 'tasks:read_all' | — |
| `POST` | `/api/tasks` | 'tasks:create_personal', 'tasks:create_assign' | — |
| `PATCH` | `/api/tasks/:id/status` | 'tasks:update_status', 'tasks:approve' | — |
| `POST` | `/api/tasks/:id/approve` | 'tasks:approve' | — |
| `POST` | `/api/tasks/:id/reject` | 'tasks:reject' | — |
| `POST` | `/api/tasks/:id/reassign` | 'tasks:reassign' | — |
| `PATCH` | `/api/tasks/:id/checklist/:itemId` | 'tasks:toggle_checklist' | — |
| `POST` | `/api/tasks/:id/submissions` | 'tasks:submit_work' | — |
| `POST` | `/api/tasks/:id/comments` | 'tasks:comment' | — |
| `GET` | `/api/teams` | 'teams:read_own', 'teams:read_all' | — |
| `GET` | `/api/teams/:id` | 'teams:read_own', 'teams:read_all' | — |
| `POST` | `/api/teams` | 'teams:create' | — |
| `PATCH` | `/api/teams/:id` | 'teams:update' | — |
| `POST` | `/api/teams/:id/members` | 'teams:manage_members' | — |
| `DELETE` | `/api/teams/:id/members/:employeeId` | 'teams:manage_members' | — |
