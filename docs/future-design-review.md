# Future design-review integration

This is documentation only. Phase A does not load or execute design skills.

The intended division of responsibility is:

- HUMAN owns taste, references, art direction, and final aesthetic approval.
- SKILLS/AI provide design-engineering craft, candidate generation, and
  critique against human intent and evidence.
- DORKFLOW preserves intent, constraints, evidence, decisions, and project
  history across replaceable agents.
- DETERMINISTIC CODE performs extraction, measurement, preservation checks,
  accessibility checks, and objective verification.

The skills repository at
https://github.com/jakubkrehel/skills may be used in a later, unprivileged
design/review context. Real client copy remains quarantined from visual
design exploration; placeholder content is used there. Copy editing that
requires the original text runs in a separate unprivileged writing context.
Visual review uses a separate perceptual evidence path with an explicit
trust mode. `sanitized-external` v1 replaces light-DOM text with geometry
placeholders and uses Playwright's screenshot stylesheet to suppress text in
Shadow DOM; shadow-root text is not replaced with geometry placeholders, so
its layout can collapse. This defensive transformation is not proof that
arbitrary remote pixels are safe, and remote reference ingestion remains
disabled pending network isolation. Phase A system-recovery inference remains
limited to sanitized structural observations.
