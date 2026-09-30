# Expense Tracker project decision history

This is an inspectable B10 archive for one project experiment, not a general
profile of the person who reviewed it. Decisions remain attributable to this
project, their source run, and the exact source bytes that contain them.

## Contents

`.dorkflow/project.json` assigns the stable project ID
`proj_expensetracker01`. `.dorkflow/decisions/<human-decision-id>.json` stores
one immutable decision per file. `.dorkflow/sources/<sha256>.json` preserves
the exact original review-record or B9 closure bytes used to validate that
decision. Each decision record also retains the review packet hash or B9
report/closure/resolution hashes.

The archive has 19 decisions:

- 10 B5 decisions from the initial three-direction review;
- 4 B6 revision-1 decisions, including the localized delete-control revision;
- 2 B6 revision-2 decisions, including approval of the hybrid and the
  control/candidate review convention;
- 3 B9 approvals for the revised post-submit mobile state, transaction
  polarity cue, and divider-free summary.

The first B6 review remains in history even though its delete-control
revision was later resolved in B6 revision 2. It is an earlier project event,
not a current instruction to undo the approved revision. B5/B6 decision
timestamps were not present in the source records, so `decisionAt` is `null`.
Their `recordedAt` is the archive creation timestamp and must not be read as
the original time of the human decision.

Source file digests map to the archived source records as follows:

| Source | SHA-256 |
| --- | --- |
| B5 review record | `342585442bdb41609c264fe04bb40ae17fad2de9250be716c72317b9d7d6d3fc` |
| B6 revision 1 record | `794b5f928ecedd28ebb3bf9f53a8205e8f0887d501472beafc5a2ac056e62380` |
| B6 revision 2 record | `19858f9fdb70ded45fc688e2adcf60b869863c0eeca9674dd7bf2f90260811cc` |
| B9 closure | `79e63f85cc312c6cff2cc2730dc7bb37d638564035e0d9661f33c61ac8db0140` |

## Exact retrieval

The core API reads one project's store and can select decisions by exact
opaque subject reference, optionally narrowed by disposition:

```ts
const result = await retrieveProjectDecisionHistory(
  "docs/experiments/phase-b-expense-tracker-decision-history",
  { subjectRefs: ["choice_en000001"] },
);
```

The returned context declares `scope: "project-only"` and preserves the
original disposition, rationale, and source provenance. It performs no text
similarity search, cross-project lookup, taste inference, or automatic prompt
injection.

## Reproduction and limits

In the original development checkout, the archive importer is:

```sh
bun run scripts/phase-b/archive-expense-tracker-history.ts
```

It reads the three retained local B5/B6 review records from the ignored
`artifacts/` experiment run and the tracked B9 closure, then writes the
validated `.dorkflow/` archive. Exact duplicate appends are no-ops; conflicting
decision IDs fail rather than overwrite. The migration script is specific to
this experiment and is not a general onboarding command.

File permissions, create-once writes, strict schemas, and source hashes guard
against accidental edits and path substitution. This is not signed or
tamper-proof storage: someone able to rewrite the project files and Git
history can replace both records and hashes. The store is ordinary plaintext
inside the project repository; Git hosting visibility applies, so sensitive
human rationale should not be committed to a public repository. A cloned
repository carries the same project identity; intentionally splitting it
into a distinct project requires a future explicit re-key workflow.
