# Announcement language resources

English announcement sentences live in `lang/en-US/announcements.json`. The musical catalog `api/audio/catalog.json` contains notes and tempo, without embedded speech. `AnnouncementLanguage.js` reads the selected language resource and resolves templates. `app.js` waits for the resource before initialization, using the document's language (`en` resolves to `en-US`). Missing languages or missing translated templates fall back to English.

The language file has `version`, `locale`, `announcements`, and `messages`. Announcement entries use stable type keys such as `trip-started`, `trip-ended`, `goal-failed`, and `syncTry`. Components and variants contain sentences with named placeholders, for example:

```json
{
  "summary": "Trip started.",
  "details": "{duration} until {goal}."
}
```

JavaScript supplies values rather than concatenating the sentence. Translations can move placeholders to any position. Values such as durations and numbers continue through the existing English spoken-value formatters; another language may need its own value formatter as well as translated sentences. Chime references, component priorities, and state decisions remain language-independent.

`WMOFAnnouncementLanguage.load(locale)` selects a resource. Subsequent announcements use its sentences. Loads are cached and language selections are protected against outdated asynchronous requests. `text(path, values)` resolves a sentence, rejecting missing templates and missing required values. `summary(type)` exposes a fixed announcement summary and its speech options. Audio output includes the selected speech language.

`AnnouncementCatalog.js` assigns stable positive IDs to built-in types. IDs do not depend on the spoken wording, language, or load order. New types should receive new IDs; existing IDs must not be renumbered. Custom runtime types retain the queue's fallback ID allocation starting at 1000. Informational announcements now deduplicate by underlying event type, including differently worded outcomes of the same type in one nonempty queue cycle.

English-only implementation: trip start/resume/end, goal failures and remaining time, sync outcomes, chime summaries and meal cues, audio-setting confirmations, goal/mode/range confirmations and time readbacks. This does not translate the entire UI, speech-recognition grammar, or voice-entry dialog prompts.

Tests: `tests/announcement-language.mjs` checks loading, substitutions, fallback, language switching, and template coverage; `tests/announcement-english-output.mjs` checks the actual dynamic sentence builders. Queue, component, chime, and volume tests also exercise the loaded English resource.
