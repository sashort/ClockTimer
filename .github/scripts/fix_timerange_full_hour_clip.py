from pathlib import Path
import re

path = Path("TimeRange.js")
text = path.read_text()

method_pattern = re.compile(
    r"    #getCornerBetweenAngles\(.*?(?=    #getRingOriginTime\(\) \{)",
    re.S,
)

new_method = '''    #getCornersBetweenAngles(
        startAngle,
        endAngle,
        width,
        height
    ) {
        const normalize =
            angle =>
                (
                    (
                        angle %
                        360
                    ) +
                    360
                ) %
                360;

        const clockwiseDistance =
            (
                from,
                to
            ) =>
                (
                    normalize(
                        to
                    ) -
                    normalize(
                        from
                    ) +
                    360
                ) %
                360;

        const corners = [
            {
                x: 0,
                y: 0
            },
            {
                x: width,
                y: 0
            },
            {
                x: width,
                y: height
            },
            {
                x: 0,
                y: height
            }
        ];

        const totalDistance =
            clockwiseDistance(
                startAngle,
                endAngle
            );

        return corners
            .map(
                corner => {
                    const dx =
                        corner.x -
                        width /
                        2;

                    const dy =
                        corner.y -
                        height /
                        2;

                    const angle =
                        normalize(
                            Math.atan2(
                                dx,
                                -dy
                            ) *
                            180 /
                            Math.PI
                        );

                    return {
                        ...corner,
                        angle
                    };
                }
            )
            .filter(
                corner => {
                    const distance =
                        clockwiseDistance(
                            startAngle,
                            corner.angle
                        );

                    return (
                        distance > 0 &&
                        distance <
                            totalDistance
                    );
                }
            )
            .sort(
                (a, b) =>
                    clockwiseDistance(
                        startAngle,
                        a.angle
                    ) -
                    clockwiseDistance(
                        startAngle,
                        b.angle
                    )
            );
    }

'''

text, count = method_pattern.subn(lambda _: new_method, text, count=1)
if count != 1:
    raise SystemExit("Could not replace #getCornerBetweenAngles")

marker = '''        const ringOrigin =
            this.#getRingOriginTime();
'''
insert = '''        const duration =
            this.#endTime.getTime() -
            this.#startTime.getTime();

        if (
            duration >=
                60 * 60 * 1000
        ) {
            this.#styleElement.textContent = `
                :host {
                    clip-path: none;
                }
            `;

            return;
        }

        const ringOrigin =
            this.#getRingOriginTime();
'''
if marker not in text:
    raise SystemExit("Could not find ringOrigin marker")
text = text.replace(marker, insert, 1)

clip_tail_pattern = re.compile(
    r'''        const corner =\n            this\.#getCornerBetweenAngles\(.*?(?=    static #reorderParent\()''',
    re.S,
)

new_tail = '''        const corners =
            this.#getCornersBetweenAngles(
                startAngle,
                endAngle,
                width,
                height
            );

        const startX =
            startPoint.x /
            width *
            100;

        const startY =
            startPoint.y /
            height *
            100;

        const endX =
            endPoint.x /
            width *
            100;

        const endY =
            endPoint.y /
            height *
            100;

        const polygonPoints = [
            "50% 50%",
            `${startX}% ${startY}%`,
            ...corners.map(
                corner =>
                    `${
                        corner.x /
                        width *
                        100
                    }% ${
                        corner.y /
                        height *
                        100
                    }%`
            ),
            `${endX}% ${endY}%`
        ];

        this.#styleElement.textContent = `
            :host {
                clip-path: polygon(
                    ${polygonPoints.join(",\\n                    ")}
                );
            }
        `;
    }

'''

text, count = clip_tail_pattern.subn(lambda _: new_tail, text, count=1)
if count != 1:
    raise SystemExit("Could not replace clip-path tail")

path.write_text(text)
