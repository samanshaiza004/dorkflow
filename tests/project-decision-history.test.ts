import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  ProjectDecisionHistoryManifest,
  ProjectDecisionRecord,
} from "../src/contracts/design/project-decision-history.ts";
import {
  appendProjectDecision,
  initializeProjectDecisionHistory,
  readProjectDecisionHistory,
  retrieveProjectDecisionHistory,
  storeProjectDecisionSource,
} from "../src/design/project-decision-history.ts";

const roots: string[] = [];
const timestamp = "2026-09-30T01:10:00.000Z";

async function makeProject(name = "Example project", projectId = "proj_example1234") {
  const root = await mkdtemp(join(tmpdir(), "dorkflow-history-"));
  roots.push(root);
  const manifest = await initializeProjectDecisionHistory(root, { name, projectId, createdAt: timestamp });
  return { root, manifest };
}

function reviewRecord(decisions: unknown[] = [decision()]) {
  return {
    schemaVersion: 1,
    runRef: "run_12345678",
    packetSha256: "a".repeat(64),
    decisions,
  };
}

function decision(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: "hdec_example0001",
    subjectRefs: ["dir_example0001", "choice_example0001"],
    disposition: "accept",
    rationale: "This project accepted the ledger treatment because it supports scanning.",
    pairwiseComparison: null,
    ...overrides,
  };
}

async function prepareReviewSource(root: string, sourceRecord = reviewRecord()) {
  const bytes = new TextEncoder().encode(`${JSON.stringify(sourceRecord)}\n`);
  const sourceSha256 = await storeProjectDecisionSource(root, bytes);
  return { bytes, sourceSha256, sourceRecord };
}

function historyEntry(projectId: string, sourceSha256: string, decisionValue = decision(), overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    projectId,
    decisionAt: null,
    recordedAt: timestamp,
    source: {
      kind: "review-record",
      runRef: "run_12345678",
      sourceSha256,
      packetSha256: "a".repeat(64),
    },
    decision: decisionValue,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project-local decision history", () => {
  test("initializes a stable project identity and validates its required metadata", async () => {
    const { root, manifest } = await makeProject();
    expect(ProjectDecisionHistoryManifest.parse(manifest)).toEqual(manifest);
    expect(await initializeProjectDecisionHistory(root, { name: manifest.name, projectId: manifest.projectId })).toEqual(manifest);
    await expect(initializeProjectDecisionHistory(root, { name: "Different project" })).rejects.toThrow(/name differs/i);

    const missing = await mkdtemp(join(tmpdir(), "dorkflow-history-missing-"));
    roots.push(missing);
    await mkdir(join(missing, ".dorkflow", "decisions"), { recursive: true });
    await mkdir(join(missing, ".dorkflow", "sources"));
    await expect(readProjectDecisionHistory(missing)).rejects.toThrow(/project\.json is missing|not initialized/i);
  });

  test("stores source bytes by hash and appends an exact decision once", async () => {
    const { root, manifest } = await makeProject();
    const source = await prepareReviewSource(root);
    expect(await storeProjectDecisionSource(root, source.bytes)).toBe(source.sourceSha256);
    const record = historyEntry(manifest.projectId, source.sourceSha256);
    expect(ProjectDecisionRecord.parse(record)).toEqual(record);

    const concurrent = await Promise.all([
      appendProjectDecision(root, record),
      appendProjectDecision(root, record),
    ]);
    expect(concurrent.map(({ created }) => created).sort()).toEqual([false, true]);
    expect((await appendProjectDecision(root, record)).created).toBe(false);
    const history = await readProjectDecisionHistory(root);
    expect(history.decisions).toHaveLength(1);
    expect(history.decisions[0]?.decision.rationale).toContain("supports scanning");
  });

  test("rejects reuse of a decision ID for changed meaning and altered source bytes", async () => {
    const { root, manifest } = await makeProject();
    const initialSource = await prepareReviewSource(root);
    const initial = historyEntry(manifest.projectId, initialSource.sourceSha256);
    await appendProjectDecision(root, initial);

    const changedDecision = decision({ rationale: "A different rationale must never replace the first one." });
    const changedSource = await prepareReviewSource(root, reviewRecord([changedDecision]));
    const conflicting = historyEntry(manifest.projectId, changedSource.sourceSha256, changedDecision);
    await expect(appendProjectDecision(root, conflicting)).rejects.toThrow(/ID conflict|differs from the cited/i);

    const sourcePath = join(root, ".dorkflow", "sources", `${initialSource.sourceSha256}.json`);
    await writeFile(sourcePath, "{}\n");
    await expect(readProjectDecisionHistory(root)).rejects.toThrow(/source hash does not match/i);
  });

  test("retrieves exact references and preserves both acceptance and rejection without preference generalization", async () => {
    const { root, manifest } = await makeProject();
    const accepted = decision({ id: "hdec_accepted0001", subjectRefs: ["dir_example0001"] });
    const rejected = decision({
      id: "hdec_rejected0001",
      subjectRefs: ["dir_example0001", "choice_example0002"],
      disposition: "reject",
      rationale: "This project rejected the mandatory desktop form-first arrangement because it wasted space.",
    });
    const sourceRecord = reviewRecord([accepted, rejected]);
    const source = await prepareReviewSource(root, sourceRecord);
    for (const item of sourceRecord.decisions) {
      await appendProjectDecision(root, historyEntry(manifest.projectId, source.sourceSha256, item as ReturnType<typeof decision>));
    }

    const result = await retrieveProjectDecisionHistory(root, { subjectRefs: ["dir_example0001"] });
    expect(result.scope).toBe("project-only");
    expect(result.precedents.map(({ decision: item }) => item.disposition)).toEqual(["accept", "reject"]);
    expect(result.precedents[1]?.decision.rationale).toContain("wasted space");
    expect((await retrieveProjectDecisionHistory(root, { subjectRefs: ["dir_example0002"] })).precedents).toEqual([]);
    expect((await retrieveProjectDecisionHistory(root, { subjectRefs: ["dir_example0001"], dispositions: ["reject"] })).precedents).toHaveLength(1);
  });

  test("keeps histories isolated by project identity", async () => {
    const first = await makeProject("Project one", "proj_projectone01");
    const second = await makeProject("Project two", "proj_projecttwo02");
    const source = await prepareReviewSource(first.root);
    const record = historyEntry(first.manifest.projectId, source.sourceSha256);
    await appendProjectDecision(first.root, record);

    await expect(appendProjectDecision(second.root, record)).rejects.toThrow(/different project/i);
    expect((await retrieveProjectDecisionHistory(second.root, { subjectRefs: ["dir_example0001"] })).precedents).toEqual([]);
  });

  test("validates source identity against the cited B5 review record", async () => {
    const { root, manifest } = await makeProject();
    const source = await prepareReviewSource(root);
    const mismatched = historyEntry(manifest.projectId, source.sourceSha256, decision({ rationale: "Not in the source record." }));
    await expect(appendProjectDecision(root, mismatched)).rejects.toThrow(/differs from the cited review record/i);
  });

  test("rejects traversal IDs, malformed records, unexpected files, and missing source metadata", async () => {
    const { root, manifest } = await makeProject();
    expect(() => ProjectDecisionRecord.parse(historyEntry(manifest.projectId, "a".repeat(64), decision({ id: "../../outside" })))).toThrow();
    await expect(appendProjectDecision(root, { schemaVersion: 1, projectId: manifest.projectId })).rejects.toThrow();
    await writeFile(join(root, ".dorkflow", "decisions", "notes.txt"), "not a decision");
    await expect(readProjectDecisionHistory(root)).rejects.toThrow(/unexpected project decision-history entry/i);
  });

  test("rejects symlinked store directories, source files, decision files, and project roots", async () => {
    const { root, manifest } = await makeProject();
    const outside = await mkdtemp(join(tmpdir(), "dorkflow-history-outside-"));
    roots.push(outside);
    const source = await prepareReviewSource(root);
    const sourcePath = join(root, ".dorkflow", "sources", `${source.sourceSha256}.json`);
    await rm(sourcePath);
    await symlink(join(outside, "missing.json"), sourcePath);
    await expect(appendProjectDecision(root, historyEntry(manifest.projectId, source.sourceSha256))).rejects.toThrow(/symlink/i);

    await rm(sourcePath);
    await writeFile(sourcePath, source.bytes);
    const decisionPath = join(root, ".dorkflow", "decisions", "hdec_example0001.json");
    await symlink(join(outside, "missing-decision.json"), decisionPath);
    await expect(readProjectDecisionHistory(root)).rejects.toThrow(/symlink|regular file/i);

    const alias = `${root}-alias`;
    await symlink(root, alias);
    roots.push(alias);
    await expect(readProjectDecisionHistory(alias)).rejects.toThrow(/root.*symlink/i);
  });

  test("rejects a symlinked .dorkflow directory and corrupt decision JSON", async () => {
    const project = await mkdtemp(join(tmpdir(), "dorkflow-history-link-"));
    roots.push(project);
    const outside = await mkdtemp(join(tmpdir(), "dorkflow-history-outside-"));
    roots.push(outside);
    await symlink(outside, join(project, ".dorkflow"));
    await expect(initializeProjectDecisionHistory(project, { name: "Bad path" })).rejects.toThrow(/symlink/i);

    const { root, manifest } = await makeProject();
    const source = await prepareReviewSource(root);
    await appendProjectDecision(root, historyEntry(manifest.projectId, source.sourceSha256));
    await writeFile(join(root, ".dorkflow", "decisions", "hdec_example0001.json"), "{bad json");
    await expect(readProjectDecisionHistory(root)).rejects.toThrow(/valid UTF-8 JSON/i);
  });

  test("rejects a symlinked decisions directory", async () => {
    const { root } = await makeProject();
    const outside = await mkdtemp(join(tmpdir(), "dorkflow-history-outside-"));
    roots.push(outside);
    await rm(join(root, ".dorkflow", "decisions"), { recursive: true });
    await symlink(outside, join(root, ".dorkflow", "decisions"));
    await expect(readProjectDecisionHistory(root)).rejects.toThrow(/real directory.*symlink/i);
  });

  test("rejects a symlinked staging directory before publishing an append", async () => {
    const { root, manifest } = await makeProject();
    const outside = await mkdtemp(join(tmpdir(), "dorkflow-history-outside-"));
    roots.push(outside);
    const source = await prepareReviewSource(root);
    await symlink(outside, join(root, ".dorkflow", "decisions", ".staging"));
    await expect(appendProjectDecision(root, historyEntry(manifest.projectId, source.sourceSha256))).rejects.toThrow(/symlink/i);
  });

  test("bounds source size and validates query shape", async () => {
    const { root } = await makeProject();
    await expect(storeProjectDecisionSource(root, new Uint8Array(512 * 1024 + 1))).rejects.toThrow(/exceeds|between/i);
    await expect(retrieveProjectDecisionHistory(root, { subjectRefs: [] })).rejects.toThrow();
    await expect(retrieveProjectDecisionHistory(root, { subjectRefs: ["dir_example0001", "dir_example0001"] })).rejects.toThrow();
  });

  test("the Expense Tracker archive retains B5/B6/B9 decisions and retrieves only exact project precedents", async () => {
    const archive = "docs/experiments/phase-b-expense-tracker-decision-history";
    const history = await readProjectDecisionHistory(archive);
    expect(history.manifest.projectId).toBe("proj_expensetracker01");
    expect(history.decisions).toHaveLength(19);
    expect(new Set(history.decisions.map(({ decision: item }) => item.disposition))).toEqual(new Set(["accept", "reject", "revise", "prefer"]));
    expect(history.decisions.filter(({ decisionAt }) => decisionAt === null)).toHaveLength(16);

    const exact = await retrieveProjectDecisionHistory(archive, { subjectRefs: ["choice_en000001"] });
    expect(exact.scope).toBe("project-only");
    expect(exact.precedents).toHaveLength(1);
    expect(exact.precedents[0]?.decision.disposition).toBe("reject");
    expect(exact.precedents[0]?.decision.rationale).toContain("useful horizontal space");
    expect((await retrieveProjectDecisionHistory(archive, { subjectRefs: ["choice_unused0001"] })).precedents).toEqual([]);
  });
});
