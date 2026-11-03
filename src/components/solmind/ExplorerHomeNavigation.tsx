import { FOCUS_RING, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";

type ExplorerHomeNavigationProps = Readonly<{
  navigationDisabled?: boolean;
}>;

const destinationClassName = joinClasses(
  "block rounded-xl border border-amber-200/15 bg-white/[0.03] p-4 text-stone-100",
  FOCUS_RING,
);

/** Presentation only: the Explorer home's collapsed "Design previews". Each
 * preview retains its own boundaries. The Explorer workspace destinations are
 * in the Explorer workspace menu and the Overview cards (Paul's 2026-11-02
 * decisions), so the earlier "Your Explorer workspace" list is gone. While a
 * sign-out is pending each link shows in its non-link form. */
export function ExplorerHomeNavigation({
  navigationDisabled = false,
}: ExplorerHomeNavigationProps) {
  return (
    <details className="max-w-3xl rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 p-5 text-stone-100">
      <summary className={joinClasses("cursor-pointer rounded-md font-semibold text-stone-100", FOCUS_RING)}>
        Design previews
      </summary>
      <p className="mt-3 text-sm leading-6 text-stone-300">
        The older previews use a fixed local script. The conversation design
        review shows sample messages and cannot reply. No AI or human Guide is
        connected. They are not a therapist or crisis service. Refresh clears
        the preview, and changes are not saved or shared.
      </p>
      <nav aria-label="Explorer design previews" aria-busy={navigationDisabled || undefined}>
        <ul className="mt-3 space-y-3">
          <li>
            {navigationDisabled ? (
              <span aria-disabled="true" className={`${destinationClassName} opacity-60`}>
                Conversation and Compass preview
              </span>
            ) : (
              <a href="/explorer/compass-comparison" className={`${destinationClassName} hover:border-amber-300/60`}>
                Conversation and Compass preview
              </a>
            )}
          </li>
          <li>
            {navigationDisabled ? (
              <span aria-disabled="true" className={`${destinationClassName} opacity-60`}>
                Onboarding and sharing preview
              </span>
            ) : (
              <a href="/explorer" className={`${destinationClassName} hover:border-amber-300/60`}>
                Onboarding and sharing preview
              </a>
            )}
          </li>
          <li>
            {navigationDisabled ? (
              <span aria-disabled="true" className={`${destinationClassName} opacity-60`}>
                Conversation screen design review
              </span>
            ) : (
              <a href="/explorer/conversation-preview" className={`${destinationClassName} hover:border-amber-300/60`}>
                Conversation screen design review
              </a>
            )}
            <p className="mt-1 text-sm text-stone-300">
              Design review only: sample content and working layout controls; conversation features are not connected.
            </p>
          </li>
        </ul>
      </nav>
    </details>
  );
}
