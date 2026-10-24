import "server-only";
import { composeRequestAuthContext } from "../auth/composeRequestAuthContext";
import { noopCookieSetAll, type RequestCookie } from "../auth/requestCookieAccessor";
import { createSupabaseRequestAuthPrincipalSource } from "./requestAuthClient";
import { createServiceRoleClient } from "./serviceRoleClient";
import { createServiceRoleRpcExecutor } from "./serviceRoleRpcExecutor";
import { createSupabaseAuthQueryClient } from "./supabaseAuthQueryClient";
import { createSupabaseAuthSource } from "./serverAuthSourceAdapter";
import { createExplorerConversationRepository } from "./explorerConversationRepository";
import type { ExplorerConversationDependencies } from "../virtual-guide/explorerConversationComposition";

// Preserve duplicate wire names and exact values. Framework cookie maps cannot
// establish the raw-cookie ambiguity check owned by the banked login boundary.
export function readExplorerConversationCookies(raw: string | null): readonly RequestCookie[] | null {
  if (raw === null || raw === "") return [];
  if (raw.length > 16_384) return null;
  const parts = raw.split(";");
  if (parts.length > 128) return null;
  const result: RequestCookie[] = [];
  for (const segment of parts) {
    const pair = segment.replace(/^[\t ]+/, "");
    const equals = pair.indexOf("=");
    if (equals < 1) return null;
    const name = pair.slice(0, equals), value = pair.slice(equals + 1);
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name) ||
        !/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/.test(value)) return null;
    result.push({ name, value });
  }
  return result;
}

export function createExplorerConversationRequestDependencies(rawCookieHeader: string | null): ExplorerConversationDependencies {
  const snapshot = readExplorerConversationCookies(rawCookieHeader);
  if (snapshot === null) throw new Error("explorer_conversation_request_unavailable");
  const cookies = { getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll };
  const principalSource = createSupabaseRequestAuthPrincipalSource({ cookies });
  const client = createServiceRoleClient();
  const authSource = createSupabaseAuthSource(createSupabaseAuthQueryClient({
    client: createServiceRoleRpcExecutor(client), now: () => new Date(),
  }));
  return Object.freeze({
    authenticate: async () => {
      const access = await composeRequestAuthContext({ principalSource, authSource }, {
        selectors: { requestedRoute: "/explorer/home" },
      });
      if (!access.allowed) return null;
      const expiresAt = Date.parse(access.context.session.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
      return Object.freeze({ accountId: access.context.identity.userAccountId,
        applicationSessionId: access.context.session.userSessionId });
    },
    repository: createExplorerConversationRepository(client),
    // No credential lookup, provider, synthetic fallback or context-policy
    // configuration here. Runtime activation is a separately approved effect.
  });
}
