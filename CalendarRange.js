(() => {
    "use strict";
    const dayMilliseconds = 86400000;
    const pad = value => String(value).padStart(2, "0");
    const dateString = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    function civilDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Invalid calendar date.");
        const date = new Date(`${value}T00:00:00Z`);
        if (!Number.isFinite(date.getTime()) || dateString(date) !== value) throw new RangeError("Invalid calendar date.");
        return date;
    }
    function localParts(instant, timezone) {
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
        });
        const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
        return {date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}`};
    }
    function boundary(date, time, timezone) {
        const wall = Date.parse(`${date}T${time}Z`);
        let candidate = wall;
        for (let attempt = 0; attempt < 5; attempt++) {
            const parts = localParts(new Date(candidate), timezone);
            const rendered = Date.parse(`${parts.date}T${parts.time}Z`);
            if (rendered === wall) return new Date(candidate);
            candidate += wall - rendered;
        }
        throw new RangeError("The calendar cutoff does not exist in this timezone on this date.");
    }
    function calculate(rules, range, at, timezone) {
        if (!Number.isInteger(rules.weekStartDay) || rules.weekStartDay < 0 || rules.weekStartDay > 6 ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(rules.cutoffTime)) throw new RangeError("Invalid cached calendar rules.");
        civilDate(rules.effectiveFrom);
        if (typeof rules.recurring !== "boolean" || (!rules.recurring && !rules.effectiveThrough)) throw new RangeError("Invalid cached calendar coverage.");
        if (rules.effectiveThrough) civilDate(rules.effectiveThrough);
        const instant = new Date(at);
        if (!Number.isFinite(instant.getTime())) throw new RangeError("Invalid calendar timestamp.");
        const local = localParts(instant, timezone);
        let date = civilDate(local.date);
        if (local.time < rules.cutoffTime) date = new Date(date.getTime() - dayMilliseconds);
        const day = dateString(date);
        if (day < rules.effectiveFrom || (!rules.recurring && (!rules.effectiveThrough || day > rules.effectiveThrough))) {
            throw new RangeError("No verified calendar covers this date. Refresh the calendar source.");
        }
        let start, end;
        if (range === "day") {
            start = date; end = new Date(start.getTime() + dayMilliseconds);
        } else if (range === "week") {
            const offset = (date.getUTCDay() - rules.weekStartDay + 7) % 7;
            start = new Date(date.getTime() - offset * dayMilliseconds);
            end = new Date(start.getTime() + 7 * dayMilliseconds);
        } else if (range === "pay-period") {
            if (!Number.isInteger(rules.payPeriodDays) || rules.payPeriodDays < 1 || rules.payPeriodDays > 366 || !rules.payPeriodAnchorDate) {
                throw new RangeError("No verified recurring pay-period anchor is available.");
            }
            const anchor = civilDate(rules.payPeriodAnchorDate);
            const cycles = Math.floor((date - anchor) / dayMilliseconds / rules.payPeriodDays);
            start = new Date(anchor.getTime() + cycles * rules.payPeriodDays * dayMilliseconds);
            end = new Date(start.getTime() + rules.payPeriodDays * dayMilliseconds);
        } else if (range === "month") {
            start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
            end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
        } else if (range === "year") {
            start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
            end = new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));
        } else throw new RangeError("Unknown Trip Log Range.");
        const lastDay = dateString(new Date(end.getTime() - dayMilliseconds));
        if (dateString(start) < rules.effectiveFrom || (!rules.recurring && lastDay > rules.effectiveThrough)) {
            throw new RangeError("The complete range is not covered by the verified calendar.");
        }
        return {
            range, timezone,
            startTime: boundary(dateString(start), rules.cutoffTime, timezone).toISOString(),
            endTime: boundary(dateString(end), rules.cutoffTime, timezone).toISOString(),
            endExclusive: true,
            extrapolated: Boolean(rules.effectiveThrough && lastDay > rules.effectiveThrough)
        };
    }
    class CalendarRange {
        constructor({baseUrl = location.origin + "/", fetcher = (...args) => fetch(...args), storage = localStorage, profile = "walmart-us"} = {}) {
            this.baseUrl = baseUrl; this.fetcher = fetcher; this.storage = storage;
            this.profile = profile;
        }
        static calculate(...args) { return calculate(...args); }
        static tripWindow(window) {
            // Existing trips API includes maxDateTime. Keep the following period's midnight out.
            return {startTime: window.startTime, endTime: new Date(Date.parse(window.endTime) - 1).toISOString()};
        }
        async resolve({range = "week", at = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone, profile = this.profile} = {}) {
            const key = `wmof.calendar.${profile}.${timezone}`;
            const url = new URL("api/calendar/", this.baseUrl);
            url.search = new URLSearchParams({range, at: new Date(at).toISOString(), timezone, profile});
            let record;
            try {
                const response = await this.fetcher(url, {credentials: "same-origin", headers: {Accept: "application/json"}});
                record = await response.json();
                if (!response.ok) {
                    const error = new Error(record.message || "Calendar lookup failed.");
                    error.authoritative = response.status < 500;
                    throw error;
                }
                calculate(record.rules, range, at, record.timezone);
                try { this.storage.setItem(key, JSON.stringify(record)); } catch {}
                return {...record, offline: false};
            } catch (error) {
                if (error.authoritative) throw error;
                let cached;
                try { cached = JSON.parse(this.storage.getItem(key)); } catch {}
                if (!cached?.rules) throw error;
                let result, rules = cached.rules;
                try { result = calculate(rules, range, at, cached.timezone); }
                catch (error) {
                    if (range === "pay-period" || !cached.fallbackRules) throw error;
                    rules = cached.fallbackRules;
                    result = calculate(rules, range, at, cached.timezone);
                }
                return {...cached, ...result, rules, offline: true, refreshNeeded: true,
                    warning: "Using cached calendar rules while the calendar service is unavailable."};
            }
        }
    }
    globalThis.CalendarRange = CalendarRange;
})();
