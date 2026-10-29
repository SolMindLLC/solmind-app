// PREPARED, NOT RUN. Actual banked request-auth composer with synthetic ports.
// No real Supabase principal, credential, provider or database is exercised here.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolMindAuthSource } from "../../auth/authSource";
import type { SupabaseAuthenticatedUser, DeriveTrustedServerAuthContextInput } from "../../auth/serverAuthContext";
import type { SolMindRequestAuthPrincipalSource } from "../../auth/requestAuthPrincipalSource";
import type { RequestCookieAccessor } from "../../auth/requestCookieAccessor";

const mocks = vi.hoisted(() => ({ principal: vi.fn(), client: vi.fn(), rpc: vi.fn(), query: vi.fn(), source: vi.fn(), repository: vi.fn(), privateRepository: vi.fn(), profile: vi.fn() }));
vi.mock("../requestAuthClient", () => ({ createSupabaseRequestAuthPrincipalSource: mocks.principal }));
vi.mock("../serviceRoleClient", () => ({ createServiceRoleClient: mocks.client }));
vi.mock("../serviceRoleRpcExecutor", () => ({ createServiceRoleRpcExecutor: mocks.rpc }));
vi.mock("../supabaseAuthQueryClient", () => ({ createSupabaseAuthQueryClient: mocks.query }));
vi.mock("../serverAuthSourceAdapter", () => ({ createSupabaseAuthSource: mocks.source }));
vi.mock("../explorerConversationRepository", () => ({ createExplorerConversationRepository: mocks.repository }));
vi.mock("../explorerPrivateConversationRepository", () => ({ createExplorerPrivateConversationRepository: mocks.privateRepository }));
vi.mock("../../operations/explorerPrivateLocalRunProfile", () => ({ loadExplorerPrivateLocalRun: mocks.profile }));
import { createExplorerPrivateLocalRequestDependencies, createExplorerPrivateConversationRequestDependencies, createExplorerConversationRequestDependencies, readExplorerConversationCookies } from "../explorerConversationRequestDependencies";
import { getExplorerPrivateConfigurationCandidate } from "../../virtual-guide/explorerPrivateConfiguration";

const ACCOUNT = "10000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT = "10000000-0000-4000-8000-000000000002";
const SESSION = "20000000-0000-4000-8000-000000000001";
const OTHER_SESSION = "20000000-0000-4000-8000-000000000002";
const principal: SupabaseAuthenticatedUser = { providerName: "supabase", providerUserId: "synthetic-provider-user", presentedSessionId: SESSION };
const principalPort = { resolveAuthenticatedUser: vi.fn<SolMindRequestAuthPrincipalSource["resolveAuthenticatedUser"]>() };
const sourcePort: SolMindAuthSource = { loadServerAuthContextInput: vi.fn(), loadGuideRelationship: vi.fn() };
const serviceClient = Object.freeze({ synthetic: "service-role-client" });
const authRpc = Object.freeze({ synthetic: "auth-rpc" });
const authQuery = Object.freeze({ synthetic: "auth-query" });
const repository = Object.freeze({ read: vi.fn(), prepare: vi.fn(), complete: vi.fn(), mutate: vi.fn() });
const privateRepository = Object.freeze({ read: vi.fn(), ensure: vi.fn(), observe: vi.fn(), prepare: vi.fn(), settle: vi.fn(), mutate: vi.fn() });
function records(verified = principal, accountId = ACCOUNT): DeriveTrustedServerAuthContextInput {
  return {
    authenticatedUser: verified,
    authProviderIdentity: { userAccountId: accountId, providerName: verified.providerName, providerUserId: verified.providerUserId, status: "active" },
    userAccount: { userAccountId: accountId, accountStatus: "active" },
    session: { userSessionId: verified.presentedSessionId!, userAccountId: accountId, activeRoleContext: "explorer", sessionStatus: "active", expiresAt: "2999-12-31T23:59:59+00:00" },
    activeRoleAssignment: { userAccountId: accountId, roleCode: "explorer", roleStatus: "active" },
    guideProfile: null,
    explorerProfile: { explorerProfileId: "30000000-0000-4000-8000-000000000001", userAccountId: accountId, status: "active" },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.profile.mockReturnValue(null);
  mocks.principal.mockReturnValue(principalPort); mocks.client.mockReturnValue(serviceClient);
  mocks.rpc.mockReturnValue(authRpc); mocks.query.mockReturnValue(authQuery);
  mocks.source.mockReturnValue(sourcePort); mocks.repository.mockReturnValue(repository); mocks.privateRepository.mockReturnValue(privateRepository);
  principalPort.resolveAuthenticatedUser.mockResolvedValue(principal);
  vi.mocked(sourcePort.loadServerAuthContextInput).mockResolvedValue(records());
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_network_effect"));
});

describe("explicit private local HTTP composition", () => {
  it("keeps missing configuration held without looking up a provider credential", async () => {
    const credential = vi.fn(() => { throw new Error("must_not_read_credential"); });
    const environment = Object.defineProperty({}, "OPENAI_API_KEY", { get: credential });
    const dependencies = createExplorerPrivateLocalRequestDependencies("solmind-session=synthetic", environment);
    expect(await dependencies.authenticate()).toEqual({ accountId: ACCOUNT, applicationSessionId: SESSION });
    expect(dependencies.provider).toBeUndefined(); expect(credential).not.toHaveBeenCalled();
  });
  it("constructs all real composition owners from synthetic trusted data without calling any port or credential", () => {
    const configuration = getExplorerPrivateConfigurationCandidate()!;
    const sha = "A".repeat(64);
    const receipts = Object.fromEntries(["policy", "source", "resources", "renderer", "signal", "provider", "target"].map(key => [key, { file: key + ".json", sha256: sha }]));
    mocks.profile.mockReturnValue({ directory: process.cwd(), modelName: "gpt-5.6-luna", available: () => true, claim: vi.fn(),
      adultResources: "Synthetic adult resource.", ageAppropriateResources: "Synthetic general resource.",
      failureAssistance: { support: "Synthetic support.", adultPolicy: "Synthetic boundary.", supportAndAdultPolicy: "Synthetic combined.", temporarilyUnavailable: "Synthetic uncertainty." },
      profile: { actorAccountId: ACCOUNT, explorerId: OTHER_ACCOUNT, guideId: OTHER_SESSION, packId: SESSION,
        methodologyVersionId: OTHER_ACCOUNT, methodologyContentSha256: configuration.methodologySubjectSha256,
        methodologyAuthorizationVersion: "MV1:" + sha, expiresAt: new Date(Date.now() + 60_000).toISOString(),
        modelPolicyVersion: "synthetic-model", resourcePolicyVersion: "synthetic-resource", receipts } });
    const credential = vi.fn(() => { throw new Error("must_not_read_credential"); });
    const dependencies = createExplorerPrivateLocalRequestDependencies(null, Object.defineProperty({}, "OPENAI_API_KEY", { get: credential }));
    for (const name of ["provider", "buildContext", "renderer", "operationalSignal", "resolveOperationalReadiness"] as const) expect(dependencies[name]).toBeDefined();
    for (const port of Object.values(privateRepository)) expect(port).not.toHaveBeenCalled();
    expect(credential).not.toHaveBeenCalled();
  });
});
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

describe("Explorer conversation raw-cookie and request dependency boundary", () => {
  it("D01 keeps duplicate wire names, percent encoding and equals signs intact", () => {
    expect(readExplorerConversationCookies("solmind-auth=opaque%2Fvalue%3D==;\tsolmind-session=first; solmind-session=second")).toEqual([
      { name: "solmind-auth", value: "opaque%2Fvalue%3D==" },
      { name: "solmind-session", value: "first" }, { name: "solmind-session", value: "second" },
    ]);
    expect(readExplorerConversationCookies(null)).toEqual([]);
    expect(readExplorerConversationCookies("")).toEqual([]);
  });
  it.each([
    { label: "missing owned equals", raw: "solmind-auth" },
    { label: "invalid owned name", raw: "solmind-auth =value" },
    { label: "space in owned value", raw: "solmind-session=has space" },
    { label: "tab in owned value", raw: "solmind-auth=tab\tvalue" },
    { label: "quoted hosted chunk", raw: '__Host-solmind-auth.0="quoted"' },
    { label: "malformed verifier", raw: "solmind-auth-code-verifier=has space" },
    { label: "oversized header", raw: "x=" + "a".repeat(16_384) },
    { label: "too many segments", raw: Array.from({ length: 129 }, () => "x=a").join(";") },
    { label: "global CR", raw: "unrelated=bad\rvalue" },
    { label: "global LF", raw: "unrelated=bad\nvalue" },
    { label: "global NUL", raw: "unrelated=bad\u0000value" },
  ])("D02 rejects malformed owned or unsafe cookie framing before any dependency ($label)", ({ raw }) => {
    expect(readExplorerConversationCookies(raw)).toBeNull();
    expect(() => createExplorerConversationRequestDependencies(raw)).toThrow("explorer_conversation_request_unavailable");
    for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
  });
  it.each([
    { raw: "missing-equals", expected: [] }, { raw: "bad name=value", expected: [] },
    { raw: "cookie=has space", expected: [] }, { raw: "cookie=value;", expected: [{ name: "cookie", value: "value" }] },
    { raw: "cookie=tab\tvalue", expected: [] }, { raw: 'cookie="quoted"', expected: [] },
  ])("D02A skips only malformed unrelated pairs ($raw)", ({ raw, expected }) => {
    expect(readExplorerConversationCookies(raw)).toEqual(expected);
    createExplorerConversationRequestDependencies(raw);
    const cookies = (mocks.principal.mock.calls[0][0] as { cookies: RequestCookieAccessor }).cookies;
    expect(cookies.getAll()).toEqual(expected);
    expect(principalPort.resolveAuthenticatedUser).not.toHaveBeenCalled();
    for (const port of Object.values(repository)) expect(port).not.toHaveBeenCalled();
  });
  it("D03 supplies fresh cookie copies and a write-free accessor", () => {
    createExplorerConversationRequestDependencies("solmind-auth=synthetic%3D; solmind-auth=duplicate");
    const cookies = (mocks.principal.mock.calls[0][0] as { cookies: RequestCookieAccessor }).cookies;
    const first = cookies.getAll(); first[0].value = "mutated outside snapshot";
    expect(cookies.getAll()).toEqual([{ name: "solmind-auth", value: "synthetic%3D" }, { name: "solmind-auth", value: "duplicate" }]);
    expect(cookies.setAll([{ name: "solmind-auth", value: "do-not-publish" }])).toBeUndefined();
    expect(cookies.getAll()[0].value).toBe("synthetic%3D");
  });
  it("D04 assembles separate identity/record clients and holds provider/context absent", () => {
    const dependencies = createExplorerConversationRequestDependencies(null);
    expect(Object.keys(dependencies).sort()).toEqual(["authenticate", "repository"]);
    expect(Object.isFrozen(dependencies)).toBe(true); expect(dependencies.repository).toBe(repository);
    expect("provider" in dependencies).toBe(false); expect("buildContext" in dependencies).toBe(false);
    expect(mocks.client).toHaveBeenCalledOnce(); expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(serviceClient);
    expect(mocks.query.mock.calls[0][0].client).toBe(authRpc);
    expect(mocks.query.mock.calls[0][0].now()).toBeInstanceOf(Date);
    expect(mocks.source).toHaveBeenCalledExactlyOnceWith(authQuery);
    expect(mocks.repository).toHaveBeenCalledExactlyOnceWith(serviceClient);
    expect(principalPort.resolveAuthenticatedUser).not.toHaveBeenCalled();
    expect(sourcePort.loadServerAuthContextInput).not.toHaveBeenCalled();
    for (const port of Object.values(repository)) expect(port).not.toHaveBeenCalled();
  });
  it("D05 actual banked composer derives account and bound application session afresh", async () => {
    const dependencies = createExplorerConversationRequestDependencies("synthetic=opaque");
    const first = await dependencies.authenticate();
    expect(first).toEqual({ accountId: ACCOUNT, applicationSessionId: SESSION });
    expect(first && Object.isFrozen(first)).toBe(true);
    const other = { ...principal, providerUserId: "second-synthetic-provider", presentedSessionId: OTHER_SESSION };
    principalPort.resolveAuthenticatedUser.mockResolvedValueOnce(other);
    vi.mocked(sourcePort.loadServerAuthContextInput).mockResolvedValueOnce(records(other, OTHER_ACCOUNT));
    expect(await dependencies.authenticate()).toEqual({ accountId: OTHER_ACCOUNT, applicationSessionId: OTHER_SESSION });
    expect(principalPort.resolveAuthenticatedUser).toHaveBeenCalledTimes(2);
    expect(sourcePort.loadServerAuthContextInput).toHaveBeenNthCalledWith(1, { authenticatedUser: principal });
    expect(sourcePort.loadServerAuthContextInput).toHaveBeenNthCalledWith(2, { authenticatedUser: other });
  });
  it("D06 missing verified principal denies before record loading", async () => {
    principalPort.resolveAuthenticatedUser.mockResolvedValue(null);
    expect(await createExplorerConversationRequestDependencies(null).authenticate()).toBeNull();
    expect(sourcePort.loadServerAuthContextInput).not.toHaveBeenCalled();
  });
  it.each(["expired", "ended", "binding", "inactive-account", "guide", "admin"] as const)("D07 actual composer denies %s state", async condition => {
    const input = records();
    if (condition === "expired") input.session!.expiresAt = "2000-01-01T00:00:00+00:00";
    if (condition === "ended") input.session!.sessionStatus = "ended";
    if (condition === "binding") input.session!.userSessionId = OTHER_SESSION;
    if (condition === "inactive-account") input.userAccount!.accountStatus = "disabled";
    if (condition === "guide" || condition === "admin") {
      input.session!.activeRoleContext = condition; input.activeRoleAssignment!.roleCode = condition;
      if (condition === "guide") input.guideProfile = { guideProfileId: "40000000-0000-4000-8000-000000000001", userAccountId: ACCOUNT, status: "active" };
    }
    vi.mocked(sourcePort.loadServerAuthContextInput).mockResolvedValue(input);
    expect(await createExplorerConversationRequestDependencies(null).authenticate()).toBeNull();
    for (const port of Object.values(repository)) expect(port).not.toHaveBeenCalled();
  });
  it.each(["principal", "records"] as const)("D08 actual composer closes %s exceptions without leaking", async phase => {
    if (phase === "principal") principalPort.resolveAuthenticatedUser.mockRejectedValue(new Error("private_auth_exception"));
    else vi.mocked(sourcePort.loadServerAuthContextInput).mockRejectedValue(new Error("private_auth_exception"));
    expect(await createExplorerConversationRequestDependencies(null).authenticate()).toBeNull();
    for (const port of Object.values(repository)) expect(port).not.toHaveBeenCalled();
  });
});

describe("private v3 authenticated request factory", () => {
  it("reuses genuine request-auth composition while supplying no operational defaults", async () => {
    const dependencies = createExplorerPrivateConversationRequestDependencies("synthetic=opaque");
    expect(Object.keys(dependencies).sort()).toEqual(["authenticate", "repository"]);
    expect(Object.keys(dependencies.repository).sort()).toEqual(["ensure", "mutate", "observe", "prepare", "read", "settle"]);
    expect(mocks.privateRepository).toHaveBeenCalledExactlyOnceWith(serviceClient);
    expect(mocks.repository).not.toHaveBeenCalled();
    expect(await dependencies.authenticate()).toEqual({ accountId: ACCOUNT, applicationSessionId: SESSION });
    for (const port of Object.values(privateRepository)) expect(port).not.toHaveBeenCalled();
    const row = { outcome: "ok", conversation_state: null };
    privateRepository.read.mockResolvedValue(row);
    const actor = { accountId: ACCOUNT, applicationSessionId: SESSION };
    expect(await dependencies.repository.read(actor)).toBe(row);
    expect(privateRepository.read).toHaveBeenCalledExactlyOnceWith(actor);
  });
  it("does not let runtime extra properties replace actor or persistence authority", async () => {
    const extra = { authenticate: vi.fn(), repository: { synthetic: "foreign" } };
    const dependencies = createExplorerPrivateConversationRequestDependencies(null, extra as never);
    expect(Object.keys(dependencies.repository).sort()).toEqual(["ensure", "mutate", "observe", "prepare", "read", "settle"]);
    expect(await dependencies.authenticate()).toEqual({ accountId: ACCOUNT, applicationSessionId: SESSION });
    expect(extra.authenticate).not.toHaveBeenCalled();
  });
  it("rejects malformed raw cookies before constructing any private client", () => {
    expect(() => createExplorerPrivateConversationRequestDependencies("solmind-auth")).toThrow("explorer_conversation_request_unavailable");
    for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
  });
});


it("the compatibility reader forwards exact owned duplicates through unrelated malformed input", () => {
  createExplorerPrivateConversationRequestDependencies("noise; solmind-auth=opaque%2F==; bad=has space; solmind-session=first; solmind-session=second;");
  const cookies = (mocks.principal.mock.calls[0][0] as { cookies: RequestCookieAccessor }).cookies;
  expect(cookies.getAll()).toEqual([{ name: "solmind-auth", value: "opaque%2F==" },
    { name: "solmind-session", value: "first" }, { name: "solmind-session", value: "second" }]);
  expect(principalPort.resolveAuthenticatedUser).not.toHaveBeenCalled();
  for (const port of Object.values(privateRepository)) expect(port).not.toHaveBeenCalled();
});
