<?php
declare(strict_types=1);
require_once __DIR__.'/speech_recordings.php';

/** One private runner queue. Requests carry a session grant, never a reusable access token. */
final class DiagnosticsJobs
{
    public function __construct(private string $directory, private string $corpusDirectory, private ?string $recordingsDirectory=null) {}

    public function handle(array $input, string $principal, array $credentials = []): array
    {
        if (!is_dir($this->directory) && !mkdir($this->directory,0700,true) && !is_dir($this->directory)) throw new RuntimeException('Diagnostics queue unavailable.');
        $lock=fopen($this->directory.'/queue.lock','c');
        if (!$lock || !flock($lock,LOCK_EX)) throw new RuntimeException('Diagnostics queue lock unavailable.');
        try {
            $active=$this->directory.'/active.json';
            $job=is_file($active)?json_decode((string)file_get_contents($active),true,32,JSON_THROW_ON_ERROR):null;
            $state=$job;
            if ($job && is_file($this->directory.'/'.$job['id'].'.status')) $state=array_merge($job,json_decode((string)file_get_contents($this->directory.'/'.$job['id'].'.status'),true,32,JSON_THROW_ON_ERROR));
            $busy=$state && in_array($state['status'],['queued','running','stopping','stopped','aborting'],true);
            if($busy){
                $prefix=$this->directory.'/'.$job['id'];
                if(is_file($prefix.'.abort'))$state['status']='aborting';
                elseif(is_file($prefix.'.paused'))$state['status']='stopped';
                elseif(is_file($prefix.'.pause'))$state['status']='stopping';
            }
            $ready=is_file($this->directory.'/heartbeat') && time()-filemtime($this->directory.'/heartbeat')<30;
            $action=$input['action']??'job-status';
            if ($action==='job-start') {
                if (!$ready) throw new RuntimeException('Diagnostics runner is offline.');
                if ($busy) throw new DomainException('A diagnostics run is already active.');
                $locale=(string)($input['locale']??'');
                if (!preg_match('/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*$/D',$locale)) throw new InvalidArgumentException('Invalid language/region.');
                $available=array_map('basename',glob($this->corpusDirectory.'/*',GLOB_ONLYDIR)?:[]);
                $matches=array_values(array_filter($available,static fn($value)=>strtolower($value)===strtolower($locale)));
                if (!$matches || !is_file($this->corpusDirectory.'/'.$matches[0].'/profile.cjs')) throw new InvalidArgumentException('No reviewed test corpus for that language/region.');
                $suite=$input['suite']??'';
                if (!in_array($suite,['press','fast','medium','time','duration'],true)) throw new InvalidArgumentException('Invalid test category.');
                if (empty($credentials['cookie']) || empty($credentials['csrf'])) throw new RuntimeException('A diagnostics session is required.');
                $audioSource=$input['audioSource']??'synthetic';
                if (!in_array($audioSource,['human','synthetic'],true)) throw new InvalidArgumentException('Choose Human recordings or Synthetic audio.');
                if (in_array($suite,['fast','medium'],true) && $audioSource==='human') {
                    if ($this->recordingsDirectory===null) throw new RuntimeException('Human recording storage is not configured.');
                    $script=(new SpeechRecordings($this->recordingsDirectory,dirname($this->corpusDirectory).'/recording-scripts'))->script($matches[0],$suite);
                    if ($script['recorded']!==count($script['prompts'])) throw new InvalidArgumentException('Record all '.count($script['prompts']).' '.$suite.' prompts first ('.$script['recorded'].' saved).');
                }
                $job=['id'=>bin2hex(random_bytes(16)),'status'=>'queued','suite'=>$suite,'locale'=>$matches[0],'principal'=>$principal,'startedAt'=>gmdate('c')];
                if (in_array($suite,['fast','medium'],true)) $job['audioSource']=$audioSource;
                $this->write($this->directory.'/'.$job['id'].'.request',$job+['credentials'=>$credentials]);
                $this->write($active,$job);$state=$job;$busy=true;
            } elseif (in_array($action,['job-stop','job-resume','job-abort'],true)) {
                if (!$busy || !is_string($input['jobId']??null) || !hash_equals($job['id'],$input['jobId']) || !hash_equals($job['principal'],$principal)) throw new DomainException('This run cannot be aborted by the current session.');
                $prefix=$this->directory.'/'.$job['id'];
                if($action==='job-stop') {
                    if(!in_array($state['status'],['queued','running'],true))throw new DomainException('This run is not running.');
                    $this->write($prefix.'.pause',['at'=>gmdate('c')]);$state['status']='stopping';
                } elseif($action==='job-resume') {
                    if(!is_file($prefix.'.pause'))throw new DomainException('This run is not stopped.');
                    unlink($prefix.'.pause');$state['status']='running';
                } else {
                    $this->write($prefix.'.abort',['at'=>gmdate('c')]);$state['status']='aborting';
                }
            } elseif ($action!=='job-status') throw new InvalidArgumentException('Invalid job action.');
            $canAbort=$busy && $job && hash_equals($job['principal'],$principal);
            if ($state) unset($state['principal']);
            return ['job'=>$state,'ready'=>$ready,'busy'=>(bool)$busy,'canAbort'=>(bool)$canAbort];
        } finally { flock($lock,LOCK_UN);fclose($lock); }
    }

    private function write(string $path,array $value): void
    {
        $temporary=$path.'.'.bin2hex(random_bytes(4));
        if(file_put_contents($temporary,json_encode($value,JSON_THROW_ON_ERROR))===false)throw new RuntimeException('Diagnostics queue write failed.');
        chmod($temporary,0600);
        if(!rename($temporary,$path))throw new RuntimeException('Diagnostics queue publish failed.');
    }
}
