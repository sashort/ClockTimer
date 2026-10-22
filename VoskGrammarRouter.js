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
            this.optionalValue = false;
            this.setRecords(records);
        }

        setRecords(records) {
            this.optionalValue = false;
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
            const initialPhrases = path => {
                const stage = path.stages[0];
                // Root value-first alternatives need a bootstrap vocabulary,
                // not hundreds of repeated numeric phrase transitions that
                // overpower literal heads such as "trip mode".
                return this.grammar === "commands" && stage?.grammar !== "commands" &&
                    path.record.atomic !== "digits" && path.stages[1]?.grammar === "commands"
                    ? unique(stage.phrases.flatMap(phrase => phrase.split(" ")))
                    : stage?.phrases || [];
            };
            const continuations = this.confirmationLocked
                ? this.continuations.filter(path => path.record.action === "SpeechMenu.cancel")
                : this.continuations;
            return unique([...this.paths.flatMap(initialPhrases),
                // A value-first command can finish without a pause before its
                // literal suffix (for example "one hundred ten percent trip").
                ...this.paths.flatMap(path => path.stages[0]?.grammar !== "commands" &&
                    path.stages[1]?.grammar === "commands" ? path.stages[1].phrases : []),
                ...continuations.flatMap(initialPhrases)]).sort();
        }

        get transcript() { return [this.prefix, this.text].filter(Boolean).join(" "); }

        consume(text) {
            this.prefix = [this.prefix, text].filter(Boolean).join(" ");
        }

        async project(value, paths = this.paths) {
            const full = [this.prefix, value].filter(Boolean).join(" ");
            const records = await this.nextRecords(full);
            const compiled = globalThis.VoskPhraseListCompiler.compileStages(records, this.options);
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
                    if (text === head && selected.every(path => path.record.atomic === "digits")) break;
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
                        if (text === head && types.length === 1) {
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
            // Preserve the pre-Vosk parser's compositional vocabulary. These
            // finite pieces let recognition retain articles, omitted units,
            // connectors and digit aliases; SpeechMenu validates the full value.
            const aliases = ["oh", "o", "naught", "nought", "tutu"];
            const duration = ["twenty minutes", ...numbers, "a", "an", "and", "double", "triple", "to", "too", ...aliases];
            for (const unit of ["hour", "hours", "hr", "hrs", "minute", "minutes", "min", "mins", "second", "seconds", "sec", "secs"]) {
                // Articles introduce singular units; plural forms such as
                // "an hours" bias recognition away from "an hour".
                if (["hour", "minute", "second"].includes(unit)) duration.push("a " + unit, "an " + unit);
                for (let n = 0; n < 60; n++) duration.push(number(n) + " " + unit);
            }
            for (let n = 0; n < 60; n++) duration.push("and " + number(n));
            for (const article of ["a", "an", "one"]) for (let minute = 0; minute < 60; minute++) {
                duration.push(article + " hour " + number(minute), article + " hour and " + number(minute));
            }
            for (let hour = 1; hour <= 12; hour++) for (let minute = 0; minute < 60; minute++) {
                duration.push(number(hour) + " hours " + number(minute), number(hour) + " hours and " + number(minute));
            }
            // Include unitless minutes/seconds as complete decoder phrases, just
            // as clock time includes hour/minute pairs. Individual number words
            // alone do not describe the transitions between spoken groups.
            for (let minute = 0; minute < 60; minute++) for (let second = 0; second < 60; second++) {
                duration.push(number(minute) + " " + number(second));
                if (second < 10) duration.push(number(minute) + " oh " + number(second));
                duration.push(number(minute) + " minutes " + number(second), number(minute) + " minutes and " + number(second));
            }
            // Clock idioms and 24-hour/digit-alias forms accepted before Vosk.
            for (let hour = 0; hour < 24; hour++) for (let minute = 0; minute < 60; minute++) {
                time.push(number(hour) + " " + number(minute));
                if (minute < 10) for (const alias of aliases.slice(0, 4)) time.push(number(hour) + " " + alias + " " + number(minute));
            }
            for (let hour = 1; hour <= 12; hour++) {
                for (const fraction of ["quarter", "half"]) for (const relation of ["past", "after", "to", "till", "until"]) {
                    for (const article of ["", "a "]) for (const suffix of ["", " am", " pm"])
                        time.push(article + fraction + " " + relation + " " + number(hour) + suffix);
                }
                for (const day of ["today", "tomorrow"]) time.push(day + " at " + number(hour));
            }
            time.push("noon tomorrow", "noon today", "midnight tomorrow", "midnight today", "today", "tomorrow", "at", "oclock", "o clock", ...aliases);
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
