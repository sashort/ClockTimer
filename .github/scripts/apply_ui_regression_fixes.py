from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def patch_index():
    path = Path("index.html")
    text = path.read_text()

    text = replace_once(
        text,
        '''            <div class="scope-control">\n                <button id="scopeConnectionButton" class="scope-connection-button" type="button" data-cloud-state="offline" aria-label="Offline. Retry connection" hidden></button>\n                <button id="scopeToggle" class="scope-toggle" type="button">Trip</button>\n            </div>''',
        '''            <div class="scope-control">\n                <button id="scopeToggle" class="scope-toggle" type="button">Trip</button>\n                <button id="scopeConnectionButton" class="scope-connection-button" type="button" data-cloud-state="offline" aria-label="Offline. Retry connection" hidden></button>\n            </div>''',
        "scope cloud order"
    )

    text = replace_once(
        text,
        '''            <button id="syncGoalsMenuButton" class="sync-goals-menu-button" type="button" aria-pressed="false">Sync Goals</button>''',
        '''            <button id="syncGoalsMenuButton" class="sync-goals-menu-button" type="button" aria-pressed="false"><span class="sync-goals-menu-icon" data-sync-state="disabled" aria-hidden="true"></span><span>Sync Goals</span></button>''',
        "sync menu icon markup"
    )

    old_hands = '''                        <div class="style-row three-control-row hand-style-row">\n                            <span>Hour Hand</span>\n                            <label class="hand-enabled-control">Show<input name="showHourHand" type="checkbox" checked aria-label="Show Hour Hand"></label>\n                            <label>Length<input name="hourHandLength" value="28%"></label>\n                            <label>Width<input name="hourHandWidth" value="5px"></label>\n                            <label>Color<input name="hourHandColor" type="color" value="#ffffff"></label>\n                        </div>\n                        <div class="style-row three-control-row hand-style-row">\n                            <span>Minute Hand</span>\n                            <label class="hand-enabled-control">Show<input name="showMinuteHand" type="checkbox" checked aria-label="Show Minute Hand"></label>\n                            <label>Length<input name="minuteHandLength" value="38%"></label>\n                            <label>Width<input name="minuteHandWidth" value="4px"></label>\n                            <label>Color<input name="minuteHandColor" type="color" value="#ffffff"></label>\n                        </div>\n                        <div class="style-row three-control-row hand-style-row">\n                            <span>Second Hand</span>\n                            <label class="hand-enabled-control">Show<input name="showSecondHand" type="checkbox" checked aria-label="Show Second Hand"></label>\n                            <label>Length<input name="secondHandLength" value="42%"></label>\n                            <label>Width<input name="secondHandWidth" value="2px"></label>\n                            <label>Color<input name="secondHandColor" type="color" value="#ffc220"></label>\n                        </div>'''

    new_hands = '''                        <div class="style-row three-control-row">\n                            <span class="hand-caption"><span>Hour Hand</span><input name="showHourHand" type="checkbox" checked aria-label="Show Hour Hand"></span>\n                            <label>Length<input name="hourHandLength" value="28%"></label>\n                            <label>Width<input name="hourHandWidth" value="5px"></label>\n                            <label>Color<input name="hourHandColor" type="color" value="#ffffff"></label>\n                        </div>\n                        <div class="style-row three-control-row">\n                            <span class="hand-caption"><span>Minute Hand</span><input name="showMinuteHand" type="checkbox" checked aria-label="Show Minute Hand"></span>\n                            <label>Length<input name="minuteHandLength" value="38%"></label>\n                            <label>Width<input name="minuteHandWidth" value="4px"></label>\n                            <label>Color<input name="minuteHandColor" type="color" value="#ffffff"></label>\n                        </div>\n                        <div class="style-row three-control-row">\n                            <span class="hand-caption"><span>Second Hand</span><input name="showSecondHand" type="checkbox" checked aria-label="Show Second Hand"></span>\n                            <label>Length<input name="secondHandLength" value="42%"></label>\n                            <label>Width<input name="secondHandWidth" value="2px"></label>\n                            <label>Color<input name="secondHandColor" type="color" value="#ffc220"></label>\n                        </div>'''

    text = replace_once(text, old_hands, new_hands, "hand checkbox placement")
    path.write_text(text.rstrip() + "\n")


def patch_app():
    path = Path("app.js")
    text = path.read_text()

    text = replace_once(
        text,
        '''    const syncGoalsMenuButton = $("#syncGoalsMenuButton");\n    const tripLogButton = $("#tripLogButton");''',
        '''    const syncGoalsMenuButton = $("#syncGoalsMenuButton");\n    const syncGoalsMenuIcon = syncGoalsMenuButton?.querySelector(".sync-goals-menu-icon");\n    const tripLogButton = $("#tripLogButton");''',
        "sync menu icon reference"
    )

    text = replace_once(
        text,
        '''                    if (\n                        state?.connectionStatusToken === token &&\n                        state.connectionPresentation === "cloud-fade"\n                    ) {''',
        '''                    if (\n                        state &&\n                        state.connectionStatusToken === token &&\n                        state.connectionPresentation === "cloud-fade"\n                    ) {''',
        "undefined connection state guard"
    )

    old_render = '''        if (goalSyncButton) {\n            goalSyncButton.hidden =\n                renderedScope !==\n                    "trip";\n        }\n    }'''
    new_render = '''        if (syncGoalsMenuIcon) {\n            const nextState =\n                enabled\n                    ? "enabled"\n                    : "disabled";\n\n            const animate =\n                syncGoalsMenuIcon.dataset.syncInitialized ===\n                    "true";\n\n            setCloudIconVisualState(\n                syncGoalsMenuIcon,\n                () => syncGoalsMenuIcon.dataset.syncState,\n                value => { syncGoalsMenuIcon.dataset.syncState = value; },\n                nextState,\n                { animate }\n            );\n\n            syncGoalsMenuIcon.dataset.syncInitialized =\n                "true";\n        }\n\n        if (goalSyncButton) {\n            goalSyncButton.hidden =\n                renderedScope !==\n                    "trip";\n        }\n    }'''
    text = replace_once(text, old_render, new_render, "animated sync menu state")

    text = replace_once(
        text,
        '''        tripLogBody.hidden =\n            false;\n\n        tripLogBody.inert =\n            false;''',
        '''        setFloatingTripLogBodyRect({\n            left: bodyRect.left + bodyRect.width / 2,\n            top: bodyRect.top + bodyRect.height / 2,\n            width: 0,\n            height: 0\n        });\n\n        tripLogBody.hidden =\n            false;\n\n        tripLogBody.inert =\n            false;''',
        "Trip Log collapsed opening state"
    )

    text = replace_once(
        text,
        '''        tripLogBody.hidden =\n            true;\n\n        clearFloatingTripLogBodyRect();\n\n        if (pinned) {''',
        '''        tripLogBody.hidden =\n            true;\n\n        clearFloatingTripLogBodyRect();\n\n        await wait(\n            TRIP_LIST_BODY_DELAY\n        );\n\n        if (pinned) {''',
        "symmetric Trip Log close delay"
    )

    path.write_text(text.rstrip() + "\n")


def patch_css():
    path = Path("app.css")
    text = path.read_text()

    old_hand_css = '''.hand-style-row {\n    grid-template-columns:\n        minmax(90px, 0.8fr)\n        58px\n        repeat(3, minmax(0, 1fr));\n}\n\n.hand-style-row .hand-enabled-control {\n    place-items: center;\n    align-self: end;\n}\n\n.hand-style-row .hand-enabled-control input {\n    width: 20px;\n    height: 20px;\n    margin: 0;\n    accent-color: var(--wm-blue);\n}\n\n@media (max-width: 720px) {\n    .hand-style-row {\n        grid-template-columns: 58px repeat(3, minmax(0, 1fr));\n    }\n\n    .hand-style-row > span {\n        grid-column: 1 / -1;\n    }\n}\n'''

    new_hand_css = '''.hand-caption {\n    width: min(120px, 100%);\n    display: grid;\n    grid-template-columns: minmax(0, 1fr) 18px;\n    align-items: center;\n    gap: 6px;\n}\n\n.hand-caption > span {\n    min-width: 0;\n}\n\n.hand-caption input {\n    width: 18px;\n    height: 18px;\n    margin: 0;\n    accent-color: var(--wm-blue);\n}\n'''
    text = replace_once(text, old_hand_css, new_hand_css, "restore hand settings grid")

    text = replace_once(
        text,
        '''.trip-log-body {\n    position: fixed;\n    z-index: 2999;\n    margin: 0;\n    padding: 0;\n    overflow: hidden;\n    border-radius: 14px;\n    transform: none;\n    transition:\n        border-color var(--trip-list-merge-duration, 750ms) linear,\n        border-radius var(--trip-list-merge-duration, 750ms) ease-in-out;\n    will-change: left, top, width, height;\n}''',
        '''.trip-log-body {\n    position: fixed;\n    z-index: 2999;\n    margin: 0;\n    padding: 0;\n    overflow: hidden;\n    border-radius: 14px;\n    transform: none;\n    opacity: 0.58;\n    transition:\n        border-color var(--trip-list-merge-duration, 750ms) linear,\n        border-radius var(--trip-list-merge-duration, 750ms) ease-in-out,\n        opacity var(--trip-list-merge-duration, 750ms) linear;\n    will-change: left, top, width, height, opacity;\n}''',
        "Trip Log body growth opacity"
    )

    text = replace_once(
        text,
        '''.trip-log-body.trip-log-merged {\n    border-top-color: transparent;\n    border-radius: 0 0 14px 14px;\n}''',
        '''.trip-log-body.trip-log-merged {\n    border-top-color: transparent;\n    border-radius: 0 0 14px 14px;\n    opacity: 1;\n}''',
        "Trip Log merged opacity"
    )

    additions = r'''

/* ui-regression-fixes-v1 */
.scope-control {
    position: relative;
    display: block;
}

.scope-toggle {
    width: 100%;
    height: 100%;
    padding-inline: 44px;
    text-align: center;
}

.scope-connection-button,
.goal-sync-button {
    width: 32px;
    height: 32px;
    padding: 6px;
    border: 0;
    border-radius: 50%;
    font-size: 20px;
}

.scope-connection-button {
    position: absolute;
    top: 10px;
    right: 8px;
    display: grid;
    place-items: center;
    background: transparent;
}

.scope-connection-button::before,
.goal-sync-button::before {
    width: 20px;
    height: 20px;
}

.percent-summary {
    position: relative;
}

.goal-sync-button {
    position: absolute;
    top: 50%;
    right: 8px;
    margin: 0;
    flex: none;
    transform: translateY(-50%);
}

#syncGoalsMenuButton::before {
    content: none;
}

#syncGoalsMenuButton[aria-pressed="true"] {
    color: var(--wm-white);
}

.sync-goals-menu-icon {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    display: grid;
    place-items: center;
    color: var(--wm-white);
    transform-style: preserve-3d;
    backface-visibility: hidden;
    will-change: transform;
}

.sync-goals-menu-icon::before {
    content: "";
    width: 30px;
    height: 30px;
    background: currentColor;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
}

.sync-goals-menu-icon[data-sync-state="disabled"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2M4.5 4.5l15 15' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2M4.5 4.5l15 15' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

.sync-goals-menu-icon[data-sync-state="enabled"] {
    color: #8bd5ff;
}

.sync-goals-menu-icon[data-sync-state="enabled"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

.trip-settings-dialog .dialog-actions button {
    min-height: 40px;
}
'''

    text = text.rstrip() + additions + "\n"
    path.write_text(text)


def main():
    patch_index()
    patch_app()
    patch_css()


if __name__ == "__main__":
    main()
