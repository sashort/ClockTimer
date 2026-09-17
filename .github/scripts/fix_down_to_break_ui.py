from pathlib import Path

path = Path('app.js')
text = path.read_text()

old = '''    breakDialog.querySelectorAll("[data-break-type]").forEach(button => {
        button.addEventListener("click", () => {
            const startPromise =
                startBreakInterval(
                    button.dataset.breakType
                );

            closeDialog(
                breakDialog,
                { reason: "break-type-selected" }
            );

            void startPromise.catch(() => {});
        });
    });'''
new = '''    breakDialog.querySelectorAll("[data-break-type]").forEach(button => {
        button.addEventListener("click", async event => {
            event.preventDefault();

            const breakType =
                button.dataset.breakType;

            closeDialog(
                breakDialog,
                { reason: "break-type-selected" }
            );

            try {
                await startBreakInterval(
                    breakType
                );
            }
            catch {
                updateSummaryValues();
                renderTripActionState();
            }
        });
    });'''

if text.count(old) != 1:
    raise SystemExit(f'break dialog handler count: {text.count(old)}')
text = text.replace(old, new, 1)

old = '''        const active = clockTimer.getActiveIntervalState?.(new Date());
        if (String(active?.intervalType || "").toLowerCase() === "down") {
            await clockTimer.endInterval();
        }

        const result = await clockTimer.startInterval(
            config.type,
            config.length,
            config.attributes,
            "2:30",
            "2:30"
        );
        return Boolean(result);'''
new = '''        const active = clockTimer.getActiveIntervalState?.(new Date());
        if (String(active?.intervalType || "").toLowerCase() === "down") {
            const ended =
                await clockTimer.endInterval();

            updateSummaryValues();
            renderTripActionState();

            if (!ended) {
                return false;
            }
        }

        const result = await clockTimer.startInterval(
            config.type,
            config.length,
            config.attributes,
            "2:30",
            "2:30"
        );

        updateSummaryValues();
        renderTripActionState();

        return Boolean(result);'''

if text.count(old) != 1:
    raise SystemExit(f'startBreakInterval handoff count: {text.count(old)}')
text = text.replace(old, new, 1)

path.write_text(text)
