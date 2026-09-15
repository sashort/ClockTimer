from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Expected {label} block not found")
    return text.replace(old, new, 1)


app_path = Path("app.js")
app = app_path.read_text()

old_scope = '''    function applyScope(mode, persist = true) {
        const next = mode === "total" ? "total" : "trip";
        clockTimer.percentMode = next;
        $("#scopeToggle").textContent = next === "trip" ? "Trip" : "Total";
        updateSummaryLabels();
        if (persist) safeStorageSet(STORAGE.percentMode, next);
    }
'''
new_scope = '''    function syncScopeUI(persist = false) {
        const actual = clockTimer.percentMode === "total" ? "total" : "trip";
        $("#scopeToggle").textContent = actual === "total" ? "Total" : "Trip";
        updateSummaryLabels();
        if (persist) safeStorageSet(STORAGE.percentMode, actual);
        return actual;
    }

    function applyScope(mode, persist = true) {
        const requested = mode === "total" ? "total" : "trip";
        clockTimer.percentMode = requested;
        return syncScopeUI(persist);
    }
'''
app = replace_once(app, old_scope, new_scope, "scope")

old_events = '''    for (const eventName of ["tick", "start", "stop", "clear", "goalChange", "percentModeChange"]) {
        clockTimer.addEventListener(eventName, updateSummaryValues);
    }

    clockTimer.addEventListener("connect", () => setOffline(false));
'''
new_events = '''    for (const eventName of ["tick", "start", "stop", "clear", "goalChange"]) {
        clockTimer.addEventListener(eventName, updateSummaryValues);
    }

    clockTimer.addEventListener("percentModeChange", () => {
        syncScopeUI(true);
        updateSummaryValues();
    });

    clockTimer.addEventListener("connect", () => setOffline(false));
'''
app = replace_once(app, old_events, new_events, "summary event")
app_path.write_text(app)

css_path = Path("app.css")
css = css_path.read_text()

old_notch = '''.main-menu::before {
    content: "";
    position: absolute;
    top: -10px;
    left: 14px;
    width: 18px;
    height: 18px;
    border-top: 1px solid rgb(255 255 255 / 70%);
    border-left: 1px solid rgb(255 255 255 / 70%);
    background: rgb(4 30 66 / 94%);
    transform: translateX(-50%) rotate(45deg);
    pointer-events: none;
}
'''
new_notch = '''.main-menu::before,
.main-menu::after {
    content: "";
    position: absolute;
    left: 14px;
    width: 0;
    height: 0;
    transform: translateX(-50%);
    pointer-events: none;
}

.main-menu::before {
    top: -14px;
    border-left: 13px solid transparent;
    border-right: 13px solid transparent;
    border-bottom: 14px solid rgb(255 255 255 / 78%);
}

.main-menu::after {
    top: -11px;
    border-left: 11px solid transparent;
    border-right: 11px solid transparent;
    border-bottom: 12px solid rgb(4 30 66 / 96%);
}
'''
css = replace_once(css, old_notch, new_notch, "menu notch")

old_button_end = '''    text-align: left;
    font-size: 18px;
}

.main-menu button::before {
'''
new_button_end = '''    text-align: left;
    font-size: 18px;
}

.main-menu button[hidden] {
    display: none;
}

.main-menu button::before {
'''
css = replace_once(css, old_button_end, new_button_end, "hidden menu button")

old_logout = '.main-menu .logout-button { color: #ff554d; }\n'
new_logout = '''.main-menu .logout-button { color: var(--wm-white); }
.main-menu .logout-button::before { background: #ff554d; }
'''
if old_logout in css:
    css = css.replace(old_logout, new_logout, 1)
elif new_logout not in css:
    raise SystemExit("Expected logout color block not found")

css_path.write_text(css)
