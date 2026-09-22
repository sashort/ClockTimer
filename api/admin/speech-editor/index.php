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
    <link rel="stylesheet" href="editor.css">
</head>
<body data-csrf="<?=htmlspecialchars(csrf_token(), ENT_QUOTES)?>">
    <header class="toolbar">
        <h1>Speech Command Editor</h1>
        <button id="overlayToggle" type="button" aria-pressed="true">Overlay: On</button>
        <button id="discardButton" type="button" disabled>Discard</button>
        <button id="saveButton" class="primary" type="button" disabled>Save changes</button>
    </header>
    <main class="layout">
        <section class="preview" aria-label="WMOF preview">
            <iframe id="appFrame" title="WMOF application" src="../../../index.html"></iframe>
            <div id="previewHint">Click a control to inspect its speech elements. Turn off the overlay to use the page.</div>
        </section>
        <aside class="inspector" aria-label="Speech element editor">
            <h2 id="selectedTitle">Select a control</h2>
            <p id="selectedPath" class="subtle">Click a control in the preview.</p>
            <label class="field">Element type
                <select id="elementType"><option value="attribute">Selected control</option><option value="command" selected>&lt;speech-command&gt;</option><option value="modal">&lt;speech-modal&gt;</option></select>
            </label>
            <div class="section-title"><strong>SpeechMenu elements</strong><button id="addButton" class="small primary" type="button" disabled>+ Add</button></div>
            <div id="elementList" class="element-list" role="list"></div>
            <form id="attributeForm" autocomplete="off" hidden>
                <label class="field" data-for="command attribute">speech-pattern<input name="speech-pattern" spellcheck="false"></label>
                <label class="field" data-for="command attribute">speech-function<input name="speech-function" spellcheck="false"></label>
                <label class="field" data-for="command attribute">speech-preproc<input name="speech-preproc" spellcheck="false"></label>
                <details id="moreAttributes"><summary>More attributes</summary>
                    <label class="field" data-for="command attribute">speech-preproc-context<input name="speech-preproc-context" spellcheck="false"></label>
                    <label class="field" data-for="command attribute">speech-preproc-field<input name="speech-preproc-field" spellcheck="false"></label>
                </details>
                <label class="field">speech-modal<select id="modalValue"><option value="__absent__">Absent</option><option value="__empty__">Present, empty</option><option value="top-level">top-level</option><option value="__custom__">Other…</option></select><input id="modalCustom" spellcheck="false" placeholder="Custom value" hidden></label>
                <label class="field" id="parentField" hidden>Parent &lt;speech-modal&gt;
                    <select id="parentSelect"><option value="">None</option></select>
                </label>
                <button id="removeButton" class="remove" type="button">Remove selected element</button>
            </form>
            <p id="status" role="status" aria-live="polite"></p>
        </aside>
    </main>
    <script src="editor.js"></script>
</body>
</html>
