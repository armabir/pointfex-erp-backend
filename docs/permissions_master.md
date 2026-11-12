# Pointfex ERP: Master Permission Catalog

**Version:** 1.0
**Purpose:** Single source of truth for every permission in the system. The seeder reads this file.

## How to read this file

Every module table has three columns:

| Column | Meaning |
| --- | --- |
| `Code` | Stable technical identifier, `resource:action`. Never rename; deprecate instead. |
| `Name` | Plain-English label shown in the UI. |
| `Critical` | `⚠` means critical: non-delegable, dual approval required, fully audited. Empty means normal. |

**Seeder rules:**
- Parse each `## NN. Title` section as a module (`permission_categories`).
- Parse each table row as one permission.
- Read the `Domains:` line under each module heading to map the module to wildcard domains.
- The seeder must be idempotent: re-running it updates names and flags, and never deletes codes.

---

## A. Authorization model

- **Model:** RBAC + ABAC (resource scope) + temporary delegation.
- **Roles:** database records created at runtime by the CEO. No role name is hardcoded in the authorization engine.
- **Effective permissions:** `(role permissions ∪ direct grants ∪ valid delegations) − explicit denials`, then checked against scope, resource state and policy.

### Scopes

Every role assignment, direct grant and delegation carries one scope.

| Scope | Meaning |
| --- | --- |
| `SELF` | Only the user's own records |
| `ASSIGNED` | Records explicitly assigned to the user |
| `SQUAD` | One or more specific squads |
| `DEPARTMENT` | One or more departments |
| `PROJECT` | One or more specific projects |
| `ORG` | The whole organization |
| `GLOBAL` | All organizations and system-level resources |

Compatibility mapping for legacy codes:

| Legacy suffix | Maps to scope |
| --- | --- |
| `_own` | `SELF` or `ASSIGNED` |
| `_team` | `SQUAD` |
| `_dept` | `DEPARTMENT` |
| `_all` | `ORG` |

---

## B. Mother permission and wildcards

## 00. Mother Permission (CEO only)

Domains: all

| Code | Name | Critical |
| --- | --- | --- |
| `system:root` | Supreme Authority: implicitly grants every current and future permission in every module | ⚠ |

**Rules for `system:root`:**
1. Held only by the CEO.
2. Satisfies every authorization check, including permissions registered in the future.
3. Hidden from the normal role editor.
4. Cannot be edited, deleted, cloned or delegated.
5. Changes hands only through a successful `governance:transfer_ceo`.
6. Its use on ⚠ actions, HR-confidential data and production changes is still audited.
7. The audit log stays append-only, even for the CEO.

### Domain wildcards

A wildcard grants every non-critical permission of the modules in its domain.

| Wildcard | Modules covered |
| --- | --- |
| `admin:*` | 01, 02, 03, 20 |
| `hr:*` | 04, 05, 06, 16, 17 |
| `finance:*` | 06, 07, 08 |
| `engineering:*` | 10, 11, 12, 13, 14, 15 |
| `product:*` | 09 |
| `sales:*` | 18 |
| `ops:*` | 08, 10, 19, 20 |

**Wildcard rules:**
- A wildcard never crosses its domain. A CTO holding `engineering:*` gets nothing from `finance:*`.
- A wildcard does **not** include ⚠ permissions. A role must list each ⚠ code explicitly, unless the role is flagged `include_critical = true` (CEO only by default).
- Some modules appear in two domains (for example 06 is both `hr` and `finance`). Both executives get the non-critical codes. Payroll execution remains split by separation of duties.
- The module-to-domain mapping lives in `permission_categories.domains`, not in code.

---

## 01. Identity & Access

Domains: admin

| Code | Name | Critical |
| --- | --- | --- |
| `roles:create` | Create Custom Roles | |
| `roles:read` | View Roles | |
| `roles:update` | Update Role Permissions | |
| `roles:delete` | Delete Custom Roles | |
| `roles:clone` | Duplicate Role | |
| `roles:activate` | Activate/Deactivate Role | |
| `roles:set_scope` | Limit Role to Dept/Squad/Project | |
| `roles:read_assignments` | View Who Holds Each Role | |
| `roles:read_versions` | View Role Change History | |
| `roles:manage_templates` | Manage Role Templates | |
| `users:provision` | Create User Accounts | |
| `users:read` | View User Accounts | |
| `users:update` | Edit User Accounts | |
| `users:assign_role` | Assign Roles to Users | |
| `users:demote` | Demote / Reset Access | |
| `users:suspend` | Suspend Accounts | |
| `users:reactivate` | Reactivate Accounts | |
| `users:offboard` | Terminate Account & Revoke Everything | ⚠ |
| `users:reset_password` | Reset Password | |
| `users:force_logout` | Kill User Sessions | |
| `permissions:read` | View Permission Catalog | |
| `permissions:register` | Register New Permission Codes | ⚠ |
| `permissions:grant_direct` | Grant Direct Exceptional Permission | |
| `permissions:deny_direct` | Set Explicit Denial | |
| `permissions:read_assignments` | View Effective Permissions of a User | |
| `permissions:approve_elevated` | Approve Elevated Access | |
| `access_requests:submit` | Request Extra Access | |
| `access_reviews:conduct` | Run Periodic Access Review | |
| `sessions:read` | View Active Sessions | |
| `sessions:revoke` | Revoke Sessions | |
| `mfa:manage` | Manage MFA Enrollment | |
| `mfa:enforce` | Enforce MFA Policy | |
| `security_policies:manage` | Manage Auth Policies | ⚠ |
| `service_accounts:manage` | Manage Service Accounts | ⚠ |
| `api_tokens:manage` | Manage API Tokens | |
| `break_glass:use` | Emergency Override Access | ⚠ |
| `sod_rules:manage` | Manage Separation-of-Duties Rules | ⚠ |

## 02. Delegation & Approval Engine

Domains: admin

| Code | Name | Critical |
| --- | --- | --- |
| `delegations:create` | Delegate My Own Powers Temporarily | |
| `delegations:create_on_behalf` | Delegate on Behalf of Others | ⚠ |
| `delegations:read_own` | View Delegations I Created | |
| `delegations:read_received` | View Delegations Given to Me | |
| `delegations:read_all` | View All Delegations | |
| `delegations:approve` | Approve Delegation Requests | |
| `delegations:reject` | Reject Delegation Requests | |
| `delegations:revoke` | Revoke Delegation | |
| `delegations:extend` | Extend Delegation | |
| `delegations:suspend` | Suspend Delegation | |
| `delegations:emergency` | Emergency Temporary Access | ⚠ |
| `delegations:review` | Review Delegation History | |
| `delegations:manage_policy` | Set Max Duration / Non-Delegable List | ⚠ |
| `approvals:create` | Create Approval Request | |
| `approvals:read` | View Approval Requests | |
| `approvals:approve` | Approve Requests | |
| `approvals:reject` | Reject Requests | |
| `approvals:cancel` | Cancel Approval Request | |
| `approvals:delegate` | Delegate Approval Authority | |
| `approvals:escalate` | Escalate Approval | |
| `approval_policies:manage` | Configure Approval Policies | |
| `approval_chains:manage` | Configure Approval Chains | |
| `approval_limits:set` | Set Spending/Approval Limits | ⚠ |

## 03. Corporate Governance

Domains: admin

| Code | Name | Critical |
| --- | --- | --- |
| `governance:read` | View Governance | |
| `governance:approve_request` | Approve Access-Change Requests | |
| `governance:transfer_ceo` | Transfer CEO Authority | ⚠ |
| `governance:manage_structure` | Manage Corporate Structure | |
| `governance:appoint_executive` | Appoint Executives | ⚠ |
| `governance:remove_executive` | Remove Executives | ⚠ |
| `governance:assign_authority` | Assign Executive Authority | |
| `governance:revoke_authority` | Revoke Executive Authority | |
| `governance:manage_succession` | Manage Succession Plan | ⚠ |
| `governance:create_policy` | Create Policies | |
| `governance:update_policy` | Update Policies | |
| `governance:approve_policy` | Approve Policies | |
| `decisions:create` | Create Decisions | |
| `decisions:read` | View Decisions | |
| `decisions:update` | Amend Decisions | |
| `decisions:ratify` | Ratify Decisions | |
| `decisions:revoke` | Revoke Decisions | |
| `directives:dispatch` | Dispatch Directives | |
| `directives:read` | View Directives | |

## 04. Human Resources

Domains: hr

| Code | Name | Critical |
| --- | --- | --- |
| `employees:create` | Onboard Employees | |
| `employees:read_own` | View My Record | |
| `employees:read_directory` | View Employee Directory | |
| `employees:read_sensitive` | View Sensitive Records (SSN/Tax/ID) | ⚠ |
| `employees:read_contract` | View Employment Contracts | |
| `employees:update_own_profile` | Update Own Profile | |
| `employees:update_any` | Update Any Profile | |
| `employees:change_department` | Transfer Between Departments | |
| `employees:change_supervisor` | Change Reporting Manager | |
| `employees:manage_documents` | Manage Employee Documents | |
| `employees:offboard` | Run Termination/Offboarding | ⚠ |
| `employees:archive` | Archive Employee Record | |
| `employees:restore` | Restore Employee Record | |
| `onboarding:manage` | Manage Onboarding Checklists | |
| `positions:read` | View Hierarchy | |
| `positions:manage` | Manage Departments/Positions | |
| `positions:assign` | Assign Titles/Seats | |
| `positions:restructure` | Restructure Organization | ⚠ |
| `headcount:plan` | Plan Headcount & Hiring Budget | |
| `candidates:read` | View Candidates | |
| `candidates:manage` | Manage Postings & Interviews | |
| `candidates:score_interview` | Score Interviews | |
| `candidates:offer` | Issue Job Offers | |
| `candidates:approve_hiring` | Approve Hiring | |
| `promotions:propose` | Propose Promotion | |
| `promotions:approve` | Approve Promotion | ⚠ |
| `skills:manage` | Manage Skills Matrix | |
| `training:read` | View Training Records | |
| `training:assign` | Assign Training | |
| `training:manage` | Manage Training & Certifications | |
| `surveys:manage` | Run Employee Surveys | |
| `performance:evaluate` | Conduct Performance Reviews | |
| `performance:discipline` | Issue Disciplinary Action | ⚠ |
| `performance:recognize` | Issue Recognition | |
| `performance:read_own` | View Own Performance | |
| `performance:read_team` | View Team Performance | |
| `performance:read_all` | View All Performance | |
| `grievances:submit_confidential` | Submit Grievance | |
| `grievances:read_confidential` | View Confidential Grievances | ⚠ |
| `grievances:adjudicate_confidential` | Resolve Grievances | ⚠ |

## 05. Attendance, Leave & Time

Domains: hr

| Code | Name | Critical |
| --- | --- | --- |
| `attendance:check_in` | Clock In | |
| `attendance:check_out` | Clock Out | |
| `attendance:read_own` | View My Attendance | |
| `attendance:read_team` | View Team Attendance | |
| `attendance:read_all` | View Company Attendance | |
| `attendance:correct_own` | Request Correction | |
| `attendance:correct_team` | Correct Team Attendance | |
| `attendance:approve_correction` | Approve Corrections | |
| `shifts:create` | Create Shifts | |
| `shifts:manage` | Manage Shifts / Remote Policy | |
| `shifts:assign` | Assign Shifts | |
| `shifts:read` | View Schedules | |
| `holidays:manage` | Manage Company Holidays | |
| `leave_policies:manage` | Configure Leave Types & Rules | |
| `leaves:request` | Request Leave | |
| `leaves:cancel` | Cancel Leave | |
| `leaves:approve` | Approve Leave | |
| `leaves:reject` | Reject Leave | |
| `leaves:read_own` | View My Leave | |
| `leaves:read_team` | View Team Leave | |
| `leaves:read_all` | View Global Absence Calendar | |
| `leaves:manage_balance` | Adjust Leave Balances | |
| `overtime:request` | Request Overtime | |
| `overtime:approve` | Approve Overtime | |
| `timesheets:create` | Log/Submit Hours | |
| `timesheets:read_own` | View My Timesheets | |
| `timesheets:read_team` | View Team Timesheets | |
| `timesheets:read_all` | View All Timesheets | |
| `timesheets:edit_any` | Correct Anyone's Timesheet | |
| `timesheets:approve` | Approve Timesheets | |
| `timesheets:reject` | Reject Timesheets | |
| `timesheets:mark_billable` | Mark Hours Billable | |
| `time_tracking:start` | Start Timer | |
| `time_tracking:stop` | Stop Timer | |
| `time_tracking:edit_own` | Edit Own Time Logs | |

## 06. Payroll & Compensation

Domains: hr, finance

| Code | Name | Critical |
| --- | --- | --- |
| `payroll_profiles:read` | View Payroll/Tax Profiles | |
| `payroll_profiles:update` | Update Payroll/Tax Profiles | |
| `compensation:read_own` | View My Compensation | |
| `compensation:read_team` | View Team Compensation | |
| `compensation:read_all` | View Company Compensation | |
| `compensation:read_bands` | View Salary Bands | |
| `compensation:set` | Set/Revise Salary | ⚠ |
| `compensation:approve_changes` | Approve Salary Changes | ⚠ |
| `payroll:read_own` | View My Payslips | |
| `payroll:read_all` | View All Payroll | |
| `payroll:calculate` | Calculate Payroll | |
| `payroll:approve_batch` | Approve Payroll Batch | ⚠ |
| `payroll:process_batch` | Execute Payroll Run | ⚠ |
| `payroll:release_payment` | Release Salary Payments | ⚠ |
| `payroll:adjust` | Adjust Payroll | |
| `payroll:reverse` | Reverse Payroll | ⚠ |
| `finance:issue_adjustment` | Issue Global Payroll Adjustments | |
| `deductions:manage` | Manage Deductions | |
| `bonuses:create` | Create Bonuses | |
| `bonuses:approve` | Approve Bonuses | ⚠ |
| `advances:request` | Request Advance/Loan | |
| `advances:approve` | Approve Advance/Loan | |
| `commissions:read_own` | View My Commission | |
| `commissions:calculate` | Calculate/Approve Commissions | |
| `revenue_share:read` | View Revenue Share | |
| `revenue_share:configure` | Configure Revenue Share | |
| `revenue_share:process` | Process Revenue Share | ⚠ |

## 07. Finance, Accounting & Treasury

Domains: finance

| Code | Name | Critical |
| --- | --- | --- |
| `treasury:read` | View Treasury | |
| `treasury:manage` | Manage Treasury Accounts | |
| `treasury:transfer` | Transfer Funds Between Accounts | ⚠ |
| `treasury:withdraw` | Withdraw Funds Externally | ⚠ |
| `treasury:reconcile` | Reconcile Bank Accounts | |
| `bank_accounts:manage` | Manage Bank Accounts | ⚠ |
| `payment_gateways:manage` | Manage Payment Gateways | ⚠ |
| `accounts:manage` | Manage Chart of Accounts | |
| `ledger:read` | View General Ledger | |
| `ledger:create` | Post Journal Entries | |
| `ledger:adjust` | Adjust/Reverse Entries | |
| `ledger:close_period` | Close Fiscal Period | ⚠ |
| `ledger:reopen_period` | Reopen Fiscal Period | ⚠ |
| `cost_centers:manage` | Manage Cost Centers | |
| `currencies:manage` | Manage Currencies & Rates | |
| `tax:read` | View Tax Records | |
| `tax:manage` | Configure & Manage Taxes | |
| `wallets:read_own` | View My Wallet | |
| `wallets:read_all` | View All Wallets | |
| `wallets:credit` | Credit Wallet | |
| `wallets:debit` | Debit Wallet | |
| `transactions:read_own` | View My Transactions | |
| `transactions:read_all` | View Global Ledger | |
| `transactions:approve` | Approve Transactions | |
| `transactions:reverse` | Reverse Transactions | ⚠ |
| `budgets:create` | Create Department/Annual Budgets | |
| `budgets:read` | View Budgets | |
| `budgets:read_dept` | View Department Budget | |
| `budgets:request_increase` | Request Budget Increase | |
| `budgets:read_requests` | View Budget Request Queue | |
| `budgets:approve_request` | Approve Budget Request | |
| `budgets:reject_request` | Reject Budget Request | |
| `budgets:allocate_project` | Allocate Funds to Project | |
| `budgets:allocate_developer` | Disburse to Developer Wallet | |
| `budgets:reallocate` | Reallocate Budget | |
| `budgets:close` | Close Project Budget | |
| `forecast:read` | View Cash-Flow Forecast | |
| `expenses:submit` | Submit Expenses | |
| `expenses:read_own` | View My Expenses | |
| `expenses:read_all` | View All Expenses | |
| `expenses:approve` | Approve Expenses | |
| `expenses:reject` | Reject Expenses | |
| `expenses:reimburse` | Pay Reimbursements | |
| `invoices:create` | Generate Invoices | |
| `invoices:read` | View Invoices | |
| `invoices:update` | Edit Invoices | |
| `invoices:send` | Send Invoices | |
| `invoices:void` | Void Invoices | |
| `invoices:recurring_manage` | Manage Recurring Invoices | |
| `invoices:mark_paid` | Mark Paid | |
| `credit_notes:issue` | Issue Credit Notes/Refunds | |
| `billing:milestone_trigger` | Trigger Milestone Billing | |
| `billing:generate_from_timesheets` | Bill from Approved Hours | |
| `payments:record` | Record Incoming Payments | |
| `reconciliation:perform` | Reconcile Payments | |
| `receivables:manage` | Manage Receivables | |
| `payables:manage` | Manage Payables | |
| `bills:create` | Enter Vendor Bills | |
| `bills:approve` | Approve Vendor Bills | |
| `bills:pay` | Pay Vendor Bills | ⚠ |
| `financial_reports:read` | View Financial Reports | |
| `financial_reports:generate` | Generate P&L / Tax Reports | |
| `financial_reports:export` | Export Financial Statements | |
| `infra_cost:read` | View Cloud/Infra Costs | |

## 08. Procurement, Inventory & Assets

Domains: finance, ops

| Code | Name | Critical |
| --- | --- | --- |
| `vendors:create` | Register Vendors | |
| `vendors:read` | View Vendors | |
| `vendors:update` | Update Vendors | |
| `vendors:approve` | Approve Vendors | |
| `purchase_requests:create` | Request Purchase | |
| `purchase_requests:approve` | Approve Purchase Request | |
| `purchase_orders:create` | Create PO | |
| `purchase_orders:approve` | Approve PO | |
| `purchase_orders:cancel` | Cancel PO | |
| `inventory:create` | Register Inventory | |
| `inventory:read` | View Inventory | |
| `inventory:update` | Update Inventory | |
| `inventory:adjust` | Adjust Quantities | |
| `hardware:create` | Register Hardware | |
| `hardware:read_own` | View My Hardware | |
| `hardware:read` | View Hardware Registry | |
| `hardware:assign` | Assign Hardware | |
| `hardware:transfer` | Transfer Hardware | |
| `hardware:audit` | Audit Hardware | |
| `hardware:retire` | Retire/Write-off Hardware | |
| `licenses:read` | View Licenses | |
| `licenses:manage` | Manage Licenses | |
| `assets:depreciate` | Manage Depreciation | |

## 09. Product Management

Domains: product

| Code | Name | Critical |
| --- | --- | --- |
| `products:create` | Create Products | |
| `products:read` | View Catalog | |
| `products:update` | Edit Products | |
| `products:archive` | Archive Products | |
| `pricing:manage` | Manage Rate Cards/Pricing | |
| `roadmaps:read` | View Roadmaps | |
| `roadmaps:manage` | Manage Roadmaps | |
| `features:propose` | Propose Features | |
| `features:vote` | Vote on Features | |
| `features:prioritize` | Prioritize Features | |
| `features:approve` | Approve Features | |
| `feedback:create` | Submit Feedback | |
| `feedback:read` | View Feedback | |
| `feedback:manage` | Manage Feedback | |
| `product_releases:manage` | Manage Product Releases | |

## 10. Organization & Squads

Domains: ops, engineering

| Code | Name | Critical |
| --- | --- | --- |
| `departments:create` | Create Departments | |
| `departments:read` | View Departments | |
| `departments:update` | Update Departments | |
| `departments:archive` | Archive Departments | |
| `teams:create` | Form Squads | |
| `teams:update` | Update Squads | |
| `teams:manage_members` | Add/Remove Members | |
| `teams:assign_lead` | Assign Squad Lead | |
| `teams:read_own` | View My Squads | |
| `teams:read_all` | View All Squads | |
| `teams:read_capacity` | View Squad Capacity | |
| `teams:transfer` | Transfer Squad Ownership | |
| `teams:archive` | Archive/Disband Squad | |
| `org_chart:read` | View Org Chart | |
| `org_chart:manage` | Edit Org Chart | |
| `resources:allocate` | Allocate Staff Across Projects | |

## 11. Projects & Portfolio

Domains: engineering

| Code | Name | Critical |
| --- | --- | --- |
| `projects:create` | Create Projects | |
| `projects:read_own` | View Assigned Projects | |
| `projects:read_all` | View All Projects | |
| `projects:read_budget` | View Budget & Burn | |
| `projects:read_profitability` | View Margin/Profit | |
| `projects:update` | Update Projects | |
| `projects:assign_team` | Assign Squads | |
| `projects:assign_manager` | Assign PM | |
| `projects:change_owner` | Change Owner | |
| `projects:manage_members` | Manage Members | |
| `projects:manage_access` | Manage Project Access | |
| `projects:manage_settings` | Manage Settings | |
| `projects:manage_templates` | Manage Templates | |
| `projects:manage_risks` | Manage Risk Register | |
| `projects:manage_dependencies` | Manage Dependencies | |
| `projects:approve_scope` | Approve Scope | |
| `projects:approve_changes` | Approve Change Requests | |
| `projects:close` | Close Project | |
| `projects:archive` | Archive Project | |
| `projects:restore` | Restore Project | |
| `projects:delete` | Delete Project | ⚠ |
| `milestones:create` | Create Milestones | |
| `milestones:read` | View Milestones | |
| `milestones:update` | Update Milestones | |
| `milestones:approve` | Approve Milestones | |
| `portfolio:read` | View Portfolio | |
| `portfolio:manage` | Manage Portfolio | |

## 12. Work Management (Jira-style)

Domains: engineering

| Code | Name | Critical |
| --- | --- | --- |
| `epics:create` | Create Epics | |
| `epics:read` | View Epics | |
| `epics:update` | Update Epics | |
| `epics:manage` | Manage Epic Structure | |
| `subtasks:create` | Create Subtasks | |
| `subtasks:manage` | Manage Subtasks | |
| `backlog:read` | View Backlog | |
| `backlog:manage` | Groom Backlog | |
| `backlog:prioritize` | Prioritize Backlog | |
| `sprints:create` | Create Sprints | |
| `sprints:read` | View Sprints & Velocity | |
| `sprints:update` | Edit Sprint | |
| `sprints:manage_backlog` | Manage Sprint Scope | |
| `sprints:start` | Start Sprint | |
| `sprints:complete` | Close Sprint | |
| `retrospectives:manage` | Run Retrospectives | |
| `tasks:create_assign` | Create & Assign Tasks | |
| `tasks:create_personal` | Create Personal Tasks | |
| `tasks:read` | View Tasks (scoped) | |
| `tasks:read_own` | View Assigned Tasks | |
| `tasks:read_team` | View Squad Tasks | |
| `tasks:read_all` | View All Tasks | |
| `tasks:read_confidential` | View Confidential Tasks | |
| `tasks:update` | Edit Task Details | |
| `tasks:update_status` | Move Task on Kanban | |
| `tasks:reassign` | Reassign Tasks | |
| `tasks:set_priority` | Set Priority | |
| `tasks:estimate` | Set Story Points | |
| `tasks:link` | Link Dependencies | |
| `tasks:manage_dependencies` | Manage Dependencies | |
| `tasks:attach` | Attach Files | |
| `tasks:watch` | Watch Tasks | |
| `tasks:bulk_update` | Bulk Edit | |
| `tasks:delete` | Delete Tasks | |
| `tasks:comment` | Comment | |
| `tasks:toggle_checklist` | Toggle Checklist | |
| `tasks:submit_work` | Submit Work | |
| `tasks:approve` | Approve Work (never own work) | |
| `tasks:reject` | Reject Work | |
| `bugs:report` | Report Bugs | |
| `bugs:triage` | Triage/Assign Bugs | |
| `issue_types:manage` | Define Issue Types | |
| `workflows:read` | View Workflows | |
| `workflows:manage` | Customize Workflows | |
| `custom_fields:manage` | Manage Custom Fields | |
| `labels:manage` | Manage Labels/Components | |
| `boards:create` | Create Boards | |
| `boards:read` | View Boards | |
| `boards:update` | Configure Boards | |
| `boards:manage` | Manage Board Settings | |
| `releases:manage` | Plan/Publish Releases | |
| `sla:manage` | Define SLAs | |
| `consultancy:create` | Request Cross-Squad Consultation | |
| `consultancy:read` | View Consultations | |
| `consultancy:manage` | Manage Consultations | |

## 13. Development & DevOps

Domains: engineering

| Code | Name | Critical |
| --- | --- | --- |
| `repositories:create` | Create Repos | |
| `repositories:read` | View Repos | |
| `repositories:manage` | Manage Repos | |
| `repositories:link` | Connect Git Providers | |
| `repositories:archive` | Archive Repos | |
| `branches:create` | Create Branches | |
| `branches:manage` | Manage Branch Rules | |
| `pull_requests:create` | Open PRs | |
| `pull_requests:read` | View PRs | |
| `pull_requests:review` | Review PRs | |
| `pull_requests:approve` | Approve PRs | |
| `pull_requests:merge` | Merge PRs | |
| `code_reviews:manage` | Manage Review Rules | |
| `pipelines:read` | View CI/CD | |
| `pipelines:manage` | Manage CI/CD | |
| `quality_gates:read` | View Quality Gates | |
| `quality_gates:manage` | Configure Quality Gates | |
| `test_runs:read` | View Test Runs | |
| `artifacts:read` | View Artifacts | |
| `artifacts:manage` | Manage Artifacts | |
| `environments:read` | View Environments | |
| `environments:manage` | Manage Environments | |
| `deployments:read` | View Deployments | |
| `deployments:create` | Initiate Deployment | |
| `deployments:approve` | Approve Production Deploy | |
| `deployments:execute` | Execute Deployment | |
| `deployments:rollback` | Roll Back | |
| `feature_flags:manage` | Toggle Feature Flags | |
| `secrets:read` | Read Authorized Secrets | |
| `secrets:manage` | Manage Secrets Vault | ⚠ |
| `infrastructure:read` | View Infrastructure | |
| `infrastructure:manage` | Manage Infrastructure | ⚠ |
| `monitoring:read` | View Monitoring/Logs | |
| `monitoring:manage` | Configure Monitoring | |
| `oncall:manage` | Manage On-Call Rotation | |

## 14. QA & Security

Domains: engineering

| Code | Name | Critical |
| --- | --- | --- |
| `qa:test_plans:read` | View Test Plans | |
| `qa:test_plans:create` | Create Test Plans | |
| `qa:test_plans:manage` | Manage Test Plans | |
| `qa:test_cases:create` | Create Test Cases | |
| `qa:test_cases:execute` | Execute Test Cases | |
| `qa:test_cases:approve` | Approve Results | |
| `qa:bugs:create` | Report QA Bugs | |
| `qa:bugs:manage` | Manage QA Bugs | |
| `qa:release_approval:approve` | Approve QA Release | |
| `security_alerts:create` | Trigger Security Alerts | |
| `security_alerts:read` | View Alerts | |
| `security_alerts:update_status` | Resolve Alerts | |
| `vulnerabilities:read` | View Vulnerabilities | |
| `vulnerabilities:manage` | Manage Vulnerabilities | |
| `security_scans:read` | View Scan Results | |
| `security_scans:execute` | Run Scans | |
| `compliance:assess` | Conduct Security Assessments | |

## 15. IT Operations, Support & Incidents

Domains: engineering

| Code | Name | Critical |
| --- | --- | --- |
| `incidents:create` | Create Incident | |
| `incidents:declare` | Declare Outage | |
| `incidents:read` | View Incidents | |
| `incidents:update` | Update Incident | |
| `incidents:assign` | Assign Responders | |
| `incidents:resolve` | Resolve Incident | |
| `incidents:close` | Close Incident | |
| `incidents:postmortem` | Write Postmortem | |
| `changes:create` | Create Change Request | |
| `changes:approve` | Approve Change | |
| `changes:execute` | Execute Change | |
| `problems:create` | Create Problem Record | |
| `problems:manage` | Manage Root-Cause Analysis | |
| `support:tickets:create` | Open Ticket | |
| `support:tickets:read` | View Tickets | |
| `support:tickets:respond` | Respond to Tickets | |
| `support:tickets:assign` | Assign/Escalate Tickets | |
| `support:tickets:manage` | Manage Tickets | |
| `support:tickets:resolve` | Resolve/Close Tickets | |
| `backups:read` | View Backups | |
| `backups:manage` | Manage Backups & Restore | ⚠ |
| `disaster_recovery:manage` | Manage DR Plan | ⚠ |

## 16. KPI & Performance

Domains: hr

| Code | Name | Critical |
| --- | --- | --- |
| `kpis:create` | Create KPIs | |
| `kpis:read` | View KPI Definitions | |
| `kpis:update` | Edit KPI Formulas | |
| `kpis:archive` | Archive KPI | |
| `kpis:assign` | Assign KPIs | |
| `kpis:set_targets` | Set Targets | |
| `kpis:configure_weights` | Configure Weights | |
| `kpis:submit_evidence` | Submit Evidence | |
| `kpis:review_evidence` | Review Evidence | |
| `kpis:calculate` | Calculate Scores | |
| `kpis:approve_results` | Approve Results | |
| `kpis:override_score` | Override Score (logged) | ⚠ |
| `kpis:read_own` | View My KPIs | |
| `kpis:read_team` | View Team KPIs | |
| `kpis:read_all` | View Company KPIs | |
| `kpis:export` | Export KPI Data | |
| `performance:appeal` | Dispute My Result | |
| `performance:resolve_appeal` | Resolve Disputes | |
| `okrs:create` | Create OKRs | |
| `okrs:manage` | Manage OKRs | |
| `okrs:read` | View OKRs | |
| `okrs:update_progress` | Update Progress | |
| `reviews:create` | Create Reviews | |
| `reviews:submit` | Submit Reviews | |
| `reviews:approve` | Approve Reviews | |
| `reviews:read_own` | View My Reviews | |
| `reviews:read_team` | View Team Reviews | |
| `reviews:read_all` | View All Reviews | |
| `feedback360:submit` | Give 360 Feedback | |
| `feedback360:read` | View 360 Results | |
| `scorecards:manage` | Build Scorecards | |

## 17. XP, Gamification & Rewards

Domains: hr

| Code | Name | Critical |
| --- | --- | --- |
| `xp:read_own` | View My XP | |
| `xp:read_team` | View Team XP | |
| `xp:read_all` | View Everyone's XP | |
| `xp:read_ledger` | View XP Ledger | |
| `xp:manage_rules` | Define XP Rules | |
| `xp:manage_multipliers` | Manage Multipliers | |
| `xp:award` | Award XP Manually | |
| `xp:deduct` | Deduct XP | ⚠ |
| `xp:adjust` | Create Correction Entry | |
| `xp:approve_adjustment` | Approve XP Adjustment | |
| `xp:reverse` | Reverse Mistaken/Fraudulent XP | |
| `xp:freeze` | Freeze XP | |
| `xp:dispute` | Dispute XP | |
| `xp:export` | Export XP Ledger | |
| `levels:read` | View Levels | |
| `levels:manage` | Configure Levels | |
| `achievements:create` | Create Achievements | |
| `achievements:manage` | Manage Achievements | |
| `achievements:award` | Award Achievements | |
| `badges:manage` | Manage Badges | |
| `leaderboards:read` | View Leaderboards | |
| `seasons:manage` | Manage Seasons/Resets | |
| `rewards:create` | Create Rewards | |
| `rewards:manage` | Manage Reward Catalog | |
| `rewards:redeem_own` | Redeem Rewards | |
| `rewards:approve_redemption` | Approve Redemption | |
| `rewards:fulfill` | Fulfill Reward | |
| `xp:convert_to_bonus` | Convert XP to Cash | ⚠ |
| `gamification:manage` | Manage Gamification Settings | |

## 18. CRM & Sales

Domains: sales

| Code | Name | Critical |
| --- | --- | --- |
| `clients:create` | Add Clients | |
| `clients:read_own` | View My Clients | |
| `clients:read_all` | View All Clients | |
| `clients:read_financials` | View Client Billing/Margin | |
| `clients:update` | Edit Clients | |
| `clients:archive` | Archive Clients | |
| `clients:export` | Export Client Data | |
| `clients:delete` | Delete Clients | ⚠ |
| `leads:create` | Create Leads | |
| `leads:manage` | Manage Pipeline | |
| `leads:assign` | Assign Leads | |
| `leads:convert` | Convert to Client | |
| `deals:forecast` | View Sales Forecast | |
| `proposals:create` | Create Proposals | |
| `proposals:read` | View Proposals | |
| `proposals:update` | Edit Proposals | |
| `proposals:send` | Send Proposals | |
| `proposals:approve` | Approve Proposals | |
| `discounts:approve` | Approve Discounts | |
| `contracts:draft` | Draft Contracts/SOWs | |
| `contracts:read` | View Contracts | |
| `contracts:update` | Edit Contracts | |
| `contracts:approve` | Approve Contracts | |
| `contracts:sign` | Countersign Contracts | ⚠ |
| `contracts:renew` | Renew Contracts | |
| `contracts:terminate` | Terminate Contracts | ⚠ |
| `meetings:log` | Log Meetings | |
| `meetings:read` | View Meeting Records | |
| `communications:manage_client` | Manage Client Communications | |
| `client_portal:manage` | Manage Client Portal Access | |
| `sales:reports:read` | View Sales Reports | |

## 19. Communication, Documents & Knowledge

Domains: ops

| Code | Name | Critical |
| --- | --- | --- |
| `announcements:read` | View Announcements | |
| `announcements:create` | Create Announcements | |
| `announcements:update` | Edit Announcements | |
| `announcements:delete` | Delete Announcements | |
| `announcements:global` | Broadcast Company-wide | |
| `announcements:squad` | Broadcast to Squad | |
| `notifications:read_own` | View Notifications | |
| `notifications:manage_own` | Manage Notification Settings | |
| `messages:send` | Send Messages | |
| `messages:read_own` | Read My Messages | |
| `messages:manage_channels` | Manage Channels | |
| `documents:upload` | Upload Files | |
| `documents:read_public` | View Org-Wide Files | |
| `documents:read_team` | View Team Files | |
| `documents:read_confidential` | View Confidential Files | |
| `documents:update` | Replace/Version Files | |
| `documents:manage_versions` | Manage Versions | |
| `documents:classify` | Set Confidentiality | |
| `documents:share` | Share Internally | |
| `documents:share_external` | Share Outside Company | ⚠ |
| `documents:approve` | Approve Documents | |
| `documents:delete` | Delete Files | |
| `wiki:read` | Read Wiki | |
| `wiki:create` | Create Articles | |
| `wiki:write` | Edit Articles | |
| `wiki:approve` | Approve/Publish Articles | |
| `wiki:delete` | Delete Articles | |
| `search:global` | Global Search | |

## 20. Reporting, Audit, Compliance & System

Domains: admin, ops

| Code | Name | Critical |
| --- | --- | --- |
| `reports:create` | Create Reports | |
| `reports:read_standard` | View Standard Reports | |
| `reports:read_confidential` | View Confidential Reports | |
| `reports:triage` | Triage Reports | |
| `reports:forward` | Forward to Executives | |
| `reports:schedule` | Schedule Reports | |
| `reports:export` | Export Reports | |
| `analytics:read` | View Analytics | |
| `analytics:manage_dashboards` | Build/Share Dashboards | |
| `analytics:export` | Export Analytics | |
| `dashboards:read_exec` | View Executive Dashboards | |
| `audit_logs:read` | View Audit Logs | |
| `audit_logs:read_confidential` | View Confidential Audit Logs | ⚠ |
| `audit_logs:export` | Export Audit Logs | |
| `audit_logs:verify` | Verify Log Integrity | |
| `audit:investigate` | Investigate Activities | |
| `audit:manage_cases` | Manage Investigations | |
| `compliance:read` | View Compliance | |
| `compliance:manage` | Manage Compliance | |
| `data_privacy:manage` | Handle Privacy Requests | |
| `data_retention:manage` | Manage Retention Policies | |
| `data_export:approve` | Approve Bulk Export | ⚠ |
| `data:export_bulk` | Bulk Export Data | ⚠ |
| `data:import` | Bulk Import | |
| `data_deletion:approve` | Approve Deletion | ⚠ |
| `data:hard_delete` | Permanently Delete Records | ⚠ |
| `system_settings:update` | Modify Global Settings | ⚠ |
| `integrations:manage` | Manage Third-Party Keys | ⚠ |
| `ip_blocklist:manage` | Manage IP Blocklist | |
| `system_health:read` | View System Health | |
| `system_maintenance:manage` | Manage Maintenance | |

---

## C. Default authority map

These are **seed templates**, not hardcoded roles. The CEO can edit, clone or delete any of them (except the CEO bootstrap role) at runtime.

| Position | Grants | Must not get |
| --- | --- | --- |
| **CEO** | `system:root` (everything, including all ⚠) | Cannot be removed or edited; changes only via `governance:transfer_ceo` |
| **COO** | `ops:*`; `portfolio:read`; approvals in 07/08 | Finance execution, HR confidential |
| **CTO** | `engineering:*`; `infra_cost:read` | Payroll, treasury, grievances |
| **CFO** | `finance:*`; `payroll:calculate`, `payroll:approve_batch` | Deployments, grievances |
| **CHRO** | `hr:*` | Treasury transfer, secrets |
| **CPO** | `product:*`; `feedback:*`; `roadmaps:*`; `features:*` | Finance, HR sensitive |
| **CRO** | `sales:*`; `invoices:create`, `invoices:read`; `pricing:manage` | Payroll, deployments |
| **PM** | Scope `PROJECT`: modules 11, 12; `timesheets:approve`; `budgets:read_dept`; `tasks:approve` | Treasury, HR sensitive |
| **Squad Lead** | Scope `SQUAD`: modules 12, 13 (PR review/approve); `teams:manage_members`; `xp:award` (capped) | Budget allocation |
| **Senior Developer** | `pull_requests:*`, `tasks:*` (own/team), `deployments:read`; may receive delegated `deployments:approve` | Production secrets |
| **Developer** | `tasks:read_own`, `tasks:submit_work`, `tasks:update_status`, `tasks:comment`, `timesheets:create`, `wallets:read_own`, `xp:read_own`, `kpis:read_own` | Anything outside `SELF` / `ASSIGNED` |
| **QA / DevOps / Finance / HR / Sales Officer** | Narrow slices of modules 14 / 13 / 07 / 04 / 18 | All ⚠ |
| **Employee (baseline)** | All `*_own`; `attendance:check_in`, `attendance:check_out`; `leaves:request`; `expenses:submit`; `grievances:submit_confidential`; `notifications:read_own`; `wiki:read`; `search:global` | None |

---

## D. Hard rules (system invariants, not editable roles)

1. `system:root` exists only for the CEO and cannot be delegated or removed except by `governance:transfer_ceo`.
2. Every ⚠ code is non-delegable, needs dual approval (two different people), and is fully audited.
3. A user can delegate only permissions they currently hold, inside the scope they hold.
4. Every delegation has `starts_at` and `expires_at`, a maximum depth of 1, and auto-revokes if the delegator is suspended, demoted, or loses the permission.
5. Nobody approves their own request.
6. Payroll `calculate`, `approve_batch` and `release_payment` must be three different people.
7. Domain wildcards never cross domains. A CTO never inherits `finance:*`.
8. Budget allocation, internal wallet/ledger transaction, and real bank payment (`treasury:transfer`, `treasury:withdraw`) are separate authorities. One never implies another.
9. XP and financial ledgers are append-only. Corrections are reversal entries, never edits or deletes.
10. The audit log is append-only and tamper-evident, even for the CEO.
11. Expiry and revocation are enforced server-side at check time, not only by the frontend or a scheduler.

---

## E. Separation-of-duties seed rules

| Rule | Conflicting actions (must be different people) |
| --- | --- |
| `SOD-PAYROLL` | `payroll:calculate` / `payroll:approve_batch` / `payroll:release_payment` |
| `SOD-PO` | `purchase_orders:create` / `purchase_orders:approve` |
| `SOD-EXPENSE` | `expenses:submit` / `expenses:approve` / `expenses:reimburse` |
| `SOD-INVOICE` | `invoices:create` / `invoices:mark_paid` / `reconciliation:perform` |
| `SOD-BILL` | `bills:create` / `bills:approve` / `bills:pay` |
| `SOD-TASK` | `tasks:submit_work` / `tasks:approve` (same task) |
| `SOD-DEPLOY` | `deployments:approve` / `deployments:execute` (recommended) |
| `SOD-XP` | `xp:adjust` / `xp:approve_adjustment` |
| `SOD-BONUS` | `bonuses:create` / `bonuses:approve` |
| `SOD-SALARY` | `compensation:set` / `compensation:approve_changes` |

---

## F. Totals

- 21 modules (00 to 20), including the mother permission.
- 606 permission codes, with 57 flagged ⚠.
- The catalog is open: new codes are added through `permissions:register` or a new seed entry, with no change to the authorization engine.continue

Decisions:
1. Phase 1 parses docs/permissions_master.md verbatim: 606 codes, 57 ⚠. Do not add codes.
   Update Section F of that file to say 606 codes / 57 ⚠ (the old "~900 / ~70" was a miscount).
2. Keep the existing isSensitive flag as a separate column from the new ⚠ "critical" flag.
   The 21 codes that are sensitive today but not ⚠ must keep their extra audit and
   re-authentication behavior. Do not downgrade any protection silently. List those 21 codes
   in your Phase 1 summary.
3. Add a permission_aliases table (or equivalent) for employees:suspend and
   permissions:delegate so existing users and role grants keep working. Deprecate,
   never delete.
4. Phase 1 only. Additive migrations, an idempotent seeder, and tests. Show me the
   migration SQL and the test results, then stop and wait for my "continue".