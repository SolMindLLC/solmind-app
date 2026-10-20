// Real dependency factory + bridge + provider cleanup; only HTTP is synthetic.
// Tests hold/release after simulated session acceptance, not a real database login.
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPLORER_SIGN_IN_PORTS, EXPLORER_SIGN_IN_PRIOR_CLEANUP_FAILURE_SIGNAL_LINE } from "../explorerSignInDependencies";

const provider = "http://127.0.0.1:54321";
const application = "http://127.0.0.1:3000";
const userId = "aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa";
const oldSession = "bbbbbbbb-1111-4444-8888-bbbbbbbbbbbb";
const newSession = "cccccccc-1111-4444-8888-cccccccccccc";
const segment = (item: unknown) => Buffer.from(JSON.stringify(item)).toString("base64url");
function token(session: string) {
  return `${segment({ alg: "HS256", typ: "JWT" })}.${segment({ iss: provider + "/auth/v1", aud: "authenticated",
    sub: userId, session_id: session, exp: Math.floor(Date.now() / 1000) + 3600 })}.c3ludGhldGlj`;
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("residual cleanup reporting at the real login composition boundary", () => {
  it.each(["refused", "rejected", "late-rejected", "throwing-reporter", "cleaned", "same-session"])(
    "%s preserves fresh publication, exact old target and bounded value-free reporting", async (mode) => {
      vi.useFakeTimers();
      for (const [name, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: provider, NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public",
        SUPABASE_SERVICE_ROLE_KEY: "synthetic-server", SOLMIND_VERIFICATION_PEPPER: Buffer.alloc(32, 83).toString("base64url") })) vi.stubEnv(name, value);
      vi.stubEnv("NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER", undefined);
      vi.stubEnv("SOLMIND_CREDENTIAL_PAIR_PROOF_KEY_BASE64", undefined);
      const fresh = token(newSession);
      const old = mode === "same-session" ? fresh : token(oldSession);
      const targets: string[] = [];
      let lateReject: ((error: unknown) => void) | undefined;
      const output: unknown[][] = [];
      vi.spyOn(process.stderr, "write").mockImplementation((...args: unknown[]) => {
        output.push(args);
        if (mode === "throwing-reporter") throw new Error("synthetic-private-sink");
        return true;
      });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const send = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        if (url === provider + "/auth/v1/token?grant_type=password") return Response.json({ access_token: fresh,
          refresh_token: "synthetic-fresh-refresh", token_type: "bearer", expires_in: 3600,
          user: { id: userId, aud: "authenticated", role: "authenticated", email: "synthetic@example.test", app_metadata: {}, user_metadata: {} } });
        if (url === provider + "/auth/v1/user") return Response.json({ id: userId });
        if (url === provider + "/auth/v1/logout?scope=local") {
          targets.push(new Headers(init?.headers).get("authorization") ?? "");
          if (mode === "late-rejected") return new Promise((_resolve, reject) => { lateReject = reject; });
          if (mode === "rejected") throw new Error("synthetic-private-provider");
          return new Response(null, { status: mode === "cleaned" ? 204 : 500 });
        }
        throw new Error("unexpected synthetic HTTP request");
      });
      vi.stubGlobal("fetch", send);
      const dependencies = EXPLORER_SIGN_IN_PORTS.createVerifyDependencies(application, {
        accessToken: old, refreshToken: "synthetic-old-refresh", proof: undefined,
      });
      const result = await dependencies.bridge.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });
      expect(result.outcome).toBe("held");
      if (result.outcome !== "held") return;
      await result.hold.assertProviderUser(userId);
      const preparing = result.hold.prepareAcceptedSession({ sessionOutcome: "created" });
      await vi.advanceTimersByTimeAsync(5_001);
      await preparing;
      const release = result.hold.release({ sessionOutcome: "created" });
      expect(release.outcome).toBe("released");
      expect(targets.length).toBe(mode === "same-session" ? 0 : 1);
      expect(targets.every((target) => target === `Bearer ${old}` && target !== `Bearer ${fresh}`)).toBe(true);
      const failed = mode !== "cleaned" && mode !== "same-session";
      expect(output.length).toBe(failed ? 1 : 0);
      expect(output.every((args) => args.length === 1 && args[0] === EXPLORER_SIGN_IN_PRIOR_CLEANUP_FAILURE_SIGNAL_LINE)).toBe(true);
      expect(consoleError).not.toHaveBeenCalled();
      lateReject?.(new Error("synthetic-private-late"));
      await vi.advanceTimersByTimeAsync(1);
      expect(output.length).toBe(failed ? 1 : 0);
      expect(result.hold.release({ sessionOutcome: "created" }).outcome).toBe("refused");
    },
  );
});
