from pathlib import Path

path = Path("app.js")
text = path.read_text()

replacements = [
    (
        '''            tripStartsNowState = {
                value,
                label,
                scheduled: false,
                actual: false
            };''',
        '''            tripStartsNowState = {
                value,
                label,
                snapshot: {
                    scheduledStart: values.scheduledStart,
                    startTime: values.startTime
                },
                scheduled: false,
                actual: false
            };'''
    ),
    (
        '''        if (tripStartsNowState.scheduled) values.scheduledStart = tripStartsNowState.value;
        if (tripStartsNowState.actual) values.startTime = tripStartsNowState.value;
        beginTripStartsNowExit();''',
        '''        beginTripStartsNowExit();'''
    ),
    (
        '''    tripSetStartsNowCancel.addEventListener("pointerup", () => {
        if (!tripStartsNowState) return;
        beginTripStartsNowExit();
    });''',
        '''    tripSetStartsNowCancel.addEventListener("pointerup", () => {
        if (!tripStartsNowState) return;
        const values = tripSettingsSession?.values;
        const snapshot = tripStartsNowState.snapshot;
        if (values && snapshot) {
            if (tripStartsNowState.scheduled) {
                values.scheduledStart = snapshot.scheduledStart;
            }
            if (tripStartsNowState.actual) {
                values.startTime = snapshot.startTime;
            }
        }
        beginTripStartsNowExit();
    });'''
    ),
    (
        '''    tripStartNowToggles.forEach(button => {
        button.addEventListener("pointerup", () => {
            if (!tripStartsNowState) return;
            const key = button.dataset.tripStartNowTarget === "scheduled-start"
                ? "scheduled"
                : "actual";
            tripStartsNowState[key] = !tripStartsNowState[key];
            syncTripStartsNowUI();
        });
    });''',
        '''    tripStartNowToggles.forEach(button => {
        button.addEventListener("pointerup", () => {
            if (!tripStartsNowState) return;
            const values = tripSettingsSession?.values;
            const snapshot = tripStartsNowState.snapshot;
            if (!values || !snapshot) return;

            const scheduled =
                button.dataset.tripStartNowTarget === "scheduled-start";
            const key = scheduled ? "scheduled" : "actual";
            const selected = !tripStartsNowState[key];
            tripStartsNowState[key] = selected;

            if (scheduled) {
                values.scheduledStart = selected
                    ? tripStartsNowState.value
                    : snapshot.scheduledStart;
            }
            else {
                values.startTime = selected
                    ? tripStartsNowState.value
                    : snapshot.startTime;
            }

            refreshTripSettingsValues();
        });
    });'''
    )
]

for old, new in replacements:
    if old not in text:
        raise SystemExit("trip-start snapshot patch anchor not found")
    text = text.replace(old, new, 1)

path.write_text(text)
