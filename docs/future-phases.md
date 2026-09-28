# Future phases

## First product-level experiment

Compare a capable baseline coding-agent workflow against the same agent
using Dorkflow artifacts and gates on one functional open-source page. Keep
the model version, starting repository, human brief, references, tool access,
and time/token budget consistent; record comparable human review time and
interventions. Repeat paired runs when practical. Review final results
blind, then inspect whether the decision trail explains choices and reduces
arbitrary defaults. Compare behavior, responsive states, accessibility, and
visual results. This is the product-level test; it does not replace the
system-recovery benchmark.

## System-recovery subsystem

The current Phase A experiment tests whether deliberate primitives,
semantic roles, and component relationships can be inferred from structural
evidence while rejecting controlled design debris. USWDS calibrates the
pipeline; sealed generated benchmarks determine that subsystem's pass/fail
result. Passing this experiment does not establish that the complete
design-process harness improves redesign outcomes.

For the product-level experiment, record human intent and reference roles,
capture interface states, recover the existing system, propose distinct
directions, critique them against intent, record human choices, and produce
an implementation contract.

An isolated executable prototype or Penpot can serve as the design canvas.
When Penpot is used, a checkpoint must succeed before every write batch;
otherwise mutation aborts. The design agent cannot write the source
repository. The implementation agent cannot mutate Penpot. Technical review
and human approval precede implementation on a repository branch.

Real content is injected by ordinary code after design. Copy preservation is
deterministic, not LLM-reviewed. Responsive and overflow checks run after
content injection. Approved designs become visual-regression baselines.

The human remains the aesthetic authority. Agents may critique craft against
intent and evidence, but cannot override human art direction. Structural
evidence and perceptual evidence remain separate paths; external reference
content is sanitized before perceptual review. There is no universal taste
score.

## Phase C

Only after the system-recovery subsystem passes and the product-level
experiment succeeds on real redesigns may the project consider packaging a
general-purpose CLI, a GUI, workflow orchestration, automatic Penpot
checkpoints, project management, PR flow, or self-hosting. The CLI/file
handoff is already the Phase B protocol of record, but remains experiment-
specific. A future MCP transport should be a thin adapter over the same core
operations. Provider selection is deliberately deprioritized: Dorkflow's
normal executor is the agent the user already has, while direct API adapters
remain optional for BYOK/headless runs.

These later capabilities are not implemented in the current subsystem.
