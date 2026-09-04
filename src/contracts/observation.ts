import { z } from "zod";
import {
  ComponentKey,
  ElementId,
  EvidenceId,
  ObservationValueId,
  PageKey,
  RelationshipId,
  ViewportKey,
} from "./ids.ts";

const finite = z.number().finite();
const nonNegative = finite.min(0);

export const Viewport = z
  .object({
    id: ViewportKey,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    deviceScaleFactor: z.number().positive(),
    label: z.enum(["mobile", "tablet", "desktop"]),
  })
  .strict();

export const Geometry = z
  .object({
    x: finite,
    y: finite,
    width: nonNegative,
    height: nonNegative,
  })
  .strict();

export const Typography = z
  .object({
    familyFingerprint: z.string().regex(/^fp_font_[a-z0-9]{8,64}$/),
    fontSize: nonNegative,
    fontWeight: z.number().int().min(1).max(1000),
    lineHeight: nonNegative,
    letterSpacing: finite,
    textAlign: z.enum(["left", "center", "right", "justify", "start", "end"]),
    textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]),
  })
  .strict();

export const Border = z
  .object({
    width: nonNegative,
    style: z.enum(["none", "solid", "dashed", "dotted", "double", "other"]),
    color: z.string().regex(/^(#[0-9a-f]{6}|rgba?\([^\n]{1,100}\))$/i),
  })
  .strict();

export const Shadow = z
  .object({
    offsetX: finite,
    offsetY: finite,
    blur: nonNegative,
    spread: finite,
    color: z.string().regex(/^(#[0-9a-f]{6}|rgba?\([^\n]{1,100}\))$/i),
  })
  .strict();

export const Paint = z
  .object({
    color: z.string().regex(/^(#[0-9a-f]{6}|rgba?\([^\n]{1,100}\))$/i),
    backgroundColor: z.string().regex(/^(#[0-9a-f]{6}|rgba?\([^\n]{1,100}\))$/i),
    border: Border,
    radius: z
      .object({
        topLeft: nonNegative,
        topRight: nonNegative,
        bottomRight: nonNegative,
        bottomLeft: nonNegative,
      })
      .strict(),
    shadow: Shadow.nullable(),
    opacity: z.number().min(0).max(1),
  })
  .strict();

export const Spacing = z
  .object({
    top: finite,
    right: finite,
    bottom: finite,
    left: finite,
  })
  .strict();

export const Layout = z
  .object({
    display: z.enum(["block", "inline", "inline-block", "flex", "grid", "table", "none", "other"]),
    position: z.enum(["static", "relative", "absolute", "fixed", "sticky"]),
    parentId: ElementId.nullable(),
    componentKey: ComponentKey.nullable(),
    gap: finite,
    padding: Spacing,
    margin: Spacing,
    flexDirection: z.enum(["row", "row-reverse", "column", "column-reverse", "none"]),
    alignItems: z.enum(["normal", "start", "end", "center", "stretch", "baseline", "other"]),
    justifyContent: z.enum(["normal", "start", "end", "center", "space-between", "space-around", "space-evenly", "other"]),
  })
  .strict();

export const ContentMetrics = z
  .object({
    characterCount: z.number().int().min(0),
    lineCount: z.number().int().min(0),
    wraps: z.boolean(),
  })
  .strict();

export const ElementRole = z.enum([
  "page",
  "region",
  "header",
  "banner",
  "navigation",
  "main",
  "footer",
  "heading",
  "paragraph",
  "link",
  "button",
  "card",
  "image",
  "form",
  "input",
  "list",
  "listitem",
  "generic",
]);

export const InteractionState = z.enum([
  "default",
  "hover",
  "focus-visible",
  "active",
  "disabled",
  "aria-disabled",
  "open",
  "closed",
]);

export const ElementObservation = z
  .object({
    id: ElementId,
    pageKey: PageKey,
    viewportKey: ViewportKey,
    state: InteractionState,
    role: ElementRole,
    geometry: Geometry,
    typography: Typography,
    paint: Paint,
    layout: Layout,
    contentMetrics: ContentMetrics,
    evidenceIds: z.array(EvidenceId).min(1),
  })
  .strict();

export const ValueKind = z.enum([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "spacing",
  "dimension",
  "radius",
  "border",
  "shadow",
  "opacity",
]);

export const ObservedValue = z
  .object({
    id: ObservationValueId,
    kind: ValueKind,
    normalizedValue: z.union([z.string(), finite]),
    units: z.enum(["px", "ratio", "unitless", "color", "fingerprint", "none"]),
    occurrenceCount: z.number().int().positive(),
    pageCount: z.number().int().positive(),
    viewportCount: z.number().int().positive(),
    elementCount: z.number().int().positive(),
    roles: z.array(ElementRole),
    states: z.array(InteractionState),
    componentKeys: z.array(ComponentKey),
    evidenceIds: z.array(EvidenceId).min(1),
  })
  .strict();

export const RelationshipType = z.enum([
  "same-observed-value",
  "repeated-pattern",
  "parent-child",
  "alignment",
  "spacing",
  "state-delta",
  "responsive-change",
  "co-occurrence",
]);

export const Relationship = z
  .object({
    id: RelationshipId,
    type: RelationshipType,
    subjectIds: z.array(z.union([ElementId, ObservationValueId])).min(1),
    objectIds: z.array(z.union([ElementId, ObservationValueId])).min(1),
    evidenceIds: z.array(EvidenceId).min(1),
    magnitude: finite.nullable(),
  })
  .strict();

export const InventoryStats = z
  .object({
    elementCount: z.number().int().nonnegative(),
    valueCount: z.number().int().nonnegative(),
    relationshipCount: z.number().int().nonnegative(),
    pageCount: z.number().int().positive(),
    viewportCount: z.number().int().positive(),
    stateCount: z.number().int().positive(),
  })
  .strict();

export const TrustedObservationBundle = z
  .object({
    schemaVersion: z.literal(1),
    viewports: z.array(Viewport).min(1),
    elements: z.array(ElementObservation),
    values: z.array(ObservedValue),
    relationships: z.array(Relationship),
    inventoryStats: InventoryStats,
  })
  .strict();

export const ModelInput = z
  .object({
    schemaVersion: z.literal(1),
    viewports: z.array(Viewport).min(1),
    elements: z.array(ElementObservation),
    values: z.array(ObservedValue),
    relationships: z.array(Relationship),
    inventoryStats: InventoryStats,
  })
  .strict();

export type Viewport = z.infer<typeof Viewport>;
export type ElementObservation = z.infer<typeof ElementObservation>;
export type ObservedValue = z.infer<typeof ObservedValue>;
export type Relationship = z.infer<typeof Relationship>;
export type TrustedObservationBundle = z.infer<typeof TrustedObservationBundle>;
export type ModelInput = z.infer<typeof ModelInput>;
