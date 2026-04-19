import React, { useState } from 'react';
import GraphView2D from './GraphView2D';
import GraphView3D from './GraphView3D';
import { Box, Layers } from 'lucide-react';

export default function GraphView(props) {
  const [is3DMode, setIs3DMode] = useState(false);

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-6 left-6 z-20 flex bg-[#0f172a]/80 backdrop-blur-md rounded-lg p-1 border border-white/10 shadow-2xl">
        <button
          onClick={() => setIs3DMode(false)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!is3DMode ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}
        >
          <Layers className="w-3.5 h-3.5" />
          2D Map
        </button>
        <button
          onClick={() => setIs3DMode(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${is3DMode ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-white'}`}
        >
          <Box className="w-3.5 h-3.5" />
          3D Force
        </button>
      </div>

      {is3DMode ? (
        <GraphView3D {...props} />
      ) : (
        <GraphView2D {...props} />
      )}
    </div>
  );
}
