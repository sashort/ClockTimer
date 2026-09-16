from pathlib import Path

path = Path('database/create_database.sql')
text = path.read_text()

replacements = [
    (
        "             'standard_time_ms', NEW.`standard_time_ms`,\n             'non_production', NEW.`non_production`,\n             'created_at', NEW.`created_at`",
        "             'standard_time_ms', NEW.`standard_time_ms`,\n             'non_production', NEW.`non_production`,\n             'pending', NEW.`pending`,\n             'client_token', NEW.`client_token`,\n             'created_at', NEW.`created_at`",
        2,
        'NEW trip audit snapshots'
    ),
    (
        "             'standard_time_ms', OLD.`standard_time_ms`,\n             'non_production', OLD.`non_production`,\n             'created_at', OLD.`created_at`",
        "             'standard_time_ms', OLD.`standard_time_ms`,\n             'non_production', OLD.`non_production`,\n             'pending', OLD.`pending`,\n             'client_token', OLD.`client_token`,\n             'created_at', OLD.`created_at`",
        2,
        'OLD trip audit snapshots'
    ),
]

for old, new, expected, label in replacements:
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'{label}: expected {expected} matches, found {count}')
    text = text.replace(old, new)

assert '`pending` TINYINT(1) NOT NULL DEFAULT 0' in text
assert '`client_token` CHAR(36) NULL' in text
assert "'pending', NEW.`pending`" in text
assert "'client_token', NEW.`client_token`" in text
assert "'pending', OLD.`pending`" in text
assert "'client_token', OLD.`client_token`" in text

path.write_text(text)
print('folded pending-trip schema into database generation script')
