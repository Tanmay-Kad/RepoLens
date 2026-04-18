import type { OnboardingItem } from "../../types/graph";

interface OnboardingPanelProps {
  items: OnboardingItem[];
}

export default function OnboardingPanel({ items }: OnboardingPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Onboarding Path</h3>
        <span className="text-xs text-slate-400">{items.length} files</span>
      </div>
      <div className="max-h-[350px] space-y-2 overflow-auto pr-1">
        {items.slice(0, 15).map((item) => (
          <div key={item.file} className="rounded-xl border border-slate-700/60 bg-slate-950/70 p-2 text-xs">
            <div className="font-semibold text-slate-100">
            {item.order}. {item.file}
          </div>
            <div className="mt-1 text-slate-400">{item.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
