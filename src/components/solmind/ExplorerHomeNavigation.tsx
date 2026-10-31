type ExplorerHomeNavigationProps = Readonly<{
  navigationDisabled?: boolean;
}>;

const destinationClassName =
  "block rounded-xl border border-slate-300 bg-white p-4 text-slate-900 " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700";

/** Presentation only. Each destination retains its own access and data boundary. */
export function ExplorerHomeNavigation({
  navigationDisabled = false,
}: ExplorerHomeNavigationProps) {
  return (
    <section aria-labelledby="explorer-workspace-heading" className="my-6">
      <h2 id="explorer-workspace-heading" className="mb-3 text-xl font-semibold">
        Your Explorer workspace
      </h2>
      <nav aria-label="Explorer workspace" aria-busy={navigationDisabled || undefined}>
        {navigationDisabled ? (
          <span aria-disabled="true" className={`${destinationClassName} mb-3 opacity-60`}>Conversation and Compass</span>
        ) : (
          <a href="/explorer/conversation" className={`${destinationClassName} mb-3 hover:border-teal-700`}>Conversation and Compass</a>
        )}
        {navigationDisabled ? (
          <span aria-disabled="true" className={`${destinationClassName} mb-3 opacity-60`}>Review ended conversations</span>
        ) : (
          <a href="/explorer/conversations" className={`${destinationClassName} mb-3 hover:border-teal-700`}>Review ended conversations</a>
        )}
        {navigationDisabled ? (
          <span aria-disabled="true" className={`${destinationClassName} opacity-60`}>
            Waypoint Suggestions
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- Full document navigation retires this authenticated view and requests fresh server access.
          <a href="/explorer/waypoints" className={`${destinationClassName} hover:border-teal-700`}>
            Waypoint Suggestions
          </a>
        )}
        <p className="mt-2 text-sm">
          Review suggestions from your Guide. Marking a suggestion as read stays
          private; acknowledging receipt tells your Guide.
        </p>
      </nav>

      <details className="mt-6 rounded-xl border border-slate-300 bg-slate-50 p-4 text-slate-900">
        <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">
          Design previews
        </summary>
        <p className="mt-3 text-sm">
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
                <a href="/explorer/compass-comparison" className={`${destinationClassName} hover:border-teal-700`}>
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
                <a href="/explorer" className={`${destinationClassName} hover:border-teal-700`}>
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
                <a href="/explorer/conversation-preview" className={`${destinationClassName} hover:border-teal-700`}>
                  Conversation screen design review
                </a>
              )}
              <p className="mt-1 text-sm">
                Design review only: sample content and working layout controls; conversation features are not connected.
              </p>
            </li>
          </ul>
        </nav>
      </details>
    </section>
  );
}
