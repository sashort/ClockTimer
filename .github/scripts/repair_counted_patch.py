from pathlib import Path

# Repair duplicate API anchors in the aggregate patch helper.
path = Path('.github/scripts/patch_counted_aggregates.py')
text = path.read_text()

replacements = [
    (
        '''s = one(s, ". 'standard_time_ms = :standard_time_ms, non_production = :non_production, pending = 0 '", ". 'standard_time_ms = :standard_time_ms, counted_time_ms = :counted_time_ms, non_production = :non_production, pending = 0 '", "post update")''',
        '''post_update_old = ". 'standard_time_ms = :standard_time_ms, non_production = :non_production, pending = 0 '"
post_update_new = ". 'standard_time_ms = :standard_time_ms, counted_time_ms = :counted_time_ms, non_production = :non_production, pending = 0 '"
if s.count(post_update_old) != 2:
    raise RuntimeError(f"post update: expected 2 initial matches, found {s.count(post_update_old)}")
s = s.replace(post_update_old, post_update_new, 1)'''
    ),
    (
        '''s = one(s, "                ':standard_time_ms' => $standardTimeMilliseconds,\\n                ':non_production' => $nonProductionValue,", "                ':standard_time_ms' => $standardTimeMilliseconds,\\n                ':counted_time_ms' => $countedTimeMilliseconds,\\n                ':non_production' => $nonProductionValue,", "post insert args")''',
        '''post_insert_args_old = "                ':standard_time_ms' => $standardTimeMilliseconds,\\n                ':non_production' => $nonProductionValue,"
post_insert_args_new = "                ':standard_time_ms' => $standardTimeMilliseconds,\\n                ':counted_time_ms' => $countedTimeMilliseconds,\\n                ':non_production' => $nonProductionValue,"
if s.count(post_insert_args_old) != 2:
    raise RuntimeError(f"post insert args: expected 2 initial matches, found {s.count(post_insert_args_old)}")
s = s.replace(post_insert_args_old, post_insert_args_new, 1)'''
    ),
]

for old, new in replacements:
    if text.count(old) != 1:
        raise RuntimeError('expected one aggregate patch helper statement')
    text = text.replace(old, new, 1)

path.write_text(text)

# Repair the generic !#started anchor in the cadence helper so it targets #tick only.
path = Path('.github/scripts/patch_cadence_clock.py')
text = path.read_text()
old = "s = one(s,\n'''            if (\n                !this.#started\n            ) {\n                return;\n            }''',\n'''            if (\n                !this.#started\n            ) {\n                this.#emitCadenceTick(\n                    nowDate\n                );\n                return;\n            }''', \"nonstarted cadence\")"
new = "s = one(s,\n'''            this.#updateOpenOverwriteRange(\n                nowDate\n            );\n\n            if (\n                !this.#started\n            ) {\n                return;\n            }''',\n'''            this.#updateOpenOverwriteRange(\n                nowDate\n            );\n\n            if (\n                !this.#started\n            ) {\n                this.#emitCadenceTick(\n                    nowDate\n                );\n                return;\n            }''', \"nonstarted cadence\")"
if text.count(old) != 1:
    raise RuntimeError('expected one generic nonstarted cadence helper statement')
path.write_text(text.replace(old, new, 1))

print('repaired aggregate and cadence patch helpers')
