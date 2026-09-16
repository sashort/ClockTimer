from pathlib import Path

app = Path("app.js")
text = app.read_text()

old = '''    const CONNECTION_INDICATOR_MINIMUM = 1000;\n    const NUMBER_PAD_LONG_PRESS = 750;'''
new = '''    const CONNECTION_INDICATOR_MINIMUM = 1000;\n    const CONNECTION_CLOUD_FADE_DURATION = 250;\n    const NUMBER_PAD_LONG_PRESS = 750;'''
if text.count(old) != 1:
    raise SystemExit(f"constant marker count={text.count(old)}")
text = text.replace(old, new, 1)

old = '''    function updateNumberPadConnectionStatus(token, status) {\n        const normalized = status === "pending" ? "pending" : normalizedConnectionStatus(status);\n        if (numberPadState?.connectionStatusToken === token) {\n            numberPadState.persistence = normalized;\n            refreshNumberPad();\n        }\n        for (let index = uiReturnStack.length - 1; index >= 0; index -= 1) {\n            const frame = uiReturnStack[index];\n            if (\n                frame?.type === "number-pad" &&\n                frame.state?.connectionStatusToken === token\n            ) {\n                frame.state.persistence = normalized;\n                break;\n            }\n        }\n    }\n\n    async function settleInitialNumberPadConnection(state, preparationPromise) {\n        const startedAt = performance.now();\n        try {\n            await Promise.resolve(preparationPromise);\n        }\n        catch {}\n        const remaining = CONNECTION_INDICATOR_MINIMUM - (performance.now() - startedAt);\n        if (remaining > 0) await wait(remaining);\n        updateNumberPadConnectionStatus(\n            state.connectionStatusToken,\n            clockTimer.networkStatus\n        );\n    }'''
new = '''    function updateNumberPadConnectionStatus(token, status, { presentation } = {}) {\n        const normalized = status === "pending" ? "pending" : normalizedConnectionStatus(status);\n        if (numberPadState?.connectionStatusToken === token) {\n            numberPadState.persistence = normalized;\n            if (presentation) numberPadState.connectionPresentation = presentation;\n            refreshNumberPad();\n        }\n        for (let index = uiReturnStack.length - 1; index >= 0; index -= 1) {\n            const frame = uiReturnStack[index];\n            if (\n                frame?.type === "number-pad" &&\n                frame.state?.connectionStatusToken === token\n            ) {\n                frame.state.persistence = normalized;\n                if (presentation) frame.state.connectionPresentation = presentation;\n                break;\n            }\n        }\n    }\n\n    async function settleInitialNumberPadConnection(state, preparationPromise) {\n        const startedAt = performance.now();\n        try {\n            await Promise.resolve(preparationPromise);\n        }\n        catch {}\n\n        const fadeStartAt = Math.max(\n            startedAt + CONNECTION_INDICATOR_MINIMUM - CONNECTION_CLOUD_FADE_DURATION,\n            performance.now()\n        );\n        const beforeFade = fadeStartAt - performance.now();\n        if (beforeFade > 0) await wait(beforeFade);\n\n        updateNumberPadConnectionStatus(\n            state.connectionStatusToken,\n            clockTimer.networkStatus,\n            { presentation: "handoff" }\n        );\n        await wait(CONNECTION_CLOUD_FADE_DURATION);\n        updateNumberPadConnectionStatus(\n            state.connectionStatusToken,\n            clockTimer.networkStatus,\n            { presentation: "settled" }\n        );\n    }'''
if text.count(old) != 1:
    raise SystemExit(f"connection status block count={text.count(old)}")
text = text.replace(old, new, 1)

old = '''        if (numberPad && numberPadState) {\n            token = numberPadState.connectionStatusToken || ++numberPadConnectionSequence;\n            numberPadState.connectionStatusToken = token;\n            updateNumberPadConnectionStatus(token, "pending");\n        }'''
new = '''        if (numberPad && numberPadState) {\n            token = numberPadState.connectionStatusToken || ++numberPadConnectionSequence;\n            numberPadState.connectionStatusToken = token;\n            updateNumberPadConnectionStatus(\n                token,\n                "pending",\n                { presentation: "retry" }\n            );\n        }'''
if text.count(old) != 1:
    raise SystemExit(f"retry start block count={text.count(old)}")
text = text.replace(old, new, 1)

old = '''        if (token) {\n            updateNumberPadConnectionStatus(token, status);\n        }\n        else {\n            const frame = findUIReturnFrame("number-pad");\n            if (frame?.state) frame.state.persistence = status;\n        }'''
new = '''        if (token) {\n            updateNumberPadConnectionStatus(\n                token,\n                status,\n                { presentation: "settled" }\n            );\n        }\n        else {\n            const frame = findUIReturnFrame("number-pad");\n            if (frame?.state) {\n                frame.state.persistence = status;\n                frame.state.connectionPresentation = "settled";\n            }\n        }'''
if text.count(old) != 1:
    raise SystemExit(f"retry result block count={text.count(old)}")
text = text.replace(old, new, 1)

old = '''            const status = numberPadState.persistence || normalizedConnectionStatus();\n            numberPadSettingsArea.dataset.persistence = status;'''
new = '''            const status = numberPadState.persistence || normalizedConnectionStatus();\n            numberPadSettingsArea.dataset.persistence = status;\n            numberPadSettingsArea.dataset.connectionPhase =\n                numberPadState.connectionPresentation || "settled";'''
if text.count(old) != 1:
    raise SystemExit(f"refresh phase marker count={text.count(old)}")
text = text.replace(old, new, 1)

old = '''            persistence: source === "new-trip"\n                ? "pending"\n                : normalizedConnectionStatus(),\n            connectionStatusToken: ++numberPadConnectionSequence,'''
new = '''            persistence: source === "new-trip"\n                ? "pending"\n                : normalizedConnectionStatus(),\n            connectionPresentation: source === "new-trip"\n                ? "initial"\n                : "settled",\n            connectionStatusToken: ++numberPadConnectionSequence,'''
if text.count(old) != 1:
    raise SystemExit(f"state presentation marker count={text.count(old)}")
text = text.replace(old, new, 1)

app.write_text(text)

css = Path("app.css")
text = css.read_text()

old = '''.number-pad-settings[data-persistence="online"] .number-pad-persistence-badge,\n.number-pad-settings[data-persistence="offline"] .number-pad-persistence-badge {\n    animation: number-pad-cloud-fade-in 250ms linear both;\n}'''
new = '''.number-pad-settings[data-connection-phase="handoff"][data-persistence="online"] .number-pad-persistence-badge,\n.number-pad-settings[data-connection-phase="handoff"][data-persistence="offline"] .number-pad-persistence-badge {\n    animation: number-pad-cloud-fade-in 250ms linear both;\n}'''
if text.count(old) != 1:
    raise SystemExit(f"fade selector block count={text.count(old)}")
text = text.replace(old, new, 1)

pending_svg = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cdefs%3E%3Cmask id='q'%3E%3Crect width='24' height='24' fill='white'/%3E%3Cpath d='M10.2 9.4a2.3 2.3 0 1 1 4.2 1.3c-.3.5-.8.8-1.3 1.15-.7.5-1.1.95-1.1 1.85' fill='none' stroke='black' stroke-width='1.7' stroke-linecap='round'/%3E%3Ccircle cx='12' cy='16.1' r='.9' fill='black'/%3E%3C/mask%3E%3C/defs%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black' mask='url(%23q)'/%3E%3C/svg%3E\")"

old = '''.trip-settings-cloud[data-network-status="pending"]::before {\n    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");\n    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");\n    animation: trip-settings-cloud-pulse 700ms ease-in-out infinite alternate;\n}\n\n@keyframes trip-settings-cloud-pulse {\n    from { opacity: 0.35; transform: scale(0.92); }\n    to { opacity: 1; transform: scale(1); }\n}'''
new = f'''.trip-settings-cloud[data-network-status="pending"]::before {{\n    -webkit-mask-image: {pending_svg};\n    mask-image: {pending_svg};\n    animation: connection-cloud-pulse 700ms ease-in-out infinite alternate;\n}}\n\n.number-pad-settings[data-connection-phase="handoff"] .number-pad-settings-gear {{\n    animation: number-pad-gear-spin 800ms linear infinite;\n}}\n\n.number-pad-settings[data-connection-phase="retry"][data-persistence="pending"] .number-pad-settings-gear {{\n    animation: none;\n}}\n\n.number-pad-settings[data-connection-phase="retry"][data-persistence="pending"] .number-pad-persistence-badge {{\n    display: grid;\n}}\n\n.number-pad-settings[data-connection-phase="retry"][data-persistence="pending"] .number-pad-persistence-badge::before {{\n    -webkit-mask-image: {pending_svg};\n    mask-image: {pending_svg};\n    animation: connection-cloud-pulse 700ms ease-in-out infinite alternate;\n}}\n\n@keyframes connection-cloud-pulse {{\n    from {{ opacity: 0.35; transform: scale(0.92); }}\n    to {{ opacity: 1; transform: scale(1); }}\n}}'''
if text.count(old) != 1:
    raise SystemExit(f"trip pending block count={text.count(old)}")
text = text.replace(old, new, 1)

css.write_text(text)
