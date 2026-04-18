import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import { cyStyle } from "./cytoscapeStyle";
import type { GraphEdge, GraphNode } from "../../types/graph";

cytoscape.use(coseBilkent);

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  matchedNodeIds: string[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export default function GraphCanvas({
  nodes,
  edges,
  matchedNodeIds,
  selectedNodeId,
  onSelectNode,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const elements = [
      ...nodes.map((node) => ({ data: node })),
      ...edges.map((edge) => ({ data: edge })),
    ];
    cyRef.current?.destroy();
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: cyStyle,
      layout: { name: "cose-bilkent" },
    });
    cy.on("tap", "node", (event) => {
      const nodeId = String(event.target.id());
      onSelectNode(nodeId);
    });
    cy.on("tap", (event) => {
      if (event.target === cy) {
        onSelectNode(null);
      }
    });
    cyRef.current = cy;
    return () => cy.destroy();
  }, [nodes, edges, onSelectNode]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.nodes().removeClass("matched");
    matchedNodeIds.forEach((nodeId) => cy.getElementById(nodeId).addClass("matched"));
  }, [matchedNodeIds]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.nodes().unselect();
    if (selectedNodeId) {
      const node = cy.getElementById(selectedNodeId);
      if (node.nonempty()) {
        node.select();
      }
    }
  }, [selectedNodeId]);

  return (
    <div className="relative h-[680px] w-full overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-2xl shadow-slate-950/40">
      <div className="absolute left-3 top-3 z-10 rounded-full border border-cyan-300/30 bg-slate-800/85 px-3 py-1 text-[11px] font-semibold text-cyan-200">
        Cyclone Graph Engine
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
