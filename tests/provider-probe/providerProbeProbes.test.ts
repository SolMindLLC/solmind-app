import fs from "node:fs";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createProviderProbeEvidence,
  type ProviderProbeEvidence,
} from "../../src/lib/solmind/supabase/__tests__/providerProbeEvidence";
import {
  classifyAuthError,
  PROVIDER_PROBE_AUTH_LIMITS,
  PROVIDER_PROBE_REFUSALS,
  providerProbeIsConfirmedRefusal,
  type ProviderProbePublicClient,
  type ProviderProbeRefusalSurface,
} from "./providerProbeAuthProbeCore";
import { PROVIDER_PROBE_CLEANUP_LIMITS } from "./providerProbeCleanupLedger";
import { readTomlSetting } from "./providerProbeEnvironment";
import { PROVIDER_PROBE_APP_ROOT, providerProbeAppRoot } from "./providerProbeLocalRoot";
import { PROVIDER_PROBE_TRANSPORT_LIMITS } from "./providerProbeLoopbackFetch";
import { extractMailCredentials, MAILPIT_MAX_INVENTORY_PASSES, MAILPIT_MAX_PAGES } from "./providerProbeMailpitClient";
import { writeProviderProbeOutputFile } from "./providerProbeOutputFile";
import {
  computeUsableSessionSeconds,
  finalizeProviderProbeRecord,
  PROVIDER_PROBE_FINISH_TIMEOUT_MILLISECONDS,
  PROVIDER_PROBE_MIRRORED_LIMITS,
  PROVIDER_PROBE_STEPS,
  PROVIDER_PROBE_SUITE_LIMITS,
  providerProbeStepRequestBound,
  providerProbeStepTimeoutMilliseconds,
  providerProbeStepWaitBudgetMilliseconds,
  type ProviderProbeStepSummary,
} from "./providerProbeProbeCore";
import { PROVIDER_PROBE_EVIDENCE_BOUNDS, PROVIDER_PROBE_OUTPUT_LIMITS } from "./providerProbeRunEnvelope";
import {
  observeProviderProbeStackFromContainers,
  parseProviderProbeContainerIds,
  parseProviderProbeContainerInspection,
  PROVIDER_PROBE_STACK_OBSERVER_LIMITS,
} from "./providerProbeStackObserver";
import {
  createLoopbackFetchForTests,
  createRunForTests,
  createSuiteCoreForTests,
  gatedTestEnvironment,
} from "./providerProbeTestSupport";

// The probe bodies, end to end, against an in-process fake of the local Auth API and
// the mail catcher. The fake is an http.Server started here on a random 127.0.0.1 port
// and closed after each test; nothing else is contacted. It answers in the shapes the
// pinned auth-js 2.108.2 parses (flat generate_link bodies, `error_code` errors,
// `x-total-count` on user lists, sessions with access_token, refresh_token, expires_in
// and expires_at), and every key, password and token in it is plainly fake.
//
// The running stack is observed through the real observer's parser over FIXTURE docker
// outputs (labels for this checkout's folder); no docker command runs here.
//
// (R6b) The app root every module sees can be given one extra folder that looks like a
// value the scanner refuses, followed by "..", so it still names this checkout (reads
// and comparisons resolve it). By default it is the real root.

const rootSegment = vi.hoisted(() => ({ value: null as string | null }));

vi.mock("./providerProbeLocalRoot", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown> & { providerProbeAppRoot: () => string };
  return {
    ...actual,
    providerProbeAppRoot: () => {
      const root = actual.providerProbeAppRoot();
      const separator = root.includes("\\") ? "\\" : "/";
      return rootSegment.value === null ? root : `${root}${separator}${rootSegment.value}${separator}..`;
    },
  };
});

const ANON_KEY = "fake-anon-key-for-probe-tests-only";
const SERVICE_KEY = "fake-service-role-key-for-probe-tests-only";
const START = Date.UTC(2026, 9, 1, 12, 0, 0);
const WORKDIR = path.resolve(PROVIDER_PROBE_APP_ROOT);
// Never created: the writer's file-system calls are spies wherever this is used.
const OUTPUT_DIRECTORY = path.resolve(WORKDIR, "..", "provider-probe-output-not-created");

type Behaviour = {
  seedUsers: number;
  seedMessages: number;
  signupOpen: boolean;
  signupTransportFailure: boolean;
  signupRefusedWithoutCode: boolean;
  signupAcceptedWithoutId: boolean;
  // R8: the closed sign-up refuses by policy (status and code) yet creates the user.
  signupRefusedButCreates: boolean;
  signupRefusedButMailsFixture: boolean;
  // R7: the status and code of the closed sign-up's refusal.
  signupRefusalStatus: number;
  signupRefusalCode: string;
  failListingAfterSignup: boolean;
  otpCreateOpen: boolean;
  otpCreateRefusedButMails: boolean;
  otpMissingSendsMail: boolean;
  // R7: the status of the email-code surfaces' otp_disabled refusal.
  otpRefusalStatus: number;
  // R7: "validation" is GoTrue's own disabled-provider answer (400, validation_failed and
  // its message); "other-validation" is a 400 validation_failed about something else.
  authorizeAnswer: "validation" | "other-validation" | "not-found";
  providerEnabled: boolean;
  existingAccountOtp: boolean;
  delayLinkMailMilliseconds: number | null;
  generateLinkSendsMail: boolean;
  generateLinkCreatesMissing: boolean;
  generateLinkMissingHangs: boolean;
  failListingAfterGenerateLink: boolean;
  // R7: a missing-user link refused with user_not_found although the user was created.
  generateLinkRefusesButCreates: boolean;
  // R7: a missing-user link answered without an id, after creating two users at the address.
  generateLinkCreatesTwoWithoutId: boolean;
  // R9: a missing-user link that creates the user and answers without an id, with a token
  // hash the run's registry cannot hold.
  generateLinkOversizedWithoutId: boolean;
  // R7: the first admin creation creates the user, then its answer is lost.
  loseFirstAdminCreateAnswer: boolean;
  // R10: the ordinal of the admin creation whose answer is lost (0: none), and how many
  // users that creation makes at its address.
  loseAdminCreateAnswerAt: number;
  lostCreateUsers: number;
  failListingAfterLostCreate: boolean;
  replayAllowed: boolean;
  replayTransportFailure: boolean;
  verifyReturnsOtherUser: boolean;
  duplicateBothSucceed: boolean;
  duplicateSecondFailsOther: boolean;
  // R8: the second create is refused as a duplicate (422 email_exists) yet creates a user.
  duplicateRefusedButCreates: boolean;
  failListingAfterDuplicate: boolean;
  unknownEnumerates: boolean;
  shortRefreshToken: boolean;
  rateLimitAfter: number | null;
  expiresIn: number;
  jwtLifetime: number;
  expiresAtOffset: number;
  failDeletesOfFirstAdminCreatedUser: boolean;
  foreignRunTaggedUserOnOtp: boolean;
  adminUsersGetPhone: boolean;
  passwordGrantReturnsFirstAdminUser: boolean;
  getUserRefuses: boolean;
};

const DEFAULTS: Behaviour = {
  seedUsers: 2,
  seedMessages: 0,
  signupOpen: false,
  signupTransportFailure: false,
  signupRefusedWithoutCode: false,
  signupAcceptedWithoutId: false,
  signupRefusedButCreates: false,
  signupRefusedButMailsFixture: false,
  signupRefusalStatus: 422,
  signupRefusalCode: "signup_disabled",
  failListingAfterSignup: false,
  otpCreateOpen: false,
  otpCreateRefusedButMails: false,
  otpMissingSendsMail: false,
  otpRefusalStatus: 422,
  authorizeAnswer: "validation",
  providerEnabled: false,
  existingAccountOtp: true,
  delayLinkMailMilliseconds: null,
  generateLinkSendsMail: false,
  generateLinkCreatesMissing: true,
  generateLinkMissingHangs: false,
  failListingAfterGenerateLink: false,
  generateLinkRefusesButCreates: false,
  generateLinkCreatesTwoWithoutId: false,
  generateLinkOversizedWithoutId: false,
  loseFirstAdminCreateAnswer: false,
  loseAdminCreateAnswerAt: 0,
  lostCreateUsers: 1,
  failListingAfterLostCreate: false,
  replayAllowed: false,
  replayTransportFailure: false,
  verifyReturnsOtherUser: false,
  duplicateBothSucceed: false,
  duplicateSecondFailsOther: false,
  duplicateRefusedButCreates: false,
  failListingAfterDuplicate: false,
  unknownEnumerates: false,
  shortRefreshToken: false,
  rateLimitAfter: 20,
  expiresIn: 3600,
  jwtLifetime: 3600,
  expiresAtOffset: 0,
  failDeletesOfFirstAdminCreatedUser: false,
  foreignRunTaggedUserOnOtp: false,
  adminUsersGetPhone: false,
  passwordGrantReturnsFirstAdminUser: false,
  getUserRefuses: false,
};

type FakeUser = { id: string; email: string | null; phone: string; is_anonymous: boolean; password: string | null };
type FakeMessage = { id: string; to: string; text: string; visibleAt: number };

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
  while (closers.length > 0) {
    await closers.pop()!();
  }
});

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

// Deterministic, non-repeating test bytes (xorshift32). The sequential source in test
// support repeats every 32 values once masked to five bits, which would let a
// generated wrong credential equal the right one.
function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return (size: number) =>
    Uint8Array.from({ length: size }, () => {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state & 0xff;
    });
}

// The real observer's parser over fixture docker outputs: a running stack labelled with
// this checkout's folder (or another one), publishing the kernel's API port.
function fixtureObservation(workdir: string = WORKDIR) {
  const labels = { "com.docker.compose.project": "solmind-app", "com.supabase.cli.project": "solmind-app", "com.supabase.cli.workdir": workdir };
  const kong = JSON.stringify(["11".repeat(32), "/supabase_kong_solmind-app", labels, { "8000/tcp": [{ HostIp: "0.0.0.0", HostPort: "54321" }] }, true]);
  const auth = JSON.stringify(["22".repeat(32), "/supabase_auth_solmind-app", labels, null, true]);
  const ids = parseProviderProbeContainerIds(`${"11".repeat(32)}\n${"22".repeat(32)}\n`);
  return observeProviderProbeStackFromContainers(parseProviderProbeContainerInspection(`${kong}\n${auth}\n`, ids), "http://127.0.0.1:54321");
}

async function startFakeStack(overrides: Partial<Behaviour>, runTag: string) {
  const behaviour: Behaviour = { ...DEFAULTS, ...overrides };
  let now = START;
  let counter = 0;
  let passwordGrants = 0;
  let existingAccountSends = 0;
  let failUserListings = 0;
  let adminCreates = 0;
  const users = new Map<string, FakeUser>();
  const sessions = new Map<string, { userId: string; signedOut: boolean }>();
  const links = new Map<string, { userId: string; used: boolean }>();
  const codes = new Map<string, { userId: string; used: boolean }>();
  const messages: FakeMessage[] = [];
  const issued: string[] = [];
  const shortCodes: string[] = [];
  const requests: { method: string; path: string }[] = [];
  const deleteAttempts = new Map<string, number>();
  // R7: the bearer of every sign-out request.
  const logouts: string[] = [];
  let firstAdminCreatedId: string | null = null;
  let requestHook: (entry: { method: string; path: string }) => void = () => undefined;

  const nextId = () => {
    counter += 1;
    return `${counter.toString(16).padStart(8, "0")}-0000-4000-8000-${(counter * 7919).toString(16).padStart(12, "0")}`;
  };
  const addUser = (fields: Partial<FakeUser>): FakeUser => {
    const user: FakeUser = { id: nextId(), email: null, phone: "", is_anonymous: false, password: null, ...fields };
    users.set(user.id, user);
    return user;
  };
  for (let index = 0; index < behaviour.seedUsers; index += 1) {
    addUser({ email: `seed-${index}@example.test`, password: "seed-password-not-used" });
  }
  for (let index = 0; index < behaviour.seedMessages; index += 1) {
    messages.push({ id: `seedMsg${String(index).padStart(6, "0")}`, to: "someone-else@example.test", text: "seed", visibleAt: 0 });
  }
  const userJson = (user: FakeUser) => ({
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email ?? "",
    phone: user.phone,
    is_anonymous: user.is_anonymous,
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(START).toISOString(),
  });
  const secret = (prefix: string) => {
    counter += 1;
    const value = `${prefix}${counter.toString(36)}${"x".repeat(12)}${(counter * 104729).toString(36)}`;
    issued.push(value);
    return value;
  };
  const issueSession = (user: FakeUser) => {
    const iat = Math.floor(now / 1000);
    counter += 1;
    const access = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ sub: user.id, iat, exp: iat + behaviour.jwtLifetime, role: "authenticated" })}.fake-signature-${counter}`;
    issued.push(access);
    sessions.set(access, { userId: user.id, signedOut: false });
    return {
      access_token: access,
      token_type: "bearer",
      expires_in: behaviour.expiresIn,
      expires_at: iat + behaviour.expiresIn + behaviour.expiresAtOffset,
      refresh_token: behaviour.shortRefreshToken ? "short1" : secret("fakerefresh"),
      user: userJson(user),
    };
  };
  const sendSignInMail = (address: string, ownerId: string | null, delay = 0) => {
    const tokenHash = secret("fakehash");
    const code = String(100000 + ((counter * 7) % 899999));
    shortCodes.push(code);
    if (ownerId !== null) {
      links.set(tokenHash, { userId: ownerId, used: false });
      codes.set(`${address}:${code}`, { userId: ownerId, used: false });
    }
    const link = `http://127.0.0.1:54321/auth/v1/verify?token=${tokenHash}&type=magiclink&redirect_to=http://127.0.0.1:3000`;
    issued.push(link);
    const id = `fakeMsg${String(messages.length + counter).padStart(6, "0")}`;
    issued.push(id);
    messages.push({
      id,
      to: address,
      text: `Magic Link\n\nFollow this link to log in:\n${link}\n\nAlternatively, enter the code: ${code}\n`,
      visibleAt: now + delay,
    });
  };
  const visibleMessages = () => messages.filter((message) => message.visibleAt <= now);
  const byEmail = (email: string) => [...users.values()].find((user) => user.email === email.toLowerCase()) ?? null;

  function send(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
    const text = body === null ? "" : JSON.stringify(body);
    response.writeHead(status, {
      ...(body === null ? {} : { "content-type": "application/json" }),
      "content-length": String(Buffer.byteLength(text)),
      ...headers,
    });
    response.end(text);
  }
  const error = (response: ServerResponse, status: number, code: string) =>
    send(response, status, { code: status, error_code: code, msg: "fake error" });

  function handleAuth(request: IncomingMessage, response: ServerResponse, url: URL, body: Record<string, unknown>) {
    const apikey = request.headers.apikey;
    const path = url.pathname.slice("/auth/v1".length);
    const bearer = (request.headers.authorization ?? "").replace(/^Bearer /, "");
    if (path === "/authorize") {
      if (behaviour.providerEnabled) {
        response.writeHead(302, { location: "http://127.0.0.1:9/provider", "content-length": "0" });
        response.end();
        return;
      }
      if (behaviour.authorizeAnswer === "not-found") {
        // A gateway answer with no GoTrue code: not a confirmed refusal.
        send(response, 404, { message: "no Route matched with those values" });
        return;
      }
      // GoTrue's own disabled-provider refusal, or (R7) an unrelated validation failure.
      send(response, 400, {
        code: 400,
        error_code: "validation_failed",
        msg: behaviour.authorizeAnswer === "validation" ? "Unsupported provider: provider is not enabled" : "fake error: redirect address is not allowed",
      });
      return;
    }
    if (apikey !== ANON_KEY && apikey !== SERVICE_KEY) {
      error(response, 401, "no_authorization");
      return;
    }
    if (path.startsWith("/admin/") && apikey !== SERVICE_KEY) {
      error(response, 403, "not_admin");
      return;
    }
    if (path === "/health" && request.method === "GET") {
      send(response, 200, { version: "v0.0.0-fake", name: "GoTrue", description: "fake" });
      return;
    }
    if (path === "/admin/users" && request.method === "GET") {
      if (failUserListings > 0) {
        failUserListings -= 1;
        error(response, 500, "unexpected_failure");
        return;
      }
      const page = Number(url.searchParams.get("page"));
      const perPage = Number(url.searchParams.get("per_page"));
      const all = [...users.values()];
      send(response, 200, { users: all.slice((page - 1) * perPage, page * perPage).map(userJson), aud: "authenticated" }, {
        "x-total-count": String(all.length),
      });
      return;
    }
    if (path === "/admin/users" && request.method === "POST") {
      const email = String(body.email).toLowerCase();
      if (!behaviour.duplicateBothSucceed && byEmail(email) !== null) {
        if (behaviour.failListingAfterDuplicate) {
          failUserListings = 1;
        }
        if (behaviour.duplicateSecondFailsOther) {
          error(response, 500, "unexpected_failure");
          return;
        }
        if (behaviour.duplicateRefusedButCreates) {
          // R8: a contradiction: a second user exists at the address, yet the answer refuses.
          issued.push(addUser({ email }).id);
        }
        error(response, 422, "email_exists");
        return;
      }
      if (typeof body.password === "string") {
        issued.push(body.password);
      }
      const user = addUser({
        email,
        password: typeof body.password === "string" ? body.password : null,
        ...(behaviour.adminUsersGetPhone ? { phone: "99900000002" } : {}),
      });
      firstAdminCreatedId ??= user.id;
      issued.push(user.id);
      adminCreates += 1;
      if (behaviour.loseAdminCreateAnswerAt === adminCreates) {
        // R10: this creation makes `lostCreateUsers` users at the address, and its answer is lost.
        for (let extra = 1; extra < behaviour.lostCreateUsers; extra += 1) {
          issued.push(addUser({ email }).id);
        }
        response.destroy();
        return;
      }
      if (behaviour.loseFirstAdminCreateAnswer && user.id === firstAdminCreatedId) {
        // R7: the user exists, but the answer is lost on the way back.
        if (behaviour.failListingAfterLostCreate) {
          failUserListings = 1;
        }
        response.destroy();
        return;
      }
      send(response, 200, userJson(user));
      return;
    }
    const adminUser = /^\/admin\/users\/([0-9a-f-]{36})$/.exec(path);
    if (adminUser !== null && request.method === "GET") {
      const user = users.get(adminUser[1]!);
      if (user === undefined) {
        error(response, 404, "user_not_found");
        return;
      }
      send(response, 200, userJson(user));
      return;
    }
    if (adminUser !== null && request.method === "DELETE") {
      const user = users.get(adminUser[1]!);
      const attempts = (deleteAttempts.get(adminUser[1]!) ?? 0) + 1;
      deleteAttempts.set(adminUser[1]!, attempts);
      if (user !== undefined && behaviour.failDeletesOfFirstAdminCreatedUser && user.id === firstAdminCreatedId) {
        error(response, 500, "unexpected_failure");
        return;
      }
      if (user === undefined) {
        error(response, 404, "user_not_found");
        return;
      }
      users.delete(user.id);
      send(response, 200, userJson(user));
      return;
    }
    if (path === "/admin/generate_link" && request.method === "POST") {
      const email = String(body.email).toLowerCase();
      let user = byEmail(email);
      if (user === null && behaviour.generateLinkRefusesButCreates) {
        // R7: a contradiction: a user is created, yet the answer says there is none.
        issued.push(addUser({ email }).id);
        if (behaviour.failListingAfterGenerateLink) {
          failUserListings = 1;
        }
        error(response, 404, "user_not_found");
        return;
      }
      if (user === null && behaviour.generateLinkCreatesTwoWithoutId) {
        // R7: two users at the address, and a success answer that carries no user id.
        issued.push(addUser({ email }).id, addUser({ email }).id);
        const hashed = secret("fakehashedlink");
        const actionLink = `http://127.0.0.1:54321/auth/v1/verify?token=${hashed}&type=magiclink&redirect_to=http://127.0.0.1:3000`;
        issued.push(actionLink);
        send(response, 200, {
          action_link: actionLink,
          email_otp: "654321",
          hashed_token: hashed,
          redirect_to: "http://127.0.0.1:3000",
          verification_type: "magiclink",
        });
        return;
      }
      if (user === null && behaviour.generateLinkOversizedWithoutId) {
        // R9: one user created, then a success answer without its id whose token hash is too
        // long for the run's registry (more than 8,192 characters).
        issued.push(addUser({ email }).id);
        if (behaviour.failListingAfterGenerateLink) {
          failUserListings = 1;
        }
        send(response, 200, {
          action_link: "http://127.0.0.1:54321/auth/v1/verify?token=fakeoversized&type=magiclink",
          email_otp: "654321",
          hashed_token: "x".repeat(9_000),
          redirect_to: "http://127.0.0.1:3000",
          verification_type: "magiclink",
        });
        return;
      }
      if (user === null) {
        if (!behaviour.generateLinkCreatesMissing) {
          error(response, 404, "user_not_found");
          return;
        }
        user = addUser({ email });
        issued.push(user.id);
        if (behaviour.failListingAfterGenerateLink) {
          failUserListings = 1;
        }
        if (behaviour.generateLinkMissingHangs) {
          // The user exists, but no answer ever comes: the transport's timeout ends it.
          return;
        }
      }
      const hashed = secret("fakehashedlink");
      links.set(hashed, { userId: user.id, used: false });
      const actionLink = `http://127.0.0.1:54321/auth/v1/verify?token=${hashed}&type=magiclink&redirect_to=http://127.0.0.1:3000`;
      issued.push(actionLink);
      if (behaviour.generateLinkSendsMail) {
        sendSignInMail(email, user.id);
      }
      send(response, 200, {
        ...userJson(user),
        action_link: actionLink,
        email_otp: "654321",
        hashed_token: hashed,
        redirect_to: "http://127.0.0.1:3000",
        verification_type: "magiclink",
      });
      return;
    }
    if (path === "/verify" && request.method === "POST") {
      const entry =
        typeof body.token_hash === "string"
          ? links.get(body.token_hash)
          : codes.get(`${String(body.email).toLowerCase()}:${String(body.token)}`);
      if (entry !== undefined && entry.used && behaviour.replayTransportFailure) {
        response.destroy();
        return;
      }
      if (entry === undefined || (entry.used && !behaviour.replayAllowed) || !users.has(entry.userId)) {
        error(response, 403, "otp_expired");
        return;
      }
      entry.used = true;
      const owner = users.get(entry.userId)!;
      const other = [...users.values()].find((user) => user.id !== owner.id) ?? owner;
      send(response, 200, issueSession(behaviour.verifyReturnsOtherUser ? other : owner));
      return;
    }
    if (path === "/token" && url.searchParams.get("grant_type") === "password") {
      passwordGrants += 1;
      if (behaviour.rateLimitAfter !== null && passwordGrants > behaviour.rateLimitAfter) {
        error(response, 429, "over_request_rate_limit");
        return;
      }
      const user = byEmail(String(body.email));
      if (typeof body.password === "string") {
        issued.push(body.password);
      }
      if (user === null) {
        error(response, 400, behaviour.unknownEnumerates ? "user_not_found" : "invalid_credentials");
        return;
      }
      if (user.password !== body.password) {
        error(response, 400, "invalid_credentials");
        return;
      }
      const first = firstAdminCreatedId === null ? undefined : users.get(firstAdminCreatedId);
      send(response, 200, issueSession(behaviour.passwordGrantReturnsFirstAdminUser && first !== undefined ? first : user));
      return;
    }
    if (path === "/otp" && request.method === "POST") {
      const email = String(body.email).toLowerCase();
      const existing = byEmail(email);
      if (behaviour.foreignRunTaggedUserOnOtp) {
        // Someone else creates a run-tagged user the run did not mint.
        addUser({ email: `${runTag}-foreign@synthetic.invalid` });
      }
      if (existing !== null) {
        if (!behaviour.existingAccountOtp) {
          error(response, 422, "email_provider_disabled");
          return;
        }
        existingAccountSends += 1;
        sendSignInMail(email, existing.id, existingAccountSends === 2 ? (behaviour.delayLinkMailMilliseconds ?? 0) : 0);
        send(response, 200, {});
        return;
      }
      if (body.create_user === true && behaviour.otpCreateOpen) {
        const user = addUser({ email });
        sendSignInMail(email, user.id);
        send(response, 200, {});
        return;
      }
      if (body.create_user === true && behaviour.otpCreateRefusedButMails) {
        sendSignInMail(email, null);
        error(response, 422, "signup_disabled");
        return;
      }
      if (body.create_user !== true && behaviour.otpMissingSendsMail) {
        sendSignInMail(email, null);
        send(response, 200, {});
        return;
      }
      error(response, behaviour.otpRefusalStatus, "otp_disabled");
      return;
    }
    if (path === "/signup" && request.method === "POST") {
      if (typeof body.email !== "string") {
        error(response, 400, "validation_failed");
        return;
      }
      if (behaviour.signupTransportFailure) {
        response.destroy();
        return;
      }
      if (behaviour.signupRefusedWithoutCode) {
        send(response, 403, { msg: "forbidden by a gateway" });
        return;
      }
      if (behaviour.signupAcceptedWithoutId) {
        // A user is created at the minted address, but no id comes back.
        addUser({ email: body.email.toLowerCase(), password: String(body.password) });
        if (behaviour.failListingAfterSignup) {
          failUserListings = 1;
        }
        send(response, 200, {});
        return;
      }
      if (!behaviour.signupOpen) {
        const fixture = firstAdminCreatedId === null ? undefined : users.get(firstAdminCreatedId);
        if (behaviour.signupRefusedButMailsFixture && fixture?.email) {
          // Refused by policy, yet a message goes out (to an address the run owns).
          sendSignInMail(fixture.email, fixture.id);
        }
        if (behaviour.signupRefusedButCreates) {
          // R8: refused by policy (a confirmed status and code), yet the user is created.
          issued.push(addUser({ email: body.email.toLowerCase(), password: String(body.password) }).id);
          if (behaviour.failListingAfterSignup) {
            failUserListings = 1;
          }
        }
        error(response, behaviour.signupRefusalStatus, behaviour.signupRefusalCode);
        return;
      }
      const user = addUser({ email: body.email.toLowerCase(), password: String(body.password) });
      issued.push(user.id, String(body.password));
      send(response, 200, issueSession(user));
      return;
    }
    if (path === "/user" && request.method === "GET") {
      const held = sessions.get(bearer);
      if (behaviour.getUserRefuses || held === undefined || held.signedOut || !users.has(held.userId)) {
        error(response, 403, "bad_jwt");
        return;
      }
      send(response, 200, userJson(users.get(held.userId)!));
      return;
    }
    if (path === "/logout" && request.method === "POST") {
      logouts.push(bearer);
      const held = sessions.get(bearer);
      if (held !== undefined) {
        held.signedOut = true;
      }
      response.writeHead(204, { "content-length": "0" });
      response.end();
      return;
    }
    error(response, 404, "not_found");
  }

  function handleMail(request: IncomingMessage, response: ServerResponse, url: URL, body: Record<string, unknown>) {
    if (url.pathname === "/api/v1/messages" && request.method === "GET") {
      const visible = visibleMessages();
      const start = Number(url.searchParams.get("start"));
      const limit = Number(url.searchParams.get("limit"));
      const page = visible.slice(start, start + limit);
      send(response, 200, {
        total: visible.length,
        messages_count: visible.length,
        start,
        count: page.length,
        messages: page.map((message) => ({ ID: message.id, To: [{ Address: message.to }], Cc: [], Bcc: [] })),
      });
      return;
    }
    const single = /^\/api\/v1\/message\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
    if (single !== null && request.method === "GET") {
      const message = visibleMessages().find((entry) => entry.id === single[1]);
      if (message === undefined) {
        send(response, 404, { error: "not found" });
        return;
      }
      send(response, 200, { ID: message.id, To: [{ Address: message.to }], Text: message.text, HTML: "" });
      return;
    }
    if (url.pathname === "/api/v1/messages" && request.method === "DELETE") {
      const ids = Array.isArray(body.IDs) ? (body.IDs as string[]) : [];
      if (ids.length !== 1) {
        send(response, 400, { error: "exactly one id expected by this fake" });
        return;
      }
      const index = messages.findIndex((entry) => entry.id === ids[0]);
      if (index >= 0) {
        messages.splice(index, 1);
      }
      response.writeHead(200, { "content-type": "text/plain", "content-length": "2" });
      response.end("ok");
      return;
    }
    send(response, 404, { error: "not found" });
  }

  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const entry = { method: request.method ?? "", path: url.pathname };
      requests.push(entry);
      requestHook(entry);
      const raw = Buffer.concat(chunks).toString("utf8");
      let body: Record<string, unknown> = {};
      try {
        body = raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        body = {};
      }
      if (url.pathname.startsWith("/auth/v1/")) {
        handleAuth(request, response, url, body);
      } else {
        handleMail(request, response, url, body);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  closers.push(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  return {
    origin,
    behaviour,
    users,
    messages,
    issued,
    shortCodes,
    requests,
    deleteAttempts,
    logouts,
    firstAdminCreatedId: () => firstAdminCreatedId,
    clock: () => now,
    advance: async (milliseconds: number) => {
      now += milliseconds;
      await Promise.resolve();
    },
    onRequest(hook: (entry: { method: string; path: string }) => void) {
      requestHook = hook;
    },
    runTaggedUsers: () => [...users.values()].filter((user) => (user.email ?? "").includes(runTag)).length,
    runTaggedMessages: () => messages.filter((message) => message.to.includes(runTag)).length,
    effectRequests: () => requests.filter((entry) => entry.method !== "GET").length,
  };
}

// The real writer over spies: realpathSync maps the (never created) output directory and
// the app root to themselves, and writeFileSync records the text instead of writing.
function spyOnRealWriter(outputs: { kind: string; text: string }[]) {
  const realRealpath = fs.realpathSync;
  vi.spyOn(fs, "realpathSync").mockImplementation(((target: fs.PathLike) => {
    const resolved = path.resolve(String(target));
    return resolved === OUTPUT_DIRECTORY || resolved === WORKDIR ? resolved : realRealpath(target);
  }) as typeof fs.realpathSync);
  const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(((file: fs.PathOrFileDescriptor, text: unknown) => {
    outputs.push({ kind: String(file).includes("provider-probe-impact-") ? "impact-display" : "evidence", text: String(text) });
  }) as typeof fs.writeFileSync);
  syncBuiltinESMExports();
  return writeSpy;
}

type Harness = Awaited<ReturnType<typeof harness>>;

async function harness(
  options: Readonly<{
    suffix: string;
    behaviour?: Partial<Behaviour>;
    environment?: Readonly<Record<string, string | undefined>>;
    cliVersion?: string;
    approval?: "matching" | "wrong";
    // Called at the start of every wait of the run-phase suite (test control only).
    waitHook?: () => Promise<void>;
    // The stack observation PP-00 receives (default: this checkout's fixture labels).
    observe?: () => Promise<unknown>;
    transportTimeoutMilliseconds?: number;
    // Use the production output writer (over file-system spies) instead of a recorder.
    realWriter?: boolean;
    // Called with the fake stack before the preview runs, and after it (test control only).
    beforePreview?: (stack: Awaited<ReturnType<typeof startFakeStack>>, environment: Record<string, string | undefined>) => void;
    afterPreview?: (environment: Record<string, string | undefined>) => void;
    // R7: the run core's test seam around each public client of the run phase.
    publicClientWrapper?: (client: ProviderProbePublicClient) => ProviderProbePublicClient;
  }>,
) {
  const environment = gatedTestEnvironment(options.suffix, { SOLMIND_PROVIDER_PROBE_PHASE: "preview", ...(options.environment ?? {}) });
  const runTag = `p28-20261001-${options.suffix}`;
  const stack = await startFakeStack(options.behaviour ?? {}, runTag);
  const limits = { timeoutMilliseconds: options.transportTimeoutMilliseconds ?? 5_000, maxRequestBytes: 65_536, maxResponseBytes: 1_048_576 };
  const authFetch = createLoopbackFetchForTests({ environment, targets: [{ origin: stack.origin, pathPrefixes: ["/auth/v1/"] }], ...limits });
  const mailFetch = createLoopbackFetchForTests({ environment, targets: [{ origin: stack.origin, pathPrefixes: ["/api/v1/"] }], ...limits });
  const outputs: { kind: string; text: string }[] = [];
  const writeSpy = options.realWriter ? spyOnRealWriter(outputs) : null;
  const build = (phase: "preview" | "run", approvedImpact: string | null) => {
    const run = createRunForTests({
      environment,
      auth: { origin: stack.origin, fetch: authFetch },
      mailpit: { origin: stack.origin, fetch: mailFetch },
      random: seededRandom(phase === "run" ? 0x5eed1 : 0x5eed2),
      clock: stack.clock,
      ...(phase === "run" && options.publicClientWrapper !== undefined ? { publicClientWrapper: options.publicClientWrapper } : {}),
    });
    const expected = { runId: run.config.runId, phase };
    const suite = createSuiteCoreForTests({
      run,
      settings: { phase, anonKey: ANON_KEY, serviceRoleKey: SERVICE_KEY, cliVersion: options.cliVersion ?? "2.115.0", approvedImpact },
      seams: {
        clock: stack.clock,
        wait: async (milliseconds: number) => {
          if (phase === "run" && options.waitHook !== undefined) {
            await options.waitHook();
          }
          await stack.advance(milliseconds);
        },
        observeStack: options.observe ?? (async () => fixtureObservation()),
        writeOutput: options.realWriter
          ? (kind, text) => writeProviderProbeOutputFile({ environment, expected, directory: OUTPUT_DIRECTORY, kind, text })
          : (kind, text) => {
              outputs.push({ kind, text });
            },
      },
    });
    return { run, suite };
  };
  options.beforePreview?.(stack, environment);
  const preview = build("preview", null);
  const previewSummary: ProviderProbeStepSummary | Error = await preview.suite.runStep("PP-00").catch((caught: unknown) => caught as Error);
  stack.onRequest(() => undefined);
  options.afterPreview?.(environment);
  const display = outputs.find((output) => output.kind === "impact-display")?.text ?? "";
  const digest = /Approval digest: (sha256:[0-9a-f]{64})/.exec(display)?.[1] ?? `sha256:${"0".repeat(64)}`;
  environment.SOLMIND_PROVIDER_PROBE_PHASE = "run";
  const main = build("run", options.approval === "wrong" ? `sha256:${"1".repeat(64)}` : digest);
  return { stack, ...main, environment, outputs, writeSpy, display, digest, previewSummary, previewRun: preview.run };
}

// Runs every step in order, and checks that no step waited longer (in simulated time:
// only the wait seam moves the fake clock) than the budget its test timeout is built on,
// and that no record made more requests than its allowance.
async function runAll(subject: Harness): Promise<ProviderProbeStepSummary[]> {
  const summaries: ProviderProbeStepSummary[] = [];
  for (const step of PROVIDER_PROBE_STEPS) {
    const before = subject.stack.clock();
    const requestsBefore = subject.stack.requests.length;
    summaries.push(await subject.suite.runStep(step));
    expect(subject.stack.clock() - before).toBeLessThanOrEqual(providerProbeStepWaitBudgetMilliseconds(step));
    expect(subject.stack.requests.length - requestsBefore).toBeLessThanOrEqual(providerProbeStepRequestBound(step));
  }
  return summaries;
}

function evidenceDocument(subject: Harness): { envelope: Record<string, unknown>; evidence: ProviderProbeEvidence[] } {
  const output = subject.outputs.find((entry) => entry.kind === "evidence");
  if (output === undefined) {
    throw new Error("no evidence document was written");
  }
  return JSON.parse(output.text) as { envelope: Record<string, unknown>; evidence: ProviderProbeEvidence[] };
}

function evidenceOf(subject: Harness): ProviderProbeEvidence[] {
  return evidenceDocument(subject).evidence;
}

// The fixed record order (README, "The evidence records"), and each record's index.
const RECORDS = [
  ["pp00", "PP-00"],
  ["pp01", "PP-01"],
  ["pp02", "PP-02"],
  ["pp03", "PP-03"],
  ["signUp", "PP-04"],
  ["codeSignUp", "PP-04"],
  ["missingCode", "PP-04"],
  ["provider", "PP-04"],
  ["existingCode", "PP-04"],
  ["existingLink", "PP-04"],
  ["credential", "PP-06"],
  ["opacity", "PP-06"],
  ["pp07", "PP-07"],
  ["pp08", "PP-08"],
  ["pp09", "PP-09"],
  ["pp10", "PP-10"],
  ["rate", "PP-06"],
  ["pp11", "PP-11"],
  ["pp12", "PP-12"],
] as const;
const RECORD_ORDER = RECORDS.map(([, probeId]) => probeId);
const R = Object.fromEntries(RECORDS.map(([name], index) => [name, index])) as Record<(typeof RECORDS)[number][0], number>;

describe("the preview phase", () => {
  it("writes the impact display with an approval digest and makes no effect", async () => {
    const subject = await harness({ suffix: "probes-preview" });
    const lines = subject.display.split("\n");

    expect(subject.previewSummary).toMatchObject({ step: "PP-00", outcome: "preview", code: "none" });
    expect(lines).toContain(
      "Local Auth users: expected 3 to 4, each at an address this run minted for it; at most 8 planned, if every check found an unexpected result; the run tracks at most 10 (enforced), and a user it finds but cannot track stops the run",
    );
    expect(lines).toContain(
      "Local Auth sessions: expected 3 to 5, held in memory only, never in a cookie or file; at most 10 planned; at most 10 can be held (enforced)",
    );
    expect(lines).toContain(
      "Local test messages: expected 0 to 2, to addresses this run minted; at most 7 planned; the run tracks at most 100 (enforced), and a run-tagged message it cannot attribute stops the run",
    );
    expect(lines).toContain("Environment check: workdir matches, project matches, API URL matches");
    expect(lines).toContain(
      "Observed running stack (its Docker container labels and published port): workdir is this checkout's pinned app root, project solmind-app, API http://127.0.0.1:54321; each matches this checkout and the kernel",
    );
    expect(lines).toContain(
      "Configured, not observed: this checkout's supabase/config.toml has anonymous sign-in disabled and phone sign-up disabled; the run does not try either, so item 70's anon-key check of those two surfaces stays owed (a decision for Paul)",
    );
    // Every permitted effect is described, sign-out and issued one-time links included.
    expect(lines).toContain(
      "One-time sign-in links and codes: the server issues them only for addresses this run minted (PP-02, PP-09 and the two existing-account messages); each is used at most once, and the rest expire",
    );
    expect(lines).toContain(
      "Sign-out: each session the run holds is signed out once (local scope) before cleanup; sign-out does not revoke a session credential already issued, which stays in memory only until the process ends",
    );
    expect(subject.display).toContain("Run id: P28-20261001-probes-preview");
    expect(subject.display).toContain("Requests: at most 100 per record (enforced); cleanup is not limited");
    // R6: no anonymous or phone attempt is announced or made.
    expect(subject.display).not.toMatch(/Anonymous and phone sign-up are each tried|\+999|Not observed:/);
    expect(subject.display).toMatch(/Approval digest: sha256:[0-9a-f]{64}\n$/);
    expect(subject.stack.effectRequests()).toBe(0);
    expect(subject.outputs.filter((output) => output.kind === "evidence")).toEqual([]);
  });

  it("allows no step after PP-00", async () => {
    const subject = await harness({ suffix: "probes-preview2" });
    // A fresh preview suite: PP-00 then PP-01 must refuse.
    const previewOnly = createSuiteCoreForTests({
      run: subject.previewRun,
      settings: { phase: "preview", anonKey: ANON_KEY, serviceRoleKey: SERVICE_KEY, cliVersion: "2.115.0", approvedImpact: null },
      seams: {
        clock: subject.stack.clock,
        wait: subject.stack.advance,
        observeStack: async () => fixtureObservation(),
        writeOutput: () => undefined,
      },
    });
    await previewOnly.runStep("PP-00");
    await expect(previewOnly.runStep("PP-01")).rejects.toThrow("provider_probe_step_preview_only");
  });
});

describe("the display does not depend on where the checkout lives (R6b)", () => {
  afterEach(() => {
    rootSegment.value = null;
  });

  it.each([
    ["a UUID-shaped", "0f8fad5b-d9cb-469f-a165-70867728950e"],
    ["an address-like", "probe@example.test"],
    ["a token-like", "token-folder"],
  ])("passes the preview and a full run with %s folder in the app root's path", async (_label, segment) => {
    rootSegment.value = segment;
    // Positive control: every module now sees a root with that folder in it.
    expect(providerProbeAppRoot()).toContain(segment);

    const subject = await harness({ suffix: "probes-anyroot" });
    expect(subject.previewSummary).toMatchObject({ step: "PP-00", outcome: "preview", code: "none" });
    expect(subject.display).not.toContain(segment);
    expect(subject.display).toContain("workdir is this checkout's pinned app root");
    const summaries = await runAll(subject);

    expect(summaries.map((summary) => summary.outcome)).toEqual([...Array.from({ length: 13 }, () => "pass"), "written"]);
    expect(evidenceOf(subject).map((record) => record.probeId)).toEqual(RECORD_ORDER);
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });

  it("shows the same display, so the same approval digest, wherever the checkout lives", async () => {
    const here = await harness({ suffix: "probes-samedigest" });
    rootSegment.value = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const elsewhere = await harness({ suffix: "probes-samedigest" });

    expect(elsewhere.display).toBe(here.display);
    expect(elsewhere.digest).toBe(here.digest);
  });

  it("stops PP-00 before any request when the run id is one the output scanner would refuse", async () => {
    // A run id with the word the scanner refuses; the run procedure's generated id never has one.
    const subject = await harness({ suffix: "probes-tokenrun" });

    expect(subject.previewSummary).toMatchObject({ step: "PP-00", outcome: "blocked", code: "preflight-refused" });
    expect(subject.stack.requests).toEqual([]);
    expect(subject.outputs).toEqual([]);
  });
});

describe("the running stack is observed first (item 70; R6)", () => {
  it.each([
    ["the observer cannot read the stack", async () => Promise.reject(new Error("provider_probe_stack_unreadable")), "environment-unobserved"],
    ["the observation is malformed", async () => ({ workdir: WORKDIR, projectId: "solmind-app" }), "environment-unobserved"],
    ["the stack was started from another folder", async () => fixtureObservation(path.resolve(WORKDIR, "..", "another-checkout")), "environment-mismatch"],
    ["the stack belongs to another project", async () => ({ ...fixtureObservation(), projectId: "another-project" }), "environment-mismatch"],
    ["the stack's API is on another port", async () => ({ ...fixtureObservation(), apiUrl: "http://127.0.0.1:54399/" }), "environment-mismatch"],
  ] as const)("when %s, the preview stops with no request at all and no display", async (_label, observe, code) => {
    const subject = await harness({ suffix: "probes-observe", observe });

    expect(subject.previewSummary).toMatchObject({ step: "PP-00", outcome: "blocked", code });
    expect(subject.stack.requests).toEqual([]);
    expect(subject.outputs).toEqual([]);
  });

  it("refuses the run phase as well, before any effect", async () => {
    let calls = 0;
    const subject = await harness({
      suffix: "probes-observe-run",
      observe: async () => {
        calls += 1;
        if (calls > 1) {
          throw new Error("provider_probe_stack_not_found");
        }
        return fixtureObservation();
      },
    });
    const before = subject.stack.requests.length;
    const summaries = await runAll(subject);

    expect(summaries[0]).toMatchObject({ outcome: "blocked", code: "environment-unobserved" });
    expect(summaries.slice(1, -1).every((summary) => summary.outcome === "blocked")).toBe(true);
    expect(subject.stack.requests.length).toBe(before);
  });
});

describe("a full run against the current-settings fake (closed sign-up, open existing-account email sign-in)", () => {
  it("passes every step, writes 19 coherent records in the fixed order, and leaves nothing behind", async () => {
    const subject = await harness({ suffix: "probes-full" });
    const summaries = await runAll(subject);

    expect(summaries.map((summary) => summary.outcome)).toEqual([
      ...Array.from({ length: 13 }, () => "pass"),
      "written",
    ]);
    const { envelope, evidence } = evidenceDocument(subject);
    expect(envelope).toMatchObject({
      envelopeVersion: 3,
      configuredNotObserved: { anonymousSignIns: "disabled", phoneSignUp: "disabled" },
      countsBeyondEvidenceBounds: [],
    });
    expect(evidence.map((record) => record.probeId)).toEqual(RECORD_ORDER);
    for (const record of evidence) {
      expect(() => createProviderProbeEvidence({ ...record })).not.toThrow();
      expect(record.outcome).toBe("pass");
      expect(record.cookieWriteCount).toBe(0);
      expect(record.requestCount).toBeLessThanOrEqual(PROVIDER_PROBE_SUITE_LIMITS.recordRequestAllowance);
    }
    expect(evidence[R.pp01]).toMatchObject({ userDelta: 1, identityMatched: true, cleanupOutcome: "complete" });
    expect(evidence[R.pp02]).toMatchObject({ messageDelta: 0, identityMatched: true, cleanupOutcome: "not-needed" });
    expect(evidence[R.pp03]).toMatchObject({ sessionDelta: 1, identityMatched: true, cleanupOutcome: "complete" });
    for (const index of [R.signUp, R.codeSignUp, R.missingCode, R.provider]) {
      expect(evidence[index]).toMatchObject({ userDelta: 0, sessionDelta: 0, messageDelta: 0, cleanupOutcome: "not-needed" });
    }
    for (const index of [R.existingCode, R.existingLink]) {
      expect(evidence[index]).toMatchObject({ sessionDelta: 1, messageDelta: 1, identityMatched: true, cleanupOutcome: "complete" });
    }
    expect(evidence[R.credential]).toMatchObject({ userDelta: 1, sessionDelta: 1, identityMatched: true });
    expect(evidence[R.pp07]).toMatchObject({ sessionDelta: 1, identityMatched: false });
    expect(evidence[R.pp08]).toMatchObject({ userDelta: 1 });
    expect(evidence[R.pp09]).toMatchObject({ userDelta: 1, identityMatched: false });
    expect(evidence[R.pp10]).toMatchObject({ providerLifetimeSeconds: 3540, identityMatched: true });
    expect(evidence[R.pp11]).toMatchObject({ cleanupOutcome: "complete", userDelta: 0 });
    expect(evidence[R.pp12]).toMatchObject({ cleanupOutcome: "complete" });
    // The expected counts the display states: 4 users, 5 sessions, 2 messages.
    expect(evidence.reduce((sum, record) => sum + record.userDelta, 0)).toBe(4);
    expect(evidence.reduce((sum, record) => sum + record.sessionDelta, 0)).toBe(5);
    expect(evidence.reduce((sum, record) => sum + record.messageDelta, 0)).toBe(2);
    // Nothing the run created is left, and the unrelated users are untouched.
    expect(subject.stack.runTaggedUsers()).toBe(0);
    expect([...subject.stack.users.values()].map((user) => user.email)).toEqual(["seed-0@example.test", "seed-1@example.test"]);
    expect(subject.stack.messages).toEqual([]);
    // R6: no anonymous or phone request was ever made.
    expect(subject.stack.requests.filter((entry) => entry.path === "/auth/v1/signup").length).toBe(1);
  });

  it("registers every token, link, id and credential the fake issued before any could be written", async () => {
    const subject = await harness({ suffix: "probes-registry" });
    await runAll(subject);

    expect(subject.stack.issued.length).toBeGreaterThan(20);
    const unregistered: number[] = [];
    subject.stack.issued.forEach((value, index) => {
      const before = subject.run.knownValueCount();
      subject.run.registerKnownValue(value);
      if (subject.run.knownValueCount() !== before) {
        unregistered.push(index);
      }
    });
    expect(unregistered).toEqual([]);
    // The 6-digit email codes are below the registry's 8-character minimum; the closed
    // schema is their protection: no record value equals one.
    expect(subject.stack.shortCodes.length).toBeGreaterThan(0);
    const values = evidenceOf(subject).flatMap((record) => Object.values(record).map(String));
    for (const code of subject.stack.shortCodes) {
      expect(values).not.toContain(code);
    }
  });
});

describe("refusals before any effect", () => {
  it("refuses a run whose approval digest does not match the display", async () => {
    const subject = await harness({ suffix: "probes-approval", approval: "wrong" });
    const summaries = await runAll(subject);

    expect(summaries[0]).toMatchObject({ outcome: "blocked", code: "approval-mismatch" });
    expect(summaries.slice(1, -1).every((summary) => summary.outcome === "blocked")).toBe(true);
    expect(summaries[summaries.length - 1]).toMatchObject({ outcome: "not-written" });
    expect(subject.stack.effectRequests()).toBe(0);
  });

  it.each([
    ["a CLI other than 2.115.0", { cliVersion: "2.114.0" }],
    ["a margin other than decision D's 60 seconds", { environment: { SOLMIND_PROVIDER_PROBE_LIFETIME_MARGIN_SECONDS: "30" } }],
  ])("refuses %s", async (_label, options) => {
    const subject = await harness({ suffix: "probes-refuse", ...options });

    expect(subject.previewSummary).toMatchObject({ outcome: "blocked", code: "preflight-refused" });
    expect(subject.outputs).toEqual([]);
    expect(subject.stack.effectRequests()).toBe(0);
  });

  it("refuses when a user already carries this run id", async () => {
    const subject = await harness({ suffix: "probes-dirty" });
    subject.stack.users.set("ffffffff-0000-4000-8000-000000000001", {
      id: "ffffffff-0000-4000-8000-000000000001",
      email: "p28-20261001-probes-dirty-left@synthetic.invalid",
      phone: "",
      is_anonymous: false,
      password: null,
    });
    const summaries = await runAll(subject);

    expect(summaries[0]).toMatchObject({ outcome: "blocked", code: "preflight-refused" });
    expect(subject.stack.effectRequests()).toBe(0);
  });
});

describe("the output writer's live gate, end to end (R6)", () => {
  it("positive control: the real writer writes the display in the preview and the evidence in the run", async () => {
    const subject = await harness({ suffix: "probes-writer", realWriter: true });
    await runAll(subject);

    expect(subject.writeSpy).toHaveBeenCalledTimes(2);
    expect(subject.outputs.map((output) => output.kind)).toEqual(["impact-display", "evidence"]);
    expect(evidenceOf(subject).map((record) => record.probeId)).toEqual(RECORD_ORDER);
  });

  it("an interlock removed during the preview's last read refuses the display write", async () => {
    const subject = await harness({
      suffix: "probes-writer-preview",
      realWriter: true,
      beforePreview: (stack, environment) => {
        let mailReads = 0;
        stack.onRequest((entry) => {
          // The baseline's second mailbox read is PP-00's last request; it is already
          // written, so it completes, and nothing else is sent before the write.
          if (entry.method === "GET" && entry.path === "/api/v1/messages" && ++mailReads === 2) {
            delete environment.SOLMIND_PROVIDER_PROBE_APPROVAL;
          }
        });
      },
      // Restored only so the harness can build its (unused) run-phase suite afterwards.
      afterPreview: (environment) => {
        environment.SOLMIND_PROVIDER_PROBE_APPROVAL = gatedTestEnvironment("probes-writer-preview").SOLMIND_PROVIDER_PROBE_APPROVAL;
      },
    });

    expect(subject.previewSummary).toBeInstanceOf(Error);
    expect((subject.previewSummary as Error).message).toBe("provider_probe_output_gate_closed");
    expect(subject.writeSpy).not.toHaveBeenCalled();
    expect(subject.outputs).toEqual([]);
    expect(subject.stack.effectRequests()).toBe(0);
  });

  it("an interlock removed during PP-12's last read refuses the evidence write, after cleanup", async () => {
    const subject = await harness({ suffix: "probes-writer-run", realWriter: true });
    for (const step of PROVIDER_PROBE_STEPS.slice(0, PROVIDER_PROBE_STEPS.indexOf("PP-12"))) {
      await subject.suite.runStep(step);
    }
    let mailReads = 0;
    subject.stack.onRequest((entry) => {
      if (entry.method === "GET" && entry.path === "/api/v1/messages" && ++mailReads === 2) {
        delete subject.environment.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS;
      }
    });
    expect(await subject.suite.runStep("PP-12")).toMatchObject({ outcome: "pass" });

    await expect(subject.suite.runStep("evidence")).rejects.toThrow("provider_probe_output_gate_closed");
    expect(subject.writeSpy).toHaveBeenCalledTimes(1);
    expect(subject.outputs.map((output) => output.kind)).toEqual(["impact-display"]);
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });
});

describe("findings and failure paths", () => {
  it("PP-02 fails when generateLink sends a message, and the message is still cleaned up", async () => {
    const subject = await harness({ suffix: "probes-linkmail", behaviour: { generateLinkSendsMail: true } });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.pp02]).toMatchObject({ outcome: "fail", messageDelta: 1, cleanupOutcome: "complete" });
    // PP-09's link for a missing user mails too: a failure there as well.
    expect(evidence[R.pp09]).toMatchObject({ outcome: "fail", userDelta: 1, messageDelta: 1, cleanupOutcome: "complete" });
    // The earlier message to the fixture is set aside, so the existing-account sign-ins
    // still read only the message their own request caused.
    for (const index of [R.existingCode, R.existingLink]) {
      expect(evidence[index]).toMatchObject({ outcome: "pass", sessionDelta: 1, messageDelta: 1 });
    }
    expect(subject.stack.messages).toEqual([]);
  });

  it("PP-01 fails when the created Explorer fixture carries a phone", async () => {
    const subject = await harness({ suffix: "probes-phone01", behaviour: { adminUsersGetPhone: true } });
    await runAll(subject);

    expect(evidenceOf(subject)[R.pp01]).toMatchObject({ outcome: "fail", userDelta: 1, cleanupOutcome: "complete" });
  });

  it("PP-07 fails, and PP-06 fails on identity, when a credential sign-in returns the bound user's session", async () => {
    const subject = await harness({ suffix: "probes-pp07allow", behaviour: { passwordGrantReturnsFirstAdminUser: true } });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.credential]).toMatchObject({ outcome: "fail", errorClass: "identity-mismatch", identityMatched: false });
    expect(evidence[R.pp07]).toMatchObject({ outcome: "fail", identityMatched: true });
  });

  it("PP-10 (and PP-03) fail when the server no longer recognizes the sessions", async () => {
    const subject = await harness({ suffix: "probes-nouser", behaviour: { getUserRefuses: true } });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.pp03]).toMatchObject({ outcome: "fail", errorClass: "identity-mismatch" });
    expect(evidence[R.pp10]).toMatchObject({ outcome: "fail", identityMatched: false });
  });

  it("PP-03 fails on identity mismatch when the exchange returns another user's session", async () => {
    const subject = await harness({ suffix: "probes-otheruser", behaviour: { verifyReturnsOtherUser: true } });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.pp03]).toMatchObject({ outcome: "fail", errorClass: "identity-mismatch", identityMatched: false });
    // R6: an existing-account code or link that signs in another account is never a pass.
    for (const index of [R.existingCode, R.existingLink]) {
      expect(evidence[index]).toMatchObject({ outcome: "fail", errorClass: "identity-mismatch", identityMatched: false });
    }
  });

  it("PP-03 fails when the same token hash can be used twice", async () => {
    const subject = await harness({ suffix: "probes-replay", behaviour: { replayAllowed: true } });
    await runAll(subject);

    expect(evidenceOf(subject)[R.pp03]).toMatchObject({ outcome: "fail", sessionDelta: 2 });
  });

  it("R6: PP-03 fails when the replay is answered by a transport failure instead of a refusal", async () => {
    const subject = await harness({ suffix: "probes-replaydrop", behaviour: { replayTransportFailure: true } });
    await runAll(subject);

    expect(evidenceOf(subject)[R.pp03]).toMatchObject({ outcome: "fail", sessionDelta: 1, cleanupOutcome: "complete" });
  });

  it("PP-04 records every open surface as a failure and still deletes what it created", async () => {
    const subject = await harness({
      suffix: "probes-open",
      behaviour: { signupOpen: true, otpCreateOpen: true, providerEnabled: true },
    });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.signUp]).toMatchObject({ outcome: "fail", userDelta: 1, sessionDelta: 1, cleanupOutcome: "complete" });
    expect(evidence[R.codeSignUp]).toMatchObject({ outcome: "fail", userDelta: 1, messageDelta: 1, cleanupOutcome: "complete" });
    expect(evidence[R.provider]).toMatchObject({ outcome: "fail", userDelta: 0 });
    expect(evidence[R.pp11]).toMatchObject({ outcome: "pass", cleanupOutcome: "complete" });
    expect(evidence[R.pp12]).toMatchObject({ outcome: "pass" });
    expect([...subject.stack.users.values()].map((user) => user.email)).toEqual(["seed-0@example.test", "seed-1@example.test"]);
    expect(subject.stack.messages).toEqual([]);
  });

  it.each([
    ["a transport failure", { signupTransportFailure: true }],
    ["a 403 without a policy-refusal code", { signupRefusedWithoutCode: true }],
  ])("R6: PP-04 does not count %s as a closed sign-up surface", async (_label, behaviour) => {
    const subject = await harness({ suffix: "probes-signupodd", behaviour });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.signUp]).toMatchObject({ outcome: "fail", userDelta: 0, sessionDelta: 0, messageDelta: 0 });
    // The other closed surfaces still pass on their confirmed refusals.
    expect(evidence[R.codeSignUp]).toMatchObject({ outcome: "pass" });
  });

  it("R6: PP-04 fails a closed surface that refuses by policy but still sends a message, which is cleaned up", async () => {
    // The message goes to an address the run owns, so it is tracked and deleted, and the
    // record's failure can only come from the closed surface's own no-message rule.
    const subject = await harness({ suffix: "probes-refusedmail2", behaviour: { signupRefusedButMailsFixture: true } });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.signUp]).toMatchObject({ outcome: "fail", userDelta: 0, sessionDelta: 0, messageDelta: 1, cleanupOutcome: "complete" });
    expect(evidence[R.codeSignUp]).toMatchObject({ outcome: "pass" });
    expect(subject.stack.messages).toEqual([]);
  });

  it("R6: PP-04 fails a closed surface whose refusal mails an address nobody owns, and stops further effects", async () => {
    const subject = await harness({ suffix: "probes-refusedmail", behaviour: { otpCreateRefusedButMails: true } });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.codeSignUp]).toMatchObject({ outcome: "fail", userDelta: 0, sessionDelta: 0, messageDelta: 1 });
    // The message is to an address no user has: nobody can own it, so effects stop.
    expect(summaries.find((summary) => summary.step === "PP-04")).toMatchObject({ code: "untracked-effect" });
  });

  it("R6: PP-04 fails the disabled provider when the answer is not GoTrue's own refusal", async () => {
    const subject = await harness({ suffix: "probes-authz404", behaviour: { authorizeAnswer: "not-found" } });
    await runAll(subject);

    expect(evidenceOf(subject)[R.provider]).toMatchObject({ outcome: "fail", userDelta: 0 });
  });

  it("never adopts a listed user at an address it did not mint for that request", async () => {
    const subject = await harness({ suffix: "probes-foreign", behaviour: { foreignRunTaggedUserOnOtp: true } });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    const foreign = [...subject.stack.users.values()].filter((user) => (user.email ?? "").endsWith("-foreign@synthetic.invalid"));
    expect(foreign.length).toBeGreaterThan(0);
    for (const user of foreign) {
      // Listed, carrying the run id, but never minted for a request: never deleted.
      expect(subject.stack.deleteAttempts.get(user.id)).toBeUndefined();
    }
    expect(evidence[R.pp12]).toMatchObject({ outcome: "fail", errorClass: "cleanup-failed", cleanupOutcome: "failed" });
    expect(summaries.find((summary) => summary.step === "PP-12")).toMatchObject({ outcome: "fail" });
  });

  it("R6: PP-04 records a refused existing-account email sign-in as a failure (provider-denied), never a pass", async () => {
    const subject = await harness({ suffix: "probes-otpoff", behaviour: { existingAccountOtp: false } });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    for (const index of [R.existingCode, R.existingLink]) {
      expect(evidence[index]).toMatchObject({ outcome: "fail", errorClass: "provider-denied", sessionDelta: 0, messageDelta: 0 });
    }
  });

  it("PP-04 fails, and stops further effects, when a mail lands for an address with no user", async () => {
    const subject = await harness({ suffix: "probes-orphanmail", behaviour: { otpMissingSendsMail: true } });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.missingCode]).toMatchObject({ outcome: "fail", messageDelta: 1, cleanupOutcome: "failed" });
    expect(summaries.find((summary) => summary.step === "PP-06")).toMatchObject({ outcome: "blocked" });
    expect(evidence[R.pp11]).toMatchObject({ outcome: "fail", errorClass: "cleanup-failed" });
  });

  it("R6/R7: an id-less creation whose listing fails is reported unresolved: effects stop, cleanup still runs, and the run stops for Paul", async () => {
    // The sign-up creates a user at its minted address but returns no id; the listing
    // that would adopt it then fails. The run cannot know that user's id, so (R7) it
    // counts one unresolved user and stops every further effect. The reservation is still
    // released, so cleanup runs and deletes the Explorer fixture; the unresolved user
    // stays for Paul, and PP-12 finds it.
    const subject = await harness({ suffix: "probes-noidlist", behaviour: { signupAcceptedWithoutId: true, failListingAfterSignup: true } });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.signUp]).toMatchObject({ outcome: "fail" });
    expect(summaries.find((summary) => summary.step === "PP-04")).toMatchObject({ code: "untracked-effect" });
    expect(summaries.find((summary) => summary.step === "PP-06")).toMatchObject({ outcome: "blocked" });
    expect(subject.stack.deleteAttempts.get(subject.stack.firstAdminCreatedId()!)).toBe(1);
    expect(subject.stack.runTaggedUsers()).toBe(1);
    expect(evidence[R.pp12]).toMatchObject({ outcome: "fail", errorClass: "cleanup-failed" });
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
  });

  it("PP-06 fails when an unknown address is answered differently from a wrong credential", async () => {
    const subject = await harness({ suffix: "probes-enum", behaviour: { unknownEnumerates: true } });
    await runAll(subject);

    expect(evidenceOf(subject)[R.opacity]).toMatchObject({ outcome: "fail" });
  });

  it("R6: a session whose refresh token is too short to register is refused as malformed, and nothing is held", async () => {
    // (The run id avoids the word the output scanner refuses.)
    const subject = await harness({ suffix: "probes-shortsession", behaviour: { shortRefreshToken: true } });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    // The first session (PP-03's exchange) is refused as malformed, so PP-03 fails and
    // effects stop; no session is held anywhere.
    expect(evidence[R.pp03]).toMatchObject({ outcome: "fail", sessionDelta: 0 });
    expect(summaries.find((summary) => summary.step === "PP-03")).toMatchObject({ code: "unexpected-error" });
    expect(evidence.reduce((sum, record) => sum + record.sessionDelta, 0)).toBe(0);
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });

  it("PP-06 rate fails when nothing throttles within the bound, and passes with its request count when it does", async () => {
    const open = await harness({ suffix: "probes-norate", behaviour: { rateLimitAfter: null } });
    await runAll(open);
    expect(evidenceOf(open)[R.rate]).toMatchObject({ outcome: "fail", requestCount: 40 });

    const limited = await harness({ suffix: "probes-rate", behaviour: { rateLimitAfter: 12 } });
    await runAll(limited);
    const rate = evidenceOf(limited)[R.rate]!;
    expect(rate.outcome).toBe("pass");
    // Earlier credential sign-ins (PP-06 three times, PP-07 once) count toward the limit.
    expect(rate.requestCount).toBe(12 - 4 + 1);
  });

  it("PP-07, a pre-bridge rule check, denies when the signed-in user is not the bound user", async () => {
    const subject = await harness({ suffix: "probes-pp07" });
    await runAll(subject);

    expect(evidenceOf(subject)[R.pp07]).toMatchObject({ outcome: "pass", identityMatched: false });
  });

  it("PP-08 fails when two concurrent creates both succeed, and deletes both", async () => {
    const subject = await harness({ suffix: "probes-dup", behaviour: { duplicateBothSucceed: true } });
    await runAll(subject);

    expect(evidenceOf(subject)[R.pp08]).toMatchObject({ outcome: "fail", userDelta: 2, cleanupOutcome: "complete" });
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });

  it("R6: PP-08 fails when the second create fails for another reason than a duplicate", async () => {
    const subject = await harness({ suffix: "probes-dupother", behaviour: { duplicateSecondFailsOther: true } });
    await runAll(subject);

    expect(evidenceOf(subject)[R.pp08]).toMatchObject({ outcome: "fail", userDelta: 1, cleanupOutcome: "complete" });
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });

  it("R6/R8: PP-08 releases its open reservation when the listing fails after one create; the refused attempt counts unresolved", async () => {
    // One create returns its id; the other is refused as a duplicate (422 email_exists,
    // a confirmed refusal) and returns none; then the listing fails. (R8) A refusal does
    // not account for the attempt, so it counts one unresolved user: effects stop and the
    // run stops for Paul. The reservation is still released, and the tracked user deleted.
    const subject = await harness({ suffix: "probes-duplist", behaviour: { failListingAfterDuplicate: true } });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.pp08]).toMatchObject({ outcome: "fail", userDelta: 2, cleanupOutcome: "failed" });
    expect(summaries.find((summary) => summary.step === "PP-08")).toMatchObject({ code: "untracked-effect" });
    expect(summaries.find((summary) => summary.step === "PP-09")).toMatchObject({ outcome: "blocked" });
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    expect(evidence[R.pp12]).toMatchObject({ outcome: "fail", errorClass: "cleanup-failed" });
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });

  it("PP-09 records no creation when generateLink refuses a missing user", async () => {
    const subject = await harness({ suffix: "probes-nocreate", behaviour: { generateLinkCreatesMissing: false } });
    await runAll(subject);

    expect(evidenceOf(subject)[R.pp09]).toMatchObject({ outcome: "pass", userDelta: 0, identityMatched: null });
  });

  it("R6: PP-09 fails when generateLink hangs past the transport timeout, and the user it created is still deleted", async () => {
    const subject = await harness({
      suffix: "probes-hang",
      behaviour: { generateLinkMissingHangs: true },
      transportTimeoutMilliseconds: 1_000,
    });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    // A transport failure is not an answer: never a pass. The user exists at the minted
    // address, so the listing adopts it and cleanup deletes it.
    expect(evidence[R.pp09]).toMatchObject({ outcome: "fail", userDelta: 1, cleanupOutcome: "complete" });
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "pass" });
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });

  it("R6/R7: PP-09 reports a hung request's user unresolved when the listing fails; effects stop and the run stops for Paul", async () => {
    // The hung request created a user whose id the run never learns (the listing that
    // would adopt it fails). (R7) It is one unresolved user: every further effect stops,
    // cleanup still runs and deletes what was tracked, and the run stops for Paul.
    const subject = await harness({
      suffix: "probes-hanglist",
      behaviour: { generateLinkMissingHangs: true, failListingAfterGenerateLink: true },
      transportTimeoutMilliseconds: 1_000,
    });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    // The unresolved user is counted in the record, whose cleanup failed.
    expect(evidence[R.pp09]).toMatchObject({ outcome: "fail", userDelta: 1, cleanupOutcome: "failed" });
    expect(summaries.find((summary) => summary.step === "PP-09")).toMatchObject({ code: "untracked-effect" });
    expect(summaries.find((summary) => summary.step === "PP-10")).toMatchObject({ outcome: "blocked" });
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    expect(subject.stack.runTaggedUsers()).toBe(1);
    expect(evidence[R.pp12]).toMatchObject({ outcome: "fail", errorClass: "cleanup-failed" });
  });

  it.each([
    ["lifetime fields that disagree", { expiresAtOffset: 100 }],
    ["a usable length below one second", { expiresIn: 50, jwtLifetime: 50 }],
  ])("PP-10 fails for %s", async (_label, behaviour) => {
    const subject = await harness({ suffix: "probes-life", behaviour });
    await runAll(subject);

    expect(evidenceOf(subject)[R.pp10]).toMatchObject({ outcome: "fail" });
  });
});

// R7: a wrapper for the run core's public-client test seam. Each method delegates to the
// real auth-js client over the fake, unless an override answers in its place (an answer
// the real auth-js never returns, such as an error that also carries a session).
type PublicAuth = ProviderProbePublicClient["auth"];
type PublicOverrides = Partial<{
  signUp: (real: PublicAuth, credentials: Readonly<Record<string, unknown>>) => Promise<unknown>;
  // R8: for the existing-account send's answer.
  signInWithOtp: (real: PublicAuth, credentials: Readonly<Record<string, unknown>>) => Promise<unknown>;
  verifyOtp: (real: PublicAuth, params: Readonly<Record<string, unknown>>) => Promise<unknown>;
}>;

function wrapPublicClients(overrides: PublicOverrides) {
  return (client: ProviderProbePublicClient): ProviderProbePublicClient => {
    const real = client.auth;
    return {
      auth: {
        signUp: (credentials) => (overrides.signUp ? overrides.signUp(real, credentials) : real.signUp(credentials)),
        signInWithOtp: (credentials) =>
          overrides.signInWithOtp ? overrides.signInWithOtp(real, credentials) : real.signInWithOtp(credentials),
        signInWithPassword: (credentials) => real.signInWithPassword(credentials),
        verifyOtp: (params) => (overrides.verifyOtp ? overrides.verifyOtp(real, params) : real.verifyOtp(params)),
        getUser: (jwt) => real.getUser(jwt),
      },
    };
  };
}

type AuthAnswer = { data: Record<string, unknown> | null; error: unknown };

// A plainly fake session for a contradictory answer; the fake server never issued it.
function fabricatedSession(credential: string) {
  return {
    access_token: credential,
    refresh_token: `${credential}-renewal`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(START / 1000) + 3600,
    user: null,
  };
}

describe("R7: findings of re-check #128b", () => {
  it("a lost admin creation answer is reconciled at its minted address: PP-01 fails, and cleanup deletes that exact id once", async () => {
    const subject = await harness({ suffix: "probes-lostcreate", behaviour: { loseFirstAdminCreateAnswer: true } });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);
    const located = subject.stack.firstAdminCreatedId()!;

    expect(evidence[R.pp01]).toMatchObject({ outcome: "fail", errorClass: "unexpected", userDelta: 1, cleanupOutcome: "complete" });
    expect(summaries.find((summary) => summary.step === "PP-01")).toMatchObject({ outcome: "fail", code: "none" });
    // Never a fixture: the steps that need the Explorer are blocked; the others run.
    for (const index of [R.pp02, R.pp03, R.existingCode, R.existingLink, R.pp07]) {
      expect(evidence[index]).toMatchObject({ outcome: "blocked" });
    }
    expect(evidence[R.credential]).toMatchObject({ outcome: "pass" });
    expect(subject.stack.deleteAttempts.get(located)).toBe(1);
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "pass", stoppedForPaul: false });
    expect(evidence[R.pp12]).toMatchObject({ outcome: "pass" });
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });

  it("a lost admin creation answer whose listing also fails stops every later effect (PP-04 and PP-06 do not run), and stops for Paul", async () => {
    const subject = await harness({
      suffix: "probes-lostlist",
      behaviour: { loseFirstAdminCreateAnswer: true, failListingAfterLostCreate: true },
    });
    await subject.suite.runStep("PP-00");
    const pp01 = await subject.suite.runStep("PP-01");
    const afterPp01 = subject.stack.requests.length;
    const summaries = [pp01];
    for (const step of PROVIDER_PROBE_STEPS.slice(2)) {
      summaries.push(await subject.suite.runStep(step));
    }
    const evidence = evidenceOf(subject);
    const orphan = subject.stack.firstAdminCreatedId()!;

    expect(pp01).toMatchObject({ outcome: "fail", code: "untracked-effect" });
    // The unresolved user is counted in the record (value-free), whose cleanup failed.
    expect(evidence[R.pp01]).toMatchObject({ outcome: "fail", userDelta: 1, cleanupOutcome: "failed" });
    for (const step of ["PP-02", "PP-03", "PP-04", "PP-06", "PP-07", "PP-08", "PP-09", "PP-10", "PP-06-rate"]) {
      expect(summaries.find((summary) => summary.step === step)).toMatchObject({ outcome: "blocked" });
    }
    // No effect request of any kind after PP-01: no sign-up, email, sign-in, creation or link.
    expect(subject.stack.requests.slice(afterPp01).filter((entry) => entry.method === "POST")).toEqual([]);
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    expect(evidence[evidence.length - 1]).toMatchObject({ probeId: "PP-12", outcome: "fail", errorClass: "cleanup-failed" });
    // The unresolved user is left for Paul, never deleted by a guess.
    expect(subject.stack.deleteAttempts.get(orphan)).toBeUndefined();
    expect(subject.stack.runTaggedUsers()).toBe(1);
  });

  it.each([
    ["refuses with user_not_found although it created the user", { generateLinkRefusesButCreates: true }, 1],
    ["succeeds without an id after creating two users", { generateLinkCreatesTwoWithoutId: true }, 2],
  ])("PP-09 fails when generateLink %s, and cleanup deletes what was created", async (_label, behaviour, created) => {
    const subject = await harness({ suffix: "probes-pp09odd", behaviour });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.pp09]).toMatchObject({ outcome: "fail", userDelta: created, cleanupOutcome: "complete" });
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "pass", stoppedForPaul: false });
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });

  it.each([
    ["a refusal code from another surface", { behaviour: { signupRefusalCode: "otp_disabled" } }],
    ["a policy code with a server-error status", { behaviour: { signupRefusalStatus: 500 } }],
    ["an unrelated validation failure", { behaviour: { signupRefusalStatus: 400, signupRefusalCode: "validation_failed" } }],
    [
      "status zero with a policy code",
      {
        publicClientWrapper: wrapPublicClients({
          signUp: async () => ({ data: { user: null, session: null }, error: { name: "AuthRetryableFetchError", status: 0, code: "signup_disabled" } }),
        }),
      },
    ],
  ] as const)("the closed sign-up surface fails on %s", async (_label, options) => {
    const subject = await harness({ suffix: "probes-refusal", ...options });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.signUp]).toMatchObject({ outcome: "fail", userDelta: 0, sessionDelta: 0, messageDelta: 0 });
    // Positive control: the next surface still passes on its own confirmed refusal.
    expect(evidence[R.codeSignUp]).toMatchObject({ outcome: "pass" });
  });

  it("the email code for a missing address fails when its refusal comes with a server-error status", async () => {
    const subject = await harness({ suffix: "probes-otp500", behaviour: { otpRefusalStatus: 500 } });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.missingCode]).toMatchObject({ outcome: "fail", userDelta: 0, sessionDelta: 0, messageDelta: 0 });
    expect(evidence[R.codeSignUp]).toMatchObject({ outcome: "fail", userDelta: 0 });
    // Positive control: the sign-up surface still passes on its own confirmed refusal.
    expect(evidence[R.signUp]).toMatchObject({ outcome: "pass" });
  });

  it("PP-08 reports an attempt without an id or a confirmed duplicate refusal unresolved when the listing fails, and stops for Paul", async () => {
    // The second create fails with a server error (no id, no duplicate code), then the
    // listing fails: the run cannot know whether that attempt created a user.
    const subject = await harness({ suffix: "probes-duplost", behaviour: { duplicateSecondFailsOther: true, failListingAfterDuplicate: true } });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.pp08]).toMatchObject({ outcome: "fail", userDelta: 2, cleanupOutcome: "failed" });
    expect(summaries.find((summary) => summary.step === "PP-08")).toMatchObject({ code: "untracked-effect" });
    expect(summaries.find((summary) => summary.step === "PP-09")).toMatchObject({ outcome: "blocked" });
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    // What was tracked is still deleted.
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });

  it("the disabled provider fails on an unrelated validation_failed answer", async () => {
    const subject = await harness({ suffix: "probes-authzother", behaviour: { authorizeAnswer: "other-validation" } });
    await runAll(subject);

    expect(evidenceOf(subject)[R.provider]).toMatchObject({ outcome: "fail", userDelta: 0 });
  });

  it("a closed sign-up refusal that also carries a session fails, and that session is held and signed out", async () => {
    const credential = "fake-contradictory-signup-credential-0001";
    const subject = await harness({
      suffix: "probes-errsession",
      publicClientWrapper: wrapPublicClients({
        signUp: async (real, credentials) => {
          const answer = (await real.signUp(credentials)) as AuthAnswer;
          return { data: { ...(answer.data ?? {}), session: fabricatedSession(credential) }, error: answer.error };
        },
      }),
    });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.signUp]).toMatchObject({ outcome: "fail", userDelta: 0, sessionDelta: 1, cleanupOutcome: "complete" });
    expect(subject.stack.logouts.filter((bearer) => bearer === credential)).toHaveLength(1);
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "pass" });
    // Both of its credentials were registered when it arrived: registering again adds nothing.
    const known = subject.run.knownValueCount();
    subject.run.registerKnownValue(credential);
    subject.run.registerKnownValue(`${credential}-renewal`);
    expect(subject.run.knownValueCount()).toBe(known);
  });

  it("PP-03 fails when the replay's refusal also carries a session, which is held and signed out", async () => {
    const credential = "fake-contradictory-replay-credential-0001";
    let exchanges = 0;
    const subject = await harness({
      suffix: "probes-replaysession",
      publicClientWrapper: wrapPublicClients({
        verifyOtp: async (real, params) => {
          const answer = (await real.verifyOtp(params)) as AuthAnswer;
          if (typeof params.token_hash === "string" && ++exchanges === 2) {
            return { data: { ...(answer.data ?? {}), session: fabricatedSession(credential) }, error: answer.error };
          }
          return answer;
        },
      }),
    });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.pp03]).toMatchObject({ outcome: "fail", sessionDelta: 2 });
    expect(subject.stack.logouts.filter((bearer) => bearer === credential)).toHaveLength(1);
  });

  it("PP-03 fails when its exchange answers with an error that also carries a session", async () => {
    let exchanges = 0;
    const subject = await harness({
      suffix: "probes-exchangeerror",
      publicClientWrapper: wrapPublicClients({
        verifyOtp: async (real, params) => {
          const answer = (await real.verifyOtp(params)) as AuthAnswer;
          if (typeof params.token_hash === "string" && ++exchanges === 1) {
            return { ...answer, error: { name: "AuthApiError", status: 400, code: "validation_failed" } };
          }
          return answer;
        },
      }),
    });
    await runAll(subject);
    const evidence = evidenceOf(subject);

    // The session is the fake's own: it belongs to the Explorer and the server knows it,
    // and the replay is refused; only the error makes the answer contradictory.
    expect(evidence[R.pp03]).toMatchObject({ outcome: "fail", sessionDelta: 1 });
    expect(subject.stack.logouts.length).toBeGreaterThan(0);
  });
});

describe("R8: findings of re-check #128c", () => {
  // The run-tagged users still in the fake after the run, and whether cleanup ever tried
  // to delete any of them.
  function leftovers(subject: Harness, suffix: string) {
    const left = [...subject.stack.users.values()].filter((user) => (user.email ?? "").includes(`p28-20261001-${suffix}`));
    return { count: left.length, deleteAttempted: left.some((user) => subject.stack.deleteAttempts.has(user.id)) };
  }

  it.each([
    [
      "a closed sign-up refused by policy (422 signup_disabled)",
      "probes-refusedlist",
      { signupRefusedButCreates: true, failListingAfterSignup: true },
      "signUp",
      "PP-04",
      "PP-06",
      // No user tracked, one unresolved.
      1,
    ],
    [
      "PP-09's confirmed user_not_found (404)",
      "probes-notfoundlist",
      { generateLinkRefusesButCreates: true, failListingAfterGenerateLink: true },
      "pp09",
      "PP-09",
      "PP-10",
      // No user tracked, one unresolved.
      1,
    ],
    [
      "PP-08's confirmed duplicate refusal (422 email_exists)",
      "probes-duprefusedlist",
      { duplicateRefusedButCreates: true, failListingAfterDuplicate: true },
      "pp08",
      "PP-08",
      "PP-09",
      // One user tracked (its id came back), one unresolved (the refused attempt).
      2,
    ],
  ] as const)(
    "%s that still created a user, followed by a failed listing, counts one unresolved user, stops every later effect and deletes nothing by a guess",
    async (_label, suffix, behaviour, recordName, step, nextStep, userDelta) => {
      const subject = await harness({ suffix, behaviour });
      const summaries = await runAll(subject);
      const evidence = evidenceOf(subject);

      // The record fails, and its user count is exactly the tracked users plus the one
      // unresolved user (value-free).
      expect(evidence[R[recordName]]).toMatchObject({ outcome: "fail", cleanupOutcome: "failed", userDelta });
      expect(summaries.find((summary) => summary.step === step)).toMatchObject({ code: "untracked-effect" });
      expect(summaries.find((summary) => summary.step === nextStep)).toMatchObject({ outcome: "blocked" });
      expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
      expect(evidence[R.pp12]).toMatchObject({ outcome: "fail", errorClass: "cleanup-failed" });
      // The refused-but-created user is still there, and nothing tried to delete it.
      expect(leftovers(subject, suffix)).toEqual({ count: 1, deleteAttempted: false });
    },
  );

  it("PP-08: the unresolved count is one per attempt without an id (value-free)", async () => {
    const subject = await harness({ suffix: "probes-duprefusedcount", behaviour: { duplicateRefusedButCreates: true, failListingAfterDuplicate: true } });
    await runAll(subject);

    // One tracked user (its id came back) plus one unresolved attempt.
    expect(evidenceOf(subject)[R.pp08]).toMatchObject({ outcome: "fail", userDelta: 2 });
  });

  it.each([
    ["an error that also carries a session", true],
    ["a clean send that also carries a session", false],
  ])(
    "the existing-account email send fails on %s, which is registered and signed out exactly once",
    async (_label, withError) => {
      const credential = withError ? "fake-contradictory-send-credential-0001" : "fake-contradictory-send-credential-0002";
      let sendsWithoutCreation = 0;
      const subject = await harness({
        suffix: "probes-sendsession",
        publicClientWrapper: wrapPublicClients({
          signInWithOtp: async (real, credentials) => {
            const answer = (await real.signInWithOtp(credentials)) as AuthAnswer;
            const options = credentials.options as { shouldCreateUser?: unknown } | undefined;
            // The second send without creation is the existing-account code send (the first
            // is the email code for a missing address).
            if (options?.shouldCreateUser === false && ++sendsWithoutCreation === 2) {
              return {
                data: { ...(answer.data ?? {}), session: fabricatedSession(credential) },
                error: withError ? { name: "AuthApiError", status: 422, code: "email_provider_disabled" } : answer.error,
              };
            }
            return answer;
          },
        }),
      });
      const summaries = await runAll(subject);
      const evidence = evidenceOf(subject);

      expect(evidence[R.existingCode]).toMatchObject({ outcome: "fail", sessionDelta: 1 });
      // Never "provider-denied": a refusal that carries a session is not confirmed.
      expect(evidence[R.existingCode]!.errorClass).not.toBe("provider-denied");
      expect(subject.stack.logouts.filter((bearer) => bearer === credential)).toHaveLength(1);
      const known = subject.run.knownValueCount();
      subject.run.registerKnownValue(credential);
      subject.run.registerKnownValue(`${credential}-renewal`);
      expect(subject.run.knownValueCount()).toBe(known);
      // Positive control: the link sign-in that follows still passes, and cleanup completes.
      expect(evidence[R.existingLink]).toMatchObject({ outcome: "pass" });
      expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "pass" });
    },
  );
});

describe("R9: finding of re-check #128d (settlement is delivered before the answer is processed)", () => {
  function leftoverUsers(subject: Harness, suffix: string) {
    const left = [...subject.stack.users.values()].filter((user) => (user.email ?? "").includes(`p28-20261001-${suffix}`));
    return { count: left.length, deleteAttempted: left.some((user) => subject.stack.deleteAttempts.has(user.id)) };
  }

  // Runs every step, filling the run's known-value registry just before `target` so that
  // only one place is left: the target step's own minted address. Any further registration
  // in that step (a returned or listed user id) then throws.
  async function runWithFullRegistryBefore(subject: Harness, target: (typeof PROVIDER_PROBE_STEPS)[number]) {
    const summaries: ProviderProbeStepSummary[] = [];
    for (const step of PROVIDER_PROBE_STEPS) {
      if (step === target) {
        const room = PROVIDER_PROBE_OUTPUT_LIMITS.maxKnownValues - subject.run.knownValueCount();
        for (let index = 0; index < room - 1; index += 1) {
          subject.run.registerKnownValue(`fake-filler-known-value-${index}`);
        }
        expect(subject.run.knownValueCount()).toBe(PROVIDER_PROBE_OUTPUT_LIMITS.maxKnownValues - 1);
      }
      summaries.push(await subject.suite.runStep(step));
    }
    return summaries;
  }

  it("a closed sign-up refused yet created, with a failed listing, keeps its unresolved count when the answer's session is malformed", async () => {
    // The answer also carries a malformed session, so holding it throws after settlement.
    const subject = await harness({
      suffix: "probes-sessionthrow",
      behaviour: { signupRefusedButCreates: true, failListingAfterSignup: true },
      publicClientWrapper: wrapPublicClients({
        signUp: async (real, credentials) => {
          const answer = (await real.signUp(credentials)) as AuthAnswer;
          const malformed = { ...fabricatedSession("fake-malformed-session-0001"), access_token: "short" };
          return { data: { ...(answer.data ?? {}), session: malformed }, error: answer.error };
        },
      }),
    });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    // The record fails (the malformed session), and counts exactly the one unresolved user.
    expect(evidence[R.signUp]).toMatchObject({ outcome: "fail", userDelta: 1, sessionDelta: 0, cleanupOutcome: "failed" });
    expect(summaries.find((summary) => summary.step === "PP-04")).toMatchObject({ code: "untracked-effect" });
    expect(summaries.find((summary) => summary.step === "PP-06")).toMatchObject({ outcome: "blocked" });
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    expect(evidence[R.pp12]).toMatchObject({ outcome: "fail", errorClass: "cleanup-failed" });
    expect(leftoverUsers(subject, "probes-sessionthrow")).toEqual({ count: 1, deleteAttempted: false });
  });

  it("PP-09's link created without an id, with a failed listing, keeps its unresolved count when a property cannot be registered", async () => {
    const subject = await harness({
      suffix: "probes-propertythrow",
      behaviour: { generateLinkOversizedWithoutId: true, failListingAfterGenerateLink: true },
    });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    expect(evidence[R.pp09]).toMatchObject({ outcome: "fail", userDelta: 1, cleanupOutcome: "failed" });
    expect(summaries.find((summary) => summary.step === "PP-09")).toMatchObject({ code: "untracked-effect" });
    expect(summaries.find((summary) => summary.step === "PP-10")).toMatchObject({ outcome: "blocked" });
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    expect(evidence[R.pp12]).toMatchObject({ outcome: "fail", errorClass: "cleanup-failed" });
    expect(leftoverUsers(subject, "probes-propertythrow")).toEqual({ count: 1, deleteAttempted: false });
  });

  it("PP-08 keeps its unresolved count when registering the returned id throws (a full registry)", async () => {
    // One create returns its id; the other is refused as a duplicate yet creates a user;
    // the listing fails; and the registry has no place left for the returned id.
    const subject = await harness({
      suffix: "probes-dupfullregistry",
      behaviour: { duplicateRefusedButCreates: true, failListingAfterDuplicate: true },
    });
    const summaries = await runWithFullRegistryBefore(subject, "PP-08");
    const evidence = evidenceOf(subject);

    // One user tracked (its receipt was committed before the registration threw), plus one
    // unresolved.
    expect(evidence[R.pp08]).toMatchObject({ outcome: "fail", userDelta: 2, cleanupOutcome: "failed" });
    expect(summaries.find((summary) => summary.step === "PP-08")).toMatchObject({ code: "untracked-effect" });
    expect(summaries.find((summary) => summary.step === "PP-09")).toMatchObject({ outcome: "blocked" });
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    // The tracked user is deleted; the refused-but-created one is left, never deleted by a guess.
    expect(leftoverUsers(subject, "probes-dupfullregistry")).toEqual({ count: 1, deleteAttempted: false });
  });

  it("settlement commits every user it found before registering any id: a full registry fails PP-09 but strands no user", async () => {
    // The link answers without an id after creating two users; the listing finds both; the
    // registry has no place left for their ids.
    const subject = await harness({ suffix: "probes-twofullregistry", behaviour: { generateLinkCreatesTwoWithoutId: true } });
    const summaries = await runWithFullRegistryBefore(subject, "PP-09");
    const evidence = evidenceOf(subject);

    expect(evidence[R.pp09]).toMatchObject({ outcome: "fail", userDelta: 2, cleanupOutcome: "complete" });
    expect(summaries.find((summary) => summary.step === "PP-09")).toMatchObject({ code: "unexpected-error" });
    // Both users were committed, so cleanup deleted both: nothing is left, and no stop for Paul.
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "pass", stoppedForPaul: false });
    expect(leftoverUsers(subject, "probes-twofullregistry").count).toBe(0);
  });
});

describe("R10: finding of re-check #128e (the admin core carries its unresolved count, not a fixed one)", () => {
  it("a lost admin creation answer with three users at its address and one ledger place left counts exactly the two it cannot track", async () => {
    // Nine users are created first through the run's own admin (their receipts in the run's
    // ledger), so PP-01's reservation takes the last of the ledger's ten places. PP-01's
    // creation (the tenth admin creation) then makes three users at its address and its
    // answer is lost: the locator finds all three, one gets the receipt, two cannot.
    const suffix = "probes-threeids";
    const subject = await harness({ suffix, behaviour: { loseAdminCreateAnswerAt: 10, lostCreateUsers: 3 } });
    const summaries = [await subject.suite.runStep("PP-00")];
    const filler = subject.run.createAuthAdmin(SERVICE_KEY);
    for (let index = 0; index < 9; index += 1) {
      await filler.createRunTaggedUser();
    }
    expect(subject.run.cleanupCounts().authUsers).toBe(9);
    for (const step of PROVIDER_PROBE_STEPS.slice(1)) {
      summaries.push(await subject.suite.runStep(step));
    }
    const evidence = evidenceOf(subject);

    // Exactly one tracked plus two unresolved: the record's user delta is three.
    expect(evidence[R.pp01]).toMatchObject({ outcome: "fail", userDelta: 3, cleanupOutcome: "failed" });
    expect(summaries.find((summary) => summary.step === "PP-01")).toMatchObject({ code: "untracked-effect" });
    for (const step of ["PP-02", "PP-03", "PP-04", "PP-06", "PP-07", "PP-08", "PP-09", "PP-10", "PP-06-rate"]) {
      expect(summaries.find((summary) => summary.step === step)).toMatchObject({ outcome: "blocked" });
    }
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    expect(evidence[evidence.length - 1]).toMatchObject({ probeId: "PP-12", outcome: "fail", errorClass: "cleanup-failed" });
    // The nine and the one with a receipt are deleted by their ids; the two without receipts
    // are left, and nothing tried to delete them.
    const left = [...subject.stack.users.values()].filter((user) => (user.email ?? "").includes(`p28-20261001-${suffix}`));
    expect(left).toHaveLength(2);
    expect(left.some((user) => subject.stack.deleteAttempts.has(user.id))).toBe(false);
  });
});

describe("R11: finding 1 of re-check #128f (a known count above the evidence maximum is never silently recorded as the maximum)", () => {
  // Nine users are created first through the run's own admin, so PP-01's reservation takes
  // the last of the ledger's ten places. PP-01's creation (the tenth admin creation) then
  // makes `users` users at its address and its answer is lost: one gets the receipt, the
  // rest cannot be tracked.
  async function lostCreationWith(users: number, suffix: string) {
    const subject = await harness({ suffix, behaviour: { loseAdminCreateAnswerAt: 10, lostCreateUsers: users } });
    const summaries = [await subject.suite.runStep("PP-00")];
    const filler = subject.run.createAuthAdmin(SERVICE_KEY);
    for (let index = 0; index < 9; index += 1) {
      await filler.createRunTaggedUser();
    }
    expect(subject.run.cleanupCounts().authUsers).toBe(9);
    for (const step of PROVIDER_PROBE_STEPS.slice(1)) {
      summaries.push(await subject.suite.runStep(step));
    }
    const left = [...subject.stack.users.values()].filter((user) => (user.email ?? "").includes(`p28-20261001-${suffix}`));
    return { subject, summaries, document: evidenceDocument(subject), left };
  }

  it("eleven users with one ledger place left: the record holds 10, the envelope says more than 10, and the run stops for Paul", async () => {
    const { subject, summaries, document, left } = await lostCreationWith(11, "probes-elevenids");
    const { envelope, evidence } = document;

    // One tracked plus ten unresolved is eleven: the kernel's record holds at most 10, so
    // the record says 10 and the envelope names it as more than 10.
    expect(evidence[R.pp01]).toMatchObject({ probeId: "PP-01", outcome: "fail", userDelta: 10, cleanupOutcome: "failed" });
    expect(envelope.countsBeyondEvidenceBounds).toEqual([
      { record: R.pp01, probeId: "PP-01", field: "userDelta", relation: "more-than", limit: 10 },
    ]);
    for (const record of evidence) {
      expect(() => createProviderProbeEvidence({ ...record })).not.toThrow();
    }
    // Every later effect is blocked, as before; PP-11 and the evidence step stop for Paul.
    expect(summaries.find((summary) => summary.step === "PP-01")).toMatchObject({ code: "untracked-effect" });
    for (const step of ["PP-02", "PP-03", "PP-04", "PP-06", "PP-07", "PP-08", "PP-09", "PP-10", "PP-06-rate"]) {
      expect(summaries.find((summary) => summary.step === step)).toMatchObject({ outcome: "blocked" });
    }
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    expect(summaries.find((summary) => summary.step === "evidence")).toMatchObject({
      outcome: "written",
      stoppedForPaul: true,
      code: "count-beyond-evidence-bounds",
    });
    expect(evidence[evidence.length - 1]).toMatchObject({ probeId: "PP-12", outcome: "fail", errorClass: "cleanup-failed" });
    // The nine and the one with a receipt are deleted by their ids; the ten without receipts
    // are left, and nothing tried to delete any of them (no guessed id).
    expect(left).toHaveLength(10);
    expect(left.some((user) => subject.stack.deleteAttempts.has(user.id))).toBe(false);
  });

  it("ten users with one ledger place left: the exact count of 10 is recorded as 10, with no marker", async () => {
    const { subject, summaries, document, left } = await lostCreationWith(10, "probes-tenids");
    const { envelope, evidence } = document;

    expect(evidence[R.pp01]).toMatchObject({ probeId: "PP-01", outcome: "fail", userDelta: 10, cleanupOutcome: "failed" });
    expect(envelope.countsBeyondEvidenceBounds).toEqual([]);
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    expect(summaries.find((summary) => summary.step === "evidence")).toMatchObject({
      outcome: "written",
      stoppedForPaul: true,
      code: "untracked-effect",
    });
    expect(left).toHaveLength(9);
    expect(left.some((user) => subject.stack.deleteAttempts.has(user.id))).toBe(false);
  });

  it("mirrors the kernel's own count bounds: each maximum is accepted, one more and one below zero are refused", () => {
    const base = {
      probeId: "PP-03",
      profile: "current-config",
      outcome: "fail",
      errorClass: "cleanup-failed",
      userDelta: 0,
      sessionDelta: 0,
      messageDelta: 0,
      requestCount: 0,
      identityMatched: null,
      cookieWriteCount: 0,
      providerLifetimeSeconds: null,
      cleanupOutcome: "failed",
      sensitiveMaterialScanPassed: true,
    } as const;

    expect(Object.keys(PROVIDER_PROBE_EVIDENCE_BOUNDS).sort()).toEqual(["messageDelta", "requestCount", "sessionDelta", "userDelta"]);
    for (const [field, maximum] of Object.entries(PROVIDER_PROBE_EVIDENCE_BOUNDS)) {
      expect(() => createProviderProbeEvidence({ ...base, [field]: maximum })).not.toThrow();
      expect(() => createProviderProbeEvidence({ ...base, [field]: maximum + 1 })).toThrow("provider_probe_evidence_invalid_value");
      expect(() => createProviderProbeEvidence({ ...base, [field]: -1 })).toThrow("provider_probe_evidence_invalid_value");
    }
  });

  const PENDING = {
    probeId: "PP-03",
    outcome: "pass",
    errorClass: "none",
    userDelta: 1,
    sessionDelta: 1,
    messageDelta: 0,
    requestCount: 3,
    identityMatched: true,
    providerLifetimeSeconds: null,
  } as const;
  type Sink = NonNullable<Parameters<typeof finalizeProviderProbeRecord>[2]>;

  it("finalizes each count at its maximum unchanged, and throws for a count beyond it when there is nowhere to name it", () => {
    for (const [field, maximum] of Object.entries(PROVIDER_PROBE_EVIDENCE_BOUNDS)) {
      const sink: Sink = [];
      const atMaximum = finalizeProviderProbeRecord({ ...PENDING, [field]: maximum }, "complete", sink);
      expect(atMaximum[field]).toBe(maximum);
      expect(sink).toEqual([]);
      expect(() => finalizeProviderProbeRecord({ ...PENDING, [field]: maximum + 1 }, "complete")).toThrow(
        "provider_probe_count_beyond_evidence_bounds",
      );
    }
    expect(() => finalizeProviderProbeRecord({ ...PENDING, userDelta: Number.NaN }, "complete", [])).toThrow(
      "provider_probe_count_invalid",
    );
  });

  it("names a count above the maximum or below zero, writes the bound, and never lets that record pass", () => {
    const sink: Sink = [];
    const above = finalizeProviderProbeRecord(
      { ...PENDING, probeId: "PP-11", userDelta: 0, sessionDelta: 0, requestCount: 101 },
      "complete",
      sink,
    );
    expect(above).toMatchObject({ outcome: "fail", errorClass: "unexpected", requestCount: 100 });
    expect(() => createProviderProbeEvidence(above)).not.toThrow();

    const below = finalizeProviderProbeRecord({ ...PENDING, messageDelta: -1 }, "complete", sink);
    expect(below).toMatchObject({ outcome: "fail", errorClass: "unexpected", messageDelta: 0 });
    expect(() => createProviderProbeEvidence(below)).not.toThrow();

    expect(sink).toEqual([
      { field: "requestCount", relation: "more-than", limit: 100 },
      { field: "messageDelta", relation: "less-than", limit: 0 },
    ]);
  });

  it("writes a blocked record that somehow carries an effect as failed, with its counts, not zeroed", () => {
    const blockedWithEffect = {
      ...PENDING,
      outcome: "blocked",
      errorClass: "invalid-request",
      identityMatched: null,
      userDelta: 2,
      sessionDelta: 0,
    } as const;
    const afterCleanup = finalizeProviderProbeRecord(blockedWithEffect, "complete", []);
    const withoutCleanup = finalizeProviderProbeRecord(blockedWithEffect, "not-run", []);

    expect(afterCleanup).toMatchObject({ outcome: "fail", errorClass: "unexpected", userDelta: 2, cleanupOutcome: "complete" });
    expect(withoutCleanup).toMatchObject({ outcome: "fail", errorClass: "unexpected", userDelta: 2, cleanupOutcome: "not-attempted" });
    expect(() => createProviderProbeEvidence(afterCleanup)).not.toThrow();
    expect(() => createProviderProbeEvidence(withoutCleanup)).not.toThrow();
  });
});

describe("R12: findings of re-check #128g", () => {
  const explorerAddress = (subject: Harness) => subject.stack.users.get(subject.stack.firstAdminCreatedId()!)!.email!;

  // Late messages to the Explorer's own (run-owned) address, made visible just before PP-11:
  // PP-11's late-mail read tracks every one, and its cleanup deletes each by its id, one
  // request apiece. This many bring PP-11 to exactly 101 requests in this fake.
  const LATE_MESSAGES = 86;

  it("finding 1: PP-11 with 101 requests and completed cleanup fails for its requests, not as failed cleanup", async () => {
    const suffix = "probes-pp11-101";
    const subject = await harness({ suffix });
    const summaries: ProviderProbeStepSummary[] = [];
    let pp11Requests = 0;
    for (const step of PROVIDER_PROBE_STEPS) {
      const before = subject.stack.requests.length;
      if (step === "PP-11") {
        const address = explorerAddress(subject);
        for (let index = 1; index <= LATE_MESSAGES; index += 1) {
          subject.stack.messages.push({
            id: `fakeLate${String(index).padStart(6, "0")}`,
            to: address,
            text: "A late message for the cleanup request test.\n",
            visibleAt: subject.stack.clock(),
          });
        }
      }
      summaries.push(await subject.suite.runStep(step));
      if (step === "PP-11") {
        pp11Requests = subject.stack.requests.length - before;
      }
    }
    const { envelope, evidence } = evidenceDocument(subject);

    expect(pp11Requests).toBe(101);
    // PP-11's requests are named beyond the bound; its record fails for that alone, and its
    // cleanup field says what cleanup achieved: complete.
    expect(envelope.countsBeyondEvidenceBounds).toEqual([
      { record: R.pp11, probeId: "PP-11", field: "requestCount", relation: "more-than", limit: 100 },
    ]);
    expect(evidence[R.pp11]).toMatchObject({ probeId: "PP-11", outcome: "fail", errorClass: "unexpected", requestCount: 100, cleanupOutcome: "complete" });
    expect(evidence[R.pp12]).toMatchObject({ probeId: "PP-12", outcome: "pass", errorClass: "none", cleanupOutcome: "complete" });
    for (const record of evidence) {
      expect(() => createProviderProbeEvidence({ ...record })).not.toThrow();
    }
    expect(subject.stack.runTaggedUsers()).toBe(0);
    expect(subject.stack.runTaggedMessages()).toBe(0);
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: false });
    expect(summaries.find((summary) => summary.step === "PP-12")).toMatchObject({ outcome: "pass", stoppedForPaul: false });
    // With cleanup complete, the marker alone stops the run for Paul.
    expect(summaries.find((summary) => summary.step === "evidence")).toMatchObject({
      outcome: "written",
      stoppedForPaul: true,
      code: "count-beyond-evidence-bounds",
    });
  });

  it("finding 2: the written failed-record count includes a record that was pending as a pass but carries a marker", async () => {
    // More than 100 run-tagged messages to an address the run did not mint appear while the
    // existing-account code sign-in captures its message: that sub-check still passes on
    // its own terms (one owned message, a clean sign-in), but its message count is above
    // 100, so its record carries a marker and is written as failed. The strays are gone
    // again before cleanup, so cleanup completes.
    const suffix = "probes-strays";
    const subject = await harness({ suffix });
    const strayAddress = `p28-20261001-${suffix}-stray@synthetic.invalid`;
    let injected = false;
    subject.stack.onRequest(() => {
      if (injected || subject.stack.firstAdminCreatedId() === null) {
        return;
      }
      const address = explorerAddress(subject);
      if (subject.stack.messages.some((message) => message.to === address)) {
        injected = true;
        for (let index = 1; index <= 101; index += 1) {
          subject.stack.messages.push({
            id: `fakeStray${String(index).padStart(6, "0")}`,
            to: strayAddress,
            text: "A stray run-tagged message the run did not cause.\n",
            visibleAt: subject.stack.clock(),
          });
        }
      }
    });
    const summaries: ProviderProbeStepSummary[] = [];
    for (const step of PROVIDER_PROBE_STEPS) {
      summaries.push(await subject.suite.runStep(step));
      if (step === "PP-04") {
        for (let index = subject.stack.messages.length - 1; index >= 0; index -= 1) {
          if (subject.stack.messages[index]!.to === strayAddress) {
            subject.stack.messages.splice(index, 1);
          }
        }
      }
    }
    const { envelope, evidence } = evidenceDocument(subject);

    expect(injected).toBe(true);
    expect(envelope.countsBeyondEvidenceBounds).toEqual([
      { record: R.existingCode, probeId: "PP-04", field: "messageDelta", relation: "more-than", limit: 100 },
    ]);
    expect(evidence[R.existingCode]).toMatchObject({ outcome: "fail", errorClass: "unexpected", messageDelta: 100, cleanupOutcome: "complete" });
    // The only record that is neither passing nor blocked is the marked one.
    expect(evidence.filter((record) => record.outcome === "fail").map((record) => record.probeId)).toEqual(["PP-04"]);
    expect(evidence[R.pp11]).toMatchObject({ outcome: "pass", cleanupOutcome: "complete" });
    expect(evidence[R.pp12]).toMatchObject({ outcome: "pass", cleanupOutcome: "complete" });
    expect(summaries.find((summary) => summary.step === "evidence")).toMatchObject({
      outcome: "written",
      stoppedForPaul: true,
      code: "count-beyond-evidence-bounds",
      failedRecords: evidence.filter((record) => record.outcome !== "pass").length,
    });
  });
});

describe("request allowances and deadlines (R6)", () => {
  it("derives every step's timeout and the safety net's from enforced or structural worst cases", () => {
    const requestTimeout = PROVIDER_PROBE_TRANSPORT_LIMITS.timeoutMilliseconds;
    const observerBound = 2 * PROVIDER_PROBE_STACK_OBSERVER_LIMITS.timeoutMilliseconds;
    for (const step of PROVIDER_PROBE_STEPS) {
      expect(providerProbeStepTimeoutMilliseconds(step)).toBe(
        providerProbeStepWaitBudgetMilliseconds(step) +
          providerProbeStepRequestBound(step) * requestTimeout +
          (step === "PP-00" ? observerBound : 0) +
          10_000,
      );
    }
    expect(providerProbeStepRequestBound("PP-04")).toBe(6 * 100);
    expect(providerProbeStepRequestBound("PP-06")).toBe(2 * 100);
    expect(providerProbeStepRequestBound("evidence")).toBe(0);
    // Cleanup: every held session signed out, one late-mail read, three rounds over everything the ledger can hold.
    expect(providerProbeStepRequestBound("PP-11")).toBe(
      PROVIDER_PROBE_AUTH_LIMITS.maxOpenSessions +
        MAILPIT_MAX_INVENTORY_PASSES * MAILPIT_MAX_PAGES +
        PROVIDER_PROBE_CLEANUP_LIMITS.maxCleanupRounds *
          (PROVIDER_PROBE_CLEANUP_LIMITS.maxAuthUsers + PROVIDER_PROBE_CLEANUP_LIMITS.maxMailpitMessages),
    );
    expect(PROVIDER_PROBE_FINISH_TIMEOUT_MILLISECONDS).toBe(
      Math.max(...PROVIDER_PROBE_STEPS.map(providerProbeStepTimeoutMilliseconds)) +
        providerProbeStepTimeoutMilliseconds("PP-11") +
        providerProbeStepTimeoutMilliseconds("PP-12") +
        providerProbeStepTimeoutMilliseconds("evidence"),
    );
  });

  it("mirrors exactly the limits it does not import, and plans within the enforced capacities", () => {
    expect(PROVIDER_PROBE_MIRRORED_LIMITS).toEqual({
      maxAuthUsers: PROVIDER_PROBE_CLEANUP_LIMITS.maxAuthUsers,
      maxMailpitMessages: PROVIDER_PROBE_CLEANUP_LIMITS.maxMailpitMessages,
      maxCleanupRounds: PROVIDER_PROBE_CLEANUP_LIMITS.maxCleanupRounds,
      mailInventoryPasses: MAILPIT_MAX_INVENTORY_PASSES,
      mailInventoryPages: MAILPIT_MAX_PAGES,
      observerCommandTimeoutMilliseconds: PROVIDER_PROBE_STACK_OBSERVER_LIMITS.timeoutMilliseconds,
    });
    const { users, sessions, messages } = PROVIDER_PROBE_SUITE_LIMITS.plan;
    expect([users.capacity, sessions.capacity, messages.capacity]).toEqual([
      PROVIDER_PROBE_CLEANUP_LIMITS.maxAuthUsers,
      PROVIDER_PROBE_AUTH_LIMITS.maxOpenSessions,
      PROVIDER_PROBE_CLEANUP_LIMITS.maxMailpitMessages,
    ]);
    // The planned message maximum is kept apart from the enforced capacity.
    expect(messages.plannedMax).toBeLessThan(messages.capacity);
  });

  it("a record that exhausts its allowance fails, and the safety net's cleanup still deletes everything", async () => {
    // 450 unrelated messages make every mailbox read 18 requests; the second
    // existing-account message stays hidden for 3 simulated seconds, so the link check
    // keeps polling until its 101st request is refused. The safety net then runs cleanup
    // straight after PP-04, with no other record's allowance in between.
    const subject = await harness({ suffix: "probes-allowance", behaviour: { seedMessages: 450, delayLinkMailMilliseconds: 3_000 } });
    for (const step of PROVIDER_PROBE_STEPS.slice(0, PROVIDER_PROBE_STEPS.indexOf("PP-04") + 1)) {
      await subject.suite.runStep(step);
    }
    await subject.suite.finish();
    const evidence = evidenceOf(subject);

    expect(evidence[R.existingCode]).toMatchObject({ outcome: "pass" });
    expect(evidence[R.existingLink]).toMatchObject({ outcome: "fail", requestCount: PROVIDER_PROBE_SUITE_LIMITS.recordRequestAllowance });
    expect(evidence[evidence.length - 2]).toMatchObject({ probeId: "PP-11", outcome: "pass", cleanupOutcome: "complete" });
    expect(evidence[evidence.length - 1]).toMatchObject({ probeId: "PP-12", outcome: "pass" });
    expect(subject.stack.runTaggedUsers()).toBe(0);
    expect(subject.stack.runTaggedMessages()).toBe(0);
    expect(subject.stack.messages.length).toBe(450);
  });
});

describe("cleanup: three tries, then stop for Paul", () => {
  it("tries a user that cannot be deleted exactly three times, stops, and still writes coherent evidence", async () => {
    // The Explorer fixture (the first user the admin API creates) cannot be deleted.
    const subject = await harness({ suffix: "probes-stuck", behaviour: { failDeletesOfFirstAdminCreatedUser: true } });
    const summaries = await runAll(subject);
    const evidence = evidenceOf(subject);

    const stuck = [...subject.stack.users.values()].find((user) => (user.email ?? "").includes("probes-stuck"));
    expect(stuck).toBeDefined();
    expect(subject.stack.runTaggedUsers()).toBe(1);
    expect(subject.stack.deleteAttempts.get(stuck!.id)).toBe(3);
    expect(summaries.find((summary) => summary.step === "PP-11")).toMatchObject({ outcome: "fail", stoppedForPaul: true });
    expect(evidence[R.pp11]).toMatchObject({ outcome: "fail", errorClass: "cleanup-failed", cleanupOutcome: "failed" });
    expect(evidence[R.pp12]).toMatchObject({ outcome: "fail", cleanupOutcome: "failed" });
    // Every record that reflects an effect says cleanup failed; none claims otherwise.
    for (const record of evidence) {
      expect(() => createProviderProbeEvidence({ ...record })).not.toThrow();
      if (record.userDelta + record.sessionDelta + record.messageDelta > 0) {
        expect(record).toMatchObject({ outcome: "fail", errorClass: "cleanup-failed", cleanupOutcome: "failed" });
      }
    }
  });

  it("finishes from the safety net: unreached steps are blocked, and cleanup and the evidence still happen", async () => {
    const subject = await harness({ suffix: "probes-finish" });
    for (const step of PROVIDER_PROBE_STEPS.slice(0, 4)) {
      await subject.suite.runStep(step);
    }
    await subject.suite.finish();
    const evidence = evidenceOf(subject);

    expect(evidence.filter((record) => record.outcome === "blocked").length).toBeGreaterThan(0);
    expect(evidence[evidence.length - 1]).toMatchObject({ probeId: "PP-12", outcome: "pass" });
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });

  it("refuses steps out of order", async () => {
    const subject = await harness({ suffix: "probes-order" });

    await expect(subject.suite.runStep("PP-01")).rejects.toThrow("provider_probe_step_out_of_order");
  });

  it("runs steps one at a time: a later step and the safety net wait until the current step settles", async () => {
    let holding = false;
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const subject = await harness({
      suffix: "probes-serial",
      waitHook: async () => {
        if (holding) {
          await held;
        }
      },
    });
    await subject.suite.runStep("PP-00");
    await subject.suite.runStep("PP-01");
    holding = true;
    const settled: string[] = [];
    // PP-02 now stops inside its mail-settle wait until the test releases it.
    const pp02 = subject.suite.runStep("PP-02").then(() => settled.push("PP-02"));
    const pp03 = subject.suite.runStep("PP-03").then(() => settled.push("PP-03"));
    const finished = subject.suite.finish().then(() => settled.push("finish"));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(settled).toEqual([]);
    expect(subject.stack.requests.filter((entry) => entry.method === "DELETE")).toEqual([]);

    holding = false;
    release();
    await Promise.all([pp02, pp03, finished]);

    expect(settled).toEqual(["PP-02", "PP-03", "finish"]);
    expect(evidenceOf(subject)[R.pp03]).toMatchObject({ outcome: "pass" });
    expect(subject.stack.runTaggedUsers()).toBe(0);
  });
});

describe("pure parts", () => {
  it.each([
    [null, "none"],
    [{ status: 429, code: "over_request_rate_limit" }, "rate-limited"],
    [{ status: 422, code: "signup_disabled" }, "refused"],
    [{ status: 422, code: "otp_disabled" }, "refused"],
    [{ status: 400, code: "invalid_credentials" }, "invalid-credentials"],
    [{ status: 403, code: "otp_expired" }, "expired-or-invalid"],
    [{ status: 422, code: "email_exists" }, "duplicate"],
    [{ status: 400, code: "validation_failed" }, "validation"],
    [{ status: 0 }, "transport"],
    // R7: the status decides first; a code never turns a transport failure or a server error into a refusal.
    [{ status: 0, code: "signup_disabled" }, "transport"],
    [{ status: 500, code: "signup_disabled" }, "unexpected"],
    [{ status: 404, code: "signup_disabled" }, "unexpected"],
    [{ status: 401, code: "otp_disabled" }, "unexpected"],
    [{ status: 500, code: "unexpected_failure" }, "unexpected"],
    // R6: a 403 or 422 without a policy-refusal code is not a confirmed refusal.
    [{ status: 403 }, "unexpected"],
    [{ status: 422, code: "some_other_code" }, "unexpected"],
  ])("classifies %j as %s", (error, kind) => {
    expect(classifyAuthError(error)).toBe(kind);
  });

  it("R7: confirms a refusal only with a refusal status and a code of the surface attempted", () => {
    const surfaces = Object.keys(PROVIDER_PROBE_REFUSALS) as ProviderProbeRefusalSurface[];
    expect(surfaces.sort()).toEqual(
      ["duplicate-create", "email-code-missing-address", "email-code-sign-up", "email-sign-up", "existing-account-send", "link-replay", "missing-user-link"].sort(),
    );
    for (const surface of surfaces) {
      const rule = PROVIDER_PROBE_REFUSALS[surface];
      for (const status of rule.statuses) {
        for (const code of rule.codes) {
          expect(providerProbeIsConfirmedRefusal({ status, code }, surface)).toBe(true);
        }
      }
      const code = rule.codes[0]!;
      for (const status of [0, 200, 401, 429, 500, 503, 422.5, Number.NaN]) {
        if (!rule.statuses.includes(status)) {
          expect(providerProbeIsConfirmedRefusal({ status, code }, surface)).toBe(false);
        }
      }
      expect(providerProbeIsConfirmedRefusal({ status: String(rule.statuses[0]), code }, surface)).toBe(false);
      expect(providerProbeIsConfirmedRefusal({ status: rule.statuses[0] }, surface)).toBe(false);
      expect(providerProbeIsConfirmedRefusal(null, surface)).toBe(false);
      // A code that only another surface refuses with is not a refusal here.
      for (const other of surfaces) {
        for (const foreign of PROVIDER_PROBE_REFUSALS[other].codes.filter((entry) => !rule.codes.includes(entry))) {
          expect(providerProbeIsConfirmedRefusal({ status: rule.statuses[0], code: foreign }, surface)).toBe(false);
        }
      }
    }
    expect(providerProbeIsConfirmedRefusal({ status: 422, code: "otp_disabled" }, "email-sign-up")).toBe(false);
    expect(providerProbeIsConfirmedRefusal({ status: 400, code: "validation_failed" }, "email-sign-up")).toBe(false);
  });

  it("extracts exactly one code and one link token, and never a digit run inside the link", () => {
    const registered: string[] = [];
    const text =
      "Follow this link: http://127.0.0.1:54321/auth/v1/verify?token=abc123456def&amp;type=magiclink\nAlternatively, enter the code: 482913\n";

    expect(extractMailCredentials(text, (value) => registered.push(value))).toEqual({ code: "482913", tokenHash: "abc123456def" });
    expect(registered).toContain("abc123456def");
    expect(extractMailCredentials("codes 111111 and 222222", () => undefined)).toEqual({ code: null, tokenHash: null });
    expect(extractMailCredentials("no credential here", () => undefined)).toEqual({ code: null, tokenHash: null });
  });

  it("reads single settings from config.toml text and refuses ambiguity", () => {
    const text = 'project_id = "solmind-app"\n[auth]\n# jwt_expiry = 1\njwt_expiry = 3600\n[auth.email]\njwt_expiry = 9\n';

    expect(readTomlSetting(text, null, "project_id")).toBe('"solmind-app"');
    expect(readTomlSetting(text, "auth", "jwt_expiry")).toBe("3600");
    expect(readTomlSetting(`${text}[auth]\njwt_expiry = 7\n`, "auth", "jwt_expiry")).toBeNull();
    expect(readTomlSetting(text, "auth", "missing")).toBeNull();
  });

  it("computes the usable session length as min(measured, configured) minus the margin", () => {
    const session = { expiresIn: 3600, expiresAt: 10_000 + 3600, jwtExp: 10_000 + 3600, jwtIat: 10_000, receivedAtSeconds: 10_000 };

    expect(computeUsableSessionSeconds([session], 3600, 60)).toEqual({ consistent: true, measuredSeconds: 3600, usableSeconds: 3540 });
    expect(computeUsableSessionSeconds([session], 1800, 60).usableSeconds).toBe(1740);
    expect(computeUsableSessionSeconds([{ ...session, expiresAt: session.expiresAt + 30 }], 3600, 60).consistent).toBe(false);
    expect(computeUsableSessionSeconds([], 3600, 60)).toEqual({ consistent: false, measuredSeconds: null, usableSeconds: null });
  });

  it.each([
    ["pass", "none"],
    ["fail", "identity-mismatch"],
    ["blocked", "invalid-request"],
  ] as const)("finalizes a %s record into kernel-valid evidence under every cleanup state", (outcome, errorClass) => {
    for (const cleanup of ["not-run", "complete", "failed"] as const) {
      for (const effect of [0, 1]) {
        const record = finalizeProviderProbeRecord(
          {
            probeId: "PP-03",
            outcome,
            errorClass,
            userDelta: effect,
            sessionDelta: effect,
            messageDelta: 0,
            requestCount: 3,
            identityMatched: outcome === "blocked" ? null : true,
            providerLifetimeSeconds: null,
          },
          cleanup,
        );
        expect(() => createProviderProbeEvidence(record)).not.toThrow();
      }
    }
  });
});
