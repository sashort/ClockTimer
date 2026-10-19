// Apply the approved stem mix to a completed base render; never reprocess a mix.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sourceDir=path.resolve(process.argv[2]||path.join(root,'tests/artifacts/neon-softened-r57'));
const score=read('api/audio/instruments/neon-countdown-score.json');
const settings=read(score.render.postprocess.settings),base=fs.readFileSync(path.join(sourceDir,'neon-countdown.wav'));
const render=JSON.parse(fs.readFileSync(path.join(sourceDir,'neon-countdown-render.json'),'utf8'));
assert([57,58].includes(render.revision),'unprocessed base arrangement revision');
assert(!render.approvedSolo,'use a fresh base render, not a mix with the solo already installed');
const preview=fs.readFileSync(path.join(root,settings.preview)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(preview),settings.previewSha256,'approved audio');
assert.equal(base.length,44+score.durationSeconds*192000);assert.equal(base.readUInt32LE(24),48000);
const result=Buffer.from(base),rate=48000,[from,to]=settings.replaceLocalSeconds;
const gain=render.sectionGains.find(s=>settings.sourceStartSeconds>=s.startSeconds&&settings.sourceStartSeconds<s.endSeconds).gain/settings.referenceGain;
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const first=Math.ceil((settings.sourceStartSeconds+from)*rate),last=Math.floor((settings.sourceStartSeconds+to)*rate);
for(let i=first;i<last;i++){
 const local=i/rate-settings.sourceStartSeconds,frame=(local*rate),left=Math.floor(frame),fraction=frame-left;
 const wet=ease((local-from)/settings.crossfadeSeconds)*ease((to-local)/settings.crossfadeSeconds);
 for(let c=0;c<2;c++){
  const at=44+i*4+c*2,pa=44+left*4+c*2;
  const sample=(preview.readInt16LE(pa)*(1-fraction)+preview.readInt16LE(pa+4)*fraction)*gain;
  const value=base.readInt16LE(at)*(1-wet)+sample*wet;assert(Math.abs(value)<32768,'unclipped insert');result.writeInt16LE(Math.round(value),at);
 }
}
const catalog=read('api/audio/catalog.json'),song=catalog.songs['neon-countdown'];
const mix={...read(song.renderedMix.settings),...render,revision:score.revision,sha256:sha(result)};
mix.approvedSolo={...settings,sourceBaseSha256:sha(base),gain,firstFrame:first,lastFrame:last,
 unchangedPrefixSha256:sha(base.subarray(44,44+first*4)),unchangedSuffixSha256:sha(base.subarray(44+last*4))};
let peak=0;mix.secondRms=[];
for(let second=0;second<score.durationSeconds;second++){let sum=0;for(let at=44+second*192000;at<44+(second+1)*192000;at+=2){const sample=result.readInt16LE(at)/32768;peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}mix.secondRms.push(Math.sqrt(sum/96000));}
mix.peak=peak;
fs.writeFileSync(path.join(root,song.mediaUrl),result);
fs.writeFileSync(path.join(root,song.renderedMix.settings),JSON.stringify(mix,null,2)+'\n');
Object.assign(song.renderedMix,{revision:score.revision,sha256:mix.sha256,approvedSolo:score.render.postprocess.settings});
fs.writeFileSync(path.join(root,'api/audio/catalog.json'),JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({revision:score.revision,peak,sha256:mix.sha256,soloAtSeconds:settings.sourceStartSeconds+from}));
