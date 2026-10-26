import React, { useEffect, useRef, useMemo } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import IconButton from '../ui/IconButton';
import { NODE_KINDS, KIND_DEFINITIONS } from '../../models/graphModel';

/**
 * Center Cytoscape canvas component with toolbar, legend, and ResizeObserver
 */
export default function GraphCanvas({
  model,
  selectedNode,
  onSelectNode,
  searchQuery,
  aiSearchResults,
  activeCycle,
  isSimulatingBlast,
  className = '',
}) {
  const cyRef = useRef(null);
  const containerRef = useRef(null);

  // Build Cytoscape elements
  const elements = useMemo(() => {
    const rawNodes = model?.nodes || [];
    const rawEdges = model?.rawEdges || [];

    const nodeElements = rawNodes.map((node) => {
      const kindDef = KIND_DEFINITIONS[node.nodeKind] || KIND_DEFINITIONS[NODE_KINDS.NORMAL];
      return {
        data: {
          id: node.id,
          label: node.label || node.id.split('/').pop(),
          fullPath: node.id,
          color: kindDef.colorHex,
          nodeKind: node.nodeKind,
          loc: node.loc,
          fanIn: node.fanIn,
          fanOut: node.fanOut,
          isEntryCandidate: node.isEntryCandidate,
          isTest: node.isTest,
          isOrphan: node.isOrphan,
        },
      };
    });

    const edgeElements = rawEdges.map((edge, idx) => ({
      data: {
        id: `e-${idx}`,
        source: edge.source || edge.from,
        target: edge.target || edge.to,
      },
    }));

    return [...nodeElements, ...edgeElements];
  }, [model?.nodes, model?.rawEdges]);

  // Cytoscape stylesheet (colors from nodeKind tokens, layout unchanged)
  const cyStyle = useMemo(() => [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'background-color': 'data(color)',
        color: '#f8fafc',
        'font-size': '11px',
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        'text-valign': 'center',
        'text-halign': 'center',
        width: 38,
        height: 38,
        'border-width': 2,
        'border-color': '#1e293b',
        'transition-property': 'background-color, border-color, opacity, width, height',
        'transition-duration': '0.14s',
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.5,
        'line-color': '#334155',
        'target-arrow-color': '#475569',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.8,
        'curve-style': 'bezier',
        opacity: 0.6,
        'transition-property': 'line-color, target-arrow-color, width, opacity',
        'transition-duration': '0.14s',
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': '#6366f1',
        width: 44,
        height: 44,
        'font-weight': 'bold',
      },
    },
    {
      selector: '.dimmed',
      style: {
        opacity: 0.1,
      },
    },
    {
      selector: '.search-match',
      style: {
        opacity: 1.0,
        'border-width': 3,
        'border-color': '#f8fafc',
      },
    },
    {
      selector: '.ai-match',
      style: {
        opacity: 1.0,
        'border-width': 3,
        'border-color': '#a855f7',
        'background-color': '#9333ea',
      },
    },
    {
      selector: '.cycle-node',
      style: {
        opacity: 1.0,
        'border-width': 3,
        'border-color': '#f43f5e',
        'background-color': '#e11d48',
      },
    },
    {
      selector: '.cycle-edge',
      style: {
        width: 2.5,
        'line-color': '#f43f5e',
        'target-arrow-color': '#f43f5e',
        opacity: 1.0,
      },
    },
    {
      selector: '.blast-center',
      style: {
        'border-width': 4,
        'border-color': '#ef4444',
        'background-color': '#b91c1c',
        width: 46,
        height: 46,
      },
    },
    {
      selector: '.blast-radius',
      style: {
        'border-width': 3,
        'border-color': '#f87171',
        'background-color': '#dc2626',
        opacity: 1.0,
      },
    },
    {
      selector: '.blast-edge',
      style: {
        width: 2.5,
        'line-color': '#ef4444',
        'target-arrow-color': '#ef4444',
        opacity: 0.9,
      },
    },
  ], []);

  // Layout configuration (standard cose)
  const cyLayout = useMemo(() => ({
    name: 'cose',
    padding: 40,
    randomize: false,
    animate: false,
    nodeRepulsion: 600000,
    idealEdgeLength: 120,
    edgeElasticity: 100,
    gravity: 80,
  }), []);

  // ResizeObserver on canvas container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (cyRef.current) {
        cyRef.current.resize();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update Cytoscape instance when selection or query changes
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      // Clear dynamic classes
      cy.elements().removeClass('dimmed search-match ai-match cycle-node cycle-edge');

      // AI Search active
      if (Array.isArray(aiSearchResults)) {
        const matchSet = new Set(aiSearchResults);
        cy.nodes().forEach((n) => {
          if (matchSet.has(n.id())) {
            n.addClass('ai-match');
          } else {
            n.addClass('dimmed');
          }
        });
        cy.edges().addClass('dimmed');
        return;
      }

      // Name search query active
      if (searchQuery?.trim()) {
        const term = searchQuery.trim().toLowerCase();
        cy.nodes().forEach((n) => {
          const match = n.id().toLowerCase().includes(term) || n.data('label')?.toLowerCase().includes(term);
          if (match) {
            n.addClass('search-match');
          } else {
            n.addClass('dimmed');
          }
        });
        cy.edges().addClass('dimmed');
        return;
      }

      // Cycle active
      if (Array.isArray(activeCycle) && activeCycle.length > 0) {
        const cycleNodeSet = new Set(activeCycle);
        cy.nodes().forEach((n) => {
          if (cycleNodeSet.has(n.id())) {
            n.addClass('cycle-node');
          } else {
            n.addClass('dimmed');
          }
        });

        // Highlight cycle edges
        cy.edges().forEach((e) => {
          const src = e.source().id();
          const tgt = e.target().id();
          if (cycleNodeSet.has(src) && cycleNodeSet.has(tgt)) {
            e.addClass('cycle-edge');
          } else {
            e.addClass('dimmed');
          }
        });
        return;
      }
    });
  }, [searchQuery, aiSearchResults, activeCycle]);

  // Handle Blast Radius Simulation
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().removeClass('blast-center blast-radius blast-edge');

      if (isSimulatingBlast && selectedNode?.id) {
        const centerNode = cy.getElementById(selectedNode.id);
        if (centerNode.length > 0) {
          centerNode.addClass('blast-center');
          // In Cytoscape, predecessors() traverses backward from target to source.
          // Since A -> B means A imports B, predecessors of B are all modules that import B.
          const predecessors = centerNode.predecessors();
          predecessors.nodes().addClass('blast-radius');
          predecessors.edges().addClass('blast-edge');

          // Dim unaffected elements
          cy.elements().difference(predecessors).difference(centerNode).addClass('dimmed');
        }
      }
    });
  }, [isSimulatingBlast, selectedNode?.id]);

  // Sync Cytoscape selection when selectedNode changes externally (e.g. from Sidebar tree)
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    if (selectedNode?.id) {
      const node = cy.getElementById(selectedNode.id);
      if (node.length > 0) {
        cy.nodes().unselect();
        node.select();
        cy.animate({
          center: { eles: node },
          zoom: Math.max(cy.zoom(), 0.9),
          duration: 200,
        });
      }
    } else {
      cy.nodes().unselect();
    }
  }, [selectedNode?.id]);

  // Toolbar actions
  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.25);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 0.8);
    }
  };

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 40);
    }
  };

  const handleReset = () => {
    if (cyRef.current) {
      cyRef.current.reset();
      cyRef.current.fit(undefined, 40);
    }
  };

  return (
    <div ref={containerRef} className={`relative flex-1 h-full w-full bg-surface-app overflow-hidden ${className}`}>
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={cyStyle}
        layout={cyLayout}
        cy={(cy) => {
          cyRef.current = cy;

          cy.removeAllListeners('tap', 'node');
          cy.removeAllListeners('tap');

          cy.on('tap', 'node', (evt) => {
            const node = evt.target;
            const data = node.data();
            const fullNode = model?.nodeMap?.get(data.id) || data;
            onSelectNode(fullNode);
          });

          cy.on('tap', (evt) => {
            if (evt.target === cy) {
              onSelectNode(null);
            }
          });
        }}
      />

      {/* Floating Toolbar */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-surface-panel/90 border border-border-default rounded-sm p-1 shadow-md z-10 backdrop-blur-xs">
        <IconButton
          icon={ZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
          size={16}
          onClick={handleZoomIn}
        />
        <IconButton
          icon={ZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
          size={16}
          onClick={handleZoomOut}
        />
        <div className="w-px h-4 bg-border-subtle mx-0.5" />
        <IconButton
          icon={Maximize2}
          aria-label="Fit graph to view"
          title="Fit to view"
          size={16}
          onClick={handleFit}
        />
        <IconButton
          icon={RotateCcw}
          aria-label="Reset graph view"
          title="Reset view"
          size={16}
          onClick={handleReset}
        />
      </div>

      {/* Semantic Legend */}
      <div className="absolute bottom-3 left-3 bg-surface-panel/95 border border-border-subtle rounded-sm p-2.5 text-xs text-content-secondary space-y-1.5 shadow-md z-10 pointer-events-auto max-w-[260px] select-none">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-content-muted mb-1 flex items-center justify-between">
          <span>Legend</span>
          <span className="text-[10px] lowercase text-content-muted">tokens</span>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1.5" title={KIND_DEFINITIONS[NODE_KINDS.ENTRY].description}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: KIND_DEFINITIONS[NODE_KINDS.ENTRY].colorHex }} />
            <span className="truncate">Entry Point</span>
          </div>
          <div className="flex items-center gap-1.5" title={KIND_DEFINITIONS[NODE_KINDS.IMPORTANT].description}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: KIND_DEFINITIONS[NODE_KINDS.IMPORTANT].colorHex }} />
            <span className="truncate">Important (≥2 in)</span>
          </div>
          <div className="flex items-center gap-1.5" title={KIND_DEFINITIONS[NODE_KINDS.NORMAL].description}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: KIND_DEFINITIONS[NODE_KINDS.NORMAL].colorHex }} />
            <span className="truncate">Normal File</span>
          </div>
          <div className="flex items-center gap-1.5" title={KIND_DEFINITIONS[NODE_KINDS.TEST].description}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: KIND_DEFINITIONS[NODE_KINDS.TEST].colorHex }} />
            <span className="truncate">Test File</span>
          </div>
          <div className="flex items-center gap-1.5" title={KIND_DEFINITIONS[NODE_KINDS.ISOLATED].description}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: KIND_DEFINITIONS[NODE_KINDS.ISOLATED].colorHex }} />
            <span className="truncate">Isolated</span>
          </div>
          <div className="flex items-center gap-1.5" title={KIND_DEFINITIONS[NODE_KINDS.CYCLE].description}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: KIND_DEFINITIONS[NODE_KINDS.CYCLE].colorHex }} />
            <span className="truncate">In Cycle</span>
          </div>
        </div>

        {/* Edge Direction Convention */}
        <div className="pt-1.5 border-t border-border-subtle text-[11px] text-content-muted leading-tight">
          <span className="font-mono text-content-secondary">A → B</span> means <strong className="text-content-secondary font-medium">A imports B</strong>
        </div>
      </div>
    </div>
  );
}
