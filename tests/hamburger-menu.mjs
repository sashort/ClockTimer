import assert from "node:assert/strict";
import fs from "node:fs";
import {Window} from "happy-dom";

const window = new Window({
    url:
        "https://wmof.example/"
});

window.requestAnimationFrame =
    callback =>
        setTimeout(
            () =>
                callback(
                    window.performance.now()
                ),
            0
        );

window.cancelAnimationFrame =
    clearTimeout;

window.matchMedia =
    () => ({
        matches:
            true,
        addEventListener() {},
        removeEventListener() {}
    });

Object.defineProperty(
    window.HTMLElement.prototype,
    "animate",
    {
        configurable:
            true,
        value:
            undefined
    }
);

const componentSource =
    fs.readFileSync(
        new URL(
            "../HamburgerMenu.js",
            import.meta.url
        ),
        "utf8"
    );

assert.match(
    componentSource,
    /--hamburger-menu-promotion-duration:\s*450ms/
);

assert.match(
    componentSource,
    /#promotionDuration\(/
);


assert.match(
    componentSource,
    /submenuAnimationRecords/
);


assert.match(
    componentSource,
    /#closePromotedSubmenu\([\s\S]*#promotionPause\(\)/
);

assert.match(
    componentSource,
    /const PROMOTION_PAUSE\s*=\s*75/
);

assert.match(
    componentSource,
    /height: auto/
);

assert.match(
    componentSource,
    /max-height: var\(--hamburger-menu-safe-height/
);

assert.doesNotMatch(
    componentSource,
    /hamburger-menu-source \{[\s\S]{0,120}min-height: 100%/
);

assert.match(
    componentSource,
    /data-calculating/
);

assert.match(
    componentSource,
    /#freezePane\(/
);

assert.match(
    componentSource,
    /#finishOpeningMeasurement\([^)]*\)[\s\S]*#freezePane\(\s*this\.#viewport\s*,\s*this\.#normalPaneHeight\s*\)/
);

assert.match(
    componentSource,
    /#handleToggle\([\s\S]*#unfreezePane\(\)[\s\S]*#reset\(\)/
);

assert.match(
    componentSource,
    /async #promoteNested\([\s\S]*const parentOffsetY\s*=\s*childTarget\.top\s*-\s*childStart\.top/
);

assert.match(
    componentSource,
    /async #promoteNested\([\s\S]*#translationAnimation\(\s*group,\s*from,\s*to,\s*duration\s*\)[\s\S]*parent\.animate\(/
);

assert.match(
    componentSource,
    /async #restoreNestedFocusLevel\([\s\S]*const parentOffsetY\s*=\s*childStart\.top\s*-\s*destination\.top[\s\S]*#translationAnimation\(\s*child,\s*from,\s*to,\s*duration\s*\)/
);

assert.match(
    componentSource,
    /hamburger-menu-pane-frozen/
);

assert.match(
    componentSource,
    /hamburger-menu-promotion-mask/
);

assert.doesNotMatch(
    componentSource,
    /hamburger-menu-trigger-shift/
);

assert.match(
    componentSource,
    /MutationObserver/
);

assert.match(
    componentSource,
    /ResizeObserver/
);

assert.match(
    componentSource,
    /#isUsableBoundaryElement\(/
);

assert.match(
    componentSource,
    /display ===\s*"contents"/
);

assert.match(
    componentSource,
    /#refreshFrozenPaneGeometry\(/
);

assert.match(
    componentSource,
    /#frozenPaneBaseSize/
);

assert.match(
    componentSource,
    /One frozen pane spans the entire promoted stack/
);

assert.match(
    componentSource,
    /--hamburger-menu-frozen-pane-height/
);

assert.match(
    componentSource,
    /hamburger-menu-frozen-height-duration/
);

assert.match(
    componentSource,
    /height:\s*var\(--hamburger-menu-frozen-pane-height\)/
);

assert.match(
    componentSource,
    /#startBoundaryTracking\(/
);

assert.match(
    componentSource,
    /#boundaryGeometrySnapshot\(/
);

assert.match(
    componentSource,
    /#documentUsableBottom\([\s\S]*boundary[\s\S]*Math\.min/
);

const appCss =
    fs.readFileSync(
        new URL(
            "../app.css",
            import.meta.url
        ),
        "utf8"
    );

const appHtml =
    fs.readFileSync(
        new URL(
            "../index.html",
            import.meta.url
        ),
        "utf8"
    );

const appJs =
    fs.readFileSync(
        new URL(
            "../app.js",
            import.meta.url
        ),
        "utf8"
    );

assert.match(
    appCss,
    /position-area:\s*bottom span-right/
);

assert.match(
    appCss,
    /hamburger-menu-popover:not\(\[data-ready="true"\]\)/
);

assert.match(
    appCss,
    /hamburger-menu\.main-menu:not\(:defined\)/
);

assert.match(
    appHtml,
    /id="menuButton"[^>]*slot="trigger"/
);


assert.match(
    appHtml,
    /id="developerDocsButton"[^>]*hidden[^>]*>Docs<\/button>/
);

assert.match(
    appHtml,
    /Speech Recognition — Beta/
);

assert.match(
    appHtml,
    /Developer → Speech → Speech Training/
);

assert.match(
    appHtml,
    /id="speechRecognitionHelpButton"[^>]*>i<\/button>/
);

assert.match(
    appHtml,
    /id="syncGoalsHelpButton"[^>]*>i<\/button>/
);

assert.match(
    appCss,
    /#developerDocsButton::before/
);

assert.match(
    appCss,
    /hamburger-menu-popover \.menu-help-button/
);

assert.match(
    appJs,
    /openDeveloperDocs\(\)/
);

assert.match(
    appJs,
    /api\/docs\//
);

window.eval(
    componentSource
);

assert.equal(
    typeof window.customElements.get(
        "hamburger-menu"
    ),
    "function"
);

window.close();

console.log(
    "hamburger-menu tests passed"
);

process.exit(0);
