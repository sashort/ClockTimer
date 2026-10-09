(() => {
    "use strict";

    const normalizeText =
        value =>
            value === null ||
            value === undefined
                ? ""
                : String(
                    value
                ).trim();

    const normalize =
        value => {
            if (
                !value ||
                typeof value !==
                    "object"
            ) {
                throw new TypeError(
                    "A user identity object is required."
                );
            }

            const userId =
                Number(
                    value.userId ??
                    value.id
                );

            if (
                !Number.isSafeInteger(
                    userId
                ) ||
                userId <
                    1
            ) {
                throw new TypeError(
                    "Identity userId must be a positive integer."
                );
            }

            const firstName =
                normalizeText(
                    value.firstName ??
                    value.first_name
                );
            const lastName =
                normalizeText(
                    value.lastName ??
                    value.last_name
                );
            const username =
                normalizeText(
                    value.username
                );
            const preferredRaw =
                value.preferredName ??
                value.preferred_name;
            const preferredName =
                preferredRaw ===
                    null ||
                preferredRaw ===
                    undefined ||
                normalizeText(
                    preferredRaw
                ) ===
                    ""
                    ? null
                    : normalizeText(
                        preferredRaw
                    );

            if (!username) {
                throw new TypeError(
                    "Identity username is required."
                );
            }

            return Object.freeze({
                type:
                    "user",
                version:
                    1,
                userId,
                firstName,
                lastName,
                preferredName,
                username
            });
        };

    function displayName(identity) {
        if (!identity) return "No user selected";
        const formal = [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim();
        return identity.preferredName || formal || identity.username || "User";
    }

    function displayMeta(identity) {
        if (!identity) return "Use Account Lookup to select an identity.";
        const formal = [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim();
        const parts = [];
        if (identity.preferredName && formal && identity.preferredName !== formal) parts.push(formal);
        parts.push("@" + identity.username);
        parts.push("ID " + identity.userId);
        return parts.join(" · ");
    }

    class IdentityContext extends EventTarget {
        #current;

        displayName(value = this.#current) {
            return displayName(value);
        }

        displayMeta(value = this.#current) {
            return displayMeta(value);
        }

        get current() {
            return this.#current;
        }

        normalize(
            value
        ) {
            return normalize(
                value
            );
        }

        select(
            value
        ) {
            const identity =
                normalize(
                    value
                );

            this.#current =
                identity;

            this.dispatchEvent(
                new CustomEvent(
                    "identity-selected",
                    {
                        detail: {
                            identity
                        }
                    }
                )
            );

            return identity;
        }

        clear() {
            const previous =
                this.#current;

            if (!previous) {
                return false;
            }

            this.#current =
                undefined;

            this.dispatchEvent(
                new CustomEvent(
                    "identity-cleared",
                    {
                        detail: {
                            identity:
                                previous
                        }
                    }
                )
            );

            return true;
        }

        stringify(
            value =
                this.#current
        ) {
            const identity =
                normalize(
                    value
                );

            return JSON.stringify(
                identity,
                null,
                2
            );
        }

        async copy(
            value =
                this.#current
        ) {
            const text =
                this.stringify(
                    value
                );

            if (
                navigator.clipboard
                    ?.writeText
            ) {
                await navigator
                    .clipboard
                    .writeText(
                        text
                    );

                return text;
            }

            const textarea =
                document
                    .createElement(
                        "textarea"
                    );

            textarea.value =
                text;
            textarea.readOnly =
                true;
            textarea.style.position =
                "fixed";
            textarea.style.opacity =
                "0";
            textarea.style.pointerEvents =
                "none";

            document.body
                .append(
                    textarea
                );

            textarea.select();

            const copied =
                document.execCommand?.(
                    "copy"
                );

            textarea.remove();

            if (!copied) {
                throw new Error(
                    "Clipboard access is unavailable."
                );
            }

            return text;
        }
    }

    globalThis.WMOFIdentityContext =
        new IdentityContext();
})();
