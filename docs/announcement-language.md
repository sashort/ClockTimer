# Language packs

`index.php` renders `templates/index.html`. `?lang=en-US` selects `lang/en-US`; omitted, invalid, or unavailable folders use English. A folder must contain all four version-1 resources: `ui-text.json`, `speech-patterns.json`, `announcements.json`, and `associations.json`. Only English is supplied.

UI text, speech patterns, preprocessors, announcement types, and associated elements use UUID definitions. Distinct speech patterns must have distinct IDs, including across languages. Runtime copies receive separate instance IDs while retaining their definition references. Associations connect elements to text, patterns, preprocessors and select options. Option values remain application keys; labels and available options can vary by language.

PHP escapes HTML text and safely embeds the resource pack as JSON. Language-specific parser implementations must be JavaScript files inside the selected language folder. Declarative replacement rules can be attached to preprocessors through their transform IDs. `LanguagePack.js` resolves runtime text and speech bindings and observes dynamically inserted elements and component shadow roots.

Announcement templates use named placeholders such as `{duration}`. Queue type IDs remain positive numeric IDs independent of language; announcement definition UUIDs identify their underlying resource. Chimes, priorities, and event state remain application logic. English spoken-value parsers are supplied; a new language must provide suitable vocabulary and parsing rules.

The generated `index.html` is the English static fallback. Regenerate the English static pages after template/resource edits with `node scripts/build-pages.cjs`; PHP continues to render localized production pages. Hosting must support PHP and prefer `index.php` (the supplied `.htaccess` sets this for Apache).

Checks: PHP template tests cover fallback, HTML/script escaping, UUID uniqueness, alternate-language options and parser paths. Runtime tests cover command bindings, cloned elements, shadow roots and preprocessing transforms. Announcement tests cover template loading, substitution and queue behavior.

The current goal-limit messages are `messages.settings.goalCapped` and
`messages.settings.goalCappedNotice`, parameterized by scope and requested value.
The spoken correction, such as “Day goal changed to 150 percent.”, precedes Auto/
Sync recalculation and later chain messages. The informational notice is not a
speech-command surface. Classic/Goal bar menu text and the Standard Time option
in the configurable selector use normal UUID text associations. Main header text
is “Standard Time” in every selected scope. See [goal-bar.md](goal-bar.md).
