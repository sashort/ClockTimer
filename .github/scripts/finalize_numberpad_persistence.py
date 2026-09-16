from pathlib import Path

api_path = Path('api/trips/index.php')
api = api_path.read_text()
old = "            . 'AND start_time <= :production_max_date_time '\n            . 'AND non_production = 0';"
new = "            . 'AND start_time <= :production_max_date_time '\n            . 'AND pending = 0 '\n            . 'AND non_production = 0';"
if old not in api:
    raise RuntimeError('production aggregate anchor not found')
api = api.replace(old, new, 1)
api_path.write_text(api)

clock_path = Path('ClockTimer.js')
clock = clock_path.read_text()
old = '''            const clientToken =\n                globalThis.crypto?.randomUUID?.() ??\n                `${Date.now()}-${Math.random().toString(16).slice(2)}`;'''
new = '''            const clientToken =\n                globalThis.crypto?.randomUUID?.() ??\n                "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(\n                    /[xy]/g,\n                    character => {\n                        const random =\n                            Math.floor(Math.random() * 16);\n                        const value =\n                            character === "x"\n                                ? random\n                                : (random & 0x3) | 0x8;\n                        return value.toString(16);\n                    }\n                );'''
if old not in clock:
    raise RuntimeError('client token fallback anchor not found')
clock = clock.replace(old, new, 1)
clock_path.write_text(clock)

assert "AND pending = 0" in api
assert 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' in clock
print('persistence finalization patch applied')
