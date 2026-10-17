// Part II: slow C-sharp-minor pulse, broad phrases and low-register textures.
const bellLibrary=require('../api/audio/instruments/vcsl-tubular-bells.json');
function extend(score,catalog) {
    const {instruments,song}=score,events=song.events;
    const tempo=64,beat=60/tempo,barSeconds=beat*4,bars=40;
    const start=120,shift=start-120,firstNoteHold=barSeconds*.94;
    const windStart=116,windAttack=1.5,windDuration=Number((start+firstNoteHold-windStart).toFixed(6)),quietBeats=1;
    // Let the closing ensemble finish before the longer, unpitched transition.
    for(let i=events.length-1;i>=0;i--)if(Number(events[i].offset)/2>116)events.splice(i,1);
    for(const event of events)if(Number(event.offset)/2===116)event.length=String(Math.min(Number(event.length),event.instrument===score.backingPad.instrument?2:3));
    const clone=(name,source,volume,changes={})=>{
        instruments[name]={...structuredClone(catalog.instruments[source]),volume,...changes};return name;
    };
    const pulse=clone('midnight-pulse','cinematic-pulse-bass',1.6,{
        envelope:{attack:.025,decay:.5,sustain:.86,release:.5},
        filter:{type:'lowpass',frequency:650,Q:.65,envelopeAmount:850},
        distortion:{amount:.045},delay:{time:.46875,feedback:.12,wet:.055},reverb:{wet:.08,decay:2.2}});
    const pulseChord=clone('midnight-pulse-chord','cinematic-pulse-bass',.88,{
        partials:structuredClone(catalog.instruments['cinematic-pulse-bass'].partials.filter(partial=>partial.ratio>=1)),
        envelope:{attack:.065,decay:.55,sustain:.84,release:1.05},
        filter:{type:'lowpass',frequency:1250,Q:.6,envelopeAmount:650},
        reverb:{wet:.16,decay:2.4},delay:{time:.46875,feedback:.14,wet:.07}});
    const pad=clone('midnight-pad','warm-chorus-poly',.25,{
        envelope:{attack:1.5,decay:1,sustain:.68,release:2.2},
        filter:{type:'lowpass',frequency:950,Q:.6,envelopeAmount:350},
        reverb:{wet:.24,decay:3.2},delay:{time:.9375,feedback:.16,wet:.08}});
    const organ='midnight-organ';
    instruments[organ]={type:'oscillator',waveform:'sine',volume:2,velocitySensitivity:.6,
        envelope:{attack:.035,decay:.3,sustain:.92,release:1.8},
        partials:[{ratio:1,gain:.42,waveform:'sine'},{ratio:2,gain:.25,waveform:'sine'},
            {ratio:3,gain:.16,waveform:'sine'},{ratio:4,gain:.1,waveform:'sine'},
            {ratio:6,gain:.065,waveform:'sine'},{ratio:8,gain:.04,waveform:'sine'},
            {ratio:.5,gain:.1,waveform:'sine'}],
        filter:{type:'lowpass',frequency:3200,Q:.45},tremolo:{rate:5.4,depth:.09},
        chorus:{rate:.65,delay:.025,depth:.002,wet:.2},reverb:{wet:.16,decay:2.5}};
    const ghost=clone('midnight-ghost','dark-breathy-reed',.13,{
        envelope:{attack:.3,decay:.6,sustain:.72,release:1.8},
        filter:{type:'lowpass',frequency:1700,Q:.65,envelopeAmount:300},
        delay:{time:.9375,feedback:.24,wet:.15},reverb:{wet:.22,decay:3}});
    const kick=clone('midnight-kick','easter-egg-eighties-kick',.6,{
        filter:{type:'lowpass',frequency:700,Q:.55,envelopeAmount:250},
        reverb:{wet:.11,decay:1.2}});
    const tom=clone('midnight-tom','electro-tom',.22,{
        envelope:{attack:.008,decay:.4,sustain:.05,release:.55},
        filter:{type:'lowpass',frequency:1200,Q:.7,envelopeAmount:400},reverb:{wet:.2,decay:2}});
    const wind='midnight-wind';
    instruments[wind]={class:'expressive',type:'oscillator',volume:.85,velocitySensitivity:0,
        envelope:{attack:0,decay:0,sustain:1,release:.1},
        samples:[{url:'api/audio/samples/neon-wind.wav',rootFrequency:261.6255653005986,naturalDecay:true}]};
    const bells='midnight-tubular-bells';
    // Recorded strikes own their full decay; written gates never stop them.
    instruments[bells]={class:'expressive',type:'oscillator',displayName:'Recorded Tubular Bells (VCSL)',
        volume:1.2,velocitySensitivity:.7,envelope:{attack:0,decay:0,sustain:1,release:0},
        samples:structuredClone(bellLibrary.samples),reverb:{wet:.1,decay:2.8}};
    const gridSeconds=beat/4;
    const snap=seconds=>start+Math.round((seconds-start)/gridSeconds)*gridSeconds;
    const add=(seconds,tone,secondsLength,instrument,dynamic='mp')=>events.push({
        offset:String(seconds*2),tone,
        length:String(secondsLength*2),instrument,dynamic});
    // Wind holds through the pitched rest; its decay starts with the first slow note.
    add(windStart,'C4',windDuration,wind,'mp');
    const chords=[
        {root:'C#2',fifth:'G#2',notes:['C#3','E3','G#3','B3']},
        {root:'A1',fifth:'E2',notes:['A2','C#3','E3','G#3']},
        {root:'F#1',fifth:'C#2',notes:['F#2','A2','C#3','E3']},
        {root:'G#1',fifth:'D#2',notes:['G#2','C3','D#3','F#3']}
    ];
    const motif=[['C#4','G#3','E4'],['E4','C#4','B3'],['A3','C#4','E4'],['D#4','C4','C#4']];
    for(let bar=0;bar<bars;bar++) {
        const at=start+bar*barSeconds,chord=bar>=38?
            {root:'A1',fifth:'E2',notes:['A2','C#3','E3','G3']}:chords[Math.floor(bar/4)%4];
        const intro=bar<4,ending=bar>=36,central=bar>=12&&bar<28;
        for(const note of bar===39?['A2','E3','A3']:chord.notes)add(at,note,barSeconds*.97,pad,intro?'pp':ending?'pp':'p');
        // Recognizable syncopated pulse, expanded to the slower beat; no high arp.
        const patterns=[
            [[0,0],[1.5,1],[2.25,0]],
            [[0,0],[1.75,1],[2.75,0]],
            [[0,0],[1.25,0],[2.5,1]],
            [[0,0],[2.25,1]]
        ];
        let phrase=patterns[bar%4];
        if(intro)phrase=[[0,0]];
        if(ending)phrase=[[0,0]];
        for(const [index,[position,fifth]] of phrase.entries()) {
            const nextPosition=phrase[index+1]?.[0]??4;
            // Hold nearly to the next attack instead of gating each pulse short.
            const heldBeats=(nextPosition-position)*.94;
            add(at+position*beat,fifth?chord.fifth:chord.root,heldBeats*beat,pulse,intro?'mp':central?'f':'mf');
        }
        if(bar>=4&&bar%4===2) {
            // Voice chords above the single-note bass; remove the sub partial to keep space.
            for(const note of chord.notes.slice(0,3)) {
                const upper=note.replace(/\d$/,octave=>String(Number(octave)+1));
                add(at+beat*(ending?1.5:1.25),upper,beat*3.5,pulseChord,central?'f':'mf');
            }
        }
        if(!intro&&!ending) {
            add(at,'C2',.22,kick,central?'mp':'p');
            if(bar%2===0)add(at+2.5*beat,'C2',.18,kick,'p');
            if(bar%4===3)for(const [i,note] of ['F#2','C#2'].entries())add(at+(2.5+i*.75)*beat,note,.45,tom,'pp');
        }
        if(bar%4===0&&bar>=4)for(const note of chord.notes.slice(0,3))add(at+beat,note,beat*5.5,organ,central?'ff':'f');
        if(bar%4===1&&bar>=5&&bar<36) {
            const phrase=motif[Math.floor(bar/4)%4];
            add(at+beat*.5,phrase[0],beat*2.5,ghost,'pp');
            add(at+beat*3.25,phrase[1],beat*2.5,ghost,'pp');
            add(at+barSeconds+beat*2,phrase[2],beat*3,ghost,'p');
        }
        if(bar===36)for(const note of ['C#3','E3','G#3'])add(at,note,barSeconds*3.2,organ,'f');

    }

    // Longer melodic statements follow the current harmony, with space between
    // phrases. Positions are slow-tempo beats, not arbitrary millisecond fills.
    const bellPhrases=[
        [128,[[0,'C#4'],[1.5,'E4'],[3.5,'G#4'],[5,'E4']]],
        [138.75,[[0,'A3'],[2,'C#4'],[5,'E4']]],
        [150,[[0,'F#3'],[1.5,'A3'],[3.5,'C#4'],[5,'E4']]],
        [165,[[0,'G#3'],[2,'C4'],[3.5,'D#4'],[5.5,'F#4']]],
        [180,[[0,'E4'],[1.5,'G#4'],[3,'C#5'],[5,'B4'],[7,'G#4']]],
        [195,[[0,'C#4'],[2,'E4'],[3.5,'A4'],[6,'E4']]],
        [210,[[0,'F#3'],[1.5,'A3'],[3.5,'C#4'],[6,'G#4']]],
        [225,[[0,'G#3'],[2,'D#4'],[4,'C4'],[6,'G#3']]],
        [240,[[0,'C#4'],[1.5,'E4'],[3.5,'G#4'],[5,'C#5'],[7,'E4']]],
        [255,[[0,'E4'],[2,'A3']]]
    ];
    const bellStrikes=[];
    for(const [start,phrase] of bellPhrases)for(const [index,[position,note]] of phrase.entries()) {
        const onGrid=snap(start+shift+position*beat);
        const pulseTimes=events.filter(event=>event.instrument===pulse).map(event=>Number(event.offset)/2);
        const nearest=pulseTimes.reduce((best,time)=>Math.abs(time-onGrid)<Math.abs(best-onGrid)?time:best);
        const at=Math.abs(nearest-onGrid)<=gridSeconds+1e-8?nearest:onGrid;
        bellStrikes.push([at,note]);
        add(at,note,3.5,bells,index===0?'ff':'f');
    }
    // Spacious organ responses after selected bell strikes; leave the pulse clear.
    const organAnswers=[[130.5,['C#3','E3','G#3']],[152.5,['F#3','A3','C#4']],
        [197.5,['A2','C#3','E3']],[242.5,['C#3','E3','G#3']]];
    for(const [at,notes] of organAnswers)for(const note of notes)add(snap(at+shift),note,4,organ,'ff');
    const frequency=note=>{
        const match=/^([A-G])(#|b)?(\d)$/.exec(note);
        const semitone={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[match[1]]+(match[2]==='#'?1:match[2]==='b'?-1:0);
        return 440*2**(((Number(match[3])+1)*12+semitone-69)/12);
    };
    const naturalBellEnd=Math.max(...bellStrikes.map(([at,note])=>{
        const hz=frequency(note);
        const nearest=Math.min(...bellLibrary.samples.map(sample=>Math.abs(Math.log2(hz/sample.rootFrequency))));
        const candidates=bellLibrary.samples.filter(sample=>Math.abs(Math.abs(Math.log2(hz/sample.rootFrequency))-nearest)<1e-8);
        return at+Math.max(...candidates.map(sample=>sample.durationSeconds/(hz/sample.rootFrequency)));
    }));
    // Recorded tails overlap the next part without delaying its downbeat.
    const musicEnd=start+bars*barSeconds;
    const durationSeconds=musicEnd+5;
    const finalStart=musicEnd-beat,finalHold=beat*6,finalRelease=.65;
    const finalBass='midnight-final-bass',finalPulse='midnight-final-pulse';
    instruments[finalBass]={...structuredClone(instruments[pulse]),envelope:{attack:.025,decay:.5,sustain:.75,release:finalRelease}};
    instruments[finalPulse]={...structuredClone(instruments[pulseChord]),envelope:{attack:.065,decay:.55,sustain:.8,release:finalRelease}};
    add(finalStart,'A1',finalHold,finalBass,'f');
    for(const note of ['A2','E3','A3']) {
        add(finalStart,note,finalHold,finalPulse,'f');
    }
    events.sort((a,b)=>Number(a.offset)-Number(b.offset));
    return {...score,title:'Neon Countdown / Midnight Passage',revision:52,durationSeconds,
        sections:[...score.sections,['Wind transition',windStart,windStart+windDuration],['Wind-only slow-tempo breath',start-quietBeats*beat,start],['Part II: shadow pulse',start,135+shift],
            ['Part II: midnight procession',135+shift,165+shift],['Part II: haunted hall',165+shift,195+shift],
            ['Part II: deepening pulse',195+shift,225+shift],['Part II: return',225+shift,255+shift],['Part II: sustained handoff',255+shift,durationSeconds]],
        partTwo:{startSeconds:start,durationSeconds:durationSeconds-start,bpm:tempo,key:'C# minor',bars,
            windTransition:[windStart,windStart+windDuration],
            windCrescendo:{startSeconds:windStart,fullLevelSeconds:windStart+windAttack,matchedPartOneHoldSeconds:windAttack},
            entranceRest:{startSeconds:start-quietBeats*beat,endSeconds:start,beats:quietBeats,bpm:tempo,windContinues:true},
            windOverlap:{firstNoteSeconds:start,secondNoteSeconds:start+barSeconds,decayStartSeconds:start,decayEndSeconds:windStart+windDuration,matchedNoteHoldSeconds:firstNoteHold},lastPartOneAttackSeconds:116,noPluckedArpeggio:true,pulseChordVoicings:true,
            tubularBells:{strikeSeconds:bellStrikes.map(([at])=>at),longRingingTails:true,
                phraseStartSeconds:bellPhrases.map(([at])=>snap(at+shift)),sampleLibrary:bellLibrary.source,
                naturalDecay:true,naturalEndSeconds:naturalBellEnd},
            organ:{foreground:true,answerSeconds:organAnswers.map(([at])=>snap(at+shift))},
            tempoChange:{atSeconds:durationSeconds,fromBpm:64,toBpm:120,mode:'immediate',sustainedHandoff:true},
            ending:{startSeconds:finalStart,holdSeconds:finalHold,releaseSeconds:finalRelease,key:'A/E sustained into D minor',
                instruments:[finalBass,finalPulse],closingWind:false,flowsIntoPartThree:true}},
        render:{...score.render,seconds:durationSeconds,fadeOutSeconds:.035,preservePartOneLevel:true}};
}
module.exports={extend};
