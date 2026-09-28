# dorkflow Phase A plan

This plan covers the system-recovery subsystem of the broader
design-process harness. Passing its hidden benchmark establishes only that
the inference pipeline can recover exercised design-system concepts under
the frozen benchmark conditions; it does not establish that Dorkflow
improves end-to-end redesign quality or reduces arbitrary design decisions.
That product-level question has a separate paired workflow experiment.

## Hypothesis

Can a design-engineering model recover deliberate primitives, semantic
roles, and component relationships from rendered website evidence after all
content and source identifiers have been removed?

USWDS is a calibration benchmark only. It measures whether the pipeline can
reconstruct a real documented system, but its public nature means model
training-data contamination is possible.

The substantive Phase A kill gate is a locally generated hidden benchmark.

## Benchmark roles and lifecycle

The hidden benchmark has two roles:

- `development`: seed and source may be revealed after scoring and used for
  debugging and tuning;
- `sealed-holdout`: source, seed, definitions, and ground truth remain
  inaccessible until inference and scoring are complete.

Every holdout follows this lifecycle:

```text
CREATED -> SEALED -> EVALUATED -> REVEALED
                         \-> BURNED
```

If any implementation, prompt, extraction logic, inference logic, scoring
logic, or threshold changes after a sealed holdout is evaluated, that
holdout is burned. It cannot be reused as a fresh kill-gate input.

The tooling accepts a benchmark as a kill-gate input only when it is a
sealed holdout with a valid evaluation lock. Revealed and burned benchmarks
are terminal for kill-gate use.

The preferred final decision uses two or three independent unseen holdout
seeds. A development seed is never counted toward PASS.

## Hidden-system recipe

The generator creates ordinary static web pages from a versioned coherent
design-system recipe. The recipe contains primitive, semantic, and
component layers, typography, spacing, color roles, radii, shadows,
responsive rules, reusable components, representative pages, and states.

A recorded deterministic seed randomizes identifiers and values while
preserving coherence constraints such as scale ordering, contrast,
component reuse, and responsive relationships.

The rendered implementation intentionally contains both design-system
values and controlled debris:

Intentional cases:

- high-reuse primitive;
- low-reuse semantic token;
- legitimate singleton component token;
- responsive-only token;
- interaction-state-only token.

Incidental cases:

- accidental singleton;
- repeated accidental value;
- local hard-coded override;
- near-duplicate spacing, color, or radius;
- one-off shadow or border;
- inherited or browser-default value where appropriate.

Ground truth explicitly classifies each exercised value or relationship as
intentional or incidental. Occurrence count is recorded as evidence, never
as the classification rule.

The inference subprocess receives only the sanitized observation bundle.
It cannot read the generator, rendered source, seed, ground truth, or
benchmark metadata.

## Frozen inputs

Normal benchmark runs use only immutable local rendered bundles. Each
bundle contains the exact HTML, CSS, assets, fonts, and runtime inputs,
plus content hashes and browser/viewport metadata. A hash mismatch aborts
the run.

For a sealed holdout, the rendered bundle is private input too: it lives
alongside the seed, instantiated source, and ground truth under the
external `DORKFLOW_SEALED_STORE/<benchmark-id>/` directory. Only the
isolated crawler is granted access to that directory. The coding agent and
inference process receive no raw rendered files; the inference process gets
only the sanitized observation artifact.

Live USWDS pages are used only to intentionally create a new calibration
bundle version. A7/A8 never depends on the live site or Storybook.

## Evaluation freeze

Before any live inference result is viewed, the following are frozen:

- both ground-truth datasets;
- exercised concept lists;
- importance weights;
- semantic-equivalence rules;
- deterministic matching logic;
- thresholds;
- manual adjudication rubric;
- evaluator version and hashes;
- benchmark bundle hashes.

The lock is recorded in `evaluation-lock.json`. No evaluation input or
matching rule may be changed after live inference begins.

## Metrics

Recall for primitives, semantic roles, and component relationships is
weighted by the explicit ground-truth importance weight:

```text
weighted recall =
  sum(weight of matched ground-truth records)
  / sum(weight of all exercised ground-truth records)
```

Proposal precision is proposal-oriented and does not use singleton status:

```text
proposal precision = matched proposed token claims / all proposed token claims
false-token rate = 1 - proposal precision
```

Matching is deterministic and one-to-one. A repeated accidental value can
therefore be false, and a singleton intentional token can be correct.

Required hidden-benchmark metrics:

- intentional-token recall;
- primitive recall;
- semantic-role recall;
- component-token relationship recall;
- proposal precision;
- false-token rate;
- precision by occurrence count;
- legitimate-singleton recovery;
- repeated-incidental rejection;
- zero missed major exercised concepts.

PASS requires the hidden benchmark to meet the frozen thresholds: 80%
primitive recall, 75% semantic-role recall, 75% component-relationship
recall, false-token rate at or below 20%, and no missed major concepts.

## Trust boundary

Crawler and quarantine artifacts are untrusted. Deterministic extraction
creates a strict allowlisted observation bundle. The model receives only
that bundle. Screenshots, text, attributes, URLs, classes, IDs, CSS
variables, source, and provenance are excluded.

Ground truth is read only by a separate deterministic evaluator after
inference completes.
