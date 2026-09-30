# Expense Tracker B9 verification

B9 compares the untouched upstream control, the human-approved B6 candidate,
and a separate implementation against the frozen B7 contract. The first B9
review prompted two local refinements that remained within B7's provisional
styling freedom. The original B9 run is preserved at
[`phase-b-expense-tracker-b9/`](phase-b-expense-tracker-b9/); the revised run
and its captures are preserved separately at
[`phase-b-expense-tracker-b9-revision/`](phase-b-expense-tracker-b9-revision/).

## Current revised run

The B9 refinement is **REVIEW-PENDING**. All 22 frozen B7 requirements have an
explicit outcome: 18 `PASS`, 4 `HUMAN-REVIEW`, and no `FAIL`. The remaining
human-review requirements concern the no-divider summary, rapid polarity
scanning/delete-cue balance, and the post-submit mobile state. The two actual
style-revision questions are whether the divider-free summary reads clearly
and whether the stronger edge cues aid scanning without competing with delete.
This run does not claim that Dorkflow improves design quality or passes the
Phase B product hypothesis.

### Revision and provenance

- Frozen control: `5e5ad9ad6f0929f80e1c9f6667b08870f87e7743` (untouched).
- Prior B8 implementation: `2400196c9a7d3a64554b517d5364fc739d4acf49`.
- Revised implementation: `ee7e2167a1f85200c57136defda3a2e79ef791b9`, a clean
  child of B8. Its reproducible source change is recorded in
  [`implementation-revision.patch`](phase-b-expense-tracker-b9-revision/implementation-revision.patch).
- Approved B6 candidate tree SHA-256:
  `9b8cae681ed49f0a821b207abf71fed8d6cab97532265fce4e81c5436977f1ca`.
- Frozen B7 contract SHA-256:
  `26dfb47a303df79f13b6cbb8d75ec94d412b1f47ca9c615c523702f0b10875f4`.
- Rendering environment SHA-256:
  `a9215d1eea25dcbe7111011395f5cfc41a62b8b177fbcb2e13d14da28405d361`.
- Local Lato font SHA-256:
  `d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251`.
- Browser: Chromium `151.0.7922.34`, Playwright `1.62.1`, Node `v24.21.0`,
  macOS arm64, locale `en-US`, timezone `America/Chicago`, DPR 1.
- Revised report SHA-256:
  `bae126e1f06341faf0c284307a196c07e113ed51faa965b1a2dafe2116fa71fa`.
- Verification harness SHA-256:
  `88bd0e0b566a265053e715b1694624308bc351e62ccc41fb6cfc5019c559cc42`.

The exact original control, approved B6 candidate, and revised implementation
were captured under the same pinned rendering environment. No external
requests were observed. The responsive sweep checked 320, 375, 699, 700, 701,
719, 720, 721, 768, and 1280 CSS pixels with populated content. The
implementation's 700px boundary remains a tested implementation choice, not a
design token or approved design-system breakpoint.

### Deterministic results

- Production build passed.
- `bun run check` passed.
- `bun run test` passed: 96 tests, 0 failures.
- B9 browser verification: no failed hard checks; all responsive, content,
  function, focus, interaction, reduced-motion, and targeted contrast checks
  passed. B9 remains pending only for explicit human review.
- Income and expense edge cues are each 5px wide and measure at least 3:1
  against the page surface. The recorded values are `4.43:1` for income and
  `5.02:1` for expense. Signed amounts and Income/Expense labels remain the
  redundant semantic cues; color is not the sole source of meaning.
- The internal Income-right / Expense-left borders both measure `0px`.
- Delete remains a named, keyboard-reachable 32×32 control with its centered
  icon and distinct focus/hover/active states. The broader targeted checks are
  not a complete WCAG conformance claim; no axe scan was run because the frozen
  experiment dependencies do not include `@axe-core/playwright`.

### Human decisions recorded

The revised report records these explicit human dispositions as `PASS`:

- Desktop history-led and mobile entry → summary → history relationships.
- Wide-screen form-to-history keyboard focus sequence.
- Legibility of long descriptions and large signed amounts on mobile.
- The previously reviewed delete target alignment, size, and state treatment.

The report leaves the following questions `PENDING`:

- After mobile submission, are the changed balance and new row understandable
  together in the same flow?
- Do the stronger income/expense edge cues improve rapid classification while
  staying subordinate to transaction content and distinct from delete?
- Does the summary remain clear and balanced without the vertical separator?

The current review packet is
[`human-review.md`](phase-b-expense-tracker-b9-revision/human-review.md). The
original B9 report, measurements, review packet, and 25 screenshots remain
unchanged as the historical first review at
[`phase-b-expense-tracker-b9/`](phase-b-expense-tracker-b9/).
