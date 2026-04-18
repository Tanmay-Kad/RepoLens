import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CytoscapeComponent from 'react-cytoscapejs';
import { X, ChevronRight, Search, FileCode, ArrowLeft, Layers, CornerDownRight, Zap } from 'lucide-react';

export default function DependencyExplorerModal({ isOpen, onClose, initialNodeId, graphData }) {
  const [currentNodeId, setCurrentNodeId] = useState(initialNodeId);
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const cyRef = useRef(null);

  useEffect(() => {
    if (isOpen && initialNodeId) {
      setCurrentNodeId(initialNodeId);
      setHistory([]);
    }
  }, [isOpen, initialNodeId]);

  const currentNode = useMemo(() => {
    return graphData?.nodes.find(n => n.id === currentNodeId);
  }, [graphData, currentNodeId]);

  const relationships = useMemo(() => {
    if (!graphData || !currentNodeId) return { dependencies: [], dependents: [] };

    const dependencies = graphData.edges
      .filter(e => e.source === currentNodeId)
      .map(e => e.target)
      .filter(id => id.toLowerCase().includes(searchQuery.toLowerCase()));

    const dependents = graphData.edges
      .filter(e => e.target === currentNodeId)
      .map(e => e.source)
      .filter(id => id.toLowerCase().includes(searchQuery.toLowerCase()));

    return { dependencies, dependents };
  }, [graphData, currentNodeId, searchQuery]);

  const miniGraphElements = useMemo(() => {
    if (!graphData || !currentNodeId) return [];

    const deps = graphData.edges.filter(e => e.source === currentNodeId);
    const caps = graphData.edges.filter(e => e.target === currentNodeId);
    
    const neighborIds = new Set([
      currentNodeId,
      ...deps.map(e => e.target),
      ...caps.map(e => e.source)
    ]);

    const nodes = graphData.nodes
      .filter(n => neighborIds.has(n.id))
      .map(n => ({
        data: { 
          id: n.id, 
          label: n.id.split('/').pop(),
          isCurrent: n.id === currentNodeId,
          color: n.id === currentNodeId ? '#3b82f6' : '#94a3b8'
        }
      }));

    const edges = graphData.edges
      .filter(e => neighborIds.has(e.source) && neighborIds.has(e.target))
      .map(e => ({
        data: { source: e.source, target: e.target }
      }));

    return [...nodes, ...edges];
  }, [graphData, currentNodeId]);

  const handleNavigate = (nodeId) => {
    if (nodeId === currentNodeId) return;
    setHistory([...history, currentNodeId]);
    setCurrentNodeId(nodeId);
    setSearchQuery('');
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const prevId = newHistory.pop();
    setHistory(newHistory);
    setCurrentNodeId(prevId);
  };

  if (!isOpen || !currentNode) return null;

  const miniGraphStyle = [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'label': 'data(label)',
        'color': '#fff',
        'font-size': '8px',
        'width': (node) => node.data('isCurrent') ? 24 : 16,
        'height': (node) => node.data('isCurrent') ? 24 : 16,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 4
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 1,
        'line-color': '#475569',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#475569',
        'curve-style': 'bezier',
        'opacity': 0.4
      }
    }
  ];

  const layout = { name: 'breadthfirst', directed: true, padding: 20 };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-[#020617]/80 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-6xl h-[85vh] shadow-2xl overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header & Breadcrumbs */}
          <header className="shrink-0 p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-4 overflow-hidden">
              <button 
                onClick={handleBack}
                disabled={history.length === 0}
                className={`p-2 rounded-xl transition-all ${history.length > 0 ? 'bg-white/5 hover:bg-white/10 text-white' : 'text-slate-700'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <nav className="flex items-center gap-2 text-xs font-medium overflow-hidden">
                <div className="flex items-center gap-2 shrink-0 text-slate-500">
                  <Layers className="w-4 h-4" />
                  <span>History:</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {history.slice(-3).map((hid, idx) => (
                    <React.Fragment key={hid}>
                      <button 
                        onClick={() => {
                          const newHistory = history.slice(0, history.indexOf(hid));
                          setHistory(newHistory);
                          setCurrentNodeId(hid);
                        }}
                        className="px-2 py-1 bg-white/5 rounded-md text-slate-400 hover:text-white truncate max-w-[120px]"
                      >
                        {hid.split('/').pop()}
                      </button>
                      <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />
                    </React.Fragment>
                  ))}
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-md font-bold truncate max-w-[200px] border border-blue-500/30">
                    {currentNodeId.split('/').pop()}
                  </span>
                </div>
              </nav>
            </div>
            
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </header>

          {/* Main Body */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left: Mini Visualization */}
            <div className="w-2/5 border-r border-white/5 bg-slate-950/50 flex flex-col">
              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Local Neighborhood</h3>
              </div>
              <div className="flex-1 relative">
                <CytoscapeComponent 
                  elements={miniGraphElements}
                  style={{ width: '100%', height: '100%' }}
                  stylesheet={miniGraphStyle}
                  layout={layout}
                  cy={cy => {
                    cyRef.current = cy;
                    cy.on('tap', 'node', (e) => handleNavigate(e.target.id()));
                  }}
                />
              </div>
              <div className="p-6 space-y-4 bg-slate-900">
                <div>
                   <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-600 mb-2">Selected File</h4>
                   <h2 className="text-xl font-bold text-white mb-1 truncate">{currentNodeId.split('/').pop()}</h2>
                   <p className="text-[10px] font-mono text-slate-500 break-all">{currentNodeId}</p>
                </div>
              </div>
            </div>

            {/* Right: Lists */}
            <div className="flex-1 flex flex-col bg-slate-900">
              <div className="p-6 border-b border-white/5 flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="text"
                    placeholder="Filter relationships..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-slate-200 placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Dependencies Column */}
                <div className="flex-1 flex flex-col border-r border-white/5">
                  <div className="p-4 bg-slate-950/20 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80">Depends On ({relationships.dependencies.length})</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                    {relationships.dependencies.map(id => (
                      <NodeCard key={id} id={id} type="dep" onClick={() => handleNavigate(id)} />
                    ))}
                    {relationships.dependencies.length === 0 && (
                      <EmptyState text="No outbound dependencies" />
                    )}
                  </div>
                </div>

                {/* Dependents Column */}
                <div className="flex-1 flex flex-col">
                  <div className="p-4 bg-slate-950/20 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400/80">Imported By ({relationships.dependents.length})</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                    {relationships.dependents.map(id => (
                      <NodeCard key={id} id={id} type="parent" onClick={() => handleNavigate(id)} />
                    ))}
                    {relationships.dependents.length === 0 && (
                      <EmptyState text="No incoming dependents" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const NodeCard = ({ id, onClick, type }) => (
  <motion.div 
    whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.05)" }}
    onClick={onClick}
    className="p-3 rounded-xl border border-white/5 bg-slate-900/50 cursor-pointer flex items-center justify-between group"
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className={`p-2 rounded-lg ${type === 'dep' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
        <FileCode className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-200 truncate">{id.split('/').pop()}</div>
        <div className="text-[9px] text-slate-500 truncate">{id}</div>
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-white transition-colors shrink-0" />
  </motion.div>
);

const EmptyState = ({ text }) => (
  <div className="flex flex-col items-center justify-center py-12 text-slate-600 grayscale opacity-40">
    <FileCode className="w-8 h-8 mb-3" />
    <span className="text-[10px] italic">{text}</span>
  </div>
);
