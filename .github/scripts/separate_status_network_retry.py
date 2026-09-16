from pathlib import Path

source_path = Path('.github/scripts/separate_status_network.py')
source = source_path.read_text(encoding='utf-8')
needle = '''if "clockTimer.connected" in app:\n    raise AssertionError("app still uses connected for network state")\n\napp_path.write_text(app, encoding="utf-8")\n'''
replacement = '''app = app.replace(\n    "clockTimer.connected",\n    '(clockTimer.networkStatus === "online")'\n)\nif "clockTimer.connected" in app:\n    raise AssertionError("app still uses connected for network state")\n\napp_path.write_text(app, encoding="utf-8")\n'''
if needle not in source:
    raise AssertionError('retry patch anchor missing')
source = source.replace(needle, replacement, 1)
exec(compile(source, str(source_path), 'exec'))
