import React, { useRef, useEffect } from "react";
import { useAppStore } from "../store";
import cytoscape from "cytoscape";

const NODE_COLORS: Record<string, string> = {
  entry: "#6366f1",
  business: "#8b5cf6",
  utility: "#14b8a6",
  external: "#f59e0b",
  config: "#64748b",
};

const GraphView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const { repoData, setSelectedNode, searchTerm } = useAppStore();

  useEffect(() => {
    if (!repoData || !containerRef.current) return;

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const filteredNodes = repoData.nodes.filter(
      (n) =>
        !searchTerm || n.id.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

    const elements = [
      ...filteredNodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          node_type: node.node_type,
          impact_score: node.impact_score,
          summary: node.summary,
          in_degree: node.in_degree,
          imports: node.imports,
        },
      })),
      ...repoData.edges
        .filter(
          (e) =>
            filteredNodeIds.has(e.source) &&
            filteredNodeIds.has(e.target) &&
            e.source !== e.target,
        )
        .map((edge) => ({
          data: {
            source: edge.source,
            target: edge.target,
            id: `edge-${edge.source}-${edge.target}`,
          },
        })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: any) =>
              NODE_COLORS[ele.data("node_type")] || "#64748b",
            label: "data(label)",
            color: "#f1f5f9",
            "font-size": "10px",
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 4,
            width: (ele: any) =>
              Math.max(24, Math.min(60, 24 + ele.data("impact_score") * 2)),
            height: (ele: any) =>
              Math.max(24, Math.min(60, 24 + ele.data("impact_score") * 2)),
            "border-width": 2,
            "border-color": (ele: any) =>
              NODE_COLORS[ele.data("node_type")] || "#64748b",
            "border-opacity": 0.8,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#ffffff",
            "background-color": "#ffffff",
            color: "#0f172a",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#334155",
            "target-arrow-color": "#475569",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.6,
          },
        },
        {
          selector: "edge:selected",
          style: {
            "line-color": "#6366f1",
            "target-arrow-color": "#6366f1",
            opacity: 1,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        randomize: true,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 100,
        edgeElasticity: () => 100,
        gravity: 1,
        numIter: 1000,
        fit: true,
        padding: 40,
      } as any,
      wheelSensitivity: 0.3,
    });

    cy.on("tap", "node", (evt: any) => {
      const nodeData = evt.target.data();
      setSelectedNode({
        id: nodeData.id,
        label: nodeData.label,
        node_type: nodeData.node_type,
        impact_score: nodeData.impact_score,
        in_degree: nodeData.in_degree,
        imports: nodeData.imports,
        summary: nodeData.summary,
      });
    });

    cy.on("tap", (evt: any) => {
      if (evt.target === cy) setSelectedNode(null);
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [repoData, searchTerm]);

  if (!repoData) return null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#0f172a",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "16px",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "10px",
          padding: "12px 16px",
          zIndex: 10,
        }}
      >
        <p
          style={{
            color: "#94a3b8",
            fontSize: "11px",
            margin: "0 0 8px",
            fontWeight: 600,
          }}
        >
          Node Types
        </p>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div
            key={type}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: color,
              }}
            />
            <span
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                textTransform: "capitalize",
              }}
            >
              {type}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => cyRef.current?.fit()}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
            color: "#94a3b8",
            padding: "8px 12px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Fit Graph
        </button>
        <button
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
            color: "#94a3b8",
            padding: "8px 12px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Zoom In
        </button>
        <button
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
            color: "#94a3b8",
            padding: "8px 12px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Zoom Out
        </button>
      </div>
    </div>
  );
};

export default GraphView;
