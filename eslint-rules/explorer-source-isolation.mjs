// Explorer assembly has a deliberately closed source dependency graph. This
// static boundary complements typed assembly; it is not a runtime sandbox.
function profile(file, runtimeImports, typeImports = []) {
  return Object.freeze({
    file,
    runtimeImports: Object.freeze(runtimeImports),
    typeImports: Object.freeze(typeImports),
  });
}

export const EXPLORER_SOURCE_PROFILES = Object.freeze([
  profile("src/lib/solmind/roles.ts", []),
  profile("src/lib/solmind/onboarding.ts", []),
  profile("src/lib/solmind/context/aiRoleContext.ts", ["../roles"]),
  profile("src/lib/solmind/context/explorerContext.ts", []),
  profile("src/lib/solmind/context/explorerSafeContext.ts", [
    "server-only",
    "./aiRoleContext",
    "./explorerContext",
  ]),
  profile("src/lib/solmind/virtual-guide/virtualGuideConversationContract.ts", [
    "server-only",
    "node:util",
  ]),
  profile("src/lib/solmind/virtual-guide/authorizedVirtualGuideContext.ts", [
    "server-only",
    "node:crypto",
    "@/lib/solmind/context/explorerSafeContext",
    "@/lib/solmind/virtual-guide/virtualGuideConversationContract",
  ]),
  profile("src/lib/solmind/virtual-guide/effectiveMethodologyContext.ts", [
    "server-only",
    "node:util",
    "./methodologySafetyScreenContract",
  ], ["./explorerConversationComposition"]),
  profile("src/lib/solmind/virtual-guide/methodologySafetyScreenContract.ts", [
    "server-only",
    "node:crypto",
    "node:util",
    "../context/explorerSafeContext",
  ]),
  profile("src/lib/solmind/virtual-guide/explorerContextExclusionGuard.ts", [
    "server-only",
    "node:crypto",
    "node:util",
    "../context/explorerSafeContext",
  ]),
  profile("src/lib/solmind/virtual-guide/explorerConversationContext.ts", [
    "server-only",
    "./authorizedVirtualGuideContext",
    "../context/explorerSafeContext",
    "../onboarding",
    "node:util",
    "./effectiveMethodologyContext",
  ], ["./explorerConversationComposition"]),
  profile("src/lib/solmind/explorerConversationContract.ts", []),
  profile("src/lib/solmind/explorerPrivateConversationResponse.ts", ["./explorerConversationContract"]),
  profile("src/lib/solmind/virtual-guide/explorerConversationComposition.ts", ["server-only", "node:crypto", "../explorerConversationContract", "./virtualGuideConversationContract"]),
  profile("src/lib/solmind/virtual-guide/explorerPrivateConfigurationCandidate.ts", ["server-only"]),
  profile("src/lib/solmind/virtual-guide/explorerPrivateConfiguration.ts", ["server-only", "node:crypto", "node:util", "./explorerPrivateConfigurationCandidate"]),
  profile("src/lib/solmind/virtual-guide/explorerSafetyReplyContract.ts", ["server-only", "node:crypto"]),
  profile("src/lib/solmind/virtual-guide/explorerSafetyReplyInvocation.ts", ["server-only", "node:util", "./explorerSafetyReplyContract"]),
  profile("src/lib/solmind/virtual-guide/explorerConversationSafety.ts", ["server-only", "./explorerSafetyReplyContract"], ["./explorerPrivateConfiguration"]),
  profile("src/lib/solmind/virtual-guide/openAiLunaExplorerSafetyTransport.ts", ["server-only", "./explorerSafetyReplyContract"], ["./explorerSafetyReplyInvocation"]),
  profile("src/lib/solmind/virtual-guide/explorerPrivateConversationComposition.ts", ["server-only", "node:crypto", "node:util", "../explorerConversationContract", "./explorerConversationComposition", "./explorerPrivateConfiguration", "./explorerSafetyReplyContract", "./explorerSafetyReplyInvocation", "./explorerConversationSafety"], ["../explorerPrivateConversationResponse"]),
  profile("src/lib/solmind/supabase/explorerPrivateConversationRepository.ts", ["server-only", "node:util"], ["@supabase/supabase-js", "../virtual-guide/explorerPrivateConversationComposition"]),
  profile("src/lib/solmind/operations/explorerPrivateOperationalSignal.ts", ["server-only", "node:fs/promises", "node:path"], ["../virtual-guide/explorerPrivateConversationComposition"]),
  profile("src/lib/solmind/virtual-guide/openAiLunaMethodologyScreeningTransport.ts", ["server-only", "node:crypto", "./methodologySafetyScreenContract"], ["./methodologyScreeningComposition"]),
  profile("src/lib/solmind/operations/explorerPrivateRequestBudgets.ts", ["server-only", "node:util"], ["../virtual-guide/explorerPrivateConversationComposition"]),
  profile("src/lib/solmind/operations/explorerPrivateReviewedRenderer.ts", ["server-only", "../virtual-guide/explorerSafetyReplyContract"], ["../virtual-guide/explorerPrivateConversationComposition", "../virtual-guide/explorerConversationSafety"]),
  profile("src/lib/solmind/virtual-guide/explorerPrivateGovernedCapabilities.ts", ["server-only", "node:crypto", "./explorerPrivateConfiguration", "./explorerPrivateConversationComposition", "./explorerConversationContext", "./effectiveMethodologyContext"]),
]);

function selectedProfile(filename) {
  if (typeof filename !== "string") return undefined;
  const normalized = filename.replace(/\\/g, "/");
  return EXPLORER_SOURCE_PROFILES.find(candidate =>
    normalized === candidate.file || normalized.endsWith(`/${candidate.file}`));
}

function entirelyTypeOnly(node) {
  // Empty and side-effect declarations are runtime edges. Do not use an
  // unguarded every(): its empty-array result would grant an unintended edge.
  if (Array.isArray(node.specifiers) && node.specifiers.length === 0) return false;
  if (node.importKind === "type" || node.exportKind === "type") return true;
  return Array.isArray(node.specifiers) && node.specifiers.length > 0 &&
    node.specifiers.every(specifier =>
      (specifier.type === "ImportSpecifier" && specifier.importKind === "type") ||
      (specifier.type === "ExportSpecifier" && specifier.exportKind === "type"));
}

const approvedDependencies = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce the reviewed Explorer assembly source dependency graph.",
    },
    schema: [],
    messages: {
      missingProfile: "Explorer source isolation requires an approved file profile.",
      unapprovedDependency: "Explorer assembly dependency is not approved for this file.",
      unsupportedImport: "Explorer assembly permits approved static imports and reexports only.",
    },
  },
  create(context) {
    const approved = selectedProfile(context.filename);
    if (!approved) {
      return {
        Program(node) {
          context.report({ node, messageId: "missingProfile" });
        },
      };
    }

    function inspectStaticDependency(node) {
      // Local named exports have no source dependency.
      if (!node.source) return;
      const specifier = node.source.value;
      if (typeof specifier === "string" &&
          (approved.runtimeImports.includes(specifier) ||
            (entirelyTypeOnly(node) && approved.typeImports.includes(specifier)))) return;
      context.report({ node, messageId: "unapprovedDependency" });
    }

    function rejectImportForm(node) {
      context.report({ node, messageId: "unsupportedImport" });
    }

    return {
      ImportDeclaration: inspectStaticDependency,
      ExportNamedDeclaration: inspectStaticDependency,
      ExportAllDeclaration: inspectStaticDependency,
      ImportExpression: rejectImportForm,
      TSImportEqualsDeclaration: rejectImportForm,
      TSImportType: rejectImportForm,
    };
  },
};

export default {
  rules: {
    "approved-dependencies": approvedDependencies,
  },
};
