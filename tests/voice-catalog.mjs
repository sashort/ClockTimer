import fs from "node:fs";
import assert from "node:assert/strict";

const listeners = new Map();

globalThis.speechSynthesis = {
    addEventListener(
        type,
        callback
    ) {
        listeners.set(
            type,
            callback
        );
    },
    getVoices() {
        return [
            {
                voiceURI:
                    "system-en-us",
                name:
                    "English US",
                lang:
                    "en-US",
                default:
                    true,
                localService:
                    true
            },
            {
                voiceURI:
                    "system-en-gb",
                name:
                    "English UK",
                lang:
                    "en-GB",
                default:
                    false,
                localService:
                    true
            },
            {
                voiceURI:
                    "system-es-us",
                name:
                    "Spanish US",
                lang:
                    "es-US",
                default:
                    false,
                localService:
                    true
            }
        ];
    }
};

delete globalThis.WMOFVoiceCatalog;

const source =
    fs.readFileSync(
        new URL(
            "../api/audio/VoiceCatalog.js",
            import.meta.url
        ),
        "utf8"
    );

Function(source)();

const catalog =
    globalThis.WMOFVoiceCatalog;

assert(catalog);
assert.equal(
    typeof catalog.load,
    "function"
);
assert.equal(
    typeof catalog.registerProvider,
    "function"
);

const english =
    await catalog.load(
        "en-US"
    );
const system =
    english.providers.find(
        provider =>
            provider.id ===
            "system"
    );

assert(system);
assert.deepEqual(
    system.voices.map(
        voice =>
            voice.id
    ),
    [
        "system-en-us",
        "system-en-gb"
    ]
);
assert.equal(
    system.voices[0].default,
    true
);
assert(
    system.voices.every(
        voice =>
            voice.language
                .toLowerCase()
                .startsWith("en-")
    )
);

let providerLanguage;

catalog.registerProvider(
    "future-provider",
    {
        label:
            "Future Provider",
        load(
            language
        ) {
            providerLanguage =
                language;

            return [
                {
                    provider:
                        "future-provider",
                    id:
                        "voice-a",
                    name:
                        "Voice A",
                    language
                }
            ];
        }
    }
);

const extended =
    await catalog.load(
        "en-US"
    );

assert.equal(
    providerLanguage,
    "en-US"
);
assert.equal(
    extended.providers
        .find(
            provider =>
                provider.id ===
                "future-provider"
        )
        ?.voices[0]
        ?.language,
    "en-US"
);

let changed = false;

catalog.onChanged(
    detail => {
        changed =
            detail.provider ===
            "system";
    }
);

listeners.get(
    "voiceschanged"
)?.();

assert.equal(
    changed,
    true
);

console.log(
    "PASS dynamic voice catalog filters by language and supports future providers"
);
