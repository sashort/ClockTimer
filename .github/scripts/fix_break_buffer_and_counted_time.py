from pathlib import Path

# app.js
path = Path('app.js')
text = path.read_text()
replacements = {
    '        breakColor: "#001e60",\n        lunchColor: "#ffc420",\n        downColor: "#5f6772",':
    '        breakColor: "#001e60",\n        lunchColor: "#ffc420",\n        breakBufferColor: "#6b7f99",\n        showBreakBuffer: true,\n        downColor: "#5f6772",',

    '        target.showTolerance = settings.showTolerance;\n        target.toggleAttribute("hide-latency", !Boolean(settings.showLatency));':
    '        target.showTolerance = settings.showTolerance;\n        target.toggleAttribute("hide-break-buffer", !Boolean(settings.showBreakBuffer));\n        target.toggleAttribute("hide-latency", !Boolean(settings.showLatency));',

    '            "--clock-timer-break-color": settings.breakColor,\n            "--clock-timer-lunch-color": settings.lunchColor,\n            "--clock-timer-down-color": settings.downColor,':
    '            "--clock-timer-break-color": settings.breakColor,\n            "--clock-timer-lunch-color": settings.lunchColor,\n            "--clock-timer-break-buffer-color": settings.breakBufferColor,\n            "--clock-timer-down-color": settings.downColor,',

    '            breakColor: text("breakColor"),\n            lunchColor: text("lunchColor"),\n            downColor: text("downColor"),':
    '            breakColor: text("breakColor"),\n            lunchColor: text("lunchColor"),\n            breakBufferColor: text("breakBufferColor"),\n            showBreakBuffer: form.elements.showBreakBuffer.checked,\n            downColor: text("downColor"),',
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'app.js: expected exactly one occurrence of {old!r}, found {count}')
    text = text.replace(old, new)
path.write_text(text)

# index.html
path = Path('index.html')
text = path.read_text()
old = '''                            <div class="timer-color-row">
                                <label for="breakColor">Break</label>
                                <input id="breakColor" name="breakColor" type="color" value="#001e60">
                            </div>
                            <div class="timer-color-row">
                                <label for="lunchColor">Lunch</label>
                                <input id="lunchColor" name="lunchColor" type="color" value="#ffc420">
                            </div>
'''
new = '''                            <div class="timer-color-row">
                                <label for="lunchColor">Lunch</label>
                                <input id="lunchColor" name="lunchColor" type="color" value="#ffc420">
                            </div>
                            <div class="timer-color-row">
                                <label for="breakColor">Break</label>
                                <input id="breakColor" name="breakColor" type="color" value="#001e60">
                            </div>
                            <div class="timer-color-row with-toggle">
                                <label for="breakBufferColor">Break Buffer</label>
                                <input name="showBreakBuffer" type="checkbox" checked aria-label="Show Break Buffer">
                                <input id="breakBufferColor" name="breakBufferColor" type="color" value="#6b7f99" aria-label="Break Buffer color">
                            </div>
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'index.html: expected timer color block once, found {count}')
text = text.replace(old, new)
path.write_text(text)

# app.css
path = Path('app.css')
text = path.read_text()
old = '''clock-timer time-range[type="lunch"] {
    background: var(--clock-timer-lunch-color, #ffc420);
}

clock-timer time-range[type="down"] {
'''
new = '''clock-timer time-range[type="lunch"] {
    background: var(--clock-timer-lunch-color, #ffc420);
}

clock-timer time-range[type="buffer"] {
    background: var(--clock-timer-break-buffer-color, #6b7f99);
}

clock-timer[hide-break-buffer] time-range[type="buffer"] {
    background: transparent !important;
}

clock-timer time-range[type="down"] {
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'app.css: expected lunch/down block once, found {count}')
text = text.replace(old, new)
path.write_text(text)

# ClockTimer.js
path = Path('ClockTimer.js')
text = path.read_text()
old = '''            const remainingMilliseconds = allowedTimeMilliseconds - actualTimeMilliseconds;

            let renderedTime;
            if (this.#renderedTimeMode === "elapsed") {
                renderedTime = this.#formatElapsedRenderedDuration(actualTimeMilliseconds);
'''
new = '''            const remainingMilliseconds = allowedTimeMilliseconds - countedTimeMilliseconds;

            let renderedTime;
            if (this.#renderedTimeMode === "elapsed") {
                renderedTime = this.#formatElapsedRenderedDuration(countedTimeMilliseconds);
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'ClockTimer.js: expected total rendered-time block once, found {count}')
text = text.replace(old, new)
path.write_text(text)
