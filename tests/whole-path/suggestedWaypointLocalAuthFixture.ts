import { randomBytes } from "node:crypto";

import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";

import {
  readSuggestedWaypointWholePathSafetyConfig,
  type SuggestedWaypointWholePathRole,
  type SuggestedWaypointWholePathSafetyConfig,
} from "./suggestedWaypointWholePathSafety";
import {
  buildSuggestedWaypointLocalFixtureSql,
  type SuggestedWaypointFixtureActorBinding,
  type SuggestedWaypointFixtureScenarioIds,
} from "./suggestedWaypointLocalSqlFixture";

type WholePathEnvironment = Readonly<Record<string, string | undefined>>;

export type SuggestedWaypointLocalSecrets = Readonly<{
  anonKey: string;
  serviceRoleKey: string;
}>;

export type SuggestedWaypointCookieRecord = Readonly<{
  name: string;
  value: string;
  options: Readonly<CookieOptions>;
}>;

export type SuggestedWaypointRoleSession = Readonly<{
  cookies(): readonly SuggestedWaypointCookieRecord[];
  clear(): Promise<void>;
}>;

export type SuggestedWaypointFixtureActor = Readonly<{
  role: SuggestedWaypointWholePathRole;
  session: SuggestedWaypointRoleSession;
}>;

export type SuggestedWaypointLocalFixture = Readonly<{
  actors: readonly SuggestedWaypointFixtureActor[];
  scenarioIds: SuggestedWaypointFixtureScenarioIds;
}>;

type CreatedAuthUser = Readonly<{
  id: string;
  email: string;
  password: string;
}>;

export type SuggestedWaypointLocalFixtureDependencies = Readonly<{
  resetLocalDatabase(): Promise<void>;
  assertNoAuthEmailCollisions(emails: readonly string[]): Promise<void>;
  createAuthUser(email: string, password: string): Promise<Readonly<{ id: string }>>;
  deleteAuthUser(id: string): Promise<void>;
  executeFixtureSql(sql: string): Promise<void>;
  createRoleSession(
    email: string,
    password: string,
    expectedAuthUserId: string,
  ): Promise<SuggestedWaypointRoleSession>;
}>;

export type SuggestedWaypointLocalFixtureRunOptions<T> = Readonly<{
  environment: WholePathEnvironment;
  loadSecrets(): Promise<SuggestedWaypointLocalSecrets>;
  createDependencies(
    config: SuggestedWaypointWholePathSafetyConfig,
    secrets: SuggestedWaypointLocalSecrets,
  ): SuggestedWaypointLocalFixtureDependencies;
  runScenario(fixture: SuggestedWaypointLocalFixture): Promise<T>;
  generatePassword?: (role: SuggestedWaypointWholePathRole) => string;
}>;

const AUTH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function assertSecret(value: string, code: string): string {
  if (
    typeof value !== "string" ||
    value.length < 16 ||
    value !== value.trim() ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    throw new Error(code);
  }
  return value;
}

const PASSWORD_POLICY_SUFFIX = "aA1!";

function defaultPassword(role: SuggestedWaypointWholePathRole): string {
  return `${role}.${randomBytes(32).toString("base64url")}${PASSWORD_POLICY_SUFFIX}`;
}

class InMemoryCookieStore {
  readonly #cookies = new Map<string, SuggestedWaypointCookieRecord>();

  getAll(): { name: string; value: string }[] {
    return [...this.#cookies.values()].map(({ name, value }) => ({ name, value }));
  }

  setAll(
    cookies: { name: string; value: string; options: CookieOptions }[],
  ): void {
    for (const cookie of cookies) {
      if (
        typeof cookie.name !== "string" ||
        cookie.name.length === 0 ||
        typeof cookie.value !== "string"
      ) {
        throw new Error("whole_path_fixture_invalid_cookie_record");
      }
      if (cookie.value.length === 0 || cookie.options.maxAge === 0) {
        this.#cookies.delete(cookie.name);
        continue;
      }
      this.#cookies.set(
        cookie.name,
        Object.freeze({
          name: cookie.name,
          value: cookie.value,
          options: Object.freeze({ ...cookie.options }),
        }),
      );
    }
  }

  snapshot(): readonly SuggestedWaypointCookieRecord[] {
    return Object.freeze(
      [...this.#cookies.values()].map((cookie) =>
        Object.freeze({
          name: cookie.name,
          value: cookie.value,
          options: Object.freeze({ ...cookie.options }),
        }),
      ),
    );
  }

  clear(): void {
    this.#cookies.clear();
  }
}

export function createSupabaseLocalFixtureDependencies(
  config: SuggestedWaypointWholePathSafetyConfig,
  secrets: SuggestedWaypointLocalSecrets,
  localEffects: Readonly<{
    resetLocalDatabase(): Promise<void>;
    executeFixtureSql(sql: string): Promise<void>;
  }>,
): SuggestedWaypointLocalFixtureDependencies {
  const anonKey = assertSecret(secrets.anonKey, "whole_path_fixture_invalid_anon_key");
  const serviceRoleKey = assertSecret(
    secrets.serviceRoleKey,
    "whole_path_fixture_invalid_service_role_key",
  );
  const admin = createClient(config.localSupabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return Object.freeze({
    resetLocalDatabase: localEffects.resetLocalDatabase,
    executeFixtureSql: localEffects.executeFixtureSql,
    async assertNoAuthEmailCollisions(emails) {
      const expected = new Set(emails);
      let page = 1;
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
        if (error) {
          throw new Error("whole_path_fixture_auth_collision_check_failed");
        }
        if (data.users.some((user) => user.email && expected.has(user.email))) {
          throw new Error("whole_path_fixture_auth_email_collision");
        }
        if (data.users.length < 100) {
          return;
        }
        page += 1;
      }
    },
    async createAuthUser(email, password) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { synthetic: true },
      });
      if (error || !data.user || !AUTH_UUID.test(data.user.id)) {
        throw new Error("whole_path_fixture_auth_create_failed");
      }
      return Object.freeze({ id: data.user.id });
    },
    async deleteAuthUser(id) {
      if (!AUTH_UUID.test(id)) {
        throw new Error("whole_path_fixture_invalid_cleanup_auth_user_id");
      }
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) {
        throw new Error("whole_path_fixture_auth_delete_failed");
      }
    },
    async createRoleSession(email, password, expectedAuthUserId) {
      const store = new InMemoryCookieStore();
      const client = createBrowserClient(config.localSupabaseUrl, anonKey, {
        isSingleton: false,
        cookies: {
          getAll: () => store.getAll(),
          setAll: (cookies) => store.setAll(cookies),
        },
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: true,
        },
      });
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (
        error ||
        !data.user ||
        data.user.id !== expectedAuthUserId ||
        store.snapshot().length === 0
      ) {
        store.clear();
        throw new Error("whole_path_fixture_auth_sign_in_failed");
      }
      return Object.freeze({
        cookies: () => store.snapshot(),
        async clear() {
          try {
            await client.auth.signOut({ scope: "local" });
          } finally {
            store.clear();
          }
        },
      });
    },
  });
}

export async function runWithSuggestedWaypointLocalAuthFixture<T>(
  options: SuggestedWaypointLocalFixtureRunOptions<T>,
): Promise<Readonly<{ status: "refused" } | { status: "completed"; result: T }>> {
  const config = readSuggestedWaypointWholePathSafetyConfig(options.environment);
  if (config === null) {
    return Object.freeze({ status: "refused" });
  }

  let dependencies: SuggestedWaypointLocalFixtureDependencies;
  try {
    const secrets = await options.loadSecrets();
    assertSecret(secrets.anonKey, "whole_path_fixture_invalid_anon_key");
    assertSecret(secrets.serviceRoleKey, "whole_path_fixture_invalid_service_role_key");
    dependencies = options.createDependencies(config, secrets);
  } catch {
    throw new Error("whole_path_fixture_initialization_failed");
  }
  const generatePassword = options.generatePassword ?? defaultPassword;
  const created: CreatedAuthUser[] = [];
  const sessions: SuggestedWaypointRoleSession[] = [];
  let result: T | undefined;
  let primaryFailure = false;
  let cleanupFailure = false;

  try {
    await dependencies.resetLocalDatabase();
    const emails = config.roles.map((role) => config.syntheticEmailFor(role));
    await dependencies.assertNoAuthEmailCollisions(emails);

    for (const role of config.roles) {
      const email = config.syntheticEmailFor(role);
      const password = generatePassword(role);
      if (password.length < 32 || /[\r\n]/u.test(password)) {
        throw new Error("whole_path_fixture_invalid_generated_password");
      }
      const user = await dependencies.createAuthUser(email, password);
      if (!AUTH_UUID.test(user.id) || created.some((actor) => actor.id === user.id)) {
        throw new Error("whole_path_fixture_invalid_created_auth_user");
      }
      created.push(Object.freeze({ id: user.id, email, password }));
    }

    const bindings: SuggestedWaypointFixtureActorBinding[] = config.roles.map(
      (role, index) =>
        Object.freeze({
          role,
          authUserId: created[index]!.id,
          email: created[index]!.email,
        }),
    );
    const fixtureSql = buildSuggestedWaypointLocalFixtureSql(bindings);
    await dependencies.executeFixtureSql(fixtureSql.sql);

    const actors: SuggestedWaypointFixtureActor[] = [];
    for (let index = 0; index < config.roles.length; index += 1) {
      const role = config.roles[index]!;
      const actor = created[index]!;
      const session = await dependencies.createRoleSession(
        actor.email,
        actor.password,
        actor.id,
      );
      if (sessions.includes(session)) {
        throw new Error("whole_path_fixture_invalid_role_session");
      }
      sessions.push(session);
      actors.push(Object.freeze({ role, session }));
    }

    result = await options.runScenario(
      Object.freeze({
        actors: Object.freeze(actors),
        scenarioIds: fixtureSql.scenarioIds,
      }),
    );
  } catch {
    primaryFailure = true;
  } finally {
    for (const session of [...sessions].reverse()) {
      try {
        await session.clear();
      } catch {
        cleanupFailure = true;
      }
    }
    for (const actor of [...created].reverse()) {
      try {
        await dependencies.deleteAuthUser(actor.id);
      } catch {
        cleanupFailure = true;
      }
    }
    try {
      await dependencies.resetLocalDatabase();
    } catch {
      cleanupFailure = true;
    }
    sessions.length = 0;
    created.length = 0;
  }

  if (cleanupFailure) {
    throw new Error("whole_path_fixture_cleanup_failed");
  }
  if (primaryFailure) {
    throw new Error("whole_path_fixture_run_failed");
  }
  return Object.freeze({ status: "completed", result: result as T });
}
