# dorkflow

dorkflow is an experimental design-engineering system. Phase A tests one
narrow hypothesis: whether a deliberate design system can be recovered from
sanitized rendered evidence.

Phase A is deliberately not a GUI, CLI product, Penpot integration, website
redesign agent, or repository automation system.

## A0

Install dependencies and run the scaffold checks:

```sh
bun install
bun run check
bun test
bun run a0:smoke
```

The live benchmark and model are intentionally not invoked by A0.
