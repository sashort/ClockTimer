import assert from "node:assert/strict";
import fs from "node:fs";
import {Window} from "happy-dom";

const window = new Window({
    url:
        "https://wmof.example/"
});

window.requestAnimationFrame ??=
    callback =>
        setTimeout(
            () =>
                callback(
                    window.performance.now()
                ),
            0
        );

window.cancelAnimationFrame ??=
    clearTimeout;

window.matchMedia =
    () => ({
        matches:
            true,
        addEventListener() {},
        removeEventListener() {}
    });

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
    /const PROMOTION_DURATION\s*=\s*750/
);

assert.match(
    componentSource,
    /const PROMOTION_PAUSE\s*=\s*75/
);

assert.match(
    componentSource,
    /height: fit-content/
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
    /#unfreezePane\(\)[\s\S]*parentclosed/
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

assert.match(
    appCss,
    /position-area:\s*bottom span-right/
);

assert.match(
    appCss,
    /hamburger-menu\.main-menu:not\(:defined\)/
);

assert.match(
    appHtml,
    /id="menuButton"[^>]*slot="trigger"/
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

const boundary =
    window.document
        .createElement(
            "div"
        );

boundary.id =
    "boundary";

boundary.style.height =
    "20px";

window.document.body
    .append(
        boundary
    );

const menu =
    window.document
        .createElement(
            "hamburger-menu"
        );

menu.setAttribute(
    "safe-boundary",
    "#boundary"
);

const trigger =
    window.document
        .createElement(
            "button"
        );

trigger.textContent =
    "Menu";

const leaf =
    window.document
        .createElement(
            "button"
        );

leaf.textContent =
    "Leaf";

const group =
    window.document
        .createElement(
            "div"
        );

const parent =
    window.document
        .createElement(
            "button"
        );

parent.textContent =
    "Parent";

parent.setAttribute(
    "aria-controls",
    "submenu"
);

parent.setAttribute(
    "aria-expanded",
    "false"
);

const submenu =
    window.document
        .createElement(
            "div"
        );

submenu.id =
    "submenu";

submenu.hidden =
    true;

const child =
    window.document
        .createElement(
            "button"
        );

child.textContent =
    "Child";

submenu.append(
    child
);

group.append(
    parent,
    submenu
);

menu.append(
    trigger,
    leaf,
    group
);

window.document.body
    .append(
        menu
    );

assert.equal(
    menu.trigger,
    trigger
);

assert.equal(
    trigger.getAttribute(
        "slot"
    ),
    "trigger"
);

assert.equal(
    menu.safeBoundary,
    boundary
);

assert.ok(
    menu.popoverElement
);

assert.ok(
    menu.querySelector(
        ".hamburger-menu-viewport"
    )
);

menu.showPopover();

await new Promise(
    resolve =>
        setTimeout(
            resolve,
            25
        )
);

assert.equal(
    menu.isOpen,
    true
);

assert.ok(
    menu.pageCount >=
        1
);

let opening;

menu.addEventListener(
    "parentopening",
    event => {
        opening =
            event.detail;
    }
);

parent.click();

await new Promise(
    resolve =>
        setTimeout(
            resolve,
            25
        )
);

assert.equal(
    parent.getAttribute(
        "aria-expanded"
    ),
    "true"
);

assert.equal(
    submenu.hidden,
    false
);

assert.equal(
    menu.promotionDepth,
    1
);

assert.equal(
    opening?.button,
    parent
);

await menu.back();

assert.equal(
    parent.getAttribute(
        "aria-expanded"
    ),
    "false"
);

assert.equal(
    submenu.hidden,
    true
);

const lateItem =
    window.document
        .createElement(
            "button"
        );

lateItem.textContent =
    "Late item";

menu.append(
    lateItem
);

menu.refresh();

await new Promise(
    resolve =>
        setTimeout(
            resolve,
            25
        )
);

assert.equal(
    lateItem.parentElement
        ?.classList
        .contains(
            "hamburger-menu-source"
        ) ||
    Boolean(
        lateItem.closest(
            ".hamburger-menu-panel"
        )
    ),
    true
);

menu.hidePopover();

assert.equal(
    menu.isOpen,
    false
);

const automaticBoundary =
    window.document
        .createElement(
            "div"
        );

automaticBoundary
    .setAttribute(
        "data-hamburger-safe-boundary",
        ""
    );

automaticBoundary.style.height =
    "16px";

window.document.body
    .append(
        automaticBoundary
    );

const autoMenu =
    window.document
        .createElement(
            "hamburger-menu"
        );

const autoTrigger =
    window.document
        .createElement(
            "button"
        );

autoTrigger.textContent =
    "Auto";

autoMenu.append(
    autoTrigger,
    window.document
        .createElement(
            "button"
        )
);

window.document.body
    .append(
        autoMenu
    );

assert.equal(
    autoMenu.safeBoundary,
    automaticBoundary
);

console.log(
    "hamburger-menu tests passed"
);
