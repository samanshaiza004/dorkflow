# Expense Tracker B2–B6 rehearsal with the default Design Profile

**Status:** B6 candidate captured; second human review pending. Stop before
B7 and implementation.
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

Five states now cover the candidate's open questions and an explicit empty
baseline. The request definitions exactly match the captured state matrix.
Every request is marked `captured`, not `reviewed`; its review outcome remains
null.

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

## Review boundary and next step

The remaining gate is human review of this hybrid and its five captures. In
particular, review should decide whether the mobile entry → summary → history
sequence and the same-frame post-submit state satisfy the recorded revision,
and whether the tablet layout deserves to proceed. The empty and post-submit
captures make the state change inspectable; they do not make the underlying
layout an approved rule.

Only after a recorded human accept/revise decision should B7 freeze an
implementation contract. No source implementation, baseline comparison, or
Phase B quality claim follows from this rehearsal. The experiment establishes
that B5 synthesis can be represented as a candidate plus explicit,
capturable evidence obligations, with reproducible captures; it does not
establish that the resulting design is better or that the workflow improves
design outcomes.
