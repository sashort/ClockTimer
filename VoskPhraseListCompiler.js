/*
 * Compiles finite Vosk phrase lists from ClockTimer speech-pattern records.
 *
 * Unlike a prefix grammar, this expands complete patterns. Every named capture
 * must have an explicit finite phrase vocabulary supplied by the caller.
 * Unsupported regex constructs are reported rather than broadened.
 */
(() => {
    "use strict";

    const normalize = value => String(value ?? "")
        .toLocaleLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

    function splitTopLevel(source, delimiter) {
        const parts = [];
        let start = 0;
        let depth = 0;
        let escaped = false;
        for (let i = 0; i < source.length; i++) {
            const ch = source[i];
            if (escaped) { escaped = false; continue; }
            if (ch === "\\") { escaped = true; continue; }
            if (ch === "(") depth++;
            else if (ch === ")") depth--;
            else if (ch === delimiter && depth === 0) {
                parts.push(source.slice(start, i));
                start = i + 1;
            }
        }
        parts.push(source.slice(start));
        return parts;
    }

    function findGroupEnd(source, openIndex) {
        let depth = 0;
        let escaped = false;
        for (let i = openIndex; i < source.length; i++) {
            const ch = source[i];
            if (escaped) { escaped = false; continue; }
            if (ch === "\\") { escaped = true; continue; }
            if (ch === "(") depth++;
            else if (ch === ")" && --depth === 0) return i;
        }
        return -1;
    }

    function expandRegex(source, maxPhrases) {
        function expand(input, depth = 0) {
            if (depth > 16) throw new Error("regex nesting exceeds 16 levels");
            let values = [""];
            for (let i = 0; i < input.length;) {
                const ch = input[i];
                if (ch === "(") {
                    if (!input.startsWith("(?:", i)) {
                        throw new Error("only non-capturing groups are supported after named captures are substituted");
                    }
                    const end = findGroupEnd(input, i);
                    if (end < 0) throw new Error("unclosed group");
                    const alternatives = splitTopLevel(input.slice(i + 3, end), "|")
                        .flatMap(part => expand(part, depth + 1));
                    const optional = input[end + 1] === "?";
                    const choices = optional ? ["", ...alternatives] : alternatives;
                    values = product(values, choices, maxPhrases);
                    i = end + (optional ? 2 : 1);
                    continue;
                }
                if (ch === "\\") {
                    const next = input[i + 1];
                    if (next === "s") {
                        // The application normalizes whitespace to a single space.
                        if (input[i + 2] === "+" || input[i + 2] === "*") i += 3;
                        else i += 2;
                        values = values.map(value => value + " ");
                        continue;
                    }
                    if (next === "?" || next === "." || next === "-" || next === "|") {
                        values = values.map(value => value + next);
                        i += 2;
                        continue;
                    }
                    throw new Error("unsupported escape sequence \\" + next);
                }
                if ("[]{}*+".includes(ch) || ch === "?") {
                    throw new Error("unsupported regex quantifier or character class: " + ch);
                }
                values = values.map(value => value + ch);
                i++;
            }
            return values;
        }
        return [...new Set(expand(source).map(normalize).filter(Boolean))];
    }

    function product(left, right, limit) {
        if (left.length * right.length > limit) {
            throw new Error("phrase expansion exceeds limit of " + limit);
        }
        const result = [];
        for (const a of left) for (const b of right) result.push(a + b);
        return result;
    }

    function substituteCaptures(pattern, capturePhrases) {
        let source = String(pattern ?? "").replace(/^\^/, "").replace(/\$$/, "");
        let output = "";
        for (let i = 0; i < source.length;) {
            if (source.startsWith("(?<", i)) {
                const nameEnd = source.indexOf(">", i + 3);
                if (nameEnd < 0) throw new Error("malformed named capture");
                const name = source.slice(i + 3, nameEnd);
                const open = nameEnd + 1;
                let close = -1;
                let depth = 1;
                let escaped = false;
                for (let cursor = open; cursor < source.length; cursor++) {
                    const ch = source[cursor];
                    if (escaped) { escaped = false; continue; }
                    if (ch === "\\") { escaped = true; continue; }
                    if (ch === "(") depth++;
                    else if (ch === ")" && --depth === 0) { close = cursor; break; }
                }
                if (close < 0) throw new Error("unclosed named capture: " + name);
                const choices = capturePhrases[name];
                if (!Array.isArray(choices) || choices.length === 0) {
                    throw new Error("no finite phrase vocabulary supplied for capture: " + name);
                }
                const alternatives = choices.map(normalize).filter(Boolean);
                if (!alternatives.length) throw new Error("capture vocabulary is empty: " + name);
                // Captures are phrase-valued; normalize whitespace after expansion.
                output += "(?:" + alternatives.map(value => value.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&")).join("|") + ")";
                i = close + 1;
                continue;
            }
            output += source[i++];
        }
        return output;
    }

    function compile(patternRecords, options = {}) {
        const capturePhrases = options.capturePhrases || {};
        const maxPhrasesPerPattern = Math.max(1, options.maxPhrasesPerPattern || 50000);
        const all = new Set();
        const unsupported = [];
        let recordsSeen = 0;
        let supportedPatterns = 0;

        for (const record of patternRecords || []) {
            const pattern = typeof record === "string" ? record : record?.pattern;
            if (typeof pattern !== "string") continue;
            recordsSeen++;
            try {
                const substituted = substituteCaptures(pattern, capturePhrases);
                const phrases = expandRegex(substituted, maxPhrasesPerPattern);
                if (!phrases.length) throw new Error("pattern expanded to no phrases");
                supportedPatterns++;
                for (const phrase of phrases) all.add(phrase);
            } catch (error) {
                unsupported.push(Object.freeze({
                    id: typeof record === "object" ? record.id || null : null,
                    pattern,
                    reason: String(error?.message || error)
                }));
            }
        }

        const phrases = [...all].sort();
        return Object.freeze({
            phrases: Object.freeze(phrases),
            phraseCount: phrases.length,
            recordsSeen,
            supportedPatterns,
            unsupported: Object.freeze(unsupported),
            duplicateCount: 0
        });
    }

    class VoskPhraseListCompiler {
        static normalize(value) { return normalize(value); }
        static compile(patternRecords, options) { return compile(patternRecords, options); }
    }

    globalThis.VoskPhraseListCompiler = VoskPhraseListCompiler;
})();
