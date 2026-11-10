import "server-only";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

/** Server configuration selects a name; it grants no provider or spending authority. */
export function parseOpenAiModelName(value: unknown): string {
  if (typeof value !== "string" || MODEL_NAME.exec(value)?.[0] !== value) throw new Error("openai_model_configuration_unavailable");
  return value;
}

export function readOpenAiModelName(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  const selected = environment.SOLMIND_OPENAI_MODEL;
  return parseOpenAiModelName(selected === undefined ? DEFAULT_OPENAI_MODEL : selected);
}

// Correction D-12 (2026-11-09): the time limit for one Virtual Guide reply is a setting of each provider model (Paul's
// decision, PRJ01-SPR002 decision queue, meeting part 2 entry, item 7). A model with no entry uses the default. The
// values stay within EXPLORER_SAFETY_REPLY_LIMITS.maximumTimeoutMilliseconds, and the overall Send deadline built from
// them stays within EXPLORER_SEND_TIME_LIMITS.ceilingMilliseconds; tests check both.
export const OPENAI_REPLY_LIMIT_MILLISECONDS: Readonly<{ default: number; models: Readonly<Record<string, number>> }> =
  Object.freeze({ default: 60_000, models: Object.freeze({}) });

export function openAiReplyLimitMilliseconds(modelName: string): number {
  const selected = parseOpenAiModelName(modelName);
  return Object.prototype.hasOwnProperty.call(OPENAI_REPLY_LIMIT_MILLISECONDS.models, selected)
    ? OPENAI_REPLY_LIMIT_MILLISECONDS.models[selected] : OPENAI_REPLY_LIMIT_MILLISECONDS.default;
}

/** A dated snapshot may identify the requested alias; a different variant may not. */
export function isOpenAiResponseModel(requested: string, returned: unknown): boolean {
  if (typeof returned !== "string") return false;
  const selected = parseOpenAiModelName(requested);
  const suffix = returned.slice(selected.length + 1);
  return returned === selected || (returned.startsWith(selected + "-") && /^\d{4}-\d{2}-\d{2}$/.exec(suffix)?.[0] === suffix);
}
