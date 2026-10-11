/*
 * Builds PocketSphinx FSG descriptions without depending on the WASM runtime.
 * The returned objects match the grammar shape accepted by PocketSphinx.js.
 */
(() => {
    "use strict";

    const normalize = value =>
        String(value ?? "")
            .toLocaleUpperCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z0-9]+/g, " ")
            .trim()
            .replace(/\s+/g, " ");

    const NUMBER_WORDS = Object.freeze([
        "ZERO", "OH", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX",
        "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN",
        "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN",
        "NINETEEN", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY",
        "SEVENTY", "EIGHTY", "NINETY", "HUNDRED", "THOUSAND"
    ]);

    const TIME_WORDS = Object.freeze([
        ...NUMBER_WORDS, "A", "P", "AM", "PM", "O", "CLOCK", "HOUR",
        "HOURS", "MINUTE", "MINUTES", "AND", "PAST", "AFTER", "TO",
        "TIL", "TILL", "QUARTER", "HALF", "NOON", "MIDNIGHT"
    ]);

    const DATE_WORDS = Object.freeze([
        ...NUMBER_WORDS, "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY",
        "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER",
        "DECEMBER", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY",
        "FRIDAY", "SATURDAY", "SUNDAY", "FIRST", "SECOND", "THIRD",
        "FOURTH", "FIFTH", "TWENTIETH", "THIRTIETH", "OF", "THE"
    ]);

    const VALUE_WORDS = Object.freeze({
        digits: Object.freeze(["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"]),
        number: NUMBER_WORDS,
        duration: Object.freeze([...NUMBER_WORDS, "SECOND", "SECONDS", "MINUTE", "MINUTES", "HOUR", "HOURS"]),
        time: TIME_WORDS,
        date: DATE_WORDS
    });

    function compilePhrases(phrases) {
        const transitions = [];
        const edges = new Map();
        let nextState = 1;
        const end = () => nextState++;
        const finalState = end();

        for (const phrase of phrases || []) {
            const words = normalize(phrase).split(" ").filter(Boolean);
            if (!words.length) continue;
            let state = 0;
            for (const word of words) {
                const key = state + "\u0000" + word;
                let target = edges.get(key);
                if (target === undefined) {
                    target = nextState++;
                    edges.set(key, target);
                    transitions.push({ from: state, to: target, logp: 0, word });
                }
                state = target;
            }
            transitions.push({ from: state, to: finalState, logp: 0, word: "" });
        }

        return Object.freeze({
            start: 0,
            end: finalState,
            numStates: nextState,
            transitions: Object.freeze(transitions.map(item => Object.freeze(item)))
        });
    }

    function expandRegexPrefix(source) {
        let text = String(source ?? "").replace(/^\^/, "");
        const capture = text.search(/\(\?<[^>]+>/);
        if (capture >= 0) text = text.slice(0, capture);
        text = text.replace(/\$/, "");

        // Expand the simple alternation/optional groups used by speech-patterns.
        // This intentionally refuses unsupported regex constructs instead of
        // guessing at the language of an arbitrary regular expression.
        function expand(input, depth = 0) {
            if (depth > 12) throw new Error("Speech pattern prefix nesting is too deep.");
            let results = [""];
            for (let i = 0; i < input.length;) {
                if (input.startsWith("(?:", i) || input[i] === "(") {
                    const nonCapture = input.startsWith("(?:", i);
                    const start = i + (nonCapture ? 3 : 1);
                    let nesting = 1;
                    let end = start;
                    for (; end < input.length; end++) {
                        if (input[end] === "(" && input[end - 1] !== "\\") nesting++;
                        else if (input[end] === ")" && input[end - 1] !== "\\") {
                            nesting--;
                            if (nesting === 0) break;
                        }
                    }
                    if (end >= input.length) throw new Error("Unclosed group in speech pattern prefix.");
                    const body = input.slice(start, end);
                    const alternatives = splitAlternatives(body).flatMap(part => expand(part, depth + 1));
                    const optional = input[end + 1] === "?";
                    const choices = optional ? ["", ...alternatives] : alternatives;
                    results = results.flatMap(prefix => choices.map(choice => prefix + choice));
                    i = end + 1 + (optional ? 1 : 0);
                    continue;
                }
                if ("[]{}*+?".includes(input[i])) {
                    throw new Error("Unsupported regex construct in speech pattern prefix: " + input[i]);
                }
                const char = input[i] === "\\" ? input[i + 1] : input[i];
                results = results.map(prefix => prefix + char);
                i += input[i] === "\\" ? 2 : 1;
            }
            return results;
        }

        function splitAlternatives(input) {
            const parts = [];
            let start = 0;
            let nesting = 0;
            for (let i = 0; i < input.length; i++) {
                if (input[i] === "(" && input[i - 1] !== "\\") nesting++;
                else if (input[i] === ")" && input[i - 1] !== "\\") nesting--;
                else if (input[i] === "|" && nesting === 0) {
                    parts.push(input.slice(start, i));
                    start = i + 1;
                }
            }
            parts.push(input.slice(start));
            return parts;
        }

        return [...new Set(expand(text).map(normalize).filter(Boolean))];
    }

    function compileCommandPatterns(patternRecords) {
        const prefixes = [];
        const byPrefix = {};
        for (const record of patternRecords || []) {
            const pattern = typeof record === "string" ? record : record?.pattern;
            if (typeof pattern !== "string") continue;
            const capture = pattern.match(/\(\?<([A-Za-z][A-Za-z0-9_]*)>/);
            if (!capture) continue;
            const type = globalThis.SpeechGrammarContext?.fromPattern(pattern)?.grammar || "commands";
            if (type === "commands") continue;
            const prefixSource = pattern.slice(0, capture.index);
            const phrases = expandRegexPrefix(prefixSource);
            for (const phrase of phrases) {
                prefixes.push(phrase);
                byPrefix[phrase] = Object.freeze({
                    grammar: type,
                    capture: capture[1],
                    pattern
                });
            }
        }
        return Object.freeze({
            grammar: compilePhrases(prefixes),
            prefixes: Object.freeze([...new Set(prefixes)]),
            byPrefix: Object.freeze(byPrefix)
        });
    }

    function compileValue(type) {
        const words = VALUE_WORDS[type];
        if (!words) throw new TypeError("Unknown speech value grammar: " + type);

        // A single state with self-loops admits a sequence of value tokens.
        // Semantic validity and command completion remain the existing planner's job.
        const transitions = words.map(word => Object.freeze({
            from: 0, to: 0, logp: 0, word
        }));
        transitions.push(Object.freeze({ from: 0, to: 1, logp: 0, word: "" }));
        return Object.freeze({
            start: 0,
            end: 1,
            numStates: 2,
            transitions: Object.freeze(transitions),
            valueType: type
        });
    }

    class PocketSphinxGrammarCatalog {
        static valueTypes() {
            return Object.keys(VALUE_WORDS);
        }

        static compilePhrases(phrases) {
            return compilePhrases(phrases);
        }

        static compileCommandPatterns(patternRecords) {
            return compileCommandPatterns(patternRecords);
        }

        static compileValue(type) {
            return compileValue(type);
        }

        static normalize(value) {
            return normalize(value);
        }
    }

    globalThis.PocketSphinxGrammarCatalog = PocketSphinxGrammarCatalog;
})();
