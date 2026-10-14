/* Recognition vocabulary only. SpeechMenu supplies availability and projected
 * chain contexts, and remains the sole command planner and executor. */
(() => {
    "use strict";
    const normalize = value => globalThis.SpeechGrammarContext.normalize(value);
    const unique = values => [...new Set(values)];
    const begins = (text, prefix) => text === prefix || text.startsWith(prefix + " ");

    class VoskGrammarRouter {
        constructor({ records = [], capturePhrases = {}, valuePhrases = {}, nextRecords = async () => [] } = {}) {
            this.options = { capturePhrases, valuePhrases };
            this.nextRecords = nextRecords;
            this.prefix = "";
            this.text = "";
            this.unsupported = [];
            this.confirmationLocked = false;
            this.setRecords(records);
        }

        setRecords(records) {
            const compiled = globalThis.VoskPhraseListCompiler.compileStages(records, this.options);
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
            const continuations = this.confirmationLocked
                ? this.continuations.filter(path => path.record.action === "SpeechMenu.cancel")
                : this.continuations;
            return unique([...this.paths.flatMap(path => path.stages[0]?.phrases || []),
                ...continuations.flatMap(path => path.stages[0]?.phrases || [])]).sort();
        }

        get transcript() { return [this.prefix, this.text].filter(Boolean).join(" "); }

        consume(text) {
            this.prefix = [this.prefix, text].filter(Boolean).join(" ");
        }

        async project(value) {
            const full = [this.prefix, value].filter(Boolean).join(" ");
            const records = await this.nextRecords(full);
            const compiled = globalThis.VoskPhraseListCompiler.compileStages(records, this.options);
            this.reportUnsupported(compiled.unsupported);
            const suffixes = this.paths.filter(path => path.stages.length > 1)
                .map(path => ({ ...path, stages: path.stages.slice(1) }));
            this.continuations = suffixes.length ? suffixes : compiled.paths;
        }

        async update(hypothesis) {
            let text = normalize(hypothesis);
            let stableHead;
            if (!this.prefix && this.grammar === "commands") {
                // Locate a literal head before vocabulary routing. This does
                // not grant a command context or reinterpret a value fragment;
                // SpeechMenu still validates every resulting segment.
                const heads = this.paths.filter(path => path.stages[0]?.grammar === "commands")
                    .flatMap(path => path.stages[0].phrases);
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
                    const matching = this.paths.filter(path => path.stages[0]?.phrases.some(phrase =>
                        begins(text, phrase) || begins(phrase, text)));
                    const completed = matching.filter(path => path.stages[0].phrases.some(phrase => begins(text, phrase)));
                    if (!completed.length || matching.length !== completed.length) break;
                    const heads = unique(completed.flatMap(path => path.stages[0].phrases.filter(phrase => begins(text, phrase)))).sort((a, b) => b.length - a.length);
                    const head = heads[0];
                    const selected = completed.filter(path => path.stages[0].phrases.includes(head));
                    const types = unique(selected.map(path => path.stages[1]?.grammar || "terminal"));
                    if (types.length !== 1 || types[0] === "terminal") {
                        // Only SpeechMenu can establish a boundary after a
                        // terminal command and choose its next context.
                        if (text === head) {
                            await this.project(head);
                            if (types.length === 1) {
                                stableHead = head;
                                this.confirmationLocked = false;
                            }
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

        static valuePhrases() {
            const small = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
                "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
            const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
            const number = n => n >= 100
                ? [small[Math.floor(n / 100)], "hundred", n % 100 ? number(n % 100) : ""].filter(Boolean).join(" ")
                : n < 20 ? small[n] : [tens[Math.floor(n / 10)], n % 10 ? small[n % 10] : ""].filter(Boolean).join(" ");
            const numbers = Array.from({length: 1000}, (_, n) => number(n));
            const time = ["four twelve", "noon", "midnight"];
            for (let hour = 1; hour <= 12; hour++) {
                for (let minute = 0; minute < 60; minute++) {
                    const phrase = [number(hour), minute ? (minute < 10 ? "oh " : "") + number(minute) : ""].filter(Boolean).join(" ");
                    time.push(phrase, phrase + " am", phrase + " pm");
                }
            }
            const duration = ["twenty minutes", ...numbers];
            for (const n of numbers) for (const unit of ["second", "seconds", "minute", "minutes", "hour", "hours"]) duration.push(n + " " + unit);
            // Bounded vocabularies. Deployments may supply different finite
            // ranges/capture choices; no catch-all or unknown-word fallback.
            const digits = small.slice(0, 10);
            let sequences = [""];
            const pins = [];
            for (let length = 1; length <= 4; length++) {
                sequences = sequences.flatMap(prefix => digits.map(digit => [prefix, digit].filter(Boolean).join(" ")));
                pins.push(...sequences);
            }
            const date = ["today", "tomorrow"];
            for (const month of ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"])
                for (let day = 1; day <= 31; day++) date.push(month + " " + number(day));
            return { time: unique(time), duration: unique(duration), number: numbers, digits: pins, date };
        }
    }
    globalThis.VoskGrammarRouter = VoskGrammarRouter;
})();
