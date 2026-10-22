(() => {
    function encode(samples, {leadingMilliseconds=180,trailingMilliseconds=2000}={}) {
        if (!(samples instanceof Float32Array) || samples.length<4000 || samples.length>480000 || samples.some(sample=>!Number.isFinite(sample))) throw new Error('Record between 0.25 and 30 seconds.');
        const leading=Math.round(16*leadingMilliseconds),trailing=Math.round(16*trailingMilliseconds);
        if (leading<0 || trailing<0 || leading+trailing>80000) throw new Error('Invalid recording padding.');
        const buffer=new ArrayBuffer(44+(leading+samples.length+trailing)*2),view=new DataView(buffer);
        const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
        text(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);
        view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,buffer.byteLength-44,true);
        for(let i=0;i<samples.length;i++){const sample=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+(leading+i)*2,Math.round(sample*(sample<0?32768:32767)),true);}
        return buffer;
    }
    globalThis.RecordingWave={encode};
    if(typeof module!=='undefined')module.exports={encode};
})();
