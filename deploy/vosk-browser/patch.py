"""Expose native N-best results through pinned vosk-browser sources, without changing decoding."""
from pathlib import Path
import sys
root=Path(sys.argv[1])
def replace(name,before,after):
 p=root/name;s=p.read_text(encoding='utf-8')
 if s.count(before)!=1:raise RuntimeError('Pinned source changed: '+name)
 p.write_text(s.replace(before,after),encoding='utf-8')
replace('src/bindings.cc','static bool Recognizer_AcceptWaveform', '''static void Recognizer_SetMaxAlternatives(Recognizer &self, int count) {
    if (count < 0 || count > 30) throw std::invalid_argument("Alternatives must be 0 through 30");
    self.SetMaxAlternatives(count);
}

static bool Recognizer_AcceptWaveform''')
replace('src/bindings.cc','.function("SetWords", &Recognizer_SetWords)', '.function("SetWords", &Recognizer_SetWords)\n        .function("SetMaxAlternatives", &Recognizer_SetMaxAlternatives)')
replace('src/bindings.cc','#include <emscripten/bind.h>','#include <emscripten/bind.h>\n#include <stdexcept>')
replace('src/vosk.d.ts','  public SetWords(words: boolean): void;','  public SetWords(words: boolean): void;\n  public SetMaxAlternatives(count: number): void;')
replace('lib/src/model.ts','      public setWords(words: boolean): void {','''      public setMaxAlternatives(count: number): void {
        if (!Number.isInteger(count) || count < 0 || count > 30)
          throw new RangeError("Alternatives must be 0 through 30");
        model.postMessage<ClientMessageSet>({action:"set", recognizerId:this.id,
          key:"maxAlternatives", value:count});
      }

      public setWords(words: boolean): void {''')
replace('lib/src/interfaces.ts','export type ClientMessageSet = ClientMessageRecognizerSet | ClientMessageGenericSet;', '''export interface ClientMessageAlternativesSet {
  action: "set";
  recognizerId: string;
  key: "maxAlternatives";
  value: number;
}
export type ClientMessageSet = ClientMessageRecognizerSet | ClientMessageGenericSet | ClientMessageAlternativesSet;''')
replace('lib/src/interfaces.ts','    text: string;\n  };','''    text?: string;
    alternatives?: Array<{text:string; confidence:number; result?: Array<{conf:number; start:number; end:number; word:string}>}>;
  };''')
replace('lib/src/interfaces.ts','return message?.result?.text != null || message?.result?.result != null;','return message?.result?.text != null || message?.result?.result != null || Array.isArray(message?.result?.alternatives);')
replace('lib/src/worker.ts','      case "logLevel":','''      case "maxAlternatives": {
        if (!Number.isInteger(message.value) || message.value < 0 || message.value > 30)
          throw new RangeError("Alternatives must be 0 through 30");
        const target = this.recognizers.get(message.recognizerId);
        if (!target) throw new Error("Recognizer is not ready for alternatives");
        target.recognizer.SetMaxAlternatives(message.value);
        break;
      }
      case "logLevel":''')
print('Patched native binding, worker protocol, public API and result types')
