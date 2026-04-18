import { useMemo, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import useGraphStore from "../store/useGraphStore";

const colors = {
  entry: "#7F77DD",
  core: "#D85A30",
  utility: "#1D9E75",
  external: "#888780",
  highlight: "#EF9F27"
};

export default function GraphCanvas() {
  const fgRef = useRef(null);
  const { graph, highlightedNodes, setSelectedNode } = useGraphStore();

  const data = useMemo(() => graph || { nodes: [], links: [] }, [graph]);
  const links = useMemo(() => (graph ? graph.edges.map((e) => ({ source: e.source, target: e.target })) : []), [graph]);

  return (
    <div className="relative h-full w-full bg-bg">
      <ForceGraph2D
        ref={fgRef}
        graphData={{ nodes: data.nodes, links }}
        backgroundColor="#0f0f0f"
        nodeRelSize={4}
        linkWidth={0.8}
        linkColor={() => "rgba(255,255,255,0.18)"}
        onNodeClick={(node) => setSelectedNode(node.id)}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const isHighlighted = highlightedNodes.includes(node.id);
          const color = isHighlighted ? colors.highlight : colors[node.type] || "#999";
          const size = Math.min(18, 4 + (node.riskScore || 0) * 0.8);

          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          if (node.isHighRisk) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 2, 0, Math.PI * 2);
            ctx.strokeStyle = "#ff4d4d";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          const label = node.label || node.id;
          const fontSize = 11 / globalScale;
          ctx.font = `${fontSize}px Inter, system-ui`;
          ctx.fillStyle = "#ddd";
          ctx.fillText(label, node.x + size + 2, node.y + 3);
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
      />
      <div className="absolute bottom-4 left-4 rounded-md border border-border bg-surface/90 p-3 text-xs text-muted">
        <p>Legend</p>
        <p className="text-[#7F77DD]">Entry</p>
        <p className="text-[#D85A30]">Core</p>
        <p className="text-[#1D9E75]">Utility</p>
        <p className="text-[#888780]">External</p>
        <p className="text-[#EF9F27]">Search Highlight</p>
      </div>
    </div>
  );
}
