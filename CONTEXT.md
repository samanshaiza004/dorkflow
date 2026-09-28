# Dorkflow

Dorkflow is an agent-agnostic harness for design engineering. It keeps human intent, agent proposals, evidence, decisions, and deterministic checks connected across design and implementation.

## Language

**Design intent**:
Human-owned goals, constraints, references, and anti-references that guide design decisions.

**Structural evidence**:
Deterministic measurements of rendered interfaces, including geometry, typography, paint, layout, states, and relationships.

**Perceptual evidence**:
Rendered visual or motion material used to judge composition, hierarchy, atmosphere, density, and balance.

**Design decision graph**:
A traceable set of links between intent, evidence, design decisions, interface properties, and later human judgments.

**Design direction**:
A coherent candidate expression of design intent across typography, color, spatial rhythm, surfaces, imagery, and motion.

**Stage executor**:
An existing agent, direct API model call, or human that performs one workflow stage. Dorkflow owns the stage artifacts and gates; executor identity and reproducibility are recorded only to the extent they are actually known.

**System recovery**:
Inference of intentional primitives, semantic roles, and component relationships from rendered structural evidence.

**Human decision**:
An explicit acceptance, rejection, or revision that records the human's rationale and remains authoritative for taste.

_Avoid_: AI-designed website, CSS extraction as the product, universal taste score, API provider as the workflow's central concept
