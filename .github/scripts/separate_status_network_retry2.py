from pathlib import Path

source_path = Path('.github/scripts/separate_status_network.py')
source = source_path.read_text(encoding='utf-8')

old_method_locator = '''    open_index = text.find("{", start)\n    if open_index < 0:\n        raise AssertionError(f"missing method brace: {marker}")\n    close_index = find_matching_brace(text, open_index)\n'''
new_method_locator = '''    signature_end = text.find(") {", start)\n    if signature_end < 0:\n        raise AssertionError(f"missing method signature end: {marker}")\n    open_index = signature_end + 2\n    close_index = find_matching_brace(text, open_index)\n'''
if old_method_locator not in source:
    raise AssertionError('method locator patch anchor missing')
source = source.replace(old_method_locator, new_method_locator, 1)

old_connected_check = '''if "clockTimer.connected" in app:\n    raise AssertionError("app still uses connected for network state")\n\napp_path.write_text(app, encoding="utf-8")\n'''
new_connected_check = '''app = app.replace(\n    "clockTimer.connected",\n    '(clockTimer.networkStatus === "online")'\n)\nif "clockTimer.connected" in app:\n    raise AssertionError("app still uses connected for network state")\n\napp_path.write_text(app, encoding="utf-8")\n'''
if old_connected_check not in source:
    raise AssertionError('connected fallback patch anchor missing')
source = source.replace(old_connected_check, new_connected_check, 1)

exec(compile(source, str(source_path), 'exec'))
