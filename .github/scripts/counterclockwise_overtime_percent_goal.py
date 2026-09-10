from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '''        #handlePercentGoalChange() {
            const goal =
                this.#getPercentGoal();

            this.#percentGoal =
                goal;
'''
new = '''        #handlePercentGoalChange() {
            const goal =
                this.#getPercentGoal();

            const previousGoal =
                this.#percentGoal;

            const counterclockwiseOvertimeRemoval =
                previousGoal < 1 &&
                goal >= 1;

            this.#percentGoal =
                goal;
'''
if old not in text:
    raise SystemExit('percent goal handler header not found')
text = text.replace(old, new, 1)

handler_start = text.index('        #handlePercentGoalChange() {')
handler_end = text.find('\n        #', handler_start + 10)
if handler_end == -1:
    raise SystemExit('percent goal handler end not found')
handler = text[handler_start:handler_end]
old_call = '            this.#reconcilePlannedRanges();'
new_call = '''            this.#reconcilePlannedRanges({
                counterclockwiseOvertimeRemoval
            });'''
if old_call not in handler:
    raise SystemExit('reconcile call not found in percent goal handler')
handler = handler.replace(old_call, new_call, 1)
text = text[:handler_start] + handler + text[handler_end:]

old_sig = '''        #reconcilePlannedRanges() {'''
new_sig = '''        #reconcilePlannedRanges({
            counterclockwiseOvertimeRemoval = false
        } = {}) {'''
if old_sig not in text:
    raise SystemExit('reconcile signature not found')
text = text.replace(old_sig, new_sig, 1)

reconcile_start = text.index(new_sig)
reconcile_end = text.find('\n        #', reconcile_start + len(new_sig))
if reconcile_end == -1:
    raise SystemExit('reconcile method end not found')
reconcile = text[reconcile_start:reconcile_end]

old_remove = '''                    range.removeAnimated({
                        collapseTo: "end"
                    });'''
new_remove = '''                    range.removeAnimated({
                        collapseTo:
                            counterclockwiseOvertimeRemoval &&
                            range.getAttribute("type") ===
                                "overtime"
                                ? "start"
                                : "end"
                    });'''
if old_remove not in reconcile:
    raise SystemExit('unused planned-range removal not found')
reconcile = reconcile.replace(old_remove, new_remove, 1)
text = text[:reconcile_start] + reconcile + text[reconcile_end:]

path.write_text(text)
