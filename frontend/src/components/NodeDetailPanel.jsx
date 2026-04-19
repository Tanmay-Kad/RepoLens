import React from 'react';
import { X, AlertTriangle, Sparkles, Loader2, Layers } from 'lucide-react';

export default function NodeDetailPanel({ 
  selectedNode, 
  onClose, 
  isCircular, 
  impactScore, 
  impactLabel, 
  impactColor, 
  impactBarColor, 
  aiSummary, 
  aiLoading, 
  aiError,
  onSimulate
}) {
  if (!selectedNode) return null;

  return (
    <div className="h-full bg-[#1e293b]/60 flex flex-col border-l border-white/10 animate-in slide-in-from-right-4 duration-300">
      
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white break-words leading-tight">{selectedNode.label}</h3>
          <p className="text-[11px] text-gray-500 mt-1 break-all">{selectedNode.fullPath || selectedNode.filePath}</p>
          {selectedNode.nodeType === 'config' && (
            <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
              ⬡ Configuration File · {selectedNode.configType}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-gray-500 hover:text-white transition-colors mt-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-5 overflow-y-auto custom-scrollbar">

        {/* Dep / Dependent counters */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 text-center">
            <div className="text-2xl font-bold text-blue-400">{selectedNode.dependencies}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Dependencies</div>
          </div>
          <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 text-center">
            <div className="text-2xl font-bold text-purple-400">{selectedNode.dependents}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Dependents</div>
          </div>
        </div>

        {/* Impact Score */}
        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-widest">Impact Score</span>
            <span className={`text-sm font-bold ${impactColor}`}>{impactLabel} ({impactScore}/100)</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${impactBarColor}`}
              style={{ width: `${impactScore}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-2">Weighted by dependents × 7 + dependencies × 3. High impact = risky to change.</p>
        </div>

        {selectedNode.nodeType !== 'config' && (
          <button 
            onClick={() => {
              console.log('[DEBUG] NodeDetailPanel Simulate Button Clicked!');
              onSimulate();
            }}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 hover:from-red-500/30 hover:to-orange-500/30 border border-red-500/30 text-red-400 font-bold text-sm py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
          >
            <AlertTriangle className="w-4 h-4" />
            Simulate Blast Radius
          </button>
        )}

        {/* Circular dependency warning */}
        {isCircular && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex flex-col gap-2">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Circular Dependency Detected
            </div>
            <p className="text-xs opacity-80">This module is part of a circular chain. Changes here may cause unexpected runtime errors or import failures.</p>
          </div>
        )}

        {/* AI Summary Panel */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-violet-300">AI Summary</span>
            {aiSummary && !aiLoading && (
              <span className="ml-auto text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/30">Groq</span>
            )}
          </div>

          {aiLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating AI summary...
            </div>
          )}

          {aiError && !aiLoading && (
            <p className="text-xs text-red-400 italic">{aiError}</p>
          )}

          {aiSummary && !aiLoading && !aiError && (
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <span className="text-violet-400 font-semibold uppercase tracking-widest text-[10px]">Purpose</span>
                <p className="text-gray-300 mt-1 leading-relaxed">{aiSummary.purpose}</p>
              </div>
              <div>
                <span className="text-blue-400 font-semibold uppercase tracking-widest text-[10px]">Why It Matters</span>
                <p className="text-gray-300 mt-1 leading-relaxed">{aiSummary.importance}</p>
              </div>
              <div>
                <span className="text-yellow-400 font-semibold uppercase tracking-widest text-[10px]">Risk If Changed</span>
                <p className="text-gray-300 mt-1 leading-relaxed">{aiSummary.riskIfChanged}</p>
              </div>
            </div>
          )}

          {!aiSummary && !aiLoading && !aiError && (
            <p className="text-xs text-gray-500 italic leading-relaxed">
              AI-powered analysis of <span className="text-gray-400 not-italic font-medium">{selectedNode.label}</span> will appear here — purpose, coupling risks, and refactoring suggestions powered by Groq.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
