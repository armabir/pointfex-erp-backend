# Pointfex ERP — Deployment Guide

## Production URLs

- Frontend: `https://pointfex-frontend.vercel.app`
- Backend: `https://pointfex-backend.vercel.app`
- Health: `https://pointfex-backend.vercel.app/api/health`
- Readiness: `https://pointfex-backend.vercel.app/api/ready`

Pushes to `main` run backend and frontend verification in GitHub Actions. Both Vercel
production projects deploy only after every verification job succeeds. Runtime secrets
live in Vercel and GitHub Actions secrets; real `.env` files are ignored and must never
be committed.

## 1. Local Development
1. Copy `backend/.env.example` -> `backend/.env` and `frontend/.env.example` -> `frontend/.env`.
2. Start PostgreSQL, backend, and frontend:
   ```bash
   ./start-local.sh
   ```
3. Apply migrations and seed once:
   ```bash
   cd backend && npx prisma migrate deploy && SEED_PROFILE=production npm run prisma:seed
   ```

## 2. Docker Compose (VPS)
1. Set production variables (use `backend/.env.production.example` as reference; never use default passwords).
2. Build and start:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
3. Verify `/api/health` and `/api/ready`.

## 3. Neon Production Deployment Order (Exact Sequence)
1. **Build**: `cd backend && npm run build` and `cd frontend && npm run build`.
2. **Apply migrations (owner `DIRECT_URL`)**:
   ```bash
   cd backend && npx prisma migrate deploy
   ```
3. **Seed production baseline once**:
   ```bash
   SEED_PROFILE=production npm run prisma:seed
   ```
   Remove `CEO_INITIAL_PASSWORD` and `SEED_DEFAULT_PASSWORD` from `.env` after seeding.
4. **Create least-privilege runtime role (`pointfex_app`)**:
   - Open Neon Console -> SQL Editor as `neondb_owner`.
   - Execute `backend/scripts/neon-setup-app-role.sql` after replacing `REPLACE_WITH_STRONG_APP_ROLE_PASSWORD`.
5. **Switch runtime `DATABASE_URL`**:
   - Point `DATABASE_URL` to the pooled Neon host using `pointfex_app` with `?sslmode=require&pgbouncer=true&connect_timeout=15`.
   - Keep `DIRECT_URL` on the owner role for future `prisma migrate deploy` runs only.
6. **Verify Resend & Google OAuth**:
   - Verify your sending domain in Resend and set `MAIL_FROM`.
   - Add your production `https://.../api/auth/google/callback` redirect URI in Google Cloud Console.
7. **Enable default-deny allowlist LAST**:
   - Sign in as CEO -> **Admin & Governance > Login access** -> add initial allowed emails.
   - Set `LOGIN_ALLOWLIST_REQUIRED="true"` and restart backend.

## 4. Rollback & Backup Advice
- **Backups**: Use Neon PITR branching or `pg_dump "$DIRECT_URL"` before migrations.
- **Rollback**: Redeploy the previous git tag (`pre-release-baseline` or `release-candidate-1`). Never run `prisma migrate reset` on production.
