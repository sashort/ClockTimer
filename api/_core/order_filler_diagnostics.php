<?php
declare(strict_types=1);

/** One bounded, private JSON-lines report per suite and BCP-47 locale. */
final class OrderFillerDiagnostics
{
    public function __construct(private string $directory) {}

    public static function basename(string $suite, string $locale): string
    {
        if (strlen($locale) > 63 || !in_array($suite, ['summary', 'order-filler', 'press', 'fast', 'medium', 'slow', 'duration', 'time'], true) ||
            !preg_match('/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/D', strtolower($locale))) {
            throw new InvalidArgumentException('Invalid suite or language/region.');
        }
        return $suite === 'summary' ? 'summary.log' : $suite . '-' . strtolower($locale) . '.log';
    }

    private function path(string $suite, string $locale): string
    {
        $name = self::basename($suite, $locale);
        return $suite === 'summary' ? $this->directory.'/'.$name : $this->directory.'/language-tests/'.strtolower($locale).'/'.$name;
    }

    /** Counts for old reports are reconstructed once, rather than inferred from a lane's status. */
    public function statistics(string $suite, string $locale): ?array
    {
        $path = $this->path($suite, $locale);
        if (!is_file($path.'.state')) return null;
        $lock = fopen($path.'.lock', 'c');
        if (!$lock || !flock($lock, LOCK_SH)) throw new RuntimeException('Diagnostics lock unavailable.');
        try {
            $state = json_decode((string)file_get_contents($path.'.state'), true, 32, JSON_THROW_ON_ERROR);
            if (isset($state['deliveryTotals']) && !isset($state['deliveryStats'])) {
                $cachePath = $path.'.counts';
                $cache = is_file($cachePath) ? json_decode((string)file_get_contents($cachePath), true) : null;
                if (($cache['runId'] ?? '') !== $state['runId'] || ($cache['tests'] ?? -1) !== $state['tests']) {
                    $stats = array_fill_keys(array_keys($state['deliveryTotals']), ['passed'=>0,'failed'=>0,'skipped'=>0]);
                    $file = fopen($path, 'rb');
                    try { while (($line = fgets($file)) !== false) {
                        $record = json_decode($line, true, 32, JSON_THROW_ON_ERROR);
                        if (($record['type'] ?? '') === 'test' && isset($stats[$record['delivery'] ?? ''][$record['status'] ?? ''])) $stats[$record['delivery']][$record['status']]++;
                    }} finally { fclose($file); }
                    $cache = ['runId'=>$state['runId'],'tests'=>$state['tests'],'deliveryStats'=>$stats];
                    $temporary = $cachePath.'.'.bin2hex(random_bytes(4));
                    file_put_contents($temporary, json_encode($cache, JSON_THROW_ON_ERROR));chmod($temporary,0600);rename($temporary,$cachePath);
                }
                $state['deliveryStats'] = $cache['deliveryStats'];
            }
            unset($state['principal']);
            return $state;
        } finally { flock($lock, LOCK_UN);fclose($lock); }
    }

    /** Byte cursors bound both response size and work per poll, even for large numeric corpora. */
    public function results(string $suite, string $locale, int $cursor = 0, string $runId = '', string $delivery = '', bool $failuresOnly = false): array
    {
        if ($cursor < 0 || !in_array($delivery,['','press','fast','medium','slow'],true)) throw new InvalidArgumentException('Invalid results cursor or delivery.');
        $path = $this->path($suite,$locale);
        if (!is_file($path)) return ['rows'=>[],'cursor'=>0,'nextCursor'=>0,'hasMore'=>false,'runId'=>null];
        $lock=fopen($path.'.lock','c');
        if (!$lock || !flock($lock,LOCK_SH)) throw new RuntimeException('Diagnostics lock unavailable.');
        try {
            $state=json_decode((string)file_get_contents($path.'.state'),true,32,JSON_THROW_ON_ERROR);
            $reset=$runId!=='' && $runId!==$state['runId'];
            if ($reset) $cursor=0;
            clearstatcache(true,$path);
            if ($cursor>filesize($path)) throw new InvalidArgumentException('Results cursor exceeds the report.');
            $file=fopen($path,'rb');$rows=[];
            try {
                if ($cursor>0) { fseek($file,$cursor-1);if(fread($file,1)!=="\n")throw new InvalidArgumentException('Results cursor must follow a complete record.'); }
                fseek($file,$cursor);$scanned=0;
                while(count($rows)<50 && $scanned<1048576 && ($line=fgets($file))!==false) {
                    $scanned+=strlen($line);$record=json_decode($line,true,32,JSON_THROW_ON_ERROR);
                    if (($record['type']??'')!=='test' || ($delivery!=='' && ($record['delivery']??'')!==$delivery) || ($failuresOnly && ($record['status']??'')!=='failed')) continue;
                    $rows[]=$record;
                }
                $next=ftell($file);$more=$next<filesize($path);
            } finally { fclose($file); }
            return ['rows'=>$rows,'cursor'=>$cursor,'nextCursor'=>$next,'hasMore'=>$more,'runId'=>$state['runId'],'reset'=>$reset,'completed'=>$state['tests'],'total'=>$state['totalTests']];
        } finally { flock($lock,LOCK_UN);fclose($lock); }
    }

    /** Read at most 16 KiB from EOF; status never scans a whole report. */
    public function last(string $suite, string $locale): ?array
    {
        $path = $this->path($suite, $locale);
        if (!is_file($path)) return null;
        $lock = fopen($path . '.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_SH)) throw new RuntimeException('Diagnostics lock unavailable.');
        try {
            $file = fopen($path, 'rb');
            if ($file === false) throw new RuntimeException('Diagnostics log unavailable.');
            try {
                clearstatcache(true, $path);$size=(int)filesize($path);$limit=min(16384,$size);
                do {
                    fseek($file,-$limit,SEEK_END);$tail=rtrim((string)stream_get_contents($file),"\r\n");
                    if(str_contains($tail,"\n") || $limit >= $size)break;
                    $limit=min($size,$limit*2);
                    if($limit > 1048576)throw new RuntimeException('Diagnostics status record exceeds its limit.');
                }while(true);
            }
            finally {fclose($file);}
            $lines = explode("\n", $tail);
            return $tail === '' ? null : json_decode(end($lines), true, 32, JSON_THROW_ON_ERROR);
        } finally {flock($lock, LOCK_UN);fclose($lock);}
    }

    public function apply(array $input, string $principal, array $build): array
    {
        $name = self::basename((string)($input['suite'] ?? ''), (string)($input['locale'] ?? ''));
        $action = $input['action'] ?? '';
        if (!in_array($action, ['start', 'append', 'end', 'abort', 'read', 'progress'], true)) throw new InvalidArgumentException('Invalid diagnostics action.');
        $path = $this->path($input['suite'], $input['locale']);
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Diagnostics directory unavailable.');
        $lock = fopen($path . '.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) throw new RuntimeException('Diagnostics lock unavailable.');
        try {
            $statePath = $path . '.state';
            $state = is_file($statePath) ? json_decode((string)file_get_contents($statePath), true, 32, JSON_THROW_ON_ERROR) : null;
            if ($action === 'read') return ['file'=>$name, 'state'=>$state, 'log'=>is_file($path) ? file_get_contents($path) : ''];
            $now = gmdate('c');
            if ($action === 'start') {
                if (!is_int($input['totalTests'] ?? null) || $input['totalTests'] < 1 || $input['totalTests'] > 200000) throw new InvalidArgumentException('Supply a totalTests count from 1 to 200000.');
                $state = ['runId'=>bin2hex(random_bytes(16)), 'principal'=>$principal, 'suite'=>$input['suite'],
                    'locale'=>strtolower($input['locale']), 'build'=>$build, 'startedAt'=>$now, 'endedAt'=>null,
                    'tests'=>0, 'totalTests'=>$input['totalTests'], 'passed'=>0, 'failed'=>0, 'skipped'=>0];
                if (isset($input['deliveryTotals'])) {
                    $totals = $input['deliveryTotals'];
                    if (!is_array($totals) || array_sum($totals) !== $state['totalTests']) throw new InvalidArgumentException('Delivery totals must match totalTests.');
                    foreach ($totals as $delivery=>$total) if (!in_array($delivery,['press','fast','medium','slow'],true) || !is_int($total) || $total < 1) throw new InvalidArgumentException('Invalid delivery total.');
                    $state['deliveryTotals'] = $totals;
                    $state['deliveryCounts'] = array_fill_keys(array_keys($totals),0);
                    $state['deliveryStats'] = array_fill_keys(array_keys($totals), ['passed'=>0,'failed'=>0,'skipped'=>0]);
                }
                if ($input['suite'] === 'summary') {
                    $languages = $input['languages'] ?? null;
                    if (!is_array($languages) || !array_is_list($languages) || count($languages) < 1 || count($languages) > 100) throw new InvalidArgumentException('Supply the tested languages.');
                    $state['languages'] = [];
                    foreach ($languages as $language) {
                        if (!is_string($language)) throw new InvalidArgumentException('Invalid tested language.');
                        self::basename('time',$language);
                        if (in_array(strtolower($language),$state['languages'],true)) throw new InvalidArgumentException('Duplicate tested language.');
                        $state['languages'][] = strtolower($language);
                    }
                    $state['results'] = [];
                    foreach ($state['languages'] as $language) $state['results'][$language] = ['press'=>'queued','fast'=>'queued','medium'=>'queued','slow'=>'queued'];
                }
                $records = [['type'=>'test-start', 'runId'=>$state['runId'], 'suite'=>$state['suite'],
                    'locale'=>$state['locale'], 'at'=>$now, 'build'=>$build]];
            } else {
                if (!$state || !is_string($input['runId'] ?? null) || !hash_equals($state['runId'], $input['runId']) ||
                    !hash_equals($state['principal'], $principal) || $state['endedAt'] !== null) {
                    throw new DomainException('The test run was replaced, belongs to another principal, or has ended.');
                }
                $records = [];
                if ($action === 'progress') {
                    $language = strtolower((string)($input['language'] ?? ''));
                    $delivery = $input['delivery'] ?? '';
                    if ($state['suite'] !== 'summary' || !isset($state['results'][$language][$delivery])) throw new InvalidArgumentException('Unknown language/delivery.');
                    $state['results'][$language][$delivery] = 'running';
                    $records[] = ['type'=>'progress','at'=>$now,'language'=>$language,'delivery'=>$delivery];
                } elseif ($action === 'append') {
                    $tests = $input['tests'] ?? null;
                    if (!is_array($tests) || !array_is_list($tests) || count($tests) < 1 || count($tests) > 500) throw new InvalidArgumentException('Supply 1–500 numbered test results per request.');
                    foreach ($tests as $test) {
                        if (!is_array($test) || !is_string($test['label'] ?? null) || strlen($test['label']) > 512 ||
                            !in_array($test['status'] ?? '', ['passed','failed','skipped'], true)) throw new InvalidArgumentException('Invalid test result.');
                        $elapsed = $test['elapsedMs'] ?? 0;
                        if (!is_numeric($elapsed) || !is_finite((float)$elapsed) || $elapsed < 0 || $elapsed > 86400000) throw new InvalidArgumentException('Invalid test elapsed time.');
                        $records[] = ['type'=>'test', 'number'=>++$state['tests'], 'label'=>$test['label'],
                            'status'=>$test['status'], 'elapsedMs'=>$elapsed, 'at'=>$now];
                        if (isset($test['message'])) {
                            if (!is_string($test['message']) || strlen($test['message']) > 2048) throw new InvalidArgumentException('Invalid failure detail.');
                            $records[array_key_last($records)]['message'] = $test['message'];
                        }
                        if (isset($test['delivery'])) {
                            if (!in_array($test['delivery'],['press','slow','medium','fast'],true)) throw new InvalidArgumentException('Unknown delivery rate.');
                            $records[array_key_last($records)]['delivery'] = $test['delivery'];
                            if (isset($state['deliveryTotals'][$test['delivery']])) {
                                $count = ++$state['deliveryCounts'][$test['delivery']];
                                $state['deliveryStats'][$test['delivery']][$test['status']] = ($state['deliveryStats'][$test['delivery']][$test['status']] ?? 0) + 1;
                                $total = $state['deliveryTotals'][$test['delivery']];
                                if ($count > $total) throw new InvalidArgumentException('Delivery results exceed the planned count.');
                                $records[array_key_last($records)] += ['deliveryNumber'=>$count,'deliveryTotal'=>$total];
                            }
                        }
                        if ($state['suite'] === 'summary') {
                            $language = strtolower((string)($test['language'] ?? ''));
                            $delivery = $test['delivery'] ?? '';
                            if (!isset($state['results'][$language][$delivery])) throw new InvalidArgumentException('Unknown language/delivery.');
                            $state['results'][$language][$delivery] = $test['status'];
                            $records[array_key_last($records)]['language'] = $language;
                        }
                        $state[$test['status']]++;
                    }
                    if ($state['tests'] > $state['totalTests']) throw new InvalidArgumentException('Results exceed the planned test count.');
                } else {
                    $summary = $input['tripSummary'] ?? [];
                    if (!is_array($summary)) throw new InvalidArgumentException('Invalid trip-run summary.');
                    $clean = [];
                    foreach (['trips','standaloneBreaks','hourRingSwitches','failures','wallMilliseconds'] as $key) {
                        if (!array_key_exists($key, $summary)) continue;
                        if (!is_numeric($summary[$key]) || !is_finite((float)$summary[$key]) || $summary[$key] < 0) throw new InvalidArgumentException('Invalid summary value.');
                        $clean[$key] = $summary[$key];
                    }
                    $state['endedAt'] = $now;
                    $state['status'] = $action === 'abort' ? 'aborted' : ($state['tests'] < $state['totalTests'] ? 'incomplete' : (($state['failed'] > 0 || ($clean['failures'] ?? 0) > 0) ? 'failed' : 'passed'));
                    $records[] = ['type'=>'summary', 'tests'=>$state['tests'], 'passed'=>$state['passed'],
                        'failed'=>$state['failed'], 'skipped'=>$state['skipped'], 'tripRun'=>$clean, 'at'=>$now];
                    $records[] = ['type'=>'test-end', 'runId'=>$state['runId'], 'status'=>$state['status'], 'at'=>$now];
                }
            }
            foreach ($records as &$record) {
                $completed = $record['number'] ?? $state['tests'];
                $record += ['runId'=>$state['runId'], 'suite'=>$state['suite'], 'locale'=>$state['locale'],
                    'completed'=>$completed, 'total'=>$state['totalTests'], 'progress'=>'test '.$completed.'/'.$state['totalTests'],
                    'runStatus'=>$state['status'] ?? 'running', 'build'=>$state['build']];
                $record += ['passed'=>$state['passed'],'failed'=>$state['failed'],'skipped'=>$state['skipped']];
                if (isset($state['deliveryTotals'])) $record += ['deliveryCounts'=>$state['deliveryCounts'],'deliveryTotals'=>$state['deliveryTotals'],'deliveryStats'=>$state['deliveryStats'] ?? []];
                if (isset($state['languages'])) $record += ['languages'=>$state['languages'],'results'=>$state['results']];
            }
            unset($record);
            $lines = implode('', array_map(static fn(array $record): string => json_encode($record, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n", $records));
            if ($action !== 'start' && (filesize($path) ?: 0) + strlen($lines) > 268435456) throw new InvalidArgumentException('Diagnostics report exceeds 256 MiB.');
            if (file_put_contents($path, $lines, $action === 'start' ? 0 : FILE_APPEND) === false ||
                file_put_contents($statePath, json_encode($state, JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('Diagnostics write failed.');
            chmod($path, 0600); chmod($statePath, 0600);
            return ['file'=>$name, 'state'=>$state];
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }
}
