import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {EventTarget, CustomEvent};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../IdentityContext.js", import.meta.url), "utf8"), sandbox);
const context = sandbox.WMOFIdentityContext;
assert.ok(context, "identity context registers its shared instance");

assert.equal(context.displayName(null), "No user selected");
assert.equal(context.displayMeta(null), "Use Account Lookup to select an identity.");

const identity = context.select({
    userId: 42,
    username: "alex",
    firstName: "Alex",
    lastName: "Driver",
    preferredName: "Al"
});
assert.equal(context.displayName(identity), "Al", "preferred name takes precedence");
assert.equal(context.displayMeta(identity), "Alex Driver · @alex · ID 42",
    "metadata includes formal name when preferred name differs");

const formalOnly = context.normalize({
    userId: 7, username: "jordan", firstName: "Jordan", lastName: "Lee"
});
assert.equal(context.displayName(formalOnly), "Jordan Lee");
assert.equal(context.displayMeta(formalOnly), "@jordan · ID 7",
    "metadata omits a duplicate formal name when there is no preferred name");

assert.equal(context.displayName({username: "solo"}), "solo",
    "username is the display-name fallback");
assert.equal(context.displayName({}), "User",
    "generic user label is the final fallback");
console.log("PASS identity context display-name and metadata projection");
