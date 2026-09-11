from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
start=s.index('        stop() {')
end=s.index('\n        closeOpenRange() {', start)
new='''        stop() {
            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );

                this.#queueAsyncOperation({
                    type: "stop"
                });

                return true;
            }

            const wasRunning =
                this.#started;

            const hadOpenRange =
                Boolean(
                    this.#openEndedRange ||
                    this.#openOverwriteRange
                );

            if (!wasRunning && !hadOpenRange) {
                return false;
            }

            if (hadOpenRange) {
                this.closeOpenRange();
            }

            const now =
                wasRunning
                    ? this.#getCurrentTimelineTime()
                    : undefined;

            this.#started =
                false;

            this.#stopTickTimer();

            this.#setIndicatorSymbolVisible(
                false
            );

            this.#refreshRingLayout(
                now,
                { refreshTickMarks: true }
            );

            return true;
        }
'''
s=s[:start]+new+s[end:]
needle='''                        case "start":
                            this.start(operation.args);
                            break;
'''
assert needle in s
replacement=needle+'''\n                        case "stop":\n                            this.stop();\n                            break;\n'''
s=s.replace(needle,replacement,1)
p.write_text(s)
