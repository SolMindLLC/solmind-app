import "server-only";

import { SESSION_COOKIE_NO_STORE_HEADERS } from "../auth/sessionCookiePolicy";

// Login step 6, sub-slice S6-8: the route contract of the two Explorer
// sign-in routes ("send a code"; "verify the code and sign in").
//
// Source of truth: solmind-docs
// `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
// (contract 25), accepted by Paul on 2026-10-04 (AUTH-RLS-DEC-043), Sections
// 10, 11 and 12, and
// `execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
// (contract 21) Sections 7.1.3 and 9.
//
// What it holds:
//   - the two body parsers. Each accepts a plain JSON object with exactly the
//     listed keys, every one a string, and nothing else. A body that carries
//     any other key (a role, an account id, a session id, a purpose, a
//     duration or a return address) is refused whole, so no such value is
//     ever read, let alone used;
//   - the closed outward results, each a frozen constant. Neither route ever
//     sends a body that is not one of them, apart from the one
//     acknowledgment, which carries the opaque selector of AUTH-RLS-DEC-031;
//   - the one fixed destination a successful sign-in names. It is a server
//     constant: no request value reaches it (contract 25 Section 11);
//   - the headers every answer of both routes carries: the three no-store
//     headers of contract 25 F9c, from the session-cookie policy's own list,
//     and `X-Content-Type-Options: nosniff`. Contract 25 Section 6 requires
//     the no-store set on an answer that sets cookies; putting the same set
//     on every answer keeps the headers equal for every identifier.
//
// The outward results are an interface the connected screens (S6-10) bind to.
// The words a person sees are theirs; this module fixes only the closed set.
//
// Pure: no IO, no environment read, no clock and no logging. Keep it
// server-only, direct-import only and off every barrel.

// DECIDED by Paul on 2026-10-07 (morning check-in packet, item 3, option 1):
// the two sign-in addresses are `/login/explorer/send` and
// `/login/explorer/verify`, "with one sentence added to the app's rules
// saying these handlers exist and the preview screens still do not call
// them". Record:
// `solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`,
// "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock
// read)". The route files sit at these paths; a test keeps the two in step.
export const EXPLORER_SIGN_IN_ROUTE_PATHS: Readonly<{ send: string; verify: string }> = Object.freeze({
  send: "/login/explorer/send",
  verify: "/login/explorer/verify",
});

// DECIDED by Paul on 2026-10-07 (morning check-in packet, item 4, option 1),
// the address of the Explorer's signed-in home: "name the new page's address
// now, `/explorer/home`, and build the page with the screens. No browser
// signs in before then." Record:
// `solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`,
// "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock
// read)". Paul chose "a small signed-in home page per role" on 2026-10-05.
// Still open: the page itself, which does not exist yet (S6-10 builds it).
export const EXPLORER_SIGN_IN_HOME_PATH = "/explorer/home" as const;

export type ExplorerSignInSendBody = Readonly<{ identifier: string }>;

export type ExplorerSignInVerifyBody = Readonly<{
  identifier: string;
  challengeId: string;
  code: string;
}>;

// The one acknowledgment of the send route, in the shape login step 5's
// callers define it. The composition hands the banked helper's result over
// unchanged; the type check there keeps this shape equal to the banked one.
export type ExplorerSignInSendAcknowledgment = Readonly<{
  acknowledgment: "verification_code_requested";
  challengeId: string;
}>;

export type ExplorerSignInInvalidEmail = Readonly<{ outcome: "invalid_email" }>;
export type ExplorerSignInDenied = Readonly<{ outcome: "denied" }>;
export type ExplorerSignInCodeNotAccepted = Readonly<{ outcome: "code_not_accepted" }>;
export type ExplorerSignInSignedIn = Readonly<{
  outcome: "signed_in";
  destination: typeof EXPLORER_SIGN_IN_HOME_PATH;
}>;

export type ExplorerSignInSendResult =
  | ExplorerSignInSendAcknowledgment
  | ExplorerSignInInvalidEmail
  | ExplorerSignInDenied;

// What the verify route sends. `signed_in` is sent only on the response that
// carries the cookies.
export type ExplorerSignInVerifyBodyResult =
  | ExplorerSignInSignedIn
  | ExplorerSignInCodeNotAccepted
  | ExplorerSignInDenied;

// The generic deny: the guard, the query string, the body shape, the
// configuration, and every failure that must not say which step failed.
export const EXPLORER_SIGN_IN_DENIED: ExplorerSignInDenied = Object.freeze({ outcome: "denied" });

// The typed text is not an email address the shared normalizer accepts. It
// depends only on what was typed, never on stored data.
export const EXPLORER_SIGN_IN_INVALID_EMAIL: ExplorerSignInInvalidEmail = Object.freeze({
  outcome: "invalid_email",
});

// DECIDED by Paul on 2026-10-07 (morning check-in packet, item 6, option 1),
// in the option's words: one "code not accepted" result for every refused
// code, its words chosen with the screens; the send route never says "please
// wait". Record:
// `solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`,
// "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock
// read)". Still open: the words a person sees, which are chosen with the
// screens (S6-10). The database answers one `denied` for a wrong, expired,
// used or unknown code, so the route cannot tell them apart. Contract 25
// Section 12 allows a code-screen message where the condition is
// user-fixable at input; contract 21 Section 9 reads the other way for a
// code at the authorization boundary.
export const EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED: ExplorerSignInCodeNotAccepted = Object.freeze({
  outcome: "code_not_accepted",
});

// DECIDED by Paul on 2026-10-07 (morning check-in packet, item 18, option
// 1), how the browser gets to the Explorer's home after a correct code:
// "keep the small message naming the fixed home. The sign-in is a request
// the page makes in the background, and a redirect answer to such a request
// does not move the page." Record:
// `solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`,
// "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock
// read)". So the verify route answers HTTP 200 with this JSON body, which
// names the fixed home, and the calling page goes there; the address is the
// one constant above and nothing the browser sent is repeated. Contract 25
// Section 11 says the server "sends the browser to a fixed home for the
// role", and its Section 15 item 10 is headed "Redirect". Still open: the
// banking documents must say how this answer meets or departs from that
// wording.
export const EXPLORER_SIGN_IN_SIGNED_IN: ExplorerSignInSignedIn = Object.freeze({
  outcome: "signed_in",
  destination: EXPLORER_SIGN_IN_HOME_PATH,
});

// The headers of every answer of both routes, as one frozen record.
function buildResponseHeaders(): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {};
  for (const header of SESSION_COOKIE_NO_STORE_HEADERS) {
    headers[header.name] = header.value;
  }
  headers["X-Content-Type-Options"] = "nosniff";
  return Object.freeze(headers);
}

export const EXPLORER_SIGN_IN_RESPONSE_HEADERS: Readonly<Record<string, string>> =
  buildResponseHeaders();

const SEND_BODY_KEYS: ReadonlyArray<string> = Object.freeze(["identifier"]);
const VERIFY_BODY_KEYS: ReadonlyArray<string> = Object.freeze(["identifier", "challengeId", "code"]);

// Reads exactly the listed keys of a plain object through own data property
// descriptors only, so no getter, setter or Proxy `get` trap runs, and
// requires every one to be a string. Returns null for anything else; an
// exception is dropped unread.
function readExactStringProperties(
  value: unknown,
  keys: ReadonlyArray<string>,
): ReadonlyMap<string, string> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      !ownKeys.every(
        (key) =>
          typeof key === "string" &&
          keys.includes(key) &&
          Object.prototype.propertyIsEnumerable.call(value, key),
      )
    ) {
      return null;
    }
    const fields = new Map<string, string>();
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        typeof descriptor.value !== "string"
      ) {
        return null;
      }
      fields.set(key, descriptor.value);
    }
    return fields;
  } catch {
    return null;
  }
}

// The send route's body: exactly `{ identifier }`, a string. Whether the
// string is an email address is the shared normalizer's question, not this
// parser's.
export function parseExplorerSignInSendBody(value: unknown): ExplorerSignInSendBody | null {
  const fields = readExactStringProperties(value, SEND_BODY_KEYS);
  if (fields === null) {
    return null;
  }
  return Object.freeze({ identifier: fields.get("identifier") as string });
}

// The verify route's body: exactly `{ identifier, challengeId, code }`, all
// strings. The selector's and the code's own forms are checked by login step
// 5's redeeming caller, which refuses a malformed one without a database
// call.
export function parseExplorerSignInVerifyBody(value: unknown): ExplorerSignInVerifyBody | null {
  const fields = readExactStringProperties(value, VERIFY_BODY_KEYS);
  if (fields === null) {
    return null;
  }
  return Object.freeze({
    identifier: fields.get("identifier") as string,
    challengeId: fields.get("challengeId") as string,
    code: fields.get("code") as string,
  });
}
