from pathlib import Path
import subprocess
import sys

patch_path = Path('.github/scripts/refactor-numberpad-navigation.py')
text = patch_path.read_text()

old = r'''replace_block(
    "    tripSettingsDialog.querySelectorAll(\"[data-trip-time-field]\").forEach(button => {",
    "    tripSetStartsNow.addEventListener(\"pointerup\", () => {",
    """    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
        button.addEventListener("pointerup", () => {
            if (button.disabled) return;
            const field = button.dataset.tripTimeField;

            void (async () => {
                try {
                    await openTripFieldNumberPad(field);
                    if (!numberPadDialog?.open) return;
                    if (!closeDialog(tripSettingsDialog, {
                        reason: `trip-settings:${field}`,
                        immediate: true
                    })) {
                        await closeNumberPad({
                            discardPrepared: false,
                            allowChanged: true,
                            immediate: true,
                            destination: "none"
                        });
                    }
                }
                catch {}
            })();
        });
    });

""",
    "trip settings field handoff"
)
'''

new = r'''replace_once(
    """    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
        button.addEventListener("pointerup", () => {
            if (button.disabled) return;
            const field = button.dataset.tripTimeField;
            const caller = { type: "dialog", element: tripSettingsDialog };
            pushUIReturnFrame(caller);

            void (async () => {
                try {
                    await openTripFieldNumberPad(field);
                    if (!numberPadDialog?.open) {
                        popUIReturnFrame(caller);
                        return;
                    }
                    if (!closeDialog(tripSettingsDialog, {
                        reason: `trip-settings:${field}`,
                        immediate: true
                    })) {
                        popUIReturnFrame(caller);
                        await closeNumberPad({
                            discardPrepared: false,
                            allowChanged: true,
                            immediate: true,
                            returnToCaller: false
                        });
                    }
                }
                catch {
                    popUIReturnFrame(caller);
                }
            })();
        });
    });
""",
    """    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
        button.addEventListener("pointerup", () => {
            if (button.disabled) return;
            const field = button.dataset.tripTimeField;

            void (async () => {
                try {
                    await openTripFieldNumberPad(field);
                    if (!numberPadDialog?.open) return;
                    if (!closeDialog(tripSettingsDialog, {
                        reason: `trip-settings:${field}`,
                        immediate: true
                    })) {
                        await closeNumberPad({
                            discardPrepared: false,
                            allowChanged: true,
                            immediate: true,
                            destination: "none"
                        });
                    }
                }
                catch {}
            })();
        });
    });
""",
    "trip settings field handoff"
)
'''

if text.count(old) != 1:
    raise SystemExit(f'Expected one broad trip-field replacement, found {text.count(old)}')
patch_path.write_text(text.replace(old, new, 1))

subprocess.run([sys.executable, str(patch_path)], check=True)
