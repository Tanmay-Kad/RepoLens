import React from 'react';
import { ShieldAlert, RefreshCw, X, AlertTriangle } from 'lucide-react';

export default function BlastRadiusPanel({ config, results, onConfigChange, onReset }) {
  if (!config.active) return null;

  return (
    <div className="absolute right-6 top-24 w-80 bg-[#1e293b]/90 backdrop-blur-md rounded-2xl border border-red-500/30 overflow-hidden shadow-2xl animate-in slide-in-from-right-4 z-50">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-red-500/10">
        <div className="flex items-center gap-2 text-red-400 font-bold">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
          Blast Radius Active
        </div>
        <button onClick={onReset} className="text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
            <div className="text-2xl font-bold text-orange-400">{results.totalImpacted || 0}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Impacted Files</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
            <div className="text-2xl font-bold text-yellow-400">{results.depth || 0}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Propagation Depth</div>
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-widest">Risk Score</span>
            <span className="text-sm font-bold text-red-400">{results.riskScore || 0}/100</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 bg-red-500`}
              style={{ width: `${Math.min(100, Math.max(0, results.riskScore || 0))}%` }}
            />
          </div>
        </div>

        {results.totalImpacted > 15 && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-300 text-xs items-start">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>High blast radius! Modifying this file introduces significant regression risk.</p>
          </div>
        )}

        {results.impactedFiles && results.impactedFiles.length > 0 && (
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-widest mb-2 block">Affected Files ({results.totalImpacted})</label>
            <div className="max-h-32 overflow-y-auto custom-scrollbar bg-black/20 rounded-lg p-2 border border-white/5 space-y-1.5">
              {results.impactedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="truncate pr-2 text-gray-300 w-4/5" title={file.id}>{file.id.split('/').pop()}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${file.level === 1 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'}`}>
                    L{file.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-400 uppercase tracking-widest mb-3 block">Change Severity</label>
          <div className="flex gap-2 bg-black/20 p-1 rounded-lg">
            {['Low', 'Medium', 'High'].map(level => (
              <button
                key={level}
                onClick={() => onConfigChange({ ...config, severity: level })}
                className={`flex-1 text-xs py-1.5 rounded-md transition-all ${config.severity === level ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/30' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors mt-2"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Simulation
        </button>
      </div>
    </div>
  );
}
