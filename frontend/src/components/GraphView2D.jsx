import React, { useState, useEffect, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import { getGraphData } from '../services/api';
import { Loader2 } from 'lucide-react';

export default function GraphView2D({ repoId, searchQuery = '', onNodeSelect, simulationConfig, onSimulationUpdate, externalSelectedNodeId }) {
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cyReady, setCyReady] = useState(false);
  const cyRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getGraphData(repoId);
        
        let cyElements = [];
        const determineTypeAndColor = (id) => {
          const lowerId = id.toLowerCase();
          if (lowerId.includes('test') || lowerId.includes('spec')) return '#4ade80';
          if (lowerId.includes('util') || lowerId.includes('helper')) return '#9ca3af';
          if (lowerId.includes('controller') || lowerId.includes('service') || lowerId.includes('model') || lowerId.includes('route')) return '#60a5fa';
          if (lowerId === 'index.js' || lowerId === 'main.js' || lowerId === 'server.js' || lowerId === 'app.js') return '#fbbf24';
          return '#94a3b8';
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
              data: { source: e.source, target: e.target }
            });
          });
        }
        
        setElements(cyElements);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [repoId]);

  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;
      const query = searchQuery.toLowerCase();
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
  }, [searchQuery]);

  useEffect(() => {
    if (!cyRef.current || !cyReady) return;
    const cy = cyRef.current;
    
    console.log('[DEBUG] GraphView useEffect for simulationConfig triggered.', simulationConfig);
    
    if (simulationConfig && simulationConfig.active && simulationConfig.rootNodeId) {
      console.log('[DEBUG] Simulation is active! Starting BFS on rootNodeId:', simulationConfig.rootNodeId);
      cy.batch(() => {
        // Clear previous generic highlights
        cy.elements().removeClass('faded highlighted-edge blast-root blast-l1 blast-l2 blast-unaffected');
        
        const rootId = simulationConfig.rootNodeId.replace(/\\/g, '/'); // ensure standard separators
        let root = cy.getElementById(rootId);
        
        // If exact ID fails, try to find by fullPath (since ID might be just basename or relative)
        if (root.empty()) {
          const matched = cy.nodes().filter(n => n.data('fullPath') === simulationConfig.rootNodeId || n.id() === simulationConfig.rootNodeId);
          if (!matched.empty()) root = matched.first();
        }

        if (root.empty()) {
          console.warn('[DEBUG] Root node not found in GraphView!', simulationConfig.rootNodeId);
          return;
        }

        console.log('[DEBUG] Root node found:', root.id());
        const q = [{ node: root, level: 0 }];
        const visited = new Set();
        visited.add(root.id());
        
        let totalImpacted = 0;
        let maxDepth = 0;
        const impactedFiles = [];
        
        while (q.length > 0) {
           const { node, level } = q.shift();
           maxDepth = Math.max(maxDepth, level);
           if (level > 0) {
             totalImpacted++;
             impactedFiles.push({ id: node.id(), level });
           }
           
           if (level === 0) node.addClass('blast-root');
           else if (level === 1) node.addClass('blast-l1');
           else node.addClass('blast-l2');
           
           // For Blast Radius, we find nodes that depend on "node". 
           // In Madge, X imports Y becomes edge source=X, target=Y.
           // So if Y changes, X is impacted. We need edges where target == node.
           const edgesIn = cy.edges().filter(e => e.target().id() === node.id());
           
           edgesIn.forEach(edge => {
              edge.addClass('highlighted-edge');
              const sourceNode = edge.source();
              if (!visited.has(sourceNode.id())) {
                visited.add(sourceNode.id());
                q.push({ node: sourceNode, level: level + 1 });
              }
           });
        }
        
        cy.nodes().forEach(n => {
           if (!visited.has(n.id())) n.addClass('blast-unaffected');
        });
        
        // Calculate Risk Score
        let riskScore = Math.min(100, Math.round(totalImpacted * 5 + maxDepth * 10));
        if (simulationConfig.severity === 'High') riskScore = Math.min(100, Math.round(riskScore * 1.5));
        if (simulationConfig.severity === 'Low') riskScore = Math.round(riskScore * 0.6);
        
        if (onSimulationUpdate) {
           onSimulationUpdate({ totalImpacted, depth: maxDepth, riskScore, impactedFiles });
        }
      });
    } else {
       cy.batch(() => {
          cy.elements().removeClass('faded highlighted-edge blast-root blast-l1 blast-l2 blast-unaffected');
       });
    }
  }, [simulationConfig, onSimulationUpdate, cyReady]);

  // Handle external node selection dynamically
  useEffect(() => {
    if (externalSelectedNodeId && cyRef.current && cyReady) {
      const cy = cyRef.current;
      // ensure we use correct path matching string 
      const normId = externalSelectedNodeId.replace(/\\/g, '/');
      const node = cy.getElementById(normId);
      if (!node.empty()) {
        try {
          cy.animate({ center: { eles: node }, zoom: 2 }, { duration: 500 });
          // Manually trigger visual highlighting neighborhood if it hasn't fired
          node.emit('tap');
        } catch (e) {
          console.error("Snap error", e);
        }
      }
    }
  }, [externalSelectedNodeId, cyReady]);

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
        'text-margin-y': 5,
        'transition-property': 'opacity, border-width, border-color, overlay-opacity',
        'transition-duration': '0.3s'
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
        'opacity': 0.6,
        'transition-property': 'opacity, line-color, width',
        'transition-duration': '0.3s'
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
      selector: '.faded',
      style: {
        'opacity': 0.05
      }
    },
    {
      selector: '.highlighted-edge',
      style: {
        'width': 4,
        'line-color': '#38bdf8',
        'target-arrow-color': '#38bdf8',
        'opacity': 1,
        'z-index': 10
      }
    },
    {
      selector: '.blast-root',
      style: {
        'background-color': '#ef4444',
        'border-width': 4,
        'border-color': '#b91c1c',
        'color': '#fff',
        'z-index': 100
      }
    },
    {
      selector: '.blast-l1',
      style: {
        'background-color': '#f97316',
        'z-index': 99
      }
    },
    {
      selector: '.blast-l2',
      style: {
        'background-color': '#eab308',
        'z-index': 98
      }
    },
    {
      selector: '.blast-unaffected',
      style: {
        'opacity': 0.1,
        'background-color': '#64748b'
      }
    }
  ];

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-blue-300">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p>Analyzing architecture...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8 text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={style}
        layout={layout}
        wheelSensitivity={0.1}
        cy={(cy) => {
          cyRef.current = cy;
          if (!cyReady) setCyReady(true);
          
          cy.removeAllListeners('tap', 'node');
          cy.on('tap', 'node', (evt) => {
            const node = evt.target;
            const data = node.data();
            
            // Visual Highlighting Logic
            cy.batch(() => {
              // Reset all
              cy.elements().removeClass('faded highlighted-edge');
              
              // Get neighborhood
              const neighborhood = node.closedNeighborhood();
              const nonNeighborhood = cy.elements().not(neighborhood);
              
              // Dim unrelated
              nonNeighborhood.addClass('faded');
              
              // Highlight direct edges
              node.connectedEdges().addClass('highlighted-edge');
            });

            const dependencies = cy.edges(`[source = "${data.id}"]`).length;
            const dependents = cy.edges(`[target = "${data.id}"]`).length;
            
            if (onNodeSelect) {
              onNodeSelect({
                ...data,
                dependencies,
                dependents
              });
            }
          });
          
          cy.on('tap', (evt) => {
            if (evt.target === cy) {
              cy.batch(() => {
                cy.elements().removeClass('faded highlighted-edge');
              });
              if (onNodeSelect) onNodeSelect(null);
            }
          });
        }}
      />
      
      <div className="absolute bottom-6 left-6 bg-[#1e293b]/90 p-3 rounded-lg border border-white/5 text-[10px] text-gray-300 space-y-2 pointer-events-none z-10 shadow-2xl">
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]"></div>Entry Points</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#60a5fa]"></div>Core Logic</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#9ca3af]"></div>Utilities</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#4ade80]"></div>Tests</div>
      </div>
    </div>
  );
}
