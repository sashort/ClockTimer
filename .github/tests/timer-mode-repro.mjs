import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const htmlPath = path.join(root, 'timer-mode-repro.html');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClockTimer timer-mode repro</title>
  <script src="TemporalFormat.js"></script>
  <script src="RingContainer.js"></script>
  <script src="ClockTimer.js"></script>
  <script src="TimeRange.js"></script>
</head>
<body>
  <clock-timer visible-hours="12,3,6,9" time-format="h:mm" date-format="m/d/yy" military-time="false" tick-marks="[10]" indicator-symbol timer-mode="remaining"></clock-timer>
  <style>
    body {
      container-type: size;
      display: grid;
      grid-template-rows: 100dvh;
      grid-template-columns: 100dvw;
      height: 100dvh;
      width: 100dvw;
      box-sizing: border-box;
      margin: 0;
    }
    * { box-sizing: border-box; }
    body * { grid-row: 1; grid-column: 1; }
    clock-timer {
      --clock-timer-border-width: .125rem;
      --clock-timer-border-color: #001e60;
      --clock-timer-active-ring-width: 2px;
      --clock-timer-inactive-ring-width: 6px;
      background-color: #0053e2;
      --clock-timer-tick-color: white;
    }
    clock-timer .hour-number {
      color: white;
      font-family: helvetica;
      font-weight: bold;
    }
    clock-timer::part(time) {
      font-family: helvetica;
      font-weight: bold;
      background-color: #001e60;
      opacity: 60%;
      border-radius: 1rem;
      padding-inline: .5rem;
      color: white;
    }
    clock-timer time-range[type="trip"] { background: green; }
    clock-timer time-range[type="tolerance"] { background: orange; }
    clock-timer time-range[type="overtime"] { background: red; }
    clock-timer::part(hour-hand) { width: 1px; height: 28%; background-color: white; }
    clock-timer::part(minute-hand) { width: 1px; height: 38%; background: blue; }
    clock-timer::part(second-hand) { width: 1px; height: 43%; background: red; }
  </style>
</body>
</html>`;

await fs.writeFile(htmlPath, html, 'utf8');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 520, height: 520 }, deviceScaleFactor: 1 });
page.on('console', msg => console.log('PAGE', msg.type(), msg.text()));
page.on('pageerror', error => console.log('PAGEERROR', error.stack ?? error.message));

await page.goto(pathToFileURL(htmlPath).href);
await page.waitForFunction(() => customElements.get('clock-timer') && customElements.get('time-range') && customElements.get('ring-container'));

const started = await page.evaluate(() => {
  const clock = document.querySelector('clock-timer');
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const fmt = date => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
  const now = new Date();
  const scheduled = new Date(now.getTime() - 20 * 60 * 1000);
  return clock.start({
    tripId: 1,
    standardTime: '1:00:00',
    creationTime: fmt(now),
    scheduledStart: fmt(scheduled),
    startTime: fmt(scheduled)
  });
});
console.log('STARTED', started);
if (!started) throw new Error('ClockTimer.start returned false');

await page.waitForTimeout(1400);

async function snapshot(label) {
  const data = await page.evaluate(label => {
    const clock = document.querySelector('clock-timer');
    window.__ids ??= new WeakMap();
    window.__nextId ??= 1;
    const idFor = node => {
      if (!window.__ids.has(node)) window.__ids.set(node, window.__nextId++);
      return window.__ids.get(node);
    };
    const ranges = [...clock.querySelectorAll('ring-container > time-range')].map(range => {
      const ring = range.parentElement;
      const style = getComputedStyle(range);
      return {
        id: idFor(range),
        type: range.getAttribute('type'),
        className: range.className,
        startTime: range.getAttribute('start-time'),
        endTime: range.getAttribute('end-time'),
        clockStart: Number(range.clockTimerStart),
        clockEnd: Number(range.clockTimerEnd),
        connected: range.isConnected,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        backgroundColor: style.backgroundColor,
        transitionMarker: range.hasAttribute('timer-mode-transitioning'),
        activeRing: ring?.hasAttribute('active') ?? false,
        ringIndex: ring?.clockTimerRingIndex ?? null,
        ringInset: ring?.getAttribute('inset') ?? null,
        ringWidth: ring?.getAttribute('width') ?? null
      };
    });
    const elapsed = ranges.filter(r => r.type === 'elapsed');
    const remaining = ranges.filter(r => r.type === 'remaining');
    const activeElapsed = elapsed.filter(r => r.activeRing).sort((a,b) => b.clockEnd - a.clockEnd)[0] ?? elapsed.sort((a,b) => b.clockEnd - a.clockEnd)[0];
    const firstRemaining = remaining.sort((a,b) => a.clockStart - b.clockStart)[0];
    return {
      label,
      mode: clock.getAttribute('timer-mode'),
      elapsedCount: elapsed.length,
      remainingCount: remaining.length,
      activeElapsedEnd: activeElapsed?.clockEnd ?? null,
      firstRemainingStart: firstRemaining?.clockStart ?? null,
      remainingStartMinusElapsedEnd: activeElapsed && firstRemaining ? firstRemaining.clockStart - activeElapsed.clockEnd : null,
      ranges
    };
  }, label);
  console.log(`STATE ${label} ${JSON.stringify(data)}`);
  await page.screenshot({ path: `timer-mode-${label}.png` });
  return data;
}

await snapshot('01-remaining-initial');
await page.waitForTimeout(1200);
await snapshot('02-remaining-after-1s');

await page.evaluate(() => document.querySelector('clock-timer').setAttribute('timer-mode', 'elapsed'));
await snapshot('03-elapsed-immediate');
await page.waitForTimeout(120);
await snapshot('04-elapsed-120ms');
await page.waitForTimeout(300);
await snapshot('05-elapsed-settled');
await page.waitForTimeout(1100);
await snapshot('06-elapsed-after-1s');

await page.evaluate(() => document.querySelector('clock-timer').setAttribute('timer-mode', 'remaining'));
await snapshot('07-remaining-immediate');
await page.waitForTimeout(120);
await snapshot('08-remaining-120ms');
await page.waitForTimeout(300);
await snapshot('09-remaining-settled');
await page.waitForTimeout(1100);
await snapshot('10-remaining-after-1s');

// Rapid reversal probe, because stale transition completion can orphan DOM state.
await page.evaluate(() => document.querySelector('clock-timer').setAttribute('timer-mode', 'elapsed'));
await page.waitForTimeout(100);
await page.evaluate(() => document.querySelector('clock-timer').setAttribute('timer-mode', 'remaining'));
await page.waitForTimeout(450);
await snapshot('11-rapid-reversal-settled');
await page.waitForTimeout(1100);
await snapshot('12-rapid-reversal-after-1s');

await browser.close();
