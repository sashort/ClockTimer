from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''            if (
                !Number.isFinite(
                    effectiveEnd
                ) ||
                effectiveEnd <= start
            ) {
                const ring =
                    this.#ensureRing(
                        this.#getTimerRingIndex(
                            start
                        )
                    );
'''

new = '''            if (
                Number.isFinite(
                    effectiveEnd
                ) &&
                effectiveEnd <= start
            ) {
                return;
            }

            if (
                !Number.isFinite(
                    effectiveEnd
                )
            ) {
                const ring =
                    this.#ensureRing(
                        this.#getTimerRingIndex(
                            start
                        )
                    );
'''

count = text.count(old)
if count != 1:
    raise SystemExit(
        f"expected one zero-length render branch, found {count}"
    )

text = text.replace(old, new, 1)
path.write_text(text)
