import { describe, expect, it } from "vitest";
import { DEFAULT_OPENAI_MODEL, isOpenAiResponseModel, parseOpenAiModelName, readOpenAiModelName } from "./openAiModelConfiguration";

describe("server OpenAI model setting", () => {
  it("defaults only an absent setting and retains a valid explicit model", () => {
    expect(readOpenAiModelName({})).toBe(DEFAULT_OPENAI_MODEL);
    expect(readOpenAiModelName({ SOLMIND_OPENAI_MODEL: "synthetic-compatible-model" })).toBe("synthetic-compatible-model");
  });

  it.each(["", " gpt-5.6-luna", "gpt-5.6-luna ", "model\n", "model/name", "x".repeat(121), "mod\u00E8le", null])("refuses malformed selection %j", value => {
    expect(() => parseOpenAiModelName(value)).toThrow("openai_model_configuration_unavailable");
  });

  it("accepts only the selected model or its dated snapshot", () => {
    expect(isOpenAiResponseModel("synthetic-compatible-model", "synthetic-compatible-model")).toBe(true);
    expect(isOpenAiResponseModel("synthetic-compatible-model", "synthetic-compatible-model-2026-10-28")).toBe(true);
    expect(isOpenAiResponseModel("synthetic-compatible-model", "synthetic-compatible-model-mini")).toBe(false);
    expect(isOpenAiResponseModel("synthetic-compatible-model", "other-model")).toBe(false);
    expect(isOpenAiResponseModel("synthetic-compatible-model", "synthetic-compatible-model-2026-10-28\n")).toBe(false);
  });
});
