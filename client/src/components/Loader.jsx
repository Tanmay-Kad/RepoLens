const STEPS = ["Fetching files...", "Parsing AST...", "Building graph...", "Ready"];

export default function Loader({ loadingStep }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[420px] rounded-xl border border-border bg-surface p-6 text-text shadow-2xl">
        <h2 className="text-xl font-semibold">Analyzing repository</h2>
        <p className="mt-2 text-sm text-muted">Estimated time: 20-60 seconds depending on repo size.</p>
        <div className="mt-4 space-y-2">
          {STEPS.map((step) => (
            <div
              key={step}
              className={`rounded-md px-3 py-2 text-sm transition ${
                step === loadingStep ? "bg-primary/20 text-primary" : "bg-[#141414] text-muted"
              }`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
