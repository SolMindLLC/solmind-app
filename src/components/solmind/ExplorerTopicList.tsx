import { SOLMIND_EXPLORER_TOPICS } from "@/lib/solmind/topics";

export function ExplorerTopicList() {
  return (
    <div className="mt-5 space-y-3">
      {SOLMIND_EXPLORER_TOPICS.map((topic) => (
        <button
          key={topic}
          className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-left"
        >
          {topic}
        </button>
      ))}
    </div>
  );
}