from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text(encoding="utf-8")

old = '''                #time-layer {
                    position: absolute;

                    inset: 0;

                    display: grid;

                    place-items:
                        center;

                    z-index: 100;

                    pointer-events:
                        none;
                }

                #time {
                    display:
                        inline-block;

                    box-sizing:
                        border-box;

                    width:
                        fit-content;

                    height:
                        fit-content;

                    max-width:
                        100%;

                    max-height:
                        100%;

                    place-self:
                        center;
'''

new = '''                #time-layer {
                    position: absolute;

                    inset: 0;

                    display: flex;

                    align-items:
                        center;

                    justify-content:
                        center;

                    z-index: 100;

                    pointer-events:
                        none;
                }

                #time {
                    display:
                        inline-block;

                    box-sizing:
                        border-box;

                    width:
                        auto;

                    height:
                        auto;

                    max-width:
                        max-content;

                    max-height:
                        max-content;

                    flex:
                        0 0 auto;
'''

count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected exactly one ClockTimer time layout block, found {count}")

text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
