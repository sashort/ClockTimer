from pathlib import Path

# app.js
path = Path('app.js')
text = path.read_text()
replacements = {
    '        tripColor: "#0053e2",\n        breakColor: "#001e60",':
    '        tripColor: "#0053e2",\n        earlyStartColor: "#00a6d2",\n        showEarlyStart: true,\n        breakColor: "#001e60",',

    '        target.showTolerance = settings.showTolerance;\n        target.toggleAttribute("hide-break-buffer", !Boolean(settings.showBreakBuffer));':
    '        target.showTolerance = settings.showTolerance;\n        target.toggleAttribute("render-early-start-as-trip", !Boolean(settings.showEarlyStart));\n        target.toggleAttribute("hide-break-buffer", !Boolean(settings.showBreakBuffer));',

    '            "--clock-timer-trip-color": settings.tripColor,\n            "--clock-timer-break-color": settings.breakColor,':
    '            "--clock-timer-trip-color": settings.tripColor,\n            "--clock-timer-early-start-color": settings.earlyStartColor,\n            "--clock-timer-break-color": settings.breakColor,',

    '            tripColor: text("tripColor"),\n            breakColor: text("breakColor"),':
    '            tripColor: text("tripColor"),\n            earlyStartColor: text("earlyStartColor"),\n            showEarlyStart: form.elements.showEarlyStart.checked,\n            breakColor: text("breakColor"),',
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'app.js: expected one occurrence, found {count}: {old!r}')
    text = text.replace(old, new)
path.write_text(text)

# index.html
path = Path('index.html')
text = path.read_text()
old = '''                            <div class="timer-color-row">
                                <label for="tripColor">Trip</label>
                                <input id="tripColor" name="tripColor" type="color" value="#0053e2">
                            </div>
                            <div class="timer-color-row">
                                <label for="lunchColor">Lunch</label>
'''
new = '''                            <div class="timer-color-row">
                                <label for="tripColor">Trip</label>
                                <input id="tripColor" name="tripColor" type="color" value="#0053e2">
                            </div>
                            <div class="timer-color-row with-toggle">
                                <label for="earlyStartColor">Early Start</label>
                                <input name="showEarlyStart" type="checkbox" checked aria-label="Show Early Start color">
                                <input id="earlyStartColor" name="earlyStartColor" type="color" value="#00a6d2" aria-label="Early Start color">
                            </div>
                            <div class="timer-color-row">
                                <label for="lunchColor">Lunch</label>
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'index.html: expected one Trip/Lunch insertion point, found {count}')
text = text.replace(old, new)
path.write_text(text)

# app.css
path = Path('app.css')
text = path.read_text()
old = '''clock-timer time-range[type="trip"] {
    background: var(--clock-timer-trip-color, #0053e2);
}

clock-timer time-range[type="break"] {
'''
new = '''clock-timer time-range[type="trip"] {
    background: var(--clock-timer-trip-color, #0053e2);
}

clock-timer time-range[type="earlystart"] {
    background: var(--clock-timer-early-start-color, #00a6d2);
}

clock-timer[render-early-start-as-trip] time-range[type="earlystart"] {
    background: var(--clock-timer-trip-color, #0053e2);
}

clock-timer time-range[type="break"] {
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'app.css: expected one Trip/Break block, found {count}')
text = text.replace(old, new)
path.write_text(text)
