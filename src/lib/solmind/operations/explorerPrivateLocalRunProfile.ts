import "server-only";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { readOpenAiModelName } from "../virtual-guide/openAiModelConfiguration";

const FAILURE = "explorer_private_local_run_unavailable";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA = /^[0-9A-F]{64}$/;
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const POLICY_REQUEST = "6DFBFFC629426F8AF3B67B83963CC8E24327D44F14CE36B66146C702F43BD520";
const POLICY_DRAFT = "ED89374CF34C1AD8A7C33AC836140FB8A114D98BB095B31A81789CE14216E94E";
const RECEIPTS = ["policy", "source", "resources", "renderer", "signal", "provider", "target"] as const;
type ReceiptName = typeof RECEIPTS[number];
type Reference = Readonly<{ file: string; sha256: string }>;
export type ExplorerPrivateLocalRunProfile = Readonly<{
  version: "explorer-private-local-run.v1"; runId: string; expiresAt: string;
  appOrigin: string; supabaseOrigin: string; actorAccountId: string; explorerId: string;
  guideId: string; packId: string; methodologyVersionId: string;
  methodologyContentSha256: string; methodologyAuthorizationVersion: string;
  explorerMessageSha256: string; modelPolicyVersion: string; resourcePolicyVersion: string;
  receipts: Readonly<Record<ReceiptName, Reference>>;
}>;
export type ExplorerPrivateLocalRun = Readonly<{
  profile: ExplorerPrivateLocalRunProfile; directory: string; modelName: string;
  adultResources: string; ageAppropriateResources: string;
  failureAssistance: Readonly<{ support: string; adultPolicy: string; supportAndAdultPolicy: string; temporarilyUnavailable: string }>;
  available: () => boolean;
  claim: () => void;
}>;

function fail(): never { throw new Error(FAILURE); }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function localOrigin(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.origin === value && url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 8192 &&
    !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(value);
}

/** Parse JSON data, never an executable configuration object or a browser selector. */
export function parseExplorerPrivateLocalRunProfile(raw: string, now: number): ExplorerPrivateLocalRunProfile | null {
  try {
    if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 65_536) return null;
    const value: unknown = JSON.parse(raw);
    const ids = ["runId", "actorAccountId", "explorerId", "guideId", "packId", "methodologyVersionId"];
    const hashes = ["methodologyContentSha256", "explorerMessageSha256"];
    if (!object(value) || !exact(value, ["version", "expiresAt", "appOrigin", "supabaseOrigin", ...ids, ...hashes,
      "methodologyAuthorizationVersion", "modelPolicyVersion", "resourcePolicyVersion", "receipts"]) ||
      value.version !== "explorer-private-local-run.v1" || !localOrigin(value.appOrigin) || !localOrigin(value.supabaseOrigin) ||
      value.appOrigin === value.supabaseOrigin || !ids.every(key => typeof value[key] === "string" && UUID.test(value[key])) ||
      !hashes.every(key => typeof value[key] === "string" && SHA.test(value[key])) ||
      ![value.modelPolicyVersion, value.resourcePolicyVersion].every(v => typeof v === "string" && LABEL.test(v)) ||
      typeof value.methodologyAuthorizationVersion !== "string" || !/^MV1:[0-9A-F]{64}$/.test(value.methodologyAuthorizationVersion) ||
      typeof value.expiresAt !== "string" || !Number.isFinite(now) || Date.parse(value.expiresAt) <= now ||
      !Number.isFinite(Date.parse(value.expiresAt)) || new Date(value.expiresAt).toISOString() !== value.expiresAt ||
      !object(value.receipts) || !exact(value.receipts, RECEIPTS)) return null;
    for (const key of RECEIPTS) {
      const ref = value.receipts[key];
      if (!object(ref) || !exact(ref, ["file", "sha256"]) || typeof ref.file !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.json$/.test(ref.file) || typeof ref.sha256 !== "string" || !SHA.test(ref.sha256)) return null;
      Object.freeze(ref);
    }
    Object.freeze(value.receipts);
    return Object.freeze(value) as ExplorerPrivateLocalRunProfile;
  } catch { return null; }
}

function readPinned(file: string, sha256: string): string {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65_536) fail();
  const bytes = readFileSync(file);
  if (bytes.length > 65_536 || createHash("sha256").update(bytes).digest("hex").toUpperCase() !== sha256) fail();
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/**
 * Explicit trusted server configuration only. The two variables select pinned
 * local data; they are not an enable flag or approval. Root must first obtain
 * the real target/provider/human grants and supply their retained receipts.
 * No OpenAI credential is read here. Missing or invalid configuration stays held.
 */
export function loadExplorerPrivateLocalRun(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now = Date.now(),
): ExplorerPrivateLocalRun | null {
  try {
    const file = environment.SOLMIND_PRIVATE_EXPLORER_RUN_PROFILE;
    const hash = environment.SOLMIND_PRIVATE_EXPLORER_RUN_PROFILE_SHA256;
    if (!file || !hash || !SHA.test(hash) || !isAbsolute(file) || file.startsWith("\\\\") || file.startsWith("//") ||
      /[\u0000-\u001f\u007f]/u.test(file) || !file.endsWith(".json")) return null;
    const profile = parseExplorerPrivateLocalRunProfile(readPinned(file, hash), now);
    if (!profile || environment.SOLMIND_TRUSTED_APP_ORIGIN !== profile.appOrigin ||
      environment.NEXT_PUBLIC_SUPABASE_URL !== profile.supabaseOrigin) return null;
    const directory = dirname(file);
    const evidence = Object.fromEntries(RECEIPTS.map(key => [key,
      JSON.parse(readPinned(join(directory, profile.receipts[key].file), profile.receipts[key].sha256)) as unknown]));
    // Receipt hashes bind actual operator evidence; they do not manufacture it.
    // The real governed DB resolver still proves screening and human authority.
    const policy = evidence.policy, grant = evidence.provider, target = evidence.target;
    const modelName = readOpenAiModelName(environment);
    if (!object(policy) || policy.humanAccepted !== true || policy.requestSha256 !== POLICY_REQUEST ||
      policy.sourceDraftSha256 !== POLICY_DRAFT || !object(policy.amendedResourceSelection) ||
      !object(policy.amendedFailureAssistance) || !object(grant) ||
      grant.kind !== "solmind-private-explorer-provider-grant.v1" || grant.humanApproved !== true ||
      grant.runId !== profile.runId || grant.expiresAt !== profile.expiresAt || grant.artifactDirectory !== directory ||
      grant.model !== modelName || grant.endpoint !== "https://api.openai.com/v1/responses" ||
      grant.reasoningEffort !== "medium" || grant.maxOutputTokens !== 4096 || grant.store !== false || grant.timeoutMilliseconds !== 60_000 ||
      grant.maximumExplorerCalls !== 1 || grant.noRetry !== true || grant.noFallback !== true ||
      grant.credentialSource !== "OPENAI_API_KEY" || grant.explorerMessageSha256 !== profile.explorerMessageSha256 ||
      grant.methodologyContentSha256 !== profile.methodologyContentSha256 || grant.packId !== profile.packId ||
      grant.methodologyVersionId !== profile.methodologyVersionId || grant.modelPolicyVersion !== profile.modelPolicyVersion ||
      grant.resourcePolicyVersion !== profile.resourcePolicyVersion || grant.targetReceiptSha256 !== profile.receipts.target.sha256 ||
      !object(target) || target.kind !== "solmind-private-isolated-target.v1" || target.result !== "PASS" ||
      target.runId !== profile.runId || target.artifactDirectory !== directory || target.supabaseOrigin !== profile.supabaseOrigin ||
      target.appOrigin !== profile.appOrigin || target.actorAccountId !== profile.actorAccountId ||
      target.explorerId !== profile.explorerId || target.guideId !== profile.guideId) return null;
    const resources = policy.amendedResourceSelection, help = policy.amendedFailureAssistance;
    if (!text(resources.adultResources) || !text(resources.ageAppropriateResources) ||
      !exact(help, ["support", "adultPolicy", "supportAndAdultPolicy", "temporarilyUnavailable"]) || !Object.values(help).every(text)) return null;
    const claimedFile = join(directory, `explorer-send-${profile.runId}.claimed`);
    const available = () => Date.now() < Date.parse(profile.expiresAt) && !existsSync(claimedFile);
    return Object.freeze({ profile, directory, modelName, adultResources: resources.adultResources,
      ageAppropriateResources: resources.ageAppropriateResources,
      failureAssistance: Object.freeze({ support: help.support as string, adultPolicy: help.adultPolicy as string,
        supportAndAdultPolicy: help.supportAndAdultPolicy as string, temporarilyUnavailable: help.temporarilyUnavailable as string }),
      available,
      claim: () => {
        if (!available()) fail();
        // Atomic exclusive creation survives concurrent requests and process
        // restarts. Never delete/reset/retry this consumed one-call allowance.
        writeFileSync(claimedFile, "consumed\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
      },
    });
  } catch { return null; }
}
