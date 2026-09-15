from pathlib import Path

path = Path("app.css")
text = path.read_text()

main_menu_anchor = '''.main-menu {\n    width: min(430px, 74vw);\n'''
if main_menu_anchor not in text:
    raise SystemExit("main menu block not found")
text = text.replace(
    main_menu_anchor,
    '''[popover] {\n    opacity: 0;\n    transition-property: opacity, display, overlay;\n    transition-duration: 750ms;\n    transition-timing-function: linear;\n    transition-behavior: normal, allow-discrete, allow-discrete;\n}\n\n[popover]:popover-open {\n    opacity: 1;\n}\n\n@starting-style {\n    [popover]:popover-open {\n        opacity: 0;\n    }\n}\n\n.main-menu {\n    width: min(430px, 74vw);\n''',
    1
)

old_dialog = '''.app-dialog {\n    color: var(--wm-white);\n    background: linear-gradient(135deg, rgb(0 83 160 / 98%), rgb(4 30 66 / 98%));\n    border: 2px solid var(--wm-white);\n    border-radius: 16px;\n    box-shadow: 0 18px 50px rgb(0 0 0 / 42%);\n}\n\n.app-dialog::backdrop { background: rgb(0 0 0 / 48%); }\n'''
new_dialog = '''.app-dialog {\n    color: var(--wm-white);\n    background: linear-gradient(135deg, rgb(0 83 160 / 98%), rgb(4 30 66 / 98%));\n    border: 2px solid var(--wm-white);\n    border-radius: 16px;\n    box-shadow: 0 18px 50px rgb(0 0 0 / 42%);\n    opacity: 0;\n    transition-property: opacity, display, overlay;\n    transition-duration: 750ms;\n    transition-timing-function: linear;\n    transition-behavior: normal, allow-discrete, allow-discrete;\n}\n\n.app-dialog[open] {\n    opacity: 1;\n}\n\n.app-dialog::backdrop {\n    background: rgb(0 0 0 / 48%);\n    opacity: 0;\n    transition: opacity 750ms linear;\n}\n\n.app-dialog[open]::backdrop {\n    opacity: 1;\n}\n\n@starting-style {\n    .app-dialog[open],\n    .app-dialog[open]::backdrop {\n        opacity: 0;\n    }\n}\n'''
if old_dialog not in text:
    raise SystemExit("app dialog block not found")
text = text.replace(old_dialog, new_dialog, 1)

path.write_text(text)
