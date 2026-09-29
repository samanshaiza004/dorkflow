# Expense Tracker B2–B5 dress rehearsal with the default Design Profile

**Status:** B5 human review recorded; stop before B6 and implementation.
**Date:** 2026-09-29
**Run:** run_aadad7d73a62536be1d6f2d415979ea7

## Question and scope

Does the existing artifact-driven design process remain usable on a real
interface when supplied with the untouched starter Design Profile? This is a
B2–B5 process rehearsal only. It is not a baseline comparison, a product
hypothesis result, or evidence that the resulting design is better.

## Frozen inputs

- Expense Tracker upstream commit:
  5e5ad9ad6f0929f80e1c9f6667b08870f87e7743
- The pinned local Lato rendering environment fingerprint:
  a9215d1eea25dcbe7111011395f5cfc41a62b8b177fbcb2e13d14da28405d361.
  The final 10-state captures in run-016 and run-017 matched byte-for-byte.
  An earlier capture pass had a two-pixel mobile focus-state variance
  (maximum channel delta 1); it was not used as the final evidence pair.
- The profile was the uncustomized private atlas checkout at commit
  3faf703f0e009273f0f6c140ce77226fbb2d22cf, clean, with aggregate profile
  SHA-256 0726da9f58ae6f1c8f17fbe055422d7f1d217a6af8afb093f535eb5fb440196d.
  Dorkflow recorded hashes for all 11 consumed profile files. No personal
  references or Compass edits were added.
- Ten captures covered desktop, 768px tablet, narrow default, focus, submit,
  populated history, delete hover, populated mobile, and post-submit mobile.

## Results

Three structurally different directions passed the deterministic diversity
gate. Each pair differed on eight strategy axes (minimum required: three):

1. Ledger workspace: history receives the broad desktop area; entry stays
   nearby.
2. Entry station: the form leads, with summary/history as confirmation.
3. Statement page: balance and totals lead, with entry secondary.

All 12 choices had valid source citations. The same Codex/GPT-5 executor
self-critiqued the directions: 5 choices were rated supported, 7 weakly
supported, and 0 unsupported-default-like. These are diagnostic judgments,
not independent evaluation. The 0% unsupported-choice rate does not establish
that no arbitrary decisions exist.

The human review recorded ten decisions rather than collapsing the result to
one winner: prefer Ledger-first over Entry-first, prefer Entry-first over
Statement-first, revise rather than approve Ledger-first unchanged, retain
selected ledger choices, borrow form treatment and quieter boundaries/color
semantics across directions, and reject the form-led desktop and
statement-first compositions as primary answers.

The B5 artifact therefore preserved the intended synthesis. The review packet
is still too close to raw artifact representation for routine use: the
authoritative packet is 1,550 lines / 63 KB. The decision was possible, but
the packet should not be mistaken for a good everyday review surface.

## Limits and follow-up

- The model invocation was agent-driven, not API-controlled: model snapshot
  and agent version are unknown. The run records Codex / GPT-5 as
  agent-reported metadata.
- Direction and critique ran in the same Codex session. That session had
  access to earlier human-review discussion and prior source inspection,
  although the frozen stage input itself contains no human decisions. This is
  not a blinded or isolated inference run.
- At the time of this run, the generated response JSON Schema omitted
  profileRefs and profile support-reference kinds even though the runtime
  Zod contracts accepted them. The mismatch has since been corrected with
  schema-parity regression tests, but this historical run was not rerun. The
  default profile and its file hashes were included in model input and review,
  but this run cannot trace profile guidance to individual choices through
  the schema it received; do not infer that defaults had no effect.
- The new tablet/populated-mobile/post-submit-mobile captures describe the
  frozen baseline. They do not validate the proposed mobile redesign order.
  The recorded human decision keeps **entry → balance/summary → recent
  history** as a revision requirement, not an approved implementation rule.

Stop here. The next authorized design-process step is to prepare a B6 hybrid
candidate that carries the recorded keep/borrow/reject/revise decisions and
then ask for human review. No implementation contract, source change to the
Expense Tracker, paired baseline, or Phase B product-quality claim follows
from this run.

## Artifacts

Ignored run artifacts:
artifacts/phase-b-expense-tracker/agent-runs/run_aadad7d73a62536be1d6f2d415979ea7/

- Review packet SHA-256:
  4fd927386e357f103de0c7bb016f6caba52a5032d075a7b974963508a7ad5744
- The accepted human decision is recorded at review/decision.json.
- The frozen model-input SHA-256 is
  be268d835d00bb122e5315924564c859b503c4fbd6a7f19ecd8691b02daca696.
