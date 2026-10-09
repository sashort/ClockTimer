/* Pure permission-bit policy for profile and live-stream controls. */
(function (root) {
    "use strict";

    const PERMISSION_SUPERUSER = 4;
    const PERMISSION_VIEW_LIVE_STREAMS = 64;
    const PERMISSION_LOOKUP_USERS = 128;
    const PERMISSION_EDIT_USERS = 2;

    function permissions(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed | 0 : 0;
    }

    function hasAny(value, mask) {
        return (permissions(value) & mask) !== 0;
    }

    function hasAll(value, mask) {
        return (permissions(value) & mask) === mask;
    }

    function canViewLiveStreams(value) {
        return hasAny(value, PERMISSION_VIEW_LIVE_STREAMS | PERMISSION_SUPERUSER);
    }

    function canLookupUsers(value) {
        return hasAny(value, PERMISSION_LOOKUP_USERS | PERMISSION_SUPERUSER);
    }

    function canEditUsers(value) {
        return hasAny(value, PERMISSION_EDIT_USERS | PERMISSION_SUPERUSER);
    }

    function canAssignPermissions(value) {
        return hasAny(value, PERMISSION_SUPERUSER);
    }

    function canGrantPermission(value, bit) {
        return canAssignPermissions(value) || hasAll(value, bit);
    }

    const constants = Object.freeze({
        PERMISSION_SUPERUSER,
        PERMISSION_DEVELOPER_PREVIEW: 8,
        PERMISSION_DEVELOPER: 16,
        PERMISSION_GRANT_TOKEN_ACCESS: 32,
        PERMISSION_VIEW_LIVE_STREAMS,
        PERMISSION_LOOKUP_USERS,
        ACCESS_TOKEN_PERMISSION_MASK: PERMISSION_SUPERUSER | 32,
        SPEECH_EDITOR_PERMISSION_MASK: PERMISSION_SUPERUSER | 8 | 16,
        DEVELOPER_MENU_PERMISSION_MASK: 8 | 16
    });

    root.ClockTimerAccessPolicyModel = Object.freeze({
        constants,
        canViewLiveStreams,
        canLookupUsers,
        canEditUsers,
        canAssignPermissions,
        canGrantPermission
    });
})(globalThis);
