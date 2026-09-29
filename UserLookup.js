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
                    "User ID must be a positive integer."
                );
            }

            if (
                Object.keys(
                    criteria
                ).length ===
                    0
            ) {
                throw new Error(
                    "Enter at least one search criterion."
                );
            }

            return criteria;
        }

        #displayName(
            identity
        ) {
            if (!identity) {
                return "No user selected";
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
                "User"
            );
        }

        #meta(
            identity
        ) {
            if (!identity) {
                return "Select a result to create the current identity object.";
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
                "ID " +
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
                    "Select";
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
                    "Copy Identity";
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
                        "Live Stream";
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
                            " result" +
                            (
                                this
                                    .#identities
                                    .length ===
                                    1 &&
                                !this
                                    .#nextAfterId
                                    ? ""
                                    : "s"
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
                    "User lookup permission is required.";

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
                "Searching…";
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
                            "User lookup failed."
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
                        : "No users matched.";

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
                    "User lookup failed.";

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
                    "Identity copied.";

                return true;
            }
            catch (error) {
                this.#status.textContent =
                    error.message ||
                    "Unable to copy identity.";

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
