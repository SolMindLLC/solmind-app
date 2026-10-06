import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import AxeBuilder from "@axe-core/playwright";
import { chromium, expect, test, type Page, type Route } from "@playwright/test";

import {
  createSupabaseLocalFixtureDependencies,
  type SuggestedWaypointLocalSecrets,
} from "./suggestedWaypointLocalAuthFixture";
import { suggestedWaypointPlaywrightContextOptions } from "./suggestedWaypointPlaywrightSession";
import {
  runSuggestedWaypointWholePath,
  runSuggestedWaypointWholePathScenarioStep,
} from "./suggestedWaypointWholePathOrchestrator";
import type { SuggestedWaypointWholePathScenario } from "./suggestedWaypointWholePathOrchestrator";
import {
  classifySuggestedWaypointGuideDraftCreateResult,
  SuggestedWaypointGuideDraftCreateFailure,
  type SuggestedWaypointGuideDraftCreateRequestResult,
} from "./suggestedWaypointWholePathGuideDraftDiagnostics";
import {
  classifySuggestedWaypointGuideRelationshipEntryResult,
  SuggestedWaypointGuideRelationshipEntryFailure,
  type SuggestedWaypointGuideRelationshipEntryRequestResult,
} from "./suggestedWaypointWholePathGuideRelationshipEntryDiagnostics";
import {
  classifySuggestedWaypointGuideSchedulePullBackRescheduleStatus,
  SuggestedWaypointGuideSchedulePullBackRescheduleFailure,
  type SuggestedWaypointGuideSchedulePullBackRescheduleCheck,
} from "./suggestedWaypointWholePathGuideScheduleDiagnostics";
import {
  readSuggestedWaypointWholePathSafetyConfig,
  WHOLE_PATH_APPROVAL_GATE,
  WHOLE_PATH_EFFECT_GATE,
  type SuggestedWaypointWholePathRole,
} from "./suggestedWaypointWholePathSafety";

const exec = promisify(execFile);
const npxCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const supabaseCli = ["--offline", "--no", "--package", "supabase@2.115.0", "--", "supabase"];
const vitestCli = path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_CHILD_OUTPUT = 2_000_000;
const WHOLE_PATH_RESET_TIMEOUT_MS = 600_000;
const GUIDE_DETAIL_KEYS = Object.freeze([
  "suggested_waypoint_id", "authoring_mode", "authoring_revision",
  "destination_preview", "pending_deadline_at", "pull_back_available",
  "channel_category", "current_version_id", "pending_version_id",
  "delivered_at", "acknowledged_version_id", "acknowledged_at",
  "draft_or_pending_destination", "draft_or_pending_why",
  "draft_or_pending_arrival_signals", "delivered_destination",
  "delivered_why", "delivered_arrival_signals", "policy_key",
  "policy_version", "effective_seconds",
] as const);

function safeChildEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { NODE_ENV: "test" };
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

type PendingSelector = Readonly<{
  suggestedWaypointId: string;
  pendingVersionId: string;
  deadlineAt: string;
  effectiveSeconds: 60;
}>;

async function loadLocalSecrets(): Promise<SuggestedWaypointLocalSecrets> {
  const { stdout } = await exec(process.execPath, [npxCli, ...supabaseCli, "status", "-o", "json"], {
    cwd: process.cwd(),
    env: safeChildEnvironment(),
    windowsHide: true,
    maxBuffer: MAX_CHILD_OUTPUT,
    timeout: 30_000,
  });
  let value: unknown;
  try { value = JSON.parse(stdout); } catch { throw new Error("whole_path_status_refused"); }
  if (typeof value !== "object" || value === null) {
    throw new Error("whole_path_status_refused");
  }
  const record = value as Record<string, unknown>;
  if (
    record.API_URL !== "http://127.0.0.1:54321" ||
    typeof record.ANON_KEY !== "string" || record.ANON_KEY.length < 16 ||
    typeof record.SERVICE_ROLE_KEY !== "string" || record.SERVICE_ROLE_KEY.length < 16
  ) {
    throw new Error("whole_path_status_refused");
  }
  return Object.freeze({
    anonKey: record.ANON_KEY,
    serviceRoleKey: record.SERVICE_ROLE_KEY,
  });
}

async function resetLocalDatabase(): Promise<void> {
  await exec(process.execPath, [npxCli, ...supabaseCli, "db", "reset", "--local", "--yes", "--no-seed"], {
    cwd: process.cwd(),
    env: safeChildEnvironment(),
    windowsHide: true,
    maxBuffer: MAX_CHILD_OUTPUT,
    timeout: WHOLE_PATH_RESET_TIMEOUT_MS,
  });
}

function executeFixtureSql(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "exec", "-i", "supabase_db_solmind-app", "psql",
        "--username", "postgres", "--dbname", "postgres", "--no-psqlrc",
        "--set", "ON_ERROR_STOP=on",
      ],
      {
        cwd: process.cwd(),
        env: safeChildEnvironment(),
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let outputBytes = 0;
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(() => reject(new Error("whole_path_fixture_sql_failed")));
    }, 60_000);
    const bound = (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_CHILD_OUTPUT) child.kill("SIGKILL");
    };
    child.stdout.on("data", bound);
    child.stderr.on("data", bound);
    child.once("error", () =>
      settle(() => reject(new Error("whole_path_fixture_sql_failed"))),
    );
    child.once("exit", (code, signal) => {
      if (signal || code !== 0 || outputBytes > MAX_CHILD_OUTPUT) {
        settle(() => reject(new Error("whole_path_fixture_sql_failed")));
      } else {
        settle(resolve);
      }
    });
    child.stdin.end(sql);
  });
}

function actor(scenario: SuggestedWaypointWholePathScenario, role: SuggestedWaypointWholePathRole) {
  const match = scenario.actors.find((candidate) => candidate.role === role);
  if (!match) throw new Error("whole_path_scenario_actor_missing");
  return match;
}

async function noSeriousAxe(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations.filter(({ impact }) => impact === "serious" || impact === "critical"))
    .toEqual([]);
}

async function createDraft(
  page: Page,
  relationshipId: string,
  runId: string,
): Promise<string> {
  const requestResult = await page.evaluate(async ({ relationshipId: target, runId: exactRunId }) => {
    try {
      const response = await fetch(`/guide/waypoint-suggestions/${encodeURIComponent(target)}/commands`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json",
          "X-SolMind-Whole-Path-Run-Id": exactRunId,
        },
        body: JSON.stringify({
          kind: "guide.create_draft",
          operationId: crypto.randomUUID(),
          destination: "Protect one evening each week for recovery",
          why: "A protected evening may make the week feel more sustainable.",
          arrivalSignals: ["One evening stays unscheduled."],
        }),
      });
      if (!response.ok) return { kind: "http_failed" } as const;
      try {
        return { kind: "response", value: await response.json() } as const;
      } catch {
        return { kind: "response_parse_failed" } as const;
      }
    } catch {
      return { kind: "request_failed" } as const;
    }
  }, { relationshipId, runId }) as SuggestedWaypointGuideDraftCreateRequestResult;
  const diagnostic = classifySuggestedWaypointGuideDraftCreateResult(requestResult);
  if (diagnostic.status === "failed") {
    throw new SuggestedWaypointGuideDraftCreateFailure(diagnostic.reason);
  }
  return diagnostic.suggestedWaypointId;
}

async function openGuideRelationshipEntry(
  page: Page,
  relationshipId: string,
  runId: string,
): Promise<void> {
  const pagePath = `/guide/waypoint-suggestions/${relationshipId}`;
  const listPath = `${pagePath}/suggestions`;
  const exactListRequest = (url: URL): boolean =>
    url.pathname === listPath &&
    url.searchParams.size === 1 &&
    url.searchParams.get("pageSize") === "10";
  const bindExactRun = async (route: Route): Promise<void> => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-solmind-whole-path-run-id": runId,
      },
    });
  };
  let requestResult: SuggestedWaypointGuideRelationshipEntryRequestResult;
  await page.route(exactListRequest, bindExactRun);
  try {
    const responsePromise = page.waitForResponse((candidate) => {
      try {
        const url = new URL(candidate.url());
        return (
          candidate.request().method() === "GET" &&
          url.pathname === listPath &&
          url.searchParams.size === 1 &&
          url.searchParams.get("pageSize") === "10"
        );
      } catch {
        return false;
      }
    });
    const [, response] = await Promise.all([
      page.goto(pagePath),
      responsePromise,
    ]);
    if (!response.ok()) {
      requestResult = Object.freeze({ kind: "http_failed" });
    } else {
      try {
        requestResult = Object.freeze({
          kind: "response",
          value: await response.json(),
        });
      } catch {
        requestResult = Object.freeze({ kind: "response_parse_failed" });
      }
    }
  } catch {
    requestResult = Object.freeze({ kind: "request_failed" });
  } finally {
    await page.unroute(exactListRequest, bindExactRun);
  }

  const diagnostic = classifySuggestedWaypointGuideRelationshipEntryResult(
    requestResult,
  );
  if (diagnostic.status === "failed") {
    throw new SuggestedWaypointGuideRelationshipEntryFailure(
      diagnostic.reason,
    );
  }

  try {
    await expect(
      page.getByRole("heading", { name: "Waypoint Suggestions" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No suggestions yet" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "This relationship has no Guide-visible Suggested Waypoints.",
        { exact: false },
      ),
    ).toBeVisible();
  } catch {
    throw new SuggestedWaypointGuideRelationshipEntryFailure(
      "ui_projection_failed",
    );
  }
}

async function pendingSelector(
  page: Page,
  relationshipId: string,
  suggestedWaypointId: string,
): Promise<PendingSelector> {
  const result = await page.evaluate(async ({ relationshipId: relationship, suggestedWaypointId: suggestion }) => {
    const response = await fetch(
      `/guide/waypoint-suggestions/${encodeURIComponent(relationship)}/${encodeURIComponent(suggestion)}/detail`,
      { credentials: "same-origin", cache: "no-store" },
    );
    return response.json();
  }, { relationshipId, suggestedWaypointId });
  const data = typeof result === "object" && result !== null
    ? (result as { data?: unknown }).data
    : null;
  if (typeof data !== "object" || data === null) {
    throw new SuggestedWaypointGuideSchedulePullBackRescheduleFailure(
      "pending_selector_mismatch",
    );
  }
  const record = data as Record<string, unknown>;
  if (
    record.suggested_waypoint_id !== suggestedWaypointId ||
    record.authoring_mode !== "pending" ||
    typeof record.pending_version_id !== "string" || !UUID.test(record.pending_version_id) ||
    typeof record.pending_deadline_at !== "string" ||
    !Number.isFinite(Date.parse(record.pending_deadline_at)) ||
    record.pull_back_available !== true ||
    record.effective_seconds !== 60
  ) {
    throw new SuggestedWaypointGuideSchedulePullBackRescheduleFailure(
      "pending_selector_mismatch",
    );
  }
  return Object.freeze({
    suggestedWaypointId,
    pendingVersionId: record.pending_version_id,
    deadlineAt: record.pending_deadline_at,
    effectiveSeconds: 60,
  });
}

async function expectGuideScheduleHeading(
  page: Page,
  check: SuggestedWaypointGuideSchedulePullBackRescheduleCheck,
  heading: "Pending-send window" | "Guide-only draft",
): Promise<void> {
  try {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  } catch {
    let statusTexts: readonly string[];
    try {
      statusTexts = await page.getByRole("status").allTextContents();
    } catch {
      statusTexts = [];
    }
    throw new SuggestedWaypointGuideSchedulePullBackRescheduleFailure(
      classifySuggestedWaypointGuideSchedulePullBackRescheduleStatus(
        check,
        statusTexts,
      ),
    );
  }
}

async function waitUntilDeliveryEligible(
  page: Page,
  relationshipId: string,
  selector: PendingSelector,
): Promise<void> {
  const deadline = Date.now() + 70_000;
  while (Date.now() < deadline) {
    const result = await page.evaluate(async ({ relationshipId: relationship, suggestedWaypointId }) => {
      const response = await fetch(
        `/guide/waypoint-suggestions/${encodeURIComponent(relationship)}/${encodeURIComponent(suggestedWaypointId)}/detail`,
        { credentials: "same-origin", cache: "no-store" },
      );
      return response.json();
    }, { relationshipId, suggestedWaypointId: selector.suggestedWaypointId });
    const data = typeof result === "object" && result !== null
      ? (result as { data?: unknown }).data
      : null;
    if (typeof data !== "object" || data === null) {
      throw new Error("whole_path_delivery_eligibility_failed");
    }
    const record = data as Record<string, unknown>;
    if (
      record.suggested_waypoint_id !== selector.suggestedWaypointId ||
      record.pending_version_id !== selector.pendingVersionId ||
      record.authoring_mode !== "pending" ||
      record.pending_deadline_at !== selector.deadlineAt ||
      record.effective_seconds !== selector.effectiveSeconds
    ) {
      throw new Error("whole_path_delivery_eligibility_failed");
    }
    if (record.pull_back_available === false) return;
    if (record.pull_back_available !== true) {
      throw new Error("whole_path_delivery_eligibility_failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("whole_path_delivery_eligibility_timeout");
}

function wholePathSafetyEnvironment(): NodeJS.ProcessEnv {
  const config = readSuggestedWaypointWholePathSafetyConfig(process.env);
  if (config === null) throw new Error("whole_path_delivery_bridge_safety_refused");
  return {
    NODE_ENV: "test",
    SOLMIND_WHOLE_PATH_APPROVAL: WHOLE_PATH_APPROVAL_GATE,
    SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS: WHOLE_PATH_EFFECT_GATE,
    SOLMIND_WHOLE_PATH_RUN_ID: config.runId,
    SOLMIND_LOCAL_SUPABASE_PROJECT_ID: config.projectId,
    SOLMIND_LOCAL_SUPABASE_URL: config.localSupabaseUrl,
    SOLMIND_LOCAL_DATABASE_PORT: String(config.localDatabasePort),
    SOLMIND_TRUSTED_APP_ORIGIN: config.trustedApplicationOrigin,
  };
}

async function deliveryBridge(
  secrets: SuggestedWaypointLocalSecrets,
  selector: PendingSelector,
): Promise<void> {
  await exec(
    process.execPath,
    [vitestCli, "run", "--config", "vitest.whole-path.config.ts"],
    {
      cwd: process.cwd(),
      windowsHide: true,
      maxBuffer: MAX_CHILD_OUTPUT,
      timeout: 180_000,
      env: {
        ...safeChildEnvironment(),
        ...wholePathSafetyEnvironment(),
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: secrets.serviceRoleKey,
        SOLMIND_WHOLE_PATH_DELIVERY_OPERATION_ID: randomUUID(),
        SOLMIND_WHOLE_PATH_DELIVERY_SUGGESTION_ID: selector.suggestedWaypointId,
        SOLMIND_WHOLE_PATH_DELIVERY_PENDING_VERSION_ID: selector.pendingVersionId,
      },
    },
  );
}

async function expectUnavailable(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: /unavailable/iu })).toBeVisible();
}

async function expectValueFreeDeniedPost(
  page: Page,
  url: string,
  body: Readonly<Record<string, unknown>>,
): Promise<void> {
  const result = await page.evaluate(async ({ target, payload }) => {
    const response = await fetch(target, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  }, { target: url, payload: body });
  expect(result).toEqual({
    ok: false,
    outcome: null,
    suggestedWaypointId: null,
    error: "command_denied",
  });
}

async function expectExplorerRelationshipUnavailablePost(
  page: Page,
  url: string,
  body: Readonly<Record<string, unknown>>,
): Promise<void> {
  const result = await page.evaluate(async ({ target, payload }) => {
    const response = await fetch(target, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  }, { target: url, payload: body });
  expect(result).toEqual({
    ok: false,
    outcome: "relationship_unavailable",
    suggestedWaypointId: null,
    error: null,
  });
}

async function runScenario(
  scenario: SuggestedWaypointWholePathScenario,
  secrets: SuggestedWaypointLocalSecrets,
): Promise<"passed"> {
  const relationshipId = scenario.scenarioIds.assignedRelationshipId;
  const guidePage = await runSuggestedWaypointWholePathScenarioStep(
    "guide_relationship_entry",
    async () => {
      const page = await actor(scenario, "assigned-guide").context.newPage();
      await openGuideRelationshipEntry(
        page,
        relationshipId,
        scenario.config.runId,
      );
      return page;
    },
  );
  const suggestedWaypointId = await runSuggestedWaypointWholePathScenarioStep(
    "guide_draft_create",
    () => createDraft(guidePage, relationshipId, scenario.config.runId),
  );
  const detailUrl = `/guide/waypoint-suggestions/${relationshipId}/${suggestedWaypointId}`;

  await runSuggestedWaypointWholePathScenarioStep(
    "guide_draft_edit_save",
    async () => {
      await guidePage.goto(detailUrl);
      await expect(guidePage.getByRole("heading", { name: "Guide-only draft" })).toBeVisible();
      await guidePage.getByRole("button", { name: "Edit draft" }).click();
      await guidePage.getByLabel("Possible Waypoint destination").fill("Protect two quiet evenings each week");
      await guidePage.getByLabel("Why this may help").fill("Two evenings may make recovery dependable.\nReview after two weeks.");
      await guidePage.getByLabel("Arrival signal 1").fill("Two evenings stay unscheduled.");
      await guidePage.getByRole("button", { name: "Save changes" }).click();
      await expect(guidePage.getByRole("status").filter({ hasText: "saved and confirmed" })).toBeFocused();
    },
  );

  const selector = await runSuggestedWaypointWholePathScenarioStep(
    "guide_schedule_pull_back_reschedule",
    async () => {
      await guidePage.getByRole("button", { name: "Review before sending" }).click();
      await guidePage.getByRole("button", { name: "Schedule send" }).click();
      await expectGuideScheduleHeading(guidePage, "schedule", "Pending-send window");
      await guidePage.getByRole("button", { name: "Pull Back", exact: true }).click();
      await expectGuideScheduleHeading(guidePage, "pull_back", "Guide-only draft");
      await guidePage.getByRole("button", { name: "Review before sending" }).click();
      await guidePage.getByRole("button", { name: "Schedule send" }).click();
      await expectGuideScheduleHeading(guidePage, "reschedule", "Pending-send window");
      return pendingSelector(guidePage, relationshipId, suggestedWaypointId);
    },
  );

  const explorerPage = await runSuggestedWaypointWholePathScenarioStep(
    "explorer_pre_delivery_denial",
    async () => {
      const page = await actor(scenario, "assigned-explorer").context.newPage();
      await expectUnavailable(page, `/explorer/waypoints/${suggestedWaypointId}`);
      return page;
    },
  );
  await runSuggestedWaypointWholePathScenarioStep(
    "delivery_eligibility_wait",
    () => waitUntilDeliveryEligible(guidePage, relationshipId, selector),
  );
  await runSuggestedWaypointWholePathScenarioStep(
    "delivery_bridge",
    () => deliveryBridge(secrets, selector),
  );

  await runSuggestedWaypointWholePathScenarioStep(
    "explorer_delivery_read",
    async () => {
      await explorerPage.goto(`/explorer/waypoints/${suggestedWaypointId}`);
      await expect(explorerPage.getByRole("heading", { name: "Protect two quiet evenings each week" })).toBeVisible();
    },
  );
  await runSuggestedWaypointWholePathScenarioStep(
    "explorer_mark_read",
    async () => {
      await explorerPage.getByRole("button", { name: "Mark as read" }).click();
      await expect(explorerPage.getByText("✓ Read", { exact: true })).toBeVisible();
    },
  );
  await runSuggestedWaypointWholePathScenarioStep(
    "explorer_acknowledge",
    async () => {
      await explorerPage.getByRole("button", { name: "Acknowledge receipt" }).click();
      await expect(explorerPage.getByText("Receipt acknowledged.", { exact: false })).toBeVisible();
    },
  );

  await runSuggestedWaypointWholePathScenarioStep(
    "guide_acknowledgement_refresh",
    async () => {
      await guidePage.reload();
      await expect(guidePage.getByText("Receipt acknowledged", { exact: false })).toBeVisible();
    },
  );
  await runSuggestedWaypointWholePathScenarioStep(
    "guide_projection_shape",
    async () => {
      const guideDetailKeys = await guidePage.evaluate(async ({ relationshipId: relationship, suggestedWaypointId: suggestion }) => {
        const response = await fetch(
          `/guide/waypoint-suggestions/${encodeURIComponent(relationship)}/${encodeURIComponent(suggestion)}/detail`,
          { credentials: "same-origin", cache: "no-store" },
        );
        const result = await response.json();
        const data = typeof result === "object" && result !== null
          ? (result as { data?: unknown }).data
          : null;
        return typeof data === "object" && data !== null ? Object.keys(data).sort() : null;
      }, { relationshipId, suggestedWaypointId });
      expect(guideDetailKeys).toEqual([...GUIDE_DETAIL_KEYS].sort());
    },
  );

  await runSuggestedWaypointWholePathScenarioStep(
    "unrelated_role_denials",
    async () => {
      const unrelatedGuide = await actor(scenario, "unrelated-guide").context.newPage();
      const unrelatedExplorer = await actor(scenario, "unrelated-explorer").context.newPage();
      const endedExplorer = await actor(scenario, "ended-explorer").context.newPage();
      await expectUnavailable(unrelatedGuide, detailUrl);
      await expectUnavailable(unrelatedExplorer, `/explorer/waypoints/${suggestedWaypointId}`);
      await expectUnavailable(endedExplorer, `/explorer/waypoints/${suggestedWaypointId}`);
      await expectValueFreeDeniedPost(
        unrelatedGuide,
        `/guide/waypoint-suggestions/${relationshipId}/commands`,
        {
          kind: "guide.create_draft",
          operationId: randomUUID(),
          destination: "A denied synthetic target",
          why: "Authorization must decide this request.",
          arrivalSignals: ["No write occurs."],
        },
      );
      for (const deniedExplorer of [unrelatedExplorer, endedExplorer]) {
        await expectExplorerRelationshipUnavailablePost(
          deniedExplorer,
          `/explorer/waypoints/${suggestedWaypointId}/commands`,
          {
            kind: "explorer.mark_read",
            operationId: randomUUID(),
            versionId: randomUUID(),
          },
        );
      }
    },
  );

  await runSuggestedWaypointWholePathScenarioStep(
    "layout_accessibility",
    async () => {
      for (const page of [guidePage, explorerPage]) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
          .toBe(true);
        await noSeriousAxe(page);
      }
    },
  );
  return "passed";
}

test("runs the local complete-draft Guide-to-Explorer lifecycle", async ({}, testInfo) => {
  let secrets: SuggestedWaypointLocalSecrets | undefined;
  const viewport = testInfo.project.name === "narrow-chromium"
    ? { width: 390, height: 844 }
    : { width: 1_280, height: 900 };

  try {
    const result = await runSuggestedWaypointWholePath({
      environment: process.env,
      async loadSecrets() {
        secrets = await loadLocalSecrets();
        return secrets;
      },
      createDependencies(config, localSecrets) {
        return createSupabaseLocalFixtureDependencies(config, localSecrets, {
          resetLocalDatabase,
          executeFixtureSql,
        });
      },
      async createBrowser(config) {
        const browser = await chromium.launch({ headless: true });
        return Object.freeze({
          newContext: () =>
            browser.newContext({
              ...suggestedWaypointPlaywrightContextOptions(config),
              viewport,
            }),
          close: () => browser.close(),
        });
      },
      async runScenario(scenario) {
        if (!secrets) throw new Error("whole_path_secrets_missing");
        return runScenario(scenario, secrets);
      },
    });

    expect(result).toEqual({ status: "completed", result: "passed" });
  } finally {
    secrets = undefined;
  }
});
