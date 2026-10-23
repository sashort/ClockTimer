/* Recognition vocabulary only. SpeechMenu supplies availability and projected
 * chain contexts, and remains the sole command planner and executor. */
(() => {
    "use strict";
    const normalize = value => globalThis.SpeechGrammarContext.normalize(value);
    const unique = values => [...new Set(values)];
    const begins = (text, prefix) => text === prefix || text.startsWith(prefix + " ");

    const phraseCaches = new WeakMap(), wordCaches = new WeakMap();
    const phraseWords = phrases => {
        let words = wordCaches.get(phrases);
        if (!words) {
            words = Object.freeze(unique(phrases.flatMap(phrase => phrase.split(" "))));
            if (Object.isFrozen(phrases)) wordCaches.set(phrases, words);
        }
        return words;
    };
    class VoskGrammarRouter {
        constructor({ records = [], capturePhrases = {}, valuePhrases = {}, nextRecords = async () => [], compiled, compileRecords } = {}) {
            this.options = { capturePhrases, valuePhrases };
            this.nextRecords = nextRecords;this.compileRecords=compileRecords;
            this.prefix = "";
            this.text = "";
            this.unsupported = [];
            this.confirmationLocked = false;
            this.optionalValue = false;
            this.setRecords(records,compiled);
        }

        setRecords(records,prepared) {
            this.optionalValue = false;
            this.digitRecords=records.filter(record=>record.digitCounts?.length);
            const compiled = prepared || globalThis.VoskPhraseListCompiler.compileStages(records, this.options);
            this.reportUnsupported(compiled.unsupported);
            this.paths = compiled.paths;
            this.grammar = this.paths[0]?.stages[0]?.grammar || "commands";
            // Bare collectors may coexist with explicit commands in a modal.
            const types = unique(this.paths.map(path => path.stages[0]?.grammar));
            if (types.length !== 1) this.grammar = "commands";
            this.continuations = [];
        }

        reportUnsupported(records) {
            const seen = new Set(this.unsupported.map(record => JSON.stringify(record)));
            for (const record of records) if (!seen.has(JSON.stringify(record))) {
                this.unsupported.push(record);
                seen.add(JSON.stringify(record));
            }
        }

        get phrases() {
            const cached = phraseCaches.get(this);
            if (cached && cached.paths === this.paths && cached.continuations === this.continuations &&
                cached.grammar === this.grammar && cached.confirmationLocked === this.confirmationLocked)
                return cached.value;
            const initialPhrases = path => {
                const stage = path.stages[0];
                // Root value-first alternatives need a bootstrap vocabulary,
                // not hundreds of repeated numeric phrase transitions that
                // overpower literal heads such as "trip mode".
                return this.grammar === "commands" && stage?.grammar !== "commands" &&
                    path.record.atomic !== "digits" && path.stages[1]?.grammar === "commands"
                    ? phraseWords(stage.phrases)
                    : stage?.phrases || [];
            };
            const continuations = this.confirmationLocked
                ? this.continuations.filter(path => path.record.action === "SpeechMenu.cancel")
                : this.continuations;
            const value = Object.freeze(unique([...this.paths.flatMap(initialPhrases),
                // A value-first command can finish without a pause before its
                // literal suffix (for example "one hundred ten percent trip").
                ...this.paths.flatMap(path => path.stages[0]?.grammar !== "commands" &&
                    path.stages[1]?.grammar === "commands" ? path.stages[1].phrases : []),
                ...continuations.flatMap(initialPhrases)]).sort());
            phraseCaches.set(this, {paths:this.paths, continuations:this.continuations, grammar:this.grammar,
                confirmationLocked:this.confirmationLocked, value});
            return value;
        }

        get transcript() { return [this.prefix, this.text].filter(Boolean).join(" "); }

        consume(text) {
            this.prefix = [this.prefix, text].filter(Boolean).join(" ");
        }

        async project(value, paths = this.paths) {
            const full = [this.prefix, value].filter(Boolean).join(" ");
            const records = await this.nextRecords(full);
            const compiled = this.compileRecords ? await this.compileRecords(records) : globalThis.VoskPhraseListCompiler.compileStages(records, this.options);
            this.reportUnsupported(compiled.unsupported);
            const suffixes = paths.filter(path => path.stages.length > 1)
                .map(path => ({ ...path, stages: path.stages.slice(1) }));
            // An extendable value is still the same collector, not the next
            // command. Keep compound duration fragments in the current stage.
            this.continuations = [...suffixes, ...compiled.paths.filter(next =>
                this.grammar === "commands" || next.stages[0]?.grammar === "commands" ||
                !this.paths.some(current => current.stages.length === 1 &&
                    (current.record.id && next.record.id
                        ? current.record.id === next.record.id
                        : current.record.pattern === next.record.pattern &&
                            current.record.action === next.record.action && current.record.capture === next.record.capture)))];
        }

        async update(hypothesis) {
            let text = normalize(hypothesis);
            if(this.digitRecords.length && globalThis.DigitSequence && globalThis.SpeechValueCollector){
                const vocabulary=this.digitRecords.find(record=>record.digitVocabulary)?.digitVocabulary || {};
                const counts=unique(this.digitRecords.flatMap(record=>record.digitCounts));
                const contexts=Object.fromEntries(this.digitRecords.flatMap(record=>record.digitCounts.map(count=>[count,record.digitContext || record.id])));
                const evaluate=digits=>{
                    const collector=new globalThis.SpeechValueCollector({digitCounts:counts,digitContexts:contexts,toDigits:()=>digits});
                    collector.update([{id:'digit-probe',text:digits,final:false}]);return collector.evaluate();
                };
                const words=text.split(' ');
                // Longest declared complete field wins. The contract, rather
                // than a recognizer's four-digit phrase, owns the boundary.
                for(let end=words.length;end>0;end--){
                    const head=words.slice(0,end).join(' ');
                    for(const record of this.digitRecords){
                        if(!record.digitField)continue;
                        const match=new RegExp(record.pattern,'i').exec(head);
                        const raw=match?.groups?.[record.digitField];
                        if(raw===undefined)continue;
                        const digits=globalThis.DigitSequence.parse(raw,vocabulary);
                        if(digits===null)continue;
                        const state=evaluate(digits);
                        if(state.status!=='valid' || (!match.groups.confirmation && state.canContinue))continue;
                        await this.project(head);this.text=text;
                        return {transcript:this.transcript,grammar:this.grammar,phrases:this.phrases,stableHead:head,digitState:state};
                    }
                }
                const digits=globalThis.DigitSequence.parse(text,vocabulary);
                if(digits!==null){this.text=text;return {transcript:this.transcript,grammar:this.grammar,phrases:this.phrases,digitState:evaluate(digits)};}
            }
            let stableHead;
            if (!this.prefix && this.grammar === "commands") {
                // Locate a literal head before vocabulary routing. This does
                // not grant a command context or reinterpret a value fragment;
                // SpeechMenu still validates every resulting segment.
                const heads = this.paths.flatMap(path => path.stages[0]?.phrases || []);
                const words = text.split(" ").filter(Boolean);
                const start = words.findIndex((word, offset) => {
                    const tail = words.slice(offset).join(" ");
                    return heads.some(head => begins(tail, head) || begins(head, tail));
                });
                if (start > 0) text = words.slice(start).join(" ");
            }
            // Decoder stages report only their own text. Never deduplicate
            // numbers: "one one" can be a PIN or a legitimate time value.
            for (let iteration = 0; iteration < 16; iteration++) {
                this.text = text;
                if (this.grammar === "commands") {
                    const valuePaths = this.paths.filter(path => path.record.atomic !== "digits" && path.stages[0]?.grammar !== "commands" &&
                        path.stages[0]?.phrases.some(phrase => begins(text, phrase) || begins(phrase, text)));
                    const valueTypes = unique(valuePaths.map(path => path.stages[0].grammar));
                    const literalMatch = this.paths.some(path => path.stages[0]?.grammar === "commands" &&
                        path.stages[0].phrases.some(phrase => begins(text, phrase) || begins(phrase, text)));
                    // A value-first command still needs its literal suffix.
                    // Do not discard competing command heads on a provisional
                    // numeric partial ("three" can revise to "trip mode").
                    const needsSuffix = valuePaths.length && valuePaths.every(path => path.stages[1]?.grammar === "commands");
                    const suffixMatched = valuePaths.some(path => path.stages[0].phrases.some(value => {
                        if (!begins(text, value)) return false;
                        const tail = text.slice(value.length).trim();
                        return tail && path.stages[1]?.phrases.some(phrase => begins(tail, phrase));
                    }));
                    if (!literalMatch && valueTypes.length === 1 && (!needsSuffix || suffixMatched)) {
                        this.paths = valuePaths;
                        this.grammar = valueTypes[0];
                        continue;
                    }
                    const matching = this.paths.filter(path => (path.stages[0]?.grammar === "commands" || path.record.atomic === "digits") && path.stages[0].phrases.some(phrase =>
                        begins(text, phrase) || begins(phrase, text)));
                    const completed = matching.filter(path => path.stages[0].phrases.some(phrase => begins(text, phrase)));
                    if (!completed.length || matching.length !== completed.length) break;
                    const heads = unique(completed.flatMap(path => path.stages[0].phrases.filter(phrase => begins(text, phrase)))).sort((a, b) => b.length - a.length);
                    const head = heads[0];
                    const selected = completed.filter(path => path.stages[0].phrases.includes(head));
                    // The final digit of an atomic group is still revisable.
                    // Keep confirmation words audible in this decoder, and
                    // route only once a following token establishes a boundary.
                    if (selected.every(path => path.record.atomic === "digits")) {
                        const tail=text.slice(head.length).trim();
                        const digitWords=new Set((this.options.valuePhrases.digits || []).filter(phrase=>!phrase.includes(' ')));
                        // A complete field is not necessarily the end of a digit
                        // stream. Let the owning collector validate discrete counts.
                        if (!tail || tail.split(/\s+/).every(word=>digitWords.has(word)||/^[0-9]+$/.test(word))) break;
                    }
                    const types = unique(selected.map(path => path.stages[1]?.grammar || "terminal"));
                    const values = types.filter(type => type !== "terminal");
                    if (types.includes("terminal") && values.length === 1 && values[0] !== "commands") {
                        this.consume(head);
                        this.paths = selected.filter(path => path.stages.length > 1).map(path => ({...path,stages:path.stages.slice(1)}));
                        this.grammar = values[0]; this.optionalValue = true;
                        text = text.slice(head.length).trim();
                        await this.project(text);
                        continue;
                    }
                    if (types.length !== 1 || types[0] === "terminal") {
                        // Only SpeechMenu can establish a boundary after a
                        // terminal command and choose its next context.
                        await this.project(head, selected);
                        if (types.length === 1) {
                            stableHead = head;
                            this.confirmationLocked = false;
                        }
                        const tail = text.slice(head.length).trim();
                        if (!tail || !this.continuations.some(path => path.stages[0]?.phrases.some(phrase => begins(phrase, tail) || begins(tail, phrase)))) break;
                        this.consume(head);
                        this.paths = this.continuations;
                        this.continuations = [];
                        this.grammar = "commands";
                        text = tail;
                        continue;
                    }
                    this.consume(head);
                    this.paths = selected.map(path => ({ ...path, stages: path.stages.slice(1) }));
                    this.grammar = types[0];
                    this.optionalValue = false;
                    this.confirmationLocked = selected.every(path => path.record.atomic === "digits") && types[0] === "commands";
                    text = text.slice(head.length).trim();
                    // Ask SpeechMenu to project the next UI context using a
                    // representative finite value, without executing it.
                    await this.project(this.paths[0].stages[0].phrases[0]);
                    continue;
                }

                const values = unique(this.paths.flatMap(path => path.stages[0].phrases));
                // Longest valid value first keeps teens/compound numbers intact.
                const valid = values.filter(value => begins(text, value)).sort((a, b) => b.length - a.length);
                if (this.optionalValue && !valid.length && text && this.continuations.some(path =>
                    path.stages[0]?.grammar === "commands" && path.stages[0].phrases.some(phrase => begins(text, phrase) || begins(phrase, text)))) {
                    this.paths = this.continuations.filter(path => path.stages[0]?.grammar === "commands");
                    this.continuations = []; this.grammar = "commands"; this.optionalValue = false;
                    continue;
                }
                let switched = false;
                for (const value of valid) {
                    const tail = text.slice(value.length).trim();
                    await this.project(value);
                    if (!tail) break;
                    if (!this.continuations.some(path => path.stages[0]?.phrases.some(phrase => begins(phrase, tail) || begins(tail, phrase)))) continue;
                    this.consume(value);
                    this.paths = this.continuations;
                    this.continuations = [];
                    this.grammar = this.paths[0]?.stages[0]?.grammar || "commands";
                    text = tail;
                    switched = true;
                    break;
                }
                if (!switched) break;
            }
            if (this.confirmationLocked && text && !this.phrases.some(phrase =>
                begins(text, phrase) || begins(phrase, text))) {
                // A word decoded under the wider digit vocabulary is not a
                // confirmation. Let the narrow decoder replay its audio instead
                // of seeding that unsupported word into the next stage.
                text = "";
            }
            this.text = text;
            return { transcript: this.transcript, grammar: this.grammar, phrases: this.phrases, stableHead };
        }

        static valuePhrases(language) {
            return globalThis.SpeechLanguageController.vocabulary(language);

        }
    }
    globalThis.VoskGrammarRouter = VoskGrammarRouter;
})();
