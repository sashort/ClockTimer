// Original synthetic vinyl transients, confined to the vintage string feature.
// Seeded randomness keeps the irregular timing reproducible for future renders.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tests/artifacts/neon-chord-transitions');
const input=process.argv[2]?path.resolve(process.argv[2]):path.join(dir,'chord-transitions-filter.wav'),output=process.argv[3]?path.resolve(process.argv[3]):path.join(dir,'chord-transitions-vinyl-strong.wav');
const source=fs.readFileSync(input),result=Buffer.from(source);
const score=JSON.parse(fs.readFileSync(path.join(dir,'transition-score.json'),'utf8'));
const [start,entryEnd]=score.audition.entrySeconds,[exitStart,end]=score.audition.exitSeconds;
const rate=source.readUInt32LE(24),frames=(source.length-44)/4,noise=new Float64Array(frames*2),pops=[];
let seed=0x1835ad91;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function pop(at,secondary=false){
 const duration=.003+random()*.01,gain=24*(.018+random()*.045)*(secondary?.48:1),pan=.2+random()*.6;
 const mix=ease((at-start)/(entryEnd-start))*(1-ease((at-exitStart)/(end-exitStart)));
 const first=Math.floor(at*rate),count=Math.floor(duration*rate),polarity=random()<.5?-1:1;
 let low=0;
 for(let i=0;i<count;i++){
  const t=i/rate,raw=random()*2-1;low+=.55*(raw-low);
  const envelope=Math.min(1,t/.00025)*Math.exp(-7*t/duration);
  const value=(.72*low+.28*Math.sin(2*Math.PI*(900+pan*1300)*t))*envelope*gain*mix*polarity;
  const frame=first+i;if(frame>=frames)break;
  noise[frame*2]+=value*Math.sqrt(1-pan);noise[frame*2+1]+=value*Math.sqrt(pan);
 }
 pops.push({atSeconds:at,durationSeconds:duration,peakScale:gain*mix,pan,secondary});
}
for(let at=start+.3;at<end-.2;){
 pop(at);if(random()<.22)pop(at+.018+random()*.055,true);
 at+=.38+random()*1.5;
}
let peak=0;
for(let i=0;i<frames;i++)for(let c=0;c<2;c++){
 const at=44+i*4+c*2,value=source.readInt16LE(at)/32768+noise[i*2+c];
 assert(Number.isFinite(value)&&Math.abs(value)<1,'vinyl layer has unclipped headroom');peak=Math.max(peak,Math.abs(value));
 if(noise[i*2+c])result.writeInt16LE(Math.round(value*32768),at);
}
assert(source.subarray(44,44+Math.floor(start*rate)*4).equals(result.subarray(44,44+Math.floor(start*rate)*4)));
assert(source.subarray(44+Math.ceil(end*rate)*4).equals(result.subarray(44+Math.ceil(end*rate)*4)));
fs.writeFileSync(output,result);
const info={source:input,output,seed:'0x1835ad91',synthetic:true,constantHiss:false,gainRelativeToFirstPreview:24,gainRelativeToPreviousPreview:4,gainIncreaseDb:20*Math.log10(24),soloSeconds:[start,end],
 peak,pops,sha256:crypto.createHash('sha256').update(result).digest('hex'),backingAndStringsUnchanged:true};
fs.writeFileSync(output.replace(/\.wav$/,'-mix.json'),JSON.stringify(info,null,2)+'\n');
console.log(JSON.stringify({output,popCount:pops.length,peak,soloSeconds:info.soloSeconds,sha256:info.sha256}));
