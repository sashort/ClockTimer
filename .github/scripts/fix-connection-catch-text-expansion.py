from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)


path = Path("app.js")
app = path.read_text()

old = '''        if (!connectionResumePromise) {
            connectionResumePromise = Promise.resolve()
                .then(() => clockTimer.resumeConnection())
                .catch(() => false)
                .finally(() => {
                    connectionResumePromise = undefined;
                });
        }

        await connectionResumePromise;
'''
new = '''        if (!connectionResumePromise) {
            connectionResumePromise = (async () => {
                try {
                    return await clockTimer.resumeConnection();
                }
                catch {
                    return false;
                }
            })().finally(() => {
                connectionResumePromise = undefined;
            });
        }

        try {
            await connectionResumePromise;
        }
        catch {}
'''
app = replace_once(app, old, new, "explicit connection try/catch")

old = '''    function finishTripStartsNowExit() {
        clearTimeout(tripStartsNowExitTimer);
        if (!tripStartsNowExiting) {
            tripStartsNowExitTimer = undefined;
            return;
        }

        tripStartsNowExitTimer = setTimeout(() => {
            tripStartsNowExitTimer = undefined;
            if (!tripStartsNowExiting) return;
            tripStartsNowExiting = false;
            if (!tripStartsNowState) syncTripStartsNowUI();
        }, TRIP_START_TRANSITION_DURATION);
    }
'''
new = '''    function finishTripStartsNowExit() {
        clearTimeout(tripStartsNowExitTimer);
        tripStartsNowExitTimer = undefined;
        if (!tripStartsNowExiting) return;

        tripStartsNowExiting = false;
        if (!tripStartsNowState) syncTripStartsNowUI();
    }
'''
app = replace_once(app, old, new, "remove post-width text delay")
path.write_text(app)

path = Path("app.css")
css = path.read_text()
old = '''.trip-now-actions.is-selecting .trip-now-start-copy,
.trip-now-actions.is-exiting .trip-now-start-copy {
    width: 0;
    opacity: 0;
}
'''
new = '''.trip-now-actions.is-selecting .trip-now-start-copy {
    width: 0;
    opacity: 0;
}
'''
css = replace_once(css, old, new, "start-copy reverse expansion")
path.write_text(css)
