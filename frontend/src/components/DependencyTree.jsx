import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, FolderTree, ToggleLeft, ToggleRight, Info } from 'lucide-react';

const TreeItem = ({ nodeId, graphData, expandedNodes, toggleExpand, onSelect, depth = 0 }) => {
  const isExpanded = expandedNodes.has(nodeId);
  const children = useMemo(() => {
    return graphData.edges
      .filter(edge => edge.source === nodeId)
      .map(edge => edge.target);
  }, [graphData, nodeId]);

  const nodeName = nodeId.split('/').pop();
  const hasChildren = children.length > 0;

  return (
    <div className="flex flex-col select-none">
      <div 
        className={`flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer transition-all ${depth === 0 ? 'hover:bg-blue-500/10' : 'hover:bg-white/5'}`}
        style={{ marginLeft: `${depth * 20}px` }}
        onClick={() => {
          onSelect(nodeId);
          if (hasChildren) toggleExpand(nodeId);
        }}
      >
        <div className="w-4 h-4 flex items-center justify-center">
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
          )}
        </div>
        {hasChildren ? (
          <FolderTree className={`w-3.5 h-3.5 ${depth === 0 ? 'text-blue-400' : 'text-slate-500'}`} />
        ) : (
          <FileCode className="w-3.5 h-3.5 text-slate-500" />
        )}
        <span className={`text-[11px] font-medium truncate ${depth === 0 ? 'text-blue-300 font-bold' : 'text-slate-300'}`}>
          {nodeName}
        </span>
        {hasChildren && !isExpanded && (
          <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-slate-500 font-mono">
            {children.length}
          </span>
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {children.map(childId => (
            <TreeItem 
              key={`${nodeId}-${childId}`}
              nodeId={childId}
              graphData={graphData}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function DependencyTree({ graphData, onSelect }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  const toggleExpand = (nodeId) => {
    const next = new Set(expandedNodes);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    setExpandedNodes(next);
  };

  const isNoise = (id) => {
    const lowerId = id.toLowerCase();
    return lowerId.includes('test') || 
           lowerId.includes('spec') || 
           lowerId.includes('.css') || 
           lowerId.includes('.svg') ||
           lowerId.includes('readme');
  };

  const entryPoints = useMemo(() => {
    if (!graphData?.nodes) return [];
    
    // An entry point is a node that is not depended on by anyone else (in-degree = 0)
    // Or, for practical purposes, nodes that are likely the main app entry
    return graphData.nodes
      .filter(node => {
        const inDegree = graphData.edges.filter(e => e.target === node.id).length;
        if (!showAll && isNoise(node.id)) return false;
        return inDegree === 0;
      })
      .map(node => node.id);
  }, [graphData, showAll]);

  if (!graphData) return null;

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Dependency Tree</h2>
          <p className="text-xs text-slate-500 italic">Hierarchical view of resource coupling starting from root entry points.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
          >
            <span className={`text-[10px] font-bold uppercase transition-colors ${showAll ? 'text-blue-400' : 'text-slate-500'}`}>
              Show All Files
            </span>
            {showAll ? <ToggleRight className="w-5 h-5 text-blue-500" /> : <ToggleLeft className="w-5 h-5 text-slate-700" />}
          </button>
        </div>
      </div>

      <div className="flex-1 border border-white/5 rounded-2xl bg-[#0f172a]/40 shadow-2xl flex flex-col min-h-0">
        <div className="p-4 bg-white/5 border-b border-white/10 flex items-center gap-3">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-[10px] text-slate-400 leading-tight">
            Displaying <span className="text-blue-200 font-bold">{entryPoints.length}</span> root entry points. {showAll ? 'Full repository view enabled.' : 'Test files and noise filtered from root.'}
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="flex flex-col gap-1">
            {entryPoints.map(id => (
              <TreeItem 
                key={id} 
                nodeId={id} 
                graphData={graphData} 
                expandedNodes={expandedNodes} 
                toggleExpand={toggleExpand}
                onSelect={onSelect}
              />
            ))}
            {entryPoints.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-600 gap-2">
                <Folder className="w-8 h-8 opacity-20" />
                <p className="text-xs italic">No entry points found with current filters.</p>
                <button 
                  onClick={() => setShowAll(true)}
                  className="text-xs text-blue-500 hover:underline mt-2"
                >
                  Switch to Full View
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
