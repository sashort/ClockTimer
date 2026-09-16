from pathlib import Path

path = Path("app.js")
text = path.read_text(encoding="utf-8")

old = '''    function refreshTripSettingsValues() {
        const active = clockTimer.status === "running";
        const values = {
            "creation-time": active ? formatTripTimeDisplay(clockTimer.creationTime) : "---",
            "scheduled-start": active ? formatTripTimeDisplay(clockTimer.scheduledStart) : "---",
            "actual-start": active ? formatTripTimeDisplay(clockTimer.startTime) : "---",
            "standard-time": active && clockTimer.standardTime ? clockTimer.standardTime : "---"
        };
        $("#tripCreationTime").textContent = values["creation-time"];
        $("#tripScheduledStart").textContent = values["scheduled-start"];
        $("#tripActualStart").textContent = values["actual-start"];
        $("#tripStandardTime").textContent = values["standard-time"];
        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
            button.disabled = !active;
        });
        tripSettingsForm.elements.intervalElapsedBehavior.value = clockTimer.intervalElapsedBehavior;
        tripSettingsForm.elements.autoSyncTripGoal.checked = clockTimer.autoSyncTripGoal;
    }
'''

new = '''    function getTripSettingsPadSnapshot() {
        return tripSettingsPadStack[tripSettingsPadStack.length - 1];
    }

    function getTripSettingsPendingField(snapshot = getTripSettingsPadSnapshot()) {
        if (!snapshot) return undefined;
        if (snapshot.source === "new-trip" || snapshot.source === "standard-time") {
            return "standard-time";
        }
        if (["creation-time", "scheduled-start", "actual-start"].includes(snapshot.source)) {
            return snapshot.source;
        }
        return undefined;
    }

    function formatTripSettingsPendingValue(snapshot) {
        if (!snapshot) return "---";
        if (snapshot.mode === "absolute") {
            const parts = splitAbsoluteDigits(snapshot.pending);
            const date = parseDateInput(snapshot.pendingDate);
            if (!parts || !date) return "---";
            const time = snapshot.meridiem
                ? `${parts.hour}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")} ${snapshot.meridiem}`
                : `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
            const dateText = new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric"
            }).format(date);
            return `${time} · ${dateText}`;
        }
        if (snapshot.mode === "duration") {
            return snapshot.pending ? renderTimeDigits(snapshot.pending) : "---";
        }
        return "---";
    }

    function tripIsLive() {
        return app.dataset.tripState === "running";
    }

    function refreshTripSettingsValues() {
        const live = tripIsLive();
        const snapshot = getTripSettingsPadSnapshot();
        const pendingField = getTripSettingsPendingField(snapshot);
        const values = {
            "creation-time": live ? formatTripTimeDisplay(clockTimer.creationTime) : "---",
            "scheduled-start": live ? formatTripTimeDisplay(clockTimer.scheduledStart) : "---",
            "actual-start": live ? formatTripTimeDisplay(clockTimer.startTime) : "---",
            "standard-time": live && clockTimer.standardTime ? clockTimer.standardTime : "---"
        };

        if (pendingField) {
            values[pendingField] = formatTripSettingsPendingValue(snapshot);
        }

        $("#tripCreationTime").textContent = values["creation-time"];
        $("#tripScheduledStart").textContent = values["scheduled-start"];
        $("#tripActualStart").textContent = values["actual-start"];
        $("#tripStandardTime").textContent = values["standard-time"];
        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
            const field = button.dataset.tripTimeField;
            button.disabled = !live && !(field === "standard-time" && pendingField === "standard-time");
        });
        tripSettingsForm.elements.intervalElapsedBehavior.value = clockTimer.intervalElapsedBehavior;
        tripSettingsForm.elements.autoSyncTripGoal.checked = clockTimer.autoSyncTripGoal;
    }
'''

if old not in text:
    raise SystemExit("refreshTripSettingsValues anchor not found")
text = text.replace(old, new, 1)

old2 = '''    function openTripFieldNumberPad(field) {
        if (clockTimer.status !== "running") return Promise.resolve();
        const absolute = field !== "standard-time";
        return openNumberPad({
            mode: absolute ? "absolute" : "time",
            source: field,
            initialValue: getTripFieldValue(field),
            returnToTripSettings: true
        });
    }
'''

new2 = '''    function openTripFieldNumberPad(field) {
        const snapshot = getTripSettingsPadSnapshot();
        const pendingField = getTripSettingsPendingField(snapshot);

        if (pendingField === field && snapshot) {
            return restoreNumberPadState({
                ...snapshot,
                source: field,
                title: getNumberPadTitle(field),
                returnToTripSettings: true
            });
        }

        if (!tripIsLive()) return Promise.resolve();
        const absolute = field !== "standard-time";
        return openNumberPad({
            mode: absolute ? "absolute" : "time",
            source: field,
            initialValue: getTripFieldValue(field),
            returnToTripSettings: true
        });
    }
'''

if old2 not in text:
    raise SystemExit("openTripFieldNumberPad anchor not found")
text = text.replace(old2, new2, 1)

path.write_text(text, encoding="utf-8")
