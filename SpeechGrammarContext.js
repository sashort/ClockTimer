/*
 * Context selection for the PocketSphinx speech backend.
 *
 * This module deliberately does not parse or execute commands. SpeechMenu's
 * existing command planner remains authoritative; this class only selects the
 * recognition vocabulary appropriate to the current command/UI context.
 */
(() => {
    "use strict";

    const VALUE_CAPTURE_TYPES = Object.freeze({
        spokenTime: "time",
        timeValue: "time",
        dateValue: "date",
        spokenDate: "date",
        digits: "digits",
        pin: "digits",
        percent: "number",
        amount: "number",
        duration: "duration"
    });

    const normalize = value =>
        String(value ?? "")
            .toLocaleLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim()
            .replace(/\s+/g, " ");

    class SpeechGrammarContext {
        static DEFAULT = "commands";

        static VALUE_CAPTURE_TYPES = VALUE_CAPTURE_TYPES;

        static normalize(value) {
            return normalize(value);
        }

        /*
         * Infer the expected next grammar from a matched speech-pattern.
         * Named capture groups are the contract between command patterns and
         * the recognizer: they describe value type, not a specific command.
         */
        static fromPattern(pattern, options = {}) {
            const source = String(pattern ?? "");
            const captureNames = [
                ...source.matchAll(/\(\?<([A-Za-z][A-Za-z0-9_]*)>/g)
            ].map(match => match[1]);

            for (const name of captureNames) {
                if (VALUE_CAPTURE_TYPES[name]) {
                    return Object.freeze({
                        grammar: VALUE_CAPTURE_TYPES[name],
                        capture: name,
                        reason: "named-capture"
                    });
                }
            }

            if (options.expect === "time" ||
                options.expect === "date" ||
                options.expect === "digits" ||
                options.expect === "number" ||
                options.expect === "duration") {
                return Object.freeze({
                    grammar: options.expect,
                    capture: null,
                    reason: "explicit-context"
                });
            }

            return Object.freeze({
                grammar: SpeechGrammarContext.DEFAULT,
                capture: null,
                reason: "command-pattern"
            });
        }

        /*
         * UI entry modes can override the command grammar. Keep this decision
         * pure so it can be tested without microphone, DOM, or decoder state.
         */
        static fromUIContext(context = {}) {
            const mode = normalize(context.mode || context.inputMode);
            if (context.pinEntry || /\b(pin|passcode|login code)\b/.test(mode)) {
                return Object.freeze({ grammar: "digits", reason: "ui-context" });
            }
            if (context.dateEntry || /\b(date|calendar)\b/.test(mode)) {
                return Object.freeze({ grammar: "date", reason: "ui-context" });
            }
            if (context.timeEntry || /\b(time|clock)\b/.test(mode)) {
                return Object.freeze({ grammar: "time", reason: "ui-context" });
            }
            if (context.numberEntry || /\b(number|percent|amount)\b/.test(mode)) {
                return Object.freeze({ grammar: "number", reason: "ui-context" });
            }
            return Object.freeze({ grammar: SpeechGrammarContext.DEFAULT, reason: "ui-default" });
        }

        /*
         * A command prefix can be recognized first, then mapped to a value
         * grammar. A bare prefix is not executable; SpeechMenu's existing
         * planner still validates and executes the completed utterance.
         */
        static resolve({ pattern, uiContext, expect } = {}) {
            const ui = SpeechGrammarContext.fromUIContext(uiContext);
            if (ui.grammar !== SpeechGrammarContext.DEFAULT) return ui;
            return SpeechGrammarContext.fromPattern(pattern, { expect });
        }
    }

    globalThis.SpeechGrammarContext = SpeechGrammarContext;
})();
