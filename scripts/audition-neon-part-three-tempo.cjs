// Retiming score events changes tempo without changing recorded-note pitches.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'tests/artifacts/neon-tempo-auditions'));
const source = JSON.parse(fs.readFileSync(path.join(root, 'api/audio/instruments/neon-countdown-score.json'), 'utf8'));
const start = source.partThree.startSeconds, excerptSeconds = 36;
fs.mkdirSync(out, {recursive:true});
const bpms = process.argv.slice(3).length ? process.argv.slice(3).map(Number) : [108, 100];
if (bpms.some(bpm => !Number.isFinite(bpm) || bpm < 40 || bpm > 200)) throw Error('Choose a BPM between 40 and 200');
for (const bpm of bpms) {
    const ratio = source.partThree.bpm / bpm;
    const selected = source.song.events.filter(event => Number(event.offset)/2 >= start && Number(event.offset)/2 < start + excerptSeconds);
    const events = selected.map(event => ({...event, offset:String((Number(event.offset)/2-start)*ratio*2), length:String(Number(event.length)*ratio)}));
    const used = new Set(events.map(event => event.instrument));
    const instruments = Object.fromEntries(Object.entries(source.instruments).filter(([name]) => used.has(name)));
    const durationSeconds = Math.ceil(excerptSeconds*ratio+4);
    const score = {title:'Neon Countdown Part III — '+bpm+' BPM audition', key:source.partThree.key,
        revision:source.revision, durationSeconds, instruments,
        song:{...source.song, instrument:events[0].instrument, events},
        // Engine grid remains 120 BPM; every offset and gate is converted above.
        audition:{sourceBpm:source.partThree.bpm,bpm,sourceStartSeconds:start,sourceLengthSeconds:excerptSeconds,pitchPreserved:true},
        partThree:{startSeconds:0,bpm,ending:{startSeconds:excerptSeconds*ratio,holdSeconds:0}},
        sections:[['Part III tempo audition',0,durationSeconds]],
        render:{...source.render,seconds:durationSeconds,preservePartOneLevel:false,fadeOutSeconds:.035}};
    fs.writeFileSync(path.join(out,'part-three-'+bpm+'-score.json'),JSON.stringify(score,null,2)+'\n');
    if(events.some((event,index)=>event.tone!==selected[index].tone))throw Error('Pitch changed');
    console.log(bpm+' BPM: '+events.length+' events, '+durationSeconds+' seconds, pitches preserved');
}
