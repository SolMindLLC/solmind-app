// PRJ01_V-WS05-WI022-S03 trusted application-origin configuration.
//
// Authenticated browser writes compare Origin against one server-configured,
// canonical application origin. Request Host and forwarded headers are never
// accepted as authority.

import "server-only";

export const SOLMIND_TRUSTED_APP_ORIGIN_ENV =
  "SOLMIND_TRUSTED_APP_ORIGIN" as const;
export const SOLMIND_TRUSTED_APP_ORIGIN_CONFIGURATION_FAILED =
  "SolMind trusted application origin is unavailable." as const;

const FORBIDDEN_CHARACTER = /[\u0000-\u0020\u007f-\u009f,]/u;

export function parseTrustedApplicationOrigin(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    FORBIDDEN_CHARACTER.test(value)
  ) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.pathname !== "/" ||
      parsed.search !== "" ||
      parsed.hash !== "" ||
      parsed.origin === "null"
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function loadTrustedApplicationOrigin(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const origin = parseTrustedApplicationOrigin(
    environment[SOLMIND_TRUSTED_APP_ORIGIN_ENV],
  );
  if (origin === null) {
    throw new Error(SOLMIND_TRUSTED_APP_ORIGIN_CONFIGURATION_FAILED);
  }
  return origin;
}
