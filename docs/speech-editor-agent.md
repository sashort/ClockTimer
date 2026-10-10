# Speech Editor JSON / agent interface

The Speech Editor exposes semantic editor actions through
`WMOFSpeechEditorActionFunctions`. GUI controls call the same action layer.

## Security

Opening the Speech Editor requires:

- an authenticated WMOF session;
- a valid WMOF CSRF token; and
- `developer_preview` (8), `developer` (16), or `superuser` (4).

The main application opens the editor with a same-origin POST. Direct GET navigation to
the editor page is rejected.

The agent bridge is:

`/api/admin/speech-editor/agent/`

Every bridge request requires the authenticated session cookie and
`X-CSRF-Token`. Requests are isolated by WMOF user ID. A separately authenticated
agent session for the same account can therefore communicate with an open Speech Editor
tab without sharing the tab's PHP session cookie.

## Discover actions

With an authorized editor tab open:

```http
GET /api/admin/speech-editor/agent/?operation=manifest
X-CSRF-Token: <token>
Cookie: <authenticated WMOF session>
```

The response contains `connected`, the current editor action manifest, and the latest
editor state snapshot.

## Enqueue an action

```http
POST /api/admin/speech-editor/agent/
Content-Type: application/json
X-CSRF-Token: <token>
Cookie: <authenticated WMOF session>

{
  "action": "setSpeechAttributes",
  "input": {
    "selector": "#tripActionControls",
    "attrs": {
      "speech-pattern": "^open trip log$",
      "speech-function": "WMOFActions.openTripLog"
    }
  }
}
```

The endpoint returns a `requestId`. Poll:

```http
GET /api/admin/speech-editor/agent/?operation=status&requestId=<requestId>
X-CSRF-Token: <token>
Cookie: <authenticated WMOF session>
```

## Atomic batches

```json
{
  "atomic": true,
  "actions": [
    {
      "action": "addSpeechMenu",
      "input": {
        "target": "#tripActionControls"
      }
    },
    {
      "action": "addSpeechCommand",
      "input": {
        "menuTarget": "#tripActionControls",
        "attrs": {
          "speech-pattern": "^open trip log$",
          "speech-function": "WMOFActions.openTripLog"
        }
      }
    },
    {
      "action": "validateChanges",
      "input": {}
    }
  ]
}
```

Atomic batches snapshot the editor draft and restore it if a step fails. Actions with
external side effects, such as `saveChanges` and `runMacro`, cannot run inside an
atomic batch.

To persist a validated draft, enqueue `saveChanges` as a separate command.


## Natural speech templates

The editor persists the human-readable Regex Builder source as `speech-template`
alongside the compiled `speech-pattern`.

For example:

```json
{
  "action": "setSpeechTemplate",
  "input": {
    "selector": "#tripActionControls",
    "template": "set [the] {trip|total} goal to <percent>"
  }
}
```

The editor compiles the template and updates both attributes atomically. Agents can
inspect the syntax with `getSpeechTemplateSyntax`, inspect one target with
`getSpeechTemplate`, or inspect all live templates through `getSpeechCatalog`.

Template syntax includes:

- `[text]` for optional content;
- `{one|two|three}` for alternatives;
- `<template>` for wildcards such as `<time>`, `<duration>`, and `<percent>`;
- `<name:template>` for named captures.

If the raw `speech-pattern` is edited so it no longer matches its stored natural
template, the editor clears `speech-template` to avoid exposing stale source text.
