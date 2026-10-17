// Original FM/analogue-style keyboard samples; an approximation, not a factory patch.
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..'),rate=48000,seconds=4;
for(const [note,hz] of [['d3',146.8323839587038],['d4',293.6647679174076]]){
 const pcm=new Float64Array(rate*seconds);let peak=0;
 for(let i=0;i<pcm.length;i++){
  const t=i/rate,p=2*Math.PI*hz*t,attack=Math.min(1,t/.0025),index=.18+2.7*Math.exp(-t/.12);
  const fm=Math.sin(p+index*Math.sin(p*3.001))*(.8*Math.exp(-t/1.1)+.2*Math.exp(-t/2.8));
  let body=0;for(let n=1;n<=12;n++)body+=(Math.sin(p*n*2**(-4/1200))+Math.sin(p*n*2**(4/1200)))/(n*n**.2)*Math.exp(-n/7);
  body=body*.24*(.7*Math.exp(-t/1.6)+.15*Math.exp(-t/3));
  const tine=.05*Math.sin(p*7.006)*Math.exp(-t/.07);
  const value=Math.tanh((.68*fm+body+tine)*1.15)*attack*Math.min(1,(seconds-t)/.08);pcm[i]=value;peak=Math.max(peak,Math.abs(value));
 }
 const wav=Buffer.alloc(44+pcm.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length*2,40);for(let i=0;i<pcm.length;i++)wav.writeInt16LE(Math.round(pcm[i]/peak*.7*32767),44+i*2);fs.writeFileSync(path.join(root,'api/audio/samples/neon-layered-keys-'+note+'.wav'),wav);
}
console.log('Synthesized two original FM/analogue-style keyboard samples');
