# Changelog

## Release Candidate 1 (`release-candidate-1`)
- **Auth & Google OAuth**: Fixed `GET /api/auth/google` 302 redirect with PKCE + state + nonce, Vite `/api` proxy navigation, and friendly OAuth error screens.
- **CEO-Only Login Allowlist**: Added `login_allowlist`, `login_blocked_attempts`, `allowlist_email_requests`, default-deny enforcement (`LOGIN_ALLOWLIST_REQUIRED`), and Admin & Governance > **Login access** panel.
- **Allowlist-Driven Onboarding & Resend Mail**: Enforced allowlist-only employee creation, Resend welcome/reset/MFA-reset emails, delivery status tracking, rate-limited resend (`3/hr`), and removed temporary passwords from API responses and UI.
- **Always-MFA & CEO MFA Reset**: Enforced fresh single-use 6-digit TOTP (`X-MFA-Code`) on sensitive/executive mutations, privileged MFA reset rules, Admin & Governance > **Security** tab, and offline `npm run ceo:reset-mfa` CLI.
- **UI/UX & Security Hardening**: Unified **My Account** page, demo-free **LoginPage**, response sanitizer stripping `passwordHash`/`mfaSecret`/`mfaRecoveryCodes`/`temporaryPassword`, `backend/` & `frontend/` folder layout, `/api/health` & `/api/ready`, and updated deployment/security docs.

