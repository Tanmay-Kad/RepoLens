import React, { useState, useEffect } from 'react';
import { Compass, Clock, AlertTriangle, CheckCircle, ChevronRight, Loader2 } from 'lucide-react';
import { getOnboardingPath } from '../services/api';

export default function OnboardingPathPanel({ repoId, onNodeSelect, graphData }) {
  const [mode, setMode] = useState('Quick Start');
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Track completed steps locally
  const [completed, setCompleted] = useState(new Set());

  useEffect(() => {
    const fetchPath = async () => {
      setLoading(true);
      setError(null);
      setSteps([]);
      setCompleted(new Set());
      try {
        const data = await getOnboardingPath(repoId, mode);
        setSteps(data.steps || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (repoId) fetchPath();
  }, [repoId, mode]);

  const toggleComplete = (idx, e) => {
    e.stopPropagation();
    const newSet = new Set(completed);
    if (newSet.has(idx)) newSet.delete(idx);
    else newSet.add(idx);
    setCompleted(newSet);
  };

  const handleStepClick = (step) => {
    if (!onNodeSelect || !graphData) return;
    const normPath = step.file.replace(/\\/g, '/');
    const node = graphData?.nodes?.find(n => n.id === normPath || n.fullPath === normPath);
    if (node) {
      const deps = graphData.edges.filter(e => e.source === node.id).length;
      const dependents = graphData.edges.filter(e => e.target === node.id).length;
      onNodeSelect({ ...node, dependencies: deps, dependents: dependents });
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-medium">Algorithmic sequencing & AI evaluation running...</p>
        <p className="text-xs opacity-50 mt-2">Mapping entry points and logic hubs topology</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-4 rounded-xl text-sm">
          Failed to load path: {error}
        </div>
      </div>
    );
  }

  const totalTime = steps.reduce((sum, step) => sum + (step.timeMinutes || 0), 0);

  return (
    <div className="h-full w-full overflow-y-auto bg-[#020617] p-8 custom-scrollbar">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-end justify-between border-b border-white/5 pb-8 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              <Compass className="w-8 h-8 text-blue-500" />
              Onboarding Path
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-xl">
              An intelligent, structured architectural walkthrough mapped mathematically to help you learn the repository logic dynamically.
            </p>
            <div className="flex gap-4 items-center mt-6">
              <div className="bg-[#0f172a] rounded-lg p-1 flex border border-white/5">
                <button 
                  onClick={() => setMode('Quick Start')}
                  className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${mode === 'Quick Start' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >Quick Start</button>
                <button 
                  onClick={() => setMode('Deep Dive')}
                  className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${mode === 'Deep Dive' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >Deep Dive</button>
              </div>
              <div className="text-xs text-slate-500 font-mono">EST: {totalTime} MINS</div>
            </div>
          </div>

          {/* Progress Tracker */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-48 text-center shrink-0">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Progress</div>
            <div className="text-3xl font-mono text-white mb-2">{completed.size} <span className="text-slate-600 text-lg">/ {steps.length}</span></div>
            <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(completed.size / steps.length) * 100}%`}}></div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[23px] before:w-px before:bg-white/10">
          {steps.map((step, idx) => {
            const isCompleted = completed.has(idx);
            return (
              <div key={idx} className="relative flex gap-6 group cursor-pointer" onClick={() => handleStepClick(step)}>
                
                {/* Timeline Node Base */}
                <div className="shrink-0 mt-1 z-10" onClick={(e) => toggleComplete(idx, e)}>
                  {isCompleted ? (
                    <CheckCircle className="w-12 h-12 text-emerald-500 bg-[#020617] rounded-full drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all" />
                  ) : (
                    <div className="w-12 h-12 bg-[#0f172a] rounded-full border-2 border-slate-700 flex items-center justify-center group-hover:border-blue-500 transition-colors">
                      <span className="text-slate-400 font-bold group-hover:text-blue-400">{idx + 1}</span>
                    </div>
                  )}
                </div>

                {/* Content Card */}
                <div className={`flex-1 bg-white/[0.02] border rounded-2xl p-5 hover:bg-white/[0.04] transition-all transform group-hover:-translate-y-1 ${isCompleted ? 'border-emerald-500/20 opacity-60 hover:opacity-100' : 'border-white/10 shadow-lg'}`}>
                  
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">{step.category || 'Module Segment'}</div>
                      <h3 className="text-lg font-mono text-blue-300 flex items-center gap-2">
                        {step.file} 
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className={`text-[10px] px-2 py-1 rounded-full border ${step.importance === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/20' : step.importance === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                         {step.importance} Priority
                       </span>
                       <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-black/40 px-2 py-1 rounded-full">
                         <Clock className="w-3 h-3" /> {step.timeMinutes}m
                       </span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed">
                    {step.reason}
                  </p>
                  
                  <div className="mt-4 flex items-center gap-2 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-4 h-4" /> Tap to lock graph and open Node Details
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
