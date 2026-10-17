// Orchestral finale at Part I's 120 BPM, with the cinematic pulse and
// the user-approved Dark 80s hip-hop kit. Pipe organ plays only the final chord.
const orchestra=require('../api/audio/instruments/neon-orchestra-samples.json');
const hiphop=require('../api/audio/instruments/dark-eighties-hiphop-kit.json');
const {approach,midi}=require('./string-chord-approach.cjs');
const {arrangeFinale}=require('./neon-countdown-phrasing.cjs');
function extendFinale(score,catalog) {
    const {instruments,song}=score,events=song.events,firstEvent=events.length;
    const start=score.durationSeconds,bpm=120,beat=60/bpm,barSeconds=4*beat,bars=48;
    const clone=(name,source,volume,changes={})=>{
        instruments[name]={...structuredClone(instruments[source]||catalog.instruments[source]),volume,...changes};return name;
    };
    const sampled=(name,group,volume,{naturalDecay=false,...changes}={})=>{
        instruments[name]={class:'expressive',type:'oscillator',displayName:'Recorded '+group,
            orchestraGroup:group,volume,velocitySensitivity:.65,
            envelope:{attack:.012,decay:.15,sustain:.9,release:.3},
            samples:orchestra.groups[group].map(sample=>({...structuredClone(sample),...(naturalDecay?{naturalDecay:true}:{})})),
            reverb:{wet:.12,decay:1.2},...changes};return name;
    };
    const pulse=clone('finale-pulse','cinematic-pulse-bass',1.1,{
        envelope:{attack:.018,decay:.22,sustain:.76,release:.16}});
    const cellos=sampled('finale-cellos','cello-short',1.9,{naturalDecay:true});
    const spiccato=sampled('finale-spiccato','violin-short',1.9,{naturalDecay:true});
    const violins=sampled('finale-violins','violin-long',2.4);
    const runStrings=sampled('finale-string-runs','violin-short',4.8,{envelope:{attack:.003,decay:.02,sustain:.96,release:.012},reverb:{wet:.025,decay:.35}});
    const strings=sampled('finale-horror-strings','violin-tremolo',2.6,{
        envelope:{attack:.025,decay:.15,sustain:.95,release:.5},reverb:{wet:.08,decay:1.2}});
    const openingStringHold=.75,openingStringRelease=1.75;
    const openingStrings=clone('finale-opening-horror-strings',strings,2.6,{
        envelope:{...instruments[strings].envelope,release:openingStringRelease}});
    const horns=sampled('finale-horns','horn',2.6,{envelope:{attack:.012,decay:.15,sustain:.9,release:.35}});
    const trumpets=sampled('finale-trumpets','trumpet',1.9,{naturalDecay:true});
    const flute=sampled('finale-flute','flute',2.6,{naturalDecay:true});
    const kit=(name,source,volume)=>{
        const sample=structuredClone(hiphop.samples[source]);sample.gain=.75/sample.peakAmplitude;
        instruments[name]={class:'expressive',type:'oscillator',displayName:'Dark 80s '+source,
            volume,velocitySensitivity:.5,envelope:{attack:0,decay:0,sustain:1,release:0},samples:[sample]};return name;
    };
    const bassDrum=kit('finale-hiphop-kick','kick',3.2);
    const snare=kit('finale-hiphop-snare','snare',2.6);
    const clap=kit('finale-hiphop-clap','clap',2.2);
    const hat=kit('finale-hiphop-hat','hat',1.6);
    const cymbal=sampled('finale-cymbal','cymbal',1.4,{naturalDecay:true});
    const softCymbal=sampled('finale-cymbal-soft','cymbal',1.4,{naturalDecay:true});
    instruments[cymbal].samples=instruments[cymbal].samples.slice(1);
    instruments[softCymbal].samples=instruments[softCymbal].samples.slice(0,1);
    const bells=clone('finale-bells','midnight-tubular-bells',5.2);
    const melodicEvents=[];
    const add=(at,tone,length,instrument,dynamic='mf')=>{
        const event={offset:String(at*2),tone,length:String(length*2),instrument,dynamic};events.push(event);return event;
    };
    const chords=[
        {root:'D2',fifth:'A2',notes:['D3','F3','A3','C4'],high:['D4','F4','A4','C5']},
        {root:'Bb1',fifth:'F2',notes:['Bb2','D3','F3','A3'],high:['D4','F4','A4','Bb4']},
        {root:'F2',fifth:'C3',notes:['C3','F3','A3','C4'],high:['C4','F4','A4','C5']},
        {root:'C2',fifth:'G2',notes:['C3','E3','G3','Bb3'],high:['E4','G4','Bb4','C5']}
    ];
    const hook=[
        [[0,'D5',.75],[1,'A4',.5],[1.75,'C5',.25],[2,'D5',1],[3.25,'F5',.5]],
        [[0,'E5',.75],[1,'D5',.5],[2,'A4',.75],[3,'F4',.75]],
        [[0,'F5',.75],[1,'D5',.5],[2,'C5',.5],[2.75,'A4',.75]],
        [[0,'Bb4',1],[1.5,'A4',.5],[2.5,'F4',.5],[3.25,'A4',.5]],
        [[0,'C5',.75],[1,'A4',.5],[1.75,'C5',.25],[2,'F5',1.5]],
        [[0,'E5',.5],[.75,'F5',.5],[1.5,'A5',.75],[2.75,'G5',.5],[3.5,'F5',.25]],
        [[0,'E5',.75],[1,'D5',.5],[2,'C5',.75],[3,'G4',.75]],
        [[0,'A4',.75],[1,'C5',.5],[2,'E5',.5],[2.75,'C#5',.25],[3,'D5',.25],[3.5,'A4',.25]]
    ];
    // Announce the horror-string color immediately, rather than burying it late.
    for(const note of ['E6','F6'])add(start+.25,note,openingStringHold,openingStrings,'mf');
    for(let bar=0;bar<bars;bar++) {
        const at=start+bar*barSeconds,building=bar>=40;
        const chord=bar>=46?{root:'A1',fifth:'E2',notes:['A2','C#3','E3','G3'],high:['C#4','E4','G4','A4']}:chords[Math.floor(bar/2)%4];
        const bassPattern=bar%2?[[0,.8,0],[1.25,.5,1],[2,.75,0],[3,.8,0]]:
            [[0,.65,0],[.75,.45,0],[1.5,.65,1],[2.5,.75,0],[3.5,.38,1]];
        for(const [position,length,fifth] of bassPattern) {
            const note=fifth?chord.fifth:chord.root;
            add(at+position*beat,note,length*beat,pulse,building?'f':'mf');
            add(at+position*beat,note.replace(/\d$/,o=>String(Number(o)+1)),.4,cellos,building?'f':'mf');
        }
        for(let step=0;step<(building?16:8);step++) {
            const note=chord.high[[0,2,1,3,2,1,2,3][step%8]];
            add(at+step*4/(building?16:8)*beat,note,.16,spiccato,step%2?'mp':'mf');
        }
        for(const note of chord.high.slice(0,3))add(at,note,1.6,violins,'mf');
        for(const position of building?[0,1.5,2.75]:bar%2?[1.5,3]:[0,2.5])
            for(const note of chord.notes.slice(0,3))add(at+position*beat,note,.8*beat,horns,building?'f':'mf');
        if(bar>=8&&bar<24||bar>=32&&bar<46)
            for(const [position,note,length] of hook[bar%8])melodicEvents.push(add(at+position*beat,note,length*beat,violins,building?'f':'mf'));
        if(bar>=24&&bar<32) {
            const phrase=bar%2?['A4','F4','D4']:['D5','F5','A5'];
            for(const [index,note] of phrase.entries())melodicEvents.push(add(at+(.25+index)*beat,note,.4,bar%2?horns:flute,'mf'));
        }
        if(bar>=4&&bar%2===0)for(const note of chord.high.slice(0,3))
            add(at,note.replace(/\d$/,o=>String(Number(o)+1)),(building?3.5:5.5)*beat,strings,building?'f':'mf');
        if([15,23,31,39,43,47].includes(bar))for(const note of ['E6','F6'])
            add(at+2.5*beat,note,.65,strings,building?'ff':'f');
        for(const position of [0,1,2,3])add(at+position*beat,'C4',.2,bassDrum,position===0?'f':'mf');
        for(const position of [1,3]){
            add(at+position*beat,'C4',.15,snare,building?'ff':'f');
            add(at+position*beat,'C4',.15,clap,'f');
        }
        for(let step=0;step<16;step++)add(at+step*.25*beat,'C4',.1,hat,['f','mp','mf','p'][step%4]);
        if(bar%4===0||building&&bar%2===0)
            for(const note of chord.high.slice(0,3))add(at,note,.4,trumpets,'mf');
        if(bar%8===0&&bar<=40)add(at,'C4',.2,cymbal,'mf');
        if(bar===44)add(at,'C4',.2,softCymbal,'mf');
        if(building&&bar%2===1)for(let step=0;step<6;step++)add(at+(2.5+step*.25)*beat,'C4',.08,snare,step<3?'p':'mf');
        if(bar>=46)for(const [index,note] of ['A5','Bb5','C#6','E6'].entries())melodicEvents.push(add(at+(index+.25)*beat,note,.35,violins,'f'));
    }
    // Most broad tremolo-chord entrances receive four diatonic sixteenths.
    // Direction follows the incoming melodic pitch relative to the chord tone.
    const stringRuns=[],skippedRepeatedStringChords=[];
    const melody=melodicEvents.sort((a,b)=>Number(a.offset)-Number(b.offset));
    const chordBars=Array.from({length:22},(_,i)=>4+i*2).filter(bar=>bar%8!==6);
    chordBars.push(48);
    for(const bar of chordBars) {
        const at=start+bar*barSeconds,leadAt=at-beat;
        const prior=melody.filter(e=>Number(e.offset)/2<leadAt).slice(-2);
        const fallback=events.slice(firstEvent).filter(e=>e.instrument===spiccato&&Number(e.offset)/2<leadAt).at(-1);
        const previous=prior.at(-1)?.tone||fallback?.tone||'A4';
        const chord=bar>=46?{high:['C#5','E5','G5']}:chords[Math.floor(bar/2)%4];
        const previousHeldNotes=[];
        for(const voice of [violins,strings]) {
            const held=events.slice(firstEvent).filter(e=>e.instrument===voice&&Number(e.length)/2>=1.5&&Number(e.offset)/2<at);
            const lastAt=Math.max(...held.map(e=>Number(e.offset)));
            previousHeldNotes.push(...held.filter(e=>Number(e.offset)===lastAt).map(e=>e.tone));
        }
        const chordTargets=bar===48?['D6']:bar>=46?chord.high:[...chord.high.slice(0,3),...chord.high.slice(0,3).map(n=>n.replace(/\d$/,o=>String(Number(o)+1)))];
        const targets=chordTargets.filter(note=>!previousHeldNotes.includes(note));
        if(!targets.length){skippedRepeatedStringChords.push({bar,notes:chordTargets});continue;}

        const target=targets.reduce((best,note)=>Math.abs(midi(note)-midi(previous))<Math.abs(midi(best)-midi(previous))?note:best,targets[0]);
        const run={bar,startSeconds:leadAt,previousHeldNotes,...approach(previous,target,{harmonicMinor:bar>=46,
            previousDirection:prior.length===2?midi(prior[1].tone)-midi(prior[0].tone):1})};
        run.notes.forEach((note,index)=>{
            const event=add(leadAt+index*beat/4,note,beat/4*.84,runStrings,'mf');
            event.sampleStartSeconds=.12; // bypass the quiet pre-attack on rapid bow strokes
        });
        if(bar===48)add(at,'D6',1.5,violins,'f');
        // Quarter-note strikes mark the run entrance and its held-chord arrival.
        add(leadAt,run.notes[0],beat,bells,'ff');
        add(at,run.target,beat,bells,'ff');
        stringRuns.push(run);
    }
    // Sparse callbacks to Part II, with enough space for complete recorded tails.
    const bellEvents=[[8,'D4'],[20,'F4'],[32,'A4'],[40,'D5']].map(([bar,note])=>({at:start+bar*barSeconds,note}));
    for(const {at,note} of bellEvents)add(at,note,.6,bells,'ff');
    const finalAt=start+bars*barSeconds,hold=2,release=3,ensembleHold=1.5;
    const finalPulse=clone('finale-last-pulse',pulse,1.25,{envelope:{attack:.018,decay:.2,sustain:.8,release:.35}});
    const finalOrgan=sampled('finale-last-organ','pipe-organ',1.6,{
        envelope:{attack:.015,decay:.2,sustain:.95,release},reverb:{wet:.1,decay:1}});
    const finalCellos=sampled('finale-last-cellos','cello-long',1.9);
    const finalTrumpets=sampled('finale-last-trumpets','trumpet-long',1.9);
    add(finalAt,'D2',ensembleHold,finalPulse,'ff');
    for(const note of ['D4','F4','A4','D5']) {
        add(finalAt,note,hold,finalOrgan,'ff');
        add(finalAt,note,ensembleHold,violins,'f');
        add(finalAt,note,ensembleHold,finalTrumpets,'f');
    }
    for(const note of ['D3','A3','D4'])add(finalAt,note,ensembleHold,horns,'f');
    add(finalAt,'D3',ensembleHold,finalCellos,'f');
    for(const note of ['A5','D6'])add(finalAt,note,ensembleHold,strings,'f');
    add(finalAt,'C4',.2,bassDrum,'ff');add(finalAt,'C4',.15,snare,'f');add(finalAt,'C4',.15,clap,'f');
    const phrasing=arrangeFinale({events,instruments,start,stringRuns,violins,strings,runStrings,bells});
    const frequency=note=>{const m=/^([A-G])(#|b)?(\d)$/.exec(note);return 440*2**((((Number(m[3])+1)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0))-69)/12);};
    const naturalEnd=event=>{
        const definition=instruments[event.instrument],samples=definition.samples,hz=frequency(event.tone);
        if(!samples?.every(sample=>sample.naturalDecay))return 0;
        const nearest=Math.min(...samples.map(sample=>Math.abs(Math.log2(hz/sample.rootFrequency))));
        return Number(event.offset)/2+Math.max(...samples.filter(sample=>Math.abs(Math.abs(Math.log2(hz/sample.rootFrequency))-nearest)<1e-8).map(sample=>sample.durationSeconds/(hz/sample.rootFrequency)))+(definition.reverb?.decay||0);
    };
    const naturalTailEnd=Math.max(...events.slice(firstEvent).map(naturalEnd));
    const bellNaturalEnd=Math.max(...events.slice(firstEvent).filter(event=>event.instrument===bells).map(naturalEnd));
    const durationSeconds=Math.ceil(Math.max(finalAt+hold+release+1,naturalTailEnd,score.partTwo.tubularBells.naturalEndSeconds+2.8));
    events.sort((a,b)=>Number(a.offset)-Number(b.offset));
    return {...score,revision:52,durationSeconds,
        sections:[...score.sections,['Part III: orchestral entry',start,start+8*barSeconds],
            ['Part III: orchestral themes',start+8*barSeconds,start+24*barSeconds],
            ['Part III: woodwind and brass answers',start+24*barSeconds,start+32*barSeconds],
            ['Part III: full orchestra',start+32*barSeconds,start+40*barSeconds],
            ['Part III: final build',start+40*barSeconds,finalAt],['Part III: final organ chord',finalAt,durationSeconds]],
        partThree:{startSeconds:start,durationSeconds:durationSeconds-start,bpm,key:'D minor',bars,
            balance:{orchestraRaised:true,pulseGain:1.1,pulseArticulation:'original short pattern',pulseSustain:.76},
            ...phrasing,stringRuns,skippedRepeatedStringChords,stringLeadInGain:4.8,stringLeadInSampleStartSeconds:.12,
            percussion:{steady:true,samplePeakTarget:.75,recordingLevelsCompensated:true,foregroundBoostDb:6.0206,kitSource:hiphop.source,bassDrumBeats:[0,1,2,3],snareBeats:[1,3],subdivisionBeats:.25,sixteenthNoteInstrument:hat},
            orchestral:true,electronicExceptions:['cinematic-pulse-bass','Dark 80s hip-hop percussion'],
            sampleManifest:'api/audio/instruments/neon-orchestra-samples.json',
            horrorStrings:{instrument:strings,entrySeconds:start+.25,openingInstrument:openingStrings,openingHoldSeconds:openingStringHold,openingReleaseSeconds:openingStringRelease,semitoneAccents:true,recordedTremolo:true},
            bells:{strikeCount:events.filter(e=>e.instrument===bells).length,contourPositions:['run-start','held-chord'],contourGateBeats:1,contourStrikeCount:phrasing.bellPhrases.filter(p=>p.count===2).length*2,exactContourOctaves:true,foregroundGain:5.2,dynamic:'ff',lastStrikeSeconds:Math.max(...events.filter(e=>e.instrument===bells).map(e=>Number(e.offset)/2)),naturalEndSeconds:bellNaturalEnd,naturalDecay:true,sparse:false},
            naturalTailEndSeconds:naturalTailEnd,
            ending:{startSeconds:finalAt,holdSeconds:hold,releaseSeconds:release,dramaticFinalHit:true,organOnlySustained:false,ensembleHoldSeconds:ensembleHold}},
        render:{...score.render,seconds:durationSeconds}};
}
module.exports={extendFinale};
