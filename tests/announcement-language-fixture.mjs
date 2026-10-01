import fs from 'node:fs';
import vm from 'node:vm';
export const english = JSON.parse(fs.readFileSync(new URL('../lang/en-US/announcements.json', import.meta.url), 'utf8'));
export async function englishLanguage() {
    const context = vm.createContext({ fetch: async () => ({ ok: true, json: async () => structuredClone(english) }) });
    vm.runInContext(fs.readFileSync(new URL('../AnnouncementLanguage.js', import.meta.url), 'utf8'), context);
    await context.WMOFAnnouncementLanguage.load('en-US');
    return context.WMOFAnnouncementLanguage;
}
