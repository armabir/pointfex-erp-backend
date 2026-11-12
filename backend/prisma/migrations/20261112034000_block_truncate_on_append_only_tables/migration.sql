-- Protect append-only ledgers against TRUNCATE at the database engine level
DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON "audit_logs";
CREATE TRIGGER trg_audit_logs_no_truncate
BEFORE TRUNCATE ON "audit_logs"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_financial_transactions_no_truncate ON "financial_transactions";
CREATE TRIGGER trg_financial_transactions_no_truncate
BEFORE TRUNCATE ON "financial_transactions"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_xp_ledger_entries_no_truncate ON "xp_ledger_entries";
CREATE TRIGGER trg_xp_ledger_entries_no_truncate
BEFORE TRUNCATE ON "xp_ledger_entries"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_append_only_mutation();

REVOKE TRUNCATE ON "audit_logs", "financial_transactions", "xp_ledger_entries" FROM PUBLIC;

