from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

old = '''                                state.indicatorTrackAnimation =
                                    undefined;

                                this.#releaseTimerTypeIndicator(
                                    state
                                );
'''
new = '''                                state.indicatorTrackAnimation =
                                    undefined;

                                this.#startTimerTypeIndicatorOutward(
                                    state
                                );
'''

count = text.count(old)
if count != 1:
    raise SystemExit(f"expected 1 completion match, found {count}")

path.write_text(text.replace(old, new, 1))
