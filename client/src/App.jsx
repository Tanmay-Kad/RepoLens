import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { analyzeRepo } from "./api";
import useGraphStore from "./store/useGraphStore";
import GraphCanvas from "./components/GraphCanvas";
import Sidebar from "./components/Sidebar";
import Loader from "./components/Loader";

function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const { graph, setGraph, isLoading, loadingStep, setLoading, setError } = useGraphStore();

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    try {
      setLoading(true, "Fetching files...");
      const stepTimer1 = setTimeout(() => setLoading(true, "Parsing AST..."), 350);
      const stepTimer2 = setTimeout(() => setLoading(true, "Building graph..."), 900);
      const data = await analyzeRepo(repoUrl.trim());
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setLoading(true, "Ready");
      setGraph(data.graph, data.repoId);
      setTimeout(() => setLoading(false, ""), 250);
      toast.success("Repository analyzed successfully");
    } catch (error) {
      const msg = error?.response?.data?.message || "Analysis failed";
      setError(msg);
      toast.error(msg);
      setLoading(false, "");
    }
  };

  return (
    <div className="h-screen bg-bg text-text">
      <Toaster position="top-right" />
      <header className="border-b border-border bg-surface px-6 py-4">
        <h1 className="text-2xl font-bold">RepoNav</h1>
        <p className="text-sm text-muted">Repository Architecture Navigator</p>
        <form onSubmit={handleAnalyze} className="mt-4 flex gap-2">
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="Paste GitHub repo URL..."
            className="w-full max-w-2xl rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-primary"
          />
          <button className="rounded-md bg-primary px-4 py-2 font-medium text-white transition hover:opacity-90">Analyze</button>
        </form>
      </header>
      <main className="flex h-[calc(100vh-130px)]">
        <section className="flex-1">{graph ? <GraphCanvas /> : <div className="p-6 text-muted">Analyze a repository to generate graph.</div>}</section>
        {graph && <Sidebar />}
      </main>
      {isLoading && <Loader loadingStep={loadingStep} />}
    </div>
  );
}

export default App;
