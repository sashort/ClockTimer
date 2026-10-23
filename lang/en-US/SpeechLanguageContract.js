(() => {
    'use strict';
    const unique=values=>[...new Set(values)];
    const parserKind=kind=>({time:'clock',number:'percent'})[kind]||kind;
    const vocabulary=()=> {
            const forms=Array.from({length:1000},(_,n)=>EnglishSpokenPercentParser.spokenForms(n));
            const number = n => forms[n][0];
            const small = forms.slice(0,20).map(values=>values[0]);
            const numbers = forms.map(values=>values[0]);
            const numberVariants = forms.flat();
            const time = ["four twelve", "noon", "midnight"];
            for (let hour = 1; hour <= 12; hour++) {
                for (let minute = 0; minute < 60; minute++) {
                    const phrase = [number(hour), minute ? (minute < 10 ? "oh " : "") + number(minute) : ""].filter(Boolean).join(" ");
                    time.push(phrase, phrase + " am", phrase + " pm");
                }
            }
            // Preserve the pre-Vosk parser's compositional vocabulary. These
            // finite pieces let recognition retain articles, omitted units,
            // connectors and digit aliases; SpeechMenu validates the full value.
            const aliases = ["oh", "o", "naught", "nought", "tutu"];
            const duration = ["twenty minutes", ...numbers, "a", "an", "and", "double", "triple", "to", "too", ...aliases];
            for (const unit of ["hour", "hours", "hr", "hrs", "minute", "minutes", "min", "mins", "second", "seconds", "sec", "secs"]) {
                // Articles introduce singular units; plural forms such as
                // "an hours" bias recognition away from "an hour".
                if (["hour", "minute", "second"].includes(unit)) duration.push("a " + unit, "an " + unit);
                for (let n = 0; n < 60; n++) duration.push(number(n) + " " + unit);
            }
            for (let n = 0; n < 60; n++) duration.push("and " + number(n));
            for (const article of ["a", "an", "one"]) for (let minute = 0; minute < 60; minute++) {
                duration.push(article + " hour " + number(minute), article + " hour and " + number(minute));
            }
            for (let hour = 1; hour <= 12; hour++) for (let minute = 0; minute < 60; minute++) {
                duration.push(number(hour) + " hours " + number(minute), number(hour) + " hours and " + number(minute));
            }
            // Include unitless minutes/seconds as complete decoder phrases, just
            // as clock time includes hour/minute pairs. Individual number words
            // alone do not describe the transitions between spoken groups.
            for (let minute = 0; minute < 60; minute++) for (let second = 0; second < 60; second++) {
                duration.push(number(minute) + " " + number(second));
                if (second < 10) duration.push(number(minute) + " oh " + number(second));
                duration.push(number(minute) + " minutes " + number(second), number(minute) + " minutes and " + number(second));
            }
            // Clock idioms and 24-hour/digit-alias forms accepted before Vosk.
            for (let hour = 0; hour < 24; hour++) for (let minute = 0; minute < 60; minute++) {
                time.push(number(hour) + " " + number(minute));
                if (minute < 10) for (const alias of aliases.slice(0, 4)) time.push(number(hour) + " " + alias + " " + number(minute));
            }
            for (let hour = 1; hour <= 12; hour++) {
                for (const fraction of ["quarter", "half"]) for (const relation of ["past", "after", "to", "till", "until"]) {
                    for (const article of ["", "a "]) for (const suffix of ["", " am", " pm"])
                        time.push(article + fraction + " " + relation + " " + number(hour) + suffix);
                }
                for (const day of ["today", "tomorrow"]) time.push(day + " at " + number(hour));
            }
            time.push("noon tomorrow", "noon today", "midnight tomorrow", "midnight today", "today", "tomorrow", "at", "oclock", "o clock", ...aliases);
            for (const n of numbers) for (const unit of ["second", "seconds", "minute", "minutes", "hour", "hours"]) duration.push(n + " " + unit);
            // Bounded vocabularies. Deployments may supply different finite
            // ranges/capture choices; no catch-all or unknown-word fallback.
            const digits = [...small.slice(0, 10), "oh"];
            let sequences = [""];
            const pins = [];
            for (let length = 1; length <= 4; length++) {
                sequences = sequences.flatMap(prefix => digits.map(digit => [prefix, digit].filter(Boolean).join(" ")));
                pins.push(...sequences);
            }
            const date = ["today", "tomorrow"];
            for (const month of ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"])
                for (let day = 1; day <= 31; day++) date.push(month + " " + number(day));
            return { time: unique(time), duration: unique(duration), number: unique(numberVariants), digits: pins, date };
    };
    SpeechLanguageController.register({
        version:1,locale:'en-US',
        contexts:{time:{digitRange:[1,4]},duration:{digitRange:[1,6]},number:{},digits:{},date:{}},
        vocabulary,
        normalize:(value,kind,options)=>EnglishSpeechValuePreprocessor.normalize(value,parserKind(kind),options),
        parse:(value,kind,options)=>EnglishSpeechValuePreprocessor.parse(value,parserKind(kind),options),
        format:(value,kind,{canonical=false}={})=>kind==='duration'
            ?canonical?EnglishDurationParser.formatCanonical(value):EnglishDurationParser.format(value):undefined,
        classify:(value,kind,options)=>EnglishSpeechValuePreprocessor.classify(value,parserKind(kind),options),
        numberForms:value=>EnglishSpokenPercentParser.spokenForms(value),
        *parityCases() {
            for(let value=0;value<1000;value++)for(const phrase of EnglishSpokenPercentParser.spokenForms(value))
                yield {kind:'percent',phrase,value:String(value),parsed:value,recognition:'phrase'};
            const spell=value=>EnglishSpokenPercentParser.spokenForms(value)[0];
            for(let hour=0;hour<24;hour++)for(let minute=0;minute<60;minute++)
                yield {kind:'clock',phrase:`${spell(hour)} ${spell(minute)}`,value:`${hour}:${String(minute).padStart(2,'0')}`,recognition:'phrase'};
            for(let minute=0;minute<60;minute++)for(let second=0;second<60;second++){
                if(!minute&&!second)continue;
                yield {kind:'duration',phrase:`${spell(minute)} minutes ${spell(second)} seconds`,value:`0:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`,parsed:(minute*60+second)*1000};
            }
            yield {kind:'duration',phrase:'an hour and five',value:'1:05:00',components:{hours:1,minutes:5,seconds:0},inferred:{hours:false,minutes:false,seconds:true}};
        },
        examples:[
            {kind:'percent',phrase:'one ten',value:'110'},
            {kind:'percent',phrase:'a hundred and ten',value:'110'},
            {kind:'duration',phrase:'four twelve',value:'0:04:12'},
            {kind:'clock',phrase:'four twelve',value:'4:12'},
            {kind:'duration',phrase:'an hour and five',value:'1:05:00',components:{hours:1,minutes:5,seconds:0},inferred:{hours:false,minutes:false,seconds:true}}
        ]
    });
})();
