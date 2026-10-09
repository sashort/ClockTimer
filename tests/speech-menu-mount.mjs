import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function load(document) {
    const sandbox = { document, Object };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(new URL("../SpeechMenuMount.js", import.meta.url), "utf8"), sandbox);
    return sandbox.ClockTimerSpeechMenuMount;
}

{
    const existing = { id: "speechTopLevelMenu" };
    const document = {
        body: {},
        getElementById: id => id === "speechTopLevelMenu" ? existing : null,
        createElement() { throw new Error("top-level menu should be reused"); }
    };
    assert.equal(load(document).ensure({}, "top-level"), existing);
}

{
    const children = [];
    const container = {
        children,
        append(node) { children.push(node); },
    };
    const document = {
        body: container,
        getElementById: () => null,
        createElement(tag) {
            return {
                tagName: tag,
                dataset: {},
                attributes: {},
                matches(selector) {
                    if (selector === "speech-menu:not([speech-modal])") return !this.attributes["speech-modal"];
                    const match = selector.match(/^speech-menu\[speech-modal="(.+)"\]$/);
                    return Boolean(match && this.attributes["speech-modal"] === match[1]);
                },
                setAttribute(name, value) { this.attributes[name] = value; }
            };
        }
    };
    const mount = load(document);
    const menu = mount.ensure(container, "top-level");
    assert.equal(menu.tagName, "speech-menu");
    assert.equal(menu.dataset.speechRuntimeMenu, "true");
    assert.equal(menu.attributes["speech-modal"], "top-level");
    assert.equal(children.length, 1);
    assert.equal(mount.ensure(container, "top-level"), menu, "matching menu is reused");
}

{
    const existing = { matches: selector => selector === "speech-menu:not([speech-modal])" };
    const container = { children: [existing], append() { throw new Error("existing menu should be reused"); } };
    const document = { body: container, getElementById: () => null, createElement() { throw new Error("unexpected creation"); } };
    assert.equal(load(document).ensure(container), existing);
}
console.log("PASS speech menu reuse, top-level routing, and context-specific creation");
