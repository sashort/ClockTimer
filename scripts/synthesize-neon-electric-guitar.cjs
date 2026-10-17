// Original clean string samples through a sustained, gently overdriven amp/cab model.
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
for(const note of ['d3','d4']){
 const source=fs.readFileSync(path.join(root,'api/audio/samples/neon-picked-electric-'+note+'.wav'));
 if(source.readUInt16LE(22)!==1||source.readUInt16LE(34)!==16)throw Error('Expected mono16-bit original guitar source');
 const rate=source.readUInt32LE(24),frames=(source.length-44)/2,signal=new Float64Array(frames),values=new Float64Array(frames);for(let i=0;i<frames;i++)signal[i]=source.readInt16LE(44+i*2)/32768;
 const window=Math.round(rate*.025),power=[];for(let i=0;i<frames;i+=window){let sum=0;for(let j=i;j<Math.min(frames,i+window);j++)sum+=signal[j]**2;power.push(Math.sqrt(sum/Math.min(window,frames-i)));}
 let low=0,dc=0,peak=0;const lp=1-Math.exp(-2*Math.PI*3200/rate),hp=1-Math.exp(-2*Math.PI*75/rate);
 for(let i=0;i<frames;i++){const t=i/window,index=Math.floor(t),fraction=t-index;const rms=power[index]*(1-fraction)+(power[index+1]??power[index])*fraction;const gain=Math.min(12,.16/Math.max(.003,rms));const amp=Math.tanh(signal[i]*gain*2.8);dc+=hp*(amp-dc);low+=lp*((amp-dc)-low);const edge=Math.min(1,i/(rate*.006),(frames-1-i)/(rate*.03));values[i]=low*edge;peak=Math.max(peak,Math.abs(values[i]));}
 const wave=Buffer.from(source);for(let i=0;i<frames;i++)wave.writeInt16LE(Math.round(values[i]/peak*.7*32767),44+i*2);fs.writeFileSync(path.join(root,'api/audio/samples/neon-electric-amp-'+note+'.wav'),wave);
}
console.log('Created sustained overdriven electric-guitar samples');
