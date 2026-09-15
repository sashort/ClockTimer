from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Expected {label} block not found")
    return text.replace(old, new, 1)

# ClockTimer hand/tick fade timing
clock_path = Path("ClockTimer.js")
clock = clock_path.read_text()
clock = clock.replace('''                        750ms;\n\n                    transition-timing-function:\n                        linear, linear;\n                }\n\n                #tick-marks {''', '''                        1500ms;\n\n                    transition-timing-function:\n                        linear, linear;\n                }\n\n                #tick-marks {''', 1)
clock = clock.replace('''                        750ms;\n\n                    transition-timing-function:\n                        linear, linear;\n\n                    pointer-events:''', '''                        1500ms;\n\n                    transition-timing-function:\n                        linear, linear;\n\n                    pointer-events:''', 1)
if clock.count('1500ms;') < 2:
    raise SystemExit("Expected both hand and tick fade durations to be 1500ms")
clock_path.write_text(clock)

# App grayscale transition duration is controlled per state.
css_path = Path("app.css")
css = css_path.read_text()
css = replace_once(
    css,
    '    transition: filter 180ms linear;\n',
    '    transition: filter var(--app-grayscale-ramp, 2000ms) linear;\n',
    "app grayscale transition"
)
css_path.write_text(css)

# Connection/login timing behavior.
app_path = Path("app.js")
app = app_path.read_text()
app = replace_once(
    app,
    '''    let loginPromptTimeout;\n    let grayscaleReleaseTimeout;\n''',
    '''    let loginPromptTimeout;\n    let grayscaleReleaseTimeout;\n    let loginPending = false;\n\n    const STARTUP_CONNECTION_DELAY = 2000;\n    const STARTUP_GRAYSCALE_RAMP = 2000;\n    const LOGIN_GRAYSCALE_RAMP = 750;\n''',
    "timing declarations"
)

old_set_offline = '''    function setOffline(offline) {\n        clearTimeout(loginPromptTimeout);\n        clearTimeout(grayscaleReleaseTimeout);\n        loginPromptTimeout = undefined;\n        grayscaleReleaseTimeout = undefined;\n\n        app.dataset.state = offline ? "offline" : (clockTimer.status === "running" ? "running" : "ready");\n        syncConnectionUI(!offline);\n\n        if (offline) {\n            app.classList.add("is-offline");\n            loginPromptTimeout = setTimeout(() => {\n                loginPromptTimeout = undefined;\n                if (!clockTimer.connected && !loginDialog.open) loginDialog.showModal();\n            }, 1000);\n            return;\n        }\n\n        if (loginDialog.open) loginDialog.close();\n        if (!app.classList.contains("is-offline")) return;\n\n        grayscaleReleaseTimeout = setTimeout(() => {\n            grayscaleReleaseTimeout = undefined;\n            if (clockTimer.connected) app.classList.remove("is-offline");\n        }, 1000);\n    }\n'''
new_set_offline = '''    function setOffline(offline, { login = false, startup = false } = {}) {\n        clearTimeout(loginPromptTimeout);\n        clearTimeout(grayscaleReleaseTimeout);\n        loginPromptTimeout = undefined;\n        grayscaleReleaseTimeout = undefined;\n\n        app.dataset.state = offline ? "offline" : (clockTimer.status === "running" ? "running" : "ready");\n        syncConnectionUI(!offline);\n\n        if (offline) {\n            app.style.setProperty("--app-grayscale-ramp", `${STARTUP_GRAYSCALE_RAMP}ms`);\n            app.classList.add("is-offline");\n            loginPromptTimeout = setTimeout(() => {\n                loginPromptTimeout = undefined;\n                if (!clockTimer.connected && !loginDialog.open) loginDialog.showModal();\n            }, STARTUP_CONNECTION_DELAY);\n            return;\n        }\n\n        if (loginDialog.open) loginDialog.close();\n        if (!app.classList.contains("is-offline")) return;\n\n        const ramp = login ? LOGIN_GRAYSCALE_RAMP : STARTUP_GRAYSCALE_RAMP;\n        const delay = startup ? STARTUP_CONNECTION_DELAY : 0;\n        app.style.setProperty("--app-grayscale-ramp", `${ramp}ms`);\n\n        grayscaleReleaseTimeout = setTimeout(() => {\n            grayscaleReleaseTimeout = undefined;\n            if (!clockTimer.connected) return;\n            requestAnimationFrame(() => app.classList.remove("is-offline"));\n        }, delay);\n    }\n'''
app = replace_once(app, old_set_offline, new_set_offline, "setOffline")

old_login = '''        try {\n            const result = await clockTimer.connect(username, password);\n            if (!result?.connected) throw new Error("Login failed.");\n            $("#profileUsername").value = result.user?.username || username;\n            setOffline(false);\n        }\n        catch (failure) {\n            error.textContent = failure?.message || "Unable to login.";\n        }\n'''
new_login = '''        loginPending = true;\n        try {\n            const result = await clockTimer.connect(username, password);\n            if (!result?.connected) throw new Error("Login failed.");\n            $("#profileUsername").value = result.user?.username || username;\n            setOffline(false, { login: true });\n        }\n        catch (failure) {\n            error.textContent = failure?.message || "Unable to login.";\n        }\n        finally {\n            loginPending = false;\n        }\n'''
app = replace_once(app, old_login, new_login, "login submit")

app = replace_once(
    app,
    '    clockTimer.addEventListener("connect", () => setOffline(false));\n',
    '    clockTimer.addEventListener("connect", () => setOffline(false, { login: loginPending }));\n',
    "connect listener"
)
app = replace_once(
    app,
    '    setOffline(!clockTimer.connected);\n',
    '    setOffline(!clockTimer.connected, { startup: true });\n',
    "startup connection state"
)
app_path.write_text(app)
