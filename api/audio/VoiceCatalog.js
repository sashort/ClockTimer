(() => {
    "use strict";

    class WMOFVoiceCatalog {
        #providers = new Map();
        #listeners = new Set();

        constructor() {
            this.registerProvider(
                "system",
                {
                    label: "System Voices",
                    load:
                        language =>
                            this.#loadSystemVoices(
                                language
                            )
                }
            );

            globalThis.speechSynthesis
                ?.addEventListener?.(
                    "voiceschanged",
                    () =>
                        this.#emitChanged(
                            "system"
                        )
                );
        }

        registerProvider(
            id,
            {
                label,
                load
            } = {}
        ) {
            const providerId =
                String(id || "").trim();

            if (
                !providerId ||
                typeof load !==
                    "function"
            ) {
                return false;
            }

            this.#providers.set(
                providerId,
                {
                    id:
                        providerId,
                    label:
                        String(
                            label ||
                            providerId
                        ),
                    load
                }
            );

            return true;
        }

        async load(
            language = "en-US"
        ) {
            const requestedLanguage =
                String(
                    language ||
                    "en-US"
                ).trim() ||
                "en-US";
            const providers = [];

            for (
                const provider of
                this.#providers.values()
            ) {
                try {
                    const voices =
                        await provider.load(
                            requestedLanguage
                        );

                    providers.push({
                        id:
                            provider.id,
                        label:
                            provider.label,
                        voices:
                            Array.isArray(
                                voices
                            )
                                ? voices
                                : []
                    });
                }
                catch (error) {
                    console.warn(
                        "Unable to load voices for provider:",
                        provider.id,
                        error
                    );

                    providers.push({
                        id:
                            provider.id,
                        label:
                            provider.label,
                        voices: []
                    });
                }
            }

            return {
                language:
                    requestedLanguage,
                providers
            };
        }

        onChanged(callback) {
            if (
                typeof callback !==
                    "function"
            ) {
                return () => {};
            }

            this.#listeners.add(
                callback
            );

            return () =>
                this.#listeners.delete(
                    callback
                );
        }

        #emitChanged(provider) {
            for (
                const callback of
                this.#listeners
            ) {
                try {
                    callback({
                        provider
                    });
                }
                catch {}
            }
        }

        #languageMatches(
            voiceLanguage,
            requestedLanguage
        ) {
            const voice =
                String(
                    voiceLanguage ||
                    ""
                ).toLocaleLowerCase(
                    "en-US"
                );
            const requested =
                String(
                    requestedLanguage ||
                    ""
                ).toLocaleLowerCase(
                    "en-US"
                );

            if (
                !voice ||
                !requested
            ) {
                return false;
            }

            return (
                voice.split("-")[0] ===
                requested.split("-")[0]
            );
        }

        #loadSystemVoices(
            language
        ) {
            const synthesis =
                globalThis.speechSynthesis;

            if (
                !synthesis ||
                typeof synthesis
                    .getVoices !==
                    "function"
            ) {
                return [];
            }

            return synthesis
                .getVoices()
                .filter(
                    voice =>
                        this.#languageMatches(
                            voice.lang,
                            language
                        )
                )
                .map(
                    voice => ({
                        provider:
                            "system",
                        id:
                            String(
                                voice.voiceURI ||
                                voice.name ||
                                ""
                            ),
                        name:
                            String(
                                voice.name ||
                                voice.voiceURI ||
                                "System Voice"
                            ),
                        language:
                            String(
                                voice.lang ||
                                language
                            ),
                        default:
                            voice.default ===
                                true,
                        local:
                            voice.localService ===
                                true
                    })
                )
                .filter(
                    voice =>
                        Boolean(
                            voice.id
                        )
                )
                .sort(
                    (
                        first,
                        second
                    ) => {
                        if (
                            first.default !==
                            second.default
                        ) {
                            return first.default
                                ? -1
                                : 1;
                        }

                        return first.name
                            .localeCompare(
                                second.name
                            );
                    }
                );
        }
    }

    globalThis.WMOFVoiceCatalog =
        globalThis.WMOFVoiceCatalog ||
        new WMOFVoiceCatalog();
})();
