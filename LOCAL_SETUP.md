# Local Development Setup — Pointfex ERP (`v3.13.0`)

Follow these steps to run **Pointfex ERP** locally on Linux/macOS/WSL.

---

## 1. Prerequisites

- **Node.js** `20+` and **npm** `10+`
- **PostgreSQL 15+** (local Docker/Postgres or a Neon branch)
- **Git**

---

## 2. Environment Configuration

### Backend (`backend/.env`)
Copy the template and fill in your local values (never commit `.env` files):

```bash
cp backend/.env.example backend/.env
```

Required / recommended variables in `backend/.env`:
- `NODE_ENV="development"`
- `PORT=3000`
- `DATABASE_URL` — PostgreSQL connection string
- `DIRECT_URL` — Direct PostgreSQL connection string (required for Neon migrations)
- `JWT_SECRET` — At least 32 random characters
- `CORS_ORIGIN="http://localhost:5173"`
- `FRONTEND_URL="http://localhost:5173"`
- `LOGIN_ALLOWLIST_REQUIRED="true"`
- `TEMP_PASSWORD_TTL_HOURS="24"`

#### Email Delivery (Choose One)
- **Option A — Gmail SMTP (recommended when no custom domain is verified):**
  1. Enable 2-Step Verification on your Google account and generate a **16-character App Password**.
  2. Set in `backend/.env`:
     ```env
     SMTP_HOST="smtp.gmail.com"
     SMTP_PORT="587"
     SMTP_SECURE="false"
     SMTP_USER="your-sender@gmail.com"
     SMTP_PASS="your-16-char-app-password"
     MAIL_FROM="Pointfex ERP <your-sender@gmail.com>"
     ```
- **Option B — Resend API (requires a verified domain in Resend):**
  ```env
  RESEND_API_KEY="re_..."
  MAIL_FROM="Pointfex ERP <no-reply@yourdomain.com>"
  ```

### Frontend (`frontend/.env`)
```bash
cp frontend/.env.example frontend/.env
```
Ensure `VITE_API_URL` points to your backend (or leave default `/api` when using the Vite dev proxy).

---

## 3. Install Dependencies & Initialize Database

```bash
# Backend dependencies + Prisma client + migrations
cd backend
npm install
npx prisma generate
npx prisma migrate deploy

# Optional: seed local development database (refuses to run on remote DB unless ALLOW_DEMO_SEED=true)
npm run prisma:seed
cd ..

# Frontend dependencies
cd frontend
npm install
cd ..
```

---

## 4. Start the Application Locally

### Option A: One-command local launcher
```bash
./start-local.sh
```

### Option B: Separate terminals
**Terminal 1 — Backend API (`http://localhost:3000`):**
```bash
cd backend
npm run start:dev
```

**Terminal 2 — Frontend UI (`http://localhost:5173`):**
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 5. Run Full Verification Before Committing

```bash
npm run verify:all
```

This runs:
1. `backend`: `nest build` + full `jest` suite
2. `frontend`: `tsc --noEmit` + `oxlint` + `node tests/run.mjs` + `vite build`

---

## 6. Troubleshooting

- **`Invitation not delivered` with Resend:** `onboarding@resend.dev` only sends to your own Resend account email. Switch to **Gmail SMTP** (Section 2, Option A) or verify a custom domain in Resend.
- **Prisma client out of sync:** Run `cd backend && npx prisma generate`.
- **Port 3000 or 5173 already in use:** Stop the previous `node` / `vite` process (`pkill -f "nest|vite"`) and restart.

