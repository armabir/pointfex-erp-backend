-- Pointfex ERP — Least-Privilege Neon Application Role Setup (`pointfex_app`)
-- Execute this script in the Neon Console -> SQL Editor while connected as the
-- database owner role (e.g. `neondb_owner`), AFTER running:
--   npx prisma migrate deploy
-- with owner credentials.
--
-- Connection Architecture:
--   * DATABASE_URL (NestJS runtime, pooled): must connect as `pointfex_app`
--       with `?sslmode=require&pgbouncer=true&connect_timeout=15`
--   * DIRECT_URL (Prisma CLI migrations only, direct): stays on the owner role.
--
-- IMPORTANT: Replace REPLACE_WITH_STRONG_APP_ROLE_PASSWORD before running.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pointfex_app') THEN
    CREATE ROLE pointfex_app
      WITH LOGIN
      PASSWORD 'REPLACE_WITH_STRONG_APP_ROLE_PASSWORD'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$$;

-- Restrict schema access strictly to object lookup (no DDL creation rights)
REVOKE ALL ON SCHEMA public FROM pointfex_app;
GRANT USAGE ON SCHEMA public TO pointfex_app;

-- Grant standard application DML on operational tables and sequence usage
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pointfex_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pointfex_app;

-- Enforce strict append-only permissions on audit logs & immutable financial/XP/history/security ledgers
-- Covers: audit_logs, financial_transactions, xp_ledger_entries, employee_change_history, login_blocked_attempts
-- Operational tables (including login_allowlist, external_identities, allowlist_email_requests,
-- mfa_action_bindings, sensitive_profile_view_tokens) retain SELECT, INSERT, UPDATE, DELETE above.
REVOKE ALL ON TABLE "audit_logs", "financial_transactions", "xp_ledger_entries", "employee_change_history", "login_blocked_attempts" FROM pointfex_app;
GRANT SELECT, INSERT ON TABLE "audit_logs", "financial_transactions", "xp_ledger_entries", "employee_change_history", "login_blocked_attempts" TO pointfex_app;

-- Explicitly revoke TRUNCATE, TRIGGER, and REFERENCES privileges across all existing tables
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM pointfex_app;

-- Keep future migration tables & sequences covered automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pointfex_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM pointfex_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pointfex_app;

