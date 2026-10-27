import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Eye,
  EyeOff,
  Grid,
  Info,
  X,
  Target,
} from 'lucide-react';
import IconButton from '../ui/IconButton';
import Button from '../ui/Button';
import { NODE_KINDS, KIND_DEFINITIONS } from '../../models/graphModel';
import {
  computeNodeSize,
  getNodeVisualCues,
  resolveLabelCollisions,
  ZOOM_THRESHOLDS,
} from '../../models/labelLOD';
import { layoutIsolatedGrid, GRAPH_LAYOUTS } from '../../models/layoutPacking';

/**
 * Center Cytoscape canvas component with multi-layout engine, label LOD,
 * collision avoidance, isolated files tray, and accessible keyboard navigation.
 */
export default function GraphCanvas({
  model,
  selectedNode,
  onSelectNode,
  searchQuery,
  aiSearchResults,
  activeCycle,
  isSimulatingBlast,
  visibleSubgraph,
  focusConfig,
  onClearFocus,
  layoutMode = GRAPH_LAYOUTS.FORCE,
  onChangeLayout,
  className = '',
}) {
  const cyRef = useRef(null);
  const containerRef = useRef(null);

  // UI state for floating overlays
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isIsolatedTrayOpen, setIsIsolatedTrayOpen] = useState(false);
  const [drawIsolatedGrid, setDrawIsolatedGrid] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Source nodes for rendering (either focus neighborhood or scope visible nodes)
  const renderNodes = useMemo(() => {
    if (focusConfig?.active && focusConfig.neighborhood?.neighborhoodNodeIds) {
      const allowedIds = focusConfig.neighborhood.neighborhoodNodeIds;
      const allNodes = model?.nodes || [];
      return allNodes.filter((n) => allowedIds.has(n.id));
    }
    return visibleSubgraph?.visibleNodes || model?.nodes || [];
  }, [focusConfig, visibleSubgraph?.visibleNodes, model?.nodes]);

  // Source edges for rendering
  const renderEdges = useMemo(() => {
    const rawEdges = model?.rawEdges || [];
    const visibleIdSet = new Set(renderNodes.map((n) => n.id));
    return rawEdges.filter((e) => {
      const src = e.source || e.from;
      const tgt = e.target || e.to;
      return visibleIdSet.has(src) && visibleIdSet.has(tgt);
    });
  }, [model?.rawEdges, renderNodes]);

  // Isolated files in graph (fanIn 0 & fanOut 0)
  const isolatedFiles = useMemo(() => {
    return (model?.nodes || []).filter(
      (n) => n.nodeKind === NODE_KINDS.ISOLATED || (n.fanIn === 0 && (n.fanOut === 0 || !n.fanOut))
    );
  }, [model?.nodes]);

  // Build Cytoscape elements with accessible shapes and sizing
  const elements = useMemo(() => {
    const nodeElements = renderNodes.map((node) => {
      const kindDef = KIND_DEFINITIONS[node.nodeKind] || KIND_DEFINITIONS[NODE_KINDS.NORMAL];
      const cues = getNodeVisualCues(node);
      const size = computeNodeSize(node);

      return {
        data: {
          id: node.id,
          label: node.label || node.id.split('/').pop(),
          displayLabel: node.label || node.id.split('/').pop(),
          fullPath: node.id,
          color: kindDef.colorHex,
          nodeKind: node.nodeKind,
          loc: node.loc,
          fanIn: node.fanIn || 0,
          fanOut: node.fanOut || 0,
          isEntryCandidate: Boolean(node.isEntryCandidate),
          isTest: Boolean(node.isTest),
          isOrphan: Boolean(node.isOrphan),
          inCycle: Boolean(node.inCycle),
          nodeSize: size,
          shape: cues.shape,
          borderStyle: cues.borderStyle,
          borderWidth: cues.borderWidth,
        },
      };
    });

    const edgeElements = renderEdges.map((edge, idx) => ({
      data: {
        id: `e-${idx}`,
        source: edge.source || edge.from,
        target: edge.target || edge.to,
      },
    }));

    return [...nodeElements, ...edgeElements];
  }, [renderNodes, renderEdges]);

  // Cytoscape stylesheet with accessible cues, arrowheads, and CSS-class dimming
  const cyStyle = useMemo(
    () => [
      {
        selector: 'node',
        style: {
          label: 'data(displayLabel)',
          'background-color': 'data(color)',
          color: '#f8fafc',
          'font-size': '10px',
          'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-max-width': '85px',
          'text-wrap': 'ellipsis',
          'text-background-color': '#090d16',
          'text-background-opacity': 0.75,
          'text-background-padding': '2px',
          'text-background-shape': 'roundrectangle',
          width: 'data(nodeSize)',
          height: 'data(nodeSize)',
          shape: 'data(shape)',
          'border-style': 'data(borderStyle)',
          'border-width': 'data(borderWidth)',
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
          'target-arrow-color': '#64748b',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.85,
          'curve-style': 'bezier',
          opacity: 0.35,
          'transition-property': 'line-color, target-arrow-color, width, opacity',
          'transition-duration': '0.14s',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 3.5,
          'border-color': '#6366f1',
          'font-weight': 'bold',
          opacity: 1.0,
        },
      },
      // Non-neighbor dimming via CSS class (no per-node style loops)
      {
        selector: '.dimmed',
        style: {
          opacity: 0.12,
        },
      },
      // Incident Dependencies (outgoing: sky blue)
      {
        selector: '.edge-dependency',
        style: {
          width: 2.5,
          'line-color': '#38bdf8',
          'target-arrow-color': '#38bdf8',
          opacity: 1.0,
          'z-index': 10,
        },
      },
      // Incident Dependents (incoming: purple)
      {
        selector: '.edge-dependent',
        style: {
          width: 2.5,
          'line-color': '#c084fc',
          'target-arrow-color': '#c084fc',
          opacity: 1.0,
          'z-index': 10,
        },
      },
      {
        selector: '.neighbor-dependency',
        style: {
          'border-color': '#38bdf8',
          'border-width': 3,
          opacity: 1.0,
        },
      },
      {
        selector: '.neighbor-dependent',
        style: {
          'border-color': '#c084fc',
          'border-width': 3,
          opacity: 1.0,
        },
      },
      {
        selector: '.cycle-node',
        style: {
          opacity: 1.0,
          'border-width': 3.5,
          'border-color': '#f43f5e',
          'background-color': '#e11d48',
          'z-index': 15,
        },
      },
      {
        selector: '.cycle-edge',
        style: {
          width: 3.0,
          'line-color': '#f43f5e',
          'target-arrow-color': '#f43f5e',
          opacity: 1.0,
          'z-index': 15,
        },
      },
      {
        selector: '.search-match',
        style: {
          opacity: 1.0,
          'border-width': 3.5,
          'border-color': '#ffffff',
          'z-index': 12,
        },
      },
      {
        selector: '.ai-match',
        style: {
          opacity: 1.0,
          'border-width': 3.5,
          'border-color': '#a855f7',
          'background-color': '#9333ea',
          'z-index': 12,
        },
      },
      {
        selector: '.blast-center',
        style: {
          'border-width': 4,
          'border-color': '#ef4444',
          'background-color': '#b91c1c',
          opacity: 1.0,
          'z-index': 20,
        },
      },
      {
        selector: '.blast-radius',
        style: {
          'border-width': 3,
          'border-color': '#f87171',
          'background-color': '#dc2626',
          opacity: 1.0,
          'z-index': 18,
        },
      },
      {
        selector: '.blast-edge',
        style: {
          width: 2.5,
          'line-color': '#ef4444',
          'target-arrow-color': '#ef4444',
          opacity: 0.9,
          'z-index': 18,
        },
      },
    ],
    []
  );

  // Cytoscape built-in layout configuration
  const cyLayout = useMemo(() => {
    const isDense = renderNodes.length > 150;
    const animate = !isDense;

    if (layoutMode === GRAPH_LAYOUTS.LAYERED) {
      // Find candidate entry points among visible nodes, else roots with in-degree 0
      const entryIds = renderNodes
        .filter((n) => n.isEntryCandidate)
        .map((n) => n.id);

      return {
        name: 'breadthfirst',
        directed: true,
        roots: entryIds.length > 0 ? entryIds : undefined,
        spacingFactor: 1.5,
        avoidOverlap: true,
        padding: 40,
        animate,
        fit: true,
      };
    }

    if (layoutMode === GRAPH_LAYOUTS.CONCENTRIC) {
      return {
        name: 'concentric',
        concentric: (node) => node.data('fanIn') || 0,
        levelWidth: () => 1,
        avoidOverlap: true,
        padding: 40,
        animate,
        fit: true,
      };
    }

    // Default: Force (cose; randomize: false for deterministic execution)
    return {
      name: 'cose',
      padding: 40,
      randomize: false,
      animate,
      componentSpacing: 80,
      nodeRepulsion: 450000,
      idealEdgeLength: 100,
      edgeElasticity: 32,
      numIter: 1000,
      fit: true,
    };
  }, [layoutMode, renderNodes]);

  // Pure Label LOD & Collision Avoidance updater
  const updateLabelLOD = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const zoom = cy.zoom();
    const visibleNodes = cy.nodes();
    const selectedId = selectedNode?.id || null;

    // Direct neighbors for priority boost
    const neighborIds = new Set();
    if (selectedId) {
      const sel = cy.getElementById(selectedId);
      sel.neighborhood('node').forEach((n) => neighborIds.add(n.id()));
    }

    const candidates = [];
    visibleNodes.forEach((n) => {
      const bb = n.boundingBox({ includeLabels: true });
      candidates.push({
        id: n.id(),
        node: n.data(),
        box: bb,
      });
    });

    const visibleLabelIds = resolveLabelCollisions(
      candidates,
      zoom,
      selectedId,
      neighborIds
    );

    cy.batch(() => {
      visibleNodes.forEach((n) => {
        const fullLabel = n.data('label') || n.id();
        const displayLabel = visibleLabelIds.has(n.id()) ? fullLabel : '';
        if (n.data('displayLabel') !== displayLabel) {
          n.data('displayLabel', displayLabel);
        }
      });
    });
  }, [selectedNode?.id]);

  // Run layout and measure performance.now
  const triggerLayout = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const t0 = performance.now();
    const layout = cy.layout(cyLayout);

    layout.one('layoutstop', () => {
      const elapsed = performance.now() - t0;
      console.log(
        `[Cytoscape Layout] ${cyLayout.name} completed in ${elapsed.toFixed(1)}ms (${renderNodes.length} visible nodes)`
      );
      cy.fit(undefined, 40);
      updateLabelLOD();
    });

    layout.run();
  }, [cyLayout, renderNodes.length, updateLabelLOD]);

  // Run layout only when elements or layoutMode changes (never on selection)
  useEffect(() => {
    triggerLayout();
  }, [elements, layoutMode, triggerLayout]);

  // Attach zoom/pan listeners for dynamic LOD
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    let timeout;
    const handleViewportChange = () => {
      clearTimeout(timeout);
      timeout = setTimeout(updateLabelLOD, 60);
    };

    cy.on('zoom pan', handleViewportChange);
    return () => {
      cy.removeListener('zoom pan', handleViewportChange);
      clearTimeout(timeout);
    };
  }, [updateLabelLOD]);

  // Center selected node if focus mode is active
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    if (focusConfig?.active && focusConfig.rootNodeId) {
      const centerNode = cy.getElementById(focusConfig.rootNodeId);
      if (centerNode.length > 0) {
        cy.animate({
          center: { eles: centerNode },
          zoom: Math.max(cy.zoom(), 0.85),
          duration: 250,
        });
      }
    }
  }, [focusConfig]);

  // Dimming and highlighting logic via CSS classes
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      // Clear dynamic classes
      cy.elements().removeClass(
        'dimmed neighbor-dependency neighbor-dependent edge-dependency edge-dependent cycle-node cycle-edge blast-center blast-radius blast-edge search-match ai-match'
      );

      // 1. Search Query Highlighting
      if (searchQuery?.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matches = cy.nodes().filter((n) => n.id().toLowerCase().includes(query));
        if (matches.length > 0) {
          matches.addClass('search-match');
          cy.elements().not(matches).addClass('dimmed');
        }
      }

      // 2. AI Search Highlights
      if (aiSearchResults && aiSearchResults.length > 0) {
        const aiSet = new Set(aiSearchResults.map((m) => (typeof m === 'string' ? m : m.id)));
        const matches = cy.nodes().filter((n) => aiSet.has(n.id()));
        if (matches.length > 0) {
          matches.addClass('ai-match');
          cy.elements().not(matches).addClass('dimmed');
        }
      }

      // 3. Circular Dependency Highlight
      if (activeCycle && Array.isArray(activeCycle) && activeCycle.length > 0) {
        const cycleSet = new Set(activeCycle);
        const cycleNodes = cy.nodes().filter((n) => cycleSet.has(n.id()));
        cycleNodes.addClass('cycle-node');

        const cycleEdges = cy.edges().filter((e) => {
          return cycleSet.has(e.source().id()) && cycleSet.has(e.target().id());
        });
        cycleEdges.addClass('cycle-edge');

        cy.elements().not(cycleNodes).not(cycleEdges).addClass('dimmed');
        return;
      }

      // 4. Blast Radius Simulation
      if (isSimulatingBlast && selectedNode?.id) {
        const centerNode = cy.getElementById(selectedNode.id);
        if (centerNode.length > 0) {
          const predecessors = centerNode.predecessors();
          centerNode.addClass('blast-center');
          predecessors.nodes().addClass('blast-radius');
          predecessors.edges().addClass('blast-edge');
          cy.elements().difference(predecessors).difference(centerNode).addClass('dimmed');
          return;
        }
      }

      // 5. Normal Selection: Emphasize incident edges & neighbors with distinct directional colors
      if (selectedNode?.id && !searchQuery?.trim() && !aiSearchResults) {
        const sel = cy.getElementById(selectedNode.id);
        if (sel.length > 0) {
          // Outgoing edges (Dependencies: sky blue)
          const outEdges = sel.outgoers('edge');
          const depNodes = sel.outgoers('node');
          outEdges.addClass('edge-dependency');
          depNodes.addClass('neighbor-dependency');

          // Incoming edges (Dependents: purple)
          const inEdges = sel.incomers('edge');
          const parentNodes = sel.incomers('node');
          inEdges.addClass('edge-dependent');
          parentNodes.addClass('neighbor-dependent');

          const neighborhood = sel.union(depNodes).union(parentNodes).union(outEdges).union(inEdges);
          cy.elements().difference(neighborhood).addClass('dimmed');
        }
      }
    });
  }, [
    selectedNode?.id,
    searchQuery,
    aiSearchResults,
    activeCycle,
    isSimulatingBlast,
  ]);

  // Sync external selection
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    if (selectedNode?.id) {
      const node = cy.getElementById(selectedNode.id);
      if (node.length > 0 && !node.selected()) {
        cy.nodes().unselect();
        node.select();
      }
    } else {
      cy.nodes().unselect();
    }
  }, [selectedNode?.id]);

  // Position isolated files in a tidy grid when drawIsolatedGrid is enabled
  useEffect(() => {
    if (!drawIsolatedGrid) return;
    const cy = cyRef.current;
    if (!cy) return;

    const isoElements = cy.nodes().filter((n) => n.data('isOrphan') || (n.data('fanIn') === 0 && n.data('fanOut') === 0));
    if (isoElements.length === 0) return;

    const grid = layoutIsolatedGrid(
      isoElements.map((n) => n.id()),
      { startX: 50, startY: 50, columns: 6, spacingX: 80, spacingY: 80 }
    );

    cy.batch(() => {
      isoElements.forEach((n) => {
        const pos = grid.get(n.id());
        if (pos) {
          n.position(pos);
        }
      });
    });
  }, [drawIsolatedGrid]);

  // Toolbar Actions
  const handleZoomIn = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 1.25);
  };
  const handleZoomOut = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 0.8);
  };
  const handleFit = () => {
    if (cyRef.current) cyRef.current.fit(undefined, 40);
  };
  const handleReset = () => {
    if (cyRef.current) {
      cyRef.current.reset();
      triggerLayout();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 h-full w-full bg-surface-app overflow-hidden ${className}`}
    >
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={cyStyle}
        layout={cyLayout}
        hideEdgesOnViewport={elements.length > 250}
        textureOnViewport={elements.length > 250}
        cy={(cy) => {
          cyRef.current = cy;
          if (typeof window !== 'undefined') {
            window.cy = cy;
            window.__repolens_cy = cy;
          }

          cy.removeAllListeners('tap', 'node');
          cy.removeAllListeners('tap');
          cy.removeAllListeners('mouseover', 'node');
          cy.removeAllListeners('mouseout', 'node');

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

          cy.on('mouseover', 'node', (evt) => {
            const node = evt.target;
            const renderedPos = node.renderedPosition();
            setHoveredNode(node.data());
            setTooltipPos({ x: renderedPos.x, y: renderedPos.y });
          });

          cy.on('mouseout', 'node', () => {
            setHoveredNode(null);
          });
        }}
      />

      {/* Floating Toolbar */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-surface-panel/90 border border-border-default rounded-sm p-1 shadow-md z-20 backdrop-blur-xs">
        {/* Layout Switcher */}
        <div className="flex items-center rounded-xs bg-surface-overlay p-0.5 border border-border-subtle mr-1">
          {[
            { id: GRAPH_LAYOUTS.FORCE, label: 'Force' },
            { id: GRAPH_LAYOUTS.LAYERED, label: 'Layered' },
            { id: GRAPH_LAYOUTS.CONCENTRIC, label: 'Concentric' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeLayout && onChangeLayout(item.id)}
              className={`px-2 py-1 text-[11px] rounded-xs font-medium transition-colors ${
                layoutMode === item.id
                  ? 'bg-accent text-white font-semibold'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <IconButton
          icon={ZoomIn}
          aria-label="Zoom in (+)"
          title="Zoom in (+)"
          size={16}
          onClick={handleZoomIn}
        />
        <IconButton
          icon={ZoomOut}
          aria-label="Zoom out (-)"
          title="Zoom out (-)"
          size={16}
          onClick={handleZoomOut}
        />
        <IconButton
          icon={Maximize2}
          aria-label="Fit view (f)"
          title="Fit view (f)"
          size={16}
          onClick={handleFit}
        />
        <IconButton
          icon={RotateCcw}
          aria-label="Reset layout"
          title="Reset layout"
          size={16}
          onClick={handleReset}
        />
        <IconButton
          icon={HelpCircle}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          size={16}
          onClick={() => setIsHelpOpen(!isHelpOpen)}
        />
      </div>

      {/* Focus Mode Banner (if active) */}
      {focusConfig?.active && (
        <div className="absolute top-3 left-3 bg-surface-panel/95 border border-accent/40 rounded-sm px-3 py-2 shadow-lg z-20 flex items-center gap-3 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent animate-pulse" aria-hidden="true" />
            <div className="text-xs">
              <span className="font-semibold text-content-primary">Focus Mode: </span>
              <span className="text-accent font-mono">{focusConfig.rootNodeId}</span>
              <span className="text-content-muted ml-1.5 font-mono text-[11px]">
                (depth {focusConfig.depth}, {focusConfig.direction})
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearFocus}
            className="text-xs text-content-muted hover:text-content-primary h-6 px-2"
          >
            Clear Focus (Esc)
          </Button>
        </div>
      )}

      {/* Hover Node Tooltip */}
      {hoveredNode && (
        <div
          style={{
            left: `${tooltipPos.x + 15}px`,
            top: `${tooltipPos.y + 15}px`,
          }}
          className="pointer-events-none absolute z-40 bg-surface-overlay/95 border border-border-default rounded-sm px-2.5 py-1.5 shadow-xl text-xs backdrop-blur-xs max-w-xs"
        >
          <div className="font-mono text-content-primary font-semibold truncate">
            {hoveredNode.fullPath || hoveredNode.id}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-content-muted mt-0.5">
            <span>Fan-In: {hoveredNode.fanIn || 0}</span>
            <span>•</span>
            <span>Fan-Out: {hoveredNode.fanOut || 0}</span>
            {hoveredNode.isEntryCandidate && (
              <>
                <span>•</span>
                <span className="text-amber-400">Entry</span>
              </>
            )}
            {hoveredNode.inCycle && (
              <>
                <span>•</span>
                <span className="text-rose-400">In Cycle</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Isolated Files Collapsible Tray */}
      {isolatedFiles.length > 0 && (
        <div className="absolute bottom-3 right-3 z-20">
          <div className="bg-surface-panel/95 border border-border-default rounded-sm shadow-lg backdrop-blur-xs max-w-sm">
            <button
              type="button"
              onClick={() => setIsIsolatedTrayOpen(!isIsolatedTrayOpen)}
              className="w-full flex items-center justify-between p-2 text-xs text-content-secondary hover:text-content-primary transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-content-primary">
                  Isolated Files ({isolatedFiles.length})
                </span>
                <span className="text-[10px] text-content-muted bg-surface-overlay px-1.5 py-0.5 rounded">
                  not connected
                </span>
              </div>
              {isIsolatedTrayOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-content-muted" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-content-muted" />
              )}
            </button>

            {isIsolatedTrayOpen && (
              <div className="p-3 border-t border-border-subtle space-y-2 text-xs">
                <p className="text-[11px] text-content-muted leading-relaxed">
                  Isolation in the import graph does not prove a file is unused (e.g. entry scripts, dynamic imports, config files).
                </p>
                <div className="flex items-center justify-between pt-1">
                  <Button
                    size="sm"
                    variant={drawIsolatedGrid ? 'primary' : 'outline'}
                    onClick={() => setDrawIsolatedGrid(!drawIsolatedGrid)}
                    className="text-[11px] h-6 px-2 flex items-center gap-1"
                  >
                    <Grid className="w-3 h-3" />
                    <span>{drawIsolatedGrid ? 'Grid Active' : 'Draw as Tidy Grid'}</span>
                  </Button>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-0.5 font-mono text-[11px] text-content-secondary pr-1">
                  {isolatedFiles.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => onSelectNode(f)}
                      className="cursor-pointer hover:text-accent truncate py-0.5"
                    >
                      {f.id}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Accessible Legend */}
      <div className="absolute bottom-3 left-3 z-20">
        <div className="bg-surface-panel/95 border border-border-default rounded-sm shadow-md backdrop-blur-xs select-none min-w-[210px]">
          <button
            type="button"
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className="w-full flex items-center justify-between p-2 text-xs font-semibold text-content-primary hover:bg-surface-raised transition-colors"
          >
            <span>LEGEND</span>
            {isLegendOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-content-muted" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-content-muted" />
            )}
          </button>

          {isLegendOpen && (
            <div className="p-2.5 pt-0 border-t border-border-subtle space-y-2 text-xs">
              {/* Category Nodes */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5" title="Hexagon shape">
                  <span className="w-3 h-3 rounded-xs bg-[#f59e0b] border border-[#d97706] inline-block" />
                  <span className="text-content-secondary">Entry (Hexagon)</span>
                </div>
                <div className="flex items-center gap-1.5" title="Diamond shape">
                  <span className="w-3 h-3 rounded-xs bg-[#8b5cf6] border border-[#7c3aed] inline-block rotate-45" />
                  <span className="text-content-secondary">High In (Diamond)</span>
                </div>
                <div className="flex items-center gap-1.5" title="Ellipse shape">
                  <span className="w-3 h-3 rounded-full bg-[#64748b] border border-[#475569] inline-block" />
                  <span className="text-content-secondary">Normal (Ellipse)</span>
                </div>
                <div className="flex items-center gap-1.5" title="Tag shape">
                  <span className="w-3 h-3 rounded-xs bg-[#10b981] border border-[#059669] inline-block" />
                  <span className="text-content-secondary">Test (Tag)</span>
                </div>
                <div className="flex items-center gap-1.5" title="Dashed border">
                  <span className="w-3 h-3 rounded-xs bg-[#e11d48] border-2 border-dashed border-[#f43f5e] inline-block" />
                  <span className="text-rose-400">In Cycle</span>
                </div>
              </div>

              {/* Edge Directions & Focus Colors */}
              <div className="pt-1.5 border-t border-border-subtle space-y-1 text-[11px]">
                <div className="text-content-muted font-mono text-[10px]">
                  A → B means <strong>A imports B</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-[#38bdf8] inline-block" />
                  <span className="text-[#38bdf8]">Dependencies (Outgoing)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-[#c084fc] inline-block" />
                  <span className="text-[#c084fc]">Dependents (Incoming)</span>
                </div>
              </div>

              {/* LOD Hint */}
              <div className="text-[10px] text-content-muted italic pt-1 border-t border-border-subtle">
                Zoom in to reveal more labels
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Help Popover */}
      {isHelpOpen && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface-panel border border-border-default rounded-sm max-w-sm w-full p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-content-primary">Keyboard Shortcuts</span>
              <IconButton
                icon={X}
                aria-label="Close shortcuts"
                size={16}
                onClick={() => setIsHelpOpen(false)}
              />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border-subtle">
                <span className="text-content-secondary">Focus file search</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-overlay border border-border-default font-mono text-[11px] text-content-primary">/</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border-subtle">
                <span className="text-content-secondary">Clear selection / Exit focus</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-overlay border border-border-default font-mono text-[11px] text-content-primary">Esc</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border-subtle">
                <span className="text-content-secondary">Fit entire graph to screen</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-overlay border border-border-default font-mono text-[11px] text-content-primary">f</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border-subtle">
                <span className="text-content-secondary">Zoom in / Zoom out</span>
                <span className="font-mono text-[11px] space-x-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-overlay border border-border-default text-content-primary">+</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-overlay border border-border-default text-content-primary">-</kbd>
                </span>
              </div>
            </div>
            <p className="text-[11px] text-content-muted leading-relaxed">
              Shortcuts are inactive while typing inside inputs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
