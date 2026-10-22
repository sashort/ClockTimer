class RecordingCapture extends AudioWorkletProcessor {
    constructor(){super();this.active=true;this.port.onmessage=event=>{if(event.data==='stop'){this.active=false;this.port.postMessage({stopped:true});}};}
    process(inputs){if(this.active&&inputs[0]?.[0])this.port.postMessage(inputs[0][0].slice());return true;}
}
registerProcessor('recording-capture',RecordingCapture);
