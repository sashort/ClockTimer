// Original plucked-string source for the 80s guitar layer; no imported recording.
const fs=require('node:fs'),path=require('node:path');
const rate=48000,frequency=146.8323839587038,frames=rate*3;
let seed=73193;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
function string(detune) {
    const delay=rate/(frequency*2**(detune/1200))-.5;
    const size=Math.ceil(delay)+2,ring=Float64Array.from({length:size},random);
    const out=new Float64Array(frames);let previous=0;
    for(let i=0;i<frames;i++) {
        const write=i%size,read=(write-delay+size*2)%size,lo=Math.floor(read),fraction=read-lo;
        const tap=ring[lo]*(1-fraction)+ring[(lo+1)%size]*fraction;
        const value=(tap+previous)*.5*.9974;previous=tap;ring[write]=value;out[i]=value;
    }
    return out;
}
const a=string(-1.5),b=string(1.5),samples=new Float64Array(frames);
let highpass=0,previous=0,lowpass=0,peak=0;
for(let i=0;i<frames;i++) {
    const dry=(a[i]+b[i])*.5;
    highpass=.989*(highpass+dry-previous);previous=dry;
    const driven=Math.tanh(highpass*4.8);
    lowpass+=.36*(driven-lowpass);
    samples[i]=lowpass*Math.min(1,i/48,(frames-1-i)/2400);peak=Math.max(peak,Math.abs(samples[i]));
}
const wave=Buffer.alloc(44+frames*2);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*2,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(frames*2,40);
for(let i=0;i<frames;i++)wave.writeInt16LE(Math.round(samples[i]/peak*.72*32767),44+i*2);
fs.writeFileSync(path.resolve(__dirname,'../api/audio/samples/neon-guitar-d3.wav'),wave);
console.log('Synthesized original D3 plucked-string guitar source, 3s at 48 kHz.');
