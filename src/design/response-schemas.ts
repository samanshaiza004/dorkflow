/** Provider-neutral strict JSON Schemas for the existing direction and critique contracts. */
export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  enum?: Array<string | number>;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

type StringOptions = {
  values?: string[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

const string = (options: StringOptions = {}): JsonSchema => ({
  type: "string",
  ...(options.values === undefined ? {} : { enum: options.values }),
  ...(options.minLength === undefined ? {} : { minLength: options.minLength }),
  ...(options.maxLength === undefined ? {} : { maxLength: options.maxLength }),
  ...(options.pattern === undefined ? {} : { pattern: options.pattern }),
});
const integer = (values?: number[]): JsonSchema => values ? { type: "integer", enum: values } : { type: "integer" };
const array = (items: JsonSchema, minItems?: number, maxItems?: number): JsonSchema => ({
  type: "array",
  items,
  ...(minItems === undefined ? {} : { minItems }),
  ...(maxItems === undefined ? {} : { maxItems }),
});
const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const opaqueId = (prefix: string): JsonSchema => string({ pattern: `^${prefix}_[a-z0-9]{8,64}$` });
const nonEmptyText = (maxLength = 5000): JsonSchema => string({
  minLength: 1,
  maxLength,
  pattern: "\\S",
});
const designSlug = string({
  maxLength: 64,
  pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
});

const density = string({ values: ["sparse", "relaxed", "balanced", "compact", "dense", "other"] });
const surfaceModel = string({ values: ["flat", "bounded", "elevated", "layered", "immersive", "other"] });

const profileReferenceKinds = ["profile-floor", "profile-rail", "profile-compass"] as const;
const profileItemId = string({
  maxLength: 80,
  pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
});
const profileReference = (kind: (typeof profileReferenceKinds)[number]): JsonSchema => object({
  kind: string({ values: [kind] }),
  id: profileItemId,
});
const profileReferences = profileReferenceKinds.map(profileReference);

const directionChoice = object({
  id: opaqueId("choice"),
  area: string({ values: [
    "typography", "palette", "spatial-model", "density", "layout", "surfaces",
    "borders", "imagery", "motion", "navigation", "component-anatomy",
  ] }),
  statement: nonEmptyText(),
  rationale: nonEmptyText(),
  intentRefs: array(opaqueId("istat")),
  referenceAspectRefs: array(opaqueId("raspect")),
  evidenceRefs: array(opaqueId("ev")),
  captureRefs: array(opaqueId("cap")),
  profileRefs: array({ anyOf: profileReferences }),
});

const designDirection = object({
  schemaVersion: integer([2]),
  id: opaqueId("dir"),
  thesis: nonEmptyText(),
  rationale: nonEmptyText(),
  intentRefs: array(opaqueId("istat"), 1),
  evidenceRefs: array(opaqueId("ev"), 1),
  decisionRefs: array(opaqueId("hdec")),
  systemModelRefs: array(opaqueId("sys")),
  strategyAxes: object({
    composition: designSlug,
    spatialModel: designSlug,
    density,
    navigationModel: designSlug,
    hierarchy: designSlug,
    surfaceModel,
    componentAnatomy: designSlug,
    imagery: designSlug,
    motion: designSlug,
  }),
  choices: array(directionChoice, 1),
  uncertainties: array(nonEmptyText()),
});

export const DIRECTIONS_RESPONSE_SCHEMA = object({
  directions: array(designDirection, 3, 3),
});

const supportRef = (kind: string, prefix: string): JsonSchema => object({
  kind: string({ values: [kind] }),
  id: opaqueId(prefix),
});

const anySupportRef = (
  kinds: Array<{ kind: string; prefix: string }>,
  includeProfileReferences = false,
): JsonSchema => ({
  anyOf: [
    ...kinds.map(({ kind, prefix }) => supportRef(kind, prefix)),
    ...(includeProfileReferences ? profileReferences : []),
  ],
});

const critiqueFinding = object({
  id: opaqueId("finding"),
  category: string({ values: [
    "necessity", "specificity", "consistency", "exception", "dependency",
    "default-suspicion", "hierarchy", "accessibility", "responsive", "motion",
  ] }),
  severity: string({ values: ["informational", "low", "medium", "high", "blocking"] }),
  supportRefs: array(anySupportRef([
    { kind: "intent-statement", prefix: "istat" },
    { kind: "reference-aspect", prefix: "raspect" },
    { kind: "state-evidence", prefix: "cap" },
    { kind: "system-model", prefix: "sys" },
    { kind: "system-token", prefix: "tok" },
    { kind: "human-decision", prefix: "hdec" },
    { kind: "direction-choice", prefix: "choice" },
  ], true), 1),
  rationale: nonEmptyText(),
  suggestedResolution: nonEmptyText(),
});

const choiceSupportAssessment = object({
  choiceRef: opaqueId("choice"),
  assessment: string({ values: ["supported", "weakly-supported", "unsupported-default-like"] }),
  supportRefs: array(anySupportRef([
    { kind: "intent-statement", prefix: "istat" },
    { kind: "reference-aspect", prefix: "raspect" },
    { kind: "state-evidence", prefix: "cap" },
    { kind: "system-model", prefix: "sys" },
    { kind: "system-token", prefix: "tok" },
    { kind: "human-decision", prefix: "hdec" },
  ], true), 1),
  rationale: nonEmptyText(),
});

const critiqueReport = object({
  schemaVersion: integer([2]),
  id: opaqueId("crit"),
  directionRef: opaqueId("dir"),
  intentRefs: array(opaqueId("istat"), 1),
  evidenceRefs: array(opaqueId("ev"), 1),
  findings: array(critiqueFinding),
  choiceAssessments: array(choiceSupportAssessment, 1),
  uncertainties: array(nonEmptyText()),
});

export const CRITIQUES_RESPONSE_SCHEMA = object({
  critiques: array(critiqueReport, 3, 3),
});
