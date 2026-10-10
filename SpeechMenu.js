// Stable literal-prefix tree; regexes remain the final matching authority.
class SpeechCommandIndex {
    #trees = new Map();
    #records = new Map();
    #nextOrder = 0;
    #observer;
    generation = 0;

    constructor(root = document.documentElement) {
        this.root = root;
        for (const element of root.querySelectorAll('[speech-pattern]')) this.#register(element);
        const Observer = globalThis.MutationObserver || root.ownerDocument?.defaultView?.MutationObserver;
        if (typeof Observer === 'function') {
            this.#observer = new Observer(records => this.#reconcile(records));
            this.#observer.observe(root, {subtree: true, childList: true, attributes: true,
                attributeFilter: ['speech-noun', 'speech-modal', 'speech-scope', 'popover', 'speech-pattern', 'speech-persist', 'speech-skippable', 'speech-chain-context', 'speech-chain-next', 'speech-chain-surface', 'speech-available',
                    'speech-authorized', 'speech-function', 'speech-preproc', 'speech-preproc-context',
                    'speech-preproc-field', 'speech-collect', 'hidden', 'disabled', 'inert', 'aria-hidden', 'open', 'primed']});
        }
    }

    static literalPrefix(pattern) {
        // Only index syntax whose leading literals are certain. Alternatives,
        // lookarounds and variable-leading patterns safely use the fallback.
        if (!pattern?.startsWith('^')) return [];
        let literal = '', complete = false;
        for (let i = 1; i < pattern.length; i++) {
            const char = pattern[i];
            if (char === '$' && i === pattern.length - 1) {complete = true; break;}
            if ('\\()[]{}.*+?|^$'.includes(char)) {
                if ('?*{'.includes(char) && /\s$/.test(literal)) literal = literal.trimEnd();
                break;
            }
            literal += char;
            if (i === pattern.length - 1) complete = true;
        }
        // A top-level alternative can bypass all preceding literals.
        let nesting = 0, bracket = false, escaped = false;
        for (const char of pattern) {
            if (escaped) {escaped = false; continue;}
            if (char === '\\') {escaped = true; continue;}
            if (char === '[') bracket = true;
            if (char === ']') bracket = false;
            if (bracket) continue;
            if (char === '(') nesting++;
            if (char === ')') nesting--;
            if (char === '|' && nesting === 0) return [];
        }
        if (!complete && !/\s$/.test(literal)) literal = literal.replace(/\S+$/, '');
        return literal.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    }

    #register(element) {
        const pattern = element.getAttribute('speech-pattern');
        if (!pattern || !this.root.contains(element)) {this.#remove(element); return;}
        const modalMode = element.getAttribute('speech-modal') ?? element.closest('speech-menu')?.getAttribute('speech-modal');
        const reserved = ['SpeechMenu.close', 'SpeechMenu.cancel'].includes(element.getAttribute('speech-function'));
        const scope = reserved ? 'system' : ['system', 'top-level', 'default', ''].includes(modalMode) ? modalMode || 'default'
            : element.closest('dialog, [popover], details, [speech-scope]') || null;
        const nouns = element.getAttribute('speech-noun') || '';
        const previous = this.#records.get(element);
        if (previous?.pattern === pattern && previous.scope === scope && previous.nouns === nouns) return;
        const primedOwner = previous?.tree.primed.get(element);
        this.#remove(element);
        let tree = this.#trees.get(scope);
        if (!tree) this.#trees.set(scope, tree = {children: new Map(), commands: new Set(), descendants: new Set(), fallback: new Set(), primed: new Map()});
        tree.descendants.add(element);
        const prefixes = nouns ? nouns.split('|').map(noun => noun.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean))
            : [SpeechCommandIndex.literalPrefix(pattern)];
        const path = [];
        for (const words of prefixes) {
            let node = tree;
            for (const word of words) {
                let next = node.children.get(word);
                if (!next) node.children.set(word, next = {children: new Map(), commands: new Set(), descendants: new Set()});
                path.push({parent: node, word, node: next});
                next.descendants.add(element);
                node = next;
            }
            if (words.length) node.commands.add(element);
            else tree.fallback.add(element);
        }
        this.#records.set(element, {pattern, nouns, path, scope, tree, order: this.#nextOrder++});
        if (primedOwner !== undefined) {tree.primed.set(element, primedOwner); element.setAttribute('primed', '');}
        this.generation++;
    }

    #remove(element) {
        const record = this.#records.get(element);
        if (!record) return;
        if (record.tree.primed.delete(element)) element.removeAttribute('primed');
        record.tree.fallback.delete(element);
        record.tree.descendants.delete(element);
        for (const {node} of record.path) {node.commands.delete(element); node.descendants.delete(element);}
        for (const {parent, word, node} of record.path.toReversed()) {
            if (!node.descendants.size) parent.children.delete(word);
        }
        if (!record.tree.descendants.size) this.#trees.delete(record.scope);
        this.#records.delete(element);
        this.generation++;
    }

    #reconcile(records) {
        const affected = new Set();
        const collect = node => {
            if (node.nodeType !== 1) return;
            if (node.hasAttribute('speech-pattern') || this.#records.has(node)) affected.add(node);
            for (const child of node.querySelectorAll('[speech-pattern]')) affected.add(child);
            // Removed subtrees may have lost speech-pattern before delivery.
            for (const element of this.#records.keys()) if (node.contains(element)) affected.add(element);
        };
        for (const record of records) {
            if (record.type === 'attributes') {
                if (record.attributeName !== 'speech-pattern') this.generation++;
                collect(record.target);
            }
            else {for (const node of record.addedNodes) collect(node); for (const node of record.removedNodes) collect(node);}
        }
        for (const element of affected) this.#register(element);
    }

    flush() {if (this.#observer) this.#reconcile(this.#observer.takeRecords());}
    elements() {this.flush(); return [...this.#records.keys()];}
    // Load only active scope buckets. Definitions stay registered, so closing a
    // dialog unloads its commands without rebuilding patterns or prefix trees.
    activeElements(surface, openContainers = []) {
        this.flush();
        const selected = new Set();
        for (const [scope, tree] of this.#trees) {
            const global = typeof scope === 'string';
            const active = global || (surface ? scope && surface.contains(scope)
                : scope === null || openContainers.some(container => container.contains(scope)));
            for (const element of active ? tree.descendants : tree.primed.keys()) selected.add(element);
        }
        // Preserve existing tie-breaking order across scope buckets.
        return [...selected].sort((a, b) => this.#records.get(a).order - this.#records.get(b).order);
    }
    prime(element, owner) {
        this.flush();
        const record = this.#records.get(element);
        if (!record) return;
        record.tree.primed.set(element, owner);
        element.setAttribute('primed', '');
        this.generation++;
    }
    isPrimed(element, owner) {
        this.flush();
        return owner !== undefined && this.#records.get(element)?.tree.primed.get(element) === owner;
    }
    clearPrimed(owner) {
        this.flush();
        for (const tree of this.#trees.values()) for (const [element, id] of tree.primed) {
            if (owner !== undefined && id !== owner) continue;
            tree.primed.delete(element);
            element.removeAttribute('primed');
            this.generation++;
        }
    }

    clearSurfacePrimed(surface, owner) {
        this.flush();
        const tree = this.#trees.get(surface);
        if (!tree) return;
        for (const [element, id] of tree.primed) {
            if (owner !== undefined && owner !== id) continue;
            tree.primed.delete(element); element.removeAttribute('primed'); this.generation++;
        }
    }

    #accessible(node, eligible) {
        if (!eligible) return true;
        if (node.accessScope !== eligible || node.accessGeneration !== this.generation) {
            node.accessScope = eligible;
            node.accessGeneration = this.generation;
            node.accessible = [...node.descendants].some(element => eligible.has(element));
        }
        return node.accessible;
    }

    candidates(words, eligible) {
        this.flush();
        const found = new Set();
        const scopes = eligible ? new Set([...eligible].map(element => this.#records.get(element)?.scope)) : this.#trees.keys();
        for (const scope of scopes) {
            const tree = this.#trees.get(scope);
            if (!tree || !this.#accessible(tree, eligible)) continue;
            for (const element of tree.fallback) if (!eligible || eligible.has(element)) found.add(element);
            let node = tree;
            for (let i = 0; i < words.length; i++) {
                const word = words[i].toLocaleLowerCase();
                if (i === words.length - 1) {
                    for (const [key, child] of node.children) {
                        if (key.startsWith(word) && this.#accessible(child, eligible))
                            for (const command of child.descendants) if (!eligible || eligible.has(command)) found.add(command);
                    }
                }
                node = node.children.get(word);
                if (!node || !this.#accessible(node, eligible)) break;
                for (const command of node.commands) if (!eligible || eligible.has(command)) found.add(command);
                if (i === words.length - 1) for (const command of node.descendants)
                    if (!eligible || eligible.has(command)) found.add(command);
            }
        }
        return found;
    }
}

class SpeechMenu {
    static #surfaceHandlers = new Map();
    static #surfaceOrder = [];
    static #surfaceListeners = new Map();
    static #commandIndex;
    static #selectionState;
    static get selectionState() {return SpeechMenu.#selectionState;}
    static #indexedMatching = true;
    static #index() { return SpeechMenu.#commandIndex ??= new SpeechCommandIndex(); }
    static #stopped = true;
    static #modelReady = false;
    static #sleeping = false;
    static #listeningSuspensions = 0;
    static #events = new EventTarget();
    static #separator = ",";
    static #language = "en-US";
    static #silenceTimeout = 5000;
    static #commitSilenceTimeout = 350;
    static #terminalCommitSilenceTimeout = 120;
    static #continuationSilenceTimeout = 900;
    static #vadMinimumSilenceMilliseconds = 220;
    static #maximumCandidateHoldTimeout = 1200;
    static #adaptiveTiming =
        typeof globalThis
            .AdaptiveSpeechTiming ===
            "function"
            ? new globalThis
                .AdaptiveSpeechTiming()
            : undefined;
    static #speechThreshold = 0.025;
    static #preRollMilliseconds = 350;
    static #stream;
    static #micTrack;
    static #audioContext;
    static #sourceNode;
    static #captureNode;
    static #recognizer;
    static #vad;
    static #pipeline = "raw";
    static #finishedUtterances = new Map();
    static #silentGain;
    static #utterance;
    static #utteranceSequence = 0;
    static #preRollFrames = [];
    static #preRollSamples = 0;
    static #startPromise;
    static #sessionGeneration = 0;
    static #contextGeneration = 0;
    static #lastLevelEventAt = 0;
    static #debug = false;
    static #debugFunction = data => console.log(data);
    static #executionEnabled = true;
    static #systemExecutionPassthrough = false;
    static #executionContext;
    static #feedbackAdapter;

    static setFeedbackAdapter(adapter) { SpeechMenu.#feedbackAdapter = adapter; }

    static #flushCommandFeedback(utterance, accepted) {
        const callbacks = utterance?.feedbackCallbacks || [];
        if (utterance) utterance.feedbackCallbacks = [];
        if (accepted) for (const callback of callbacks) callback();
    }

    static #commandFeedback(element, context, snapshot, result, utterance) {
        const run = () => {
            if (context.skippable && context.hasContinuation?.()) return;
            try { SpeechMenu.#feedbackAdapter?.complete?.({element, context, snapshot, result}); }
            catch (error) { SpeechMenu.#emit("speechFeedbackError", {error, utteranceId: context.utteranceId}); }
        };
        // Keep UI execution immediate. Only optional speech waits while an
        // interim transcript can still continue into another command.
        if (context.skippable && context.chain && utterance && !utterance.digestCommitted) {
            (utterance.feedbackCallbacks ||= []).push(run);
        } else if (!utterance?.chainCanceled && !utterance?.digestExecutionFailed) run();
    }
    static #synthesizedSpeech = new Map();
    static #synthesizedSpeechSequence = 0;
    static #synthesizedSpeechGraceMilliseconds = 750;
    static #phrases = Object.freeze([]);
    static #phraseGroups = Object.freeze([]);
    static #phraseRefreshQueued = false;
    static #surfaceContextRefreshPending = false;
    static #recognizerHotwordKey = "";
    static #corrections = Object.freeze([]);
    static #correctionsRevision = "empty";
    static #builtInCorrections =
        Object.freeze([
            ...[
                ["red", -101],
                ["redd", -102]
            ]
                .map(
                    ([observed, id]) =>
                        Object.freeze({
                            id,
                            observed,
                            observedCompact:
                                observed,
                            canonical:
                                "ready",
                            canonicalCompact:
                                "ready",
                            matchType:
                                "prefix",
                            occurrences:
                                1
                        })
                ),
            Object.freeze({
                id: -104,
                observed:
                    "sinkon",
                observedCompact:
                    "sinkon",
                canonical:
                    "sync on",
                canonicalCompact:
                    "syncon",
                matchType:
                    "exact",
                occurrences:
                    1
            }),
            Object.freeze({
                id: -105,
                observed:
                    "sinoff",
                observedCompact:
                    "sinoff",
                canonical:
                    "sync off",
                canonicalCompact:
                    "syncoff",
                matchType:
                    "exact",
                occurrences:
                    1
            })
        ]);

    static {
        document.addEventListener("visibilitychange", () => {
            if (
                document.visibilityState === "visible" &&
                SpeechMenu.#audioContext?.state === "suspended"
            ) {
                void SpeechMenu.#audioContext.resume().catch(() => {});
            }
        });

        const refreshPhrases =
            () => SpeechMenu.#schedulePhraseRefresh();

        const refreshSurfaceContext =
            () => {
                SpeechMenu
                    .#surfaceContextRefreshPending =
                    true;

                SpeechMenu
                    .#schedulePhraseRefresh();
            };

        for (
            const type of [
                "toggle",
                "close"
            ]
        ) {
            document.addEventListener(
                type,
                refreshSurfaceContext,
                true
            );
        }

        for (
            const type of [
                "cancel",
                "okStatusChanged"
            ]
        ) {
            document.addEventListener(
                type,
                refreshPhrases,
                true
            );
        }

        if (typeof MutationObserver === "function") {
            new MutationObserver(
                records => {
                    const surfaceChanged =
                        records.some(
                            record =>
                                record.type ===
                                    "attributes" &&
                                [
                                    "open",
                                    "hidden",
                                    "inert",
                                    "aria-hidden"
                                ].includes(
                                    record.attributeName
                                ) &&
                                record.target
                                    ?.matches?.(
                                        "dialog, [popover], details"
                                    )
                        );

                    if (surfaceChanged) {
                        SpeechMenu
                            .#surfaceContextRefreshPending =
                            true;
                    }

                    SpeechMenu
                        .#schedulePhraseRefresh();
                }
            )
                .observe(
                    document.documentElement,
                    {
                        subtree: true,
                        childList: true,
                        attributes: true,
                        attributeFilter: [
                            "speech-pattern",
                            "speech-noun",
                            "speech-modal",
                            "speech-index",
                            "data-speech-options-group",
                            "data-speech-options-category",
                            "open",
                            "hidden",
                            "disabled",
                            "inert",
                            "aria-hidden",
                            "speech-available",
                            "speech-open-ended",
                            "speech-chain-context",
                            "speech-chain-next",
                            "speech-chain-surface",
                            "speech-scope",
                            "speech-authorized",
                            "speech-collect",
                            "speech-function",
                            "speech-preproc",
                            "speech-preproc-context",
                            "speech-preproc-field",
                            "primed"
                        ]
                    }
                );
        }

        queueMicrotask(refreshPhrases);
    }

    static get events() { return SpeechMenu.#events; }

    static createMicrophoneStream() {
        const track =
            SpeechMenu.#micTrack;

        if (
            !track ||
            track.readyState !== "live" ||
            typeof globalThis.MediaStream !==
                "function" ||
            typeof track.clone !==
                "function"
        ) {
            return undefined;
        }

        return new globalThis.MediaStream(
            [
                track.clone()
            ]
        );
    }
    static get debug() { return SpeechMenu.#debug; }
    static get debugFunction() { return SpeechMenu.#debugFunction; }
    static get executionEnabled() { return SpeechMenu.#executionEnabled; }
    static get systemExecutionPassthrough() { return SpeechMenu.#systemExecutionPassthrough; }
    static registerSurface(element, handlers) {
        if (!element?.isConnected || typeof handlers?.close !== 'function') {
            throw new TypeError('A connected surface and close handler are required.');
        }
        SpeechMenu.#surfaceListeners.get(element)?.();
        SpeechMenu.#surfaceHandlers.set(element, handlers);
        const toggled = event => {
            if (event.newState === 'open' || handlers.isOpen?.()) SpeechMenu.surfaceOpened(element);
            else SpeechMenu.surfaceClosed(element);
        };
        element.addEventListener('toggle', toggled);
        element.addEventListener('close', toggled);
        const detach = () => {
            element.removeEventListener('toggle', toggled);
            element.removeEventListener('close', toggled);
        };
        SpeechMenu.#surfaceListeners.set(element, detach);
        if (handlers.isOpen?.()) SpeechMenu.surfaceOpened(element);
        return () => {
            if (SpeechMenu.#surfaceHandlers.get(element) !== handlers) return;
            detach(); SpeechMenu.#surfaceListeners.delete(element);
            SpeechMenu.#surfaceHandlers.delete(element); SpeechMenu.surfaceClosed(element);
        };
    }

    static surfaceOpened(element) {
        if (!SpeechMenu.#surfaceHandlers.has(element)) return false;
        SpeechMenu.#surfaceOrder = SpeechMenu.#surfaceOrder.filter(surface => surface !== element);
        SpeechMenu.#surfaceOrder.push(element);
        return true;
    }

    static surfaceClosed(element) {
        SpeechMenu.#surfaceOrder = SpeechMenu.#surfaceOrder.filter(surface => surface !== element);
        return true;
    }

    static get activeSurface() {
        // Reconcile custom surfaces whose UI changed without a native toggle.
        for (const [element, handlers] of SpeechMenu.#surfaceHandlers) {
            if (element.isConnected && handlers.isOpen?.() && !SpeechMenu.#surfaceOrder.includes(element)) {
                SpeechMenu.#surfaceOrder.push(element);
            }
        }
        SpeechMenu.#surfaceOrder = SpeechMenu.#surfaceOrder.filter(element =>
            element.isConnected && SpeechMenu.#surfaceHandlers.get(element)?.isOpen?.());
        let active, priority = -Infinity;
        for (const element of SpeechMenu.#surfaceOrder) {
            const value = SpeechMenu.#surfaceHandlers.get(element).priority || 0;
            if (value >= priority) {active = element; priority = value;}
        }
        return active;
    }

    static #surfaceFrames() {
        SpeechMenu.activeSurface;
        const surfaces = SpeechMenu.#surfaceOrder.filter(element => element !== document.body)
            .toSorted((a, b) => (SpeechMenu.#surfaceHandlers.get(a)?.priority || 0) - (SpeechMenu.#surfaceHandlers.get(b)?.priority || 0));
        if (!surfaces.length) surfaces.push(...document.querySelectorAll('dialog[open]'));
        const items = SpeechMenu.#index().elements();
        return surfaces.map(surface => ({surface, context: SpeechMenu.#chainContextTokens(items.find(element =>
            element.closest('dialog, [popover], [speech-scope]') === surface && element.hasAttribute('speech-chain-context')))[0]}));
    }

    static async close() { return SpeechMenu.#dismissSurface('close'); }
    static async cancel() { return SpeechMenu.#dismissSurface('cancel'); }

    static async #dismissSurface(intent) {
        const context = SpeechMenu.#executionContext;
        const projected = context?.chainSurface;
        const surface = SpeechMenu.activeSurface;
        if (projected && projected !== surface) return false;
        const handlers = SpeechMenu.#surfaceHandlers.get(surface);
        if (!handlers || !surface?.isConnected || handlers.isOpen?.() === false ||
            handlers.canClose?.(intent) === false) return false;
        const handler = intent === 'cancel' ? handlers.cancel || handlers.close : handlers.close;
        const result = await handler({intent, surface, context});
        if (result === false) return false;
        SpeechMenu.#index().clearSurfacePrimed(surface, context?.utteranceId);
        const owner = SpeechMenu.#utterance?.id === context?.utteranceId
            ? SpeechMenu.#utterance : SpeechMenu.#finishedUtterances.get(context?.utteranceId);
        owner?.expectedSurfaces?.delete(surface);
        SpeechMenu.#index().flush();
        return true;
    }

    static get executionContext() { return SpeechMenu.#executionContext; }
    static withExecutionContext(context, operation) {
        const previous = SpeechMenu.#executionContext;
        SpeechMenu.#executionContext = context;
        try {return operation();} finally {SpeechMenu.#executionContext = previous;}
    }

    static get synthesizedSpeechActive() { return SpeechMenu.#synthesizedSpeech.size > 0; }
    static get pipeline() { return SpeechMenu.#pipeline; }
    static get silenceTimeout() { return SpeechMenu.#silenceTimeout; }
    static get commitSilenceTimeout() { return SpeechMenu.#commitSilenceTimeout; }
    static get modelReady() {return SpeechMenu.#modelReady;}
    static get started() { return Boolean(SpeechMenu.#stream) && !SpeechMenu.#stopped; }
    static get muted() { return SpeechMenu.#sleeping; }
    static get listeningSuspended() { return SpeechMenu.#listeningSuspensions > 0; }
    static get phrases() { return SpeechMenu.#phrases; }
    static get phraseGroups() { return SpeechMenu.#phraseGroups; }
    static get corrections() { return SpeechMenu.#corrections; }
    static get correctionsRevision() { return SpeechMenu.#correctionsRevision; }
    static get speechTimingSnapshot() {
        const timing =
            SpeechMenu
                .#adaptiveTiming
                ?.snapshot || {};

        const utterance =
            SpeechMenu
                .#utterance;
        const exact =
            SpeechMenu
                .#exactCandidate(
                    utterance
                );
        const streamHead =
            SpeechMenu
                .#recognitionStreamHead(
                    utterance
                );

        return {
            ...timing,
            recognition: {
                utteranceId:
                    utterance?.id,
                transcript:
                    streamHead
                        ?.transcript ||
                    utterance
                        ?.transcript ||
                    "",
                exact:
                    streamHead
                        ?.exact ??
                    Boolean(exact),
                canContinue:
                    streamHead
                        ?.canContinue ??
                    SpeechMenu
                        .#hasOpenContinuation(
                            utterance
                        ),
                candidateCount:
                    streamHead
                        ?.candidateCount ??
                    (
                        utterance
                            ?.candidatePool
                            ?.length ||
                        0
                    ),
                silenceMilliseconds:
                    Math.round(
                        Number(
                            utterance
                                ?.silenceMilliseconds
                        ) ||
                        0
                    ),
                streamDepth:
                    utterance
                        ?.streamStack
                        ?.length ||
                    0,
                streams:
                    (
                        utterance
                            ?.streamStack ||
                        []
                    ).map(
                        stream => ({
                            id:
                                stream.id,
                            transcript:
                                stream.transcript,
                            pauseMilliseconds:
                                stream.pauseMilliseconds,
                            source:
                                stream.source,
                            status:
                                stream.status,
                            exact:
                                Boolean(
                                    stream.exact
                                ),
                            canContinue:
                                Boolean(
                                    stream.canContinue
                                ),
                            repeatable:
                                Boolean(
                                    stream.repeatable
                                )
                        })
                    )
            }
        };
    }

    static configureSpeechTimingProfile(
        profile
    ) {
        return SpeechMenu
            .#adaptiveTiming
            ?.configureProfile(
                profile
            );
    }

    static setSpeechTimingTtsRate(
        value
    ) {
        return SpeechMenu
            .#adaptiveTiming
            ?.setTtsRate(
                value
            );
    }

    static beginSpeechTimingTrip() {
        return SpeechMenu
            .#adaptiveTiming
            ?.startTrip();
    }

    static finishSpeechTimingTrip() {
        return SpeechMenu
            .#adaptiveTiming
            ?.finishTrip();
    }

    static resetSpeechTimingTrip() {
        SpeechMenu
            .#adaptiveTiming
            ?.resetTrip();
    }

    static async wake({
        utteranceId,
        transcript,
        signal
    } = {}) {
        if (signal?.aborted) {
            return false;
        }

        utteranceId ??=
            SpeechMenu
                .#executionContext
                ?.utteranceId;
        transcript ??=
            SpeechMenu
                .#executionContext
                ?.transcript;

        SpeechMenu.#sleeping =
            false;
        SpeechMenu
            .#schedulePhraseRefresh();

        SpeechMenu.#emit(
            "unmuted",
            {
                utteranceId,
                transcript
            }
        );

        return true;
    }

    static async sleep({
        utteranceId,
        transcript,
        signal
    } = {}) {
        if (signal?.aborted) {
            return false;
        }

        utteranceId ??=
            SpeechMenu
                .#executionContext
                ?.utteranceId;
        transcript ??=
            SpeechMenu
                .#executionContext
                ?.transcript;

        SpeechMenu.#sleeping =
            true;
        SpeechMenu
            .#schedulePhraseRefresh();

        SpeechMenu.#emit(
            "muted",
            {
                utteranceId,
                transcript
            }
        );

        return true;
    }

    static isCommandImplemented(element) {
        if (!(element instanceof Element)) {
            return false;
        }

        const speechFunction =
            element.getAttribute(
                "speech-function"
            );

        if (
            !SpeechMenu
                .#resolve(
                    speechFunction
                )
        ) {
            return false;
        }

        const speechPreproc =
            element.getAttribute(
                "speech-preproc"
            );

        return (
            !speechPreproc ||
            speechPreproc.split(",").map(name => name.trim()).filter(Boolean)
                .every(name => Boolean(SpeechMenu.#resolve(name)))
        );
    }

    static set silenceTimeout(value) {
        const milliseconds = Number(value);
        if (!Number.isFinite(milliseconds) || milliseconds < 100) {
            throw new RangeError("SpeechMenu.silenceTimeout must be at least 100 milliseconds.");
        }
        SpeechMenu.#silenceTimeout = Math.round(milliseconds);
        SpeechMenu.#emit("silenceTimeoutChanged", {
            silenceTimeout: SpeechMenu.#silenceTimeout
        });
    }
    static set commitSilenceTimeout(value) {
        const milliseconds = Number(value);
        if (!Number.isFinite(milliseconds) || milliseconds < 100) {
            throw new RangeError("SpeechMenu.commitSilenceTimeout must be at least 100 milliseconds.");
        }
        SpeechMenu.#commitSilenceTimeout = Math.round(milliseconds);
        SpeechMenu.#emit("commitSilenceTimeoutChanged", {
            commitSilenceTimeout: SpeechMenu.#commitSilenceTimeout
        });
    }
    static set debug(value) {
        const next = Boolean(value);
        if (next === SpeechMenu.#debug) return;
        SpeechMenu.#debug = next;
        SpeechMenu.#emit("debugToggled", {debug: next});
    }
    static set debugFunction(value) {
        SpeechMenu.#debugFunction =
            typeof value === "function"
                ? value
                : data => console.log(data);
        SpeechMenu.#emit("debugFunctionChanged", {
            debugFunction: SpeechMenu.#debugFunction
        });
    }

    static registerSynthesizedSpeech(value) {
        const text =
            SpeechMenu
                .#normalizeTranscript(
                    value
                );

        if (!text) {
            return undefined;
        }

        const id =
            ++SpeechMenu
                .#synthesizedSpeechSequence;

        SpeechMenu.#synthesizedSpeech
            .set(
                id,
                {
                    text,
                    expiresAt:
                        Infinity,
                    timer:
                        undefined
                }
            );

        return id;
    }

    static unregisterSynthesizedSpeech(
        id,
        {
            graceMilliseconds =
                SpeechMenu
                    .#synthesizedSpeechGraceMilliseconds
        } = {}
    ) {
        const entry =
            SpeechMenu
                .#synthesizedSpeech
                .get(id);

        if (!entry) {
            return false;
        }

        clearTimeout(
            entry.timer
        );

        const delay =
            Math.max(
                0,
                Number(
                    graceMilliseconds
                ) || 0
            );

        if (delay === 0) {
            SpeechMenu
                .#synthesizedSpeech
                .delete(id);
            return true;
        }

        entry.expiresAt =
            performance.now() +
            delay;

        entry.timer =
            setTimeout(
                () => {
                    SpeechMenu
                        .#synthesizedSpeech
                        .delete(id);
                },
                delay
            );

        return true;
    }

    static set executionEnabled(value) {
        const next =
            Boolean(value);

        if (
            next ===
            SpeechMenu.#executionEnabled
        ) {
            return;
        }

        SpeechMenu.#executionEnabled =
            next;

        SpeechMenu.#emit(
            "speechExecutionChanged",
            {
                enabled:
                    next
            }
        );
    }

    static set systemExecutionPassthrough(value) {
        const next =
            Boolean(value);

        if (
            next ===
            SpeechMenu.#systemExecutionPassthrough
        ) {
            return;
        }

        SpeechMenu.#systemExecutionPassthrough =
            next;

        SpeechMenu.#emit(
            "speechSystemExecutionPassthroughChanged",
            {
                enabled:
                    next
            }
        );
    }

    static set pipeline(value) {
        const next =
            String(value || "raw")
                .toLocaleLowerCase();

        if (
            next !== "raw" &&
            next !== "silero"
        ) {
            throw new RangeError(
                'SpeechMenu.pipeline must be "raw" or "silero".'
            );
        }

        if (
            SpeechMenu.started ||
            SpeechMenu.#startPromise
        ) {
            throw new Error(
                "SpeechMenu.pipeline cannot change while speech recognition is running."
            );
        }

        SpeechMenu.#pipeline =
            next;

        SpeechMenu.#emit(
            "speechPipelineChanged",
            {
                pipeline:
                    next
            }
        );
    }

    static async loadCorrections(
        url = "api/speech-corrections/?language=en-US"
    ) {
        try {
            const response =
                await fetch(
                    url,
                    {
                        credentials:
                            "same-origin",
                        cache:
                            "no-store",
                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );

            const data =
                await response.json();

            if (
                !response.ok ||
                !Array.isArray(
                    data.corrections
                )
            ) {
                throw new Error(
                    data.message ||
                    "Speech corrections could not be loaded."
                );
            }

            SpeechMenu.#corrections =
                Object.freeze(
                    data.corrections
                        .filter(
                            correction =>
                                correction &&
                                correction.enabled !== false &&
                                typeof correction.observed ===
                                    "string" &&
                                typeof correction.canonical ===
                                    "string"
                        )
                        .map(
                            correction =>
                                Object.freeze({
                                    id:
                                        Number(
                                            correction.id
                                        ) || 0,
                                    observed:
                                        SpeechMenu
                                            .#normalizeTranscript(
                                                correction.observed
                                            ),
                                    observedCompact:
                                        String(
                                            correction.observedCompact ||
                                            SpeechMenu
                                                .#compactTranscript(
                                                    correction.observed
                                                )
                                        ),
                                    canonical:
                                        SpeechMenu
                                            .#normalizeTranscript(
                                                correction.canonical
                                            ),
                                    canonicalCompact:
                                        String(
                                            correction.canonicalCompact ||
                                            SpeechMenu
                                                .#compactTranscript(
                                                    correction.canonical
                                                )
                                        ),
                                    matchType:
                                        correction.matchType ===
                                            "prefix"
                                            ? "prefix"
                                            : "exact",
                                    occurrences:
                                        Number(
                                            correction.occurrences
                                        ) || 1
                                })
                        )
                );

            SpeechMenu.#correctionsRevision =
                String(
                    data.revision ||
                    "unknown"
                );

            SpeechMenu.#emit(
                "speechCorrectionsChanged",
                {
                    corrections:
                        SpeechMenu.#corrections,
                    revision:
                        SpeechMenu.#correctionsRevision
                }
            );

            return true;
        }
        catch (error) {
            globalThis
                .WMOFPresentationSetters
                ?.cancelSpeechResponse?.(
                    responseSession
                );

            SpeechMenu.#emit(
                "speechCorrectionsFailed",
                {
                    error,
                    message:
                        error?.message ||
                        "Speech corrections could not be loaded."
                }
            );

            return false;
        }
    }

    static async start(language = "en-US", listSeparator = ",") {
        if (!navigator.mediaDevices?.getUserMedia) {
            SpeechMenu.#emit("speechRecognitionFailed", {
                error: "NotSupportedError",
                message: "Microphone capture is not supported by this browser."
            });
            return false;
        }

        if (SpeechMenu.#startPromise) return SpeechMenu.#startPromise;
        if (SpeechMenu.started && SpeechMenu.#modelReady) return true;

        SpeechMenu.#language =
            typeof language === "string" && language.trim()
                ? language
                : "en-US";

        SpeechMenu.#separator =
            typeof listSeparator === "string" && listSeparator
                ? listSeparator
                : ",";

        SpeechMenu.#sleeping = false;
        SpeechMenu.#stopped = false;
        SpeechMenu.#modelReady = false;

        const generation = ++SpeechMenu.#sessionGeneration;

        SpeechMenu.#startPromise = (async () => {
            let stream;

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });

                if (
                    SpeechMenu.#stopped ||
                    generation !== SpeechMenu.#sessionGeneration
                ) {
                    for (const track of stream.getTracks()) {
                        try { track.stop(); } catch {}
                    }
                    return false;
                }

                const AudioContextCtor =
                    window.AudioContext ||
                    window.webkitAudioContext;

                if (!AudioContextCtor) {
                    throw new Error(
                        "Web Audio is not supported by this browser."
                    );
                }

                const context =
                    new AudioContextCtor();

                if (context.state === "suspended") {
                    await context.resume();
                }

                const AudioWorkletNodeCtor =
                    window.AudioWorkletNode ||
                    globalThis.AudioWorkletNode;

                if (
                    !context.audioWorklet ||
                    typeof AudioWorkletNodeCtor !== "function" ||
                    typeof globalThis.SherpaRecognizer !== "function" ||
                    (
                        SpeechMenu.#pipeline === "silero" &&
                        typeof globalThis.SileroVad !== "function"
                    )
                ) {
                    try { await context.close(); } catch {}
                    throw new Error(
                        "This browser does not support the WMOF client speech runtime."
                    );
                }

                await context.audioWorklet.addModule(
                    globalThis.SherpaRecognizer.assetUrl(
                        "speech/SpeechAudioWorklet.js"
                    )
                );

                const recognizer =
                    new globalThis.SherpaRecognizer({
                        hotwords:
                            SpeechMenu.#hotwords()
                    });

                SpeechMenu.#recognizer =
                    recognizer;

                recognizer.addEventListener(
                    "transcript",
                    SpeechMenu.#onSherpaTranscript
                );

                recognizer.addEventListener(
                    "error",
                    SpeechMenu.#onSherpaError
                );

                recognizer.addEventListener(
                    "status",
                    SpeechMenu.#onSherpaStatus
                );

                recognizer.addEventListener(
                    "utteranceEnded",
                    SpeechMenu.#onSherpaUtteranceEnded
                );

                await recognizer.ready;

                if (
                    SpeechMenu.#pipeline === "silero"
                ) {
                    const vad =
                        new globalThis.SileroVad({
                            threshold: 0.5,
                            minSilenceDuration:
                                SpeechMenu
                                    .#vadMinimumSilenceMilliseconds /
                                1000,
                            minSpeechDuration: 0.15,
                            maxSpeechDuration: 20
                        });

                    SpeechMenu.#vad =
                        vad;

                    vad.addEventListener(
                        "speechStart",
                        SpeechMenu.#onVadSpeechStart
                    );

                    vad.addEventListener(
                        "speechEnd",
                        SpeechMenu.#onVadSpeechEnd
                    );

                    vad.addEventListener(
                        "error",
                        SpeechMenu.#onVadError
                    );

                    vad.addEventListener(
                        "status",
                        SpeechMenu.#onVadStatus
                    );

                    await vad.ready;
                }

                SpeechMenu.#stream =
                    stream;

                SpeechMenu.#micTrack =
                    stream.getAudioTracks()[0];

                if (!SpeechMenu.#micTrack) {
                    throw new Error(
                        "No microphone audio track was available."
                    );
                }

                SpeechMenu.#audioContext =
                    context;

                SpeechMenu.#sourceNode =
                    context.createMediaStreamSource(
                        stream
                    );

                SpeechMenu.#captureNode =
                    new AudioWorkletNodeCtor(
                        context,
                        "wmof-speech-capture",
                        {
                            numberOfInputs: 1,
                            numberOfOutputs: 1,
                            outputChannelCount: [1]
                        }
                    );

                SpeechMenu.#silentGain =
                    context.createGain();

                SpeechMenu.#silentGain.gain.value =
                    0;

                SpeechMenu.#captureNode.port
                    .addEventListener(
                        "message",
                        SpeechMenu.#onAudioWorkletMessage
                    );

                SpeechMenu.#captureNode.port
                    .start?.();

                SpeechMenu.#sourceNode.connect(
                    SpeechMenu.#captureNode
                );

                SpeechMenu.#captureNode.connect(
                    SpeechMenu.#silentGain
                );

                SpeechMenu.#silentGain.connect(
                    context.destination
                );

                SpeechMenu.#micTrack.addEventListener(
                    "ended",
                    SpeechMenu.#onTrackEnded,
                    {once: true}
                );

                SpeechMenu.#modelReady = true;
                SpeechMenu.#emit("started", {
                    language:
                        SpeechMenu.#language,
                    recognizer:
                        "sherpa",
                    pipeline:
                        SpeechMenu.#pipeline,
                    sampleRate:
                        globalThis.SherpaRecognizer
                            .sampleRate,
                    captureSettings:
                        SpeechMenu.#micTrack
                            .getSettings?.() ||
                        {},
                    silenceTimeout:
                        SpeechMenu.#silenceTimeout,
                    commitSilenceTimeout:
                        SpeechMenu.#commitSilenceTimeout,
                    deliberate: true
                });

                return true;
            }
            catch (error) {
                SpeechMenu.#stopped = true;

                if (
                    stream &&
                    stream !== SpeechMenu.#stream
                ) {
                    for (const track of stream.getTracks()) {
                        try { track.stop(); } catch {}
                    }
                }

                await SpeechMenu.#releaseCapture();

                SpeechMenu.#emit(
                    "speechRecognitionFailed",
                    {
                        error:
                            error?.name ||
                            "MicrophoneError",
                        message:
                            error?.message ||
                            String(error)
                    }
                );

                return false;
            }
            finally {
                SpeechMenu.#startPromise =
                    undefined;
            }
        })();

        return SpeechMenu.#startPromise;
    }

    static suspendListening(reason = "audio-playback") {
        SpeechMenu.#listeningSuspensions++;

        if (SpeechMenu.#listeningSuspensions === 1) {
            SpeechMenu.#preRollFrames = [];
            SpeechMenu.#preRollSamples = 0;

            SpeechMenu.#emit("listeningSuspended", {
                reason,
                count: SpeechMenu.#listeningSuspensions
            });
        }

        return SpeechMenu.#listeningSuspensions;
    }

    static resumeListening(reason = "audio-playback") {
        if (SpeechMenu.#listeningSuspensions <= 0) {
            SpeechMenu.#listeningSuspensions = 0;
            return false;
        }

        SpeechMenu.#listeningSuspensions--;

        if (SpeechMenu.#listeningSuspensions === 0) {
            SpeechMenu.#preRollFrames = [];
            SpeechMenu.#preRollSamples = 0;

            SpeechMenu.#emit("listeningResumed", {
                reason,
                count: 0
            });
        }

        return true;
    }

    static async stop() {
        const wasActive =
            !SpeechMenu.#stopped ||
            Boolean(SpeechMenu.#stream) ||
            Boolean(SpeechMenu.#startPromise);

        if (!wasActive) return false;

        SpeechMenu.#stopped = true;
        SpeechMenu.#sleeping = false;
        SpeechMenu.#sessionGeneration++;

        if (SpeechMenu.#utterance) {
            SpeechMenu.#finishUtterance(
                "stopped",
                false
            );
        }

        await SpeechMenu.#releaseCapture();

        SpeechMenu.#emit("stopped", {
            deliberate: true
        });

        return true;
    }

    static refresh() {
        for (
            const element of
            document.querySelectorAll(
                "[speech-pattern]"
            )
        ) {
            SpeechMenu.#prepare(
                element,
                true
            );
        }

        return SpeechMenu.extrapolatePhrases();
    }

    static extrapolatePattern(pattern) {
        return Object.freeze(
            SpeechMenu
                .#expandRegexSource(
                    pattern
                )
                .slice()
        );
    }

    static withoutPhrase(
        pattern,
        phrase
    ) {
        if (
            typeof pattern !== "string" ||
            typeof phrase !== "string" ||
            !phrase.trim()
        ) {
            return pattern;
        }

        const parts =
            SpeechMenu
                .#splitPhraseExclusions(
                    pattern
                );

        const exclusion =
            SpeechMenu
                .#phraseExclusionSource(
                    phrase
                );

        if (!exclusion) {
            return pattern;
        }

        const exclusions =
            [
                ...new Set([
                    ...parts.exclusions,
                    exclusion
                ])
            ];

        return (
            "^(?!(?:" +
            exclusions.join("|") +
            ")$)(?:" +
            parts.base +
            ")$"
        );
    }

    static async planCommandChain(
        transcript
    ) {
        SpeechMenu.extrapolatePhrases();

        const probe = {
            id: -1,
            candidatePool: [],
            lastExactCandidate:
                undefined
        };

        const candidate =
            await SpeechMenu
                .#planCommandChain(
                    probe,
                    transcript
                );

        if (!candidate) {
            return undefined;
        }

        return Object.freeze({
            exact:
                Boolean(
                    candidate.exact
                ),
            continuation:
                Boolean(
                    candidate
                        .continuation
                ),
            terminal:
                Boolean(
                    candidate.terminal
                ),
            pending:
                candidate.pending
                    ? Object.freeze({
                        editorId:
                            candidate
                                .pending
                                .element
                                ?.dataset
                                ?.speechEditorId ||
                            undefined,
                        transcript:
                            candidate
                                .pending
                                .transcript
                    })
                    : undefined,
            steps:
                Object.freeze(
                    candidate.chain
                        .map(
                            step =>
                                Object.freeze({
                                    editorId:
                                        step
                                            .commandElement
                                            ?.dataset
                                            ?.speechEditorId ||
                                        undefined,
                                    transcript:
                                        step
                                            .segmentTranscript ||
                                        step
                                            .transcript,
                                    canonicalTranscript:
                                        step
                                            .canonicalTranscript,
                                    arguments:
                                        Object.freeze(
                                            (
                                                step
                                                    .arguments ||
                                                []
                                            )
                                                .slice()
                                        )
                                })
                        )
                )
        });
    }

    static extrapolatePhrases() {
        const groups = [];
        const intentGroups =
            new Map();
        const phrases = [];
        const seen = new Set();

        for (
            const element of
            SpeechMenu.#availableCandidates()
        ) {
            const pattern =
                element.getAttribute(
                    "speech-pattern"
                );

            if (!pattern) continue;

            const extrapolated =
                SpeechMenu
                    .#expandRegexSource(
                        pattern
                    );

            if (!extrapolated.length) {
                continue;
            }

            const menu =
                element.closest(
                    "speech-menu"
                );

            const intent =
                element
                    .getAttribute(
                        "data-speech-intent"
                    )
                    ?.trim() ||
                undefined;

            const optionsPhrase =
                element
                    .getAttribute(
                        "data-speech-options-phrase"
                    )
                    ?.trim() ||
                undefined;

            const descriptor = {
                element,
                elements: [element],
                intent,
                menu: menu || undefined,
                modal:
                    SpeechMenu
                        .#effectiveModal(
                            element
                        ),
                pattern,
                optionsGroup:
                    element
                        .getAttribute(
                            "data-speech-options-group"
                        )
                        ?.trim() ||
                    undefined,
                optionsCategory:
                    element
                        .getAttribute(
                            "data-speech-options-category"
                        )
                        ?.trim() ||
                    undefined,
                optionPhrases:
                    optionsPhrase
                        ? [optionsPhrase]
                        : undefined,
                phrases:
                    extrapolated.slice()
            };

            if (intent) {
                const existing =
                    intentGroups.get(
                        intent
                    );

                if (existing) {
                    existing.elements.push(
                        element
                    );

                    for (
                        const phrase of
                        extrapolated
                    ) {
                        if (
                            !existing.phrases
                                .includes(
                                    phrase
                                )
                        ) {
                            existing.phrases.push(
                                phrase
                            );
                        }
                    }

                    if (optionsPhrase) {
                        existing.optionPhrases ??=
                            [];

                        if (
                            !existing
                                .optionPhrases
                                .includes(
                                    optionsPhrase
                                )
                        ) {
                            existing
                                .optionPhrases
                                .push(
                                    optionsPhrase
                                );
                        }
                    }
                }
                else {
                    intentGroups.set(
                        intent,
                        descriptor
                    );
                    groups.push(
                        descriptor
                    );
                }
            }
            else {
                groups.push(
                    descriptor
                );
            }

            for (const phrase of extrapolated) {
                if (seen.has(phrase)) continue;
                seen.add(phrase);
                phrases.push(phrase);
            }
        }

        const previousPhrases =
            SpeechMenu.#phrases;
        const previousGroups =
            SpeechMenu.#phraseGroups;

        SpeechMenu.#phraseGroups =
            Object.freeze(
                groups.map(
                    group =>
                        Object.freeze({
                            ...group,
                            elements:
                                Object.freeze(
                                    group.elements.slice()
                                ),
                            optionPhrases:
                                group.optionPhrases
                                    ? Object.freeze(
                                        group
                                            .optionPhrases
                                            .slice()
                                    )
                                    : undefined,
                            phrases:
                                Object.freeze(
                                    group.phrases.slice()
                                )
                        })
                )
            );

        SpeechMenu.#phrases =
            Object.freeze(phrases);

        const phrasesChanged =
            previousPhrases.length !==
                phrases.length ||
            previousPhrases.some(
                (phrase, index) =>
                    phrase !==
                    phrases[index]
            );

        const groupsChanged =
            previousGroups.length !==
                groups.length ||
            previousGroups.some(
                (group, index) => {
                    const next =
                        groups[index];

                    return (
                        !next ||
                        group.element !==
                            next.element ||
                        group.intent !==
                            next.intent ||
                        group.pattern !==
                            next.pattern ||
                        group.optionsGroup !==
                            next.optionsGroup ||
                        group.optionsCategory !==
                            next.optionsCategory ||
                        (
                            group.optionPhrases
                                ?.length ||
                            0
                        ) !==
                            (
                                next.optionPhrases
                                    ?.length ||
                                0
                            ) ||
                        group.optionPhrases
                            ?.some(
                                (
                                    phrase,
                                    phraseIndex
                                ) =>
                                    phrase !==
                                    next
                                        .optionPhrases?.[
                                            phraseIndex
                                        ]
                            ) ||
                        group.phrases.length !==
                            next.phrases.length ||
                        group.phrases.some(
                            (
                                phrase,
                                phraseIndex
                            ) =>
                                phrase !==
                                next.phrases[
                                    phraseIndex
                                ]
                        )
                    );
                }
            );

        const speechContextChanged =
            phrasesChanged ||
            groupsChanged;

        if (
            SpeechMenu
                .#surfaceContextRefreshPending
        ) {
            SpeechMenu
                .#surfaceContextRefreshPending =
                false;

            if (speechContextChanged) {
                SpeechMenu
                    .#invalidateRecognitionContext(
                        "surface-context-change"
                    );
            }
        }

        if (
            speechContextChanged
        ) {
            SpeechMenu.#emit(
                "phrasesChanged",
                {
                    phrases:
                        SpeechMenu.#phrases,
                    phraseGroups:
                        SpeechMenu.#phraseGroups
                }
            );

        }

        /*
         * Command scope and recognizer vocabulary are separate concerns.
         * Sleep/wake, dialogs, popovers, availability, etc. can change
         * the executable phrase set without changing the vocabulary the
         * recognizer should know. Keep a stable superset of all defined
         * speech phrases so transient scope changes do not force Sherpa
         * to destroy/rebuild its recognizer between utterances.
         */
        SpeechMenu
            .#refreshRecognizerHotwords();

        return SpeechMenu.#phrases;
    }

    static #hotwords() {
        const values = [];
        const seen =
            new Set();
        const append =
            raw => {
                const value =
                    String(
                        raw ||
                        ""
                    ).trim();

                if (
                    !value ||
                    seen.has(
                        value
                    )
                ) {
                    return;
                }

                seen.add(
                    value
                );
                values.push(
                    value
                );
            };

        for (
            const value of
                globalThis
                    .WMOFLanguages?.[
                        SpeechMenu
                            .#language
                    ]
                    ?.speech
                    ?.recognitionHotwords ||
                []
        ) {
            append(
                value
            );
        }

        for (
            const element of
            document.querySelectorAll(
                "[speech-pattern]"
            )
        ) {
            const pattern =
                element.getAttribute(
                    "speech-pattern"
                );

            if (!pattern) {
                continue;
            }

            for (
                const phrase of
                SpeechMenu
                    .#expandRegexSource(
                        pattern
                    )
            ) {
                const value =
                    String(
                        phrase ||
                        ""
                    ).trim();

                append(
                    value
                );
            }
        }

        return values;
    }

    static #refreshRecognizerHotwords() {
        const values =
            SpeechMenu
                .#hotwords();

        const key =
            JSON.stringify(
                values
            );

        if (
            key ===
                SpeechMenu
                    .#recognizerHotwordKey
        ) {
            return false;
        }

        SpeechMenu.#recognizerHotwordKey =
            key;

        SpeechMenu.#recognizer
            ?.setHotwords(
                values
            );

        return true;
    }

    static #invalidateRecognitionContext(
        reason = "speech-context-change"
    ) {
        SpeechMenu.#contextGeneration++;
        for (const buffered of SpeechMenu.#finishedUtterances.values()) {
            if (buffered.bargeInPending) buffered.contextGeneration = SpeechMenu.#contextGeneration;
        }
        if (SpeechMenu.#utterance?.bargeInPending && !SpeechMenu.#stopped) {
            // The buffered stream will be interpreted against the state left by the old queue.
            SpeechMenu.#utterance.contextGeneration = SpeechMenu.#contextGeneration;
            return true;
        }
        const chains = [SpeechMenu.#utterance, ...SpeechMenu.#finishedUtterances.values()]
            .filter(utterance => utterance?.chainActive && !utterance.chainCanceled && !utterance.digestFailed);
        if (chains.length && !SpeechMenu.#stopped) {
            const activeSurface = (SpeechMenu.activeSurface !== document.body ? SpeechMenu.activeSurface : undefined) || [...document.querySelectorAll('dialog[open]')].at(-1);
            for (const chain of chains) {
                if (activeSurface && !chain.expectedSurfaces?.has(activeSurface)) {
                    // A single surface-opening action may introduce its own
                    // dialog. A pending chain must name its projected surface.
                    if (chain.commandChainExecuting && !chain.digestContext &&
                        chain.digestSteps.length === 1 && !chain.digestPending) {
                        chain.expectedSurfaces ??= new Set();
                        chain.expectedSurfaces.add(activeSurface);
                    } else {
                        chain.chainCanceled = true;
                        void globalThis.WMOFStateTransactions?.rollback(`speech:${chain.id}`, new Error("Recognition context changed."));
                        SpeechMenu.#rejectDigest(chain, 'unexpected-modal', chain.digestPending || '');
                        continue;
                    }
                }
                chain.contextGeneration = SpeechMenu.#contextGeneration;
            }
            return true;
        }

        SpeechMenu.#preRollFrames =
            [];
        SpeechMenu.#preRollSamples =
            0;

        SpeechMenu
            .#cancelPendingRecognitionForBargeIn();

        if (
            SpeechMenu.#pipeline ===
                "silero"
        ) {
            SpeechMenu.#vad
                ?.reset?.();
        }

        const utterance =
            SpeechMenu.#utterance;

        if (!utterance) {
            return false;
        }

        SpeechMenu
            .#cancelCandidateWork(
                utterance
            );
        SpeechMenu
            .#cancelContinuationPause(
                utterance
            );

        /*
         * A command may change the active surface while its action is still
         * completing. Non-repeatable commands already stop recognition before
         * running the action; repeatable commands do not. Mark either case as
         * stopped so the next voiced frame must begin under the new context.
         */
        if (utterance.committing) {
            utterance.contextInvalidated =
                true;

            SpeechMenu
                .#stopLiveRecognition(
                    utterance,
                    false
                );

            return true;
        }

        SpeechMenu.#finishUtterance(
            reason,
            false
        );

        return true;
    }

    static #schedulePhraseRefresh() {
        if (SpeechMenu.#phraseRefreshQueued) {
            return;
        }

        SpeechMenu.#phraseRefreshQueued =
            true;

        queueMicrotask(
            () => {
                SpeechMenu.#phraseRefreshQueued =
                    false;
                SpeechMenu.extrapolatePhrases();
            }
        );
    }

    static #emit(type, detail) {
        SpeechMenu.#events.dispatchEvent(
            new CustomEvent(
                type,
                detail === undefined
                    ? undefined
                    : {detail}
            )
        );
    }

    static #onTrackEnded = () => {
        if (SpeechMenu.#stopped) return;

        SpeechMenu.#stopped =
            true;

        SpeechMenu.#emit(
            "speechCaptureEnded",
            {
                deliberate: false
            }
        );

        void SpeechMenu.#releaseCapture();
    };

    static #onAudioWorkletMessage = event => {
        if (
            SpeechMenu.#stopped ||
            SpeechMenu.listeningSuspended ||
            !SpeechMenu.#audioContext
        ) {
            return;
        }

        const data =
            event.data;

        if (
            data?.type !== "audio" ||
            !(data.samples instanceof Float32Array) ||
            data.samples.length === 0
        ) {
            return;
        }

        const samples =
            data.samples;

        const level =
            Number.isFinite(
                Number(data.level)
            )
                ? Number(data.level)
                : 0;

        const sampleRate =
            Number(data.sampleRate) ||
            globalThis.SherpaRecognizer
                ?.sampleRate ||
            16000;

        const frame = {
            samples,
            length:
                samples.length
        };

        const frameMilliseconds =
            frame.length /
            sampleRate *
            1000;

        const now =
            performance.now();

        if (
            now -
                SpeechMenu.#lastLevelEventAt >=
                    45
        ) {
            SpeechMenu.#lastLevelEventAt =
                now;

            SpeechMenu.#emit(
                "audioLevelChanged",
                {level}
            );
        }

        if (
            SpeechMenu.#utterance &&
            SpeechMenu.#utterance
                .candidateHardCommitAt !==
                undefined &&
            now >=
                SpeechMenu.#utterance
                    .candidateHardCommitAt &&
            !SpeechMenu.#utterance
                .committed &&
            !SpeechMenu.#utterance
                .committing
        ) {
            const currentExact =
                SpeechMenu
                    .#exactCandidate(
                        SpeechMenu.#utterance
                    );

            if (currentExact) {
                void SpeechMenu
                    .#commitUtterance(
                        SpeechMenu.#utterance
                    );
            }
        }

        if (
            SpeechMenu.#pipeline ===
                "silero"
        ) {
            SpeechMenu.#vad
                ?.accept(
                    samples
                );

            if (!SpeechMenu.#utterance) {
                SpeechMenu.#appendPreRollFrame(
                    frame,
                    sampleRate
                );
            }
            else {
                SpeechMenu.#appendUtteranceFrame(
                    frame
                );
            }

            return;
        }

        if (!SpeechMenu.#utterance) {
            if (
                level >=
                SpeechMenu.#speechThreshold
            ) {
                SpeechMenu.#beginUtterance(
                    now
                );

                SpeechMenu.#appendUtteranceFrame(
                    frame
                );
            }
            else {
                SpeechMenu.#appendPreRollFrame(
                    frame,
                    sampleRate
                );
            }

            return;
        }

        if (
            (
                SpeechMenu.#utterance.committed ||
                SpeechMenu.#utterance
                    .recognitionStopped
            ) &&
            level >= SpeechMenu.#speechThreshold
        ) {
            SpeechMenu
                .#clearCandidatePool(
                    SpeechMenu.#utterance
                );

            SpeechMenu.#finishUtterance(
                "committed",
                false
            );
            SpeechMenu.#beginUtterance(now);
            SpeechMenu.#appendUtteranceFrame(frame);
            return;
        }

        SpeechMenu.#appendUtteranceFrame(
            frame
        );

        if (
            level >=
            SpeechMenu.#speechThreshold
        ) {
            const utterance =
                SpeechMenu.#utterance;
            const resumedPause =
                Number(
                    utterance
                        .silenceMilliseconds
                ) ||
                0;
            const hadOpenContinuation =
                SpeechMenu
                    .#hasOpenContinuation(
                        utterance
                    );

            if (
                resumedPause >= 70 &&
                hadOpenContinuation
            ) {
                SpeechMenu
                    .#pushRecognitionStream(
                        utterance,
                        resumedPause,
                        "raw",
                        now
                    );
            }

            if (
                utterance
                    .continuationPauseTimer !==
                        undefined ||
                utterance
                    .continuationPauseStartedAt !==
                        undefined
            ) {
                SpeechMenu
                    .#cancelContinuationPause(
                        utterance
                    );
            }

            utterance.silenceMilliseconds =
                0;
        }
        else {
            const utterance =
                SpeechMenu.#utterance;

            utterance.silenceMilliseconds +=
                frameMilliseconds;

            if (
                !utterance.committed &&
                !utterance.committing
            ) {
                const repeatable =
                    SpeechMenu
                        .#repeatableStreamHead(
                            utterance
                        );
                const openContinuation =
                    SpeechMenu
                        .#hasOpenContinuation(
                            utterance
                        );

                if (
                    repeatable &&
                    utterance
                        .silenceMilliseconds >=
                        SpeechMenu
                            .#streamSeparationMilliseconds()
                ) {
                    SpeechMenu
                        .#finishUtterance(
                            "repeatable-silence",
                            false
                        );

                    return;
                }

                if (openContinuation) {
                    if (
                        utterance
                            .continuationPauseTimer ===
                                undefined &&
                        utterance
                            .silenceMilliseconds >=
                            SpeechMenu
                                .#continuationPauseBoundaryMilliseconds()
                    ) {
                        /*
                         * The pause boundary is intentionally fast and
                         * independent of speech rate. Crossing it starts
                         * the continuation dispatch hold; it does not
                         * end recognition. If speech resumes during the
                         * hold, the timer is cancelled above and the
                         * phrase keeps growing.
                         */
                        utterance
                            .continuationPauseStartedAt =
                            now -
                            utterance
                                .silenceMilliseconds;

                        SpeechMenu
                            .#armContinuationPauseDeadline(
                                utterance
                            );
                    }
                }
                else if (
                    utterance
                        .silenceMilliseconds >=
                        SpeechMenu
                            .#commitSilenceTimeout
                ) {
                    const exactCandidate =
                        SpeechMenu
                            .#exactCandidate(
                                utterance
                            );

                    if (exactCandidate) {
                        void SpeechMenu
                            .#commitUtterance(
                                utterance
                            );
                    }
                }
            }

            if (
                SpeechMenu.#utterance &&
                SpeechMenu.#utterance
                    .silenceMilliseconds >=
                    SpeechMenu.#silenceTimeout
            ) {
                SpeechMenu.#finishUtterance(
                    "silence",
                    true
                );
            }
        }
    };

    static #onVadSpeechStart = event => {
        if (
            SpeechMenu.#stopped ||
            SpeechMenu.#pipeline !==
                "silero"
        ) {
            return;
        }

        if (
            SpeechMenu.#utterance
                ?.recognitionStopped
        ) {
            SpeechMenu.#finishUtterance(
                "recognition-committed",
                false
            );
        }

        if (SpeechMenu.#utterance) {
            if (
                SpeechMenu
                    .#hasOpenContinuation(
                        SpeechMenu.#utterance
                    )
            ) {
                const utterance =
                    SpeechMenu
                        .#utterance;
                const pauseStartedAt =
                    utterance
                        .continuationPauseStartedAt;
                const now =
                    performance.now();

                if (
                    Number.isFinite(
                        pauseStartedAt
                    )
                ) {
                    SpeechMenu
                        .#pushRecognitionStream(
                            utterance,
                            now -
                                pauseStartedAt,
                            "silero",
                            now
                        );
                }

                SpeechMenu
                    .#cancelContinuationPause(
                        utterance
                    );

                SpeechMenu.#emit(
                    "speechVadChanged",
                    {
                        pipeline: "silero",
                        detected: true,
                        resumed: true,
                        processMilliseconds:
                            Number(
                                event.detail
                                    ?.processMilliseconds
                            ) || 0,
                        maxProcessMilliseconds:
                            Number(
                                event.detail
                                    ?.maxProcessingMilliseconds
                            ) || 0
                    }
                );
            }

            return;
        }

        const now =
            performance.now();

        SpeechMenu.#emit(
            "speechVadChanged",
            {
                pipeline: "silero",
                detected: true,
                processMilliseconds:
                    Number(
                        event.detail
                            ?.processMilliseconds
                    ) || 0,
                maxProcessMilliseconds:
                    Number(
                        event.detail
                            ?.maxProcessingMilliseconds
                    ) || 0
            }
        );

        SpeechMenu.#beginUtterance(
            now
        );
    };

    static #onVadSpeechEnd = event => {
        if (
            SpeechMenu.#pipeline !==
                "silero"
        ) {
            return;
        }

        SpeechMenu.#emit(
            "speechVadChanged",
            {
                pipeline: "silero",
                detected: false,
                processMilliseconds:
                    Number(
                        event.detail
                            ?.processMilliseconds
                    ) || 0,
                maxProcessMilliseconds:
                    Number(
                        event.detail
                            ?.maxProcessingMilliseconds
                    ) || 0
            }
        );

        if (
            SpeechMenu.#utterance
        ) {
            const utterance =
                SpeechMenu.#utterance;
            if (
                !utterance.committed &&
                !utterance.committing &&
                SpeechMenu
                    .#hasOpenContinuation(
                        utterance
                    )
            ) {
                /*
                 * Silero has already detected the pause quickly. Keep
                 * recognition alive and let only the continuation
                 * dispatch timer vary with speech rate. If speech resumes
                 * first, #onVadSpeechStart cancels this pending dispatch.
                 */
                utterance
                    .continuationPauseStartedAt =
                    performance.now() -
                    SpeechMenu
                        .#vadMinimumSilenceMilliseconds;

                SpeechMenu
                    .#armContinuationPauseDeadline(
                        utterance
                    );

                return;
            }

            if (
                !utterance.committed &&
                !utterance.committing &&
                SpeechMenu
                    .#exactCandidate(
                        utterance
                    )
            ) {
                void SpeechMenu
                    .#commitUtterance(
                        utterance
                    );
            }
            else {
                SpeechMenu.#finishUtterance(
                    "vad-silence",
                    true
                );
            }
        }
    };

    static #onVadError = event => {
        const detail =
            event.detail || {};

        SpeechMenu.#emit(
            "speechRecognitionFailed",
            {
                error:
                    detail.error ||
                    "SileroVadError",
                message:
                    detail.message ||
                    "Silero VAD failed."
            }
        );
    };

    static #onVadStatus = event => {
        const status =
            event.detail?.status ||
            "";

        if (!status) {
            return;
        }

        SpeechMenu.#emit(
            "speechRecognitionStatusChanged",
            {
                status:
                    `VAD: ${status}`
            }
        );
    };

    static #appendPreRollFrame(
        frame,
        sampleRate
    ) {
        SpeechMenu.#preRollFrames.push(
            frame
        );

        SpeechMenu.#preRollSamples +=
            frame.length;

        const maximumSamples =
            sampleRate *
            (
                SpeechMenu.#preRollMilliseconds /
                1000
            );

        while (
            SpeechMenu.#preRollSamples >
                maximumSamples &&
            SpeechMenu.#preRollFrames
                .length > 0
        ) {
            const removed =
                SpeechMenu.#preRollFrames.shift();

            SpeechMenu.#preRollSamples -=
                removed.length;
        }
    }

    static #beginUtterance(now) {
        SpeechMenu
            .#cancelPendingRecognitionForBargeIn();

        const id =
            ++SpeechMenu.#utteranceSequence;

        const preRollFrames =
            SpeechMenu.#preRollFrames
                .splice(0);

        const sampleCount =
            SpeechMenu.#preRollSamples;

        SpeechMenu.#preRollSamples =
            0;

        const wallStartedAt =
            new Date(
                performance.timeOrigin +
                now
            );

        SpeechMenu.#utterance = {
            id,
            sessionGeneration:
                SpeechMenu.#sessionGeneration,
            contextGeneration:
                SpeechMenu.#contextGeneration,
            startedAt: now,
            wallStartedAt:
                wallStartedAt.toISOString(),
            silenceMilliseconds: 0,
            sampleCount,
            transcript: "",
            transcriptRevision: 0,
            discardedTranscriptPrefixWords: 0,
            expectedSurfaces: new Set([...document.querySelectorAll('dialog[open]')].slice(-1)),
            valueCollectors: new Map(),
            digestTranscript: "",
            digestContext: undefined,
            digestQueue: Promise.resolve(),
            digestSteps: [],
            chainActive: false,
            chainCanceled: false,
            digestFailed: false,
            firstTranscriptAt:
                undefined,
            candidatePool: [],
            candidatePoolController:
                undefined,
            candidateCommitTimer:
                undefined,
            candidateHardCommitTimer:
                undefined,
            candidateHardCommitAt:
                undefined,
            continuationPauseStartedAt:
                undefined,
            continuationPauseTimer:
                undefined,
            streamSequence: 1,
            streamStack: [
                {
                    id: 1,
                    baseTranscript: "",
                    transcript: "",
                    pauseMilliseconds: 0,
                    source: "initial",
                    startedAt: now,
                    wallStartedAt:
                        wallStartedAt
                            .toISOString(),
                    status: "active",
                    exact: false,
                    canContinue: false,
                    repeatable: false,
                    committedTranscript: "",
                    candidateCount: 0
                }
            ],
            lastExactCandidate:
                undefined,
            committed: false,
            committing: false,
            recognitionStopped: false
        };

        SpeechMenu.#emit(
            "utteranceStarted",
            {
                id,
                startedAt: now,
                wallStartedAt:
                    wallStartedAt.toISOString()
            }
        );

        SpeechMenu.#recognizer
            ?.beginUtterance(id);

        for (
            const frame of
            preRollFrames
        ) {
            SpeechMenu.#recognizer
                ?.accept(
                    id,
                    frame.samples
                );
        }
    }

    static #cancelPendingRecognitionForBargeIn() {
        for (
            const [
                id,
                utterance
            ] of SpeechMenu
                .#finishedUtterances
        ) {
            // Capture has ended, but its requested final decode still owns the
            // accepted command transaction. A new utterance must not discard
            // that result and leave later state changes waiting forever.
            if (utterance.bargeInPending) continue;
            if (utterance.chainActive && !utterance.chainCanceled &&
                !utterance.digestFailed && !utterance.digestCommitted) continue;
            SpeechMenu
                .#clearCandidatePool(
                    utterance
                );

            SpeechMenu
                .#stopLiveRecognition(
                    utterance,
                    false
                );

            SpeechMenu
                .#finishedUtterances
                .delete(id);
        }
    }

    static #appendUtteranceFrame(
        frame
    ) {
        const utterance =
            SpeechMenu.#utterance;

        if (!utterance) {
            return;
        }

        utterance.sampleCount +=
            frame.length;

        SpeechMenu.#recognizer
            ?.accept(
                utterance.id,
                frame.samples
            );
    }

    static #finishUtterance(
        reason,
        recognize
    ) {
        const utterance =
            SpeechMenu.#utterance;

        if (!utterance) return;
        utterance.digestClosed = true;
        if (recognize && utterance.chainActive && !utterance.digestCommitted && !utterance.chainCanceled) {
            utterance.releaseFinalResult ??= utterance.operation?.expect("recognition-final");
        }
        utterance.valueCollectors?.clear();
        SpeechMenu.#clearPrimed(utterance);
        if (["stopped", "muted", "speech-context-change", "surface-context-change"].includes(reason)) {
            utterance.chainCanceled = true;
            void (utterance.operation ? utterance.operation.cancel(new Error(reason)) :
                globalThis.WMOFStateTransactions?.rollback(`speech:${utterance.id}`, new Error(reason)));
        }

        SpeechMenu
            .#cancelContinuationPause(
                utterance
            );

        if (
            recognize &&
            !utterance.committed
        ) {
            SpeechMenu.#finishedUtterances
                .set(
                    utterance.id,
                    utterance
                );
        }

        SpeechMenu.#stopLiveRecognition(
            utterance,
            recognize
        );

        SpeechMenu.#utterance =
            undefined;

        const sampleRate =
            globalThis.SherpaRecognizer
                ?.sampleRate ||
            16000;

        const durationMilliseconds =
            utterance.sampleCount /
            sampleRate *
            1000;

        SpeechMenu.#emit(
            "utteranceFinished",
            {
                id: utterance.id,
                reason,
                startedAt:
                    utterance.startedAt,
                finishedAt:
                    performance.now(),
                durationMilliseconds,
                committed:
                    Boolean(
                        utterance.committed ||
                        utterance
                            .hadCommittedCommand
                    ),
                transcript:
                    utterance.transcript || ""
            }
        );

        const exactCandidate =
            SpeechMenu
                .#exactCandidate(
                    utterance
                );

        if (
            recognize &&
            exactCandidate &&
            !utterance.committed &&
            !utterance.committing &&
            !(
                (
                    SpeechMenu.#pipeline ===
                        "silero" &&
                    reason ===
                        "vad-silence"
                ) ||
                reason ===
                    "candidate-silence"
            )
        ) {
            void SpeechMenu.#commitUtterance(
                utterance
            );
        }
        else {
            SpeechMenu
                .#clearCandidatePool(
                    utterance
                );
        }
    }

    static #onSherpaTranscript = event => {
        const detail =
            event.detail || {};
        const id =
            detail.utteranceId;
        const active =
            SpeechMenu.#utterance;
        const utterance =
            active?.id === id
                ? active
                : SpeechMenu
                    .#finishedUtterances
                    .get(id);

        if (!utterance) {
            return;
        }

        const transcript = SpeechMenu.#stripSynthesizedSpeech(
            SpeechMenu.#normalizeTranscript(
                [utterance.bargeInSeed, detail.transcript].filter(Boolean).join(" ")
            )
        );

        if (!transcript) {
            return;
        }

        const receivedAt =
            performance.now();
        const isFirstTranscript =
            utterance.firstTranscriptAt ===
                undefined;

        if (isFirstTranscript) {
            utterance.firstTranscriptAt =
                receivedAt;
        }

        SpeechMenu.#emit(
            "speechRecognitionTiming",
            {
                backend:
                    "sherpa",
                utteranceId:
                    id,
                isFinal:
                    Boolean(
                        detail.isFinal
                    ),
                isFirstTranscript,
                firstTranscriptMilliseconds:
                    utterance.firstTranscriptAt -
                    utterance.startedAt,
                transcriptMilliseconds:
                    receivedAt -
                    utterance.startedAt,
                decodeMilliseconds:
                    Number(
                        detail.decodeMilliseconds
                    ) || 0
            }
        );

        if (
            active === utterance
        ) {
            void SpeechMenu
                .#handleLiveTranscript(
                    utterance,
                    transcript,
                    Boolean(
                        detail.isFinal
                    )
                );
            return;
        }

        if (!detail.isFinal) {
            return;
        }

        SpeechMenu.#finishedUtterances
            .delete(id);

        void SpeechMenu
            .#handleCompletedTranscript(
                utterance,
                transcript
            );
    };

    static #flushNamedStream(utterance, barge, isFinal) {
        utterance.bargeInFlushing = true;
        SpeechMenu.#clearCandidatePool(utterance);
        // Capture restarts immediately; command completion remains on its existing queue.
        const previousBarrier = utterance.bargeInBarrier;
        SpeechMenu.#finishUtterance("named-barge-in", false);
        SpeechMenu.#finishedUtterances.delete(utterance.id);
        SpeechMenu.#preRollFrames.length = 0;
        SpeechMenu.#preRollSamples = 0;
        SpeechMenu.#beginUtterance(performance.now());
        const next = SpeechMenu.#utterance;
        next.bargeInSeed = barge.after;
        next.bargeInPending = true;
        next.bargeInBarrier = (async () => {
            await previousBarrier;
            await utterance.digestQueue;
            const remainder = SpeechMenu.#digestRemainder(utterance, barge.before);
            if (!utterance.digestFailed && !utterance.digestCommitted && remainder) {
                // Retain only validated command segments. Unmatched tail never rejects prior work.
                utterance.digestIsFinal = true;
                let candidate;
                let validPrefix = remainder;
                // Greedy value parsers may include trailing noise. Search longest valid prefix.
                let attempts = 0;
                while (validPrefix) {
                    if (++attempts % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
                    const pool = await SpeechMenu.#refreshCandidatePool(utterance, validPrefix);
                    candidate = pool[0];
                    if (candidate?.chain?.length || candidate?.exact) break;
                    validPrefix = validPrefix.split(" ").slice(0, -1).join(" ");
                }
                if (candidate?.kind === "chain" && candidate.chain?.length) {
                    const valid = candidate.chain.map(step => step.segmentTranscript).join(" ");
                    SpeechMenu.#digestCandidate(utterance, {...candidate,invalid:false,remainder:""}, valid, true);
                } else if (candidate?.exact && !utterance.chainActive) {
                    await SpeechMenu.#processElement(candidate.commandElement, validPrefix, utterance.id,
                        candidate.speechMenuElement, SpeechMenu.#shouldExecuteElement(candidate.commandElement));
                }
            }
            utterance.digestCommitted = true;
            if (utterance.chainActive) await SpeechMenu.#completeDigest(utterance);
            else await utterance.digestQueue;
            if (next.sessionGeneration === SpeechMenu.#sessionGeneration) {
                next.contextGeneration = SpeechMenu.#contextGeneration;
                next.expectedSurfaces = new Set([...document.querySelectorAll('dialog[open]')].slice(-1));
            }
        })().catch(error => {SpeechMenu.#emit("speechMenuCommandError", {utteranceId:utterance.id,error});})
            .finally(() => {next.bargeInPending = false;});
        globalThis.WMOFAudio?.stopAll?.();
        SpeechMenu.#emit("speechBargeIn", {utteranceId:utterance.id,nextUtteranceId:next.id,name:barge.name,
            preservedTranscript:utterance.digestTranscript, discardedTranscript:barge.before, transcript:barge.after});
        if (barge.after) SpeechMenu.#onSherpaTranscript({detail:{utteranceId:next.id, transcript:"", isFinal}});
    }

    static #onSherpaError = event => {
        const detail =
            event.detail || {};
        const affected = [SpeechMenu.#utterance, ...SpeechMenu.#finishedUtterances.values()]
            .filter(utterance => utterance && (detail.fatal || utterance.id === detail.utteranceId));
        for (const utterance of affected) {
            if (utterance.operation && !utterance.operation.settled) {
                void utterance.operation.cancel(new Error(detail.message || "Speech recognition failed."));
            }
        }

        SpeechMenu.#emit(
            detail.fatal
                ? "speechRecognitionFailed"
                : "speechRecognitionStreamingFailed",
            {
                utteranceId:
                    detail.utteranceId,
                error:
                    detail.error ||
                    "SherpaError",
                message:
                    detail.message ||
                    "Sherpa recognition failed."
            }
        );
    };

    static #onSherpaStatus = event => {
        SpeechMenu.#emit(
            "speechRecognitionStatusChanged",
            {
                status:
                    event.detail?.status ||
                    ""
            }
        );
    };

    static #onSherpaUtteranceEnded = event => {
        const id =
            event.detail?.utteranceId;

        if (
            SpeechMenu.#utterance?.id === id
        ) {
            return;
        }

        const utterance =
            SpeechMenu.#finishedUtterances
                .get(id);

        if (!utterance) {
            return;
        }

        SpeechMenu.#finishedUtterances
            .delete(id);
        if (utterance.operation && !utterance.operation.settled && !utterance.digestCommitted) {
            const transcript = SpeechMenu.#stripSynthesizedSpeech(SpeechMenu.#normalizeTranscript(event.detail?.transcript || ""));
            if (transcript) void SpeechMenu.#handleCompletedTranscript(utterance, transcript);
            else void utterance.operation.cancel(new Error("Recognition ended without a final result."));
            return;
        }

        if (
            !utterance.transcript &&
            !String(
                event.detail?.transcript ||
                ""
            ).trim()
        ) {
            SpeechMenu.#emit(
                "utteranceUnrecognized",
                {
                    id
                }
            );
        }
    };

    static #stopLiveRecognition(
        utterance,
        finalize = true
    ) {
        if (
            !utterance ||
            utterance.recognitionStopped
        ) {
            return;
        }

        utterance.recognitionStopped =
            true;

        if (finalize) {
            SpeechMenu.#recognizer
                ?.finishUtterance(
                    utterance.id
                );
        }
        else {
            SpeechMenu.#recognizer
                ?.abortUtterance(
                    utterance.id
                );
        }
    }

    static #recoverOpenContinuationTranscript(
        utterance,
        transcript
    ) {
        const incoming =
            SpeechMenu
                .#normalizeTranscript(
                    transcript
                );
        const stream =
            SpeechMenu
                .#recognitionStreamHead(
                    utterance
                );
        const base =
            SpeechMenu
                .#normalizeTranscript(
                    stream
                        ?.baseTranscript
                );

        if (
            !incoming ||
            !base ||
            !stream ||
            stream.source ===
                "initial" ||
            !SpeechMenu
                .#hasOpenContinuation(
                    utterance
                ) ||
            SpeechMenu
                .#streamRemainder(
                    base,
                    incoming
                ) !==
                undefined
        ) {
            return incoming;
        }

        const baseFirst =
            base.split(/\s+/)[0] ||
            "";
        const incomingFirst =
            incoming.split(/\s+/)[0] ||
            "";
        const looksLikeRevision =
            baseFirst ===
                incomingFirst ||
            baseFirst.startsWith(
                incomingFirst
            ) ||
            incomingFirst.startsWith(
                baseFirst
            );

        if (looksLikeRevision) {
            return incoming;
        }

        const recovered =
            (
                base +
                " " +
                incoming
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        SpeechMenu.#emit(
            "speechContinuationRecovered",
            {
                utteranceId:
                    utterance.id,
                streamId:
                    stream.id,
                baseTranscript:
                    base,
                observedTranscript:
                    incoming,
                recoveredTranscript:
                    recovered
            }
        );

        return recovered;
    }

    static async #handleLiveTranscript(
        utterance,
        transcript,
        isFinal
    ) {
        if (utterance?.bargeInBarrier) await utterance.bargeInBarrier;
        if (
            !utterance ||
            utterance.committed ||
            utterance.committing ||
            SpeechMenu.#stopped ||
            SpeechMenu.#utterance !==
                utterance ||
            utterance.sessionGeneration !==
                SpeechMenu.#sessionGeneration ||
            utterance.contextGeneration !==
                SpeechMenu.#contextGeneration
        ) {
            return;
        }

        transcript =
            SpeechMenu
                .#recoverOpenContinuationTranscript(
                    utterance,
                    transcript
                );

        if (
            transcript ===
            utterance.transcript &&
            !isFinal
        ) {
            return;
        }

        utterance.transcript =
            transcript;

        const revision =
            ++utterance.transcriptRevision;

        SpeechMenu.#emit(
            "utteranceTranscriptChanged",
            {
                id: utterance.id,
                transcript,
                isFinal:
                    Boolean(isFinal)
            }
        );

        if (isFinal) {
            SpeechMenu.#emit(
                "utteranceTranscribed",
                {
                    id: utterance.id,
                    transcript,
                    live: true
                }
            );
        }

        SpeechMenu
            .#cancelCandidateWork(
                utterance
            );

        const controller =
            new AbortController();

        utterance.candidatePoolController =
            controller;

        /*
         * Once a command has consumed words, remove the previously identified
         * noise prefix from each cumulative recognition result before checking
         * the consumed command prefix. Before that point, let the normal
         * candidate refresh identify and prune the prefix so collector state is
         * not reset by a second planning pass.
         */
        const normalizedTranscript =
            SpeechMenu.#normalizeTranscript(transcript);
        if (utterance.digestTranscript) {
            const words = normalizedTranscript.split(" ").filter(Boolean);
            transcript = words.slice(
                utterance.discardedTranscriptPrefixWords || 0
            ).join(" ");
            if (transcript !== normalizedTranscript) {
                utterance.transcript = transcript;
                SpeechMenu.#emit("utteranceTranscriptChanged", {
                    id: utterance.id, transcript, isFinal: Boolean(isFinal)
                });
            }
        }
        else {
            utterance.discardedTranscriptPrefixWords = 0;
            transcript = normalizedTranscript;
        }

        utterance.digestIsFinal = Boolean(isFinal);
        let remainingTranscript = SpeechMenu.#digestRemainder(utterance, transcript);
        if (remainingTranscript === undefined) {
            SpeechMenu.#rejectDigest(utterance, "consumed-prefix-revised", transcript);
            return;
        }
        const pool =
            await SpeechMenu
                .#refreshCandidatePool(
                    utterance,
                    remainingTranscript,
                    controller.signal
                );

        if (
            controller.signal.aborted ||
            SpeechMenu.#utterance !==
                utterance ||
            utterance.committed ||
            revision !==
                utterance.transcriptRevision ||
            utterance.candidatePoolController !==
                controller
        ) {
            return;
        }

        /*
         * The chain planner already matched from the first viable word and
         * records everything before it as ignoredPrefix. Commit that boundary
         * to the live transcript now, before digesting, and reuse the planned
         * chain rather than planning again (which would clear collector state).
         */
        const plannedPrefix = pool[0]?.kind === "chain"
            ? pool[0].ignoredPrefix
            : "";
        if (plannedPrefix && !pool[0]?.headViable && !utterance.digestTranscript) {
            const ignoredWords = plannedPrefix.split(" ").filter(Boolean).length;
            utterance.discardedTranscriptPrefixWords = ignoredWords;
            transcript = SpeechMenu.#normalizeTranscript(transcript)
                .split(" ").filter(Boolean).slice(ignoredWords).join(" ");
            remainingTranscript = SpeechMenu.#digestRemainder(utterance, transcript);
            utterance.transcript = transcript;
            pool[0].ignoredPrefix = "";
            SpeechMenu.#emit("utteranceTranscriptChanged", {
                id: utterance.id, transcript, isFinal: Boolean(isFinal)
            });
        }

        utterance.candidatePool =
            pool;
        if (SpeechMenu.#digestCandidate(utterance, pool[0], remainingTranscript, isFinal)) return;

        const streamResult =
            await SpeechMenu
                .#classifyRecognitionStreamHead(
                    utterance,
                    transcript,
                    controller.signal
                );

        if (
            controller.signal.aborted ||
            SpeechMenu.#utterance !==
                utterance ||
            utterance.committed ||
            revision !==
                utterance.transcriptRevision ||
            utterance.candidatePoolController !==
                controller
        ) {
            return;
        }

        if (
            streamResult
                ?.terminal
        ) {
            const committed =
                await SpeechMenu
                    .#commitRecognitionStream(
                        utterance,
                        streamResult
                            .stream,
                        streamResult
                            .exact
                    );

            if (committed) {
                return;
            }
        }

        if (
            pool.length &&
            utterance.lastExactCandidate &&
            !SpeechMenu.#isOpenEndedParameter(utterance.lastExactCandidate.commandElement) &&
            !utterance.committed &&
            !utterance.committing
        ) {
            SpeechMenu
                .#armCandidateHardDeadline(
                    utterance
                );
        }

        if (
            !pool.length &&
            !streamResult
                ?.viable &&
            !utterance.committing &&
            !utterance.lastExactCandidate &&
            SpeechMenu
                .synthesizedSpeechActive
        ) {
            const recovered =
                await SpeechMenu
                    .#recoverBargeInTail(
                        utterance,
                        transcript,
                        controller.signal
                    );

            if (
                controller.signal.aborted ||
                SpeechMenu.#utterance !==
                    utterance ||
                utterance.committed ||
                revision !==
                    utterance.transcriptRevision
            ) {
                return;
            }

            if (recovered) {
                SpeechMenu.#emit(
                    "speechBargeInRecovered",
                    {
                        utteranceId:
                            utterance.id,
                        observed:
                            transcript,
                        recovered:
                            recovered
                                .transcript
                    }
                );

                const stream =
                    SpeechMenu
                        .#recognitionStreamHead(
                            utterance
                        );

                if (
                    stream &&
                    stream.source !==
                        "initial" &&
                    stream.status !==
                        "command"
                ) {
                    stream.transcript =
                        recovered.transcript;

                    if (
                        await SpeechMenu
                            .#commitRecognitionStream(
                                utterance,
                                stream,
                                recovered
                                    .candidate
                            )
                    ) {
                        return;
                    }
                }
                else {
                    utterance.transcript =
                        recovered.transcript;
                    utterance.candidatePool =
                        recovered.pool;

                    if (
                        await SpeechMenu
                            .#commitUtterance(
                                utterance
                            )
                    ) {
                        return;
                    }
                }
            }
        }

        SpeechMenu
            .#scheduleCandidateCommit(
                utterance,
                revision
            );
    }

    static #isPrimed(element) {
        return SpeechMenu.#index().isPrimed(element, SpeechMenu.#utterance?.id);
    }

    static #primeContext(utterance, context) {
        if (!context || utterance.digestClosed) return;
        for (const element of SpeechMenu.#chainContextCandidates(context)) {
            const surface = element.closest('dialog, [popover]');
            if (surface) {utterance.expectedSurfaces ??= new Set(); utterance.expectedSurfaces.add(surface);}
            SpeechMenu.#index().prime(element, utterance.id);
        }
    }

    static #clearPrimed(utterance) {
        SpeechMenu.#index().clearPrimed(utterance?.id);
    }

    static #digestRemainder(utterance, transcript) {
        const full = SpeechMenu.#normalizeTranscript(transcript);
        const consumed = utterance.digestTranscript || "";
        if (!consumed) return full;
        if (full === consumed) return "";
        return full.startsWith(consumed + " ") ? full.slice(consumed.length + 1) : undefined;
    }

    static #rejectDigest(utterance, reason, remainder) {
        utterance.digestFailed = true;
        utterance.releaseFinalResult?.();
        void (utterance.operation ? utterance.operation.cancel(new Error(reason)) :
            globalThis.WMOFStateTransactions?.rollback(`speech:${utterance.id}`, new Error(reason)));
        SpeechMenu.#flushCommandFeedback(utterance, false);
        utterance.digestFailed = true;
        utterance.valueCollectors?.clear();
        if (reason === "consumed-prefix-revised") utterance.chainCanceled = true;
        SpeechMenu.#clearPrimed(utterance);
        if (SpeechMenu.#utterance === utterance) SpeechMenu.#finishUtterance(reason, false);
        SpeechMenu.#emit("utteranceUnrecognized", {id: utterance.id, transcript: remainder, reason, fast: true});
    }

    static #queueDigestStep(utterance, step) {
        const segment = step.segmentTranscript;
        utterance.digestTranscript = [utterance.digestTranscript, segment].filter(Boolean).join(" ");
        utterance.digestSteps.push(step);
        utterance.digestContext = step.nextContext;
        utterance.digestSurfaceStack = step.nextSurfaceStack;
        for (const frame of step.nextSurfaceStack || []) {
            utterance.expectedSurfaces ??= new Set(); utterance.expectedSurfaces.add(frame.surface);
        }
        utterance.valueCollectors?.delete(step.commandElement);
        SpeechMenu.#clearPrimed(utterance);
        SpeechMenu.#primeContext(utterance, step.nextContext);
        const nextSurface = step.nextSurfaceStack?.at(-1)?.surface;
        if (nextSurface && !utterance.digestClosed) {
            for (const element of SpeechMenu.#index().elements()) {
                if (element.closest('dialog, [popover], [speech-scope]') === nextSurface &&
                    SpeechMenu.#candidateStateAvailable(element, true)) SpeechMenu.#index().prime(element, utterance.id);
            }
        }
        SpeechMenu.#emit("speechCommandDigested", {utteranceId: utterance.id,
            commandElement: step.commandElement, transcript: segment,
            consumedTranscript: utterance.digestTranscript});
        utterance.digestQueue = utterance.digestQueue.then(async () => {
            if (utterance.chainCanceled || utterance.digestExecutionFailed || SpeechMenu.#stopped ||
                utterance.sessionGeneration !== SpeechMenu.#sessionGeneration) {
                utterance.chainCanceled = true;
                SpeechMenu.#clearPrimed(utterance);
                return false;
            }
            // UI visibility may lag; hard gates are always rechecked at execution.
            if (!(step.optimistic ? SpeechMenu.#canAttemptStateCommand(step.commandElement) : SpeechMenu.#candidateStateAvailable(step.commandElement, true))) {
                utterance.digestExecutionFailed = true;
                SpeechMenu.#rejectDigest(utterance, "chain-action-unavailable", segment);
                return false;
            }
            utterance.commandChainExecuting = true;
            utterance.digestExecutingContext = SpeechMenu.#chainContextTokens(step.commandElement)[0];
            try {
                const result = await SpeechMenu.#processElement(step.commandElement, segment,
                    utterance.id, step.speechMenuElement, SpeechMenu.#shouldExecuteElement(step.commandElement),
                    undefined, utterance.wallStartedAt, true, false,
                    {chain: true, operation: utterance.operation, chainSurface: step.surface, chainContext: step.context || utterance.digestExecutingContext,
                        hasContinuation: () => utterance.digestSteps.indexOf(step) < utterance.digestSteps.length - 1,
                        nextCommand: () => utterance.digestSteps[utterance.digestSteps.indexOf(step) + 1]?.commandElement.getAttribute("speech-function"),
                        isFinal: () => utterance.digestCommitted,
                        canCommit: () => !utterance.chainCanceled && !utterance.digestExecutionFailed &&
                            !SpeechMenu.#stopped && utterance.sessionGeneration === SpeechMenu.#sessionGeneration &&
                            (step.optimistic ? SpeechMenu.#canAttemptStateCommand(step.commandElement) : SpeechMenu.#candidateStateAvailable(step.commandElement, true))});
                if (utterance.chainCanceled) return false;
                if (!result) {
                    utterance.digestExecutionFailed = true;
                    utterance.digestSurfaceStack = step.surfaceStack;
                    utterance.digestContext = step.context;
                    SpeechMenu.#rejectDigest(utterance, "chain-action-failed", segment);
                    return false;
                }
                utterance.hadCommittedCommand = true;
                return true;
            } finally {
                utterance.commandChainExecuting = false;
                utterance.digestExecutingContext = undefined;
            }
        }).catch(error => {
            utterance.digestExecutionFailed = true;
            SpeechMenu.#rejectDigest(utterance, "chain-action-error", segment);
            SpeechMenu.#emit("speechMenuCommandError", {utteranceId: utterance.id, error});
            return false;
        });
    }

    static #completeDigest(utterance) {
        return utterance.digestCompletion ??= (async () => {
            await utterance.digestQueue;
            const transactions = globalThis.WMOFStateTransactions;
            const group = `speech:${utterance.id}`;
            if (utterance.digestExecutionFailed || utterance.chainCanceled) {
                await transactions?.rollback(group, new Error("The speech command was cancelled."));
                SpeechMenu.#flushCommandFeedback(utterance, false);
                return false;
            }
            utterance.releaseFinalResult?.();
            if (transactions && !(await (utterance.operation ? utterance.operation.complete() : transactions.complete(group)))) {
                utterance.chainCanceled = true;
                SpeechMenu.#rejectDigest(utterance, "state-change-reverted", utterance.transcript);
                return false;
            }
            SpeechMenu.#flushCommandFeedback(utterance, true);
            return true;
        })();
    }

    static #digestCandidate(utterance, candidate, remainder, isFinal) {
        if (!SpeechMenu.#executionEnabled) return false;
        if (candidate?.kind !== "chain" && !utterance.chainActive) return false;
        if (utterance.digestFailed || utterance.digestCommitted) return true;
        utterance.chainActive = true;
        if (!utterance.operation && globalThis.WMOFStateTransactions?.createOperation) {
            utterance.operation = globalThis.WMOFStateTransactions.createOperation({group:`speech:${utterance.id}`, source:"voice"});
            utterance.operation.signal.addEventListener("abort", () => {
                if (!utterance.digestFailed) {
                    utterance.chainCanceled = true;
                    SpeechMenu.#rejectDigest(utterance, "async-operation-cancelled", utterance.digestPending || "");
                }
            }, {once:true});
        }
        SpeechMenu.#clearCandidatePool(utterance);
        const steps = candidate?.chain || [];
        let count = steps.length;
        const last = steps[count - 1];
        // A parameter can still grow: "four" -> "four fifteen". A next
        // command with a complete leading literal word establishes its boundary;
        // a bare/partially decoded value fragment does not.
        if (!isFinal && last && (last.canContinue ||
            last.commandElement.hasAttribute("speech-open-ended") ||
            last.commandElement.hasAttribute("speech-collect")) && (!candidate.pending || !candidate.pending.hasCommandPrefix)) count--;
        if (count && candidate?.ignoredPrefix) {
            utterance.digestTranscript = [utterance.digestTranscript, candidate.ignoredPrefix].filter(Boolean).join(" ");
        }
        for (const step of steps.slice(0, count)) SpeechMenu.#queueDigestStep(utterance, step);
        const consumedWords = steps.slice(0, count).reduce((n, step) =>
            n + step.segmentTranscript.split(" ").length, 0);
        const ignoredWords = candidate?.ignoredPrefix?.split(" ").filter(Boolean).length || 0;
        const tail = remainder.split(" ").filter(Boolean).slice(ignoredWords + consumedWords).join(" ");
        utterance.digestPending = tail;
        // Interim recognition is revisable: keep unmatched head/tail text pending.
        // The final digest validation decides whether the utterance is accepted or rejected.
        if (isFinal) {
            if (tail || candidate?.invalid) SpeechMenu.#rejectDigest(utterance, "no-candidates", tail || remainder);
            else {
                utterance.committed = true;
                utterance.digestCommitted = true;
                SpeechMenu.#clearPrimed(utterance);
                if (SpeechMenu.#utterance === utterance) SpeechMenu.#finishUtterance("digested", false);
                void SpeechMenu.#completeDigest(utterance).then(accepted => {
                    if (accepted) SpeechMenu.#emit("utteranceCommitted", {id: utterance.id, transcript: utterance.transcript});
                });
            }
        }
        return true;
    }

    static async #executeCommandChain(
        candidate,
        utterance
    ) {
        const steps =
            candidate
                ?.chain || [];

        if (
            !steps.length ||
            !utterance
        ) {
            return false;
        }

        if (SpeechMenu.#executionEnabled) {
            // A silence boundary is a final command boundary too. Use the
            // same transaction settlement as the recognizer's final decode.
            utterance.chainActive = true;
            utterance.digestCommitted = true;
            for (const step of steps) SpeechMenu.#queueDigestStep(utterance, step);
            return SpeechMenu.#completeDigest(utterance);
        }

        utterance.commandChainExecuting =
            true;

        const startedAt =
            utterance.wallStartedAt;

        try {
            for (const step of steps) {
                const committed =
                    await SpeechMenu
                        .#processElement(
                            step.commandElement,
                            step.segmentTranscript ||
                                step.transcript,
                            utterance.id,
                            step.speechMenuElement,
                            SpeechMenu
                                .#shouldExecuteElement(
                                    step
                                        .commandElement
                                ),
                            undefined,
                            startedAt,
                            true,
                            false
                        );

                if (!committed) {
                    return false;
                }
            }

            return true;
        }
        finally {
            utterance.commandChainExecuting =
                false;
        }
    }

    static async #commitUtterance(
        utterance
    ) {
        const candidate =
            SpeechMenu
                .#exactCandidate(
                    utterance
                );

        if (
            !utterance ||
            utterance.committed ||
            utterance.committing ||
            utterance.contextGeneration !==
                SpeechMenu.#contextGeneration ||
            !candidate
        ) {
            return false;
        }

        utterance.committing =
            true;

        const transcript =
            utterance.transcript;

        SpeechMenu
            .#cancelCandidateWork(
                utterance
            );

        const repeatable =
            SpeechMenu
                .#candidateIsRepeatable(
                    candidate
                );

        /*
         * Repeatable terminal commands stay on the live Sherpa utterance.
         * A measured pause opens the next logical stream, allowing
         * "faster ... faster" without a recognizer restart. Other
         * terminal commands retain the existing hard stream cut.
         */
        if (!repeatable) {
            SpeechMenu.#stopLiveRecognition(
                utterance,
                false
            );
        }

        let committed =
            false;

        try {
            committed =
                Boolean(
                    candidate.kind ===
                        "chain"
                        ? await SpeechMenu
                            .#executeCommandChain(
                                candidate,
                                utterance
                            )
                        : await SpeechMenu
                            .#processElement(
                                candidate
                                    .commandElement,
                                transcript,
                                utterance.id,
                                candidate
                                    .speechMenuElement,
                                SpeechMenu
                                    .#shouldExecuteElement(
                                        candidate
                                            .commandElement
                                    )
                            )
                );

            if (committed) {
                if (repeatable) {
                    const stream =
                        SpeechMenu
                            .#recognitionStreamHead(
                                utterance
                            );

                    if (stream) {
                        stream.status =
                            "command";
                        stream.exact =
                            true;
                        stream.canContinue =
                            false;
                        stream.repeatable =
                            true;
                        stream.transcript =
                            transcript;
                        stream.committedTranscript =
                            transcript;
                        stream.candidateCount =
                            1;
                    }

                    utterance.hadCommittedCommand =
                        true;

                    SpeechMenu
                        .#clearCandidatePool(
                            utterance
                        );

                    SpeechMenu.#emit(
                        "utteranceCommitted",
                        {
                            id:
                                utterance.id,
                            transcript,
                            streamId:
                                stream?.id,
                            stream:
                                true,
                            repeatable:
                                true
                        }
                    );
                }
                else {
                    SpeechMenu
                        .#resolvePendingStreamsAsContinuation(
                            utterance
                        );

                    utterance.committed =
                        true;

                    SpeechMenu
                        .#clearCandidatePool(
                            utterance
                        );

                    SpeechMenu.#emit(
                        "utteranceCommitted",
                        {
                            id:
                                utterance.id,
                            transcript
                        }
                    );
                }
            }

            return committed;
        }
        finally {
            utterance.committing =
                false;
        }
    }

    static #terminalPrefixRecovery(
        transcript
    ) {
        const spoken =
            SpeechMenu
                .#normalizeTranscript(
                    transcript
                );

        if (
            spoken.length < 4 ||
            spoken.includes(
                " "
            )
        ) {
            return undefined;
        }

        const matches = [];

        for (
            const element of
            SpeechMenu
                .#availableCandidates()
        ) {
            const pattern =
                element.getAttribute(
                    "speech-pattern"
                );

            if (!pattern) {
                continue;
            }

            for (
                const phrase of
                SpeechMenu
                    .#expandRegexSource(
                        pattern
                    )
            ) {
                const canonical =
                    SpeechMenu
                        .#normalizeTranscript(
                            phrase
                        );

                if (
                    !canonical ||
                    canonical.includes(
                        " "
                    ) ||
                    canonical ===
                        spoken ||
                    !canonical.startsWith(
                        spoken
                    ) ||
                    spoken.length * 3 <
                        canonical.length * 2
                ) {
                    continue;
                }

                matches.push({
                    element,
                    phrase:
                        canonical
                });
            }
        }

        if (
            matches.length !==
                1
        ) {
            return undefined;
        }

        return matches[0];
    }

    static async #handleCompletedTranscript(
        utterance,
        transcript
    ) {
        if (utterance?.bargeInBarrier) await utterance.bargeInBarrier;
        if (
            !utterance ||
            utterance.contextGeneration !==
                SpeechMenu.#contextGeneration
        ) {
            return;
        }

        utterance.releaseFinalResult?.();
        SpeechMenu
            .#clearCandidatePool(
                utterance
            );

        utterance.transcript =
            transcript;

        SpeechMenu.#emit(
            "utteranceTranscriptChanged",
            {
                id:
                    utterance.id,
                transcript,
                isFinal: true
            }
        );

        SpeechMenu.#emit(
            "utteranceTranscribed",
            {
                id:
                    utterance.id,
                transcript,
                live: false
            }
        );

        if (SpeechMenu.#executionEnabled) {
            utterance.digestIsFinal = true;
            const remaining = SpeechMenu.#digestRemainder(utterance, transcript);
            if (remaining === undefined) {
                SpeechMenu.#rejectDigest(utterance, "consumed-prefix-revised", transcript);
                return;
            }
            const pool = await SpeechMenu.#refreshCandidatePool(utterance, remaining);
            if (SpeechMenu.#digestCandidate(utterance, pool[0], remaining, true)) return;
        }

        const streamResult =
            await SpeechMenu
                .#classifyRecognitionStreamHead(
                    utterance,
                    transcript
                );

        if (
            streamResult
                ?.terminal
        ) {
            const streamMatched =
                await SpeechMenu
                    .#commitRecognitionStream(
                        utterance,
                        streamResult
                            .stream,
                        streamResult
                            .exact
                    );

            if (streamMatched) {
                return;
            }
        }

        let matched =
            await SpeechMenu.#processTranscript(
                transcript,
                utterance.id,
                SpeechMenu.#executionEnabled
            );

        if (matched) {
            SpeechMenu
                .#resolvePendingStreamsAsContinuation(
                    utterance
                );
        }

        if (!matched) {
            const recovery =
                SpeechMenu
                    .#terminalPrefixRecovery(
                        transcript
                    );

            if (recovery) {
                SpeechMenu.#emit(
                    "speechTerminalPrefixRecovered",
                    {
                        utteranceId:
                            utterance.id,
                        observed:
                            transcript,
                        canonical:
                            recovery.phrase,
                        commandElement:
                            recovery.element
                    }
                );

                matched =
                    await SpeechMenu
                        .#processElement(
                            recovery.element,
                            recovery.phrase,
                            utterance.id,
                            SpeechMenu
                                .#candidateMenu(
                                    recovery.element
                                ),
                            SpeechMenu
                                .#shouldExecuteElement(
                                    recovery.element
                                )
                        );

                if (matched) {
                    SpeechMenu
                        .#resolvePendingStreamsAsContinuation(
                            utterance
                        );
                }
            }
        }

        if (!matched) {
            SpeechMenu.#emit(
                "utteranceUnrecognized",
                {
                    id:
                        utterance.id,
                    transcript
                }
            );
        }
    }

    static #stripSynthesizedSpeech(value) {
        let transcript =
            SpeechMenu
                .#normalizeTranscript(
                    value
                );

        if (
            !transcript ||
            !SpeechMenu
                .#synthesizedSpeech
                .size
        ) {
            return transcript;
        }

        const now =
            performance.now();

        const phrases = [];

        for (
            const [
                id,
                entry
            ] of SpeechMenu
                .#synthesizedSpeech
        ) {
            if (
                entry.expiresAt !==
                    Infinity &&
                entry.expiresAt <= now
            ) {
                clearTimeout(
                    entry.timer
                );

                SpeechMenu
                    .#synthesizedSpeech
                    .delete(id);

                continue;
            }

            phrases.push(
                entry.text
            );
        }

        phrases.sort(
            (left, right) =>
                right.length -
                left.length
        );

        for (
            const phrase of
            phrases
        ) {
            const escaped =
                phrase.replace(
                    /[-/\\^$*+?.()|[\]{}]/g,
                    "\\$&"
                );

            transcript =
                transcript
                    .replace(
                        new RegExp(
                            "(?:^|\\s)" +
                            escaped +
                            "(?=\\s|$)",
                            "g"
                        ),
                        " "
                    )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            if (!transcript) {
                break;
            }
        }

        return transcript;
    }

    static #activeSynthesizedPhrases() {
        const now =
            performance.now();
        const phrases = [];

        for (
            const [
                id,
                entry
            ] of SpeechMenu
                .#synthesizedSpeech
        ) {
            if (
                entry.expiresAt !==
                    Infinity &&
                entry.expiresAt <= now
            ) {
                clearTimeout(
                    entry.timer
                );
                SpeechMenu
                    .#synthesizedSpeech
                    .delete(id);
                continue;
            }

            phrases.push(
                entry.text
            );
        }

        return phrases;
    }

    static async #recoverBargeInTail(
        utterance,
        transcript,
        signal
    ) {
        if (
            !SpeechMenu
                .synthesizedSpeechActive
        ) {
            return undefined;
        }

        const normalized =
            SpeechMenu
                .#normalizeTranscript(
                    transcript
                );
        const words =
            normalized
                .split(" ")
                .filter(Boolean);

        if (words.length < 2) {
            return undefined;
        }

        const synthesized =
            SpeechMenu
                .#activeSynthesizedPhrases();

        for (
            let index = 1;
            index < words.length;
            index++
        ) {
            if (signal?.aborted) {
                return undefined;
            }

            const tail =
                words
                    .slice(index)
                    .join(" ");

            if (
                synthesized.some(
                    phrase =>
                        phrase === tail ||
                        phrase.endsWith(
                            " " + tail
                        )
                )
            ) {
                continue;
            }

            const probe = {
                id:
                    utterance.id,
                candidatePool: [],
                lastExactCandidate:
                    undefined
            };
            const pool =
                await SpeechMenu
                    .#refreshCandidatePool(
                        probe,
                        tail,
                        signal
                    );

            if (signal?.aborted) {
                return undefined;
            }

            const exact =
                SpeechMenu
                    .#exactCandidate(
                        probe
                    );

            if (
                exact &&
                !exact.continuation
            ) {
                return {
                    transcript:
                        tail,
                    candidate:
                        exact,
                    pool
                };
            }
        }

        return undefined;
    }

    static #normalizeTranscript(value) {
        return String(value || "")
            .toLocaleLowerCase()
            .trim()
            .replace(
                /(\d)\.(?=\d)/g,
                "$1\uFFFF"
            )
            .replace(
                /[^\p{L}\p{N}\s:\uFFFF]/gu,
                " "
            )
            .replace(
                /\uFFFF/g,
                "."
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    static #compactTranscript(value) {
        return SpeechMenu
            .#normalizeTranscript(
                value
            )
            .replace(
                /\s+/g,
                ""
            );
    }

    static #whitespaceTolerantSource(
        source
    ) {
        const text =
            String(source || "");

        let result = "";
        let escaped = false;
        let characterClass = false;

        for (
            let index = 0;
            index < text.length;
            index++
        ) {
            const character =
                text[index];

            if (escaped) {
                result +=
                    character;
                escaped = false;
                continue;
            }

            if (character === "\\") {
                result +=
                    character;
                escaped = true;
                continue;
            }

            if (character === "[") {
                characterClass =
                    true;
                result +=
                    character;
                continue;
            }

            if (
                character === "]" &&
                characterClass
            ) {
                characterClass =
                    false;
                result +=
                    character;
                continue;
            }

            if (
                !characterClass &&
                /\s/.test(
                    character
                )
            ) {
                result +=
                    "\\s*";

                while (
                    index + 1 <
                        text.length &&
                    /\s/.test(
                        text[
                            index + 1
                        ]
                    )
                ) {
                    index++;
                }

                continue;
            }

            result +=
                character;
        }

        return result;
    }

    static #compactPrefixRemainder(
        text,
        compactPrefix
    ) {
        const normalized =
            SpeechMenu
                .#normalizeTranscript(
                    text
                );

        const target =
            String(
                compactPrefix ||
                ""
            );

        if (!target) {
            return undefined;
        }

        let compactIndex = 0;

        for (
            let index = 0;
            index < normalized.length;
            index++
        ) {
            const character =
                normalized[index];

            if (/\s/.test(character)) {
                continue;
            }

            if (
                character !==
                target[
                    compactIndex
                ]
            ) {
                return undefined;
            }

            compactIndex++;

            if (
                compactIndex ===
                target.length
            ) {
                return normalized
                    .slice(
                        index + 1
                    )
                    .trim();
            }
        }

        return undefined;
    }

    static #candidateAllowsCorrection(
        element,
        correction
    ) {
        const normal =
            element.speechPattern;

        const compact =
            element.speechCompactPattern;

        const test =
            value => {
                for (
                    const regex of
                    [normal, compact]
                ) {
                    if (!regex) continue;
                    regex.lastIndex = 0;

                    if (
                        regex.test(
                            value
                        )
                    ) {
                        return true;
                    }
                }

                return false;
            };

        if (
            correction.matchType ===
                "exact"
        ) {
            return test(
                correction.canonical
            );
        }

        return (
            test(
                correction.canonical +
                " value"
            ) ||
            SpeechMenu
                .#expandRegexSource(
                    element.getAttribute(
                        "speech-pattern"
                    ) ||
                    ""
                )
                .some(
                    phrase =>
                        SpeechMenu
                            .#compactTranscript(
                                phrase.replace(
                                    /<[^>]+>/g,
                                    ""
                                )
                            )
                            .startsWith(
                                correction
                                    .canonicalCompact
                            )
                )
        );
    }

    static #applyCorrection(
        element,
        text
    ) {
        const transcript =
            SpeechMenu
                .#normalizeTranscript(
                    text
                );

        const compact =
            SpeechMenu
                .#compactTranscript(
                    transcript
                );

        for (
            const correction of
            [
                ...SpeechMenu
                    .#builtInCorrections,
                ...SpeechMenu
                    .#corrections
            ]
        ) {
            if (
                !SpeechMenu
                    .#candidateAllowsCorrection(
                        element,
                        correction
                    )
            ) {
                continue;
            }

            if (
                correction.matchType ===
                    "exact"
            ) {
                if (
                    compact !==
                    correction
                        .observedCompact
                ) {
                    continue;
                }

                return {
                    correction,
                    original:
                        transcript,
                    corrected:
                        correction
                            .canonical
                };
            }

            const remainder =
                SpeechMenu
                    .#compactPrefixRemainder(
                        transcript,
                        correction
                            .observedCompact
                    );

            if (
                remainder ===
                    undefined
            ) {
                continue;
            }

            return {
                correction,
                original:
                    transcript,
                corrected:
                    SpeechMenu
                        .#normalizeTranscript(
                            correction
                                .canonical +
                            (
                                remainder
                                    ? " " +
                                        remainder
                                    : ""
                            )
                        )
            };
        }

        return undefined;
    }

    static #test(regex, text) {
        regex.lastIndex = 0;
        return regex.test(text);
    }

    static #recognitionStreamHead(
        utterance
    ) {
        const stack =
            utterance
                ?.streamStack;

        return Array.isArray(
            stack
        ) &&
        stack.length
            ? stack[
                stack.length - 1
            ]
            : undefined;
    }

    static #pushRecognitionStream(
        utterance,
        pauseMilliseconds,
        source,
        now = performance.now()
    ) {
        if (!utterance) {
            return undefined;
        }

        const current =
            SpeechMenu
                .#recognitionStreamHead(
                    utterance
                );
        const baseTranscript =
            SpeechMenu
                .#normalizeTranscript(
                    current?.status ===
                        "command" &&
                    current?.repeatable
                        ? (
                            current
                                .committedTranscript ||
                            utterance
                                .transcript
                        )
                        : utterance
                            .transcript
                );

        if (!baseTranscript) {
            return undefined;
        }

        if (
            current &&
            current.status ===
                "pending" &&
            current.baseTranscript ===
                baseTranscript
        ) {
            current.pauseMilliseconds =
                Math.round(
                    pauseMilliseconds
                );

            return current;
        }

        const wallStartedAt =
            new Date(
                performance.timeOrigin +
                now
            )
                .toISOString();

        const stream = {
            id:
                ++utterance
                    .streamSequence,
            baseTranscript,
            transcript: "",
            pauseMilliseconds:
                Math.max(
                    0,
                    Math.round(
                        Number(
                            pauseMilliseconds
                        ) ||
                        0
                    )
                ),
            source:
                String(
                    source ||
                    "speech"
                ),
            startedAt:
                now,
            wallStartedAt,
            status:
                "pending",
            exact:
                false,
            canContinue:
                false,
            repeatable:
                false,
            committedTranscript:
                "",
            candidateCount:
                0
        };

        utterance
            .streamStack
            .push(
                stream
            );

        if (
            utterance
                .streamStack
                .length >
            8
        ) {
            utterance
                .streamStack
                .splice(
                    1,
                    utterance
                        .streamStack
                        .length -
                        8
                );
        }

        SpeechMenu.#emit(
            "speechStreamPushed",
            {
                utteranceId:
                    utterance.id,
                streamId:
                    stream.id,
                pauseMilliseconds:
                    stream.pauseMilliseconds,
                source:
                    stream.source,
                baseTranscript
            }
        );

        return stream;
    }

    static #candidateIsRepeatable(
        candidate
    ) {
        return Boolean(
            candidate
                ?.commandElement
                ?.hasAttribute?.(
                    "speech-repeatable"
                )
        );
    }

    static #repeatableStreamHead(
        utterance
    ) {
        const stream =
            SpeechMenu
                .#recognitionStreamHead(
                    utterance
                );

        return (
            stream?.status ===
                "command" &&
            stream?.repeatable ===
                true
        )
            ? stream
            : undefined;
    }

    static #streamRemainder(
        baseTranscript,
        fullTranscript
    ) {
        const base =
            SpeechMenu
                .#normalizeTranscript(
                    baseTranscript
                );
        const full =
            SpeechMenu
                .#normalizeTranscript(
                    fullTranscript
                );

        if (!base) {
            return full;
        }

        if (full === base) {
            return "";
        }

        const prefix =
            base + " ";

        if (
            !full.startsWith(
                prefix
            )
        ) {
            return undefined;
        }

        return full
            .slice(
                prefix.length
            )
            .trim();
    }

    static async #classifyRecognitionStreamHead(
        utterance,
        fullTranscript,
        signal
    ) {
        const stream =
            SpeechMenu
                .#recognitionStreamHead(
                    utterance
                );

        if (
            !stream ||
            stream.source ===
                "initial" ||
            stream.status ===
                "separation" ||
            stream.status ===
                "continuation" ||
            stream.status ===
                "command"
        ) {
            return undefined;
        }

        const text =
            SpeechMenu
                .#streamRemainder(
                    stream
                        .baseTranscript,
                    fullTranscript
                );

        if (text === undefined) {
            stream.status =
                "revised";

            return {
                stream,
                viable: false,
                terminal: false
            };
        }

        if (!text) {
            return {
                stream,
                viable: true,
                terminal: false
            };
        }

        stream.transcript =
            text;

        const probe = {
            id:
                utterance.id,
            candidatePool: [],
            lastExactCandidate:
                undefined
        };

        const pool =
            await SpeechMenu
                .#refreshCandidatePool(
                    probe,
                    text,
                    signal
                );

        if (signal?.aborted) {
            return undefined;
        }

        const exact =
            SpeechMenu
                .#exactCandidate(
                    probe
                );
        const canContinue =
            pool.some(
                candidate =>
                    candidate
                        .continuation
            );

        stream.exact =
            Boolean(exact);
        stream.canContinue =
            canContinue;
        stream.candidateCount =
            pool.length;
        stream.status =
            pool.length
                ? "active"
                : "pending";

        return {
            stream,
            pool,
            exact,
            viable:
                pool.length > 0,
            terminal:
                Boolean(
                    exact &&
                    !canContinue
                )
        };
    }

    static #resolvePendingStreamsAsContinuation(
        utterance
    ) {
        let observed =
            false;

        for (
            const stream of
                utterance
                    ?.streamStack ||
                []
        ) {
            if (
                stream.source ===
                    "initial" ||
                stream.status ===
                    "continuation" ||
                stream.status ===
                    "separation" ||
                !stream
                    .pauseMilliseconds
            ) {
                continue;
            }

            stream.status =
                "continuation";

            observed =
                SpeechMenu
                    .#observeContinuationPause(
                        stream
                            .pauseMilliseconds,
                        stream
                            .source
                    ) ||
                observed;
        }

        return observed;
    }

    static #observeStreamSeparation(
        milliseconds,
        source
    ) {
        const accepted =
            SpeechMenu
                .#adaptiveTiming
                ?.observeStreamSeparation(
                    milliseconds,
                    {
                        source
                    }
                );

        if (accepted) {
            SpeechMenu.#emit(
                "speechTimingChanged",
                {
                    reason:
                        "stream-separation",
                    source,
                    pauseMilliseconds:
                        Math.round(
                            milliseconds
                        ),
                    snapshot:
                        SpeechMenu
                            .speechTimingSnapshot
                }
            );
        }

        return Boolean(
            accepted
        );
    }

    static async #commitRecognitionStream(
        utterance,
        stream,
        candidate
    ) {
        if (
            !utterance ||
            !stream ||
            !candidate ||
            utterance.committed ||
            utterance.committing ||
            utterance.contextGeneration !==
                SpeechMenu.#contextGeneration
        ) {
            return false;
        }

        utterance.committing =
            true;

        SpeechMenu
            .#cancelCandidateWork(
                utterance
            );

        const repeatable =
            SpeechMenu
                .#candidateIsRepeatable(
                    candidate
                );

        if (
            !repeatable &&
            SpeechMenu
                .#utterance ===
            utterance
        ) {
            SpeechMenu
                .#stopLiveRecognition(
                    utterance,
                    false
                );
        }

        let committed =
            false;

        try {
            committed =
                Boolean(
                    await SpeechMenu
                        .#processElement(
                            candidate
                                .commandElement,
                            stream
                                .transcript,
                            utterance.id,
                            candidate
                                .speechMenuElement,
                            SpeechMenu
                                .#shouldExecuteElement(
                                    candidate
                                        .commandElement
                                ),
                            undefined,
                            stream
                                .wallStartedAt
                        )
                );

            if (committed) {
                stream.status =
                    repeatable
                        ? "command"
                        : "separation";
                stream.repeatable =
                    repeatable;
                stream.exact =
                    true;
                stream.canContinue =
                    false;
                stream.committedTranscript =
                    SpeechMenu
                        .#normalizeTranscript(
                            utterance
                                .transcript
                        );
                utterance.hadCommittedCommand =
                    true;

                if (!repeatable) {
                    utterance.committed =
                        true;
                }

                SpeechMenu
                    .#observeStreamSeparation(
                        stream
                            .pauseMilliseconds,
                        stream
                            .source
                    );

                SpeechMenu
                    .#clearCandidatePool(
                        utterance
                    );

                SpeechMenu.#emit(
                    "utteranceCommitted",
                    {
                        id:
                            utterance.id,
                        transcript:
                            stream
                                .transcript,
                        streamId:
                            stream.id,
                        stream:
                            true,
                        repeatable
                    }
                );
            }

            return committed;
        }
        finally {
            utterance.committing =
                false;
        }
    }

    static #continuationPauseBoundaryMilliseconds() {
        const adaptive =
            Number(
                SpeechMenu
                    .#adaptiveTiming
                    ?.continuationPauseBoundaryMilliseconds
            );

        return Number.isFinite(
            adaptive
        )
            ? adaptive
            : SpeechMenu
                .#vadMinimumSilenceMilliseconds;
    }

    static #continuationDispatchDelayMilliseconds() {
        const adaptive =
            Number(
                SpeechMenu
                    .#adaptiveTiming
                    ?.continuationDispatchDelayMilliseconds
            );

        return Number.isFinite(
            adaptive
        )
            ? adaptive
            : Math.max(
                0,
                SpeechMenu
                    .#continuationSilenceTimeout -
                SpeechMenu
                    .#vadMinimumSilenceMilliseconds
            );
    }

    static #continuationGraceMilliseconds() {
        return (
            SpeechMenu
                .#continuationPauseBoundaryMilliseconds() +
            SpeechMenu
                .#continuationDispatchDelayMilliseconds()
        );
    }

    static #streamSeparationMilliseconds() {
        const adaptive =
            Number(
                SpeechMenu
                    .#adaptiveTiming
                    ?.streamSeparationMilliseconds
            );

        return Number.isFinite(
            adaptive
        )
            ? adaptive
            : SpeechMenu
                .#continuationSilenceTimeout;
    }

    static #observeContinuationPause(
        milliseconds,
        source
    ) {
        const accepted =
            SpeechMenu
                .#adaptiveTiming
                ?.observeContinuationPause(
                    milliseconds,
                    {
                        source
                    }
                );

        if (accepted) {
            SpeechMenu.#emit(
                "speechTimingChanged",
                {
                    reason:
                        "continuation-pause",
                    source,
                    pauseMilliseconds:
                        Math.round(
                            milliseconds
                        ),
                    snapshot:
                        SpeechMenu
                            .speechTimingSnapshot
                }
            );
        }

        return Boolean(
            accepted
        );
    }

    static #cancelContinuationPause(
        utterance
    ) {
        if (!utterance) {
            return false;
        }

        if (
            utterance
                .continuationPauseTimer !==
            undefined
        ) {
            clearTimeout(
                utterance
                    .continuationPauseTimer
            );
        }

        utterance
            .continuationPauseTimer =
            undefined;
        utterance
            .continuationPauseStartedAt =
            undefined;

        return true;
    }

    static #armContinuationPauseDeadline(
        utterance
    ) {
        if (!utterance) {
            return false;
        }

        if (
            utterance
                .continuationPauseTimer !==
            undefined
        ) {
            clearTimeout(
                utterance
                    .continuationPauseTimer
            );
        }

        const startedAt =
            Number(
                utterance
                    .continuationPauseStartedAt
            );
        const elapsed =
            Number.isFinite(
                startedAt
            )
                ? Math.max(
                    0,
                    performance.now() -
                        startedAt
                )
                : 0;
        const repeatable =
            SpeechMenu
                .#repeatableStreamHead(
                    utterance
                );
        const pauseBoundaryMilliseconds =
            repeatable
                ? SpeechMenu
                    .#streamSeparationMilliseconds()
                : SpeechMenu
                    .#continuationPauseBoundaryMilliseconds();
        const dispatchDelayMilliseconds =
            repeatable
                ? 0
                : SpeechMenu
                    .#continuationDispatchDelayMilliseconds();
        const dispatchAtMilliseconds =
            pauseBoundaryMilliseconds +
            dispatchDelayMilliseconds;
        const delay =
            Math.max(
                0,
                dispatchAtMilliseconds -
                    elapsed
            );

        utterance
            .continuationPauseTimer =
            setTimeout(
                () => {
                    utterance
                        .continuationPauseTimer =
                        undefined;

                    if (
                        SpeechMenu.#stopped ||
                        SpeechMenu.#utterance !==
                            utterance ||
                        utterance.committed ||
                        utterance.committing ||
                        !SpeechMenu
                            .#hasOpenContinuation(
                                utterance
                            )
                    ) {
                        return;
                    }

                    if (
                        SpeechMenu
                            .#repeatableStreamHead(
                                utterance
                            )
                    ) {
                        SpeechMenu
                            .#finishUtterance(
                                "repeatable-silence",
                                false
                            );
                        return;
                    }

                    SpeechMenu
                        .#finishUtterance(
                            "candidate-silence",
                            true
                        );
                },
                delay
            );

        return true;
    }

    static #cancelCandidateWork(
        utterance
    ) {
        if (
            utterance
                ?.candidateCommitTimer !==
            undefined
        ) {
            clearTimeout(
                utterance
                    .candidateCommitTimer
            );

            utterance.candidateCommitTimer =
                undefined;
        }

        const controller =
            utterance
                ?.candidatePoolController;

        if (
            controller &&
            !controller.signal.aborted
        ) {
            controller.abort();
        }

        if (utterance) {
            utterance.candidatePoolController =
                undefined;
        }
    }

    static #clearCandidatePool(
        utterance
    ) {
        if (!utterance) return;

        SpeechMenu
            .#cancelCandidateWork(
                utterance
            );
        SpeechMenu
            .#cancelContinuationPause(
                utterance
            );

        if (
            utterance
                .candidateHardCommitTimer !==
            undefined
        ) {
            clearTimeout(
                utterance
                    .candidateHardCommitTimer
            );

            utterance.candidateHardCommitTimer =
                undefined;
        }

        utterance.candidateHardCommitAt =
            undefined;
        utterance.lastExactCandidate =
            undefined;
        utterance.candidatePool = [];
    }

    static #exactCandidate(
        utterance
    ) {
        return utterance
            ?.candidatePool
            ?.find(
                candidate =>
                    candidate.exact
            );
    }

    static #hasCompetingContinuation(
        utterance,
        exactCandidate
    ) {
        const exactIsSystem =
            SpeechMenu
                .#effectiveModal(
                    exactCandidate
                        ?.commandElement
                ) ===
                "system";

        return Boolean(
            utterance
                ?.candidatePool
                ?.some(
                    candidate =>
                        candidate !==
                            exactCandidate &&
                        candidate
                            .continuation &&
                        (
                            !exactIsSystem ||
                            SpeechMenu
                                .#effectiveModal(
                                    candidate
                                        .commandElement
                                ) ===
                                "system"
                        )
                )
        );
    }

    static #hasOpenContinuation(
        utterance
    ) {
        if (utterance?.chainActive && !utterance.digestFailed) return true;
        const exactCandidate =
            SpeechMenu
                .#exactCandidate(
                    utterance
                );
        const streamHead =
            SpeechMenu
                .#recognitionStreamHead(
                    utterance
                );

        return Boolean(
            (
                streamHead &&
                streamHead.status ===
                    "command" &&
                streamHead.repeatable ===
                    true
            ) ||
            (
                streamHead &&
                streamHead.source !==
                    "initial" &&
                (
                    streamHead.status ===
                        "pending" ||
                    streamHead.canContinue
                )
            ) ||
            exactCandidate
                ?.continuation ||
            (
                !exactCandidate &&
                utterance
                    ?.candidatePool
                    ?.length &&
                utterance
                    .lastExactCandidate
            )
        );
    }

    static #commitHeldCandidate(
        utterance
    ) {
        if (
            !utterance ||
            utterance.committed ||
            utterance.committing
        ) {
            return false;
        }

        const candidate =
            SpeechMenu
                .#exactCandidate(
                    utterance
                ) ||
            utterance.lastExactCandidate;

        if (!candidate) {
            return false;
        }

        utterance.candidatePool = [
            candidate
        ];

        if (candidate.transcript) {
            utterance.transcript =
                candidate.transcript;
        }

        void SpeechMenu
            .#commitUtterance(
                utterance
            );

        return true;
    }

    static #candidateCommitTimeout(
        utterance
    ) {
        return utterance
            ?.candidatePool
            ?.some(
                candidate =>
                    candidate.continuation
            )
                ? SpeechMenu
                    .#commitSilenceTimeout
                : Math.min(
                    SpeechMenu
                        .#commitSilenceTimeout,
                    SpeechMenu
                        .#terminalCommitSilenceTimeout
                );
    }

    static #armCandidateHardDeadline(
        utterance
    ) {
        if (!utterance) {
            return false;
        }

        if (
            utterance
                .candidateHardCommitTimer !==
            undefined
        ) {
            clearTimeout(
                utterance
                    .candidateHardCommitTimer
            );
        }

        utterance.candidateHardCommitAt =
            performance.now() +
            SpeechMenu
                .#maximumCandidateHoldTimeout;

        utterance.candidateHardCommitTimer =
            setTimeout(
                () => {
                    utterance
                        .candidateHardCommitTimer =
                        undefined;

                    if (
                        SpeechMenu.#stopped ||
                        SpeechMenu.#utterance !==
                            utterance ||
                        utterance.committed ||
                        utterance.committing
                    ) {
                        return;
                    }

                    const currentExact =
                        SpeechMenu
                            .#exactCandidate(
                                utterance
                            );

                    if (currentExact) {
                        void SpeechMenu
                            .#commitUtterance(
                                utterance
                            );
                        return;
                    }

                    /*
                     * The recognizer advanced beyond the last exact
                     * transcript but is still inside a viable command.
                     * Do not commit the stale snapshot; ask Sherpa for
                     * its final decode of the newer partial instead.
                     */
                    if (
                        utterance
                            .lastExactCandidate &&
                        utterance
                            .lastExactCandidate
                            .revision !==
                            utterance
                                .transcriptRevision
                    ) {
                        SpeechMenu
                            .#finishUtterance(
                                "candidate-silence",
                                true
                            );
                    }
                },
                SpeechMenu
                    .#maximumCandidateHoldTimeout
            );

        return true;
    }

    static #scheduleCandidateCommit(
        utterance,
        revision
    ) {
        const exactCandidate =
            SpeechMenu
                .#exactCandidate(
                    utterance
                );

        if (
            !utterance ||
            utterance.committed ||
            utterance.committing ||
            !exactCandidate
        ) {
            return false;
        }

        if (
            SpeechMenu
                .#hasCompetingContinuation(
                    utterance,
                    exactCandidate
                )
        ) {
            return false;
        }

        utterance.lastExactCandidate = {
            ...exactCandidate,
            transcript:
                utterance.transcript,
            revision
        };

        if (
            !SpeechMenu.#isOpenEndedParameter(exactCandidate.commandElement)
        ) {
            SpeechMenu
                .#armCandidateHardDeadline(
                    utterance
                );
        }

        if (
            utterance
                .candidateCommitTimer !==
            undefined
        ) {
            clearTimeout(
                utterance
                    .candidateCommitTimer
            );

            utterance.candidateCommitTimer =
                undefined;
        }

        if (
            exactCandidate.continuation
        ) {
            return true;
        }

        /*
         * Once a terminal phrase is exact and no competing phrase can
         * still grow from the same transcript, the recognition decision
         * is complete.  Commit it immediately instead of holding the
         * utterance for the terminal silence timeout.  #commitUtterance()
         * stops the current Sherpa stream before running the action, so
         * the very next voiced frame can start a fresh utterance and
         * barge in even while the previous action is still finishing.
         *
         * Open/ambiguous phrases keep the normal hold above, preserving
         * cases such as "ready" -> "ready at four fifteen". Speech rate
         * changes that continuation dispatch hold, not pause detection.
         */
        void SpeechMenu
            .#commitUtterance(
                utterance
            );

        return true;
    }

    static #phraseCanContinue(
        transcript,
        phrase
    ) {
        const spoken =
            SpeechMenu
                .#normalizeTranscript(
                    transcript
                )
                .split(" ")
                .filter(Boolean);

        const template =
            String(
                phrase ||
                ""
            )
                .toLocaleLowerCase()
                .trim()
                .replace(
                    /\s+/g,
                    " "
                )
                .split(" ")
                .filter(Boolean);

        if (
            !spoken.length ||
            !template.length
        ) {
            return false;
        }

        const placeholder =
            token =>
                /^<[A-Za-z_$][\w$]*>$/
                    .test(token);

        const visit =
            (
                templateIndex,
                spokenIndex
            ) => {
                if (
                    spokenIndex >=
                    spoken.length
                ) {
                    return (
                        templateIndex <
                        template.length
                    );
                }

                if (
                    templateIndex >=
                    template.length
                ) {
                    return false;
                }

                const token =
                    template[
                        templateIndex
                    ];

                if (
                    !placeholder(token)
                ) {
                    const spokenToken =
                        spoken[
                            spokenIndex
                        ];

                    if (
                        token !==
                        spokenToken
                    ) {
                        /*
                         * Streaming recognizers revise the final word
                         * character-by-character/phoneme-by-phoneme.
                         * Keep a phrase alive when the last observed
                         * token is still a prefix of the expected token
                         * (for example "re" / "read" -> "ready").
                         */
                        if (
                            spokenIndex ===
                                spoken.length -
                                    1 &&
                            token.startsWith(
                                spokenToken
                            )
                        ) {
                            return true;
                        }

                        return false;
                    }

                    return visit(
                        templateIndex + 1,
                        spokenIndex + 1
                    );
                }

                for (
                    let next =
                        spokenIndex + 1;
                    next <=
                        spoken.length;
                    next++
                ) {
                    if (
                        next ===
                        spoken.length
                    ) {
                        return true;
                    }

                    if (
                        visit(
                            templateIndex + 1,
                            next
                        )
                    ) {
                        return true;
                    }
                }

                return false;
            };

        return visit(
            0,
            0
        );
    }

    static #hasExactLiteralPhrase(
        phrases,
        transcript
    ) {
        const spoken =
            SpeechMenu
                .#normalizeTranscript(
                    transcript
                );

        if (!spoken) {
            return false;
        }

        return (
            phrases || []
        )
            .some(
                phrase => {
                    const value =
                        String(
                            phrase ||
                            ""
                        )
                            .trim();

                    if (
                        !value ||
                        /<[A-Za-z_$][\w$]*>/
                            .test(value)
                    ) {
                        return false;
                    }

                    return (
                        SpeechMenu
                            .#normalizeTranscript(
                                value
                            ) ===
                        spoken
                    );
                }
            );
    }

    static #elementContinuationDepth(
        element,
        transcript
    ) {
        const group =
            SpeechMenu.#phraseGroups
                .find(
                    item =>
                        item.element ===
                        element
                );

        if (!group) {
            return undefined;
        }

        if (
            !SpeechMenu.#isOpenEndedParameter(element) &&
            SpeechMenu
                .#hasExactLiteralPhrase(
                    group.phrases,
                    transcript
                )
        ) {
            return undefined;
        }

        let depth;

        for (
            const phrase of
            group.phrases
        ) {
            if (
                !SpeechMenu
                    .#phraseCanContinue(
                        transcript,
                        phrase
                    )
            ) {
                continue;
            }

            const words =
                String(phrase)
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .length;

            depth =
                depth === undefined
                    ? words
                    : Math.min(
                        depth,
                        words
                    );
        }

        return depth;
    }

    static #elementDirectContinuationDepth(
        element,
        transcript
    ) {
        const pattern =
            element?.getAttribute?.(
                "speech-pattern"
            );

        if (!pattern) {
            return undefined;
        }

        const phrases =
            SpeechMenu
                .#expandRegexSource(
                    pattern
                );

        let depth;

        for (const phrase of phrases) {
            if (
                !SpeechMenu
                    .#phraseCanContinue(
                        transcript,
                        phrase
                    )
            ) {
                continue;
            }

            const words =
                String(phrase)
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .length;

            depth =
                depth === undefined
                    ? words
                    : Math.min(
                        depth,
                        words
                    );
        }

        return depth;
    }

    static #chainNextContext(
        element
    ) {
        return String(
            element
                ?.getAttribute?.(
                    "speech-chain-next"
                ) ||
            ""
        )
            .trim() ||
            undefined;
    }

    static #chainContextTokens(
        element
    ) {
        return String(
            element
                ?.getAttribute?.(
                    "speech-chain-context"
                ) ||
            ""
        )
            .split(/[\s,]+/)
            .map(
                value =>
                    value.trim()
            )
            .filter(Boolean);
    }

    static #chainContextCandidates(
        context
    ) {
        const key =
            String(
                context ||
                ""
            ).trim();

        if (!key) {
            return [];
        }

        return SpeechMenu
            .#sortCandidates(
                [
                    ...SpeechMenu.#index().elements()
                ]
                    .filter(
                        element =>
                            SpeechMenu
                                .#chainContextTokens(
                                    element
                                )
                                .includes(
                                    key
                                ) && SpeechMenu.#candidateStateAvailable(element, true)
                    )
            );
    }

    static async #probeChainElement(
        element,
        transcript,
        utterance,
        signal
    ) {
        if (signal?.aborted) {
            return undefined;
        }

        return SpeechMenu
            .#processElement(
                element,
                transcript,
                utterance.id,
                SpeechMenu
                    .#candidateMenu(
                        element
                    ),
                false,
                signal,
                undefined,
                false,
                true
            );
    }

    static #isOpenEndedParameter(element) {
        return Boolean(element?.hasAttribute?.("speech-open-ended") || element?.hasAttribute?.("speech-collect"));
    }

    // Collect an opaque sequence using the item's own matching/preprocessing
    // contract. No language, numeric format, or value type is assumed.
    static async #collectSpeechSequence(element, words, utterance, signal, probe) {
        if (!element.hasAttribute("speech-collect")) return undefined;
        let accepted;
        for (let end = 1; end <= words.length; end++) {
            if (signal?.aborted) return undefined;
            const segment = words.slice(0, end).join(" ");
            const result = await probe(segment);
            if (result) accepted = {end, segment, result};
        }
        const state = {status: accepted ? "valid" : "pending",
            transcript: words.join(" "), value: accepted?.result.transcript,
            acceptedTranscript: accepted?.segment, end: accepted?.end};
        // Final decodes after VAD closure may collect locally, but must not
        // recreate persistent state for an utterance whose capture ended.
        if (!utterance.digestClosed && !utterance.digestFailed && !signal?.aborted) {
            utterance.valueCollectors ??= new Map();
            utterance.valueCollectors.set(element, state);
        }
        return {state, accepted};
    }

    static #digestCandidates(context, frames) {
        const contextual = context ? SpeechMenu.#chainContextCandidates(context) : [];
        return [...new Set([...contextual, ...SpeechMenu.#availableCandidates(frames === undefined ? undefined : frames.at(-1)?.surface || null)])];
    }

    static #canAttemptStateCommand(element) {
        if (!element?.isConnected || !element.hasAttribute("data-speech-state-command") ||
            element.matches("[disabled], [hidden], [inert], [aria-hidden='true']")) return false;
        const authorization = element.getAttribute("speech-authorized");
        if (authorization) {
            const resolved = SpeechMenu.#resolve(authorization);
            try {if (!resolved || resolved.fn.call(resolved.owner, element) !== true) return false;}
            catch {return false;}
        }
        return true;
    }
    static #stateAttemptCandidates(context, frames) {
        const available = SpeechMenu.#digestCandidates(context, frames);
        const surface = frames?.at(-1)?.surface;
        return [...new Set([...available, ...SpeechMenu.#index().elements().filter(element => {
            if (!SpeechMenu.#canAttemptStateCommand(element)) return false;
            const contexts = SpeechMenu.#chainContextTokens(element);
            if (contexts.length) return contexts.includes(context);
            const owner = element.closest('dialog, [popover], [speech-scope]');
            return !owner || owner === surface;
        })])];
    }

    // A bare parameter fragment is not a boundary for the preceding value.
    // Only a matching literal command prefix can release it before final decode.
    static #hasExplicitCommandPrefix(element, transcript) {
        const words = SpeechMenu.#normalizeTranscript(transcript).split(" ").filter(Boolean);
        return SpeechMenu.#expandRegexSource(element.getAttribute("speech-pattern") || "").some(phrase => {
            if (!SpeechMenu.#phraseCanContinue(transcript, phrase)) return false;
            const prefix = SpeechMenu.#normalizeTranscript(phrase).split(/\s+/).filter(Boolean);
            const parameter = prefix.findIndex(token => /^<[^>]+>$/.test(token));
            const literal = parameter < 0 ? prefix : prefix.slice(0, parameter);
            return literal.length > 0 && words[0] === literal[0] && words.slice(0, literal.length).every((word, index) =>
                literal[index] === word || (index === words.length - 1 && literal[index]?.startsWith(word)));
        });
    }

    static #digestCanContinue(element, segment, candidates) {
        return SpeechMenu.#elementDirectContinuationDepth(element, segment) !== undefined ||
            candidates.some(other => other !== element &&
                SpeechMenu.#elementDirectContinuationDepth(other, segment) !== undefined);
    }

    static async #planDigest(candidates, words, utterance, signal, depth = 0, memo = new Map(), projectedContext = utterance.digestContext, projectedFrames = utterance.digestSurfaceStack, optimistic = false) {
        if (signal?.aborted || !words.length) return undefined;
        memo.elementIds ??= new Map(SpeechMenu.#index().elements()
            .map((element, index) => [element, index]));
        memo.contexts ??= new Map();
        memo.probes ??= new Map();
        memo.surfaces ??= new Map();
        if (projectedFrames) for (const frame of projectedFrames) {
            if (!memo.surfaces.has(frame.surface)) memo.surfaces.set(frame.surface, memo.surfaces.size);
        }
        const scopeKey = projectedFrames?.map(frame => memo.surfaces.get(frame.surface) + ':' + (frame.context || '')).join('/') ?? 'actual';
        const key = scopeKey + ":" + String(projectedContext || "") + ":" +
            candidates.map(element => memo.elementIds.get(element)).join(",") + ":" + words.join(" ");
        if (memo.has(key)) return memo.get(key);
        let best;
        // A longer command owns its words before shorter commands can split them.
        const select = plan => {
            if (!plan) return;
            const score = candidate => (candidate.invalid || (utterance.digestIsFinal && candidate.pending) ? 0 : 1000000) +
                (candidate.steps[0]?.segmentTranscript.split(" ").length || 0) * 10000 + (candidate.pending ? 4000 : 0) +
                (candidate.exact ? 2000 : 0) + candidate.consumedWords;
            if (!best || score(plan) > score(best)) best = plan;
        };
        const indexed = SpeechMenu.#indexedMatching ? SpeechMenu.#index().candidates(words, new Set(candidates)) : undefined;
        for (const element of candidates) {
            if (indexed && !indexed.has(element)) continue;
            if (signal?.aborted) return undefined;
            const full = words.join(" ");
            const partialDepth = SpeechMenu.#elementDirectContinuationDepth(element, full);
            if (partialDepth !== undefined) select({steps: [], exact: false, continuation: true,
                terminal: false, pending: {element, transcript: full,
                    hasCommandPrefix: SpeechMenu.#hasExplicitCommandPrefix(element, full)}, consumedWords: 0,
                remainder: full, depth: partialDepth});
            if (!memo.probes.has(element)) memo.probes.set(element, new Map());
            const probes = memo.probes.get(element);
            const probeSegment = segment => {
                if (!probes.has(segment)) probes.set(segment,
                    SpeechMenu.#probeChainElement(element, segment, utterance, signal));
                return probes.get(segment);
            };
            const collector = await SpeechMenu.#collectSpeechSequence(element, words, utterance, signal, probeSegment);
            for (let end = 1; end <= words.length; end++) {
                if (collector && end !== collector.accepted?.end) continue;
                const segment = words.slice(0, end).join(" ");
                const probe = await probeSegment(segment);
                if (!probe || signal?.aborted) continue;
                const declaredContext = SpeechMenu.#chainNextContext(element);
                const transition = element.getAttribute('speech-chain-surface');
                let frames = projectedFrames?.map(frame => ({...frame}));
                if (transition || declaredContext) {
                    frames ??= SpeechMenu.#surfaceFrames();
                    if (transition === 'pop' || transition === 'close') frames.pop();
                    else if (transition) {
                        let surface;
                        try {surface = document.querySelector(transition);} catch {}
                        if (surface && frames.at(-1)?.surface !== surface) frames.push({surface, context: declaredContext});
                    }
                    if (declaredContext) {
                        const surface = SpeechMenu.#chainContextCandidates(declaredContext)[0]?.closest('dialog, [popover], [speech-scope]');
                        if (surface && frames.at(-1)?.surface !== surface) frames.push({surface, context: declaredContext});
                        else if (frames.length) frames.at(-1).context = declaredContext;
                    }
                }
                const context = frames === undefined ? declaredContext : frames.at(-1)?.context;
                const nextSurface = frames?.at(-1)?.surface;
                if (nextSurface && !memo.surfaces.has(nextSurface)) memo.surfaces.set(nextSurface, memo.surfaces.size);
                const contextKey = String(context || '') + ':' + (nextSurface ? memo.surfaces.get(nextSurface) : frames ? 'page' : 'actual');
                if (!memo.contexts.has(contextKey)) memo.contexts.set(contextKey, optimistic ? SpeechMenu.#stateAttemptCandidates(context, frames) : SpeechMenu.#digestCandidates(context, frames));
                const next = memo.contexts.get(contextKey);
                const step = {...probe, segmentTranscript: segment, optimistic,
                    nextContext: context, nextSurfaceStack: frames, context: projectedContext,
                    surfaceStack: projectedFrames,
                    surface: projectedFrames?.at(-1)?.surface,
                    canContinue: SpeechMenu.#isOpenEndedParameter(element) || SpeechMenu.#digestCanContinue(element, segment, candidates)};
                const remaining = words.slice(end);
                if (remaining.length) {
                    const tail = await SpeechMenu.#planDigest(next, remaining, utterance, signal, depth + 1, memo, context, frames, optimistic);
                    if (tail) select({...tail, steps: [step, ...tail.steps], consumedWords: end + tail.consumedWords});
                    else select({steps: [step], exact: false, continuation: false, terminal: false,
                        invalid: true, consumedWords: end, remainder: remaining.join(" ")});
                } else {
                    const future = context ? SpeechMenu.#chainContextCandidates(context) : [];
                    select({steps: [step], exact: true, continuation: future.length > 0 || step.canContinue,
                        terminal: future.length === 0 && !step.canContinue, consumedWords: end, remainder: ""});
                }
            }
        }
        memo.set(key, best);
        return best;
    }

    static async #planCommandChain(utterance, transcript, signal) {
        utterance.valueCollectors?.clear();
        const normalized = SpeechMenu.#normalizeTranscript(transcript);
        const words = normalized.split(" ").filter(Boolean);
        if (!words.length) return undefined;
        let best;
        let offset = 0;
        let headViable = false;
        // Search beyond a free-form collector at the head. During voice login,
        // for example, the spoken prompt can be transcribed as leading noise;
        // a collector must not absorb that noise and hide the following digits.
        // Keep the collector as a fallback if no more specific tail command fits.
        for (let attempt = 0; attempt < 2; attempt++) {
            SpeechMenu.#index().flush();
            const generation = SpeechMenu.#index().generation;
            best = undefined;
            offset = 0;
            headViable = false;
            let collectorFallback;
            for (let start = 0; start < words.length; start++) {
                const candidate = await SpeechMenu.#planDigest(
                    SpeechMenu.#digestCandidates(utterance.digestContext, utterance.digestSurfaceStack),
                    words.slice(start), utterance, signal);
                if (signal?.aborted) return undefined;
                if (!candidate || (!candidate.steps.length && !candidate.pending)) continue;
                if (start === 0) headViable = true;
                const firstStep = candidate.steps[0];
                const collector = firstStep && (
                    firstStep.commandElement.hasAttribute("speech-collect") ||
                    firstStep.commandElement.hasAttribute("speech-open-ended"));
                // A collector is only a fallback when it stands alone. Keep
                // scanning every offset (including the last word): a one-word
                // collector match must not preempt a longer valid value later
                // in the transcript, such as the four digits after an announcement.
                if (collector && candidate.steps.length === 1 && !candidate.pending) {
                    const score = candidate.consumedWords;
                    const priorScore = collectorFallback?.candidate.consumedWords ?? -1;
                    if (score > priorScore || (score === priorScore && start < collectorFallback.offset)) {
                        collectorFallback = {candidate, offset: start};
                    }
                    continue;
                }
                best = candidate;
                offset = start;
                break;
            }
            if (!best && collectorFallback) {
                best = collectorFallback.candidate;
                offset = collectorFallback.offset;
            }
            SpeechMenu.#index().flush();
            if (generation === SpeechMenu.#index().generation) break;
            best = undefined;
            offset = 0;
            utterance.valueCollectors?.clear();
        }
        // Invalid-state commands remain lower priority, but can also begin
        // after leading recognition noise.
        if ((!best || best.invalid) && SpeechMenu.#executionEnabled && globalThis.WMOFStateTransactions) {
            for (let start = 0; start < words.length; start++) {
                const attempted = await SpeechMenu.#planDigest(
                    SpeechMenu.#stateAttemptCandidates(utterance.digestContext, utterance.digestSurfaceStack),
                    words.slice(start), utterance, signal, 0, new Map(),
                    utterance.digestContext, utterance.digestSurfaceStack, true);
                if (signal?.aborted) return undefined;
                if (attempted?.exact) { best = attempted; offset = start; break; }
            }
        }
        if (!best || (!best.steps.length && !utterance.chainActive)) return undefined;
        const root = best.steps[0] || best.pending;
        return {kind: "chain", utteranceId: utterance.id,
            commandElement: root?.commandElement || root?.element,
            speechMenuElement: root?.speechMenuElement,
            transcript: words.slice(offset).join(" "),
            ignoredPrefix: words.slice(0, offset).join(" "),
            exact: Boolean(best.exact), continuation: Boolean(best.continuation),
            system: false, depth: best.depth ?? Number.MAX_SAFE_INTEGER, order: -1,
            chain: best.steps, pending: best.pending, headViable, terminal: Boolean(best.terminal),
            invalid: Boolean(best.invalid), remainder: best.remainder || ""};
    }

        static async #refreshCandidatePool(
        utterance,
        transcript,
        signal
    ) {
        SpeechMenu.extrapolatePhrases();

        const chain =
            await SpeechMenu
                .#planCommandChain(
                    utterance,
                    transcript,
                    signal
                );

        if (
            chain &&
            !signal?.aborted
        ) {
            return [
                chain
            ];
        }

        const previous =
            utterance.candidatePool ||
            [];

        const previousElements =
            new Set(
                previous
                    .map(
                        candidate =>
                            candidate
                                .commandElement
                    )
                    .filter(Boolean)
            );

        const all =
            SpeechMenu
                .#availableCandidates();

        const source =
            previousElements.size
                ? all.filter(
                    element =>
                        previousElements
                            .has(element)
                )
                : all;

        const evaluated =
            await Promise.all(
                source.map(
                    async (
                        element,
                        order
                    ) => {
                        if (signal?.aborted) {
                            return false;
                        }

                        const continuationDepth =
                            SpeechMenu
                                .#elementContinuationDepth(
                                    element,
                                    transcript
                                );

                        const speechMenuElement =
                            SpeechMenu
                                .#candidateMenu(
                                    element
                                );

                        const exact =
                            await SpeechMenu
                                .#processElement(
                                    element,
                                    transcript,
                                    utterance.id,
                                    speechMenuElement,
                                    false,
                                    signal
                                );

                        if (signal?.aborted) {
                            return false;
                        }

                        const openEnded = SpeechMenu.#isOpenEndedParameter(element);

                        const previousOpenEndedExact =
                            openEnded &&
                            utterance
                                .lastExactCandidate
                                ?.commandElement ===
                                    element &&
                            String(
                                transcript ||
                                ""
                            )
                                .toLocaleLowerCase()
                                .startsWith(
                                    String(
                                        utterance
                                            .lastExactCandidate
                                            ?.transcript ||
                                        ""
                                    )
                                        .toLocaleLowerCase()
                                        .trim() +
                                    " "
                                );

                        const continuation =
                            continuationDepth !==
                                undefined ||
                            (
                                openEnded &&
                                (
                                    Boolean(
                                        exact
                                    ) ||
                                    previousOpenEndedExact
                                )
                            );

                        if (
                            !exact &&
                            !continuation
                        ) {
                            return false;
                        }

                        return {
                            kind: "command",
                            utteranceId:
                                utterance.id,
                            commandElement:
                                element,
                            speechMenuElement,
                            transcript,
                            exact:
                                Boolean(exact),
                            continuation,
                            system:
                                SpeechMenu
                                    .#effectiveModal(
                                        element
                                    ) ===
                                    "system",
                            depth:
                                continuationDepth ??
                                (
                                    openEnded &&
                                    continuation
                                        ? 1
                                        : Number.MAX_SAFE_INTEGER
                                ),
                            order
                        };
                    }
                )
            );

        if (signal?.aborted) {
            return [];
        }

        let next =
            evaluated
                .filter(Boolean)
                .sort(
                    (left, right) => {
                        const leftSystemExact =
                            left.system &&
                            left.exact
                                ? 1
                                : 0;
                        const rightSystemExact =
                            right.system &&
                            right.exact
                                ? 1
                                : 0;

                        return (
                            rightSystemExact -
                                leftSystemExact ||
                            left.depth -
                                right.depth ||
                            left.order -
                                right.order
                        );
                    }
                );

        /*
         * The candidate pool behaves like a queue.  Newer words
         * make shorter/front candidates ineligible, so discard
         * those first before considering the longer continuations.
         */
        while (
            next.length > 1 &&
            !next[0].exact &&
            !next[0].continuation
        ) {
            next.shift();
        }

        /*
         * Recognition engines can revise earlier words.  If pruning
         * an existing queue leaves nothing, reseed from every
         * currently available speech candidate for the new revision.
         */
        if (
            !next.length &&
            previousElements.size &&
            !signal?.aborted
        ) {
            utterance.candidatePool = [];

            return SpeechMenu
                .#refreshCandidatePool(
                    utterance,
                    transcript,
                    signal
                );
        }

        return next;
    }

    static async #processTranscript(
        text,
        utteranceId,
        execute = true
    ) {
        SpeechMenu.extrapolatePhrases();

        for (
            const element of
            SpeechMenu.#availableCandidates()
        ) {
            const result =
                await SpeechMenu
                    .#processElement(
                        element,
                        text,
                        utteranceId,
                        SpeechMenu
                            .#candidateMenu(
                                element
                            ),
                        SpeechMenu
                            .#shouldExecuteElement(
                                element,
                                execute
                            )
                    );

            if (result) {
                return result;
            }
        }

        return false;
    }

    static #candidateMenu(element) {
        return (
            element.closest(
                "speech-menu"
            ) ||
            element.closest(
                "dialog, details, [popover]"
            ) ||
            undefined
        );
    }

    static #normalizeModal(value) {
        if (value === "system") {
            return "system";
        }

        if (value === "top-level") {
            return "top-level";
        }

        if (
            value === "default" ||
            value === ""
        ) {
            return "default";
        }

        return undefined;
    }

    static #shouldExecuteElement(
        element,
        requested =
            SpeechMenu.#executionEnabled
    ) {
        return Boolean(
            requested ||
            (
                SpeechMenu
                    .#systemExecutionPassthrough &&
                !['SpeechMenu.close', 'SpeechMenu.cancel'].includes(element.getAttribute('speech-function')) &&
                SpeechMenu
                    .#effectiveModal(
                        element
                    ) ===
                    "system"
            )
        );
    }

    static #effectiveModal(element) {
        if (['SpeechMenu.close', 'SpeechMenu.cancel'].includes(element.getAttribute('speech-function'))) return 'system';
        if (
            element.hasAttribute(
                "speech-modal"
            )
        ) {
            return SpeechMenu
                .#normalizeModal(
                    element.getAttribute(
                        "speech-modal"
                    )
                );
        }

        const menu =
            element.closest(
                "speech-menu"
            );

        if (
            menu?.hasAttribute(
                "speech-modal"
            )
        ) {
            return SpeechMenu
                .#normalizeModal(
                    menu.getAttribute(
                        "speech-modal"
                    )
                );
        }

        return undefined;
    }

    static #openPopover(element) {
        try {
            return element.matches(
                ":popover-open"
            );
        }
        catch {
            return false;
        }
    }

    static #speechIndex(
        element
    ) {
        if (!element) return 0;

        const value =
            Number(
                element.getAttribute(
                    "speech-index"
                )
            );

        return Number.isFinite(value)
            ? value
            : 0;
    }

    static #candidatePriority(
        element
    ) {
        return {
            menu:
                SpeechMenu
                    .#speechIndex(
                        element.closest(
                            "speech-menu"
                        )
                    ),
            command:
                SpeechMenu
                    .#speechIndex(
                        element
                    )
        };
    }

    static #sortCandidates(
        elements
    ) {
        return elements
            .map(
                (element, order) => ({
                    element,
                    order,
                    priority:
                        SpeechMenu
                            .#candidatePriority(
                                element
                            )
                })
            )
            .sort(
                (left, right) =>
                    right.priority.menu -
                        left.priority.menu ||
                    right.priority.command -
                        left.priority.command ||
                    left.order -
                        right.order
            )
            .map(
                item =>
                    item.element
            );
    }

    static #targetIsAvailable(
        target
    ) {
        if (!(target instanceof Element)) {
            return false;
        }

        if (
            target.matches?.(
                "[hidden], [inert], [aria-hidden='true'], :disabled"
            )
        ) {
            return false;
        }

        if (
            target.closest?.(
                "[hidden], [inert], [aria-hidden='true']"
            )
        ) {
            return false;
        }

        const details =
            target.closest?.(
                "details"
            );

        if (
            details &&
            !details.open
        ) {
            return false;
        }

        const popover =
            target.closest?.(
                "[popover]"
            );

        if (
            popover &&
            !SpeechMenu
                .#openPopover(
                    popover
                )
        ) {
            return false;
        }

        for (
            let current = target;
            current &&
                current !==
                    document.documentElement;
            current =
                current.parentElement
        ) {
            const dialog =
                current.matches?.("dialog")
                    ? current
                    : undefined;

            if (
                dialog &&
                !dialog.open
            ) {
                return false;
            }

            try {
                const style =
                    getComputedStyle(
                        current
                    );

                if (
                    style.display ===
                        "none" ||
                    style.visibility ===
                        "hidden" ||
                    style.visibility ===
                        "collapse"
                ) {
                    return false;
                }
            }
            catch {}
        }

        return true;
    }

    static #candidateStateAvailable(
        element,
        projected = false
    ) {
        const primed = projected || SpeechMenu.#isPrimed(element);
        if (
            !element || !element.isConnected ||
            (!primed && element.hasAttribute(
                "hidden"
            )) ||
            element.hasAttribute(
                "disabled"
            ) ||
            (!primed && element.hasAttribute(
                "inert"
            )) ||
            (!primed && element.getAttribute(
                "aria-hidden"
            ) === "true")
        ) {
            return false;
        }

        const authorization = element.getAttribute("speech-authorized");
        if (authorization) {
            const resolved = SpeechMenu.#resolve(authorization);
            try {
                if (!resolved || resolved.fn.call(resolved.owner, element) !== true) return false;
            } catch { return false; }
        }
        // Projected contexts bypass UI readiness, never disabled/authorization.
        if (primed) {
            const targets = SpeechMenu.#resolveSpeechTarget(element).elements;
            // A command with semantic availability uses the shared state;
            // its representative pointer target may intentionally be disabled.
            if (!element.hasAttribute("speech-available") && targets.length &&
                targets.every(target => target.matches?.(":disabled, [disabled]"))) return false;
            return true;
        }

        if (
            element.dataset
                ?.speechIntent ===
                "confirm"
        ) {
            const context =
                element.closest(
                    "dialog, [popover], details"
                ) ||
                element.parentElement;

            const okAllowed =
                context?.allowOk !==
                    false;

            if (!okAllowed) {
                return false;
            }
        }

        const availability =
            element.getAttribute(
                "speech-available"
            );

        if (availability) {
            const resolved =
                SpeechMenu.#resolve(
                    availability
                );

            if (!resolved) {
                return false;
            }

            try {
                if (
                    resolved.fn.call(
                        resolved.owner,
                        element
                    ) !== true
                ) {
                    return false;
                }
            }
            catch {
                return false;
            }

            /*
             * An explicit semantic availability function is authoritative.
             * data-speech-target remains useful for training and response
             * presentation, but it must not veto a command whose semantic
             * runtime state says it is available.
             */
            return true;
        }

        /*
         * Confirm/cancel targets are retained as command metadata for
         * training and response presentation.  Their runtime scope comes
         * from the active speech context instead: confirm is gated above by
         * allowOk.  A shared training target must not make a contextual
         * OK/Cancel command unavailable merely because that representative
         * target is on another surface.
         */
        const intent =
            element.dataset
                ?.speechIntent;

        if (
            intent === "confirm" ||
            intent === "cancel"
        ) {
            return true;
        }

        const target =
            SpeechMenu
                .#resolveSpeechTarget(
                    element
                );

        if (!target.selector) {
            return true;
        }

        return target.elements
            .some(
                SpeechMenu
                    .#targetIsAvailable
            );
    }

    static #availableCandidates(projectedSurface) {
        const previous = SpeechMenu.#selectionState;
        SpeechMenu.#selectionState = previous || globalThis.WMOFInteractionState?.state;
        try {return SpeechMenu.#selectAvailableCandidates(projectedSurface);}
        finally {SpeechMenu.#selectionState = previous;}
    }

    static #selectAvailableCandidates(projectedSurface) {
        const dialog = projectedSurface === undefined
            ? (SpeechMenu.activeSurface !== document.body ? SpeechMenu.activeSurface : undefined) || [...document.querySelectorAll("dialog[open]")].at(-1)
            : projectedSurface;
        const openContainers = dialog ? [] : [
            ...document.querySelectorAll("details[open]"),
            ...[...document.querySelectorAll("[popover], [speech-scope]")].filter(SpeechMenu.#openPopover)
        ];
        const all = SpeechMenu.#index().activeElements(dialog, openContainers);

        const system = [];
        const topLevel = [];
        const defaults = [];
        const contextual = [];
        const primed = [];

        for (const element of all) {
            if (
                !SpeechMenu
                    .#candidateStateAvailable(
                        element, projectedSurface !== undefined
                    )
            ) {
                continue;
            }

            if (SpeechMenu.#isPrimed(element)) {
                primed.push(element);
                continue;
            }

            const modal =
                SpeechMenu
                    .#effectiveModal(
                        element
                    );

            if (modal === "system") {
                system.push(element);
            }
            else if (modal === "top-level") {
                topLevel.push(element);
            }
            else if (modal === "default") {
                defaults.push(element);
            }
            else {
                contextual.push(element);
            }
        }

        const result = [];
        const seen = new Set();
        const append =
            elements => {
                for (
                    const element of
                    SpeechMenu
                        .#sortCandidates(
                            elements
                        )
                ) {
                    if (seen.has(element)) {
                        continue;
                    }

                    seen.add(element);
                    result.push(element);
                }
            };

        if (SpeechMenu.#sleeping) {
            append(
                system.filter(
                    element =>
                        element.dataset
                            ?.speechSystemCommand ===
                            "wake" ||
                        element.getAttribute(
                            "speech-function"
                        ) ===
                            "SpeechMenu.wake"
                )
            );

            return result;
        }

        append(system);
        append(topLevel);

        if (dialog) {
            append(
                contextual.filter(
                    element =>
                        dialog.contains(
                            element
                        )
                )
            );

            append(defaults);
            append(primed);
            return result;
        }

        append(defaults);
        append(primed);

        for (const container of openContainers) {
            append(
                contextual.filter(
                    element =>
                        container.contains(
                            element
                        )
                )
            );
        }

        append(
            contextual.filter(
                element => {
                    if (
                        element.closest(
                            "dialog"
                        )
                    ) {
                        return false;
                    }

                    if (
                        element.closest(
                            "details"
                        )
                    ) {
                        return false;
                    }

                    if (
                        element.closest(
                            "[popover], [speech-scope]"
                        )
                    ) {
                        return false;
                    }

                    return true;
                }
            )
        );

        return result;
    }

    static #stripRegexAnchors(
        source
    ) {
        let text =
            String(source || "")
                .trim();

        if (text.startsWith("^")) {
            text = text.slice(1);
        }

        if (
            text.endsWith("$") &&
            !text.endsWith("\\$")
        ) {
            text = text.slice(0, -1);
        }

        return text;
    }

    static #splitPhraseExclusions(
        source
    ) {
        const text =
            String(source || "")
                .trim();

        const prefix =
            "^(?!(?:";
        const marker =
            ")$)(?:";
        const suffix =
            ")$";

        if (
            text.startsWith(prefix) &&
            text.endsWith(suffix)
        ) {
            const markerIndex =
                text.indexOf(
                    marker,
                    prefix.length
                );

            if (markerIndex >= 0) {
                const raw =
                    text.slice(
                        prefix.length,
                        markerIndex
                    );

                const exclusions = [];
                let current = "";

                for (
                    let index = 0;
                    index < raw.length;
                    index++
                ) {
                    const character =
                        raw[index];

                    if (
                        character === "\\" &&
                        index + 1 <
                            raw.length
                    ) {
                        current +=
                            character +
                            raw[++index];
                        continue;
                    }

                    if (character === "|") {
                        exclusions.push(
                            current
                        );
                        current = "";
                        continue;
                    }

                    current +=
                        character;
                }

                if (current) {
                    exclusions.push(
                        current
                    );
                }

                return {
                    base:
                        text.slice(
                            markerIndex +
                                marker.length,
                            -suffix.length
                        ),
                    exclusions:
                        exclusions.filter(
                            Boolean
                        )
                };
            }
        }

        return {
            base:
                SpeechMenu
                    .#stripRegexAnchors(
                        text
                    ),
            exclusions: []
        };
    }

    static #phraseExclusionSource(
        phrase
    ) {
        const text =
            String(phrase || "")
                .trim();

        if (!text) return "";

        const escape =
            value =>
                value.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );

        let result = "";
        let offset = 0;
        const slots =
            /<([A-Za-z_$][\w$]*)>/g;

        for (
            let match;
            (
                match =
                    slots.exec(text)
            );
        ) {
            result +=
                escape(
                    text.slice(
                        offset,
                        match.index
                    )
                );

            result += ".+";
            offset =
                match.index +
                match[0].length;
        }

        result +=
            escape(
                text.slice(
                    offset
                )
            );

        return result;
    }

    static #expandRegexSource(
        source,
        limit = 128
    ) {
        if (typeof source !== "string") {
            return [];
        }

        const exclusionParts =
            SpeechMenu
                .#splitPhraseExclusions(
                    source
                );

        let text =
            exclusionParts.base;

        let exclusionRegex;

        if (
            exclusionParts
                .exclusions
                .length
        ) {
            try {
                exclusionRegex =
                    new RegExp(
                        "^(?:" +
                        exclusionParts
                            .exclusions
                            .join("|") +
                        ")$",
                        "i"
                    );
            }
            catch {}
        }

        let index = 0;

        const combine =
            (left, right) => {
                const output = [];

                for (const a of left) {
                    for (const b of right) {
                        output.push(a + b);

                        if (
                            output.length >=
                            limit
                        ) {
                            return output;
                        }
                    }
                }

                return output;
            };

        const placeholder =
            slotName =>
                "<" +
                (slotName || "value") +
                ">";

        const parseExpression =
            (
                stopCharacter,
                slotName
            ) => {
                const alternatives = [];
                let sequence = [""];

                while (index < text.length) {
                    const character =
                        text[index];

                    if (
                        stopCharacter &&
                        character ===
                            stopCharacter
                    ) {
                        break;
                    }

                    if (character === "|") {
                        alternatives.push(
                            ...sequence
                        );
                        sequence = [""];
                        index++;
                        continue;
                    }

                    let atom;

                    if (character === "(") {
                        index++;

                        let name;

                        if (
                            text.slice(
                                index,
                                index + 2
                            ) === "?:"
                        ) {
                            index += 2;
                        }
                        else if (
                            text.slice(
                                index,
                                index + 2
                            ) === "?<"
                        ) {
                            const close =
                                text.indexOf(
                                    ">",
                                    index + 2
                                );

                            if (close > index) {
                                name =
                                    text.slice(
                                        index + 2,
                                        close
                                    );
                                index =
                                    close + 1;
                            }
                        }

                        atom =
                            parseExpression(
                                ")",
                                name ||
                                    slotName
                            );

                        if (
                            text[index] ===
                            ")"
                        ) {
                            index++;
                        }
                    }
                    else if (
                        character === "["
                    ) {
                        const close =
                            text.indexOf(
                                "]",
                                index + 1
                            );

                        if (close < 0) {
                            atom = [
                                placeholder(
                                    slotName
                                )
                            ];
                            index++;
                        }
                        else {
                            const body =
                                text.slice(
                                    index + 1,
                                    close
                                );

                            atom =
                                /^[A-Za-z0-9]+$/
                                    .test(body)
                                    ? [...body]
                                    : [
                                        placeholder(
                                            slotName
                                        )
                                    ];

                            index =
                                close + 1;
                        }
                    }
                    else if (
                        character === "\\"
                    ) {
                        const escaped =
                            text[index + 1];

                        if (!escaped) {
                            atom = ["\\"];
                            index++;
                        }
                        else {
                            atom = [
                                escaped === "s"
                                    ? " "
                                    : escaped
                            ];
                            index += 2;
                        }
                    }
                    else if (
                        character === "."
                    ) {
                        atom = [
                            placeholder(
                                slotName
                            )
                        ];
                        index++;
                    }
                    else {
                        atom = [character];
                        index++;
                    }

                    const quantifier =
                        text[index];

                    if (quantifier === "?") {
                        atom = [
                            "",
                            ...atom
                        ];
                        index++;
                    }
                    else if (
                        quantifier === "+" ||
                        quantifier === "*"
                    ) {
                        index++;
                    }
                    else if (
                        quantifier === "{"
                    ) {
                        const close =
                            text.indexOf(
                                "}",
                                index + 1
                            );

                        if (close >= 0) {
                            index =
                                close + 1;
                        }
                    }

                    sequence =
                        combine(
                            sequence,
                            atom
                        );

                    if (
                        sequence.length >=
                        limit
                    ) {
                        break;
                    }
                }

                alternatives.push(
                    ...sequence
                );

                return [
                    ...new Set(
                        alternatives
                    )
                ].slice(0, limit);
            };

        return parseExpression()
            .map(
                phrase =>
                    phrase
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim()
            )
            .filter(Boolean)
            .filter(
                phrase =>
                    !exclusionRegex ||
                    !exclusionRegex
                        .test(
                            phrase
                        )
            )
            .filter(
                (
                    phrase,
                    phraseIndex,
                    phrases
                ) =>
                    phrases.indexOf(
                        phrase
                    ) ===
                    phraseIndex
            )
            .slice(0, limit);
    }

    static #canonicalMatchTranscript(
        element,
        text,
        groups,
        matchingMode
    ) {
        if (
            matchingMode !==
                "compact"
        ) {
            return text;
        }

        const values =
            groups &&
            typeof groups ===
                "object"
                ? groups
                : {};

        const compact =
            SpeechMenu
                .#compactTranscript(
                    text
                );

        for (
            const phrase of
            SpeechMenu
                .#expandRegexSource(
                    element
                        .getAttribute(
                            "speech-pattern"
                        ) ||
                    ""
                )
        ) {
            const candidate =
                SpeechMenu
                    .#normalizeTranscript(
                        String(
                            phrase ||
                            ""
                        )
                            .replace(
                                /<([A-Za-z_$][\w$]*)>/g,
                                (
                                    token,
                                    name
                                ) =>
                                    values[
                                        name
                                    ] ??
                                    token
                            )
                    );

            if (
                /<[^>]+>/.test(
                    candidate
                )
            ) {
                continue;
            }

            if (
                SpeechMenu
                    .#compactTranscript(
                        candidate
                    ) ===
                    compact
            ) {
                return candidate;
            }
        }

        return text;
    }

    static #prepare(
        element,
        force = false
    ) {
        const source =
            element.getAttribute(
                "speech-pattern"
            );

        if (!source) return false;

        if (
            force ||
            element.speechPatternSource !==
                source
        ) {
            try {
                element.speechPattern =
                    new RegExp(
                        source,
                        "gi"
                    );

                element.speechCompactPattern =
                    new RegExp(
                        SpeechMenu
                            .#whitespaceTolerantSource(
                                source
                            ),
                        "gi"
                    );

                element.speechPatternSource =
                    source;
            }
            catch {
                SpeechMenu.#emit(
                    "speechMenuPatternInvalid",
                    {
                        speechMenuElement:
                            element,
                        component:
                            "speech-pattern",
                        message:
                            "Invalid speech-pattern regular expression."
                    }
                );

                return false;
            }
        }

        const speechFunction =
            element.getAttribute(
                "speech-function"
            );

        const target =
            SpeechMenu.#resolve(
                speechFunction
            );

        if (!target) {
            SpeechMenu.#emit(
                "speechMenuFunctionNotFound",
                {
                    speechMenuElement:
                        element,
                    component:
                        "speech-function",
                    functionName:
                        element.getAttribute(
                            "speech-function"
                        ),
                    message:
                        "The speech function was not found."
                }
            );

            return false;
        }

        element.speechFunc =
            target.fn;

        element.speechFuncThis =
            target.owner;

        element.speechParameterFunc =
            target.fn;

        const actionName =
            speechFunction
                .match(
                    /^WMOFActions\.([A-Za-z_$][\w$]*)$/
                )
                ?.[1];

        if (actionName) {
            const implementation =
                globalThis
                    .WMOFActionFunctions
                    ?.getImplementation?.(
                        actionName
                    );

            if (
                typeof implementation ===
                    "function"
            ) {
                element.speechParameterFunc =
                    implementation;
            }
        }

        const preprocNames = (element.getAttribute("speech-preproc") || "")
            .split(",").map(name => name.trim()).filter(Boolean);
        if (!preprocNames.length) {
            delete element.speechPreprocFunc;
            delete element.speechPreprocFuncs;
            return true;
        }
        const preprocessors = [];
        for (const preprocName of preprocNames) {
            const preproc = SpeechMenu.#resolve(preprocName);
            if (!preproc) {
                delete element.speechPreprocFunc;
                delete element.speechPreprocFuncs;
                SpeechMenu.#emit("speechMenuFunctionNotFound", {
                    speechMenuElement: element, component: "speech-preproc",
                    functionName: preprocName, message: "The speech preprocessor was not found."
                });
                return false;
            }
            preprocessors.push(preproc.fn.bind(preproc.owner));
        }
        element.speechPreprocFuncs = preprocessors;
        element.speechPreprocFunc = async (text, context) => {
            if (typeof text !== "string") {
                throw new TypeError(
                    "Speech preprocessing input must be a string."
                );
            }

            for (const preprocessor of preprocessors) {
                // Do not run later stages when this recognition attempt is obsolete.
                if (context?.signal?.aborted) {
                    return text;
                }

                const result = await preprocessor(text, context);

                if (context?.signal?.aborted) {
                    return text;
                }

                // A preprocessor may explicitly reject a provisional
                // candidate with false. Stop the chain; #processElement treats
                // that sentinel as a rejected candidate. Successful transforms
                // must always remain strings.
                if (result === false) {
                    return false;
                }

                if (typeof result !== "string") {
                    throw new TypeError(
                        "Each speech preprocessor must return a string or false to reject a candidate."
                    );
                }

                // Each stage transforms the input for the next stage.
                text = result;
            }

            return text;
        };
        return true;
    }

    static #resolve(source) {
        if (
            typeof source !== "string" ||
            !source.trim()
        ) {
            return undefined;
        }

        const path =
            source
                .trim()
                .replace(
                    /\[['"]([A-Za-z_$][\w$]*)['"]\]/g,
                    ".$1"
                )
                .replace(
                    /\[([A-Za-z_$][\w$]*)\]/g,
                    ".$1"
                )
                .split(".");

        if (
            !path.every(
                part =>
                    /^[A-Za-z_$][\w$]*$/
                        .test(part)
            )
        ) {
            return undefined;
        }

        let owner =
            window;

        for (
            let index = 0;
            index < path.length - 1;
            index++
        ) {
            owner =
                owner?.[
                    path[index]
                ];

            if (owner == null) {
                return undefined;
            }
        }

        const fn =
            owner?.[
                path.at(-1)
            ];

        return typeof fn === "function"
            ? {fn, owner}
            : undefined;
    }

    static #resolveSpeechTarget(
        element
    ) {
        const selector =
            element.getAttribute(
                "data-speech-target"
            );

        if (!selector) {
            return {
                selector:
                    undefined,
                element:
                    undefined,
                elements: []
            };
        }

        try {
            const elements =
                [
                    ...document
                        .querySelectorAll(
                            selector
                        )
                ];

            return {
                selector,
                element:
                    elements[0] ||
                    undefined,
                elements
            };
        }
        catch {
            return {
                selector,
                element:
                    undefined,
                elements: []
            };
        }
    }

    static async #completeSpeechExecution(
        {
            element,
            speechMenuElement,
            utteranceId,
            transcript,
            canonicalTranscript,
            argumentValues,
            target,
            responseSession,
            outcomeValue,
            executionStartedAt
        }
    ) {
        try {
            const outcome =
                await outcomeValue;

            if (outcome === false) {
                globalThis
                    .WMOFPresentationSetters
                    ?.cancelSpeechResponse?.(
                        responseSession
                    );

                SpeechMenu.#emit(
                    "speechCommandRejected",
                    {
                        utteranceId,
                        commandElement:
                            element,
                        speechMenuElement,
                        transcript,
                        canonicalTranscript
                    }
                );

                return false;
            }

            const dictatedResponse =
                outcome &&
                typeof outcome ===
                    "object" &&
                outcome.speechResponse
                    ?.type ===
                    "dictation"
                    ? outcome
                        .speechResponse
                    : undefined;
            const dictatedText =
                String(
                    dictatedResponse
                        ?.value ??
                    ""
                ).trim();

            if (dictatedText) {
                globalThis
                    .WMOFPresentationSetters
                    ?.cancelSpeechResponse?.(
                        responseSession
                    );

                globalThis
                    .WMOFPresentationSetters
                    ?.presentSpeechDictation?.(
                        dictatedResponse,
                        {
                            commandElement:
                                element,
                            utteranceId
                        }
                    );
            }
            else {
                await Promise.resolve();

                if (
                    target.element &&
                    typeof requestAnimationFrame ===
                        "function"
                ) {
                    await new Promise(
                        resolve =>
                            requestAnimationFrame(
                                () =>
                                    resolve()
                            )
                    );
                }

                globalThis
                    .WMOFPresentationSetters
                    ?.finishSpeechResponse?.(
                        responseSession,
                        {
                            commandElement:
                                element,
                            targetSelector:
                                target.selector,
                            targetElements:
                                target.elements,
                            utteranceId
                        }
                    );
            }

            SpeechMenu.#emit(
                "speechCommandExecuted",
                {
                    utteranceId,
                    utteranceStartedAt:
                        executionStartedAt,
                    commandElement:
                        element,
                    speechMenuElement,
                    transcript,
                    canonicalTranscript,
                    arguments:
                        argumentValues.slice(),
                    targetSelector:
                        target.selector,
                    targetElement:
                        target.element,
                    targetElements:
                        target.elements.slice()
                }
            );

            SpeechMenu.#emit(
                "command",
                {
                    speechMenuElement:
                        element,
                    transcript,
                    canonicalTranscript,
                    utteranceId
                }
            );

            return true;
        }
        catch (error) {
            globalThis
                .WMOFPresentationSetters
                ?.cancelSpeechResponse?.(
                    responseSession
                );

            SpeechMenu.#emit(
                "speechMenuCommandError",
                {
                    speechMenuElement:
                        element,
                    error,
                    utteranceId
                }
            );

            return false;
        }
    }

    static async #processElement(
        element,
        transcript,
        utteranceId,
        speechMenuElement,
        execute = true,
        signal,
        executionStartedAt,
        awaitCompletion = false,
        quietProvisional = false,
        executionMetadata
    ) {
        if (signal?.aborted) {
            return false;
        }

        if (
            !SpeechMenu.#prepare(
                element
            )
        ) {
            return false;
        }

        let text =
            transcript;

        const correction =
            SpeechMenu
                .#applyCorrection(
                    element,
                    text
                );

        if (correction) {
            text =
                correction.corrected;
        }

        let preprocessing;

        try {
            if (
                element.speechPreprocFunc
            ) {
                text = globalThis.WMOFLanguagePack?.preprocess(text,
                    element.getAttribute("data-speech-preproc-definition") || element.getAttribute("data-speech-preproc-id")) ?? text;
                const processed =
                    await Promise.resolve(
                        element.speechPreprocFunc(
                            text,
                            {
                                kind:
                                    element.getAttribute(
                                        "speech-preproc-context"
                                    ),
                                field:
                                    element.getAttribute(
                                        "speech-preproc-field"
                                    ),
                                pattern:
                                    element.getAttribute(
                                        "speech-pattern"
                                    ),
                                provisional:
                                    !execute,
                                signal
                            }
                        )
                    );

                if (signal?.aborted) {
                    return false;
                }

                if (
                    typeof processed !==
                    "string"
                ) {
                    return false;
                }

                if (
                    processed !== text
                ) {
                    let contextChange;

                    let prefixLength = 0;
                    const sharedLength =
                        Math.min(
                            text.length,
                            processed.length
                        );

                    while (
                        prefixLength <
                            sharedLength &&
                        text[
                            prefixLength
                        ] ===
                            processed[
                                prefixLength
                            ]
                    ) {
                        prefixLength++;
                    }

                    let originalSuffix =
                        text.length;
                    let processedSuffix =
                        processed.length;

                    while (
                        originalSuffix >
                            prefixLength &&
                        processedSuffix >
                            prefixLength &&
                        text[
                            originalSuffix -
                                1
                        ] ===
                            processed[
                                processedSuffix -
                                    1
                            ]
                    ) {
                        originalSuffix--;
                        processedSuffix--;
                    }

                    const sourceText =
                        text.slice(
                            prefixLength,
                            originalSuffix
                        );
                    const processedValue =
                        processed.slice(
                            prefixLength,
                            processedSuffix
                        );

                    if (
                        sourceText ||
                        processedValue
                    ) {
                        contextChange = {
                            field:
                                element.getAttribute(
                                    "speech-preproc-field"
                                ) ||
                                undefined,
                            kind:
                                element.getAttribute(
                                    "speech-preproc-context"
                                ) ||
                                undefined,
                            sourceStart:
                                prefixLength,
                            sourceEnd:
                                originalSuffix,
                            sourceText,
                            processedStart:
                                prefixLength,
                            processedEnd:
                                processedSuffix,
                            processedValue
                        };
                    }

                    preprocessing = {
                        utteranceId,
                        commandElement:
                            element,
                        speechMenuElement,
                        originalText:
                            text,
                        processedText:
                            processed,
                        contextChange,
                        provisional:
                            !execute
                    };
                }

                text =
                    processed;
            }
        }
        catch (error) {
            if (
                signal?.aborted ||
                error?.name ===
                    "AbortError"
            ) {
                return false;
            }

            SpeechMenu.#emit(
                "speechMenuCommandError",
                {
                    speechMenuElement:
                        element,
                    error,
                    utteranceId
                }
            );

            return false;
        }

        const args =
            new ParameterParser(
                element.speechParameterFunc ||
                element.speechFunc
            );

        let matched =
            false;

        let matchingMode =
            "normal";

        let matchedGroups =
            {};

        for (
            const candidate of
            [
                {
                    regex:
                        element.speechPattern,
                    mode:
                        "normal"
                },
                {
                    regex:
                        element
                            .speechCompactPattern,
                    mode:
                        "compact"
                }
            ]
        ) {
            const regex =
                candidate.regex;

            if (!regex) continue;

            regex.lastIndex = 0;

            let result;

            while (
                (
                    result =
                        regex.exec(text)
                ) !== null
            ) {
                matched = true;
                matchingMode =
                    candidate.mode;

                const values =
                    result.groups ||
                    {};

                matchedGroups = {
                    ...values
                };

                const named =
                    new Set(
                        Object
                            .values(
                                result.groups ||
                                {}
                            )
                            .filter(
                                value =>
                                    value !==
                                    undefined
                            )
                    );

                for (
                    const [name, value] of
                        Object.entries(
                            values
                        )
                ) {
                    if (!value) continue;

                    if (name === "_") {
                        args.restArguments
                            ?.push(
                                ...SpeechMenu
                                    .#list(
                                        value
                                    )
                            );
                    }
                    else if (
                        name.startsWith(
                            "_"
                        )
                    ) {
                        args.setArgument(
                            name.slice(1),
                            SpeechMenu.#list(
                                value
                            )
                        );
                    }
                    else {
                        args.setArgument(
                            name,
                            value
                        );
                    }
                }

                if (
                    args.restArguments
                ) {
                    for (
                        let index = 1;
                        index <
                            result.length;
                        index++
                    ) {
                        const value =
                            result[
                                index
                            ];

                        if (
                            value &&
                            !named.has(
                                value
                            )
                        ) {
                            args.restArguments
                                .push(
                                    SpeechMenu
                                        .#scalar(
                                            value
                                        )
                                );
                        }
                    }
                }

                if (
                    !result[0].length
                ) {
                    regex.lastIndex++;
                }
            }

            if (matched) {
                break;
            }
        }

        if (!matched) {
            return false;
        }

        const canonicalTranscript =
            SpeechMenu
                .#canonicalMatchTranscript(
                    element,
                    text,
                    matchedGroups,
                    matchingMode
                );

        const matchDetail = {
            utteranceId,
            commandElement:
                element,
            speechMenuElement,
            originalTranscript:
                transcript,
            transcript:
                text,
            canonicalTranscript,
            matchingMode,
            correctionId:
                correction?.correction
                    ?.id ||
                null,
            provisional:
                !execute
        };

        if (
            correction &&
            !quietProvisional
        ) {
            SpeechMenu.#emit(
                "speechCorrectionApplied",
                {
                    utteranceId,
                    commandElement:
                        element,
                    speechMenuElement,
                    correctionId:
                        correction
                            .correction
                            .id,
                    matchType:
                        correction
                            .correction
                            .matchType,
                    observed:
                        correction.original,
                    canonical:
                        correction.corrected
                }
            );
        }

        if (!quietProvisional) {
            SpeechMenu.#emit(
                "speechCommandMatched",
                matchDetail
            );

            if (speechMenuElement) {
                SpeechMenu.#emit(
                    "speechMenuMatched",
                    matchDetail
                );
            }

            if (preprocessing) {
                SpeechMenu.#emit(
                    "speechPreprocessed",
                    preprocessing
                );
            }
        }

        const argumentValues =
            args.argumentArray();

        const target =
            SpeechMenu
                .#resolveSpeechTarget(
                    element
                );

        if (!quietProvisional) {
            SpeechMenu.#emit(
                "speechArgumentsPrepared",
                {
                    utteranceId,
                commandElement:
                    element,
                speechMenuElement,
                transcript:
                    text,
                canonicalTranscript,
                arguments:
                    argumentValues.slice(),
                targetSelector:
                    target.selector,
                targetElement:
                    target.element,
                targetElements:
                    target.elements.slice(),
                    provisional:
                        !execute
                }
            );
        }

        if (!execute) {
            return {
                kind: "command",
                utteranceId,
                commandElement:
                    element,
                speechMenuElement,
                transcript:
                    text,
                canonicalTranscript,
                arguments:
                    argumentValues.slice(),
                targetSelector:
                    target.selector,
                targetElement:
                    target.element,
                targetElements:
                    target.elements.slice()
            };
        }

        // Preparation may have awaited while this attempt lost its right to act.
        if (signal?.aborted || executionMetadata?.canCommit?.() === false) return false;

        const responseSession =
            globalThis
                .WMOFPresentationSetters
                ?.beginSpeechResponse?.({
                    commandElement:
                        element,
                    targetSelector:
                        target.selector,
                    targetElements:
                        target.elements
                });

        try {
            const utterance =
                SpeechMenu.#utterance
                    ?.id ===
                        utteranceId
                    ? SpeechMenu.#utterance
                    : SpeechMenu
                        .#finishedUtterances
                        .get(
                            utteranceId
                        );

            const previousExecutionContext =
                SpeechMenu
                    .#executionContext;

            SpeechMenu.#executionContext =
                Object.freeze({
                    utteranceId,
                    transcript:
                        text,
                    arguments: Object.freeze(argumentValues.slice()),
                    utteranceStartedAt:
                        executionStartedAt ||
                        utterance
                            ?.wallStartedAt,
                    chain: executionMetadata?.chain === true || utterance?.commandChainExecuting === true,
                    chainContext: executionMetadata?.chainContext || utterance?.digestExecutingContext,
                    chainSurface: executionMetadata?.chainSurface,
                    skippable: element.hasAttribute("speech-skippable") && element.getAttribute("speech-skippable") !== "false",
                    hasContinuation: executionMetadata?.hasContinuation,
                    nextCommand: executionMetadata?.nextCommand,
                    isFinal: executionMetadata?.isFinal,
                    persist: element.hasAttribute("speech-persist") && element.getAttribute("speech-persist") !== "false"
                });

            const feedbackContext = SpeechMenu.#executionContext;
            const feedbackSnapshot = SpeechMenu.#feedbackAdapter?.capture?.(element, feedbackContext);
            let outcomeValue;

            try {
                outcomeValue =
                    element
                        .speechFunc
                        .apply(
                            element.speechFuncThis,
                            argumentValues
                        );
            }
            finally {
                SpeechMenu.#executionContext =
                    previousExecutionContext;
            }

            if (outcomeValue?.then) {
                outcomeValue = Promise.resolve(outcomeValue).then(result => {
                    SpeechMenu.#commandFeedback(element, feedbackContext, feedbackSnapshot, result, utterance);
                    return result;
                });
            } else SpeechMenu.#commandFeedback(element, feedbackContext, feedbackSnapshot, outcomeValue, utterance);

            if (outcomeValue === false) {
                globalThis
                    .WMOFPresentationSetters
                    ?.cancelSpeechResponse?.(
                        responseSession
                    );

                return false;
            }

            SpeechMenu.#emit(
                "speechCommandDispatched",
                {
                    utteranceId,
                    commandElement:
                        element,
                    speechMenuElement,
                    transcript:
                        text,
                    canonicalTranscript,
                    arguments:
                        argumentValues.slice(),
                    targetSelector:
                        target.selector,
                    targetElement:
                        target.element,
                    targetElements:
                        target.elements.slice()
                }
            );

            // A chain depends on the action result, not on a response paint.
            // Presentation continues independently after logical completion.
            if (awaitCompletion && executionMetadata?.chain) outcomeValue = await outcomeValue;

            const completion =
                SpeechMenu
                    .#completeSpeechExecution({
                        element,
                        speechMenuElement,
                        utteranceId,
                        transcript:
                            text,
                        canonicalTranscript,
                        argumentValues:
                            argumentValues.slice(),
                        target: {
                            selector:
                                target.selector,
                            element:
                                target.element,
                            elements:
                                target.elements.slice()
                        },
                        responseSession,
                        outcomeValue,
                        executionStartedAt: executionStartedAt || utterance?.wallStartedAt
                    });

            if (awaitCompletion && !executionMetadata?.chain) {
                return Boolean(
                    await completion
                );
            }

            void completion;

            /*
             * Recognition commitment ends at dispatch, not at action
             * completion. The action promise may continue with UI work,
             * chimes, TTS, network requests, or other asynchronous side
             * effects while the recognizer accepts and commits later
             * speech independently.
             */
            return outcomeValue !== false;
        }
        catch (error) {
            SpeechMenu.#emit(
                "speechMenuCommandError",
                {
                    speechMenuElement:
                        element,
                    error,
                    utteranceId
                }
            );

            return false;
        }
    }

    static #list(value) {
        return value
            .split(
                SpeechMenu.#separator
            )
            .map(
                part =>
                    part.trim()
            )
            .filter(Boolean)
            .map(
                SpeechMenu.#scalar
            );
    }

    static #scalar(value) {
        const number =
            Number(value);

        return value.trim() &&
            Number.isFinite(number)
                ? number
                : value;
    }

    static async #releaseCapture() {
        SpeechMenu.#clearPrimed();
        if (SpeechMenu.#utterance) SpeechMenu.#utterance.chainCanceled = true;
        const captureNode =
            SpeechMenu.#captureNode;

        SpeechMenu.#captureNode =
            undefined;

        if (captureNode) {
            try {
                captureNode.port
                    .removeEventListener(
                        "message",
                        SpeechMenu.#onAudioWorkletMessage
                    );
            }
            catch {}

            try {
                captureNode.disconnect();
            }
            catch {}
        }

        try {
            SpeechMenu.#sourceNode
                ?.disconnect();
        }
        catch {}

        SpeechMenu.#sourceNode =
            undefined;

        try {
            SpeechMenu.#silentGain
                ?.disconnect();
        }
        catch {}

        SpeechMenu.#silentGain =
            undefined;

        const recognizer =
            SpeechMenu.#recognizer;

        SpeechMenu.#recognizer =
            undefined;

        if (recognizer) {
            try {
                recognizer.removeEventListener(
                    "transcript",
                    SpeechMenu.#onSherpaTranscript
                );
                recognizer.removeEventListener(
                    "error",
                    SpeechMenu.#onSherpaError
                );
                recognizer.removeEventListener(
                    "status",
                    SpeechMenu.#onSherpaStatus
                );
                recognizer.removeEventListener(
                    "utteranceEnded",
                    SpeechMenu.#onSherpaUtteranceEnded
                );
                recognizer.close();
            }
            catch {}
        }

        const vad =
            SpeechMenu.#vad;

        SpeechMenu.#vad =
            undefined;

        if (vad) {
            try {
                vad.removeEventListener(
                    "speechStart",
                    SpeechMenu.#onVadSpeechStart
                );
                vad.removeEventListener(
                    "speechEnd",
                    SpeechMenu.#onVadSpeechEnd
                );
                vad.removeEventListener(
                    "error",
                    SpeechMenu.#onVadError
                );
                vad.removeEventListener(
                    "status",
                    SpeechMenu.#onVadStatus
                );
                vad.close();
            }
            catch {}
        }

        const stream =
            SpeechMenu.#stream;

        SpeechMenu.#stream =
            undefined;

        SpeechMenu.#micTrack =
            undefined;

        if (stream) {
            for (
                const track of
                    stream.getTracks()
            ) {
                try {
                    track.stop();
                }
                catch {}
            }
        }

        const context =
            SpeechMenu.#audioContext;

        SpeechMenu.#audioContext =
            undefined;

        if (
            context &&
            context.state !== "closed"
        ) {
            try {
                await context.close();
            }
            catch {}
        }

        SpeechMenu.#preRollFrames =
            [];

        SpeechMenu.#preRollSamples =
            0;

        await Promise.all([...SpeechMenu.#finishedUtterances.values()].map(utterance =>
            utterance.operation?.cancel(new DOMException("Speech recognition stopped.", "AbortError"))));
        SpeechMenu.#finishedUtterances
            .clear();

        SpeechMenu.#utterance =
            undefined;
    }
}

globalThis.SpeechMenu = SpeechMenu;
