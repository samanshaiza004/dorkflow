# Expense Tracker B9 verification

B9 compares the untouched upstream control, the human-approved B6 candidate,
and the separate B8 implementation. Its current machine result is
**REVIEW-PENDING**: all deterministic assertions passed, but four human review
items remain open. This is not yet a B9 PASS and makes no claim that Dorkflow
improves design quality.

## Frozen inputs and run

- Control: upstream commit `5e5ad9ad6f0929f80e1c9f6667b08870f87e7743`.
- Approved candidate tree SHA-256: `9b8cae681ed49f0a821b207abf71fed8d6cab97532265fce4e81c5436977f1ca`.
- Implementation: `2400196c9a7d3a64554b517d5364fc739d4acf49`, based on the
  control commit and clean at verification.
- Frozen B7 contract SHA-256:
  `26dfb47a303df79f13b6cbb8d75ec94d412b1f47ca9c615c523702f0b10875f4`.
- Rendering environment SHA-256:
  `a9215d1eea25dcbe7111011395f5cfc41a62b8b177fbcb2e13d14da28405d361`.
- Local Lato font SHA-256:
  `d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251`.
- Browser: Chromium `151.0.7922.34`, Playwright `1.62.1`, Node `v24.21.0`,
  macOS arm64, locale `en-US`, timezone `America/Chicago`, DPR 1.
- Final report:
  [`report.json`](phase-b-expense-tracker-b9/report.json)
  (SHA-256 `349fe6b408953ad3fbac88523aaedbf4f81d62a429dd0759b7a542345c510c78`).
- Verification harness SHA-256:
  `993e475289323272528a4729bd9ac1af88a20905d61a91fa89b4d46c472c9854`.
- Human packet and raw observations are committed beside the report in
  [`human-review.md`](phase-b-expense-tracker-b9/human-review.md) and
  [`measurements.json`](phase-b-expense-tracker-b9/measurements.json); all 25
  screenshots are committed under `phase-b-expense-tracker-b9/captures/`.

Earlier timestamped B9 runs are superseded verifier-development runs, not
evaluation evidence. The report above is the only current B9 result.

## Requirement outcomes

Every one of the 22 frozen B7 requirement IDs has exactly one result and
measurement evidence. Ten requirements are machine `PASS`; twelve are
`HUMAN-REVIEW`. There are no deterministic `FAIL` results. The overall status
is therefore `REVIEW-PENDING`, not PASS. The machine report has no aggregate
percentage that could conceal a failed requirement.

The populated responsive sweep checked 320, 375, 699, 700, 701, 719, 720, 721,
768, and 1280 CSS pixels. Layout order, region relationships, visible boxes,
row containment, and document/container overflow all passed. The 699/700/701
measurements test the implementation's chosen 700px breakpoint; they do not
approve that value as a design token. Long text currently inside the editable
text input can scroll within that native control; that is recorded separately
and is not treated as page clipping.

The functional checks passed for four seeded transactions, independently
calculated balance/income/expense totals, pointer deletion, keyboard deletion,
and mobile post-submit balance/history confirmation. The initial B8 smoke had
caught a mobile keyboard-order mismatch before the final B8 commit; the
correction is recorded as a pre-B9 deviation and the final narrow and wide
sequences were rechecked.

Measured results include:

- minimum sampled normal-text/placeholder contrast: `4.607:1`;
- input boundary against its adjacent white surface: `4.361:1`;
- delete rest icon against the page surface: `5.815:1`;
- delete hover border against fill: `3.351:1`;
- delete active border against fill: `4.786:1`;
- focus outline against page background: `10.727:1`, with a visible 3px
  outline and keyboard-reachable named button;
- reduced-motion preference changes the transition to `0.01ms` while hover
  feedback remains present;
- browser requests outside the pinned local variants/font were blocked, with
  no unapproved external requests observed.

Low-contrast section dividers are classified as decorative grouping, not the
sole identification of a control or state. Expense meaning also has signed
amounts and explicit Income/Expense labels. These classifications are preserved
in the measurement artifact. An axe scan was not run because
`@axe-core/playwright` is not in the frozen experiment dependencies. The
measurements are targeted checks, not a complete WCAG conformance claim.

## Human review still required

The review packet asks the human to decide:

1. In the desktop and mobile three-way comparison, did B8 preserve the approved
   B6 relationships while using only values B7 left provisional? Pixel equality
   is not required.
2. At 1280px, does sequential focus from the right-side form to the left-side
   history feel logical to a sighted keyboard user?
3. Are the long descriptions and large signed values legible and scannable at
   375px?
4. Does delete remain subordinate at rest and clearly actionable on hover,
   with active/focus feedback distinct from the expense accent?

Until these are recorded, B9 remains open. A material implementation mismatch
that stays inside the frozen B7 decisions can be corrected as implementation
work and reverified. A correction that changes an approved design relationship
must return to human design review instead of being silently accepted.

Three-way populated captures are available directly:

- Desktop: [control](phase-b-expense-tracker-b9/captures/desktop-populated-control-1280.png),
  [approved B6](phase-b-expense-tracker-b9/captures/desktop-populated-candidate-1280.png),
  [B8](phase-b-expense-tracker-b9/captures/desktop-populated-implementation-1280.png).
- Mobile: [control](phase-b-expense-tracker-b9/captures/mobile-populated-control-375.png),
  [approved B6](phase-b-expense-tracker-b9/captures/mobile-populated-candidate-375.png),
  [B8](phase-b-expense-tracker-b9/captures/mobile-populated-implementation-375.png).
- Wide keyboard focus: [B8 at 1280px](phase-b-expense-tracker-b9/captures/wide-focus-order-implementation-1280.png).
- State-by-state packet: [`human-review.md`](phase-b-expense-tracker-b9/human-review.md).
