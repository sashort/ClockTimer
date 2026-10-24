# Deployment notifications

These are permanent user requirements.

- On verified deployment success, announce success aloud and display the
  six-character deployed build version as a top-level Markdown heading.
- On deployment failure, announce failure aloud and display
  `# DEPLOYMENT FAILED` prominently in the final response, followed by the
  concrete failure and whether the previous production build remains active.
- Do not report success from a local test, commit, push, or queued workflow.
  Verify the deployment workflow and the live build-version.json first.
- If audible notification cannot run, say so explicitly; do not claim it played.

# Stable production reference

The user identified **I0462X** (`bb6cd93b6712c03be6282b800ace3e183bb6c45d`) as
“very stable with almost no lag” on October 23, 2026. Use it as the baseline for future
speech stability/latency comparisons. See [docs/stable-release-reference.md](docs/stable-release-reference.md).

Current implementation guide: [docs/speech-current-implementation.md](docs/speech-current-implementation.md).
