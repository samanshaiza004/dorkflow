import type { DesignDirection, DesignModelInput } from "../contracts/design/index.ts";
import type {
  CritiqueRequest,
  DesignProcessModel,
  DirectionRequest,
  ModelCallResponse,
} from "./process.ts";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const REQUESTED_MODEL = "chat-latest";
const MAX_OUTPUT_TOKENS = 12_000;

type ResponsesPayload = {
  status?: unknown;
  model?: unknown;
  temperature?: unknown;
  top_p?: unknown;
  max_output_tokens?: unknown;
  output?: unknown;
  usage?: unknown;
  error?: unknown;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonnegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function outputText(payload: ResponsesPayload): string {
  if (payload.status !== "completed") {
    throw new Error(`OpenAI Responses API returned a non-completed response (${String(payload.status ?? "unknown")})`);
  }
  if (!Array.isArray(payload.output)) throw new Error("OpenAI Responses API response omitted output items");
  const pieces: string[] = [];
  for (const item of payload.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const record = part as { type?: unknown; text?: unknown };
      if (record.type === "refusal") throw new Error("OpenAI refused the structured design-process request");
      if (record.type === "output_text" && typeof record.text === "string") pieces.push(record.text);
    }
  }
  if (pieces.length === 0) throw new Error("OpenAI Responses API response contained no output text");
  return pieces.join("");
}

function inputContent(
  input: DesignModelInput,
  directions?: DesignDirection[],
): Array<Record<string, unknown>> {
  const { captures, ...context } = input;
  const textData = {
    designModelInput: context,
    captures: captures.map(({ imageBase64: _image, ...metadata }) => metadata),
    ...(directions === undefined ? {} : { proposedDirections: directions }),
  };
  const content: Array<Record<string, unknown>> = [{
    type: "input_text",
    text: `Dorkflow structured input (all identifiers are exact references):\n${JSON.stringify(textData)}`,
  }];
  for (const capture of captures) {
    content.push({
      type: "input_text",
      text: `Rendered interface capture ${capture.id}; state ${capture.stateRef}; viewport ${capture.viewport.label} ${capture.viewport.width}x${capture.viewport.height}.`,
    });
    content.push({
      type: "input_image",
      image_url: `data:image/png;base64,${capture.imageBase64}`,
      detail: "high",
    });
  }
  return content;
}

/** Optional BYOK/headless experiment caller: no tools, conversation state, or provider framework. */
export class OpenAIResponsesDesignProcessModel implements DesignProcessModel {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = globalThis.fetch,
  ) {
    if (!apiKey.trim()) throw new Error("An OpenAI API key is required");
  }

  async proposeDirections(input: DesignModelInput, request: DirectionRequest): Promise<ModelCallResponse> {
    return this.invoke(input, request);
  }

  async critiqueDirections(
    input: { context: DesignModelInput; directions: DesignDirection[] },
    request: CritiqueRequest,
  ): Promise<ModelCallResponse> {
    return this.invoke(input.context, request, input.directions);
  }

  private async invoke(
    input: DesignModelInput,
    request: DirectionRequest | CritiqueRequest,
    directions?: DesignDirection[],
  ): Promise<ModelCallResponse> {
    const startedAt = new Date().toISOString();
    const response = await this.fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: REQUESTED_MODEL,
        instructions: request.instructions,
        input: [{ role: "user", content: inputContent(input, directions) }],
        max_output_tokens: MAX_OUTPUT_TOKENS,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: request.responseShape === "three-design-directions" ? "dorkflow_directions" : "dorkflow_critiques",
            strict: true,
            schema: request.responseSchema,
          },
        },
      }),
    });
    if (!response.ok) {
      const requestId = response.headers.get("x-request-id");
      throw new Error(`OpenAI Responses API request failed with HTTP ${response.status}${requestId ? ` (request ${requestId})` : ""}`);
    }

    const payload = await response.json() as ResponsesPayload;
    if (payload.error !== undefined && payload.error !== null) {
      throw new Error("OpenAI Responses API returned an error response");
    }
    const rawOutput = outputText(payload);
    const usage = payload.usage && typeof payload.usage === "object"
      ? payload.usage as Record<string, unknown>
      : {};
    const responseModel = typeof payload.model === "string" ? payload.model : null;

    return {
      provider: "openai",
      model: REQUESTED_MODEL,
      modelVersion: responseModel !== null && responseModel !== REQUESTED_MODEL ? responseModel : null,
      sampling: {
        temperature: finiteNumber(payload.temperature),
        topP: finiteNumber(payload.top_p),
        seed: null,
        maxOutputTokens: finiteNumber(payload.max_output_tokens) === null
          ? MAX_OUTPUT_TOKENS
          : nonnegativeInteger(payload.max_output_tokens),
      },
      tokenUsage: {
        inputTokens: nonnegativeInteger(usage.input_tokens),
        outputTokens: nonnegativeInteger(usage.output_tokens),
        totalTokens: nonnegativeInteger(usage.total_tokens),
      },
      toolPermissions: { enabled: false, allowedTools: [] },
      startedAt,
      finishedAt: new Date().toISOString(),
      rawOutput,
    };
  }
}

export const OPENAI_RESPONSES_RUN_CONFIG = {
  endpoint: OPENAI_RESPONSES_URL,
  requestedModel: REQUESTED_MODEL,
  maxOutputTokens: MAX_OUTPUT_TOKENS,
  store: false,
  tools: [],
} as const;
