from pathlib import Path

path = Path('api/trips/index.php')
text = path.read_text()
old = '''        $tripActualMilliseconds =
            $trip['actualTimeMilliseconds'];

        $addAggregate(
            $allNonProductionAggregate,
            $standardMilliseconds,
            $tripActualMilliseconds,
            $tripCountedMilliseconds
        );'''
new = '''        $tripActualMilliseconds =
            $trip['actualTimeMilliseconds'];
        $tripCountedMilliseconds =
            $trip['countedTimeMilliseconds'];

        $addAggregate(
            $allNonProductionAggregate,
            $standardMilliseconds,
            $tripActualMilliseconds,
            $tripCountedMilliseconds
        );'''
count = text.count(old)
if count != 1:
    raise RuntimeError(f'expected one non-production aggregate loop anchor, found {count}')
path.write_text(text.replace(old, new, 1))
print('fixed non-production counted aggregate value')
