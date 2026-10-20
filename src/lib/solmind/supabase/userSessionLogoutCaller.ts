import "server-only";

// The banked 20261004000000_user_session_logout_function.sql owns locking,
// expiry, account/session matching and the atomic audit. A late/lost answer
// may hide a committed logout; the response deadline is not a rollback claim.
export const USER_SESSION_LOGOUT_FUNCTION = "solmind_logout_user_session" as const;
export type UserSessionLogoutOutcome = "ended" | "already_ended" | "failed" | "invalid_request";
export type UserSessionLogoutRpcClient = Readonly<{
  rpc(name: string, args: Readonly<Record<string, string>>): Readonly<{
    abortSignal(signal: AbortSignal): PromiseLike<unknown>;
  }>;
}>;
export type UserSessionLogoutRequest = Readonly<{
  userAccountId: string;
  presentedSessionId: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function isLogoutUuid(value: unknown): value is string {
  return typeof value === "string" && value.length === 36 && UUID.test(value);
}

function fields(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    if (Reflect.ownKeys(value).length !== keys.length) return null;
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const field = Object.getOwnPropertyDescriptor(value, key);
      if (!field || !field.enumerable || !("value" in field)) return null;
      result[key] = field.value;
    }
    return result;
  } catch {
    return null;
  }
}

const RESULTS = Object.freeze({
  ended: Object.freeze({ outcome: "ended" as const }),
  already_ended: Object.freeze({ outcome: "already_ended" as const }),
  failed: Object.freeze({ outcome: "failed" as const }),
  invalid_request: Object.freeze({ outcome: "invalid_request" as const }),
});

export function createUserSessionLogoutCaller(input: Readonly<{
  rpcClient: UserSessionLogoutRpcClient;
  rpcTimeoutMilliseconds?: number;
}>) {
  let client: UserSessionLogoutRpcClient;
  let timeout: number;
  try {
    client = input.rpcClient;
    timeout = input.rpcTimeoutMilliseconds ?? 6_000;
    if (!client || typeof client.rpc !== "function" || !Number.isSafeInteger(timeout) || timeout < 10 || timeout > 6_000) {
      throw new Error();
    }
  } catch {
    throw new Error("user_session_logout_invalid_configuration");
  }

  return Object.freeze({
    async end(request: UserSessionLogoutRequest): Promise<Readonly<{ outcome: UserSessionLogoutOutcome }>> {
      const args = fields(request, ["userAccountId", "presentedSessionId"]);
      if (!args || !isLogoutUuid(args.userAccountId) || !isLogoutUuid(args.presentedSessionId)) {
        return RESULTS.invalid_request;
      }
      const controller = new AbortController();
      const deadline = performance.now() + timeout;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const elapsed = new Promise<null>((resolve) => {
        timer = setTimeout(() => { controller.abort(); resolve(null); }, timeout);
      });
      // Exactly one dispatch, no replay or retry. Both settlement branches
      // consume late errors without retaining or printing provider details.
      const attempt = Promise.resolve().then(() => {
        if (performance.now() >= deadline) return null;
        return client.rpc(USER_SESSION_LOGOUT_FUNCTION, Object.freeze({
          p_user_account_id: args.userAccountId as string,
          p_user_session_id: args.presentedSessionId as string,
        })).abortSignal(controller.signal);
      }).then((answer): UserSessionLogoutOutcome => {
        if (performance.now() >= deadline) return "failed";
        try {
          if (!answer || typeof answer !== "object") return "failed";
          const { data, error } = answer as { data: unknown; error: unknown };
          if (error !== null || !Array.isArray(data) || data.length !== 1) return "failed";
          const row = fields(data[0], ["outcome"]);
          return row?.outcome === "ended" || row?.outcome === "already_ended" ? row.outcome : "failed";
        } catch {
          return "failed";
        }
      }, (): UserSessionLogoutOutcome => "failed");
      try {
        const result = await Promise.race([attempt, elapsed]);
        return performance.now() < deadline && result !== null ? RESULTS[result] : RESULTS.failed;
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
