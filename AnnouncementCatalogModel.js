/* Catalog-facing announcement labels and master-layer policy. */
(function (root) {
    "use strict";

    function create(catalog) {
        const definition = key => catalog?.get?.(key);
        const audioAnnouncements = Object.freeze(
            (catalog?.list?.() || []).map(entry => [entry.key, entry.label])
        );
        const songName = key => definition(key)?.song || key;
        const overridesMaster = (key, layer) =>
            definition(key)?.masterOverrides?.includes?.(layer) === true;
        const speechIgnoresMaster = (key, {ignoreSummaryMaster = false} = {}) =>
            Boolean(ignoreSummaryMaster
                || overridesMaster(key, "summary")
                || overridesMaster(key, "details"));

        return Object.freeze({
            audioAnnouncements,
            definition,
            songName,
            overridesMaster,
            speechIgnoresMaster
        });
    }

    root.ClockTimerAnnouncementCatalogModel = Object.freeze({create});
})(globalThis);
