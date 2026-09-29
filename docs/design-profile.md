# Optional Design Profile

Dorkflow can reuse a small, human-owned Design Profile across projects and
agents. It is optional: a project can use the existing Phase B intent,
references, and evidence without creating one or filling out a taste survey.

The text-only starter is at
[`templates/dorkflow-design-atlas-template`](../templates/dorkflow-design-atlas-template/README.md).
It separates:

- **Floor:** conservative usability, accessibility, responsive, and state
  requirements. It does not prescribe an aesthetic or claim automatic WCAG
  conformance.
- **Rails:** recommended defaults with context and an explicit escape
  condition. They guide decisions rather than ban styles.
- **Compass:** optional personal principles; the starter is deliberately
  permissive rather than a Dorkflow house style.
- **Atlas:** attributed references with specific borrow / do-not-borrow
  aspects. A reference is not a request to copy its full look.
- **Anti-references:** contextual cautions with a reason, not permanent bans
  on the techniques they illustrate.
- **Decisions:** human-owned choices and their rationale, kept as ordinary
  files rather than silently rewritten preferences.

## Starting from the template

The starter is staged in this repository; no separate GitHub template
repository has been created yet. The target is
`samanshaiza004/dorkflow-design-atlas-template`. The one-time publication step
is to create a new repository from the staged directory and enable GitHub's
**Template repository** setting. Until then, copy the directory into a new
local repository. The files are small JSON and Markdown; there are no images,
fonts, copied source archives, or Git LFS objects.

Once published, a user can choose **Use this template** to make a repository
with independent history. On another machine, clone that repository with
their existing Git credentials. Dorkflow consumes the local checkout; it has
no GitHub login, account browser, or synchronization service.

## Connecting it to Phase B

The current core seam is the optional `designProfilePath` on
`DesignProcessArtifacts`. For example, a caller constructing an existing
design-process run can set:

```ts
const artifacts = {
  intent,
  references,
  runDirectory,
  systemModel: null,
  designProfilePath: "/Users/me/design/my-design-atlas",
};
```

`createDesignModelInput` resolves that local directory before the model call.
It validates `profile.json` and all listed Floor, Rails, Compass, Atlas, and
anti-reference data; hashes each consumed file; and records the concrete
Git commit plus whether the repository worktree is clean or dirty. A missing
profile remains a valid existing path. No polished onboarding command is
introduced in this milestone.

Only Floor, Rails, and Compass are added to model context. Each requirement,
rail, and Compass principle has an ID that directions and critique can cite.
Atlas entries are validated and fingerprinted, but their content is not
injected; a person must still select/attribute any project references through
the existing project `ReferenceSet`. Profile data is frozen into the model
input hash and the persisted process manifest. Dirty changes are allowed but
clearly marked; clean profiles are pinned to their exact Git commit.

The resolver accepts the root of a committed local Git repository; it does
not fetch a branch or follow a moving remote ref. It records the dirty state
of that complete working tree. It rejects symlinked profile roots and listed
inputs, path traversal, non-regular inputs, invalid UTF-8/JSON, files over
256 KiB, and total listed inputs over 2 MiB. Files not listed by the
manifest are never read or injected. File hashes describe the exact bytes
consumed; the profile aggregate hash includes
the manifest and every manifest-listed input. This is a reproducibility
boundary, not a sandbox against a malicious process with local filesystem or
Git access.

## Authority order

Treat this as the intended conflict-resolution order for design guidance:

1. Functional and accessibility Floor.
2. Project requirements and constraints.
3. Explicit human project decisions.
4. Personal Compass.
5. Rails and default heuristics.
6. Human-selected Atlas inspiration.
7. Model preferences and defaults.

This ordering does not turn subjective profile guidance into a deterministic
quality score. Humans retain final aesthetic authority; Dorkflow preserves
the rationale and checks what can be checked.
