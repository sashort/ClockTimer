const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const input=path.resolve(process.argv[2]),score=JSON.parse(fs.readFileSync(path.resolve(process.argv[3]),'utf8'));
const output=path.resolve(process.argv[4]),wav=fs.readFileSync(input);
assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',36,40),'data');
assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt16LE(34),16);
const sampleRate=wav.readUInt32LE(24),frames=(wav.length-44)/4,rendered=Buffer.from(wav);
function biquad(type,hz){
 const omega=2*Math.PI*hz/sampleRate,c=Math.cos(omega),alpha=Math.sin(omega)/(2*Math.SQRT1_2),a0=1+alpha;
 const b0=(type==='lowpass'?(1-c):(1+c))/2/a0,b1=(type==='lowpass'?1-c:-(1+c))/a0,b2=b0,a1=-2*c/a0,a2=(1-alpha)/a0;
 let x1=0,x2=0,y1=0,y2=0;return x=>{const y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
const hp=biquad('highpass',220),lp=biquad('lowpass',3300);
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const [inStart,inEnd]=score.audition.radioInSeconds,[outStart,outEnd]=score.audition.radioOutSeconds;
let seed=9173,peak=0;
for(let i=0;i<frames;i++){
 const t=i/sampleRate,wet=ease((t-inStart)/(inEnd-inStart))*(1-ease((t-outStart)/(outEnd-outStart)));
 const left=wav.readInt16LE(44+i*4)/32768,right=wav.readInt16LE(46+i*4)/32768;
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 const staticNoise=(seed/4294967296*2-1)*.001;
 const filtered=lp(hp((left+right)/2)),radio=Math.tanh(filtered*2.1)/1.7+staticNoise;
 for(const [channel,dry] of [left,right].entries()){
  const sample=dry*(1-wet)+radio*wet;assert(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));
  assert(Math.abs(sample)<1,'radio transition has headroom');rendered.writeInt16LE(Math.round(sample*32768),44+i*4+channel*2);
 }
}
fs.writeFileSync(output,rendered);
const metadata={output,peak,radioBandHz:[220,3300],staticAmplitude:.001,noiseSeed:9173,sourceSha256:createHash('sha256').update(wav).digest('hex'),sha256:createHash('sha256').update(rendered).digest('hex'),...score.audition};
fs.writeFileSync(output.replace(/\.wav$/,'-mix.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata));
