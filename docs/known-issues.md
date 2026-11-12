# Known Issues & Deferred Items

1. **Inbox `leave_request` backend endpoint**: Leave requests do not yet have a dedicated `/api/leave-requests` backend module; the `leave_request` filter chip is hidden in `UnifiedInboxPage` until built.
2. **Inbox `mention` source**: Derived from `/api/communications/notifications` rather than a dedicated `@mentions` endpoint.
3. **Backend `npm audit` (5 high advisories)**: Transitive/framework advisories in `@nestjs/platform-express`, `multer`, `@prisma/config`, `prisma`, and `deepmerge-ts` (all require major-version upgrades or upstream Nest/Prisma releases; kept pinned to avoid breaking API/ORM contracts).
4. **List virtualization**: Current employee/audit tables use debounced search and pagination/filtering; window virtualization (`@tanstack/react-virtual`) can be added if row counts exceed ~500+ simultaneously rendered rows.

