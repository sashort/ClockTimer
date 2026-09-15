from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Expected {label} block not found")
    return text.replace(old, new, 1)


# App startup/connection visuals.
app_path = Path("app.js")
app = app_path.read_text()

app = replace_once(
    app,
    '''    let timerStartedAt = 0;\n    let timerAccumulated = 0;\n    let timerInterval;\n''',
    '''    let timerStartedAt = 0;\n    let timerAccumulated = 0;\n    let timerInterval;\n    let loginPromptTimeout;\n    let grayscaleReleaseTimeout;\n''',
    "app timer state"
)

app = replace_once(
    app,
    '''    function setOffline(offline) {\n        app.classList.toggle("is-offline", offline);\n        app.dataset.state = offline ? "offline" : (clockTimer.status === "running" ? "running" : "ready");\n        syncConnectionUI(!offline);\n        if (offline && !loginDialog.open) loginDialog.showModal();\n        if (!offline && loginDialog.open) loginDialog.close();\n    }\n''',
    '''    function setOffline(offline) {\n        clearTimeout(loginPromptTimeout);\n        clearTimeout(grayscaleReleaseTimeout);\n        loginPromptTimeout = undefined;\n        grayscaleReleaseTimeout = undefined;\n\n        app.dataset.state = offline ? "offline" : (clockTimer.status === "running" ? "running" : "ready");\n        syncConnectionUI(!offline);\n\n        if (offline) {\n            app.classList.add("is-offline");\n            loginPromptTimeout = setTimeout(() => {\n                loginPromptTimeout = undefined;\n                if (!clockTimer.connected && !loginDialog.open) loginDialog.showModal();\n            }, 1000);\n            return;\n        }\n\n        if (loginDialog.open) loginDialog.close();\n        if (!app.classList.contains("is-offline")) return;\n\n        grayscaleReleaseTimeout = setTimeout(() => {\n            grayscaleReleaseTimeout = undefined;\n            if (clockTimer.connected) app.classList.remove("is-offline");\n        }, 1000);\n    }\n''',
    "setOffline"
)

app = replace_once(
    app,
    '''        if (!clockTimer.connected) {\n            if (!loginDialog.open) loginDialog.showModal();\n            return;\n        }\n''',
    '''        if (!clockTimer.connected) {\n            clearTimeout(loginPromptTimeout);\n            loginPromptTimeout = undefined;\n            if (!loginDialog.open) loginDialog.showModal();\n            return;\n        }\n''',
    "manual login"
)

app_path.write_text(app)


# Default the document to the unresolved/offline visual state.
index_path = Path("index.html")
index = index_path.read_text()
index = replace_once(
    index,
    '<main id="app" class="app" data-state="ready">',
    '<main id="app" class="app is-offline" data-state="offline">',
    "initial app state"
)
index = replace_once(
    index,
    '<button id="profileMenuButton" type="button" data-dialog="profileDialog">Profile</button>',
    '<button id="profileMenuButton" type="button" data-dialog="profileDialog" hidden>Profile</button>',
    "initial profile visibility"
)
index_path.write_text(index)


# Flush the menu left and keep the pointer centered under the 52px hamburger.
css_path = Path("app.css")
css = css_path.read_text()
css = replace_once(
    css,
    '''.main-menu::before,\n.main-menu::after {\n    content: "";\n    position: absolute;\n    left: 14px;\n''',
    '''.main-menu::before,\n.main-menu::after {\n    content: "";\n    position: absolute;\n    left: 26px;\n''',
    "menu pointer position"
)
css = replace_once(
    css,
    '''.main-menu:popover-open {\n    position: fixed;\n    inset: 60px auto auto 12px;\n}\n''',
    '''.main-menu:popover-open {\n    position: fixed;\n    inset: 60px auto auto 0;\n}\n''',
    "menu position"
)
css_path.write_text(css)


# ClockTimer hands stay invisible until their first synchronized timeline position,
# then fade in. If hand animations are stopped, return them to the hidden state.
clock_path = Path("ClockTimer.js")
clock = clock_path.read_text()

transition_block = '''                #tick-marks,\n                #hand-layer,\n                #indicator-ring {\n                    transition-property:\n                        inset;\n\n                    transition-duration:\n                        var(\n                            --clock-timer-ring-resize-duration\n                        );\n\n                    transition-timing-function:\n                        linear;\n                }\n'''
hand_rule = transition_block + '''\n                #hand-layer {\n                    opacity: 0;\n\n                    transition-property:\n                        inset, opacity;\n\n                    transition-duration:\n                        var(\n                            --clock-timer-ring-resize-duration\n                        ),\n                        750ms;\n\n                    transition-timing-function:\n                        linear, linear;\n                }\n'''
clock = replace_once(clock, transition_block, hand_rule, "hand layer transition")

clock = replace_once(
    clock,
    '''            this.#secondHandAnimation =\n                undefined;\n\n            this.#handsStarted =\n                false;\n''',
    '''            this.#secondHandAnimation =\n                undefined;\n\n            if (this.#handLayer) {\n                this.#handLayer.style.opacity =\n                    "0";\n            }\n\n            this.#handsStarted =\n                false;\n''',
    "hand animation stop"
)

clock = replace_once(
    clock,
    '''            this.#handsStarted =\n                true;\n''',
    '''            this.#handsStarted =\n                true;\n\n            requestAnimationFrame(\n                () => {\n                    if (\n                        this.#handsStarted &&\n                        this.isConnected &&\n                        this.#handLayer\n                    ) {\n                        this.#handLayer.style.opacity =\n                            "1";\n                    }\n                }\n            );\n''',
    "hand synchronization reveal"
)

clock_path.write_text(clock)
