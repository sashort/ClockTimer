import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {Window} from "happy-dom";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "..");

const identitySource = readFileSync(join(root, "IdentityContext.js"), "utf8");
const lookupSource = readFileSync(join(root, "UserLookup.js"), "utf8");
const app = readFileSync(join(root, "app.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");

const window = new Window();
window.eval(identitySource);

const context = window.WMOFIdentityContext;
assert.ok(context);

const identity = context.select({
    id: "42",
    first_name: "John",
    last_name: "Smith",
    preferred_name: "Johnny",
    username: "jsmith"
});

assert.deepEqual(
    JSON.parse(context.stringify()),
    {
        type: "user",
        version: 1,
        userId: 42,
        firstName: "John",
        lastName: "Smith",
        preferredName: "Johnny",
        username: "jsmith"
    }
);
assert.equal(Object.isFrozen(identity), true);
assert.throws(() => context.select({userId: 0, username: "bad"}));

assert.match(lookupSource, /api\/admin\/user-lookup\//);
assert.match(lookupSource, /new FormData/);
assert.match(lookupSource, /"firstName"/);
assert.match(lookupSource, /"lastName"/);
assert.match(lookupSource, /"preferredName"/);
assert.match(lookupSource, /"username"/);
assert.match(lookupSource, /"id"/);
assert.match(lookupSource, /#identityContext[\s\S]*\.select/);
assert.match(lookupSource, /\.copy\(/);
assert.match(lookupSource, /onLiveStream/);

assert.match(app, /const PERMISSION_LOOKUP_USERS\s*=\s*128/);
assert.match(app, /WMOFIdentityContext/);
assert.match(app, /WMOFUserLookup/);
assert.match(app, /canLookupUsers/);
assert.match(app, /userLookupButton/);
assert.match(app, /liveTripStream[\s\S]*startViewing\(\s*targetUserId/);

const adminStart = html.indexOf('id="adminSubmenu"');
const adminEnd = html.indexOf("</div>", adminStart);
const admin = html.slice(adminStart, adminEnd);
assert.match(admin, /id="userLookupButton"/);
assert.match(admin, /id="liveStreamButton"/);

for (const id of [
    "userLookupDialog",
    "userLookupForm",
    "userLookupId",
    "userLookupUsername",
    "userLookupFirstName",
    "userLookupLastName",
    "userLookupPreferredName",
    "userLookupResults",
    "userLookupCopySelected",
    "userLookupLiveStream",
    "userLookupClearSelected"
]) {
    assert.match(html, new RegExp(`id="${id}"`));
}

assert.match(html, /<script src="IdentityContext\.js"><\/script>/);
assert.match(html, /<script src="UserLookup\.js"><\/script>/);

console.log("PASS shared user identity object and admin lookup UI");
