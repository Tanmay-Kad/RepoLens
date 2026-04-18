import { useState } from "react";
import toast from "react-hot-toast";
import { searchNodes } from "../api";
import useGraphStore from "../store/useGraphStore";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const { repoId, setHighlightedNodes, highlightedNodes } = useGraphStore();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || !repoId) return;
    try {
      const data = await searchNodes(repoId, query.trim());
      setHighlightedNodes(data.matchedNodes || []);
      toast.success(`${(data.matchedNodes || []).length} files match`);
    } catch (_error) {
      toast.error("Search failed");
    }
  };

  return (
    <div className="border-b border-border p-4">
      <form onSubmit={onSubmit} className="space-y-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything... e.g. where is auth handled?"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
        <div className="flex gap-2">
          <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:opacity-90">
            Search
          </button>
          {highlightedNodes.length > 0 && (
            <button
              type="button"
              onClick={() => setHighlightedNodes([])}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted transition hover:text-text"
            >
              Clear
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
