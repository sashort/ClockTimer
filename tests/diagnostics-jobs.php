<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/diagnostics_jobs.php';
function assertJob(bool $condition,string $message):void{if(!$condition)throw new RuntimeException($message);}
$directory=sys_get_temp_dir().'/diagnostics-jobs-'.bin2hex(random_bytes(6));mkdir($directory,0700);
$jobs=new DiagnosticsJobs($directory,__DIR__.'/languages');$credentials=['cookie'=>'fixture=session','csrf'=>'fixture-csrf'];
try{
    assertJob(!$jobs->handle([],'one')['ready'],'Missing worker is offline');
    touch($directory.'/heartbeat');
    $run=$jobs->handle(['action'=>'job-start','suite'=>'press','locale'=>'en-US'],'one',$credentials);
    $id=$run['job']['id'];
    assertJob($run['busy']&&$run['canAbort'],'Queued run is controllable');
    assertJob(!str_contains(json_encode($run),'fixture'),'Credentials never appear in API response');
    foreach([
        [['action'=>'job-start','suite'=>'time','locale'=>'en-US'],'one'],
        [['action'=>'job-abort','jobId'=>$id],'two'],
        [['action'=>'job-abort','jobId'=>str_repeat('a',32)],'one']
    ]as[$input,$principal]){try{$jobs->handle($input,$principal,$credentials);throw new RuntimeException('Conflicting control accepted');}catch(DomainException){}}
    $jobs->handle(['action'=>'job-stop','jobId'=>$id],'one');assertJob(is_file($directory.'/'.$id.'.pause'),'Stop requests a checkpoint pause');
    $jobs->handle(['action'=>'job-resume','jobId'=>$id],'one');assertJob(!is_file($directory.'/'.$id.'.pause'),'Resume clears pause without replacing run');
    $jobs->handle(['action'=>'job-abort','jobId'=>$id],'one');assertJob(is_file($directory.'/'.$id.'.abort'),'Abort is a distinct terminal request');
    file_put_contents($directory.'/'.$id.'.status',json_encode(['status'=>'aborted']));
    foreach(['press','fast','medium','time','duration']as$suite){
        $run=$jobs->handle(['action'=>'job-start','suite'=>$suite,'locale'=>'en-US'],'one',$credentials);
        file_put_contents($directory.'/'.$run['job']['id'].'.status',json_encode(['status'=>'passed']));
    }
    foreach(['../time','order-filler','slow']as$suite){try{$jobs->handle(['action'=>'job-start','suite'=>$suite,'locale'=>'en-US'],'one',$credentials);throw new RuntimeException('Invalid suite accepted');}catch(InvalidArgumentException){}}
    $humanJobs=new DiagnosticsJobs($directory,__DIR__.'/languages',$directory.'/recordings');
    try{$humanJobs->handle(['action'=>'job-start','suite'=>'fast','locale'=>'en-US','audioSource'=>'human'],'one',$credentials);throw new RuntimeException('Incomplete human corpus accepted');}catch(InvalidArgumentException $error){assertJob(str_contains($error->getMessage(),'32'),'Human runs identify missing approved prompts');}
    try{$humanJobs->handle(['action'=>'job-start','suite'=>'fast','locale'=>'en-US','audioSource'=>'unknown'],'one',$credentials);throw new RuntimeException('Unknown audio source accepted');}catch(InvalidArgumentException){}
    $recordings=new SpeechRecordings($directory.'/recordings',__DIR__.'/recording-scripts');
    $pcm=str_repeat(pack('v',1200),8000);$wave='RIFF'.pack('V',strlen($pcm)+36).'WAVEfmt '.pack('VvvVVvv',16,1,1,16000,32000,2,16).'data'.pack('V',strlen($pcm)).$pcm;
    foreach($recordings->script('en-US','fast')['prompts']as$prompt)$recordings->save(['locale'=>'en-US','delivery'=>'fast','phraseId'=>$prompt['id'],'wav'=>base64_encode($wave)]);
    $human=$humanJobs->handle(['action'=>'job-start','suite'=>'fast','locale'=>'en-US','audioSource'=>'human'],'one',$credentials);
    assertJob($human['job']['audioSource']==='human','A complete approved corpus queues an explicit human voice run');
    file_put_contents($directory.'/'.$human['job']['id'].'.status',json_encode(['status'=>'passed']));
    try{$jobs->handle(['action'=>'job-start','suite'=>'time','locale'=>'en-GB'],'one',$credentials);throw new RuntimeException('Missing language accepted');}catch(InvalidArgumentException){}
    echo "PASS five-category queue, stop/resume/abort, principal fencing, offline runner and credential privacy\n";
}finally{foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST)as$file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($directory);}
