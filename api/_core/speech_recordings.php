<?php
declare(strict_types=1);

/** Reviewed human speech fixtures, kept outside the document root. */
final class SpeechRecordings
{
    public function __construct(private string $directory, private string $scriptsDirectory) {}

    public function script(string $locale, string $delivery): array
    {
        if (!preg_match('/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/D',strtolower($locale)) || !in_array($delivery,['fast','medium'],true)) throw new InvalidArgumentException('Choose a reviewed language and Fast or Medium delivery.');
        $file=$this->scriptsDirectory.'/'.strtolower($locale).'.json';
        if (!is_file($file)) throw new InvalidArgumentException('No recording script is available for that language.');
        $script=json_decode((string)file_get_contents($file),true,32,JSON_THROW_ON_ERROR);
        $prompts=[];
        foreach ($script['phrases'] as $text) {
            $id=hash('sha256',strtolower($locale)."\n".$text);
            $metadata=$this->metadata($locale,$delivery,$id);
            $prompts[]=['id'=>$id,'text'=>$text,'recorded'=>$metadata!==null,'sha256'=>$metadata['sha256']??null,'seconds'=>$metadata['seconds']??null];
        }
        return ['locale'=>$script['locale'],'delivery'=>$delivery,'targetWpm'=>$delivery==='fast'?240:160,'prompts'=>$prompts,'recorded'=>count(array_filter($prompts,static fn($p)=>$p['recorded']))];
    }

    private function folder(string $locale,string $delivery): string { return $this->directory.'/'.strtolower($locale).'/'.$delivery; }
    private function metadata(string $locale,string $delivery,string $id): ?array
    {
        $file=$this->folder($locale,$delivery).'/'.$id.'.json';
        return is_file($file)?json_decode((string)file_get_contents($file),true,16,JSON_THROW_ON_ERROR):null;
    }

    public static function inspectWave(string $wav): array
    {
        $size=strlen($wav);
        if ($size<44 || $size>1120044 || substr($wav,0,4)!=='RIFF' || substr($wav,8,8)!=='WAVEfmt ' || substr($wav,36,4)!=='data') throw new InvalidArgumentException('Supply a mono 16 kHz, 16-bit PCM WAV, up to 35 seconds.');
        $u32=static fn($offset)=>unpack('V',substr($wav,$offset,4))[1];
        $u16=static fn($offset)=>unpack('v',substr($wav,$offset,2))[1];
        if ($u32(4)!==$size-8 || $u32(16)!==16 || $u16(20)!==1 || $u16(22)!==1 || $u32(24)!==16000 || $u32(28)!==32000 || $u16(32)!==2 || $u16(34)!==16 || $u32(40)!==$size-44 || ($size-44)%2!==0 || $size<8044) throw new InvalidArgumentException('Invalid PCM WAV header or duration.');
        $peak=0;$clipped=0;
        foreach (unpack('v*',substr($wav,44)) as $sample) { $sample=$sample>32767?$sample-65536:$sample;$level=abs($sample);$peak=max($peak,$level);if($level>=32760)$clipped++; }
        if ($peak<64) throw new InvalidArgumentException('This take is silent or too quiet. Record it again.');
        return ['sampleRate'=>16000,'channels'=>1,'bits'=>16,'seconds'=>($size-44)/32000,'peak'=>$peak,'clippedSamples'=>$clipped];
    }

    public function save(array $input): array
    {
        $locale=(string)($input['locale']??'');$delivery=(string)($input['delivery']??'');
        $script=$this->script($locale,$delivery);$id=$input['phraseId']??'';
        $matches=array_values(array_filter($script['prompts'],static fn($p)=>$p['id']===$id));
        if (!$matches || !is_string($input['wav']??null) || strlen($input['wav'])>1493400) throw new InvalidArgumentException('Choose a script prompt and supply its WAV recording.');
        $wav=base64_decode($input['wav'],true);
        if ($wav===false) throw new InvalidArgumentException('Invalid WAV encoding.');
        $metadata=self::inspectWave($wav)+['format'=>1,'source'=>'human','locale'=>strtolower($locale),'delivery'=>$delivery,'targetWpm'=>$script['targetWpm'],'phraseId'=>$id,'text'=>$matches[0]['text'],'sha256'=>hash('sha256',$wav),'approvedAt'=>gmdate('c')];
        $folder=$this->folder($locale,$delivery);
        if (!is_dir($folder) && !mkdir($folder,0700,true) && !is_dir($folder)) throw new RuntimeException('Recording storage unavailable.');
        $lock=fopen($folder.'/.lock','c');
        if (!$lock || !flock($lock,LOCK_EX)) throw new RuntimeException('Recording storage is busy.');
        try {
            $audio=$folder.'/'.$metadata['sha256'].'.wav';
            if (!is_file($audio)) $this->write($audio,$wav);
            // Each approved replacement keeps older content-addressed takes.
            $this->write($folder.'/'.$id.'.json',json_encode($metadata,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE));
        } finally {flock($lock,LOCK_UN);fclose($lock);}
        return $metadata;
    }

    public function audio(string $locale,string $delivery,string $id): string
    {
        $script=$this->script($locale,$delivery);
        if (!array_filter($script['prompts'],static fn($p)=>$p['id']===$id)) throw new InvalidArgumentException('Unknown recording prompt.');
        $metadata=$this->metadata($locale,$delivery,$id);
        if (!$metadata || !preg_match('/^[a-f0-9]{64}$/D',$metadata['sha256']??'')) throw new InvalidArgumentException('No approved take exists for this prompt.');
        $wav=(string)file_get_contents($this->folder($locale,$delivery).'/'.$metadata['sha256'].'.wav');
        if (!hash_equals($metadata['sha256'],hash('sha256',$wav))) throw new RuntimeException('Recording checksum mismatch.');
        return $wav;
    }

    private function write(string $file,string $contents): void
    {
        $temporary=$file.'.'.bin2hex(random_bytes(6));
        if (file_put_contents($temporary,$contents)!==strlen($contents)) throw new RuntimeException('Could not save recording.');
        chmod($temporary,0600);
        if (!rename($temporary,$file)) {unlink($temporary);throw new RuntimeException('Could not publish recording.');}
    }
}
