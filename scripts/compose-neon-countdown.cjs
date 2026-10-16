// Original D-minor arrangement. No existing song or instrument is changed.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const {extend}=require('./neon-countdown-part-two.cjs');
const {extendFinale}=require('./neon-countdown-part-three.cjs');

function compose(catalog) {
    const instruments = {};
    function voice(name, source, volume, changes = {}) {
        instruments[name] = {...structuredClone(catalog.instruments[source]), volume, ...changes};
        return name;
    }
    const bass = voice('neon-bass', 'cinematic-robot-pulse', .48);
    const originalPulse = voice('neon-cinematic-pulse', 'cinematic-pulse-bass', .68);
    // Original backing layer predates the removed fantasy experiment.
    const backingPad = voice('neon-backing-pad', 'warm-chorus-poly', .36);
    const arp = voice('neon-arp', 'eighties-poly', .16, {
        envelope: {attack:.004, decay:.1, sustain:.2, release:.12},
        delay: {time:.1875, feedback:.28, wet:.22},
        filter: {type:'lowpass',frequency:2300,Q:1.1,envelopeAmount:2100}
    });
    const lead = voice('neon-lead', 'jx3p-inspired-lead', .56);
    const brass = voice('neon-brass', 'synth-brass-stab', .27);
    const bell = voice('neon-reference', 'cinematic-pulse-bass', .42);
    const kick = voice('neon-kick', 'easter-egg-eighties-kick', .95);
    const snare = voice('neon-snare', 'gated-snare', .58);
    const hat = voice('neon-hat', 'easter-egg-hiphop-hat', .19);
    const clap = voice('neon-clap', 'easter-egg-hiphop-clap', .26);
    const tom = voice('neon-tom', 'electro-tom', .5);
    const guitar='neon-guitar', guitarLead='neon-guitar-lead';
    const picked='neon-picked-electric';
    instruments[picked]={class:'expressive',type:'oscillator',displayName:'Clean Picked Electric Guitar',volume:.25,
        velocitySensitivity:.65,envelope:{attack:.002,decay:.25,sustain:.48,release:.65},
        samples:[{url:'api/audio/samples/neon-picked-electric-d3.wav',rootFrequency:146.8323839587038},
            {url:'api/audio/samples/neon-picked-electric-d4.wav',rootFrequency:293.6647679174076}],
        filter:{type:'lowpass',frequency:3600,Q:.45},
        chorus:{rate:.65,delay:.018,depth:.0018,wet:.18},
        reverb:{wet:.1,decay:1.3},variation:{seed:517,gain:.06,detuneCents:.8}};
    instruments[guitar]={class:'expressive',type:'oscillator',displayName:'80s Chorus Rhythm Guitar',volume:1.1,
        velocitySensitivity:.75,envelope:{attack:.002,decay:.12,sustain:.28,release:.08},
        samples:[{url:'api/audio/samples/neon-guitar-d3.wav',rootFrequency:146.8323839587038}],
        filter:{type:'lowpass',frequency:3700,Q:.6,envelopeAmount:600},
        chorus:{rate:.85,delay:.018,depth:.003,wet:.32},
        delay:{time:.1875,feedback:.18,wet:.09},reverb:{wet:.09,decay:.9}};
    instruments[guitarLead]={type:'oscillator',waveform:'triangle',volume:.12,velocitySensitivity:.8,
        envelope:{attack:.035,decay:.24,sustain:.8,release:.8},
        partials:[{ratio:1,gain:.55,waveform:'triangle',detune:-2},{ratio:1,gain:.25,waveform:'square',detune:2},{ratio:1,gain:.15,waveform:'sawtooth'},{ratio:2,gain:.05,waveform:'sine'}],
        filter:{type:'lowpass',frequency:1700,Q:.55,envelopeAmount:450},
        distortion:{amount:.12},chorus:{rate:.6,delay:.02,depth:.003,wet:.22},
        delay:{time:.25,feedback:.2,wet:.1},reverb:{wet:.12,decay:1.5}};
    const events = [];
    const add = (beat, tone, length, instrument, dynamic='mf') => events.push({
        offset:String(beat), tone, length:String(length), instrument, dynamic
    });
    const chords = [
        {bass:'D2', fifth:'A2', notes:['D3','F3','A3','C4'], high:['D4','F4','A4','C5']},
        {bass:'Bb1', fifth:'F2', notes:['Bb2','D3','F3','A3'], high:['D4','F4','A4','Bb4']},
        {bass:'F2', fifth:'C3', notes:['C3','F3','A3','C4'], high:['C4','F4','A4','C5']},
        {bass:'C2', fifth:'G2', notes:['C3','E3','G3','Bb3'], high:['E4','G4','Bb4','C5']}
    ];
    // Eight-bar hook: the first D5 recalls the Time reference tone.
    const hook = [
        [[0,'D5',.75],[1,'A4',.5],[1.75,'C5',.25],[2,'D5',1],[3.25,'F5',.5]],
        [[0,'E5',.75],[1,'D5',.5],[2,'A4',.75],[3,'F4',.75]],
        [[0,'F5',.75],[1,'D5',.5],[2,'C5',.5],[2.75,'A4',.75]],
        [[0,'Bb4',1],[1.5,'A4',.5],[2.5,'F4',.5],[3.25,'A4',.5]],
        [[0,'C5',.75],[1,'A4',.5],[1.75,'C5',.25],[2,'F5',1.5]],
        [[0,'E5',.5],[.75,'F5',.5],[1.5,'A5',.75],[2.75,'G5',.5],[3.5,'F5',.25]],
        [[0,'E5',.75],[1,'D5',.5],[2,'C5',.75],[3,'G4',.75]],
        [[0,'A4',.75],[1,'C5',.5],[2,'E5',.5],[2.75,'C#5/D5',.5],[3.5,'A4',.25]]
    ];
    for (let bar=0; bar<60; bar++) {
        const beat=bar*4;
        const intro=bar<4, verse=bar>=4&&bar<16, breakdown=bar>=32&&bar<40, outro=bar>=56;
        const chorus=!intro&&!verse&&!breakdown&&!outro;
        const chord = chords[Math.floor(bar/2)%4];
        // The last four bars return home rather than fading a random loop.
        const harmony=outro ? chords[0] : chord;
        for(const note of harmony.notes)add(beat,note,outro?3.7:3.8,backingPad,breakdown?'mp':'pp');
        // Clean electric picking sits between pulse accents, without distortion.
        const picking=intro||outro?[[.5,0,1.4],[2.5,2,1.2]]:
            breakdown?[[.5,0,1.2],[2.75,2,1]]:
            chorus?[[.5,0,.8],[1.25,2,.65],[1.75,1,.6],[2.25,3,.7],[3,2,.6],[3.5,1,.75]]:
            [[.5,0,1],[1.25,2,.8],[2.25,1,.85],[3.25,3,1]];
        for(const [index,[at,note,length]] of picking.entries())
            add(beat+at,harmony.notes[note],length,picked,intro||outro||breakdown?'p':index%3===0?'mf':'mp');
        if (intro) {
            // The requested four opening pulse notes use the original sound.
            add(beat,harmony.bass,3.7,bass,'p');
            if (bar>=2) for (let s=0;s<8;s++) add(beat+s*.5,harmony.high[[0,1,2,1,3,2,1,2][s]],.22,arp,'pp');
        } else if (!outro || bar<58) {
            const bassPhrases=[
                [[0,.7,0,'mf'],[1,.25,0,'mp'],[1.75,.2,1,'mp'],[2.5,.8,0,'mf'],[3.5,.3,1,'mp']],
                [[0,1.15,0,'mf'],[1.5,.32,1,'mp'],[2.25,.25,0,'mp'],[2.75,.65,0,'mf'],[3.75,.18,1,'p']],
                [[0,.3,0,'mf'],[.75,.45,0,'mp'],[1.5,.7,1,'mf'],[2.5,.25,0,'mp'],[3,.7,0,'mf']],
                [[0,.85,0,'mf'],[1.25,.2,1,'p'],[1.75,.3,0,'mp'],[2.5,.4,1,'mf'],[3.25,.5,0,'mp']]
            ];
            // Rejoin the established four-bar groove with the drums/arp at bar
            // 36. The former three-across-two-bars fills fought the straight beat.
            const phrase=breakdown&&bar<36?[[0,1.3,0,'p'],[2.75,.65,1,'pp']]:bassPhrases[bar%4];
            for(const [at,length,fifth,dynamic] of phrase)
                add(beat+at,fifth?harmony.fifth:harmony.bass,length,bass,outro?'p':dynamic);
            if (!breakdown || bar>=36) {
                const subdivisions=chorus?16:8;
                for (let s=0;s<subdivisions;s++) {
                    const pattern=[0,2,1,3,2,1,2,3];
                    add(beat+s*4/subdivisions,harmony.high[pattern[s%8]],.14,arp,chorus?'mp':'pp');
                }
            }
        }
        if (bar>=2 && !outro) {
            const sparse=breakdown&&bar<36;
            for (const k of sparse?[0]:[0,1.5,2,3.5]) add(beat+k,'C2',.16,kick,k===0?'f':'mf');
            if (!sparse) for (const s of [1,3]) {
                add(beat+s,'D3',.16,snare,'mf');
                if (chorus) add(beat+s+.025,'D3',.12,clap,'mp');
            }
            for (let s=0;s<(sparse?4:8);s++) add(beat+s*(sparse?1:.5),'F#5',.055,hat,s%2?'mp':'pp');
            if (bar%8===7 && !sparse) for (const [i,note] of ['A3','G3','F3','D3'].entries()) add(beat+3+i*.25,note,.18,tom,'mp');
        }
        if (verse && bar%2===0) {
            const phrase=hook[(bar-4)%8];
            for (const [at,note,length] of phrase.slice(0,3)) add(beat+at,note,length,lead,bar<8?'p':'mp');
        }
        if (chorus) {
            for (const [index,[at,note,length]] of hook[(bar-16)%8].entries())
                add(beat+at,note,length,lead,bar>=48&&index===0?'f':index%2?'mp':'mf');
            if (bar>=40 && bar%2===1) for (const note of harmony.high.slice(0,3)) add(beat+2.5,note,.38,brass,'mp');
            if (bar%4===0) for (const note of harmony.high.slice(0,3)) add(beat,note,.55,brass,'mp');
        }
        // The quieter middle eight is a literal call/answer, with rests between voices.
        if (breakdown) {
            const calls=[['D5','F5','A5'],['F5','A5','C6'],['C5','E5','G5'],['E5','C#5','D5']];
            const answers=[['A4','F4','D4'],['C5','A4','F4'],['G4','E4','C4'],['A4','C#5/D5','D5']];
            const phrase=(bar%2?answers:calls)[Math.floor((bar-32)/2)];
            phrase.forEach((note,index)=>add(beat+[.25,1.25,2.25][index],note,
                bar%2 ? index===2?1.15:.85 : index===2?.85:.5,
                bar%2?guitarLead:lead,bar%2?'p':index===2?'mp':'p'));
        }
        const power=[harmony.bass.replace(/\d$/,m=>String(Number(m)+1)),harmony.fifth.replace(/\d$/,m=>String(Number(m)+1))];
        if (verse) for(const at of [1.5,3.5]) power.forEach((note,index)=>add(beat+at+index*.012,note,.27,guitar,bar<8?'pp':'p'));
        if (chorus) {
            const strums=bar%2?[[0,.55],[1.5,.2],[2.25,.65],[3.25,.25]]:[[0,.6],[.75,.18],[1.5,.35],[2.5,.5],[3.5,.22]];
            for(const [at,length] of strums) power.forEach((note,index)=>add(beat+at+index*.012,note,length,guitar,bar>=40?'mp':'p'));
            if ([23,31,47,55].includes(bar)) {
                add(beat+.5,'A4/C5...','.55,.65',guitarLead,'p');
                add(beat+1.5,'D5',1.4,guitarLead,'p');
                add(beat+2.75,'C5\\A4...','.5,.75',guitarLead,'p');
            }
        }
        if (outro) {
            if (bar===56) add(beat,'F5',2,lead,'mp');
            if (bar===57) add(beat,'E5',1.5,lead,'mp');
            if (bar===58) add(beat,'D5',3.5,bell,'mp');
            if (bar===58) for(const note of ['D3','A3','D4']) add(beat,note,2.7,guitar,'p');
            if (bar===56||bar===58) add(beat,'D2',3.5,bass,'mp');
        }
    }
    // The main melody's 25 ms attack now reaches the beat rather than trailing it.
    for(const event of events)if(event.instrument===lead)event.offset=String(Number(event.offset)-.05);
    // Four soft 32nd-note pickups, just before two major transitions.
    for(const [bar,notes] of [[15,['F4','A4','C5','D5']],[39,['A4','C5','C#5','D5']]]) {
        const start=bar*4+3.5;
        for(let index=events.length-1;index>=0;index--) {
            const event=events[index];
            if(event.instrument===arp && Number(event.offset)>=start && Number(event.offset)<bar*4+4)events.splice(index,1);
        }
        notes.forEach((note,index)=>add(start+index/8,note,.07,arp,index===2?'p':'pp'));
    }
    events.sort((a,b)=>Number(a.offset)-Number(b.offset));
    const pulseNotes=events.filter(event=>event.instrument===bass);
    const originalNotes=[...pulseNotes.slice(0,4),pulseNotes.at(-1)];
    for(const event of originalNotes)event.instrument=originalPulse;
    return extendFinale(extend({title:'Neon Countdown', key:'D minor', durationSeconds:120,
        sections:[['Intro',0,8],['Verse',8,32],['Chorus',32,64],['Breakdown',64,80],['Final chorus',80,112],['Outro',112,120]],
        revision:6, leadAdvanceMs:25, bassTripletPhrases:[],
        grooveRepair:{phraseSeconds:[[24,32],[72,80]],bassReentrySeconds:72,subdivisionBeats:.25},
        fantasyPadRemoved:true,
        backingPad:{part:1,instrument:backingPad,source:'warm-chorus-poly'},
        partOnePulse:{source:'cinematic-robot-pulse',instruments:[bass],
            originalPulseInstrument:originalPulse,originalPulseSeconds:originalNotes.map(event=>Number(event.offset)/2),
            closingReferenceInstrument:bell},
        partOneInstrumentation:'Pre-fantasy backing, melody, arp, brass, guitars and drums; retain current vocoder passages and add clean picked electric',
        partOneBalance:{vocoderGain:.48,pickedElectricGain:.25,warmPadGain:.36,originalLayersPreserved:true},
        pickedElectricGuitar:{part:1,instrument:picked,sourceScript:'scripts/synthesize-neon-picked-electric.cjs'},
        callAndAnswerSeconds:[64,80],
        transitionPickups:{bars:[15,39],beatStep:1/8,notesPerRun:4,noteLength:.07},
        instruments, song:{bpm:120,instrument:bass,events},
        render:{sampleRate:48000,channels:2,seconds:120,fadeOutSeconds:2,peakTarget:.85}},catalog),catalog);
}
module.exports={compose};
if(require.main===module) {
    const score=compose(JSON.parse(fs.readFileSync(path.join(root,'api/audio/catalog.json'),'utf8')));
    fs.writeFileSync(path.join(root,'api/audio/instruments/neon-countdown-score.json'),JSON.stringify(score,null,2)+'\n');
    console.log(`Composed ${score.song.events.length} events; ${score.durationSeconds}s, ${score.key}.`);
}
