import { z } from "zod";
import { Sha256, StateDefinitionId } from "./common.ts";

const Selector = z.string().trim().min(1).max(500);
const PagePath = z.string().trim().min(1).max(2000).refine(
  (path) => path.startsWith("/") && !path.startsWith("//") && !path.split("/").includes(".."),
  "pagePath must be a local absolute path without traversal segments",
);

export const SetupAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), selector: Selector }).strict(),
  z.object({ type: z.literal("hover"), selector: Selector }).strict(),
  z.object({ type: z.literal("mouse-down"), selector: Selector }).strict(),
  z.object({ type: z.literal("mouse-up") }).strict(),
  z.object({ type: z.literal("focus"), selector: Selector }).strict(),
  z.object({ type: z.literal("fill"), selector: Selector, value: z.string().max(1000) }).strict(),
  z.object({ type: z.literal("press"), selector: Selector, key: z.string().trim().min(1).max(80) }).strict(),
  z.object({ type: z.literal("check"), selector: Selector }).strict(),
  z.object({ type: z.literal("uncheck"), selector: Selector }).strict(),
  z.object({ type: z.literal("select-option"), selector: Selector, value: z.string().max(1000) }).strict(),
  z.object({
    type: z.literal("tab"),
    selector: Selector,
    key: z.enum(["Tab", "Shift+Tab"]).default("Tab"),
  }).strict(),
]);

const BasicAssertion = z.object({
  selector: Selector,
  condition: z.enum([
    "visible",
    "hidden",
    "enabled",
    "disabled",
    "checked",
    "unchecked",
    "hovered",
    "focused",
    "focus-visible",
    "active",
  ]),
}).strict();

const AttributeAssertion = z.object({
  selector: Selector,
  condition: z.literal("attribute"),
  name: z.string().regex(/^[a-zA-Z_:][a-zA-Z0-9_.:-]{0,127}$/),
  // The expected value is hashed so assertion text never enters model-facing state records.
  value: Sha256,
}).strict();

export const StateAssertion = z.discriminatedUnion("condition", [
  BasicAssertion,
  AttributeAssertion,
]);

export const InterfaceStateKind = z.enum([
  "default",
  "hover",
  "focus-visible",
  "active",
  "disabled",
  "open",
  "closed",
  "empty",
  "error",
  "loading",
  "selected",
  "custom",
]);

export const StateDefinition = z
  .object({
    schemaVersion: z.literal(1),
    id: StateDefinitionId,
    pagePath: PagePath,
    viewport: z.object({
      label: z.string().trim().min(1).max(80),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }).strict(),
    setupActions: z.array(SetupAction),
    targetSelector: Selector.nullable(),
    stateKind: InterfaceStateKind,
    settleMs: z.number().int().min(0).max(5000),
    assertions: z.array(StateAssertion),
  })
  .strict();

export const StateMatrix = z
  .object({
    schemaVersion: z.literal(1),
    states: z.array(StateDefinition).min(1),
  })
  .strict()
  .superRefine((matrix, context) => {
    const seen = new Set<string>();
    matrix.states.forEach((state, index) => {
      if (seen.has(state.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["states", index, "id"],
          message: "State definition IDs must be unique within a matrix",
        });
      }
      seen.add(state.id);
    });
  });

export type SetupAction = z.infer<typeof SetupAction>;
export type StateAssertion = z.infer<typeof StateAssertion>;
export type InterfaceStateKind = z.infer<typeof InterfaceStateKind>;
export type StateDefinition = z.infer<typeof StateDefinition>;
export type StateMatrix = z.infer<typeof StateMatrix>;
