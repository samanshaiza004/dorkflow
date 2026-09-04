# Hidden benchmark recipe

This document defines the A0 contract for generated benchmark versions. It
is authoring material, not model input.

Each generated system has:

1. primitive scales for color, spacing, type, radius, shadow, opacity, and
   dimensions;
2. semantic roles for text, surfaces, actions, borders, focus, and status;
3. component slots for navigation, buttons, cards, forms, and footers;
4. responsive rules at mobile, tablet, and desktop widths;
5. multiple pages that reuse the same system;
6. deterministic interaction states where practical.

The generator applies a seeded transformation to values and source
identifiers. It must preserve perceptual contrast, relative scale order,
component reuse, and responsive structure. It must not emit the seed or
authoring names into the rendered observation bundle's model-facing form.

The rendered pages contain controlled debris in addition to intentional
tokens. The ground-truth authoring record identifies every debris case and
its expected classification before evaluation is locked.

The development seed may be revealed after scoring. Sealed holdout seeds
remain inaccessible until the result is finalized. A changed pipeline burns
the evaluated holdout and requires a newly generated holdout version.
