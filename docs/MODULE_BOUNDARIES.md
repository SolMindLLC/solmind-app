# SolMind App Module Boundaries

## Lane 7: active Waypoint capacity and private history - 2026-11-06

Twenty active Waypoints are allowed per durable Explorer account across all
conversations and relationships. The canonical protected SQL count includes
chosen current heads that are neither Reached nor Released (a private post-End
closure counts as Reached or Released). Drafts, Guide suggestions and
predecessor versions do not count. Existing accounts above twenty retain all
work; only increases are blocked. Revision is net zero; revisit requires a free
active place.

The separate engineering guard is 200 saved Waypoint records per source
conversation, counting originals and revisions. Every insertion requires
history room; reading, Reached, Release and End remain available at the guard.
The protected SQL policy owns both numbers. Required waypointCapacity
{activeCount, activeLimit, historyRoom} comes from the authenticated v3 read,
which supplies it even without a current conversation; the base state builder
returns null capacity when there is no owner. A missing, null or malformed
capacity fails closed.

The conversation projection is explicitly partial: at most 20 authoritative
current heads, with identity, creation time, provenance and projection metadata.
Separate owner-private head and history RPCs return at most 20 records per
page. Currentness and account capacity must never be inferred from absence in
a partial array. SQL retains and validates the complete lineage.

Interim display gap: earlier versions of revised or revisited Waypoints are
no longer visible on the connected card, compact list or ended review. The
owner-private history RPC preserves read access, but has no route or screen
in this increment. Further current heads outside the bounded projection also
stay saved and private without a screen to open them. Paul accepted this gap
for saving now for the demo (decision queue 2026-11-06 15:13:41 CST, item 2).
The private Your Waypoints section must be built next, before any real Explorer
uses SolMind. Release now says history stays saved and private; revised and
revisited details explain that earlier definitions stay saved privately and
cannot currently be opened. The earlier-version link is hidden until that
private section exists.
The compact list sorts each group newest first independently of projection
order. The legacy formation tools and ended review follow the same order
(active heads first, then closed heads, newest first within each group);
before this change they showed the oldest first. Paul approved active-first
ordering on every screen in the same decision.

Append-only private post-End closure is a narrow exception to frozen ended
history: an eligible Explorer may close an originally owned current head across
earlier Guide relationships after fresh current eligibility and consent checks.
Reached requires known-clear, adult-allowed policy and explicit evidence;
Release retains its existing policy allowance. Authenticated exact replay,
the account owner lock, one terminal fact and transactional audit are required.
The original conversation, ending revision/time, transcript, Route and source
provenance stay unchanged. No after-End revision, revisit, reactivation or
Guide access is authorized. The private Your Waypoints screen is later work;
this increment adds no route or page.

Ordinary model context is compass-v7 / explorer-compass-context.v7 and includes
at most 20 same-conversation heads: active heads first, then newest closed
heads, with deterministic matching SQL/TypeScript selection and source ids.
Compass-v5 and compass-v6 are refused for new turns; classification_only is unchanged.
The bounded-selection instruction and its five version labels, byte counts
and integrity pins move together. Paul approved that instruction as written
in the decision queue on 2026-11-06 at 15:13:41 CST. Classification-only context
stays unchanged; its shared HTTP instruction text also receives the
bounded-selection sentence. Existing request/provider budgets, cancellation,
one-call rules and Send counting stay unchanged.

The four limit sentences are Paul's approved wording (decision queue
2026-11-06 15:13:41 CST, item 2) and change only with his approval.
src/lib/solmind/explorerWaypointCapacity.ts owns their named constants and
waypointCapacityMessage selects the explanation from the server's
waypointCapacity, never a count of the visible list; activeCount and
activeLimit also come only from those server facts. A false historyRoom chooses
the 200-version explanation first, including when both limits apply. Otherwise,
an active count at or above the limit explains refusals to add, confirm a draft
or revisit.
The active limit never blocks or explains a revision. Missing, null or
malformed capacity fails closed with the existing calm unavailable wording,
never a limit sentence. Forming drafts use the approved "That's right"
variants. Each explanation stays beside its affected control, including a
disabled control, with keyboard access and the existing screen-reader
announcement behavior.

The application change and
supabase/migrations/20261106000000_explorer_waypoint_active_limits.sql
must reach the database together. Earlier migrations remain immutable;
reverting the application alone after longer history or closure facts exist
is unsafe. SQL/pgTAP and browser execution, canonical sibling-document updates,
independent review and integration remain Executor work.

## Reply choices in the Explorer's voice - 2026-11-06 (REV302b)

Paul's decision of 2026-11-06 11:58:16 CST ("Yes, both fixes") authorizes
Explorer-voice choice labels and a server-verified marker for a tapped choice.
Every offered choice is the Explorer's own reply, in their voice, as a
complete answer to the Virtual Guide's question or invitation; it must not
read as a question to the Virtual Guide or as the Virtual Guide's own words.

ExplorerConversation.tsx adds replyChoice: true only to the ordinary Send
started by onReplyChoice. The closed optional command field is replyChoice?:
true; other values are invalid, and typed Sends omit it. It is only a browser
claim. The server independently requires the latest saved message in this
conversation to be a Virtual Guide reply and the immediate message to equal
exactly one of that reply's choice labels, with exact bytes and no trimming,
normalization or case folding. Older replies, duplicate matching labels and
nonmatching messages do not qualify. A failed verification drops the marker
to false; it does not turn the claim into authority or cancel an ordinary Send.

Ordinary context is now wi007-v0.1+onboarding-fields-v2+compass-v7 with
explorer-compass-context.v7. Its required boolean
compassContext.immediateMessageIsReplyChoice is last in that section and is
true only for the verified selection. The Virtual Guide is told to respond
to that selected option instead of treating its words as a question to it.
TypeScript and SQL independently derive the same value and serialized section;
the inspector checks the same current facts. Compass-v5 and compass-v6 are refused for new
ordinary turns. Classification-only context stays on the section-free base
revision and receives no choice marker or additional source material.

The reply-choice forward migration follows the Waypoint-limits migration:

supabase/migrations/20261106010000_explorer_reply_choice_voice.sql.
It changes no table schema or Row Level Security policy. Prepare adds final
p_reply_choice boolean default false as argument 38; the inspector and audited
inspection entry add it as argument 8. The raw flag is bound into the request
fingerprint while the absent/false path preserves its existing fingerprint
and exact-replay behavior. Exact replay never authorizes a second provider call.
Both forward migrations and the application must reach a database together.
Waypoint-limits capacity gates, partial head projection, context selection,
owner locks and function settings are preserved.

All five prompt/role/instruction labels end in -20261106-cv-r2. The role and
reply-format instructions each add one Explorer-voice sentence, and the
ordinary reply-format context description adds one marker sentence. Byte
counts and SHA-256 pins move with the text. Paul must read the exact new
sentences before integration into the app or demo.

A choice remains one counted Send with the existing safety classification,
authority, restriction, adults-only, pending-turn, capacity and uncertain-retry
gates. Context/RPC/provider budgets remain 30/10/60 seconds; cancellation,
counting and the one-call rule are unchanged. This is isolated source work:
SQL/pgTAP and browser execution, independent review, integration and publication
remain Executor work. This builder may read only the clone and the named
REV302b package files outside it; sibling product documentation is untouched.

> Source reconciliation, 2026-10-21. Explorer login, direct-token request checks
> and shared logout are banked under SL-069. Dated actual evidence and limits
> remain in the execution ledger. Connected Guide source and October 21
> observations are described below; SL-070 and its linked checked receipt own
> current publication/banking status. Source/check results alone are not banking.
> Earlier component descriptions retain their historical source-only limits.

Version: 0.2.3
Repo: solmind-app  
Last Updated: 2026-10-29
Purpose: Define where code should live as the SolMind MVP0 application grows.

## Core Principle

SolMind code should be organized so that a small AI coding assistant can safely understand and modify one feature area at a time.

Prefer small, explicit modules over large mixed-purpose files.

## Current Source Layout

```text
src/
  instrumentation.ts        server start hook: runs the login startup check
  instrumentation-node.ts   its Node.js half
  app/
    page.tsx
    layout.tsx
    globals.css
    admin/page.tsx
    admin/access/route.ts
    explorer/page.tsx
    guide/page.tsx
    login/page.tsx
    login/explorer/page.tsx
    explorer/home/page.tsx
    login/explorer/send/route.ts
    login/explorer/verify/route.ts

  components/
    solmind/
      BackLink.tsx
      ConversationPreview.tsx
      DashboardCard.tsx
      ExplorerResponseComposer.tsx
      ExplorerTopicList.tsx
      MiniProfileCard.tsx
      OnboardingProgressCard.tsx
      PageShell.tsx
      Panel.tsx
      RoleBadge.tsx
      RouteAccessPreview.tsx
      SectionLabel.tsx
      SignInPreview.tsx
      SignInPreviewParts.tsx

  lib/
    solmind/
      conversation.ts
      dashboardPanels.ts
      invitations.ts
      navigation.ts
      onboarding.ts
      pages.ts
      profile.ts
      roles.ts
      signInPreview.ts
      routeAccess.ts
      terms.ts
      topics.ts
      auth/        server-side deny-by-default authorization and the request-auth boundary
      context/     Explorer-facing and AI-role context assembly helpers
      supabase/    server-side Supabase integration (request-auth client, service-role loader, mapping)

supabase/
  config.toml
  fixtures/      Banked manually invoked local-only S02 fixture; never production migration or universal seed
  migrations/    MVP0 schema foundations with Row Level Security enabled deny-by-default
  seed.sql
```

## Route Files

Route files live under:

```text
src/app/
```

Route files should:

- define page layout
- compose reusable components
- load feature-specific data when needed
- stay small and readable

Route files should not:

- contain large business rules
- contain safety classification logic
- contain Supabase policy assumptions
- contain long lists that belong in `src/lib/solmind`
- contain reusable UI that belongs in `src/components/solmind`

`src/app/explorer/page.tsx` remains a thin Server Component. Since 2026-11-04
it only redirects to the Explorer Overview (`/explorer/home`); the S01 client
boundary it composed was removed (Paul's decision, decision queue 2026-11-04 21:44:03 CST).

`src/app/explorer/waypoints/page.tsx` and its suggestion-scoped detail page are
thin Server Components for the authenticated S03 Explorer inbox and detail.
The detail's explicit engagement actions use a separate same-origin command
Route Handler; the Server Components own no command state or authority.

`src/app/guide/explorers/avery/waypoint-suggestions/page.tsx` is the paired thin
Server Component for the deterministic Human Guide review surface. It composes
only `GuideSuggestedWaypointWorkspace.tsx`.

## Components

Reusable SolMind UI components live under:

```text
src/components/solmind/
```

Use this folder for components such as:

- page shells
- panels
- cards
- navigation helpers
- topic lists
- progress indicators
- consent blocks
- dashboard sections
- form components

Components should be presentational when possible.

Avoid placing core product rules inside components. If a component needs product rules, import them from `src/lib/solmind`.

### Explorer S01 components

- `ExplorerExperiencePrototype.tsx`, the S01 `"use client"` entry point, was
  removed on 2026-11-04 (Paul's decision, decision queue 2026-11-04 21:44:03 CST).
- `SessionCompass.tsx`, the S01 controlled Compass component, was removed on
  2026-11-05 (Paul's decision, decision queue 2026-11-05 11:07:58 CST, item 4).

Neither component may own provider, persistence, auth, consent-version,
safety, or visibility policy. The mock Guide view receives only the narrow
projection returned by `createNonLiveGuideProjection`.

The bounded S01R2 conversation-first review surface keeps a parallel but
separate ownership split:

- `ExplorerCompassComparison.tsx` owns transient browser orchestration and
  focus/viewport handling;
- `ExplorerCompassComparisonParts.tsx` owns presentational screen regions and
  controls; and
- `explorerCompassComparison.ts` owns the pure deterministic conversation,
  Compass, Waypoint, quotation, navigation, and disclosure transitions.

`src/app/explorer/compass-comparison/page.tsx` only composes that client
boundary. The surface inherits S01's no-provider, no-persistence, no-auth,
no-notification, and no-real-user constraints. Its fixed replies must not be
described as semantic interpretation or a genuine model response. S03 remains
the owner of server-side provider conversation.

The interim `/explorer/conversation-preview` design review keeps its own split.
It imports only `SOLMIND_LOGO_SRC` from the S01R2 owners, plus the shared
speaker-style module `src/lib/solmind/explorerSpeakerStyle.ts` and the shared
speaker icons `src/components/solmind/ExplorerSpeakerIcon.tsx` that S01R2 also
uses, and the shared menu labels leaf `src/lib/solmind/workspaceNavigation.ts`
(never the signed-in menu data in `workspaceMenus.ts`):

- `src/app/explorer/conversation-preview/page.tsx` only composes the client
  boundary and exports honest metadata;
- `ExplorerConversationScreenPreview.tsx` owns layout state only (panel,
  drawer, the narrow-screen Menu, Compass view, quote list, speaker-label
  switch);
- the other `ExplorerConversationScreen*.tsx` files own presentation, read the
  fixed wording directly, and receive read-only display props typed in
  `explorerConversationScreenDisplay.ts`; only
  `ExplorerConversationScreenPreview.tsx` imports the sample; and
- `explorerConversationScreen.ts` and `explorerConversationScreenSample.ts`
  own the "Not yet implemented:" sentences and the tagged sample content.

Setting `SPEAKER_LABEL_STYLE` to `"original"` restores the earlier labels on
both screens. The S01R2 files change only in speaker labels and icons.

The preview has no provider, persistence, auth, route handler, browser storage,
URL state, timer, notification, or real-user effect.

Rebuild step 2 puts the same layout on the connected `/explorer/conversation`
screen, and `ExplorerConversation.tsx` stays its only fetch owner:

- `ExplorerConversation.tsx` keeps fetch, decoding, authority loss, pending
  turns, uncertain retry, Send and End unchanged, and passes read-only view
  props and callbacks (one dated exception: since 2026-11-03, chat step slice
  S2 fix round 2, a confirmed command other than Send keeps the Virtual Guide
  state the screen last had instead of the result's "unavailable", because
  that result never checks the Virtual Guide and the server checks readiness
  again on every Send; and since fix round 3, the same day, a Send refused as
  unavailable records "unavailable" as that kept state, because the refusal is
  the server's latest word and a later command must not enable Send again;
  and since the chat card redesign, the same day, the decoding it uses, the
  closed state parser in `explorerConversationContract.ts`, reads current
  attention on a point without a position in an arranged Compass, because the
  server saves such a needle since migration 20261103180000);
- `ExplorerConversationConnectedScreen.tsx` is presentation only and owns
  layout state only (panel, drawer, since 2026-11-03 the Compass card's Full
  or Compact view in the panel and in the drawer, the narrow-screen Menu and
  which "Not connected yet" sentence is shown, through `NotConnectedProvider`,
  and since 2026-11-03 which build notes show, through `BuildNotesProvider`);
- `ExplorerConversationScreenBuildNotes.tsx` (2026-11-03; Paul's build-note
  rule, decision queue 2026-11-03 17:59:20, 18:00:59, 18:03:39, 18:30:50,
  18:32:04 and 18:33:15 CST) owns the build notes of the signed-in screens and
  nothing else: the blue label (`BuildNoteLabel`, `#4A86FF`), the blue dashed
  box with its X (`BuildNoteBox`), the violet removal outline and tag
  (`REMOVAL_OUTLINE`, `RemovalTag`, `#D27BFF`), the page toggle
  (`BuildNotesToggle`, `aria-pressed`, first in the top bar's right-hand group)
  and the pure toggle and X rules (`toggleBuildNotes`, `closeBuildNote`,
  `buildNoteShown`) with the boundary hook `useBuildNotesState`. Its fixed
  words are in `explorerConversationScreen.ts` (`BUILD_NOTE_WORDING`). It
  imports only React, those two lib leaves and its icons, never the other
  parts, because `ExplorerConversationScreenNotYetImplemented.tsx` imports it.
  Without `BuildNotesProvider` (the review version) it draws no toggle, so the
  review version is unchanged. Every note, label, box, marker and the toggle
  carries `data-build-note` or `data-removal-marker`;
- `scripts/checkReleaseCandidate.mjs` (with its pure scan in
  `scripts/releaseCandidateScan.mjs`) is the release-candidate check: it reads
  `src/` and the built `.next/server` and `.next/static` and fails while either
  attribute remains anywhere outside tests, the mockup routes and files
  included, because they ship with every build (amended 2026-11-03 after review
  REV224). It changes nothing and is not a `package.json` script. A release
  candidate for UAT or production must pass it (Paul's rule, 2026-11-03);
- `explorerConversationConnectedScreen.ts` owns its fixed wording and shell
  data and imports no sample; its Guide notes say "your Guide"
  (`UNNAMED_GUIDE`), because the screen receives no Guide name;
- the shared shell, navigation and support panel take a `connected` flag that
  drops the preview band and the "Sample" and "Layout only" tags;
- the Explorer menu (Paul's 2026-11-02 option A, decision queue 14:07:48 and
  22:19:17 CST) has two presentation-data files:
  `src/lib/solmind/workspaceNavigation.ts`, the labels leaf (labels, the
  "Not connected yet" label, grey until 2026-11-03 and a blue build note since,
  the prefix helper and the entry types), imports
  only `explorerConversationScreen.ts` and is imported by the
  conversation-screen shell, not-yet-implemented and build-note parts
  (`ExplorerConversationScreenShell.tsx`,
  `ExplorerConversationScreenNotYetImplemented.tsx`,
  `ExplorerConversationScreenBuildNotes.tsx`), by `workspaceMenus.ts`
  and by `explorerWorkspaceFrame.ts`; `src/lib/solmind/workspaceMenus.ts`, the
  signed-in menu data with its destinations (Overview from `routeAccess.ts`),
  is imported only by the signed-in lib files `explorerConversationConnectedScreen.ts`,
  `explorerWorkspaceFrame.ts`, `explorerOverviewHome.ts`, `guideWorkspaceFrame.ts`
  and `guideDashboardHome.ts`, which map it (it also holds the Guide menu);
  the review sample keeps its own menu data. Both screens draw the
  September 23 list in the rail and in the panel a labelled "Menu" button
  opens below 64rem (the icon strip and spaces toggle are gone). On the
  signed-in screen built entries are plain full-document links (a plain click
  on the current page's entry keeps the page and a typed message), and every
  control not built yet shows a "Not connected yet" line (the bell
  beside its icon, named "Notifications Not connected yet"; grey until
  2026-11-03, the build-note blue since) and one sentence
  directly under it on request instead of a "Not yet implemented:" note;
  notes that describe an area are shown, since 2026-11-03 each in a blue
  build-note box with an X instead of an area marked with the grey label (one
  dated exception, 2026-11-03, Paul's decision in decision queue
  18:05:33 CST: the Compass card shows no forming-point or needle note, to cut
  clutter; see the card below); only the review version keeps its "Not yet
  implemented:" notes.
  Amendment 2026-11-04 (S5): the card now shows forming points and automatic needle moves are implemented; the Compass card still has no explanatory build-note area.
  The sentences are the review drafts reused pending Paul's wording review;
- since chat step slices S1 and S2 (2026-11-03; Paul's chat-step decisions,
  decision queue 2026-11-03 12:38:07 and 12:41:08 CST), the support panel and
  drawer show the connected Compass & Waypoint card instead of the Compass and
  Waypoint "Not connected yet" notes. `ExplorerConnectedCompassCard.tsx` draws
  the saved Compass on its 8 stored positions in the look of the reviewed dial
  (not that dial itself, which has 4 zones) and lists every current point;
  choosing a point hands the existing `set_attention` intent to `onCommand`, so
  `ExplorerConversation.tsx` sends it with its existing hold, retry and
  expected revision. `ExplorerConnectedWaypointCard.tsx` shows each saved
  Waypoint read-only with the stage names Formed, Reached and Released and its
  older wording as "Earlier version - <stage>". Both are presentation only;
  `src/lib/solmind/explorerConnectedCard.ts` owns their pure mapping from the
  saved state, the needle rules (through `buildAttentionFormationIntent`, which
  since 2026-11-03 takes any current point, as the server does, and the
  reasons the needle is held) and their wording. Their names avoid the `ExplorerConversationScreen*.tsx`
  pattern, so the review version and its checks are unchanged. Since fix
  round 2 (2026-11-03) the Compass card keeps two pieces of presentation
  state: the live line's last result and the point the Explorer chose there,
  so that focus can move to the "Current attention" line once that move is
  confirmed; and `ExplorerConversationConnectedScreen.tsx` closes the narrow
  drawer and moves focus to the page's alert when a change made from the
  drawer leaves no saved state. Since 2026-11-03 (Paul's decisions, decision
  queue 16:20:29 and 16:24:39 CST) the Compass card shows one view at a time,
  to save space: the Full view (the dial with the Priority and Current
  attention lines; each point drawn on the dial is a button over its bubble
  that points the needle with the list's rules, holds, reasons, live line and
  focus, and one line says how many points are not on the dial and that the
  Compact view shows them) or the Compact view (the point list as before, with
  the same two lines). A button under the Compass heading ("Compact view" or
  "Full view", with " of the Compass" for screen readers) switches between
  them. The card takes the view as a prop; which view shows is layout state in
  `ExplorerConversationConnectedScreen.tsx`, Full first, kept separately for
  the panel and the drawer while the page is open and never saved. The chat
  card redesign (2026-11-03; Paul's design and decision, decision queue
  18:05:33 CST) amends this: the needle may point at any current point, placed
  or not (the database rule changed with it, below); the Full view shows the
  points without a position in a bottom row under Excursion, in grey with one
  small yellow symbol each, at most three places, the third "+N more" (which
  opens the Compact view, focus then on the view switch) when there are more,
  each a button with the dial's rules; the line about the Compact view is
  gone; a needle on such a point is drawn dashed all the way to its place, under
  the dial's points, with no symbol at its tip (amended 2026-11-05, Paul's decision, decision queue 2026-11-05 19:11:11 CST),
  and is a button (named "Why the needle is dashed") whose tap shows one
  short sentence and whose next tap hides it (card state only); the Compact
  view's points without a position are grey with the same symbol; the heading
  is "Point the needle to change topic" in both views, with no instruction
  sentence and no placement paragraph; and the card no longer has its two
  "Not connected yet" notes (forming points; the needle following the
  conversation), a dated exception Paul decided for the Compass card. Key
  Insights stay marked as not built yet, since 2026-11-03 with a blue
  build-note box under their heading; and
  Amendment 2026-11-04 (S5): forming points and automatic needle moves are now implemented; their earlier explanatory notes remain absent.
- `ExplorerConversationFormation.tsx` stays mounted below the conversation as
  the current Compass and Waypoint tools until rebuild steps 4 and 5. Since
  2026-11-03 (Paul's build-note rule, decision queue 18:03:39 CST; his
  chat-step decision 8) the screen's section around it carries the violet
  removal marker (dashed violet outline and the "Planned for removal" tag with
  the sentence `CURRENT_TOOLS_REMOVAL_REASON`); the tools keep working, and the
  ended conversation review, which shows them read-only, is not marked. Since
  2026-11-03 it labels older Waypoint wording "Earlier version - Formed",
  "- Reached" or "- Released" (Paul's question 9 decision) instead of
  "Superseded - ..."; its other labels are unchanged, except that since the
  chat card redesign (2026-11-03) its "Attend to" button takes any current
  point, so the disabled state and the sentence "Arrange this point visibly
  before moving attention here." are gone, to match the server. Its
  arrangement review keeps the rule that the current-attention point stays
  placed.

The Explorer workspace frame (Paul's 2026-11-02 decisions, decision queue
14:07:48 and 22:19:17 CST) puts the same look and menu on the other signed-in
Explorer pages:

- `src/components/solmind/WorkspaceFrame.tsx` is the role-neutral,
  presentation-only client frame (rail, top bar with Menu button and plain
  breadcrumb, phone panel, one `<main>`). It reuses the exported conversation
  parts (`Rail`, `UtilityBar` and `AmbientGlow` from the shell, `MenuPanel`,
  the `MENU_ICONS` icons and `NotConnectedProvider`, and since 2026-11-03
  `BuildNotesProvider` with `useBuildNotesState`, so its top bar has the
  "Build notes" toggle on every page), owns layout state only,
  and takes `WorkspaceFrameData` (typed in `explorerConversationScreenDisplay.ts`)
  with the menu entries, names, breadcrumb root and profile role;
- `src/components/solmind/ExplorerWorkspaceFrame.tsx` is the thin Explorer
  client wrapper and `src/lib/solmind/explorerWorkspaceFrame.ts` its frozen
  data (each page's section current; the spaces only under Conversations);
- `src/components/solmind/ExplorerOverviewHome.tsx` presents Overview inside it
  and `src/lib/solmind/explorerOverviewHome.ts` owns its wording; and
- `ExplorerConversationReview.tsx`, `ExplorerSuggestedWaypointInbox.tsx` and
  the Waypoint detail page render inside the frame and keep their reads,
  commands and rules.

The same frame carries the August Guide menu on the signed-in Guide pages
(same decisions; no route created or renamed):

- `src/components/solmind/GuideWorkspaceFrame.tsx` is the thin Guide client
  wrapper and `src/lib/solmind/guideWorkspaceFrame.ts` its frozen data
  (Dashboard current on `/guide/home`, no entry current on the Waypoint
  Suggestions pages, whose breadcrumb names the page; the profile chip's
  person icon by id in `PROFILE_ICONS`); the Guide menu, names and draft
  sentences are in `workspaceMenus.ts`;
- `src/components/solmind/GuideDashboardHome.tsx` presents the Dashboard and
  `src/lib/solmind/guideDashboardHome.ts` owns its wording; `GuideHome.tsx`
  passes it only the pending and warning flags and the sign-out action;
- `src/components/solmind/WorkspaceHomeParts.tsx` holds the header, card,
  card link, not-connected card button, session warning and Sign out shared
  by Overview and the Dashboard; and
- `src/components/solmind/GuideWaypointSuggestionsPage.tsx` puts the three
  Guide Waypoint Suggestions pages in the frame; their Guide Suggested
  Waypoint components keep their reads, commands and rules.

The retained sign-in preview keeps the same split: `SignInPreview.tsx` owns
its client boundary, `SignInPreviewParts.tsx` owns presentation, and
`signInPreview.ts` owns the approved copy and pure screen transitions.
Banked `/login` composes connected Explorer LoginExperience. The separate
Guide and Admin use their separate bounded connections. Screens follow their approved
mockups; the preview's own additions are styled apart (a "Preview controls"
band, with a remembered-browser switch on A3 and A3A, an example-screen
callout beside each code screen's claims, and explanations beside
unconnected controls). Within that preview, Guide opens A3 and Admin opens A3A;
both go on to A4 for that role, or, with the remembered-browser switch on,
explain beside the "Sign in" button that the code is skipped and stay. The
password field is uncontrolled, so its value never reaches state or markup.
A new-code request keeps A4, M1 or M2 on screen with what was typed; only the
preview switcher moves between the code screens.
It must not import the `auth/` or `supabase/` modules, persist entries, or
send or check credentials or codes; drafts remain in page memory. Connected
Explorer uses separate login step 6 owners.

### Suggested Waypoint components

- `ExplorerSuggestedWaypointWorkspace.tsx` owns only fixture-local view state
  for the Explorer inbox, detail, private comparison, acknowledgement, and
  exact-response review surface.
- `SuggestedWaypointStatusPill.tsx` is a presentational status component; its
  optional dark surface serves the Explorer and Guide pages in the workspace
  frame, and the fixture surfaces keep the light pills.
- `suggestedWaypointFixtures.ts` constructs the synthetic delivered state by
  calling the pure domain rather than duplicating lifecycle rules in React.
- `GuideSuggestedWaypointWorkspace.tsx` owns only fixture-local Guide list,
  draft, pending-send, Pull Back, sent-detail, withdrawal, and receipt-review
  presentation.
- `guideSuggestedWaypointFixtures.ts` constructs Guide-only draft, pending,
  open, and acknowledged examples through the pure domain. It must not emulate
  passive Explorer telemetry or import Explorer-private fixture observations.
- `ExplorerSuggestedWaypointInbox.tsx` owns authenticated read presentation,
  inside the Explorer workspace frame since 2026-11-02 (no own sidebar).
  `ExplorerSuggestedWaypointDetail.tsx` also owns explicit Mark as read and
  Acknowledge receipt interaction and recovery over the separately owned
  command client and route. Opening the detail remains write-free. Their
  browser contracts admit exact delivered-current-version and Explorer-private
  engagement fields, then reject Guide-only or inferred data.
- `GuideSuggestedWaypointRelationshipEntry.tsx` and
  `GuideSuggestedWaypointRelationshipList.tsx` own authenticated Guide read
  presentation only, inside the Guide workspace frame since 2026-11-02 (dark
  pills). `GuideSuggestedWaypointDetail.tsx` remains relationship-
  scoped and additionally owns complete-draft edit/save/review/schedule and
  pending-version Pull Back interaction over the separately owned client and
  Route Handler.

The retained fixture UIs do not access a provider, database owner, Server
Action, Route Handler, cookie, browser storage, notification, or real Guide
record. The authenticated S03 components use thin same-origin routes over
server-derived request authority and exact role-safe projections. The Guide
detail invokes save draft and schedule send for an existing complete draft plus
Pull Back for a pending version through the separately owned Guide command
Route Handler. The Explorer detail invokes only explicit Mark as read and
Acknowledge receipt through its separately owned command Route Handler. No
current Suggested Waypoint UI invokes blank-draft compose, delete, correction,
withdrawal, Explorer comparison/adoption/response commands, a worker, provider,
deployment, or real-user activation.

`auth/trustedApplicationOrigin.ts` and
`auth/sameOriginJsonWriteRequest.ts` are server-only first-write predecessors
for both role lanes. The configuration owner accepts one absolute HTTP(S)
origin from `SOLMIND_TRUSTED_APP_ORIGIN`; it never derives trust from Host,
forwarded headers, Supabase, or a public environment variable. The request
guard requires POST, exact JSON media type, exact Origin equality, Fetch
Metadata `same-origin`, identity or absent content encoding, one canonical
optional content length, a bounded 16,384-byte stream, strict UTF-8 without a
BOM, and one deeply frozen plain JSON object. It performs no authentication,
role choice, command parsing, RPC, or response projection. The existing
server-only Suggested Waypoint request composition remains the command-shape
owner and now rejects isolated UTF-16 surrogates plus Unicode line and
paragraph separators so the byte cap and text validator describe one coherent
accepted-input set. The Guide command POST route calls this guard before auth
or executor IO and then uses the existing request-dependency and composition
owners; every later Explorer write edge must preserve the same order.

`suggestedWaypointDisplayDate.ts` is the shared browser-safe presentation owner
for those authenticated Explorer and Guide list/detail components. It renders
year-complete `en-US` dates and date-times in the viewer's local time zone. Its
optional explicit IANA time zone is a test seam only; production consumers do
not pass one or force UTC. The helper does not change exact timestamps, browser
contracts, persistence, locale preferences, or an application-wide date system.

`suggestedWaypointCommandBrowserContract.ts` and
`suggestedWaypointCommandOperation.ts` are shared browser-safe predecessors for
later role-specific command edges. The contract accepts only exact data-property
results and the expected-outcome subset supplied by the owning route, then
returns frozen success, expected non-success, or value-free denied/failed
results. The operation owner is pure state: it suppresses double activation,
retains one exact serialized request and UUIDv4 operation identity across a
transport-uncertain retry, ignores stale generations, supports authoritative-
read settlement, and emits semantic busy, retry, announcement, and focus
intents. Neither module imports server-only code, invokes a route or RPC, reads
authority, owns command validation, or creates a database, worker, provider,
deployment, or real-user effect. The role lane retains the parsed result so its
copy and recovery path still distinguish expected concurrency from a value-free
denial or operational failure; the pure operation owner carries only their
shared focus and retry semantics.

`suggestedWaypointGuideDraftContentBrowserContract.ts` is the browser-safe
content owner shared by Guide detail parsing and the server command-route body
contract. It snapshots plain data once, then validates normalized single-line
destination, intentionally multiline why, and one to eight unique bounded
arrival signals. It owns no request authority, persistence, or lifecycle rule.

`suggestedWaypointGuideCommandClient.ts` is the Guide role-lane command caller.
It owns exact save-draft, schedule-send, and Pull Back bodies, the relationship-
scoped route URL, closed action-specific outcomes, same-origin fetch, and
conclusive versus transport-uncertain classification. It creates no authority
and receives no actor, role, policy, deadline, lifecycle, or Explorer value
from the browser. The companion
`suggestedWaypointPullBackCountdown.ts` is display-only. The Guide detail owns
the role result and recovery copy, preserves exact request bytes and operation
identity on retry, checks the authoritative detail after uncertainty, and
retries only the read after a conclusive command. Neither client owner may
render, announce, log, or place the pending-version selector in a URL.

`suggestedWaypointExplorerCommandClient.ts` is the bounded Explorer role-lane
caller for explicit Mark as read and Acknowledge receipt. It constructs one
suggestion-scoped request from the already loaded current-version detail and
sends no actor, role, relationship, Guide policy, or private reaction. The
detail permits one operation at a time, retains byte-identical requests across
transport-uncertain retry, requires authoritative detail settlement before it
announces completion, and ignores late generations after unmount or route
change. Mark as read remains Explorer-private; only deliberate receipt
acknowledgement is Guide-visible. Opening the detail never invokes the route.

Dormant `PRJ01_V-WS05-WI022-S02` adds a database-only Suggested Waypoint
boundary under `supabase/migrations/` and `supabase/tests/`. Eight owners keep
Guide draft content, pending outbound content, immutable delivered versions,
Explorer-private read state, deliberately shared receipts, Guide preference,
and content-free operation replay proof separate. The public catalog is closed
to six commands and five role queries, owned by `postgres`, executable only by
`service_role`, and backed by deny-by-default RLS with zero policies and no
direct role grants. No `src/` caller, browser path, hosted delivery worker,
provider, or real-user activation is part of S02. Do not wire these functions
through a generic RPC executor or the shared Supabase barrel; the separately
gated S03 composition must introduce narrow human and worker allowlists.

The forward-only destination correction gives `destination` its own protected
single-line normalizer. Save-draft applies it before request-digest or write
work, and the shared content trigger applies it to Guide draft, pending, and
immutable version rows so a privileged or later internal caller cannot bypass
the invariant. The reusable text normalizer remains multiline for `why` and
arrival signals; its CRLF-to-LF canonicalization remains part of idempotent
replay. The correction adds no public function, caller, worker, provider,
deployment, hosted data, or real-user effect.

The first S03 increment adds those narrow allowlists in
`suggestedWaypointRpcContract.ts` and `suggestedWaypointRpcExecutor.ts`, with
co-located contract/executor tests. The human executor exposes exactly nine
functions; the separately constructed worker executor exposes only delivery.
The dormant Admin query stays excluded. Both files are server-only, stay off the
shared barrel, validate exact call/response shapes and lifecycle coherence, and
return frozen copies or value-free failure sentinels. Command validation keeps
all eight canonical database outcomes distinct from transport failure, applies
the exact per-function outcome subset and nullable row shape, and preserves
opaque relationship-unavailable results without weakening operation binding.
They do not derive auth, check relationships, protect routes, schedule delivery,
or activate a caller.

The banked S03 composition adds `suggestedWaypointRequestComposition.ts`. It wraps
only the human executor, snapshots and validates exact client-safe operation
shapes, derives the trusted actor and active role from injected request-auth and
record sources, authorizes Guide relationship selectors against server-loaded
records, and requires an active Explorer context on the Explorer path. The
actor account is always injected from that trusted context. Initial suggestion
and pending-version identifiers are supplied only by an injected server
resolver. The module returns executor-validated role-safe payload data or one
of two fixed browser-safe errors. It remains off the shared barrel and owns no
route, Server Action, UI, worker, scheduler, provider, deployment, or real-user
activation. Separately reviewed thin Route Handlers build its cookie adapter
and invoke only the closed Guide/Explorer read operations or their exact
role-lane command subsets.

The banked S03 read layer owns the Guide relationship selector, Guide
relationship-scoped list/detail, and Explorer list/detail. Route input is
limited to closed pagination or opaque identifiers; actor, role, and Guide
relationship authority come from server request state and records. A second
browser contract validates the already-minimized role projection before
rendering. These routes add no command, delivery worker, provider, deployment,
or real-user activation.

## Product Logic and Constants

SolMind product constants and product logic live under:

```text
src/lib/solmind/
```

Current examples:

- `conversation.ts`
- `dashboardPanels.ts`
- `navigation.ts`
- `onboarding.ts`
- `pages.ts`
- `profile.ts`
- `roles.ts`
- `routeAccess.ts`
- `terms.ts`
- `topics.ts`

Use this area for:

- role definitions
- route definitions
- page metadata
- product terminology
- validation rules
- onboarding workflow definitions
- topic definitions
- safety rule definitions
- dashboard data-shaping helpers

`onboarding.ts` owns the exact S01 structured-form field definitions and the
distinct required-form/optional-First-Compass states.

`explorerExperience.ts`, the S01 pure Discovery, Compass, Route, Waypoint,
summary, review, snapshot and Guide-projection helper, was removed on
2026-11-05 with its test (Paul's decision, decision queue 2026-11-05 11:07:58 CST, item 4).

`suggestedWaypoints.ts` owns the separate pure Suggested Waypoint lifecycle,
timing, replay, immutable-version, and role-projection rules. Do not duplicate
those rules in the Explorer or Guide component trees.

## Types

When the app grows, shared TypeScript types may live near the feature module first. Introduce `src/types/` only when types are clearly shared across multiple feature areas.

Recommended future files, when needed:

```text
src/types/
  auth.ts
  roles.ts
  invitations.ts
  consent.ts
  onboarding.ts
  conversation.ts
  safety.ts
  dashboard.ts
```

Types should be explicit and stable. Avoid vague type names such as `Data`, `Item`, `Thing`, or `Result` unless they are locally obvious.

## Future Feature Areas

As MVP0 grows, prefer these feature boundaries:

```text
src/components/solmind/auth/
src/components/solmind/consent/
src/components/solmind/conversation/
src/components/solmind/dashboard/
src/components/solmind/intake/
src/components/solmind/safety/

src/lib/solmind/auth/
src/lib/solmind/consent/
src/lib/solmind/conversation/
src/lib/solmind/invitations/
src/lib/solmind/onboarding/
src/lib/solmind/safety/
src/lib/solmind/supabase/
```

Do not create all folders before they are needed. Add them when a real feature requires them.

Some of these areas are already present and banked: `src/lib/solmind/auth/`, `src/lib/solmind/context/`, and `src/lib/solmind/supabase/`. See the Authentication, Context, Supabase, Admin Access Route, and Schema Foundation boundaries below.

## Authentication Boundary

Authentication and server-side authorization code should be isolated.

Current home (banked):

```text
src/lib/solmind/auth/
```

This directory now holds the banked, deny-by-default request-auth boundary, role-context resolution, route-access decisions, relationship read guards, the real Admin auth-source port, the bounded Auth/RLS audit event model, and the audit event writer. As of AUD-3 the `/admin/access` composition (`adminAccessRequest.ts`) persists those audit events at runtime through the closed-allowlist writer chain. Server-only modules are kept off the shared client barrel. Extend it in small slices; the separate connected-role login owners below do not implement the remaining provisioning write paths.

Authentication code should handle:

- Explorer passwordless login request
- Guide password plus email/SMS verification
- Admin password plus verification code
- verification code validation
- role-aware post-login routing
- login attempt logging

Authentication code should not:

- render full pages
- contain dashboard logic
- contain safety escalation logic
- bypass role checks
- expose server-only secrets to the client

S01 does not import or extend this boundary.

## Role Boundary

Role definitions should remain centralized.

Current home:

```text
src/lib/solmind/roles.ts
```

Do not duplicate role string literals across the app.

Canonical roles:

- Admin
- Guide
- Explorer

A person may hold multiple roles, but MVP0 role switching is not automatic.

## Guide Dashboard Boundary

The `/guide` route is the human Guide dashboard.

Do not call this route the SolMind Guide Assistant dashboard. The SolMind Guide Assistant is the AI assistant that supports the human Guide.

Guide dashboard data must remain scoped to assigned Explorers only once persistence exists.

The signed-in Guide Dashboard on `/guide/home` and the Guide workspace menu
(2026-11-02) are separate from this `/guide` prototype; see "The same frame
carries the August Guide menu" under Explorer S01 components above.

The S01 non-live Guide result is not `/guide` and is not an operational
dashboard. It is a local proof that only submitted onboarding answers and an
exact confirmed Shared Snapshot cross the visibility boundary. It never
receives raw Explorer state.

## Invitation Boundary

Future invitation logic should be isolated.

Expected future home:

```text
src/lib/solmind/invitations/
```

Invitation logic should handle:

- Admin inviting Guides
- Guides inviting Explorers
- invite state
- invite expiration
- invite acceptance

Do not mix invitation logic into generic login components.

## Consent Boundary

Future consent logic should be isolated.

Expected future home:

```text
src/lib/solmind/consent/
src/components/solmind/consent/
```

Consent logic should handle:

- consent document versions
- adult affirmation
- AI disclosure
- Admin visibility disclosure
- crisis limitation disclosure
- accepted version
- timestamp
- blocking AI access until required consent records exist

Consent should not be hidden inside chat components.

S01 displays honest draft/TBD agreement copy but records no consent and must
not imply that it does.

## Conversation Boundary

Future conversation logic should remain separated from rendering.

Expected future homes:

```text
src/components/solmind/conversation/
src/lib/solmind/conversation/
```

Conversation code should not own:

- role policy
- escalation policy
- consent versioning
- Admin visibility rules

S01 uses a fixed local script and exact Explorer-entered text. It must not
claim semantic interpretation or a genuine model response. S03 owns the first
server-side provider conversation.

### Explorer conversation composition construction - 2026-10-24

This provider-held increment does not establish a genuine AI response or
complete the connected demo. Actual proof and checked publication status belong
to `solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md` and
`solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md`.
This dated section describes retained predecessor construction. The private
successor section below owns the current held request/browser boundary.

`src/app/explorer/conversation/page.tsx` composes only the client shell and
renders no protected account/message/session props. The private data boundary
is freshly authorized GET `/explorer/conversation/state` and guarded same-origin
JSON POST `/explorer/conversation/commands`. Keep both handlers thin, no-store,
without query-selected authority. src/lib/solmind/auth/readRawRequestCookies.ts preserves duplicate raw cookie
names/values and reuses fixed Explorer authorization through
`src/lib/solmind/supabase/explorerConversationRequestDependencies.ts`.
Feature authority is separately rechecked in closed database operations.
`src/lib/solmind/supabase/explorerConversationRepository.ts` exposes only
read/prepare/complete/mutate service-role capabilities.

`src/lib/solmind/explorerConversationContract.ts` is browser-safe and owns
closed bounded command/result shapes, exact UUID selections, expected revision
and required `pendingTurn` boolean. Browser actor, account, application-session,
relationship, policy and provider fields grant no authority. Since 2026-11-03
its state parser requires a saved arrangement's Priority at the apex but lets
current attention be on any current point, placed or not, as the server saves
it since migration 20261103180000 (Paul's decision, decision queue 18:05:33
CST).
`src/components/solmind/ExplorerConversation.tsx` owns fetch, exact result
decoding, view invalidation, one operation/revision and byte-identical uncertain
retry. Unmount/clear private drafts when authority is lost. No browser storage.
A saved pending turn blocks fresh commands; read-only reload may check it
without claiming completion. A failed/uncertain send never invents a reply.
Exact replay is recognized before new context assembly and never redispatches;
changed-byte reuse is refused.

`src/lib/solmind/virtual-guide/explorerConversationComposition.ts` owns
server-scoped conversation/message/snapshot/invocation/reply identities,
command fingerprints, replay preflight, prepare-before-dispatch order and
closed terminal settlement. The injected provider is optional, and the
concrete dependency factory deliberately supplies none. With provider or
context builder absent, a new send returns provider unavailable before any
new turn write. No silent fake, automatic provider retry or runtime credential
selection exists in this source increment.

`src/lib/solmind/virtual-guide/explorerConversationContext.ts` requires explicit
trusted server configuration: methodology pack version ID, prompt/instruction/
role versions and versioned global policy, role behavior, crisis behavior and
methodology text. It imports the real S03A assembler and S03C composer.
The six existing submitted onboarding continuity fields use their actual intake
response-set ID, in banked form order. Required blanks reject; optional blanks
omit. Only onboarding identity may use (real UUID, approved field); duplicate
fields and cross-kind UUID reuse reject. The physical UUID appears once in source
evidence; selection revision `wi007-v0.1+onboarding-fields-v2` is fingerprinted in
the compact context (the AV2 entries; since 2026-11-03, chat step slice S3, the private
ordinary AV3 entries serialize `wi007-v0.1+onboarding-fields-v2+compass-v1` with the saved Compass
and Waypoint section, below). Guide-authored guardrails stay separate from Explorer
preferences. Prior conversations, Reflections, summaries and Guide-private records
remain omitted. The last 24
saved owned messages and immediate Explorer message bind to the current
Explorer/conversation. Final source revalidation rejects revoked or changed
authority/history. Fingerprint the exact compact assembled bytes and retain
sorted source IDs and exact version bindings.
Amendment 2026-11-04 (S5): ordinary AV3 now uses `wi007-v0.1+onboarding-fields-v2+compass-v2` with `explorer-compass-context.v2`; classification_only and AV2 keep the section-free base revision.
Amendment 2026-11-05 (S6b): ordinary AV3 now uses compass-v3 / explorer-compass-context.v3 (forming points add suggestedInPreviousReply); the current inspector is in 20261105030000_explorer_typed_suggestion_replies.sql; compass-v2 is refused.

`supabase/migrations/20261024000000_explorer_conversation_composition.sql`
proposes private conversation-state/operation/Compass and Waypoint storage over
existing interaction-session/message owners. Its four public RPCs are
`public.solmind_read_explorer_conversation`,
`public.solmind_prepare_explorer_conversation_turn`,
`public.solmind_complete_explorer_conversation_turn` and
`public.solmind_mutate_explorer_conversation`; only `service_role` may execute
them. Internal helpers and tables are not browser capabilities. Require current
Explorer application-session/account/role, active or paused relationship,
approved active Practice/Organization, intake/adult/consent and clear restricted
mode, bounded locks, revision protection and exact replay. AV2/
`virtual-guide-predispatch-evidence.v2` adds source/version/intake bindings and
atomic ordered message, snapshot, invocation and audit preparation before I/O.
Retain v1 record values without retrospective enrichment; no v1-only dispatch.
A completed reply requires fresh full authority. Internal failed/canceled
closure can settle the exact retained actor/session/operation/invocation after
logout or expiry, without a reply or private state projection. It cannot
authorize a browser read, new dispatch or downgrade of completed evidence.
Unknown settlement retains honest pending state. The first-turn prepare also
rechecks under the Explorer lock that another tab has not created an active
conversation since the earlier empty read. UI and server reserve two message
slots before sending; formation remains available at the message limit.

`src/components/solmind/ExplorerConversationFormation.tsx` is controlled by
authoritative state, busy and a command-intent callback; pure validation is in
`src/lib/solmind/explorerConversationFormation.ts`. The parent owns operation
identity/retry and persistence. Empty Discovery is valid. Points use an exact
saved owned source and Explorer-supplied label; Priority confirmation and
attention remain separate. A private Waypoint requires destination, meaning,
arrival signal and explicit choice; chosen displays In progress. Later Reached
requires new supporting evidence and explicit confirmation. No sharing, model
interpretation, clinical score, automatic lifecycle change, Guide-private
projection or broader Guide work is added. Existing prototypes, S03A-S03E
foundations and all login/session/logout owners retain their boundaries.
Explicit 24 non-rejected stored/eight visible current-head Compass review adds confirmed wording/combination with retained transitive source links and immutable old captures; selectors/layout never transfer silently. S5 allows 24 separately bounded rejected rows and forming wording without category history. One-way combination frees no slot; Route/Reached/End/owned read-only review preserve confirmed facts without reactivation.

The needle may point at any current point (2026-11-03; Paul's decision,
decision queue 18:05:33 CST, the chat card redesign).
`supabase/migrations/20261103180000_explorer_attention_any_point.sql` replaces
only the internal body of `public.solmind_mutate_explorer_conversation`, which
`public.solmind_mutate_explorer_conversation_v3` calls: its latest definition
(from `20261029030000_explorer_compass_categories.sql`) with one rule block
changed, so `set_attention` accepts any current, not combined-away point,
placed or not, also once a Compass is arranged, and still records the
`attention_changed` Route event with the saved label. Signature, return shape,
security definer, empty search_path, lock timeout, owner (postgres) and grants
(no API role may execute it) are unchanged and restated. `confirm_priority`
keeps its rule (once arranged, only the apex point), and
`public.solmind_confirm_explorer_compass_arrangement_v1` is unchanged: an
arrangement that leaves the current-attention point unplaced is still refused,
so the needle never moves silently (Data Model Spec 03: attention stays
visible in an arrangement). The browser rules match:
`buildAttentionFormationIntent`, the old tools' "Attend to" button, the
Compass card and the closed state parser `parseExplorerConversationState`,
which now reads attention on a point without a position. pgTAP:
`supabase/tests/explorer_compass_arrangement_test.sql`. Rollback limit
(2026-11-03, review REV223): once an Explorer has pointed the needle at a point
without a position in an arranged Compass, an app copy from before this change
cannot read that conversation's saved state (its parser required a placed
attention point), so the app cannot be rolled back on its own past this change
while such a conversation exists; roll back the app together with the
conversation state, or move the needle to a placed point first.

## Explorer Sharing Boundary

S01 implements only transient UI/domain behavior:

- exact item selection;
- a freshly derived final review;
- a deeply frozen in-memory Shared Snapshot;
- `Not ready to share`; and
- a narrow non-live Guide projection.

It does not implement storage, sendability timing, expiry, lineage,
notifications, audit, RLS, Guide Assistant context, or a real Guide view.
Those remain S02 or later owners.

## Safety Boundary

Safety and escalation code should be isolated and heavily reviewed.

Expected future home:

```text
src/lib/solmind/safety/
src/lib/solmind/escalation/
```

Safety code must not be scattered across UI components.

S01 includes only accurate boundary copy. It does not classify, escalate,
notify, or expose safety-level output.

## Supabase Boundary

Current home (banked):

```text
src/lib/solmind/supabase/
```

This directory now holds the banked server-side Supabase integration: the request-auth client (identity, who), the guarded service-role loader (record loads, what), principal mapping, session selection, and the audit write path (the closed-allowlist `auditEventWriteExecutor.ts` over the single enumerated `public.solmind_record_audit_event` function, assembled by `adminAuditEventWriter.ts` for the `/admin/access` composition). The request-auth client, the service-role factory, and the audit write modules are server-only and kept off the shared barrel.

The closed Suggested Waypoint S03 transport and authenticated human-request
composition also live here. Their contract, human/worker executors, and request
composition are direct-import server-only modules kept off the shared barrel.
The request composition wraps only the human executor and derives authority
from injected request-auth and server-loaded records. It accepts only
single-line Guide-authored destinations, while the executor classifies an
exact-function-bound zero-row Guide or Explorer detail result as denied and
keeps every other zero-row result failed. The forward-only Explorer-list
relationship-invariant migration makes a successful empty page mean exactly
one authorized active Guide relationship with no delivered suggestions. Zero
or multiple active Guide relationships and derived authorization failure raise
one fixed value-free exception. The direct-import server-only
`suggestedWaypointExplorerRelationshipRpcError.ts` maps only that exact
Explorer-list function/code/message tuple to the existing denied result; every
near match and every other function remains failed. The shared browser-safe
`suggestedWaypointPaginationSharedContract.ts` owns only the exact page sizes,
strict padded-Base64 cursor grammar, and closed query syntax. The server-only
`suggestedWaypointPaginationRpcError.ts` maps the exact database invalid-cursor
code/message only when it came from the corresponding Guide list, Explorer
list, or relationship-selector function; every near match remains a generic
value-free failure. Later command route/server-action, page/data-adapter, and
worker composition must wrap these boundaries rather than weakening or
bypassing their exact allowlists, validators, role separation, or result
binding.

The browser side of those later command edges must also wrap
`suggestedWaypointCommandBrowserContract.ts` and
`suggestedWaypointCommandOperation.ts`. Route owners keep their exact action and
expected-outcome allowlists; the shared parser must not infer those values. A
transport-uncertain retry reuses the retained operation ID and exact serialized
bytes, while deliberate changed bytes require a new operation ID and generation.

The concrete `suggestedWaypointRequestDependencies.ts` request factory now
wires the request-auth principal source, enumerated auth-record loader, closed
human executor, and `suggestedWaypointScopedIdentifiers.ts` UUIDv5 owner. Both
remain direct-import server-only modules off the shared barrel. This dependency
root remains the only concrete assembly owner. The relationship-selector route
uses its selector subset; the Guide command route invokes the human composition
without widening browser authority.

The Guide detail row has one deliberately narrower extension for the later Pull
Back interaction: `pending_version_id`. The service-role-only database function
projects the exact protected pending row identity only for the already
authorized Guide detail. Both the server RPC parser and browser-safe detail
parser require a canonical UUID exactly in pending mode and require null in
draft or delivered mode. Guide lists and every Explorer contract remain
structurally unchanged. The identifier is an opaque concurrency selector: no
current component renders, announces, logs, or places it in a URL, and all
denied or failed results remain value-free.

The first Guide command caller lives at:

```text
src/app/guide/waypoint-suggestions/[relationshipId]/commands/route.ts
```

It is a thin, dynamic, uncached POST Route Handler over the direct-import
server-only `suggestedWaypointGuideCommandRouteContract.ts`. Query and path
validation run before body, cookie, auth, or dependency IO. The route then
loads only `SOLMIND_TRUSTED_APP_ORIGIN`, applies the bounded same-origin JSON
guard once, validates the exact role body, and injects the path relationship
once. The existing request composition derives actor and role, rechecks the
active Guide relationship, and executes exactly one closed create/save draft,
schedule-send, or Pull-Back RPC. Final projection revalidates the exact
function-bound row and returns only `ok`, `outcome`, `suggestedWaypointId`, and
`error`, with expected failures value-free. The route does not expose policy,
deadline, lifecycle, version, relationship, profile, actor, audit, or private
Explorer values. The Guide detail calls save draft, schedule send, and Pull
Back. The Explorer detail separately calls only Mark as read and Acknowledge
receipt through:

```text
src/app/explorer/waypoints/[suggestedWaypointId]/commands/route.ts
```

That route preserves the same body-before-auth ordering, derives Explorer
identity and its single active Guide relationship on the server, injects the
path suggestion once, and projects only the shared value-free command result.
The server-only local delivery invoker in
`src/lib/solmind/supabase/suggestedWaypointDeliveryWorker.ts` is a separate
composition boundary. A trusted caller supplies one exact operation,
suggestion, and expected pending-version UUID envelope. The invoker snapshots
those values before client or transport work, executes only the closed delivery
RPC through the worker executor once, revalidates and binds the result, and
returns only `delivered`, `not_delivered`, or `failed`. It does not discover due
work, scan protected tables, generate or rotate retry identity, queue, claim,
lease, poll, schedule, run continuously, or activate a hosted runtime.
Together the two browser role lanes do not call that invoker and add no Guide
blank-draft compose, delete, correction, or withdrawal caller, delivery
scheduler, Explorer comparison/adoption/response command, provider, deployment,
or real-user activation.

The test-only Suggested Waypoint whole-path safety kernel in
`tests/whole-path/suggestedWaypointWholePathSafety.ts` is an effect-free gate
for the future `CARRY-001` / `RPR-011` local authenticated runner. Before any
later runner may inspect a credential or create a local fixture, the kernel
requires two exact local-effect interlocks and accepts only project `solmind-app`,
the literal loopback API on `54321`, database port `54322`, a separately owned
loopback application port, one bounded run identity, and five closed synthetic
role labels covering both unrelated-role directions plus one ended actor. It
derives reserved-domain addresses rather than accepting
free-form recipients. It does not construct a client, read a key, create an
Auth principal, write a cookie or file, start a process, touch a database, or
contact a provider. The code-visible interlock values grant no authority and
cannot replace the active workflow or current human authorization. Auth
fixture lifecycle, isolated role sessions, whole-path
execution, unconditional teardown, zero-residue proof, and final local reset
remain separate test-infrastructure owners.

The opt-in local proof driver under `tests/whole-path/` is the separate effect
owner for one synthetic lifecycle only. `runSuggestedWaypointWholePath.mjs`
validates the complete safety environment before reading local keys, invokes
the exact `supabase@2.115.0` CLI through Node, offline and without install
(`--offline --no`), uses webpack only for the
junction-backed isolated proof build, starts one loopback production server,
and launches the isolated Playwright owner. The normal live-repository
`npm run build` remains a separate mandatory Turbopack pre-banking gate. The
SQL fixture temporarily
selects the schema-owned 60-second grace value, while browser authority polling
must observe Pull Back become unavailable before the isolated Vitest delivery
bridge can invoke one exact job and replay. Five browser sessions stay in
memory; keys, cookies, traces, screenshots, videos, and raw failures are not
durable. The driver owns bounded child processes, reverse-order teardown,
result cleanup, and the mandatory final reset. It does not start Supabase,
discover or schedule due items, poll continuously, call a provider, deploy,
contact hosted data, or affect real users.

Since login step 6's sub-slice S6-4 the driver's Auth fixture builds the two
cookies the per-request check requires, because no sign-in route writes them
yet. `suggestedWaypointLocalAuthFixture.ts` takes both names from the app's
session-cookie policy for the trusted application origin, gives the auth
cookie name to the Supabase browser client that signs each synthetic role in,
and adds the session-binding cookie holding the UUID of the
`identity.user_session` row that `suggestedWaypointLocalSqlFixture.ts` inserts
for that role. The UUIDs stay with the fixture owner and never reach a
scenario, and a cookie set that the app's shared format check would refuse
fails with a fixed value-free error before any browser exists.
`suggestedWaypointRoleSessionCookies.test.ts` proves without a database or a
browser that the app's real request-auth adapter accepts each role's cookies
and is presented the UUID the SQL fixture inserts for that role. The driver's
own browser run needs the local database and is run only in a watched session.

The Playwright scenario is partitioned into fourteen closed, test-only steps.
Only the selected value-free step ID may cross the scenario boundary after a
failure; raw thrown values, messages, URLs, request bodies, fixture identifiers,
and other protected detail remain internal. The orchestrator preserves that
closed step only after successful teardown. Fixture or cleanup failure continues
to dominate the scenario result so diagnostic precision cannot weaken
containment. Playwright stops after the first failed viewport project and the
outer runner preserves the first exact finite-allowlist category, preventing a
later project or later string from masking the first durable failure. The
non-effectful contract executes the extracted runner regular expression against
all approved and representative rejected categories, pins the exact ordered
step alternation and real wrapper call sites, and directly proves combined
scenario-step and Auth-cleanup precedence.

Guide draft creation adds one narrower diagnostic owner at
`tests/whole-path/suggestedWaypointWholePathGuideDraftDiagnostics.ts`. It
classifies only request failure, non-success HTTP, response parsing, response
contract rejection, the two fixed browser error kinds, and the four permitted
create-draft outcomes. The Playwright scenario converts only that closed class
into a step subclass; arbitrary errors still collapse to the parent step, and
the outer runner independently allowlists the same ten fixed reasons. This
diagnostic layer changes no product route, request, database, or authorization
behavior.

The driver also adds one deliberately inert server-only seam at
`src/lib/solmind/supabase/suggestedWaypointWholePathGuideDraftDiagnostic.ts`
to localize a generic Guide draft denial during the separately governed local
proof. It is reachable only when every exact local proof environment gate,
loopback target, route and method, and the matching run-ID request header are
present. The route still returns the unchanged four-field browser-safe denial.
Only one of ten fixed stage names can reach the outer runner through in-memory
stderr scanning; arbitrary server output is discarded and never forwarded.
This seam adds no persistent telemetry, product capability, authorization,
database behavior, hosted behavior, or ordinary-runtime output.

Before draft creation, the Guide relationship-entry step now has its own narrow
diagnostic owner at
`tests/whole-path/suggestedWaypointWholePathGuideRelationshipEntryDiagnostics.ts`.
It waits for the exact authenticated first-page list response, validates the
existing browser-safe contract, requires the reset-owned fixture to contain no
suggestions, and then proves the corresponding empty Guide UI. Only nine fixed
value-free request, authority, fixture, and UI-projection reasons may cross the
step boundary; arbitrary values collapse to the parent step and cleanup still
dominates. The check adds no product route, response field, database read,
authorization rule, or persistent telemetry.

That step also owns one deliberately inert server-only seam at
`src/lib/solmind/supabase/suggestedWaypointWholePathGuideRelationshipEntryDiagnostic.ts`.
It is reachable only for the exact local proof GET after every environment,
loopback target, route, and run-ID header gate matches. The list route observes
the already-executed principal, auth-context, Guide-role, relationship-load,
relationship-access, and RPC boundaries without changing their decisions. If
the public result remains the unchanged generic denial, exactly one of nine
fixed stage names may reach the outer runner through in-memory stderr scanning.
No protected value, response field, persistent telemetry, product capability,
authorization change, or ordinary-runtime output is introduced.

The S03 Guide entry boundary also owns one feature-specific Suggested Waypoint
relationship selector. Its forward-only migration exposes only active
relationship ID, Explorer display name, relationship creation time, and
pagination through the closed service-role-only
`solmind_list_guide_suggested_waypoint_relationships` function. The direct-
import `suggestedWaypointRelationshipSelectorContract.ts`, executor, and
authenticated request seam validate and freeze that exact projection; the
concrete request factory wires the executor through the same request-scoped
service-role client. This selector is not the canonical Guide Explorer roster
and must never acquire onboarding, appointment, Shared Snapshot, Practice,
suggestion-count, contact, or private Explorer fields.

The first read-only caller lives at:

```text
src/app/guide/waypoint-suggestions/relationships/route.ts
```

It is a thin, dynamic, uncached Route Handler. It accepts validated pagination
only, builds the read-only request-cookie accessor, delegates trusted
actor/role derivation and the database relationship recheck, and serializes
only the fixed selector result. This route and the Guide/Explorer suggestion
list routes expose the same value-free `refresh_required` result for an exact
stale cursor. Their three client owners may retry only a non-first page, once,
with the same page size and no cursor, under the same request sequence,
controller, and timeout. A successful reset clears cursor history; malformed or
operational failure keeps the last safe page; and a current authority denial
clears it. None of those states loops. It does not protect the Guide page, replace
fixture UI, invoke human commands, mutate Suggested Waypoints, schedule
delivery, call a provider, deploy, or activate a real-user path.

Banked dormant `PRJ01_R-WS09-WI021-S02` adds
`applicationSettingReader.ts` as the narrow setting-read boundary. It accepts
no key from its caller, invokes only the fixed service-role RPC, validates the
exact 1-100/default-7/version shape, returns a frozen value, and maps failures
to one value-free sentinel. It is server-only, remains off the shared barrel,
has no browser export, and has no banked application caller.

Login step 6's sub-slice S6-2 adds the session-cookie policy and the
login-step cookie writer that
`../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
(contract 25, accepted by Paul on 2026-10-04 as AUTH-RLS-DEC-043) Sections 4,
5.2, 6 and 14 describe:

```text
src/lib/solmind/auth/sessionCookiePolicy.ts
src/lib/solmind/supabase/loginCookieWriter.ts
src/lib/solmind/auth/__tests__/sessionCookiePolicy.test.ts
src/lib/solmind/supabase/__tests__/loginCookieWriter.test.ts
```

`sessionCookiePolicy.ts` is pure: it imports nothing, reads no environment
variable and adds no setting. Given the trusted origin in the canonical form
that `loadTrustedApplicationOrigin()` returns, it gives one of two frozen
policies. `https` gives `Secure` and the `__Host-solmind-auth` and
`__Host-solmind-session` names; plain `http` is allowed only on `127.0.0.1`,
`::1` or `localhost`, with no `Secure` and the names `solmind-auth` and
`solmind-session`; any other origin is a configuration failure, so no cookie
is written and sign-in is denied. Every cookie gets `HttpOnly`,
`SameSite=Lax`, `Path=/` and no `Domain`; a session write gets the session's
remaining life, 1 to 3600 seconds, as Max-Age, and a removal gets an empty
value and Max-Age 0. The auth cookie N is split into `N.0`, `N.1`, ... as
the installed `@supabase/ssr` 0.12.0 names chunks, and its PKCE code verifier
is `N-code-verifier`, the key `@supabase/auth-js` 2.108.2 uses once
`cookieOptions.name` sets the storage key to N. The module also holds the
three no-store headers and the one shared Section 14 format check: every
chunk of the auth cookie may hold only A-Z, a-z, 0-9, `-` and `_`, the
value the library would join must start with `base64-`, and the part after
`base64-`, decoded as base64url exactly as the library decodes it, must be
strictly valid UTF-8 (Paul's 2026-10-05 correction of Section 14), or the
auth cookie counts as absent. Since sub-slice S6-4 the check ends with a
field check of the session inside the cookie, described below.

`loginCookieWriter.ts` is server-only and sits beside `requestAuthClient.ts`,
where contract 25 Section 6 places it. It imports neither `@supabase/ssr` nor
any Next.js module: the route's composition root hands it the response
(anything with `cookies.set` and `headers.set`, such as a Next.js response).
At login it takes the cookies the library handed over after sign-in, the
request's cookies, the database's session UUID and the session's remaining
life. It accepts only N and its chunks, and, for removals only, the code
verifier and its chunks. Any other name, a non-empty code verifier, a
repeated name, or writes that are not one complete value (N alone, or `N.0`
to `N.k` with no gap and no N) deny the login with nothing written.
Otherwise it sets the no-store headers first, clears every other auth chunk
and code verifier the request carries (fixation), writes the session chunks
and the binding cookie with the database's session UUID, and never reads the
request's binding cookie. At logout it writes removals only. It plans the
fixed clears of N, the code verifier and the binding cookie regardless of
earlier authentication or provider outcomes, and adds permitted names from
readable cookie lists. Invalid configuration or a malformed call denies
before writing. A response-setter exception can stop the clears partway and
returns `failed`. A removal is always a `set` with Max-Age 0, never the
framework's cookie delete, which drops `Secure`. Results are frozen and
value-free; nothing throws or logs. If the response throws mid-write, the
result is `failed` and the composition root must discard that response.

Since sub-slice S6-8 the Explorer sign-in routes' server composition
calls the login writer `writeLoginSessionCookies` in `loginCookieWriter.ts` only
after the SolMind session exists and the held cookies were released. Its
logout clear writer is called by the guarded logout composition (S6-12),
with the request, cookie-read and trusted-policy prerequisites below. `sessionCookiePolicy.ts` has had a
runtime reader since sub-slice S6-4, the per-request adapter
`requestAuthClient.ts`, which takes the cookie names, the format check and
the accepted cookie's sign-in token from it on every guarded request; since
S6-8 the sign-in routes' dependency factory resolves the policy from the
trusted origin, and their route contract takes the three no-store headers
from it. Both stay off every barrel, and the boundary tests check with
TypeScript's parser that exactly those references exist and that no other
application file references or names either module.
The guarded logout composition (S6-12) now reads the shared cleanup
candidate and uses the owned-cookie clear writer. The Explorer verify
route also uses the candidate reader for its cleanup-only backstop; the
boundary tests enumerate these explicit references. A later new caller
must amend those tests in its own reviewed slice.
The strict UTF-8 step
closes the limit that review #149a confirmed: a value that passed the
character and `base64-` checks could still decode to a code point above
U+10FFFF, and the installed library's decoder then threw an error naming
a number derived from the value, which the library passes to its
warning. The library's decoder throws on no well-formed UTF-8, so for an
auth cookie value the check returns, no decoder exception reaches that
warning; the module's tests show this against the library's own decoder.
That is all the step claims. It does not make the decoded value valid JSON
(the library's separate warning for invalid JSON carries no part of the
value) or the session authentic, and it says nothing about any other cookie
a reader hands to the library. The per-request check (S6-4) applies the
check before any Supabase client exists and hands the library only the
sign-in token of a cookie the check accepted, never the cookie; logout
(S6-12), whose client reads the cookie, is to put the check in front of
`@supabase/ssr` before it reads any auth cookie. The field check that S6-4
adds as the check's last step also refuses a decoded value that is not
JSON, so the library's warning for one is no longer reached for a cookie
the check returns.

Login step 6's sub-slice S6-7 adds the Supabase identity bridge of
contract 25 Section 6 (hold, then write) and
`../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
Section 7.9 (AUTH-RLS-DEC-035):

```text
src/lib/solmind/supabase/loginIdentityBridge.ts
src/lib/solmind/supabase/__tests__/loginIdentityBridge.test.ts
```

`loginIdentityBridge.ts` is server-only, with the runtime browser guard, and
sits beside `requestAuthClient.ts` in the request-auth adapter layer where
contract 25 Sections 5.1 and 6 keep `@supabase/ssr` (AUTH-RLS-DEC-012,
DEC-013 and DEC-019). It imports `server-only`, `@supabase/ssr` and the
server-only `credentialPairProof.ts` owner, with no Next.js module or incoming
cookie accessor. The optional proof loader reads only its dedicated server
key; the route's composition root passes the Supabase URL and anon key, the auth
cookie name N from the same S6-2 policy it gives the writer, a provider
deadline (10 ms to 60 s), a fetch, the link seam (the service-role client's
Auth admin API) and a value-free cleanup-failure signal. The link seam's
client must reach Supabase Auth through a non-logging, non-rejecting fetch
boundary. That is a required precondition and an S6-8 composition gate: the
library logs a rejected fetch's error, whatever it carries, before the bridge
sees the answer, or after the bridge has answered when the rejection comes
after the deadline, and the bridge cannot prevent that. Each sign-in builds
one `@supabase/ssr` server client whose cookie reader returns no cookies and
whose cookie setter only holds, in memory, the cookies the library hands
over after its sign-in event; with no cookies to read, that is the
session's chunks under N and no removal, which S6-2's writer accepts.

For Guides and the Admin, `signInWithPassword` sends the typed email and
password; refused credentials give `credentials_refused` with nothing held.
After the route has redeemed the challenge, the hold's `assertProviderUser`
compares the bound provider user id. For Explorers, after the route's
redemption, `exchangeExplorerLink` asks the link seam for a `magiclink`
link, denies a link made for any other user before any exchange, and
exchanges the link's token hash at once with `verifyOtp` (type `email`).
The answer's user, the session's user, the access token's subject and the
held cookies' access token must agree, or the result is `failed`, and
equal the bound id, or the result is `denied`; either way the bridge
immediately attempts best-effort local revocation of a session that came
back. A link made for another user is `denied` before any exchange, so no
session exists to revoke. `release` hands over the held `{ name, value }`
cookies only after that assertion and when the caller states `created` or
`existing`, a precondition the trusted caller attests. A refused first
release while the hold is pending starts cleanup. Repeated release attempts
return `refused` without another provider operation. A hold is released at
most once.
`discard` drops the held cookies and immediately attempts best-effort local
revocation of that one transient session (`POST /logout` with scope `local`
and the session's own access token); only a successful answer is `cleaned`,
and anything else raises the signal once and still denies.

Each sign-in or exchange is one attempt with its own hold client, transport
and recovered access tokens, so concurrent attempts never share a token.
While the attempt is open, the access token in every answer to its request,
whatever the library then makes of that answer, and in every completed
hand-over is kept, for cleanup only. The attempt gives a hold only when the
library's answer is a well-formed session, the one hand-over carries that
session's token and no other token was recovered; otherwise every recovered
token immediately gets best-effort local revocation, and each failed
revocation raises the signal once. A successful answer read only after the
attempt ended, because it arrived or its body completed after the deadline,
never gives a hold and never reaches a release; its token immediately gets
best-effort local revocation. Cleanup requests are never read for tokens. A
timeout does not establish whether Supabase created a session; if no access
token is ever recovered, revocation cannot be attempted.

`accessTokenExpiresAt` is the access token's `exp` claim, as contract 25
Section 7 sizes the session from the access token's remaining life; the
session's stored `expires_at` must be well formed but does not redefine it.
Every hold-client request goes through its attempt's transport, which bounds
it by the deadline and turns every failure into one fixed 503 answer, so the
library's own logging of a rejected fetch is not reached on these
requests; the bridge waits for the link seam at most the same deadline,
though the seam has no abort. The configuration, dependencies and request
objects themselves are read through own data properties only, so no getter
on them runs; the link seam's `generateLink` and the library's answers are
read as ordinary properties.
Every result except a successful release carries no token, cookie value,
password, email, link token or provider id; a successful release carries
the held cookie values, which contain the tokens. The bridge throws nothing
once constructed, and its own code logs nothing; the installed library keeps
its own logging paths. The bridge makes no direct session-read call, though
the library's initial-session emission still reads the hold's empty storage.

The banked Explorer dependency factory builds the bridge with the link seam
behind its required non-logging, non-rejecting fetch boundary, and Explorer
composition calls `exchangeExplorerLink`. Separate Guide and Admin dependency
factories provide fixed-role password authentication. Keep the bridge
off every barrel and preserve only explicit server-only factory references.
Module-call ownership is not publication or banking evidence; SL-070 in the
execution ledger owns current Guide status.

Login step 6's sub-slice S6-8 adds the two Explorer sign-in routes, the first
application callers of the login modules above:

```text
src/app/login/explorer/send/route.ts
src/app/login/explorer/verify/route.ts
src/lib/solmind/supabase/explorerSignInComposition.ts
src/lib/solmind/supabase/explorerSignInDependencies.ts
src/lib/solmind/supabase/explorerSignInRouteContract.ts
src/lib/solmind/supabase/loginAccountLookupCallers.ts
src/lib/solmind/supabase/loginLinkAdminClient.ts
src/instrumentation.ts
src/instrumentation-node.ts
```

Decided by Paul on 2026-10-07: seven things this section describes. The
record is
`solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`, "The
2026-10-07 check-in: answered (first seen by the 11:30:10 clock read)"; each
is option 1 of the item named, in Part 2 of
`solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Morning_Checkin_Packet_2026-10-07.md`.
They are, in each option's words: the two route paths,
"`/login/explorer/send` and `/login/explorer/verify`" (item 3); for the
Explorer home address, "name the new page's address now, `/explorer/home`,
and build the page with the screens" (item 4); for the wait, "a fixed wait
of about one and a half seconds, set from the first local run. Accept the
three limits for the local demo, and record them." (item 5); for a refused
code, "one "code not accepted" result for every refused code, its words
chosen with the screens" (item 6); for the link client, "a second, separate
module used only for that one link request, exposing nothing else" (item 7);
for a missing pepper when the server starts, "the app starts, sign-in is
unavailable, and one fixed line with no value says so" (item 9); and, after
a correct code, "keep the small message naming the fixed home" (item 18),
which is the verify route's JSON answer. Each is marked `DECIDED` in the
code. Paul approved the words shown for `code_not_accepted` on 2026-10-17
(S6-10). Still open: the wait's exact value, which the first local run sets
(the code uses 1,500 ms until then), and actual browser proof of the proposed
Explorer home and connected screens.

Both routes are thin, POST-only, dynamic Route Handlers. Each loads the
trusted origin, runs the same-origin JSON guard before any other work, denies
any query parameter, checks the body shape with an exact-key parser, and
makes one call into `explorerSignInComposition.ts`, which holds both step
orders and imports no Next.js module. Every answer is HTTP 200 with one of a
closed set of results in its JSON body and the same headers: the
session-cookie policy's three no-store headers and
`X-Content-Type-Options: nosniff`. Nothing is taken from the client but the
typed text, the opaque selector and the code: the identifier type `email`,
the role `explorer` and the purpose `login` are literals in the composition,
and a body that carries a role, an account id, a session id, a purpose or a
return address is refused whole.

Configuration first. `explorerSignInDependencies.ts` builds a request's
dependencies before the composition makes its first database call, so a
configuration fault spends no code, budget slot or attempt: the
session-cookie policy; the loopback rule; login step 5's configuration and
composition root; one more service-role client for the two lookup callers
and the session caller; and, for the verify route, the Supabase URL and anon
key, the link client, the identity bridge and the session caller. Any failure
is one fixed, value-free error, and the route answers its generic deny. The
loopback rule is on both routes: the step 5 root always composes the local
development mail transport, for the issuer and the redeemer together, so
both factories refuse a trusted origin whose policy is not the loopback one
before that root is called, and both routes deny on a hosted origin until a
provider adapter exists. A send request builds two clients with the
service-role key (the step 5 root's own and the factory's), both through
`serviceRoleClient.ts`; a verify request builds three, the third in
`loginLinkAdminClient.ts`.

Send a code. The composition fixes the answer time, normalizes the typed
text (not an email: `invalid_email`, with no lookup), builds the
dependencies, and takes a spare selector from the issuing caller with a
fixed, structurally invalid request (an empty object), which that caller
refuses with a fresh UUID, no slot, no database call and no mail. It then
calls `solmind_resolve_login_account` with the type and the Explorer role
fixed. Only for exactly one row does it issue, with both UUIDs and the email
from that row. It never issues with null binding UUIDs, which the banked
issuing caller and the issuance function accept for `login` with no contact
check. From the lookup on there is one exit: the banked acknowledgment with
a selector (the issuing caller's, or the spare one), after the wait. No
answer of the send route sets a cookie.

Verify the code and sign in, in the order of
`../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
Sections 7.1.3 and 7.9: redeem the selected challenge; look the account up
from the typed email with the role fixed; confirm with
`solmind_confirm_redeemed_login_challenge` that the redeemed challenge is
that account's own; run the bridge's Explorer exchange with the looked-up
email and bound provider user id; create the SolMind session once; release
the held cookies, stating the outcome that session call returned; and only
then call the route's function that makes the success response and write
both cookies onto it with `writeLoginSessionCookies`. The route keeps only
the request's cookie names (every value is replaced by an empty string)
for the writer to clear old chunks. From the same guarded read, the route
separately captures a shared-format cleanup candidate containing the old
access token, refresh token and optional pair proof. Only the accepted-login
cleanup closure receives that candidate; it never authenticates the fresh
login or reaches a login account lookup. After independent fresh provider
verification and SolMind session acceptance, bounded cleanup may attempt
only a provably distinct older provider session. Once a hold exists, every exit that is not the success awaits the
hold's `discard` before it answers. A returned redemption `denied` or
`invalid_request` is `code_not_accepted`; every other failure is the generic
deny; the success names one server constant as its destination.

The wait and its limits. The composition takes a clock and a waiter as ports
and asks the waiter for one fixed floor (1,500 ms), measured from
composition entry and not from the request's arrival: on the send route for
every exit from the account lookup on, and on the verify route for every
exit from the redemption call on except the success. Earlier refusals do not
wait; waiter failure can return early. It is a floor, not equal timing. It
does not hide a send that runs longer than the floor, slowness someone
creates by flooding the send route, or the shared pool of four issuance
slots. The tests prove the answer time the code asks for, with a fake clock
and counted calls; they do not measure what an observer sees.

What a failure can leave. No cookie reaches the browser on any failure.
Cleanup of the transient Supabase session is attempted and can fail; a failed
cleanup writes one fixed, value-free line through the bridge's signal and
never changes the deny. A code is spent by any failure after it was
redeemed. After the session call answered, the new session row exists and
the account's earlier session has ended, also when the release or the writer
then fails; no application code ends that session; a later sign-in of the
same account supersedes it, and otherwise it ends by itself within the hour.
Paul decided on 2026-10-07 to "accept it for the local demo, and record it"
(the morning check-in packet's item 8, option 1; the record is
`solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`, "The
2026-10-07 check-in: answered (first seen by the 11:30:10 clock read)").

`loginAccountLookupCallers.ts` holds the two lookup callers: one fixed
function name each, a narrow RPC seam, a caller response deadline, frozen
results, no retry and no log. `loginLinkAdminClient.ts` builds the one client
the bridge's link seam uses: a service-role client whose fetch never rejects
and never logs (a failed request becomes one fixed 503), handing out only
`generateLink`. It is the composition gate the bridge's precondition names,
and it adds no deadline of its own. `explorerSignInRouteContract.ts` holds
the body parsers, the closed results, the fixed destination and the response
headers.

The startup check. `src/instrumentation.ts` exports `register`, which in the
Node.js runtime only imports `src/instrumentation-node.ts` and runs
`checkLoginVerificationConfigurationAtStartup` once. A failed check writes
one fixed, value-free line and the server keeps starting; with no usable
pepper the two routes then deny, because their configuration load fails. A
hook that could not load or run the check writes a different fixed line.

The five lib modules and the Node.js half of the start hook begin with the
`server-only` import; all nine files are direct-import only and stay off
every barrel. The banked connected Explorer layer below calls the two
routes (S6-10) and shared logout route. Separate connected Guide and Admin
owners below compose their fixed request routes and screens.
The five boundary tests that guarded the login modules as dormant now assert
the exact list of references these files add.

Supabase code should not expose service-role credentials through client-accessible variables.

Never put service-role keys or bootstrap tokens in `NEXT_PUBLIC_*`.

S01 does not import or call Supabase.

## Prepared Guide/Admin and Explorer browser boundaries (2026-10-16)

This dated section describes dormant, unbanked components under the accepted
[solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Login_Step6_S69_Design_Brief_2026-10-08/DESIGN_BRIEF_R04.md](../../solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Login_Step6_S69_Design_Brief_2026-10-08/DESIGN_BRIEF_R04.md). The old component reviews remain source-only history. Explorer/logout are now
banked as SL-069; combined Guide evidence/publication status is owned by SL-070.

The server-only `solmind-app/src/lib/solmind/supabase/passwordRoleSignInBodies.ts`
reads exact fixed-role raw-string bodies. The pure
`solmind-app/src/lib/solmind/auth/adminLoginIdentifierNormalizer.ts` owns Admin
email/username dispatch and the approved username allowlist; it changes no stored
name, schema or bootstrap. Guide email handling and raw passwords stay unchanged.
The server-only `solmind-app/src/lib/solmind/supabase/passwordRoleSignInCore.ts`
has four fixed Guide/Admin send/verify entrypoints and stays off shared barrels.
No request supplies role, purpose, account, session, duration or destination authority.

Send prepares the issuing caller's harmless spare acknowledgment before lookup,
then uses only the eligible lookup's stored sign-in email and paired account/contact
identities for at most one issuance. Later refusal, throw or floor-wait failure
retains the prepared acknowledgment rather than exposing the failing stage.
Verify follows eligible lookup, exact ownership, password authentication into a
private hold, code redemption, provider-user assertion, same-account redeemed
confirmation and session creation. Ownership is before password and wrong password
does not redeem. The separate fixed `solmind_check_login_challenge_owner` read in
`solmind-app/src/lib/solmind/supabase/loginAccountLookupCallers.ts` checks the
challenge/account/contact-account join; it does not duplicate eligibility,
redemption or freshness, mutate a row/audit, or widen the seven-function
`solmind-app/src/lib/solmind/supabase/serviceRoleRpcExecutor.ts` allowlist.

After an accepted `created` or `existing` SolMind result, the corrected core
targets the logout R03 bridge's five-field hold, including
`prepareAcceptedSession`. Preparation precedes release, preserves the actual
session outcome, and reduces cookie lifetime for measured elapsed time and the
remaining provider-token lifetime. Invalid clocks or nonpositive lifetime refuse
completion. Every held failure awaits discard and discards any partial success
response. Common pre-factor `not_matched` and the configured response floor
cover lookup through same-account factor confirmation; earlier boundary/configuration
and handled post-factor completion failures remain `denied`. The floor is a
mitigation, not constant-time authentication; waiter failure preserves the chosen
refusal. Fresh credentials stay private to the hold. Previous-cookie cleanup
capability belongs in the identity/dependency layer, never core authentication
input; no old-credential cleanup or production factory is added by this core.

The injected ports are trusted executable dependencies. The core does not bound
arbitrary hanging code, prove cancellation of remote effects, or roll back an
already committed session. Concrete deadlines, safe transport and bounded cleanup
come from the concrete production dependencies. Current combined assurance
and Guide publication/banking status are owned by SL-070 in the execution ledger.

`solmind-app/src/lib/solmind/supabase/passwordRoleSignInRouteContract.ts`
describes `/login/guide/send`, `/login/guide/verify`, `/login/admin/send` and
`/login/admin/verify`, with fixed `/guide/home` and `/admin/home` destinations.
The constants/types themselves implement no route, protected page or cookie
publication. Separate Guide and Admin connections compose their fixed subsets;
prototype-role route constants are unchanged. Handler outcomes
share the declared status/headers; only a complete accepted success may carry
the login writer's cookies. R04 actual Guide wire observations and their success-body capture limit are recorded in the execution test catalog.

The separate Explorer browser-safe owners are
`solmind-app/src/lib/solmind/signInBrowserContract.ts`,
`solmind-app/src/lib/solmind/explorerSignInBrowserTransport.ts` and
`solmind-app/src/lib/solmind/explorerSignInFlowController.ts`.
They preserve raw inputs, fixed paths and closed replies, bounded request/response
bodies, an explicitly supplied response budget, and a private selector with
generation invalidation before abort. Stale completions cannot publish current
state. Cancellation ends local waiting only; it proves no remote rollback or
absence of a session/cookie effect. They add no retry, DOM navigation, browser
storage, operational timeout default or connected preview. Additional UI source
authoring remains separate; combined Explorer refusal wording and usable expiry
behavior belong to their separate connected owners. Exact test ownership and
dated completed/remaining SQL/provider/wire/browser/timing evidence are in [solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md](../../solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md).

## Connected Explorer request and view boundaries (2026-10-16)

Explorer connection is banked as SL-069 on October 20; its dated actual proof
and limits remain in the execution ledger. Preserve password-role, ownership
and logout boundaries. Earlier components retain source-only historical scope.
Connected Guide below has its separate composition; /explorer stays independent.

`solmind-app/src/components/solmind/LoginExperience.tsx` owns A1 role selection.
`solmind-app/src/app/login/page.tsx` mounts it normally;
`solmind-app/src/app/login/explorer/page.tsx` supplies `initialExplorer` for fixed
re-entry. Connected Guide and Admin supply their own fixed entry pages and
separate SignIn components. Standalone `solmind-app/src/components/solmind/SignInPreview.tsx`
callers retain optional `initialRole`/departure props, in-memory behavior and
prohibitions. The Explorer branch supplies browser fetch,
an explicit 60000ms local wait, value-free status rendering and fixed
`location.replace('/explorer/home')` only after current accepted success. No
query return URL, role selector or credential enters navigation. The existing
`solmind-app/src/components/solmind/ExplorerSignIn.tsx` owns private drafts,
selector/generation invalidation and commit-time departure cleanup.

`solmind-app/src/app/explorer/home/page.tsx` is dynamic server-only request
composition, not a client redirect guard. It reads the raw Cookie header with
bounded framing (16384 characters, 128 pairs), preserves duplicate names and
exact values, and rejects malformed framing without URI decoding or merging.
The installed Next cookie collection normalizes through a Map and cannot supply
that ambiguity evidence. A read-only accessor feeds
`solmind-app/src/lib/solmind/auth/explorerHomeAccess.ts`; trusted server code fixes
`/explorer/home` in `solmind-app/src/lib/solmind/routeAccess.ts`.

The access owner constructs the actual direct-token principal source and narrow
record source, then calls the current composer. Cookie format, platform identity,
active account/role/session, selected-session binding and Explorer route access
must all pass. Final expiry must be strictly after a fresh finite server clock
observation. Only `{ allowed: true, expiresAt, observedAt }` or the opaque
`{ allowed: false, reason: 'route_access_denied' }` leaves this seam. The page
passes only the two times to the home, never account/provider/profile/session IDs
or credentials. Missing, expired, superseded, ambiguous, wrong-role or failed
checks render S2 without protected children. A missing profile alone introduces
no new authentication-shell eligibility gate. GET performs no refresh, cookie
clear, logout or audit write. Inherited direct-token network-deadline limitations
remain; the new seam does not bound an arbitrary never-settling dependency.

`solmind-app/src/components/solmind/ExplorerHome.tsx` consumes that time projection.
Its private view lifetime owns logout and timers. `solmind-app/src/lib/solmind/logoutBrowserRequest.ts`
issues only same-origin POST `/logout`, no query, JSON `{}`, no-store,
same-origin credentials, redirect refusal and one owned cancellation signal.
The explicit browser wait is 30000ms and the complete response is bounded to
1024 bytes. Only the closed current `signed_out` result shows S1; refusal,
malformed/missing/late answers and local failure show honest SM-OUT-01 uncertainty.
No retry, browser cookie deletion or claim of provider rollback/administrator
notification follows. Server outcome and safe clearing remain owned by the
logout composition; client cancellation establishes only local abandonment.

`solmind-app/src/lib/solmind/explorerLoginJourney.ts` owns value-free copy and
advisory expiry. The browser uses trusted expiry/observation plus a wall/monotonic
high-water elapsed clock, warns within five minutes and shows S2 at apparent
expiry. Invalid time fails closed; resumed/cached pages require a fresh request.
The timer neither grants authority nor extends/revokes a server session. S1/S2
offer only `/login/explorer`. Stay signed in remains a later accepted amendment,
not a button or renewal route in this component. Paul approved the sign-in and
finite-session reminder wording on 2026-10-17; the exact messages are recorded in
`solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`,
under Explorer screen copy approved - 2026-10-17.

All text rendering is value-free and ordinary React text. Credentials stay out
of URLs, logs, storage and home props. Static rendering, fake fetch and direct
binding tests do not exercise mounted React or a real browser. Exact planned
coverage and unperformed proof are in
[solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md](../../solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md#connected-explorer-proof-plan-2026-10-16).

## Logout and credential-pair provenance boundary

`src/app/logout/route.ts` is a thin dynamic Node.js POST handler. Under
`src/lib/solmind/supabase/`, `logoutRouteContract.ts` owns the exact empty-JSON,
no-query request and closed outcomes including guarded local no_current_sign_in absence; `logoutComposition.ts` owns ordering and
safe clearing with no remote constructors for true current-policy cookie absence; cookie Max-Age alone clamps exactly5s clock excess to3600; LoopbackSignInAddressWarning offers a public fixed-role opposite-loopback link. `logoutDependencies.ts` constructs independent database/provider
capabilities; `userSessionLogoutCaller.ts` calls only
`solmind_logout_user_session(account, presentedSession)` once; and
`logoutProviderSignOut.ts` owns bounded explicit-token local cleanup. These
server-only owners stay off shared/client barrels. No request body supplies
account, role, session or redirect authority. The Explorer and Guide homes call this route through their closed browser boundaries.

The same-origin JSON guard precedes the one cookie read. Only a readable
cookie list and trusted policy permit `writeLogoutSessionCookieClears` to clear
the auth and code-verifier families plus binding, preserving remembered-browser
cookies. Later malformed request shape or missing backend settings still reaches
safe clearing, with no unauthorized remote work. A fresh denied response replaces
any partially written response. Only a strict database `ended`/`already_ended`
answer plus successful clears yields `signed_out`; other completed clears yield
`sign_out_unconfirmed`. Provider failure cannot undo confirmed SolMind termination.
A suspended account or superseded session does not need application access to end
its identifiable presented session; the current-session access guard stays strict
on every protected read/write. Never substitute the account's current session.

`credentialPairProof.ts` owns optional HMAC-SHA256 pair provenance. Its server key
`SOLMIND_CREDENTIAL_PAIR_PROOF_KEY_BASE64` is documented without a value in
`.env.example`. Only the identity bridge can mint from a trusted fresh provider
response after account assertion and SolMind acceptance; logout receives only
verification capability. The proof binds the exact access/refresh bytes, issuer,
audience, account, provider-session UUID, expiry, trusted origin and auth-cookie
name. It is the `solmind_pair_proof` property inside the existing encoded auth
session, not a new cookie family or an authentication grant. The bridge rechunks
the augmented session before the cookie writer publishes it with the binding.
The 32,768-byte encoded-session cap and normal hold/release failure handling apply.
The pure `readSessionAuthCookieCleanupCandidate` uses the shared format check and
returns only a captured candidate; it does not verify a proof or grant authority.
Legacy/malformed/missing proofs do not invalidate ordinary independent auth checks.

Missing/invalid key configuration disables minting and proof-authorized renewal;
no key is created or substituted. Suitable existing-token cleanup remains possible.
A renewal requires a valid exact-pair proof before dispatch, then independent
verification of matching renewed identity. Explicit `scope=local`, no retries,
no global/others scope, bounded bodies/deadlines and a non-rejecting sanitized
transport prevent widening the operation. Timeout/abort does not prove cancellation.

The Explorer verify route captures prior credentials before fresh authentication.
After fresh identity assertion and SolMind acceptance,
`prepareAcceptedSession` invokes the optional cleanup backstop before release.
Only a verified same-account, distinct older provider session is eligible; the
backstop never renews, enumerates sessions, writes cookies or receives a fresh
credential/discard capability. Insufficient release budget skips it. The identity
hold owns at most one best-effort report attempt for failed prior-session cleanup,
including its own deadline; late completion cannot emit a second report. The
separate fixed line `solmind_login_prior_session_cleanup_failed` contains no values
and makes no administrator-notification claim. Reporting failure cannot change
fresh login. Release rechecks expiry and the composition reduces Max-Age for
elapsed time. Existing cleanup of a failed fresh login and its separate
`solmind_login_identity_cleanup_failed` signal remain unchanged. Server target isolation
does not solve competing Set-Cookie responses in one browser; future UI operation
coordination and watched browser/provider/database evidence remain required.

These are implementation controls for the accepted October12 behavior, not new
product decisions. The owning contract is
`../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
Section 9; test ownership and assurance limits are in
`../solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md` Section 7.2.

## Admin Access Route Boundary

The `/admin/access` server route handler is the first banked request-auth boundary.

```text
src/app/admin/access/route.ts
```

It is a thin composition root: it reads request cookies, builds the request-auth principal source, and delegates to the server-only composition, which loads the real Admin auth source through the guarded path and returns only an opaque `{ allowed }` boolean. It is deny-by-default and fail-closed.

This route is an opaque probe. It does not protect the `/admin`, `/guide`, or `/explorer` pages, and it performs no product-record writes, creates no session, adds no RLS policy, and runs no migration. The only persistence on this path is the bounded Auth/RLS audit rows the delegated composition writes (AUD-3): on an allow, the guarded-read row and the allow decision row must both persist before the outward allow. Keep the route thin; composition, decision, and audit wiring live in `src/lib/solmind/auth`.

## Context Boundary

AI-role and Explorer-facing context assembly is isolated.

```text
src/lib/solmind/context/
```

Context code must preserve SolMind role separation. The SolMind Virtual Guide is Explorer-facing and must receive only Explorer-safe context. The SolMind Guide Assistant is Guide-facing and must receive only Guide-authorized context. Do not blend Explorer-private and Guide-private context in a single path.

The human Guide remains the human Guide; the SolMind Guide Assistant is the AI that supports the human Guide. Do not conflate them.

S01 does not assemble AI context. Its non-live Guide projection is a pure
visibility-boundary function, not a prompt-context function.

`PRJ01_R-WS09-WI021-S03A` adds one provider-free Explorer-safe context kernel:

```text
src/lib/solmind/context/explorerSafeContext.ts
src/lib/solmind/context/__tests__/explorerSafeContext.test.ts
```

The module is server-only, is imported directly by later server composition,
and must remain off `src/lib/solmind/context/index.ts`. It accepts one unknown
runtime envelope, validates exact keys and Virtual Guide/Explorer bindings,
projects the canonical nine layers into a new fixed-key deeply immutable
object, and returns its compact deterministic JSON serialization. It may reuse
only the pure role-alignment and Explorer-eligibility owners in this directory.
Summary continuity is eligible only through the exact banked publication
projection: a published Summary container, a target-bound published
publication, an active or paused Guide-Explorer relationship, a
`published_to_explorer` revision, and an `explorer_facing` section whose
visibility is `published_to_explorer`. Container type or status alone never
authorizes inclusion. Co-located cross-contract tests pin the accepted Summary
and relationship vocabulary to the owning migrations.

This boundary is not a provider prompt or complete orchestration service. It
must not import React/client code, routes/actions, repositories, Supabase,
provider adapters, environment owners, browser state, Guide/Admin/safety
repositories, or the S01 Explorer browser-memory prototype. Source retrieval,
authorization/consent refresh, context snapshots, audit/fingerprint runtime
enforcement, context budgeting, provider dispatch, persistence, route/UI
integration, deployment, and real-user use remain separate gates.

`PRJ01_R-WS09-WI021-S03B` adds one provider-neutral conversation boundary:

```text
src/lib/solmind/virtual-guide/virtualGuideConversationContract.ts
src/lib/solmind/virtual-guide/__tests__/virtualGuideConversationContract.test.ts
```

The module is server-only, is imported directly by later server composition,
and must remain off every shared/client barrel. It accepts only the exact compact
serialized context already authorized by S03A together with opaque invocation,
Explorer, session, context-snapshot, and fingerprint identifiers. It validates
exact request keys and byte limits, creates a frozen copy, invokes one injected
transport with bounded timeout and caller cancellation, then validates an exact
invocation-bound response and returns a deeply immutable copy. Its closed error
algebra carries no provider or request values. Co-located tests use an in-memory
fake transport and prove that malformed input never reaches that seam.

S03B neither selects nor calls a concrete provider by itself. It does not load
context sources, refresh authorization or consent, create or verify the context
fingerprint, read environment configuration, import a provider SDK, persist or
audit messages, expose a route/action, connect S01R2, deploy, or affect a real
user. Fake transport behavior is test-only and must never become a production
fallback. Those responsibilities remain separately gated later S03 increments.

`PRJ01_R-WS09-WI021-S03C` adds authorized context composition:

```text
src/lib/solmind/virtual-guide/authorizedVirtualGuideContext.ts
src/lib/solmind/virtual-guide/__tests__/authorizedVirtualGuideContext.test.ts
```

This direct-import server-only owner accepts only server-issued invocation,
Explorer, session and context-snapshot identifiers. Its injected source exposes
exactly one authorization-snapshot load and one minimized version revalidation;
the functions are descriptor-checked and captured before the first await. The
composer independently proves self-Explorer actor/account binding, Explorer
role context, active onboarding, adult affirmation, an active or paused
relationship bound to the Explorer, and exact equality between non-empty active
required-consent IDs and accepted IDs. It then runs S03A, requires the resulting
Explorer/session binding, hashes the exact compact serialization with SHA-256,
revalidates the minimized authorization proof/version, and returns a frozen S03B
request. Ineligible continuity is omitted by S03A; prompt-injection text remains
data and cannot add context keys or source capabilities.

S03C's revalidation is not final dispatch authority. It has no concrete
repository or database loader, does not persist the context-snapshot ID, does
not create S03D pre-I/O evidence, and does not own provider/model selection,
credentials, provider I/O, logging/audit, route/action, browser/UI code,
deployment or real-user activation. Later server composition must derive its
request identifiers and supply the reviewed concrete source; S03D must recheck
and record the required evidence immediately before any provider effect.

`PRJ01_R-WS09-WI021-S03D` adds the protected pre-dispatch evidence boundary:

```text
supabase/migrations/20260924000000_virtual_guide_predispatch_evidence.sql
supabase/migrations/20260927000000_virtual_guide_predispatch_evidence_hardening.sql
supabase/tests/virtual_guide_predispatch_evidence_contract_and_security_test.sql
supabase/tests/virtual_guide_predispatch_evidence_realpath_test.sql
supabase/tests/virtual_guide_predispatch_evidence_hardening_test.sql
supabase/tests/virtual_guide_predispatch_evidence_concurrency_test.sql
```

The service-role-only, security-definer function revalidates the current
Explorer account/role, one of the three Explorer session types, session status,
Explorer profile/onboarding, relationship/Practice binding, single-Guide
topology (no other current Guide relationship), restricted-mode state,
active/approved Practice and Organization, adult affirmation and complete
active required-consent set immediately before evidence creation. Every
authority and exact-retry comparison is null-safe. It locks the reviewed
authority rows and stabilizes the required-consent definition, recomputes an AV1
proof over those current facts,
then atomically creates one bounded context snapshot, one started invocation and
the exact two value-free Family E lifecycle rows. Advisory serialization,
unique operation/snapshot indexes and a 2-second lock timeout make the boundary
bounded and idempotent. Exact retry is retained evidence with an explicit
no-dispatch disposition; a changed payload under the same operation, or a
snapshot or invocation identifier already used by another operation, fails
closed, normally as `operation_conflict`; a racing reuse can instead end in
the 2-second lock timeout, and a check that runs earlier (for example stale
authorization) reports its own error first.

S03D does not load the S03A sources, call S03E, persist conversation messages,
select a credential, expose a route/action, own the safety response, deploy or
activate a real-user path. `exact_retry` must never trigger a second provider
call.

The database recomputes and verifies only the AV1 authority proof. It does not
verify the context fingerprint, the context source IDs, or their ownership;
the server caller attests them. The rule that derives the context source IDs
is still an open composition gate, because the S03C result exposes no
source-ID set. A `created` result is therefore necessary but not sufficient
for a provider attempt. An S03D v1 context snapshot is write-once by contract
(no update path or role grant exists; the database does not block an
owner-level update) and leaves
the Methodology Context Pack version, typed source IDs including
`related_reflection_ids`, and policy/behavior versions empty; the snapshot
fields required by `solmind-docs`
`execution/04_SolMind_AI_Orchestration_Spec_v1_0.md` Section 12, plus an S03E
instruction version, must be recorded at creation by a separately reviewed
successor evidence contract, and v1 evidence alone never authorizes an
Explorer-facing dispatch. Later composition must also bind the dispatched
bytes to the stored fingerprint. Any outcome other than `created`, including
`exact_retry` and every denial, authorizes no provider call.

`PRJ01_R-WS09-WI021-S03E` adds a dormant Luna-specific transport adapter:

```text
src/lib/solmind/virtual-guide/openAiLunaVirtualGuideTransport.ts
src/lib/solmind/virtual-guide/__tests__/openAiLunaVirtualGuideTransport.test.ts
```

The adapter is a direct-import server-only implementation of the single S03B
transport capability. It fixes one HTTPS Responses endpoint, model
`gpt-5.6-luna`, medium reasoning effort, `store: false`, fixed Virtual Guide
instructions and a bounded output request. It passes only the exact S03B
authorized-context string as input. The credential and `fetch` capability are
captured from later server composition; the module cannot read environment
state and accepts no endpoint/model/instruction/tool/storage override. Redirects
are denied. HTTP/provider failures, provider bodies and credentials collapse to
value-free transport failure at S03B. The response must be completed by the
selected model, contain exactly one assistant message and no tool output; one
provider refusal maps to fixed Explorer-facing text before S03B validates the
final local envelope.

This adapter is not runtime activation. It does not create S03D snapshot/
invocation/audit evidence, select an operational credential, expose a route,
persist conversation messages, own safety escalation, connect the UI, deploy or
affect a real user. Tests use fake HTTP and a deterministic message-ID function.
No real OpenAI request is made by this slice.

## Schema Foundation Boundary

Database schema foundations live under:

```text
supabase/migrations/
```

The MVP0 schemas and tables are banked through migrations, with Row Level Security enabled deny-by-default on application tables. Permissive or role-aware RLS policies, grants, and runtime access enforcement remain deferred. Do not add policies, grants, or schema changes without a Database/Supabase workflow slice and approval. The authoritative Auth/RLS banked-vs-deferred status is `../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md`.

The banked dormant S02 protected-setting foundation adds one deny-by-default
`core.application_setting` singleton and two purpose-built service-role-only
functions. The mutation serializes the singleton, checks expected version, and
embeds the exact
`../solmind-docs/execution/22_SolMind_MVP0_Auth_RLS_Audit_Persistence_Contract_v0_1.md`
Family F row in the same transaction as an actual change. The audit payload is
closed and typed: no free-form caller reference or reason can enter the
database. Same-value/current-version requests and exact already-applied retries
are writeless; any request-field mismatch, stale version, unknown token, lock
failure, or audit failure fails closed. The family has since grown to six
closed rows: the Suggested Waypoint send grace (2026-08-13) and the four product
hard-stop settings (2026-11-01).

The banked dormant DEF5-S3 issuance foundation keeps the database boundary narrow: `public.solmind_issue_verification_challenge` is a service-role-only, purpose-built `SECURITY DEFINER` operation over `identity.verification_challenge`, `identity.contact_method`, and the exact Family B `audit.audit_event` row. Its partial unique index independently limits each normalized-contact/purpose pair to one structurally open challenge. It does not authorize a route, delivery provider, invitation acceptance, session creation, self-signup, Guide assignment, or rate-limit implementation. The outer app/route layer must establish invitation or self-signup eligibility before calling it. The resend and lockout controls (AUTH-RLS-DEC-037) are implemented inside the same function by `supabase/migrations/20260929010000_verification_issuance_abuse_limits.sql` (login step 2, app `05884ed`); Explorer and connected Guide fixed send compositions reach it through login step 5's shared issuing caller, for a loopback trusted origin only; Admin remains inactive. Its stored comment still says no runtime caller or real-user path may use it until separately gated. Paul's go-ahead of 2026-10-04 for step 6's login writes, for local synthetic work only (no real users, no cloud; AUTH-RLS-DEF-011), is read as that gate; it is recorded in `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`, "Paul's Acceptance (2026-10-04)" and Section 1. Card 5 adds `supabase/migrations/20261027000000_verification_issuance_unused_code_limits.sql`: only `used_at IS NULL` rows count in the rolling hour and both lockout queries; unused superseded, expired and exhausted codes still count. All other function-body bytes and ownership/grants are preserved; the stored comment records that codes used to sign in do not count.

Login step 4 adds the server-only, provider-neutral verification-code
delivery boundary that
`../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
section 7.1.3 describes, and a local development transport for it:

```text
src/lib/solmind/auth/verificationCodeDelivery.ts
src/lib/solmind/auth/localSmtpVerificationCodeDelivery.ts
src/lib/solmind/auth/verificationCodeEmailWording.ts
src/lib/solmind/auth/__tests__/verificationCodeDelivery.test.ts
src/lib/solmind/auth/__tests__/localSmtpVerificationCodeDelivery.test.ts
```

The delivery boundary is direct-import only and stays off every barrel. It
accepts only an `issued` outcome from
`public.solmind_issue_verification_challenge`; `denied` or any other value is
refused with a fixed error. That check is a trusted-caller precondition, not
proof that a challenge committed. The boundary checks every field, rejects
unknown keys, and returns an opaque handle that serializes to `{}`. It calls
one injected transport's `send` at most once per prepared handle, within an
elapsed-time ceiling that the caller sets between 10 ms and 15 s, and has no
fallback transport. Its limits are a retry ceiling of 0 and one send per
prepared handle: a handle cannot be delivered twice, but two handles prepared
with the same challenge and code are two sends. A retry is never a resend of
the same code: under AUTH-RLS-DEC-033 it is supersede-and-reissue, a new
issuance that spends budget under AUTH-RLS-DEC-037. The outcomes form a
closed set: `accepted`, `delivered`, `bounced`, `throttled`, `ambiguous`,
`timeout`, `retryable_failure`, `terminal_failure` and `cleanup_failure`,
each returned as a frozen, value-free `{ outcome }`. The boundary meters no
spend and passes through whatever closed outcome the transport returns.
Before the ceiling, a transport that throws, rejects or returns anything
outside the set gives `ambiguous`. When the ceiling is reached, the boundary
aborts the transport and gives it one turn of the event loop to report. Only
the literal `ambiguous`, or a rejection, which counts as `ambiguous`, can win
in that turn; anything else, including a value outside the set, or no
answer, is `timeout`, so no success is ever reported after the deadline.
`timeout` is treated like `ambiguous`: either way the code may or may not
have been sent, and neither is retried.

The boundary does not generate a code and holds no verifier, pepper or
credential; the plaintext code stays only in memory until its one attempt. It
writes nothing to a database, audit table or log, reads no environment
variable, and does not reveal whether an account, invitation, contact or role
exists. Mapping outcomes to the outward response belongs to the future caller.

The development transport emails the code to the local test mailbox over plain
SMTP, using Node's built-in `node:net` and no new dependency. Its host, port,
sender, wording and timeout (10 ms to 15 s) are required settings with no
defaults, and it reads no environment variable. The host must be exactly
`127.0.0.1` or `::1`; `localhost` and every other name or address are refused.
It uses no AUTH or STARTTLS. The email's sender, subject and body live in
`src/lib/solmind/auth/verificationCodeEmailWording.ts`; the transport takes
them as required settings with no defaults. They must be printable ASCII, and
the code token must appear exactly once in the body and never in the subject.
The message is sent as 7bit `text/plain; charset=us-ascii`, and every body
line that starts with `.` is dot-stuffed. One overall deadline covers
connecting, every reply and the message. Before the message is written, a
4xx reply or a refused or dropped connection is `retryable_failure`, a 5xx,
unexpected or malformed reply is `terminal_failure`, and a timeout is
`timeout`. Once the message bytes start to be written, a 250 reply is
`accepted`, never `delivered`, because it shows only that the local mail
server took the message. Every other reply after that point, including 4xx
and 5xx, is `ambiguous`, because a failure reply does not prove that the
server did not queue the message; a lost, late or unreadable reply is
`ambiguous` too. When the boundary's ceiling aborts it, the transport reports
`ambiguous` if the message had started and `timeout` if not, and the
boundary keeps that result. The transport's spend ceiling is 0, because the
local mail catcher costs nothing. An SMS request returns a fixed
`terminal_failure` without touching the network, because SMS is disabled
locally. Results and errors never contain the code, the contact, the
challenge id or any server reply text.

Four obligations fall outside this step. The login step 5 caller must bind
each delivery to its own issuance answer, and its unit tests must prove that
ordering (the answer comes before the delivery); that the database commits
before it answers (commit before answer) remains for the separately gated
database proof. It must prepare exactly one delivery per issuance answer,
keep no copy of the code, and reach the transport only through
`deliverVerificationCode`, never by calling the transport's `send` directly,
because duplicate suppression here is per prepared handle only. The step 5
composition root must bound how many sends run at once. A future provider
adapter must state and prove its own spend ceiling and delivery proof, with
its own idempotency, retry and elapsed-time limits, before it is activated.

Only login step 5's callers and composition root, described next, import the
three modules. Since login step 6's sub-slice S6-8 the Explorer sign-in
routes call that root, for a loopback trusted origin only, with the settings
of sub-slice S6-1; nothing else composes them. The
boundary tests use injected fake transports and the transport tests use an
in-process loopback server; none of them touches the local Supabase stack or
its mail catcher.

Login step 5 adds the server-only code module, the issuing and
redeeming callers (a restricted core and a public module), and their
composition root:

```text
src/lib/solmind/auth/verificationCode.ts
src/lib/solmind/auth/verificationChallengeCallersCore.ts
src/lib/solmind/auth/verificationChallengeCallers.ts
src/lib/solmind/auth/verificationChallengeComposition.ts
src/lib/solmind/auth/__tests__/verificationCode.test.ts
src/lib/solmind/auth/__tests__/verificationChallengeIssuance.test.ts
src/lib/solmind/auth/__tests__/verificationChallengeRedemption.test.ts
src/lib/solmind/auth/__tests__/verificationChallengeComposition.test.ts
```

The four modules are direct-import only, stay off every barrel, start with
`import "server-only";`, and read no environment variable of their own.

`verificationCode.ts` generates the six-digit code with Node's `randomInt`,
uniformly from 000000 to 999999, and the challenge UUID with `randomUUID`.
It computes the AUTH-RLS-DEC-032 verifier exactly as the register fixes it:
`svf1:` followed by 64 lowercase hexadecimal characters of HMAC-SHA-256,
keyed by the pepper, over the ASCII fields
`solmind-verification-challenge-svf1`, the lowercase canonical challenge
UUID, the purpose and the code, joined by the byte 0x0A. Its tests reproduce
the register's known-answer verifier and the verifiers that the banked
redemption pgTAP fixtures store. Every input check is a whole-string match:
an uppercase UUID, or any value with a final line terminator (LF, CR, CRLF,
U+2028 or U+2029), is refused before any HMAC, and tests pin this, pairing
each refused value with its otherwise identical accepted request. The
pepper, at least 32 bytes, is held as a Node `KeyObject` behind an opaque
handle that serializes to `{}`. The module compares no verifiers: the banked
redemption function's byte-exact comparison is the only one, so the app adds
no second verification authority.

`verificationChallengeCallersCore.ts` holds the two callers. It is a
restricted module: its factories take the slot pool as a separate argument,
so only `verificationChallengeCallers.ts` and three named unit-test files may
import it, which a boundary test checks with TypeScript's own parser, as the
provider-probe harness does for its restricted modules. Each caller reaches
the database only through an injected RPC seam, which the service-role
client satisfies, and calls exactly one fixed function; neither accepts a
function name. The issuing caller picks a fresh challenge UUID for every
request (the one exception: if Node's `randomUUID` ever failed, the result
would carry the fixed nil UUID, which `randomUUID` never issues). It checks
the request against the issuance function's own rules, takes an issuance
slot, generates the code, computes the verifier, and calls
`public.solmind_issue_verification_challenge` once under a caller response
deadline: the time the caller waits for an answer, not a limit on the call
itself. Before the call it records that deadline on a monotonic clock
(`performance.now()` plus the configured limit) and arms a timer that aborts
the call's AbortSignal at that time, which requests cancellation through
`fetch`. The deadline is checked when the answer settles, so an answer whose
callback runs late, even before the timer could fire, is late; it is checked
again just before a delivery is prepared. Only a timely answer of exactly one
row `{ outcome: "issued" }` is treated as an issuance; then, and only then,
the caller prepares exactly one delivery for it and hands it to
`deliverVerificationCode`, never to the transport directly. The code is kept
only for that single local delivery attempt; this is not a claim that memory
is erased. A `denied` row is `denied`; the function's fixed
`solmind_issue_ineligible_contact` and `solmind_issue_invalid_binding` errors
are `ineligible`; anything else, including a late or lost answer, is `failed`
and delivers nothing. There is no retry. Every result carries the request's
UUID, which names a challenge only after `issued`, so every outcome maps to
one generic outward acknowledgment of one shape. The redeeming caller takes
the purpose the route fixes and the client's selector and code, refuses a
malformed one without a database call, takes a redemption slot (`busy` if
none is free), computes the verifier, calls
`public.solmind_redeem_verification_challenge` once under the same kind of
caller response deadline, and returns `redeemed` (only for a timely answer that is still
before the deadline when it is accepted), `denied`, `busy`, `invalid_request`
or `failed`. Results are frozen and value-free: they never hold a code,
verifier, pepper, contact or database error text, and nothing logs.

An `issued` or `redeemed` answer is the database function's own answer. It
shows committed database state only if four things hold, and they must be
proved before these callers are used against any database: PostgREST runs
the call at READ COMMITTED isolation; each call is its own transaction, begun
just before the function runs and not given a `transaction_timeout` above 60
seconds; that transaction commits before the answer is sent; and no layer
replays the POST. The composition tests prove the last point for the client
layers, for both callers: postgrest-js 2.108.2 sends one POST and does not
retry it after a network error or a 503 or 520 answer. Node's own `fetch` and
the first three points need a local database run, which needs Paul's
AUTH-RLS-DEF-011 approval.

`verificationChallengeCallers.ts` is the public module. Optional bound email/login flow uses a10arg atomic mapping wrapper; fixed-role4arg resolution supplies one actual code UUID, preserving legacy8arg calls and six-unused limits. NewUI keeps the private flow ID across resends. It owns two slot
pools: four issuance slots shared by every issuer and four redemption slots
shared by every redeemer built through it, by any root. Its factories take
no pool, refuse a dependency object that carries one, and pass their own
pool as the separate argument. The parser-checked `src` references show that
this public module and three named unit tests are the only literal importers
of the core: the issuance and redemption tests, which pass test pools to the
core's caller factories, and the composition test, which exercises its slot
factory. So no caller built through these public factories can supply a pool,
and no parser-checked `src` reference outside the public module and those
tests reaches the core. Reflective loading (`createRequire`, `module.require`
or the `Function` constructor) is beyond those source checks and could still
reach the core's exported factories. A caller takes
a slot before its database call and gives it back only when that call has
settled (and, for issuance, when the delivery boundary has returned), even
when the deadline decided the outcome earlier. The bound proved is therefore:
per loaded copy of this module in one server process, at most four issuances
(each a database call followed by at most one delivery attempt through the
delivery boundary) and at most four redemption calls are in progress at the
client at any moment, for every caller built through the public factories,
whichever roots built them. This meets login
step 4's duty that the step 5 composition root bound how many sends run at
once: the root takes no pool, and every root's callers draw on these pools.
A call that never settles holds its slot indefinitely, so a pool fails closed
to `busy`. Nothing is bounded across processes or server instances, and
nothing is proved about what a transport does after the delivery boundary has
returned (the local SMTP transport may still close its socket within its
one-second QUIT grace).

`verificationChallengeComposition.ts` is the composition root. It
takes no slot pool and cannot be given one. It wires the public callers to
the service-role client from `createServiceRoleClient()`, which reads its two
existing environment variables only when the root is called, and to login
step 4's local SMTP transport with the approved email, through explicit
configuration with no defaults. The service-role client is postgrest-js
2.108.2, whose `abortSignal()` passes the caller's signal to `fetch`, so at
the caller response deadline the abort requests cancellation through
`fetch`. Whether the transport cancels, and whether and when the call then
settles, depend on the transport (postgrest-js turns `fetch`'s AbortError
into an error answer), and nothing proves that PostgreSQL stopped or rolled
back the call. Tests inject fake database
clients and transports, and drive the real postgrest-js client through a fake
`fetch`; no test touches a database, the local Supabase stack or its mail
catcher. The boundary tests use TypeScript's own parser to find every module
reference (static and side-effect imports, re-exports, `import x =
require()`, dynamic `import()` in any spacing or comment form, `require()`
calls and other value uses of `require`, `typeof import()`, and any use of
`import.meta`, through which Vite's `import.meta.glob` could load modules
without naming them). They parse every non-test file, the ten guarded
modules included (login step 4's three, these four, and, since login step
6's sub-slice S6-1, its three), and refuse any computed reference and any
`import.meta` use in it; only then do they exempt the guarded modules'
literal references to each other, and prove that no other application file
reaches these modules, login step 4's or S6-1's through any of those forms.
Reflective loading (`createRequire`, `module.require` or the `Function`
constructor) is beyond what a source parser can see.

Step 5 itself has no route, server action, cookie, session or UI; since login
step 6's sub-slice S6-8 the Explorer sign-in routes call the root. Three
duties are not provided by step 5: the pepper's source and the startup check
that AUTH-RLS-DEC-032 requires; the one shared, unit-tested contact
normalizer of AUTH-RLS-DEC-033 (the callers only check that a contact is
already canonical); and the route-owned purpose and eligibility (the route
must fix the purpose and prove invitation, first-Admin or account
eligibility before it calls). Sub-slice S6-1 supplies the first two, and
S6-8 supplies the third for the Explorer sign-in, with the timing of the
outward response.

Login step 6's sub-slice S6-1 adds the first two of those duties,
with the login route configuration that hands the step 5 root its settings:

```text
src/lib/solmind/auth/verificationPepperSource.ts
src/lib/solmind/auth/loginRouteConfiguration.ts
src/lib/solmind/auth/loginContactNormalizer.ts
src/lib/solmind/auth/__tests__/verificationPepperSource.test.ts
src/lib/solmind/auth/__tests__/loginRouteConfiguration.test.ts
src/lib/solmind/auth/__tests__/loginContactNormalizer.test.ts
```

Paul's 2026-10-05 evening decision 1 placed the settings that banked
decisions already require (the AUTH-RLS-DEC-032 pepper, the step 5 root's
delivery settings and the trusted origin) within login step 6, with no
change to `supabase/config.toml` or to any hosted configuration. The
contract 25 wording that records that meaning, and its register record,
belong to sub-slice S6-3.

`verificationPepperSource.ts` is server-only, refuses to load where a
browser window exists, and besides the server-only marker imports only
`node:buffer` and the code module.
It takes the pepper from one server-only environment variable,
`SOLMIND_VERIFICATION_PEPPER`, listed with an empty value in `.env.example`,
as base64url text with no padding, 32 to 64 bytes (43 to 86 characters).
More than 64 bytes would add
nothing, because HMAC-SHA-256 hashes a longer key down to 32 bytes first.
The text is accepted only in its one canonical form: exactly that character
set and length, with no padding, whitespace or line terminator, and decoding
it and encoding the bytes again must give the same text, so the platform's
lenient decoder cannot widen what is accepted. If
`NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER` is also present, the pepper is
refused: a tripwire for that one name, not a guarantee that the value is
exposed nowhere else. Any failure throws one fixed, value-free
`VerificationPepperSourceError` (`verification_pepper_unavailable`); whatever
was thrown inside is dropped unread. A success returns the code module's
opaque handle, which serializes to `{}`, and the module then overwrites its
decoded copy of the bytes with zeros; the text stays in the environment, and
JavaScript strings cannot be wiped. Each call reads the environment again and
makes a new handle.

`loginRouteConfiguration.ts` is server-only and imports the pepper source
and, type-only, the step 5 root's configuration type, so loading it does not
load the root. `loadLoginVerificationConfiguration` returns exactly the
root's configuration as one frozen plain object: the pepper, and delivery
settings fixed in the code rather than read from the environment. The host
is `127.0.0.1`, which login step 4's transport accepts; the port is 54325,
the local mail catcher's SMTP port that `supabase/config.toml` publishes
(`[inbucket] smtp_port`), which a test checks; the delivery ceiling is
5,000 ms; and the caller response deadline is 6,000 ms, longer than the
issuance function's two advisory lock waits of up to 2,000 ms each
(`lock_timeout`), which a test reads from the current migration. The
6,000 ms caller response deadline leaves 2,000 ms beyond the two documented
advisory-lock waits. Other waiting, execution, transport and scheduling
delays can still cause a committed issuance to be reported as failed. A test
hands the loaded configuration to the real
root with fake dependencies and checks that both callers are keyed by the
loaded pepper. `checkLoginVerificationConfigurationAtStartup` is
AUTH-RLS-DEC-032's startup check: it loads the configuration once and returns
nothing, or throws the pepper source's fixed error. Since sub-slice S6-8 the
server start hook calls it when the server starts (Next.js 16's
`instrumentation.ts` `register`, in the Node.js runtime only, because the
pepper path uses `node:crypto`): a failed check writes one fixed, value-free
line and the server keeps starting, and a route composition that loads this
configuration still fails closed. These
settings point at the local mail catcher only: the route composition must
not compose the local transport unless the trusted origin is a loopback
origin, and a hosted environment needs a provider adapter that does not
exist yet.

`loginContactNormalizer.ts` is pure (no import, IO, environment read, clock
or logging) and is AUTH-RLS-DEC-033's one shared normalizer for login
emails. It refuses anything that is not a string or is longer than 512
characters before any other work, removes leading and trailing ASCII
whitespace (tab, line feed, form feed, carriage return and space), refuses
the rest unless every character is printable ASCII (nothing outside ASCII is
mapped or folded, so a look-alike such as the Kelvin sign is refused rather
than turned into `k`), lowercases A-Z only, and accepts the result only if it
passes the current issuance function's email check exactly: 3 to 254
characters, that function's pattern, and no `..`. Tests compare its pattern
with the migration's text and its behavior with the delivery boundary's
canonical check for every printable character. A refusal is `null`; a
success returns the canonical email, which is a contact value that callers
keep out of audit rows, errors, traces, alarms and logs. It decides no
eligibility. Phone sign-in is outside login step 6, so phone normalization
joins this module when phone sign-in is designed; the Admin username's
lookup belongs to the login lookups (S6-5 and S6-9).

Since sub-slice S6-8 the Explorer sign-in routes use all three: their server
composition calls the normalizer, their dependency factory loads the route
configuration, which loads the pepper, and the server start hook runs the
startup check. All three stay off every barrel. They stay in the login step
5 boundary test's guarded set (VCB-004), and their own boundary tests check,
with TypeScript's parser, their exact imports, that `process.env` appears
only as the default value of an `environment` parameter, and that exactly
the references S6-8 added exist and no other application file references or
names them. The next slice that imports any of them (S6-9) amends both
tests.

The banked dormant DEF5-S4 slice keeps session mutation separate from redemption and provisioning. `public.solmind_create_user_session` consumes committed account-bound `login` or `role_reentry` evidence, owns account-wide supersede-then-create serialization, and embeds its exact Family B audit rows. Its freshness policy and both uniqueness indexes are hidden database backstops, not client authorization. Corrective migration `20260716001000_user_session_creation_chronology_guard.sql`, banked in `d2fbb0e`, preserves the writeless exact-retry branch and requires never-sessionized evidence to be strictly newer by `(used_at, challenge UUID)` than every prior session-linked evidence tuple for the account; chronology denial is fixed and zero-write. The three DEF5-S4 plans contain 49/51/50 assertions, and clean reset passed 14 files / 502 assertions. The banked slice creates no caller, route, cookie, provider action, account/profile/role provisioning, invitation or Guide assignment dependency, cloud path, or real-user flow. Its only application caller is login step 6's session-creation caller (sub-slice S6-6), described next, which the Explorer sign-in routes call since sub-slice S6-8.

Login step 6's sub-slice S6-6 adds that caller and the duration rule it uses:

```text
src/lib/solmind/supabase/userSessionCreationCaller.ts
src/lib/solmind/auth/loginSessionDuration.ts
src/lib/solmind/supabase/__tests__/userSessionCreationCaller.test.ts
src/lib/solmind/auth/__tests__/loginSessionDuration.test.ts
```

Both modules are direct-import only, stay off every barrel, and read no
environment variable. `loginSessionDuration.ts` is pure, with no import and no
clock: every time is passed in. It holds the rule of
`../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
Section 7: the requested duration is the provider access token's remaining life
in whole seconds, rounded down, minus 120, capped at 3600, and under 1 the
login is denied; the cookies' Max-Age is the session's remaining life in whole
seconds, rounded down, worked out from the `expires_at` the function returns,
with no cap. A session cookie may be given only 1 to 3600 seconds, the range
that S6-2's login-step cookie writer accepts, so under 1 second no cookie may
be written, and more than 3600 seconds, which only this server's clock running
behind the database's can show, is refused as an abnormal state; the caller
reports both as `failed`. `expires_at` is read only in the exact form
PostgreSQL prints a `timestamptz` in JSON, with a real calendar date and time.

`userSessionCreationCaller.ts` starts with `import "server-only";` and imports
only the duration rule and the role names. It reaches the database only through
an injected RPC seam that the service-role client satisfies, and calls only
`public.solmind_create_user_session`, whose current definition is in
`supabase/migrations/20260718000000_authorizing_evidence_consumption.sql`; it
accepts no function name. Its request is exactly the server-derived account
UUID, the role the route's login path fixes, the challenge UUID the route has
just redeemed, and the provider access token's expiry in epoch seconds. Any
other key (a purpose, a duration, a session id) or a malformed value, including
a final line terminator, is `invalid_request`, with no database call. It fixes
the purpose to `login`, the one flow step 6 builds, works out the duration with
the rule (`denied` under 1 second, with no call), and calls the function once
under a caller response deadline, as login step 5's callers do: a monotonic
deadline recorded before the call, a timer that aborts the call's signal, which
postgrest-js passes to `fetch`, and the deadline checked again just before an
answer is accepted. It accepts only exactly one row whose only keys are
`outcome` (`created` or `existing`), a lowercase canonical `user_session_id`
and an exactly printed `expires_at`, and returns that UUID and the Max-Age. The
function's seven fixed refusals of the evidence, account or role are `denied`;
everything else, its other fixed errors included, is `failed`. A test reads the
migration and checks both lists, the arguments, the duration bounds, the
outputs and the service-role-only grants (all privileges revoked from PUBLIC,
execute revoked from `anon` and `authenticated` and granted to `service_role`)
against the current definition. Results are frozen, and each refusal is one
shared object. Refusals contain only `outcome`; successful results contain
`outcome`, `sessionId` and `maxAgeSeconds`. The session UUID in `sessionId` is
what the binding cookie needs, so the route must never log a result. Once
constructed the caller never throws, and it never logs.

`existing` is accepted only for this exact flow. The function's exact-retry
branch returns the same live session for this challenge, account, role and
purpose, and it runs before the freshness check, so anything that could call it
twice with one redeemed challenge could recover a live session's UUID for up to
an hour. The caller therefore makes one call per `create`, never retries,
offers no lookup or recovery entry point, and checks `existing` exactly as
`created`; the tests show that postgrest-js 2.108.2 sends one POST per call and
does not replay it after a 503, a 520 or a network error. The route slices
(S6-8 for the Explorer, S6-9 for Guides and the Admin) must call it only after
their own redemption of that challenge returned `redeemed` in the same request,
after every other factor and check the role's login path requires, and at most
once per request. A `created` or `existing` answer shows committed state only
if the call is its own READ COMMITTED transaction (the runtime-caller
requirement of
`../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
Section 7.3), PostgREST commits before it answers, and nothing replays the
POST; only the last is shown here, and the rest belongs to the route slice's
database run. A lost or late answer may hide a session the database did make,
which has also ended the account's previous session; the caller reports
`failed`, no cookie is written, and that session ends by itself within the
hour.

Explorer, Guide and Admin compositions call the session creator through their
explicit server-only factories; Guide/Admin use the shared fixed-role
password-role core. Each accepted verify request calls `create` once after
its own factors and same-account confirmation. The session caller alone uses
the duration rule; neither module owns a route, cookie writer or UI.
Current TypeScript parser-covered boundary tests enumerate the exact factory/
composition references, preserving off-barrel and computed-reference guards.
Reflective loading remains beyond a source parser. The banked identity bridge
supplies the provider expiry; incoming browser values never supply that authority.

The dormant login step 6a logout writer keeps ending a session inside one database operation. `public.solmind_logout_user_session` takes only the server-derived account and the presented session UUID, takes the same shared account-domain advisory lock as session creation (and no evidence lock), then the presented row's lock, and only then reads its one database clock, so a session that expires during either wait is not ended. It changes that session to `logged_out` with `ended_at` only when it is the account's active, unexpired session, embedding the one Family B logout audit row in the same transaction. It reports `ended` or `already_ended`; an unknown or another account's session fails closed with one fixed identifier, and every other error raised in its body, an assertion failure included, leaves as one fixed `solmind_logout_*` identifier with no underlying message, detail, or hint. EXECUTE is granted to `service_role` only: `anon` and `authenticated` execution is denied, and service-role RPC execution through the Data API stays available, as for session creation. It never ends any other session, reads no evidence, and does not require the account or role to be active, because ending a session only removes access. Its application caller is now `userSessionLogoutCaller.ts`, through the shared logout composition. The database function itself reads/writes no browser cookie and makes no provider call. Real provider/browser proof, hosting and real-user activation remain separate.

Login step 6's sub-slice S6-3 changes the banked active-session lookup `public.solmind_find_active_user_sessions(uuid)` (AUTH-RLS-DEC-026; function 3 of `../solmind-docs/execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md`) so that each returned row also carries its `user_session_id`, the UUID that the per-request session-binding check of `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25) Section 8, as Paul corrected it on 2026-10-05, compares with the binding cookie (sub-slice S6-4). `supabase/migrations/20261005000000_active_user_session_lookup_session_id.sql` drops and recreates the function in one transaction, because PostgreSQL cannot replace a function whose return columns change, and keeps everything else: the one `uuid` argument, `LANGUAGE sql`, `STABLE`, `SECURITY DEFINER` owned by `postgres`, an empty search path, one schema-qualified SELECT of `identity.user_session` with only the account and `session_status = 'active'` predicates and no expiry pre-filter, `LIMIT`, `ORDER BY`, or exception handler, and the same grants (all privileges revoked from PUBLIC, EXECUTE revoked from `anon` and `authenticated` and granted to `service_role`). It raises nothing of its own: an absent or null account returns no rows. Unlike the dormant step 6 modules, it has runtime callers: the `/admin/access` composition (`adminAuthSource.ts`) and the Suggested Waypoint request dependencies (`suggestedWaypointRequestDependencies.ts`) reach it through `serviceRoleRpcExecutor.ts`, and until sub-slice S6-4 `supabaseAuthQueryClient.ts` read only the four columns it named from each row. Since S6-4, described below, it requires `user_session_id` in every row and carries the selected session's UUID and `expires_at` to the allow result. The UUID grants nothing on its own and stays out of logs, errors and evidence (contract 25 Sections 8 and 14). Two pgTAP suites, `supabase/tests/active_user_session_lookup_*_test.sql`, prove its shape, hygiene, grants and real path; the real-path suite compares session UUIDs only inside SQL, so a failing assertion prints none. The banked `admin_access_rpc_*` suites are unchanged.

The login step 6 sign-in lookups (sub-slice S6-5) keep a sign-in's account and evidence checks inside two read-only database functions. `public.solmind_resolve_login_account` takes only an identifier, its type (`email`, or `username` for the `admin` role only) and the role the route's login path fixes. Its stored-state predicates are ones the banked functions already use: the issuance function's sign-in contact check (an active, verified, sign-in-enabled email) and its canonical email check, applied to the contact's stored email, session creation's account and role checks (an active account and an active role assignment with no revocation time), and the one active `supabase` provider identity that the identity bridge asserts. It returns the account, the contact, that email and the bound provider user id only when exactly one candidate exists; every ineligible, unknown or ambiguous identifier gives the same zero rows, so the route can answer every identifier with one acknowledgment, and neither path returns an email the issuance function would refuse. A typed email must pass the issuance function's own check, so login step 6's contact normalizer (S6-1) and issuance accept the same set. A typed username is checked only for what the schema already requires of a username (not blank) and must already be lowercase, so that it compares with `lower(username)`, the expression of the unique username index; no other username form is imposed, and the Admin's sign-in route (S6-9) must pass it lowercased. `public.solmind_confirm_redeemed_login_challenge` takes the server-derived account, the exact selector the route has just redeemed and the expected purpose, and returns one row: `true` only when that challenge is bound to that account with a contact, has that purpose, is used and not invalidated, and is fresh under `identity.session_creation_freshness_policy` with the session function's comparison, measured from the start of the calling statement; `false` for every other state, with no reason. It is a check before the Explorer's Supabase exchange, not a consumption check: the Explorer route (S6-8) must have its own `redeemed` answer for that selector in the same request, and then `true`, before it asks Supabase for a session, so that a code one person redeemed cannot make a Supabase session for an account someone else typed; the session function still checks everything again. Both functions are STABLE, so they cannot write; a malformed argument raises one fixed identifier that carries no part of the input, and neither has an exception handler or takes a lock. EXECUTE is granted to `service_role` only: `anon` and `authenticated` execution is denied, and service-role RPC execution through the Data API stays available. Since sub-slice S6-8 the Explorer sign-in routes call both, through the two server callers in `src/lib/solmind/supabase/loginAccountLookupCallers.ts`; the functions themselves add no route, cookie, provider action, cloud path, or real-user flow.

Login step 6's sub-slice S6-4 is the per-request check of contract 25 Sections
7, 8, 14 and 19: Sections 8 and 19 as Paul corrected them on 2026-10-05
(AUTH-RLS-DEC-044), and Section 14's field check and the token-only
verification of Sections 7 and 8 under the decision record that banks before
this code (the entry of
`../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md`
that records the field check and the token-only verification for sub-slice
S6-4, and the section of contract 25 that quotes the visitor-cookie question).
It runs on the guarded read path that all 8 route handlers share:
`/admin/access`, the three Explorer Suggested Waypoint routes and the four
Guide ones. It adds no module, route or caller, and it changes these files:

```text
src/lib/solmind/supabase/requestAuthClient.ts
src/lib/solmind/supabase/principalMapping.ts
src/lib/solmind/supabase/supabaseAuthQueryClient.ts
src/lib/solmind/supabase/serverAuthSourceAdapter.ts
src/lib/solmind/supabase/sessionSelection.ts
src/lib/solmind/auth/serverAuthContext.ts
src/lib/solmind/auth/authSource.ts
src/lib/solmind/auth/sessionCookiePolicy.ts
tests/whole-path/suggestedWaypointLocalAuthFixture.ts
tests/whole-path/suggestedWaypointLocalSqlFixture.ts
```

Four more files change in comments only. Five comment lines that called the
request-auth adapter `@supabase/ssr`-backed now call it Supabase-backed, in
`src/app/admin/access/route.ts`, `src/lib/solmind/auth/adminAccessRequest.ts`,
`src/lib/solmind/auth/adminRouteAccess.ts` and
`src/lib/solmind/auth/composeRequestAuthContext.ts`; no code line of those
files changes.

A request is allowed only when it presents, in the session-binding cookie, the
UUID of the very session the lookup selected for its account. The request's
cookies are read in one place and the comparison is made in one place, and
every guarded route passes through both.

The read is in `requestAuthClient.ts`, which both composition roots build
(`adminAccessRequest.ts` and `suggestedWaypointRequestDependencies.ts`). At
construction it resolves the one session-cookie policy from
`loadTrustedApplicationOrigin()`, as the Explorer sign-in routes' dependency
factory resolves it for the identity bridge and the login-step cookie writer
resolves it for itself (S6-8), so
that the writer, this adapter and logout read one name. A missing or malformed
trusted origin, or a plain-http one that is not a loopback address, throws one
fixed, value-free configuration error. `/admin/access` answers it with
`{ allowed: false }` and, when the audit writer is available, writes one
`auth_resolution_failure` audit row for every request in place of the opaque
deny decision row (the banked handling of a construction failure). Suggested
Waypoint requests fail closed: policy-construction failures use the fixed
failure response; command requests rejected earlier by the origin guard use
its fixed denial response. For each request the adapter reads the cookies once
into a frozen snapshot and then, in this order: applies the policy's one
shared Section 14 format check to the auth cookie, through the policy's second
pure helper `readSessionAuthCookieAccessToken`, which gives it the accepted
cookie's sign-in token and nothing else of the cookie, and resolves no
principal for an absent or malformed one; requires exactly one session-binding
cookie holding a lowercase canonical UUID, and resolves no principal for none,
a repeated one or any other value; and only then builds a Supabase client,
with `createClient` of `@supabase/supabase-js`, the public anon key, and
`persistSession` false, `autoRefreshToken` false, `detectSessionInUrl` false
and `skipAutoInitialize` true. That client is given no cookie reader, no
cookie setter and no storage, so nothing of the request reaches the library
but the token, and a Supabase session without the binding cookie is not even
sent to Supabase. On a route, Next's own cookie reader keeps one entry for
each name (the last whose value percent-decodes), so a repeated name does not
reach the adapter there; that refusal guards any other caller.
`getUser(token)` then asks Supabase Auth about that one token, and the UUID
from the binding cookie travels on the principal as `presentedSessionId`,
which `principalMapping.ts` passes through. The adapter never calls the
accessor's `setAll`: this slice writes, refreshes and clears no cookie.
`requestAuthClient.ts` no longer imports `@supabase/ssr`; the login
identity bridge beside it still does (AUTH-RLS-DEC-013).

The records carry the selected session's own values.
`supabaseAuthQueryClient.ts` requires `user_session_id` in every session row,
so a row without it fails closed, and returns the selected session's
`user_session_id` and `expires_at` unchanged; `serverAuthSourceAdapter.ts`
maps them to `userSessionId` and `expiresAt` and echoes the principal whole.
`serviceRoleRpcExecutor.ts` is unchanged, and `composeRequestAuthContext.ts`
changes only in a comment: the executor passes rows through, and the composer
hands the principal to the record load and the loaded input to the decision,
as before.

The comparison is in `deriveTrustedServerAuthContext`
(`serverAuthContext.ts`), which every guarded decision already calls:
`authorizeRouteAccess`, the two Suggested Waypoint request compositions and
the Guide list route's diagnostic. After the provider identity, the account
and the selected session have passed, it denies unless `presentedSessionId` is
a non-empty string exactly equal to the session's `userSessionId`, with no
trimming or case folding. Its two new internal reasons, like the others, never
leave the server. The UUID therefore grants nothing on its own, and a browser
left with a superseded session's UUID, in the same role or after a login in
another role, is denied instead of acting under the newer session. On an
allow, `TrustedServerAuthContext` gains `session: { userSessionId, expiresAt
}`, carried from the lookup for server use. The proposed home returns only
expiry and a fresh observation time for its advisory warning; the session UUID
stays server-private and neither value is logged. The in-memory auth
source (`authSource.ts`), a test double and the deny-all default of the
`/admin` helper, takes the presented UUID from the request and never from its
store.

Every outward result is unchanged and value-free: the routes answer a refused
request exactly as they answer an unauthenticated one. Since sub-slice S6-8
the Explorer verify route writes the two cookies after a successful sign-in;
Guide and Admin compose their separate fixed password/code routes;
the banked Explorer screen calls its fixed routes. A request without both cookies is still denied
by every guarded route, including one that still
carries a Supabase cookie under the library's default name. All 8 routes now
need `SOLMIND_TRUSTED_APP_ORIGIN`; before this slice only the two command
routes did. `src/app/__tests__/guardedRoutes.perRequestCheck.realpath.test.ts`
drives all 8 handlers through the real composition, and
`src/lib/solmind/supabase/__tests__/requestAuthClient.realLibrary.test.ts` and
`requestAuthClient.directToken.realLibrary.test.ts` run the adapter against
the real installed library with only `fetch` replaced.

The field check is the last step of the shared format check in
`sessionCookiePolicy.ts`. The earlier steps judge the cookie's encoding (the
allowed characters, the `base64-` start, strictly valid UTF-8); they cannot
see what is inside. The library builds its request to Supabase Auth from the
token text it is given, and when the platform refuses that request (a token
holding a line feed or a NUL, which reach it as JSON escapes, or a character
above U+00FF) the library prints the platform's error itself, which quotes the
text or gives a position and a character code taken from it, before the
adapter's fail-closed wrapper sees anything. So the check decodes the cookie
exactly as the library would (a leading byte-order mark kept), parses the text
once as JSON, drops the parser's error, and requires, each read as an own
property of the parsed object with no copy first: `access_token` a string of
three non-empty parts of A-Z, a-z, 0-9, `-` and `_` joined by dots (plain
ASCII classes and no pattern flags); `refresh_token` a non-empty string, with
no character rule; `expires_at` a positive safe integer; and `user` absent,
null or an object that is not an array. Anything else is the same fixed
`malformed` result as every other refusal, and nothing of a refused value is
kept, returned, logged or thrown. So no token text that the platform refuses
reaches the library, and neither does text that is not JSON or JSON that is
not a session. The module stays pure and imports nothing. No guard is put
around the library's requests: contract 25 Section 19 does not list one, and
with the field check the study found nothing left for one to catch for this
problem (text a visitor chooses); the line the library prints when Supabase
Auth cannot be reached stays, as said below. `sessionCookiePolicy.test.ts`
(`FCP-001` to `FCP-013`) and the real-library tests (`FCL-001` to `FCL-004`)
show each hostile shape refused with nothing requested, set or printed, and
cookies that the library's own writer produces accepted.

The token-only verification is how the adapter asks Supabase who the user is
(contract 25 Sections 7 and 8). A cookie-reading client can send the cookie's
renewal token when loading an expired or near-expiry session. In the
refused-renewal controls it printed the stand-in's error; with the unreachable
stand-in it retried for about 25 seconds. The adapter therefore gives the
library no cookie. `sessionCookiePolicy.ts` hands it the accepted cookie's
sign-in token through `readSessionAuthCookieAccessToken`, which judges the
cookies with the shared check itself and returns that one string; the renewal
token, the expiry and the profile stay behind. The client's only session store
is the empty in-memory one the library makes for itself; it cannot persist a
session, starts no renewal timer and has no cookie setter, and the one call
made on it is `getUser(token)`, which sends `GET /user` with that token as the
bearer. The library asks for a renewal only for a session it has loaded from
its store or has been handed; this client is given neither. The adapter reads
no clock, so the time that passes between the check and the call changes
nothing about what is sent. Whether the token is still good is Supabase Auth's
answer, not the adapter's: when Supabase Auth refuses a token, the library
returns that error without printing it, and the request is denied. An expiry
rule in the adapter is not used: a first draft refused tokens with under 95
seconds left, and review #161a showed that such a rule cannot exclude a
renewal, because time can pass between the adapter's test and the library's
own. `requestAuthClient.directToken.realLibrary.test.ts` (`TKL-001` to
`TKL-009`), with `PRL-008` and `PRL-009`, runs the adapter and the real
library on late, replayed and hand-made cookies (the expiries and renewal
tokens its rows list), moves the clock forward by between 5,001 milliseconds
and 30 days between the check and the call, and finds at most one request,
`GET /user`, none to the token endpoint, nothing handed to a cookie setter,
nothing printed except the library's one line when Supabase Auth cannot be
reached, and no unhandled rejection; one test also finds no timer left pending
after the call. Most of those tests are paired with a control in which a
cookie-reading client asks for the renewal. `requestAuthClient.test.ts`
(`TKA-001` to `TKA-007`) pins the client's options, the one call and its one
argument, and that the adapter's own code reads no clock;
`sessionCookiePolicy.accessToken.test.ts` (`TKP-001` to `TKP-006`) covers the
helper.

What stays open. When Supabase Auth cannot be reached, the library prints the
platform's error for its one request; that line is the platform's own error,
to which the library adds nothing (in the tests, with a stand-in for a refused
connection, it held no cookie text), the request is tried once and is denied,
and the library's request code sets no time limit on it. The tests ran the
library on its own, with `fetch` replaced by a stand-in: what the real
Supabase Auth answers (to a token past its end, to a forged one, or to one
whose session has ended), and behavior on a real connection and inside a
running Next.js server, were not tested. The construction rests on the
installed library (`@supabase/supabase-js` and `@supabase/auth-js` 2.108.2):
`TKL-009` pins that a client built this way holds no session and that
`getUser(token)` makes one request, so a library change that breaks either
fails a test. If Supabase ever issued sign-in tokens that are not three
dot-joined parts, the field check would refuse every session until it is
adjusted; it fails closed. SolMind's own code logs nothing.

Banked `PRJ01_F-WS06-WI008-S02D` - Guide-to-Explorer invitation issuance,
same-Guide replacement, and revocation - keeps invitation lifecycle mutation inside
two dormant service-role-only database entry functions in synchronized app commit
`a9944f1`. The issuance function
re-derives Guide, Practice, and active membership authority; serializes the
normalized-contact capacity domain; materializes expiry; replaces only the older
same-Guide/same-Practice/same-contact invitation; denies cross-Guide capacity
without displacement; snapshots protected lifetime policy; and writes exact
transactional audit. The revocation function changes only an owned live invitation
or returns a value-free terminal observation. The functions add no acceptance,
relationship, evidence, reservation, session, provider, route, delivery, consent,
RLS policy, table grant, cloud, deployment, or real-user path. Focused 203/203
and complete 1,547/1,547 database assertions, zero-residue proof, final clean
reset, lint, typecheck, 487 application tests, production build, and exact
Fable 5 implementation assurance passed before banking.

Banked `PRJ01_F-WS06-WI008-S02E` - dormant Explorer invitation acceptance -
keeps the acceptance boundary inside one service-role-only database entry
function. It verifies committed preparation and a server-verified provider
result; acquires evidence-first and sorted domain locks; supports only exact
writeless committed-response recovery; applies the protected current-Guide
capacity policy; reuses the shared invited-identity helper; consumes the
evidence; creates exactly one `intake_pending` relationship whose
`created_from_invite_id` names the accepted invitation; accepts that
invitation; revokes only open same-Guide, same-Practice, same-contact siblings;
and persists the exact Family B audit rows in the same transaction. The paired
preparation change is only a writeless, non-authoritative capacity pre-check
after banked identity checks and before reservation creation. Focused
validation passed 6 files / 436 assertions and complete validation passed 31
files / 1,777 assertions with zero synthetic residue and three clean
32-migration resets. The slice is banked in synchronized app commit
`5e98ebf`; it remains dormant and adds no provider IO, caller, route, cookie,
session, consent, RLS policy, table grant, capacity-policy writer, cloud
action, deployment, or real-user path.

`PRJ01_R-WS09-WI021-S02`, not S01, owns exact additive storage for submitted
onboarding, Compass, Route, private Waypoint, Private Summary Draft, selection
provenance, Shared Snapshot, and lineage. Its protected 1-100 day setting,
local synthetic relationship fixture, and forward-only Summary publication /
Shared Snapshot persistence realignment are banked dormant foundations.

The realignment owns immutable Guide-authored Summary revisions and sections,
the authoritative publication record, the fail-closed targeted Explorer
projection, Explorer-private exact-review drafts, immutable confirmed Shared
Snapshots, preserved original/addendum/replacement lineage, and bounded
service-role-only publication, unpublication, confirmation, and integrity
surfaces. It does not own Suggested Waypoint identity and adds no application
caller, permissive RLS policy, direct-table role grant, operational timer,
hosted data, provider behavior, deployment, or real-user path. Submitted
onboarding, Compass, Route, private Waypoint, conversation, notification, and
the remaining caller/runtime persistence still require separate slices. Do not
put the synthetic fixture in a production migration or universal seed.

The banked manually invoked local-development fixture boundary is:

```text
supabase/fixtures/
  PRJ01_R_WS09_WI021_S02_LOCAL_FIXTURE.md
  prj01_r_ws09_wi021_s02_local_fixture_setup.sql
  prj01_r_ws09_wi021_s02_local_fixture_validate.sql
  prj01_r_ws09_wi021_s02_local_fixture_cleanup.sql
```

It creates only one reserved synthetic Guide, one reserved synthetic Explorer,
their minimum organization/practice membership substrate, one active
relationship, and one bounded Explorer-safe Virtual Guide behavior string.
Setup rejects pre-existing deterministic IDs or ownership markers before
writes; validation is read-only and exact-cardinality; cleanup rejects
mismatched or expanded ownership and proves zero known residue. The fixture is
local-development support, not schema, universal seed, authentication state,
runtime product behavior, hosted data, or a real-user identity source.

## Documentation Boundary

When any route, role behavior, authentication behavior, onboarding workflow, or dashboard behavior changes, update:

- `README.md`
- `AGENTS.md`
- `docs/AI_MAINTENANCE_MAP.md`
- `docs/AGENT_TASK_RULES.md`
- `docs/MODULE_BOUNDARIES.md`

Also check the canonical documentation in:

```text
../solmind-docs
```

## Connected Guide request and view boundaries - 2026-10-21

Connected Guide is a bounded integration over the banked Explorer/auth
foundation. Current publication/banking status is owned by SL-070 in
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md
and its linked checked receipt. Source/check results alone do not establish
banking. This description does not relabel component reviews, activate Admin
or expand the /guide dashboard.

Thin src/app/login/guide/page.tsx and its send/verify Route Handlers compose
Guide-only entrypoints. src/lib/solmind/supabase/guideSignInHttpPorts.ts supplies
explicit provisional timing to request-scoped dependencies and projects Next
mutable cookie records to plain name/value entries. Preserve the strict HTTP
reader; no auth/configuration IO at module load. LoginExperience mounts
GuideSignIn separately; Admin has its separate connection below and standalone
preview callers remain effect-free. Since 2026-11-02 GuideSignIn and AdminSignIn
draw the approved A3/A3A and A4 through PasswordRoleSignInView and the shared
SignInPreviewView.

The password-role bodies/core/route/HTTP/dependencies retain raw password text
and fixed role/login/home. Send prepares its spare acknowledgment before lookup;
only eligible account lookup permits issuance. Send receives no password and
writes no cookie. Verify orders eligible lookup, non-consuming exact ownership,
password private hold, redemption, provider-user/redeemed-account confirmation,
session creation, accepted-session preparation and release. Wrong account never
reaches password; confirmed wrong password shares the existing five-failure code budget with atomic content-free audit and never redeems. Pre-factor refusals share the
accepted message/body/status/headers and attempted floor. Earlier guard/config
and handled post-factor completion failures remain generic denial. Await bounded
discard; preserve existing cookies, publish no new auth/binding cookie on refusal,
and discard partial success. Timeout/cleanup proves no remote rollback or
absence of a committed session/supersession. Stale/terminal owned selectors still reach password; recorder eligibility remains strict and writeless; revisit before Sharing.

The ownership migration
supabase/migrations/20261016000000_login_challenge_ownership_lookup.sql is a
service-role-only STABLE SECURITY DEFINER exact boolean read. Join contact back
to the same account; separate foreign keys are insufficient. No mutation/audit/
reservation or duplicate redemption policy. Banked loginAccountLookupCallers.ts
and its unit suite are context; the SQL suites passed 56 assertions in the
isolated October 21 run, included in the 680-assertion auth regression. See
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Keep later
redemption, provider/account confirmation and session checks.

Browser-safe passwordRoleSignInBrowserContract.ts, guideSignInBrowserTransport.ts
and guideSignInFlowController.ts own Guide requests/results and private attempt
state; src/components/solmind/GuideSignIn.tsx mounts it through
src/components/solmind/PasswordRoleSignInView.tsx. Clear drafts, including the
privately held password, on cancellation/disposal; no secrets/selectors in URLs, logs or browser storage.
Only current accepted success permits fixed /guide/home navigation; stale
completions and request-selected destinations have no authority.

Dynamic src/app/guide/home/page.tsx preserves bounded raw-cookie framing,
duplicate names and exact values. src/lib/solmind/auth/guideHomeAccess.ts uses
current token-only principal and SolMind session/role/binding checks, with fresh
expiry recheck. Only expiry/observation times reach
src/components/solmind/GuideHome.tsx; since 2026-11-02 its presentation, the
Dashboard (GuideDashboardHome.tsx), receives only the pending and warning flags
and the sign-out action. Reuse finite clock/shared logout, Guide
re-entry, confirmed-only signed-out state, honest uncertainty and fresh server
check after cached-page restoration. No GET cleanup, retry, renewal or client
credential clearing.

The collapsed fixed-script "Design previews" on Overview
(src/components/solmind/ExplorerHomeNavigation.tsx) was removed on 2026-11-04
(Paul's decision, decision queue 2026-11-04 21:44:03 CST); its older design reviews,
`/explorer/compass-comparison` and `/explorer/conversation-preview`, stay
reachable by address. The Explorer workspace destinations are in the Explorer
workspace menu and the Overview cards (`WorkspaceFrame.tsx`,
`ExplorerOverviewHome.tsx`). Each destination retains its own authorization and
data boundary. Navigation grants no persistence, AI/human Guide/provider or
session authority. ExplorerHome retains its session/logout lifecycle and passes
its presentation only the pending and warning flags and the sign-out action.

Four issuance/four redemption slots are per loaded module/process, not
distributed/per-account. October 21 R04 genuine functional/contention
observations and isolated app/SQL checks are recorded in
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Paul's 20:17:31 CDT
approval in
solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Guide_Local_Risk_Approval_2026-10-21.json
accepts disclosed small-sample timing/capacity risks and defers real exhaustion/
induced provider/session/cookie failure timing only for private synthetic local
use. The original full protocol is not claimed passed; deferred measurements
remain required before broader exposure or real users. Fake clocks/Explorer
proof cannot replace real timing or full assurance. This dated Guide-only
approval supplies no Admin residual-risk acceptance. Preserve accounts/private
passwords; no blind reset/recreation. Admin parsing alone implements no
first-Admin setup; later setup reuses its policy.


## Connected Admin request and view boundaries - 2026-10-23

This source connection adds the Admin chooser branch, fixed /login/admin,
POST /login/admin/send, POST /login/admin/verify and protected /admin/home.
src/components/solmind/LoginExperience.tsx mounts AdminSignIn separately from
Explorer/Guide. Standalone preview callers and prototype /admin stay separate.
The home is a finite-session confirmation/sign-out surface, not new dashboard,
private Guide/Explorer-data or provisioning authority. Amended 2026-11-03: the
home is now the minimal Admin Dashboard of the minimal functional Admin screens
(section below); it still adds no provisioning authority and no Explorer-private
data.

src/lib/solmind/supabase/adminSignInHttpPorts.ts constructs request-scoped ports
for the existing fixed Admin HTTP handlers and password-role dependencies.
Keep imports direct/server-only/off barrels, configuration before remote work,
no module-load auth/configuration IO and plain name/value projection from Next's
mutable cookie store into the strict reader. The shared core fixes role, login
purpose and home. A browser chooses none of those authorities.

Admin accepts the approved username or unchanged email normalization: at most
512 typed characters before username trimming, outer U+0020 spaces only,
ASCII letters/digits/period/underscore/hyphen and lowercase ASCII folding.
Input containing @ uses the email normalizer with no username fallback; wider
existing usernames retain email sign-in. Lookup supplies the verified stored
sign-in email for delivery/password authentication; never construct an email
from a username or reveal its stored value. No first-Admin setup/name migration
is implemented.

Send carries no password. Verify preserves typed password text and orders
eligible fixed-role lookup, non-consuming exact challenge/account/contact
ownership, private password hold, atomic redemption, provider-user assertion,
redeemed-account confirmation, session creation, accepted-session preparation
and release. Wrong-account ownership must not reach password; wrong password
leaves redemption uncalled. Neither factor alone permits a session. Refusals
retain the shared message/body/status/headers in the accepted interval, publish
no new auth/binding cookie, preserve existing browser cookies and await bounded
discard. Cleanup/timeout cannot undo or disprove a committed remote effect.

src/lib/solmind/adminSignInBrowserTransport.ts uses the existing browser
builders/parsers with fixed Admin POST paths, same-origin credentials, no-store,
redirect rejection, bounded streamed JSON and explicit cancellation/budget.
src/lib/solmind/adminSignInFlowController.ts privately owns the current opaque
selector/generation and rejects stale, cancelled or disposed continuations.
src/components/solmind/AdminSignIn.tsx (through PasswordRoleSignInView) reads the password once from the uncontrolled A3A field at Send my code, empties
the field, and holds it only in a private ref until the verify request, which
needs a non-empty, required code; send never carries it. Identifier changes
clear password and code drafts; resend clears the code draft and keeps the held password, because the approved A4
has no password field (the Executor's reading of contract 25 Section 5.3,
confirmed by Paul on 2026-11-02); departure, disposal and pagehide retire the
active attempt. After every A4 refusal the shared view adds Paul's approved
help line naming Use a different email, the same for every cause.
Only current accepted success allows fixed /admin/home navigation. No credential,
selector, token or private server detail enters logs, URLs, storage or home props;
password values are not serialized into React state/markup.

src/app/admin/home/page.tsx is dynamic and reads the wire cookie header before
Next can merge/decode it; preserve duplicate names and exact values for strict
validation. src/lib/solmind/auth/adminHomeAccess.ts delegates once to
resolveAdminHomeForRequest in src/lib/solmind/auth/adminAccessRequest.ts
(since 2026-11-03 the home page goes through adminWorkspaceAccess and
resolveAdminWorkspaceForRequest with the same fixed home resolver, see Minimal
functional Admin screens below; adminHomeAccess keeps no page caller).
That trusted internal path uses resolveAdminHomeRouteAccess from
src/lib/solmind/auth/adminRouteAccess.ts against the fixed /admin/home rule in
src/lib/solmind/routeAccess.ts. It cannot borrow /admin policy or accept a
request-selected route. Verify the principal, current account/role/session
records and exact binding through the existing guarded read.

On a would-be home allow, require the post-resolution guarded_service_role_read
write FIRST and admin_route_access_decision/allow write SECOND; both must persist.
Preserve the existing fail-closed write ordering and accepted residual-read-row
behavior on second-write failure. After both awaited writes, recheck current
expiry/clock before projecting home times. Final projection/expiry denial does
not rerun the read or invent a third resolution-failure row; prior committed
audit rows may remain. Do not imply rollback or widen the audit vocabulary.
The public /admin/access probe retains exactly { allowed }; legacy server-only
resolveAdminActorForRequest callers retain exactly the existing allowed/actor
projection. No expiry field is added to either old contract.

Only expiresAt/observedAt reach src/components/solmind/AdminHome.tsx (amended
2026-11-03: with the page's plain display data, view, from the minimal Admin
screens below; the actor and every account id stay on the server). Its reused
finite clock is advisory, refresh/cached-page restoration obtains fresh server
verification, and shared POST /logout preserves confirmed signed_out versus
honest uncertainty. Session denial/expiry uses fixed /login/admin re-entry.
GET never renews, clears cookies or signs out. Shared logout owns termination,
bounded provider cleanup and owned-cookie clearing; add no second logout route.

ADMIN_SIGN_IN_CONFIGURATION explicitly uses a provisional 1,500 ms floor;
3,000 ms each for account lookup, ownership and confirmation; 5,000 ms provider
and 18,000 ms session deadlines. LoginExperience supplies an explicit 60,000 ms
browser response budget. These values supply no measured adequacy, constant-time
proof, rollback guarantee or whole-flow wall-clock bound. Shared issuance and
redemption capacity is per loaded module/process, not distributed/per-account.

Source/component checks do not establish Admin genuine journey, actual audit/
failure effects, timing/capacity, residual-risk acceptance, complete assurance,
publication or banking. Guide's dated October 21 proof and private-synthetic-local
risk acceptance remain Guide-only history. Admin requires its own actual evidence
and risk disposition under the adopted protocol. Current complete-slice evidence
and status are owned by solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md
and solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md with its exact
checked receipt; no result is inferred from this source description.

Preserve existing accounts/private passwords and all separately gated first-Admin
setup, invitation/provisioning, password reset, SMS, remembered browser/activity
renewal, broader Admin workflow, new SQL/schema/grant/dependency, provider/
cloud/production/deployment/real-user and cleanup boundaries (amended
2026-11-03: except the minimal Admin screens below and their four read
functions).

### Minimal functional Admin screens - 2026-11-03

PRJ01_R-WS03-WI014; Paul's decisions, decision queue 2026-11-03 11:23:03,
11:52:57, 11:56:14 and 12:19:09: only what testing needs; they may be thrown
away for a better design. They reuse the Admin sign-in and the audited server
checks above with no new security design, and the Admin sign-in owners are
unchanged.

- Route policy: one fixed Admin-only rule per path in src/lib/solmind/routeAccess.ts
  (/admin/people, /admin/ai-use, /admin/settings, /admin/ai-use/lift,
  /admin/settings/change; the Dashboard keeps /admin/home) and one fixed resolver
  per path in src/lib/solmind/auth/adminRouteAccess.ts. No path borrows another
  rule; a missing rule denies.
- Guard: resolveAdminWorkspaceForRequest in adminAccessRequest.ts runs the
  audited chain once against the resolver the server caller fixes, then the
  expiry check it shares with the home, and returns the actor and times. The
  public probe, actor and home projections are unchanged.
- Access: src/lib/solmind/auth/adminWorkspaceAccess.ts (server-only) guards and
  then reads in the same request, so a view writes the usual two audit rows. It
  passes the actor only to src/lib/solmind/supabase/adminWorkspaceRpcExecutor.ts,
  a closed executor with six fixed functions, exact-key row checks and
  value-free failures. Pages get the session times and plain display data
  (src/lib/solmind/adminWorkspaceContract.ts), every time formatted on the
  server in Chicago time (adminWorkspaceTime.ts). A read failure after an
  allowed check shows the page with a could-not-load sentence.
- Pages: src/app/admin/home, people, ai-use and settings page.tsx, each like the
  home page (force-dynamic, nodejs, raw cookies, a catch to AdminSessionOutcome
  session_ended). AdminHome.tsx keeps one binding on every page and passes the
  view, pending and warning flags and the sign-out action to
  AdminWorkspacePages.tsx in the WorkspaceFrame with the Admin menu.
- Commands: src/app/admin/ai-use/lift/route.ts and
  src/app/admin/settings/change/route.ts in the Guide command order. The browser
  (adminWorkspaceBrowserRequest.ts, AdminWorkspaceActions.tsx) makes one
  operation id per press, posts once, shows the outcome in plain words and
  reloads the page; no retry or browser storage. The lift reuses
  public.solmind_lift_explorer_ai_use_pause_v1; the change reuses
  public.solmind_set_application_setting_integer with basis paul_approved, reason
  paul_approved_configuration_change, the version the page read and one setting
  per submit. Both writers get one fixed authority reference,
  ADMIN_SCREENS_AUTHORITY_REFERENCE_ID in the executor, naming Paul's decision
  queue entry 2026-11-03 11:56:14 as amended at 12:19:09 (amended 2026-11-03
  after review REV219: the Admin's account id is no longer sent, since audit
  contract 22 makes the reference a non-descriptive id of an approved
  checkpoint). Both still audit as a system change on Paul's word (actor null,
  role system); Paul accepted that for these throwaway screens and the audit
  contract is unchanged. Because each press sends a fresh operation id, the
  lift writer's operation conflict means the stop was already lifted another
  way: the screen says "This pause had already been lifted. Nothing was
  changed." (outcome lifted_elsewhere, 2026-11-03); a lock timeout stays the
  could-not-be-lifted-just-now outcome.
- Database: supabase/migrations/20261103120000_admin_minimal_reads.sql adds
  four service-role-only, security-definer, empty-search-path reads that recheck
  an active Admin (solmind_admin_required otherwise): overview, people, AI-use
  pauses and application settings. "Paused now" is the AI-use gate's own
  decision (amended 2026-11-03 after review REV219): the reads call
  ai.solmind_explorer_ai_use_gate_v1 in read mode (no write, no lock) at now()
  with no conversation for every account with a non-deleted Explorer profile.
  The Dashboard counts the accounts it pauses by their own limit; the AI-use
  read lists each recorded unlifted individual stop the gate counts as a pause
  (all but a crisis account's first stop of a day) with Lift pause, plus an
  individual_unrecorded row (no stop, time or crisis status; shown as "Not
  recorded yet" with no Lift pause) for each Explorer the gate pauses by their
  own limit with no such stop, for example after the limit was lowered (a Send
  is normally refused at the pause read before any stop is recorded, so that
  pause ends at midnight, Chicago time, or when the limit is raised above that
  Explorer's calls today; corrected 2026-11-03 after review REV219b), and
  today's shared stop; the People read returns own_limit, shared (only today's
  shared pause) or none, shown as "Yes", "Yes, shared pause" or "No". "Explorers
  active in the last 7 days" counts only accounts with a non-deleted Explorer
  profile. No table, table grant or existing function changes.
- Privacy: activity is by sign-ins only (identity.user_session for the Explorer
  role); apart from the recorded hard-stop facts Paul approved as Admin review
  flags (2026-11-01 01:00:16: day, time reached, that day's total calls, the
  limit; 2026-11-01 12:27:07: crisis or urgent status at the stop), no Admin
  page shows conversation content, message dates or message counts. Crisis or
  urgent status appears only as recorded at a stop.

### Admin-specific local evidence and acceptance - 2026-10-23

Admin's own isolated real browser/provider/database/mail proof completed the
functional login, authorization, refresh and shared-logout paths. Separate real
measurements covered four-slot admission/recovery, actual code exhaustion and
idle induced failures. Ordinary refusals were about 1.51-1.53 seconds; provider
failure about 5.06 seconds and session-lock failure about 2.50 seconds. These
single observations retain timing/capacity clues. A timed-out redemption later
spent its code. An induced second cookie-setter failure returned a fresh
cookieless denial, while one unpublished application session and its created
audit had committed; the test separately observed and ended that session.
This response-local handler trial does not measure natural browser-cookie
failure or guarantee remote rollback.

Paul explicitly accepted these disclosed limits for PRIVATE SYNTHETIC LOCAL
Admin use on 2026-10-23. Repeated timing distributions, partial/maintained-load
comparisons, natural browser-cookie failure timing and induced home-audit-write
failure timing are deferred. The original full protocol remains INCOMPLETE,
not passed. The pressure-comparison startup timed out before authentication
runtime; its disposable resources were fully torn down. Full source assurance,
all other checks and exact application/publication/banking gates remain required.
Broader exposure and real-user use retain separate gates. The detailed evidence,
Admin-specific decision and current slice status are owned by
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md,
solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md and
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md.

### Provider-held response-length follow-through - 2026-10-24

The S03B response parser enforces the existing canonical 300-word hard cap after
normalization and the independent 8,192-character check. It counts Unicode
word-like segments with Intl.Segmenter (en, word), so punctuation-separated words
and unspaced scripts cannot bypass the cap through whitespace counting. Exactly
300 segments pass unchanged; 301 rejects the whole reply with the existing
value-free limit error. Completed, refused and safety_redirect envelopes share
this boundary. Connected composition settles failure with null reply fields,
never truncates or invents a fallback, and exact replay does not redispatch.
The response shape and wire version stay unchanged. This deterministic guard
does not prove the 40-150-word target, one question, semantic pacing,
classification, crisis handling or genuine model safety. No provider, environment,
factory, SQL, shared database or context-source behavior is activated or widened.


### Provider-held methodology screening contract - 2026-10-24

`src/lib/solmind/virtual-guide/methodologySafetyScreenContract.ts` is a
direct-import, server-only synchronous data boundary, absent from shared barrels.
It binds a closed version-UUID/content subject to its exact UTF-8 SHA-256, using
the existing 24,000-character methodology cap without text normalization. It
rejects unsafe controls, isolated surrogates, unknown/accessor/proxy properties
and widened or sparse findings. The closed result permits only pass/review/fail,
the exact subject digest and at most 16 findings from 18 declared criteria.
Citations must be exact nonempty subject substrings of at most 512 characters;
explanations are bounded to 768 characters. Duplicate criterion/excerpt pairs
and inconsistent outcomes reject. The result is a deeply frozen copy with the
server-selected version UUID. Errors contain only fixed codes.

This proves structural and byte linkage only. It does not prove semantic truth,
stored version/scope existence, invocation/policy-version provenance, screening,
Admin compliance, Guide approval, audit persistence or activation. Those belong
to the future governed caller and storage flow. There is no provider, environment,
HTTP, database, timer, log, UI or factory wiring in this contract. A parsed pass
cannot activate a pack. Preserve the independent provider-held factory and the
existing response-length guard. Focused tests use artificial data only.


### Dormant methodology storage foundation - 2026-10-24

`supabase/migrations/20261024010000_methodology_storage_foundation.sql`
creates only the logical methodology pack and immutable version tables, one
internal invoker trigger and their constraints. Typed scope foreign keys,
same-pack version/predecessor links, exact UTF-8 content digest, immutable
content/provenance and once-set screen/Admin/Guide/effective evidence are
structural controls. Both tables enable RLS with zero policies. Explicit schema,
table and trigger-function revocations deny PUBLIC, anon, authenticated and
service_role access, including inherited creation defaults. No workflow RPC,
service-role DML grant, seed, actual screen, actor approval or active data exists.

The owner-written test fixtures prove structure only. An FK-valid session/audit
record does not prove current role authority, event semantics or actual model
screening. An owner can structurally select a draft active pointer; the missing
closed workflow must enforce approved status and exact scope before any runtime
use. The schema is dormant and cannot safely activate methodology by itself.
Owner/superuser powers are not represented as RLS protection.

Existing context snapshots, legacy/v1 and synthetic v2 writers and fixtures are
unchanged. No blanket methodology FK or backfill is added: NOT VALID would still
enforce new writes and break existing arbitrary synthetic UUIDs. A future governed
successor must bind a real approved version, exact text/digest, screen/Admin/Guide
and audit evidence prospectively; load/revalidate effective context each new turn,
preserve old provenance and perform no extra dispatch on exact replay.

`supabase/tests/methodology_storage_foundation_test.sql` adds 67 rollback-only
structural/ACL/denial/immutability assertions. Normal full SQL regression,
character validation, current Executor assurance, exact application and checked
publication remain required. The earlier standalone 67-case draft proof is
separate from the migration candidate's regression; neither is operational AI
screening or human approval. Banking is final only when the current purpose
root's PUBLICATION_METHODOLOGY_STORAGE_R05/STATUS_CLOSEOUT.json is PASS.

Provider/context factory wiring, UI, current request/response contracts, shared
demo schema/data/passwords and package dependencies stay unchanged. No shared
database migration, provider activation, external AI or real-user effect follows
from source publication. Governed registration/screen persistence/closed audit,
focused Admin review, actual Guide-role checklist/approval, effective-version
resolution and affected safety/privacy runtime remain unfinished. No new slice
identity, sprint outcome, forecast, readiness or genuine-AI acceptance credit.


### Provider-held governed methodology construction - 2026-10-24

This successor is current proposal construction, NOT validated, assurance-passed,
applied, published or banked. Earlier storage/parser/response-length notes retain
their dated evidence and limits; original global object counts and no-workflow-RPC
statements describe that earlier foundation, not this additive candidate. Current
proof/publication status remains owned by
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md and
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md.

The initial governed path is one explicit trusted-server-selected Guide-scoped
pack. Admin-assisted immutable preparation, a bound system screen, focused Admin
consistency review and the owning Guide's authenticated checklist/approval are
separate transitions. Other scope kinds refuse; no precedence, merge, fallback,
direct Guide authoring or new disclosure/retention policy is introduced. A failed
screen cannot be overridden into effectiveness.

Actual AI screening/inference, an approved operational pack, real human approval,
shared-demo migration/data, the default context/provider factory and genuine
connected-demo acceptance remain absent or held. Synthetic fixtures and a shaped
result are not actual model or human evidence. The approved metadata-only check
is consumed: credential_absent, no HTTP or inference. No new credential search
or retry follows. Preserve all existing private-local role-login limits,
provider boundaries and the 300-word guard.

The effective source's single closed read capability is
public.solmind_resolve_explorer_methodology. It derives current Explorer,
account-bound session, relationship/topology, exact owning Guide scope and
trusted pack; requires the approved effective version, exact immutable digest,
completed nonfail screen, Admin review, Guide checklist and atomic audits; and
returns one exact row or a fixed value-free error. MV1 plus 64 uppercase hex
characters is SQL-derived evidence, not a caller permission token.

The additive governed builder resolves methodology for each new turn with
configuration version methodology: plus immutable version UUID. It retains
exact bytes/fingerprint and refuses final pointer/version/content/scope/MV1
drift. The additive governed repository changes prepare only; browser routes,
request dependencies, default factories and shared/client barrels stay unchanged.

For new operations the wrapper takes existing authority locks before methodology
locks, uses READ COMMITTED/bounded contention, rederives selected digest/MV1 and
calls v2 prepare in the same transaction. Append-only
methodology.explorer_methodology_binding links the new snapshot to exact
pack/version/SHA/MV1 under explorer-methodology-governance.v1 before dispatch
permission. No lock spans provider I/O. No immutable snapshot rewrite or old
invocation-CHECK widening manufactures governance evidence.

Browser-command replay settles before builder/source loading. Direct governed
prepare retry must match original full v2 fingerprint and stored governance
binding after a later version activates; missing/changed binding cannot upgrade
legacy evidence. Owner/superuser powers are outside RLS protection.

Screen citations/explanations belong on the protected version. Operation/audit
rows remain closed ID/hash/status or exact catalog metadata. Provenance shape
is Admin-attested metadata, not rights proof. Caller/policy approval, semantic
model safety and genuine human actions require actual independent evidence.


### Governed workflow technical evidence update - 2026-10-24 23:32:36 CDT

The earlier construction/unrun labels are dated authorship state. This candidate
now has passing focused198/full4582/typecheck/lint/build and51-migration,
65-file/3400-assertion SQL evidence, including217 governance checks and five
actual overlap scenarios; zero-fixture/restored-trigger/owned-resource closeout
also passed. The full evidence, failures, two-cycle reconciliation and precise
synthetic-versus-genuine limits are owned by
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Do not duplicate its
proof protocol here. Full source assurance/application/publication remain gated
at this capture; banking is final only at
PUBLICATION_GOVERNANCE_R06/STATUS_CLOSEOUT.json PASS in the retained purpose root.
Default factories/provider/shared demo remain held; no real screen, operational
human approval, new slice/outcome, genuine-AI acceptance or wider effect follows.


### Provider-held exact-field exclusion matcher construction - 2026-10-25

This is current pure proposal construction, NOT validated, assurance-passed,
applied, published or banked. Current proof belongs to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Earlier governed-workflow
proof and publication retain their exact payload/date and do not prove this
increment. The default factory, dispatch path and shared database stay unchanged.

The pure input has exactly serializedContext, includedSourceIds, expectedBinding
and manifest. The compact S03A object must retain its exact canonical bytes,
twelve output keys, Virtual Guide/Explorer roles and expected Explorer/session/
relationship continuity binding. Full prior authorized assembly stays mandatory;
this matcher does not replace or duplicate its complete source allowlist.

Defensive local bounds are 524288 serialized UTF-8 bytes, 256 unique source IDs,
128 manifest entries with unique entity IDs and JSON nesting at most 64. These
are matcher input bounds, not production capacity/token policy. Inputs reject
proxy/accessor/exotic/unknown/symbol/hidden/sparse/extra-array shapes before any
hostile trap/getter can run. Digests are exactly 64 uppercase hex characters.

Check each excluded UUID against source evidence and every decoded string leaf,
including embedded identifier text. Content matching hashes each whole decoded
string leaf after CRLF/CR-to-LF and outer trim only. Identifier-first/manifest
order is deterministic. Hashes remain request-local ephemeral data; no content,
digest, assembly or exception cause appears in the frozen result or fixed error.
No raw hashing export or cache/idempotency fingerprint use is introduced.
A clear result is only absence of a match in the supplied manifest. It proves
neither authorization nor index completeness/freshness. Whole-field content
hashing misses a private passage embedded inside a longer string, paraphrases,
encoded/Unicode-equivalent variants and content absent from the supplied index.
Typed isolation, an authoritative relationship-bound hash-only source with final
revalidation, runtime abort/audit handling and scheduled snapshot/Admin control
remain necessary before operational exclusion protection is complete.


### Pure matcher technical proof update - 2026-10-25 00:22:49 CDT

The preceding R07 unrun labels retain their initial-authorship meaning. Current
focused149/full4659/typecheck/lint/build checks passed; Root corrected one test
identity collision under cycle1of2, with original failures retained and no
matcher/runtime change. Detailed results/limits belong to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Complete-folder Root
assurance/application/publication remain gated at this capture; banking is final
only at PUBLICATION_EXCLUSION_R07/STATUS_CLOSEOUT.json PASS in the retained
purpose root. No authoritative source/freshness, complete exclusion coverage,
runtime audit/default wiring, scheduled control or genuine AI follows.


### Held methodology screening caller construction - 2026-10-25

R08 is held construction, not a tested or activated caller. Detailed evidence
belongs to solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.
The composition and repository are separate direct-import server-only owners.

The repository exposes only readOwnedDraft/prepare/settle over injected rpc:
solmind_read_methodology_version, solmind_prepare_methodology_screen and
solmind_record_methodology_screen. Read sends four SQL arguments and locally
checks expected Guide scope, own preparing Admin, draft status and exact
content/digest. Only the eleven-key projected draft DTO leaves the full stored
version record; ordinary unselected columns are not copied or provider-sent.
There is no table/query/default-client/alternate-RPC capability.

The synchronous trusted builder returns a nonempty exact valid-Unicode request
body, at most 524288 UTF-8 bytes, without normalization or Promise coercion.
The frozen request binds fixed task/protocol/provider/model, subject/version,
policy manifest and exact request hash. Those values attest intended bytes;
actual approved policy, HTTP correspondence, model envelope/refusal/incomplete/
usage/cost/budget assurance remain with a later real builder/adapter.

Prepare has exactly ten SQL parameters; settlement exactly seven. A completed
SQL result has exactly result, subject_sha256 and findings: omit the parser's
methodologyContextPackVersionId and bind version separately. Completed result
fail differs from execution failed/null. No extra telemetry or audit field is
invented outside the existing ports.

Capture functions/configuration before awaiting. Execute once only after fresh
durable permission. Use linked native caller/transport-abort signals, then drain
owned work; cancellation/timeout sets a single immutable canceled/failed intent.
Use independent terminal-cleanup signal/deadline and await one settle. A failed,
unknown or malformed receipt returns unconfirmed with no changed intent/retry.
The local repository requests abort after twelve seconds; transport requests
abort at its explicitly supplied 10-60000ms bound. Neither bounds an
uncooperative injected promise's wall-time or proves operational capacity.


### Held screening caller technical proof - 2026-10-25 01:15:50 CDT

Earlier R08 unrun labels retain their initial-authorship meaning. Current
269 focused/4826 full tests, type checking, lint and normal build passed.
The targeted real-SQL/fake-model bridge passed eight cases; exact invocation/
audit state and no approval/activation were checked. Both disposable databases
were closed with shared three-volume identities unchanged. Root cycle 1 and
all initial regression/harness failures are retained. Detailed results and
limits belong to solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.

Immediate capability returns must be ordinary native Promises, descriptor-
checked before await. This does not undo work/resolution inside a trusted port.
Independent cleanup requests abort at twelve seconds, then owned work drains;
no real-adapter wall-time or operational latency guarantee is supplied.
No actual HTTP/model/policy/human approval, active pack, default wiring, audit
class, telemetry capability or SQL change follows. Current full-folder Root
assurance/application/publication remain gates. Checked banking becomes final
only at PUBLICATION_SCREENING_R08/STATUS_CLOSEOUT.json PASS in the retained
purpose root; no extra slice/outcome/forecast/readiness credit follows.


### Explorer assembly static source isolation construction - 2026-10-25

The local plugin rule
solmind-explorer-source-isolation/approved-dependencies applies only to the
eleven exact EXPLORER_SOURCE_PROFILES. Each profile closes runtimeImports and
typeImports to exact specifier strings. Static imports and reexports are checked;
unknown profiles deliberately given the rule fail with a fixed message. Keep
existing Next presets/default ignores and unrelated-file configuration intact.

The two additional composition edges are type-only and erase at build time.
Mixed declarations, empty named lists, default/namespace values and side-effect
imports are runtime edges, never vacuous type-only permission. ImportExpression,
TSImportEqualsDeclaration and TSImportType are conservatively refused. No alias
or barrel spelling silently expands the graph.

Installed no-restricted-globals runs at error severity on the same profiles,
with checkGlobalObject true, covering process, module, require, fetch, WebSocket,
XMLHttpRequest, eval, Function, globalThis, global, window and self. Fixed lint
messages contain no module/private fixture text and offer no fix or mutation.

This is static source policy, not module-resolution isolation or a JavaScript
sandbox. It cannot undo trusted-port work, prove injected data/source currency,
exhaust reflected-code tricks, enforce runtime dispatch abort/audit or certify
content/semantic safety. Detailed unrun proof is owned by
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.


### Explorer assembly import-boundary technical proof - 2026-10-25 01:50:01 CDT

Earlier R09 unrun labels retain initial-authorship meaning. Current188focused/
4926full/type/lint/normalbuild checks passed; no correction cycle was needed.
Actual plugin/config/eleven current modules and parsed negative fixtures were
tested. Detailed evidence and limits belong to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. This is a static source
boundary, not a sandbox or runtime/source-currentness/audit/model guarantee.
No productionTypeScript/SQL/provider/default/dependency change. Character/
Rootformalreview/application/live/publication/checked banking remain gates;
only PUBLICATION_SOURCE_ISOLATION_R09/STATUS_CLOSEOUT.json PASS is final banking.
Required productprivacy control does not adopt deferred optional process work
or add an accepted outcome. Source/currency gaps remain explicit preparation.


### Virtual Guide immediate transport-return guard construction - 2026-10-25

In the current R10 proposal, virtualGuideConversationContract.ts checks the
native Promise brand before reflection, then requires exact Promise.prototype,
no own then descriptor and no own constructor except a data property whose value
is Promise. This explicitly permits ordinary same-realm native Promises only.
Shape decisions must not invoke getters, then bodies or proxy traps. Unsupported
returns use the existing generic transport-failed path, with the existing
synchronous caller-cancellation priority.

Attach a handled observer to the owned abort-sentinel Promise before generate;
keep that same Promise in the race. No new await/drain/retry, timeout, replay,
settlement, policy or restricted-state lifecycle is introduced. The exact static
profile gains node:util after server-only and no other edge or config change.
The guard cannot reverse port-internal assimilation/failures, sandbox mutated
intrinsics or guarantee late drain; an uncooperative port may outlive the outcome.
SQL, provider/default/dependency and source/currentness implementation are absent.

Detailed prospective proof belongs to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. All current R10
checks, counts, durations and results are UNRUN; Root retains formal review,
exact application, live validation and publication. Checked banking is final
only when PUBLICATION_TRANSPORT_RETURN_R10/STATUS_CLOSEOUT.json is PASS in
the retained purpose root. Earlier dated evidence is not current R10 proof.


### Virtual Guide transport-return technical proof - 2026-10-25 02:24:15 CDT

Earlier R10 UNRUN statements retain initial-authorship meaning. Current initial
candidate205focused/4944full/type/lint/normalbuild passed, zero correction
cycles. Retained R09 pre-guard diagnostic10FAIL/8PASS/oneunhandled demonstrates
the defect; it is not current candidate evidence. Detailed proof/limits belong
to solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Immediate native
Promise validation and owned abort observation preserve existing timeout/cancel/
parser/adapter/composition/replay behavior; no late drain, safety-state/policy,
SQL/default/provider/dependency change. Characters/Rootformalreview/application/
live/publication/checked banking remain gates; final banking only at
PUBLICATION_TRANSPORT_RETURN_R10/STATUS_CLOSEOUT.json PASS. No outcome credit.


## Private Explorer successor ownership

The current private construction and its six lifecycle ports (settle v4, others v3) are owned by
solmind-app/AGENTS.md and solmind-app/README.md. The older v1/v2/AV2 descriptions
and dated eleven-profile proof above retain their predecessor scope. The current
source graph has28 exact profiles and twelve erased type-only edges; pure openAiModelConfiguration.ts validates the supplied SOLMIND_OPENAI_MODEL (undefined alone defaults to gpt-5.6-luna), and migration 20261028010000_openai_model_configuration_binding.sql captures immutable operation/screen model identity without a settings table or history backfill; do not infer
new imports or activation from the older counts.

Keep explorerPrivateConfigurationCandidate.ts and explorerPrivateConfiguration.ts,
explorerSafetyReplyContract.ts, explorerSafetyReplyInvocation.ts,
openAiLunaExplorerSafetyTransport.ts, explorerConversationSafety.ts and
explorerPrivateConversationComposition.ts direct-import server-only under
src/lib/solmind/virtual-guide/. The six-port closed repository is
src/lib/solmind/supabase/explorerPrivateConversationRepository.ts. AV3 entries in
src/lib/solmind/virtual-guide/explorerConversationContext.ts are separate from
strict AV2 entries; the AV2 compact input remains wi007-v0.1+onboarding-fields-v2.

Chat step slice S3 (2026-11-03; Paul's decision 4 of decision queue entry 2026-11-03
12:38:07 CST and his go-ahead at 20:50:45 CST): the ordinary AV3 compact input is
wi007-v0.1+onboarding-fields-v2+compass-v1, the same layers plus `compassContext` after
`approvedContinuity`.
Amendment 2026-11-04 (S5): the ordinary AV3 revision is now `wi007-v0.1+onboarding-fields-v2+compass-v2`, requiring `explorer-compass-context.v2`; classification_only and AV2 keep the section-free base revision.
Amendment 2026-11-05 (S6b): ordinary AV3 now uses compass-v3 / explorer-compass-context.v3 (forming points add suggestedInPreviousReply); the current inspector is in 20261105030000_explorer_typed_suggestion_replies.sql; compass-v2 is refused.
Owners: src/lib/solmind/context/explorerSafeContext.ts (the section
shape, limits of 24 points, 5 Route events and 20 selected Waypoint heads (a context
bound independent of active capacity and stored history), the label and text limits,
and the version tie: this revision requires the section, every other revision forbids
it); explorerConversationContext.ts (fills it from the read state for the AV3 entries
only: current points in saved display order, the saved Priority and attention, the last
five needle moves (`attention_changed`) on a current point, counted after leaving out
combined-away points, each with that point's current label, never the label the Route
captured (amended 2026-11-03, S3 fix round 2; Priority changes are not sent), the
current Waypoint heads with stage formed, reached or released, `formation` "saved",
`drafts` empty; the point and Waypoint ids join the source ids);
Amendment 2026-11-04 (S5): point formation may now be `saved` or `forming`; `drafts` remains empty, rejected points are omitted, and an awaitingReply signal for a forming point captures no Route wording.
explorerPrivateConversationComposition.ts (pins the new revision before preparation,
using the section owner's exported version constant);
openAiLunaExplorerSafetyTransport.ts (its instructions list the section and treat
Compass point, Route and Waypoint text as untrusted data; the approved policy, role and
crisis texts are unchanged); explorerPrivateConfigurationCandidate.ts (prompt and
instruction version labels bumped by hand, since the labels are not tied to the text);
explorerContextExclusionGuard.ts (the dormant matcher also accepts the section, only
under its contract version, and inspects its strings). No module was added. One runtime
import edge was added in S3 fix round 2: explorerPrivateConversationComposition.ts may
import ../context/explorerSafeContext (the pure, server-only section owner) for the
version constant, listed in eslint-rules/explorer-source-isolation.mjs and its test; the
profile count and the erased type-only edges are unchanged.
supabase/migrations/20261103210000_explorer_context_compass.sql
replaces ai.solmind_inspect_explorer_context_v3 in place (the new revision only, an
exact rebuild of the section from the saved rows, the ids in the exact source set,
3 to 103 source ids) and methodology.serialized_methodology_valid (exactly two key sets,
each tied to its version). A saved label or Waypoint text containing a character the
assembler refuses (a tab, or a zero-width joiner as in some emoji) makes that
conversation's ordinary Sends unavailable, as such a character in the recent history already does.
Amendment 2026-11-04 (S5): both current SQL owners are in `20261105010000_explorer_forming_compass_points.sql`; validation accepts only the base revision without a section or compass-v2 with it, refusing compass-v1, and inspection requires the exact current mode's envelope.
Amendment 2026-11-05 (S6b): both current SQL owners (the inspector and methodology.serialized_methodology_valid) are in 20261105030000_explorer_typed_suggestion_replies.sql; validation accepts only the base revision without a section or compass-v3 with it, refusing compass-v1 and compass-v2.

supabase/migrations/20261025010000_explorer_source_exclusion.sql owns bounded
current-source inspection and committed content-free exclusion accountability;
`supabase/migrations/20261028000000_explorer_private_deferred_guard_privilege.sql` runs the existing deferred coherence check as its postgres owner at commit; its body, empty search_path, deferred timing and API-role grants stay unchanged.
supabase/migrations/20261025020000_explorer_private_safety_lifecycle.sql owns the
real first-Send container, minimum actual positive private evidence, monotonic
conversation policy and atomic terminal/formation transitions. Five legacy direct
service-role writes are retired, including all former v1 session types; preserve
definitions/history without restoring a bypass. Read-only/owner fixture evidence
grants no dispatch. Current private request wiring selects the v3 repository;
default dependencies still omit provider, readiness, builder, reviewed renderer
and operational signal. Actual assurance and unfinished gates belong to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md and
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md.

### Finite private local HTTP configuration and dispatch - 2026-10-27

The actual private state/commands HTTP routes use
`createExplorerPrivateLocalRequestDependencies` in
`src/lib/solmind/supabase/explorerConversationRequestDependencies.ts`.
The separate `createExplorerPrivateConversationRequestDependencies` retains
explicit capability injection and otherwise supplies auth/v3-repository only.
Older default/private-factory statements below refer to that explicit factory;
they do not describe the new local HTTP composition.

`src/lib/solmind/operations/explorerPrivateLocalRunProfile.ts` owns strict pinned
JSON/receipt loading and uses the shared daily test-allowance ledger described
below. Absent, invalid or expired server-selected data stays held. The browser selects neither profile
nor actor/target/authority. Receipt hashes and shaped approval fields bind trusted
operator evidence; they do not independently establish actual target isolation,
resource/source verification, screening or authenticated Admin/Guide decisions.
The two profile environment selectors are data locations, never enable flags or
approval. No OpenAI credential is read by this loader.

`src/lib/solmind/operations/explorerPrivateLocalDispatch.ts` owns request-scoped
prepared identity, fresh authenticated v3/conversation/policy checks, current
governed-methodology verification and a final authenticated reread after that
await. Changed/unknown authority, cancellation or session/run expiry refuses
forwarding. Check the key's format, then reserve one daily-ledger place, then
forward; never delete, reset or release a place after uncertain results. A
fresh profile shares the same ledger, so it adds no calls beyond the day's
count, and nothing is retried automatically.
Actual provider/credential and isolated-target grants remain separate.

The approved policy record supplies the exact private US English/plain-text
resource/failure strings. Keep the operator audit at the start and end of each
test session, with the daily ledger report, distinct from mandatory dispatch
authority/exclusion.
This is not scheduled integrity/Admin paging, an independent preHTTP snapshot
scanner or an atomic database-to-HTTP lock. Genuine joined proof remains separate;
dated synthetic/source proof retains its original scope. Actual results belong
to solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.

### Daily private local test allowance - 2026-10-31

Paul chose option A for rebuild step 3 on 2026-10-31 (decision queue 14:20:03,
with the defaults recorded at 14:48:04): one test setup allows many sends,
counted against his standing test allowance of up to 1,000 conversation calls a
day on the local demo, safety assessments included (sprint handoff 2026-10-29
22:08:10 and 2026-10-31 11:46:00, 11:50:02, 14:15:38). The profile is
`explorer-private-local-run.v2`, without `explorerMessageSha256`. The grant is
`solmind-private-explorer-provider-grant.v2` with `dailyConversationCallLimit`, a
safe integer from 1 to `EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING` (1,000). A v1
profile or grant, or a grant still carrying `maximumExplorerCalls` or
`explorerMessageSha256`, is refused. Every other grant, target, policy, model,
expiry, sign-in, identity and methodology check is unchanged, and the operator
keeps the human grant. No v1 setup may be made or used again, and no app copy
from before this change may serve a run, because its calls would bypass the
ledger.

`src/lib/solmind/operations/explorerPrivateLocalCallLedger.ts` owns the single
ledger `EXPLORER_PRIVATE_LOCAL_CALL_LEDGER_ROOT`, a fixed local folder that never
comes from a profile, environment selector, run folder or working directory, so
a new setup, folder or run shares the day's count. It imports only `server-only`
and Node built-ins.
A place is one file `<day>.slot-NNNN.json` for the America/Chicago calendar day,
holding only version, day, slot, time and run. Its record is written and synced
in full under a unique `pending` name, then hard-linked to the slot name, which
fails if the slot exists: each place has one winner across requests, processes
and restarts, and a slot is never visible half-written. A place is reserved
before the attempt, stays counted if the outcome is unknown, and is never
deleted, reset or released; one bound request reserves at most once, and a
later call on it is refused before any further read. Any entry
named for the day that is not a complete valid slot record (damaged, partial, a
folder or link, or an unexpected name) holds every run until it is resolved; an
unfinished `pending` file never counts, and one whose write fails is removed
where possible.
If midnight passes during a reservation,
that place stays counted on the old day and nothing is forwarded against it. The
folder must already exist; the app never creates it, and a missing or unreadable
ledger, or a ledger folder that is itself a link, keeps every run held.

The day's total is the number of valid slot files for that America/Chicago day.
`readExplorerPrivateLocalCallUsage` reports the current day only; for a finished
day the operator's report helper counts that day's valid slot files. The
operator reports the total to Paul with the passive dispatch observer's count of
actual requests. Only the current day's
names count, so earlier days' files may be archived; the folder itself must be
left out of any `.validation` cleanup. Deleting today's files or moving the clock
forward would give fresh places; nothing local prevents that, and the observer
count is the cross-check. A reached count shows the existing unavailable state
on the next readiness check, and the reply to the last allowed send already
reports unavailable. The private controller's optional `sendCapacityAvailable`
check is made where a Send would otherwise report available after the readiness
check: on a saved reply, and on an exact replay found by the fallback
observation, the second read or preparation. Failure paths, and a replay found
by the first read, still report unavailable, as before. It can only turn
available into unavailable,
never the reverse; a check that
fails or answers anything but true reports unavailable. Only the local factory
wires it, to the run's own availability (profile expiry and today's count); the
budget wrapper passes it through unwrapped, and the explicit factory neither
accepts nor passes it. Message
text is no longer bound by code: the rule that test messages are invented, never
a real person's words, rests on the operator. The product hard stops are in the
database (next section); the ordinary allowance, the screen notices, Admin
alerts and token recording are later steps and are not built here.

### Product hard stops in the database - 2026-11-01

Product-limits slice 2a puts Paul's two hard stops in the database (decision
queue 2026-10-31 12:45:13 to 14:17:30 and 2026-11-01 00:32:35 to 01:07:27,
12:00:53, 12:27:07 and 13:20:16 to 13:26:32): 500 AI calls per Explorer per
America/Chicago day, and for everyone together 300 per active Explorer. The
per-Explorer value is kept when the day first needs it; before the audited
writer changes that setting, it keeps the current day's old value, so a change
takes effect at the next midnight. The active Explorers are counted once, at
the day's first counted Send, so the sending Explorer always counts. Change the
limit settings one per transaction.
`supabase/migrations/20261101010000_explorer_ai_use_hard_stops.sql` adds four
keys to the closed `core.application_setting` family
(`explorer_ai_use_individual_daily_call_limit`, 500 within 1 to 2,000;
`explorer_ai_use_shared_daily_calls_per_active_explorer`, 300 within 1 to
2,000; `explorer_ai_use_automatic_lifts_per_week`, 1 within 0 to 7; and
`explorer_ai_use_automatic_lifts_per_month`, 2 within 0 to 30; only the audited
writer's allowlist grows, the reader keeps its two keys), the protected
`ai.explorer_ai_use_shared_day` and `ai.explorer_ai_use_stop`
tables (RLS on, zero policies, no API role access, immutable except a stop's
one-time lift and a day's one-time count) and the internal gate
`ai.solmind_explorer_ai_use_gate_v1`.

A Send counts once, when the 37-argument
`public.solmind_prepare_explorer_conversation_turn_v3` commits its started
operation; failed, unknown-outcome and stopped Sends stay counted, and exact
replays never count. The observe step and an early check in prepare refuse a
paused Send with the closed outcome `paused` before any observation, message
or count is stored (a refusal may record the stop it reaches). One exception:
when the only pause is a first stop of its day and the phrase check finds
crisis or urgent signs (level 3 or 4) in the message, observe stores its
observation first, which gives the account crisis status, and the automatic
lift then applies. Observe and both checks in prepare take the four hard-stop
settings, in key order, before they read the clock; the final check then takes
one blocking transaction lock, reads the clock, counts the Send and records a
stop it reaches. When a stop is reached, or a limit setting is lowered, between
a Send's observe and prepare, prepare refuses at its early or final check after
observe has stored the message's safety observation, as for a Send that turns
stale; the message itself is never saved. Both steps were replaced in place
with the same signatures, return shapes and grants.

The individual stop pauses that Explorer until Paul's lift; a same-day lift
gives a fresh individual allowance. An account is in crisis or urgent handling
when any of its conversations is at restricted level 3 or 4. Such an account's
first stop of a day is lifted automatically, once: it is recorded already
lifted when the account is in crisis as it is reached, or lifted at the next
Send when the crisis begins later. An account not in crisis has its first stop of
a day lifted automatically while it has had fewer such lifts than the per-week
setting in the last 7 Chicago days and than the per-month setting in the last
30; Paul's lifts and crisis lifts do not count toward them, and a setting of 0
turns them off. A second stop that day is treated as likely misuse and waits for
Paul, across midnight. The shared stop pauses everyone and lifts at midnight.

Four new service-role-only functions:
`public.solmind_read_explorer_ai_use_pause_v1` (the notice kind for the
signed-in Explorer: NULL, individual, shared or individual_and_shared; whether
the current conversation is in crisis or urgent handling, for the crisis pause
notice; and the adults-only flag; writes nothing; those flags are private facts
for that Explorer's own screen),
`public.solmind_lift_explorer_ai_use_pause_v1`
(the Executor's lift, only on Paul's recorded word: role `system`, authority
`paul_approved`, one content-free `explorer_ai_use_pause_lifted` audit row; a
stop already lifted automatically returns `lifted_automatically`),
`public.solmind_report_explorer_ai_use_v1` (the Question 8 facts plus the
stop's number that day, whether the account was in crisis or urgent handling
when it was reached, and when and how it was lifted: Paul's, a crisis lift or a
weekly and monthly lift) and
`public.solmind_report_explorer_ai_use_days_v1` (daily
counts, so an unusual number of automatic lifts stands out). Paul decided that
crisis status is not private, only what caused it, so Admins may see it at a
limit;
`solmind-docs/execution/05_SolMind_Privacy_And_Security_Baseline_v1_0.md`
Section 11.4 records that exception, and the Explorer privacy disclosure must
say so before real Explorers. Stop records never hold conversation words, a
conversation reference, or safety or crisis counts. The screen step (slice 2b,
next section) is the app's only caller, of the pause read and of the `paused`
outcome. The migration reaches the Card 3 demo database only after that step
is banked.

### Hard-stop pause notices on the screen - 2026-11-01

Product-limits slice 2b shows Paul's pause notices on the connected
conversation screen (decision queue 2026-11-01 00:39:51, 01:07:27, 12:27:07,
13:24:41 and 13:26:32). The repository's thirteenth port, `pause`, calls
`public.solmind_read_explorer_ai_use_pause_v1` with only the actor pair and
accepts only `ok` with a closed `notice_kind` and two booleans that can be true
only with a pause; observe and prepare accept the closed outcome `paused`. The
port is required in the repository type, and the budget wrapper bounds it at
10 seconds like the other required ports.

On Send the controller runs the phrase check and reads the pause after
readiness and before ensure. A pause that read reports is refused there, so
that refusal creates no conversation, except for an individual-only pause
with a level 3 or 4 message, which goes on to observe: observe stores the
observation and the automatic lift applies, or refuses at a second stop. A
denied pause read denies. The read is advisory: if it fails, the Send goes on
to ensure, observe and prepare, which enforce the stops, as before (so a first
Send can then leave an empty conversation when observe or prepare refuses it).
Against a
database without the slice 2a migration the read always fails and Sends run
without the stops, as before that migration; apply the migration together
with this step. When observe or prepare refuses with `paused`, the controller
keeps the policy it returned and reads the pause again; a failed, denied or
other re-read, or a pause that has ended by then, gets the existing temporary
assistance and, when the facts are critical, its marker (Send then shows
unavailable until a reload).

A refusal emits the marker when the conversation policy or the message is
critical, then makes a fresh authenticated read with this operation's
selector, so a duplicate of the Send that committed meanwhile shows as its
exact replay without a refusal notice (in that rare race a critical duplicate
can raise the marker for an operation returned as its replay; accepted, so
that a read stays the last wait). If that read first shows critical facts,
the marker is sent then and the read is repeated with the same selector (an
exact replay there is returned as the replay). When the last read is not an
exact replay, the result carries `paused` assistance, so the browser keeps the
typed message and Send stays usable (the crisis unlock stays reachable), with
the provider state following the test allowance checked after the last read. A lost or failed fresh read, or a notice
the renderer cannot write, keeps the existing static assistance, chosen from
every policy fact any read has shown and the phrase check, never the pause
read's flags. A screen-open read reads the pause before its final fresh
read and writes the notice afterward, without the refused-message line; a
failed pause read there shows no notice. The notice's crisis and adults-only
parts follow the final read's own known policy; when that policy is unknown,
the policy known before it together with the pause read's flags (both kept
even if the conversation may have changed, since the pause read returns no
conversation reference: this errs toward the supportive wording); and the
refused message's phrase check.

`createExplorerPrivateReviewedRenderer` writes the notice with
`pauseNotice`, bound to the same resource policy and receipt as `render`, and
readiness is held when a renderer lacks it. The ordinary notice is the pause
sentence with its true restart condition (the individual stop: an Admin's
lift; the shared stop: midnight, Chicago time; both: both pauses ended), the
refused-message line on a refused Send, the adults-only paragraph where the
Explorer may be under 18 (the stored conversation state, or a refused message
whose phrase check suggests it), then the help text. A crisis notice, for a
conversation in crisis or urgent handling or a refused level 3 or 4 message,
leads with the trusted acknowledgment, limits, help text and human-contact
parts in reply order (level 4 the crisis parts, level 3 the urgent parts),
then the adults-only paragraph where it applies, then the pause. The marker
is the existing value-free one, never chosen from the pause read's flags, which
are never logged or passed to signals. The crisis parts are the
app's draft text and the help text is the demo's approved record: before real
Explorers, the crisis wording needs Paul's approval and the help resources
must be verified. A Compass or Waypoint command clears the notice from the
screen while the pause continues; a reload or the next Send shows it again.

### Held private request/browser boundary

src/lib/solmind/explorerPrivateConversationResponse.ts is browser-safe and accepts
only the versioned version/result/assistance envelope, reusing the existing
closed result parser. Assistance is null or bounded support, adult_policy or
temporarily_unavailable text with persisted:false; it never becomes saved history.
No private policy, evidence, actor or configuration crosses through this owner.
The private controller imports the assistance type only; this erased edge
does not permit a server value import into a browser module.

src/lib/solmind/supabase/explorerConversationRequestDependencies.ts shares the
existing raw-cookie authentication source between retained predecessor and new
private factories; malformed unrelated pairs alone are skipped. The closed
fourteen-port private repository includes exact9arg
public.solmind_confirm_explorer_waypoint_revision_v1, 7arg Release and the
8arg respondCompassSuggestion port alongside category/End/review/pause. Each
retains the propagated 10s await budget. Revision/revisit require current
unrestricted active reflection; owned Release preserves safety/stop state,
immutable definition/lineage/app-question-Explorer-answer history stays private,
no clarification becomes AI context, and abort is not remote rollback.
Its default has only auth/repository; readiness/provider/context/renderer/signal
require explicit trusted server injection. No new provider credential/environment
lookup, fake operational default or candidate-driven activation is introduced.

The state/commands candidates call private read/command and validate the strict
envelope. GET never ensures a container or writes evidence, and reports generation
available only through complete injected ports/valid readiness. The browser parses
the same envelope, displays assistance separately, retains the draft on an
assistance-bearing confirmed state and clears private state on authority loss.
Its legacy 70-second abort is not a whole-command budget or remote drain guarantee.
This held integration candidate supplies no validation pass, formal assurance,
application/banking, operational acceptance or genuine-AI proof.

### Explicit private-local signal and dormant screening boundary

src/lib/solmind/operations/explorerPrivateOperationalSignal.ts accepts only an
explicit dedicated local .jsonl destination and verification-receipt binding.
It appends version/time/closed marker, without private IDs, default/path/env
lookup, directory creation, retry or notification. No destination is operationally
adopted. The controller's one-second await/abort request is not proof an in-flight
filesystem append stopped; unknown completion never grants retry.

src/lib/solmind/virtual-guide/openAiLunaMethodologyScreeningTransport.ts owns pure
explicit-policy subject/manifest/request-byte binding and a dormant injected HTTP
adapter. Preserve the captured configured model/medium/store:false, structured output, absent
tools/background/stream/retry, 128-KiB limits and omission of account/pack UUIDs
from model input. Its 60-second local race covers fetch/body parsing, not a whole
screening workflow, remote cancellation, billing or zero provider retention.
Standard provider abuse-monitoring retention is separately disclosed. No key
lookup, automatic policy acceptance, actual screen, human approval or activation.
Both owners are server-only with erased type imports; new-module checks are
initially UNRUN and prior bridge checks prove only prior bytes. GET rereads fresh
identity/authority/state after awaited readiness. Real governance, joined-command
proof, scheduled integrity and provider gates remain unchanged.

### Private request await-budget boundary

src/lib/solmind/operations/explorerPrivateRequestBudgets.ts is server-only and
imports the controller dependency type only. The new private request factory
wraps auth and each supplied one of six v3 repository methods at 10s, readiness
at 15s and context at 30s. Context combines caller and owned deadline signals;
provider/render/signal retain their 60/2/1s owners. The legacy factory does not
use the wrapper. Default private dependencies still omit all operational ports.

Finite await ownership is implemented, not a claim that command budgets are
wholly absent. Native-Promise/race/deadline guards bound local waits without
proving remote cancellation, rollback, drain or synchronous-code isolation.
Timeout never authorizes automatic retry or another terminal post. The retained
70-second browser abort expresses delivery interest and uncertain completion.
Joined-path timing/settlement proof, actual governance, scheduled integrity and
activation remain gated; new fake-timer cases are initially UNRUN and earlier
bridge checks cover only earlier source bytes.

### Explicit trusted renderer and governed-capability boundary

src/lib/solmind/operations/explorerPrivateReviewedRenderer.ts reconstructs the
pinned trusted before/resource/after segments, binds renderer/resource versions
and selects explicit adult or age-appropriate resources in the required order.
Adult-only and restricted-follow-up plans remain distinct; mismatched plan prose,
generated candidates and unsupported persistence/signal claims refuse. Supplied
resource/failure strings and receipt labels prove no real review or suitability.
Keep its controller and safety-plan imports erased types.

src/lib/solmind/virtual-guide/explorerPrivateGovernedCapabilities.ts composes
explicit copied configuration, pack/Guide scope, receipt hashes, versions
and ports into a deterministic fingerprint. Its readiness path performs a real
effective-methodology source call each time and requires the pinned subject
digest; operational injection must supply the genuine governed resolver. Turn
context uses the AV3 governed builder/adapter with current authority
and methodology revalidation. Receipt labels manufacture no approval or authority.

These server-only direct-import mechanisms remain dormant: no default adoption,
credential lookup, provider activation or real-user effect. Actual Admin/Guide
decisions, accepted operational policy/resources, source/integrity coverage and
genuine joined-path evidence remain gates. Construction is not passing proof.

## Chat slice S4: reply v2 construction - 2026-11-04

Paul approved the corrected S4 scope on 2026-11-04 (decision queue 09:57:20 and
10:22:18 CST). New provider replies use the closed explorer-safety-reply.v2 body:
protocol, classification, candidateReply, optional compass {attention: saved point
UUID or null}, and optional choices [{label}] (one to three, 1 to 40 Unicode scalar
characters per plain-text label). Malformed optional groups are absent independently;
they never discard valid classification or candidate prose. Classification-only mode
requests neither optional group nor candidate prose. The request remains
explorer-safety-request.v2. Existing v1 evidence and saved messages remain valid.
Amendment 2026-11-04 (S5): optional compass attention may also name a current forming head below level 2; its Route capture waits for confirmation.

explorerSafetyReplyContract.ts owns parsing; explorerPrivateConversationComposition.ts
passes proposals only for ordinary replies with delivery still wanted. Attention must
name a current saved head; unplaced heads remain eligible. Choices require level 0 or
1. SQL rechecks current authority, ownership, unrestricted state and successful reply
persistence. A null, missing, foreign or merged attention is ignored, never a request
to clear attention or fail the reply. The pending-turn guard keeps formation stable.
The closed repository now calls public.solmind_settle_explorer_conversation_turn_v4
with the previous 20 arguments plus p_attention_item_id and p_choices. Service-role
execute on settle v3 is revoked; its definition and old evidence are retained.
Prepare keeps its exact 37 arguments and one-count-per-Send hard-stop behavior.
The forward migration is
`supabase/migrations/20261104000000_explorer_reply_protocol_v2.sql`.
Amendment 2026-11-04 (S5): a current forming head is also eligible for automatic attention below level 2, and settle v4 adds p_compass_suggestions as its 23rd argument in the S5 migration.

Choices are an insert-time nullable column on the saved Virtual Guide message,
protected by the message guard for both v1 and v2, and returned as optional choices
in the closed browser state. S4 renders no choice controls. A real automatic move
adds one completed follow_attention operation, with an immutable origin_operation_id
link to its Send and an attention_changed Route event. The optional Route actor is
explorer or virtual_guide; no origin identifier enters browser or model context.
The existing AV3 compass-v1 section keeps its revision and adds an optional actor /
awaitingReply pair to recentRoute. New assembly and SQL exact rederivation supply
both; only the latest Explorer needle move after the last saved Virtual Guide reply
has awaitingReply true. This prevents repeated acknowledgments without a persistent
marker. Priority changes remain excluded. AV2 stays unchanged.
Amendment 2026-11-05 (reply choices): the connected screen now shows the latest saved reply's choices as
buttons; see "Reply choices as buttons" below.
Amendment 2026-11-04 (S5): ordinary AV3 uses compass-v2 / explorer-compass-context.v2; the latest Explorer move onto a forming point also supplies the transient awaitingReply signal without a Route row.
Amendment 2026-11-05 (S6b): ordinary AV3 now uses compass-v3 / explorer-compass-context.v3 (forming points add suggestedInPreviousReply); the current inspector is in 20261105030000_explorer_typed_suggestion_replies.sql; compass-v2 is refused.

The global policy and role text change only for the v2 proposals and approved shift,
acknowledgment and choice guidance; prompt/instruction labels and integrity pins
change together. Never claim a proposed move was saved. Mention only substantial,
unannounced shifts, once, below level 2 and outside restricted conversations; offer
a return to the earlier topic at most once without pressure. Acknowledge an Explorer
move awaiting a reply briefly once, then follow their lead. Offer choices only when
helpful; a first reply without a named topic may offer Show me around, I have a
question and Let's begin. Always answer questions about how the screen works.

This is source construction, not demo approval or provider evidence. Paul must read
the exact changed wording before demo use. His later crisis-context decision is
implemented separately below; S4 itself leaves those calls unchanged.
The independent AI-provider/database review and two-round rule remain Executor
work. SQL/pgTAP, browser validation and any approved demo migration are Executor
work; no database, provider or server was run by the builder. Daily repeated tour
offers, remembered feature-use evidence, the Admin duration setting, forming points
and Waypoints, S6 buttons, and Key Insights remain later slices.
Amendment 2026-11-04 (S5): forming Compass points are implemented below; forming Waypoints, S6 controls and the other named later work remain outside S5.
## AV3 crisis-check context - 2026-11-04

Paul's decision 2026-11-04 17:14:51 CST, point (d): classification_only uses
wi007-v0.1+onboarding-fields-v2 without compassContext or its point/Waypoint source
ids. The controller selects the mode before assembly; its adapter forwards it to
both private builders, which omit the section before serialization and hashing.
The controller pins mode, revision and section presence together. Ordinary
classification_and_reply keeps the existing compass-v1 bytes; AV2 is unchanged.
Amendment 2026-11-04 (S5): ordinary classification_and_reply now uses compass-v2 / explorer-compass-context.v2; classification_only and AV2 keep the section-free base revision.
Amendment 2026-11-05 (S6b): ordinary AV3 now uses compass-v3 / explorer-compass-context.v3 (forming points add suggestedInPreviousReply); the current inspector is in 20261105030000_explorer_typed_suggestion_replies.sql; compass-v2 is refused.

The inspector replacement in
supabase/migrations/20261105000000_explorer_crisis_context_without_compass.sql
requires the exact matching envelope and source set, deriving mode from known
restricted/adult-stop state after prepare applies fallback under lock. Unknown
policy fails closed. Its existing SECURITY INVOKER setting, owner and grants,
prepare's 37 arguments, immutable snapshots and historical replay are unchanged.
Keep context/RPC/provider limits at 30/10/60 seconds and preserve cancellation,
one-call and counting rules. SQL and browser execution remain Executor work.

## Chat step S5: forming Compass points - 2026-11-04

Paul's decisions of 2026-11-03 12:38:07 and 2026-11-04 21:44:03 allow
conversation-derived Compass wording to appear immediately as Forming. Only the
Explorer confirms a point, Priority or arrangement. S5 adds no reply buttons or
typed-confirmation interpretation; those remain S6. Existing tools stay mounted.

The single forward migration is
`supabase/migrations/20261105010000_explorer_forming_compass_points.sql`.
The app change and this migration must reach a database together; out of step in either direction every ordinary Send fails closed before the provider is called.
`ai.explorer_conversation_compass_item.formation_status` is NULL for existing
Explorer-saved rows (no backfill), or proposed, confirmed or rejected.
`wording_message_id` points to the saved Virtual Guide reply that last supplied
forming wording. Only settlement may overwrite a proposed label. Refining a
proposal overwrites that label and pointer without a Compass wording snapshot;
confirmed category/wording history remains immutable. Existing immutable context
evidence retains fingerprints, source ids and version bindings, not serialized
context text. S5 adds no hidden snapshot of forming wording.

The existing 24-row limit counts every non-rejected row, including merged
originals and forming points. Rejected rows have a separate fixed limit of 24
per conversation; reaching it refuses another rejection without deleting earlier
rows or silently freeing a slot. Rejected rows never appear in state or model
context and cannot be heads, selectors, arrangement entries or category targets.
Total storage is therefore at most 48 rows; display order can be 1 through 48.
One-way combination still releases no slot. The eight visible positions and
explicit Explorer control of Priority and arrangement remain unchanged.

The service-role-only `public.solmind_settle_explorer_conversation_turn_v4`
adds `p_compass_suggestions` to its previous 22 arguments. Each optional entry
has a label and optionally pointId naming an owned current forming point. Only
the first three submitted entries are considered; invalid entries are dropped
independently, preserving valid siblings and the reply. A label with leading or
trailing spaces is dropped, not trimmed. Labels must be single-line text within
the existing 160-unit browser/context and SQL label bounds. Suggestions require
a successfully saved ordinary reply, delivery still wanted,
unrestricted/adult-allowed state and classification below level 2.
They cannot rewrite a confirmed or Explorer-saved point, choose Priority or
arrange points. An unchanged label does not create a new history entry.

An Explorer or automatic Virtual Guide move onto a forming point changes
attention but creates no Route entry or captured label. Immutable set_attention
or Send facts keep only the target id. Confirming the point records every
deferred move once as attention_changed, in operation order, with the confirmed
wording, the revision and time the move would have had, and actor explorer or
virtual_guide, even if attention has since moved elsewhere. Rejection never
creates those Route entries. No later move captures an unconfirmed prior label.
The latest Explorer needle move after the last saved Virtual Guide reply still
supplies recentRoute's awaitingReply signal, including a move onto a forming
point, with its current label and actor explorer. TypeScript and SQL build the
same transient signal without writing a Route event; a later Explorer move
supersedes it and the next saved Virtual Guide reply clears it.
Amendment 2026-11-04 (S5): the read uses `ai.solmind_forming_attention_move_v1` to supply optional, server-only, label-free `authority_context.formingAttentionMove` as `{pointId,revision,recordedAt}`; a rejected latest move uses `pointId:null` and chronology only to suppress an older acknowledgment, with no browser field or Route event added.
The private confirmation/rejection helper is groundwork
for S6, with no new public execute grant or browser command; it requires current
Explorer authority, exact wording/revision, unrestricted active state and no
pending turn. Proposed points must be confirmed before Priority, arrangement or
category operations can capture their wording.

The additive optional `compass.suggestions` field keeps explorer-safety-reply.v2.
The private ordinary context revision becomes
wi007-v0.1+onboarding-fields-v2+compass-v2, with
explorer-compass-context.v2 and formation saved or forming. SQL rederives the
same section exactly. methodology.serialized_methodology_valid accepts v2 with
its section and the base revision without a section, and refuses compass-v1;
exact replay returns before this check. Classification-only context still has no
Compass section or its exclusive source ids, using wi007-v0.1+onboarding-fields-v2. AV2 and
historical evidence remain unchanged. Prepare still has 37 arguments; context,
RPC and provider await limits remain 30/10/60 seconds, with the same cancellation,
one-call, exact replay and one-count-per-Send rules.

The browser contract accepts optional formation saved or forming so old fixtures
remain valid. The connected Compass card marks forming points with a dashed
outline and the word Forming, in Full and Compact views. Existing tool reviews
exclude forming points from Priority, arrangement and category captures while
keeping attention available. Ending on a forming point uses the label-free
sentence "Current attention was still forming." Global policy,
role text and output instructions permit bounded tentative suggestions without
claims of saving or confirmation; their version labels and integrity pins move
together. Paul must read the exact changed sentences before demo use.

This is isolated source construction, not integration or demo approval. Builder
checks are limited to TypeScript, ESLint and Vitest. SQL/pgTAP and browser suites,
the standing Executor-launched independent Claude review, integration and any
database/demo update remain Executor work. The builder may not access the
sibling solmind-docs repository: its Data Model 03, Orchestration 04 section 12.6
and Blueprint section 7.6 updates are an explicit outstanding handoff, not a
claim that canonical documentation was updated.

## Chat step S6a: replies on forming Compass suggestions - 2026-11-05

The connected screen now offers one row per current forming Compass point,
inside the list item of the Virtual Guide message that last supplied its wording.
S6a projects wording_message_id as optional forming-only wordingMessageId,
while sourceMessageId retains the original source. The closed browser parser
requires a present wordingMessageId to name a saved Virtual Guide message;
older projections without it show no reply row. This display pointer is absent
from provider context, whose source IDs and bytes are unchanged. The row offers
"That's right", "Close, not quite" and "That's not it"; these labels and the
reason sentences remain drafts for Paul's wording read. Confirmed, rejected,
combined-away and ended points have no reply row. The review mockup is unchanged.

The closed browser command respond_compass_suggestion carries only itemId,
response (right, close or not_it), operationId and expectedRevision. Its separate
eight-argument service-role-only RPC is
public.solmind_respond_explorer_compass_suggestion_v1, introduced only by
supabase/migrations/20261105020000_explorer_compass_suggestion_replies.sql.
The existing generic mutate whitelist is unchanged. SQL reads the stored wording
under current-authority, active-session, ownership, known-clear-policy,
pending-turn and revision checks. Right confirms using S5's transition rules,
including recording each deferred needle move once with confirmed wording;
not_it privately rejects with the separate 24-row rejection limit; close records
the answer and leaves the point unchanged. Exact operation/fingerprint replay
changes nothing; a stale revision conflicts. No response command calls a provider
or counts as a Send. The private immutable operation receipt adds only
compass_suggestion_item_id and compass_suggestion_response; it retains no
snapshot of forming wording.

A pending turn, the turned-down limit and invalid forming-point selections use
the existing definite-conflict path: the browser requires a refresh and starts
no follow-up Send.

Amendment 2026-11-05 (turned-down limit): saved state includes the required
boolean turnedDownLimitReached, true at 24 rejected Compass rows in that
conversation under S5's counting rule, with no rejected details or count.
The browser contract and repository reject missing or non-boolean values.
Only "That's not it" is disabled; the named row gets Paul's approved reason
once beneath it. ExplorerConversation.tsx refuses not_it locally without a
request. The other replies and typing retain their existing gates. A server
refusal after a race still takes the definite-conflict path. S6b typed
rejections at the limit still leave the point unchanged and let Send complete.
The app change and its migration (20261105040000) must reach a database
together; out of step in either direction, every conversation state read
fails closed.

explorerConversationContract.ts owns the closed command and optional UI-only
compassSuggestionReplies availability (available, support, adult_policy or
unavailable). explorerPrivateConversationComposition.ts derives that value from
server policy, routes the command and refuses restricted/adult-stopped changes.
This is a deliberate, coarse display value derived from private policy for
only the Explorer's own screen; it includes no level, version or evidence.
explorerConversationComposition.ts owns its fingerprint.
explorerPrivateConversationRepository.ts owns the exact
respondCompassSuggestion port, wrapped by explorerPrivateRequestBudgets.ts with
the same 10-second budget as the other ports.

ExplorerCompassSuggestionReplies.tsx is presentation only; its labels and
current-source filtering live in explorerCompassSuggestionReplies.ts.
ExplorerConversationConnectedScreen.tsx places it in the existing transcript
list item. Busy, pending, uncertain and End-review states hold replies; close
and not_it also require ordinary Send availability and message capacity.
Restricted/adults-only states hide the controls and show one reason sentence;
an absent or unknown availability also fails closed. These are connected
controls, not build notes; existing build-note behavior is unchanged.

ExplorerConversation.tsx owns the sequence: after a confirmed close or not_it,
a separate suggestion_follow_up intent prepares one ordinary Send with the
button label followed by a colon, a space and the point's current wording in
straight double quotes, at the returned revision. Right makes no Send. The follow-up
retains the Explorer's typed draft, including across identical-byte uncertain
retry. Each phase has its own operation identity; no failure or uncertain
response command starts a follow-up. Existing authority-loss clearing, Send
counting, hard stops, cancellation and context/RPC/provider limits remain.
Typed confirmation interpretation remains S6b.

This is isolated source construction. SQL/pgTAP and browser execution,
independent review, canonical solmind-docs updates and any integration or demo
publication remain Executor work. The builder was limited to the clone and
the three named package files; no sibling product documentation was read or
written. Paul must read the new wording before anything reaches the app or demo.

## Chat step S6b: typed replies to Compass suggestions - 2026-11-05

Paul's decision of 2026-11-03 12:38:07 says typed replies always count.
The Virtual Guide may propose right, close or not_it only when the latest
Explorer message clearly answers its immediately preceding saved suggestion.
Residual risk: the model judges the typed answer's meaning; a button press
records the Explorer's explicit selection. Silence, topic changes and ambiguous
messages supply no answer; when unsure the Virtual Guide asks.

The additive optional compass.responses keeps explorer-safety-reply.v2.
The first three submitted entries are considered independently; malformed
entries are dropped and the first valid response per point wins. Ordinary
context becomes wi007-v0.1+onboarding-fields-v2+compass-v3 with
explorer-compass-context.v3. Each forming point adds only the boolean
suggestedInPreviousReply, derived identically in TypeScript and SQL from its
wording source and the last saved Virtual Guide message. Saved points add no
field. The prior context version is refused for new turns. Classification-only
calls keep the section-free base version and existing source exclusions.

The only forward migration is
supabase/migrations/20261105030000_explorer_typed_suggestion_replies.sql.
Settle v4 adds p_compass_responses as its 24th argument. It independently
requires an ordinary saved reply, delivery still wanted, unrestricted and
adult-allowed state, classification below level 2 and classification_and_reply.
A response must target a current forming head whose stored wording came from
the immediately preceding saved Virtual Guide reply. A response is also
dropped when that point already has an answer receipt (button or typed)
completed at or after that reply was saved, so a button Close followed by its
automatic Send never adds a typed receipt; typed answers to that same wording
then no longer count, and new wording from a refinement makes them count again.
A valid refinement in the same reply wins over its response, even when the
wording is unchanged.
The shared S6a transition confirms exact stored wording for right and records
deferred needle moves once; not_it rejects privately, silently dropping the
response at the separate 24-row limit; close records only the answer.
Applied responses use immutable point-id/answer receipts marked typed, with
no wording snapshot. Response proposals bind exact replay; no duplicate
transition or provider call is authorized.

explorerPrivateConversationComposition.ts filters proposals defensively;
explorerPrivateConversationRepository.ts closes and freezes the 24-argument
payload. The saved state updates the existing card and S6a reply row without
new controls. Prepare remains 37 arguments; grants, current authority checks,
30/10/60-second context/RPC/provider budgets, cancellation and Send counting
remain unchanged. App and migration must reach the database together.

Global policy, role text, output instructions, version labels, byte counts and
integrity pins move together. Paul must read the exact changed sentences before
anything reaches the app or demo. This isolated build grants no publication or
deployment authority. SQL/pgTAP and browser execution, independent review and
canonical sibling-document updates remain Executor work; the builder cannot
read or write the sibling documentation under this package's access limits.

## Chat step S7a: private Waypoint drafts in the conversation - 2026-11-05

Paul's decisions of 2026-11-03 12:38:07 and 2026-11-05 13:18:35 authorize
one private forming Waypoint draft with a short title, destination, why it
matters and arrival signal. The Virtual Guide may suggest or refine that
wording; only an Explorer reply button confirms or rejects it. Typed Waypoint
answers remain S7b. Existing local clarification/form drafts retain their
close/reload loss disclosure; these saved conversation drafts survive reload.

The single forward migration is
supabase/migrations/20261105050000_explorer_waypoint_drafts.sql.
The app change and its migration must reach a database together. State now
requires waypointDraft (the current proposed draft or null) and each saved
Waypoint's title. Old state projections and the old ordinary context version
fail closed; this is not a runtime compatibility switch.

content.waypoint_draft is Explorer-private, with RLS enabled, zero policies
and no direct anon, authenticated or service_role grants. It allows one
proposed draft per conversation, draft_kind new only, nullable forming fields,
and at most 24 rejected rows per conversation. Drafts do not consume the
account-wide active allowance (lane 7, 2026-11-06). Only settlement rewrites proposed wording.
Confirmed and rejected drafts are immutable; rejected details never enter
browser state or model context.

The service-role-only settle v4 replaces the 24-argument overload with 25
arguments, adding optional p_waypoint_suggestion. The additive optional
waypointSuggestion reply field keeps explorer-safety-reply.v2. Its four
required valid fields are accepted only with a saved ordinary reply below
level 2, delivery still wanted, classification_and_reply, clear restriction
and no adults-only stop. Invalid suggestions are dropped independently of
the reply. Refinement replaces wording and its latest suggestion-message
pointer, retaining the first source message; exact replay applies no change.

public.solmind_respond_explorer_waypoint_draft_v1 is the separate bounded
service-role-only command. It preserves fresh authority, policy, ownership,
revision, pending-turn and exact-operation-replay checks. Right copies the
exact stored four fields into a chosen Waypoint within the existing limit,
records Explorer choice and insert-only Virtual Guide/draft/source provenance,
and marks the draft confirmed. Close records only the answer; not_it rejects
within the separate bound. Neither response command calls a provider.
History, revision, Reached and sharing rules remain unchanged.

Ordinary context is wi007-v0.1+onboarding-fields-v2+compass-v4 with
explorer-compass-context.v4. Its drafts array contains zero or one proposed
draft with id and the four nullable fields. SQL and TypeScript derive the
same section and source set; compass-v3 is refused for new turns.
Classification-only calls retain the section-free base revision and exclude
Compass, Waypoint and draft sources. The 30/10/60-second context/RPC/provider
budgets, cancellation, one-call and counting rules remain unchanged.

The connected transcript shows the current draft under the Virtual Guide
message that supplied its latest wording, with Forming, Where you're heading:,
Why it matters: and Reached looks like:. The existing three-reply row and helper
retain their labels, operation identity and uncertain
retry behavior. Close and not_it start a separate ordinary follow-up Send
only after the response is confirmed, naming the draft title and preserving
the Explorer's typed message. Right starts no Send. Confirmed Waypoints use
their saved titles in the existing Waypoint display. Review mockups are unchanged.

Fix round 2, 2026-11-05 (Paul's answers at 17:04:49, 17:21:15 and 17:30:02
CST): the shared unavailability sentences now say "suggestion replies" for
both Compass and Waypoint rows. At the Waypoint limit only "That's right"
is disabled, with the approved reason once beneath the row and a local
command refusal before any request. Close, not_it and typing keep their
existing gates; a server refusal after a race keeps the definite-conflict path.
Amendment 2026-11-06 (lane 7): the browser's waypoints array is an
explicitly partial projection of at most 20 current heads. Required server
waypointCapacity supplies the account-wide active count, active limit and
conversation history room; screen and command gates never count local rows.
SQL coverage exercises Release, Reached, revision and separate active/history
guards on a draft-confirmed Waypoint. The SQL and TypeScript
context tests share one non-empty draft golden in the SQL test.

All five prompt/role/instruction labels end in -20261105-s7a-r2; wording,
byte counts and integrity pins move together. Paul approved the final
screen and instruction sentences in this round's PAUL_ANSWERS.md.
SQL/pgTAP and browser execution, independent review, canonical sibling-doc
updates and any integration or publication remain Executor work. This builder
is limited to the clone and the five named fix-package files; no sibling product
documentation, database or provider was accessed.

## Curious Virtual Guide instruction round - 2026-11-05

This instruction-only round adds easier optional choices, one gentle invitation
after hesitation, useful situation questions one at a time, and adaptation to
the Explorer's style within the conversation without assigning a type or
retaining a style profile. All five prompt/role/instruction labels end in
-20261105-cg-r1; changed text and integrity pins move together. There is no
database, context or screen change. Existing safety, crisis, pacing, Compass,
Waypoint and output-protocol rules remain. Paul must read the exact changed
instruction sentences before saving or integration into the app or demo.

## Chat step S7b: typed replies to the forming Waypoint - 2026-11-05

Paul's decisions of 2026-11-03 12:38:07 and 2026-11-05 17:21:15 extend
typed answers to the one forming Waypoint draft. The Virtual Guide may propose
right, close or not_it only when the latest Explorer message clearly answers
the exact wording from its immediately preceding saved reply. Residual risk:
the Virtual Guide judges the typed answer's meaning, whereas a button press
records the Explorer's explicit selection. Silence, topic changes and ambiguity
supply no answer; when unsure the Virtual Guide asks.

The additive optional waypointResponse keeps explorer-safety-reply.v2 and
contains only draftId and response. A malformed proposal is dropped without
losing the reply. Ordinary context becomes
wi007-v0.1+onboarding-fields-v2+compass-v5 with explorer-compass-context.v5.
Its proposed draft adds suggestedInPreviousReply, derived identically in
TypeScript and SQL from its latest wording source and the preceding saved
Virtual Guide reply. Compass-v4 is refused for new turns; classification-only
calls keep the section-free base revision and existing source exclusions.

The forward migration is
supabase/migrations/20261105060000_explorer_typed_waypoint_replies.sql.
Settle v4 replaces the 25-argument overload with 26 arguments, adding
p_waypoint_response. A response requires a saved ordinary reply below level 2,
delivery still wanted, unrestricted/adult-allowed state and
classification_and_reply. It must target this conversation's current proposed
draft from the immediately preceding saved Virtual Guide reply, with no answer
receipt completed at or after that reply. A valid rewording in the same reply
wins over its response. Right confirms exact stored wording within the existing
Waypoint limit; not_it rejects within the 24-draft bound; a limit silently
drops the response. Close records only the answer. Applied typed receipts keep
only the draft id and response, with no wording snapshot. Exact replay never
applies a response twice. The existing forming and Waypoint cards update from
saved state without new controls.

A Waypoint revision or revisit now carries a drafted title (one that differs
from the destination) forward unchanged; neither screen asks for a title. A
form-created Waypoint, whose title is its destination, keeps following its
destination. All five instruction labels
end in -20261105-s7b-r1, and changed wording, byte counts and integrity pins
move together. Every sentence added or changed in the held curious-Virtual-Guide
round remains unchanged. Paul must read all new instruction sentences and this
title behavior change before anything reaches the app or demo.

The app change and this migration must reach a database together. Grants,
existing authority checks, context/RPC/provider budgets, cancellation, one-call
and counting rules remain unchanged. SQL/pgTAP and browser execution,
independent review, canonical sibling-document updates, integration and any
publication remain Executor work. This builder is limited to the clone and
the three named external files; no sibling product documentation, database
or provider was accessed.

## Reply choices as buttons - 2026-11-05

Paul approved this screen behavior in the decision queue on 2026-11-05
16:37:16 CST. He approved the labels and calm lines in his wording read on
2026-11-06 at 08:56:47 CST. Since S4 a saved Virtual Guide reply may carry one to
three plain-text choices (1 to 40 Unicode scalar values each), returned as
the message's optional choices. src/lib/solmind/explorerReplyChoices.ts owns
the rule: only the latest saved message may offer choices, and only when it
is a Virtual Guide reply carrying them, in an active conversation with no
pending turn and compassSuggestionReplies "available". This uses the coarse
S6a display value; restricted, adults-only and unconfirmed conversations show
none. Saved choices are already empty at classification level 2 or above.
A choice tap or a sent message ends the current offer.
ExplorerReplyChoices.tsx is presentation only, inside that message's existing
list item after any Compass suggestion replies, as a group named "Suggested
replies" with the existing choice-button look. The class strings are exported
from ExplorerConversationScreenTranscript.tsx; the review mockup is unchanged.
These are connected controls, not build notes. Existing held-screen, Virtual
Guide availability and saved-message capacity gates remain in force.

ExplorerConversation.tsx owns the Send: the reply_choice intent sends exactly
the choice's label as an ordinary send command (kind, body, operationId,
expectedRevision). It is refused unless the latest reply still offers that
label, the Virtual Guide is available and capacity remains. It is the
Explorer's own message: one counted call, checked for crisis signs like any
typed message, with the same uncertain-retry bytes and operation identity.
Its own intent keeps the Explorer's typed draft. There is no server, database,
provider-instruction, reply-format or context change; the first-conversation
tour and its daily offer remain later work.

Amendment 2026-11-05 (reply choices r2): "Something else" appears after the
choice buttons with a distinct text-style appearance, only where those
choices show, and never on the Compass suggestion reply row. It is not
counted among the three choices. Pressing it focuses the message box, keeps
any typed draft, sends nothing and makes no request or provider call. The
choices stay visible until Send. One calm line appears just above the
message box and is associated with it for screen readers. The list of 20
exact lines lives in explorerReplyChoices.ts, as Paul approved them; change
them only with his approval. Screen state remembers the last selected line only for the
current conversation; each press selects randomly from the other lines.
The line clears on Send or a new Virtual Guide reply. Nothing is saved or
sent, no browser storage is used, and the line is not a Virtual Guide message.

## Compact Waypoint list - 2026-11-06

Paul's decision of 2026-11-05 19:38:45 (point 4, on GPT-6 Astra's research
REV276) and his design approval of 2026-11-06 08:59:55 (both additions:
newest first, and a forming Waypoint shown in the list as well as in the
conversation) turn the connected Waypoint card into a compact list.
ExplorerConnectedWaypointCard.tsx draws each Waypoint as one row (its title,
at most two lines while closed, and its stage) that opens to the earlier card
details, one row at a time (a disclosure button with aria-expanded and
aria-controls). Three rows show at first, then five ("Show N more"), then all
("Show all N"); "Show fewer" returns to three. Show more and Show all move
focus to the first row they reveal, and Show fewer to Show more. A forming
draft takes the first row with the dashed "Forming" marker (not in an ended
conversation); the other rows are the Formed Waypoints, newest first; Reached
and Released Waypoints sit in a closed "Reached and released (N)" group.
explorerConnectedCard.ts owns the list helpers (waypointListGroups,
waypointRowsShown, waypointListNextSize) and WAYPOINT_LIST_WORDING. Layout
state only (which row is open, how many show, whether the group is open):
nothing is saved and no command, request or AI call is added. Its screen-reader
operation is still to be checked with a real screen reader before the pilot
(Paul's rank, 2026-11-06 09:20:44: This Sprint Could, MVP0 Should).

## Opening greeting - 2026-11-06

Paul's decision of 2026-11-05 19:13:28 (wish 1 from his test: "there was no
initial offer ... Just a blank chat window") adds a fixed, short welcome to a
conversation that has no saved message and has not ended, so the window is
never blank. ExplorerConversationConnectedScreen.tsx draws it above "There
are no saved messages yet." like a Virtual Guide message, without a time,
named "Welcome from the SolMind Virtual Guide" for screen readers
(data-opening-greeting). Its wording is OPENING_GREETING_LABEL and
OPENING_GREETING_TEXT in explorerConversationConnectedScreen.ts, a draft for
Paul's wording read. It is not a saved message, makes no request or AI call,
is not sent to the Virtual Guide and goes away once a message is saved; an
ended conversation never shows it. The three starting choices ("Show me around",
"I have a question", "Let's begin") keep their rule: they may appear in the
Virtual Guide's first reply in the first conversation each day until the tour
is taken. No instruction sentence changes. Presentation
only: no database, context, provider or command change.
