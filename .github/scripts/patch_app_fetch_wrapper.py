from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 occurrence, found {count}")
    return text.replace(old, new, 1)


path = Path("app.js")
text = path.read_text()

wrapper = r'''    async function fetchResource(url, options = {}) {
        return fetch(url, options)
            .then(async response => {
                const text =
                    await response
                        .text()
                        .catch(() => "");

                return {
                    response,
                    body: response.ok
                        ? {
                            ok: true,
                            status: response.status,
                            text
                        }
                        : {
                            ok: false,
                            error: "http_error",
                            message:
                                `Request failed (${response.status}).`,
                            status: response.status,
                            text
                        }
                };
            })
            .catch(cause => ({
                response: undefined,
                body: {
                    ok: false,
                    error: "fetch_failed",
                    message:
                        cause?.message ||
                        "Network request failed.",
                    status: 0,
                    text: ""
                },
                cause
            }));
    }

'''

text = replace_once(
    text,
    '    async function ensureNumberPadLoaded() {',
    wrapper + '    async function ensureNumberPadLoaded() {',
    "fetchResource wrapper insertion"
)

old = '''                const response = await fetch("numberpad.html", { cache: "no-store" });
                if (!response.ok) throw new Error(`Unable to load number pad (${response.status}).`);
                const template = document.createElement("template");
                template.innerHTML = (await response.text()).trim();'''

new = '''                const result =
                    await fetchResource(
                        "numberpad.html",
                        { cache: "no-store" }
                    );

                const body =
                    result.body || {};

                if (!body.ok) {
                    throw new Error(
                        body.message ||
                        "Unable to load number pad."
                    );
                }

                const template = document.createElement("template");
                template.innerHTML = String(body.text || "").trim();'''

text = replace_once(
    text,
    old,
    new,
    "number pad fetch wrapper usage"
)

path.write_text(text.rstrip() + "\n")
