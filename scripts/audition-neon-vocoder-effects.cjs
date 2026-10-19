// Per-instrument effects audition. Leave the shared preset and all other voices alone.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const input=process.argv[2],out=process.argv[3];if(!input||!out)throw Error('Pass input score and output directory');
const original=JSON.parse(fs.readFileSync(input)),score=structuredClone(original),voice=score.instruments['neon-bass'];
voice.distortion={...voice.distortion,amount:.16};
voice.delay={time:.065,feedback:.06,wet:.1};
assert.deepEqual(score.song,original.song,'notes, rhythm and phrasing unchanged');
for(const [id,instrument] of Object.entries(original.instruments))if(id!=='neon-bass')assert.deepEqual(score.instruments[id],instrument);
assert.equal(voice.volume,original.instruments['neon-bass'].volume);
score.audition={...score.audition,vocoderEffects:{saturation:.16,slapbackSeconds:.065,feedback:.06,wet:.1,volumeUnchanged:true}};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'vocoder-effects-score.json'),JSON.stringify(score,null,2));
console.log('PASS only vocoder saturation and slapback changed; notes and other instruments unchanged');
