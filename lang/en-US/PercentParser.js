class EnglishSpokenPercentParser {
    static #ones = Object.freeze({
        zero: 0,
        oh: 0,
        o: 0,
        naught: 0,
        nought: 0,
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
        eleven: 11,
        twelve: 12,
        thirteen: 13,
        fourteen: 14,
        fifteen: 15,
        sixteen: 16,
        seventeen: 17,
        eighteen: 18,
        nineteen: 19
    });

    static #digitWords = Object.freeze({
        zero: "0",
        oh: "0",
        o: "0",
        naught: "0",
        nought: "0",
        one: "1",
        two: "2",
        three: "3",
        four: "4",
        five: "5",
        six: "6",
        seven: "7",
        eight: "8",
        nine: "9"
    });

    static #tens = Object.freeze({
        twenty: 20,
        thirty: 30,
        forty: 40,
        fifty: 50,
        sixty: 60,
        seventy: 70,
        eighty: 80,
        ninety: 90
    });

    // The recognizer contract uses the same lexical tables and supported
    // number forms as this parser. Meanings remain authoritative here.
    static spokenForms(value) {
        if (!Number.isInteger(value)||value<0||value>999) throw RangeError('Finite English number range is 0–999.');
        const small=Array.from({length:20},(_,n)=>Object.keys(this.#ones).find(word=>this.#ones[word]===n));
        const tens=Object.fromEntries(Object.entries(this.#tens).map(([word,n])=>[n,word]));
        const spell=n=>n>=100?[small[Math.floor(n/100)],'hundred',n%100?spell(n%100):''].filter(Boolean).join(' ')
            :n<20?small[n]:[tens[Math.floor(n/10)*10],n%10?small[n%10]:''].filter(Boolean).join(' ');
        const forms=[spell(value)];
        if(value>=100){
            const head=small[Math.floor(value/100)],rest=value%100;
            if(rest){
                forms.push(`${head} hundred and ${spell(rest)}`);
                forms.push(rest>=10?`${head} ${spell(rest)}`:`${head} oh ${spell(rest)}`);
            }
            if(value<200){forms.push(['a hundred',rest?spell(rest):''].filter(Boolean).join(' '));
                if(rest)forms.push(`a hundred and ${spell(rest)}`);}
        }
        return forms;
    }

    static parse(value) {
        const phrase =
            String(value ?? "")
                .toLocaleLowerCase(
                    "en-US"
                )
                .trim()
                .replace(/\btutu\b/g, "22")
                .replace(/\ba(?=\s+hundred\b)/g, "one")
                .replace(
                    /\s*(?:percent|per cent|%)\s*$/,
                    ""
                )
                .trim();

        if (
            /^\d+(?:\.\d+)?$/
                .test(phrase)
        ) {
            return Number(
                phrase
            );
        }

        const digitSequence =
            EnglishSpokenPercentParser
                .#digitSequence(
                    phrase
                );

        if (digitSequence !== undefined) {
            return Number(
                digitSequence
            );
        }

        const words =
            phrase
                .replace(
                    /[-–—]/g,
                    " "
                )
                .replace(
                    /\band\b/g,
                    " "
                )
                .split(/\s+/)
                .filter(Boolean);

        if (!words.length) {
            return undefined;
        }

        // Colloquial hundreds: "one twelve" = 112, "one twenty two" = 122.
        // Pure digit sequences ("one two") were handled above and remain 12.
        const leading = /^\d$/.test(words[0]) ? Number(words[0]) : this.#ones[words[0]];
        if (leading >= 1 && leading <= 9 && words.length >= 2 && words.length <= 3 &&
            !words.some(word => ["hundred","thousand"].includes(word))) {
            const tail = words.slice(1);
            let remainder;
            if (tail.length === 1) remainder = /^\d{2}$/.test(tail[0]) ? Number(tail[0]) : this.#ones[tail[0]] ?? this.#tens[tail[0]];
            else if (this.#tens[tail[0]] && this.#ones[tail[1]] >= 1 && this.#ones[tail[1]] <= 9)
                remainder = this.#tens[tail[0]] + this.#ones[tail[1]];
            if (remainder >= 10 && remainder <= 99) return leading * 100 + remainder;
        }

        let total = 0;
        let current = 0;

        for (const word of words) {
            if (
                Object.hasOwn(
                    EnglishSpokenPercentParser
                        .#ones,
                    word
                )
            ) {
                current +=
                    EnglishSpokenPercentParser
                        .#ones[
                            word
                        ];
            }
            else if (
                Object.hasOwn(
                    EnglishSpokenPercentParser
                        .#tens,
                    word
                )
            ) {
                current +=
                    EnglishSpokenPercentParser
                        .#tens[
                            word
                        ];
            }
            else if (
                word ===
                "hundred"
            ) {
                current =
                    (
                        current ||
                        1
                    ) *
                    100;
            }
            else if (
                word ===
                "thousand"
            ) {
                total +=
                    (
                        current ||
                        1
                    ) *
                    1000;
                current = 0;
            }
            else {
                return undefined;
            }
        }

        return total + current;
    }

    static #digitSequence(
        value
    ) {
        const tokens =
            String(
                value ||
                ""
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (tokens.length < 2) {
            return undefined;
        }

        let digits = "";

        for (
            let index = 0;
            index < tokens.length;
            index++
        ) {
            const token =
                tokens[index];

            let repeat = 1;

            if (
                token ===
                    "double" ||
                token ===
                    "triple"
            ) {
                repeat =
                    token ===
                        "double"
                        ? 2
                        : 3;
                index++;

                if (
                    index >=
                    tokens.length
                ) {
                    return undefined;
                }
            }

            const digitToken =
                tokens[index];
            const digit =
                /^\d$/.test(
                    digitToken
                )
                    ? digitToken
                    : EnglishSpokenPercentParser
                        .#digitWords[
                            digitToken
                        ];

            if (digit === undefined) {
                return undefined;
            }

            digits +=
                digit.repeat(
                    repeat
                );
        }

        return digits || undefined;
    }
}

globalThis.EnglishSpokenPercentParser =
    EnglishSpokenPercentParser;
