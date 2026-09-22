import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const countPaintedPixels = buffer => {
    const png = PNG.sync.read(buffer);
    let painted = 0;

    for (let index = 3; index < png.data.length; index += 4) {
        if (png.data[index] > 0) {
            painted += 1;
        }
    }

    return painted;
};

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
                    background: transparent;
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

                #ellipse,
                #preview {
                    color: rgb(255 255 255);
                    --clock-timer-border-color: rgb(255 255 255);
                    --clock-timer-tick-color: rgb(255 255 255);
                    --clock-timer-hour-hand-color: rgb(255 255 255);
                    --clock-timer-minute-hand-color: rgb(255 255 255);
                    --clock-timer-second-hand-color: rgb(255 194 32);
                    --clock-timer-time-color: rgb(255 255 255);
                }

                #previewDialog {
                    border: 0;
                    padding: 24px;
                    background: transparent;
                }

                #previewDialog::backdrop {
                    background: transparent;
                }

                #preview {
                    width: 520px;
                    height: 220px;
                }
            </style>
        </head>
        <body>
            <clock-timer id="square"></clock-timer>
            <clock-timer
                id="ellipse"
                visible-hours="12,3,6,9"
                tick-marks="[10]"
            ></clock-timer>

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

    const containment = await page.evaluate(() => {
        const clock = document.querySelector('#ellipse');
        return {
            host: getComputedStyle(clock).containerType
        };
    });

    assert.equal(
        containment.host,
        'normal',
        'ClockTimer host must not establish size containment'
    );

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

    const ellipseScreenshot =
        await page.locator('#ellipse').screenshot({
            omitBackground: true
        });

    assert(
        countPaintedPixels(ellipseScreenshot) > 100,
        'free-aspect ClockTimer paints visible clock pixels'
    );

    await page.waitForTimeout(1100);

    const ellipseAfterTickScreenshot =
        await page.locator('#ellipse').screenshot({
            omitBackground: true
        });

    assert(
        countPaintedPixels(ellipseAfterTickScreenshot) > 100,
        'free-aspect ClockTimer remains painted after a second-hand tick'
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

    const previewScreenshot =
        await page.locator('#preview').screenshot({
            omitBackground: true
        });

    assert(
        countPaintedPixels(previewScreenshot) > 100,
        'closed-dialog ClockTimer paints after becoming visible'
    );

    console.log(
        'PASS ClockTimer browser renderer uses one render box and recovers from closed-dialog layout'
    );
}
finally {
    await browser.close();
}
