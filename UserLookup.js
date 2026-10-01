(() => {
    "use strict";

    const $ =
        selector =>
            document.querySelector(
                selector
            );

    class WMOFUserLookup {
        #endpoint;
        #identityContext;
        #canLookup;
        #canViewLive;
        #currentUserId;
        #onLiveStream;
        #dialog;
        #form;
        #status;
        #results;
        #resultCount;
        #loadMore;
        #copySelected;
        #liveSelected;
        #clearSelected;
        #selectedName;
        #selectedMeta;
        #searchAbort;
        #nextAfterId;
        #criteriaKey = "";
        #identities = [];

        constructor({
            baseUrl =
                document.baseURI,
            identityContext =
                globalThis
                    .WMOFIdentityContext,
            canLookup =
                () => false,
            canViewLive =
                () => false,
            currentUserId =
                () => undefined,
            onLiveStream =
                () => {}
        } = {}) {
            this.#endpoint =
                new URL(
                    "api/admin/user-lookup/",
                    baseUrl
                );
            this.#identityContext =
                identityContext;
            this.#canLookup =
                canLookup;
            this.#canViewLive =
                canViewLive;
            this.#currentUserId =
                currentUserId;
            this.#onLiveStream =
                onLiveStream;

            this.#dialog =
                $("#userLookupDialog");
            this.#form =
                $("#userLookupForm");
            this.#status =
                $("#userLookupStatus");
            this.#results =
                $("#userLookupResults");
            this.#resultCount =
                $("#userLookupResultCount");
            this.#loadMore =
                $("#userLookupLoadMore");
            this.#copySelected =
                $("#userLookupCopySelected");
            this.#liveSelected =
                $("#userLookupLiveStream");
            this.#clearSelected =
                $("#userLookupClearSelected");
            this.#selectedName =
                $("#userLookupSelectedName");
            this.#selectedMeta =
                $("#userLookupSelectedMeta");

            this.#wire();
            this.sync();
        }

        get currentIdentity() {
            return this
                .#identityContext
                ?.current;
        }

        #wire() {
            this.#form
                ?.addEventListener(
                    "submit",
                    event => {
                        event.preventDefault();
                        void this
                            .search();
                    }
                );

            $("#userLookupClearSearch")
                ?.addEventListener(
                    "click",
                    () =>
                        this
                            .clearSearch()
                );

            this.#loadMore
                ?.addEventListener(
                    "click",
                    () =>
                        void this
                            .search({
                                append:
                                    true
                            })
                );

            this.#copySelected
                ?.addEventListener(
                    "click",
                    () =>
                        void this
                            .copyIdentity(
                                this
                                    .currentIdentity
                            )
                );

            this.#clearSelected
                ?.addEventListener(
                    "click",
                    () =>
                        this
                            .#identityContext
                            ?.clear?.()
                );

            this.#liveSelected
                ?.addEventListener(
                    "click",
                    () =>
                        this
                            .openLiveStream(
                                this
                                    .currentIdentity
                            )
                );

            this.#dialog
                ?.addEventListener(
                    "opening",
                    event => {
                        if (
                            !this
                                .#canLookup()
                        ) {
                            event
                                .preventDefault();

                            return;
                        }

                        this.sync();

                        queueMicrotask(
                            () =>
                                $("#userLookupUsername")
                                    ?.focus?.()
                        );
                    }
                );

            for (
                const eventName of [
                    "identity-selected",
                    "identity-cleared"
                ]
            ) {
                this
                    .#identityContext
                    ?.addEventListener?.(
                        eventName,
                        () =>
                            this.sync()
                    );
            }
        }

        #readCriteria() {
            const values =
                Object.fromEntries(
                    new FormData(
                        this.#form
                    )
                );

            const criteria = {};

            for (
                const key of [
                    "id",
                    "username",
                    "firstName",
                    "lastName",
                    "preferredName"
                ]
            ) {
                const value =
                    String(
                        values[
                            key
                        ] ||
                        ""
                    )
                        .trim();

                if (value) {
                    criteria[
                        key
                    ] =
                        value;
                }
            }

            if (
                criteria.id &&
                !/^[1-9]\d*$/
                    .test(
                        criteria.id
                    )
            ) {
                throw new Error(
                    globalThis.WMOFLanguagePack.text("03c4bdd2-9057-48c9-a9b7-f6fbd97b1310")
                );
            }

            if (
                Object.keys(
                    criteria
                ).length ===
                    0
            ) {
                throw new Error(
                    globalThis.WMOFLanguagePack.text("8833716a-086f-4d1c-b2b7-6aeca61285f7")
                );
            }

            return criteria;
        }

        #displayName(
            identity
        ) {
            if (!identity) {
                return globalThis.WMOFLanguagePack.text("0d29d3a2-389b-4825-993d-688183cd5f91");
            }

            const formal =
                [
                    identity.firstName,
                    identity.lastName
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        " "
                    )
                    .trim();

            return (
                identity
                    .preferredName ||
                formal ||
                identity
                    .username ||
                globalThis.WMOFLanguagePack.text("fef363e8-ad34-48c9-9961-6d6460e1456f")
            );
        }

        #meta(
            identity
        ) {
            if (!identity) {
                return globalThis.WMOFLanguagePack.text("98eb131c-07ac-4ba5-95eb-17ab2a9a4826");
            }

            const formal =
                [
                    identity.firstName,
                    identity.lastName
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        " "
                    )
                    .trim();
            const parts = [];

            if (
                identity.preferredName &&
                formal &&
                identity.preferredName !==
                    formal
            ) {
                parts.push(
                    formal
                );
            }

            parts.push(
                "@" +
                    identity
                        .username
            );
            parts.push(
                globalThis.WMOFLanguagePack.text("e8cafe89-9039-44e1-9314-dcb503e0f7a2") +
                    identity
                        .userId
            );

            return parts.join(
                " · "
            );
        }

        #isSelf(
            identity
        ) {
            return Boolean(
                identity &&
                Number(
                    identity.userId
                ) ===
                    Number(
                        this
                            .#currentUserId()
                    )
            );
        }

        #renderResults() {
            this.#results
                ?.replaceChildren();

            for (
                const identity of
                this.#identities
            ) {
                const row =
                    document
                        .createElement(
                            "article"
                        );

                row.className =
                    "user-lookup-result";
                row.setAttribute(
                    "role",
                    "listitem"
                );
                row.dataset.userId =
                    String(
                        identity.userId
                    );
                row.setAttribute(
                    "aria-selected",
                    String(
                        Number(
                            this
                                .currentIdentity
                                ?.userId
                        ) ===
                            Number(
                                identity
                                    .userId
                        )
                    )
                );

                const card =
                    document
                        .createElement(
                            "div"
                        );

                card.className =
                    "identity-object-card";

                const name =
                    document
                        .createElement(
                            "strong"
                        );
                name.textContent =
                    this
                        .#displayName(
                            identity
                        );

                const meta =
                    document
                        .createElement(
                            "span"
                        );
                meta.textContent =
                    this
                        .#meta(
                            identity
                        );

                card.append(
                    name,
                    meta
                );

                const actions =
                    document
                        .createElement(
                            "div"
                        );

                actions.className =
                    "user-lookup-result-actions";

                const select =
                    document
                        .createElement(
                            "button"
                        );
                select.type =
                    "button";
                select.textContent =
                    globalThis.WMOFLanguagePack.text("e8050ef7-72ba-5854-bc79-d46712f28281");
                select.addEventListener(
                    "click",
                    () =>
                        this
                            .#identityContext
                            ?.select?.(
                                identity
                            )
                );

                const copy =
                    document
                        .createElement(
                            "button"
                        );
                copy.type =
                    "button";
                copy.textContent =
                    globalThis.WMOFLanguagePack.text("9b02e0b1-7add-5cec-ba58-0f0c2b915c37");
                copy.addEventListener(
                    "click",
                    () =>
                        void this
                            .copyIdentity(
                                identity
                            )
                );

                actions.append(
                    select,
                    copy
                );

                if (
                    this
                        .#canViewLive() &&
                    !this
                        .#isSelf(
                            identity
                        )
                ) {
                    const live =
                        document
                            .createElement(
                                "button"
                            );

                    live.type =
                        "button";
                    live.className =
                        "primary-action";
                    live.dataset.action =
                        "live-stream";
                    live.textContent =
                        globalThis.WMOFLanguagePack.text("c796d00c-df14-54c9-91ae-40022ff832db");
                    live.addEventListener(
                        "click",
                        () =>
                            this
                                .openLiveStream(
                                    identity
                                )
                    );

                    actions.append(
                        live
                    );
                }

                row.append(
                    card,
                    actions
                );

                this.#results
                    ?.append(
                        row
                    );
            }

            if (
                this.#resultCount
            ) {
                this.#resultCount
                    .textContent =
                    this
                        .#identities
                        .length ===
                        0
                        ? ""
                        : (
                            this
                                .#identities
                                .length +
                            (
                                this
                                    .#nextAfterId
                                    ? "+"
                                    : ""
                            ) +
                            globalThis.WMOFLanguagePack.text("2d9ecb50-8a00-50bd-b37e-a612bf40e93c") +
                            (
                                this
                                    .#identities
                                    .length ===
                                    1 &&
                                !this
                                    .#nextAfterId
                                    ? ""
                                    : globalThis.WMOFLanguagePack.text("a1eade3f-ff99-5e18-a86e-41217e28eaf2")
                            )
                        );
            }
        }

        sync() {
            const identity =
                this
                    .currentIdentity;
            const canLookup =
                Boolean(
                    this
                        .#canLookup()
                );
            const canView =
                Boolean(
                    this
                        .#canViewLive()
                );
            const canStream =
                Boolean(
                    identity &&
                    canView &&
                    !this
                        .#isSelf(
                            identity
                        )
                );

            if (
                this.#selectedName
            ) {
                this.#selectedName
                    .textContent =
                    this
                        .#displayName(
                            identity
                        );
            }

            if (
                this.#selectedMeta
            ) {
                this.#selectedMeta
                    .textContent =
                    this
                        .#meta(
                            identity
                        );
            }

            if (
                this.#copySelected
            ) {
                this.#copySelected.disabled =
                    !identity;
            }

            if (
                this.#clearSelected
            ) {
                this.#clearSelected.disabled =
                    !identity;
            }

            if (
                this.#liveSelected
            ) {
                this.#liveSelected.hidden =
                    !canView;
                this.#liveSelected.disabled =
                    !canStream;
            }

            for (
                const element of
                this
                    .#form
                    ?.querySelectorAll?.(
                        "input, button"
                    ) ||
                []
            ) {
                if (
                    element ===
                        this.#copySelected ||
                    element ===
                        this.#clearSelected ||
                    element ===
                        this.#liveSelected
                ) {
                    continue;
                }

                if (
                    element.closest(
                        ".user-lookup-search"
                    ) ||
                    element ===
                        this.#loadMore
                ) {
                    element.disabled =
                        !canLookup;
                }
            }

            for (
                const row of
                this
                    .#results
                    ?.querySelectorAll?.(
                        ".user-lookup-result"
                    ) ||
                []
            ) {
                row.setAttribute(
                    "aria-selected",
                    String(
                        Number(
                            row.dataset
                                .userId
                        ) ===
                            Number(
                                identity
                                    ?.userId
                            )
                    )
                );
            }

            return canLookup;
        }

        clearSearch() {
            this
                .#searchAbort
                ?.abort?.();

            this.#form
                ?.reset?.();
            this.#identities =
                [];
            this.#nextAfterId =
                undefined;
            this.#criteriaKey =
                "";
            this.#status.textContent =
                "";
            this.#resultCount.textContent =
                "";
            this.#loadMore.hidden =
                true;
            this
                .#renderResults();
        }

        async search({
            append =
                false
        } = {}) {
            if (
                !this
                    .#canLookup()
            ) {
                this.#status.textContent =
                    globalThis.WMOFLanguagePack.text("0549ce8a-6d89-5cf9-8b9d-a63a92949335");

                return [];
            }

            let criteria;

            try {
                criteria =
                    this
                        .#readCriteria();
            }
            catch (error) {
                this.#status.textContent =
                    error.message;

                return [];
            }

            const criteriaKey =
                JSON.stringify(
                    criteria
                );

            if (
                append &&
                criteriaKey !==
                    this
                        .#criteriaKey
            ) {
                append =
                    false;
            }

            const url =
                new URL(
                    this.#endpoint
                );

            for (
                const [
                    key,
                    value
                ] of
                Object.entries(
                    criteria
                )
            ) {
                url.searchParams
                    .set(
                        key,
                        value
                    );
            }

            url.searchParams.set(
                "limit",
                "25"
            );

            if (
                append &&
                this.#nextAfterId
            ) {
                url.searchParams.set(
                    "afterId",
                    String(
                        this
                            .#nextAfterId
                    )
                );
            }

            this
                .#searchAbort
                ?.abort?.();

            const controller =
                new AbortController();

            this.#searchAbort =
                controller;
            this.#status.textContent =
                globalThis.WMOFLanguagePack.text("62c267a0-d3af-529c-8eb5-01beca9409f2");
            $("#userLookupSearchButton").disabled =
                true;
            this.#loadMore.disabled =
                true;

            try {
                const response =
                    await fetch(
                        url,
                        {
                            method:
                                "GET",
                            credentials:
                                "same-origin",
                            cache:
                                "no-store",
                            headers: {
                                Accept:
                                    "application/json"
                            },
                            signal:
                                controller.signal
                        }
                    );

                const data =
                    await response
                        .json()
                        .catch(
                            () => ({})
                        );

                if (!response.ok) {
                    const error =
                        new Error(
                            data.message ||
                            data.error ||
                            globalThis.WMOFLanguagePack.text("70f32e1c-dd50-417b-ac9d-86916696b9a1")
                        );

                    error.status =
                        response.status;

                    throw error;
                }

                const incoming =
                    (
                        Array.isArray(
                            data.identities
                        )
                            ? data
                                .identities
                            : []
                    )
                        .map(
                            identity =>
                                this
                                    .#identityContext
                                    .normalize(
                                        identity
                                    )
                        );

                this.#criteriaKey =
                    criteriaKey;

                if (append) {
                    const existing =
                        new Set(
                            this
                                .#identities
                                .map(
                                    identity =>
                                        identity
                                            .userId
                                )
                        );

                    this.#identities.push(
                        ...incoming.filter(
                            identity =>
                                !existing
                                    .has(
                                        identity
                                            .userId
                                    )
                        )
                    );
                }
                else {
                    this.#identities =
                        incoming;
                }

                this.#nextAfterId =
                    data.hasMore
                        ? Number(
                            data
                                .nextAfterId
                        ) ||
                            undefined
                        : undefined;

                this.#loadMore.hidden =
                    !this
                        .#nextAfterId;
                this.#status.textContent =
                    this
                        .#identities
                        .length
                        ? ""
                        : globalThis.WMOFLanguagePack.text("1256d560-45d5-555c-a945-8d878a7642e6");

                this
                    .#renderResults();

                return this
                    .#identities;
            }
            catch (error) {
                if (
                    error.name ===
                        "AbortError"
                ) {
                    return [];
                }

                this.#status.textContent =
                    error.message ||
                    globalThis.WMOFLanguagePack.text("29d10587-1940-5523-9b37-57b5d268d8a5");

                return [];
            }
            finally {
                if (
                    this
                        .#searchAbort ===
                        controller
                ) {
                    this.#searchAbort =
                        undefined;
                }

                $("#userLookupSearchButton").disabled =
                    !this
                        .#canLookup();
                this.#loadMore.disabled =
                    !this
                        .#canLookup();
            }
        }

        async copyIdentity(
            identity
        ) {
            if (!identity) {
                return false;
            }

            try {
                await this
                    .#identityContext
                    .copy(
                        identity
                    );

                this.#status.textContent =
                    globalThis.WMOFLanguagePack.text("9c8f7cef-a26e-57d8-bd87-7719b71f3376");

                return true;
            }
            catch (error) {
                this.#status.textContent =
                    error.message ||
                    globalThis.WMOFLanguagePack.text("f07d2624-75dd-54c5-b3b7-7744ecb393d0");

                return false;
            }
        }

        openLiveStream(
            identity
        ) {
            if (
                !identity ||
                !this
                    .#canViewLive() ||
                this
                    .#isSelf(
                        identity
                    )
            ) {
                return false;
            }

            const selected =
                this
                    .#identityContext
                    .select(
                        identity
                    );

            this
                .#onLiveStream(
                    selected
                );

            return true;
        }
    }

    globalThis.WMOFUserLookup =
        WMOFUserLookup;
})();
