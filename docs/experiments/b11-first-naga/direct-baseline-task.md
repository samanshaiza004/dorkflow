# B11.1 direct-design baseline task

You are working in the isolated First Naga Baptist Church source snapshot for
the direct-design baseline arm. Read the exact frozen `frontend-design` skill
at `<common-inputs>/frontend-design/SKILL.md` in full; do not substitute a
newer installed copy. Read the shared brief, `README.md`,
`docs/BRAND_DESIGN_DIRECTION.md`, and `docs/UX_INFORMATION_ARCHITECTURE_AUDIT.md`,
then inspect and test the current homepage and its relevant components.

Redesign and implement the homepage directly. You may plan, consider
alternatives, and critique your work in your ordinary workflow, but you are not
required to produce Dorkflow artifacts or follow Dorkflow stage gates. Do not
read the Dorkflow repository, experiment plan, or other arm's materials. Do not
use external references, web browsing, remote services, the live CMS, or
network-fetched assets. Use the frozen project documents, checked-in content,
and existing local assets only.

Treat `default-design-guidance.json` as the same permissive advisory Floor,
Rails, and Compass guidance shared with the Dorkflow arm. It is not a visual
template and may be departed from when the project brief and evidence support
that choice. The exact source file is provided as a normal input document; do
not load the personal Design Atlas or any other project history.

The shared input folder also contains identical original-site state captures,
their evidence manifest, a normalized control copy/link inventory, the frozen
rendering-environment record, and a standalone copy of the common verifier.
Use those as initial evidence and run the common verifier against your finished
local preview. Do not inspect the Dorkflow repository, B11 process artifacts,
or any other arm's workspace. The common folder contains no redesign outputs.

Follow the shared brief exactly. Preserve visible copy, routes, local
CMS-driven content relationships, interactions, and accessibility behavior.
Do not add features or claims. Keep changes limited to homepage code plus
shared header/footer code if needed. Do not change content/data fixtures,
dependencies, routes, or non-homepage pages.

Use Bun `1.3.14` and the locked dependencies. Set `CMS_SOURCE=local`; build and
serve without loading environment files. External network access is out of
scope. Use the provided fixed-time command settings for builds. For common
verification, run the supplied `verify-rendering.mjs` from the shared input
folder with the local preview URL, a new empty output folder, and the frozen
control inventory as `--reference`. Its screenshots are comparison evidence;
pixel equality is not a design requirement.

The active agent-work cap is three hours. Record start/stop times, active
segments, turns, tool executions where visible, build/test outcomes, and every
human interaction. The human may answer factual questions from the frozen
project inputs but will not give design feedback before final comparison. Stop
when the cap is reached, even if incomplete. Token equality is not claimed.

Commit the finished work locally in this isolated copy. Do not push. Write a
short `direct-process-log.md` after implementation that lists the significant
design choices, their stated reasons, verification performed, and any
uncertainties. This log is for post-comparison analysis and must not be shown to
the other arm before both implementations are frozen.
