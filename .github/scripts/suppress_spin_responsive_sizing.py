from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old_schedule = '''        #scheduleFontSizing() {
            if (
                this.#fontSizingFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#fontSizingFrame
                );
            }

            this.#fontSizingFrame =
                requestAnimationFrame(
                    () => {
                        this.#fontSizingFrame =
                            undefined;

                        if (
                            !this.isConnected
                        ) {
                            return;
                        }

                        this.#updateResponsiveFontSizes();
                    }
                );
        }

        #updateResponsiveFontSizes() {
            const rect =
'''

new_schedule = '''        #scheduleFontSizing() {
            if (
                this.#spinAnimation
            ) {
                return;
            }

            if (
                this.#fontSizingFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#fontSizingFrame
                );
            }

            this.#fontSizingFrame =
                requestAnimationFrame(
                    () => {
                        this.#fontSizingFrame =
                            undefined;

                        if (
                            !this.isConnected ||
                            this.#spinAnimation
                        ) {
                            return;
                        }

                        this.#updateResponsiveFontSizes();
                    }
                );
        }

        #updateResponsiveFontSizes() {
            if (
                this.#spinAnimation
            ) {
                return;
            }

            const rect =
'''

if old_schedule not in text:
    raise SystemExit("font sizing block not found")

text = text.replace(old_schedule, new_schedule, 1)

old_run_spin = '''            this.#freezeTimeFontForSpin();

            this.#spinAnimation
                ?.cancel();

            const animation =
'''

new_run_spin = '''            this.#freezeTimeFontForSpin();

            if (
                this.#fontSizingFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#fontSizingFrame
                );

                this.#fontSizingFrame =
                    undefined;
            }

            this.#spinAnimation
                ?.cancel();

            const animation =
'''

if old_run_spin not in text:
    raise SystemExit("spin start block not found")

text = text.replace(old_run_spin, new_run_spin, 1)

old_finish = '''                    this.#spinAnimation =
                        undefined;

                    this.#restoreTimeFontAfterSpin();
                });
'''

new_finish = '''                    this.#spinAnimation =
                        undefined;

                    this.#restoreTimeFontAfterSpin();

                    this.#scheduleFontSizing();
                });
'''

if old_finish not in text:
    raise SystemExit("spin finish block not found")

text = text.replace(old_finish, new_finish, 1)

path.write_text(text)
