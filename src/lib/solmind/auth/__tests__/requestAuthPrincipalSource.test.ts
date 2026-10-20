import { describe, expect, it } from "vitest";

import {
  createFailClosedRequestAuthPrincipalSource,
  createInMemoryRequestAuthPrincipalSource,
} from "../requestAuthPrincipalSource";
import {
  createInMemoryAuthSource,
  type InMemoryAuthSourceFixture,
} from "../authSource";
import {
  deriveTrustedServerAuthContext,
  type DeriveTrustedServerAuthContextInput,
  type SupabaseAuthenticatedUser,
} from "../serverAuthContext";

// The canonical provider name for Supabase auth, matching principalMapping and
// the existing serverAuthContext/authSource fixtures.
const PROVIDER_NAME = "supabase";
const GUIDE_USER_ID = "user-guide-1";
const GUIDE_PROFILE_A = "guide-profile-a";

// Login step 6, sub-slice S6-4: the selected session's UUID, which the request
// presents in its binding cookie, and its expiry.
const SESSION_ID = "5e5510a0-0000-4000-8000-000000001101";
const SESSION_EXPIRES_AT = "2999-12-31T23:59:59+00:00";

function guidePrincipal(
  presentedSessionId: string | null = SESSION_ID,
): SupabaseAuthenticatedUser {
  return {
    providerName: PROVIDER_NAME,
    providerUserId: "auth-user-guide-1",
    presentedSessionId,
  };
}

// A fully-valid trusted-context input for the guide principal, in the style of
// authSource.test.ts / serverAuthContext.test.ts. The active role is carried by
// the server-loaded session record, not by any request value.
function validGuideInput(): DeriveTrustedServerAuthContextInput {
  const { providerUserId } = guidePrincipal();
  return {
    authenticatedUser: {
      providerName: PROVIDER_NAME,
      providerUserId,
      presentedSessionId: SESSION_ID,
    },
    authProviderIdentity: {
      userAccountId: GUIDE_USER_ID,
      providerName: PROVIDER_NAME,
      providerUserId,
      status: "active",
    },
    userAccount: { userAccountId: GUIDE_USER_ID, accountStatus: "active" },
    session: {
      userSessionId: SESSION_ID,
      userAccountId: GUIDE_USER_ID,
      activeRoleContext: "guide",
      sessionStatus: "active",
      expiresAt: SESSION_EXPIRES_AT,
    },
    activeRoleAssignment: {
      userAccountId: GUIDE_USER_ID,
      roleCode: "guide",
      roleStatus: "active",
    },
    guideProfile: {
      guideProfileId: GUIDE_PROFILE_A,
      userAccountId: GUIDE_USER_ID,
      status: "active",
    },
    explorerProfile: null,
  };
}

function guideFixture(): InMemoryAuthSourceFixture {
  return {
    accounts: [
      {
        principal: guidePrincipal(),
        serverAuthContextInput: validGuideInput(),
      },
    ],
  };
}

describe("createInMemoryRequestAuthPrincipalSource - port contract", () => {
  it("resolves the configured principal", async () => {
    const source = createInMemoryRequestAuthPrincipalSource(guidePrincipal());

    await expect(source.resolveAuthenticatedUser()).resolves.toEqual(
      guidePrincipal(),
    );
  });

  it("resolves null when configured with null (deny)", async () => {
    const source = createInMemoryRequestAuthPrincipalSource(null);

    await expect(source.resolveAuthenticatedUser()).resolves.toBeNull();
  });

  it("is deterministic and side-effect-free across repeated calls", async () => {
    const source = createInMemoryRequestAuthPrincipalSource(guidePrincipal());

    const first = await source.resolveAuthenticatedUser();
    const second = await source.resolveAuthenticatedUser();

    expect(first).toEqual(second);
    expect(first).toEqual(guidePrincipal());
  });
});

describe("request-auth principal composes with the existing auth chain", () => {
  it("a resolved principal feeds loadServerAuthContextInput and derives an allow", async () => {
    const principalSource = createInMemoryRequestAuthPrincipalSource(
      guidePrincipal(),
    );
    const authSource = createInMemoryAuthSource(guideFixture());

    // The composition root resolves identity first, then loads records keyed by
    // that principal, then derives. The principal is only a lookup key.
    const principal = await principalSource.resolveAuthenticatedUser();
    expect(principal).not.toBeNull();
    if (principal === null) {
      return;
    }

    const input = await authSource.loadServerAuthContextInput({
      authenticatedUser: principal,
    });
    const derived = deriveTrustedServerAuthContext(input);

    expect(derived.allowed).toBe(true);
    if (derived.allowed) {
      expect(derived.context.activeRole).toBe("guide");
      expect(derived.context.identity.userAccountId).toBe(GUIDE_USER_ID);
    }
  });

  it("PRQ-601 the session UUID a principal source presents is what the chain compares: none, or another session's, derives a denial", async () => {
    const authSource = createInMemoryAuthSource(guideFixture());

    for (const presented of [null, "5e5510a0-0000-4000-8000-000000001102"]) {
      const principal = await createInMemoryRequestAuthPrincipalSource(
        guidePrincipal(presented),
      ).resolveAuthenticatedUser();
      expect(principal).toEqual(guidePrincipal(presented));
      if (principal === null) {
        return;
      }

      const input = await authSource.loadServerAuthContextInput({
        authenticatedUser: principal,
      });
      expect(deriveTrustedServerAuthContext(input).allowed).toBe(false);
    }
  });

  it("a null principal is the deny signal and yields a denied derivation", async () => {
    const principalSource = createInMemoryRequestAuthPrincipalSource(null);

    const principal = await principalSource.resolveAuthenticatedUser();
    expect(principal).toBeNull();

    // null means deny: the existing chain denies by default on a null
    // authenticated user, without consulting any record store.
    const derived = deriveTrustedServerAuthContext({
      authenticatedUser: principal,
      authProviderIdentity: null,
      userAccount: null,
      session: null,
      activeRoleAssignment: null,
      guideProfile: null,
      explorerProfile: null,
    });

    expect(derived.allowed).toBe(false);
  });
});

describe("createFailClosedRequestAuthPrincipalSource - fail-closed posture", () => {
  it("passes through a synchronously resolved principal", async () => {
    const source = createFailClosedRequestAuthPrincipalSource(() =>
      guidePrincipal(),
    );

    await expect(source.resolveAuthenticatedUser()).resolves.toEqual(
      guidePrincipal(),
    );
  });

  it("passes through an asynchronously resolved principal", async () => {
    const source = createFailClosedRequestAuthPrincipalSource(async () =>
      guidePrincipal(),
    );

    await expect(source.resolveAuthenticatedUser()).resolves.toEqual(
      guidePrincipal(),
    );
  });

  it("treats a null result as a deny", async () => {
    const source = createFailClosedRequestAuthPrincipalSource(() => null);

    await expect(source.resolveAuthenticatedUser()).resolves.toBeNull();
  });

  it("converts a thrown error to a null deny and does not rethrow", async () => {
    const source = createFailClosedRequestAuthPrincipalSource(() => {
      throw new Error("token-bearing failure that must not leak");
    });

    await expect(source.resolveAuthenticatedUser()).resolves.toBeNull();
  });

  it("converts a rejected promise to a null deny and does not reject", async () => {
    const source = createFailClosedRequestAuthPrincipalSource(() =>
      Promise.reject(new Error("verification failed")),
    );

    await expect(source.resolveAuthenticatedUser()).resolves.toBeNull();
  });
});
