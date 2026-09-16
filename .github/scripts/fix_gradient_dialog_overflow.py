from pathlib import Path

path = Path('app.css')
text = path.read_text(encoding='utf-8')
anchor = '''.trip-settings-dialog {
    width: min(760px, 94vw);
    max-height: 92dvh;
    overflow: auto;
}
'''
replacement = '''.settings-dialog,
.trip-settings-dialog {
    overflow: auto;
}

.trip-settings-dialog {
    width: min(760px, 94vw);
    max-height: 92dvh;
}
'''
if anchor not in text:
    raise SystemExit('trip settings overflow anchor missing')
text = text.replace(anchor, replacement, 1)
path.write_text(text, encoding='utf-8')
