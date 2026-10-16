// Original nonverbal vowel instrument. The existing cinematic pulse carrier
// passes through three moving resonators; no speech or imported samples.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),rate=48000;
function source(frequency) {
    const frames=Math.round(2.08*rate),out=new Float64Array(frames);
    const phases=[0,0,0],states=Array.from({length:3},()=>({x1:0,x2:0,y1:0,y2:0}));
    const vowels=[[450,850,2500],[700,1100,2450],[300,2300,3000],[450,850,2500]];
    let coefficients;
    function blep(t,dt){if(t<dt){t/=dt;return t+t-t*t-1;}if(t>1-dt){t=(t-1)/dt;return t*t+t+t+1;}return 0;}
    function saw(index,hz){const dt=hz/rate,t=phases[index];phases[index]=(t+dt)%1;return 2*t-1-blep(t,dt);}
    for(let i=0;i<frames;i++) {
        if(i%128===0) {
            const position=(i/rate%2)/2*3,index=Math.floor(position),fraction=position-index;
            const ease=fraction*fraction*(3-2*fraction);
            coefficients=vowels[index].map((value,j)=>{
                const center=value+(vowels[index+1][j]-value)*ease;
                const w=2*Math.PI*center/rate,alpha=Math.sin(w)/(j===0?8:12),a0=1+alpha;
                return {b0:alpha/a0,b2:-alpha/a0,a1:-2*Math.cos(w)/a0,a2:(1-alpha)/a0};
            });
        }
        const lowPhase=phases[2],lowStep=frequency*.5/rate;
        const sub=(lowPhase<.5?1:-1)+blep(lowPhase,lowStep)-blep((lowPhase+.5)%1,lowStep);
        phases[2]=(lowPhase+lowStep)%1;
        const dry=.5*saw(0,frequency*2**(-3/1200))+.5*saw(1,frequency*2**(3/1200))+
            .24*sub+.08*Math.sin(2*Math.PI*frequency*2*i/rate);
        let wet=0;
        for(let j=0;j<3;j++) {
            const c=coefficients[j],s=states[j];
            const y=c.b0*dry+c.b2*s.x2-c.a1*s.y1-c.a2*s.y2;
            s.x2=s.x1;s.x1=dry;s.y2=s.y1;s.y1=y;
            wet+=y*[1,.85,.45][j];
        }
        out[i]=Math.tanh(.14*dry+wet*3.8);
    }
    // End of the two-second loop blends into the audio immediately before
    // loopStart; the next sample on wrap is therefore contiguous.
    const end=Math.round(2.04*rate),cross=Math.round(.04*rate);
    for(let i=0;i<cross;i++) {
        const weight=.5-.5*Math.cos(Math.PI*i/(cross-1));
        out[end-cross+i]=out[end-cross+i]*(1-weight)+out[i]*weight;
    }
    let peak=0;for(const sample of out)peak=Math.max(peak,Math.abs(sample));
    const wave=Buffer.alloc(44+frames*2);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);
    wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(rate,24);
    wave.writeUInt32LE(rate*2,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(frames*2,40);
    for(let i=0;i<frames;i++)wave.writeInt16LE(Math.round(out[i]/peak*.72*32767),44+i*2);
    return wave;
}
function generate() {
    const catalogPath=path.join(root,'api/audio/catalog.json'),catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
    const original=catalog.instruments['cinematic-pulse-bass'];
    const instrument={...structuredClone(original),class:'expressive',displayName:'Cinematic Robot Pulse',
        derivedFrom:'cinematic-pulse-bass',volume:.48,
        filter:{type:'lowpass',frequency:4200,Q:.55,envelopeAmount:300},
        chorus:{rate:.35,delay:.019,depth:.002,wet:.12},samples:[]};
    for(const key of ['partials','pitchEnvelope','phoneFallback'])delete instrument[key];
    for(const [note,frequency] of [['c2',65.40639132514966],['c3',130.8127826502993],['c4',261.6255653005986]]) {
        const url=`api/audio/samples/cinematic-robot-${note}.wav`;
        fs.writeFileSync(path.join(root,url),source(frequency));
        instrument.samples.push({url,rootFrequency:frequency,loopStart:.04,loopEnd:2.04});
    }
    fs.writeFileSync(path.join(root,'api/audio/instruments/cinematic-robot-pulse.json'),JSON.stringify(instrument,null,2)+'\n');
    catalog.instruments['cinematic-robot-pulse']=instrument;
    fs.writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+'\n');
    const events=[];
    const add=(at,tone,length,instrument)=>events.push({offset:String(at*2),tone,length:String(length*2),instrument,dynamic:'mf'});
    const figure=[[0,'D2',.65],[.75,'D2',.3],[1.25,'A2',.55],[2,'C3',.7],[3,'D3',.8]];
    for(const [at,tone,length] of figure){add(at,tone,length,'cinematic-pulse-bass');add(4+at,tone,length,'cinematic-robot-pulse');}
    add(8,'D3',3.5,'cinematic-robot-pulse');
    for(const tone of ['D3','F3','A3'])add(12,tone,3.25,'cinematic-robot-pulse');
    for(const [i,tone] of ['D3','A2','C3','D3'].entries())add(16+i*.4,tone,.3,'cinematic-robot-pulse');
    const demo={title:'Cinematic Pulse / Robot Pulse comparison',key:'D minor',revision:1,
        sections:[['Original pulse',0,4],['Robot pulse: same figure',4,8],['Held vowel motion',8,12],['Chord',12,16],['Short pulse ending',16,18]],
        instruments:{'cinematic-pulse-bass':original,'cinematic-robot-pulse':instrument},
        song:{bpm:120,instrument:'cinematic-robot-pulse',events},
        render:{seconds:18,fadeOutSeconds:.4,peakTarget:.65}};
    fs.writeFileSync(path.join(root,'api/audio/instruments/cinematic-robot-demo.json'),JSON.stringify(demo,null,2)+'\n');
    console.log('Generated original moving-vowel pulse multisamples and 18-second A/B audition.');
}
if(require.main===module)generate();
module.exports={source};
