import React, { useState, useEffect, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import { getGraphData, getAiSummary } from '../services/api';
import { Loader2, Search, AlertTriangle, Sparkles, X } from 'lucide-react';

export default function GraphView({ repoId }) {
  const [elements, setElements] = useState([]);
  const [circularDeps, setCircularDeps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
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
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [repoId]);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    
    if (cyRef.current) {
      const cy = cyRef.current;
      cy.batch(() => {
        cy.nodes().forEach(node => {
          if (!query || node.data('fullPath').toLowerCase().includes(query)) {
            node.style('opacity', 1);
            node.style('overlay-opacity', 0);
          } else {
            node.style('opacity', 0.2);
          }
        });
      });
    }
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
    <div className="flex flex-col md:flex-row w-full h-[600px] border border-white/10 rounded-2xl overflow-hidden bg-[#0f172a]/80 backdrop-blur-xl relative mt-8">
      
      {/* Search Bar Overlay */}
      <div className="absolute top-4 left-4 z-10 w-64">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-9 pr-4 py-2 bg-[#1e293b]/90 border border-white/10 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
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
            
            // Unbind only the node-tap listener to avoid stacking duplicates on re-renders
            cy.off('tap', 'node');
            
            cy.on('tap', 'node', (evt) => {
              const node = evt.target;
              const data = node.data();
              
              const dependencies = cy.edges(`[source = "${data.id}"]`).length;
              const dependents = cy.edges(`[target = "${data.id}"]`).length;
              
              setSelectedNode({
                ...data,
                dependencies,
                dependents
              });

              // Fetch AI summary for this node
              setAiSummary(null);
              setAiError(null);
              setAiLoading(true);
              getAiSummary({
                repoId,
                fileName: data.id,
                dependencies,
                dependents,
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

      {/* Side Panel Details */}
      {selectedNode && (
        <div className="w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-white/10 bg-[#1e293b]/60 flex flex-col overflow-y-auto animate-in slide-in-from-right-4 duration-300 z-20">

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
