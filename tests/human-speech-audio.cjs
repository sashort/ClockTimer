const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function loadHumanClip({directory,locale,delivery,text}){
 if(!/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/i.test(locale)||!['fast','medium'].includes(delivery))throw Error('Invalid recording language or delivery');
 const folder=path.join(directory,locale.toLowerCase(),delivery),id=hash(locale.toLowerCase()+'\n'+text),file=path.join(folder,id+'.json');
 if(!fs.existsSync(file))throw Error(`Missing human recording: ${locale} / ${delivery} / "${text}". Record and save this prompt before running human voice tests.`);
 const metadata=JSON.parse(fs.readFileSync(file,'utf8'));
 if(metadata.source!=='human'||metadata.text!==text||metadata.locale!==locale.toLowerCase()||metadata.delivery!==delivery||metadata.phraseId!==id||!(/^[a-f0-9]{64}$/).test(metadata.sha256))throw Error('Human recording metadata does not match the requested prompt');
 const wav=fs.readFileSync(path.join(folder,metadata.sha256+'.wav'));
 if(hash(wav)!==metadata.sha256||wav.length<44||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,16)!=='WAVEfmt '||wav.readUInt16LE(20)!==1||wav.readUInt16LE(22)!==1||wav.readUInt32LE(24)!==16000||wav.readUInt16LE(34)!==16||wav.readUInt32LE(40)!==wav.length-44)throw Error('Human WAV checksum or PCM format does not match');
 return {wav,sha256:metadata.sha256,durationMilliseconds:(wav.length-44)/32000*1000,source:'human'};
}
module.exports={loadHumanClip};
