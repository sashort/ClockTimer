<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/order_filler_diagnostics.php';
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$directory = sys_get_temp_dir().'/clocktimer-diagnostics-'.bin2hex(random_bytes(6));
$store = new OrderFillerDiagnostics($directory);
$build = ['version'=>'TEST01', 'commit'=>'abc'];
$base = ['suite'=>'duration','locale'=>'en-US'];
try {
    foreach (['en-US'=>'duration-en-us.log','en-GB'=>'duration-en-gb.log','es-MX'=>'duration-es-mx.log','zh-Hant-TW'=>'duration-zh-hant-tw.log'] as $locale=>$name) check(OrderFillerDiagnostics::basename('duration',$locale)===$name,'Locale filename');
    foreach (['../en-us','en/us','en_US','en-us.php'] as $locale) {
        try { OrderFillerDiagnostics::basename('duration',$locale); throw new RuntimeException('Unsafe locale accepted'); }
        catch (InvalidArgumentException) {}
    }
    $start = $store->apply($base+['action'=>'start','totalTests'=>2],'developer-1',$build);
    $run = $start['state']['runId'];
    $store->apply($base+['action'=>'append','runId'=>$run,'tests'=>[['label'=>'voice: one second','status'=>'passed'],['label'=>'keypad: 15959','status'=>'failed']]],'developer-1',$build);
    $store->apply($base+['action'=>'end','runId'=>$run,'tripSummary'=>['trips'=>1]],'developer-1',$build);
    $read = $store->apply($base+['action'=>'read'],'developer-1',$build);
    $rows = array_map(static fn(string $line): array=>json_decode($line,true,32,JSON_THROW_ON_ERROR),explode("\n",trim($read['log'])));
    check(array_column($rows,'type')===['test-start','test','test','summary','test-end'],'Ordered start, numbered results, summary, end');
    check($rows[1]['number']===1 && $rows[2]['number']===2,'Sequential numbering');
    check($rows[3]['passed']===1 && $rows[3]['failed']===1 && $rows[4]['status']==='failed','Statistics come from actual results');
    $replacement=$store->apply($base+['action'=>'start','totalTests'=>2],'developer-1',$build);
    check(!str_contains($store->apply($base+['action'=>'read'],'developer-1',$build)['log'],'one second'),'New run overwrites the old log');
    foreach ([[$run,'developer-1'],[$replacement['state']['runId'],'developer-2']] as [$id,$principal]) {
        try {$store->apply($base+['action'=>'append','runId'=>$id,'tests'=>[['label'=>'late result','status'=>'passed']]],$principal,$build);throw new RuntimeException('Stale/cross-principal write accepted');}
        catch (DomainException) {}
    }
    $before=$store->apply($base+['action'=>'read'],'developer-1',$build)['log'];
    try {$store->apply($base+['action'=>'append','runId'=>$replacement['state']['runId'],'tests'=>[['label'=>'valid','status'=>'passed'],['label'=>'invalid','status'=>'unknown']]],'developer-1',$build);throw new RuntimeException('Malformed batch accepted');}
    catch (InvalidArgumentException) {}
    check($before===$store->apply($base+['action'=>'read'],'developer-1',$build)['log'],'Malformed batch writes nothing');
    $store->apply(['suite'=>'time','locale'=>'en-GB','action'=>'start','totalTests'=>2],'developer-1',$build);
    check($before===$store->apply($base+['action'=>'read'],'developer-1',$build)['log'],'Independent suites/locales do not overwrite each other');
    $last=$store->last('duration','en-US');
    check($last['progress']==='test 0/2' && $last['runStatus']==='running','Last-line-only in-flight status');
    $summary=['suite'=>'summary','locale'=>'en-US'];
    $startSummary=$store->apply($summary+['action'=>'start','totalTests'=>3,'languages'=>['en-US']],'developer-1',$build);
    $summaryRun=$startSummary['state']['runId'];
    $store->apply($summary+['action'=>'progress','runId'=>$summaryRun,'language'=>'en-US','delivery'=>'fast'],'developer-1',$build);
    check($store->last('summary','en-US')['results']['en-us']['fast']==='running','Summary tracks an active speech rate');
    foreach(['press','fast','medium'] as $delivery)$store->apply($summary+['action'=>'append','runId'=>$summaryRun,'tests'=>[['label'=>$delivery,'language'=>'en-US','delivery'=>$delivery,'status'=>'passed']]],'developer-1',$build);
    $store->apply($summary+['action'=>'end','runId'=>$summaryRun],'developer-1',$build);
    $summaryTail=$store->last('summary','en-US');
    check($summaryTail['runStatus']==='passed' && $summaryTail['progress']==='test 3/3','Final line carries complete status');
    check($summaryTail['languages']===['en-us'] && $summaryTail['results']['en-us']['medium']==='passed','Summary retains languages and delivery results');
    $store->apply(['suite'=>'order-filler','locale'=>'en-US','action'=>'start','totalTests'=>2],'developer-1',$build);
    $incomplete=$store->last('order-filler','en-US');
    $store->apply(['suite'=>'order-filler','locale'=>'en-US','action'=>'end','runId'=>$incomplete['runId']],'developer-1',$build);
    check($store->last('order-filler','en-US')['runStatus']==='incomplete','Missing planned tests cannot be reported passed');
    $many=[];for($i=0;$i<100;$i++)$many[]='aa-'.str_repeat('abcdefg-',6).sprintf('r%06d',$i);
    $store->apply(['suite'=>'summary','locale'=>'en-US','action'=>'start','totalTests'=>300,'languages'=>$many],'developer-1',$build);
    check(count($store->last('summary','en-US')['languages'])===100,'Tail reader handles a summary longer than the first read chunk');
    $category=['suite'=>'fast','locale'=>'en-US'];
    $first=$store->apply($category+['action'=>'start','totalTests'=>3,'deliveryTotals'=>['fast'=>3]],'developer-1',$build)['state']['runId'];
    $store->apply($category+['action'=>'append','runId'=>$first,'tests'=>[['label'=>'one','status'=>'passed','delivery'=>'fast'],['label'=>'bad','status'=>'failed','delivery'=>'fast','message'=>'Expected entry, received rejection']]],'developer-1',$build);
    $metrics=$store->statistics('fast','en-US');check($metrics['deliveryStats']['fast']===['passed'=>1,'failed'=>1,'skipped'=>0],'Per-category outcome counts');
    check(!isset($metrics['principal']),'Statistics do not expose principal');
    $page=$store->results('fast','en-US',0,$first,'fast',true);
    check(count($page['rows'])===1&&$page['rows'][0]['label']==='bad'&&$page['rows'][0]['message']==='Expected entry, received rejection','Failure filtering and detail');
    $store->apply($category+['action'=>'abort','runId'=>$first],'developer-1',$build);
    check($store->last('fast','en-US')['runStatus']==='aborted','Abort retains partial outcome and ends explicitly');
    try{$store->apply($category+['action'=>'append','runId'=>$first,'tests'=>[['label'=>'late','status'=>'passed']]],'developer-1',$build);throw new RuntimeException('Aborted run accepted a result');}catch(DomainException){}
    $store->apply($category+['action'=>'start','totalTests'=>1],'developer-1',$build);
    check($store->results('fast','en-US',$page['nextCursor'],$first)['reset'],'Replaced run resets old page cursor');
    check($store->statistics('duration','en-US')['runId']===$replacement['state']['runId'],'Category runs do not overwrite numeric reports');
    try{$store->results('duration','en-US',1);throw new RuntimeException('Partial line cursor accepted');}catch(InvalidArgumentException){}
    $large=['suite'=>'medium','locale'=>'en-US'];$largeRun=$store->apply($large+['action'=>'start','totalTests'=>75],'developer-1',$build)['state']['runId'];
    $batch=[];for($i=0;$i<75;$i++)$batch[]=['label'=>'row '.$i,'status'=>'passed'];
    $store->apply($large+['action'=>'append','runId'=>$largeRun,'tests'=>$batch],'developer-1',$build);
    $one=$store->results('medium','en-US');$two=$store->results('medium','en-US',$one['nextCursor'],$largeRun);
    check(count($one['rows'])===50&&$one['hasMore']&&count($two['rows'])===25,'Bounded pages cover all individual results without duplication');
    $audio=['suite'=>'medium','locale'=>'en-US'];$audioRun=$store->apply($audio+['action'=>'start','totalTests'=>2],'developer-1',$build)['state']['runId'];
    $clip=['key'=>str_repeat('a',64),'text'=>'ready','recognized'=>'ready','wpm'=>160,'source'=>'human'];
    $store->apply($audio+['action'=>'append','runId'=>$audioRun,'tests'=>[['label'=>'real recognition','status'=>'passed','inputLayer'=>'audio','recognizer'=>'vosk','audioClips'=>[$clip]]]],'developer-1',$build);
    $row=$store->results('medium','en-US')['rows'][0];check($row['audioClips']===[$clip]&&$row['inputLayer']==='audio'&&$row['recognizer']==='vosk','Replay evidence and test layer survive storage/pagination');
    try{$store->apply($audio+['action'=>'append','runId'=>$audioRun,'tests'=>[['label'=>'unsafe clip','status'=>'passed','audioClips'=>[array_replace($clip,['key'=>'../private'])]]]],'developer-1',$build);throw new RuntimeException('Unsafe clip key accepted');}catch(InvalidArgumentException){}
    check($store->statistics('medium','en-US')['tests']===1,'Invalid replay evidence cannot append a partial result');
    $legacyPath=$directory.'/language-tests/en-us/slow-en-us.log';
    $legacy=json_encode(['type'=>'test-end','runStatus'=>'failed','delivery'=>'slow'])."\n";
    file_put_contents($legacyPath,$legacy);
    check($store->last('slow','en-US')['runStatus']==='failed','Historical Slow reports remain readable');
    try{$store->apply(['suite'=>'slow','locale'=>'en-US','action'=>'start','totalTests'=>1],'developer-1',$build);throw new RuntimeException('Retired Slow suite accepted');}catch(InvalidArgumentException){}
    check(file_get_contents($legacyPath)===$legacy,'Retiring Slow never overwrites historical results');
    echo "PASS diagnostics numbering, counts, paging, filtering, replacement, abort, privacy and stale/principal fences\n";
} finally {
    if(is_dir($directory)){
        $files=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
        foreach($files as $file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}
        rmdir($directory);
    }
}
