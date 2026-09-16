from pathlib import Path

path = Path("app.js")
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
'''    const buttonPressStates = new WeakMap();
    const pointerPressButtons = new Map();
''',
'''    const buttonPressStates = new WeakMap();
    const pointerPressButtons = new Map();
    const tripFieldAttentionAnimations = new WeakMap();
''',
"attention animation state"
)

replace_once(
'''    function openTripSettingsDialog(reason = "number-pad-settings", { duration = 250 } = {}) {
        const existingSession = Boolean(tripSettingsSession);
        if (!existingSession) beginTripSettingsSession();
        refreshTripSettingsValues();
        const opened = openDialogElement(tripSettingsDialog, { duration, reason });
        if (!opened && !existingSession) {
            tripSettingsSession = undefined;
            tripStartsNowState = undefined;
        }
        return opened;
    }
''',
'''    function drawAttentionToTripField(field) {
        if (!field) return false;
        const row = [...tripSettingsDialog.querySelectorAll("[data-trip-time-row]")]
            .find(candidate => candidate.dataset.tripTimeRow === field);
        if (!row) return false;

        tripFieldAttentionAnimations.get(row)?.cancel();
        const style = getComputedStyle(row);
        const baseShadow = style.boxShadow && style.boxShadow !== "none"
            ? style.boxShadow
            : "none";
        const pulseShadow = baseShadow === "none"
            ? "0 0 0 3px rgb(255 194 32 / 58%), 0 0 20px rgb(255 194 32 / 24%)"
            : `${baseShadow}, 0 0 0 3px rgb(255 194 32 / 58%), 0 0 20px rgb(255 194 32 / 24%)`;
        const animation = row.animate([
            { offset: 0, scale: "1", boxShadow: baseShadow },
            { offset: 0.38, scale: "1.012", boxShadow: pulseShadow },
            { offset: 1, scale: "1", boxShadow: baseShadow }
        ], {
            duration: 800,
            easing: "ease-in-out"
        });
        tripFieldAttentionAnimations.set(row, animation);
        animation.finished
            .catch(() => {})
            .finally(() => {
                if (tripFieldAttentionAnimations.get(row) === animation) {
                    tripFieldAttentionAnimations.delete(row);
                }
            });
        return true;
    }

    function openTripSettingsDialog(
        reason = "number-pad-settings",
        { duration = 250, focusField } = {}
    ) {
        const existingSession = Boolean(tripSettingsSession);
        if (!existingSession) beginTripSettingsSession();
        refreshTripSettingsValues();

        if (tripSettingsDialog.open) {
            if (focusField) {
                requestAnimationFrame(() => drawAttentionToTripField(focusField));
            }
            return true;
        }

        const opened = openDialogElement(tripSettingsDialog, { duration, reason });
        if (!opened && !existingSession) {
            tripSettingsSession = undefined;
            tripStartsNowState = undefined;
        }
        if (opened && focusField) {
            tripSettingsDialog.addEventListener("opened", () => {
                drawAttentionToTripField(focusField);
            }, { once: true });
        }
        return opened;
    }
''',
"Trip Settings field attention"
)

replace_once(
'''    $("#standardTimeButton").addEventListener("pointerup", () => {
        if (!tripIsLive() || clockTimer.percentMode === "total") return;
        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || "",
            role: "root",
            workflow: "edit-trip",
            cancelTarget: "home",
            confirmTarget: "home"
        }).catch(() => {});
    });
''',
'''    $("#standardTimeButton").addEventListener("pointerup", () => {
        if (!tripIsLive() || clockTimer.percentMode === "total") return;
        resetTripSettingsNavigation();
        openTripSettingsDialog("summary-standard-time", {
            focusField: "standard-time"
        });
    });
''',
"Standard Time summary navigation"
)

path.write_text(text)
