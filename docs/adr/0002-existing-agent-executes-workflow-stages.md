---
status: accepted
---

# Existing agents execute stages; Dorkflow owns the gates

Dorkflow's normal workflow does not invoke or select a model. The user's
existing agent receives a frozen stage context, instructions, and schema
through the CLI/file handoff, then submits a candidate artifact. Dorkflow
validates schemas and provenance, evaluates deterministic gates, persists
hashes and decisions, and determines which stage may proceed next.

The CLI is the canonical workflow protocol. Other transports, including a
future MCP adapter, must call the same core operations rather than duplicate
workflow logic. This does not require a polished distributable CLI during
Phase B.

Direct model adapters remain optional for headless/BYOK experiments and
controlled comparisons. A direct API invocation may record provider-returned
metadata; an external agent handoff must not invent API token usage, tool
permissions, model snapshots, or invocation timestamps. Reported external
agent identity is explicitly unverified and has lower reproducibility than a
fully controlled direct invocation.

This is an artifact-and-gate protocol, not an agent sandbox. It does not
prove which model executed a stage or prevent a local agent with filesystem
access from changing files outside the handoff. Human review remains an
explicit stop, and design exploration remains separate from source-repository
writes.

## Consequences

- Normal Dorkflow use requires no model-provider credentials.
- Codex, Claude Code, Cursor, and other local agents can use the same
stage-specific file interface.
- External execution has weaker provenance than a direct API request and is
not suitable as a controlled model benchmark unless its identity is
independently captured.
- The optional OpenAI Responses adapter remains useful for experiments and
headless runs, but is not the product's default execution path.
- CLI and future MCP transports share one deterministic workflow core.
