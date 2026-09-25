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

window.eval(
    fs.readFileSync(
        new URL(
            "../HamburgerMenu.js",
            import.meta.url
        ),
        "utf8"
    )
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

menu.hidePopover();

assert.equal(
    menu.isOpen,
    false
);

console.log(
    "hamburger-menu tests passed"
);
