<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';

require_method('POST');
authenticated_user_id();
require_csrf_form();

$editorUser = require_any_permission(
    PERMISSION_DEVELOPER_PREVIEW,
    PERMISSION_DEVELOPER
);

$canWrite = has_permission(
    $editorUser,
    PERMISSION_DEVELOPER
);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
?><!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>WMOF Speech Command Editor</title>
    <link rel="stylesheet" href="editor.css?v=<?=htmlspecialchars((string) @filemtime(__DIR__ . '/editor.css'), ENT_QUOTES)?>">
</head>
<body data-csrf="<?=htmlspecialchars(csrf_token(), ENT_QUOTES)?>" data-can-write="<?=$canWrite ? 'true' : 'false'?>" data-access-mode="<?=$canWrite ? 'developer' : 'developer-preview'?>">
    <header class="toolbar">
        <h1>Speech Command Editor</h1>
        <div class="viewport-controls" aria-label="Preview viewport controls">
            <label>
                <span>Screen Size</span>
                <select id="screenSizeSelect">
                    <option value="">Fill center</option>
                </select>
            </label>
            <label>
                <span>Compare To</span>
                <select id="compareSizeSelect">
                    <option value="">None</option>
                </select>
            </label>
        </div>
        <label class="workspace-layout-control">
            <span>Workspace</span>
            <select id="workspacePreset" aria-label="Workspace layout">
                <option value="custom">Custom</option>
                <option value="authoring">Authoring</option>
                <option value="macro">Macro</option>
                <option value="regex">Regex</option>
            </select>
        </label>
        <button id="overlayToggle" type="button" aria-pressed="true">Overlay: On</button>
        <button id="jsonActionsButton" type="button">JSON</button>
        <button id="discardButton" type="button" disabled>Discard</button>
        <button id="saveButton" class="primary" type="button" disabled>Save changes</button>
    </header>
    <main class="layout">
        <aside id="leftDock" class="workspace-dock workspace-dock-left" data-workspace-dock="left" aria-label="Left workspace dock">
        <section class="dom-navigator workspace-pane" data-pane-id="dom" aria-label="DOM navigator">
            <header class="navigator-header workspace-pane-heading">
                <h2>DOM Navigator</h2>
                <label class="navigator-search">
                    <span class="sr-only">Filter DOM elements</span>
                    <input id="domSearch" type="search" placeholder="Search elements…" autocomplete="off" spellcheck="false">
                </label>
            </header>
            <div id="domTree" class="dom-tree" role="tree" aria-label="Application DOM"></div>
        </section>
        </aside>

        <section class="preview" aria-label="WMOF preview">
            <div id="previewScroller" class="preview-scroller">
                <div id="previewStage" class="preview-stage">
                    <div id="topRuler" class="ruler ruler-top" aria-hidden="true"></div>
                    <div id="leftRuler" class="ruler ruler-left" aria-hidden="true"></div>

                    <div id="screenFrame" class="screen-frame">
                        <iframe id="appFrame" title="WMOF application" src="../../../index.html"></iframe>
                        <div id="compareMaskTop" class="compare-mask" aria-hidden="true"></div>
                        <div id="compareMaskRight" class="compare-mask" aria-hidden="true"></div>
                        <div id="compareMaskBottom" class="compare-mask" aria-hidden="true"></div>
                        <div id="compareMaskLeft" class="compare-mask" aria-hidden="true"></div>
                    </div>

                    <div id="compareFrame" class="compare-frame" aria-hidden="true"></div>
                    <div id="compareDeltaLeft" class="compare-delta" aria-hidden="true"></div>
                    <div id="compareDeltaRight" class="compare-delta" aria-hidden="true"></div>
                    <div id="compareDeltaTop" class="compare-delta" aria-hidden="true"></div>
                    <div id="compareDeltaBottom" class="compare-delta" aria-hidden="true"></div>
                </div>
            </div>
            <div id="previewHint">Click an element to select it. Turn off the overlay to interact with the app.</div>
        </section>

        <aside id="rightDock" class="inspector workspace-dock workspace-dock-right" data-workspace-dock="right" aria-label="Speech command editor">
            <section class="phrase-pane workspace-pane" data-pane-id="phrases" aria-label="Speech phrases">
                <div class="pane-heading workspace-pane-heading">
                    <div>
                        <h2>Speech Phrases</h2>
                        <p class="subtle">Available phrases, grouped by candidate and SpeechMenu precedence.</p>
                    </div>
                </div>
                <div id="phraseList" class="phrase-list" role="tree" aria-label="Configured speech phrases"></div>
            </section>

            <section class="attribute-pane workspace-pane" data-pane-id="attributes" aria-label="Speech attributes">
                <div class="selection-heading workspace-pane-heading">
                    <h2 id="selectedTitle">Select an element</h2>
                    <p id="selectedPath" class="subtle">Choose an item in the DOM navigator, phrase list, or preview.</p>
                </div>

                <label id="speechMenuToggleField" class="speech-menu-toggle" hidden>
                    <input id="speechMenuToggle" type="checkbox">
                    <span>Speech Menu</span>
                </label>

                <div id="menuActions" class="menu-actions" hidden>
                    <button id="addCommandButton" class="primary" type="button">+ Add Speech Command</button>
                </div>

                <form id="attributeForm" autocomplete="off" hidden>
                    <label class="field" data-candidate-field>
                        <span>speech-pattern</span>
                        <input name="speech-pattern" spellcheck="false">
                    </label>

                    <label class="field combo-field" data-candidate-field>
                        <span>speech-function</span>
                        <input id="functionInput" name="speech-function" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" spellcheck="false">
                        <div id="functionOptions" class="combo-options" role="listbox" hidden></div>
                    </label>

                    <label class="field combo-field" data-candidate-field>
                        <span>speech-preproc</span>
                        <input id="preprocInput" name="speech-preproc" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" spellcheck="false">
                        <div id="preprocOptions" class="combo-options" role="listbox" hidden></div>
                    </label>

                    <div id="preprocSettings" class="preproc-settings" hidden>
                        <label class="field">
                            <span>speech-preproc-context</span>
                            <input name="speech-preproc-context" list="preprocContextOptions" spellcheck="false">
                            <datalist id="preprocContextOptions"></datalist>
                        </label>
                        <label class="field">
                            <span>speech-preproc-field</span>
                            <input name="speech-preproc-field" list="preprocFieldOptions" spellcheck="false">
                            <datalist id="preprocFieldOptions"></datalist>
                        </label>
                    </div>

                    <label class="field">
                        <span>speech-index</span>
                        <input id="speechIndexValue" name="speech-index" type="number" step="1" inputmode="numeric">
                        <small class="field-hint">Higher values take precedence within the same effective scope. Blank is 0.</small>
                    </label>

                    <label class="field">
                        <span>speech-modal</span>
                        <select id="modalValue" name="speech-modal">
                            <option value="">Blank — inherit structural scope</option>
                            <option value="top-level">top-level</option>
                            <option value="default">default</option>
                        </select>
                        <small id="modalHint" class="field-hint"></small>
                    </label>

                    <button id="removeButton" class="remove" type="button">Remove speech configuration</button>
                </form>

                <p id="status" role="status" aria-live="polite"></p>
            </section>

            <section id="regexBuilderPanel" class="regex-builder regex-builder-pane workspace-pane" data-pane-id="regex" aria-label="Speech pattern regex builder">
                <div class="regex-builder-heading workspace-pane-heading">
                    <div>
                        <h3>Regex Builder</h3>
                        <p>Write the phrase you want recognized; the builder handles regex syntax and recognizer-safe normalization.</p>
                    </div>
                    <button id="regexBuilderHelpButton" class="regex-help-button" type="button" aria-expanded="false" aria-controls="regexBuilderHelp" title="Regex Builder help">?</button>
                </div>

                <div id="regexBuilderHelp" class="regex-builder-help" hidden>
                    <p><strong>Templates:</strong> type <code>&lt;</code> to open the inline picker. App-specific templates appear first. You can also type wildcards directly; closing <code>&gt;</code> will infer the template.</p>
                    <p><code>&lt;AAA&gt;</code> → <code>&lt;letters:3&gt;</code>, <code>&lt;###&gt;</code> → <code>&lt;digits:3&gt;</code>, <code>&lt;##.##&gt;</code> → <code>&lt;decimal:2.2&gt;</code>, and <code>&lt;code:AAA&gt;</code> → a named <code>code</code> capture.</p>
                    <p>Semantic values can also be inferred. For example, <code>&lt;12:30 pm&gt;</code> resolves to Time; ambiguous values such as <code>&lt;12:30&gt;</code> open the matching app-template choices instead of guessing.</p>
                    <p><code>[please]</code> makes content optional. <code>{start|begin|go}</code> creates alternatives. Lengths may be exact, ranged (<code>2..5</code>), open-ended (<code>2..</code>), one-or-more (<code>+</code>), or zero-or-more (<code>*</code>).</p>
                    <p>Literal text is lowercased, punctuation is scrubbed, spaces are normalized, and the final pattern is anchored automatically.</p>
                </div>

                <label class="regex-builder-field">
                    <span>Phrase template</span>
                    <textarea id="regexBuilderInput" rows="3" spellcheck="false" autocomplete="off" placeholder="set [the] {trip|total} goal to <percent>"></textarea>
                    <div id="regexBuilderPicker" class="regex-builder-picker" role="listbox" hidden></div>
                </label>

                <div id="regexBuilderRegexRow" class="regex-builder-regex-row" data-valid="false">
                    <code id="regexBuilderOutput">Enter a phrase template.</code>
                    <button id="regexBuilderCopy" type="button" disabled>Copy</button>
                    <button id="regexBuilderPaste" type="button" disabled>Paste into speech-pattern</button>
                    <button id="regexBuilderLive" type="button" aria-pressed="false" disabled>Live</button>
                </div>
                <p id="regexBuilderMessage" class="regex-builder-message" role="status" aria-live="polite"></p>
            </section>

            <section id="macroPanel" class="macro-builder-pane workspace-pane" data-pane-id="macro" aria-label="Macro builder">
                <div class="pane-heading workspace-pane-heading macro-builder-heading">
                    <div>
                        <h2>Macro Builder</h2>
                        <p class="subtle">Record action functions, then bind each argument to a fixed value, parameter, or &lt;context&gt;.</p>
                    </div>
                </div>

                <div class="macro-toolbar">
                    <label>
                        <span>Macro</span>
                        <select id="macroSelect">
                            <option value="">New macro…</option>
                        </select>
                    </label>
                    <label class="macro-name-field">
                        <span>Function name</span>
                        <span class="macro-function-prefix">WMOFActions.</span>
                        <input id="macroName" type="text" autocomplete="off" spellcheck="false" placeholder="startProductionTrip">
                    </label>
                </div>

                <p id="macroNameMessage" class="macro-message" role="status"></p>

                <div class="macro-actions">
                    <button id="macroRecord" class="primary" type="button" aria-pressed="false">● Record</button>
                    <button id="macroNew" type="button">New</button>
                    <button id="macroTest" type="button" disabled>▶ Test</button>
                    <button id="macroStage" type="button" disabled>Save Macro</button>
                    <button id="macroDelete" class="remove" type="button" disabled>Delete</button>
                </div>

                <div class="macro-section-heading">
                    <h3>Actions</h3>
                    <span id="macroRecordingState">Not recording</span>
                </div>
                <div id="macroSteps" class="macro-steps"></div>

                <div class="macro-section-heading">
                    <h3>Parameters</h3>
                    <button id="macroAddParameter" type="button">+ Parameter</button>
                </div>
                <div id="macroParameters" class="macro-parameters"></div>

                <datalist id="macroContextOptions">
                    <option value="currentTrip">
                    <option value="currentTrip.id">
                    <option value="currentTrip.status">
                    <option value="currentTrip.summary">
                    <option value="activeInterval">
                    <option value="activeInterval.intervalType">
                    <option value="activeInterval.type">
                    <option value="activeInterval.key">
                    <option value="renderedTime.mode">
                    <option value="sync.enabled">
                    <option value="sync.connection">
                    <option value="goal.mode">
                </datalist>

                <p id="macroMessage" class="macro-message" role="status" aria-live="polite"></p>
            </section>
        </aside>
    </main>
    <dialog id="jsonActionsDialog" class="json-actions-dialog">
        <form method="dialog" class="json-actions-shell">
            <header class="json-actions-header">
                <div>
                    <h2>Speech Editor JSON</h2>
                    <p>Execute semantic editor actions without using the GUI. Commands can be single actions or atomic batches.</p>
                </div>
                <button id="jsonActionsClose" class="dialog-close" type="button" aria-label="Close">×</button>
            </header>

            <div class="json-actions-toolbar">
                <button id="jsonActionsExample" type="button">Example</button>
                <button id="jsonActionsManifest" type="button">Manifest</button>
                <button id="jsonActionsState" type="button">State</button>
                <button id="jsonActionsExecute" class="primary" type="button">Execute JSON</button>
            </div>

            <label class="json-actions-field">
                <span>Command JSON</span>
                <textarea id="jsonActionsInput" rows="16" spellcheck="false" autocomplete="off" placeholder='{"action":"addSpeechCommand","input":{"parentId":"edit:menu:example","attrs":{"speech-pattern":"^example$","speech-function":"WMOFActions.openTripLog"}}}'></textarea>
            </label>

            <label class="json-actions-field">
                <span>Result</span>
                <textarea id="jsonActionsOutput" rows="12" spellcheck="false" readonly></textarea>
            </label>
        </form>
    </dialog>

    <script src="EditorActionFunctions.js?v=<?=htmlspecialchars((string) @filemtime(__DIR__ . '/EditorActionFunctions.js'), ENT_QUOTES)?>"></script>
    <script src="RegexBuilder.js?v=<?=htmlspecialchars((string) @filemtime(__DIR__ . '/RegexBuilder.js'), ENT_QUOTES)?>"></script>
    <script src="editor.js?v=<?=htmlspecialchars((string) @filemtime(__DIR__ . '/editor.js'), ENT_QUOTES)?>"></script>
</body>
</html>
