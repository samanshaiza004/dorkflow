import { describe, expect, test } from "bun:test";
import type { DesignModelInput } from "../src/contracts/design/index.ts";
import { CRITIQUES_RESPONSE_SCHEMA, DIRECTIONS_RESPONSE_SCHEMA } from "../src/design/response-schemas.ts";
import { OpenAIResponsesDesignProcessModel, OPENAI_RESPONSES_RUN_CONFIG } from "../src/design/openai-responses.ts";
import { CRITIQUE_INSTRUCTIONS, DIRECTIONS_INSTRUCTIONS } from "../src/design/process.ts";

const image = new Uint8Array(24);
image.set([137, 80, 78, 71, 13, 10, 26, 10]);
new DataView(image.buffer).setUint32(16, 1);
new DataView(image.buffer).setUint32(20, 1);
const imageBase64 = Buffer.from(image).toString("base64");

const modelInput: DesignModelInput = {
  schemaVersion: 1,
  intent: {
    schemaVersion: 2,
    id: "intent_12345678",
    product: "Expense Tracker",
    rationale: "Support frequent expense entry and review.",
    statements: [{ id: "istat_12345678", kind: "job", statement: "Record purchases quickly." }],
  },
  references: {
    schemaVersion: 2,
    id: "refs_12345678",
    intentRef: "intent_12345678",
    references: [{
      schemaVersion: 2,
      id: "ref_12345678",
      sourceKind: "local-project",
      use: [{ id: "raspect_12345678", aspect: "task relationships", rationale: "Preserve how users move between entry and history." }],
      doNotUse: [],
      evidenceRefs: ["ev_12345678"],
    }],
  },
  evidence: {
    schemaVersion: 1,
    id: "ev_12345678",
    purpose: "hierarchy",
    trustMode: "generated",
    contentTreatment: "original",
    originalPixelsApproved: true,
    renderingEnvironmentSha256: "a".repeat(64),
    sanitizer: null,
    captures: [{
      id: "cap_12345678",
      sha256: "b".repeat(64),
      stateRef: "st_12345678",
      stateKind: "default",
      triggerKinds: ["initial"],
      viewportRef: "vp_12345678",
      viewport: { label: "desktop", width: 1, height: 1 },
      mediaType: "image/png",
      width: 1,
      height: 1,
    }],
  },
  captures: [{
    id: "cap_12345678",
    sha256: "b".repeat(64),
    stateRef: "st_12345678",
    stateKind: "default",
    triggerKinds: ["initial"],
    viewportRef: "vp_12345678",
    viewport: { label: "desktop", width: 1, height: 1 },
    mediaType: "image/png",
    width: 1,
    height: 1,
    imageBase64,
  }],
  systemModel: null,
};

function directionsRequest() {
  return {
  promptVersion: "dorkflow-directions-v4" as const,
    instructions: DIRECTIONS_INSTRUCTIONS,
    responseShape: "three-design-directions" as const,
    responseSchema: DIRECTIONS_RESPONSE_SCHEMA,
  };
}

function assertStrictObjects(schema: Record<string, any>): void {
  if (schema.type === "object") {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required.slice().sort()).toEqual(Object.keys(schema.properties).sort());
    Object.values(schema.properties).forEach((child) => assertStrictObjects(child as Record<string, any>));
  }
  if (schema.type === "array") assertStrictObjects(schema.items);
  schema.anyOf?.forEach((child: Record<string, any>) => assertStrictObjects(child));
}

describe("experiment-only OpenAI Responses adapter", () => {
  test("uses a strict response contract that mirrors Dorkflow's output objects", () => {
    assertStrictObjects(DIRECTIONS_RESPONSE_SCHEMA as Record<string, any>);
    assertStrictObjects(CRITIQUES_RESPONSE_SCHEMA as Record<string, any>);
    expect(Object.keys(DIRECTIONS_RESPONSE_SCHEMA.properties ?? {})).toEqual(["directions"]);
    expect(Object.keys(CRITIQUES_RESPONSE_SCHEMA.properties ?? {})).toEqual(["critiques"]);
    expect(OPENAI_RESPONSES_RUN_CONFIG).toEqual({
      endpoint: "https://api.openai.com/v1/responses",
      requestedModel: "chat-latest",
      maxOutputTokens: 12_000,
      store: false,
      tools: [],
    });
  });

  test("constrains opaque references and prose like the runtime contracts", () => {
    const direction = DIRECTIONS_RESPONSE_SCHEMA.properties?.directions?.items as Record<string, any>;
    const choice = direction.properties.choices.items as Record<string, any>;
    const critique = CRITIQUES_RESPONSE_SCHEMA.properties?.critiques?.items as Record<string, any>;

    expect(direction.properties.id.pattern).toBe("^dir_[a-z0-9]{8,64}$");
    expect(direction.properties.thesis).toMatchObject({ minLength: 1, maxLength: 5000, pattern: "\\S" });
    expect(choice.properties.id.pattern).toBe("^choice_[a-z0-9]{8,64}$");
    expect(choice.properties.captureRefs.items.pattern).toBe("^cap_[a-z0-9]{8,64}$");
    expect(critique.properties.id.pattern).toBe("^crit_[a-z0-9]{8,64}$");
    expect(critique.properties.findings.items.properties.id.pattern).toBe("^finding_[a-z0-9]{8,64}$");
  });

  test("sends only Dorkflow input, local images, strict JSON schema, and no tools", async () => {
    let sentUrl = "";
    let sentBody: Record<string, any> | undefined;
    const rawOutput = '{"directions":[]}';
    const model = new OpenAIResponsesDesignProcessModel("test-key", async (url, init) => {
      sentUrl = String(url);
      sentBody = JSON.parse(String(init?.body)) as Record<string, any>;
      return new Response(JSON.stringify({
        status: "completed",
        model: "chat-latest",
        temperature: null,
        top_p: 1,
        max_output_tokens: 12_000,
        output: [{ type: "message", content: [{ type: "output_text", text: rawOutput }] }],
        usage: { input_tokens: 1200, output_tokens: 600, total_tokens: 1800 },
      }), { status: 200 });
    });

    const result = await model.proposeDirections(modelInput, directionsRequest());
    expect(sentUrl).toBe("https://api.openai.com/v1/responses");
    expect(sentBody?.model).toBe("chat-latest");
    expect(sentBody?.instructions).toBe(DIRECTIONS_INSTRUCTIONS);
    expect(sentBody?.store).toBe(false);
    expect(sentBody?.max_output_tokens).toBe(12_000);
    expect("tools" in sentBody!).toBe(false);
    expect(sentBody?.text.format).toEqual({
      type: "json_schema",
      name: "dorkflow_directions",
      strict: true,
      schema: DIRECTIONS_RESPONSE_SCHEMA,
    });
    const content = sentBody?.input[0].content as Array<Record<string, string>>;
    expect(content.filter((part) => part.type === "input_image")).toHaveLength(1);
    expect(content.find((part) => part.type === "input_image")?.image_url).toBe(`data:image/png;base64,${imageBase64}`);
    expect(content.filter((part) => part.type === "input_text").map((part) => part.text).join(" ")).not.toContain(imageBase64);
    expect(result.rawOutput).toBe(rawOutput);
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("chat-latest");
    expect(result.modelVersion).toBeNull();
    expect(result.sampling).toEqual({ temperature: null, topP: 1, seed: null, maxOutputTokens: 12_000 });
    expect(result.tokenUsage).toEqual({ inputTokens: 1200, outputTokens: 600, totalTokens: 1800 });
    expect(result.toolPermissions).toEqual({ enabled: false, allowedTools: [] });
    expect(Date.parse(result.finishedAt)).toBeGreaterThanOrEqual(Date.parse(result.startedAt));
  });

  test("records a concrete returned model identifier only when the API supplies one", async () => {
    const model = new OpenAIResponsesDesignProcessModel("test-key", async () => new Response(JSON.stringify({
      status: "completed",
      model: "chat-latest-2026-09-28",
      output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
      usage: {},
    }), { status: 200 }));
    const result = await model.proposeDirections(modelInput, directionsRequest());
    expect(result.model).toBe("chat-latest");
    expect(result.modelVersion).toBe("chat-latest-2026-09-28");
    expect(result.sampling).toEqual({ temperature: null, topP: null, seed: null, maxOutputTokens: 12_000 });
    expect(result.tokenUsage).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null });
  });

  test("refuses missing credentials and does not disclose the key in error messages", async () => {
    expect(() => new OpenAIResponsesDesignProcessModel(" ")).toThrow("API key is required");
    const model = new OpenAIResponsesDesignProcessModel("secret-test-value", async () => new Response("", {
      status: 401,
      headers: { "x-request-id": "req_test" },
    }));
    await expect(model.proposeDirections(modelInput, directionsRequest())).rejects.toThrow("HTTP 401 (request req_test)");
    await expect(model.proposeDirections(modelInput, directionsRequest())).rejects.not.toThrow("secret-test-value");
  });

  test("uses the same model and strict critique schema for the critique call", async () => {
    let body: Record<string, any> | undefined;
    const model = new OpenAIResponsesDesignProcessModel("test-key", async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, any>;
      return new Response(JSON.stringify({
        status: "completed",
        model: "chat-latest",
        output: [{ type: "message", content: [{ type: "output_text", text: '{"critiques":[]}' }] }],
        usage: {},
      }), { status: 200 });
    });
    await model.critiqueDirections({ context: modelInput, directions: [] }, {
      promptVersion: "dorkflow-critique-v4",
      instructions: CRITIQUE_INSTRUCTIONS,
      responseShape: "three-critique-reports",
      responseSchema: CRITIQUES_RESPONSE_SCHEMA,
    });
    expect(body?.model).toBe("chat-latest");
    expect(body?.text.format).toEqual({
      type: "json_schema",
      name: "dorkflow_critiques",
      strict: true,
      schema: CRITIQUES_RESPONSE_SCHEMA,
    });
    const text = body?.input[0].content.find((part: Record<string, unknown>) => part.type === "input_text").text as string;
    expect(text).toContain("proposedDirections");
  });
});
