import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS } from "../../onboarding";
import {
  SOLMIND_GUIDE_EXPLORER_RELATIONSHIP_STATUSES,
  SOLMIND_SUMMARY_PUBLICATION_STATUSES,
  SOLMIND_SUMMARY_REVISION_STATUSES,
  SOLMIND_SUMMARY_SECTION_TYPES,
  SOLMIND_SUMMARY_SECTION_VISIBILITIES,
  SOLMIND_SUMMARY_STATUSES,
  SOLMIND_SUMMARY_TYPES,
} from "../explorerContext";
import {
  EXPLORER_ONBOARDING_CONTINUITY_FIELDS,
  EXPLORER_SAFE_CONTEXT_ERROR_CODES,
  EXPLORER_SAFE_CONTEXT_LIMITS,
  ExplorerSafeContextValidationError,
  assembleExplorerSafeContext,
} from "../explorerSafeContext";

const IDS = {
  explorer: "11111111-1111-4111-8111-111111111111",
  session: "22222222-2222-4222-8222-222222222222",
  binding: "33333333-3333-4333-8333-333333333333",
  focus: "44444444-4444-4444-8444-444444444444",
  reflection: "55555555-5555-4555-8555-555555555555",
  summary: "66666666-6666-4666-8666-666666666666",
  snapshot: "77777777-7777-4777-8777-777777777777",
  onboarding: "88888888-8888-4888-8888-888888888888",
  history: "99999999-9999-4999-8999-999999999999",
  immediate: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
} as const;

function validInput(): Record<string, unknown> {
  return {
    contractVersion: "wi007-v0.1",
    aiRole: "solmind_virtual_guide",
    actorRoleContext: "explorer",
    explorerBinding: {
      explorerId: IDS.explorer,
      sessionId: IDS.session,
      continuityBindingId: IDS.binding,
    },
    globalPolicy: { version: "global-v1", text: "Global policy" },
    roleBehavior: { version: "role-v1", text: "Virtual Guide behavior" },
    crisisBehavior: { version: "crisis-v1", text: "Crisis behavior" },
    methodologyContext: {
      version: "methodology-v1",
      text: "Approved methodology",
    },
    sessionContext: {
      sessionType: "explorer_virtual_guide",
      explorerId: IDS.explorer,
      sessionId: IDS.session,
      continuityBindingId: IDS.binding,
      explorerDisplayName: "Morgan Lee",
      activeFocusItems: [
        { id: IDS.focus, order: 0, text: "Prepare for the next conversation" },
      ],
      nextAppointment: {
        startsAt: "2026-08-07T15:30:00.000Z",
        timezone: "America/Chicago",
        mode: "video",
        status: "confirmed",
        location: null,
        channel: "Secure video",
      },
      explorerSafeGuardrail: "Use a calm pace and ask before reframing.",
    },
    continuityCandidates: [
      {
        kind: "reflection",
        sourceId: IDS.reflection,
        order: 0,
        explorerId: IDS.explorer,
        sessionId: IDS.session,
        continuityBindingId: IDS.binding,
        confirmationStatus: "confirmed",
        visibility: "explorer_and_guide",
        content: "I want to preserve my own wording.",
      },
      {
        kind: "summary",
        sourceId: IDS.summary,
        order: 1,
        explorerId: IDS.explorer,
        sessionId: IDS.session,
        continuityBindingId: IDS.binding,
        summaryType: "explorer_facing_summary",
        summaryStatus: "published",
        publicationStatus: "published",
        relationshipStatus: "active",
        revisionStatus: "published_to_explorer",
        sectionType: "explorer_facing",
        sectionVisibility: "published_to_explorer",
        content: "Published Explorer-visible continuity.",
      },
      {
        kind: "shared_snapshot",
        sourceId: IDS.snapshot,
        order: 2,
        explorerId: IDS.explorer,
        sessionId: IDS.session,
        continuityBindingId: IDS.binding,
        confirmationStatus: "confirmed",
        content: "Exact selected Shared Snapshot content.",
      },
      {
        kind: "onboarding_answer",
        sourceId: IDS.onboarding,
        order: 3,
        explorerId: IDS.explorer,
        sessionId: IDS.session,
        continuityBindingId: IDS.binding,
        field: "supportNow",
        content: "Keeping priorities clear.",
      },
    ],
    currentSessionMessages: [
      {
        messageId: IDS.history,
        order: 0,
        explorerId: IDS.explorer,
        sessionId: IDS.session,
        role: "solmind_virtual_guide",
        content: "What feels most important today?",
      },
    ],
    immediateExplorerMessage: {
      messageId: IDS.immediate,
      explorerId: IDS.explorer,
      sessionId: IDS.session,
      role: "explorer",
      content: "I want to start with my next conversation.",
    },
    outputRequirements: {
      format: "plain_text",
      includeCitations: false,
      allowMarkdown: false,
    },
  };
}

function expectCode(input: unknown, code: string): void {
  try {
    assembleExplorerSafeContext(input);
    throw new Error("expected validation failure");
  } catch (error) {
    expect(error).toBeInstanceOf(ExplorerSafeContextValidationError);
    expect((error as ExplorerSafeContextValidationError).code).toBe(code);
    expect((error as Error).message).toBe(code);
    expect(JSON.stringify(error)).not.toContain("Morgan");
  }
}

function setNested(
  input: Record<string, unknown>,
  path: ReadonlyArray<string>,
  value: unknown,
): void {
  let cursor = input;
  for (const key of path.slice(0, -1)) {
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
}

function extractConstraintValues(
  source: string,
  constraintName: string,
  nextConstraintName: string,
): ReadonlyArray<string> {
  const addedMarker = `add constraint ${constraintName}`;
  const nextAddedMarker = `add constraint ${nextConstraintName}`;
  const start = source.includes(addedMarker)
    ? source.indexOf(addedMarker)
    : source.indexOf(`constraint ${constraintName}`);
  const end = source.includes(nextAddedMarker, start + 1)
    ? source.indexOf(nextAddedMarker, start + 1)
    : source.indexOf(`constraint ${nextConstraintName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return [...source.slice(start, end).matchAll(/'([^']+)'/g)].map(
    (match) => match[1],
  );
}

describe("PRJ01_R-WS09-WI021-S03A Explorer-safe context kernel", () => {
  it("CTX-024 assembles the exact identity prefix and nine layers in order", () => {
    const result = assembleExplorerSafeContext(validInput());
    expect(Object.keys(result.context)).toEqual([
      "contractVersion",
      "aiRole",
      "actorRoleContext",
      "globalPolicy",
      "roleBehavior",
      "crisisBehavior",
      "methodologyContext",
      "sessionContext",
      "approvedContinuity",
      "currentSessionMessages",
      "immediateExplorerMessage",
      "outputRequirements",
    ]);
    expect(result.context.approvedContinuity.map((item) => item.kind)).toEqual([
      "reflection",
      "summary",
      "shared_snapshot",
      "onboarding_answer",
    ]);
    expect(JSON.parse(result.serialized)).toEqual(result.context);
  });

  it("CTX-024 accepts a minimal context without optional session values", () => {
    const input = validInput();
    input.continuityCandidates = [];
    input.currentSessionMessages = [];
    input.sessionContext = {
      ...(input.sessionContext as Record<string, unknown>),
      explorerDisplayName: null,
      activeFocusItems: [],
      nextAppointment: null,
      explorerSafeGuardrail: null,
    };
    const result = assembleExplorerSafeContext(input);
    expect(result.context.approvedContinuity).toEqual([]);
    expect(result.context.currentSessionMessages).toEqual([]);
  });

  it("CTX-025 rejects non-plain and malformed envelopes", () => {
    for (const value of [null, [], "value", 1, new Date()]) {
      expectCode(value, "explorer_context_invalid_envelope");
    }
  });

  it("CTX-025 rejects unknown keys at the top level and every nested family", () => {
    const mutations: Array<(input: Record<string, unknown>) => void> = [
      (input) => {
        input.unreviewed = true;
      },
      (input) => {
        (input.globalPolicy as Record<string, unknown>).unreviewed = true;
      },
      (input) => {
        (input.explorerBinding as Record<string, unknown>).unreviewed = true;
      },
      (input) => {
        (input.sessionContext as Record<string, unknown>).unreviewed = true;
      },
      (input) => {
        ((input.continuityCandidates as unknown[])[0] as Record<string, unknown>)[
          "unreviewed"
        ] = true;
      },
      (input) => {
        ((input.currentSessionMessages as unknown[])[0] as Record<string, unknown>)[
          "unreviewed"
        ] = true;
      },
      (input) => {
        (input.outputRequirements as Record<string, unknown>).unreviewed = true;
      },
    ];
    for (const mutate of mutations) {
      const input = validInput();
      mutate(input);
      expectCode(input, "explorer_context_unknown_key");
    }
  });

  it("CTX-025 uses a stable first error and returns no partial result", () => {
    const input = validInput();
    delete input.globalPolicy;
    input.unreviewed = "SM_CANARY_PRIVATE_DRAFT_4J8N2X";
    for (let run = 0; run < 5; run += 1) {
      expectCode(input, "explorer_context_unknown_key");
    }
  });

  it("CTX-028 permits only Virtual Guide plus Explorer", () => {
    const wrongAiRole = validInput();
    wrongAiRole.aiRole = "solmind_guide_assistant";
    expectCode(wrongAiRole, "explorer_context_invalid_role_alignment");

    const wrongActor = validInput();
    wrongActor.actorRoleContext = "guide";
    expectCode(wrongActor, "explorer_context_invalid_role_alignment");
  });

  it("CTX-028 fails other-Explorer and other-session bindings before content", () => {
    const otherExplorer = validInput();
    ((otherExplorer.continuityCandidates as unknown[])[0] as Record<string, unknown>)[
      "explorerId"
    ] = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    ((otherExplorer.continuityCandidates as unknown[])[0] as Record<string, unknown>)[
      "content"
    ] = "SM_CANARY_OTHER_EXPLORER_7C5N9V";
    expectCode(otherExplorer, "explorer_context_invalid_role_alignment");

    const otherSession = validInput();
    ((otherSession.currentSessionMessages as unknown[])[0] as Record<string, unknown>)[
      "sessionId"
    ] = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    expectCode(otherSession, "explorer_context_invalid_role_alignment");

    const otherContinuityBinding = validInput();
    ((otherContinuityBinding.continuityCandidates as unknown[])[0] as Record<
      string,
      unknown
    >).continuityBindingId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    expectCode(
      otherContinuityBinding,
      "explorer_context_invalid_role_alignment",
    );
  });

  it("omits canonically ineligible Reflection and Summary candidates", () => {
    const input = validInput();
    const candidates = input.continuityCandidates as Array<Record<string, unknown>>;
    candidates[0].visibility = "paused_from_ai_context";
    candidates[0].content = "SM_CANARY_PRIVATE_WAYPOINT_5V9C3R";
    candidates[1].publicationStatus = "unpublished";
    candidates[1].content = "SM_CANARY_PRIVATE_DRAFT_4J8N2X";
    const result = assembleExplorerSafeContext(input);
    expect(result.context.approvedContinuity.map((item) => item.kind)).toEqual([
      "shared_snapshot",
      "onboarding_answer",
    ]);
    expect(result.serialized).not.toContain("SM_CANARY_PRIVATE_WAYPOINT_5V9C3R");
    expect(result.serialized).not.toContain("SM_CANARY_PRIVATE_DRAFT_4J8N2X");
  });

  it("omits a Summary when any known publication-projection fact is ineligible", () => {
    const mutations: ReadonlyArray<{
      field: string;
      value: string;
    }> = [
      { field: "summaryStatus", value: "approved" },
      { field: "publicationStatus", value: "superseded" },
      { field: "relationshipStatus", value: "ended" },
      { field: "revisionStatus", value: "guide_approved" },
      { field: "sectionType", value: "guide_only" },
      { field: "sectionVisibility", value: "explorer_publishable" },
    ];

    for (const { field, value } of mutations) {
      const input = validInput();
      const summary = (input.continuityCandidates as Array<
        Record<string, unknown>
      >)[1];
      summary[field] = value;
      summary.content = `SM_CANARY_INELIGIBLE_SUMMARY_${field}`;
      const result = assembleExplorerSafeContext(input);
      expect(result.context.approvedContinuity.map((item) => item.kind)).toEqual([
        "reflection",
        "shared_snapshot",
        "onboarding_answer",
      ]);
      expect(result.serialized).not.toContain(summary.content as string);
    }
  });

  it("pins Summary vocabulary and Explorer projection facts to the banked migrations", () => {
    const migrationDirectory = fileURLToPath(
      new URL("../../../../../supabase/migrations/", import.meta.url),
    );
    const migrationFiles = readdirSync(migrationDirectory)
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort();
    const summaryMigration = readFileSync(
      fileURLToPath(
        new URL(
          "../../../../../supabase/migrations/20260812000000_summary_shared_snapshot_realignment.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    const relationshipMigration = readFileSync(
      fileURLToPath(
        new URL(
          "../../../../../supabase/migrations/20260613003000_core_organization_practice_profile_schema.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );

    expect(
      extractConstraintValues(
        summaryMigration,
        "summary_type_check",
        "summary_status_check",
      ),
    ).toEqual(SOLMIND_SUMMARY_TYPES);
    expect(
      extractConstraintValues(
        summaryMigration,
        "summary_status_check",
        "summary_created_by_actor_type_check",
      ),
    ).toEqual(SOLMIND_SUMMARY_STATUSES);
    expect(
      extractConstraintValues(
        summaryMigration,
        "summary_revision_status_check",
        "summary_revision_created_by_actor_type_check",
      ),
    ).toEqual(SOLMIND_SUMMARY_REVISION_STATUSES);
    expect(
      extractConstraintValues(
        summaryMigration,
        "summary_section_type_check",
        "summary_section_visibility_check",
      ),
    ).toEqual(SOLMIND_SUMMARY_SECTION_TYPES);
    expect(
      extractConstraintValues(
        summaryMigration,
        "summary_section_visibility_check",
        "summary_section_type_visibility_pair_check",
      ),
    ).toEqual(SOLMIND_SUMMARY_SECTION_VISIBILITIES);
    expect(
      extractConstraintValues(
        summaryMigration,
        "summary_publication_status_check",
        "summary_publication_end_fields_check",
      ),
    ).toEqual(SOLMIND_SUMMARY_PUBLICATION_STATUSES);
    expect(
      extractConstraintValues(
        relationshipMigration,
        "guide_explorer_relationship_status_check",
        "guide_explorer_relationship_retention_class_check",
      ),
    ).toEqual(SOLMIND_GUIDE_EXPLORER_RELATIONSHIP_STATUSES);

    expect(summaryMigration).toMatch(
      /where publication\.publication_status = 'published'\s+and revision\.revision_status = 'published_to_explorer'\s+and section\.section_type = 'explorer_facing'\s+and section\.visibility = 'published_to_explorer'\s+and relationship\.relationship_status in \('active', 'paused'\)/,
    );

    const currentOwnerChecks = [
      {
        owner: "20260613003000_core_organization_practice_profile_schema.sql",
        tokens: ["guide_explorer_relationship_status_check"],
      },
      {
        owner: "20260812000000_summary_shared_snapshot_realignment.sql",
        tokens: [
          "summary_type_check",
          "summary_status_check",
          "summary_revision_status_check",
          "summary_section_type_check",
          "summary_section_visibility_check",
          "summary_publication_status_check",
          "vw_explorer_published_summary_timeline",
        ],
      },
    ] as const;

    for (const { owner, tokens } of currentOwnerChecks) {
      const laterOwners = migrationFiles
        .filter((fileName) => fileName > owner)
        .filter((fileName) => {
          const source = readFileSync(
            fileURLToPath(
              new URL(
                `../../../../../supabase/migrations/${fileName}`,
                import.meta.url,
              ),
            ),
            "utf8",
          );
          return tokens.some((token) => source.includes(token));
        });
      expect(laterOwners).toEqual([]);
    }
  });

  it("rejects unknown and unconfirmed continuity kinds", () => {
    const unknown = validInput();
    ((unknown.continuityCandidates as unknown[])[0] as Record<string, unknown>)[
      "kind"
    ] = "guide_private_note";
    expectCode(unknown, "explorer_context_invalid_candidate_kind");

    const unconfirmed = validInput();
    ((unconfirmed.continuityCandidates as unknown[])[2] as Record<string, unknown>)[
      "confirmationStatus"
    ] = "proposed";
    expectCode(unconfirmed, "explorer_context_candidate_not_eligible");

    const unknownSummaryType = validInput();
    ((unknownSummaryType.continuityCandidates as unknown[])[1] as Record<
      string,
      unknown
    >).summaryType = "unreviewed_summary_type";
    expectCode(
      unknownSummaryType,
      "explorer_context_invalid_candidate_kind",
    );

    const unknownPublicationStatus = validInput();
    ((unknownPublicationStatus.continuityCandidates as unknown[])[1] as Record<
      string,
      unknown
    >).publicationStatus = "published_to_anyone";
    expectCode(
      unknownPublicationStatus,
      "explorer_context_invalid_candidate_kind",
    );

    const removedContainerVisibility = validInput();
    const staleSummary = (
      removedContainerVisibility.continuityCandidates as Array<
        Record<string, unknown>
      >
    )[1];
    staleSummary.visibility = "explorer_visible_after_approval";
    expectCode(removedContainerVisibility, "explorer_context_unknown_key");
  });

  it("accepts exactly the six banked onboarding fields in source order", () => {
    const bankedFields = SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.map(
      ({ key }) => key,
    );
    expect(EXPLORER_ONBOARDING_CONTINUITY_FIELDS).toEqual(bankedFields);

    for (const field of bankedFields) {
      const input = validInput();
      const candidates = input.continuityCandidates as Array<
        Record<string, unknown>
      >;
      candidates[3].field = field;
      const result = assembleExplorerSafeContext(input);
      const onboardingAnswer = result.context.approvedContinuity.find(
        (item) => item.kind === "onboarding_answer",
      );
      expect(onboardingAnswer).toMatchObject({
        kind: "onboarding_answer",
        field,
      });
    }
  });

  it("rejects every stale onboarding field and returns no partial result", () => {
    const staleFields = [
      "current_challenges",
      "desired_changes",
      "what_has_helped",
      "what_has_not_helped",
      "preferences",
      "anything_else",
      "unknown_field",
    ] as const;

    for (const field of staleFields) {
      const input = validInput();
      const candidates = input.continuityCandidates as Array<
        Record<string, unknown>
      >;
      candidates[3].field = field;
      expectCode(input, "explorer_context_invalid_candidate_kind");
    }
  });

  it("rejects duplicate identity, duplicate order, and missing order", () => {
    const duplicateIdentity = validInput();
    const candidates = duplicateIdentity.continuityCandidates as Array<Record<string, unknown>>;
    candidates[1].sourceId = candidates[0].sourceId;
    expectCode(duplicateIdentity, "explorer_context_duplicate_source");

    const duplicateOrder = validInput();
    (duplicateOrder.continuityCandidates as Array<Record<string, unknown>>)[1].order = 0;
    expectCode(duplicateOrder, "explorer_context_invalid_order");

    const missingOrder = validInput();
    (missingOrder.continuityCandidates as Array<Record<string, unknown>>)[3].order = 4;
    expectCode(missingOrder, "explorer_context_invalid_order");
  });

  it("CTX-026 keeps prohibited sentinel families absent from object and bytes", () => {
    const canaries = [
      "SM_CANARY_RAW_EXPLORER_7H4Q9M",
      "SM_CANARY_GUIDE_NOTE_8K2W6P",
      "SM_CANARY_PRIVATE_WAYPOINT_5V9C3R",
      "SM_CANARY_PRIVATE_DRAFT_4J8N2X",
      "SM_CANARY_EXCLUDED_SHARE_6P3T9B",
      "SM_CANARY_SAFETY_RECORD_2M7F5K",
      "SM_CANARY_ADMIN_AUDIT_9R4D6L",
      "SM_CANARY_PROVIDER_SECRET_3X8G2Q",
      "SM_CANARY_OTHER_EXPLORER_7C5N9V",
    ];
    for (const canary of canaries) {
      const input = validInput();
      const candidate = (input.continuityCandidates as Array<Record<string, unknown>>)[0];
      candidate.kind = "prohibited_family";
      candidate.content = canary;
      try {
        assembleExplorerSafeContext(input);
        throw new Error("expected validation failure");
      } catch (error) {
        const evidence = JSON.stringify(error);
        expect(evidence).not.toContain(canary);
        expect(new TextDecoder().decode(new TextEncoder().encode(evidence))).not.toContain(
          canary,
        );
      }
    }
  });

  it("normalizes line endings and outer whitespace without Unicode normalization", () => {
    const crlf = validInput();
    (crlf.immediateExplorerMessage as Record<string, unknown>).content =
      "  cafe\u0301\r\nsecond\rline  ";
    const result = assembleExplorerSafeContext(crlf);
    expect(result.context.immediateExplorerMessage.content).toBe(
      "cafe\u0301\nsecond\nline",
    );
    expect(result.context.immediateExplorerMessage.content).not.toBe(
      "caf\u00e9\nsecond\nline",
    );
  });

  it("rejects prohibited control, bidi, and invisible characters", () => {
    for (const prohibited of ["\u0000", "\u0009", "\u200b", "\u202e", "\u2066", "\ufeff"]) {
      const input = validInput();
      (input.immediateExplorerMessage as Record<string, unknown>).content =
        `before${prohibited}after`;
      expectCode(input, "explorer_context_invalid_text");
    }
  });

  it("enforces representative max-1, max, and max+1 text boundaries", () => {
    const cases: Array<{
      path: ReadonlyArray<string>;
      maximum: number;
    }> = [
      { path: ["contractVersion"], maximum: EXPLORER_SAFE_CONTEXT_LIMITS.versionLabelCharacters },
      { path: ["globalPolicy", "text"], maximum: EXPLORER_SAFE_CONTEXT_LIMITS.policyTextCharacters },
      { path: ["methodologyContext", "text"], maximum: EXPLORER_SAFE_CONTEXT_LIMITS.methodologyTextCharacters },
      { path: ["sessionContext", "explorerDisplayName"], maximum: EXPLORER_SAFE_CONTEXT_LIMITS.explorerDisplayNameCharacters },
      { path: ["sessionContext", "explorerSafeGuardrail"], maximum: EXPLORER_SAFE_CONTEXT_LIMITS.explorerSafeGuardrailCharacters },
      { path: ["immediateExplorerMessage", "content"], maximum: EXPLORER_SAFE_CONTEXT_LIMITS.messageCharacters },
    ];
    for (const { path, maximum } of cases) {
      for (const length of [maximum - 1, maximum]) {
        const input = validInput();
        setNested(input, path, "x".repeat(length));
        expect(() => assembleExplorerSafeContext(input)).not.toThrow();
      }
      const over = validInput();
      setNested(over, path, "x".repeat(maximum + 1));
      expectCode(over, "explorer_context_text_limit_exceeded");
    }
  });

  it("enforces focus, continuity, and message collection ceilings", () => {
    const focusOver = validInput();
    (focusOver.sessionContext as Record<string, unknown>).activeFocusItems =
      Array.from(
        { length: EXPLORER_SAFE_CONTEXT_LIMITS.focusItemCount + 1 },
        (_, index) => ({
          id: `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
          order: index,
          text: "focus",
        }),
      );
    expectCode(focusOver, "explorer_context_collection_limit_exceeded");

    const continuityOver = validInput();
    continuityOver.continuityCandidates = Array.from(
      { length: EXPLORER_SAFE_CONTEXT_LIMITS.continuityItemCount + 1 },
      () => (continuityOver.continuityCandidates as unknown[])[0],
    );
    expectCode(continuityOver, "explorer_context_collection_limit_exceeded");

    const messagesOver = validInput();
    messagesOver.currentSessionMessages = Array.from(
      { length: EXPLORER_SAFE_CONTEXT_LIMITS.currentSessionMessageCount + 1 },
      () => (messagesOver.currentSessionMessages as unknown[])[0],
    );
    expectCode(messagesOver, "explorer_context_collection_limit_exceeded");
  });

  it("CTX-027 is deterministic across caller key and array permutations", () => {
    const first = validInput();
    const second = validInput();
    second.continuityCandidates = [
      ...(second.continuityCandidates as unknown[]),
    ].reverse();
    const a = assembleExplorerSafeContext(first);
    const b = assembleExplorerSafeContext(second);
    expect(b.serialized).toBe(a.serialized);
    for (let run = 0; run < 25; run += 1) {
      expect(assembleExplorerSafeContext(validInput()).serialized).toBe(a.serialized);
    }
  });

  it("CTX-027 deeply freezes output and severs caller references", () => {
    const input = validInput();
    const result = assembleExplorerSafeContext(input);
    const before = result.serialized;
    ((input.sessionContext as Record<string, unknown>).activeFocusItems as Array<Record<string, unknown>>)[0].text =
      "caller mutation";
    ((input.continuityCandidates as Array<Record<string, unknown>>)[0]).content =
      "caller mutation";
    expect(result.serialized).toBe(before);
    expect(result.context.sessionContext.activeFocusItems[0].text).not.toBe(
      "caller mutation",
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.context)).toBe(true);
    expect(Object.isFrozen(result.context.sessionContext.activeFocusItems)).toBe(true);
    expect(Object.isFrozen(result.context.approvedContinuity[0])).toBe(true);
  });

  it("rejects an immediate-message replay from current history", () => {
    const input = validInput();
    (input.immediateExplorerMessage as Record<string, unknown>).messageId = IDS.history;
    expectCode(input, "explorer_context_duplicate_source");
  });

  it("keeps the exported error surface closed and value-free", () => {
    expect(EXPLORER_SAFE_CONTEXT_ERROR_CODES).toEqual([
      "explorer_context_invalid_envelope",
      "explorer_context_unknown_key",
      "explorer_context_invalid_role_alignment",
      "explorer_context_missing_required_layer",
      "explorer_context_invalid_text",
      "explorer_context_text_limit_exceeded",
      "explorer_context_collection_limit_exceeded",
      "explorer_context_invalid_candidate_kind",
      "explorer_context_candidate_not_eligible",
      "explorer_context_invalid_order",
      "explorer_context_duplicate_source",
    ]);
    const input = validInput();
    input.contractVersion = "";
    expectCode(input, "explorer_context_invalid_text");
  });

  it("CTX-029 preserves server-only direct-import dependency hygiene", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../explorerSafeContext.ts", import.meta.url)),
      "utf8",
    );
    const barrel = readFileSync(
      fileURLToPath(new URL("../index.ts", import.meta.url)),
      "utf8",
    );
    expect(source.startsWith('import "server-only";')).toBe(true);
    expect(source).not.toMatch(
      /(?:react|next\/|supabase|provider|repository|fetch\(|cookies\(|headers\(|process\.env|localStorage|sessionStorage)/i,
    );
    expect(source).not.toContain("JSON.stringify(input)");
    expect(source).not.toMatch(/console\.(?:log|warn|error)/);
    expect(barrel).not.toContain("explorerSafeContext");
  });
});
