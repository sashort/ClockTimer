// Convert only the finale's authored timing; pitches and sample playback rates
// remain unchanged. Natural sample/reverb tails are measured in real seconds.
function retimeFinale(source, bpm) {
    if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError('Positive finale BPM required');
    const score = structuredClone(source), start = score.partThree.startSeconds;
    const ratio = score.partThree.bpm / bpm;
    const time = value => start + (value-start)*ratio;
    for (const event of score.song.events) if (Number(event.offset)/2 >= start) {
        event.offset = String(time(Number(event.offset)/2)*2);
        event.length = String(Number(event.length)*ratio);
    }
    const absolute = new Set(['startSeconds','atSeconds','entrySeconds','lastStrikeSeconds']);
    const durations = new Set(['holdSeconds','ensembleHoldSeconds','openingHoldSeconds']);
    function metadata(value) {
        if (Array.isArray(value)) return value.map(metadata);
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,
            typeof item === 'number' && absolute.has(key) ? time(item) :
            typeof item === 'number' && durations.has(key) ? item*ratio : metadata(item)]));
    }
    score.partThree = metadata(score.partThree);
    score.partThree.startSeconds = start;
    score.partThree.bpm = bpm;
    score.partThree.authoredBpm = source.partThree.bpm;
    score.partTwo.tempoChange.toBpm = bpm;
    const frequency = note => {
        const m=/^([A-G])(#|b)?(\d)$/.exec(note);
        return 440*2**((((Number(m[3])+1)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0))-69)/12);
    };
    const naturalEnd = event => {
        const voice=score.instruments[event.instrument],samples=voice.samples;
        if (!samples?.every(sample=>sample.naturalDecay)) return 0;
        const hz=frequency(event.tone),nearest=Math.min(...samples.map(s=>Math.abs(Math.log2(hz/s.rootFrequency))));
        return Number(event.offset)/2+Math.max(...samples.filter(s=>Math.abs(Math.abs(Math.log2(hz/s.rootFrequency))-nearest)<1e-8)
            .map(s=>s.durationSeconds/(hz/s.rootFrequency)))+(voice.reverb?.decay||0);
    };
    const finale=score.song.events.filter(e=>Number(e.offset)/2>=start);
    score.partThree.naturalTailEndSeconds=Math.max(...finale.map(naturalEnd));
    score.partThree.bells.naturalEndSeconds=Math.max(...finale.filter(e=>e.instrument==='finale-bells').map(naturalEnd));
    const ending=score.partThree.ending;
    score.durationSeconds=Math.ceil(Math.max(ending.startSeconds+ending.holdSeconds+ending.releaseSeconds+1,
        score.partThree.naturalTailEndSeconds,score.partTwo.tubularBells.naturalEndSeconds+2.8));
    score.partThree.durationSeconds=score.durationSeconds-start;
    score.sections=score.sections.map(([name,from,to])=>[name,from>=start?time(from):from,to>start?time(to):to]);
    score.sections.at(-1)[2]=score.durationSeconds;
    score.render.seconds=score.durationSeconds;
    return score;
}
module.exports={retimeFinale};
