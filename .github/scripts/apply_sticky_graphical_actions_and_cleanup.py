from pathlib import Path
import re
import shutil

APP_JS = Path("app.js")
INDEX = Path("index.html")
APP_CSS = Path("app.css")

# Frontend settings are defined by the current defaults. There is no versioned upgrade path.
js = APP_JS.read_text()
js, count = re.subn(r'\n    const GRAPHICAL_SETTINGS_VERSION = \d+;\n', '\n', js, count=1)
if count != 1:
    raise SystemExit("GRAPHICAL_SETTINGS_VERSION anchor not found")

storage_line = '        graphicalSettingsVersion: "wmof.clock.graphicalSettingsVersion",\n'
if storage_line not in js:
    raise SystemExit("graphicalSettingsVersion storage anchor not found")
js = js.replace(storage_line, "", 1)

settings_block = re.compile(
    r'    function getGraphicalSettings\(\) \{.*?\n    function formatDuration\(milliseconds\) \{',
    re.S,
)
replacement = '''    function getGraphicalSettings() {
        return getStoredJSON(STORAGE.graphicalSettings, GRAPHICAL_DEFAULTS);
    }

    function saveGraphicalSettings(settings) {
        safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));
    }

    function formatDuration(milliseconds) {'''
js, count = settings_block.subn(replacement, js, count=1)
if count != 1:
    raise SystemExit("graphical settings load/save block not found")
APP_JS.write_text(js)

# Move the graphical settings action row immediately below the header.
html = INDEX.read_text()
old_actions = '''            <div class="dialog-actions three-actions">
                <button id="resetGraphicalSettings" type="button">Reset to Defaults</button>
                <button type="button" data-close-dialog>Cancel</button>
                <button class="primary-action" type="submit" value="save">Save</button>
            </div>
'''
if html.count(old_actions) != 1:
    raise SystemExit(f"expected one graphical settings action block, found {html.count(old_actions)}")
html = html.replace(old_actions, "", 1)

header = '''            <header class="dialog-header">
                <h2>Clock Graphical Settings</h2>
                <button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button>
            </header>
'''
if html.count(header) != 1:
    raise SystemExit(f"expected one graphical settings header, found {html.count(header)}")
new_actions = '''
            <div class="dialog-actions three-actions graphical-settings-actions">
                <button id="resetGraphicalSettings" type="button">Reset to Defaults</button>
                <button type="button" data-close-dialog>Cancel</button>
                <button class="primary-action" type="submit" value="save">Save</button>
            </div>
'''
html = html.replace(header, header + new_actions, 1)
INDEX.write_text(html)

# Make the header/action stack sticky so the fieldsets scroll underneath it.
css = APP_CSS.read_text().rstrip()
marker = "/* graphical-settings-sticky-actions-v1 */"
if marker in css:
    raise SystemExit("graphical settings sticky action CSS already present")
css += '''\n\n/* graphical-settings-sticky-actions-v1 */
#graphicalSettingsForm {
    gap: 0;
}

.graphical-dialog .dialog-header {
    position: sticky;
    top: 0;
    z-index: 5;
}

.graphical-dialog .graphical-settings-actions {
    position: sticky;
    top: 64px;
    z-index: 4;
    margin: 0 !important;
    padding: 12px 16px;
    background: var(--ui-navy-gradient);
    border-bottom: 1px solid rgb(172 220 255 / 42%);
    box-shadow: 0 7px 16px rgb(0 0 0 / 24%), inset 0 1px 0 rgb(255 255 255 / 8%);
}

.graphical-dialog .graphical-settings-grid {
    margin-top: 16px;
    margin-bottom: 16px;
}
'''
APP_CSS.write_text(css.rstrip() + "\n")

# The canonical create_database.sql already contains the cumulative current schema.
# Remove incremental schema scripts and the temporary settings cleanup helper.
shutil.rmtree("database/migrations", ignore_errors=False)
Path(".github/scripts/remove_down_migration.py").unlink(missing_ok=True)
