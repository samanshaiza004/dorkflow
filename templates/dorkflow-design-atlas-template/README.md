# Dorkflow Design Atlas

A small, editable design profile for a project. It records a dependable
baseline, project boundaries, creative direction, scoped references, and
human decisions in plain JSON and Markdown. There is no runtime, external
asset, YAML parser, or required design tooling.

## The layers

- **Floor** (`floorFiles`) sets the minimum craft baseline: hierarchy,
  accessibility, responsive behavior, and useful interface states. These
  are practical defaults, not a claim of automatic conformance.
- **Rails** (`railFiles`) state project boundaries and recommendations. Each
  rail includes context and an escape condition so a useful exception is not
  mistaken for a universal ban.
- **Compass** (`compassFile`) is the creative orientation. Its principles
  help choices cohere without prescribing a brand, palette, typeface, or
  finished layout.
- **Atlas** (`atlasFiles`) records what a reference contributes, the human
  reaction to it, and what not to borrow. The included example is fictional
  and explicitly attributed to the template authors.
- **Anti-references** (`antiReferenceFiles`) explain a specific failure
  pattern and its rationale. They are cautions, not universal style rules.
- **Decisions** (`decisions/`) preserve human choices and rationale. Keep
  prior records and explicitly supersede them when a choice changes.

## Authority when guidance conflicts

Use this order:

1. Functional and accessibility Floor requirements.
2. Project requirements and constraints.
3. Explicit current human project decisions.
4. Personal Compass principles.
5. Rails and other default heuristics.
6. Only the Atlas references deliberately selected for this project.
7. Agent preferences and conventions.

Applicable legal, safety, and platform obligations remain binding project
constraints. Rails are defaults with escape conditions, not prohibitions. An
agent should mark an assumption when the profile is silent instead of
presenting a convention as a requirement.

## Use locally

1. Create your own repository from the [Dorkflow Design Atlas
   template](https://github.com/samanshaiza004/dorkflow-design-atlas-template)
   using **Use this template**. It is an ordinary Git repository with
   independent history.
2. Clone your repository on each machine using your normal Git credentials;
   point Dorkflow at that local checkout. No Dorkflow account or sync service
   is involved.
3. Edit `profile.json` and the files it lists with context the project
   actually knows. `schemaVersion` identifies the file shape; `profileId`
   identifies this profile. Keep the listed paths relative to this directory
   and distinct.
4. Keep or adapt the permissive defaults. There is no taste questionnaire:
   a team can start with these defaults and refine them when a real decision
   calls for it. Taste can become clearer through human decisions over time;
   it need not be articulated up front. Unknown details can stay unspecified,
   and `atlasFiles` may be empty when there are no personal references yet.
5. Add references with attribution and a narrow borrow / do-not-borrow
   rationale. Do not copy a reference's assets, wording, or whole visual
   identity.
6. Copy `decisions/decision-template.md` for each meaningful human choice.
   Keep old records and name the earlier decision when a choice is superseded.

The profile and every structured layer are JSON, so Dorkflow validates them
directly with its existing Zod contract. The template does not duplicate that
contract in a second schema file. Compass is JSON at
`compass/principles.json`; the short explanations in this README are for
people, not a second source of profile data.

This starter is text-only. It includes no images, fonts, copied interface
text, large files, or Git LFS objects. Its fictional examples are original
text written for this template, not depictions of real products.
