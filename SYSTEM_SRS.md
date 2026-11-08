# Pointfex ERP — System Requirements Specification (SRS) & Architecture

> **Document Version:** 1.0.0  
> **Last Updated:** November 2026  
> **Target Audience:** Engineering Team, Backend Developers, Leadership, and Course Instructors  
> **Status:** Backend Implementation Specification

---

## 1. Project Overview and Purpose

**Pointfex ERP** is an integrated Enterprise Resource Planning system designed for a simulated software engineering firm, **Pointfex**. The system models the complete operational, financial, engineering, human resource, and executive governance lifecycle of an agile technology company.

The company operates across **6 organizational roles** (Developer, Project Manager, CTO, CFO, CHRO, and CEO), **6 cross-functional engineering squads**, **12 active client and internal software projects**, and a documented 30-person squad staffing model (24 developers and 6 project managers) plus 4 C-Suite executive leaders.

The primary objective of this backend is to provide a robust, relational, scalable RESTful API built on **NestJS**, **TypeScript**, and **Prisma ORM** targeting **PostgreSQL (Neon)** and deployed on **Render**, seamlessly powering the existing React 19 + Vite frontend application.

---

## 2. Technology Stack

- **Runtime & Language:** Node.js (v20+ / v25+) with TypeScript 5.x
- **Backend Framework:** NestJS (Modular Monolith architecture)
- **Database:** PostgreSQL (Cloud Neon Serverless Postgres)
- **ORM & Data Modeling:** Prisma ORM
- **API Architecture:** RESTful HTTP API with standard JSON responses
- **Validation & Transformation:** `class-validator`, `class-transformer`
- **Hosting Target:** Render (Web Service for NestJS, Neon for PostgreSQL)
- **Frontend Target:** Existing React 19 + Vite application (maintained in a separate repository)

---

## 3. System Architecture

The backend follows a **Modular Monolith** architecture. Rather than introducing distributed microservice overhead, all domain boundaries are cleanly isolated as cohesive NestJS modules:

```
backend/
├── prisma/
│   ├── schema.prisma        # Complete relational schema
│   └── seed.ts              # Idempotent Bangladesh-oriented seed script
├── src/
│   ├── common/              # PrismaService, demo identity guard, filters, decorators
│   ├── employees/           # Employee directory, profiles, status
│   ├── positions/           # Organizational positions & assignment history
│   ├── teams/               # Squads, PM position binding, developer memberships
│   ├── projects/            # 12 Projects, milestones, and SRS specs
│   ├── tasks/               # Kanban tasks, checklists, submissions, approvals
│   ├── finance/             # Treasury, wallets, budgets, ledger transactions
│   ├── performance/         # Evaluations, morale scoring, recognition & discipline
│   ├── reports/             # Proposals, general complaints, confidential grievances
│   ├── audit-logs/          # Corporate audit logging stream
│   ├── engineering/         # Code quality gates, security alerts, test runs
│   ├── consultancy/         # External technical consultancy requests
│   ├── governance/          # CEO directives & ratification queue
│   ├── app.module.ts        # Root application module aggregating domain modules
│   └── main.ts              # Bootstrap with global validation, CORS, and prefixes
├── test/                    # Integration and workflow tests
├── SYSTEM_SRS.md            # System requirements specification (this file)
└── package.json
```

---

## 4. Database Entities and Relational Model

The database is designed with clean relational constraints, foreign keys, and indexes:

### Main Entities
1. **Employee (`Employee`)**: Human individuals employed by the company.
2. **Position (`Position`)**: Distinct organizational roles/seats (`CEO`, `CTO`, `CFO`, `CHRO`, `PM-01`..`PM-06`, `DEV-01`..`DEV-24`).
3. **PositionAssignment (`PositionAssignment`)**: Temporal join connecting an employee to a position with `startDate` and optional `endDate`.
4. **Team (`Team`)**: Engineering squads (`Team Alpha` through `Team Foxtrot`) bound to a dedicated PM position.
5. **TeamMembership (`TeamMembership`)**: Developer assignments to teams, capturing lead developer status and membership history.
6. **Project (`Project`)**: Fictional Bangladesh-oriented software projects with budget, timeline, SRS metadata, and milestones.
7. **TeamProject (`TeamProject`)**: Flexible association linking projects to handling teams with assignment history.
8. **ProjectMilestone (`ProjectMilestone`)**: Sprinted deliverables and payouts.
9. **Task (`Task`)**: Work items in Kanban states (`todo`, `in_progress`, `in_review`, `completed`, `blocked`).
10. **TaskChecklistItem (`TaskChecklistItem`)**: Sub-deliverable checkable items on a task.
11. **TaskSubmission (`TaskSubmission`)**: Work submitted by developers with PR links, demo URLs, and notes.
12. **TaskComment (`TaskComment`)**: Review feedback and collaboration comments.
13. **CompanyTreasury (`CompanyTreasury`)**: Singleton financial record tracking initial capital, approved budgets, developer distributions, unallocated reserves, and client revenue.
14. **BudgetRequest (`BudgetRequest`)**: PM-initiated capital increase requests adjudicated by the CFO.
15. **EmployeeWallet (`EmployeeWallet`)**: Individual balance, total earnings, escrow holds, and penalty tallies.
16. **FinancialTransaction (`FinancialTransaction`)**: Double-entry financial audit ledger tracking every balance change.
17. **PerformanceRecord (`PerformanceRecord`)**: CHRO-curated evaluations, scorecards, strengths, and areas for improvement.
18. **Report (`Report`)**: General complaints, project proposals, PM sprint reports, and confidential whistleblower grievances.
19. **AuditLog (`AuditLog`)**: Immutable corporate action log with actor, action code, severity, and payload.
20. **CodeQualityRecord (`CodeQualityRecord`)**: SonarQube-style quality gates and static analysis scores.
21. **SecurityAlert (`SecurityAlert`)**: Vulnerabilities and CVE alerts per project.
22. **TestRun (`TestRun`)**: Automated test suite executions and pass/fail metrics.
23. **ConsultancyRequest (`ConsultancyRequest`)**: Specialist consultancy and technical advisories.
24. **ExecutiveDirective (`ExecutiveDirective`)**: Strategic top-down directives dispatched by executive leadership.
25. **ExecutiveDecision (`ExecutiveDecision`)**: Ratified actions authorizing company decisions.

### Mermaid Entity-Relationship Diagram

```mermaid
erDiagram
    Employee ||--o{ PositionAssignment : "holds"
    Position ||--o{ PositionAssignment : "assigned to"
    Position ||--o| Team : "manages as PM"
    Team ||--o{ TeamMembership : "has members"
    Employee ||--o{ TeamMembership : "belongs to"
    Team ||--o{ TeamProject : "handles"
    Project ||--o{ TeamProject : "assigned to"
    Project ||--o{ ProjectMilestone : "contains"
    Project ||--o{ Task : "has"
    Employee ||--o{ Task : "assigned as developer"
    Employee ||--o{ Task : "created by"
    Task ||--o{ TaskChecklistItem : "checklist"
    Task ||--o{ TaskSubmission : "submissions"
    Task ||--o{ TaskComment : "comments"
    Employee ||--o| EmployeeWallet : "owns"
    EmployeeWallet ||--o{ FinancialTransaction : "records"
    Project ||--o{ FinancialTransaction : "funded by"
    Project ||--o{ BudgetRequest : "requests funds"
    Employee ||--o{ PerformanceRecord : "evaluated in"
    Employee ||--o{ Report : "submits"
    Employee ||--o{ AuditLog : "triggers"
    Project ||--o| CodeQualityRecord : "analyzed by"
    Project ||--o{ SecurityAlert : "flags"
    Project ||--o{ TestRun : "tested in"
    Employee ||--o{ ConsultancyRequest : "requests"
    Project ||--o{ ConsultancyRequest : "consults for"
```

---

## 5. Organizational Design: Employee, Position, and PositionAssignment

A critical architectural requirement is the strict decoupling of **Employee** (the person) and **Position** (the organizational seat):

1. **Positions are Independent and Persistent:**
   - A position exists regardless of whether an individual currently occupies it.
   - Example position codes: `CTO`, `CFO`, `CHRO`, `CEO`, `PM-01` through `PM-06`, `DEV-01` through `DEV-24`.
2. **Temporal Position Assignments:**
   - The `PositionAssignment` table connects an `Employee` with a `Position`.
   - Each assignment records `startDate` and nullable `endDate`.
   - A position can have at most **one active assignment** (`endDate IS NULL`).
   - An employee may hold **multiple positions simultaneously** (e.g. Acting PM and Lead Developer).
   - If an employee departs or changes roles, their assignment is ended (`endDate = now()`), preserving full historical records. Historical records are never deleted.
3. **Application Permissions vs. Organizational Positions:**
   - Position titles and seat codes do not tightly couple to code privileges; role categories map cleanly to application capabilities.

---

## 6. Team and Project Manager (PM) Relationship

1. **Strict 1-to-1 PM Position Binding:**
   - Every team requires exactly one assigned PM position via a non-nullable, unique foreign key: `Team.pmPositionId -> Position.id`.
   - The database constraint guarantees that each PM position can only manage **one active team**.
   - Validations ensure that only positions categorized as `pm` can be referenced as `pmPositionId`.
2. **Personnel Decoupling:**
   - If an employee holding `PM-01` is reassigned or replaced, the team's `pmPositionId` remains unchanged. The new employee simply receives an active `PositionAssignment` to `PM-01`.
3. **Developer Squad Allocation:**
   - Developers are assigned to teams via `TeamMembership` with `isLead: boolean` indicating squad lead developers.
4. **Team and Project Reassignment:**
   - Each of the 6 teams manages 2 active software projects (12 projects total).
   - Projects link to teams through `TeamProject` join mappings, allowing seamless reassignment in future quarters without breaking foreign key integrity.

---

## 7. Company Structure and User Roles

Pointfex ERP features **6 primary operational workspaces**:

| Role | Title & Profile | Primary Responsibilities |
| :--- | :--- | :--- |
| **Developer** | Full-Stack Software Engineer | Executes assigned sprint tasks, submits code PRs and demo links, checks off subtasks, tracks personal wallet earnings, and reports feedback/proposals. |
| **Project Manager (PM)** | Agile Squad Delivery Lead | Manages team backlog, assigns tasks to developers, reviews and approves/rejects submissions, allocates project funds to developers within remaining budget limits, requests budget increases from CFO. |
| **CTO** | Chief Technology Officer | Oversees engineering standards, quality gates, test coverage, security vulnerability triage, cross-squad architecture, project creation, repository configurations, and team personnel assignments. |
| **CFO** | Chief Financial Officer | Governs company treasury (initial capital, unallocated reserves), allocates capital budgets to projects, approves/rejects PM budget requests, issues bonuses/penalties, audits transaction ledger. |
| **CHRO** | Chief Human Resources Officer | Directs employee performance evaluations, attendance, morale tracking, recognition awards, formal disciplinary actions, and adjudicates privileged confidential whistleblower grievances. |
| **CEO** | Chief Executive Officer (Course Instructor) | Strategic command radar over all 4 pillars (Finance, Engineering, People, Governance), ratifies executive decision queues, and issues top-down executive directives. |

---

## 8. Business Rules and Financial Validation

### 8.1 Currency and Financial Architecture
- **Official Currency:** Bangladeshi Taka (**BDT / ৳**).
- **Precision:** Prisma `Decimal` (`Decimal(14, 2)`) is strictly used for all monetary calculations. Floating-point arithmetic is forbidden for financial computations.
- **Double-Entry Financial Ledger:** Every monetary movement (milestone payout, bonus, penalty, advance disbursement, budget allocation) creates a persistent record in `FinancialTransaction`.
- **Atomic Database Transactions:** Multi-entity financial operations (e.g. project budget reduction + developer wallet credit + treasury update) execute inside Prisma interactive transactions (`prisma.$transaction`).

### 8.2 Baseline Demo Balances
- **Initial Capital:** ৳500,000.00
- **Total Approved Project Budgets:** ৳380,000.00
- **Unallocated Treasury Reserves:** ৳120,000.00 (`500,000 - 380,000 = 120,000`)
- **Total Distributed to Developers:** ৳245,600.00
- **Total Client Commercial Revenue:** ৳740,000.00

### 8.3 Invariant Financial Constraints
1. **No Negative Balances:** Wallet balances and treasury reserves cannot be decremented below zero.
2. **PM Budget Allocation Cap:**
   $$\text{Allocated to Developer} \le \text{Project Approved Budget} - \sum \text{Existing Disbursements}$$
   A PM is strictly prohibited from disbursing more money than the project's remaining funds.
3. **CFO Reserve Cap:**
   $$\text{Budget Increase} \le \text{Unallocated Company Reserves}$$
   The CFO cannot allocate or approve budget increases exceeding available liquid reserves.
4. **Idempotent Milestone Payout:**
   A completed task milestone payout cannot be triggered more than once for the same task.
5. **Commercial Revenue Sharing Formula:**
   For commercial client projects, client revenue is partitioned: **50% to client acquisition initiator** and **50% distributed to active squad developers**.

### 8.4 Cross-Role Workflow Invariants
1. **Task Completion Gate:** Developers can transition tasks from `todo` to `in_progress` to `in_review`. Only PMs, CTO, or CEO can transition tasks to `completed`.
2. **Rejection Feedback:** Rejecting a task returns it to `in_progress` and mandates a textual review feedback note.
3. **Privileged Confidential Grievances:** Grievances marked `isConfidential: true` or `confidentialTo: 'chro'|'ceo'` are filtered out from Developer, PM, and CTO views; only authenticated CHRO and CEO roles can retrieve them.

---

## 9. API Endpoint Inventory

All endpoints are prefixed with `/api`.

### Employees & Positions
- `GET /api/employees` — List all active employees with active positions and team memberships.
- `GET /api/employees/:id` — Get single employee profile with wallet and performance.
- `PATCH /api/employees/:id` — Update editable profile fields (skills, bio, avatar, status).
- `GET /api/positions` — List all positions and current assignment status.
- `POST /api/positions/assignments` — Assign employee to position (ends prior active assignment).

### Teams & Projects
- `GET /api/teams` — List all 6 squads with PM details and developer rosters.
- `GET /api/teams/:id` — Get squad details with active projects.
- `POST /api/teams` — Create a new squad.
- `PATCH /api/teams/:id` — Update squad configuration or PM assignment.
- `GET /api/projects` — List all projects with milestones and budget health.
- `GET /api/projects/:id` — Get project details, milestones, and SRS.
- `POST /api/projects` — Create project (CTO/CEO).
- `PATCH /api/projects/:id` — Update project metadata or SRS links.
- `POST /api/projects/:id/milestones` — Add project milestone.
- `PATCH /api/projects/:id/milestones/:milestoneId` — Update milestone status.

### Tasks & Kanban
- `GET /api/tasks` — List tasks with filters (`projectId`, `assigneeId`, `status`, `creatorId`).
- `GET /api/tasks/:id` — Get single task with checklist, submissions, and comments.
- `POST /api/tasks` — Create task (PM, CTO, Developer personal tasks).
- `PATCH /api/tasks/:id/status` — Move task status (enforces role rules).
- `POST /api/tasks/:id/approve` — Approve deliverable & complete task (PM/CTO/CEO).
- `POST /api/tasks/:id/reject` — Reject deliverable with mandatory feedback.
- `POST /api/tasks/:id/reassign` — Reassign task to another developer.
- `PATCH /api/tasks/:id/checklist/:itemId` — Toggle checklist item completion.
- `POST /api/tasks/:id/submissions` — Developer submits PR/demo for review.

### Finance & Treasury
- `GET /api/finance/treasury` — Retrieve corporate treasury snapshot.
- `GET /api/finance/wallets/:employeeId` — Get employee wallet details.
- `GET /api/finance/transactions` — Filterable transaction ledger (CSV/JSON export ready).
- `POST /api/finance/allocate-developer` — PM disburses budget to developer (validated against remaining budget).
- `POST /api/finance/allocate-project` — CFO adjusts project approved budget (validated against reserves).
- `POST /api/finance/request-budget` — PM requests project budget increase from CFO.
- `POST /api/finance/approve-budget/:requestId` — CFO approves budget request.
- `POST /api/finance/reject-budget/:requestId` — CFO rejects budget request.
- `POST /api/finance/adjustment` — Issue discretionary bonus or penalty deduction.

### Performance & HR
- `GET /api/performance` — Roster of performance records across all personnel.
- `POST /api/performance/evaluations` — Record performance evaluation score and tier (CHRO/CEO).
- `POST /api/performance/recognition` — Issue formal recognition citation with optional bonus.
- `POST /api/performance/discipline` — Issue formal disciplinary warning with optional penalty.

### Reports & Grievances
- `GET /api/reports` — Retrieve reports (automatically enforces confidential grievance guard).
- `POST /api/reports` — Submit project idea, general complaint, or confidential grievance.
- `PATCH /api/reports/:id/status` — Triage or resolve report.
- `POST /api/reports/:id/forward` — PM forwards developer idea to C-Level.
- `PATCH /api/reports/:id/confidential` — Adjudicate confidential grievance (CHRO/CEO only).

### Engineering, Governance & Audit
- `GET /api/engineering/quality-gates` — Code quality metrics and static analysis.
- `GET /api/engineering/security-alerts` — Active vulnerabilities and CVE backlog.
- `POST /api/engineering/security-alerts` — Log new security alert (CTO/CEO).
- `PATCH /api/engineering/security-alerts/:id` — Update alert status.
- `GET /api/engineering/test-runs` — Test suite execution results.
- `GET /api/consultancy` — Consultancy requests queue.
- `POST /api/consultancy` — Submit technical advisory request.
- `PATCH /api/consultancy/:id` — Update consultancy status and assigned advisor.
- `GET /api/governance/directives` — Strategic executive directives.
- `POST /api/governance/directives` — Dispatch executive directive (CEO/CTO).
- `POST /api/governance/ratify` — Authorize action in CEO decision queue.
- `GET /api/audit-logs` — Corporate audit stream with keyword and severity filters.

---

## 10. Frontend and Backend Communication

The frontend currently uses reactive in-memory state in `AppContext.tsx`. The API is architected to mirror the existing DTO structures:

1. **Development Demo Identity:**
   - Since JWT authentication is scheduled for a future milestone, incoming requests identify the acting user using HTTP headers:
     - `x-demo-user-id: <employeeId>` (e.g. `emp_dev_01`, `emp_pm_01`, `emp_cto_01`)
     - `x-demo-role: <role>` (e.g. `developer`, `pm`, `cto`, `cfo`, `chro`, `ceo`)
   - An interceptor/guard populates the request context for authorization checks.
2. **CORS Configuration:**
   - Pre-configured to accept requests from the frontend development server (`http://localhost:5173` and `http://127.0.0.1:5173`) and configurable via `CORS_ORIGIN` for Render deployments.
3. **Response Envelope:**
   - Standard HTTP status codes (200, 201, 400, 403, 404, 500) paired with consistent payload schemas.

---

## 11. Environment Variables Setup

Create a `.env` file in the `backend/` directory based on `.env.example`:

```env
# Server Port
PORT=3000

# Node Environment
NODE_ENV=development

# Database Connection URL (PostgreSQL / Neon)
DATABASE_URL="postgresql://username:password@ep-sample-pooler.ap-southeast-1.aws.neon.tech/pointfex_erp?sslmode=require"

# Allowed CORS Origins (comma-separated for multiple)
CORS_ORIGIN="http://localhost:5173,http://127.0.0.1:5173"
```

---

## 12. Database Migration and Seed Instructions

1. **Install Dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

3. **Run Database Migrations (or push schema to Neon):**
   ```bash
   npm run prisma:migrate
   # Or for initial direct schema sync:
   npm run prisma:push
   ```

4. **Seed Database with Realistic Bangladeshi Demo Data:**
   ```bash
   npm run prisma:seed
   ```
   *The seed script is strictly idempotent: it uses stable unique identifiers and upsert operations, allowing safe repeated runs without duplicating records.*

---

## 13. Running the Project Locally

```bash
# Start backend in development watch mode
npm run start:dev

# Run TypeScript compilation check
npm run build

# Run automated tests
npm run test
```

---

## 14. Limitations and Intentionally Postponed Features

1. **Authentication System:**
   - Complete JWT authentication, password hashing, and refresh token rotation are intentionally postponed to a dedicated auth milestone. A development-only demo identity header mechanism (`x-demo-user-id`, `x-demo-role`) is utilized for identity resolution.
2. **Academic Marks Conversion Formula:**
   - Conversion of virtual BDT earnings into academic marks remains under evaluation by course instructors and has not been finalized.
3. **Real-Time WebSockets:**
   - Telemetry waterfall traces and real-time socket events currently use REST polling.
4. **Staffing Model Discrepancy Note:**
   - *Documentation Note:* Early planning drafts loosely referenced 5-developer squads (30 developers total). However, the active frontend prototype and UI specifications explicitly standardize on a **30-person squad staffing model: exactly 24 developers (4 per squad across 6 squads) and 6 project managers**, plus 4 executive C-Suite leaders (34 total personnel). This backend strictly adheres to the active frontend's 24 dev / 6 PM model to prevent breaking UI rendering or team cards.

