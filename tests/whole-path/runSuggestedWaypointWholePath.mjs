import { spawn } from "node:child_process";
import { lstat, readFile, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const npxCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const supabaseCli = ["--offline", "--no", "--package", "supabase@2.115.0", "--", "supabase"];
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(root, "node_modules", "@playwright", "test", "cli.js");
const isolatedBuildArguments = Object.freeze([nextCli, "build", "--webpack"]);
const port = Number(process.env.SOLMIND_WHOLE_PATH_APP_PORT ?? "4321");
const origin = `http://127.0.0.1:${port}`;
const MAX_OUTPUT = 2_000_000;
const WHOLE_PATH_PLAYWRIGHT_CHILD_TIMEOUT_MS = 4_200_000;
const RUN_ID = /^S03G-[0-9]{8}-[a-z0-9][a-z0-9-]{5,31}$/u;
const resultDirectory = path.join(root, "test-results", "whole-path");
const WHOLE_PATH_VALUE_FREE_FAILURE_PATTERN = /\bwhole_path_(?:fixture_(?:initialization|cleanup|run)_failed|orchestrator_(?:configuration_failed|configuration_drift|cleanup_failed|browser_failed|bundle_failed|scenario_failed|scenario_(?:(?:guide_relationship_entry|guide_draft_create|guide_draft_edit_save|guide_schedule_pull_back_reschedule|explorer_pre_delivery_denial|delivery_eligibility_wait|delivery_bridge|explorer_delivery_read|explorer_mark_read|explorer_acknowledge|guide_acknowledgement_refresh|guide_projection_shape|unrelated_role_denials|layout_accessibility)_failed|guide_relationship_entry_internal_(?:query_denied|relationship_path_denied|request_resolution_denied|principal_denied|auth_context_denied|guide_role_denied|relationship_load_denied|relationship_access_denied|rpc_denied)_failed|guide_relationship_entry_(?:request_failed|http_failed|response_parse_failed|response_contract_failed|relationship_denied|relationship_failed|refresh_required|unexpected_existing_suggestions|ui_projection_failed)_failed|guide_draft_create_internal_(?:query_denied|relationship_path_denied|request_guard_denied|route_input_denied|request_resolution_denied|principal_denied|auth_context_denied|guide_role_denied|relationship_denied|rpc_denied)_failed|guide_draft_create_(?:request_failed|http_failed|response_parse_failed|response_contract_failed|command_denied|command_failed|outcome_invalid_transition|outcome_operation_conflict|outcome_relationship_unavailable|outcome_stale)_failed|guide_schedule_pull_back_reschedule_(?:schedule_heading_timeout|schedule_completed_heading_missing|schedule_detail_refresh_failed|schedule_detail_not_updated|schedule_policy_unavailable|schedule_command_failed|schedule_unavailable|schedule_stale|schedule_invalid_transition|schedule_operation_conflict|schedule_unconfirmed|schedule_transport_uncertain|schedule_not_started|schedule_status_unrecognized|pull_back_heading_timeout|pull_back_completed_heading_missing|pull_back_detail_refresh_failed|pull_back_detail_not_updated|pull_back_too_late|pull_back_command_failed|pull_back_unavailable|pull_back_stale|pull_back_invalid_transition|pull_back_operation_conflict|pull_back_unconfirmed|pull_back_transport_uncertain|pull_back_not_started|pull_back_status_unrecognized|reschedule_heading_timeout|reschedule_completed_heading_missing|reschedule_detail_refresh_failed|reschedule_detail_not_updated|reschedule_policy_unavailable|reschedule_command_failed|reschedule_unavailable|reschedule_stale|reschedule_invalid_transition|reschedule_operation_conflict|reschedule_unconfirmed|reschedule_transport_uncertain|reschedule_not_started|reschedule_status_unrecognized|pending_selector_mismatch)_failed))|runner_child_failed)\b/gu;
const WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_MARKER_PATTERN = /whole_path_internal_guide_relationship_entry_(query_denied|relationship_path_denied|request_resolution_denied|principal_denied|auth_context_denied|guide_role_denied|relationship_load_denied|relationship_access_denied|rpc_denied)/u;
const WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_GENERIC_DENIAL =
  "whole_path_orchestrator_scenario_guide_relationship_entry_relationship_denied_failed";
const WHOLE_PATH_GUIDE_DRAFT_INTERNAL_MARKER_PATTERN = /whole_path_internal_guide_draft_create_(query_denied|relationship_path_denied|request_guard_denied|route_input_denied|request_resolution_denied|principal_denied|auth_context_denied|guide_role_denied|relationship_denied|rpc_denied)/u;
const WHOLE_PATH_GUIDE_DRAFT_GENERIC_DENIAL =
  "whole_path_orchestrator_scenario_guide_draft_create_command_denied_failed";

function gate(name, expected) {
  if (process.env[name] !== expected) throw new Error("whole_path_runner_refused");
}

function childEnvironment() {
  const environment = {};
  for (const name of [
    "APPDATA", "ComSpec", "HOME", "HOMEDRIVE", "HOMEPATH", "LOCALAPPDATA",
    "NUMBER_OF_PROCESSORS", "Path", "PATH", "PATHEXT", "ProgramData",
    "ProgramFiles", "ProgramFiles(x86)", "SystemDrive", "SystemRoot", "TEMP",
    "TMP", "USERPROFILE", "WINDIR",
  ]) {
    if (typeof process.env[name] === "string") environment[name] = process.env[name];
  }
  return environment;
}

function valueFreeFailureCode(stdout, stderr) {
  const combined = Buffer.concat([...stdout, ...stderr]).toString("utf8");
  const matches = combined.match(WHOLE_PATH_VALUE_FREE_FAILURE_PATTERN);
  return matches?.at(0) ?? "whole_path_runner_child_failed";
}

async function pathExists(target) {
  try { await lstat(target); return true; } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

function boundedCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      cwd: root,
      env: options.env ?? childEnvironment(),
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];
    let size = 0;
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(() => reject(new Error("whole_path_runner_child_failed")));
    }, options.timeoutMs ?? 300_000);
    const collect = (target, chunk) => {
      size += chunk.length;
      if (size > MAX_OUTPUT) {
        child.kill("SIGKILL");
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", (chunk) => collect(stdout, chunk));
    child.stderr.on("data", (chunk) => collect(stderr, chunk));
    child.once("error", () => settle(() => reject(new Error("whole_path_runner_child_failed"))));
    child.once("exit", (code, signal) => {
      if (size > MAX_OUTPUT || signal || code !== 0) {
        const failureCode =
          size > MAX_OUTPUT || signal
            ? "whole_path_runner_child_failed"
            : valueFreeFailureCode(stdout, stderr);
        settle(() => reject(new Error(failureCode)));
        return;
      }
      const result = Object.freeze({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
      stdout.length = 0;
      stderr.length = 0;
      settle(() => resolve(result));
    });
    if (options.input !== undefined) child.stdin.end(options.input);
  });
}

function listening() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

async function status() {
  const { stdout } = await boundedCommand(
    process.execPath,
    [npxCli, ...supabaseCli, "status", "-o", "json"],
  );
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new Error("whole_path_runner_status_refused");
  }
  if (
    typeof value !== "object" || value === null ||
    value.API_URL !== "http://127.0.0.1:54321" ||
    typeof value.ANON_KEY !== "string" || value.ANON_KEY.length < 16 ||
    typeof value.SERVICE_ROLE_KEY !== "string" || value.SERVICE_ROLE_KEY.length < 16 ||
    typeof value.DB_URL !== "string" ||
    !/^postgres(?:ql)?:\/\/postgres:[^@\r\n]+@127\.0\.0\.1:54322\/postgres$/u.test(value.DB_URL)
  ) {
    throw new Error("whole_path_runner_status_refused");
  }
  return Object.freeze({
    url: value.API_URL,
    anonKey: value.ANON_KEY,
    serviceRoleKey: value.SERVICE_ROLE_KEY,
  });
}

async function waitReady(server) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (serverError || server.exitCode !== null) {
      throw new Error("whole_path_runner_server_failed");
    }
    try {
      const response = await fetch(origin, {
        redirect: "manual",
        signal: AbortSignal.timeout(1_000),
      });
      if (response.status > 0) return;
    } catch {
      // Bounded readiness polling only.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("whole_path_runner_server_timeout");
}

async function stopServer(server) {
  if (server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (!(await listening())) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("whole_path_runner_server_cleanup_failed");
}

let server;
let serverError = false;
let ownedResultDirectory = false;
let serverGuideRelationshipEntryInternalStage = null;
let serverGuideDraftInternalStage = null;
let serverDiagnosticCarry = "";

function observeServerDiagnostic(chunk) {
  if (
    serverGuideRelationshipEntryInternalStage !== null &&
    serverGuideDraftInternalStage !== null
  ) return;
  const candidate = `${serverDiagnosticCarry}${chunk.toString("utf8")}`;
  if (serverGuideRelationshipEntryInternalStage === null) {
    const relationshipMatch = candidate.match(
      WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_MARKER_PATTERN,
    );
    if (relationshipMatch) {
      serverGuideRelationshipEntryInternalStage = relationshipMatch[1];
    }
  }
  if (serverGuideDraftInternalStage === null) {
    const draftMatch = candidate.match(
      WHOLE_PATH_GUIDE_DRAFT_INTERNAL_MARKER_PATTERN,
    );
    if (draftMatch) serverGuideDraftInternalStage = draftMatch[1];
  }
  serverDiagnosticCarry = candidate.slice(-512);
}

try {
  gate("SOLMIND_WHOLE_PATH_APPROVAL", "approved-local-synthetic-suggested-waypoint-whole-path");
  gate("SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS", "approved-exact-run-local-auth-and-database-cleanup");
  if (
    !RUN_ID.test(process.env.SOLMIND_WHOLE_PATH_RUN_ID ?? "") ||
    process.env.SOLMIND_LOCAL_SUPABASE_PROJECT_ID !== "solmind-app" ||
    process.env.SOLMIND_LOCAL_SUPABASE_URL !== "http://127.0.0.1:54321" ||
    process.env.SOLMIND_LOCAL_DATABASE_PORT !== "54322" ||
    process.env.SOLMIND_TRUSTED_APP_ORIGIN !== origin ||
    !Number.isInteger(port) || port < 4_100 || port > 4_999 ||
    await listening() ||
    await pathExists(resultDirectory) ||
    !(await pathExists(npxCli)) ||
    await pathExists(path.join(root, "supabase", ".temp", "project-ref"))
  ) {
    throw new Error("whole_path_runner_port_refused");
  }
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  if (!/^project_id = "solmind-app"$/mu.test(config)) {
    throw new Error("whole_path_runner_project_refused");
  }
  const local = await status();
  const publicEnvironment = {
    ...childEnvironment(),
    NEXT_PUBLIC_SUPABASE_URL: local.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: local.anonKey,
    SOLMIND_TRUSTED_APP_ORIGIN: origin,
  };
  await boundedCommand(process.execPath, isolatedBuildArguments, { env: publicEnvironment });
  server = spawn(
    process.execPath,
    [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: root,
      env: {
        ...publicEnvironment,
        SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
        SOLMIND_WHOLE_PATH_APPROVAL: process.env.SOLMIND_WHOLE_PATH_APPROVAL,
        SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS:
          process.env.SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS,
        SOLMIND_WHOLE_PATH_RUN_ID: process.env.SOLMIND_WHOLE_PATH_RUN_ID,
        SOLMIND_LOCAL_SUPABASE_PROJECT_ID: "solmind-app",
        SOLMIND_LOCAL_SUPABASE_URL: local.url,
        SOLMIND_LOCAL_DATABASE_PORT: "54322",
      },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  server.once("error", () => { serverError = true; });
  server.stderr.on("data", observeServerDiagnostic);
  await waitReady(server);
  if (serverError) throw new Error("whole_path_runner_server_failed");
  const browserEnvironment = {
    ...childEnvironment(),
    SOLMIND_WHOLE_PATH_APPROVAL: process.env.SOLMIND_WHOLE_PATH_APPROVAL,
    SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS: process.env.SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS,
    SOLMIND_WHOLE_PATH_RUN_ID: process.env.SOLMIND_WHOLE_PATH_RUN_ID,
    SOLMIND_WHOLE_PATH_APP_PORT: String(port),
    SOLMIND_TRUSTED_APP_ORIGIN: origin,
    SOLMIND_LOCAL_SUPABASE_PROJECT_ID: "solmind-app",
    SOLMIND_LOCAL_SUPABASE_URL: local.url,
    SOLMIND_LOCAL_DATABASE_PORT: "54322",
  };
  ownedResultDirectory = true;
  try {
    await boundedCommand(
      process.execPath,
      [playwrightCli, "test", "--config", "playwright.whole-path.config.ts"],
      { env: browserEnvironment, timeoutMs: WHOLE_PATH_PLAYWRIGHT_CHILD_TIMEOUT_MS },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_GENERIC_DENIAL &&
      serverGuideRelationshipEntryInternalStage !== null
    ) {
      throw new Error(
        `whole_path_orchestrator_scenario_guide_relationship_entry_internal_${serverGuideRelationshipEntryInternalStage}_failed`,
      );
    }
    if (
      error instanceof Error &&
      error.message === WHOLE_PATH_GUIDE_DRAFT_GENERIC_DENIAL &&
      serverGuideDraftInternalStage !== null
    ) {
      throw new Error(
        `whole_path_orchestrator_scenario_guide_draft_create_internal_${serverGuideDraftInternalStage}_failed`,
      );
    }
    throw error;
  }
  process.stdout.write("whole_path_completed\n");
} catch (error) {
  process.stderr.write("whole_path_failed\n");
  const failureCode =
    error instanceof Error &&
    /^whole_path_(?:fixture|orchestrator|runner)_[a-z0-9_]+$/u.test(error.message)
      ? error.message
      : "whole_path_runner_failed";
  process.stderr.write(`${failureCode}\n`);
  process.exitCode = 1;
} finally {
  let cleanupFailed = false;
  if (server) {
    try { await stopServer(server); } catch { cleanupFailed = true; }
  }
  try {
    if (ownedResultDirectory) {
      await rm(resultDirectory, { recursive: true, force: true });
    }
  } catch {
    cleanupFailed = true;
  }
  if (cleanupFailed) {
    process.stderr.write("whole_path_cleanup_failed\n");
    process.exitCode = 1;
  }
}
