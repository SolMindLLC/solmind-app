import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @supabase/ssr so no real Supabase project, network, cookies, or headers are
// touched. vi.hoisted gives the (hoisted) vi.mock factory access to the shared
// getUser/createServerClient stubs.
const { getUser, createServerClientMock } = vi.hoisted(() => {
  const getUser = vi.fn();
  // Typed parameter signature so createServerClientMock.mock.calls[0] is captured
  // as a [url, key, options] tuple rather than an empty tuple.
  const createServerClientMock = vi.fn(
    (
      _url: string,
      _key: string,
      _options: {
        cookies: {
          getAll: () => Array<{ name: string; value: string }>;
          setAll: (
            cookiesToSet: Array<{
              name: string;
              value: string;
              options?: Record<string, unknown>;
            }>,
          ) => void;
        };
      },
    ) => ({ auth: { getUser } }),
  );
  return { getUser, createServerClientMock };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { createInMemoryRequestCookieAccessor } from "../../auth/requestCookieAccessor";
import {
  REQUEST_AUTH_ANON_KEY_ENV,
  REQUEST_AUTH_URL_ENV,
  createSupabaseRequestAuthPrincipalSource,
} from "../requestAuthClient";
import * as supabaseBarrel from "../index";

const AUTH_USER_ID = "11111111-1111-1111-1111-111111111111";

function accessor() {
  return createInMemoryRequestCookieAccessor([
    { name: "sb-access-token", value: "cookie-value" },
  ]);
}

function source() {
  return createSupabaseRequestAuthPrincipalSource({ cookies: accessor() });
}

beforeEach(() => {
  process.env[REQUEST_AUTH_URL_ENV] = "https://example.supabase.co";
  process.env[REQUEST_AUTH_ANON_KEY_ENV] = "anon-key";
  // The request-auth path must never depend on the service-role secret.
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  getUser.mockReset();
  createServerClientMock.mockClear();
});

afterEach(() => {
  delete process.env[REQUEST_AUTH_URL_ENV];
  delete process.env[REQUEST_AUTH_ANON_KEY_ENV];
});

describe("createSupabaseRequestAuthPrincipalSource - identity resolution", () => {
  it("maps a verified Supabase user to SupabaseAuthenticatedUser", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: AUTH_USER_ID, email: "person@example.com" } },
      error: null,
    });

    await expect(source().resolveAuthenticatedUser()).resolves.toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
    });
  });

  it("returns null when getUser returns an error", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid or expired session" },
    });

    await expect(source().resolveAuthenticatedUser()).resolves.toBeNull();
  });

  it("returns null when there is no verified user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(source().resolveAuthenticatedUser()).resolves.toBeNull();
  });

  it("returns null for a blank user id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "   " } }, error: null });

    await expect(source().resolveAuthenticatedUser()).resolves.toBeNull();
  });

  it("fails closed (null) and does not rethrow when getUser rejects", async () => {
    getUser.mockRejectedValue(
      new Error("token-bearing failure that must not leak"),
    );

    await expect(source().resolveAuthenticatedUser()).resolves.toBeNull();
  });
});

describe("createSupabaseRequestAuthPrincipalSource - configuration", () => {
  it("throws a value-free config error at construction when the public URL is missing", () => {
    delete process.env[REQUEST_AUTH_URL_ENV];

    try {
      createSupabaseRequestAuthPrincipalSource({ cookies: accessor() });
      throw new Error("expected a configuration error to be thrown");
    } catch (caught) {
      const message = (caught as Error).message;
      expect(message).toContain(REQUEST_AUTH_URL_ENV);
      // The error must name the variable but never echo its (here, the anon-key) value.
      expect(message).not.toContain("anon-key");
    }
    // Construction failed before building any Supabase client.
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("throws a value-free config error at construction when the anon key is missing", () => {
    delete process.env[REQUEST_AUTH_ANON_KEY_ENV];

    try {
      createSupabaseRequestAuthPrincipalSource({ cookies: accessor() });
      throw new Error("expected a configuration error to be thrown");
    } catch (caught) {
      const message = (caught as Error).message;
      expect(message).toContain(REQUEST_AUTH_ANON_KEY_ENV);
      expect(message).not.toContain("https://example.supabase.co");
    }
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("does not require the service-role key to resolve a principal", async () => {
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    getUser.mockResolvedValue({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    });

    await expect(source().resolveAuthenticatedUser()).resolves.not.toBeNull();
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});

describe("createSupabaseRequestAuthPrincipalSource - @supabase/ssr wiring", () => {
  it("passes the public URL/key and getAll + setAll cookie functions to createServerClient", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    });

    await source().resolveAuthenticatedUser();

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createServerClientMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("anon-key");
    expect(typeof options.cookies.getAll).toBe("function");
    expect(typeof options.cookies.setAll).toBe("function");
  });

  it("wires getAll to the injected accessor", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    });

    await source().resolveAuthenticatedUser();

    const [, , options] = createServerClientMock.mock.calls[0];
    expect(options.cookies.getAll()).toEqual([
      { name: "sb-access-token", value: "cookie-value" },
    ]);
  });

  it("wires setAll to the injected accessor as a no-op that does not throw", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    });

    await source().resolveAuthenticatedUser();

    const [, , options] = createServerClientMock.mock.calls[0];
    // MVP0 writes are a no-op: passing rotation cookies persists nothing and the
    // call returns undefined without throwing.
    expect(
      options.cookies.setAll([
        { name: "sb-access-token", value: "rotated", options: { path: "/" } },
      ]),
    ).toBeUndefined();
  });
});

describe("requestAuthClient barrel exposure", () => {
  it("is not exported from the shared supabase index barrel", () => {
    // The server-only adapter must stay off the shared barrel (AUTH-RLS-DEC-013),
    // mirroring serviceRoleClient. Tests import it by direct path only.
    expect(
      "createSupabaseRequestAuthPrincipalSource" in supabaseBarrel,
    ).toBe(false);
  });
});
