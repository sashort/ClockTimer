(() => {
    "use strict";

    // Orders eligible interpretations. The planner supplies eligibility and
    // transitions; this policy neither recognizes text nor executes effects.
    // Compatibility guard: grammar switching is not yet in place to constrain
    // partial-token ambiguity. Reassess this guard when staged grammars arrive.
    class SpeechCommandBranchPolicy {
        static #priority(plan, final) {
            const viable = plan.invalid || (final && plan.pending) ? 0 : 1000000;
            // A final incomplete literal outranks an invalid shorter split, but
            // a complete valid command still wins at the silence boundary.
            const pendingLiteral = plan.pending?.hasCommandPrefix
                ? final ? !plan.steps.length && plan.pending.headStarted ? 600000 : 500000 : !plan.steps.length && plan.pending.headStarted ? 4000000 : 2000000 : 0;
            const headWords = plan.steps[0]?.segmentTranscript.split(" ").length || 0;
            // Preserve the planner's established relative priorities, including
            // malformed-root fallback; only unresolved literal heads gain a hold.
            return viable + pendingLiteral + headWords * 10000 +
                (plan.pending ? 4000 : 0) + (plan.exact ? 2000 : 0) + (plan.consumedWords || 0);
        }

        static compare(left, right, {final = false} = {}) {
            if (!left) return right ? -1 : 0;
            if (!right) return 1;
            return Math.sign(this.#priority(left, final) - this.#priority(right, final));
        }
    }

    globalThis.SpeechCommandBranchPolicy = SpeechCommandBranchPolicy;
})();
