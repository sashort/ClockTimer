<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/speech_recordings.php';
function recordingCheck(bool $condition,string $message):void{if(!$condition)throw new RuntimeException($message);}
function testWave(int $amplitude=1200):string{$pcm=str_repeat(pack('v',$amplitude),8000);return 'RIFF'.pack('V',strlen($pcm)+36).'WAVEfmt '.pack('VvvVVvv',16,1,1,16000,32000,2,16).'data'.pack('V',strlen($pcm)).$pcm;}
$directory=sys_get_temp_dir().'/speech-recordings-'.bin2hex(random_bytes(6));
$store=new SpeechRecordings($directory,__DIR__.'/recording-scripts');
try{
 $script=$store->script('en-US','fast');recordingCheck(count($script['prompts'])===32&&$script['recorded']===0,'Reviewed recording script contains 32 prompts');
 recordingCheck($script['prompts'][31]['text']==='zero zero four two one two three four trip goal one twenty sync on ready at four twelve','Continuous login/goal/sync/time benchmark uses fixture credentials');
 $corpus=file_get_contents(__DIR__.'/recording-scripts/en-us.json');recordingCheck(str_contains($corpus,'one two three four okay'),'The script uses fixture credentials');
 $prompt=$script['prompts'][0];$input=['locale'=>'en-US','delivery'=>'fast','phraseId'=>$prompt['id'],'wav'=>base64_encode(testWave())];
 foreach ([array_replace($input,['locale'=>'../en-us']),array_replace($input,['delivery'=>'slow']),array_replace($input,['phraseId'=>str_repeat('a',64)]),array_replace($input,['wav'=>'invalid!']),array_replace($input,['wav'=>base64_encode(testWave(0))]),array_replace($input,['wav'=>base64_encode(substr_replace(testWave(),pack('V',48000),24,4))])] as $bad){try{$store->save($bad);throw new RuntimeException('Invalid recording accepted');}catch(InvalidArgumentException){}}
 $saved=$store->save($input);recordingCheck($saved['source']==='human'&&$saved['sampleRate']===16000&&$saved['seconds']===0.5,'Approved metadata records format and provenance');
 recordingCheck($store->audio('en-US','fast',$prompt['id'])===testWave(),'Replay returns exact approved PCM');
 recordingCheck($store->script('en-US','fast')['recorded']===1&&$store->script('en-US','medium')['recorded']===0,'Progress stays independent per delivery');
 $replacement=$store->save(array_replace($input,['wav'=>base64_encode(testWave(2400))]));
 recordingCheck($replacement['sha256']!==$saved['sha256']&&is_file($directory.'/en-us/fast/'.$saved['sha256'].'.wav'),'Replacing an approved take retains previous audio');
 recordingCheck($store->audio('en-US','fast',$prompt['id'])===testWave(2400),'Replay follows the new approved take');
 echo "PASS recording script, format validation, silence rejection, approved replay, delivery separation and retained takes\n";
}finally{
 if(is_dir($directory)){foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST)as$file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($directory);}
}
