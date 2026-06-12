import {
  SOLMIND_EXPLORER_ONBOARDING_REQUIRED_STEP_COUNT,
  SOLMIND_EXPLORER_ONBOARDING_STEPS,
} from "@/lib/solmind/onboarding";

export function OnboardingProgressCard() {
  const currentStep = SOLMIND_EXPLORER_ONBOARDING_STEPS.find(
    (step) => step.key === "conversationHub",
  );

  return (
    <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-xl font-semibold">Onboarding progress</h2>

      <p className="mt-3 text-sm text-slate-300">
        {SOLMIND_EXPLORER_ONBOARDING_REQUIRED_STEP_COUNT} required MVP0 steps
      </p>

      {currentStep ? (
        <div className="mt-5 rounded-2xl border border-slate-700 p-4">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
            Current preview
          </p>

          <h3 className="mt-2 font-semibold">{currentStep.title}</h3>

          <p className="mt-2 text-sm text-slate-300">
            {currentStep.description}
          </p>
        </div>
      ) : null}
    </section>
  );
}