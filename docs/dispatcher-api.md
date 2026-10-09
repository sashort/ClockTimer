# Dispatcher API contract

This document describes the supported integration surface for the context-aware ClockTimer dispatcher. It intentionally distinguishes the stable integration contract from the current internal manifest and module list.

## Public globals and load order

Load these classic scripts before calling the dispatcher:

1. `PageManifest.js`
2. `Context.js`
3. `ResourceLoader.js`
4. `Lifecycle.js`
5. `dispatcher.js`

`SettingsSurfaces.js` and `StartupTasks.js` are used by current application startup integrations, but are not required by the three-method dispatcher API itself.

The dispatcher publishes a frozen `globalThis.ClockTimerDispatcher` object with:

- `register(name, initializer, predicate?)`
- `registerResource(name, descriptor, predicate?)`
- `bootstrap(context?)`

These names and their core semantics are the public API. Internal modules, manifest entries, cache-busting query strings, and implementation details are not public API.

## Context contract

A context is normalized by `ClockTimerContext.normalize(input)`. Supported fields currently include:

- `host`: `order-filler`, `drop-in`, or `settings-frame`
- `surface`: a surface identifier such as `application` or a settings dialog name
- `presentation`: `application` or `graphical-settings`
- `features`: feature-name array
- `capabilities`: capability-name-to-boolean map
- `options`: additional integration metadata

Contexts returned by normalization are immutable at the top level, and their `features`, `capabilities`, and `options` containers are frozen. Use `ClockTimerContext.child(parent, overrides)` for nested resources instead of constructing a child context by spreading the parent. Restrictive capabilities remain disabled in child contexts, and child features are limited by both host policy and parent features.

Unknown host names resolve through the manifest's current fallback policy; callers should use only the three supported host names.

## Feature registration

`register(name, initializer, predicate)` registers or replaces a feature under `name`. The initializer is awaited and receives the normalized context. The optional predicate is evaluated against that context. During bootstrap, when `context.features` is non-empty, only features named in that list are eligible; when it is empty, predicate-approved registrations are eligible.

The return value is an unregister function. Initializers may return a cleanup function or an object with a `dispose()` method. Lifecycle starts are deduplicated by feature name and normalized context; use `ClockTimerLifecycle.stop(name, context)` or `stopAll()` to dispose active instances.

## Resource registration and ordering

`registerResource(name, descriptor, predicate)` registers or replaces a resource. A descriptor requires:

- `type`: `script`, `style`, or `template`
- `url`: non-empty string

Optional descriptor fields include `hosts`, `features`, `capability`, `target`, and `options`. Host, feature, capability, and predicate restrictions are checked before loading. Resources are loaded sequentially in registration order, then eligible feature initializers are started sequentially in registration order. Register dependencies before their consumers; do not rely on parallel loading.

Script and style loads are deduplicated by URL and context while their load promise remains cached. Failed script/style loads clear that pending entry and can be retried. Nested templates must use the resource loader's context propagation rather than loading child assets independently.

## Bootstrap result and events

`await ClockTimerDispatcher.bootstrap(context)` resolves to an object containing:

- `context`: the normalized context used for this bootstrap
- `resources`: names of resources successfully loaded during this call, in order
- `features`: objects containing each started feature's `name` and initializer `result`, in order

On success, the document receives `clocktimer-dispatcher-ready` with `detail: { context, resources, features }`, where `features` is an array of names. On failure, bootstrap stops features started by that call in reverse order, dispatches `clocktimer-dispatcher-error` with `detail: { context, resources, error }`, then rethrows the error. Resources already loaded are not unloaded.

## Compatibility and change policy

Treat the three dispatcher methods, context field meanings, sequential ordering, result shape, lifecycle cleanup, and ready/error event names and detail shapes as stable integration contract. Additive optional fields may be introduced. Changes to these semantics require updating the contract tests and this document in the same change.

The extraction is still in progress. This contract does **not** claim that every application behavior has been extracted from `app.js`, nor that full-page compatibility or all CI jobs have been verified. Before declaring the refactor complete, validate Order-Filler, Drop-In, standalone graphical settings, embedded settings iframes, and the full CI suite.
