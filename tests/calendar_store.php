<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/_core/calendar.php';
require_once __DIR__ . '/../api/_core/calendar_store.php';
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
foreach (require __DIR__ . '/../migrations/003_calendar_rules.php' as $sql) $pdo->exec($sql);
$definition = calendar_profiles([])['walmart-us'];
$rules = ['payPeriodAnchorBasis' => 'period-start', 'weekStartDay' => 6, 'cutoffTime' => '00:00:00', 'payPeriodDays' => 14, 'payPeriodAnchorDate' => '2026-01-03',
    'recurring' => true, 'effectiveFrom' => '1970-01-01', 'effectiveThrough' => null];
$calls = 0;
$discover = function () use (&$calls, $rules): array { $calls++; return ['rules' => $rules, 'sources' => [], 'provenance' => 'web-search']; };
function check(string $name, bool $condition): void { if (!$condition) throw new RuntimeException($name); echo "PASS $name\n"; }
$r = calendar_refresh_stored($pdo, 'test', $definition, 2026, $discover);
check('successful discovery persists the annual rules', calendar_stored_record($pdo, 'test', $definition, 2026)['rules'] === $rules);
$r['verifiedAt'] = time() - 300 * 86400;
calendar_save_record($pdo, 'test', $definition, $r);
calendar_refresh_stored($pdo, 'test', $definition, 2026, $discover);
calendar_refresh_stored($pdo, 'test', $definition, 2026, $discover, true);
check('old and explicit same-year requests do not rediscover', $calls === 1);
$pdo->exec('UPDATE calendar_refresh_attempts SET attempted_at = 0');
calendar_refresh_stored($pdo, 'test', $definition, 2027, $discover);
check('new year discovers once and retains historical data', $calls === 2 && calendar_stored_record($pdo, 'test', $definition, 2026)['searchedYear'] === 2026);
check('returning to an earlier saved year needs no discovery', calendar_refresh_stored($pdo, 'test', $definition, 2026, $discover)['searchedYear'] === 2026 && $calls === 2);
$pdo->exec('UPDATE calendar_refresh_attempts SET attempted_at = 0');
try { calendar_refresh_stored($pdo, 'test', $definition, 2028, fn() => throw new RuntimeException('outage')); } catch (RuntimeException $e) { check('failed annual search preserves prior rules', calendar_stored_record($pdo, 'test', $definition, 2028)['searchedYear'] === 2027); }
try { calendar_refresh_stored($pdo, 'test', $definition, 2028, fn() => throw new LogicException('must not run')); throw new LogicException('limit missing'); } catch (RuntimeException $e) { check('failed attempts are rate limited in the database', str_contains($e->getMessage(), 'once per hour')); }
$manual = calendar_manual_save($pdo, 'test', $definition, 2028, [...$rules, 'cutoffTime' => '01:00:00'], 'Verified correction', 2);
check('manual edits persist actor and prior rules', $manual['provenance'] === 'manual' && $manual['manualHistory'][0]['userId'] === 2 && $manual['manualHistory'][0]['previousRules'] === $rules);
check('manual saved year avoids discovery', calendar_refresh_stored($pdo, 'test', $definition, 2028, $discover, true)['rules']['cutoffTime'] === '01:00:00' && $calls === 2);
calendar_manual_save($pdo, 'test', $definition, 2028, $rules, 'Second correction', 2);
check('manual history survives subsequent edits', count(calendar_stored_record($pdo, 'test', $definition, 2028)['manualHistory']) === 2);
check('changed profile cannot reuse unrelated rules', calendar_stored_record($pdo, 'test', [...$definition, 'locale' => 'Other region'], 2028) === null);
check('new profile can be entered manually without a provider', calendar_manual_save($pdo, 'other', $definition, 2026, $rules, 'Official source', 2)['rules'] === [...$rules, 'payPeriodAnchorBasis' => 'fiscal-year-start']);
foreach ([['weekStartDay' => 7], ['payPeriodAnchorDate' => null]] as $invalid) {
    try { calendar_manual_save($pdo, 'test', $definition, 2028, [...$rules, ...$invalid], 'Invalid', 2); throw new LogicException('invalid accepted'); }
    catch (InvalidArgumentException) { check('invalid rule rejected without overwriting stored values', calendar_stored_record($pdo, 'test', $definition, 2028)['rules'] === [...$rules, 'payPeriodAnchorBasis' => 'fiscal-year-start']); }
}
$login = calendar_login_records($pdo, ['calendar_profiles' => ['test' => $definition]]);
check('login includes database rules without internal edit history', count($login) === 3 && $login[0]['searchedYear'] === 2028 && !isset($login[0]['manualHistory']));
echo "14 calendar storage checks passed.\n";
