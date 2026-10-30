// Build seasonal arrangements from the approved cues and existing instruments.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const score=read('api/audio/instruments/neon-countdown-score.json'),cues=read('api/audio/instruments/halloween-event-cues.json');
const first=score.song.events.filter(e=>e.instrument==='finale-pulse').sort((a,b)=>Number(a.offset)-Number(b.offset)).slice(0,5);
const opening=score.song.events.filter(e=>e.instrument==='finale-opening-horror-strings'),at=Math.min(...opening.map(e=>Number(e.offset))),chord=opening.filter(e=>Number(e.offset)===at);
const onsets=[...new Set(score.song.events.map(e=>Number(e.offset)))].sort((a,b)=>a-b).slice(-5),cut=onsets[0];
const instruments={'halloween-pulse':score.instruments['finale-pulse'],'halloween-opening-strings':score.instruments['finale-opening-horror-strings']},songs={};
function arrangement(events,definitions,prefix){return events.map(e=>{const name=prefix+e.instrument;instruments[name]=definitions[e.instrument];return {...e,instrument:name};});}
// The former start (the score's final five onsets) is now the end cue.
const endEvents=arrangement(score.song.events.filter(e=>Number(e.offset)>=cut).map(e=>({...e,offset:String(Number(e.offset)-cut)})),score.instruments,'halloween-score-');
const pulse=first.slice(0,4),fourth=pulse[3],entry=score.partThree.startSeconds*score.song.bpm/60;
const gateEnd=Number(fourth.offset)+Number(fourth.length);
const startEvents=arrangement(score.song.events.filter(e=>Number(e.offset)>=entry&&Number(e.offset)<gateEnd-1e-8).map(e=>({...e,offset:String(Number(e.offset)-entry)})),score.instruments,'halloween-score-');
const stringIds=['halloween-score-finale-violins','halloween-score-finale-opening-horror-strings'];
const stringEnd=Math.max(...startEvents.filter(e=>stringIds.includes(e.instrument)).map(e=>(Number(e.offset)+Number(e.length))*60/score.song.bpm+instruments[e.instrument].envelope.release));
const heldId='halloween-start-held-pulse';
instruments[heldId]=structuredClone(score.instruments['finale-pulse']);
instruments[heldId].envelope.release=stringEnd-(gateEnd-entry)*60/score.song.bpm;
const last=startEvents.find(e=>e.instrument==='halloween-score-finale-pulse'&&Math.abs(Number(e.offset)-(Number(fourth.offset)-entry))<1e-8);
last.instrument=heldId;
for(const name of ['trip-started','trip-started-early','trip-started-late'])songs[name]={bpm:score.song.bpm,instrument:startEvents[0].instrument,events:startEvents,
 seasonalSpeechStartBeat:Number(fourth.offset)-entry,releaseSync:{instrument:heldId,referenceInstruments:stringIds},seasonalGain:.45};
songs['trip-ended']={bpm:score.song.bpm,instrument:endEvents[0].instrument,events:endEvents,seasonalSpeechStartSeconds:2,seasonalGain:.45};
instruments['halloween-keypad-bell']=score.instruments['finale-bells'];
songs['keypad-open']={bpm:120,instrument:'halloween-keypad-bell',seasonalGain:.45,events:[{offset:'0',tone:'D4',length:'1',instrument:'halloween-keypad-bell',dynamic:'ff'}]};
const aliases={
 '01-break-start':['break-started','short-break-started','lunch-started','lunch-clock-out'],
 '02-resume-break':['trip-resumed-early','trip-resumed-automatically','trip-resumed-after-break','lunch-clock-in'],
 '03-down-start':['down-time-started'],'04-resume-down':['trip-resumed-from-down'],
 '05-goal-missed':['goal-failed'],'06-setting-on':['setting-on'],'07-setting-off':['setting-off'],
 '08-setting-unchanged':['setting-unchanged'],'09-goal-view-change':['scope-change'],
 '10-mic-on':['microphone-activated'],'11-mic-off':['microphone-deactivated'],
 '12-speech-rejected':['speech-rejected'],'13-drop-in-message':['observer-message']};
for(const cue of cues.cues){const events=arrangement(cue.events,cues.instruments,'halloween-cue-');const gain=cues.reports.find(r=>r.id===cue.id&&r.speed===1).gain;for(const name of aliases[cue.id])songs[name]={bpm:120,instrument:events[0].instrument,events,seasonalGain:gain};}
fs.writeFileSync(path.join(root,'api/audio/halloween.json'),JSON.stringify({instruments,songs,touchtones:{notes:first.map(e=>e.tone),pulseGain:.4,attackSeconds:.008,releaseSeconds:score.instruments['finale-pulse'].envelope.release,timeoutSeconds:1},opening:{cue:'keypad-open',instrument:'halloween-keypad-bell',note:'D4',naturalDecay:true}},null,2)+'\n');
console.log('Built '+Object.keys(songs).length+' Halloween event mappings, bell opening and beat-aligned four-note start cue.');
