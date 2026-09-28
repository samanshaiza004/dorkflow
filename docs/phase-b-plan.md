# Phase B — Executable Design Process

## Purpose

Test whether a capable agent makes more intentional, less arbitrary design
decisions when it must preserve intent, evidence, human judgments, and
verification results in explicit artifacts. Phase B is developed alongside
the Phase A System Recovery subsystem. SystemRecovery is an optional input to
the design process, not a prerequisite for defining intent, references,
directions, critique, or human decisions.

The stable interface is the artifacts. Providers, agent frameworks, and a
polished CLI are outside this phase.

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

### B2 — Intent and reference attribution

Record freeform rationale alongside audience, jobs, attributes, constraints,
existing strengths/problems, and anti-references. Every reference records
what to use and what not to use; a reference is not a general style prompt.

### B3 — Design directions

Produce three substantively different design hypotheses before producing
implementation code. Each direction states its thesis, type, palette,
spatial model, density, layout, surfaces, borders, imagery, motion, preserved
decisions, changed decisions, uncertainty, and supporting intent/evidence
references. A deterministic axis comparison flags pairs that differ on
fewer than three categorical strategy axes.

### B4 — Evidence-linked critique

Critique each direction for necessity, product specificity, consistency,
exceptions, dependencies, and unsupported defaults. Each finding cites
intent, reference, system, or state evidence and includes a proposed
resolution. A familiar visual pattern is not inherently wrong; the question
is whether this product's intent supports it.

### B5 — Human review and decisions

The human manually accepts, rejects, revises, or prefers directions and
records reasons. Support pairwise preference with rationale; do not reduce
it to a universal taste score.

### B6 — Decision graph and consolidation

Store the links among intent, evidence, references, decisions, interface
properties, and human judgments as ordinary JSON. Consolidation checks
whether repeated human corrections imply a system-level rule and records
explicit exceptions.

### B7 — Implementation contract

Freeze the approved direction, tokens, component/state/motion/responsive
rules, accessibility and preservation requirements, and explicit
exceptions. The contract links back to its evidence and decisions. Changes
after approval require a new recorded decision.

### B8 — Implementation boundary

Keep design exploration separate from source-repository writes. The
implementation agent receives the approved contract and source repository;
it cannot silently rewrite human intent or approved decisions. A local
prototype can be used without Penpot. If Penpot is used, every write batch
requires a successful checkpoint; design agents cannot write the source
repository and implementation agents cannot mutate Penpot.

### B9 — Verification

Re-run the state matrix after real content is injected. Deterministically
check behavior, responsive overflow, focus/keyboard behavior, accessibility,
copy preservation, contract/token validity, and rendering-environment
identity. Compare approved and implemented visual baselines, then use
perceptual critique to identify changes in hierarchy, balance, density,
imagery, or motion. Perceptual critique reports findings; it does not
rewrite the approved design.

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
database, GUI, orchestration framework, provider abstraction, autonomous
multi-agent system, Penpot requirement, PR automation, or client-management
system during Phase B.

## Implementation checkpoint

The current working slice implements the versioned B0 artifact contracts,
the deterministic three-direction strategy-axis gate, and an initial B1
Playwright state-capture path. The B1 demo exercises desktop/mobile default,
hover, focus-visible, open-menu, and form-error states. Original pixels are
quarantined for sanitized-external mode; the model-facing evidence contains
only geometry-placeholder renders plus safe state/viewport/trigger metadata.
The run records and checks the exact current browser, OS, and font fingerprint;
Chromium sandboxing, an origin allowlist, GET/HEAD-only requests, blocked
WebSockets, and capture-size limits are also recorded as capture policy.
The current runner is loopback-only; remote reference ingestion remains
disabled until a network-isolated crawler boundary is available.

This is a capture foundation, not the complete B1 integration: structural
measurements from Phase A are not yet paired with these captures, and the
design-direction, critique, human-review, implementation, and verification
stages remain unimplemented. The Phase B product hypothesis has not been
tested.
