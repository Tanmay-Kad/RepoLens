import React from 'react';
import { File, Code, Database, ChevronRight, XCircle, Sparkles } from 'lucide-react';

export default function SearchResultsPanel({ results, loading, query, onSelectResult, onClose }) {
  if (!query) return null;

  return (
    <div className="absolute top-12 left-0 w-[500px] max-h-[400px] bg-[#1e293b]/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/10 z-50 flex flex-col overflow-hidden animate-in slide-in-from-top-2">
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center shrink-0 bg-black/20">
        <span className="text-xs font-bold text-slate-300">
          {loading ? 'Searching...' : `${results.length} matches found`}
        </span>
        {query && (
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {loading ? (
          <div className="h-20 flex items-center justify-center text-slate-500 text-xs">
            Scanning architecture...
          </div>
        ) : results.length === 0 ? (
          <div className="h-20 flex flex-col items-center justify-center text-slate-500 text-xs gap-1">
            <Database className="w-6 h-6 opacity-40" />
            <p>No matches found in {query}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {results.map((res, idx) => (
              <div key={idx} className="bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden border border-white/5 transition-colors">
                {/* File Header */}
                <div 
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer group"
                  onClick={() => onSelectResult(res.file)}
                >
                  <File className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-300 truncate font-mono">
                    {res.file}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 ml-auto group-hover:text-white transition-colors" />
                </div>
                
                {/* AI Snippets Area */}
                {res.aiMatch && res.reason && (
                  <div className="bg-purple-900/20 border-t border-purple-500/20 p-3 pt-2">
                    <div className="flex items-start gap-2 text-xs cursor-pointer hover:bg-purple-900/40 rounded p-1" onClick={() => onSelectResult(res.file)}>
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span className="text-purple-200 leading-relaxed italic">{res.reason}</span>
                    </div>
                  </div>
                )}

                {/* Normal Snippets Area */}
                {!res.aiMatch && res.matches && res.matches.length > 0 && (
                  <div className="bg-black/30 border-t border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                    {res.matches.slice(0, 5).map((match, i) => (
                      <div 
                        key={i} 
                        className="px-3 py-1.5 flex gap-3 text-xs hover:bg-black/40 cursor-pointer"
                        onClick={() => onSelectResult(res.file)}
                      >
                         <span className="text-slate-600 font-mono text-[10px] select-none w-4 text-right shrink-0">
                           {match.line}
                         </span>
                         <span className="text-slate-400 font-mono text-[10px] truncate">
                           {match.snippet}
                         </span>
                      </div>
                    ))}
                    {res.matches.length > 5 && (
                      <div className="px-3 py-1 text-[10px] text-slate-500 italic text-center border-t border-white/5">
                        + {res.matches.length - 5} more matches in this file
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
