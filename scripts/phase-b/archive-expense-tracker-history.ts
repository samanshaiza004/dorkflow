import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  HumanDecision,
  ProjectDecisionRecord,
  ReviewRecord,
} from "../../src/contracts/design/index.ts";
import {
  appendProjectDecision,
  initializeProjectDecisionHistory,
  storeProjectDecisionSource,
} from "../../src/design/project-decision-history.ts";
import { sha256Bytes } from "../../src/environment/hash.ts";
import { B9VerificationClosure, B9VerificationReport } from "../../src/design/b9-verification.ts";

const runRoot = "artifacts/phase-b-expense-tracker/agent-runs/run_aadad7d73a62536be1d6f2d415979ea7";
const archiveRoot = resolve("docs/experiments/phase-b-expense-tracker-decision-history");
const archiveCreatedAt = "2026-09-30T01:20:58.000Z";
const projectId = "proj_expensetracker01";

await mkdir(archiveRoot, { recursive: true });
const manifest = await initializeProjectDecisionHistory(archiveRoot, {
  name: "Expense Tracker Phase B experiment",
  projectId,
  createdAt: archiveCreatedAt,
});

const reviewSources = [
  `${runRoot}/review/decision.json`,
  `${runRoot}/review/b6-review-v1-record.json`,
  `${runRoot}/review/b6-review-v2-record.json`,
];
let reviewDecisionCount = 0;

for (const sourcePath of reviewSources) {
  const bytes = await readFile(sourcePath);
  const source = ReviewRecord.parse(JSON.parse(bytes.toString("utf8")));
  const sourceSha256 = await storeProjectDecisionSource(archiveRoot, bytes);
  for (const decision of source.decisions) {
    const record = ProjectDecisionRecord.parse({
      schemaVersion: 1,
      projectId: manifest.projectId,
      decisionAt: null,
      recordedAt: manifest.createdAt,
      source: {
        kind: "review-record",
        runRef: source.runRef,
        sourceSha256,
        packetSha256: source.packetSha256,
      },
      decision,
    });
    await appendProjectDecision(archiveRoot, record);
    reviewDecisionCount += 1;
  }
}

const b9Directory = "docs/experiments/phase-b-expense-tracker-b9-revision";
const closureBytes = await readFile(`${b9Directory}/closure.json`);
const closure = B9VerificationClosure.parse(JSON.parse(closureBytes.toString("utf8")));
const report = B9VerificationReport.parse(JSON.parse(await readFile(`${b9Directory}/report.json`, "utf8")));
const closureSha256 = await storeProjectDecisionSource(archiveRoot, closureBytes);

for (const item of closure.resolutions) {
  const suffix = item.reviewItemRef.replace("b9review_", "");
  const decision = HumanDecision.parse({
    schemaVersion: 1,
    id: `hdec_b9${suffix}`,
    subjectRefs: [item.reviewItemRef],
    disposition: item.disposition === "PASS" ? "accept" : item.disposition === "REVISE" ? "revise" : "reject",
    rationale: item.rationale,
    pairwiseComparison: null,
  });
  const record = ProjectDecisionRecord.parse({
    schemaVersion: 1,
    projectId: manifest.projectId,
    decisionAt: closure.decidedAt,
    recordedAt: manifest.createdAt,
    source: {
      kind: "b9-closure",
      runRef: report.runRef,
      sourceSha256: closureSha256,
      reportRef: closure.reportRef,
      reportSha256: closure.reportSha256,
      resolutionSha256: closure.resolutionSha256,
      reviewItemRef: item.reviewItemRef,
    },
    decision,
  });
  await appendProjectDecision(archiveRoot, record);
}

console.log(JSON.stringify({
  projectId: manifest.projectId,
  archiveRoot,
  reviewDecisions: reviewDecisionCount,
  b9Approvals: closure.resolutions.length,
  sourceSha256: {
    b9Closure: closureSha256,
    b9Report: sha256Bytes(await readFile(`${b9Directory}/report.json`)),
  },
}, null, 2));
