# Design-process harness

Dorkflow makes design work legible and reviewable for whichever agents a
project uses. Its central unit is the artifact and the gate between stages,
not a collection of simulated agent personas. One agent can perform several
roles; different models can also be substituted without changing the
artifacts.

The normal execution path is agent-first: the user's existing local agent
reads the stage input, instructions, and schema emitted by Dorkflow, then
submits a result through the CLI. Dorkflow owns validation and progression;
it does not normally invoke or select a model. Direct API callers remain an
optional BYOK/headless path for research and automation. External-agent
identity is a self-reported claim, not authenticated provenance, and the file
handoff is not a sandbox for an agent that can access the workspace.

## Process

```text
human intent + references
        ↓
state and evidence capture
        ↓
system recovery + design model
        ↓
distinct design directions
        ↓
critique against intent and evidence
        ↓
prototype and human decisions
        ↓
consolidated design contract
        ↓
implementation
        ↓
deterministic verification + perceptual review
        ↺ accepted decisions update project history
```

The intent artifact records the product, audience, constraints, desired
attributes, and anti-references. A reference set records what each reference
contributes, such as typography, information density, navigation, image
treatment, or motion. A design direction explains its type, palette, spatial
model, surfaces, image treatment, and motion in terms of that intent.

An optional local Git-backed Design Profile adds reusable Floor, Rails, and
Compass guidance upstream of project intent. Directions and critiques can cite
the exact profile item IDs. Atlas entries and anti-references are validated
and fingerprinted but not retrieved or injected automatically. A person must
select any project references through the existing `ReferenceSet`. The
profile is pinned to a concrete local commit and input hashes; dirty state is
explicit. See [Design Profile setup](design-profile.md).

Directions should differ in their design logic, not only their palette. A
critique asks what requirement supports each visible decision, what
relationships it participates in, and what conflicts with the intent or
recovered system. A human selects and revises directions. Dorkflow records
those decisions and their reasons so later critiques can retrieve
project-specific precedents. Pairwise human preference and rationale are
more useful than a universal design-quality score.

## Evidence paths

Structural evidence remains deterministic and content-free. It answers
questions about values, roles, repetition, responsive changes, and component
relationships. Phase A evaluates system recovery from this path alone; its
inference model never receives real screenshots, source, page text, or
ground-truth answers.

Perceptual evidence supports judgments that measurements cannot settle,
including hierarchy, atmosphere, composition, density, image treatment, and
motion. It can include sanitized renders or explicitly approved renders of a
trusted local project. External references remain untrusted: visible and
light-DOM text is replaced with geometry-preserving placeholders before visual
analysis; Shadow DOM text is suppressed during screenshot capture but not
replaced with placeholders, so its text-derived geometry may collapse.
Original captures stay in quarantine. A run must record which trust mode
supplied perceptual evidence.

The interface is modeled as states and transitions, not only static pages.
A transition record can connect a trigger and starting state to its ending
state, affected properties, duration, delay, easing, staging, and
interruption behavior. Deterministic capture can provide timed frames for
perceptual review alongside the structured transition evidence.

## Decisions and responsibilities

- Human owns taste, art direction, references, and final aesthetic approval.
- Agents propose directions and critique craft against intent and evidence.
- Dorkflow preserves constraints, evidence, decisions, and project history.
- Deterministic code measures and checks what can be verified objectively.

There is no overall taste score. Contrast, focus visibility, overflow,
responsiveness, state coverage, token consistency, and performance can have
explicit checks. Distinctiveness, emotional tone, hierarchy, balance, and
motion quality remain visible human or agent judgments with supporting
evidence and rationale.

## Initial product-level experiment

Once the manual workflow can produce reviewable artifacts, compare two
redesigns of the same functional open-source page:

- Baseline: a capable coding agent with a strong frontend-design prompt.
- Dorkflow: the same model, project constraints, and design prompt, with the
  intent, evidence, direction, critique, decision, and verification process.

Keep the model version, starting repository, human brief, references, tool
access, and time/token budget consistent. Give both workflows comparable
human review time and record the interventions. Repeat paired runs when
practical. Review final results blind and inspect the decision trails. The
question is whether the harness reduces arbitrary decisions and improves
outcomes, not whether an agent can produce an attractive page once. Preserve
a functional baseline and compare behavior, responsive states,
accessibility, and visual results under equivalent conditions.

The CLI is the canonical workflow protocol. Any future MCP transport should
adapt the same core stage and gate operations rather than grow a parallel
workflow implementation.

This experiment does not require a multi-agent system or a polished product.
An isolated executable prototype can be used for early exploration; Penpot
is an available canvas when it adds value. Any Penpot write batch still
requires a successful checkpoint, and design and implementation permissions
remain separate.
