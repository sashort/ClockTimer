"""Recover exact original Dark 80s one-shots from the preserved v12 stems."""
import array,ast,hashlib,json,math,struct,sys,wave,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
archive=Path(sys.argv[1]) if len(sys.argv)>1 else Path('D:/Codex/Projects/ClockTimer-Music/Drafts/Dark-80s-Hip-Hop-v12/percussion-stems.npz')
score=json.loads(archive.with_name('percussion-score.json').read_text())
rate=48000;samples={}
with zipfile.ZipFile(archive) as z:
 for name,label,duration in [('kick','808-style kick',.43),('snare','snare',.24),('clap','clap',.18),('hat','closed hat',.072)]:
  first=next(e for e in score if e['instrument']==label)
  with z.open(name+'.npy') as stream:
   assert stream.read(6)==b'\x93NUMPY';version=stream.read(2)
   headerlen=struct.unpack('<H' if version[0]==1 else '<I',stream.read(2 if version[0]==1 else 4))[0]
   header=ast.literal_eval(stream.read(headerlen).decode('latin1'));assert header['descr']=='<f8' and not header['fortran_order']
   at=round(first['beat']*60/225*rate);stream.seek(stream.tell()+at*8)
   values=array.array('d');values.frombytes(stream.read(round(duration*rate)*8))
   pcm=array.array('h',(max(-32768,min(32767,round(x/first['velocity']*32767))) for x in values))
  relative='api/audio/samples/dark-eighties-hiphop-'+name+'.wav';target=ROOT/relative
  with wave.open(str(target),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
  samples[name]=dict(url=relative,rootFrequency=261.6255653005986,naturalDecay=True,durationSeconds=len(pcm)/rate,
   peakAmplitude=max(abs(x) for x in pcm)/32768,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),sourceBeat=first['beat'],sourceVelocity=first['velocity'])
manifest=dict(source='Original Dark 80s Hip-Hop v12 isolated percussion stems',archive=archive.name,
 archiveSha256=hashlib.sha256(archive.read_bytes()).hexdigest(),sampleRate=rate,
 importer='scripts/import-dark-eighties-kit.py',synthesisRecipe='scripts/synthesize-dark-eighties-kit.py',samples=samples)
(ROOT/'api/audio/instruments/dark-eighties-hiphop-kit.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print('Recovered exact original kick/snare/clap/closed-hat one-shots from isolated stems.')
