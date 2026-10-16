(async () => {
    'use strict';
    const embedded = window.self !== window.top;
    if (embedded) document.documentElement.classList.add('settings-embedded');
    const dialog = document.querySelector('#graphicalSettingsDialog');
    const form = document.querySelector('#graphicalSettingsForm');
    const preview = document.querySelector('#clockPreview');
    const key = 'wmof.clock.graphicalSettings';
    const controller = WMOFGraphicalSettings.create({clockTimer: preview, clockPreview: preview});
    const error = document.createElement('p');
    error.id = 'graphicalSettingsError'; error.setAttribute('role','alert');
    form.querySelector('.dialog-header').after(error);
    let host, saving = false;
    try {
        if (embedded && parent.document.querySelector('#clockTimerSettingsFrame')?.contentWindow === window) {
            host = parent.WMOFGraphicalSettingsHost;
        }
        await WMOFPersistence.ready;
        let stored;
        if (host) stored = await host.load();
        else {
            const response = await fetch(new URL('api/users/', document.baseURI), {credentials:'same-origin',cache:'no-store'});
            if (response.ok) {
                const session = await response.json();
                await WMOFAccountSettings.load(session.user.id, session.csrfToken);
            } else if (response.status !== 401) throw Error('Account settings could not be loaded.');
            const raw = await WMOFPersistence.getItem(key);
            try {stored = raw ? JSON.parse(raw) : undefined;} catch {stored = undefined;}
        }
        controller.fillGraphicalForm(WMOFTimerAppearance.normalizeGraphicalSettings(stored));
        dialog.dispatchEvent(new Event('opening'));
        dialog.showModal();
        dialog.dispatchEvent(new Event('opened'));
        document.documentElement.dataset.settingsReady = 'true';
    } catch (failure) {
        error.textContent = failure.message || 'Settings could not be loaded.';
        if (!dialog.open) dialog.showModal();
    }
    const close = () => {
        if (saving) return;
        dialog.close();
        dialog.dispatchEvent(new Event('closed'));
    };
    dialog.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', close));
    dialog.addEventListener('cancel', event => {event.preventDefault();close();});
    dialog.addEventListener('click', event => {
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
    });
    dialog.addEventListener('close', () => {
        if (embedded) parent.postMessage({type:'clocktimer-settings-closed',session:new URLSearchParams(location.search).get('session')}, location.origin);
    });
    form.addEventListener('input', event => {
        if (event.target.name === 'showTolerance') {
            const previous = controller.getToleranceCheckboxValue(event.target);
            controller.setToleranceCheckboxValue(event.target, previous === true ? false : previous === false ? undefined : true);
        } else if (event.target.name === 'militaryTime') controller.syncTimeFormatForMilitaryToggle(form);
        else if (event.target.name === 'timeFormat') controller.syncMilitaryToggleForTimeFormat(form);
        controller.applyGraphicalSettings(controller.settingsFromForm(form), preview);
        controller.refreshActiveGraphicalHelpState();
    });
    document.querySelector('#resetGraphicalSettings').addEventListener('click', () => controller.fillGraphicalForm(WMOFTimerAppearance.graphicalDefaults));
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving) return;
        saving = true; error.textContent = '';
        const buttons = [...form.querySelectorAll('.dialog-actions button, .dialog-close')];
        buttons.forEach(button => button.disabled = true);
        try {
            const settings = WMOFTimerAppearance.normalizeGraphicalSettings(controller.settingsFromForm(form));
            if (host) await host.save(settings);
            else await WMOFPersistence.setItem(key, JSON.stringify({...settings, showTolerance:settings.showTolerance ?? null}));
            saving = false; close();
        } catch (failure) {error.textContent = failure.message || 'Settings could not be saved.';}
        finally {saving = false;buttons.forEach(button => button.disabled = false);}
    });
})();
