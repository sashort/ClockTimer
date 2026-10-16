// Reconcile the implementation delta into the working reference, preserving
// the separately approved chart and every existing state/transition ID.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);
const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024}).trim();
const baseline = '25608199497d995d1cf4b04eeef53e5984d26bc1';
const model = JSON.parse(read('docs/mainline-fsm-draft.json'));
const reviewedHead = process.env.FSM_REVIEWED_HEAD || '831745dbd2c3bfa0baf494ed6f12f6a8c069debc';
const changes = git(['log', '--reverse', '--format=@@%H|%s', '--name-only', `${baseline}..${reviewedHead}`]);
const commits = changes.split('@@').filter(Boolean).map(block => {
    const [header, ...lines] = block.trim().split('\n');
    const split = header.indexOf('|');
    const files = lines.map(line => line.trim()).filter(Boolean);
    const areas = new Set();
    for (const file of files) {
        if (/^(tests\/|\.github\/)/.test(file)) areas.add('verification');
        else if (/^docs\//.test(file)) areas.add('documentation');
        else if (/SpeechMenu|SpeechGrammar|ParameterParser|SpeechValue|DurationParser|SpokenTimeParser/.test(file)) areas.add('speech-planning');
        else if (/Vosk|PocketSphinx|^speech\//.test(file)) areas.add('recognizer-routing');
        else if (/StateTransactions|ActionFunctions|InteractionFunctions/.test(file)) areas.add('operation-ownership');
        else if (/ClockTimer|TimeRange|RingContainer/.test(file)) areas.add('clock-and-replay');
        else if (/settings|GraphicalSettings|templates|\.html$|^lib\/|LanguageTemplate/i.test(file)) areas.add('pages-and-settings');
        else if (/^app\.js$/.test(file)) areas.add('application-workflows');
        else areas.add('infrastructure-and-resources');
    }
    if (!files.length) areas.add('history-integration');
    return {commit: header.slice(0, split), subject: header.slice(split + 1), files, areas: [...areas].sort()};
});
model.chart_revision = '15 / implementation reconciliation through 16 October 2026';
model.status = 'DRAFT — version 2 behavioral test reference';
model.implementation_status = 'Implementation delta audited from the last working FSM update. Contracts distinguish required outcomes, automated evidence, and unresolved reports. Graph approval is separate from test evidence.';
model.implementation_audit = {
    last_working_reference_commit: baseline,
    last_approved_reference_update: git(['rev-parse', '1020a029']),
    through_commit: reviewedHead,
    working_changes: ['Two-step PIN review, focus announcements and Cancel/failure rules requested 16 October 2026', 'Runtime login.phase and version 2 transition contracts', 'Root-owned command/value deferral, malformed section discard, adaptive silence settlement and response-column TTLs'],
    rule: 'Every intervening commit is inventoried, including tests, corrective commits and reversions. Requirements describe the resulting code, never an abandoned intermediate implementation.',
    commits
};
model.state_contract.login.meaning = 'Authentication phase id-entry/pin-entry/pin-review/submitting/password-entry/closed, input stage, reviewReady, digitCount, pending, and method. Raw ID/PIN digits are not exposed in global FSM snapshots. Four digits plus OK are atomic spoken input for both ID and PIN; PIN OK reviews, the following independent OK authenticates.';
model.state_contract.login.values = ['closed', 'id-entry', 'pin-entry', 'pin-review', 'submitting', 'password-entry'];
model.state_contract.pending.meaning = 'Owned operations, effects, persistence acknowledgements and capture/final-result waits. lockCount is the number of outstanding owners; controls remain visible but disabled during transient operations.';
model.state_contract.speechRecognition.meaning = 'Off/starting/listening/sleeping/suspended are orthogonal. Only wake commands are eligible while sleeping. Recognizer names are ordinary transcript text. SpeechMenu owns planning/execution for Vosk and PocketSphinx.';
model.state_contract.transitionPath = {region: 'Trace', source: 'WMOFCoordinator.trace', meaning: 'Version 2 tests record the originating state, action/event ID, parent/owner, start/end timestamps, acknowledged effects and resulting state. Replay is deterministic from the scenario, not from a DOM disabled flag.'};

const contract = (id, data) => {
    model.v2_contracts ||= {};
    model.v2_contracts[id] = {id, ...data};
};
contract('LOGIN', {
    scope: ['LOGIN-ID', 'LOGIN-PIN', 'LOGIN-REVIEW', 'LOGIN-PIN-CANCEL', 'LOGIN-WAIT'],
    preconditions: {method: 'pin', open: true, credential_digits: 4},
    inputs: {voice_group: 'exactly four digits followed by OK/Okay/O K', pointer_group: 'exactly four typed digits then OK/Enter', final_confirmation: 'a separate OK/Enter after PIN review'},
    postconditions: {id_ok: {phase: 'pin-entry', focus: 'first PIN cell', requests: 0}, pin_ok: {phase: 'pin-review', requests: 0}, final_ok: {phase: 'submitting', requests: 1}, failure: {phase: 'pin-entry', id: 'retained', pin: 'empty', focus: 'first PIN cell'}},
    audio: {empty_id_focus: ['Please login via voice'], empty_pin_focus: ['ID digits spoken individually', 'sentence pause', 'Password'], pin_ok: ['PIN digits spoken individually'], final_ok: 'Success only after server acceptance'},
    cancellation: {empty_pin: 'Clear ID and PIN; return to first ID cell', entered_or_reviewed_pin: 'Clear PIN; retain ID; return to first PIN cell', second_cancel: 'Clear ID and PIN; return to first ID cell'},
    controls: {entry: 'Active credential cells and OK/Cancel enabled; inactive credential disabled', review: 'Only reviewed PIN may be confirmed by bare spoken OK; editing revokes review', submitting: 'Credential input, submit, cancel and method switches disabled'},
    forbidden: ['Authentication on the first PIN OK', 'Authentication from digits without group OK', 'Authentication from a repeated decoder partial', 'Success before server acknowledgement', 'Raw PIN in global state or transition evidence'],
    evidence: ['node tests/app-state-transactions.mjs --pin-review --voice-feedback', 'node tests/app-state-transactions.mjs --pin-return', 'node tests/app-state-transactions.mjs --pin-editing', 'node tests/app-state-transactions.mjs --voice-code', 'node tests/app-state-transactions.mjs --voice-code-adapter']
});
contract('SPEECH', {
    scope: ['all voice transitions'],
    preconditions: {planner: 'SpeechMenu', grammar: 'only available commands and finite context-specific values'},
    inputs: ['one or several independent/chained commands', 'leading/intermediate junk', 'growing typed values', 'final or malformed segments'],
    postconditions: {terminal_command: 'Execute once as soon as complete and not continuable; prune consumed text', typed_value: 'Hold viable time/duration continuations until a real boundary', decision: 'Commands and contexts report valid/incomplete/malformed/defer portions; the root arbitrates the combined chain', junk: 'Discard malformed context/command and its remainder through the next independent literal command head; never rescue a shorter valid value from the rejected section', final_invalid: 'Rollback the uncommitted dependent root; retain earlier independently completed roots', dependency: 'A failed chain root invalidates dependent continuations even when other commands intervene', silence: 'At the adaptive silence deadline settle valid chains, cancel incomplete roots, discard malformed sections, clear collectors/projections and release owned locks; speech resumption cancels the deadline', response: 'One horizontal row of response columns, newest on the left; incoming results travel from the right under existing results; each keeps its own TTL across utterances; expiry moves the whole chain right until the expired result exits; a single result uses the same mechanism'},
    controls: {speech: 'Availability comes from the active UI/modal and semantic state; pointer flags are outputs'},
    audio: {ordering: 'Suppress obsolete intermediate feedback when a known continuation owns it; UI execution cannot depend on optional feedback'},
    forbidden: ['Broaden unsupported regexes', 'Interpret recognizer name as a command boundary', 'Repeated execution of a consumed command', 'Truncate an extendable time/duration at an unstable partial'],
    evidence: ['node tests/speech-failfast.mjs', 'node tests/adaptive-speech-timing.mjs', 'node tests/speech-command-digest.mjs', 'node tests/speech-response-chain.mjs', 'node tests/speech-response-chain-browser.mjs', 'node tests/app-state-transactions.mjs --speech-boundaries', 'node tests/app-state-transactions.mjs --voicepad-continuation', 'node tests/legacy-vosk-values.mjs', 'node tests/speech-value-preprocessor.mjs']
});
contract('RECOGNIZER', {
    scope: ['all recognized utterances'], preconditions: {available_commands: 'SpeechMenu active candidates'}, inputs: ['PCM worklet frames', 'context or finite grammar changes'],
    postconditions: {switch: 'Preserve utterance ID; retain and replay short rolling transition PCM; fence old decoder results', vocabulary: 'Finite time/duration/number/digits/date choices from registered patterns; omit/report unsupported regexes', backend: 'Vosk test deployment; PocketSphinx experiment remains intact'},
    controls: {sleeping: 'Only wake; ordinary commands cannot execute'}, audio: {echo: 'Register and filter synthesized speech', microphone: 'One dedicated activation/deactivation chime and announcement per actual runtime transition for voice, pointer and remote controls; duplicates are silent'},
    forbidden: ['Change application planner to a recognizer', 'Treat acoustic decoder stages as separate SpeechMenu utterances', 'Claim a custom in-place Vosk fork is implemented'],
    evidence: ['node tests/vosk-grammar-router.mjs', 'node tests/vosk-speechmenu-context.mjs', 'node tests/vosk-phrase-list-compiler.mjs', 'node tests/pocketsphinx-grammar-catalog.mjs']
});
model.v2_contracts.SPEECH.postconditions.continuation = 'Logical session owns the unconsumed transcript, collector, projected destination and adaptive deadline across declared UI/FSM transitions; decoder grammar and execution use that same context without replaying consumed openers. Unexpected transitions or revoked authorization cancel ownership.';
model.v2_contracts.SPEECH.postconditions.silence = 'At the adaptive silence deadline request/drain the decoder final before settling valid, incomplete or malformed collections; do not promote the last partial to final. Release owned collectors, projections and locks; speech resumption before expiry cancels the deadline.';
model.v2_contracts.RECOGNIZER.postconditions.final = 'Final decoding may append or revise an unconsumed suffix; keep logical ownership until final delivery or bounded recognizer failure. Grammar-switch diagnostics cannot replace the active Mic Bar transcript.';
for (const id of ['SPEECH', 'RECOGNIZER']) {
    model.v2_contracts[id].implementation_guide = 'docs/speech-recognition-v2.md';
    model.v2_contracts[id].evidence.push('node tests/app-state-transactions.mjs --decoder-final-boundaries --voice-feedback', 'node tests/app-state-transactions.mjs --ready-handoff --voice-feedback');
}
model.v2_contracts.SPEECH.class_guide = 'docs/class-architecture-v2.md';
model.v2_contracts.SPEECH.time_guide = 'docs/time-reference-v2.md';
model.v2_contracts.SPEECH.evidence.push('node tests/tone-referenced-announcement.mjs', 'node tests/scheduled-audio-cue.mjs', 'node tests/app-state-transactions.mjs --time-reference --voice-feedback');
model.v2_contracts.SPEECH.evidence.push('node tests/owned-feedback-scope.mjs', 'node tests/speech-continuation-session.mjs');
contract('OWNERSHIP', {
    scope: ['all gestures, utterances, UI effects and persistence operations'], preconditions: {authoritative_state: 'shared coordinator and ClockTimer'}, inputs: ['overlapping operations', 'acknowledgement', 'cancellation', 'rollback', 'surface close/reopen'],
    postconditions: {lock: 'Acquire an owned token; release only that token; unlock when count reaches zero', nested: 'Only the first owner locks and the final owner unlocks the UI', transient: 'Expose applicable controls as visible, disabled and non-functional', timing: 'Record start/end and parent operation; plan subsequent commands after state settles'},
    controls: {enabled: 'Derived from capabilities and outstanding owners, not restored stale disabled DOM snapshots'}, audio: {stale: 'Cancel stale owned effects'},
    forbidden: ['A stale effect releases a newer operation lock', 'Duplicate start/stop from a disabled transient control', 'A closed command-list dialog leaves a lock held'],
    evidence: ['node tests/application-coordinator.mjs', 'node tests/async-command-lifecycle.mjs', 'node tests/app-state-transactions.mjs --commands-close', 'node tests/app-state-transactions.mjs --coordinator-end-trip']
});
contract('BREAK-DOWN', {
    scope: ['B0', 'B10', 'B15', 'BL', 'BE', 'DOWN', 'CD'], preconditions: {trip: 'active; interval identity from model'}, inputs: ['Break Start', 'Break Start <break|short break|lunch> OK', 'Break End', 'Break End OK', 'Down/Down time', 'Resume', 'OK/Cancel'],
    postconditions: {selector: 'Await an explicit type and OK; type alone cannot start', start: 'Start selected interval exactly once; from Down end Down once before starting break', end_prompt: 'Open and announce type-specific OK/Cancel immediately after recognized Break End; a known OK chain can bypass the intermediate prompt', end: 'End only the interval key captured by the prompt; keep same trip active; never open Trip Summary', stale: 'Reject if original interval ended or was replaced', down: 'Keep tick projection monotonic across cadence changes without changing spoken persistence timestamps'},
    controls: {selector: 'OK disabled before a type is chosen', pending: 'Visible disabled controls until owned effects settle'},
    audio: {selector: 'Say/press break type then OK.', started: '<type> started. Say break end to end your <type>.', end: 'Are you ready to end your <type>?; once per prompt'},
    forbidden: ['lunch end', 'short break end', 'end lunch', 'end short break', 'end break', 'Break End falls back to End Trip', 'A stale prompt ends a replacement Down/break'],
    evidence: ['node tests/app-state-transactions.mjs --interval-actions', 'node tests/app-state-transactions.mjs --down-break', 'node tests/app-state-transactions.mjs --down-timing', 'node tests/app-state-transactions.mjs --break-boundaries --voice-feedback', 'node tests/app-state-transactions.mjs --break-end-stream --voice-feedback']
});
contract('RANGES-SYNC', {
    scope: ['LOG', 'GA', 'GT', 'GL', 'SO', 'SI'], preconditions: {authenticated: 'required for server totals'}, inputs: ['Day/Week/Month/Money/Year/Custom range selection', 'goal mode change', 'Sync On/Off', 'Log open/close'],
    postconditions: {range: 'Apply canonical range; fetch matching server totals with explicit speech-persist permission even for reads; do not write trip events', pointer: 'First Day selection applies immediately and survives loading', sync_off: 'Update shared Sync state and hamburger control while preserving mic and recognition'},
    controls: {completion: 'Release all owned UI locks; a hidden menu button cannot veto an available semantic command'}, audio: {source: 'Existing range/sync semantic announcement rules'},
    forbidden: ['Client-only error for an authorized range fetch', 'Sync Off stops recognition', 'A range selection writes a trip lifecycle event'],
    evidence: ['node tests/app-state-transactions.mjs --range-permissions', 'node tests/app-state-transactions.mjs --pointer-mode', 'node tests/app-state-transactions.mjs --sync-voice']
});
contract('REPLAY-RENDER', {
    scope: ['all clock phases and restored trips'], preconditions: {source: 'persisted event history'}, inputs: ['reconnect/restart', 'elapsed breaks and Down', 'bad replay event', 'fitted overtime/Down tick'],
    postconditions: {identity: 'Restore original trip ID and complete interval history; repeated reconnect cannot insert a partial duplicate', failure: 'Stop and clear failed replay atomically, including ID/prepared/pending state, before another connection', fitted: 'All arcs use the same projection each tick; intentional goal changes can animate'},
    controls: {replay: 'UI capabilities derive from the resulting authoritative model'}, audio: {restore: 'Restoration is not a new trip start'},
    forbidden: ['Treat a valid latency model without a rendered element as replay failure', 'Leave running state with cleared database identity', 'Independent per-tick fitted regrowth'],
    evidence: ['node tests/trip-replay-identity.mjs', 'node tests/radial-fitted-tick-browser.cjs', 'TZ=UTC node tests/clock-timer-fsm.mjs', 'TZ=America/New_York node tests/clock-timer-fsm.mjs']
});
contract('SETTINGS-PAGES', {
    scope: ['SET-G', 'SET-A', 'DROP-IN', 'DROP-IN-TARGET'], preconditions: {parent: 'one existing Order Filler or Drop-In instance'}, inputs: ['open standalone graphical settings iframe', 'close/reopen', 'pointer mode selection'],
    postconditions: {frame: 'Standalone graphical page runs its own settings code, preserving presentation and shared template parity', parent: 'Close returns to same parent and trip without bootstrapping another app', cleanup: 'Unload acknowledged closed frame immediately; ignore delayed closes from an earlier opening'},
    controls: {settings: 'Return to correct previous focused surface; owner-scoped effect cleanup'}, audio: {standalone: 'No app startup/login announcements in settings-only runtime'},
    forbidden: ['A duplicate Order Filler after close', 'Loading the monolithic main app into the graphical iframe'],
    evidence: ['node tests/standalone-settings-page.mjs', 'node tests/graphical-settings-layout.mjs', 'node tests/graphical-settings-browser.cjs', 'node tests/shared-page-templates.mjs']
});
for (const [name, text] of Object.entries({
    login: 'Four ASCII digits plus group OK/Enter for both ID and PIN. ID group OK focuses PIN. PIN group OK speaks digits only and enters review; a separate final OK/Enter alone submits. Cancel on an empty PIN returns to empty ID. Cancel on a populated/reviewed PIN clears PIN and retains ID; the next Cancel clears ID. Failure retains ID, clears PIN and review, focuses first PIN. Never expose raw PIN in public state.',
    'login-input': 'Focus first empty ID: Please login via voice. Focus first empty PIN: individual ID digits, a sentence pause, Password. First PIN group OK: individual PIN digits; zero authentication requests. Final OK: one request. Editing revokes review. Backspace on an empty slot erases and selects the previous digit; on empty first PIN it clears both credentials and focuses first ID. Forward Delete remains local. Keyboard Enter and mobile line-break use OK and reject incomplete groups. Review-only speech accepts OK/Cancel; duplicate decoder partials do not count as a final OK.',
    'login-authentication': 'Authentication is not optimistic. Keep modal open and disable credential controls while a single request is pending. Only after acceptance may success be spoken or session/profile populated. Failure returns to first empty PIN with confirmed ID retained and a fresh PIN-group OK then final OK required.'
})) model.contracts[name] = text;
Object.assign(model.states['LOGIN-ID'], {commands: ['Exactly four spoken digits + OK', 'Type four digits then OK/Enter', 'Cancel: empty ID', 'First empty cell focus: ID prompt'], binding: {...model.states['LOGIN-ID'].binding, 'login.phase': 'id-entry'}});
Object.assign(model.states['LOGIN-PIN'], {commands: ['Exactly four spoken digits + OK: readback only', 'Type four digits then OK/Enter: readback only', 'Cancel empty PIN: ID entry', 'Cancel entered PIN: clear PIN', 'Backspace empty first PIN: clear ID and PIN'], binding: {...model.states['LOGIN-PIN'].binding, 'login.phase': 'pin-entry', 'login.reviewReady': false}});
model.states['LOGIN-REVIEW'] = {id: 'LOGIN-REVIEW', title: 'Login: PIN readback / final OK', focus: 'Login dialog', trip: 'Previous trip unchanged', facet: 'Four PIN digits reviewed; no authentication request yet', family: 'login', commands: ['OK/Enter: submit once', 'Cancel: clear PIN', 'Edit a digit: revoke review'], binding: {'login.open': true, 'login.phase': 'pin-review', 'login.pending': false, 'login.reviewReady': true}};
model.states['LOGIN-WAIT'].binding['login.phase'] = 'submitting';
model.states['LOGIN-PIN-CANCEL'].binding['login.phase'] = 'pin-entry';
model.states.B0.title = 'Break selector: type then OK';
model.states.B0.commands = ['Break Start: open selector', 'Choose Break / Short Break / Lunch', 'OK: start selected type', 'Cancel: restore Running or Down'];
model.states['BSELECT'] = {id:'BSELECT',title:'Break selector: type selected',focus:'Break type dialog',trip:'Running or Down origin retained',facet:'Selected type; interval has not started',family:'intervals',commands:['OK: start selected type','Choose another type','Cancel: preserve origin'],binding:{'breakDialog.open':true,'breakDialog.allowOk':true}};
model.states.BE.binding = {intervalKey: 'captured original interval identity', tripActive: true};
model.states.BE.facet = 'Recognized Break End opens and announces immediately; OK ends only its captured interval; Cancel preserves it.';
model.states.P.facet = 'Applicable controls remain exposed but disabled while one or more operation owners hold locks.';

const audio = (id, text, sequence) => { model.audio[id] = {id, chime: 'None', notes: '', summary: text, details: 'None', sequence: sequence || [{id: id+'-speech', kind: 'Summary', text, optional: false, skippable: false}], footer: 'English language resource; state/focus guards apply.', order_note: 'Required playback order.'}; };
audio('login-id', 'Please login via voice');
audio('login-pin', '<individual ID digits>. Password', [{id:'login-id-digits',kind:'Summary',text:'<individual ID digits>',optional:false},{id:'login-id-pause',kind:'Pause',text:'Sentence pause',optional:false},{id:'login-password',kind:'Summary',text:'Password',optional:false}]);
audio('login-review', '<individual PIN digits>');
audio('login-failed', 'Login failed. <individual ID digits>. Password');

const ruleFor = id => /^LOGIN/.test(id) ? 'LOGIN' : null;
for (const edge of model.transitions) {
    const rule = ruleFor(edge.id);
    if (rule) edge.v2_contract = rule;
    if (['LOGIN-CHECK','LOGIN-CHECK-P','LOGIN-PIN-VOICE'].includes(edge.id)) {
        edge.target = 'LOGIN-REVIEW'; edge.audio = 'login-review'; edge.persist = false;
        edge.label = 'Exactly four PIN digits plus OK/Enter: readback only';
    }
    if (['LOGIN-ID-VOICE','LOGIN-ID-REPLACE'].includes(edge.id)) {
        edge.retired = true; edge.replaced_by = 'LOGIN-ID-OK';
        edge.contract = {...edge.contract, trigger: 'Retired bare spoken ID entry', loopback_feedback: {classification:'superseded',rule:'Atomic four digits plus OK is required; see LOGIN-ID-OK.'}};
    }
    if (edge.id === 'LOGIN-PIN-REPLACE') {edge.retired = true;edge.replaced_by = 'LOGIN-CHECK';}
    if(edge.mode==='voice'&&['LOGIN-ID','LOGIN-PIN','LOGIN-PIN-CANCEL'].includes(edge.source)&&/^LOGIN-(?:VOICE|USER)-/.test(edge.id)){
        edge.retired=true;edge.replaced_by='Atomic group input, Cancel or pointer method switch';
        edge.contract={...edge.contract,loopback_feedback:{classification:'superseded',rule:'The strict four-digit login surface accepts digit-group OK, final review OK, and Cancel. Method switches remain pointer controls.'}};
    }
    if (rule) {
        edge.guard = 'See structured LOGIN preconditions, phase, four-digit validation and reviewReady gates.';
        edge.contract = {...edge.contract, trigger: edge.label, guard: edge.guard, state_changes: 'Apply structured LOGIN postconditions; preserve trip/recognition regions.', timing: 'Immediate local input; authentication only on final OK, server acknowledgement controls success.', persistence: edge.target === 'LOGIN-WAIT' ? 'One credential request; no trip-persistence transaction.' : 'No credential request; no trip mutation.', rollback: 'Authentication failure retains ID, clears PIN/review, focuses first PIN.', verification: model.v2_contracts.LOGIN.evidence.join('; ')};
    }
    if (/^B4(?:00|01|02|10|11|12)$/.test(edge.id)) {
        edge.label=/^B41/.test(edge.id)?'Break End OK':'Break End';
        edge.v2_contract='BREAK-DOWN';edge.guard='Original interval identity is still active; preserve the trip';
    }
    if (['B420','B423'].includes(edge.id)){edge.target='B0';edge.audio='break-options';edge.label='Break Start / Start Break';}
    if(edge.id==='B03'){edge.target='BSELECT';edge.label='Choose Break / Short Break / Lunch; wait for OK';}
    if(['B05P','B06P','B07P'].includes(edge.id)){edge.source='BSELECT';edge.label='Press OK after selecting '+({B05P:'Short break',B06P:'Break',B07P:'Lunch'}[edge.id]);edge.guard='A type is selected; preserve Running/Down origin';edge.v2_contract='BREAK-DOWN';}
    if(/^M\d/.test(edge.id)&&/Mode/i.test(edge.label)){edge.persist=true;edge.remote_access='read';edge.trip_event_writes=0;edge.v2_contract='RANGES-SYNC';}
    if(edge.id==='MIC-NAMED-BARGE-IN'){edge.retired=true;edge.replaced_by='SPEECH and RECOGNIZER contracts';edge.contract={...edge.contract,loopback_feedback:{classification:'superseded',rule:'Recognizer names are ordinary transcript words and cannot force stream boundaries.'}};}
}
const add = (id, source, target, label, mode, sound, guard, persist = false) => {
    const edge = {id,source,target,label,mode,audio:sound,guard,persist,restore:null,skippable:false,v2_contract:'LOGIN',test:{status:'untested',version:'',evidence:'Automated contract scenarios are listed in v2_contracts.LOGIN; no physical microphone claim.'},contract:{trigger:label,guard,state_changes:'Apply structured LOGIN contract.',timing:'Immediate; await server only in LOGIN-WAIT.',persistence:persist?'One credential request.':'No credential request.',rollback:'Preserve ID; clear PIN/review on authentication failure.',verification:model.v2_contracts.LOGIN.evidence.join('; ')}};
    if(source===target)edge.contract.loopback_feedback={classification:'attribute-change',rule:'Focus/input attributes change; play the explicitly specified login announcement once.'};
    const at=model.transitions.findIndex(t=>t.id===id);if(at<0)model.transitions.push(edge);else model.transitions[at]=edge;
};
add('LOGIN-FINAL-OK','LOGIN-REVIEW','LOGIN-WAIT','Final spoken OK after PIN readback','voice',null,'reviewReady; exactly four unchanged PIN digits; listening; not pending',true);
add('LOGIN-FINAL-POK','LOGIN-REVIEW','LOGIN-WAIT','Final button OK or keyboard Return','pointer',null,'reviewReady; exactly four unchanged PIN digits; not pending',true);
add('LOGIN-REVIEW-CANCEL','LOGIN-REVIEW','LOGIN-PIN-CANCEL','Cancel before final OK','voice','login-pin','Reviewed PIN present; retain ID');
add('LOGIN-REVIEW-PCANCEL','LOGIN-REVIEW','LOGIN-PIN-CANCEL','Cancel button before final OK','pointer','login-pin','Reviewed PIN present; retain ID');
add('LOGIN-EMPTY-PIN-CANCEL','LOGIN-PIN','LOGIN-ID','Cancel between confirmed ID and PIN input','voice','login-id','All PIN cells empty; clear both groups');
add('LOGIN-FIRST-PIN-BACKSPACE','LOGIN-PIN','LOGIN-ID','Physical/mobile Backspace in empty first PIN cell','pointer','login-id','Backward deletion, cell index 0, empty cell; not pending');
add('LOGIN-REVIEW-EDIT','LOGIN-REVIEW','LOGIN-PIN','Edit PIN; revoke previous review','pointer',null,'Active editable PIN cell; next OK must read back again');
add('LOGIN-ID-FOCUS','LOGIN-ID','LOGIN-ID','Focus first ID cell with every ID cell empty','pointer','login-id','Active first ID cell; not pending');
add('LOGIN-PIN-FOCUS','LOGIN-PIN','LOGIN-PIN','Focus first PIN cell with every PIN cell empty','pointer','login-pin','Active first PIN cell; retained four-digit ID; not pending');
const breakEdge=(id,source,target,label,mode,guard,audio=null)=>{
    add(id,source,target,label,mode,audio,guard,false);
    const edge=model.transitions.find(edge=>edge.id===id);edge.v2_contract='BREAK-DOWN';edge.contract={trigger:label,guard,state_changes:'Apply structured BREAK-DOWN postconditions; retain originating trip/interval identity.',timing:'Execute complete commands immediately; wait for explicit OK before starting a selected break.',persistence:'Starting/ending the interval writes its event exactly once; selecting a type is local.',rollback:'Restore the authoritative trip/interval checkpoint on rejection.',verification:model.v2_contracts['BREAK-DOWN'].evidence.join('; ')};
};
breakEdge('BSELECT-POINTER','B0','BSELECT','Press Break / Short Break / Lunch: select only','pointer','Selector open; type choice does not start the interval','break-choice');
for(const [type,target,sound]of [['short break','B10','short-break-started'],['break','B15','break-started'],['lunch','BL','lunch-started']]){
    breakEdge('BSELECT-OK-'+target,'BSELECT',target,'OK after selecting '+type,'voice','Selected type '+type+'; interval starts once',sound);
    for(const origin of ['R1','DOWN'])breakEdge('BCHAIN-'+origin+'-'+target,origin,target,'Break Start '+type+' OK','voice','Complete chained type plus OK; Down handoff ends its original interval once',sound);
}
for(const edge of model.transitions.filter(t=>/LOGIN-CANCEL-LOGIN-PIN|LOGIN-PCANCEL-LOGIN-PIN/.test(t.id)))edge.guard='At least one PIN digit entered; empty PIN Cancel uses LOGIN-EMPTY-PIN-CANCEL.';
// Trigger, input validity and test result are independent dimensions.
for(const state of ['LOGIN-ID','LOGIN-PIN']){
    for(const mode of ['pointer','voice']){
        const id=state+'-INVALID-'+mode.toUpperCase();
        const label=mode==='voice'?'Incomplete/malformed digit group or bare OK before review':'OK/Return with fewer than four digits';
        add(id,state,state,label,mode,null,'No valid four-digit group confirmation; never authenticate');
        const edge=model.transitions.find(t=>t.id===id);
        edge.outcome='invalid';
        edge.contract={trigger:label,guard:edge.guard,state_changes:'Remain in the current entry phase; do not accept a partial credential group or enter review.',discard:'Discard the rejected speech segment; preserve previously accepted group and trip state. Pointer input remains editable.',timing:'Reject the invalid confirmation immediately.',persistence:'Zero credential requests; zero trip writes.',audio:mode==='voice'?'No success announcement or digit readback.':'No success announcement; show input validation feedback.',loopback_feedback:{classification:'rejection',rule:'Rejected input does not produce a successful unchanged cue.'},verification:model.v2_contracts.LOGIN.evidence.join('; ')};
    }
}
for(const edge of model.transitions){
    if(edge.mode==='system')edge.mode='automatic';
    edge.outcome=edge.mode==='failure'?'rollback':edge.outcome||(edge.contract?.loopback_feedback?.classification==='rejection'?'invalid':'valid');
    if(edge.v2_contract&&edge.test?.status!=='untested'){
        edge.previous_test=edge.test;
        edge.test={status:'untested',version:'',evidence:'Contract reconciled for version 2; historical evidence retained separately. See v2_contracts for scenario sources.'};
    }
}
model.path_encoding={input:'pointer = touch, mouse or keyboard; voice = recognized speech; automatic = system event; failure = persistence rollback',outcome:'valid = solid; invalid = dashed; rollback = dotted; automatic valid = dash-dot',stroke:'pointer = single; voice = double',test_status:'Separate labeled badge: passed, failed or untested. A valid path is not evidence of a passed test.'};
const loops=model.transitions.filter(t=>t.source===t.target);
model.contracts['setting-chimes'].fsm_loopback_audit={...model.contracts['setting-chimes'].fsm_loopback_audit,count:loops.length,edges:loops.map(t=>({transition:t.id,source:t.source,target:t.target,classification:t.contract?.loopback_feedback?.classification||'conditional'}))};
model.known_issues = model.known_issues.filter(issue=>!['KNOWN-V2-PENDING','KNOWN-VOSK-FORK'].includes(issue.id));
model.known_issues.push({id:'KNOWN-V2-PENDING',status:'unverified reports',title:'Ready-duration carryover, sleeping-mic Log, rapid range/log/pinned-control restoration, and the summary-only break-ending report require specific reproduction. Do not mark fixed from this reconciliation.'});
model.known_issues.push({id:'KNOWN-VOSK-FORK',status:'deferred',title:'Custom Vosk safe in-place grammar-switching runtime remains deferred and must start on a new branch.'});
model.contracts['version-2-reference']={purpose:'Executable behavioral oracle for a replacement implementation, independent of its internal classes.',case_format:{given:'Public state, focused surface, allowed controls, owner locks and persisted baseline',when:'Physical gesture or recognized transcript/final/silence event with timestamps and utterance ID',then:'Exact public state, focused control, enabled/disabled controls, ordered announcements, API/event effects, and released owners',negative:'Malformed/ambiguous/revised input, stale operation/result, denial/failure and replay variants'},evidence_rule:'A listed test is a scenario source, not proof that every chart edge passed. Preserve status and test/version evidence; unresolved baseline contracts remain explicit gaps.'};
model.v2_test_vectors=JSON.parse(read('docs/fsm-v2-cases.json'));
model.contracts['version-2-reference'].precedence='Structured v2_contracts and v2_test_vectors specify the reconciled areas. Earlier explanatory prose is historical where it conflicts. Retired edges are not valid version 2 inputs. Unresolved baseline contracts outside the reconciled areas remain explicit test-coverage gaps.';
const serialized=JSON.stringify(model,null,2)+'\n';
write('docs/mainline-fsm-draft.json',serialized);
let html=read('docs/mainline-fsm-draft.html');
html=html.replace(/(<script id="fsm-data" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+'\n'+serialized+b);
html=html.replace(/DRAFT · 6 Oct 2026/g,'DRAFT · 16 Oct 2026');
html=html.replace(/Source baseline: [^<]+/,'Implementation reconciliation: '+commits.length+' commits · version 2 test contracts · 16 Oct 2026');
html=html.replace(/const positions=(\{[^\n]+\});/,(_,json)=>{const positions=JSON.parse(json.replace(/([{,])\s*([A-Za-z_$][\w$]*)\s*:/g,'$1"$2":'));const pin=positions['LOGIN-PIN']||[0,0,0];positions['LOGIN-REVIEW']=[pin[0]+600,pin[1]+300,pin[2]];positions.BSELECT=[-120,-650,1550];return 'const positions='+JSON.stringify(positions)+';';});
write('docs/mainline-fsm-draft.html',html);
require('./fsm-path-styles.cjs');
console.log(`Reconciled ${commits.length} commits, ${Object.keys(model.states).length} states and ${model.transitions.length} transitions; ${Object.keys(model.v2_contracts).length} structured version 2 contracts.`);
