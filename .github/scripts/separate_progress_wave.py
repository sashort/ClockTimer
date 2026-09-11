from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} not found')
    return text.replace(old, new, 1)


clock_path = Path('ClockTimer.js')
clock = clock_path.read_text()

clock = replace_once(
    clock,
    '        #clockFace;\n\n        #faceBackground;',
    '        #clockFace;\n\n        #ringLayer;\n\n        #faceBackground;',
    'ring layer field'
)

clock = replace_once(
    clock,
    '        #remainingRanges =\n            new Map();\n\n        #elapsedRange;',
    '        #remainingRanges =\n            new Map();\n\n        #waveRing;\n\n        #waveRange;\n\n        #elapsedRange;',
    'wave fields'
)

clock = replace_once(
    clock,
    '            const ringLayer =\n                document.createElement(\n                    "div"\n                );\n\n            ringLayer.id =\n                "rings";',
    '            const ringLayer =\n                document.createElement(\n                    "div"\n                );\n\n            this.#ringLayer =\n                ringLayer;\n\n            ringLayer.id =\n                "rings";',
    'ring layer assignment'
)

handle_start = clock.index('        #handleTimerModeChange() {')
handle_end = clock.index('        #ensureBorderRing() {', handle_start)
new_handle = '''        #handleTimerModeChange() {
            const mode =
                this.#normalizeTimerMode();

            if (mode !== "remaining") {
                this.#removeRemainingRanges();
                this.#syncWaveRange();
                return;
            }

            let start;

            if (this.#started) {
                start =
                    this.#getCurrentTimelineTime();
            }
            else {
                for (
                    const range of
                        this.querySelectorAll(
                            "time-range.elapsed"
                        )
                ) {
                    const end =
                        Number(
                            range.clockTimerEnd
                        );

                    if (
                        Number.isFinite(end) &&
                        (
                            !Number.isFinite(start) ||
                            end > start
                        )
                    ) {
                        start = end;
                    }
                }
            }

            if (Number.isFinite(start)) {
                this.#updateRemainingRanges(
                    start
                );
            }

            this.#syncWaveRange();
        }

        #findWaveSourceRange() {
            if (
                this.#started &&
                this.#elapsedRange?.isConnected
            ) {
                return this.#elapsedRange;
            }

            if (
                this.#getTimerMode() !==
                    "remaining"
            ) {
                return undefined;
            }

            let selected;
            let selectedEnd =
                -Infinity;

            for (
                const range of
                    this.querySelectorAll(
                        "time-range.elapsed"
                    )
            ) {
                if (!range.isConnected) {
                    continue;
                }

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(end) &&
                    end > selectedEnd
                ) {
                    selected = range;
                    selectedEnd = end;
                }
            }

            return selected;
        }

        #ensureWaveRing(
            sourceRing
        ) {
            if (
                !sourceRing ||
                sourceRing.localName !==
                    "ring-container" ||
                !this.#ringLayer
            ) {
                return undefined;
            }

            if (!this.#waveRing) {
                const ring =
                    document.createElement(
                        "ring-container"
                    );

                ring.id =
                    "progress-wave-ring";

                ring.clockTimerInternalWave =
                    "";

                ring.style.position =
                    "absolute";

                ring.style.inset =
                    "0";

                ring.style.width =
                    "100%";

                ring.style.height =
                    "100%";

                ring.style.zIndex =
                    "100";

                ring.style.pointerEvents =
                    "none";

                ring.style.background =
                    "transparent";

                ring.resizeDuration =
                    "0ms";

                ring.resizeFilter =
                    "none";

                ring.reorderFilter =
                    "none";

                ring.connectFilter =
                    "none";

                ring.disconnectFilter =
                    "none";

                ring.filterRamp =
                    false;

                ring.filterRampFront =
                    "0ms";

                ring.filterRampEnd =
                    "0ms";

                ring.filterRampConnect =
                    "0ms";

                ring.filterRampDisconnect =
                    "0ms";

                this.#ringLayer.appendChild(
                    ring
                );

                this.#waveRing =
                    ring;
            }

            const ring =
                this.#waveRing;

            ring.style.display =
                "block";

            ring.clockTimerRing =
                "";

            ring.clockTimerRingIndex =
                sourceRing.clockTimerRingIndex ??
                "";

            const inset =
                sourceRing.renderedInset ??
                sourceRing.getAttribute(
                    "inset"
                ) ??
                "0px";

            const width =
                sourceRing.renderedWidth ??
                sourceRing.getAttribute(
                    "width"
                ) ??
                "0px";

            if (
                ring.getAttribute(
                    "inset"
                ) !== inset
            ) {
                ring.setAttribute(
                    "inset",
                    inset
                );
            }

            if (
                ring.getAttribute(
                    "width"
                ) !== width
            ) {
                ring.setAttribute(
                    "width",
                    width
                );
            }

            ring.toggleAttribute(
                "active",
                sourceRing.hasAttribute(
                    "active"
                )
            );

            return ring;
        }

        #removeWaveRange() {
            if (this.#waveRange) {
                this.#waveRange.remove();
                this.#waveRange =
                    undefined;
            }

            if (this.#waveRing) {
                this.#waveRing.style.display =
                    "none";
            }
        }

        #syncWaveRange() {
            const source =
                this.#findWaveSourceRange();

            if (!source) {
                this.#removeWaveRange();
                return;
            }

            const start =
                Number(
                    source.clockTimerStart
                );

            const end =
                Number(
                    source.clockTimerEnd
                );

            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                this.#removeWaveRange();
                return;
            }

            const ring =
                this.#ensureWaveRing(
                    source.parentElement
                );

            if (!ring) {
                this.#removeWaveRange();
                return;
            }

            let range =
                this.#waveRange;

            if (
                !range ||
                range.parentElement !== ring
            ) {
                range =
                    document.createElement(
                        "time-range"
                    );

                range.setAttribute(
                    "type",
                    "wave"
                );

                range.setAttribute(
                    "overlapping",
                    ""
                );

                range.setAttribute(
                    "start-time",
                    this.#formatTimelineTime(
                        start
                    )
                );

                range.setAttribute(
                    "end-time",
                    this.#formatTimelineTime(
                        end
                    )
                );

                range.clockTimerStart =
                    String(start);

                range.clockTimerEnd =
                    String(end);

                range.clockTimerInternalWave =
                    "";

                range.timeRangeFullEntry =
                    true;

                ring.appendChild(
                    range
                );

                this.#waveRange =
                    range;
            }
            else {
                this.#setRangeStart(
                    range,
                    start
                );

                this.#setRangeEnd(
                    range,
                    end
                );
            }

            range.snapToLogicalTiming?.();
            range.refreshVisualGeometry?.();
        }

'''
clock = clock[:handle_start] + new_handle + clock[handle_end:]

clock = replace_once(
    clock,
    '''                range.setAttribute(
                    "overlapping",
                    ""
                );

                range.setAttribute(
                    "timer-mode",
                    this.#getTimerMode()
                );''',
    '''                range.setAttribute(
                    "overlapping",
                    ""
                );''',
    'remove mirrored timer mode'
)

clock = replace_once(
    clock,
    '''                        if (
                            this.#getTimerMode() ===
                                "elapsed"
                        ) {
                            elapsedRange.setAttribute(
                                "static-elapsed",
                                ""
                            );
                        }

''',
    '',
    'remove imported static elapsed flag'
)

clock = replace_once(
    clock,
    '''                        "elapsed",
                        "remaining"
                    ]);''',
    '''                        "elapsed",
                        "remaining",
                        "wave"
                    ]);''',
    'reserve wave type'
)

clock = replace_once(
    clock,
    '''            this.#scheduleHourRender();
            this.#scheduleIndicatorSymbolUpdate();

            if (
                !this.hasAttribute(''',
    '''            this.#scheduleHourRender();
            this.#scheduleIndicatorSymbolUpdate();
            this.#syncWaveRange();

            if (
                !this.hasAttribute(''',
    'sync wave during layout'
)

clock = replace_once(
    clock,
    '''            this.#elapsedRange =
                undefined;

            for (
                const [ringIndex, range] of
                    this.#overtimeRanges''',
    '''            this.#elapsedRange =
                undefined;

            this.#removeWaveRange();

            for (
                const [ringIndex, range] of
                    this.#overtimeRanges''',
    'remove wave on stop'
)

clear_marker = '''            this.#elapsedRange =
                undefined;

            this.#overtimeRanges.clear();

            this.#remainingRanges.clear();'''
if clear_marker in clock:
    clock = clock.replace(
        clear_marker,
        clear_marker + '''

            this.#removeWaveRange();''',
        1
    )
else:
    raise SystemExit('clear wave marker not found')

clock_path.write_text(clock)


time_path = Path('TimeRange.js')
time = time_path.read_text()

time = replace_once(
    time,
    '''    #contourLayer;
    #elapsedBaseLayer;
    #elapsedEdgeLayer;
    #elapsedWaveLayer;''',
    '''    #contourLayer;
    #elapsedWaveLayer;''',
    'wave field declarations'
)

css_start = time.index('            #elapsed-base,')
css_end_marker = '            @keyframes elapsed-wave-sweep {'
keyframe_start = time.index(css_end_marker, css_start)
# Find the end of the keyframes block by locating the template terminator after it.
template_end = time.index('        `;', keyframe_start)
keyframes = time[keyframe_start:template_end]
new_css = '''            #elapsed-wave {
                position: absolute;
                inset: 0;
                display: none;
                pointer-events: none;
                background-repeat: no-repeat;
                transform-origin: 50% 50%;
                will-change: transform;
            }

            :host(.elapsed),
            :host(.remaining) {
                background-color:
                    rgb(255 255 255 / 25%);
                animation: none !important;
                transition: none !important;
            }

            :host(.elapsed):host-context(clock-timer[timer-mode="remaining"]) {
                display: none !important;
            }

            :host([type="wave"]) {
                animation: none !important;
                transition: none !important;
                background: transparent !important;
                background-color: transparent !important;
                background-image: none !important;
            }

            :host([type="wave"]) #elapsed-wave {
                display: block;
                animation: elapsed-wave-sweep 4.5s linear infinite;
            }

''' + keyframes

time = time[:css_start] + new_css + time[template_end:]

base_start = time.index('        this.#elapsedBaseLayer =')
base_end = time.index('        this.#styleElement =', base_start)
new_layers = '''        this.#elapsedWaveLayer =
            document.createElement(
                "div"
            );

        this.#elapsedWaveLayer.id =
            "elapsed-wave";

'''
time = time[:base_start] + new_layers + time[base_end:]

time = replace_once(
    time,
    '''            this.#styleElement,
            this.#contourLayer,
            this.#elapsedBaseLayer,
            this.#elapsedEdgeLayer,
            this.#elapsedWaveLayer''',
    '''            this.#styleElement,
            this.#contourLayer,
            this.#elapsedWaveLayer''',
    'shadow append layers'
)

observer_start = time.index('    #startAppearanceObserver() {')
observer_end = time.index('    #stopAppearanceObserver() {', observer_start)
new_observer = '''    #startAppearanceObserver() {
        this.#stopAppearanceObserver();

        this.#appearanceObserver =
            new MutationObserver(
                mutations => {
                    if (
                        mutations.some(
                            mutation =>
                                mutation.type === "attributes" ||
                                mutation.type === "childList"
                        )
                    ) {
                        this.#scheduleAppearanceRefresh();
                    }
                }
            );

        this.#appearanceObserver.observe(
            this,
            {
                attributes: true
            }
        );

        const parent =
            this.parentElement;

        if (parent) {
            this.#appearanceObserver.observe(
                parent,
                {
                    attributes: true,
                    childList: true,
                    subtree: true
                }
            );
        }

        const root =
            this.getRootNode();

        const clockTimer =
            root?.host?.localName ===
                "clock-timer"
                ? root.host
                : undefined;

        if (clockTimer) {
            this.#appearanceObserver.observe(
                clockTimer,
                {
                    attributes: true,
                    childList: true,
                    subtree: true
                }
            );
        }
    }

'''
time = time[:observer_start] + new_observer + time[observer_end:]

appearance_start = time.index('    #updateElapsedWaveAppearance() {')
appearance_end = time.index('    #updateContour() {', appearance_start)
new_appearance = '''    #updateElapsedWaveAppearance() {
        if (!this.#elapsedWaveLayer) {
            return;
        }

        if (
            this.getAttribute(
                "type"
            ) !== "wave"
        ) {
            this.#elapsedWaveLayer.style.backgroundImage =
                "none";

            return;
        }

        const root =
            this.getRootNode();

        const clockTimer =
            root?.host?.localName ===
                "clock-timer"
                ? root.host
                : undefined;

        const sourceRingIndex =
            this.parentElement
                ?.clockTimerRingIndex;

        let sourceRing;

        if (clockTimer) {
            for (
                const ring of
                    clockTimer.querySelectorAll(
                        ":scope > ring-container"
                    )
            ) {
                if (
                    String(
                        ring.clockTimerRingIndex ??
                        ""
                    ) ===
                    String(
                        sourceRingIndex ??
                        ""
                    )
                ) {
                    sourceRing = ring;
                    break;
                }
            }
        }

        const sources =
            sourceRing
                ? Array.from(
                    sourceRing.querySelectorAll(
                        ":scope > time-range"
                    )
                )
                : [];

        let darkestLuminance = 1;
        let lightestLuminance = 0;
        let hasUnderlay = false;
        let strongestOpacity = 0;

        const channel =
            value => {
                const normalized =
                    value / 255;

                return normalized <= 0.04045
                    ? normalized / 12.92
                    : Math.pow(
                        (normalized + 0.055) / 1.055,
                        2.4
                    );
            };

        for (const range of sources) {
            const style =
                getComputedStyle(
                    range
                );

            if (
                style.display === "none" ||
                style.visibility === "hidden"
            ) {
                continue;
            }

            const opacityValue =
                Number.parseFloat(
                    style.opacity
                );

            const opacity =
                Number.isFinite(
                    opacityValue
                )
                    ? Math.min(
                        1,
                        Math.max(
                            0,
                            opacityValue
                        )
                    )
                    : 1;

            if (opacity <= 0) {
                continue;
            }

            const color =
                this.#parseComputedColor(
                    style.backgroundColor
                );

            if (
                color &&
                color.alpha > 0
            ) {
                const luminance =
                    0.2126 * channel(color.red) +
                    0.7152 * channel(color.green) +
                    0.0722 * channel(color.blue);

                darkestLuminance =
                    Math.min(
                        darkestLuminance,
                        luminance
                    );

                lightestLuminance =
                    Math.max(
                        lightestLuminance,
                        luminance
                    );

                strongestOpacity =
                    Math.max(
                        strongestOpacity,
                        opacity * color.alpha
                    );

                hasUnderlay =
                    true;
            }
            else if (
                style.backgroundImage !==
                    "none"
            ) {
                hasUnderlay =
                    true;

                strongestOpacity =
                    Math.max(
                        strongestOpacity,
                        opacity
                    );
            }
        }

        const contrastRange =
            hasUnderlay
                ? lightestLuminance -
                    darkestLuminance
                : 0;

        let strength =
            hasUnderlay
                ? 0.48 +
                    (1 - strongestOpacity) *
                        0.18 +
                    contrastRange *
                        0.16
                : 0.58;

        strength =
            Math.min(
                0.82,
                Math.max(
                    0.46,
                    strength
                )
            );

        const shoulder =
            strength * 0.38;

        const rgba =
            alpha =>
                `rgba(255, 255, 255, ${alpha.toFixed(3)})`;

        this.#elapsedWaveLayer.style.mixBlendMode =
            "screen";

        this.#elapsedWaveLayer.style.backgroundImage =
            `conic-gradient(from 0deg at 50% 50%, ` +
            `transparent 0deg, ` +
            `transparent calc(180deg - var(--elapsed-wave-width, 12deg)), ` +
            `${rgba(shoulder)} calc(180deg - var(--elapsed-wave-shoulder, 4deg)), ` +
            `${rgba(strength)} 180deg, ` +
            `${rgba(shoulder)} calc(180deg + var(--elapsed-wave-shoulder, 4deg)), ` +
            `transparent calc(180deg + var(--elapsed-wave-width, 12deg)), ` +
            `transparent 360deg)`;
    }

'''
time = time[:appearance_start] + new_appearance + time[appearance_end:]

# Move geometry-driven wave sizing from public elapsed ranges to the internal wave range.
time = time.replace(
    'this.getAttribute("type") ===\n                    "elapsed"',
    'this.getAttribute("type") ===\n                    "wave"'
)

# Remaining and internal wave timing updates must snap immediately.
time = replace_once(
    time,
    '''            this.getAttribute(
                "type"
            ) === "remaining"
        ) {''',
    '''            [
                "remaining",
                "wave"
            ].includes(
                this.getAttribute(
                    "type"
                )
            )
        ) {''',
    'instant remaining/wave timing'
)

# No legacy per-range timer-mode or static-elapsed behavior should remain.
if 'timer-mode="remaining"' in time or 'static-elapsed' in time:
    raise SystemExit('legacy elapsed timer-mode/static-elapsed styling remains')
if '#elapsedBaseLayer' in time or '#elapsedEdgeLayer' in time:
    raise SystemExit('legacy elapsed base/edge layers remain')

time_path.write_text(time)
