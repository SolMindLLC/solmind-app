import { parseExplorerEarlyTestNoticeResult, type ExplorerEarlyTestNoticeResult } from "./explorerEarlyTestNotice";

const UNAVAILABLE: ExplorerEarlyTestNoticeResult = Object.freeze({ status: "unavailable", noticeVersion: null });

// No automatic write retry. A lost agreement response is resolved by a fresh
// status read; the database also makes an explicit repeated agreement safe.
export async function requestExplorerEarlyTestNotice(
  path: "/explorer/early-test-notice/status" | "/explorer/early-test-notice/agree",
  body: Readonly<{ noticeVersion: string; adultAffirmation: true }> | null,
  signal: AbortSignal,
): Promise<ExplorerEarlyTestNoticeResult> {
  const controller = new AbortController();
  let finishWait: (result: ExplorerEarlyTestNoticeResult) => void = () => undefined;
  const stopped = new Promise<ExplorerEarlyTestNoticeResult>(resolve => { finishWait = resolve; });
  const cancel = () => { controller.abort(); finishWait(UNAVAILABLE); };
  signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 10_000);
  if (signal.aborted) cancel();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  async function read(): Promise<ExplorerEarlyTestNoticeResult> {
    try {
      const response = await fetch(path, {
        method: body === null ? "GET" : "POST", cache: "no-store", credentials: "same-origin", redirect: "error",
        headers: { Accept: "application/json", ...(body === null ? {} : { "Content-Type": "application/json" }) },
        ...(body === null ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
      });
      if (controller.signal.aborted || !response.ok || response.redirected ||
          !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(response.headers.get("content-type") ?? "") || !response.body) {
        await response.body?.cancel();
        return UNAVAILABLE;
      }
      reader = response.body.getReader();
      const bytes = new Uint8Array(1024);
      let length = 0;
      for (;;) {
        const chunk = await reader.read();
        if (controller.signal.aborted) return UNAVAILABLE;
        if (chunk.done) break;
        if (length + chunk.value.byteLength > bytes.byteLength) return UNAVAILABLE;
        bytes.set(chunk.value, length);
        length += chunk.value.byteLength;
      }
      return parseExplorerEarlyTestNoticeResult(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)))) ?? UNAVAILABLE;
    } catch { return UNAVAILABLE; }
  }
  try { return await Promise.race([read(), stopped]); }
  finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    controller.abort();
    if (reader) void reader.cancel().catch(() => undefined);
  }
}
