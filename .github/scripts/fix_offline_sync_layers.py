from pathlib import Path

CSS = Path("app.css")
css = CSS.read_text(encoding="utf-8")

MARKER = "offline-sync-layer-regression-v2"
if MARKER in css:
    raise SystemExit(0)

css += r'''

/* offline-sync-layer-regression-v2 */
/* Keep the original glyph only until the offline/X replacement takes over. */
.sync-goals-menu-icon[data-sync-network-state="offline-fading"]::before,
.sync-goals-menu-icon[data-sync-network-state="offline"]::before,
.goal-sync-button[data-sync-network-state="offline-fading"]::before,
.goal-sync-button[data-sync-network-state="offline"]::before {
    opacity: 0;
}

/* The red not-synced slash is persistent in every offline transition/state. */
.sync-goals-menu-icon[data-sync-network-state="offline-prep"]::after,
.sync-goals-menu-icon[data-sync-network-state="offline-fading"]::after,
.sync-goals-menu-icon[data-sync-network-state="offline"]::after,
.goal-sync-button[data-sync-network-state="offline-prep"]::after,
.goal-sync-button[data-sync-network-state="offline-fading"]::after,
.goal-sync-button[data-sync-network-state="offline"]::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 32px;
    height: 3px;
    border-radius: 999px;
    background: var(--wm-red);
    box-shadow: 0 0 1px rgb(0 0 0 / 55%);
    opacity: 1;
    transform: translate(-50%, -50%) rotate(45deg);
    transform-origin: center;
    pointer-events: none;
    transition: none;
}
'''

CSS.write_text(css, encoding="utf-8")
