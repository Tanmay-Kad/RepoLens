import { useState } from "react";
import { analyzeRepo } from "../api/repos";
import { useRepoStore } from "../store/useRepoStore";

export default function URLInput() {
  const [url, setUrl] = useState("");
  const setJob = useRepoStore((state) => state.setJob);
  const status = useRepoStore((state) => state.status);

  async function submit(): Promise<void> {
    if (!url.trim()) {
      return;
    }
    const response = await analyzeRepo(url.trim());
    setJob(response.job_id);
  }

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-100">Analyze a GitHub repository</p>
          <p className="text-xs text-slate-400">Paste any public repo URL to generate architecture insights.</p>
        </div>
        <span className="rounded-full border border-indigo-300/20 bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-200">
          {status.toUpperCase()}
        </span>
      </div>
      <div className="flex gap-2">
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://github.com/owner/repo"
        className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-indigo-400/40 placeholder:text-slate-500 focus:ring"
      />
      <button
        onClick={submit}
        className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110"
      >
        Analyze
      </button>
    </div>
    </div>
  );
}
