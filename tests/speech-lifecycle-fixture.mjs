import fs from 'node:fs';

const sources = ['OwnedFeedbackScope', 'SpeechCommandBranchPolicy', 'ValidatedCommandBuffer', 'SpeechValueCollector', 'SpeechContinuationSession', 'SpeechRejectionFeedback', 'SpeechDurationEstimator', 'ToneReferencedAnnouncement']
    .map(name => fs.readFileSync(new URL(`../${name}.js`, import.meta.url), 'utf8'));

export function installSpeechLifecycle(target = globalThis) {
    for (const source of sources) target.eval(source);
}
