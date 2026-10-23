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
