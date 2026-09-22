import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({
    viewport: {
        width: 1280,
        height: 900
    }
});

try {
    await page.setContent(`
        <!doctype html>
        <html>
        <head>
            <style>
                body {
                    margin: 0;
                    padding: 24px;
                    background: rgb(240 240 240);
                }

                clock-timer {
                    display: block;
                }

                #square {
                    width: 480px;
                    height: 300px;
                }

                #ellipse {
                    width: 480px;
                    height: 300px;
                }

                #previewDialog {
                    border: 0;
                    padding: 24px;
                }

                #preview {
                    width: 520px;
                    height: 220px;
                }
            </style>
        </head>
        <body>
            <clock-timer id="square"></clock-timer>
            <clock-timer id="ellipse"></clock-timer>

            <dialog id="previewDialog">
                <clock-timer
                    id="preview"
                    military-time="true"
                    visible-hours="12,3,6,9"
                    tick-marks="[10]"
                ></clock-timer>
            </dialog>
        </body>
        </html>
    `);

    for (const file of [
        'TemporalFormat.js',
        'RingContainer.js',
        'TimeRange.js',
        'ClockTimer.js'
    ]) {
        await page.addScriptTag({
            path: path.join(root, file)
        });
    }

    await page.evaluate(() => {
        document.querySelector('#square').keepAspectRatio = true;
        document.querySelector('#ellipse').keepAspectRatio = false;
        document.querySelector('#preview').keepAspectRatio = false;

        document.querySelector('#square').refreshLayout();
        document.querySelector('#ellipse').refreshLayout();
    });

    await page.waitForTimeout(100);

    const measure = async id =>
        page.evaluate(id => {
            const clock = document.getElementById(id);
            const host = clock.getBoundingClientRect();
            const ring = Array.from(clock.children)
                .find(child => child.localName === 'ring-container');
            const ringRect = ring?.getBoundingClientRect();

            const style = getComputedStyle(clock);

            return {
                host: {
                    left: host.left,
                    top: host.top,
                    width: host.width,
                    height: host.height
                },
                ring: ringRect
                    ? {
                        left: ringRect.left,
                        top: ringRect.top,
                        width: ringRect.width,
                        height: ringRect.height
                    }
                    : null,
                faceBackground:
                    style.getPropertyValue(
                        '--clock-timer-face-background-color'
                    ).trim(),
                activeRingBackground:
                    style.getPropertyValue(
                        '--clock-timer-active-ring-background-color'
                    ).trim()
            };
        }, id);

    const square = await measure('square');
    assert.equal(square.host.width, 480);
    assert.equal(square.host.height, 300);
    assert(square.ring, 'square ClockTimer has renderer rings');
    assert.equal(square.ring.width, 300);
    assert.equal(square.ring.height, 300);
    assert.equal(
        Math.round(square.ring.left - square.host.left),
        90,
        'square render box is horizontally centered'
    );
    assert.equal(square.faceBackground, 'transparent');
    assert.equal(square.activeRingBackground, 'transparent');

    const ellipse = await measure('ellipse');
    assert.equal(ellipse.host.width, 480);
    assert.equal(ellipse.host.height, 300);
    assert(ellipse.ring, 'free-aspect ClockTimer has renderer rings');
    assert.equal(ellipse.ring.width, 480);
    assert.equal(ellipse.ring.height, 300);
    assert.equal(
        Math.round(ellipse.ring.left - ellipse.host.left),
        0,
        'free-aspect render box uses the full host width'
    );

    await page.evaluate(() => {
        document.querySelector('#square').keepAspectRatio = false;
    });
    await page.waitForTimeout(50);

    const expandedSquare = await measure('square');
    assert.equal(expandedSquare.ring.width, 480);
    assert.equal(expandedSquare.ring.height, 300);

    await page.evaluate(() => {
        document.querySelector('#square').keepAspectRatio = true;
    });
    await page.waitForTimeout(50);

    const restoredSquare = await measure('square');
    assert.equal(restoredSquare.ring.width, 300);
    assert.equal(restoredSquare.ring.height, 300);

    const hiddenBefore = await measure('preview');
    assert.equal(hiddenBefore.host.width, 0);
    assert.equal(hiddenBefore.host.height, 0);

    await page.evaluate(() => {
        document.querySelector('#previewDialog').showModal();
    });

    await page.waitForFunction(() => {
        const preview = document.querySelector('#preview');
        const ring = Array.from(preview.children)
            .find(child => child.localName === 'ring-container');

        if (!ring) {
            return false;
        }

        const host = preview.getBoundingClientRect();
        const ringRect = ring.getBoundingClientRect();

        return (
            host.width === 520 &&
            host.height === 220 &&
            ringRect.width === 520 &&
            ringRect.height === 220
        );
    });

    const visiblePreview = await measure('preview');
    assert.equal(visiblePreview.host.width, 520);
    assert.equal(visiblePreview.host.height, 220);
    assert(visiblePreview.ring);
    assert.equal(visiblePreview.ring.width, 520);
    assert.equal(visiblePreview.ring.height, 220);

    console.log(
        'PASS ClockTimer browser renderer uses one render box and recovers from closed-dialog layout'
    );
}
finally {
    await browser.close();
}
