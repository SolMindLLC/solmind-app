// Login step 6, sub-slice S6-1: the login route configuration (the step 5
// root's configuration and the AUTH-RLS-DEC-032 startup check), and the
// module boundary of the three S6-1 modules: the pepper source, this
// configuration and the contact normalizer. Every value is synthetic; no test
// reads `.env`, `.env.local` or any file holding a value (LRB-005 reads the
// value-free `.env.example`), and nothing here touches a database, the local
// Supabase stack, its mail catcher or the network. The step 5 root runs for
// real with fake database and delivery dependencies.

import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as contextBarrel from "../../context/index";
import * as supabaseBarrel from "../../supabase/index";
import * as authBarrel from "../index";
import {
  LOCAL_SMTP_LOOPBACK_HOSTS,
  LOCAL_SMTP_VERIFICATION_CODE_LIMITS,
  type LocalSmtpVerificationCodeTransportConfiguration,
} from "../localSmtpVerificationCodeDelivery";
import * as normalizerModule from "../loginContactNormalizer";
import * as configurationModule from "../loginRouteConfiguration";
import {
  LOGIN_VERIFICATION_DELIVERY_SETTINGS,
  checkLoginVerificationConfigurationAtStartup,
  loadLoginVerificationConfiguration,
} from "../loginRouteConfiguration";
import {
  VERIFICATION_CHALLENGE_LIMITS,
  type VerificationChallengeRpcClient,
} from "../verificationChallengeCallers";
import {
  createVerificationChallengeServices,
  type VerificationChallengeCompositionDependencies,
} from "../verificationChallengeComposition";
import { isVerificationCodePepper } from "../verificationCode";
import {
  VERIFICATION_CODE_DELIVERY_LIMITS,
  type VerificationCodeDeliveryRequest,
} from "../verificationCodeDelivery";
import {
  VERIFICATION_CODE_EMAIL_SENDER,
  VERIFICATION_CODE_EMAIL_WORDING,
} from "../verificationCodeEmailWording";
import * as pepperSourceModule from "../verificationPepperSource";
import {
  VERIFICATION_PEPPER_ENV,
  VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE,
  VERIFICATION_PEPPER_SOURCE_ERROR_CODE,
  VerificationPepperSourceError,
} from "../verificationPepperSource";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

// The register's published known-answer pepper (AUTH-RLS-DEC-032), in its
// base64url form without padding, and its known answer.
const KAT_PEPPER_BYTES = Buffer.from("SOLMIND-SYNTHETIC-TEST-PEPPER-01", "ascii");
const KAT_PEPPER_SETTING = "U09MTUlORC1TWU5USEVUSUMtVEVTVC1QRVBQRVItMDE";
const KAT_CHALLENGE_ID = "00000000-0000-4000-8000-000000000001";
const KAT_VERIFIER =
  "svf1:ecab5e52743c2befef754a1568a90e466dac2777d43c18162914acca44e8960d";
const EMAIL = "explorer.s61@synthetic.invalid";

const ENVIRONMENT: Readonly<Record<string, string | undefined>> = Object.freeze({
  [VERIFICATION_PEPPER_ENV]: KAT_PEPPER_SETTING,
});

const ISSUANCE_MIGRATION = "20260929010000_verification_issuance_abuse_limits.sql";
const ISSUANCE_DEFINITION = "create or replace function public.solmind_issue_verification_challenge(";

const MODULE_NAMES = [
  "verificationPepperSource",
  "loginRouteConfiguration",
  "loginContactNormalizer",
] as const;

// The modules other dormancy tests guard, which a non-test file may not name.
const OTHER_GUARDED_NAMES = [
  "sessionCookiePolicy",
  "loginCookieWriter",
  "loginSessionDuration",
  "userSessionCreationCaller",
  "loginIdentityBridge",
] as const;

beforeEach(() => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
});

afterEach(() => {
  for (const method of CONSOLE_METHODS) {
    expect(console[method]).not.toHaveBeenCalled();
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function textOf(value: unknown): string {
  return [
    (() => {
      try {
        return JSON.stringify(value) ?? "";
      } catch {
        return "";
      }
    })(),
    String(value),
    inspect(value, { showHidden: true, depth: 5 }),
    value instanceof Error
      ? `${value.name} ${value.message} ${value.stack ?? ""} ${String(value.cause ?? "")}`
      : "",
  ].join(" ");
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("expected the action to throw");
}

function expectPepperRefusal(action: () => unknown, secrets: ReadonlyArray<string>): void {
  const error = captureError(action);
  expect(error).toBeInstanceOf(VerificationPepperSourceError);
  expect((error as Error).message).toBe(VERIFICATION_PEPPER_SOURCE_ERROR_CODE);
  const text = textOf(error);
  for (const secret of secrets) {
    expect(text).not.toContain(secret);
  }
}

// The svf1 verifier computed directly, as the register fixes it.
function expectedVerifier(bytes: Buffer, challengeId: string, code: string): string {
  const message = ["solmind-verification-challenge-svf1", challengeId, "login", code].join("\n");
  return `svf1:${createHmac("sha256", bytes).update(message, "ascii").digest("hex")}`;
}

// The app root, or, when this file runs from a proposal folder that holds
// only new files, the live app's.
function appRoot(): string {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(testDirectory, "..", "..", "..", "..", "..");
  const proposalRoot = path.resolve(root, "..");
  if (
    !fs.existsSync(path.join(root, "supabase", "migrations")) &&
    path.basename(proposalRoot).includes("_proposed_")
  ) {
    return path.resolve(proposalRoot, "..", "solmind-app");
  }
  return root;
}

// A fake database seam: rpc() returns a request whose abortSignal() returns
// the awaitable answer, as postgrest-js's builder does. It records each call.
function fakeWiring() {
  const calls: Array<readonly [string, Readonly<Record<string, unknown>>]> = [];
  const rpcClient: VerificationChallengeRpcClient = {
    rpc: (functionName: string, args: Readonly<Record<string, unknown>>) => {
      calls.push([functionName, { ...args }]);
      return {
        abortSignal: () =>
          Promise.resolve({
            data: [
              {
                outcome:
                  functionName === "solmind_issue_verification_challenge" ? "issued" : "redeemed",
              },
            ],
            error: null,
          }),
      };
    },
  } as unknown as VerificationChallengeRpcClient;
  const requests: VerificationCodeDeliveryRequest[] = [];
  const transports: LocalSmtpVerificationCodeTransportConfiguration[] = [];
  const wiring = {
    createRpcClient: () => rpcClient,
    createDeliveryTransport: (configuration: LocalSmtpVerificationCodeTransportConfiguration) => {
      transports.push(configuration);
      return {
        send: async (request: VerificationCodeDeliveryRequest) => {
          requests.push({ ...request });
          return "accepted" as const;
        },
      };
    },
  } as VerificationChallengeCompositionDependencies;
  return { wiring, calls, requests, transports };
}

describe("loginRouteConfiguration - the step 5 root's configuration and the startup check", () => {
  it("LRC-001 fixes the delivery settings within the banked transport, boundary and caller limits", () => {
    expect(LOGIN_VERIFICATION_DELIVERY_SETTINGS).toEqual({
      localSmtpHost: "127.0.0.1",
      localSmtpPort: 54325,
      deliveryTimeoutMilliseconds: 5_000,
      rpcTimeoutMilliseconds: 6_000,
    });
    expect(Object.isFrozen(LOGIN_VERIFICATION_DELIVERY_SETTINGS)).toBe(true);
    const settings = LOGIN_VERIFICATION_DELIVERY_SETTINGS;
    expect(LOCAL_SMTP_LOOPBACK_HOSTS as ReadonlyArray<string>).toContain(settings.localSmtpHost);
    expect(Number.isSafeInteger(settings.localSmtpPort)).toBe(true);
    for (const [minimum, maximum] of [
      [
        VERIFICATION_CODE_DELIVERY_LIMITS.minimumTimeoutMilliseconds,
        VERIFICATION_CODE_DELIVERY_LIMITS.maximumTimeoutMilliseconds,
      ],
      [
        LOCAL_SMTP_VERIFICATION_CODE_LIMITS.minimumTimeoutMilliseconds,
        LOCAL_SMTP_VERIFICATION_CODE_LIMITS.maximumTimeoutMilliseconds,
      ],
    ]) {
      expect(settings.deliveryTimeoutMilliseconds).toBeGreaterThanOrEqual(minimum);
      expect(settings.deliveryTimeoutMilliseconds).toBeLessThanOrEqual(maximum);
    }
    expect(settings.rpcTimeoutMilliseconds).toBeGreaterThanOrEqual(
      VERIFICATION_CHALLENGE_LIMITS.minimumRpcTimeoutMilliseconds,
    );
    expect(settings.rpcTimeoutMilliseconds).toBeLessThanOrEqual(
      VERIFICATION_CHALLENGE_LIMITS.maximumRpcTimeoutMilliseconds,
    );
  });

  it("LRC-002 uses the local mail catcher's SMTP port that supabase/config.toml publishes", () => {
    const toml = fs.readFileSync(path.join(appRoot(), "supabase", "config.toml"), "utf8");
    const lines = toml.split(/\r?\n/);
    const start = lines.indexOf("[inbucket]");
    expect(start).toBeGreaterThanOrEqual(0);
    const next = lines.findIndex((line, index) => index > start && /^\[/.test(line));
    const section = lines.slice(start + 1, next === -1 ? lines.length : next);
    expect(section).toContain("enabled = true");
    const ports = section.filter((line) => /^smtp_port\s*=/.test(line));
    expect(ports).toHaveLength(1);
    expect(Number(/^smtp_port\s*=\s*(\d+)\s*$/.exec(ports[0])?.[1])).toBe(
      LOGIN_VERIFICATION_DELIVERY_SETTINGS.localSmtpPort,
    );
  });

  it("LRC-003 sets the caller response deadline longer than the issuance function's two lock waits", () => {
    const migrations = path.join(appRoot(), "supabase", "migrations");
    const definers = fs
      .readdirSync(migrations)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .filter((name) => fs.readFileSync(path.join(migrations, name), "utf8").includes(ISSUANCE_DEFINITION));
    expect(definers[definers.length - 1]).toBe(ISSUANCE_MIGRATION);
    const sql = fs.readFileSync(path.join(migrations, ISSUANCE_MIGRATION), "utf8");
    const start = sql.indexOf(ISSUANCE_DEFINITION);
    const body = sql.slice(start, sql.indexOf("\n$$;", start));
    const lockTimeouts = [...body.matchAll(/set lock_timeout = '(\d+)ms'/g)].map((match) => Number(match[1]));
    expect(lockTimeouts).toEqual([2_000]);
    const locks = body.match(/pg_catalog\.pg_advisory_xact_lock\(/g) ?? [];
    expect(locks).toHaveLength(2);
    expect(LOGIN_VERIFICATION_DELIVERY_SETTINGS.rpcTimeoutMilliseconds).toBeGreaterThan(
      locks.length * lockTimeouts[0],
    );
  });

  it("LRC-004 loads exactly the root's configuration: one frozen plain object with five own data keys, the pepper a fresh opaque handle", () => {
    const configuration = loadLoginVerificationConfiguration(ENVIRONMENT);
    expect(Object.isFrozen(configuration)).toBe(true);
    expect(Object.getPrototypeOf(configuration)).toBe(Object.prototype);
    expect(Reflect.ownKeys(configuration)).toEqual([
      "pepper",
      "localSmtpHost",
      "localSmtpPort",
      "deliveryTimeoutMilliseconds",
      "rpcTimeoutMilliseconds",
    ]);
    for (const key of Reflect.ownKeys(configuration)) {
      const descriptor = Object.getOwnPropertyDescriptor(configuration, key);
      expect(descriptor?.enumerable).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(descriptor, "value")).toBe(true);
    }
    expect(isVerificationCodePepper(configuration.pepper)).toBe(true);
    expect(configuration).toMatchObject({
      localSmtpHost: "127.0.0.1",
      localSmtpPort: 54325,
      deliveryTimeoutMilliseconds: 5_000,
      rpcTimeoutMilliseconds: 6_000,
    });
    expect(loadLoginVerificationConfiguration(ENVIRONMENT).pepper).not.toBe(configuration.pepper);
    expect(textOf(configuration)).not.toContain(KAT_PEPPER_SETTING);
    expect(textOf(configuration)).not.toContain("SOLMIND-SYNTHETIC-TEST-PEPPER-01");
  });

  it("LRC-005 is accepted by the real step 5 root, which wires the transport with these settings and keys both callers with the loaded pepper", async () => {
    const fake = fakeWiring();
    const services = createVerificationChallengeServices(
      loadLoginVerificationConfiguration(ENVIRONMENT),
      fake.wiring,
    );
    expect(fake.transports).toEqual([
      {
        host: "127.0.0.1",
        port: 54325,
        sender: VERIFICATION_CODE_EMAIL_SENDER,
        wording: VERIFICATION_CODE_EMAIL_WORDING,
        timeoutMilliseconds: 5_000,
      },
    ]);

    const issued = await services.issuer.issue({
      purpose: "login",
      contactMethodType: "email",
      normalizedContact: EMAIL,
      userAccountId: null,
      userContactMethodId: null,
    });
    expect(issued).toMatchObject({ outcome: "issued", delivery: "accepted" });
    expect(fake.requests).toHaveLength(1);
    const [issuance] = fake.calls;
    expect(issuance[0]).toBe("solmind_issue_verification_challenge");
    expect(issuance[1].p_verifier).toBe(
      expectedVerifier(KAT_PEPPER_BYTES, issued.challengeId, fake.requests[0].code),
    );

    const redeemed = await services.redeemer.redeem({
      purpose: "login",
      challengeId: KAT_CHALLENGE_ID,
      code: "000000",
    });
    expect(redeemed).toEqual({ outcome: "redeemed" });
    expect(fake.calls[1][0]).toBe("solmind_redeem_verification_challenge");
    expect(fake.calls[1][1].p_verifier).toBe(KAT_VERIFIER);
  });

  it("LRC-006 fails closed with the pepper source's one fixed error, from the loader and from the startup check", () => {
    const sentinel = "SENTINEL-S61-ROUTE-CONFIGURATION";
    const refused: ReadonlyArray<Readonly<Record<string, string | undefined>>> = [
      {},
      { [VERIFICATION_PEPPER_ENV]: "" },
      { [VERIFICATION_PEPPER_ENV]: `${KAT_PEPPER_SETTING}=` },
      { [VERIFICATION_PEPPER_ENV]: `${sentinel}${sentinel}${sentinel}` },
      { [VERIFICATION_PEPPER_ENV]: KAT_PEPPER_SETTING, [VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE]: sentinel },
    ];
    for (const environment of refused) {
      expectPepperRefusal(() => loadLoginVerificationConfiguration(environment), [KAT_PEPPER_SETTING, sentinel]);
      expectPepperRefusal(
        () => checkLoginVerificationConfigurationAtStartup(environment),
        [KAT_PEPPER_SETTING, sentinel],
      );
    }
  });

  it("LRC-007 the startup check returns nothing on success and reads only the two pepper names, once each", () => {
    const reads: string[] = [];
    const recording = new Proxy({ ...ENVIRONMENT } as Record<string, string | undefined>, {
      get(target, key, receiver) {
        reads.push(String(key));
        return Reflect.get(target, key, receiver);
      },
    });
    expect(checkLoginVerificationConfigurationAtStartup(recording)).toBeUndefined();
    expect(reads).toEqual([VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE, VERIFICATION_PEPPER_ENV]);
  });

  it("LRC-008 reads process.env by default", () => {
    vi.stubEnv(VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE, undefined);
    vi.stubEnv(VERIFICATION_PEPPER_ENV, KAT_PEPPER_SETTING);
    expect(checkLoginVerificationConfigurationAtStartup()).toBeUndefined();
    expect(isVerificationCodePepper(loadLoginVerificationConfiguration().pepper)).toBe(true);
    vi.stubEnv(VERIFICATION_PEPPER_ENV, undefined);
    expectPepperRefusal(() => checkLoginVerificationConfigurationAtStartup(), []);
  });
});

describe("login step 6 sub-slice S6-1 - module boundary (dormant, off every barrel)", () => {
  type ModuleReference = Readonly<{ form: string; specifier: string | null; typeOnly: boolean }>;

  function moduleText(name: string): string {
    return fs.readFileSync(fileURLToPath(new URL(`../${name}.ts`, import.meta.url)), "utf8");
  }

  // Every module reference in a file, found with TypeScript's own parser, as
  // the login step 5 boundary test does: static imports, side-effect imports,
  // re-exports, `import x = require()`, dynamic `import()`, `require()` calls,
  // `typeof import()` types, any other value use of `require`, and any use of
  // `import.meta`. A reference whose argument is not one string literal has a
  // null specifier.
  function moduleReferences(fileName: string, text: string): ModuleReference[] {
    const kind = /\.[jt]sx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
    const references: ModuleReference[] = [];
    const literal = (node: ts.Node | undefined): string | null =>
      node !== undefined && ts.isStringLiteralLike(node) ? node.text : null;
    function visit(node: ts.Node): void {
      if (ts.isImportDeclaration(node)) {
        references.push({
          form: "import",
          specifier: literal(node.moduleSpecifier),
          typeOnly: node.importClause?.isTypeOnly === true,
        });
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
        references.push({ form: "export-from", specifier: literal(node.moduleSpecifier), typeOnly: node.isTypeOnly });
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        references.push({ form: "import-equals", specifier: literal(node.moduleReference.expression), typeOnly: false });
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        references.push({
          form: "dynamic-import",
          specifier: node.arguments.length === 1 ? literal(node.arguments[0]) : null,
          typeOnly: false,
        });
      } else if (ts.isImportTypeNode(node)) {
        const argument = node.argument;
        references.push({
          form: "import-type",
          specifier:
            ts.isLiteralTypeNode(argument) && ts.isStringLiteralLike(argument.literal)
              ? argument.literal.text
              : null,
          typeOnly: true,
        });
      } else if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
        references.push({ form: "import-meta", specifier: null, typeOnly: false });
      } else if (ts.isIdentifier(node) && node.text === "require") {
        const parent = node.parent;
        if (ts.isCallExpression(parent) && parent.expression === node) {
          references.push({
            form: "require",
            specifier: parent.arguments.length === 1 ? literal(parent.arguments[0]) : null,
            typeOnly: false,
          });
        } else if (!(ts.isPropertyAccessExpression(parent) && parent.name === node) && !ts.isExternalModuleReference(parent)) {
          references.push({ form: "require-reference", specifier: null, typeOnly: false });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return references;
  }

  // The string literals in a file's code (comments are not code).
  function stringLiterals(fileName: string, text: string): string[] {
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const found: string[] = [];
    function visit(node: ts.Node): void {
      if (ts.isStringLiteralLike(node)) {
        found.push(node.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return found;
  }

  // Every use of the identifier `process` in a file's code (comments are not
  // code): "environment default" for `process.env` as the default value of a
  // parameter named `environment`, and the use's own text otherwise.
  function processUses(fileName: string, text: string): string[] {
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const uses: string[] = [];
    function visit(node: ts.Node): void {
      if (ts.isIdentifier(node) && node.text === "process") {
        const access = node.parent;
        const parameter = access.parent;
        if (
          ts.isPropertyAccessExpression(access) &&
          access.expression === node &&
          access.name.text === "env" &&
          parameter !== undefined &&
          ts.isParameter(parameter) &&
          parameter.initializer === access &&
          ts.isIdentifier(parameter.name) &&
          parameter.name.text === "environment"
        ) {
          uses.push("environment default");
        } else {
          uses.push(access.getText(source));
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return uses;
  }

  // The app's source root, or, when this file runs from a proposal folder
  // that holds only new files, the live app's.
  function sourceRoot(): string {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(testDirectory, "..", "..", "..", "..");
    const proposalRoot = path.resolve(root, "..", "..");
    if (
      !fs.existsSync(path.join(root, "lib", "solmind", "auth", "index.ts")) &&
      path.basename(proposalRoot).includes("_proposed_")
    ) {
      return path.resolve(proposalRoot, "..", "solmind-app", "src");
    }
    return root;
  }

  function sourceFiles(directory: string): string[] {
    const found: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        found.push(...sourceFiles(entryPath));
      } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) {
        found.push(entryPath);
      }
    }
    return found;
  }

  // A relative or `@/` specifier as a lowercased path without its extension;
  // a package specifier gives null.
  function resolveReference(fromFile: string, specifier: string, root: string): string | null {
    let target: string;
    if (specifier.startsWith("@/")) {
      target = path.join(root, specifier.slice(2));
    } else if (specifier.startsWith(".")) {
      target = path.resolve(path.dirname(fromFile), specifier);
    } else {
      return null;
    }
    return target.replace(/\.(?:[cm]?[jt]sx?)$/, "").toLowerCase();
  }

  it("LRB-001 the two server modules start with the server-only import and import only what they need; the route configuration's import of the step 5 root is type-only; the normalizer imports nothing", () => {
    const references = (name: string) =>
      moduleReferences(`${name}.ts`, moduleText(name)).map(
        (reference) => `${reference.form}${reference.typeOnly ? " type" : ""} ${reference.specifier}`,
      );
    expect(moduleText("verificationPepperSource").startsWith('import "server-only";')).toBe(true);
    expect(moduleText("loginRouteConfiguration").startsWith('import "server-only";')).toBe(true);
    expect(references("verificationPepperSource")).toEqual([
      "import server-only",
      "import node:buffer",
      "import ./verificationCode",
    ]);
    expect(references("loginRouteConfiguration")).toEqual([
      "import server-only",
      "import type ./verificationChallengeComposition",
      "import ./verificationPepperSource",
    ]);
    expect(references("loginContactNormalizer")).toEqual([]);
    expect(moduleText("loginContactNormalizer")).not.toContain("server-only");
    for (const name of MODULE_NAMES) {
      const text = moduleText(name);
      expect(text.charCodeAt(0), name).not.toBe(0xfeff);
      // ASCII only.
      expect(/^[\x09\x0a\x20-\x7e]*$/.test(text), name).toBe(true);
    }
  });

  it("LRB-002 only the pepper source names the pepper's variables; process.env appears only as a default argument; nothing logs, fetches, stores, writes a cookie or names a module another dormancy test guards", () => {
    const pepperText = moduleText("verificationPepperSource");
    const configurationText = moduleText("loginRouteConfiguration");
    const normalizerText = moduleText("loginContactNormalizer");
    for (const [name, text] of [
      ["pepper source", pepperText],
      ["route configuration", configurationText],
      ["normalizer", normalizerText],
    ] as const) {
      expect(text, name).not.toMatch(
        /console\.|\bfetch\s*\(|localStorage|sessionStorage|document\.cookie|cookies\s*\(|["']use server["']|Math\.random|Date\.now|performance\.now|setTimeout|import\.meta|@supabase|next\/|\.rpc\(/,
      );
      for (const guarded of OTHER_GUARDED_NAMES) {
        expect(new RegExp(`\\b${guarded}\\b`).test(text), `${name} mentions ${guarded}`).toBe(false);
      }
    }
    // The pepper's two names are string literals only in the pepper source.
    expect(stringLiterals("verificationPepperSource.ts", pepperText)).toEqual(
      expect.arrayContaining([VERIFICATION_PEPPER_ENV, VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE]),
    );
    expect(
      stringLiterals("verificationPepperSource.ts", pepperText).filter((text) => text.startsWith("NEXT_PUBLIC_")),
    ).toEqual([VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE]);
    for (const [name, text] of [
      ["loginRouteConfiguration.ts", configurationText],
      ["loginContactNormalizer.ts", normalizerText],
    ] as const) {
      expect(
        stringLiterals(name, text).filter((literal) => /SOLMIND_|NEXT_PUBLIC_/.test(literal)),
        name,
      ).toEqual([]);
    }
    // In code, `process` appears only as `process.env`, and only as the
    // default value of a parameter named `environment`: once in the pepper
    // source and twice in the route configuration.
    expect(processUses("verificationPepperSource.ts", pepperText)).toEqual(["environment default"]);
    expect(processUses("loginRouteConfiguration.ts", configurationText)).toEqual([
      "environment default",
      "environment default",
    ]);
    expect(processUses("loginContactNormalizer.ts", normalizerText)).toEqual([]);
    // The normalizer reads no clock.
    expect(normalizerText).not.toMatch(/\bnew Date\b|\bDate\(/);
    // Only these runtime exports.
    expect(Object.keys(pepperSourceModule).sort()).toEqual(
      [
        "VERIFICATION_PEPPER_ENV",
        "VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE",
        "VERIFICATION_PEPPER_SOURCE_ERROR_CODE",
        "VERIFICATION_PEPPER_SOURCE_LIMITS",
        "VerificationPepperSourceError",
        "loadVerificationPepper",
      ].sort(),
    );
    expect(Object.keys(configurationModule).sort()).toEqual(
      [
        "LOGIN_VERIFICATION_DELIVERY_SETTINGS",
        "checkLoginVerificationConfigurationAtStartup",
        "loadLoginVerificationConfiguration",
      ].sort(),
    );
    expect(Object.keys(normalizerModule).sort()).toEqual(
      ["LOGIN_CONTACT_NORMALIZER_LIMITS", "normalizeLoginEmail"].sort(),
    );
  });

  it("LRB-003 is not exported from any barrel", () => {
    for (const exportedName of [
      ...Object.keys(pepperSourceModule),
      ...Object.keys(configurationModule),
      ...Object.keys(normalizerModule),
    ]) {
      expect(exportedName in authBarrel, exportedName).toBe(false);
      expect(exportedName in supabaseBarrel, exportedName).toBe(false);
      expect(exportedName in contextBarrel, exportedName).toBe(false);
    }
    const root = sourceRoot();
    const barrels = sourceFiles(root).filter((file) => /^index\.(?:[cm]?[jt]sx?)$/.test(path.basename(file)));
    expect(barrels).toContain(path.join(root, "lib", "solmind", "auth", "index.ts"));
    expect(barrels).toContain(path.join(root, "lib", "solmind", "supabase", "index.ts"));
    for (const barrel of barrels) {
      const text = fs.readFileSync(barrel, "utf8");
      for (const name of MODULE_NAMES) {
        expect(text, barrel).not.toContain(name);
      }
    }
  });

  it("LRB-004 is dormant: no other application file references or names the three modules, and the login step 5 boundary test guards them too", () => {
    // Computed references and `import.meta` in any non-test file are refused
    // by the login step 5 boundary test (VCB-004), so the literal references
    // found here are all the references there are. The route configuration
    // may import the pepper source; nothing else may reach any of the three.
    const root = sourceRoot();
    const guarded = new Set(
      MODULE_NAMES.map((name) => path.join(root, "lib", "solmind", "auth", name).toLowerCase()),
    );
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      if (/\.test\.[cm]?[jt]sx?$/.test(file)) {
        continue;
      }
      const withoutExtension = file.replace(/\.(?:[cm]?[jt]sx?)$/, "").toLowerCase();
      if (guarded.has(withoutExtension)) {
        continue;
      }
      const text = fs.readFileSync(file, "utf8");
      for (const reference of moduleReferences(file, text)) {
        if (reference.specifier === null) {
          continue;
        }
        const resolved = resolveReference(file, reference.specifier, root);
        if (resolved !== null && guarded.has(resolved)) {
          offenders.push(`${path.relative(root, file)}: ${reference.form} ${reference.specifier}`);
        }
      }
      for (const name of MODULE_NAMES) {
        if (new RegExp(`\\b${name}\\b`).test(text)) {
          offenders.push(`${path.relative(root, file)}: mentions ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);

    // Controls: a literal import from another file, and a mention by name,
    // are both found.
    const probe = path.join(root, "lib", "solmind", "other", "probe.ts");
    const found = (text: string) =>
      moduleReferences(probe, text)
        .filter((reference) => reference.specifier !== null)
        .map((reference) => resolveReference(probe, reference.specifier as string, root));
    expect(found('import { x } from "../auth/verificationPepperSource";')).toEqual([
      path.join(root, "lib", "solmind", "auth", "verificationPepperSource").toLowerCase(),
    ]);
    expect(found('import { y } from "@/lib/solmind/auth/loginContactNormalizer.ts";')).toEqual([
      path.join(root, "lib", "solmind", "auth", "loginContactNormalizer").toLowerCase(),
    ]);
    expect(found('const m = await import("../auth/loginRouteConfiguration");')).toEqual([
      path.join(root, "lib", "solmind", "auth", "loginRouteConfiguration").toLowerCase(),
    ]);

    // The login step 5 boundary test's guarded list names all three.
    const step5Test = fs.readFileSync(
      fileURLToPath(new URL("./verificationChallengeComposition.test.ts", import.meta.url)),
      "utf8",
    );
    const guardedList = /const guardedNames = \[([\s\S]*?)\] as const;/.exec(step5Test);
    expect(guardedList).not.toBeNull();
    for (const name of MODULE_NAMES) {
      expect((guardedList as RegExpExecArray)[1]).toContain(`"${name}"`);
    }
  });

  it("LRB-005 .env.example lists the pepper's variable with an empty value and never its public name", () => {
    const example = fs.readFileSync(path.join(appRoot(), ".env.example"), "utf8");
    const lines = example.split(/\r?\n/);
    expect(lines.filter((line) => line.startsWith(`${VERIFICATION_PEPPER_ENV}=`))).toEqual([
      `${VERIFICATION_PEPPER_ENV}=`,
    ]);
    expect(lines.some((line) => line.startsWith(`${VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE}=`))).toBe(false);
    expect(example).not.toContain(KAT_PEPPER_SETTING);
  });
});
