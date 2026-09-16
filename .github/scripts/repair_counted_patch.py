from pathlib import Path

path = Path('.github/scripts/patch_counted_aggregates.py')
text = path.read_text()
old = '''s = one(s, ". 'standard_time_ms = :standard_time_ms, non_production = :non_production, pending = 0 '", ". 'standard_time_ms = :standard_time_ms, counted_time_ms = :counted_time_ms, non_production = :non_production, pending = 0 '", "post update")'''
new = '''post_update_old = ". 'standard_time_ms = :standard_time_ms, non_production = :non_production, pending = 0 '"
post_update_new = ". 'standard_time_ms = :standard_time_ms, counted_time_ms = :counted_time_ms, non_production = :non_production, pending = 0 '"
if s.count(post_update_old) != 2:
    raise RuntimeError(f"post update: expected 2 initial matches, found {s.count(post_update_old)}")
s = s.replace(post_update_old, post_update_new, 1)'''
if text.count(old) != 1:
    raise RuntimeError('expected one post-update helper statement')
path.write_text(text.replace(old, new, 1))
print('repaired counted aggregate patch helper')
