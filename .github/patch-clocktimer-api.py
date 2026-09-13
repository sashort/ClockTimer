from pathlib import Path
import re

path = Path("ClockTimer.js")
text = path.read_text(encoding="utf-8")


def once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence, found {count}")
    text = text.replace(old, new, 1)


once(
    "        #tripId;\n",
    '''        #tripId;\n\n        #connectionState =\n            "offline";\n\n        #csrfToken;\n\n        #apiBase =\n            "api";\n''',
    "connection fields",
)

mapping = {
    "suspendUpdate": "#suspendUpdate",
    "resumeUpdate": "#resumeUpdate",
    "stop": "#stopLocal",
    "start": "#startLocal",
    "reset": "#resetLocal",
    "insert": "#insert",
    "overwrite": "#overwrite",
    "delete": "#delete",
    "startInterval": "#startIntervalLocal",
    "closeInterval": "#endIntervalLocal",
    "replaceWithNext": "#replaceWithNext",
    "replaceToNext": "#replaceToNext",
    "replaceWithPrevious": "#replaceWithPrevious",
    "replaceToPrevious": "#replaceToPrevious",
    "clear": "#clearLocal",
}

for old, new in mapping.items():
    pattern = re.compile(rf"^(        ){re.escape(old)}(?=\s*\()", re.M)
    text, count = pattern.subn(rf"\1{new}", text)
    if count != 1:
        raise RuntimeError(f"definition {old}: expected 1, found {count}")
    text = text.replace(f"this.{old}(", f"this.{new}(")

once(
    '''                if (!Number.isInteger(tripId)) {\n                    throw new TypeError(\n                        "tripId must be a non-null integer."\n                    );\n                }\n''',
    '''                if (\n                    tripId !== undefined &&\n                    (\n                        !Number.isInteger(tripId) ||\n                        tripId < 1\n                    )\n                ) {\n                    throw new TypeError(\n                        "tripId must be a positive integer when supplied."\n                    );\n                }\n''',
    "optional trip id",
)

once(
    '''                normalizedAttributes =\n                    this.#normalizeIntervalAttributes(\n                        attributes\n                    );\n''',
    '''                normalizedAttributes =\n                    this.#normalizeIntervalAttributes(\n                        attributes\n                    );\n\n                for (\n                    const name of\n                        Object.keys(normalizedAttributes)\n                ) {\n                    if (\n                        name.toLowerCase() ===\n                            "interval-id"\n                    ) {\n                        delete normalizedAttributes[name];\n                    }\n                }\n''',
    "strip interval id",
)

once(
    "            return Boolean(inserted);\n        }\n\n        #endIntervalLocal() {",
    "            return inserted || false;\n        }\n\n        #endIntervalLocal() {",
    "interval local return",
)

block = re.compile(
    r'''        #createIntervalId\(\) \{.*?^        \}\n\n        #getIntervalIdFromAttributes\(.*?^        \}\n\n        #ensureIntervalRecordId\(.*?^        \}\n\n        #ensureIntervalIdAttribute\(.*?^        \}\n''',
    re.M | re.S,
)
replacement = '''        #getIntervalIdFromAttributes(\n            attributes\n        ) {\n            if (\n                !attributes ||\n                typeof attributes !== "object"\n            ) {\n                return undefined;\n            }\n\n            for (const [name, value] of Object.entries(attributes)) {\n                if (String(name).toLowerCase() !== "interval-id") {\n                    continue;\n                }\n\n                const numeric = Number(value);\n                return Number.isInteger(numeric) && numeric > 0\n                    ? numeric\n                    : undefined;\n            }\n\n            return undefined;\n        }\n\n        #ensureIntervalRecordId(\n            record\n        ) {\n            if (\n                !record ||\n                !this.#isIntervalType(record.type)\n            ) {\n                return undefined;\n            }\n\n            const intervalId = Number(\n                record.intervalId ??\n                this.#getIntervalIdFromAttributes(record.otherAttributes)\n            );\n\n            if (!Number.isInteger(intervalId) || intervalId < 1) {\n                delete record.intervalId;\n                if (record.otherAttributes) {\n                    for (const name of Object.keys(record.otherAttributes)) {\n                        if (name.toLowerCase() === "interval-id") {\n                            delete record.otherAttributes[name];\n                        }\n                    }\n                }\n                return undefined;\n            }\n\n            record.intervalId = intervalId;\n            record.otherAttributes = {\n                ...(record.otherAttributes ?? {}),\n                "interval-id": String(intervalId)\n            };\n            return intervalId;\n        }\n\n        #ensureIntervalIdAttribute(\n            range,\n            intervalId\n        ) {\n            if (\n                !range ||\n                range.localName !== "time-range" ||\n                !this.#isIntervalType(range.getAttribute("type"))\n            ) {\n                return undefined;\n            }\n\n            const numeric = Number(intervalId);\n            if (!Number.isInteger(numeric) || numeric < 1) {\n                range.removeAttribute("interval-id");\n                return undefined;\n            }\n\n            range.setAttribute("interval-id", String(numeric));\n            return numeric;\n        }\n'''
text, count = block.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError(f"interval id helper block: expected 1, found {count}")

status_anchor = '''        get status() {\n            if (!this.#hasStartProperties()) {\n                return "ready";\n            }\n'''
if status_anchor not in text:
    raise RuntimeError("status anchor not found")

api_methods = r'''        #setOffline() {
            this.#connectionState = "offline";
            this.#csrfToken = undefined;
        }

        #apiURL(endpoint) {
            return `${String(this.#apiBase).replace(/\/+$/, "")}/${endpoint}/`;
        }

        async #apiRequest(endpoint, { method = "GET", body, csrf = false } = {}) {
            const headers = { "Accept": "application/json" };
            if (body !== undefined) {
                headers["Content-Type"] = "application/json";
            }
            if (csrf) {
                if (!this.#csrfToken) {
                    const error = new Error("A CSRF token is required.");
                    error.clockTimerOffline = true;
                    throw error;
                }
                headers["X-CSRF-Token"] = this.#csrfToken;
            }

            let response;
            try {
                response = await fetch(this.#apiURL(endpoint), {
                    method,
                    credentials: "same-origin",
                    headers,
                    body: body === undefined ? undefined : JSON.stringify(body)
                });
            }
            catch (cause) {
                this.#setOffline();
                const error = new Error("The API is unavailable.", { cause });
                error.clockTimerOffline = true;
                throw error;
            }

            let data = {};
            try {
                data = await response.json();
            }
            catch {}

            if (!response.ok) {
                const error = new Error(
                    data.message || `API request failed (${response.status}).`
                );
                if (response.status === 401 || data.error === "invalid_csrf") {
                    this.#setOffline();
                    error.clockTimerOffline = true;
                }
                throw error;
            }
            return data;
        }

        async #resumeSession() {
            try {
                const data = await this.#apiRequest("users");
                if (typeof data.csrfToken !== "string" || data.csrfToken.length < 32) {
                    this.#setOffline();
                    return false;
                }
                this.#csrfToken = data.csrfToken;
                this.#connectionState = "connected";
                return true;
            }
            catch {
                this.#setOffline();
                return false;
            }
        }

        async #ensureConnected() {
            if (this.#connectionState === "connected" && this.#csrfToken) {
                return true;
            }
            return this.#resumeSession();
        }

        #timelineToISO(milliseconds) {
            const creationDate = this.#getJSONCreationDate();
            if (!creationDate || !Number.isFinite(milliseconds)) {
                return undefined;
            }
            return new Date(creationDate.getTime() + milliseconds).toISOString();
        }

        #tripPersistencePayload() {
            const startTime = this.#timelineToISO(this.#getStartTimeMilliseconds());
            const endTime = this.#timelineToISO(this.#calculatedEndTime);
            if (!startTime || !endTime) {
                throw new Error("The trip does not have persistable timing data.");
            }
            return { startTime, endTime };
        }

        #intervalRecords() {
            return this.#insertedRanges.filter(
                record => this.#isIntervalType(record.type)
            );
        }

        #stripIntervalDatabaseId(record) {
            delete record.intervalId;
            delete record.clockTimerSyncedEnd;
            if (record.otherAttributes) {
                for (const name of Object.keys(record.otherAttributes)) {
                    if (name.toLowerCase() === "interval-id") {
                        delete record.otherAttributes[name];
                    }
                }
            }
            for (const range of this.#getManagedTimeRanges()) {
                if (range.clockTimerInserted === record.id) {
                    this.#ensureIntervalIdAttribute(range, undefined);
                }
            }
        }

        #assignIntervalDatabaseId(record, intervalId) {
            const numeric = Number(intervalId);
            if (!Number.isInteger(numeric) || numeric < 1) {
                throw new Error("The API returned an invalid interval id.");
            }
            record.intervalId = numeric;
            record.otherAttributes = {
                ...(record.otherAttributes ?? {}),
                "interval-id": String(numeric)
            };
            for (const range of this.#getManagedTimeRanges()) {
                if (range.clockTimerInserted === record.id) {
                    this.#ensureIntervalIdAttribute(range, numeric);
                }
            }
        }

        #intervalPayload(record) {
            const attributes = { ...(record.otherAttributes ?? {}) };
            for (const name of Object.keys(attributes)) {
                if (name.toLowerCase() === "interval-id") {
                    delete attributes[name];
                }
            }
            const startTime = record.startDate?.toISOString?.();
            const endTime = record.clockTimerPersistenceEnd ??
                record.endDate?.toISOString?.() ?? null;
            if (!startTime) {
                throw new Error("The interval does not have a persistable start time.");
            }
            return { type: String(record.type), startTime, endTime, attributes };
        }

        async #ensureTripPersisted() {
            if (Number.isInteger(this.#tripId) && this.#tripId > 0) {
                return this.#tripId;
            }
            const data = await this.#apiRequest("trips", {
                method: "POST",
                body: this.#tripPersistencePayload()
            });
            const tripId = Number(data.tripId);
            if (!Number.isInteger(tripId) || tripId < 1) {
                throw new Error("The API returned an invalid trip id.");
            }
            this.#tripId = tripId;
            if (this.#startResetState) {
                this.#startResetState.args.tripId = tripId;
            }
            if (this.#originalStartArguments) {
                this.#originalStartArguments.tripId = tripId;
            }
            return tripId;
        }

        async #syncIntervalRecord(record) {
            const tripId = await this.#ensureTripPersisted();
            const payload = this.#intervalPayload(record);
            const intervalId = Number(record.intervalId);

            if (!Number.isInteger(intervalId) || intervalId < 1) {
                const data = await this.#apiRequest("intervals", {
                    method: "POST",
                    csrf: true,
                    body: { tripId, ...payload }
                });
                this.#assignIntervalDatabaseId(record, data.intervalId);
                record.clockTimerSyncedEnd = payload.endTime;
                return;
            }

            if (payload.endTime !== null && record.clockTimerSyncedEnd !== payload.endTime) {
                await this.#apiRequest("intervals", {
                    method: "PATCH",
                    csrf: true,
                    body: { intervalId, endTime: payload.endTime }
                });
                record.clockTimerSyncedEnd = payload.endTime;
            }
        }

        async #syncIntervals() {
            for (const record of this.#intervalRecords()) {
                await this.#syncIntervalRecord(record);
            }
        }

        async #protectedSync(action) {
            if (!(await this.#ensureConnected())) {
                return false;
            }
            try {
                await action();
                return true;
            }
            catch (error) {
                if (error?.clockTimerOffline) {
                    return false;
                }
                throw error;
            }
        }

        #mutationResult(synced, record) {
            return {
                synced: Boolean(synced),
                tripId: Number.isInteger(this.#tripId) ? this.#tripId : undefined,
                intervalId: Number.isInteger(Number(record?.intervalId))
                    ? Number(record.intervalId)
                    : undefined
            };
        }

        async connect(username, password) {
            if (typeof username !== "string" || username.trim() === "" || typeof password !== "string") {
                throw new TypeError("username and password are required.");
            }
            const data = await this.#apiRequest("users", {
                method: "POST",
                body: { username: username.trim(), password }
            });
            if (typeof data.csrfToken !== "string" || data.csrfToken.length < 32) {
                this.#setOffline();
                throw new Error("The API did not return a CSRF token.");
            }
            this.#csrfToken = data.csrfToken;
            this.#connectionState = "connected";

            if (this.#hasStartProperties()) {
                await this.#ensureTripPersisted();
                await this.#syncIntervals();
            }

            return { connected: true, user: data.user };
        }

        async start(options = {}) {
            if (options === null || typeof options !== "object" || Array.isArray(options)) {
                throw new TypeError("start options must be an object.");
            }
            const { tripId: ignoredTripId, ...localOptions } = options;
            const localResult = this.#startLocal({ ...localOptions, tripId: undefined });
            if (!localResult) {
                throw new Error("The trip could not be started.");
            }
            this.#tripId = undefined;

            let synced = false;
            if (this.#connectionState === "connected") {
                try {
                    await this.#ensureTripPersisted();
                    synced = true;
                }
                catch (error) {
                    if (!error?.clockTimerOffline) {
                        throw error;
                    }
                }
            }
            return this.#mutationResult(synced);
        }

        async stop(stopTime = this.#dateToStandardTime(new Date())) {
            const parsed = this.#validateClockTime(stopTime, "stopTime");
            const stopTimeline = this.#resolveNear(parsed.total, this.#getCurrentTimelineTime());
            const persistedEnd = this.#timelineToISO(stopTimeline);
            const localResult = this.#stopLocal(stopTime);
            if (!localResult || !persistedEnd) {
                throw new Error("The trip could not be stopped.");
            }

            const synced = await this.#protectedSync(async () => {
                const tripId = await this.#ensureTripPersisted();
                await this.#syncIntervals();
                await this.#apiRequest("trips", {
                    method: "PATCH",
                    csrf: true,
                    body: { tripId, action: "stop", endTime: persistedEnd }
                });
            });
            return this.#mutationResult(synced);
        }

        async clear() {
            const oldTripId = this.#tripId;
            let synced = false;

            if (this.#hasStartProperties()) {
                synced = await this.#protectedSync(async () => {
                    const tripId = await this.#ensureTripPersisted();
                    await this.#syncIntervals();
                    await this.#apiRequest("trips", {
                        method: "DELETE",
                        csrf: true,
                        body: { tripId }
                    });
                });
            }

            const localResult = this.#clearLocal();
            if (!localResult) {
                throw new Error("The trip could not be cleared.");
            }
            const resultTripId = this.#tripId ?? oldTripId;
            this.#tripId = undefined;
            return {
                synced,
                tripId: Number.isInteger(resultTripId) ? resultTripId : undefined,
                intervalId: undefined
            };
        }

        async reset() {
            const localResult = this.#resetLocal();
            if (!localResult) {
                throw new Error("The trip could not be reset.");
            }

            const synced = await this.#protectedSync(async () => {
                const tripId = await this.#ensureTripPersisted();
                await this.#apiRequest("trips", {
                    method: "PATCH",
                    csrf: true,
                    body: { tripId, action: "reset", ...this.#tripPersistencePayload() }
                });
                for (const record of this.#intervalRecords()) {
                    this.#stripIntervalDatabaseId(record);
                }
                await this.#syncIntervals();
            });
            return this.#mutationResult(synced);
        }

        async startInterval(type, length, attributes) {
            const localResult = this.#startIntervalLocal(type, length, attributes);
            if (!localResult) {
                throw new Error("The interval could not be started.");
            }
            const current = this.#getCurrentInterval(this.#getCurrentTimelineTime());
            const record = current?.source === "inserted" ? current.record : undefined;
            if (!record) {
                throw new Error("The interval record could not be resolved.");
            }

            const synced = await this.#protectedSync(async () => {
                await this.#ensureTripPersisted();
                await this.#syncIntervals();
            });
            return this.#mutationResult(synced, record);
        }

        async endInterval() {
            const nowDate = new Date();
            const now = this.#getCurrentTimelineTime(nowDate);
            const current = this.#getCurrentInterval(now);
            const record = current?.source === "inserted" ? current.record : undefined;
            const localResult = this.#endIntervalLocal();
            if (!localResult) {
                throw new Error("The interval could not be ended.");
            }
            if (record && !current.open) {
                record.clockTimerPersistenceEnd = this.#timelineToISO(now);
            }

            const synced = await this.#protectedSync(async () => {
                await this.#ensureTripPersisted();
                await this.#syncIntervals();
            });
            return this.#mutationResult(synced, record);
        }

        get state() {
            return this.status;
        }

        get connected() {
            return this.#connectionState === "connected";
        }

'''

text = text.replace(status_anchor, api_methods + status_anchor, 1)
once(
    status_anchor,
    '''        get status() {\n            if (this.#connectionState !== "connected") {\n                return "offline";\n            }\n\n            if (!this.#hasStartProperties()) {\n                return "ready";\n            }\n''',
    "offline status",
)

path.write_text(text, encoding="utf-8")
