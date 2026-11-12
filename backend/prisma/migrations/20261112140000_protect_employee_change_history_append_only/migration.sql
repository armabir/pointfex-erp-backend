-- Protect employee_change_history as strict append-only (block UPDATE, DELETE, TRUNCATE)
DROP TRIGGER IF EXISTS trg_employee_change_history_immutable ON "employee_change_history";
CREATE TRIGGER trg_employee_change_history_immutable
BEFORE UPDATE OR DELETE ON "employee_change_history"
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_employee_change_history_no_truncate ON "employee_change_history";
CREATE TRIGGER trg_employee_change_history_no_truncate
BEFORE TRUNCATE ON "employee_change_history"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_append_only_mutation();

REVOKE TRUNCATE ON "employee_change_history" FROM PUBLIC;

