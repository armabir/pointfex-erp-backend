# Pointfex ERP Security Runbook

## 1. Key & Secret Rotation
1. **JWT_SECRET**: Generate a new 32+ byte random string (`openssl rand -hex 32`), update `.env` on the server, and restart the backend. Existing sessions will be required to re-authenticate.
2. **RESEND_API_KEY**: Create a new key in Resend, update `RESEND_API_KEY` in `.env`, restart backend, then revoke the old key in Resend.
3. **GOOGLE_CLIENT_SECRET**: Rotate in Google Cloud Console > APIs & Services > Credentials, update `.env`, restart backend, then delete the old secret.
4. **Database (`pointfex_app`)**: Rotate the `pointfex_app` role password in Neon SQL Editor (`ALTER ROLE pointfex_app WITH PASSWORD '...';`), update `DATABASE_URL`, and restart backend.

## 2. CEO Lost-Device MFA Recovery (Offline Only)
> **Warning**: `ceo:reset-mfa` bypasses web MFA checks by operating directly against the database with owner credentials. Restrict SSH/server access and never expose this script as an HTTP endpoint.

Run on the backend host:
```bash
npm run ceo:reset-mfa
```
- Requires `CEO_EMAIL` to match the active `system:root` CEO row.
- Prompts for exact confirmation phrase `RESET CEO MFA`.
- Clears `mfaSecret` and `mfaRecoveryCodes`, revokes all active sessions and refresh tokens, sets `mustEnrollMfa = true`, and writes an immutable `AuditLog` entry (`CEO_MFA_OFFLINE_RESET`).

## 3. Incident Response
1. **Compromised Employee Account**: Suspend employee or disable/remove their email in **Admin & Governance > Login access** (immediately revokes sessions and refresh tokens) and reset their MFA/password.
2. **Audit Log Verification**: Run `GET /api/audit-logs/verify` (or open **Audit Trail**) to verify the SHA-256 hash chain has zero breaks.

## 4. Backup & Restore (Neon)
- Neon provides point-in-time recovery (PITR). Before any major migration, create a Neon branch snapshot or logical `pg_dump` using `DIRECT_URL`.
- Never run `prisma migrate reset` or `prisma migrate dev` against production.

## 5. Onboarding & Offboarding Checklist
- **Onboarding**: CEO adds exact verified email to **Login access** -> HR/Admin selects email from approved picker -> Resend emails temporary password -> User sets new password on first login (and enrolls MFA if required or performing sensitive actions).
- **Offboarding**: Suspend/offboard employee -> CEO disables/removes email in **Login access** -> Verify all active sessions revoked.

