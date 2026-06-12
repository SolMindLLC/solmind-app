export function ExplorerResponseComposer() {
  return (
    <section className="mt-4 rounded-2xl border border-slate-700 p-4">
      <label
        htmlFor="explorer-response"
        className="block text-sm uppercase tracking-[0.2em] text-cyan-300"
      >
        What would you like to share?
      </label>

      <textarea
        id="explorer-response"
        className="mt-3 min-h-32 w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-50 placeholder:text-slate-500"
        placeholder="Type a reflection, question, check-in, or anything you want to explore..."
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <button className="rounded-full bg-cyan-300 px-5 py-3 font-medium text-slate-950">
          Send reflection
        </button>

        <button className="rounded-full border border-slate-600 px-5 py-3 font-medium text-slate-50">
          Save for later
        </button>
      </div>

      <p className="mt-4 text-sm text-slate-400">
        Preview only. Messages are not saved yet.
      </p>
    </section>
  );
}