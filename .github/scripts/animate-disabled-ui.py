from pathlib import Path

path = Path("app.css")
text = path.read_text()

marker = "/* reversible-disabled-ui-v1 */"
if marker in text:
    raise SystemExit("reversible disabled UI block already exists")

old_primary = '''.trip-settings-dialog #tripSettingsPrimary:disabled {
    color: rgb(255 255 255 / 68%);
    background: var(--ui-gray-gradient);
    border-color: rgb(255 255 255 / 32%);
'''
new_primary = '''.trip-settings-dialog #tripSettingsPrimary:disabled {
    color: rgb(255 255 255 / 68%);
    border-color: rgb(255 255 255 / 32%);
'''
if text.count(old_primary) != 1:
    raise SystemExit(f"expected one primary disabled block, found {text.count(old_primary)}")
text = text.replace(old_primary, new_primary, 1)

text += '''\n\n/* reversible-disabled-ui-v1 */
.number-pad-key,
.trip-time-edit,
.trip-settings-dialog #tripSettingsPrimary {
    transition:
        opacity 250ms ease-in-out,
        filter 250ms ease-in-out,
        color 250ms ease-in-out,
        border-color 250ms ease-in-out,
        box-shadow 250ms ease-in-out;
}

.trip-now-action {
    transition:
        flex-basis var(--trip-start-transition-duration) ease-in-out,
        padding-inline var(--trip-start-transition-duration) ease-in-out,
        font-size var(--trip-start-transition-duration) ease-in-out,
        opacity 250ms ease-in-out,
        filter 250ms ease-in-out,
        color 250ms ease-in-out,
        border-color 250ms ease-in-out,
        box-shadow 250ms ease-in-out;
}
'''

path.write_text(text)
