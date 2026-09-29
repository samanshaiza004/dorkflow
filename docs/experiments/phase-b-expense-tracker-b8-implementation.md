# Expense Tracker B8 implementation

**Status:** implementation complete; B9 verification pending.

**Run:** `run_aadad7d73a62536be1d6f2d415979ea7`

**Machine-readable receipt:** [phase-b-expense-tracker-b8-receipt.json](phase-b-expense-tracker-b8-receipt.json)

## Frozen inputs and implementation boundary

The implementation is based on the untouched Expense Tracker control at
`5e5ad9ad6f0929f80e1c9f6667b08870f87e7743` and the unchanged B7 contract
`contract_b6hybrid02`, SHA-256
`26dfb47a303df79f13b6cbb8d75ec94d412b1f47ca9c615c523702f0b10875f4`.
The B6-approved `Ledger-first` hybrid and its reviewed captures were consulted
as reference evidence. The control checkout and B6 candidate preview remain
unchanged.

The product implementation lives in a separate local checkout under the
ignored experiment artifacts. Its final commit is
`2400196c9a7d3a64554b517d5364fc739d4acf49` (preceded by implementation commit
`38a48499f72b5d278b672e953545dad68543c706`); its working tree is clean. The
checkout is intentionally not pushed to the frozen upstream repository. Its
local `origin` points at the untouched control checkout, so pushing there
would mutate a frozen benchmark input. The receipt and experiment report are
the durable Dorkflow records.

The implementation preserves the approved behavioral relationships without
copying the candidate stylesheet as a design system. In particular, the CSS
contains literal local values rather than custom-property aliases, and the
contract still has zero approved tokens.

## Requirement mapping

| Contract area | Implementation |
|---|---|
| Wide/narrow relationships and order (`req_b7layout01`, `req_b7wide001`, `req_b7narrow1`, `req_b7resp01`) | The wide layout gives History the broader working region with entry and summary nearby. At narrow widths the DOM and visual order are entry → summary → history. The implementation chooses 700px as a provisional stack breakpoint. |
| Entry and copy (`req_b7entry01`, `req_b7copy01`) | Existing visible labels, placeholders, heading/action copy, and submit behavior are retained. Missing input IDs are added to connect the existing labels. Heading levels are made coherent; the browser tab title changes from the generic scaffold label to the existing product name. |
| Summary and financial meaning (`req_b7summary1`, `req_b7a11y03`) | Existing calculation code is unchanged. Income/Expense labels and signed transaction amounts remain; the balance is restrained and financial values use tabular numerals. |
| Delete and interaction states (`req_b7row0001`, `req_b7state05`–`07`, `req_b7a11y01`–`02`) | The existing delete action remains inside the row. Its target measures 32×32 CSS px, the SVG is centered, its accessible name is “Delete transaction,” rest is quiet, hover/active differ, and keyboard focus has its own 3px outline. The expense edge accent is muted. |
| State and behavior preservation (`req_b7state03`–`04`, `req_b7func01`, `req_b7pres01`) | Empty/zero state, calculations, add/list/delete reducer behavior, and the existing form’s post-submit field retention remain intact. `AppReducer.js` and `GlobalState.js` were not modified. |
| Motion (`req_b7a11y04`) | Brief color transitions are used only for controls. Reduced-motion preference reduces those transitions without removing visual state feedback. No decorative motion was added. |

## Provisional implementation values

The following choices are implementation details, not approved tokens:

- Stack at `max-width: 700px`; use a wide grid with `1.35fr` history,
  `0.9fr` secondary column, 244px secondary minimum, 1180px content maximum,
  and 28px column gap.
- Use 3px input/button radii and no shadows. Page, text, divider, action,
  positive/negative, focus, hover, and active colors are enumerated in the
  receipt and remain provisional.
- Use 26px page title, 18px section headings, 30px balance, 15px row text,
  16px inputs/totals, 14px form labels, and 12px small labels. The locally
  served Lato Regular asset is byte-identical to the B6 rendering input
  (SHA-256 `d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251`)
  and carries its OFL/provenance files.
- Use brief 110–120ms control-color transitions, reduced to 0.01ms for
  `prefers-reduced-motion`.

These values are not inferred to be a system and should not be promoted to
tokens without a separate human decision.

## B8 validation

- The frozen CRA production build passed with
  `NODE_OPTIONS=--openssl-legacy-provider npm run build`. This compatibility
  setting was needed by the upstream CRA 3.4/Webpack toolchain in the current
  Node environment; no dependencies or lockfiles changed.
- A local Playwright smoke passed in Chromium `151.0.7922.34`, with the B6
  rendering-environment fingerprint, Lato hash, 1× DPR, `en-US`,
  `America/Chicago`, light color scheme, and normal motion preference.
- Twelve widths from 320px through 1280px were checked for overflow and
  region geometry in the empty state. Populated captures/checks covered 375,
  768, and 1280px. The run exercised empty/zero state, add and totals, signed
  amounts, newest-first rows, pointer and keyboard deletion, 32×32 target
  containment/centering, distinct hover/active states, the separate 3px
  focus-visible outline, reduced-motion transition duration, copy, local font
  availability, and zero external network requests.
- Machine-readable results and screenshot hashes are in the local ignored
  run at `artifacts/phase-b-expense-tracker/agent-runs/run_aadad7d73a62536be1d6f2d415979ea7/implementation/`.
  The result file SHA-256 is
  `708c6e549231a654b453c64e999aa07e597943903723acb181d421be27772eba`.

## B9 remains open

This B8 smoke is not the B9 hard gate and does not establish WCAG conformance,
formal contrast, complete responsive behavior with populated/long content, or
human approval of the implementation. B9 must map evidence to every contract
requirement; test the selected breakpoint and populated content; run the
accessibility/behavior checks; and show the frozen control, approved B6
candidate, and B8 implementation together for human review. Pixel equality to
the prototype is diagnostic only because B7 left exact visual values
provisional. The wide-screen focus/visual-order relationship also remains for
human inspection: source order follows the approved mobile sequence while the
wide grid places History in the left column.

No claim is made here that Dorkflow improves design quality or passes the
Phase B product hypothesis.
