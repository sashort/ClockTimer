// Linear tempo change in musical beats, integrated to continuous audio time.
class BeatTempoRamp {
    constructor({startSeconds,startBpm,endBpm,beats}) {
        if(![startSeconds,startBpm,endBpm,beats].every(Number.isFinite)||startBpm<=0||endBpm<=0||beats<=0)
            throw new RangeError('A tempo ramp requires positive tempo and beat length');
        Object.assign(this,{startSeconds,startBpm,endBpm,beats});
        this.slope=(endBpm-startBpm)/beats;
    }
    secondsAtBeat(beat) {
        if(beat<0)return this.startSeconds+beat*60/this.startBpm;
        const inside=Math.min(beat,this.beats);
        const elapsed=Math.abs(this.slope)<1e-12?inside*60/this.startBpm:
            60/this.slope*Math.log((this.startBpm+this.slope*inside)/this.startBpm);
        return this.startSeconds+elapsed+Math.max(0,beat-this.beats)*60/this.endBpm;
    }
    mapOriginalSeconds(seconds) {
        return this.secondsAtBeat((seconds-this.startSeconds)*this.startBpm/60);
    }
    get endSeconds(){return this.secondsAtBeat(this.beats);}
}
module.exports={BeatTempoRamp};
