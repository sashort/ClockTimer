class SpeechMenu {
    static #wakePhrase = /^listen$/i;
    static #sleepPhrase = /^mute$/i;
    static #stopped = true;
    static #sleeping = false;
    static #Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    static #recognition;
    static #starting = false;
    static #debug = false;
    static #debugFunction = data => console.log(data);
    static #events = new EventTarget();
    static #separator = ",";
    static #language = "en-US";

    static {
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                try { SpeechMenu.#recognition?.abort(); } catch {}
            } else if (!SpeechMenu.#stopped) SpeechMenu.#startEngine();
        });
    }

    static get events() { return SpeechMenu.#events; }
    static get wakePhrase() { return SpeechMenu.#wakePhrase; }
    static get sleepPhrase() { return SpeechMenu.#sleepPhrase; }
    static get debug() { return SpeechMenu.#debug; }
    static get debugFunction() { return SpeechMenu.#debugFunction; }

    static set wakePhrase(value) { SpeechMenu.#setPhrase("wake", value); }
    static set sleepPhrase(value) { SpeechMenu.#setPhrase("sleep", value); }
    static set debug(value) {
        const next = Boolean(value);
        if (next === SpeechMenu.#debug) return;
        SpeechMenu.#debug = next;
        SpeechMenu.#emit("debugToggle", {debug: next});
    }
    static set debugFunction(value) {
        SpeechMenu.#debugFunction = typeof value === "function" ? value : data => console.log(data);
        SpeechMenu.#emit("debugFunctionChange", {debugFunction: SpeechMenu.#debugFunction});
    }

    static start(language = "en-US", listSeparator = ",") {
        SpeechMenu.#language = typeof language === "string" && language.trim() ? language : "en-US";
        SpeechMenu.#separator = typeof listSeparator === "string" && listSeparator ? listSeparator : ",";
        SpeechMenu.#stopped = false;
        SpeechMenu.#sleeping = false;
        if (!SpeechMenu.#startEngine()) return false;
        SpeechMenu.#emit("start", {language: SpeechMenu.#language});
        return true;
    }

    static stop() {
        const running = !SpeechMenu.#stopped;
        SpeechMenu.#stopped = true;
        SpeechMenu.#sleeping = false;
        SpeechMenu.#starting = false;
        try { SpeechMenu.#recognition?.abort(); } catch {}
        SpeechMenu.#recognition = undefined;
        if (running) SpeechMenu.#emit("stop");
    }

    static refresh() {
        for (const element of document.querySelectorAll("[speech-pattern]")) SpeechMenu.#prepare(element, true);
    }

    static #emit(type, detail) {
        SpeechMenu.#events.dispatchEvent(new CustomEvent(type, detail === undefined ? undefined : {detail}));
    }

    static #setPhrase(kind, value) {
        try {
            const regex = value instanceof RegExp ? value : new RegExp(value, "i");
            if (kind === "wake") SpeechMenu.#wakePhrase = regex;
            else SpeechMenu.#sleepPhrase = regex;
            SpeechMenu.#emit(`${kind}PhraseChange`, {[`${kind}PhraseRegex`]: regex});
        } catch {
            SpeechMenu.#emit(`${kind}PhraseChangeError`, {message: `${kind}Phrase must be a valid regular expression.`});
        }
    }

    static #startEngine() {
        if (!SpeechMenu.#Recognition) {
            SpeechMenu.#emit("speechrecognitionunsupported", {message: "Speech recognition is not supported by this browser."});
            return false;
        }
        if (SpeechMenu.#recognition || SpeechMenu.#starting) return true;
        SpeechMenu.#starting = true;
        const recognition = new SpeechMenu.#Recognition();
        SpeechMenu.#recognition = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = SpeechMenu.#language;
        recognition.onresult = SpeechMenu.#onResult;
        recognition.onstart = () => { SpeechMenu.#starting = false; };
        recognition.onerror = event => SpeechMenu.#emit("speechRecognitionError", {error: event.error, message: event.message});
        recognition.onend = () => {
            if (SpeechMenu.#recognition === recognition) SpeechMenu.#recognition = undefined;
            SpeechMenu.#starting = false;
            if (!SpeechMenu.#stopped && document.visibilityState !== "hidden") queueMicrotask(() => SpeechMenu.#startEngine());
        };
        try { recognition.start(); return true; }
        catch (error) {
            SpeechMenu.#recognition = undefined;
            SpeechMenu.#starting = false;
            SpeechMenu.#emit("speechRecognitionError", {error: error.name, message: error.message});
            return false;
        }
    }

    static #onResult(event) {
        let interim = "", final = "";
        for (let index = event.resultIndex; index < event.results.length; index++) {
            const result = event.results[index];
            const text = result[0]?.transcript?.toLocaleLowerCase().trim()
                .replace(/(\d)\.(?=\d)/g, "$1\uFFFF")
                .replace(/[^\p{L}\p{N}\s:\uFFFF]/gu, " ")
                .replace(/\uFFFF/g, ".")
                .replace(/\s+/g, " ").trim();
            if (!text) continue;
            const key = result.isFinal ? "final" : "interim";
            if (key === "final") final += `${final ? " " : ""}${text}`;
            else interim += `${interim ? " " : ""}${text}`;
        }
        const transcript = final || interim;
        if (SpeechMenu.#debug && transcript) {
            const words = transcript.split(/\s+/);
            SpeechMenu.#debugFunction({state: SpeechMenu.#sleeping ? "sleeping" : "listening", isFinal: Boolean(final), fullText: transcript, lastWord: words.at(-1)});
        }
        if (!final) return;
        if (SpeechMenu.#sleeping) {
            if (SpeechMenu.#test(SpeechMenu.#wakePhrase, final)) {
                SpeechMenu.#sleeping = false;
                SpeechMenu.#emit("wake");
            }
            return;
        }
        if (SpeechMenu.#test(SpeechMenu.#sleepPhrase, final)) {
            SpeechMenu.#sleeping = true;
            SpeechMenu.#emit("sleep");
            return;
        }
        SpeechMenu.#processTranscript(final);
    }

    static #test(regex, text) { regex.lastIndex = 0; return regex.test(text); }

    static #processTranscript(text) {
        const first = elements => {
            for (const element of elements) if (SpeechMenu.#processElement(element, text)) return true;
            return false;
        };
        const firstMenu = elements => {
            for (const element of elements) if (SpeechMenu.#processMenu(element, text)) return true;
            return false;
        };
        if (firstMenu(document.querySelectorAll('speech-modal[speech-modal="top-level"]'))) return;
        if (first(document.querySelectorAll('speech-command[speech-modal="top-level"]'))) return;
        const modal = [...document.querySelectorAll("dialog:modal, dialog[open]")].at(-1);
        if (modal && SpeechMenu.#processMenu(modal, text)) return;
        if (firstMenu(document.querySelectorAll('speech-modal:not([speech-modal="top-level"])'))) return;
        if (first(document.querySelectorAll('speech-command[speech-modal=""]'))) return;
        if (modal) return;
        if (first(document.querySelectorAll("details[open], [popover]:popover-open"))) return;
        first(document.querySelectorAll(":not(details):not(dialog):not(speech-modal)[speech-pattern]"));
    }

    static #processMenu(menu, text) {
        for (const element of menu.querySelectorAll("[speech-pattern]:not([speech-modal])")) {
            if (SpeechMenu.#processElement(element, text)) return true;
        }
        return false;
    }

    static #prepare(element, force = false) {
        const source = element.getAttribute("speech-pattern");
        if (!source) return false;
        if (force || element.speechPatternSource !== source) {
            try {
                element.speechPattern = new RegExp(source, "gi");
                element.speechPatternSource = source;
            } catch {
                SpeechMenu.#emit("speechMenuPatternInvalid", {speechMenuElement: element, component: "speech-pattern", message: "Invalid speech-pattern regular expression."});
                return false;
            }
        }
        const target = SpeechMenu.#resolve(element.getAttribute("speech-function"));
        if (!target) {
            SpeechMenu.#emit("speechMenuFunctionNotFound", {speechMenuElement: element, component: "speech-function", functionName: element.getAttribute("speech-function"), message: "The speech function was not found."});
            return false;
        }
        element.speechFunc = target.fn;
        element.speechFuncThis = target.owner;
        const preprocName = element.getAttribute("speech-preproc");
        if (!preprocName) { delete element.speechPreprocFunc; return true; }
        const preproc = SpeechMenu.#resolve(preprocName);
        if (!preproc) {
            SpeechMenu.#emit("speechMenuFunctionNotFound", {speechMenuElement: element, component: "speech-preproc", functionName: preprocName, message: "The speech preprocessor was not found."});
            return false;
        }
        element.speechPreprocFunc = preproc.fn.bind(preproc.owner);
        return true;
    }

    static #resolve(source) {
        if (typeof source !== "string" || !source.trim()) return undefined;
        const path = source.trim().replace(/\[['"]([A-Za-z_$][\w$]*)['"]\]/g, ".$1").replace(/\[([A-Za-z_$][\w$]*)\]/g, ".$1").split(".");
        if (!path.every(part => /^[A-Za-z_$][\w$]*$/.test(part))) return undefined;
        let owner = window;
        for (let index = 0; index < path.length - 1; index++) {
            owner = owner?.[path[index]];
            if (owner == null) return undefined;
        }
        const fn = owner?.[path.at(-1)];
        return typeof fn === "function" ? {fn, owner} : undefined;
    }

    static #processElement(element, transcript) {
        if (!SpeechMenu.#prepare(element)) return false;
        let text = transcript;
        try { if (element.speechPreprocFunc) text = element.speechPreprocFunc(text); }
        catch (error) { SpeechMenu.#emit("speechMenuCommandError", {speechMenuElement: element, error}); return false; }
        if (typeof text !== "string") return false;
        const regex = element.speechPattern;
        regex.lastIndex = 0;
        const args = new ParameterParser(element.speechFunc);
        let matched = false, result;
        while ((result = regex.exec(text)) !== null) {
            matched = true;
            const named = new Set(Object.values(result.groups || {}).filter(value => value !== undefined));
            for (const [name, value] of Object.entries(result.groups || {})) {
                if (!value) continue;
                if (name === "_") args.restArguments?.push(...SpeechMenu.#list(value));
                else if (name.startsWith("_")) args.setArgument(name.slice(1), SpeechMenu.#list(value));
                else args.setArgument(name, value);
            }
            if (args.restArguments) {
                for (let index = 1; index < result.length; index++) {
                    const value = result[index];
                    if (value && !named.has(value)) args.restArguments.push(SpeechMenu.#scalar(value));
                }
            }
            if (!result[0].length) regex.lastIndex++;
        }
        if (!matched) return false;
        try {
            const outcome = element.speechFunc.apply(element.speechFuncThis, args.argumentArray());
            if (outcome === false) return false;
            SpeechMenu.#emit("command", {speechMenuElement: element, transcript: text});
            return true;
        } catch (error) {
            SpeechMenu.#emit("speechMenuCommandError", {speechMenuElement: element, error});
            return false;
        }
    }

    static #list(value) {
        return value.split(SpeechMenu.#separator).map(part => part.trim()).filter(Boolean).map(SpeechMenu.#scalar);
    }
    static #scalar(value) {
        const number = Number(value);
        return value.trim() && Number.isFinite(number) ? number : value;
    }
}
