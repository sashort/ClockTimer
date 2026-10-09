import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../AccessPolicyModel.js", import.meta.url), "utf8"), sandbox);
const policy = sandbox.ClockTimerAccessPolicyModel;

assert.ok(policy, "access policy model registers its API");
assert.deepEqual(JSON.parse(JSON.stringify(policy.constants)), {
    PERMISSION_SUPERUSER: 4,
    PERMISSION_DEVELOPER_PREVIEW: 8,
    PERMISSION_DEVELOPER: 16,
    PERMISSION_GRANT_TOKEN_ACCESS: 32,
    PERMISSION_VIEW_LIVE_STREAMS: 64,
    PERMISSION_LOOKUP_USERS: 128,
    ACCESS_TOKEN_PERMISSION_MASK: 36,
    SPEECH_EDITOR_PERMISSION_MASK: 28,
    DEVELOPER_MENU_PERMISSION_MASK: 24
});
for (const bit of [undefined, null, "", "not-a-number", NaN]) {
    assert.equal(policy.canViewLiveStreams(bit), false);
    assert.equal(policy.canLookupUsers(bit), false);
    assert.equal(policy.canEditUsers(bit), false);
    assert.equal(policy.canAssignPermissions(bit), false);
}
assert.equal(policy.canViewLiveStreams(64), true);
assert.equal(policy.canViewLiveStreams(4), true, "superuser can view live streams");
assert.equal(policy.canViewLiveStreams(2), false);
assert.equal(policy.canLookupUsers(128), true);
assert.equal(policy.canLookupUsers(4), true, "superuser can look up users");
assert.equal(policy.canLookupUsers(64), false);
assert.equal(policy.canEditUsers(2), true);
assert.equal(policy.canEditUsers(4), true, "superuser can edit users");
assert.equal(policy.canEditUsers(64), false);
assert.equal(policy.canAssignPermissions(4), true);
assert.equal(policy.canAssignPermissions(2), false);
assert.equal(policy.canGrantPermission(8, 8), true, "matching permission is grantable");
assert.equal(policy.canGrantPermission(8, 16), false, "unheld permission is not grantable");
assert.equal(policy.canGrantPermission(4, 16), true, "superuser can grant any permission");
assert.equal(policy.canGrantPermission(12, 8), true, "superuser bit grants override even when other bits exist");
console.log("PASS access policy model");
