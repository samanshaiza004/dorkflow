# Dorkflow — Design Workflow

Dorkflow is an experimental, agent-agnostic design-engineering harness. It
connects human intent, rendered evidence, design proposals, human decisions,
implementation, and verification through explicit artifacts and gates.

Dorkflow does not replace human art direction or assign a universal taste
score. Agents propose and critique design decisions; Dorkflow preserves the
intent and evidence behind them; deterministic checks verify what can be
measured.

## The process

```text
intent + attributed references
        ↓
state-aware evidence capture
        ↓
system recovery + design model
        ↓
distinct directions + evidence-linked critique
        ↓
human choice + recorded rationale
        ↓
implementation contract
        ↓
implementation + deterministic and perceptual review
```

Artifacts are the stable interface between replaceable agents. The user's
existing agent is the default stage executor: Dorkflow prepares a frozen
context, instructions, and schema, then validates the submitted artifact and
controls stage progression. Normal use does not require an API key or a
Dorkflow-owned model account. A narrow direct API runner remains optional for
BYOK/headless experiments; it is not the normal workflow. A single agent may
perform several roles; Dorkflow does not require an agent swarm, database,
GUI, or design canvas.

## Current work

- **Phase A — System Recovery:** tests whether deliberate design-system
  structure can be inferred from sanitized structural evidence, including
  controlled intentional and incidental values. USWDS is calibration; sealed
  generated benchmarks determine this subsystem's result.
- **Phase B — Executable Design Process:** builds a manual, reproducible
  workflow and tests whether its artifacts and review gates improve an
  actual redesign over the same agent using a strong frontend-design prompt.
  Phase B can use an incomplete System Recovery result as an optional input.
  It also accepts an optional local Git-backed Design Profile: Floor, Rails,
  and Compass become model-facing guidance; Atlas references remain manually
  selected through the project reference set. The starter is staged at
  [`templates/dorkflow-design-atlas-template`](templates/dorkflow-design-atlas-template/README.md).
  See [Design Profile setup](docs/design-profile.md). This does not claim
  success for the Phase B product experiment.
  Its first B2-B5 slice validates exact intent/reference citations, gates
  direction diversity before critique, and reports unsupported-choice
  diagnostics. File-based agent handoffs fingerprint each stage's input,
  instructions, schema, and submitted output. Reported agent identity is
  explicitly unverified; Dorkflow does not pretend to know API-only metadata
  such as token usage or model snapshots. A B5 packet records the human's
  decision against the exact reviewed directions and captures. The optional
  OpenAI Responses caller is retained for API-key-backed research runs.
- **Phase C — Productization:** considered only after the subsystem and
  product-level experiments succeed.

Structural evidence contains deterministic measurements and relationships.
Perceptual evidence contains rendered captures for judgments such as visual
hierarchy and atmosphere. Phase A inference receives structural evidence
only. Captures from untrusted source pages are sanitized before perceptual review;
original pixels from trusted or generated local projects require explicit
approval. The sanitized evidence records its rendering-environment hash,
viewport, state kind, safe trigger types, and sanitizer hash—but not page copy,
selectors, source URLs, or arbitrary source identifiers.
The B1 browser runs with Chromium's sandbox, origin-allowlisted GET/HEAD
requests, blocked WebSockets, and bounded capture dimensions.
For now the capture runner accepts loopback sources only. Remote reference
ingestion stays disabled until the browser can run behind a network-isolated
crawler boundary; a downloaded/frozen page can be served locally meanwhile.

See [the Phase A experiment](docs/phase-a-plan.md),
[the Phase B implementation plan](docs/phase-b-plan.md), and
[the harness architecture](docs/design-process-harness.md).

## Development

Requirements: Bun 1.3.14 and the Playwright Chromium revision recorded in
[`benchmarks/rendering-environment.json`](benchmarks/rendering-environment.json).

```sh
bun install --frozen-lockfile
bun run check
bun run test
bun run a0:smoke
```

Phase A benchmark preparation commands are recorded in `package.json`.
Sealed benchmark inputs are stored outside this repository. Do not copy them
into the model workspace.

The frozen Expense Tracker B2-B5 dress rehearsal can be driven by the agent
you already use; this path does not read `OPENAI_API_KEY`:

```sh
bun run b2:expense-tracker-agent -- start
bun run b2:expense-tracker-agent -- next <run-id>
# The agent reads only the printed model-facing input, screenshots,
# instructions, and response schema, then writes a result JSON file.
bun run b2:expense-tracker-agent -- submit <run-id> directions <directions.json> --agent Codex
bun run b2:expense-tracker-agent -- next <run-id>
bun run b2:expense-tracker-agent -- submit <run-id> critique <critiques.json> --agent Codex
bun run b2:expense-tracker-agent -- review <run-id>
# Human fills a decision record bound to the packet hash, then submits it:
bun run b2:expense-tracker-agent -- review submit <run-id> <decision.json>
```

`next` reports a hard human-review stop after critique. A diversity failure
ends that immutable attempt before critique; revise in a new run. Submitted
agent identity/model fields are claims, not authentication. This local file
handoff is an inspectable protocol, not a filesystem or tool sandbox.

The direct OpenAI API runner is separately opt-in and requires an API key:

```sh
bun run b2:expense-tracker-openai
```

The Phase B capture foundation can be exercised with the local interactive
fixture. In one terminal, start the fixture server; in another, create a new
run directory and capture sanitized states:

```sh
bun run a1:capture-environment \
  benchmarks/calibration/uswds-v3.14.0/source/package/dist/fonts \
  artifacts/phase-b-rendering-environment.json
bun run b1:serve-demo
bun run b1:capture-states -- \
  --base-url http://127.0.0.1:4179 \
  --matrix fixtures/phase-b-demo/state-matrix.json \
  --environment artifacts/phase-b-rendering-environment.json \
  --fonts benchmarks/calibration/uswds-v3.14.0/source/package/dist/fonts \
  --run-dir artifacts/phase-b-demo-run \
  --trust-mode sanitized-external \
  --purpose hierarchy
```

Original captures stay under `artifacts/phase-b-demo-run/quarantine/`; only
the sanitized PNGs and safe state metadata are placed under `perceptual/`.
Light-DOM text gets geometry-preserving placeholders; see the Phase B plan for
the Shadow DOM limitation. Run with `--trust-mode trusted-project` or `generated`
only when the original rendered pixels are approved, and include
`--allow-original-pixels`. A capture run refuses to overwrite an existing
directory and checks the exact Playwright/browser/OS/font fingerprint before
starting. Generate a new run fingerprint after changing browser, OS, or fonts;
do not silently reuse the older Phase A calibration fingerprint.
