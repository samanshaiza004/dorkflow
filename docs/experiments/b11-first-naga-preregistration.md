# B11.1 — First Naga Baptist Church paired experiment

**Status: READY TO FREEZE — this document and its input manifest must be committed and pushed before either arm starts. Neither arm has started.**

This document is the proposed preregistration for the first Phase B paired
experiment. It must be reviewed, completed, hashed, and committed before either
design arm receives its task. If a frozen input or method changes after either
arm starts, stop and record the run as a pilot rather than silently revising
the experiment.

## Question

Given the same capable agent, starting site, project brief, references,
functional requirements, general design guidance, and comparable work budget,
does the Dorkflow process produce a more intentional and preferable homepage
redesign than a strong direct-design workflow?

The experiment compares process, not model capability. It does not test whether
Dorkflow can autonomously discover First Naga cultural direction: the source
repository already contains detailed, shared brand and UX documents.

## Frozen project and tool inputs

| Input | Frozen value |
| --- | --- |
| Application repository | `https://github.com/samanshaiza004/firstnagabaptistchurch` |
| Application source commit | `c4e2f062a602fc84665e381852748fa0a11f6abd` (`main` at inspection) |
| Safe source export | SHA-256 `1a529cd70c6a7ca9aaceb46dbf4af7b9441889f71bd755aa36e60b7cbab0c019`; 126 tracked entries, excluding `.env`, `.env.example`, and `studio/` |
| Identical clean source seed / both arm starts | `11fbdbccd39ce20d54d898ecffd93bc94c5e57fc`; fresh single-commit repositories; both worktrees clean before run |
| Application scope | Homepage, with shared header/footer edits only when needed by the homepage redesign |
| Dorkflow treatment commit | `f8b284b0128041cf5951b9dc1df832e1cd993296` |
| Project brand document | `docs/BRAND_DESIGN_DIRECTION.md`, SHA-256 `0ce7c522d93677a9aa892cc7c36b78e8e1432f03f3fe60f3d7e5b67302b64eaf` |
| Project UX document | `docs/UX_INFORMATION_ARCHITECTURE_AUDIT.md`, SHA-256 `c69704d024fbfcaafa926e3364daaf02376677a96e957c61df9b5731e0b61385` |
| App package manifest | `package.json`, SHA-256 `3a0e98075dba08f9a90d694ae9b3da1c3e9bdaccc0af0a7cf936de03d3a1d0d5` |
| App dependency lock | `bun.lockb`, SHA-256 `c43fbe231dc8c7a41d97528d7805a8d146c20886eaffc61e8aef147196311532` |
| Baseline design guidance | Local `frontend-design` skill, SHA-256 `af73b8e676a83b618f1dd32bb21a2996aec75072c4b886344abe20581622fb87` |
| Direct-arm task instructions | `docs/experiments/b11-first-naga/direct-baseline-task.md`, SHA-256 recorded in `pre-run-inputs.json` |
| Reusable profile | Dorkflow's unmodified starter Floor/Rails/Compass at the treatment commit; exact consumed-file hashes recorded below |
| Clean Git revision used by profile resolver | `bddf5108ac6fab4b6539011bc6503c01d70b0acf`; clean worktree |
| Profile manifest | `templates/dorkflow-design-atlas-template/profile.json`, SHA-256 `1dbbc120279e8291dbe203790f53cf9cf019154e09a2964a7b1fab84f5406261` |
| Profile aggregate hash | `0726da9f58ae6f1c8f17fbe055422d7f1d217a6af8afb093f535eb5fb440196d` |
| Exact profile context serialized for the stage | SHA-256 `c4e66fd32409027398afcd7299c47b5eb7daf8cb1e1c4189b24abfe1f2f4d006` |

The profile bytes were copied from the frozen Dorkflow template into a
disposable, clean Git repository because the profile resolver requires the
profile root itself to be a Git working tree. The exact generated repository
revision is recorded above and its clean state was verified before the run.
The user's local profile clone was checked by file hashes only and does not
byte-match this frozen starter; it is intentionally excluded and will not be
edited.

Consumed profile files (SHA-256): `floor/core.json` —
`7fd835774867dad84fc2fe5c417589948d8676f4d69bce4f389b1aab7c939703`;
`rails/project-rails.json` —
`dc017c8859b2e9d969c963c5022c129a3e9c1e5697c8f2c67eb2dbb02943181c`;
`rails/layout.json` —
`aa82f22ea97d5a93d7b9a77743688e74f28516654ee3208afef421cfb32928b8`;
`rails/typography.json` —
`9cc39533cd55e871041110296eb30818d9f370e70d318090bca4f9c376aa1219`;
`rails/color.json` —
`d8cffc074f902f9eedda38fd15348fa7c556e09479891d84632c1b499348e858`;
`rails/motion.json` —
`75d65f37850fd6b627e79166484aaf928671ca531991a45112e17dbf9d089bb4`;
`rails/surfaces.json` —
`b70c53cb1b301dd090a0ee16108ca5b5ff7688ebb52e565441c96fa4ce293a55`;
and `compass/principles.json` —
`97825be4d47cc3d779817279b057c8b59da915b328d0495c23050bbaf866e88a`.
The resolver also validates the starter Atlas file
(`atlas/common-thread-reading-room.json`, SHA-256
`ad43107a3adf91174cf89434fc798ad6546447d42e26cac72404ff3b36a91cfc`) and
anti-reference file (`anti-references/harbor-operations-wallboard.json`,
SHA-256 `2fae03ac4d59d79d16ed1e630d408f8fb25544ce4f8dc6b3e120e71bee4336bc`)
for provenance. Their contents are not sent to either model context. Do not
include them, personal Atlas entries, or project decision history in model
inputs.

The source checkout currently has uncommitted changes in `src/components/Footer.astro`
and `src/site-config.ts`. Those changes are excluded. The safe Git export is
made from the pinned commit, not the mutable checkout. Both arms receive
separate byte-equivalent snapshots of the same sanitized export, initialized as
fresh local repositories with identical starting trees. No source Git history
is copied, preventing unrelated history or previously tracked secrets from
entering either agent context. The Sanity Studio directory/repository is
outside the homepage experiment and excluded.

The application commit tracks `.env`. Its contents must not be read, copied, or
exposed to either agent. The safe export omits `.env`, `.env.example`, and
`studio/`; no environment file is copied. Both arms run with `CMS_SOURCE=local`
and use the same checked-in local content and media. No live CMS, site, network
reference, or deployment is used during design or capture. Do not inspect
secrets to decide whether they are present.

The UX audit includes some observations that are stale at the frozen source
commit, including the homepage leadership presentation and mobile-menu Escape
behavior. Both arms receive the document unchanged, but must treat it as a
dated audit rather than proof of current behavior. The frozen rendered site
and deterministic checks establish current behavior.

## Shared brief (human-approved)

Redesign the First Naga Baptist Church homepage to help first-time visitors
understand who the church is and confidently plan a Sunday visit, while also
serving existing members and communicating its Naga diaspora identity with
cultural care. Use verified project content and available imagery. Preserve
copy, routes, CMS-driven content relationships, and existing functionality. Do
not invent factual claims, visitor services, or product features. Follow the
frozen brand and UX documents, including their explicit cultural and
accessibility constraints.

No arm may edit non-homepage routes except shared header/footer code required
for the homepage. All changes must remain in that arm's isolated copy.

## Shared inputs and unequal process treatment

Both arms receive the same source snapshot, brief, frozen project documents,
reference set, required behaviors, local data/assets, frozen `frontend-design`
skill, and flattened default Floor/Rails/Compass guidance. Neither receives the
private personal atlas, Expense Tracker decision history, or the other arm's
artifacts.

**A — Direct-design baseline:** the same Codex agent/model and tools use the
shared skill and inputs to plan, critique, implement, and verify the homepage
directly. The agent may reason about alternatives, but is not required to
produce three direction artifacts or use Dorkflow gates. No Dorkflow
artifacts, evidence-linked critique contract, human design gate, decision
graph, implementation contract, or Dorkflow verification gate are used.

**B — Dorkflow:** the same Codex agent/model and tools follow the frozen
Dorkflow process through B2–B9. The agent receives only the stage inputs
prepared by Dorkflow and cannot skip the human gates. The human may decide at
B5/B6/B9; every intervention and its duration is recorded.

Use fresh, isolated agent contexts and separate workspaces. Do not show either
agent the other arm's prompt, artifacts, code, or screenshots before both
implementations are frozen. Record the model/agent identity as observed; do not
claim an exact model snapshot if the Codex surface does not expose one.

The user's B5/B6 participation means the same project owner will know the
Dorkflow process and may recognize its output. This run therefore cannot claim
a genuinely blind owner preference test. Final captures will still be shown as
neutral, randomly ordered Variant A/Variant B, and the owner will record visual
judgments before inspecting newly prepared process summaries; this is a
masked, exploratory comparison only.

Arm order is fixed: finish and locally commit Arm A first, record its output
hashes, and withhold its code, screenshots, and process log from the fresh Arm B
agent context. Then run Arm B from the same clean starting commit. This is
operator-enforced separation, not an OS security boundary: the agents share a
host filesystem, so the operator must provide only each arm's assigned paths
and must not include Arm A output in Arm B's context. Each arm uses a fresh
Codex subagent context with no model override (same inherited default model
setting and tool family); the exact underlying model snapshot is not exposed
here and must be reported as unknown unless the runtime identifies it. The
expected difference is Dorkflow's process and gates, not provider, brief,
project guidance, reference evidence, or local development tools.

## References

Human decision: use only the two frozen project documents and the source site's
existing imagery/content. No external visual references are included. The
brand and UX documents are shared project inputs, not Dorkflow-only context.

## Required behavior and common capture states

The common hard requirement inventory is fixed as:

| Requirement | Invariant | Frozen verification evidence |
| --- | --- | --- |
| `FNBC-COPY-01` | Preserve all existing user-visible homepage copy and meaning; rearrangement is allowed, rewriting/addition/removal is not. Normalize only whitespace and date-derived service-time text for comparison. | Exact visible-text multiset comparison against control at all seven widths, plus human review for meaning/context. |
| `FNBC-LINKS-01` | Preserve existing homepage/header/footer destinations and link purpose; local routes resolve, and visit/directions actions retain their destination semantics. | Exact visible link-name/destination multiset comparison at all seven widths and local route-status checks. |
| `FNBC-CMS-01` | Keep homepage content, event, leadership, gallery, settings, image, and alt-text relationships bound to existing local CMS/data fields; do not hardcode replacements for CMS-driven content. | Source diff/code-path review and local-data build; report HUMAN-REVIEW where static/rendered evidence cannot prove a live CMS relationship. |
| `FNBC-FUNCTION-01` | Mobile navigation opens/closes by pointer and keyboard; Escape closes it and returns focus to the trigger; links remain operable. | Common Playwright pointer, keyboard-focus, and Escape/focus-return assertions. |
| `FNBC-FUNCTION-02` | Existing community carousel advances and reverses, identifies the current photo/caption, and remains keyboard-operable. | Common Playwright next/previous round-trip and active image/caption assertion; keyboard operation is checked in source/manual review. |
| `FNBC-RESPONSIVE-01` | No unintended horizontal overflow, clipping, overlap, or obscured controls at 320, 375, 480, 767, 768, 1024, and 1440 CSS px. | Common width sweep checks document overflow and offscreen interactive bounds. |
| `FNBC-RESPONSIVE-02` | Navigation and content remain usable at narrow, intermediate, and wide widths; exact breakpoints/layout values are not frozen. | Same-size screenshots, responsive DOM checks, and owner HUMAN-REVIEW. |
| `FNBC-A11Y-01` | Interactive elements have appropriate names/roles, keyboard paths, visible focus, and no color-only meaning; automated scan is supporting evidence, not a conformance verdict. | Common unnamed-control and focus/menu checks plus manual semantic, color-only, and keyboard review. No full WCAG conformance claim. |
| `FNBC-MOTION-01` | Respect reduced-motion preference without removing necessary state feedback or functionality. | Common reduced-motion contexts/screenshots and owner HUMAN-REVIEW of retained state feedback. |
| `FNBC-CONTENT-01` | Use only checked-in project content and imagery; introduce no feature, service, or unverified factual/cultural claim. | Copy/link comparison, source diff, shared project docs, and owner HUMAN-REVIEW. |
| `FNBC-BUILD-01` | The app builds from the frozen local source and locked dependencies without live CMS or external service access. | `bun install --frozen-lockfile`, local-content build, app tests, and route verifier; no network needed for tests/build. |

Each requirement is reported PASS, FAIL, HUMAN-REVIEW, or NOT-APPLICABLE with
evidence. A failed hard requirement cannot be hidden by an aggregate score.

The exact Dorkflow B1 input capture matrix is the nine-state matrix
`docs/experiments/b11-first-naga/input-state-matrix.json` (SHA-256
`882de082c966b5b6018aabdafa1d713c4f3fdba5be017aebdeed0dc7b21e4d7e`). Its successful run produced evidence id
`ev_42abf85b86e4851b` with environment SHA-256
`c61d6c2ec6e8d08feb5f72d221f31726d77a2265443b3412ddadb9cd772b6731` and evidence
manifest SHA-256
`772cfcc088cb7c575dfc212792bfceefc54d9905d132340fc7ae78b666971f22`. The
identical model-facing evidence folder is given to both arms. It contains only
trusted-project perceptual captures and their manifest; quarantine/debug
artifacts are excluded. The baseline receives these image/evidence bytes as
ordinary initial evidence, not as a Dorkflow process artifact.

The shared capture/state matrix is:

| Capture ID | Viewport / setup | Required observation |
| --- | --- | --- |
| `desktop-default` | 1440×900, initial | Homepage hierarchy, service information, events, community imagery, footer |
| `tablet-default` | 768×1024, initial | Intermediate layout and navigation behavior |
| `mobile-default` | 375×812, initial | Narrow composition and visible visit information |
| `mobile-menu-open` | 375×812, activate menu button | Expanded state, accessible name/state, link visibility |
| `mobile-menu-escape` | 375×812, open then Escape | Menu closes and focus returns to trigger |
| `mobile-menu-keyboard` | 375×812, keyboard activation/tab | Menu and links remain keyboard-operable with visible focus |
| `primary-cta-hover-focus` | 1440×900, hover and keyboard focus separately | Pointer/focus feedback for primary visit action |
| `carousel-next` | 1440×900, activate Next | Next photo/caption becomes current |
| `carousel-previous` | 1440×900, activate Previous | Previous photo/caption becomes current, including loop behavior if present |
| `reduced-motion` | 375×812 and 1440×900, reduced motion | Same content/state without nonessential motion |

The final post-redesign common verifier checks widths 320, 375, 480, 767, 768,
1024, and 1440 CSS px; inventories visible copy, destinations, and image alt
text at every width; captures the three standard default viewports plus
interaction/reduced-motion states; exercises navigation and carousel behavior;
checks reduced motion; and confirms internal route responses. Its exact source
is frozen by hash in `pre-run-inputs.json` and copied into the shared input
folder so either arm can run it without reading the Dorkflow repository. The
The exact frozen verifier was smoke-tested against the frozen control: 26
checks, zero hard failures (one control-inventory creation check marked
NOT-APPLICABLE), and ten captures; its self-comparison passed all 46 checks.
The reports and their hashes are recorded in `pre-run-inputs.json`. This is a
common check suite, not a complete accessibility audit.
The pinned dependencies have no axe package; names/focus/keyboard checks are
supporting evidence, while semantic, color-only, and assistive-technology
questions remain HUMAN-REVIEW.

All runs use DPR 1. The final common verifier freezes the browser clock at
`2026-09-30T17:00:00.000Z`. The original Dorkflow B1 capture engine does not
freeze the browser's native clock; that bounded limitation is recorded. The
checked-in page renders date-dependent schedule text from the fixed
server/build time.

The app's `.nvmrc` requests Node `22.21.1`; the host's Node executable reports
`24.21.0`, so both arms use Bun `1.3.14` for app commands (the repository
includes `bun.lockb`). Node is not used to run the app. The host is macOS `27.0` build
`26A428`, arm64. Dorkflow pins Playwright `1.62.1`, Chromium revision `1234`,
browser version `151.0.7922.34`. Browser context uses locale `en-US`, timezone
`America/Chicago`, color scheme `light`, reduced motion `no-preference` except
the reduced-motion row, and Dorkflow defaults for JavaScript, touch, and color
contrast preferences. The source imports local `Inter` and `Source Serif 4`
font packages; all 13 local WOFF2 files and their manifest hash are recorded in
the rendering-environment file and verified loaded at the three standard
viewports. A separate host-font inventory was not captured. Local font bytes
are pinned, while any fallback glyphs remain host-dependent. No remote font
requests are allowed.

Server/build time-dependent output is fixed to
`2026-09-30T17:00:00.000Z` (2026-09-30 12:00 CDT) using the experiment-only
preload helper at `docs/experiments/b11-first-naga/freeze-date.cjs`. This fixes
event ordering and year/date-dependent server rendering for both arms. The
final common verifier also fixes the browser clock to that instant. The earlier
B1 input evidence capture did not freeze the browser clock; this is a bounded
reproducibility limitation, not a claim that every historical capture step was
fully virtualized.

Both arms use identical runtime, source export, local content/media, and capture
settings. External requests are blocked during page capture; external links
may be inspected but not followed.

The standalone verifier, Playwright package, rendering-environment record,
frozen clock helper, shared brief, design guidance, B1 evidence, and original
copy/link inventory are staged byte-for-byte in one temporary common-input
bundle. The baseline is given that bundle directly and does not need to read
the Dorkflow repository to run its checks. Exact per-file hashes are recorded
in `pre-run-inputs.json`; no app source, profile archive, quarantine, or
redesign output is included in that shared bundle.

## Budget and intervention logging

Human decision: use a three-hour active-agent-time cap per arm, with
wall-clock active time, agent turns, tool executions where observable,
implementation and revision passes, and human time recorded separately.
Human interventions are classified as initial brief, Dorkflow stage decision,
factual clarification, implementation correction, or final review. The cap
is approved; permitted clarifications will be limited to resolving factual
questions using the shared project inputs, and each will be logged. Token
equality will not be claimed.

## Evaluation, masking, and interpretation

Human decision: the project owner is the sole reviewer; no outside reviewers
will be recruited for this pair. After both arms are frozen, capture the same
state matrix with the same rendering environment, content, and viewport
settings. Create a neutral comparison packet with variants randomly labeled
A/B. The owner records visual judgments before opening the final process
summaries. Because the owner participates in Dorkflow B5/B6, this is not a
blind evaluation and must be reported as such. Keep the random mapping sealed
until those judgments are recorded.

Review questions:

1. Which better helps a newcomer understand FNBC and plan a visit?
2. Which has clearer hierarchy and responsive transformation?
3. Which feels more specific to this church rather than a reusable template?
4. Which handles interaction states more coherently?
5. Which would you prefer the church to ship? A, B, or no meaningful
   preference; explain why.

After visual judgments are locked, evaluate both variants against the same
engineering checklist and apply the same post-hoc intentionality rubric to
significant visible choices. A significant choice is one affecting page
composition/section order, hierarchy, typography, color or financial/identity
cues, repeated component/surface language, cultural image treatment,
responsive rearrangement, or interaction/motion. Count a cohesive decision
once rather than counting every CSS property that implements it.

Classify each significant choice with a concise rationale and source pointer:

- **Project-supported:** explicitly required by the brief, frozen brand/UX
  documents, observed product behavior/content, or a recorded human decision.
- **Plausible but weakly supported:** a reasonable product-specific choice, but
  no direct source evidence clearly requires it.
- **Arbitrary/default-like:** lacks a product-specific rationale in the
  available evidence, conflicts with a requirement, or appears to be a generic
  template convention applied without contextual justification.

Apply this same rubric to both outputs after unblinding, using source diffs,
rendered states, and both process trails. It is qualitative owner judgment,
not an independent or deterministic score. Do not compare Dorkflow's internal
artifacts against undocumented baseline reasoning; inspect both process trails
only after visual judgments.

Record functional, accessibility, responsive, copy/content, and build checks
individually. Record correction timing and process overhead. Do not reduce the
result to a universal taste score.

Possible qualitative conclusions are PROMISING, MIXED, NO EVIDENCE, or
NEGATIVE, based on the preregistered evidence and cost of process. PROMISING
requires the owner to prefer Dorkflow or judge it to materially reduce
arbitrary choices without unacceptable process overhead, with no hard
engineering regression. MIXED means preference is tied/uncertain but the
process surfaces concrete issues earlier or improves traceability/verification.
NO EVIDENCE means no meaningful quality or process advantage is observed.
NEGATIVE means the baseline is preferable and substantially cheaper/easier, or
Dorkflow harms quality. The owner will judge acceptability of overhead and
explain the evidence; these are not numerical thresholds. This single pair is
a case study, not proof of consistent improvement; later paired runs on other
interfaces are required for broader claims.

## Pre-run freeze checklist

- [x] Human approves the shared brief and homepage-only scope.
- [x] Reference set is fixed to the two frozen project documents and checked-in content/assets; no external references.
- [x] Three-hour active-agent caps and factual-clarification rule are fixed.
- [x] Sole-owner masked comparison is fixed; do not claim reviewer blinding.
- [x] Exact shared behavior/copy/function inventory and capture states are fixed.
- [x] Safe identical source snapshots are produced from the pinned commit with `.env`, `.env.example`, and `studio/` excluded; both fresh arm worktrees are clean at the same commit.
- [x] Bun, browser, OS, local app-font bytes, locale/timezone, clock, viewport, and DPR are recorded; missing host-font inventory/container digest are explicit limitations.
- [x] Default profile file hashes are recorded; the nonmatching local clone,
      personal Atlas contents, and cross-project history are excluded.
- [x] Dorkflow treatment commit is verified unchanged at `f8b284b`.
- [x] The current common verifier passes its final loopback control self-check.
- [x] This plan and its input manifest contain exact hashes; their Git
      commit/push is the remaining operational gate before either arm starts.
