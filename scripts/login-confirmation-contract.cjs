// Apply the current login contract after historical FSM reconciliation.
module.exports = function updateLoginConfirmation(model) {
    model.state_contract.login.meaning = 'Four-digit ID plus OK advances to PIN. Four-digit PIN plus one OK submits exactly once. Server acceptance controls success; failure retains ID and clears PIN. reviewReady is a compatibility field for a complete, typed PIN awaiting its first OK.';
    model.state_contract.login.values = ['closed', 'id-entry', 'pin-entry', 'submitting', 'password-entry'];
    const contract = model.v2_contracts.LOGIN;
    contract.inputs.final_confirmation = 'The first OK/Enter after PIN entry submits; no second confirmation.';
    contract.postconditions.pin_ok = {phase: 'submitting', requests: 1};
    contract.postconditions.final_ok = {phase: 'submitting', requests: 1};
    contract.audio.pin_ok = [];
    contract.audio.final_ok = 'Success only after server acceptance; no PIN readback.';
    contract.controls.review = 'A complete typed PIN awaits its first OK. Editing does not create a separate review phase.';
    contract.forbidden = contract.forbidden.filter(item => item !== 'Authentication on the first PIN OK');
    contract.forbidden = [...new Set([...contract.forbidden, 'A second confirmation requirement after PIN OK', 'PIN readback'])];
    Object.assign(model.states['LOGIN-PIN'], {commands: ['Four spoken PIN digits + OK: submit', 'Type four PIN digits then OK/Enter: submit', 'Cancel: clear PIN or return to ID'], binding: {...model.states['LOGIN-PIN'].binding, 'login.phase': 'pin-entry'}});
    delete model.states['LOGIN-PIN'].binding['login.reviewReady'];
    // Keep this stable chart ID for links; it now describes complete typed input.
    Object.assign(model.states['LOGIN-REVIEW'], {title: 'Login: typed PIN complete', facet: 'Four typed PIN digits; first OK submits', commands: ['OK/Enter: submit once', 'Cancel: clear PIN', 'Edit a digit'], binding: {'login.open': true, 'login.phase': 'pin-entry', 'login.pending': false, 'login.reviewReady': true}});
    for (const edge of model.transitions) {
        if (['LOGIN-CHECK', 'LOGIN-CHECK-P', 'LOGIN-PIN-VOICE'].includes(edge.id)) {
            edge.target = 'LOGIN-WAIT'; edge.audio = null; edge.persist = true;
            edge.label = 'Four PIN digits plus first OK/Enter: submit once';
        }
        if (['LOGIN-FINAL-OK', 'LOGIN-FINAL-POK'].includes(edge.id)) edge.label = 'First OK/Enter on a complete typed PIN: submit once';
        if (edge.v2_contract === 'LOGIN' && edge.contract) {
            edge.guard = 'Login open, not submitting, exactly four digits for the credential being confirmed.';
            edge.contract.guard = edge.guard;
            edge.contract.trigger = edge.label;
            edge.contract.timing = 'ID OK advances; the first PIN OK submits. Success waits for server acceptance.';
            edge.contract.persistence = edge.target === 'LOGIN-WAIT' ? 'One credential request; no trip-persistence transaction.' : 'No credential request; no trip mutation.';
        }
    }
    for (const key of ['login', 'login-input']) model.contracts[key] = key === 'login'
        ? 'ID group OK advances to PIN. PIN group OK submits once, without a second OK or PIN readback. Failure retains ID and clears PIN. Raw PIN is never public state.'
        : 'Keyboard/mobile Return and button OK share the voice confirmation path. Incomplete groups cannot submit. Repeated decoder partials cannot submit twice. Cancel and Backspace preserve their existing credential-entry rules.';
    const old = model.audio['login-review'];
    if (old) {old.summary = 'None'; old.sequence = []; old.footer = 'Retired PIN readback; no playback in the current login workflow.';}
    return model;
};
