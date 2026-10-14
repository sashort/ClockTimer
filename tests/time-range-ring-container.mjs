import fs from "node:fs";
import assert from "node:assert/strict";
import {Window} from "happy-dom";

const window =
    new Window({
        url:
            "https://clock.example/"
    });

window.__testTime =
    Date.parse(
        "2026-09-22T12:00:00Z"
    );

window.eval(`
    const RealDate = Date;

    window.Date =
        class extends RealDate {
            constructor(...args) {
                super(
                    ...(
                        args.length
                            ? args
                            : [window.__testTime]
                    )
                );
            }

            static now() {
                return window.__testTime;
            }
        };
`);

window.requestAnimationFrame =
    callback =>
        setTimeout(
            () =>
                callback(
                    window.performance.now() +
                    1000
                ),
            0
        );

window.cancelAnimationFrame =
    id =>
        clearTimeout(
            id
        );

const css =
    window.CSS;

css.registerProperty =
    () => {};

Object.defineProperty(
    window,
    "CSS",
    {
        value:
            css
    }
);

for (
    const name of
        [
            "TemporalFormat",
            "RingContainer",
            "TimeRangeModel", "TimeRangeElement"
        ]
) {
    window.eval(
        fs.readFileSync(
            new URL(
                "../" +
                name +
                ".js",
                import.meta.url
            ),
            "utf8"
        )
    );
}

const RingContainer =
    window.customElements.get(
        "ring-container"
    );

const TimeRange =
    window.customElements.get(
        "time-range"
    );

assert(
    RingContainer,
    "ring-container is registered"
);

assert(
    TimeRange,
    "time-range is registered"
);

assert(
    window.customElements.get(
        "ring-layer"
    ),
    "ring-layer is registered"
);

assert.equal(
    TimeRange.calculateTimeAngle,
    undefined,
    "TimeRange no longer owns angle calculations"
);

assert.equal(
    TimeRange.calculateClipPath,
    undefined,
    "TimeRange no longer owns clip-path calculations"
);

const semicircle =
    RingContainer
        .calculateAnnularClipPath({
            startAngle:
                0,
            endAngle:
                180,
            inset:
                "10px",
            radialWidth:
                "8px"
        });

assert.match(
    semicircle,
    /large cw/,
    "exactly 180 degrees uses the explicit semicircle arc path"
);

assert.match(
    semicircle,
    /large ccw/,
    "the inner 180 degree arc reverses direction"
);

const fullCircle =
    RingContainer
        .calculateAnnularClipPath({
            startAngle:
                0,
            endAngle:
                360,
            inset:
                "10px",
            radialWidth:
                "8px"
        });

assert.equal(
    (
        fullCircle.match(
            /large cw/g
        ) ??
        []
    ).length,
    2,
    "a full circle uses two outer 180 degree arcs"
);

assert.equal(
    (
        fullCircle.match(
            /large ccw/g
        ) ??
        []
    ).length,
    2,
    "a full circle uses two inner 180 degree arcs"
);

const ring =
    window.document
        .createElement(
            "ring-container"
        );

ring.setAttribute(
    "width",
    "12px"
);

window.document.body
    .appendChild(
        ring
    );

const existing =
    window.document
        .createElement(
            "time-range"
        );

existing.setAttribute(
    "type",
    "trip"
);

existing.setAttribute(
    "start-time",
    "2026-09-22 12:00:00.000"
);

existing.setAttribute(
    "end-time",
    "2026-09-22 13:00:00.000"
);

existing.timeRangeFullEntry =
    true;

ring.appendChild(
    existing
);

// Interval conflicts are validated in the model rather than rewritten by a DOM element.
const originalModel = existing.model;
assert.throws(() => window.TimeRange.create({group: originalModel.group, type: 'Fixed',
    start: new window.Date('2026-09-22T12:20:00Z'), end: new window.Date('2026-09-22T12:30:00Z')}), /overlap/);
let change;
ring.addEventListener('time-range-changed', event => { change = event.detail; });
existing.transitionTo({startTime: new window.Date('2026-09-22T12:10:00Z'),
    endTime: new window.Date('2026-09-22T13:10:00Z')});
assert.equal(change.range, existing);
assert.equal(change.after.rangeLength, 3600000);
assert.equal(existing.model, originalModel, 'Rendering changes preserve model identity');

const elapsed =
    window.document
        .createElement(
            "time-range"
        );

elapsed.setAttribute(
    "type",
    "elapsed"
);

elapsed.setAttribute(
    "start-time",
    "2026-09-22 12:00:00.000"
);

elapsed.setAttribute(
    "end-time",
    "2026-09-22 12:45:00.000"
);

ring.appendChild(
    elapsed
);

const remaining =
    window.document
        .createElement(
            "time-range"
        );

remaining.setAttribute(
    "type",
    "remaining"
);

remaining.setAttribute(
    "start-time",
    "2026-09-22 12:15:00.000"
);

remaining.setAttribute(
    "end-time",
    "2026-09-22 13:00:00.000"
);

ring.appendChild(
    remaining
);

assert(
    elapsed.isConnected &&
    remaining.isConnected,
    "different logical layers do not collide"
);

assert.notEqual(
    elapsed.getAttribute(
        "slot"
    ),
    remaining.getAttribute(
        "slot"
    ),
    "RingContainer assigns distinct logical layer slots"
);

assert.equal(
    existing.shadowRoot,
    null,
    "TimeRange has no rendering shadow tree"
);

assert(
    Number(existing.style.zIndex) >
        Number(elapsed.style.zIndex),
    "base/history layer stays above the elapsed logical layer"
);

assert(
    Number(existing.style.zIndex) >
        Number(remaining.style.zIndex),
    "base/history layer stays above the remaining logical layer"
);

console.log(
    "PASS model interval validation, generic presentation changes, and RingContainer annular layers"
);

ring.remove();
window.happyDOM.abort();
