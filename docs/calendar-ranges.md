# Trip Log calendar rules

Trip Log and goal totals now share a resolved civil-date range. The end is exclusive;
the adapter subtracts one millisecond when calling the existing inclusive trips API.
Weeks and pay periods use employer rules. Month and Year mean Gregorian calendar
month/year, not retailer fiscal month/year. A store timezone configured on the server
overrides the browser timezone; without one, the browser timezone is used and shown.

## Search and future years

The server uses OpenAI Responses web search restricted to a profile's official domains,
then a separate strict JSON extraction request. Search uses the year of the requested
local date, not a hardcoded year or filename. Validated rules are stored in the `calendar_rules` database table per profile,
profile configuration, and calendar year. Normal authenticated GET lookups read the database only. Discovery runs only
when a superuser explicitly requests a year with no saved record. Successful records never
expire after 30 days; earlier years remain available for historical lookups. A per-profile lock and
one-hour automatic attempt interval bound duplicate requests and failures. Explicit
superuser refreshes can retry after one minute. Provider failures report only HTTP
status and safe error codes/parameter names, never secret-bearing messages. The session lock is
released before provider calls. The first lookup during refresh can take up to 90 seconds.

Source URLs must appear in the search response and match official domains. Every
extracted rule requires supporting evidence; Walmart uses the configured 14-day cycle anchored to the official first day
of fiscal week 1. Other employers still require three observed period starts. Payday is not an anchor.
If a PDF's colored dates or legend cannot be read, extraction must return unknown.
These checks validate format, provenance, and consistency; AI extraction can still
misread a source. Returned source links/evidence allow review.

An explicitly recurring rule calculates 2028 and later without a stored list of dates.
Beyond the latest verified coverage, the response labels that calculation
`extrapolated`. A year-only calendar is never silently carried into another year.
Failed search preserves previously stored rules. One annual discovery cycle uses
a search request followed by a separate extraction request; normal range lookups
make neither request. Failed attempts can retry subject to the rate limit. Weekday and cutoff time must
both be found in source-backed data; there is no baked-in Saturday or midnight fallback.
If discovery is incomplete and no usable discovered cache exists, the service returns
a clear error. Cache/profile scope changes force rediscovery. A discovered statement
of Saturday 12:00 a.m. means the START of Saturday in the store timezone, taken literally.

## Server setup

Add to `/etc/clocktimer/config.php` (the real key must never be committed):

```php
'openai_api_key' => 'YOUR_SERVER_SIDE_KEY', // alternatively OPENAI_API_KEY
'calendar_search_model' => 'gpt-5.5',
'calendar_extraction_model' => 'gpt-5.5',
'calendar_cache_directory' => '/var/lib/clocktimer/calendars',
'calendar_profiles' => [
    'walmart-us' => [
        'organization' => 'Walmart',
        'locale' => 'United States; specify the applicable region/state here',
        'timezone' => 'America/New_York', // replace with the actual store timezone
        'allowedDomains' => ['one.walmart.com', 'corporate.walmart.com'],
    ],
],
```

The default Walmart profile specifies organization, region, and official domains only.
Week-start weekday, cutoff time, and pay-period anchor are discovered, not preset.
Other employers/regions use separate profile IDs and configured official domains.
The front-end resolver accepts a `profile` argument; the
current UI defaults to `walmart-us`. Set `data-calendar-profile="your-profile-id"`
on the HTML root element to select another configured employer/region without
changing the resolver. Deploy applies `003_calendar_rules` to create the rules and refresh-attempt tables.
Existing matching private JSON caches are imported into the table during deployment.

The deploy workflow prepares a private daemon-owned cache directory outside the
web root. PHP cURL and HTTPS outbound access to `api.openai.com` are required. Models
are configurable for provider changes. Search uses the app's API account and incurs
normal provider charges; it does not use this chat's search allowance.

## API

Authenticated GET `/api/calendar/?profile=walmart-us&range=week&at=2028-02-29T17%3A00%3A00Z&timezone=America%2FNew_York`
returns UTC boundaries, store-local boundaries, effective rules, evidence sources,
verification time, requested search year, refresh/extrapolation status, and warnings.

Superuser POST `/api/calendar/` with CSRF header and JSON
`{"profile":"walmart-us","range":"week","at":"2028-02-29T17:00:00Z","timezone":"America/New_York"}`
requests discovery if that year has no stored record, subject to a one-minute
attempt limit. An already saved year is returned without contacting OpenAI.

## Verification

```sh
php tests/calendar_ranges.php
cd tests
npm install
npm run test:calendar
```

Tests cover 2028, leap years, DST, exact-midnight separation, generic rules, offline
caching, source/phase validation, requested-year search payloads, list pagination,
goal/list boundary consistency, and async selection races. Provider responses are
mocked; a real search requires the server API key. DOM tests do not verify visual
layout. The frontend caches rules, not the full Trip Log contents.

Official implementation references:
[OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search),
[Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Superuser calendar editor

Sign in through the main app, then open `/api/admin/calendar/?editor=1`.
Select a profile and year, load stored rules, edit the weekday, daily cutoff,
pay-period length/anchor, coverage dates and recurrence, and enter a correction
note. Unknown pay-period fields must both remain empty. No default employer
weekday or cutoff is invented. Manual saves also work before initial discovery,
so a verified calendar can be entered when the provider is unavailable.

The editor and its GET/POST API require HTTPS and the superuser permission;
saves require CSRF protection. Records include manual provenance, the actor,
note, change time and previous rules. A manually saved year is reused without
external discovery. Profile timezone remains a server configuration setting.
The public range API returns evidence and provenance but not internal edit history.

GET `/api/admin/calendar/?profile=walmart-us&year=2026` returns the selected
or latest earlier record. POST the same endpoint with JSON containing `profile`,
`year`, `rules`, and `note` to save. The rules object uses the existing API names:
`weekStartDay`, `cutoffTime`, `payPeriodDays`, `payPeriodAnchorDate`, `recurring`,
`effectiveFrom`, and `effectiveThrough`.

Run `php -d extension=pdo_sqlite tests/calendar_store.php` and
`php tests/calendar_database_lookup.php` and `node tests/calendar-editor.mjs` in addition to the existing calendar suites.

Storage columns are `profile VARCHAR(64)`, `definition_hash VARCHAR(64)`,
`calendar_year INTEGER`, `record_json TEXT`, and `verified_at BIGINT` (Unix seconds).
The first three columns form the primary key. The JSON contains the typed rules,
source evidence, discovery year, provenance and manual correction history.

Normal app requests never contact OpenAI, even if an older deployment's
configuration still contains `calendar_auto_refresh=true`. A superuser must
refresh each new year explicitly or enter verified values through the editor.
The application endpoint is the secure bridge to the database, not a discovery
service for ordinary users.

## Walmart pay-period anchor

For newly discovered or manually edited Walmart records, `payPeriodAnchorDate`
is the first day of fiscal week 1, with `payPeriodDays=14`. Date arithmetic uses
these persisted rules, the daily cutoff and the store timezone. Week 1 and week 2
form pay period 1, week 3 and week 4 form pay period 2, etc. Pay-period responses
include `payWeek` (1 or 2) and `payPeriodNumber` (1-based since the anchor, null
before it). Other employers retain their existing pay-period start anchors.

`payPeriodAnchorBasis` marks new Walmart rules as `fiscal-year-start`. Existing
records default to `period-start` and are not silently reinterpreted: review and
save the fiscal-week-one date in the superuser editor to change their meaning.
The date is discovered from the fiscal calendar beginning in the selected year;
it is not assumed to be January 1. Annual discovery remains explicit, and normal
lookups use only database values. A recurring prior-year record may be used when
a new annual record is missing, with `refreshNeeded=true`; verify that year's
anchor before treating its period numbering as current.

## Login bootstrap and local calculation

Both login POST and authenticated session GET `/api/users/` include `calendars`:
all saved annual rules for the configured profiles, timezone, sources and verification
metadata, without internal manual history. The app installs these database records
on login/session restore and computes day, week, pay-period, month and year locally.
Range changes make no calendar API request and no provider request. Trip data and
totals still use the trips endpoint. After a superuser changes a rule, reconnect
or log in again to load the updated database values. Missing rules produce a clear
message instead of a discovery request. For pay periods before the new fiscal-year
anchor, a saved prior-year anchor is used; missing prior data is not guessed.

## Custom Trip Log dates

The menu has a Custom range and one Start/End date row. Predefined ranges show
calculated store-local dates with disabled inputs. Custom enables both inputs;
the selected end date includes the whole civil day. Custom uses midnight
boundaries in the store timezone and respects daylight saving time. Reversed
or incomplete dates show an inline error and do not apply an aggregate refresh.
Custom dates are saved locally and restored when returning to Custom.

Changing the range or either Custom date updates the aggregate criteria even
when Trip Log is closed; an open Trip Log reloads the same date window. Aggregate
refreshes serialize and obsolete pending requests are skipped. The existing
ClockTimer goal calculation recalculates automatic percent goals and refreshes
remaining-time and calculated-end math and visuals; manual goals remain manual.
Run `node tests/custom-trip-range.mjs` and `node tests/custom-range-goals.mjs`.
