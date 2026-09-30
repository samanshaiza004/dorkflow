# Phase B — Executable Design Process

## Purpose

Test whether a capable agent makes more intentional, less arbitrary design
decisions when it must preserve intent, evidence, human judgments, and
verification results in explicit artifacts. Phase B is developed alongside
the Phase A System Recovery subsystem. SystemRecovery is an optional input to
the design process, not a prerequisite for defining intent, references,
directions, critique, or human decisions.

The stable interface is the artifacts and gates, exposed first through the
CLI/file handoff. The default executor is the user's existing agent; Dorkflow
does not normally invoke or select a model. This experiment-specific CLI is a
protocol surface, not a polished distributable product.

## Milestones

### B0 — Artifact contracts

Add strict Zod contracts for `DesignIntent`, `ReferenceSet`, `StateMatrix`,
`PerceptualEvidence`, `SystemModel`, `DesignDirection`, `CritiqueReport`,
`HumanDecision`, `DesignDecisionGraph`, `ImplementationContract`,
`VerificationReport`, and `DesignRun`. Persist each artifact as inspectable
JSON with a schema version, opaque identifiers, evidence references, and
content hashes where applicable.

### B1 — State-aware evidence capture

Use the pinned Phase A Playwright environment. A state definition names its
page, viewport, setup actions, target, and expected state. Capture default,
hover, focus-visible, active, disabled, open/closed, empty, error, loading,
and selected states only where the interface supports them. Avoid expanding
coverage without a concrete product need.

Store original page captures in quarantine. Create model-facing perceptual
captures only through the selected trust mode. Continue to send only the
Phase A sanitized observation format to system-recovery inference.

The `sanitized-external` v1 transform creates geometry-placeholder spans only
for light-DOM text. Playwright's screenshot stylesheet also pierces Shadow DOM
to suppress shadow-rendered text, but those nodes are not wrapped in geometry
placeholders; text-derived layout inside a shadow root can therefore collapse.
This is a defensive evidence transformation, not proof that arbitrary remote
pixels are safe. Remote reference ingestion remains disabled until capture is
network-isolated.

### B2 — Intent and reference attribution

Record freeform rationale alongside audience, jobs, attributes, constraints,
existing strengths/problems, and anti-references. Every reference records
what to use and what not to use; a reference is not a general style prompt.
Each intent statement and attributed reference aspect has its own opaque ID so
design choices cite the exact reason or precedent, not an entire document.

An optional local Git-backed Design Profile can supply reusable Floor, Rails,
and Compass guidance. Its concrete local Git revision, clean/dirty state, and
hashes of all manifest-listed inputs are recorded. Only Floor/Rails/Compass
are projected into model context; Atlas entries and anti-references are
validated but not automatically included. A human still selects project
references in the existing `ReferenceSet`. No profile is required, and this
does not change prior B2-B6 experiment decisions.

### B3 — Design directions

Produce three substantively different design hypotheses before producing
implementation code. Each direction states its thesis, type, palette,
spatial model, density, layout, surfaces, borders, imagery, motion, preserved
decisions, changed decisions, uncertainty, and supporting intent/evidence
references. A deterministic axis comparison flags pairs that differ on
fewer than three strategy categories. Density and surface model use controlled
vocabularies (with a reasoned `other` option); other axes remain open slugs.
Choices cite exact intent statements, reference aspects, rendered-state
capture IDs, or selected Design Profile item IDs. This checks normalized
labels, not creative distinctness.

### B4 — Evidence-linked critique

Critique each direction for necessity, product specificity, consistency,
exceptions, dependencies, and unsupported defaults. Each finding cites typed
intent, reference-aspect, profile, system, or exact state-capture refs and
includes a proposed resolution. The critic classifies each choice as
supported, weakly supported,
or unsupported/default-like. A familiar visual pattern is not inherently
wrong; the question is whether this product's intent supports it. The
unsupported-choice rate is a diagnostic, not a universal taste score or
ground-truth judgment. Choice assessments accept only source-grounding
references; a generated choice cannot cite itself or another generated choice
as proof of its own support. `citationCompleteCount` means only that every
choice has a structurally valid source citation; the critic separately judges
whether that citation supports the choice.

### Stage executor and run records

The default file handoff prepares a stage-specific input, instructions, and
response schema for an existing agent, then accepts a bounded regular JSON
file. Dorkflow checks the strict Zod contract, citations, input hashes, and
stage order before opening the next stage. Stage receipts record Dorkflow-
computed input/instructions/schema/output hashes and preparation/submission
times. Agent/model identity and versions are nullable and explicitly
agent-reported; this path does not claim tool isolation, API token usage,
model snapshots, or exact model invocation timestamps. Its reproducibility
class is weaker than a controlled direct call.

The direct OpenAI Responses caller remains an optional BYOK/headless adapter.
Its separate `ModelInvocation` records only metadata returned by or known to
that actual call. Neither path requires a generalized provider framework.
Model-facing context stores local paths to verified screenshots, not inline
base64 payloads or quarantine files. A local agent may have filesystem access
outside this handoff, so the CLI protocol is not a security sandbox.

### B5 — Human review and decisions

The human reviews a JSON packet pairing each direction with its critique,
attributed intent/references, trust-mode metadata, and only the cited
model-facing captures. Captures are copied from verified model-facing bytes
into the process-run folder; the packet also validates their hashes before
read/write. `review/packet.json` is paired with a canonical `packet.sha256`.
A create-once `review/decision.json` can hold multiple
accept/reject/revise/prefer decisions, each with rationale and resolvable
subjects; pairwise choices cite both directions. The record carries the
packet hash so decisions cannot silently drift onto a changed review. The
local CLI reports a hard stop until the human submits a validated decision;
an agent cannot silently satisfy this gate. No GUI or universal taste score
is involved.

When the exact frozen control is available, make it directly reachable beside
the candidate under the same pinned rendering environment. Never ask a human
to evaluate a redesign from memory alone. A simple index with separate control
and candidate routes is sufficient; a compare UI is not required.

### B6 — Decision graph and consolidation

Store the links among intent, evidence, references, decisions, interface
properties, and human judgments as ordinary JSON. Consolidation checks
whether repeated human corrections imply a system-level rule and records
explicit exceptions. A human reviews the proposed candidate against a directly
reachable frozen control, not from memory alone. Each unresolved claim becomes
an explicit evidence request with required viewport/state, proof criteria,
capture references, and a human outcome. A captured state is not treated as
approved merely because deterministic assertions passed. Preserve accepted
parts of a direction separately from localized revise/borrow/reject decisions;
do not freeze B7 while any required revision evidence remains under human
review.

### B7 — Implementation contract

Freeze the human-approved direction and behavior in a versioned
`ImplementationContract`: component anatomy, state and responsive rules,
accessibility and preservation requirements, and any explicit exceptions.
Bind the contract to its originating decision IDs and evidence bundles. Do not
promote unreviewed prototype values into approved tokens; empty token or motion
sections are valid when no such values or behaviors were explicitly approved.
Record run, candidate, review, profile, rendering-environment, and artifact
hashes in run provenance alongside the contract. Contract freeze does not
itself implement the redesign or mean verification has passed.

### B8 — Implementation boundary

Keep design exploration separate from source-repository writes. The
implementation agent receives the frozen contract, exact source base, exact
control revision, and approved candidate/captures as reference evidence. Its
task is to implement frozen relationships, states, and preservation
requirements while exercising judgment only where B7 explicitly left values
provisional.

The implementation boundary is:

- **Must:** preserve existing behavior/copy; implement approved responsive
  ordering and component relationships; implement reviewed rest/hover/active/
  focus behavior; satisfy the contract's accessibility and preservation
  requirements.
- **May choose:** exact breakpoint, colors, spacing, font sizes, radii,
  shadows, and column ratio where the contract left them open.
- **Must not:** reinterpret approved B6 decisions, add product features or
  visible copy, promote prototype CSS into approved tokens, or silently alter
  the contract.

Before B9, write an implementation receipt containing source base commit,
implementation commit, contract hash, files changed, requirement-to-change
mapping, choices made in provisional areas, and known uncertainties. The
receipt is provenance, not evidence that verification passed. If Penpot is
used, every write batch requires a successful checkpoint; design agents
cannot write the source repository and implementation agents cannot mutate
Penpot.

### B9 — Verification

Re-run the state matrix after real content is injected in four passes:

1. **Contract fidelity — hard gate.** Check each requirement ID and attach
   deterministic evidence for behavior, copy, state, responsive relationships,
   and preservation. A summary percentage cannot hide a failed requirement.
2. **Responsive sweep — hard gate.** Check the chosen breakpoint and its
   adjacent widths, plus narrow/intermediate/wide states, for approved
   ordering, usable controls, and unintended overflow. Capture representative
   states in the frozen rendering environment.
3. **Accessibility and behavior — hard gate where deterministic.** Verify
   keyboard operation, accessible names, target geometry, focus visibility,
   applicable contrast, non-color cues, reduced-motion behavior, and preserved
   product interactions. Record any check requiring human judgment separately.
4. **Perceptual review — diagnostic/human judgment.** Keep the exact frozen
   control, approved B6 candidate, and B8 implementation available for direct
   comparison under the same rendering environment. Pixel similarity to the
   prototype is not a pass/fail criterion when B7 deliberately left values
   provisional; review whether implementation preserved approved intent and
   explain material differences. Never ask the reviewer to judge from memory
   when the exact alternatives are available.

The perceptual critic reports findings; it does not rewrite the approved
design. A visual discrepancy is not automatically contract failure, and a
passing screenshot diff cannot substitute for contract, behavior, or
accessibility checks.

### B10 — Project decision history

Keep accepted and rejected decisions with their reasons as project-local
artifacts. Retrieve those precedents in later work without converting them
into claims about a person's general taste.

### B11 — Paired baseline experiment

Compare a strong frontend-design baseline against Dorkflow on the same
functional open-source page. Keep model version, start repository, brief,
references, tools, and time/token budgets consistent; record human review
time and interventions. Repeat paired runs when practical. Blind-review the
results, then inspect the decision trails and objective verification.

## Gates

### Engineering gate

Phase B's engineering gate passes only when:

- a complete run can be reproduced from its manifest and frozen inputs;
- every major accepted decision traces to intent or evidence and to the
  implementation contract;
- human decisions remain intact through implementation;
- design and implementation write permissions are separated;
- supported states are captured before and after implementation;
- deterministic verification runs after real-content injection;
- approved visual states can be saved as regression baselines.

### Product hypothesis

The product experiment reports blind preference, reasons for preference,
human time, intervention count, unsupported/default decisions found, and
later inconsistencies traced to missing decisions. Multiple paired runs are
needed before claiming the process consistently improves outcomes. No
single composite aesthetic score determines success.

## Scope limits

Use TypeScript, Bun, Playwright, Zod, and ordinary files. Do not add a
database, GUI, orchestration framework, generalized provider abstraction,
autonomous multi-agent system, Penpot requirement, PR automation, or
client-management system during Phase B. Keep CLI and any future MCP
transport as thin adapters over the same core gates.

## Implementation checkpoint

The current working slice implements versioned B0 contracts, a narrow B2-B4
generation/critique seam, exact intent/reference provenance, a deterministic
three-direction strategy-category gate, per-choice evidence critique, an
optional direct API runner, and a default existing-agent file handoff. The
handoff validates exact JSON envelopes and citations, records external-stage
hashes without inventing API metadata, blocks critique when the diversity
gate fails, creates the B5 packet after critique, and preserves the separate
human-decision stop. The API path records each invocation separately so
self-critique is identifiable from an independent critic. The B1 Playwright
demo exercises desktop/mobile default, hover, focus-visible, open-menu, and
form-error states. Original pixels are
quarantined for sanitized-external mode; model-facing evidence contains
light-DOM geometry-placeholder renders, suppressed Shadow DOM text, and safe
state/viewport/trigger metadata. Shadow DOM text-derived geometry may collapse.
The process writer copies only verified model-facing image bytes into its
immutable run folder and records their hashes; it never copies quarantine
files.
The run records and checks the exact current browser, OS, and font fingerprint;
Chromium sandboxing, an origin allowlist, GET/HEAD-only requests, blocked
WebSockets, and capture-size limits are also recorded as capture policy.
The current runner is loopback-only; remote reference ingestion remains
disabled until a network-isolated crawler boundary is available.

The experiment-specific file interface currently targets the frozen Expense
Tracker bundle rather than serving as a general CLI. It does not implement
design or implementation sandboxing, implementation, or verification
stages. Structural Phase A measurements are not yet paired with these
captures. A real-page B2-B5 rehearsal was followed by a manual B6 hybrid that
preserved the human's cross-direction synthesis. B6 revision 2 was reviewed
against a directly reachable frozen control; all seven explicit evidence
requests were marked reviewed/satisfied, and B7's contract is now frozen.
The contract contains no approved token values; exact prototype colors,
spacing, type sizes, radii, shadows, column ratios, and the 720px prototype
breakpoint remain provisional. B8 chose a separate provisional 700px stack
breakpoint and kept implementation values literal rather than naming them as
tokens. B8 implementation is complete in a separate local checkout.

B9 records one explicit result for each of the 22 frozen B7 requirements, with
deterministic evidence and a separate three-way human review packet. The first
review led to two implementation refinements inside B7's deliberately
provisional styling scope: strengthening the redundant transaction-polarity
edge cue and removing the unnecessary Income/Expense divider. The control,
B6 candidate, B7 contract, layout, type hierarchy, and delete styling were not
changed. The revised machine result has no failed assertions (18 requirements
pass and 4 await human review); the overall result remains `REVIEW-PENDING`,
not PASS. See
[`docs/experiments/phase-b-expense-tracker-b9-verification.md`](experiments/phase-b-expense-tracker-b9-verification.md)
and its preserved initial/revised run artifacts.
The response JSON Schemas now include the profile reference kinds accepted by
the runtime contracts, with regression coverage. The workflow's broader
usefulness and the Phase B product hypothesis have not been established.

The B2-B6 Expense Tracker rehearsal and its current review boundary are
recorded in
[`docs/experiments/phase-b-expense-tracker-default-profile-b2-b6.md`](experiments/phase-b-expense-tracker-default-profile-b2-b6.md).
The resulting human approval and frozen B7 contract are summarized in
[`docs/experiments/phase-b-expense-tracker-b7-contract.md`](experiments/phase-b-expense-tracker-b7-contract.md).
The B8 implementation is in a separate local checkout at commit
`2400196c9a7d3a64554b517d5364fc739d4acf49`; its receipt records the exact
base, contract hash, changed files, provisional choices, and smoke evidence.
A narrowly scoped B9 refinement follows at
`ee7e2167a1f85200c57136defda3a2e79ef791b9`. Its browser/build checks pass, but
human review of the revised polarity cue, separator removal, and post-submit
mobile state remains pending. The B9 report is not yet a completed human gate.
The experiment has not established that Dorkflow improves design quality or
passes the Phase B product hypothesis.
