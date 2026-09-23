<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';
authenticated_user_id();
require_permission(PERMISSION_SUPERUSER);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?><!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>WMOF Speech Command Editor</title>
    <link rel="stylesheet" href="editor.css?v=<?=htmlspecialchars((string) @filemtime(__DIR__ . '/editor.css'), ENT_QUOTES)?>">
</head>
<body data-csrf="<?=htmlspecialchars(csrf_token(), ENT_QUOTES)?>">
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
        <button id="overlayToggle" type="button" aria-pressed="true">Overlay: On</button>
        <button id="discardButton" type="button" disabled>Discard</button>
        <button id="saveButton" class="primary" type="button" disabled>Save changes</button>
    </header>
    <main class="layout">
        <aside class="dom-navigator" aria-label="DOM navigator">
            <header class="navigator-header">
                <h2>DOM Navigator</h2>
                <label class="navigator-search">
                    <span class="sr-only">Filter DOM elements</span>
                    <input id="domSearch" type="search" placeholder="Search elements…" autocomplete="off" spellcheck="false">
                </label>
            </header>
            <div id="domTree" class="dom-tree" role="tree" aria-label="Application DOM"></div>
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

        <aside class="inspector" aria-label="Speech command editor">
            <section class="phrase-pane" aria-label="Speech phrases">
                <div class="pane-heading">
                    <div>
                        <h2>Speech Phrases</h2>
                        <p class="subtle">Available phrases, grouped by candidate and SpeechMenu precedence.</p>
                    </div>
                </div>
                <div id="phraseList" class="phrase-list" role="tree" aria-label="Configured speech phrases"></div>
            </section>

            <div id="inspectorSplitter" class="inspector-splitter" role="separator" aria-orientation="horizontal" aria-label="Resize phrase list and attribute editor" tabindex="0">
                <span aria-hidden="true"></span>
            </div>

            <section class="attribute-pane" aria-label="Speech attributes">
                <div class="selection-heading">
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

                <section id="regexBuilderPanel" class="regex-builder" aria-label="Speech pattern regex builder">
                    <div class="regex-builder-heading">
                        <div>
                            <h3>Regex Builder</h3>
                            <p>Write the phrase you want recognized; the builder handles regex syntax and recognizer-safe normalization.</p>
                        </div>
                        <button id="regexBuilderHelpButton" class="regex-help-button" type="button" aria-expanded="false" aria-controls="regexBuilderHelp" title="Regex Builder help">?</button>
                    </div>

                    <div id="regexBuilderHelp" class="regex-builder-help" hidden>
                        <p><strong>Templates:</strong> type <code>&lt;</code> to open the inline picker. You can also type wildcards directly; closing <code>&gt;</code> will infer the template.</p>
                        <p><code>&lt;AAA&gt;</code> → <code>&lt;letters:3&gt;</code>, <code>&lt;###&gt;</code> → <code>&lt;digits:3&gt;</code>, <code>&lt;##.##&gt;</code> → <code>&lt;decimal:2.2&gt;</code>, and <code>&lt;code:AAA&gt;</code> → a named <code>code</code> capture.</p>
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
            </section>
        </aside>
    </main>
    <script src="RegexBuilder.js?v=<?=htmlspecialchars((string) @filemtime(__DIR__ . '/RegexBuilder.js'), ENT_QUOTES)?>"></script>
    <script src="editor.js?v=<?=htmlspecialchars((string) @filemtime(__DIR__ . '/editor.js'), ENT_QUOTES)?>"></script>
</body>
</html>
