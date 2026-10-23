import "server-only";

import { cookies } from "next/headers";
import { createPasswordRoleSignInHttpPorts, type PasswordRoleSignInDependencyConfiguration } from "./passwordRoleSignInDependencies";

// Explicit local candidate values. The floor is provisional until the accepted
// Admin timing/shared-capacity measurements and Paul's residual-risk decision;
// neither another role's measurements nor component fake-IO tests establish it.
// Lookups are bounded read calls; the existing session writer has eight lock
// statements at 2,000 ms plus 2,000 ms caller margin. A caller timeout does not
// prove that a remote write, provider request or cleanup was rolled back.
export const ADMIN_SIGN_IN_CONFIGURATION: PasswordRoleSignInDependencyConfiguration = Object.freeze({
  responseFloorMilliseconds: 1_500,
  accountLookupTimeoutMilliseconds: 3_000,
  challengeOwnershipTimeoutMilliseconds: 3_000,
  challengeConfirmationTimeoutMilliseconds: 3_000,
  providerTimeoutMilliseconds: 5_000,
  sessionCreationTimeoutMilliseconds: 18_000,
});

// Each handler obtains its own ports. Reading no configuration or cookie at
// module load keeps startup/build from authenticating or opening a connection.
export function createAdminSignInHttpPorts() {
  return createPasswordRoleSignInHttpPorts(ADMIN_SIGN_IN_CONFIGURATION, async () => {
    const store = await cookies();
    // Next's mutable cookie records carry extra keys. The strict HTTP contract
    // accepts plain name/value records; project rather than weaken that reader.
    return store.getAll().map(({ name, value }) => ({ name, value }));
  });
}
