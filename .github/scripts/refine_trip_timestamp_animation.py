from pathlib import Path

app = Path('app.js')
text = app.read_text()
old = '''        tripSetStartsNowActions.hidden = !draft;
        tripSetStartsNowActions.classList.toggle("is-selecting", active);
        tripSetStartsNowCancel.hidden = !active;
        tripSettingsDialog.classList.toggle("is-setting-starts-now", active);

        tripSettingsDialog.querySelectorAll(".trip-time-edit").forEach(button => {
            button.hidden = active;
        });

        tripStartNowToggles.forEach(button => {
            const key = button.dataset.tripStartNowTarget === "scheduled-start"
                ? "scheduled"
                : "actual";
            const selected = Boolean(active && tripStartsNowState[key]);
            button.hidden = !active;
            button.textContent = selected ? "✓" : "-";
            button.setAttribute("aria-pressed", String(selected));
        });
'''
new = '''        tripSetStartsNowActions.hidden = !draft;
        tripSetStartsNowActions.classList.toggle("is-selecting", active);
        tripSetStartsNowCancel.hidden = false;
        tripSetStartsNowCancel.disabled = !active;
        tripSetStartsNowCancel.tabIndex = active ? 0 : -1;
        tripSetStartsNowCancel.setAttribute("aria-hidden", String(!active));
        tripSettingsDialog.classList.toggle("is-setting-starts-now", active);

        tripSettingsDialog.querySelectorAll(".trip-time-edit").forEach(button => {
            button.hidden = false;
            button.tabIndex = active ? -1 : 0;
            button.setAttribute("aria-hidden", String(active));
        });

        tripStartNowToggles.forEach(button => {
            const key = button.dataset.tripStartNowTarget === "scheduled-start"
                ? "scheduled"
                : "actual";
            const selected = Boolean(active && tripStartsNowState[key]);
            button.hidden = false;
            button.tabIndex = active ? 0 : -1;
            button.setAttribute("aria-hidden", String(!active));
            button.textContent = selected ? "✓" : "-";
            button.setAttribute("aria-pressed", String(selected));
        });
'''
if old not in text:
    raise SystemExit('app.js timestamp UI block not found')
app.write_text(text.replace(old, new, 1))

css = Path('app.css')
text = css.read_text()
marker = '/* staged-trip-settings-timestamp-v1 */'
pos = text.find(marker)
if pos < 0:
    raise SystemExit('timestamp CSS marker not found')
replacement = r'''/* staged-trip-settings-timestamp-v2 */
.trip-settings-dialog {
    --trip-start-transition-duration: 250ms;
}

.trip-now-actions {
    display: flex;
    gap: 0;
    align-items: stretch;
    transition: gap var(--trip-start-transition-duration) ease-in-out;
}

.trip-now-actions[hidden] {
    display: none;
}

.trip-now-action {
    flex: 0 0 100%;
    min-width: 0;
    transition:
        flex-basis var(--trip-start-transition-duration) ease-in-out,
        padding-inline var(--trip-start-transition-duration) ease-in-out,
        font-size var(--trip-start-transition-duration) ease-in-out;
}

.trip-now-actions.is-selecting {
    gap: 12px;
}

.trip-now-actions.is-selecting .trip-now-action,
.trip-now-actions.is-selecting .trip-now-cancel {
    flex-basis: calc(50% - 6px);
}

.trip-now-actions.is-selecting .trip-now-action {
    padding-inline: 10px;
    font-size: clamp(13px, 3vw, 16px);
}

.trip-now-cancel {
    box-sizing: border-box;
    flex: 0 0 0%;
    min-width: 0;
    min-height: 48px;
    overflow: hidden;
    padding: 10px 0;
    border: 1.5px solid rgb(255 255 255 / 72%);
    border-radius: 10px;
    color: var(--wm-white);
    background: var(--ui-charcoal-gradient);
    box-shadow: var(--ui-inner-highlight), 0 5px 12px rgb(0 0 0 / 18%);
    opacity: 0;
    white-space: nowrap;
    font-size: 16px;
    font-weight: 700;
    pointer-events: none;
    transition:
        flex-basis var(--trip-start-transition-duration) ease-in-out,
        padding-inline var(--trip-start-transition-duration) ease-in-out,
        opacity var(--trip-start-transition-duration) linear;
}

.trip-now-actions.is-selecting .trip-now-cancel {
    padding-inline: 16px;
    opacity: 1;
    pointer-events: auto;
}

.trip-time-now-toggle {
    width: 54px;
    height: 54px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 1.5px solid rgb(215 241 255 / 92%);
    border-radius: 12px;
    color: var(--wm-white);
    background: var(--ui-blue-gradient);
    box-shadow: var(--ui-inner-highlight), 0 5px 12px rgb(0 0 0 / 18%);
    font-size: 30px;
    font-weight: 800;
    line-height: 1;
}

.trip-time-row .trip-time-edit,
.trip-time-row .trip-time-now-toggle {
    grid-column: 3;
    grid-row: 1;
    justify-self: center;
    align-self: center;
    transition: opacity var(--trip-start-transition-duration) linear;
}

.trip-time-row .trip-time-edit {
    z-index: 2;
    opacity: 1;
}

.trip-time-row .trip-time-now-toggle {
    z-index: 1;
    opacity: 0;
    pointer-events: none;
}

.trip-settings-dialog.is-setting-starts-now .trip-time-edit {
    z-index: 1;
    opacity: 0;
    pointer-events: none;
}

.trip-settings-dialog.is-setting-starts-now .trip-time-now-toggle {
    z-index: 2;
    opacity: 1;
    pointer-events: auto;
}

.trip-time-now-toggle[aria-pressed="true"] {
    box-shadow: inset 0 2px 5px rgb(0 0 0 / 24%), 0 4px 10px rgb(0 0 0 / 18%);
}

@media (max-width: 620px) {
    .trip-time-row .trip-time-edit,
    .trip-time-row .trip-time-now-toggle {
        grid-column: 2;
        grid-row: 2;
    }

    .trip-time-now-toggle {
        width: 50px;
        height: 50px;
    }
}
'''
css.write_text(text[:pos] + replacement)
