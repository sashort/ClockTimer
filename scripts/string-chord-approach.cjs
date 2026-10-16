// Four diatonic sixteenths approach a held chord from the incoming melody's side.
const pitchClasses={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function midi(note){const m=/^([A-G])(#|b)?(\d)$/.exec(note);return (Number(m[3])+1)*12+pitchClasses[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);}
function tone(value){return ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][value%12]+(Math.floor(value/12)-1);}
function approach(previous,target,{harmonicMinor=false,previousDirection=1}={}){
 const from=midi(previous),to=midi(target),direction=to===from?(previousDirection>=0?1:-1):Math.sign(to-from);
 const classes=[harmonicMinor?1:0,2,4,5,7,9,10];
 const scale=Array.from({length:100},(_,i)=>i+24).filter(n=>classes.includes(n%12));
 const index=scale.indexOf(to);if(index<4||index>scale.length-5)throw Error('Chord approach target outside supported scale');
 return {previous,target,direction:direction>0?'rise':'fall',notes:Array.from({length:4},(_,i)=>tone(scale[index-direction*(4-i)]))};
}
module.exports={approach,midi};
