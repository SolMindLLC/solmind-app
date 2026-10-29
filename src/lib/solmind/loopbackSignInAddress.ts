// Public presentation helper only. Origins and role choose a link, never authority.
export type LoopbackSignInRole = "explorer" | "guide" | "admin";

function canonicalOrigin(value: unknown): URL | null {
  if (typeof value !== "string" || /[\u0000-\u0020\u007f-\u009f,]/u.test(value)) return null;
  try {
    const origin = new URL(value);
    return (origin.protocol === "http:" || origin.protocol === "https:") &&
      origin.username === "" && origin.password === "" && origin.pathname === "/" &&
      origin.search === "" && origin.hash === "" && origin.origin === value ? origin : null;
  } catch { return null; }
}

export function loopbackSignInAddress(
  currentOrigin: unknown, configuredOrigin: unknown, role: unknown,
): string | null {
  if (role !== "explorer" && role !== "guide" && role !== "admin") return null;
  const current = canonicalOrigin(currentOrigin), configured = canonicalOrigin(configuredOrigin);
  if (!current || !configured || current.protocol !== configured.protocol || current.port !== configured.port) return null;
  const opposite = (current.hostname === "localhost" && configured.hostname === "127.0.0.1") ||
    (current.hostname === "127.0.0.1" && configured.hostname === "localhost");
  return opposite ? `${configured.origin}/login/${role}` : null;
}
