from pathlib import Path

tr_path = Path('TimeRange.js')
text = tr_path.read_text()

text = text.replace(
'''    static #reordering = false;\n\n    #startTime;''',
'''    static #reordering = false;\n    static #animationDuration = 1000;\n\n    #startTime;''',
1)

text = text.replace(
'''    #contourLayer;\n    #syncing = 0;''',
'''    #contourLayer;\n    #syncing = 0;\n    #suspendAnimations = false;\n    #renderStartTime;\n    #renderEndTime;\n    #animationFrame;\n    #animationStartedAt;\n    #animationFromStart;\n    #animationFromEnd;\n    #animationTargetStart;\n    #animationTargetEnd;\n    #pendingRemoval = false;\n    #removeAfterAnimation = false;''',
1)

anchor = '''    static get percentGoal() {\n        return TimeRange.#percentGoal;\n    }\n'''
insert = anchor + '''\n    static get animationDuration() {\n        return TimeRange.#animationDuration;\n    }\n\n    static set animationDuration(value) {\n        const duration = Number(value);\n\n        if (\n            Number.isFinite(duration) &&\n            duration >= 0\n        ) {\n            TimeRange.#animationDuration =\n                duration;\n        }\n    }\n'''
if anchor not in text:
    raise SystemExit('percentGoal anchor not found')
text = text.replace(anchor, insert, 1)

old_connected = '''        this.#initializeFromAttributes();\n\n        this.#syncing++;'''
new_connected = '''        this.#suspendAnimations =\n            true;\n\n        this.#initializeFromAttributes();\n\n        this.#suspendAnimations =\n            false;\n\n        this.#syncing++;'''
if old_connected not in text:
    raise SystemExit('connected init anchor not found')
text = text.replace(old_connected, new_connected, 1)

old_tail = '''        TimeRange.#updateParentClipPaths(\n            this.parentElement\n        );\n        TimeRange.#reorderParent(\n            this.parentElement\n        );\n    }\n\n    disconnectedCallback() {'''
new_tail = '''        TimeRange.#reorderParent(\n            this.parentElement\n        );\n\n        if (\n            this.hasAttribute(\n                "data-time-range-full-entry"\n            )\n        ) {\n            this.removeAttribute(\n                "data-time-range-full-entry"\n            );\n\n            this.#renderStartTime =\n                this.#cloneDate(\n                    this.#startTime\n                );\n\n            this.#renderEndTime =\n                this.#cloneDate(\n                    this.#endTime\n                );\n\n            this.#updateClipPath();\n            this.#animateOpacityIn();\n        }\n        else {\n            this.#renderStartTime =\n                this.#cloneDate(\n                    this.#startTime\n                );\n\n            this.#renderEndTime =\n                this.#cloneDate(\n                    this.#startTime\n                );\n\n            this.#animateToLogicalTiming();\n        }\n    }\n\n    disconnectedCallback() {'''
if old_tail not in text:
    raise SystemExit('connected tail anchor not found')
text = text.replace(old_tail, new_tail, 1)

old_disc = '''    disconnectedCallback() {\n        if (\n            TimeRange.#reordering\n        ) {\n            return;\n        }\n        const index ='''
new_disc = '''    disconnectedCallback() {\n        if (\n            TimeRange.#reordering\n        ) {\n            return;\n        }\n\n        if (\n            this.#animationFrame !==\n                undefined\n        ) {\n            cancelAnimationFrame(\n                this.#animationFrame\n            );\n\n            this.#animationFrame =\n                undefined;\n        }\n\n        const index ='''
if old_disc not in text:
    raise SystemExit('disconnected anchor not found')
text = text.replace(old_disc, new_disc, 1)

# Route connected logical timing changes through the shared animation engine.
old_update = '''        if (\n            this.isConnected\n        ) {\n            TimeRange.#updateParentClipPaths(\n                this.parentElement\n            );\n        }'''
new_update = '''        if (\n            this.isConnected\n        ) {\n            if (\n                this.#suspendAnimations\n            ) {\n                this.#renderStartTime =\n                    this.#cloneDate(\n                        this.#startTime\n                    );\n\n                this.#renderEndTime =\n                    this.#cloneDate(\n                        this.#endTime\n                    );\n\n                this.#updateClipPath();\n            }\n            else {\n                this.#animateToLogicalTiming();\n            }\n        }'''
count = text.count(old_update)
if count < 3:
    raise SystemExit(f'expected >=3 setter update blocks, found {count}')
text = text.replace(old_update, new_update, 3)

# Insert animation helpers before ring-origin logic.
anchor = '''    #getRingOriginTime() {'''
helpers = r'''    #cloneDate(value) {
        return value instanceof Date
            ? new Date(
                value.getTime()
            )
            : undefined;
    }

    #getVisualTiming() {
        return {
            start:
                this.#cloneDate(
                    this.#renderStartTime ??
                    this.#startTime
                ),
            end:
                this.#cloneDate(
                    this.#renderEndTime ??
                    this.#endTime
                )
        };
    }

    #animateToLogicalTiming() {
        if (
            !this.isConnected ||
            !(this.#startTime instanceof Date) ||
            !(this.#endTime instanceof Date)
        ) {
            return;
        }

        const visual =
            this.#getVisualTiming();

        this.#startTimingAnimation(
            visual.start ?? this.#startTime,
            visual.end ?? this.#startTime,
            this.#startTime,
            this.#endTime,
            false
        );
    }

    #startTimingAnimation(
        fromStart,
        fromEnd,
        targetStart,
        targetEnd,
        removeAfter = false
    ) {
        if (
            !(fromStart instanceof Date) ||
            !(fromEnd instanceof Date) ||
            !(targetStart instanceof Date) ||
            !(targetEnd instanceof Date)
        ) {
            return;
        }

        if (
            this.#animationFrame !==
                undefined
        ) {
            cancelAnimationFrame(
                this.#animationFrame
            );
        }

        this.#animationFromStart =
            this.#cloneDate(fromStart);

        this.#animationFromEnd =
            this.#cloneDate(fromEnd);

        this.#animationTargetStart =
            this.#cloneDate(targetStart);

        this.#animationTargetEnd =
            this.#cloneDate(targetEnd);

        this.#animationStartedAt =
            performance.now();

        this.#removeAfterAnimation =
            removeAfter;

        const duration =
            TimeRange.#animationDuration;

        if (
            duration <= 0
        ) {
            this.#renderStartTime =
                this.#cloneDate(targetStart);

            this.#renderEndTime =
                this.#cloneDate(targetEnd);

            this.#updateClipPath();
            this.#finishTimingAnimation();
            return;
        }

        const step =
            timestamp => {
                const progress =
                    Math.min(
                        1,
                        Math.max(
                            0,
                            (
                                timestamp -
                                this.#animationStartedAt
                            ) /
                            duration
                        )
                    );

                const fromStartMs =
                    this.#animationFromStart.getTime();

                const fromEndMs =
                    this.#animationFromEnd.getTime();

                const targetStartMs =
                    this.#animationTargetStart.getTime();

                const targetEndMs =
                    this.#animationTargetEnd.getTime();

                this.#renderStartTime =
                    new Date(
                        fromStartMs +
                        (
                            targetStartMs -
                            fromStartMs
                        ) *
                        progress
                    );

                this.#renderEndTime =
                    new Date(
                        fromEndMs +
                        (
                            targetEndMs -
                            fromEndMs
                        ) *
                        progress
                    );

                this.#updateClipPath();

                if (
                    progress >= 1
                ) {
                    this.#animationFrame =
                        undefined;

                    this.#finishTimingAnimation();
                    return;
                }

                this.#animationFrame =
                    requestAnimationFrame(
                        step
                    );
            };

        this.#animationFrame =
            requestAnimationFrame(
                step
            );
    }

    #finishTimingAnimation() {
        const removeAfter =
            this.#removeAfterAnimation;

        this.#removeAfterAnimation =
            false;

        if (removeAfter) {
            this.#pendingRemoval =
                false;

            HTMLElement.prototype.remove.call(
                this
            );
        }
    }

    #animateOpacityIn() {
        const duration =
            TimeRange.#animationDuration;

        if (
            duration <= 0 ||
            typeof this.animate !==
                "function"
        ) {
            return;
        }

        this.animate(
            [
                { opacity: 0 },
                { opacity: 1 }
            ],
            {
                duration,
                easing: "linear"
            }
        );
    }

    removeAnimated({
        collapseTo = "end",
        targetStart,
        targetEnd
    } = {}) {
        if (
            this.#pendingRemoval
        ) {
            return;
        }

        if (!this.isConnected) {
            HTMLElement.prototype.remove.call(
                this
            );
            return;
        }

        this.#pendingRemoval =
            true;

        this.setAttribute(
            "data-time-range-exiting",
            ""
        );

        const instanceIndex =
            TimeRange.#instances.indexOf(
                this
            );

        if (
            instanceIndex !== -1
        ) {
            TimeRange.#instances.splice(
                instanceIndex,
                1
            );
        }

        const visual =
            this.#getVisualTiming();

        let finalStart =
            targetStart instanceof Date
                ? targetStart
                : undefined;

        let finalEnd =
            targetEnd instanceof Date
                ? targetEnd
                : undefined;

        if (
            !(finalStart instanceof Date) ||
            !(finalEnd instanceof Date)
        ) {
            const collapseDate =
                collapseTo === "start"
                    ? (
                        visual.start ??
                        this.#startTime
                    )
                    : (
                        visual.end ??
                        this.#endTime
                    );

            finalStart =
                this.#cloneDate(collapseDate);

            finalEnd =
                this.#cloneDate(collapseDate);
        }

        this.#startTimingAnimation(
            visual.start ?? finalStart,
            visual.end ?? finalEnd,
            finalStart,
            finalEnd,
            true
        );
    }

    get isExiting() {
        return this.#pendingRemoval;
    }

'''
if anchor not in text:
    raise SystemExit('ring origin anchor not found')
text = text.replace(anchor, helpers + anchor, 1)

# Render interpolated times instead of snapping logical times.
text = text.replace(
'''        const duration =\n            this.#endTime.getTime() -\n            this.#startTime.getTime();''',
'''        const renderStart =\n            this.#renderStartTime instanceof Date\n                ? this.#renderStartTime\n                : this.#startTime;\n\n        const renderEnd =\n            this.#renderEndTime instanceof Date\n                ? this.#renderEndTime\n                : this.#endTime;\n\n        const duration =\n            renderEnd.getTime() -\n            renderStart.getTime();''',
1)
text = text.replace(
'''                this.#startTime,\n                ringOrigin''',
'''                renderStart,\n                ringOrigin''',
1)
text = text.replace(
'''                this.#endTime,\n                ringOrigin''',
'''                renderEnd,\n                ringOrigin''',
1)

# Reordering ignores visual-only exiting ranges.
text = text.replace(
'''            ).filter(\n                child =>\n                    child instanceof\n                        TimeRange\n            );''',
'''            ).filter(\n                child =>\n                    child instanceof\n                        TimeRange &&\n                    !child.#pendingRemoval\n            );''',
1)

# Overlap resolution ignores exiting ranges and animates covered ranges out rather than snapping removal.
text = text.replace(
'''                existing.hasAttribute(\n                    "overlapping"\n                )\n            ) {''',
'''                existing.hasAttribute(\n                    "overlapping"\n                ) ||\n                existing.#pendingRemoval\n            ) {''',
1)
text = text.replace(
'''                existing.remove();\n\n                continue;''',
'''                existing.removeAnimated({\n                    targetStart:\n                        this.#cloneDate(\n                            newStart\n                        ),\n                    targetEnd:\n                        this.#cloneDate(\n                            newEnd\n                        )\n                });\n\n                continue;''',
1)

tr_path.write_text(text)

ct_path = Path('ClockTimer.js')
ct = ct_path.read_text()

# Keep replace/selection logic from considering visual-only exiting ranges.
needle = '''                if (\n                    range.hasAttribute(\n                        "overlapping"\n                    )\n                ) {\n                    continue;\n                }'''
replacement = '''                if (\n                    range.hasAttribute(\n                        "overlapping"\n                    ) ||\n                    range.hasAttribute(\n                        "data-time-range-exiting"\n                    )\n                ) {\n                    continue;\n                }'''
if needle in ct:
    ct = ct.replace(needle, replacement, 1)

# replaceWithNext loop has no overlapping guard; add exit guard immediately inside its loop.
needle2 = '''            for (\n                const range of\n                    ring.querySelectorAll(\n                        ":scope > time-range"\n                    )\n            ) {\n                let start ='''
replacement2 = '''            for (\n                const range of\n                    ring.querySelectorAll(\n                        ":scope > time-range"\n                    )\n            ) {\n                if (\n                    range.hasAttribute(\n                        "data-time-range-exiting"\n                    )\n                ) {\n                    continue;\n                }\n\n                let start ='''
if needle2 not in ct:
    raise SystemExit('replaceWithNext loop anchor not found')
ct = ct.replace(needle2, replacement2, 1)

# replaceToNext replacement must occupy the complete now -> next range immediately and fade in over the same duration.
needle3 = '''            const replacement =\n                this.#createTimeRange(\n                    type.trim(),\n                    now,\n                    nextStart,\n                    {\n                        dynamic: true\n                    }\n                );\n\n            ring.insertBefore('''
replacement3 = '''            const replacement =\n                this.#createTimeRange(\n                    type.trim(),\n                    now,\n                    nextStart,\n                    {\n                        dynamic: true\n                    }\n                );\n\n            replacement.setAttribute(\n                "data-time-range-full-entry",\n                ""\n            );\n\n            ring.insertBefore('''
if needle3 not in ct:
    raise SystemExit('replaceToNext replacement anchor not found')
ct = ct.replace(needle3, replacement3, 1)

# Rendered inserted segments now exit smoothly instead of disappearing instantly.
needle4 = '''            ) {\n                range.remove();\n            }\n        }\n\n        #renderInsertedRecord('''
replacement4 = '''            ) {\n                if (\n                    typeof range.removeAnimated ===\n                        "function"\n                ) {\n                    range.removeAnimated({\n                        collapseTo: "start"\n                    });\n                }\n                else {\n                    range.remove();\n                }\n            }\n        }\n\n        #renderInsertedRecord('''
if needle4 not in ct:
    raise SystemExit('removeInsertedSegments anchor not found')
ct = ct.replace(needle4, replacement4, 1)

# clear(): keep old timer rings as visual-only exit shells until their ranges finish the one shared animation duration.
needle5 = '''                for (\n                    const ring of\n                    this.querySelectorAll(\n                        ":scope > ring-container[data-clock-timer-ring]"\n                    )\n                ) {\n                    ring.remove();\n                }'''
replacement5 = '''                for (\n                    const ring of\n                    this.querySelectorAll(\n                        ":scope > ring-container[data-clock-timer-ring]"\n                    )\n                ) {\n                    ring.removeAttribute(\n                        "data-clock-timer-ring"\n                    );\n\n                    ring.setAttribute(\n                        "data-clock-timer-exiting-ring",\n                        ""\n                    );\n\n                    const ranges =\n                        Array.from(\n                            ring.querySelectorAll(\n                                ":scope > time-range"\n                            )\n                        );\n\n                    for (\n                        const range of ranges\n                    ) {\n                        if (\n                            typeof range.removeAnimated ===\n                                "function"\n                        ) {\n                            range.removeAnimated({\n                                collapseTo: "start"\n                            });\n                        }\n                        else {\n                            range.remove();\n                        }\n                    }\n\n                    const TimeRangeClass =\n                        customElements.get(\n                            "time-range"\n                        );\n\n                    const duration =\n                        TimeRangeClass\n                            ? TimeRangeClass.animationDuration\n                            : 0;\n\n                    setTimeout(\n                        () => ring.remove(),\n                        Math.max(\n                            0,\n                            duration\n                        )\n                    );\n                }'''
if needle5 not in ct:
    raise SystemExit('clear ring removal anchor not found')
ct = ct.replace(needle5, replacement5, 1)

ct_path.write_text(ct)
