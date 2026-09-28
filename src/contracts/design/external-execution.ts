import { z } from "zod";
import { IsoTimestamp, Sha256, ShortText } from "./common.ts";

/** A local record of external-agent claims; it is not proof of model identity or tool isolation. */
export const ExternalStageExecution = z.object({
  schemaVersion: z.literal(1),
  stage: z.enum(["directions", "critique"]),
  executor: z.object({
    kind: z.literal("external-agent"),
    agentName: ShortText.nullable(),
    agentVersion: ShortText.nullable(),
    modelName: ShortText.nullable(),
    modelVersion: ShortText.nullable(),
  }).strict(),
  reproducibility: z.enum(["agent-reported", "unknown"]),
  instructionsVersion: ShortText,
  preparedAt: IsoTimestamp,
  submittedAt: IsoTimestamp,
  inputSha256: Sha256,
  instructionsSha256: Sha256,
  schemaSha256: Sha256,
  outputSha256: Sha256,
}).strict().superRefine((record, context) => {
  if (Date.parse(record.submittedAt) < Date.parse(record.preparedAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["submittedAt"],
      message: "submittedAt must not precede preparedAt",
    });
  }
  const hasReportedIdentity = [
    record.executor.agentName,
    record.executor.agentVersion,
    record.executor.modelName,
    record.executor.modelVersion,
  ].some((value) => value !== null);
  if ((record.reproducibility === "agent-reported") !== hasReportedIdentity) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reproducibility"],
      message: "Reproducibility class must reflect whether any executor identity was reported",
    });
  }
});

export type ExternalStageExecution = z.infer<typeof ExternalStageExecution>;
