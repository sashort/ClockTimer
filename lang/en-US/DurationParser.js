class EnglishDurationParser {
    static #small = Object.freeze({zero:0,oh:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19});
    static #tens = Object.freeze({twenty:20,thirty:30,forty:40,fifty:50});

    static parse(value) {
        let text = String(value ?? "").toLocaleLowerCase("en-US").trim().replace(/[-–—]/g," ").replace(/\band\b/g," ").replace(/\s+/g," ");
        if (!text) return undefined;
        const clock = text.match(/^(?:(\d+):)?([0-5]?\d):([0-5]?\d)$/);
        if (clock) {
            const hours = Number(clock[1] || 0);
            const minutes = Number(clock[2]);
            const seconds = Number(clock[3]);

            return ((hours * 60 + minutes) * 60 + seconds) * 1000;
        }

        // Bare digit runs use the same right-to-left duration semantics as
        // the number pad: ss, m:ss, mm:ss, h:mm:ss.
        if (/^\d+$/.test(text) && text.length >= 3) {
            const seconds = Number(text.slice(-2));
            const minutes =
                text.length <= 4
                    ? Number(text.slice(0, -2))
                    : Number(text.slice(-4, -2));
            const hours =
                text.length <= 4
                    ? 0
                    : Number(text.slice(0, -4));

            if (
                seconds <= 59 &&
                minutes <= 59
            ) {
                return (
                    (
                        hours * 3600 +
                        minutes * 60 +
                        seconds
                    ) *
                    1000
                );
            }

            return undefined;
        }

        let seconds = 0, matched = false;
        const units = /(.+?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)(?=\s|$)/g;
        let match;
        while ((match=units.exec(text))!==null) {
            const amount=EnglishDurationParser.#number(match[1].trim());
            if (!Number.isFinite(amount)) return undefined;
            matched=true;
            if (/^(?:hours?|hrs?)$/.test(match[2])) seconds+=amount*3600;
            else if (/^(?:minutes?|mins?)$/.test(match[2])) seconds+=amount*60;
            else seconds+=amount;
        }
        if (matched) return seconds>0?seconds*1000:undefined;

        const pieces=text.split(" ");
        for(let split=1;split<pieces.length;split++){
            const hours=EnglishDurationParser.#number(pieces.slice(0,split).join(" "));
            const minutes=EnglishDurationParser.#number(pieces.slice(split).join(" "));
            if(Number.isInteger(hours)&&hours>=0&&Number.isInteger(minutes)&&minutes>=0&&minutes<60)return (hours*3600+minutes*60)*1000;
        }
        const minutes=EnglishDurationParser.#number(text);
        return Number.isInteger(minutes)&&minutes>0&&minutes<=59
            ? minutes*60000
            : undefined;
    }

    static format(milliseconds) {
        if (!Number.isFinite(milliseconds) || milliseconds <= 0) return undefined;
        const total=Math.round(milliseconds/1000),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
        return hours > 0
            ? `${hours}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`
            : `${minutes}:${String(seconds).padStart(2,"0")}`;
    }

    static describe(milliseconds) {
        if (
            !Number.isFinite(
                milliseconds
            ) ||
            milliseconds <= 0
        ) {
            return undefined;
        }

        const totalSeconds =
            Math.round(
                milliseconds /
                1000
            );
        const hours =
            Math.floor(
                totalSeconds /
                3600
            );
        const minutes =
            Math.floor(
                (
                    totalSeconds %
                    3600
                ) /
                60
            );
        const seconds =
            totalSeconds %
                60;
        const parts = [];

        if (hours) {
            parts.push(
                String(hours) +
                (
                    hours === 1
                        ? " hour"
                        : " hours"
                )
            );
        }

        if (minutes) {
            parts.push(
                String(minutes) +
                (
                    minutes === 1
                        ? " minute"
                        : " minutes"
                )
            );
        }

        if (
            seconds ||
            !parts.length
        ) {
            parts.push(
                String(seconds) +
                (
                    seconds === 1
                        ? " second"
                        : " seconds"
                )
            );
        }

        return parts.join(
            " "
        );
    }

    static #number(value) {
        if(/^\d+$/.test(value))return Number(value);
        const words=value.split(" ").filter(Boolean);let total=0,current=0;
        for(const word of words){
            if(word in EnglishDurationParser.#small)current+=EnglishDurationParser.#small[word];
            else if(word in EnglishDurationParser.#tens)current+=EnglishDurationParser.#tens[word];
            else return undefined;

            if (current > 59) return undefined;
        }
        total+=current;return total;
    }
}

globalThis.EnglishDurationParser = EnglishDurationParser;
