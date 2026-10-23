import fs from 'node:fs';
const files=['SpeechLanguageController.js',...['DurationParser','SpokenTimeParser','PercentParser','SpeechValuePreprocessor','SpeechLanguageContract'].map(name=>'lang/en-US/'+name+'.js')];
export function installSpeechLanguage(target=globalThis,evaluate=source=>target.eval(source)) {
 if(!target.SpeechLanguageController?.languages.includes('en-US'))for(const name of files)evaluate(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'));
 target.SpeechLanguageController.activate('en-US');
 return target.SpeechLanguageController;
}
