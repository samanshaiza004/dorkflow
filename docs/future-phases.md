# Future phases

## Phase B

Approved tokens flow through human art direction, constrained design-agent
variants, Penpot writes, human selection, technical review, human approval,
implementation on a repository branch, deterministic verification, and
human diff review.

The design agent cannot write the source repository. The implementation
agent cannot mutate Penpot. A checkpoint must succeed before every Penpot
write batch; otherwise mutation aborts. Copy preservation is deterministic,
and real content is injected by ordinary code after design. Responsive and
overflow checks run after injection. Approved designs become visual
regression baselines.

## Phase C

Only after Phase A passes and the manual Phase B workflow succeeds on real
redesigns may the project consider a polished CLI, GUI, provider selection,
workflow orchestration, Penpot checkpoints, project management, PR flow, or
self-hosting.

None of these capabilities are implemented in Phase A.
