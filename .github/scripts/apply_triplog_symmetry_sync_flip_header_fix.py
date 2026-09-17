from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def patch_app_js():
    path = Path("app.js")
    text = path.read_text()

    text = replace_once(
        text,
        '''    const TRIP_LIST_BUTTON_TRANSITION_DURATION = 750;\n    const TRIP_LIST_BODY_DELAY = 350;\n    const TRIP_LIST_BODY_DURATION = 1000;\n    const TRIP_LIST_MERGE_DURATION = 750;\n    const TRIP_LIST_CLOSE_BUTTON_DURATION = 350;\n    const TRIP_LIST_CLOSE_BODY_DELAY = 125;\n    const TRIP_LIST_CLOSE_BODY_DURATION = 425;\n    const TRIP_LIST_CLOSE_MERGE_DURATION = 300;''',
        '''    const TRIP_LIST_BUTTON_TRANSITION_DURATION = 350;\n    const TRIP_LIST_BODY_DELAY = 125;\n    const TRIP_LIST_BODY_DURATION = 425;\n    const TRIP_LIST_MERGE_DURATION = 300;''',
        "unified Trip Log timing constants"
    )

    old_show = '''    function showTripLogMerge() {\n        if (\n            !tripLogButton ||\n            !tripLogBody ||\n            !tripLogCloseButton\n        ) {\n            return;\n        }\n\n        clearTripLogMergeDuration();\n\n        tripLogButton.classList.add(\n            "trip-log-merged"\n        );\n\n        tripLogBody.classList.add(\n            "trip-log-merged"\n        );\n\n        positionTripLogCloseButton();\n\n        tripLogCloseButton.hidden =\n            false;\n\n        requestAnimationFrame(\n            () => {\n                if (\n                    tripListIsActive()\n                ) {\n                    tripLogCloseButton.classList.add(\n                        "is-visible"\n                    );\n                }\n            }\n        );\n    }'''

    new_show = '''    async function showTripLogMerge(\n        duration = TRIP_LIST_MERGE_DURATION\n    ) {\n        if (\n            !tripLogButton ||\n            !tripLogBody ||\n            !tripLogCloseButton\n        ) {\n            return;\n        }\n\n        setTripLogMergeDuration(\n            duration\n        );\n\n        tripLogButton.classList.add(\n            "trip-log-merged"\n        );\n\n        tripLogBody.classList.add(\n            "trip-log-merged"\n        );\n\n        positionTripLogCloseButton();\n\n        tripLogCloseButton.hidden =\n            false;\n\n        requestAnimationFrame(\n            () => {\n                if (\n                    tripListIsActive()\n                ) {\n                    tripLogCloseButton.classList.add(\n                        "is-visible"\n                    );\n                }\n            }\n        );\n\n        await wait(\n            duration\n        );\n\n        clearTripLogMergeDuration();\n    }'''
    text = replace_once(text, old_show, new_show, "awaitable Trip Log merge")

    text = replace_once(
        text,
        '''        app.dataset.tripListState =\n            "open";\n\n        showTripLogMerge();\n\n        return true;''',
        '''        app.dataset.tripListState =\n            "open";\n\n        await showTripLogMerge();\n\n        return true;''',
        "await Trip Log opening merge"
    )

    text = text.replace(
        "TRIP_LIST_CLOSE_MERGE_DURATION",
        "TRIP_LIST_MERGE_DURATION"
    ).replace(
        "TRIP_LIST_CLOSE_BODY_DURATION",
        "TRIP_LIST_BODY_DURATION"
    ).replace(
        "TRIP_LIST_CLOSE_BODY_DELAY",
        "TRIP_LIST_BODY_DELAY"
    ).replace(
        "TRIP_LIST_CLOSE_BUTTON_DURATION",
        "TRIP_LIST_BUTTON_TRANSITION_DURATION"
    )

    old_sync = '''            const animation =\n                element.animate(\n                    [\n                        {\n                            transform:\n                                `${prefix}rotate(0deg)`\n                        },\n                        {\n                            transform:\n                                `${prefix}rotate(360deg)`\n                        }\n                    ],\n                    {\n                        duration:\n                            CONNECTION_UI_TRANSITION_DURATION,\n                        easing: "ease-in-out"\n                    }\n                );'''

    new_sync = '''            const animation =\n                element.animate(\n                    [\n                        {\n                            transform:\n                                `${prefix}rotateY(0deg)`\n                        },\n                        {\n                            transform:\n                                `${prefix}rotateY(90deg)`,\n                            offset: 0.5\n                        },\n                        {\n                            transform:\n                                `${prefix}rotateY(-90deg)`,\n                            offset: 0.5001\n                        },\n                        {\n                            transform:\n                                `${prefix}rotateY(0deg)`\n                        }\n                    ],\n                    {\n                        duration:\n                            CONNECTION_UI_TRANSITION_DURATION,\n                        easing: "linear"\n                    }\n                );'''
    text = replace_once(text, old_sync, new_sync, "Sync Goals Y-axis flip")

    path.write_text(text.rstrip() + "\n")


def patch_app_css():
    path = Path("app.css")
    text = path.read_text()

    text = replace_once(
        text,
        '''.app-header {\n    display: grid;\n    grid-template-columns: auto 1fr;\n    margin: 0;\n    padding: 0;\n}''',
        '''.app-header {\n    display: grid;\n    grid-template-columns: auto 1fr;\n    margin: 0;\n    padding: 0;\n    border: 0;\n    background: transparent;\n    box-shadow: none;\n}''',
        "transparent app header base"
    )

    text = replace_once(
        text,
        '''.app-header {\n    background: var(--ui-navy-gradient);\n    border-bottom: 1px solid rgb(255 255 255 / 22%);\n    box-shadow: var(--ui-inner-highlight);\n}\n''',
        "",
        "remove painted app header container"
    )

    path.write_text(text.rstrip() + "\n")


patch_app_js()
patch_app_css()
