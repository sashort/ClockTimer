from pathlib import Path

path = Path("app.js")
text = path.read_text()

old = '''    function finishTripStartsNowExit() {
        clearTimeout(tripStartsNowExitTimer);
        tripStartsNowExitTimer = undefined;
        if (!tripStartsNowExiting) return;
        tripStartsNowExiting = false;
        if (!tripStartsNowState) syncTripStartsNowUI();
    }
'''

new = '''    function finishTripStartsNowExit() {
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

if text.count(old) != 1:
    raise SystemExit(f"Expected one finishTripStartsNowExit block, found {text.count(old)}")

path.write_text(text.replace(old, new))
