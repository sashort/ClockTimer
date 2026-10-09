/* Pure draft-state transitions for the audio announcement editor. */
(function (root) {
    "use strict";

    function cloneRow(row) {
        return row ? structuredClone(row) : undefined;
    }

    function selectedAnnouncement(row) {
        return row?.dataset?.audioAnnouncement;
    }

    function selectedState({ announcement, draft, rows } = {}) {
        if (!announcement) return undefined;
        return draft?.announcement === announcement ? draft.row : rows?.[announcement];
    }

    function beginDraft(rows, announcement) {
        const row = rows?.[announcement];
        return row ? { announcement, row: cloneRow(row) } : undefined;
    }

    function discardDraft() {
        return undefined;
    }

    root.WMOFAudioAnnouncementDraft = Object.freeze({
        cloneRow,
        selectedAnnouncement,
        selectedState,
        beginDraft,
        discardDraft
    });
})(globalThis);
