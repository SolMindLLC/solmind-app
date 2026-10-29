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

/** A dated snapshot may identify the requested alias; a different variant may not. */
export function isOpenAiResponseModel(requested: string, returned: unknown): boolean {
  if (typeof returned !== "string") return false;
  const selected = parseOpenAiModelName(requested);
  const suffix = returned.slice(selected.length + 1);
  return returned === selected || (returned.startsWith(selected + "-") && /^\d{4}-\d{2}-\d{2}$/.exec(suffix)?.[0] === suffix);
}
