# Expense Tracker B2–B6 rehearsal with the default Design Profile

**Status:** B6 revision 2 approved; B7 implementation contract frozen. Stop
before source implementation and verification.
**Date:** 2026-09-29
**Run:** `run_aadad7d73a62536be1d6f2d415979ea7`

## Scope

This continues the B2–B5 process rehearsal documented in
[`phase-b-expense-tracker-default-profile-b2-b5.md`](phase-b-expense-tracker-default-profile-b2-b5.md).
It tests whether a human's keep/borrow/reject/revise decisions can be carried
into a reviewable hybrid candidate and turned into explicit evidence
obligations. It does not test whether Dorkflow improves design quality, and
does not authorize implementation.

The upstream Expense Tracker control at commit
`5e5ad9ad6f0929f80e1c9f6667b08870f87e7743` remains unchanged. The hybrid is a
separate local prototype copied from that frozen input. It uses the same
locally pinned Lato bytes and rendering environment as the B5 run. The
personal Design Profile was not customized.

## Protocol correction and review presentation

Before this profile-aware B6 work, the runtime allowed `profileRefs` but the
machine-facing direction/critique JSON Schemas did not expose all supported
profile citation kinds. The response schemas now include `profile-floor`,
`profile-rail`, and `profile-compass`; a regression test compares runtime
discriminated-union kinds to the machine-facing schemas, including critique
support references. This corrects the protocol for future profile-aware
stages. B2–B5 was not rerun, so its historical profile-attribution limitation
remains.

The authoritative B5 packet is unchanged and still bound by canonical SHA-256
`4fd927386e357f103de0c7bb016f6caba52a5032d075a7b974963508a7ad5744`. A
generated read-only `review/summary.md` gives a shorter view of its thesis,
choices, support status, captures, concerns, and uncertainties. The summary
is a disposable projection; human decisions continue to bind to the packet
hash, not the summary.

## B6 hybrid candidate

The candidate `dir_b6hybrid01` incorporates all ten recorded human decisions
and makes seven explicit choices:

- **Desktop/tablet:** preserve the ledger-first working area, with transaction
  history receiving the broad column and entry/summary nearby.
- **Mobile:** order entry → balance/summary → recent history.
- **After submit:** use the existing interaction and copy; show the new row
  and resulting balance together.
- **Form:** keep labels, sign explanation, focus treatment, and Add action
  associated as borrowed from Entry-first.
- **Rows:** keep description and signed amount as a scan unit; make delete
  visually subordinate at rest but keyboard-reachable and visibly focused.
- **Financial hierarchy:** use restrained balance typography and tabular
  numerals.
- **Surfaces:** use quiet boundaries and redundant labels/signs; do not make
  hue carry financial meaning alone.

The candidate links back to the human decision IDs. Its 14-node/12-edge
decision graph records the source intent, review decisions, candidate rules,
and evidence requests. These artifacts validate against the existing design
contracts. This is traceability, not approval: the hybrid is still a proposal.

## Evidence requests and results

The initial five-state capture covered the candidate's open questions and an
explicit empty baseline. At that point every request was `captured`, not
`reviewed`. The first human review later marked the populated-mobile ordering
and post-submit confirmation `reviewed` / `satisfied`; that decision is bound
to the exact revision-1 capture IDs below. Other revision-1 requests remained
captured and unresolved.

| State | Capture | Capture SHA-256 | Deterministic/visible result |
|---|---|---|---|
| Tablet populated, 768×1024 | `cap_3e3fc06e09ad8951` | `e745a1927a4a1708e50f69bfb740e0000ebb4bfac9f9e3d7d4b5fdc11c89548c` | History width 421.94px vs. 270.06px for the form column; two rows; no horizontal overflow. |
| Mobile populated, 375×812 | `cap_b39689114f385438` | `cce912ab1362274362469ef24b779c40917aa5b7d1451107e120f770e7610811` | Entry → summary → history; two readable signed rows; balance `$ 33.60`; no horizontal overflow. |
| Mobile empty, 375×812 | `cap_b8ac0750b6c30e91` | `ecbf46edd2f4433ad0d511b2dafb63054a7adbcb82351b317861a027ab562892` | Balance `$ 0.00`; zero rows; entry → summary → history; no horizontal overflow. |
| Mobile after submitting Coffee `-4.80`, 375×812 | `cap_f9f99f328a8729e4` | `127763c60e5081a6b58a89c66ffbbaae496398f08547bc58b1328fadb3ba641f` | The same frame shows balance `$ -4.80` and the Coffee `-$ 4.80` row; no horizontal overflow. |
| Keyboard focus on delete, 768×1024 | `cap_00c5cb8ba047685c` | `19d881d2b2d984d68fa830c7ae70f1dec54a3a2630d7a77aa528203918b4c0d3` | Tab reaches delete; `:focus-visible`; opacity 1; solid 3px outline. |

All five captures use rendering-environment SHA-256
`a9215d1eea25dcbe7111011395f5cfc41a62b8b177fbcb2e13d14da28405d361`, with
the pinned Lato font SHA-256
`d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251`.
The actual capture evidence ID is `ev_03ba7e27fc9699c5`; its canonical state
matrix hash is
`50de2504cdf485296d8b0ecf54577ea485c863512bc8c451f79bb9142500680f`.
The B6 input/output artifact hashes are:

| Artifact | SHA-256 |
|---|---|
| Hybrid direction | `cb00654aa3c4330cef1e5075db2186b722d140680d40229cbf813ba4224fb4c9` |
| Decision graph | `a968c9149afbd91d52b81c864d497c29e5524f5480efbe6d0cd2c3646d63a16c` |
| Evidence request set (five captured; review outcomes null) | `0dfe60e66b6cf01241784752179d2d8934e192c278633e2114500b2ebe1df246` |
| Perceptual evidence metadata | `8013bd38124f4307c70b37cea7a8f130796d9c3faf5c022925d73db94848f5f5` |
| Captured state-matrix bytes | `5516362b833e09c1f40f5d1944c3683844438a7196334957b0781733c7b10a2a` |

The ignored local run directory is:

```text
artifacts/phase-b-expense-tracker/agent-runs/run_aadad7d73a62536be1d6f2d415979ea7/
```

Within it, `hybrid-direction.json`, `decision-graph.json`, and
`evidence-requests.json` are the inspectable B6 artifacts;
`b6-proposed-capture-verified5/` contains the quarantine, capture index, and
model-facing trusted-project renders. The upstream control copy was not
modified. The five screenshots show the proposed local prototype, not the
original site, and are not evidence that a human has approved the composition.

## First B6 human review and revision 2

The first review accepted the broad ledger-first composition, the restrained
balance/signed-row hierarchy, mobile entry → summary → history ordering, and
the same-frame mobile post-submit confirmation. The latter two evidence
requests are recorded as `reviewed` / `satisfied` in
`evidence-requests-v1-reviewed.json`, against the revision-1 captures
`cap_b39689114f385438` and `cap_f9f99f328a8729e4`.

The review did **not** approve the candidate unchanged. It requested a
localized delete-control revision: a 32×32 CSS-pixel target with a centered
icon and accessible name; quiet rest, restrained hover, distinct active, and a
separate 3px focus-visible indicator; plus a less competitive expense-row
edge accent. The exact human decisions are in
`review/b6-review-v1-record.json`, bound to
`review/b6-review-v1-packet.json` (SHA-256
`35398f810be2ee2c0d1424bf8c2421636e433b256b06f09edd648d3cf233985d`). The
record contains four decisions: composition accepted, mobile ordering and
post-submit evidence accepted, delete affordance revised, and the two-route
review convention accepted.

The local review preview now has an explicit index at `http://127.0.0.1:3000/`:

```text
/           B6 review index
/control/   untouched Expense Tracker at 5e5ad9a
/candidate/ human-directed candidate dir_b6hybrid02
```

The control source copied into the local preview is byte-for-byte equal to
the frozen checkout's `src/` tree. Its Git HEAD remains
`5e5ad9ad6f0929f80e1c9f6667b08870f87e7743`; that checkout was not modified.
Both preview routes use the same local Lato-Regular.ttf bytes, SHA-256
`d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251`, and
the same rendering-environment fingerprint
`a9215d1eea25dcbe7111011395f5cfc41a62b8b177fbcb2e13d14da28405d361`.

An initial revision-2 capture exposed style leakage from the imported
upstream stylesheet: its absolutely positioned delete rule moved the new
button to the row's left edge. The candidate now explicitly resets that
positioning. The final capture below is the clean `v2c` run; the earlier
failed/incorrect capture directories are retained locally as diagnostic
artifacts and are not used as evidence.

Revision 2 is `dir_b6hybrid02` (SHA-256
`963bdf7bb10d693b5288493addd9ee979080b7b4f1c3fd2608601942aa5b1dea`). Its
seven-state matrix has hash
`0cb3aecf6de5c8dbc79846420c61638eb1dc5f5c68f8f104e931b16e5626ad97`; the
model-facing evidence bundle is `ev_2c443a4383b3b9d5`. The original request
set remains unchanged with `captured` statuses; a separately hashed reviewed
copy records the final human outcome without rewriting the pre-review
artifact.

| Candidate state | Capture | Screenshot SHA-256 | Deterministic observation |
|---|---|---|---|
| Tablet populated/rest, 768×1024 | `cap_5c3af1130f0ace0d` | `d46684b7c0f41dfa20743725c36edef85849057ee826203e23b3996fc0016cf4` | Ledger remains broad; delete target stays visually subordinate at desktop/tablet rest. |
| Mobile populated, 375×812 | `cap_c3c1367f7a396e90` | `ed354655ffa135815469934910bfc96b57a9a4bde35d1ab26fb881d1ef5b7d11` | Entry → summary → history; signed values; no clipping. |
| Mobile empty, 375×812 | `cap_4031864e62d133d7` | `94d995eb1885c396dc117847e0e4663b63b5c1bba22cd43503216b55fd9f06b2` | Zero balance, no rows, same sequence. |
| Mobile after Coffee `-4.80`, 375×812 | `cap_2b42cbb9eab07467` | `7d78c21dae77d83ee72c9f22b24eb461862cd5ab9edb13ed22247704470dd8eb` | Changed balance and new transaction remain in the same frame; mobile target is visible. |
| Keyboard focus on delete, 768×1024 | `cap_aabf51c61e88dc94` | `11ad4f3aba7b395f26ac01be9de4e210d4bc6f041b84dbc4cdb10f117e596b98` | Tab reaches the revised button; the distinct 3px focus outline remains. |
| Pointer hover on delete, 768×1024 | `cap_ad01f5549fb0e8a5` | `673b82c3950c0b9dd94c0094ca930cae6a8a4202547d761f127e180267fe29d5` | Button is at the row end with a subtle destructive tint and stronger border; expense accent is muted. |
| Pointer active on delete, 768×1024 | `cap_8662d89a9ada1419` | `e8e4bd38e0ed330a5ea02c4eb5e2dfb763e859b6be1f453c136021c4ed4d0a38` | Pressed fill differs from hover; release retains the existing delete behavior. |

The local Playwright review test passed for all three routes and verifies the
32×32 target, target containment in the row, icon center within 0.5 CSS px of
the button center, rest-to-hover border/fill changes, hover-to-active change,
existing deletion on release, and keyboard `:focus-visible` with a solid 3px
outline. The Dorkflow capture ran with loopback-only GET/HEAD network policy;
Lato was loaded from the local frozen font bytes. The revision-2 graph
(`graph_b6hybrid02`) records the old candidate being superseded and the
remaining evidence obligations.

## B6 approval and review principle

The second human review approved `dir_b6hybrid02` as the basis for B7. It
marked all seven revision-2 requests reviewed/satisfied: tablet working-area
relationship; populated and empty mobile order; same-frame mobile
post-submit feedback; keyboard focus; restrained pointer hover; and distinct
active/delete behavior. The human specifically accepted the centered 32×32
row-end target and the quieter expense accent. The record is bound to
`review/b6-review-v2-packet.json` (SHA-256
`c56a424f360b5e645f54dcdca79100c0e32060cd27694626fad1d2d37aad9472`) and is
stored at `review/b6-review-v2-record.json` (SHA-256
`19858f9fdb70ded45fc688e2adcf60b869863c0eeca9674dd7bf2f90260811cc`).

The separately reviewed evidence-request set is
`evidence-requests-v2-reviewed.json` (SHA-256
`af0b778697b68a1e257bdb78d6dd854a9909e26607239f1fac04e496b13ea054`). The
original `evidence-requests-v2.json` is preserved unchanged at SHA-256
`7b4e827c4709a596dd3222f06894a4d1211a56d7404aa34207c997175a09224c`.

The human also established a permanent Dorkflow review principle: **never ask
a human to evaluate a redesign from memory when the exact control is
available.** Make the frozen control directly reachable beside the candidate
under the same pinned rendering environment. The existing simple index and
`/control/` and `/candidate/` routes satisfy this experiment; no compare UI is
being built. The principle is documented in the B5 review protocol and the
human decision record.

## B7 contract and boundary

B7 is frozen as
`implementation/implementation-contract.json` (SHA-256
`26dfb47a303df79f13b6cbb8d75ec94d412b1f47ca9c615c523702f0b10875f4`), with
run provenance in `implementation/b7-freeze.json`. The contract carries four
component requirements, seven reviewed state requirements, three responsive
requirements, four accessibility requirements, and four preservation
requirements. It intentionally has **zero token values** and no exact motion
specification: B6 did not approve prototype colors, typography metrics,
spacing, radii, shadows, column ratios, or animation timing as reusable
tokens. The prototype's 720px media-query boundary was not independently
reviewed; implementation should preserve the approved responsive behavior,
choose the breakpoint by content fit, and verify around the selected boundary
in B9.

The contract does not constitute implementation, accessibility conformance,
or a verification pass. No source-repository implementation, approved visual
baseline, paired baseline experiment, or Phase B product-quality claim is
included. The exact contract, review, evidence, control, profile, font, and
rendering-environment hashes are summarized in
[`phase-b-expense-tracker-b7-contract.md`](phase-b-expense-tracker-b7-contract.md).
