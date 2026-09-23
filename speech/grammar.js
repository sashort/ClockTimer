const MAX_PHRASES = 128;
const MAX_PHRASE_LENGTH = 160;
const MAX_OPTIONS_PER_GROUP = 64;
const MAX_OPTION_LENGTH = 80;

const RESERVED_RULES = Object.freeze({
    clock: "clock",
    time: "clock",
    duration: "duration",
    percent: "percent",
    number: "number",
    integer: "integer"
});

const PROMPT_EXAMPLES = Object.freeze({
    clock: "five thirty",
    time: "five thirty",
    duration: "one hour fifteen",
    percent: "one hundred percent",
    number: "twenty five",
    integer: "twenty five"
});

function normalizeList(
    input,
    {
        maxItems = MAX_PHRASES,
        maxLength = MAX_PHRASE_LENGTH
    } = {}
) {
    const values = [];

    for (
        const value of
            Array.isArray(input)
                ? input
                : []
    ) {
        const text =
            String(value ?? "")
                .toLocaleLowerCase("en-US")
                .trim()
                .replace(/\s+/g, " ")
                .slice(0, maxLength);

        if (
            text &&
            !values.includes(text)
        ) {
            values.push(text);
        }

        if (values.length >= maxItems) {
            break;
        }
    }

    return values;
}

function normalizeOptions(input) {
    if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input)
    ) {
        return {};
    }

    const options = {};

    for (
        const [name, values] of
            Object.entries(input)
    ) {
        const key =
            String(name || "")
                .trim()
                .toLocaleLowerCase("en-US");

        if (!key) continue;

        const normalized =
            normalizeList(
                values,
                {
                    maxItems:
                        MAX_OPTIONS_PER_GROUP,
                    maxLength:
                        MAX_OPTION_LENGTH
                }
            );

        if (normalized.length) {
            options[key] = normalized;
        }
    }

    return options;
}

function quote(value) {
    return JSON.stringify(
        String(value)
    );
}

function ruleName(value) {
    const normalized =
        String(value || "")
            .toLocaleLowerCase("en-US")
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "");

    return normalized
        ? `option-${normalized}`
        : undefined;
}

function optionRuleName(
    name,
    options
) {
    return options[name]
        ? ruleName(name)
        : undefined;
}

function compilePhrase(
    phrase,
    options,
    referencedOptions
) {
    const parts = [];
    const expression =
        /<([a-zA-Z][a-zA-Z0-9_-]*)>/g;

    let cursor = 0;
    let match;

    while (
        (
            match =
                expression.exec(phrase)
        ) !== null
    ) {
        const literal =
            phrase.slice(
                cursor,
                match.index
            );

        if (literal) {
            parts.push(
                quote(literal)
            );
        }

        const placeholder =
            match[1]
                .toLocaleLowerCase(
                    "en-US"
                );

        const reserved =
            RESERVED_RULES[
                placeholder
            ];

        if (reserved) {
            parts.push(reserved);
        }
        else {
            const optionRule =
                optionRuleName(
                    placeholder,
                    options
                );

            if (!optionRule) {
                return undefined;
            }

            referencedOptions.add(
                placeholder
            );
            parts.push(optionRule);
        }

        cursor =
            match.index +
            match[0].length;
    }

    const tail =
        phrase.slice(cursor);

    if (tail) {
        parts.push(
            quote(tail)
        );
    }

    return parts.length
        ? parts.join(" ")
        : undefined;
}

function optionRule(
    name,
    values
) {
    const id =
        ruleName(name);

    return `${id} ::= ${values
        .map(quote)
        .join(" | ")}`;
}

const CORE_RULES = Object.freeze([
    'digit ::= [0-9]',
    'digits ::= digit+',
    'digit-word ::= "zero" | "oh" | "one" | "two" | "three" | "four" | "five" | "six" | "seven" | "eight" | "nine"',
    'one-nine ::= "one" | "two" | "three" | "four" | "five" | "six" | "seven" | "eight" | "nine"',
    'zero-nineteen ::= "zero" | "oh" | "one" | "two" | "three" | "four" | "five" | "six" | "seven" | "eight" | "nine" | "ten" | "eleven" | "twelve" | "thirteen" | "fourteen" | "fifteen" | "sixteen" | "seventeen" | "eighteen" | "nineteen"',
    'tens ::= "twenty" | "thirty" | "forty" | "fifty" | "sixty" | "seventy" | "eighty" | "ninety"',
    'under-hundred ::= zero-nineteen | tens (" " one-nine)?',
    'hundreds ::= one-nine " hundred" ((" and")? " " under-hundred)?',
    'under-thousand ::= hundreds | under-hundred',
    'thousands ::= under-thousand " thousand" ((" and")? " " under-thousand)?',
    'spoken-integer ::= thousands | under-thousand',
    'integer ::= digits | spoken-integer',
    'sign ::= "negative " | "minus "',
    'decimal-piece ::= digit | digit-word',
    'number ::= sign? integer (" point " decimal-piece (" " decimal-piece)*)?',
    'minute-spoken ::= zero-nineteen | ("twenty" | "thirty" | "forty" | "fifty") (" " one-nine)?',
    'minute-digits ::= [0-5]?[0-9]',
    'clock-hour-spoken ::= zero-nineteen | "twenty" (" " ("one" | "two" | "three"))?',
    'clock-hour-digits ::= [0-2]?[0-9]',
    'clock-hour ::= clock-hour-spoken | clock-hour-digits',
    'meridiem ::= "am" | "pm" | "a m" | "p m"',
    'clock-day ::= "today" | "tomorrow"',
    'relative-clock ::= ("quarter" | "half" | minute-spoken) " " ("past" | "after" | "to" | "till" | "until") " " clock-hour',
    'clock-value ::= clock-hour (":" minute-digits | " " minute-spoken)?',
    'clock ::= (clock-day " ")? ("noon" | "midnight" | relative-clock | clock-value (" " meridiem)?) (" " clock-day)?',
    'hour-unit ::= "hour" | "hours" | "hr" | "hrs"',
    'minute-unit ::= "minute" | "minutes" | "min" | "mins"',
    'second-unit ::= "second" | "seconds" | "sec" | "secs"',
    'hour-amount ::= number | "a" | "an"',
    'duration-clock ::= digits ":" minute-digits (":" minute-digits)?',
    'hour-duration ::= hour-amount " " hour-unit ((" and")? " " minute-spoken (" " minute-unit)? ((" and")? " " minute-spoken " " second-unit)?)?',
    'minute-duration ::= number " " minute-unit ((" and")? " " minute-spoken " " second-unit)?',
    'second-duration ::= number " " second-unit',
    'duration-bare ::= number (" " minute-spoken)?',
    'duration ::= duration-clock | hour-duration | minute-duration | second-duration | duration-bare',
    'percent ::= number (" percent" | " per cent" | "%")?'
]);

export function buildRecognitionGrammar(
    context = {}
) {
    const phrases =
        normalizeList(
            context?.phrases
        );

    if (!phrases.length) {
        return undefined;
    }

    const options =
        normalizeOptions(
            context?.options
        );

    const referencedOptions =
        new Set();

    const compiled =
        phrases
            .map(
                phrase =>
                    compilePhrase(
                        phrase,
                        options,
                        referencedOptions
                    )
            )
            .filter(Boolean);

    if (!compiled.length) {
        return undefined;
    }

    const lines = [
        'root ::= " " command [.!?]?',
        `command ::= ${compiled.join(" | ")}`
    ];

    for (
        const name of
            referencedOptions
    ) {
        lines.push(
            optionRule(
                name,
                options[name]
            )
        );
    }

    lines.push(
        ...CORE_RULES
    );

    return {
        rule: "root",
        grammar:
            lines.join("\n"),
        phrases:
            phrases.slice()
    };
}

export function buildRecognitionPrompt(
    context = {}
) {
    const phrases =
        normalizeList(
            context?.phrases
        );

    const vocabulary =
        normalizeList(
            context?.vocabulary,
            {
                maxItems: 128,
                maxLength: 80
            }
        );

    const options =
        normalizeOptions(
            context?.options
        );

    const values = [];

    const append = value => {
        const text =
            String(value ?? "")
                .trim();

        if (
            text &&
            !values.includes(text)
        ) {
            values.push(text);
        }
    };

    for (const phrase of phrases) {
        append(
            phrase.replace(
                /<([a-zA-Z][a-zA-Z0-9_-]*)>/g,
                (_, rawName) => {
                    const name =
                        rawName
                            .toLocaleLowerCase(
                                "en-US"
                            );

                    return (
                        options[name]?.[0] ||
                        PROMPT_EXAMPLES[
                            name
                        ] ||
                        ""
                    );
                }
            )
            .replace(/\s+/g, " ")
            .trim()
        );
    }

    for (
        const value of vocabulary
    ) {
        append(value);
    }

    for (
        const optionValues of
            Object.values(options)
    ) {
        for (
            const value of
                optionValues
        ) {
            append(value);
        }
    }

    return values
        .join(". ")
        .slice(0, 1000);
}
