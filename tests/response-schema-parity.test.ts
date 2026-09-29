import { expect, test } from "bun:test";
import { DesignProfileChoiceRef } from "../src/contracts/design/direction.ts";
import { ChoiceGroundingRef, CritiqueSupportRef } from "../src/contracts/design/critique.ts";
import { CRITIQUES_RESPONSE_SCHEMA, DIRECTIONS_RESPONSE_SCHEMA } from "../src/design/response-schemas.ts";

type SchemaNode = {
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  anyOf?: SchemaNode[];
  enum?: Array<string | number>;
  required?: string[];
  pattern?: string;
  maxLength?: number;
};

function property(node: SchemaNode, name: string): SchemaNode {
  const result = node.properties?.[name];
  if (!result) throw new Error("Expected a JSON Schema property");
  return result;
}

function alternatives(node: SchemaNode): SchemaNode {
  if (!node.items) throw new Error("Expected a JSON Schema array");
  return node.items;
}

function supportedKinds(node: SchemaNode): string[] {
  return (node.anyOf ?? [])
    .map((variant) => variant.properties?.kind?.enum?.[0])
    .filter((kind): kind is string => typeof kind === "string")
    .sort();
}

function runtimeKinds(union: { options: Array<{ shape: { kind: { value: string } } }> }): string[] {
  return union.options.map((variant) => variant.shape.kind.value).sort();
}

test("directions JSON Schema exposes every runtime profile reference kind", () => {
  const direction = alternatives(property(DIRECTIONS_RESPONSE_SCHEMA, "directions"));
  const choice = alternatives(property(direction, "choices"));
  const profileRefs = property(choice, "profileRefs");

  expect(supportedKinds(alternatives(profileRefs))).toEqual(runtimeKinds(DesignProfileChoiceRef));
  expect(choice.required).toContain("profileRefs");
  for (const variant of alternatives(profileRefs).anyOf ?? []) {
    expect(variant.properties?.id).toMatchObject({
      pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
      maxLength: 80,
    });
  }
});

test("critique JSON Schemas expose every runtime support-reference kind", () => {
  const critique = alternatives(property(CRITIQUES_RESPONSE_SCHEMA, "critiques"));
  const finding = alternatives(property(critique, "findings"));
  const assessment = alternatives(property(critique, "choiceAssessments"));
  const findingRefs = alternatives(property(finding, "supportRefs"));
  const assessmentRefs = alternatives(property(assessment, "supportRefs"));

  expect(supportedKinds(findingRefs)).toEqual(runtimeKinds(CritiqueSupportRef));
  expect(supportedKinds(assessmentRefs)).toEqual(runtimeKinds(ChoiceGroundingRef));
});
