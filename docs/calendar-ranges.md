# Trip Log calendar rules

Trip Log and goal totals now share a resolved civil-date range. The end is exclusive;
the adapter subtracts one millisecond when calling the existing inclusive trips API.
Weeks and pay periods use employer rules. Month and Year mean Gregorian calendar
month/year, not retailer fiscal month/year. A store timezone configured on the server
overrides the browser timezone; without one, the browser timezone is used and shown.

## Search and future years

The server uses OpenAI Responses web search restricted to a profile's official domains,
then a separate strict JSON extraction request. Search uses the year of the requested
local date, not a hardcoded year or filename. Verification refreshes after 30 days
or a year change when `calendar_auto_refresh` is enabled. A per-profile lock and
one-hour automatic attempt interval bound duplicate requests and failures. Explicit
superuser refreshes can retry after one minute. Provider failures report only HTTP
status and safe error codes/parameter names, never secret-bearing messages. The session lock is
released before provider calls. The first lookup during refresh can take up to 90 seconds.

Source URLs must appear in the search response and match official domains. Every
extracted rule requires supporting evidence; pay periods require three consistent
observed consecutive starts and a matching anchor phase. Payday is not an anchor.
If a PDF's colored dates or legend cannot be read, extraction must return unknown.
These checks validate format, provenance, and consistency; AI extraction can still
misread a source. Returned source links/evidence allow review.

An explicitly recurring rule calculates 2028 and later without a stored list of dates.
Beyond the latest verified coverage, the response labels that calculation
`extrapolated`. A year-only calendar is never silently carried into another year.
Failed search preserves the previous discovered cache. Weekday and cutoff time must
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
'calendar_auto_refresh' => true,
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
changing the resolver. No database migration is required.

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
requests an explicit refresh, subject to a one-minute attempt limit.

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
