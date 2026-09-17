from pathlib import Path

path = Path("index.html")
text = path.read_text()

old = '''        </form>
    </dialog>

    <div id="graphicalHelpPopover" class="settings-help-popover" popover="manual" role="dialog" aria-labelledby="graphicalHelpTitle">
        <header class="settings-help-header">
            <h3 id="graphicalHelpTitle"></h3>
            <button id="graphicalHelpClose" class="settings-help-close" type="button" aria-label="Close help">×</button>
        </header>
        <div id="graphicalHelpBody" class="settings-help-body"></div>
    </div>

    <template id="settingsHelpTolerance" data-help-title="Tolerance">'''

new = '''        </form>

        <div id="graphicalHelpPopover" class="settings-help-popover" popover="manual" role="dialog" aria-labelledby="graphicalHelpTitle">
            <header class="settings-help-header">
                <h3 id="graphicalHelpTitle"></h3>
                <button id="graphicalHelpClose" class="settings-help-close" type="button" aria-label="Close help">×</button>
            </header>
            <div id="graphicalHelpBody" class="settings-help-body"></div>
        </div>
    </dialog>

    <template id="settingsHelpTolerance" data-help-title="Tolerance">'''

count = text.count(old)
if count != 1:
    raise RuntimeError(f"expected one graphical help popover placement, found {count}")

text = text.replace(old, new, 1)
path.write_text(text.rstrip() + "\n")

print("Moved graphical help popover inside the modal dialog so it remains interactive while centered in the viewport.")
