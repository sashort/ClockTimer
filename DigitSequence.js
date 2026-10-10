(() => {
    "use strict";
    globalThis.DigitSequence = Object.freeze({
        parse(value, vocabulary = {}) {
            const tokens = String(value ?? "").trim().toLowerCase().split(/\s+/);
            if (!tokens[0]) return null;
            let digits = "";
            for (const token of tokens) {
                if (/^[0-9]+$/.test(token)) digits += token;
                else if (Object.hasOwn(vocabulary, token) && /^[0-9]$/.test(String(vocabulary[token]))) digits += vocabulary[token];
                else return null;
            }
            return digits;
        }
    });
})();
