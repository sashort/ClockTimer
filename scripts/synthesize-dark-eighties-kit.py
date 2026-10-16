"""Recreate the original Dark 80s v12 hip-hop one-shots, without the song."""
from pathlib import Path
import hashlib,json,numpy as np,wave
ROOT=Path(__file__).resolve().parents[1]
rate=48000;rng=np.random.default_rng(8012)
def band_noise(length,low,high):
    noise=rng.normal(0,1,length);f=np.fft.rfftfreq(length,1/rate)
    response=(1-1/(1+(f/low)**4))/(1+(f/high)**4)
    filtered=np.fft.irfft(np.fft.rfft(noise)*response,n=length)
    return filtered/max(np.sqrt(np.mean(filtered**2)),1e-12)
t=np.arange(round(.43*rate))/rate
freq=49+85*np.exp(-t/.019);phase=2*np.pi*np.cumsum(freq)/rate
kick=np.sin(phase)*(1-np.exp(-t/.0012))*np.exp(-t/.13)
kick+=.13*np.sin(2*phase)*np.exp(-t/.05)
kick+=band_noise(len(t),1700,6500)*np.exp(-t/.005)*.035
kick[-480:]*=np.linspace(1,0,480);kick*=.32
t=np.arange(round(.24*rate))/rate
snare=(band_noise(len(t),900,7000)*.13*np.exp(-t/.059)+np.sin(2*np.pi*185*t)*.12*np.exp(-t/.037)+np.sin(2*np.pi*330*t)*.04*np.exp(-t/.027))*(1-np.exp(-t/.0008));snare[-480:]*=np.linspace(1,0,480)
t=np.arange(round(.18*rate))/rate;noise=band_noise(len(t),850,5800);envelope=np.zeros(len(t))
for strike in [0,.009,.018]:
    local=np.maximum(t-strike,0);envelope+=np.where(t>=strike,np.exp(-local/.007)*(1-np.exp(-local/.0006)),0)
envelope+=.25*np.exp(-np.maximum(t-.025,0)/.035)*(t>=.025)
clap=noise*envelope*.06;clap[-480:]*=np.linspace(1,0,480)
t=np.arange(round(.072*rate))/rate;metal=sum(np.sign(np.sin(2*np.pi*f*t)) for f in [4100,5270,6310])/3
hat=(metal*.027+band_noise(len(t),5500,14000)*.02)*np.exp(-t/.014)*(1-np.exp(-t/.0005));hat[-240:]*=np.linspace(1,0,240)
samples={}
for name,tone in [('kick',kick),('snare',snare),('clap',clap),('hat',hat)]:
    relative='api/audio/samples/dark-eighties-hiphop-'+name+'.wav';target=ROOT/relative
    pcm=np.round(tone*32767).astype('<i2')
    with wave.open(str(target),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
    samples[name]=dict(url=relative,rootFrequency=261.6255653005986,naturalDecay=True,durationSeconds=len(tone)/rate,
        peakAmplitude=float(np.max(np.abs(pcm.astype(float)))/32768),sha256=hashlib.sha256(target.read_bytes()).hexdigest())
manifest=dict(source='Original Dark 80s Hip-Hop v12 synthesis recipe',seed=8012,sampleRate=rate,
    recipe='scripts/synthesize-dark-eighties-kit.py',bodyHz=49,pitchSnapHz=85,metalFrequenciesHz=[4100,5270,6310],samples=samples)
(ROOT/'api/audio/instruments/dark-eighties-hiphop-kit.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print('Recreated original Dark 80s hip-hop kick/snare/clap/closed-hat one-shots.')
