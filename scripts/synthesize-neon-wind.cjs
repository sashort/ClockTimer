// Original stereo wind/static transition; no external recording.
const fs=require('node:fs'),path=require('node:path');
const score=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../api/audio/instruments/neon-countdown-score.json'),'utf8'));
const transition=score.partTwo,windStart=transition.windTransition[0];
const duration=Number((transition.windTransition[1]-windStart).toFixed(6)),attack=transition.windCrescendo.fullLevelSeconds-windStart,decayStart=transition.windOverlap.decayStartSeconds-windStart;
const rate=48000,frames=Math.round(duration*rate),channels=[new Float64Array(frames),new Float64Array(frames)];
let seed=94617,peak=0;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
for(let channel=0;channel<2;channel++) {
    let low=0,brown=0,dc=0;
    for(let i=0;i<frames;i++) {
        const t=i/rate,noise=random();
        brown=.995*brown+.025*noise;
        const sweep=450+1400*Math.sin(Math.PI*t/duration)**2;
        const a=1-Math.exp(-2*Math.PI*sweep/rate);low+=a*(noise-low);
        const raw=low*.58+brown*.75+noise*.025;
        dc+=.001*(raw-dc);
        // Rise, hold through the gap, then decay on Part II's first downbeat.
        // Attack and decay follow the closing/opening note holds in the score.
        const swell=t<attack?Math.sin(Math.PI/2*t/attack)**1.2:t<decayStart?1:Math.cos(Math.PI/2*(t-decayStart)/(duration-decayStart))**1.2;
        const movement=.78+.15*Math.sin(2*Math.PI*.19*t+channel)+.07*Math.sin(2*Math.PI*.43*t+channel*2);
        channels[channel][i]=(raw-dc)*swell*movement;peak=Math.max(peak,Math.abs(channels[channel][i]));
    }
}
const wave=Buffer.alloc(44+frames*4);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(2,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*4,28);wave.writeUInt16LE(4,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(frames*4,40);
for(let i=0;i<frames;i++)for(let c=0;c<2;c++)wave.writeInt16LE(Math.round(channels[c][i]/peak*.6*32767),44+(i*2+c)*2);
fs.writeFileSync(path.resolve(__dirname,'../api/audio/samples/neon-wind.wav'),wave);
console.log(`Synthesized ${duration}-second stereo wind bridge: ${attack}s rise, decay starts at ${decayStart}s.`);
