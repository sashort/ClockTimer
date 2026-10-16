// Original clean picked-electric string samples. No imported recording.
const fs=require('node:fs'),path=require('node:path');
const rate=48000,frames=rate*4;
for(const [name,frequency] of [['d3',146.8323839587038],['d4',293.6647679174076]]) {
    let seed=49013;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
    const delay=rate/frequency-.5,size=Math.ceil(delay)+2;
    const ring=Float64Array.from({length:size},random),samples=new Float64Array(frames);
    // A brighter pick excitation retains the attack; output filtering rounds
    // the top end without the distortion used in the existing rhythm guitar.
    for(let pass=0;pass<1;pass++) {
        const copy=ring.slice();
        for(let i=0;i<size;i++)ring[i]=(copy[(i+size-1)%size]+2*copy[i]+copy[(i+1)%size])/4;
    }
    let previousTap=0,previousInput=0,highpass=0,body=0,peak=0;
    for(let i=0;i<frames;i++) {
        const write=i%size,read=(write-delay+size*2)%size,lo=Math.floor(read),fraction=read-lo;
        const tap=ring[lo]*(1-fraction)+ring[(lo+1)%size]*fraction;
        const value=(tap+previousTap)*.5*.9991;previousTap=tap;ring[write]=value;
        highpass=.996*(highpass+value-previousInput);previousInput=value;
        body+=.38*(highpass-body);
        samples[i]=body*Math.min(1,i/48,(frames-1-i)/4800);
        peak=Math.max(peak,Math.abs(samples[i]));
    }
    const wave=Buffer.alloc(44+frames*2);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);
    wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(rate,24);
    wave.writeUInt32LE(rate*2,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(frames*2,40);
    for(let i=0;i<frames;i++)wave.writeInt16LE(Math.round(samples[i]/peak*.72*32767),44+i*2);
    fs.writeFileSync(path.resolve(__dirname,`../api/audio/samples/neon-picked-electric-${name}.wav`),wave);
}
console.log('Synthesized original clean picked-electric D3/D4 strings, 4s each, 48 kHz.');
