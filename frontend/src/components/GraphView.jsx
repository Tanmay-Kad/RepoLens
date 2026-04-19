import React, { useState } from 'react';
import GraphView2D from './GraphView2D';
import GraphView3D from './GraphView3D';
import { Box, Layers, Settings2 } from 'lucide-react';

export default function GraphView(props) {
  const [is3DMode, setIs3DMode]     = useState(false);
  const [showConfig, setShowConfig] = useState(true); // ON by default

  return (
    <div className="w-full h-full relative">

      {/* ── Top controls bar ─────────────────────────────────────────────────── */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-2">

        {/* 2D / 3D toggle */}
        <div className="flex bg-[#0f172a]/80 backdrop-blur-md rounded-lg p-1 border border-white/10 shadow-2xl">
          <button
            onClick={() => setIs3DMode(false)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              !is3DMode ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            2D Map
          </button>
          <button
            onClick={() => setIs3DMode(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              is3DMode ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            3D Force
          </button>
        </div>

        {/* Show Config Files toggle */}
        <button
          onClick={() => setShowConfig(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-2xl backdrop-blur-md ${
            showConfig
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-[#0f172a]/80 text-slate-400 border-white/10 hover:text-white'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          {showConfig ? 'Config Files: ON' : 'Config Files: OFF'}
        </button>
      </div>

      {/* ── Graph views ──────────────────────────────────────────────────────── */}
      {is3DMode ? (
        <GraphView3D {...props} showConfig={showConfig} />
      ) : (
        <GraphView2D {...props} showConfig={showConfig} />
      )}
    </div>
  );
}
