import { z } from "zod";
import {
  DesignIntentId,
  IntentStatementId,
  NonEmptyText,
  ShortText,
} from "./common.ts";

export const IntentStatementKind = z.enum([
  "audience",
  "job",
  "attribute",
  "avoid",
  "constraint",
  "strength",
  "problem",
]);

export const IntentStatement = z
  .object({
    id: IntentStatementId,
    kind: IntentStatementKind,
    statement: NonEmptyText,
    rationale: NonEmptyText.optional(),
  })
  .strict();

export const DesignIntent = z
  .object({
    schemaVersion: z.literal(2),
    id: DesignIntentId,
    product: ShortText,
    rationale: NonEmptyText,
    statements: z.array(IntentStatement).min(1),
  })
  .strict()
  .superRefine((intent, context) => {
    const seen = new Set<string>();
    intent.statements.forEach((statement, index) => {
      if (seen.has(statement.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["statements", index, "id"],
          message: "Intent statement IDs must be unique within an intent",
        });
      }
      seen.add(statement.id);
    });
  });

export type IntentStatementKind = z.infer<typeof IntentStatementKind>;
export type IntentStatement = z.infer<typeof IntentStatement>;
export type DesignIntent = z.infer<typeof DesignIntent>;
