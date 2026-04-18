import { useRepoStore } from "../store/useRepoStore";

export default function ProgressBar() {
  const { progress, stage, status } = useRepoStore();
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-200">{stage}</span>
        <span className="text-slate-400">
          {status.toUpperCase()} - {progress}%
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-800">
        <div
          className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
