import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import { Loader2, Focus } from 'lucide-react';

export default function GraphView3D({ repoId, initialData, searchQuery = '', onNodeSelect, simulationConfig, onSimulationUpdate, externalSelectedNodeId, showConfig = true }) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      setDimensions({
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  
  // Create memoized base graph data matching react-force-graph format
  // Respects showConfig toggle — config nodes come from initialData.nodes (isConfig: true)
  const baseData = useMemo(() => {
    if (!initialData || !initialData.nodes) return { nodes: [], links: [] };

    const CONFIG_COLORS_3D = {
      pkg: '#f59e0b', 'pkg-lock': '#d97706', tsconfig: '#8b5cf6', jsconfig: '#7c3aed',
      vite: '#f97316', webpack: '#fb923c', babel: '#facc15', eslint: '#a78bfa',
      prettier: '#c084fc', env: '#34d399', jest: '#f87171', vitest: '#fb7185',
      tailwind: '#38bdf8', postcss: '#67e8f9', next: '#e2e8f0', nuxt: '#4ade80',
      docker: '#60a5fa', ci: '#a3e635', make: '#94a3b8',
    };

    const filteredNodes = initialData.nodes.filter(n =>
      showConfig ? true : !n.isConfig
    );
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

    return {
      nodes: filteredNodes.map(n => ({
        id:         n.id,
        label:      n.isConfig && n.filePath && n.filePath.includes('/') 
          ? `${n.filePath.split('/').slice(0, -1).join('/')}/${n.label}` 
          : (n.label || n.id.split('/').pop()),
        fullPath:   n.filePath || n.id,
        nodeType:   n.isConfig ? 'config' : 'source',
        configType: n.type || null,
        color3d:    n.isConfig
          ? (CONFIG_COLORS_3D[n.type] || '#f59e0b')
          : null,
      })),
      links: (initialData.edges || []).filter(e =>
        filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
      ).map(e => ({
        source:   e.source,
        target:   e.target,
        edgeType: e.source.startsWith('__config__') ? 'config' : 'source',
      })),
    };
  }, [initialData, showConfig]);

  // Handle Blast Radius Simulation & Selection logic
  const { displayData, simulationMetrics } = useMemo(() => {
    if (!baseData.nodes.length) return { displayData: baseData, simulationMetrics: null };

    // Create a working copy
    const nodes = baseData.nodes.map(n => ({ ...n }));
    const links = baseData.links.map(l => ({ ...l }));

    let metrics = null;

    if (simulationConfig && simulationConfig.active && simulationConfig.rootNodeId) {
      // Find root node natively (handle normalized slashes)
      const rootId = simulationConfig.rootNodeId.replace(/\\/g, '/');
      const rootNode = nodes.find(n => n.id === rootId || n.fullPath === rootId);
      
      if (rootNode) {
        const q = [{ node: rootNode, level: 0 }];
        const visited = new Set();
        visited.add(rootNode.id);

        let totalImpacted = 0;
        let maxDepth = 0;
        const impactedFiles = [];

        while (q.length > 0) {
          const { node, level } = q.shift();
          maxDepth = Math.max(maxDepth, level);
          if (level > 0) {
            totalImpacted++;
            impactedFiles.push({ id: node.id, level });
          }

          node.blastLevel = level;

          // Find inward edges (target == node.id)
          const edgesIn = links.filter(l => l.target === node.id || (l.target && l.target.id === node.id));
          
          edgesIn.forEach(edge => {
            edge.isBlastPath = true; // Mark edge for animation
            const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
            if (!visited.has(sourceId)) {
              visited.add(sourceId);
              const sourceNode = nodes.find(n => n.id === sourceId);
              if (sourceNode) {
                q.push({ node: sourceNode, level: level + 1 });
              }
            }
          });
        }

        nodes.forEach(n => {
          if (!visited.has(n.id)) n.isUnaffected = true;
        });

        // Calculate Risk Score
        let riskScore = Math.min(100, Math.round(totalImpacted * 5 + maxDepth * 10));
        if (simulationConfig.severity === 'High') riskScore = Math.min(100, Math.round(riskScore * 1.5));
        if (simulationConfig.severity === 'Low') riskScore = Math.round(riskScore * 0.6);

        metrics = { totalImpacted, depth: maxDepth, riskScore, impactedFiles };
      }
    }

    return { displayData: { nodes, links }, simulationMetrics: metrics };
  }, [baseData, simulationConfig]);

  // Configure physics spread
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-120);
      fgRef.current.d3Force('link').distance(50);
    }
  }, []);

  // Report simulation update back to dashboard
  useEffect(() => {
    if (onSimulationUpdate && simulationMetrics) {
      onSimulationUpdate(simulationMetrics);
    }
  }, [simulationMetrics, onSimulationUpdate]);

  useEffect(() => {
    if (externalSelectedNodeId && fgRef.current && displayData.nodes.length > 0) {
      const normId = externalSelectedNodeId.replace(/\\/g, '/');
      const node = displayData.nodes.find(n => n.id === normId || n.fullPath === normId);
      if (node) {
        const distance = 100;
        const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
        fgRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
          node, 
          2000 
        );
      }
    }
  }, [externalSelectedNodeId, displayData.nodes]);

  const determineTypeAndColor = (node) => {
    if (node.color3d) return node.color3d; // pre-computed config colour
    const lowerId = (node.id || '').toLowerCase();
    if (lowerId.includes('test') || lowerId.includes('spec')) return '#4ade80';
    if (lowerId.includes('util') || lowerId.includes('helper')) return '#9ca3af';
    if (lowerId.includes('controller') || lowerId.includes('service') || lowerId.includes('model') || lowerId.includes('route')) return '#60a5fa';
    const base = lowerId.split('/').pop();
    if (['index.js','main.js','server.js','app.js','index.ts','main.ts','app.ts'].includes(base)) return '#fbbf24';
    return '#94a3b8';
  };

  const handleNodeClick = (node) => {
    if (onNodeSelect) {
      const deps      = displayData.links.filter(l => l.source.id === node.id || l.source === node.id).length;
      const dependents = displayData.links.filter(l => l.target.id === node.id || l.target === node.id).length;
      onNodeSelect({
        id:         node.id,
        label:      node.label,
        fullPath:   node.fullPath,
        nodeType:   node.nodeType,
        configType: node.configType,
        color:      determineTypeAndColor(node),
        dependencies: deps,
        dependents:   dependents,
      });
    }

    // Aim camera at node
    const distance = 100;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    if (fgRef.current) {
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
        node, 
        2000 
      );
    }
  };

  if (!initialData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-blue-300">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p>Loading 3D space...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair overflow-hidden">
      {dimensions.width > 0 && (
        <ForceGraph3D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={displayData}
          backgroundColor="#020617"
        showNavInfo={false}
        
        nodeLabel="fullPath"
        nodeThreeObjectExtend={true}
        nodeThreeObject={node => {
          const sprite = new SpriteText(node.label);
          sprite.textHeight = 3;
          sprite.position.y = node.blastLevel !== undefined && node.blastLevel <= 2 ? 10 : 6;
          
          if (node.isUnaffected) {
            sprite.color = 'rgba(100, 116, 139, 0.1)';
          } else if (searchQuery && !node.fullPath.toLowerCase().includes(searchQuery.toLowerCase())) {
            sprite.color = 'rgba(100, 116, 139, 0.1)';
          } else {
            sprite.color = 'rgba(255, 255, 255, 0.8)';
          }
          return sprite;
        }}
        
        nodeColor={node => {
          if (node.blastLevel === 0) return '#ef4444';
          if (node.blastLevel === 1) return '#f97316';
          if (node.blastLevel >= 2)  return '#eab308';
          if (node.isUnaffected)     return 'rgba(100, 116, 139, 0.1)';
          if (searchQuery && !node.fullPath.toLowerCase().includes(searchQuery.toLowerCase())) {
            return 'rgba(100, 116, 139, 0.1)';
          }
          return determineTypeAndColor(node);
        }}
        nodeVal={node => {
          if (node.blastLevel !== undefined && node.blastLevel <= 2) return 8;
          if (node.nodeType === 'config') return 6; // slightly larger sphere
          return 3;
        }}
        nodeOpacity={1}
        nodeResolution={16}
        
        linkColor={link => {
          if (link.isBlastPath) return '#ef4444';
          if (link.edgeType === 'config') return 'rgba(245,158,11,0.6)';
          return 'rgba(255,255,255,0.3)';
        }}
        linkWidth={link => link.isBlastPath ? 2 : link.edgeType === 'config' ? 1.5 : 1}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={link => link.isBlastPath ? 4 : link.edgeType === 'config' ? 2 : 0}
        linkDirectionalParticleColor={link => link.edgeType === 'config' ? '#f59e0b' : '#ef4444'}
        linkDirectionalParticleSpeed={0.01}
        
        onNodeClick={handleNodeClick}
        />
      )}
      
      {/* HUD Info */}
      <div className="absolute bottom-6 left-6 bg-[#1e293b]/90 p-3 rounded-lg border border-white/5 text-[10px] text-gray-300 space-y-2 pointer-events-none z-10 shadow-2xl">
        <div className="flex items-center gap-2 pt-1 font-bold text-white mb-2">3D Mouse Controls</div>
        <div className="flex items-center gap-2"><div className="px-2 py-1 rounded bg-white/10 flex items-center justify-center border border-white/20 whitespace-nowrap">Left Click</div> Rotate</div>
        <div className="flex items-center gap-2"><div className="px-2 py-1 rounded bg-white/10 flex items-center justify-center border border-white/20 whitespace-nowrap">Right Click</div> Pan</div>
        <div className="flex items-center gap-2"><div className="px-2 py-1 rounded bg-white/10 flex items-center justify-center border border-white/20 whitespace-nowrap">Scroll Wheel</div> Zoom</div>
      </div>

      <button 
        className="absolute bottom-6 right-6 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 transition-colors shadow-2xl z-20 flex items-center gap-2 text-xs font-bold"
        onClick={() => {
          if (fgRef.current) {
            fgRef.current.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 1000);
          }
        }}
      >
        <Focus className="w-4 h-4" />
        Reset Camera
      </button>

    </div>
  );
}
