import React, { useState, useEffect, useRef, useMemo } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { Loader2 } from 'lucide-react';

// ─── Config colour palette ─────────────────────────────────────────────────────
const CONFIG_COLORS = {
  pkg:        '#f59e0b',
  'pkg-lock': '#d97706',
  tsconfig:   '#8b5cf6',
  jsconfig:   '#7c3aed',
  vite:       '#f97316',
  webpack:    '#fb923c',
  babel:      '#facc15',
  eslint:     '#a78bfa',
  prettier:   '#c084fc',
  env:        '#34d399',
  jest:       '#f87171',
  vitest:     '#fb7185',
  tailwind:   '#38bdf8',
  postcss:    '#67e8f9',
  next:       '#e2e8f0',
  nuxt:       '#4ade80',
  svelte:     '#fb923c',
  rollup:     '#fdba74',
  docker:     '#60a5fa',
  ci:         '#a3e635',
  make:       '#94a3b8',
};

const getConfigColor = (type) => CONFIG_COLORS[type] || '#f59e0b';

const determineSourceColor = (id) => {
  const lower = id.toLowerCase();
  if (lower.includes('test') || lower.includes('spec'))  return '#4ade80';
  if (lower.includes('util') || lower.includes('helper')) return '#9ca3af';
  if (lower.includes('controller') || lower.includes('service') ||
      lower.includes('model')      || lower.includes('route'))  return '#60a5fa';
  const base = lower.replace(/\\/g, '/').split('/').pop();
  if (['index.js','main.js','server.js','app.js','index.ts','main.ts','app.ts'].includes(base))
    return '#fbbf24';
  return '#94a3b8';
};

export default function GraphView2D({
  repoId,
  initialData, // NOW USES PROP INSTEAD OF INTERNAL FETCH
  searchQuery = '',
  onNodeSelect,
  simulationConfig,
  onSimulationUpdate,
  externalSelectedNodeId,
  showConfig = true,
}) {
  const [cyReady, setCyReady]     = useState(false);
  const cyRef = useRef(null);

  // ── Process data from props ──────────────────────────────────────────────────
  const { processedNodes, processedEdges } = useMemo(() => {
    const nodes = [];
    const edges = [];
    
    if (!initialData || !initialData.nodes) return { processedNodes: [], processedEdges: [] };

    initialData.nodes.forEach(n => {
      const isConfig = Boolean(n.isConfig);
      const parent = n.filePath && n.filePath.includes('/') ? n.filePath.split('/').slice(0, -1).join('/') : '';
      const label = isConfig && parent ? `${parent}/${n.label}` : (n.label || n.id.replace(/\\/g, '/').split('/').pop());

      nodes.push({
        data: {
          id:         n.id,
          label,
          fullPath:   n.filePath || n.id,
          color:      isConfig ? getConfigColor(n.type) : determineSourceColor(n.id),
          nodeType:   isConfig ? 'config' : 'source',
          configType: n.type  || null,
          isConfig,
        },
        classes: isConfig ? 'config-node' : 'source-node',
      });
    });

    if (initialData.edges) {
      initialData.edges.forEach(e => {
        const isConfigEdge = String(e.source).startsWith('__config__');
        edges.push({
          data: {
            source:   e.source,
            target:   e.target,
            edgeType: isConfigEdge ? 'config' : 'source',
          },
          classes: isConfigEdge ? 'config-edge' : 'source-edge',
        });
      });
    }

    return { processedNodes: nodes, processedEdges: edges };
  }, [initialData]);

  // ── Filter based on showConfig toggle ─────────────────────────────────────────
  const elements = useMemo(() => {
    if (showConfig) return [...processedNodes, ...processedEdges];
    return [
      ...processedNodes.filter(n => !n.data.isConfig),
      ...processedEdges.filter(e => e.data.edgeType !== 'config'),
    ];
  }, [processedNodes, processedEdges, showConfig]);

  // ── Search opacity ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cyRef.current || !cyReady) return;
    const cy = cyRef.current;
    const q  = searchQuery.toLowerCase();
    cy.batch(() => {
      cy.nodes().forEach(node => {
        const match = !q || node.data('fullPath').toLowerCase().includes(q);
        node.style('opacity', match ? 1 : 0.15);
      });
    });
  }, [searchQuery, cyReady]);

  // ── Blast-radius simulation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!cyRef.current || !cyReady) return;
    const cy = cyRef.current;

    if (simulationConfig && simulationConfig.active && simulationConfig.rootNodeId) {
      cy.batch(() => {
        cy.elements().removeClass('faded highlighted-edge blast-root blast-l1 blast-l2 blast-unaffected');

        const rootId = simulationConfig.rootNodeId.replace(/\\/g, '/');
        let root = cy.getElementById(rootId);
        if (root.empty()) {
          const matched = cy.nodes().filter(
            n => n.data('fullPath') === simulationConfig.rootNodeId || n.id() === simulationConfig.rootNodeId
          );
          if (!matched.empty()) root = matched.first();
        }
        if (root.empty()) return;

        const q       = [{ node: root, level: 0 }];
        const visited = new Set([root.id()]);
        let totalImpacted = 0, maxDepth = 0;
        const impactedFiles = [];

        while (q.length > 0) {
          const { node, level } = q.shift();
          maxDepth = Math.max(maxDepth, level);
          if (level > 0) { totalImpacted++; impactedFiles.push({ id: node.id(), level }); }
          if (level === 0) node.addClass('blast-root');
          else if (level === 1) node.addClass('blast-l1');
          else node.addClass('blast-l2');

          cy.edges().filter(e => e.target().id() === node.id()).forEach(edge => {
            edge.addClass('highlighted-edge');
            const src = edge.source();
            if (!visited.has(src.id())) { visited.add(src.id()); q.push({ node: src, level: level + 1 }); }
          });
        }

        cy.nodes().forEach(n => { if (!visited.has(n.id())) n.addClass('blast-unaffected'); });

        let riskScore = Math.min(100, Math.round(totalImpacted * 5 + maxDepth * 10));
        if (simulationConfig.severity === 'High') riskScore = Math.min(100, Math.round(riskScore * 1.5));
        if (simulationConfig.severity === 'Low')  riskScore = Math.round(riskScore * 0.6);
        if (onSimulationUpdate) onSimulationUpdate({ totalImpacted, depth: maxDepth, riskScore, impactedFiles });
      });
    } else {
      cy.batch(() => { cy.elements().removeClass('faded highlighted-edge blast-root blast-l1 blast-l2 blast-unaffected'); });
    }
  }, [simulationConfig, onSimulationUpdate, cyReady]);

  // ── External node selection ────────────────────────────────────────────────────
  useEffect(() => {
    if (externalSelectedNodeId && cyRef.current && cyReady) {
      const normId = externalSelectedNodeId.replace(/\\/g, '/');
      const node   = cyRef.current.getElementById(normId);
      if (!node.empty()) {
        try { cyRef.current.animate({ center: { eles: node }, zoom: 2 }, { duration: 500 }); node.emit('tap'); }
        catch (e) { console.error('Snap error', e); }
      }
    }
  }, [externalSelectedNodeId, cyReady]);

  const layout = { name: 'cose', animate: true, padding: 30, idealEdgeLength: 100, nodeOverlap: 20 };

  const stylesheet = [
    {
      selector: '.source-node',
      style: {
        shape: 'ellipse',
        'background-color': 'data(color)',
        label: 'data(label)',
        color: '#fff',
        'font-size': '10px',
        'text-outline-color': '#0f172a',
        'text-outline-width': 2,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 5,
        width: 28,
        height: 28,
        'transition-property': 'opacity, border-width, border-color',
        'transition-duration': '0.3s',
      },
    },
    {
      selector: '.config-node',
      style: {
        shape: 'hexagon',
        'background-color': 'data(color)',
        'background-opacity': 0.95,
        'border-width': 2.5,
        'border-color': 'rgba(255,255,255,0.25)',
        label: 'data(label)',
        color: '#fff',
        'font-size': '9px',
        'font-weight': 'bold',
        'text-outline-color': '#000',
        'text-outline-width': 2,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 7,
        width: 38,
        height: 38,
        'shadow-blur': 18,
        'shadow-color': 'data(color)',
        'shadow-opacity': 0.55,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
        'transition-property': 'opacity, border-width, border-color',
        'transition-duration': '0.3s',
      },
    },
    {
      selector: '.source-edge',
      style: {
        width: 2,
        'line-color': '#475569',
        'target-arrow-color': '#475569',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        opacity: 0.6,
        'transition-property': 'opacity, line-color, width',
        'transition-duration': '0.3s',
      },
    },
    {
      selector: '.config-edge',
      style: {
        width: 1.8,
        'line-color': '#f59e0b',
        'line-style': 'dashed',
        'line-dash-pattern': [7, 4],
        'target-arrow-color': '#f59e0b',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        opacity: 0.65,
      },
    },
    { selector: 'node:selected',      style: { 'border-width': 4, 'border-color': '#38bdf8', 'overlay-opacity': 0.2, 'overlay-color': '#38bdf8' } },
    { selector: '.faded',             style: { opacity: 0.05 } },
    { selector: '.highlighted-edge',  style: { width: 4, 'line-color': '#38bdf8', 'target-arrow-color': '#38bdf8', opacity: 1, 'z-index': 10 } },
    { selector: '.blast-root',        style: { 'background-color': '#ef4444', 'border-width': 4, 'border-color': '#b91c1c', color: '#fff', 'z-index': 100 } },
    { selector: '.blast-l1',          style: { 'background-color': '#f97316', 'z-index': 99 } },
    { selector: '.blast-l2',          style: { 'background-color': '#eab308', 'z-index': 98 } },
    { selector: '.blast-unaffected',  style: { opacity: 0.1, 'background-color': '#64748b' } },
  ];

  if (!initialData || !processedNodes.length) return (
    <div className="w-full h-full flex flex-col items-center justify-center text-blue-300">
      <Loader2 className="w-10 h-10 animate-spin mb-4" />
      <p>Synchronizing architecture...</p>
    </div>
  );

  return (
    <div className="w-full h-full relative">
      <CytoscapeComponent
        key={showConfig ? 'with-config' : 'no-config'}
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={stylesheet}
        layout={layout}
        wheelSensitivity={0.1}
        cy={(cy) => {
          cyRef.current = cy;
          if (!cyReady) setCyReady(true);

          cy.on('tap', 'node', (evt) => {
            const node = evt.target;
            const data = node.data();
            cy.batch(() => {
              cy.elements().removeClass('faded highlighted-edge');
              cy.elements().not(node.closedNeighborhood()).addClass('faded');
              node.connectedEdges().addClass('highlighted-edge');
            });
            const dependencies = cy.edges(`[source = "${data.id}"]`).length;
            const dependents   = cy.edges(`[target = "${data.id}"]`).length;
            if (onNodeSelect) onNodeSelect({ ...data, dependencies, dependents });
          });

          cy.on('tap', (evt) => {
            if (evt.target === cy) {
              cy.batch(() => { cy.elements().removeClass('faded highlighted-edge'); });
              if (onNodeSelect) onNodeSelect(null);
            }
          });
        }}
      />

      <div className="absolute bottom-6 left-6 bg-[#1e293b]/90 p-3 rounded-lg border border-white/5 text-[10px] text-gray-300 space-y-1.5 pointer-events-none z-10 shadow-2xl min-w-[130px]">
        <p className="font-bold text-white/50 uppercase tracking-widest text-[8px] mb-1">Source</p>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />Entry Points</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#60a5fa]" />Core Logic</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#9ca3af]" />Utilities</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#4ade80]" />Tests</div>
        {showConfig && (
          <>
            <div className="border-t border-white/10 my-1" />
            <p className="font-bold text-white/50 uppercase tracking-widest text-[8px] mb-1">Config ⬡</p>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-[#f59e0b]" />package.json</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-[#8b5cf6]" />tsconfig</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-[#f97316]" />vite/webpack</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-[#34d399]" />.env files</div>
          </>
        )}
      </div>
    </div>
  );
}
