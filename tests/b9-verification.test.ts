import { describe, expect, test } from "bun:test";
import {
  B9HumanReviewItem,
  B9RequirementResult,
  B9VerificationReport,
  completeB9RequirementResults,
  summarizeB9Requirements,
} from "../src/design/b9-verification.ts";

const pass = (requirementId: string) => ({
  requirementId,
  status: "PASS" as const,
  method: "browser-dom",
  evidenceRefs: ["ev_12345678"],
  rationale: "Observed the required relationship in the rendered page.",
});

describe("B9 requirement-addressed verification", () => {
  test("records human review outcomes and their rationale separately from machine checks", () => {
    const pending = {
      id: "b9review_polarity01",
      status: "PENDING",
      question: "Does the strengthened edge cue improve rapid classification?",
      evidenceRefs: ["ev_12345678"],
    };
    const completed = {
      ...pending,
      status: "COMPLETED",
      disposition: "REVISE",
      rationale: "The cue is legible but not salient enough for quick classification.",
    };

    expect(B9HumanReviewItem.parse(pending).status).toBe("PENDING");
    expect(B9HumanReviewItem.parse(completed).disposition).toBe("REVISE");
    expect(() => B9HumanReviewItem.parse({ ...completed, rationale: undefined })).toThrow();
    expect(() => B9HumanReviewItem.parse({ ...pending, disposition: "PASS" })).toThrow();
  });

  test("accepts the four explicit B9 outcomes", () => {
    for (const status of ["PASS", "FAIL", "HUMAN-REVIEW", "NOT-APPLICABLE"] as const) {
      expect(B9RequirementResult.parse({ ...pass("req_b7layout01"), status }).status).toBe(status);
    }
  });

  test("records Git commit identities separately from SHA-256 artifact hashes", () => {
    const report = {
      schemaVersion: 1,
      id: "verify_b9abcdef123456",
      runRef: "run_12345678",
      contractRef: "contract_12345678",
      checkedAt: "2026-09-29T12:00:00.000Z",
      status: "PASS",
      frozenInputs: {
        contractSha256: "a".repeat(64),
        verificationHarnessSha256: "f".repeat(64),
        controlCommit: "1".repeat(40),
        b6CandidateTreeSha256: "b".repeat(64),
        implementationBaseCommit: "1".repeat(40),
        implementationCommit: "2".repeat(40),
        renderingEnvironmentSha256: "c".repeat(64),
        fontSha256: "d".repeat(64),
      },
      runtime: {
        browser: "Chromium",
        browserVersion: "151.0.7922.34",
        nodeVersion: "v24.21.0",
        platform: "darwin",
        architecture: "arm64",
        locale: "en-US",
        timezoneId: "America/Chicago",
        deviceScaleFactor: 1,
        viewportWidths: [320, 375, 699, 700, 701, 768, 1280],
      },
      requirements: [pass("req_b7layout01")],
      evidenceArtifacts: [{
        id: "ev_12345678",
        path: "measurements.json",
        sha256: "e".repeat(64),
        kind: "measurement",
        description: "Measurement evidence.",
      }],
      humanReview: [],
      deviations: [],
    };
    expect(B9VerificationReport.parse(report)).toEqual(report);
    expect(() => B9VerificationReport.parse({
      ...report,
      frozenInputs: { ...report.frozenInputs, controlCommit: "a".repeat(64) },
    })).toThrow();
  });

  test("requires exactly one result for every frozen requirement", () => {
    const expected = ["req_b7layout01", "req_b7copy01", "req_b7func01"];
    const results = [
      pass("req_b7layout01"),
      { ...pass("req_b7copy01"), status: "HUMAN-REVIEW" as const },
      { ...pass("req_b7func01"), status: "NOT-APPLICABLE" as const },
    ];

    expect(completeB9RequirementResults(expected, results).map(({ requirementId }) => requirementId)).toEqual(expected);
  });

  test("rejects missing, duplicate, and unexpected requirement results", () => {
    const expected = ["req_b7layout01", "req_b7copy01"];
    expect(() => completeB9RequirementResults(expected, [pass("req_b7layout01")])).toThrow(/missing/i);
    expect(() => completeB9RequirementResults(expected, [pass("req_b7layout01"), pass("req_b7layout01")])).toThrow(/duplicate/i);
    expect(() => completeB9RequirementResults(expected, [pass("req_b7layout01"), pass("req_b7state01")])).toThrow(/unexpected/i);
  });

  test("a failed hard check cannot be hidden by other passing or pending checks", () => {
    expect(summarizeB9Requirements([
      pass("req_b7layout01"),
      { ...pass("req_b7copy01"), status: "HUMAN-REVIEW" },
    ])).toBe("REVIEW-PENDING");
    expect(summarizeB9Requirements([
      pass("req_b7layout01"),
      { ...pass("req_b7copy01"), status: "FAIL" },
      { ...pass("req_b7func01"), status: "HUMAN-REVIEW" },
    ])).toBe("FAIL");
    expect(summarizeB9Requirements([
      pass("req_b7layout01"),
      { ...pass("req_b7copy01"), status: "NOT-APPLICABLE" },
    ])).toBe("PASS");
  });
});
