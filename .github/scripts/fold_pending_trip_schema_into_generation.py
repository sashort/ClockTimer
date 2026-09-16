from pathlib import Path

# Fold pending-trip fields completely into the fresh database generator.
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

# API-backed UI actions must degrade to local/offline behavior instead of
# creating unhandled promise rejections when the API is unavailable.
app_path = Path('app.js')
app = app_path.read_text()

old = '''        try { await clockTimer.disconnect(); }
        finally { setOffline(true); }
'''
new = '''        try { await clockTimer.disconnect(); }
        catch {}
        finally { setOffline(true); }
'''
if old not in app:
    raise RuntimeError('logout API guard anchor not found')
app = app.replace(old, new, 1)

old = '''    $("#newTripButton").addEventListener("click", () => {
        const preparationPromise = clockTimer.prepareTrip({ timeout: 5000 });
        void openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: stagedStandardTime || clockTimer.standardTime || "",
            preparationPromise
        });
    });

    $("#standardTimeButton").addEventListener("click", () => {
        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || ""
        });
    });

    $("#goalPercentValue").addEventListener("click", () => {
        void openNumberPad({
            mode: "percent",
            source: "percent-goal",
            initialValue: getPercentGoalValue()
        });
    });
'''
new = '''    $("#newTripButton").addEventListener("click", () => {
        let preparationPromise;
        try {
            preparationPromise = Promise.resolve(
                clockTimer.prepareTrip({ timeout: 5000 })
            ).catch(() => ({
                persisted: false,
                pending: true,
                reason: "offline"
            }));
        }
        catch {
            preparationPromise = Promise.resolve({
                persisted: false,
                pending: true,
                reason: "offline"
            });
        }

        void openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: stagedStandardTime || clockTimer.standardTime || "",
            preparationPromise
        }).catch(() => {});
    });

    $("#standardTimeButton").addEventListener("click", () => {
        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || ""
        }).catch(() => {});
    });

    $("#goalPercentValue").addEventListener("click", () => {
        void openNumberPad({
            mode: "percent",
            source: "percent-goal",
            initialValue: getPercentGoalValue()
        }).catch(() => {});
    });
'''
if old not in app:
    raise RuntimeError('number pad API guard anchor not found')
app = app.replace(old, new, 1)

app_path.write_text(app)

print('folded pending-trip schema into database generation and guarded API UI calls')
