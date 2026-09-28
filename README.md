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

Artifacts are the stable interface between replaceable agents. A single
agent may perform several roles; Dorkflow does not require an agent swarm,
database, GUI, or design canvas.

## Current work

- **Phase A — System Recovery:** tests whether deliberate design-system
  structure can be inferred from sanitized structural evidence, including
  controlled intentional and incidental values. USWDS is calibration; sealed
  generated benchmarks determine this subsystem's result.
- **Phase B — Executable Design Process:** builds a manual, reproducible
  workflow and tests whether its artifacts and review gates improve an
  actual redesign over the same agent using a strong frontend-design prompt.
  Phase B can use an incomplete System Recovery result as an optional input.
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
the geometry-preserving sanitized PNGs and their safe metadata are placed
under `perceptual/`. Run with `--trust-mode trusted-project` or `generated`
only when the original rendered pixels are approved, and include
`--allow-original-pixels`. A capture run refuses to overwrite an existing
directory and checks the exact Playwright/browser/OS/font fingerprint before
starting. Generate a new run fingerprint after changing browser, OS, or fonts;
do not silently reuse the older Phase A calibration fingerprint.
