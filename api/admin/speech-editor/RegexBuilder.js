(() => {
    "use strict";

    const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
    const TYPES = new Set([
        "letters",
        "digits",
        "decimal",
        "words",
        "alphanumeric",
        "time",
        "duration",
        "percent",
        "date"
    ]);

    const templates = Object.freeze([
        {token:"<letters:3>", label:"Letters", description:"Exact or ranged letters: <letters:3>, <letters:2..5>, <letters:+>."},
        {token:"<digits:3>", label:"Digits", description:"Exact or ranged digits: <digits:3>, <digits:2..5>, <digits:+>."},
        {token:"<decimal:2.2>", label:"Decimal", description:"Digits before and after a decimal point."},
        {token:"<words:+>", label:"Words", description:"One or more words; ranges such as <words:2..4> are supported."},
        {token:"<alphanumeric:3..8>", label:"Alphanumeric", description:"Letters or digits with an exact or ranged length."},
        {token:"<time>", label:"Time", description:"A named spoken-time slot."},
        {token:"<duration>", label:"Duration", description:"A named spoken-duration slot."},
        {token:"<percent>", label:"Percent", description:"A named spoken-percent slot."},
        {token:"<date>", label:"Date", description:"A named spoken-date slot."}
    ]);

    const escapeRegex = value =>
        String(value).replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");

    const normalizeLiteral = value =>
        String(value || "")
            .toLowerCase()
            .replace(/[’']/g, "")
            .replace(/[^a-z0-9\s]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const parseCount = (value, fallback = "+") => {
        const source = String(value || fallback).trim();

        if (source === "+" || source === "*") return source;

        if (/^\d+$/.test(source)) {
            const count = Number(source);
            if (count < 1) throw new Error("Template length must be at least 1.");
            return {min:count, max:count};
        }

        let match = /^(\d+)\.\.(\d+)$/.exec(source);
        if (match) {
            const min = Number(match[1]);
            const max = Number(match[2]);
            if (max < min) throw new Error("Template range is invalid.");
            return {min, max};
        }

        match = /^(\d+)\.\.$/.exec(source);
        if (match) return {min:Number(match[1]), max:undefined};

        throw new Error("Use an exact length, min..max, min.., +, or *.");
    };

    const characterSequence = (characterClass, spec) => {
        const count = parseCount(spec);

        if (count === "+") {
            return "(?:" + characterClass + "\\s*)+";
        }

        if (count === "*") {
            return "(?:" + characterClass + "\\s*)*";
        }

        if (count.min === count.max) {
            if (count.min === 1) return characterClass;
            return characterClass + "(?:\\s*" + characterClass + "){" + (count.min - 1) + "}";
        }

        if (count.min === 0) {
            const maxTail = count.max === undefined
                ? ""
                : "," + Math.max(0, count.max - 1);

            return "(?:" + characterClass +
                "(?:\\s*" + characterClass + "){0" + maxTail + "})?";
        }

        const tailMin = Math.max(0, count.min - 1);
        const tailMax = count.max === undefined
            ? ""
            : String(Math.max(0, count.max - 1));

        return characterClass +
            "(?:\\s*" + characterClass + "){" +
            tailMin + "," + tailMax + "}";
    };

    const wordsPattern = spec => {
        const count = parseCount(spec);
        const word = "[a-z0-9]+";

        if (count === "+") return word + "(?:\\s+" + word + ")*";
        if (count === "*") return "(?:" + word + "(?:\\s+" + word + ")*)?";

        if (count.min === count.max) {
            if (count.min === 1) return word;
            return word + "(?:\\s+" + word + "){" + (count.min - 1) + "}";
        }

        if (count.min === 0) {
            if (count.max === undefined) {
                return "(?:" + word + "(?:\\s+" + word + ")*)?";
            }

            return "(?:" + word + "(?:\\s+" + word + "){0," +
                Math.max(0, count.max - 1) + "})?";
        }

        const tailMin = Math.max(0, count.min - 1);
        const tailMax = count.max === undefined
            ? ""
            : String(Math.max(0, count.max - 1));

        return word + "(?:\\s+" + word + "){" +
            tailMin + "," + tailMax + "}";
    };

    const genericSlotPattern = () =>
        "[a-z0-9]+(?:\\s+[a-z0-9]+)*";

    const inferWildcard = raw => {
        const value = String(raw || "").trim();
        const named = /^([A-Za-z_$][\w$]*):(.*)$/.exec(value);
        const name = named ? named[1] : "";
        const body = named ? named[2] : value;
        const withName = canonical => name ? name + ":" + canonical : canonical;
        const candidates = [];

        if (/^A+$/.test(body)) {
            candidates.push(withName("letters:" + body.length));
        }

        if (/^#+$/.test(body)) {
            candidates.push(withName("digits:" + body.length));
        }

        const decimal = /^(#+)\.(#+)$/.exec(body);
        if (decimal) {
            candidates.push(
                withName(
                    "decimal:" + decimal[1].length + "." + decimal[2].length
                )
            );
        }

        if (/^X+$/.test(body)) {
            candidates.push(withName("alphanumeric:" + body.length));
        }

        if (/^W+$/.test(body)) {
            candidates.push(withName("words:" + body.length));
        }

        const shorthand = /^([A#XW])([+*])$/.exec(body);
        if (shorthand) {
            const type = {
                A:"letters",
                "#":"digits",
                X:"alphanumeric",
                W:"words"
            }[shorthand[1]];

            candidates.push(withName(type + ":" + shorthand[2]));
        }

        if (body === "+" || body === "*") {
            for (const type of ["letters","digits","words","alphanumeric"]) {
                candidates.push(withName(type + ":" + body));
            }
        }

        return [...new Set(candidates)];
    };

    const splitSlot = source => {
        const parts = source.split(":");
        let name = "";
        let type;
        let spec = "";

        if (
            parts.length >= 2 &&
            IDENTIFIER.test(parts[0]) &&
            TYPES.has(parts[1])
        ) {
            name = parts.shift();
            type = parts.shift();
            spec = parts.join(":");
        }
        else {
            type = parts.shift();
            spec = parts.join(":");
        }

        return {name, type, spec};
    };

    const compileSlot = raw => {
        const inferred = inferWildcard(raw);
        const source = inferred.length === 1
            ? inferred[0]
            : String(raw || "").trim();

        if (!source) throw new Error("Angle brackets cannot be empty.");

        const {name, type, spec} = splitSlot(source);
        let pattern;

        if (type === "letters") {
            pattern = characterSequence("[a-z]", spec);
        }
        else if (type === "digits") {
            pattern = characterSequence("\\d", spec);
        }
        else if (type === "alphanumeric") {
            pattern = characterSequence("[a-z0-9]", spec);
        }
        else if (type === "words") {
            pattern = wordsPattern(spec);
        }
        else if (type === "decimal") {
            const match = /^(\d+)\.(\d+)$/.exec(spec);
            if (!match) throw new Error("Decimal templates use <decimal:2.2>.");

            pattern =
                characterSequence("\\d", match[1]) +
                "\\s*\\.\\s*" +
                characterSequence("\\d", match[2]);
        }
        else if (["time","duration","percent","date"].includes(type)) {
            pattern = genericSlotPattern();
        }
        else if (IDENTIFIER.test(source)) {
            return "(?<" + source + ">" + genericSlotPattern() + ")";
        }
        else if (inferred.length > 1) {
            throw new Error(
                "This wildcard matches more than one template. Choose one from the picker."
            );
        }
        else {
            throw new Error("Unknown angle-bracket template.");
        }

        const captureName =
            name ||
            (["time","duration","percent","date"].includes(type) ? type : "");

        return captureName
            ? "(?<" + captureName + ">" + pattern + ")"
            : "(?:" + pattern + ")";
    };

    const findClosing = (source, start, open, close) => {
        let depth = 1;

        for (let index = start + 1; index < source.length; index++) {
            if (source[index] === open) depth++;
            else if (source[index] === close) {
                depth--;
                if (depth === 0) return index;
            }
        }

        return -1;
    };

    const splitAlternatives = source => {
        const values = [];
        let start = 0;
        let angle = 0;
        let square = 0;
        let curly = 0;

        for (let index = 0; index < source.length; index++) {
            const char = source[index];

            if (char === "<") angle++;
            else if (char === ">") angle--;
            else if (char === "[") square++;
            else if (char === "]") square--;
            else if (char === "{") curly++;
            else if (char === "}") curly--;
            else if (
                char === "|" &&
                angle === 0 &&
                square === 0 &&
                curly === 0
            ) {
                values.push(source.slice(start, index));
                start = index + 1;
            }
        }

        values.push(source.slice(start));
        return values;
    };

    const parseAtoms = source => {
        const atoms = [];
        let literal = "";

        const flush = () => {
            const normalized = normalizeLiteral(literal);

            if (normalized) {
                for (const word of normalized.split(" ")) {
                    atoms.push({
                        optional:false,
                        pattern:escapeRegex(word)
                    });
                }
            }

            literal = "";
        };

        for (let index = 0; index < source.length; index++) {
            const char = source[index];

            if (/\s/.test(char)) {
                flush();
                continue;
            }

            if (char === "<") {
                flush();
                const end = findClosing(source, index, "<", ">");
                if (end < 0) throw new Error("Close the <…> template.");

                atoms.push({
                    optional:false,
                    pattern:compileSlot(source.slice(index + 1, end))
                });

                index = end;
                continue;
            }

            if (char === "[") {
                flush();
                const end = findClosing(source, index, "[", "]");
                if (end < 0) throw new Error("Close the […] optional group.");

                const inner = compileSequence(source.slice(index + 1, end));
                if (!inner) throw new Error("Optional groups cannot be empty.");

                atoms.push({optional:true, pattern:inner});
                index = end;
                continue;
            }

            if (char === "{") {
                flush();
                const end = findClosing(source, index, "{", "}");
                if (end < 0) throw new Error("Close the {…} alternative group.");

                const options =
                    splitAlternatives(source.slice(index + 1, end))
                        .map(value => compileSequence(value))
                        .filter(Boolean);

                if (options.length < 2) {
                    throw new Error(
                        "Alternative groups need at least two values separated by |."
                    );
                }

                atoms.push({
                    optional:false,
                    pattern:"(?:" + options.join("|") + ")"
                });

                index = end;
                continue;
            }

            if (char === "]" || char === "}" || char === ">") {
                throw new Error("Unexpected " + char + ".");
            }

            literal += char;
        }

        flush();
        return atoms;
    };

    function compileSequence(source) {
        const atoms = parseAtoms(source);
        let result = "";
        let seenRequired = false;

        for (let index = 0; index < atoms.length; index++) {
            const atom = atoms[index];
            const hasLater =
                index < atoms.length - 1;

            if (atom.optional) {
                result += seenRequired
                    ? "(?:\\s+" + atom.pattern + ")?"
                    : "(?:" + atom.pattern + (hasLater ? "\\s+" : "") + ")?";
            }
            else if (seenRequired) {
                result += "\\s+" + atom.pattern;
            }
            else {
                result += atom.pattern;
                seenRequired = true;
            }
        }

        return result;
    }

    const compile = source => {
        const input = String(source || "").trim();

        if (!input) {
            return {
                valid:false,
                pattern:"",
                error:"Enter a phrase template."
            };
        }

        try {
            const body = compileSequence(input);
            if (!body) {
                throw new Error(
                    "The phrase template is empty after normalization."
                );
            }

            const pattern = "^" + body + "$";
            new RegExp(pattern, "i");

            return {
                valid:true,
                pattern,
                error:""
            };
        }
        catch (error) {
            return {
                valid:false,
                pattern:"",
                error:error instanceof Error
                    ? error.message
                    : String(error)
            };
        }
    };

    globalThis.WMOFRegexBuilder = Object.freeze({
        compile,
        inferWildcard,
        templates,
        normalizeLiteral
    });
})();
