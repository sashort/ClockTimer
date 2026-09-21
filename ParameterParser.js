class ParameterParser {
    #parameters = [];
    #restParams;

    constructor(fn) {
        if (typeof fn !== "function") {
            throw new TypeError("ParameterParser requires a function.");
        }

        const source = Function.prototype.toString.call(fn);
        const parameterText = ParameterParser.#extractParameterList(source);

        const parameters = ParameterParser.#splitTopLevel(parameterText);

        parameters.forEach((parameter, index) => {
            const text = parameter.trim();

            // Rest parameter
            if (text.startsWith("...")) {
                const name = text.slice(3).trim();

                this.#restParams = {
                    name,
                    value: []
                };

                return;
            }

            const parsed = ParameterParser.#parseParameter(text);

            /*
             * Keep the parameter at exactly the same index as it
             * appeared in the function's parameter list.
             */
            this.#parameters[index] = {
                name: parsed.name,
                value: parsed.defaultValue,
                default: parsed.defaultValue
            };
        });
    }

    /**
     * Return a parameter's current value.
     */
    getArgument(paramName) {
        for (const parameter of this.#parameters) {
            if (parameter && parameter.name === paramName) {
                return parameter.value;
            }
        }

        if (
            this.#restParams !== undefined &&
            this.#restParams.name === paramName
        ) {
            return this.#restParams.value;
        }

        return undefined;
    }

    /**
     * Set a parameter's current value.
     *
     * If value is undefined:
     *   - ordinary parameters with defaults are reset to their default
     *   - ordinary parameters without defaults become undefined
     *   - rest parameters become []
     */
    setArgument(paramName, value) {
        for (const parameter of this.#parameters) {
            if (parameter && parameter.name === paramName) {
                if (value === undefined && parameter.default !== undefined) {
                    parameter.value = parameter.default;
                } else {
                    parameter.value = value;
                }

                return;
            }
        }

        if (
            this.#restParams !== undefined &&
            this.#restParams.name === paramName
        ) {
            if (value === undefined) {
                this.#restParams.value = [];
            } else {
                this.#restParams.value = Array.isArray(value)
                    ? value
                    : [value];
            }
        }
    }

    /**
     * Get or set the rest parameter's value.
     */
    get restArguments() {
        if (this.#restParams === undefined) {
            return undefined;
        }

        return this.#restParams.value;
    }

    set restArguments(value) {
        if (this.#restParams === undefined) {
            return;
        }

        if (value === undefined || value === null) {
            this.#restParams.value = [];
            return;
        }

        this.#restParams.value = Array.isArray(value)
            ? value
            : [value];
    }

    /**
     * Return the arguments in positional order, followed by rest arguments.
     */
    argumentArray() {
        const result = this.#parameters.map(parameter =>
            parameter ? parameter.value : undefined
        );

        if (
            this.#restParams !== undefined &&
            Array.isArray(this.#restParams.value) &&
            this.#restParams.value.length > 0
        ) {
            result.push(...this.#restParams.value);
        }

        return result;
    }

    // ------------------------------------------------------------
    // Private static parsing functions
    // ------------------------------------------------------------

    /**
     * Extract the parameter portion from:
     *
     *   function foo(a, b) {}
     *   async function foo(a, b) {}
     *   (a, b) => {}
     *   a => {}
     *   class method(a, b) {}
     */
    static #extractParameterList(source) {
        source = source.trim();

        // Remove leading "async" for arrow functions.
        const arrowIndex = ParameterParser.#findTopLevelArrow(source);

        if (arrowIndex !== -1) {
            let left = source.slice(0, arrowIndex).trim();

            if (left.startsWith("async")) {
                left = left.slice(5).trim();
            }

            // `(a, b) =>`
            if (left.startsWith("(")) {
                const close = ParameterParser.#findMatching(
                    left,
                    0,
                    "(",
                    ")"
                );

                return left.slice(1, close);
            }

            // `a =>`
            return left;
        }

        // Traditional function:
        // function name(a, b) {}
        // async function name(a, b) {}
        // function* name(a, b) {}
        const open = source.indexOf("(");

        if (open === -1) {
            // A method may theoretically have no parameters.
            return "";
        }

        const close = ParameterParser.#findMatching(
            source,
            open,
            "(",
            ")"
        );

        return source.slice(open + 1, close);
    }

    /**
     * Parse one parameter recursively.
     */
    static #parseParameter(parameterText) {
        const text = parameterText.trim();

        const equalsIndex = ParameterParser.#findTopLevelCharacter(
            text,
            "="
        );

        let parameterPart;
        let defaultExpression;

        if (equalsIndex !== -1) {
            parameterPart = text.slice(0, equalsIndex).trim();
            defaultExpression = text.slice(equalsIndex + 1).trim();
        } else {
            parameterPart = text;
        }

        /*
         * Destructured parameters:
         *
         * { a, b = 10, c: { d = 20 } }
         * [a, b = 10]
         *
         * Recursively parse their contents.
         */
        if (
            parameterPart.startsWith("{") ||
            parameterPart.startsWith("[")
        ) {
            const destructured = ParameterParser.#parseDestructuring(
                parameterPart
            );

            /*
             * The outer destructuring parameter itself has no single
             * variable name. We expose the individual variables while
             * preserving the outer parameter's position.
             */
            const name = destructured.name;

            return {
                name,
                defaultValue:
                    defaultExpression !== undefined
                        ? ParameterParser.#evaluateDefault(
                              defaultExpression
                          )
                        : undefined
            };
        }

        /*
         * Remove TypeScript-style whitespace only around the identifier.
         * This class otherwise targets JavaScript.
         */
        const name = parameterPart.trim();

        let defaultValue;

        if (defaultExpression !== undefined) {
            defaultValue = ParameterParser.#evaluateDefault(
                defaultExpression
            );
        } else {
            defaultValue = undefined;
        }

        return {
            name,
            defaultValue
        };
    }

    /**
     * Recursively inspect destructuring.
     *
     * The returned name is the textual destructuring expression.
     * The recursion is performed so nested defaults/destructuring
     * are parsed correctly rather than being broken by commas.
     */
    static #parseDestructuring(text) {
        const opening = text[0];
        const closing = opening === "{" ? "}" : "]";

        const end = ParameterParser.#findMatching(
            text,
            0,
            opening,
            closing
        );

        const contents = text.slice(1, end);
        const members = ParameterParser.#splitTopLevel(contents);

        for (const member of members) {
            const trimmed = member.trim();

            if (!trimmed || trimmed.startsWith("...")) {
                continue;
            }

            const colonIndex = ParameterParser.#findTopLevelCharacter(
                trimmed,
                ":"
            );

            let valuePart =
                colonIndex === -1
                    ? trimmed
                    : trimmed.slice(colonIndex + 1).trim();

            /*
             * Recursively inspect nested destructuring.
             */
            if (
                valuePart.startsWith("{") ||
                valuePart.startsWith("[")
            ) {
                ParameterParser.#parseDestructuring(valuePart);
                continue;
            }

            const equalsIndex =
                ParameterParser.#findTopLevelCharacter(
                    valuePart,
                    "="
                );

            if (equalsIndex !== -1) {
                const defaultExpression = valuePart
                    .slice(equalsIndex + 1)
                    .trim();

                ParameterParser.#evaluateDefault(
                    defaultExpression
                );
            }
        }

        return {
            name: text,
            defaultValue: undefined
        };
    }

    /**
     * Evaluate a default expression.
     *
     * This deliberately evaluates the complete expression, so things
     * such as these remain intact:
     *
     *   x = function(a, b) {}
     *   x = async function(a, b) {}
     *   x = (a, b) => a + b
     *   x = { a: 1, b: 2 }
     *   x = [1, 2, 3]
     *
     * The expression is evaluated as JavaScript rather than trying to
     * parse commas inside it manually.
     */
    static #evaluateDefault(expression) {
        try {
            return Function(`"use strict"; return (${expression});`)();
        } catch {
            /*
             * A default can reference a variable from the original
             * function's closure. That variable is unavailable to a
             * dynamically-created Function.
             *
             * Preserve the expression rather than throwing.
             */
            return expression;
        }
    }

    /**
     * Split a string on top-level commas only.
     *
     * Handles:
     *   (), {}, []
     *   strings
     *   template literals
     *   comments
     */
    static #splitTopLevel(text) {
        const result = [];
        let start = 0;

        let paren = 0;
        let brace = 0;
        let bracket = 0;

        let quote = null;
        let template = false;
        let escaped = false;
        let lineComment = false;
        let blockComment = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const next = text[i + 1];

            if (lineComment) {
                if (ch === "\n") {
                    lineComment = false;
                }
                continue;
            }

            if (blockComment) {
                if (ch === "*" && next === "/") {
                    blockComment = false;
                    i++;
                }
                continue;
            }

            if (!quote && !template) {
                if (ch === "/" && next === "/") {
                    lineComment = true;
                    i++;
                    continue;
                }

                if (ch === "/" && next === "*") {
                    blockComment = true;
                    i++;
                    continue;
                }
            }

            if (quote) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === quote) {
                    quote = null;
                }

                continue;
            }

            if (template) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === "`") {
                    template = false;
                }

                /*
                 * Template literal interpolation is intentionally left
                 * intact because commas inside `${...}` must not split
                 * the outer parameter.
                 */
                continue;
            }

            if (ch === "'" || ch === '"') {
                quote = ch;
                continue;
            }

            if (ch === "`") {
                template = true;
                continue;
            }

            switch (ch) {
                case "(":
                    paren++;
                    break;

                case ")":
                    paren--;
                    break;

                case "{":
                    brace++;
                    break;

                case "}":
                    brace--;
                    break;

                case "[":
                    bracket++;
                    break;

                case "]":
                    bracket--;
                    break;

                case ",":
                    if (
                        paren === 0 &&
                        brace === 0 &&
                        bracket === 0
                    ) {
                        result.push(text.slice(start, i).trim());
                        start = i + 1;
                    }
                    break;
            }
        }

        const last = text.slice(start).trim();

        if (last) {
            result.push(last);
        }

        return result;
    }

    /**
     * Find a top-level occurrence of a character such as "=" or ":".
     */
    static #findTopLevelCharacter(text, target) {
        let paren = 0;
        let brace = 0;
        let bracket = 0;

        let quote = null;
        let template = false;
        let escaped = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (quote) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === quote) {
                    quote = null;
                }

                continue;
            }

            if (template) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === "`") {
                    template = false;
                }

                continue;
            }

            if (ch === "'" || ch === '"') {
                quote = ch;
                continue;
            }

            if (ch === "`") {
                template = true;
                continue;
            }

            switch (ch) {
                case "(":
                    paren++;
                    break;

                case ")":
                    paren--;
                    break;

                case "{":
                    brace++;
                    break;

                case "}":
                    brace--;
                    break;

                case "[":
                    bracket++;
                    break;

                case "]":
                    bracket--;
                    break;

                default:
                    if (
                        ch === target &&
                        paren === 0 &&
                        brace === 0 &&
                        bracket === 0
                    ) {
                        return i;
                    }
            }
        }

        return -1;
    }

    /**
     * Find matching (), {}, or [].
     */
    static #findMatching(text, start, opening, closing) {
        let depth = 0;
        let quote = null;
        let template = false;
        let escaped = false;

        for (let i = start; i < text.length; i++) {
            const ch = text[i];

            if (quote) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === quote) {
                    quote = null;
                }

                continue;
            }

            if (template) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === "`") {
                    template = false;
                }

                continue;
            }

            if (ch === "'" || ch === '"') {
                quote = ch;
                continue;
            }

            if (ch === "`") {
                template = true;
                continue;
            }

            if (ch === opening) {
                depth++;
            } else if (ch === closing) {
                depth--;

                if (depth === 0) {
                    return i;
                }
            }
        }

        throw new SyntaxError(
            `Unable to find matching ${closing}.`
        );
    }

    /**
     * Locate a top-level =>.
     */
    static #findTopLevelArrow(source) {
        let paren = 0;
        let brace = 0;
        let bracket = 0;

        let quote = null;
        let template = false;
        let escaped = false;

        for (let i = 0; i < source.length - 1; i++) {
            const ch = source[i];
            const next = source[i + 1];

            if (quote) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === quote) {
                    quote = null;
                }

                continue;
            }

            if (template) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === "`") {
                    template = false;
                }

                continue;
            }

            if (ch === "'" || ch === '"') {
                quote = ch;
                continue;
            }

            if (ch === "`") {
                template = true;
                continue;
            }

            if (ch === "(") paren++;
            else if (ch === ")") paren--;
            else if (ch === "{") brace++;
            else if (ch === "}") brace--;
            else if (ch === "[") bracket++;
            else if (ch === "]") bracket--;

            if (
                ch === "=" &&
                next === ">" &&
                paren === 0 &&
                brace === 0 &&
                bracket === 0
            ) {
                return i;
            }
        }

        return -1;
    }
}

/*
create a JavaScript class named "ParameterParser". The constructor takes a function object as its only parameter. The constructor parses a function's parameters into a private array. The private array must not contain the rest parameter. "ParameterParser" must have a private variable "restParams" with no value assigned to it (undefined). The constructor needs to handle positional, default, rest, and destructured parameters. The constructor checks recursively in default or destructured parameter values for nested parameters. Make sure the positional parameters are in the same index matching the parameter list. Make sure to check if a default value is a function, async function, arrow function, or anonymous function and handle it correctly. The constructor must set "restParams" to a new object containing 1) "name" = the rest parameter name, 2) "value" initialized to a new empty array if the function has a trailing rest parameter. Each index in the private array should contain an object with the parameter "name", "value" and "default". Set "default" and "value" equal to the parameter's default value. If the parameter is not does not have a default value, set "value" and "default" to undefined. "ParameterParser" must have a function named "getParameter" to get a parameter's "value". "getParameter" has a string parameter named "paramName". if "getParameter" doesn't match any "name" in the private array, check if "restParams"'s "name" matches. If it matches, return "restParams"'s "value". "ParameterParser" must have a function named "setParameter" to set any "value". "setParameter" has 2 parameters; string "paramName" and "value". if "paramName" matches "restParams"'s "name": 1) if "setParameter"'s "value" is not array, change "setParameter"'s "value" to an array containing the original "value". 2) set "restParams"'s "value" = "setParameter"'s "value". If "paramName" matches "name" inside the private array, set the matching "value" = "setParameter"'s "value". "getParameter" and "setParameter" iterate through the private array and matches "paramName" to "name". If "setParameter"'s "value" is undefined, it matches a "name" in the private array, and the match has a default value, set the match's "value" to the match's "default" value. If "setParameter"'s value is undefined and it matches "restParams"'s "name", set "restParams"'s "value" = an empty array. "ParameterParser" must have a a getter and setter function called "restParameters". If "restParams" is undefined, 1) "restParameters" getter returns undefined 2) "restParameters" setter does not change "restParams". 3) if "restParams" isn't undefined, "restParams" gets/sets "restParams"'s "value". If "restParameters" setter is passed undefined or null, "restParams"'s "value" is set to and empty array. The class must have a function called "argumentList". "argumentList" will return an array containing all the "values" from the private array. If "restParams" is not undefined and has at least 1 element in its "value" array, append all elements in "restParams"'s "value" to the return array.
*/