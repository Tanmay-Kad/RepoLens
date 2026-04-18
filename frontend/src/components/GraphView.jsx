import React, { useState, useEffect, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import { getGraphData } from '../services/api';
import { Loader2 } from 'lucide-react';

export default function GraphView({ repoId, searchQuery = '', onNodeSelect }) {
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

