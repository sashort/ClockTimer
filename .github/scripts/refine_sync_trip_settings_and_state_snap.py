from pathlib import Path

APP = Path("app.js")
CSS = Path("app.css")

app = APP.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")

MARKER = "sync-three-state-and-trip-settings-v1"
if MARKER in app and MARKER in css:
    raise SystemExit(0)


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)

# Mark layered sync visuals as initialized so the legacy pseudo-arrow can be hidden
# only after the replacement arrow layer exists.
app = replace_once(
    app,
    '''            element.append(overlay);\n        }\n\n        let arrow =\n''',
    '''            element.append(overlay);\n        }\n\n        element.dataset.syncLayered = "true";\n\n        let arrow =\n''',
    "sync layered marker"
)

# Always animate the dedicated arrow child, regardless of normal/slash/X state.
old_animation = '''            // sync-offline-arrow-spin-v1\n            // Once the offline X is visible, spin only the arrow layer\n            // underneath it so the X remains stationary.\n            const offlineArrow =\n                element.dataset.syncNetworkState === "offline"\n                    ? ensureSyncOfflineOverlay(element)?.querySelector(\n                        ":scope > .sync-offline-arrow"\n                    )\n                    : undefined;\n\n            const animationTarget =\n                offlineArrow || element;\n\n            const anchored =\n                !offlineArrow &&\n                element === goalSyncButton;\n\n            const prefix =\n                anchored\n                    ? "translateY(-50%) "\n                    : "";\n\n            const animation =\n                animationTarget.animate(\n                    [\n                        {\n                            transform:\n                                `${prefix}rotate(0deg)`\n                        },\n                        {\n                            transform:\n                                `${prefix}rotate(360deg)`\n                        }\n                    ],\n'''
new_animation = '''            // sync-three-state-and-trip-settings-v1\n            // The arrow is the only rotating layer. Red slash/X overlays stay fixed.\n            const animationTarget =\n                ensureSyncOfflineOverlay(element)?.querySelector(\n                    ":scope > .sync-offline-arrow"\n                );\n\n            if (!animationTarget) continue;\n\n            element.classList.add(\n                "sync-icon-spinning"\n            );\n\n            const animation =\n                animationTarget.animate(\n                    [\n                        { transform: "rotate(0deg)" },\n                        { transform: "rotate(360deg)" }\n                    ],\n'''
app = replace_once(app, old_animation, new_animation, "sync arrow animation target")

old_finally = '''                    if (\n                        syncIconAnimations.get(\n                            element\n                        ) === animation\n                    ) {\n                        syncIconAnimations.delete(\n                            element\n                        );\n                    }\n'''
new_finally = '''                    if (\n                        syncIconAnimations.get(\n                            element\n                        ) === animation\n                    ) {\n                        syncIconAnimations.delete(\n                            element\n                        );\n                        element.classList.remove(\n                            "sync-icon-spinning"\n                        );\n                    }\n'''
app = replace_once(app, old_finally, new_finally, "sync animation cleanup")

# Snap ready/running layout state changes so main trip controls do not animate
# merely because the trip state changed.
old_trip_state = '''    function setTripControlState(running) {\n        app.dataset.tripState = running ? "running" : "ready";\n        app.dataset.state = clockTimer.status;\n        activeTripControls.hidden = !running;\n        renderTripActionState();\n    }\n'''
new_trip_state = '''    function setTripControlState(running) {\n        const nextTripState =\n            running ? "running" : "ready";\n        const stateChanged =\n            app.dataset.tripState !== nextTripState;\n\n        if (stateChanged) {\n            app.classList.add(\n                "trip-state-snap"\n            );\n            void app.offsetHeight;\n        }\n\n        app.dataset.tripState = nextTripState;\n        app.dataset.state = clockTimer.status;\n        activeTripControls.hidden = !running;\n        renderTripActionState();\n\n        if (stateChanged) {\n            void app.offsetHeight;\n            requestAnimationFrame(() => {\n                app.classList.remove(\n                    "trip-state-snap"\n                );\n            });\n        }\n    }\n'''
app = replace_once(app, old_trip_state, new_trip_state, "trip state snap")

css += r'''

/* sync-three-state-and-trip-settings-v1 */
/* The replacement arrow layer is the single arrow glyph for all three states. */
.sync-goals-menu-icon[data-sync-layered="true"]::before,
.goal-sync-button[data-sync-layered="true"]::before {
    opacity: 0;
}

.sync-goals-menu-icon > .sync-offline-overlay,
.goal-sync-button > .sync-offline-overlay,
.sync-goals-menu-icon[data-sync-network-state] > .sync-offline-overlay,
.goal-sync-button[data-sync-network-state] > .sync-offline-overlay {
    opacity: 1;
    transition: none;
}

/* X is only the offline red overlay. */
.sync-offline-x {
    opacity: 0;
    transition: opacity 750ms linear;
}

.sync-goals-menu-icon[data-sync-network-state="offline-fading"] .sync-offline-x,
.sync-goals-menu-icon[data-sync-network-state="offline"] .sync-offline-x,
.goal-sync-button[data-sync-network-state="offline-fading"] .sync-offline-x,
.goal-sync-button[data-sync-network-state="offline"] .sync-offline-x {
    opacity: 1;
}

/* Slash is only the not-synced red overlay. It remains visible while that
   state is spinning, then can crossfade to X after spinning stops. */
.sync-goals-menu-icon[data-sync-state="enabled"][data-sync-network-state="offline-prep"]::after,
.goal-sync-button[aria-pressed="true"][data-sync-network-state="offline-prep"]::after {
    opacity: 0;
}

.sync-goals-menu-icon[data-sync-network-state="offline-fading"]::after,
.goal-sync-button[data-sync-network-state="offline-fading"]::after {
    opacity: 0;
    transition: opacity 750ms linear;
}

.sync-goals-menu-icon[data-sync-network-state="offline"]::after,
.goal-sync-button[data-sync-network-state="offline"]::after {
    opacity: 0;
    transition: none;
}

/* Do not crossfade red overlays while arrows are actively spinning. */
.sync-icon-spinning .sync-offline-x,
.sync-icon-spinning::after {
    transition: none !important;
}

/* Trip Settings footer controls should size like the pencil controls rather
   than stretching with the fullscreen form grid. */
.trip-settings-dialog form {
    align-content: start;
    grid-auto-rows: max-content;
}

.trip-settings-dialog .dialog-actions {
    align-self: start;
}

.trip-settings-dialog .dialog-actions button {
    height: 54px;
    min-height: 54px;
    max-height: 54px;
}

@media (max-width: 620px) {
    .trip-settings-dialog .dialog-actions button {
        height: 50px;
        min-height: 50px;
        max-height: 50px;
    }
}

/* Ready <-> running state swaps are not layout animations. */
.app.trip-state-snap {
    transition: none !important;
}
'''

APP.write_text(app, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")
