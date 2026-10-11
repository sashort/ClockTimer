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

        static compileValue(type) {
            return compileValue(type);
        }

        static normalize(value) {
            return normalize(value);
        }
    }

    globalThis.PocketSphinxGrammarCatalog = PocketSphinxGrammarCatalog;
})();
