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
            const branches = splitTopLevel(input, "|");
            if (branches.length > 1) {
                const result = branches.flatMap(part => expand(part, depth + 1));
                if (result.length > maxPhrases) throw new Error("phrase expansion exceeds limit of " + maxPhrases);
                return result;
            }
            let values = [""];
            for (let i = 0; i < input.length;) {
                const ch = input[i];
                if (ch === "(") {
                    if (input.startsWith("(?=", i) || input.startsWith("(?!", i)) {
                        const end = findGroupEnd(input, i);
                        if (end < 0) throw new Error("unclosed lookahead");
                        // Assertions consume no words. Enumerate only finite
                        // consuming paths, then enforce the original regex.
                        i = end + 1;
                        continue;
                    }
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
                if (ch === "?") {
                    if (values.some(value => !value.length)) {
                        throw new Error("optional quantifier has no preceding literal");
                    }
                    values = [...new Set(values.flatMap(value => [value, value.slice(0, -1)]))];
                    i++;
                    continue;
                }
                if ("[]{}*+.^$".includes(ch)) {
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
        let expandedPhraseCount = 0;

        for (const record of patternRecords || []) {
            const pattern = typeof record === "string" ? record : record?.pattern;
            if (typeof pattern !== "string") continue;
            recordsSeen++;
            try {
                const substituted = substituteCaptures(pattern, capturePhrases);
                const validator = new RegExp(pattern, "i");
                const phrases = expandRegex(substituted, maxPhrasesPerPattern)
                    .filter(phrase => validator.test(phrase));
                if (!phrases.length) throw new Error("pattern expanded to no phrases");
                supportedPatterns++;
                expandedPhraseCount += phrases.length;
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
            duplicateCount: expandedPhraseCount - phrases.length
        });
    }

    // Language vocabularies are immutable; retain only bounded compiled syntax,
    // never live command availability or action records. Mutable inputs bypass it.
    const stageCaches = new WeakMap();
    class VoskPhraseListCompiler {
        static normalize(value) { return normalize(value); }
        static compile(patternRecords, options) { return compile(patternRecords, options); }
        // Each available command path becomes an independent staged search.
        // Large capture vocabularies stay separate: no phrase Cartesian product.
        static compileParallel(records, options = {}, prefix = "") {
            const compiled = this.compileStages(records, options);
            const normalizedPrefix = normalize(prefix);
            const groups = new Map();
            for (const path of compiled.paths) {
                const stages = path.stages.map(stage => ({
                    phrases: [...stage.phrases], literal: stage.grammar === "commands"
                }));
                // Share a search among commands with the same continuation.
                // E.g. every terminal literal belongs to one command grammar,
                // while equivalent time openers share one time search.
                const key = JSON.stringify(stages[0]?.literal
                    ? [true, stages.slice(1)] : [false, stages]);
                const group = groups.get(key);
                if (group) {
                    group.stages[0].phrases = [...new Set([...group.stages[0].phrases, ...stages[0].phrases])];
                    group.records.push(path.record);
                } else groups.set(key, {record:path.record, records:[path.record], stages});
            }
            const branches = [...groups.values()].map((branch,index)=>{
                if (normalizedPrefix) branch.stages.unshift({phrases:[normalizedPrefix],literal:true});
                return {...branch,id:String(index)};
            });
            return {branches, unsupported: compiled.unsupported};
        }
        // Replace typed captures with markers before expansion, avoiding the
        // Cartesian product of large value vocabularies. Literal regex syntax
        // still goes through the same strict finite compiler.
        static compileStages(records, { capturePhrases = {}, valuePhrases = {} } = {}) {
            const paths = [], unsupported = [];
            let cache;
            if (Object.isFrozen(valuePhrases) && Object.values(valuePhrases).every(Object.isFrozen) &&
                !Object.keys(capturePhrases).length) {
                cache = stageCaches.get(valuePhrases);
                if (!cache) stageCaches.set(valuePhrases, cache = new Map());
            }
            const captureTypes = JSON.stringify(globalThis.SpeechGrammarContext?.VALUE_CAPTURE_TYPES || {});
            for (const record of records || []) {
                const pattern = typeof record === "string" ? record : record.pattern;
                if (typeof pattern !== "string") continue;
                const key = cache && JSON.stringify([pattern, record.expect, record.capture, captureTypes]);
                const cached = cache?.get(key);
                if (cached) {
                    paths.push(...cached.map(stages => ({record, stages})));
                    continue;
                }
                try {
                    const firstPath = paths.length;
                    const markers = {}, captures = new Map();
                    let source = "", cursor = 0;
                    for (const match of pattern.matchAll(/\(\?<([A-Za-z][A-Za-z0-9_]*)>/g)) {
                        if (match.index < cursor) continue;
                        const end = findGroupEnd(pattern, match.index);
                        if (end < 0) throw new Error("unclosed named capture");
                        const name = match[1];
                        const grammar = record.expect && (!record.capture || record.capture === name)
                            ? record.expect : globalThis.SpeechGrammarContext.VALUE_CAPTURE_TYPES[name];
                        const body = pattern.slice(match.index + match[0].length, end);
                        let choices = capturePhrases[name] || valuePhrases[grammar];
                        if (!choices) choices = expandRegex(body, 50000);
                        const validator = new RegExp("^(?:" + body + ")$", "i");
                        choices = [...new Set(choices.map(normalize).filter(value => value && validator.test(value)))];
                        if (!choices.length) throw new Error("no finite vocabulary for capture: " + name);
                        if (choices.length > 50000) throw new Error("capture vocabulary exceeds limit of 50000: " + name);
                        if (!grammar) {
                            markers[name] = choices;
                        } else {
                            const marker = "voskcapture" + captures.size;
                            markers[name] = [marker];
                            captures.set(marker, { grammar, capture: name, phrases: choices });
                        }
                        source += pattern.slice(cursor, match.index) + "(?<" + name + ">.+)";
                        cursor = end + 1;
                    }
                    source += pattern.slice(cursor);
                    const result = compile([{ pattern: source }], { capturePhrases: markers });
                    if (result.unsupported.length) throw new Error(result.unsupported[0].reason);
                    for (const phrase of result.phrases) {
                        const stages = [], words = [];
                        const flush = () => { if (words.length) stages.push({grammar: "commands", phrases: [words.splice(0).join(" ")]}); };
                        for (const word of phrase.split(" ")) {
                            if (captures.has(word)) { flush(); stages.push(captures.get(word)); }
                            else words.push(word);
                        }
                        flush();
                        paths.push({ record, stages });
                    }
                    if (cache) {
                        const frozenPhrases=new WeakMap();
                        const stages = paths.slice(firstPath).map(path => Object.freeze(path.stages.map(stage => {
                            let phrases=frozenPhrases.get(stage.phrases);
                            if(!phrases){phrases=Object.freeze([...stage.phrases]);frozenPhrases.set(stage.phrases,phrases);}
                            return Object.freeze({...stage,phrases});
                        })));
                        if (cache.size >= 512) cache.delete(cache.keys().next().value);
                        cache.set(key, Object.freeze(stages));
                    }
                } catch (error) {
                    unsupported.push({ id: record.id || null, pattern, reason: String(error.message || error) });
                }
            }
            return { paths, unsupported };
        }
    }

    globalThis.VoskPhraseListCompiler = VoskPhraseListCompiler;
})();
