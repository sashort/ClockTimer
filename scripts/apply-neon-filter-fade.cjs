// Audition postprocess: a continuous, nonresonant filter sweep, independent
// of note envelopes. Timing/pitches/chord holds are untouched.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const input=path.resolve(process.argv[2]),score=JSON.parse(fs.readFileSync(path.resolve(process.argv[3]),'utf8'));
const output=path.resolve(process.argv[4]),source=fs.readFileSync(input),result=Buffer.from(source);
assert.equal(source.toString('ascii',0,4),'RIFF');assert.equal(source.readUInt16LE(22),2);assert.equal(source.readUInt16LE(34),16);
const rate=source.readUInt32LE(24),frames=(source.length-44)/4;
const [entryStart,entryEnd]=score.audition.entrySeconds,[exitStart,exitEnd]=score.audition.exitSeconds;
const ease=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
const mixAt=t=>ease((t-entryStart)/(entryEnd-entryStart))*(1-ease((t-exitStart)/(exitEnd-exitStart)));
function filter(type){
 let b0,b1,b2,a1,a2;const state=[{x1:0,x2:0,y1:0,y2:0},{x1:0,x2:0,y1:0,y2:0}];
 return {tune(hz){const w=2*Math.PI*hz/rate,c=Math.cos(w),alpha=Math.sin(w)/(2*Math.SQRT1_2),a0=1+alpha;
  b0=(type==='lowpass'?1-c:1+c)/2/a0;b1=(type==='lowpass'?1-c:-(1+c))/a0;b2=b0;a1=-2*c/a0;a2=(1-alpha)/a0;},
 process(x,channel){const s=state[channel],y=b0*x+b1*s.x1+b2*s.x2-a1*s.y1-a2*s.y2;s.x2=s.x1;s.x1=x;s.y2=s.y1;s.y1=y;return y;}};
}
const low=filter('lowpass'),high=filter('highpass');let peak=0;
for(let i=0;i<frames;i++){
 const wet=mixAt(i/rate);
 if(i%32===0){
  low.tune(18000*(3400/18000)**wet);
  high.tune(20*(140/20)**wet);
 }
 for(let channel=0;channel<2;channel++){
  const at=44+i*4+channel*2,dry=source.readInt16LE(at)/32768;
  const filtered=low.process(high.process(dry,channel),channel)*(1+.08*wet);
  const value=dry*(1-wet)+filtered*wet;assert(Number.isFinite(value));assert(Math.abs(value)<1,'filter sweep headroom');
  peak=Math.max(peak,Math.abs(value));if(wet>0)result.writeInt16LE(Math.round(value*32768),at);
 }
}
fs.writeFileSync(output,result);
const metadata={source:input,output,peak,entrySeconds:[entryStart,entryEnd],exitSeconds:[exitStart,exitEnd],
 lowpassHz:[18000,3400],highpassHz:[20,140],Q:Math.SQRT1_2,coefficientUpdateFrames:32,levelCompensationAtFullEffect:1.08,
 sourceSha256:createHash('sha256').update(source).digest('hex'),sha256:createHash('sha256').update(result).digest('hex'),
 noteTimingUnchanged:true,solo:score.audition};
fs.writeFileSync(output.replace(/\.wav$/,'-mix.json'),JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(metadata));
