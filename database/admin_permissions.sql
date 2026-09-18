-- Run once using a database administrator connection.
-- Seed explicitly with system audit context; existing accounts keep their masks.
USE trip_management;
START TRANSACTION;
SET @audit_user_id = 0, @audit_change_id = UUID(), @audit_sequence = 0, @audit_reversal_of = NULL;
INSERT INTO permissions (value, name, description) VALUES
    (1, 'create_users', 'Create user accounts.'),
    (2, 'modify_users', 'Modify other non-superuser accounts. Own account editing is implicit.'),
    (4, 'superuser', 'All account permissions and guarded raw SQL access.')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);
COMMIT;
SET @audit_user_id = NULL, @audit_change_id = NULL, @audit_sequence = NULL, @audit_reversal_of = NULL;
