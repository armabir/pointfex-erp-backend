# Pointfex ERP Vercel Deployment Guide

## 1. Architecture Overview
Pointfex ERP runs as two interconnected Vercel projects:
1. **Frontend (`frontend/`)**: Static SPA built with Vite and React. Rewrites `/(.*)` to `/index.html` (no permanent root redirects). Static assets in `/assets` cached with `max-age=31536000, immutable`, while `index.html` is served with `no-cache, no-store`. All `/api/(.*)` requests rewrite to the backend origin.
2. **Backend (`backend/`)**: NestJS serverless application deployed with `@vercel/node` (`api/index.ts`). Bundles Prisma Client via `includeFiles: ["node_modules/.prisma/client/**"]`.
3. **Database (Neon PostgreSQL)**: Serverless Postgres with connection pooling (`DATABASE_URL`) and direct access for migrations (`DIRECT_URL`).

---

## 2. Environment Variables Checklist

### Backend Vercel Project
| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon pooled connection string (`postgresql://...?sslmode=require&pgbouncer=true`) |
| `DIRECT_URL` | Yes | Neon non-pooled connection string (`postgresql://...?sslmode=require`) |
| `JWT_SECRET` | Yes | 64+ char random string (`openssl rand -hex 32`) |
| `CEO_EMAIL` | Yes | Email of the fixed CEO matching the `system:root` row |
| `CRON_SECRET` | Yes | Secret token for Vercel Cron sweep (`openssl rand -hex 24`) |
| `CEO_TRANSFER_ENABLED` | Optional | Set to `false` (default) to disable CEO transfer endpoints |
| `GOOGLE_CLIENT_ID` | Optional | OAuth 2.0 Web Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Optional | OAuth 2.0 Client Secret from Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | Optional | Explicit callback URL (e.g. `https://<backend-domain>/api/auth/google/callback`) |
| `RESEND_API_KEY` | Optional | API key for onboarding and invite emails |
| `RESEND_FROM_EMAIL` | Optional | Verified sender address (e.g. `auth@pointfex.com`) |

### Frontend Vercel Project
- Rewrites are configured in `frontend/vercel.json` pointing `/api/(.*)` to your production backend URL. Update `destination` if using a custom backend domain.

---

## 3. Database Migration Deployment (Neon)
Do **NOT** run `prisma migrate dev` or `prisma migrate reset` against production.

To deploy all pending migrations additively to Neon, run this single command:
```bash
cd backend && npx prisma migrate deploy
```
*(Ensure `DATABASE_URL` or `DIRECT_URL` points to your production Neon database when running).*

---

## 4. Google Cloud Console Redirect URI
In Google Cloud Console > **APIs & Services** > **Credentials** > **OAuth 2.0 Client IDs**:
Add under **Authorized redirect URIs**:
```
https://backend-erp-pointfex.vercel.app/api/auth/google/callback
```
*(Replace `backend-erp-pointfex.vercel.app` with your custom backend domain if applicable).*

---

## 5. Automated Cron Sweeper (`/api/cron/sweep`)
Configured in `backend/vercel.json` to execute every 5 minutes:
```json
{
  "crons": [
    {
      "path": "/api/cron/sweep",
      "schedule": "*/5 * * * *"
    }
  ]
}
```
Tasks executed on every sweep:
1. Cancels expired pending requests (VOTE_DEADLINE_DAYS, 7 days default) with an audit event.
2. Auto-revokes expired delegations (`expiresAt <= now`) and marks them `EXPIRED`.
3. Auto-unfreezes accounts whose `frozenUntil` has passed.
4. Cleans up expired sessions and refresh tokens.
5. Verifies the SHA-256 audit log chain tip integrity.
