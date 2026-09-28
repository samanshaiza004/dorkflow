# Phase B real-interface dress rehearsal: Expense Tracker B2-B5

**Status:** B2-B4 completed; B5 review packet ready; human decision pending.  
**Run:** `run_458db04967f1ffe3abd50ab7b671ac81`  
**Date:** 2026-09-28

## Question

Does the artifact-driven intent, evidence, direction, and critique process
remain useful on a small real interface, before implementation or the paired
product experiment?

This is a process dress rehearsal, not evidence that Dorkflow produces a
better design. No direction was selected or implemented, and no Phase B
product hypothesis is claimed as passed.

## Frozen input and executor

- Upstream: Brad Traversy's React Expense Tracker, commit
  `5e5ad9ad6f0929f80e1c9f6667b08870f87e7743`.
- Rendering: frozen local bundle, pinned Playwright/browser environment, and
  locally pinned Lato Regular. The seven-state final capture matched its
  repeat run byte-for-byte. The earlier two-pixel focus-state variance is
  retained in the bundle's pre-inference diagnostics.
- Brief: redesign the main expense-tracking interface for someone who
  records purchases several times a week; prioritize comprehension, entry,
  trust, and legibility; preserve functionality and copy; add no features.
- Evidence: seven desktop/mobile default, focus, populated-history, and
  delete-hover captures. The one local reference was explicitly attributed
  only for the transaction-to-summary relationship; baseline styling was
  not declared binding.
- Executor: the current Codex session used the file handoff. The stage record
  reports `Codex`; agent version, model name, and model version are unknown.
  No API key or OpenAI Responses API call was used. This records the handoff,
  not authenticated executor identity or a controlled model invocation.
- The direction and critique stages ran sequentially in the same Codex
  session; treat the critique as self-critique, not independent review.

## Results

The three proposals used meaningfully different structural strategies:

1. A ledger workbench: transaction history first, with totals and entry
   nearby.
2. A balance briefing: establish the current financial position before
   history and entry.
3. An entry-first capture station: prioritize recording, then connect the
   result to balance and history.

The deterministic diversity gate passed. Pairwise strategy-axis differences
were 6, 6, and 7, against a minimum of 3. This proves only that the declared
strategy categories differ; it does not establish perceived creative
distinctness or human preference.

All 12 choices had structurally valid source citations. The critic judged 5
supported, 7 weakly supported, and 0 unsupported-default-like. The zero
unsupported-default-like count is not evidence that arbitrary choices were
absent: there was one self-critique, and this diagnostic has not been
calibrated against independent human judgments.

The critique did expose concrete unresolved questions rather than merely
repeating the brief: mobile ordering and connection between a newly entered
transaction and the balance; whether a ledger split remains legible with
long descriptions; whether flat surfaces improve this specific hierarchy;
and actual palette/contrast values. This suggests the evidence links make
tradeoffs inspectable, while also showing that screenshots alone do not
validate all proposed layout behavior.

## Process assessment and limits

The file handoff was operable without a Dorkflow API credential: it emitted
stage-specific context, instructions, screenshots, and schema; enforced
citations and direction diversity; produced critiques and an inspectable
review packet; and stopped for human judgment. The output is traceable by
input/instruction/schema/output hashes.

The human-facing review experience is not yet evaluated. The packet must be
reviewed by the user before we can say whether it makes choosing easier or
feels like paperwork. The executor record is self-reported and does not
authenticate the model or its tool boundary. This run covers one page and
does not test implementation, preservation, accessibility, or post-design
verification. It is not the paired baseline experiment.

## Artifacts

Ignored local run artifacts are under
`artifacts/phase-b-expense-tracker/agent-runs/run_458db04967f1ffe3abd50ab7b671ac81/`.
The human review packet is `review/packet.json`; its SHA-256 is
`7eeff77b8f93d6810f37df430a5b61af14d6ab38f136d7f79de540c1018c4706`.
The frozen input bundle remains unchanged; the run manifest binds its exact
hash and rendering environment.

## Conclusion

**B2-B4 machinery: exercised successfully on this real interface. B5:
awaiting human review.** The process surfaced concrete competing product
priorities and left a traceable packet. Whether that structure improves
human decision-making remains unanswered; stop here until the human review
is recorded.
