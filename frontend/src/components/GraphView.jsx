import React, { useState, useEffect, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import { getGraphData, getAiSummary, searchFilesAi } from '../services/api';
import { Loader2, Search, AlertTriangle, Sparkles, X, Flame, Activity } from 'lucide-react';

export default function GraphView({ repoId }) {
  const [elements, setElements] = useState([]);
  const [circularDeps, setCircularDeps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [dangerousFiles, setDangerousFiles] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  
  const cyRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getGraphData(repoId);
        
        let cyElements = [];
        
        const determineTypeAndColor = (id) => {
          const lowerId = id.toLowerCase();
          if (lowerId.includes('test') || lowerId.includes('spec')) return '#4ade80'; // green
          if (lowerId.includes('util') || lowerId.includes('helper')) return '#9ca3af'; // gray
          if (lowerId.includes('controller') || lowerId.includes('service') || lowerId.includes('model') || lowerId.includes('route')) return '#60a5fa'; // blue
          if (lowerId === 'index.js' || lowerId === 'main.js' || lowerId === 'server.js' || lowerId === 'app.js') return '#fbbf24'; // gold
          return '#94a3b8'; // default
        };

        if (data.nodes) {
          data.nodes.forEach(n => {
            cyElements.push({
              data: {
                id: n.id,
                label: n.id.split('/').pop(),
                fullPath: n.id,
                color: determineTypeAndColor(n.id)
              }
            });
          });
        }
        
        if (data.edges) {
          data.edges.forEach(e => {
            cyElements.push({
              data: {
                source: e.source,
                target: e.target
              }
            });
          });
        }
        
        setElements(cyElements);
        if (data.circular) {
          setCircularDeps(data.circular);
        }

        // Calculate dangerous files (most incoming dependents)
        const nodeDependentsCount = {};
        if (data.edges) {
          data.edges.forEach(e => {
            nodeDependentsCount[e.target] = (nodeDependentsCount[e.target] || 0) + 1;
          });
        }
        const topDangerous = Object.entries(nodeDependentsCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, count]) => ({ id, label: id.split('/').pop(), count }));
        setDangerousFiles(topDangerous);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [repoId]);

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (!aiSearchMode && cyRef.current) {
      const q = query.toLowerCase();
      const cy = cyRef.current;
      cy.batch(() => {
        cy.nodes().forEach(node => {
          node.style('border-width', 0); // reset AI search border
          if (!q || node.data('fullPath').toLowerCase().includes(q)) {
            node.style('opacity', 1);
            node.style('overlay-opacity', 0);
          } else {
            node.style('opacity', 0.2);
          }
        });
      });
    }
  };

  const executeAiSearch = async () => {
    if (!searchQuery.trim() || !aiSearchMode) return;
    setAiSearchLoading(true);
    try {
      const nodesOnly = elements.filter(e => e.data && e.data.id).map(e => ({ id: e.data.id }));
      const res = await searchFilesAi({ query: searchQuery, nodes: nodesOnly });
      const matchingIds = res.results || [];
      
      if (cyRef.current) {
        cyRef.current.batch(() => {
          cyRef.current.nodes().forEach(node => {
            if (matchingIds.includes(node.data('id'))) {
              node.style('opacity', 1);
              node.style('overlay-opacity', 0);
              node.style('border-color', '#a855f7');
              node.style('border-width', 4);
            } else {
              node.style('opacity', 0.2);
              node.style('border-width', 0);
            }
          });
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiSearchLoading(false);
    }
  };

  useEffect(() => {
    if (aiSearchMode && searchQuery.trim()) {
      const timer = setTimeout(() => {
        executeAiSearch();
      }, 1000); // debounce AI search
      return () => clearTimeout(timer);
    } else if (!aiSearchMode && cyRef.current) {
      // Re-trigger standard search
      handleSearch({ target: { value: searchQuery } });
    }
  }, [searchQuery, aiSearchMode]);

  const simulateBlastRadius = () => {
    if (!cyRef.current || !selectedNode) return;
    const cy = cyRef.current;
    const node = cy.getElementById(selectedNode.id);

    if (isSimulating) {
      cy.elements().removeClass('blast-radius blast-center blast-edge');
      setIsSimulating(false);
      return;
    }

    setIsSimulating(true);
    cy.elements().removeClass('blast-radius blast-center blast-edge');
    node.addClass('blast-center');
    
    // Find all nodes that depend on this node recursively (predecessors)
    const predecessors = node.predecessors();
    predecessors.nodes().addClass('blast-radius');
    predecessors.edges().addClass('blast-edge');
  };

  const layout = {
    name: 'cose',
    animate: true,
    padding: 30,
    idealEdgeLength: 100,
    nodeOverlap: 20
  };

  const style = [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'label': 'data(label)',
        'color': '#fff',
        'font-size': '10px',
        'text-outline-color': '#0f172a',
        'text-outline-width': 2,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 5
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#475569',
        'target-arrow-color': '#475569',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': 0.6
      }
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': '#38bdf8',
        'overlay-opacity': 0.2,
        'overlay-color': '#38bdf8'
      }
    },
    {
      selector: '.blast-radius',
      style: {
        'background-color': '#ef4444',
        'border-width': 2,
        'border-color': '#fca5a5'
      }
    },
    {
      selector: '.blast-center',
      style: {
        'background-color': '#b91c1c',
        'border-width': 4,
        'border-color': '#fca5a5'
      }
    },
    {
      selector: '.blast-edge',
      style: {
        'line-color': '#ef4444',
        'target-arrow-color': '#ef4444',
        'width': 4,
        'opacity': 1,
        'z-index': 10
      }
    }
  ];

  if (loading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center text-blue-300">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p>Analyzing architecture and resolving dependency graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-8 text-center text-red-400 bg-red-400/10 rounded-xl border border-red-400/20">
        {error}
      </div>
    );
  }

  const isCircular = selectedNode && circularDeps.some(circle => circle.includes(selectedNode.fullPath));

  // Impact score: weighted combination of dependents (how many rely on this file) and deps (coupling)
  const impactScore = selectedNode
    ? Math.min(100, Math.round((selectedNode.dependents * 7) + (selectedNode.dependencies * 3)))
    : 0;

  const impactLabel = impactScore >= 70 ? 'High' : impactScore >= 35 ? 'Medium' : 'Low';
  const impactColor = impactScore >= 70 ? 'text-red-400' : impactScore >= 35 ? 'text-yellow-400' : 'text-emerald-400';
  const impactBarColor = impactScore >= 70 ? 'bg-red-500' : impactScore >= 35 ? 'bg-yellow-500' : 'bg-emerald-500';

  return (
    <div className="flex w-full h-[600px] border border-white/10 rounded-2xl overflow-hidden bg-[#0f172a]/80 backdrop-blur-xl mt-8">
      
      {/* Left Sidebar - Always Visible */}
      <div className="w-[300px] shrink-0 border-r border-white/10 bg-[#1e293b]/60 flex flex-col p-4 overflow-y-auto z-10">
        
        {/* Search Bar */}
        <div className="relative flex items-center mb-6">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={aiSearchMode ? "Ask AI..." : "Search files..."}
            value={searchQuery}
            onChange={handleSearch}
            className={`w-full pl-9 pr-10 py-2 bg-[#0f172a]/90 border ${aiSearchMode ? 'border-violet-500/50 focus:border-violet-400' : 'border-white/10 focus:border-blue-500'} rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none transition-colors`}
          />
          <button 
            onClick={() => setAiSearchMode(!aiSearchMode)}
            className={`absolute right-2 p-1.5 rounded-md transition-colors ${aiSearchMode ? 'bg-violet-500/20 text-violet-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            title="Toggle AI Semantic Search"
          >
            {aiSearchLoading ? <Loader2 className="w-4 h-4 animate-spin text-violet-400" /> : <Sparkles className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Dangerous Files List */}
        {dangerousFiles.length > 0 && (
          <div className="bg-[#0f172a]/60 border border-red-500/20 rounded-xl p-4 flex-1">
            <div className="flex items-center gap-2 mb-4 text-red-400 font-semibold text-xs uppercase tracking-widest">
              <Flame className="w-4 h-4" /> Highly Depended
            </div>
            <div className="flex flex-col gap-2">
              {dangerousFiles.map(df => (
                <div 
                  key={df.id} 
                  className="flex items-center justify-between text-xs cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors border border-transparent hover:border-white/5"
                  onClick={() => {
                    if (cyRef.current) {
                      const node = cyRef.current.getElementById(df.id);
                      if (node) {
                        node.emit('tap');
                        cyRef.current.zoom({ level: 1.5, position: node.position() });
                      }
                    }
                  }}
                >
                  <span className="text-gray-300 truncate w-40" title={df.id}>{df.label}</span>
                  <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded-md font-mono">{df.count}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">
              These files have the highest number of incoming dependents. Modifying them carries the highest risk of breaking downstream systems.
            </p>
          </div>
        )}
      </div>

      {/* Cytoscape Canvas */}
      <div className="flex-1 min-w-0 relative h-full">
        <CytoscapeComponent
          elements={elements}
          style={{ width: '100%', height: '100%' }}
          stylesheet={style}
          layout={layout}
          wheelSensitivity={0.1}
          cy={(cy) => {
            cyRef.current = cy;
            
            // Rebind click to avoid duplicate listeners
            cy.removeAllListeners('tap', 'node');
            
            cy.on('tap', 'node', (evt) => {
              const node = evt.target;
              const data = node.data();
              
              const dependencyEdges = cy.edges(`[source = "${data.id}"]`);
              const dependencyFiles = [];
              dependencyEdges.forEach(e => dependencyFiles.push(e.target().id()));
              
              const dependentEdges = cy.edges(`[target = "${data.id}"]`);
              const dependentFiles = [];
              dependentEdges.forEach(e => dependentFiles.push(e.source().id()));
              
              setSelectedNode({
                ...data,
                dependencies: dependencyFiles.length,
                dependents: dependentFiles.length
              });

              // Fetch AI summary for this node
              setAiSummary(null);
              setAiError(null);
              setAiLoading(true);
              getAiSummary({
                repoId,
                fileName: data.id,
                dependencies: dependencyFiles,
                dependents: dependentFiles,
              }).then(res => {
                setAiSummary(res.summary);
              }).catch(err => {
                setAiError('AI summary unavailable.');
              }).finally(() => {
                setAiLoading(false);
              });
            });
            
            // Clear selection when clicking background
            cy.on('tap', (evt) => {
              if (evt.target === cy) {
                setSelectedNode(null);
              }
            });
          }}
        />
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-[#1e293b]/90 p-3 rounded-lg border border-white/5 text-xs text-gray-300 space-y-2 pointer-events-none">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#fbbf24]"></div>Entry Points</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#60a5fa]"></div>Core Logic</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#9ca3af]"></div>Utilities</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#4ade80]"></div>Tests</div>
        </div>
      </div>

      {/* Right Side Panel Details */}
      {selectedNode && (
        <div className="w-[320px] shrink-0 border-l border-white/10 bg-[#1e293b]/60 flex flex-col overflow-y-auto animate-in slide-in-from-right-4 duration-300 z-20">

          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white break-words leading-tight">{selectedNode.label}</h3>
              <p className="text-[11px] text-gray-500 mt-1 break-all">{selectedNode.fullPath}</p>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="shrink-0 text-gray-500 hover:text-white transition-colors mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-5">

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

            {/* Blast Radius Button */}
            <button
              onClick={simulateBlastRadius}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-300 ${isSimulating ? 'bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-[#0f172a]/60 border-red-500/20 text-red-400 hover:bg-red-500/10'}`}
            >
              <Activity className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wide">
                {isSimulating ? 'Clear Simulation' : 'Simulate Blast Radius'}
              </span>
            </button>

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
                  <span className="ml-auto text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/30">Gemini</span>
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
                  AI-powered analysis of <span className="text-gray-400 not-italic font-medium">{selectedNode.label}</span> will appear here — purpose, coupling risks, and refactoring suggestions powered by Gemini.
                </p>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
