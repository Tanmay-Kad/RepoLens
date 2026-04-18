import React, { useMemo } from 'react';
import { ShieldAlert, AlertCircle, RefreshCw, Zap, Target, Activity, LayoutGrid, FileWarning, HelpCircle } from 'lucide-react';

export default function SecurityAudit({ graphData, healthScore, onSelect }) {
  
  const metrics = useMemo(() => {
    if (!graphData) return null;
    
    const nodeStats = graphData.nodes.map(node => {
      const dependencies = graphData.edges.filter(e => e.source === node.id).length;
      const dependents = graphData.edges.filter(e => e.target === node.id).length;
      const impactScore = Math.min(100, (dependents * 7) + (dependencies * 3));
      
      return { id: node.id, dependencies, dependents, impactScore };
    });

    const highImpact = [...nodeStats]
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 5);

    const godFiles = [...nodeStats]
      .sort((a, b) => b.dependents - a.dependents)
      .slice(0, 5);

    const orphanModules = nodeStats.filter(n => n.dependents === 0 && n.dependencies === 0);

    return { highImpact, godFiles, orphanModules, nodeStats };
  }, [graphData]);

  if (!graphData || !metrics) return null;

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            Architectural Security Audit
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Real-time assessment of repository health based on coupling patterns, circularity, and maintainability risks. High scores indicate stable, decoupled architectures.
          </p>
        </div>
      </div>

      {/* Grid of Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1e293b]/40 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
             <Activity className="w-20 h-20 text-blue-400" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Repository Health</p>
          <div className="text-4xl font-bold text-blue-400 mb-1">{healthScore}%</div>
          <div className="w-24 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
             <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${healthScore}%` }} />
          </div>
        </div>

        <div className="bg-[#1e293b]/40 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
             <RefreshCw className="w-20 h-20 text-red-400" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Circular Cycles</p>
          <div className={`text-4xl font-bold mb-1 ${graphData.circular?.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {graphData.circular?.length || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-2 italic">Impacts maintainability & build speed</p>
        </div>

        <div className="bg-[#1e293b]/40 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
             <Target className="w-20 h-20 text-yellow-400" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Orphan Modules</p>
          <div className="text-4xl font-bold text-yellow-400 mb-1">{metrics.orphanModules.length}</div>
          <p className="text-[10px] text-slate-500 mt-2 italic">Potential dead code detected</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Risk Assessment: God Files */}
        <div className="bg-[#0f172a]/40 border border-white/5 rounded-2xl flex flex-col h-fit">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Critical Modules (High Risk)
            </h3>
            <HelpCircle className="w-3.5 h-3.5 text-slate-500 cursor-help" />
          </div>
          <div className="p-4 flex flex-col gap-3">
            {metrics.highImpact.map(file => (
              <div 
                key={file.id} 
                onClick={() => onSelect(file)}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-300 truncate group-hover:text-white transition-colors capitalize">{file.id.split('/').pop()}</div>
                  <div className="text-[9px] text-slate-500 truncate">{file.id}</div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <div className={`text-[10px] font-bold ${file.impactScore >= 70 ? 'text-red-400' : 'text-yellow-400'}`}>Impact: {file.impactScore}%</div>
                  <div className="text-[9px] text-slate-600">Dependents: {file.dependents}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Circular Dependency Chains */}
        <div className="bg-[#0f172a]/40 border border-white/5 rounded-2xl flex flex-col h-fit">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-red-500/5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-red-400" />
              Circular Dependency Chains
            </h3>
            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">Action Required</span>
          </div>
          <div className="p-4 flex flex-col gap-4">
            {graphData.circular?.length > 0 ? (
              graphData.circular.map((chain, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex flex-col gap-2">
                   <div className="text-[10px] font-bold text-red-300 uppercase tracking-widest">Cycle #{idx + 1}</div>
                   <div className="flex flex-col gap-1">
                      {chain.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-3">
                           <div className="w-1.5 h-1.5 rounded-full bg-red-500/40 shrink-0" />
                           <span className="text-[10px] text-slate-400 font-mono truncate">{step}</span>
                        </div>
                      ))}
                   </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-600">
                 <ShieldAlert className="w-10 h-10 mb-3 opacity-10" />
                 <p className="text-xs font-medium text-emerald-400/80 italic">No circular dependencies detected!</p>
                 <p className="text-[10px] mt-1">Repository demonstrates clean vertical coupling.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
