/* Conservative replay positioning; never moves the semantic commit boundary. */
(() => {
    'use strict';
    class SpeechBoundaryAnalyzer {
        #destination;
        constructor({sampleRate=16000,minimumOverlapMilliseconds=120,maximumLookbackMilliseconds=300,
            frameMilliseconds=5,quietRms=.008}={}) {
            if(![sampleRate,frameMilliseconds].every(v=>Number.isFinite(v)&&v>0) ||
                !Number.isFinite(minimumOverlapMilliseconds)||minimumOverlapMilliseconds<0 ||
                !Number.isFinite(maximumLookbackMilliseconds)||maximumLookbackMilliseconds<minimumOverlapMilliseconds ||
                !Number.isFinite(quietRms)||quietRms<0)throw RangeError('Invalid audio boundary analysis configuration.');
            this.minimum=Math.ceil(sampleRate*minimumOverlapMilliseconds/1000);
            this.maximum=Math.ceil(sampleRate*maximumLookbackMilliseconds/1000);
            this.frame=Math.max(1,Math.round(sampleRate*frameMilliseconds/1000));this.quietRms=quietRms;
        }
        get hasDestination(){return this.#destination!==undefined;}
        setDestination(destination){
            if(destination==null)throw TypeError('A handoff destination is required.');
            if(this.hasDestination)throw Error('A handoff destination is already pending.');
            this.#destination=destination;
        }
        cancel(){this.#destination=undefined;}
        async handoff(buffer,boundarySample,transfer){
            if(!this.hasDestination)return undefined;
            // Claim once before any asynchronous transfer; reentrant callbacks
            // cannot take the same destination a second time.
            const destination=this.#destination;this.#destination=undefined;
            if(typeof transfer!=='function')throw TypeError('A local audio transfer callback is required.');
            const positioning=this.locate(buffer,boundarySample);
            await transfer(destination,positioning);
            return positioning;
        }
        locate(buffer,boundarySample) {
            if(!Number.isSafeInteger(boundarySample)||boundarySample<buffer.start||boundarySample>buffer.end)
                throw RangeError('Audio boundary is outside retained PCM.');
            const latest=Math.max(buffer.start,boundarySample-this.minimum);
            const earliest=Math.max(buffer.start,boundarySample-this.maximum);
            const samples=buffer.read(earliest,latest);
            let run=0;
            // Find the latest sustained quiet region before the mandatory overlap.
            for(let end=samples.length;end>=this.frame;end-=this.frame){
                let sum=0;for(let i=end-this.frame;i<end;i++)sum+=samples[i]*samples[i];
                if(Math.sqrt(sum/this.frame)<=this.quietRms)run++;else run=0;
                if(run>=3)return {boundarySample,replayStartSample:earliest+end-this.frame,reason:'quiet-context',analyzedSamples:samples.length};
            }
            return {boundarySample,replayStartSample:latest,reason:'conservative-overlap',analyzedSamples:samples.length};
        }
    }
    globalThis.SpeechBoundaryAnalyzer=SpeechBoundaryAnalyzer;
})();
