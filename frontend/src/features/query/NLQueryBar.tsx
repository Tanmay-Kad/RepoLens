import { useState } from "react";
import { useNLQuery } from "./useNLQuery";

export default function NLQueryBar() {
  const [query, setQuery] = useState("");
  const { runQuery } = useNLQuery();

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Natural Language Search
      </p>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask: where is auth handled?"
          className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring focus:ring-cyan-400/40"
        />
        <button
          onClick={() => runQuery(query)}
          className="rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
        >
          Find
        </button>
      </div>
    </div>
  );
}
