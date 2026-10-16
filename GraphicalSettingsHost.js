(() => {
    'use strict';
    const key = 'wmof.clock.graphicalSettings';
    globalThis.WMOFGraphicalSettingsHost = {
        async load() {
            await WMOFPersistence.ready;
            const raw = await WMOFPersistence.getItem(key);
            try {return raw ? JSON.parse(raw) : undefined;} catch {return undefined;}
        },
        async save(settings) {
            const normalized = WMOFTimerAppearance.normalizeGraphicalSettings(settings);
            if (globalThis.WMOFActions?.updateGraphicalSettings) {
                if (await WMOFActions.updateGraphicalSettings(normalized) === false) throw Error('Settings could not be saved.');
            } else {
                await WMOFPersistence.setItem(key, JSON.stringify({...normalized,showTolerance:normalized.showTolerance ?? null}));
                document.dispatchEvent(new CustomEvent('graphical-settings-saved',{detail:normalized}));
            }
        }
    };
})();
