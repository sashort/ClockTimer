import fs from 'node:fs';
import vm from 'node:vm';
export const english = JSON.parse(fs.readFileSync(new URL('../lang/en-US/announcements.json', import.meta.url), 'utf8'));
export async function englishLanguage() {
    const context = vm.createContext({ fetch: async () => ({ ok: true, json: async () => structuredClone(english) }) });
    vm.runInContext(fs.readFileSync(new URL('../AnnouncementLanguage.js', import.meta.url), 'utf8'), context);
    await context.WMOFAnnouncementLanguage.load('en-US');
    return context.WMOFAnnouncementLanguage;
}

const speech = JSON.parse(fs.readFileSync(new URL('../lang/en-US/speech-patterns.json', import.meta.url), 'utf8'));
export const englishSpeechLanguage = structuredClone(speech.language);
for (const [key, id] of Object.entries(englishSpeechLanguage.speech.commands)) englishSpeechLanguage.speech.commands[key] = speech.patterns[id].pattern;
for (const key of ['wakePhrase','sleepPhrase','offPhrase']) englishSpeechLanguage.speech[key] = speech.patterns[englishSpeechLanguage.speech[key]].pattern;
