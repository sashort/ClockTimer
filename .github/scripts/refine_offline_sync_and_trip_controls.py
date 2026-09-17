from pathlib import Path

APP = Path("app.js")
CSS = Path("app.css")

app = APP.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")

MARKER = "sync-offline-arrow-spin-v1"
if MARKER in app and MARKER in css:
    raise SystemExit(0)


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)


app = replace_once(
    app,
    '''        if (!overlay) {
            overlay =
                document.createElement("span");
            overlay.className =
                "sync-offline-overlay";
            overlay.setAttribute(
                "aria-hidden",
                "true"
            );
            element.append(overlay);
        }

        return overlay;
''',
    '''        if (!overlay) {
            overlay =
                document.createElement("span");
            overlay.className =
                "sync-offline-overlay";
            overlay.setAttribute(
                "aria-hidden",
                "true"
            );
            element.append(overlay);
        }

        let arrow =
            overlay.querySelector(
                ":scope > .sync-offline-arrow"
            );

        if (!arrow) {
            arrow =
                document.createElement("span");
            arrow.className =
                "sync-offline-arrow";
            overlay.append(arrow);
        }

        let offlineX =
            overlay.querySelector(
                ":scope > .sync-offline-x"
            );

        if (!offlineX) {
            offlineX =
                document.createElement("span");
            offlineX.className =
                "sync-offline-x";
            overlay.append(offlineX);
        }

        return overlay;
''',
    "offline overlay children"
)

app = replace_once(
    app,
    '''            const anchored =
                element === goalSyncButton;

            const prefix =
                anchored
                    ? "translateY(-50%) "
                    : "";

            const animation =
                element.animate(
''',
    '''            // sync-offline-arrow-spin-v1
            // Once the offline X is visible, spin only the arrow layer
            // underneath it so the X remains stationary.
            const offlineArrow =
                element.dataset.syncNetworkState === "offline"
                    ? ensureSyncOfflineOverlay(element)?.querySelector(
                        ":scope > .sync-offline-arrow"
                    )
                    : undefined;

            const animationTarget =
                offlineArrow || element;

            const anchored =
                !offlineArrow &&
                element === goalSyncButton;

            const prefix =
                anchored
                    ? "translateY(-50%) "
                    : "";

            const animation =
                animationTarget.animate(
''',
    "offline arrow animation target"
)

css += r'''

/* sync-offline-arrow-spin-v1 */
/* Keep normal trip controls close to the 54px trip-value labels. */
.app[data-interval-state="break"] .active-trip-controls {
    grid-template-rows: 1fr 1fr;
}

/* Strike the Sync Goals label itself, not the entire menu row, so the
   connection annotation stays readable and unstruck. */
#syncGoalsMenuButton[aria-pressed="false"] {
    text-decoration: none;
}

#syncGoalsMenuButton[aria-pressed="false"] > span:last-child,
.app[data-network-status="offline"] #syncGoalsMenuButton > span:last-child {
    text-decoration-line: line-through;
    text-decoration-thickness: 2px;
    text-decoration-color: currentColor;
}

.app[data-network-status="offline"] #syncGoalsMenuButton::after {
    content: "(offline)";
    margin-left: -6px;
    color: rgb(255 255 255 / 78%);
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
}

/* The offline overlay has independent arrow/X layers. The arrow can rotate
   while the X stays fixed in the lower-left. */
.sync-offline-overlay::before,
.sync-offline-overlay::after {
    content: none;
}

.sync-offline-arrow,
.sync-offline-x {
    position: absolute;
    display: block;
    pointer-events: none;
}

.sync-offline-arrow {
    inset: 0;
    background: currentColor;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
}

.sync-offline-x {
    left: -2px;
    bottom: -2px;
    width: 13px;
    height: 13px;
    background: var(--wm-red);
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 3l10 10M13 3 3 13' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 3l10 10M13 3 3 13' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
    filter: drop-shadow(0 0 1px rgb(0 0 0 / 55%));
}
'''

APP.write_text(app, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")
