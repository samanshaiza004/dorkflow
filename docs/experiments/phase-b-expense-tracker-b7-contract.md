# Expense Tracker B7 implementation-contract freeze

**Status:** B6 approved; B7 frozen; B8 implementation has not started.
**Date:** 2026-09-29
**Run:** `run_aadad7d73a62536be1d6f2d415979ea7`

## Approval and reviewed evidence

The human approved B6 revision 2, `dir_b6hybrid02`, SHA-256
`963bdf7bb10d693b5288493addd9ee979080b7b4f1c3fd2608601942aa5b1dea`, as the
basis for B7. The review packet is SHA-256
`c56a424f360b5e645f54dcdca79100c0e32060cd27694626fad1d2d37aad9472`; the
decision record is SHA-256
`19858f9fdb70ded45fc688e2adcf60b869863c0eeca9674dd7bf2f90260811cc` and
contains final B6 approval `hdec_20260929c1` plus the accepted review
principle `hdec_20260929c2`.

All seven revision-2 evidence requests were marked `reviewed` /
`satisfied` in the separate request-set copy (SHA-256
`af0b778697b68a1e257bdb78d6dd854a9909e26607239f1fac04e496b13ea054`). The
original pre-review set remains unchanged (SHA-256
`7b4e827c4709a596dd3222f06894a4d1211a56d7404aa34207c997175a09224c`).

| Reviewed state | Capture |
|---|---|
| Tablet populated/rest, 768×1024 | `cap_5c3af1130f0ace0d` |
| Mobile populated, 375×812 | `cap_c3c1367f7a396e90` |
| Mobile empty, 375×812 | `cap_4031864e62d133d7` |
| Mobile after submit, 375×812 | `cap_2b42cbb9eab07467` |
| Delete keyboard focus-visible, 768×1024 | `cap_aabf51c61e88dc94` |
| Delete pointer hover, 768×1024 | `cap_ad01f5549fb0e8a5` |
| Delete pointer active, 768×1024 | `cap_8662d89a9ada1419` |

The evidence bundle is `ev_2c443a4383b3b9d5`; its metadata file SHA-256 is
`b06f9eaf199fd63895a1d8b54be5e85938cc0221cf2f2a994675f6789651c8e0`, and its
state-matrix identity is
`0cb3aecf6de5c8dbc79846420c61638eb1dc5f5c68f8f104e931b16e5626ad97`. Every
capture belongs to the same rendering-environment fingerprint
`a9215d1eea25dcbe7111011395f5cfc41a62b8b177fbcb2e13d14da28405d361` and
locally pinned Lato bytes
`d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251`.

The control was available at `/control/` beside the candidate at
`/candidate/`, linked from `/`. The control is the untouched upstream commit
`5e5ad9ad6f0929f80e1c9f6667b08870f87e7743`. This records a permanent review
principle: **never ask a human to evaluate a redesign from memory when the
exact control is available.** Keep the control directly reachable under the
same pinned rendering environment. Separate routes are enough; no compare UI
is part of this milestone.

## Frozen contract

The strict `ImplementationContract` schema v2 artifact is
`implementation/implementation-contract.json`, ID `contract_b6hybrid02`,
SHA-256 `26dfb47a303df79f13b6cbb8d75ec94d412b1f47ca9c615c523702f0b10875f4`.
Its run-level freeze record is `implementation/b7-freeze.json`; graph
revision `graph_b7contract01` records the final approval-to-contract link.

The contract freezes:

- wide-screen history as the primary working region, with transaction entry
  and summary nearby; narrow-screen order is entry → balance/summary → recent
  history;
- the existing entry form's labels, amount sign explanation, controls, focus,
  and Add action as one unit, without new visible copy or product behavior;
- restrained balance hierarchy, aligned/tabular financial values where
  supported, quiet boundaries, and signed values/labels so color is not the
  only financial cue;
- transaction description plus signed amount as a scan unit, and the approved
  32×32 delete target, centered icon, accessible name, subordinate rest,
  restrained hover, distinct active response, separate 3px focus indicator,
  and quieter expense edge accent;
- the seven reviewed state behaviors plus accessibility, preservation, and
  responsive verification obligations for B9.

The contract contains four component requirements, seven state requirements,
three responsive requirements, four accessibility requirements, four
preservation requirements, zero token values, zero exact motion specifications,
and no explicit exceptions.

## Deliberately not frozen

B6 approved the candidate's relationships and interaction treatment, not a
universal token set. Exact colors, measured contrast values, font sizes,
spacing, radii, shadows, column ratios, and animation timing remain
provisional. The contract's token list is empty rather than mislabeling
prototype CSS as approved design tokens.

The prototype currently switches at 720 CSS px, but only 375px and 768px
candidate states were reviewed. The contract freezes responsive behavior,
not that exact breakpoint. B9 must inspect narrow, intermediate, and wide
widths, including both sides of the selected breakpoint and 719/720/721px if
the prototype cutoff is retained. The implementation must preserve the
approved ordering and avoid clipping; any material change in that behavior
requires a new human decision.

Screenshots do not establish implementation accessibility conformance. B9
still needs deterministic measurement of the 32×32 target and row containment,
keyboard/accessible-name checks, contrast measurement, reduced-motion checks,
copy/functionality preservation, responsive overflow tests, and rendering
environment verification. No source implementation, post-implementation
verification, visual regression baseline, paired baseline experiment, or
Phase B product-quality claim is part of this freeze.

## Frozen input identities

| Input | Identity |
|---|---|
| Frozen control source | `5e5ad9ad6f0929f80e1c9f6667b08870f87e7743` |
| B6 candidate direction | `963bdf7bb10d693b5288493addd9ee979080b7b4f1c3fd2608601942aa5b1dea` |
| B6 evidence-request source (pre-review) | `7b4e827c4709a596dd3222f06894a4d1211a56d7404aa34207c997175a09224c` |
| B6 reviewed evidence-request set | `af0b778697b68a1e257bdb78d6dd854a9909e26607239f1fac04e496b13ea054` |
| Perceptual evidence metadata | `b06f9eaf199fd63895a1d8b54be5e85938cc0221cf2f2a994675f6789651c8e0` |
| Candidate preview tree | `9b8cae681ed49f0a821b207abf71fed8d6cab97532265fce4e81c5436977f1ca` |
| Pinned rendering environment | `a9215d1eea25dcbe7111011395f5cfc41a62b8b177fbcb2e13d14da28405d361` |
| Pinned Lato file | `d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251` |
| Uncustomized Design Profile commit (clean) | `3faf703f0e009273f0f6c140ce77226fbb2d22cf` |
| Design Profile aggregate hash | `0726da9f58ae6f1c8f17fbe055422d7f1d217a6af8afb093f535eb5fb440196d` |

The full run artifacts remain in the local ignored run directory
`artifacts/phase-b-expense-tracker/agent-runs/run_aadad7d73a62536be1d6f2d415979ea7/`;
the report records their identities without committing screenshots or
quarantined page bytes.

## Validation performed

- `bun run check` passed.
- The repository-declared `bun run test` passed: 90 tests, 0 failures.
- The local Playwright review check passed for the review index, exact frozen
  control route, candidate route, and delete rest/hover/active/focus behavior.
- Zod validation and explicit cross-reference checks passed for the approved
  direction, B6 decision record, all seven reviewed evidence requests, the
  decision graph, and the B7 contract. All seven reviewed screenshot hashes
  matched their captured bytes; the frozen control HEAD and copied source were
  verified unchanged; the candidate preview tree matched its recorded digest.
