(() => {
    "use strict";

    const $ =
        selector =>
            document.querySelector(
                selector
            );

    const PROFILE_MESSAGES = {"lookupTitle": "7352d256-5ea0-4d55-a4e5-4ba1a0a49168", "loading": "d9c06d11-c59c-43c9-8721-644bc5a05a62", "saving": "0e5209c0-dea6-47f0-b5b4-e6bcd74a4a72", "saved": "633b0a46-0daf-4c19-81db-2cf11ce573a9", "failed": "38f72634-abe6-4b50-a15b-040423a0f4de", "loadFailed": "6ea6fe0a-02a1-4237-bcf0-fa47fb98e364"};

    class WMOFUserLookup {
        #endpoint;
        #usersEndpoint;
        #canEdit;
        #canAssignPermissions;
        #canGrantPermission;
        #onProfileSaved;
        #mode = "edit";
        #profile;
        #profileRequest = 0;
        #profileBusy = false;
        #profilePhase = "search";
        #identityContext;
        #canLookup;
        #dialog;
        #form;
        #status;
        #results;
        #resultCount;
        #loadMore;
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
            onProfileSaved = () => {},
            canEdit = () => false,
            canAssignPermissions = () => false,
            canGrantPermission = () => canAssignPermissions(),
            canLookup =
                () => false

        } = {}) {
            this.#endpoint =
                new URL(
                    "api/admin/user-lookup/",
                    baseUrl
                );
            this.#usersEndpoint = new URL("api/users/", baseUrl);
            this.#canEdit = canEdit;
            this.#onProfileSaved = onProfileSaved;
            this.#canAssignPermissions = canAssignPermissions;
            this.#canGrantPermission = canGrantPermission;
            this.#identityContext =
                identityContext;
            this.#canLookup =
                canLookup;

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
            this.#clearSelected =
                $("#userLookupClearSelected");
            this.#selectedName =
                $("#userLookupSelectedName");
            this.#selectedMeta =
                $("#userLookupSelectedMeta");

            $("#editProfileSave")?.addEventListener("click", () => void this.saveProfile());
            $("#userLookupButton")?.addEventListener("click", () => this.setMode("edit"));
            this.#identityContext?.addEventListener?.("identity-selected", () => {if(!this.#profileBusy) void this.loadProfile();});
            this.#identityContext?.addEventListener?.("identity-cleared", () => this.clearProfile());
            this.#dialog?.addEventListener("close", () => this.clearProfile());
            this.#wire();
            this.sync();
        }

        get state() {
            return Object.freeze({mode:this.#mode, phase:this.#profilePhase,
                open:Boolean(this.#dialog?.open), selectedAccountId:this.#profile?.id ?? null,
                canSearch:Boolean(this.#canLookup()),
                canSave:Boolean(this.#mode === "edit" && this.#profile && !this.#profileBusy && this.#canEdit()),
                canAssignPermissions:Boolean(this.#canAssignPermissions())});
        }
        setMode(mode) {
            this.#mode = mode === "lookup" ? "lookup" : "edit";
            const title = this.#dialog?.querySelector("h2");
            if(title) title.textContent = this.#mode === "lookup" ? this.#text("lookupTitle") : globalThis.WMOFLanguagePack.text("209678ee-e86a-5bff-9284-9eb3c7bba875");
            if (this.#mode === "lookup") this.clearProfile();
            else if (this.currentIdentity) void this.loadProfile();
        }
        #text(key) {return globalThis.WMOFLanguagePack.text(PROFILE_MESSAGES[key]);}
        clearProfile() {
            ++this.#profileRequest;
            this.#profile = undefined;
            this.#profileBusy = false;
            this.#profilePhase = "search";
            const editor = $("#profileEditor");
            if(editor) {editor.hidden = true; for(const input of editor.querySelectorAll("input")){if(input.type==='checkbox')input.checked=false;else input.value = "";}}
        }
        async loadProfile() {
            this.clearProfile();
            const identity = this.currentIdentity;
            if (this.#mode !== "edit" || !identity || !this.#canEdit()) return false;
            const request = this.#profileRequest, url = new URL(this.#usersEndpoint);
            const editor = $("#profileEditor"), fields = $("#profileEditorFields"), status = $("#editProfileStatus");
            this.#profilePhase = "loading";
            editor.hidden = false; fields.disabled = true; $("#editProfileSave").disabled = true;
            status.textContent = this.#text("loading");
            url.searchParams.set("userId", String(identity.userId));
            try {
                const response = await fetch(url,{credentials:"same-origin",cache:"no-store"});
                const data = await response.json();
                if(request !== this.#profileRequest) return false;
                if(!response.ok || !data.user) throw new Error(data.message || this.#text("loadFailed"));
                this.#profile = data.user;
                this.#profilePhase = "editing";
                const mapping = {AccountId:"id",FirstName:"first_name",MiddleName:"middle_name",LastName:"last_name",PreferredName:"preferred_name",Username:"username",LoginId:"login_id"};
                for(const [key,column] of Object.entries(mapping)) $("#editProfile"+key).value = String(data.user[column] ?? "");
                for(const option of $("#editProfilePermissions").querySelectorAll("input")){option.checked=Boolean(Number(data.user.permissions)&Number(option.value));option.disabled=!this.#canAssignPermissions()||!this.#canGrantPermission(Number(option.value));}
                fields.disabled = false; $("#editProfileSave").disabled = false; status.textContent = "";
                return true;
            } catch(error) {
                if(request === this.#profileRequest) {this.#profilePhase = "error";status.textContent = error.message || this.#text("loadFailed");}
                return false;
            }
        }
        async saveProfile() {
            if(!this.state.canSave) return false;
            const fields = $("#profileEditorFields"), status = $("#editProfileStatus");
            if([...fields.querySelectorAll("input")].some(input => !input.reportValidity())) return false;
            const target = this.#profile.id, request = this.#profileRequest;
            const input = {action:"update",userId:target};
            for(const [key,field] of Object.entries({firstName:"FirstName",middleName:"MiddleName",lastName:"LastName",preferredName:"PreferredName",username:"Username"})) input[key] = $("#editProfile"+field).value;
            const password = $("#editProfilePassword").value, pin = $("#editProfilePin").value, loginId = $("#editProfileLoginId").value;
            if(password) input.password = password;
            if(pin) input.pin = pin;
            if(loginId !== (this.#profile.login_id ?? "")) input.loginId = loginId;
            const permissions=[...$("#editProfilePermissions").querySelectorAll("input:checked")].reduce((mask,option)=>mask|Number(option.value),0);
            if(this.#canAssignPermissions() && permissions !== Number(this.#profile.permissions)) input.permissions = permissions;
            this.#profilePhase = "saving";
            this.#profileBusy = true; fields.disabled = true; $("#editProfileSave").disabled = true; status.textContent = this.#text("saving");
            try {
                const sessionResponse = await fetch(this.#usersEndpoint,{credentials:"same-origin",cache:"no-store"});
                const session = await sessionResponse.json();
                if(!sessionResponse.ok || typeof session.csrfToken !== "string") throw new Error(session.message || this.#text("failed"));
                if(request !== this.#profileRequest) return false;
                const response = await fetch(this.#usersEndpoint,{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json","X-CSRF-Token":session.csrfToken},body:JSON.stringify(input)});
                const data = await response.json();
                if(request !== this.#profileRequest) return false;
                if(!response.ok || !data.user) throw new Error(data.message || this.#text("failed"));
                this.#onProfileSaved(data.user);
                this.#identityContext.select(data.user);
                const reloaded = await this.loadProfile();
                if(reloaded && this.currentIdentity?.userId === target) status.textContent = this.#text("saved");
                return true;
            } catch(error) {
                if(request === this.#profileRequest) {this.#profilePhase = "error";status.textContent = error.message || this.#text("failed");}
                return false;
            } finally {
                if(request === this.#profileRequest){this.#profileBusy = false; fields.disabled = false; $("#editProfileSave").disabled = false; $("#editProfilePassword").value = ""; $("#editProfilePin").value = "";}
            }
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
                        if (document.activeElement?.closest?.("#profileEditor")) void this.saveProfile();
                        else void this.search();
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


            this.#clearSelected
                ?.addEventListener(
                    "click",
                    () =>
                        this
                            .#identityContext
                            ?.clear?.()
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

                actions.append(select);

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
                this.#clearSelected
            ) {
                this.#clearSelected.disabled =
                    !identity;
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
                        this.#clearSelected
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
            this.clearProfile();
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

            if (!append) this.clearProfile();
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

                if (controller.signal.aborted || this.#searchAbort !== controller) return [];
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

                if(!append && incoming.length === 0) this.#profilePhase = "error";
                if(!append && incoming.length === 1) this.#identityContext.select(incoming[0]);
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


    }

    globalThis.WMOFUserLookup =
        WMOFUserLookup;
})();
