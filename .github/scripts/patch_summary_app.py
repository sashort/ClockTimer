from pathlib import Path


def one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


p = Path("app.js")
s = p.read_text()

s = one(s,
'''    function syncScopeUI(persist = false) {
        const actual = clockTimer.percentMode === "total" ? "total" : "trip";
        $("#scopeToggle").textContent = actual === "total" ? "Total" : "Trip";
        updateSummaryLabels();
        if (persist) safeStorageSet(STORAGE.percentMode, actual);
        return actual;
    }''',
'''    function syncScopeUI(persist = false) {
        const actual = clockTimer.percentMode === "total" ? "total" : "trip";
        $("#scopeToggle").textContent = actual === "total" ? "Total" : "Trip";
        updateSummaryLabels();
        updateSummaryValues();
        if (persist) safeStorageSet(STORAGE.percentMode, actual);
        return actual;
    }''', "scope refresh")

s = one(s,
'''    function updateSummaryValues() {
        const standard = clockTimer.standardTime || stagedStandardTime;
        $("#standardTimeValue").textContent = typeof standard === "string" && standard ? standard : "---";
        $("#renderedTimeValue").textContent =
            ["running", "stopped"].includes(clockTimer.status)
                ? (clockTimer.renderedTime || "---")
                : "---";
        const goal = Number(clockTimer.renderedPercentGoal);
        $("#goalPercentValue").textContent = Number.isFinite(goal) ? `${Math.round(goal * 100)}%` : "100%";
    }''',
'''    function formatSummaryPercent(value, fallback = "---") {
        const numeric = Number(value);
        return Number.isFinite(numeric)
            ? `${Math.round(numeric * 100)}%`
            : fallback;
    }

    function updateSummaryValues(summary) {
        let snapshot = summary;
        if (!snapshot?.selected) {
            try {
                snapshot = clockTimer.getSummarySnapshot?.(new Date());
            }
            catch {
                snapshot = undefined;
            }
        }

        const scope = clockTimer.percentMode === "total" ? "total" : "trip";
        const selected = snapshot?.[scope] ?? snapshot?.selected;
        const standard = selected?.standardTime ||
            (scope === "trip" ? (clockTimer.standardTime || stagedStandardTime) : undefined);

        $("#standardTimeValue").textContent =
            typeof standard === "string" && standard ? standard : "---";
        $("#renderedTimeValue").textContent =
            typeof selected?.renderedTime === "string" && selected.renderedTime
                ? selected.renderedTime
                : "---";
        $("#currentPercentValue").textContent =
            selected?.available === false
                ? "---"
                : formatSummaryPercent(selected?.countedPercent);
        $("#goalPercentValue").textContent =
            formatSummaryPercent(selected?.percentGoal, "100%");
    }

    function queueSummaryRefresh() {
        queueMicrotask(() => {
            updateSummaryLabels();
            updateSummaryValues();
        });
    }''', "summary renderer")

s = one(s,
'''    for (const eventName of ["tick", "start", "stop", "clear", "goalChange"]) {
        clockTimer.addEventListener(eventName, updateSummaryValues);
    }

    clockTimer.addEventListener("percentModeChange", () => {
        syncScopeUI(true);
        updateSummaryValues();
    });

    clockTimer.addEventListener("connect", () => setOffline(false, { login: loginPending }));
    clockTimer.addEventListener("disconnect", () => setOffline(true));''',
'''    clockTimer.addEventListener("cadenceTick", event => {
        updateSummaryValues(event.detail?.summary);
    });

    const summaryRefreshEvents = [
        "start",
        "stop",
        "cleared",
        "goalChange",
        "renderedPercentGoalChange",
        "renderedTimeModeChange",
        "standardTimeChange",
        "intervalStart",
        "intervalEnd",
        "intervalElapsed",
        "intervalExtended",
        "intervalApprovalToggle",
        "intervalApprovalChange",
        "intervalDelete",
        "goalChangeFailed"
    ];

    for (const eventName of summaryRefreshEvents) {
        clockTimer.addEventListener(eventName, queueSummaryRefresh);
    }

    clockTimer.addEventListener("percentModeChange", () => {
        syncScopeUI(true);
        queueSummaryRefresh();
    });

    clockTimer.addEventListener("connected", () => {
        setOffline(false, { login: loginPending });
        queueSummaryRefresh();
    });
    clockTimer.addEventListener("disconnected", () => {
        setOffline(true);
        queueSummaryRefresh();
    });''', "summary subscriptions")

p.write_text(s)
print("app summary patch complete")
