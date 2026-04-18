import React from "react";
import { useAppStore } from "../store";

const NODE_COLORS: Record<string, string> = {
  entry: "#6366f1",
  business: "#8b5cf6",
  utility: "#14b8a6",
  external: "#f59e0b",
  config: "#64748b",
};

const NodePanel: React.FC = () => {
  const { selectedNode, repoData } = useAppStore();

  if (!selectedNode)
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          fontSize: "13px",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>👆</div>
        <p>Click any node in the graph to see its details</p>
      </div>
    );

  const onboardingPosition = repoData?.onboarding_path.indexOf(selectedNode.id);

  return (
    <div style={{ padding: "16px", overflowY: "auto", height: "100%" }}>
      <div
        style={{
          background: "#1e293b",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "12px",
          borderLeft: `4px solid ${NODE_COLORS[selectedNode.node_type]}`,
        }}
      >
        <p
          style={{
            color: "#f1f5f9",
            fontSize: "14px",
            fontWeight: 600,
            margin: "0 0 4px",
            wordBreak: "break-all",
          }}
        >
          {selectedNode.label}
        </p>
        <p
          style={{
            color: "#64748b",
            fontSize: "11px",
            margin: "0 0 8px",
            wordBreak: "break-all",
          }}
        >
          {selectedNode.id}
        </p>
        <span
          style={{
            background: NODE_COLORS[selectedNode.node_type] + "33",
            color: NODE_COLORS[selectedNode.node_type],
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "6px",
            fontWeight: 600,
            textTransform: "capitalize",
          }}
        >
          {selectedNode.node_type}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            background: "#1e293b",
            borderRadius: "8px",
            padding: "10px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "#6366f1",
              fontSize: "20px",
              fontWeight: 700,
              margin: "0 0 2px",
            }}
          >
            {selectedNode.impact_score.toFixed(1)}
          </p>
          <p style={{ color: "#64748b", fontSize: "10px", margin: 0 }}>
            Impact Score
          </p>
        </div>
        <div
          style={{
            background: "#1e293b",
            borderRadius: "8px",
            padding: "10px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "#8b5cf6",
              fontSize: "20px",
              fontWeight: 700,
              margin: "0 0 2px",
            }}
          >
            {selectedNode.in_degree}
          </p>
          <p style={{ color: "#64748b", fontSize: "10px", margin: 0 }}>
            Imported By
          </p>
        </div>
      </div>

      {onboardingPosition !== undefined && onboardingPosition !== -1 && (
        <div
          style={{
            background: "#1e1b4b",
            border: "1px solid #3730a3",
            borderRadius: "8px",
            padding: "10px",
            marginBottom: "12px",
          }}
        >
          <p style={{ color: "#a5b4fc", fontSize: "12px", margin: 0 }}>
            📚 Onboarding position: <strong>#{onboardingPosition + 1}</strong>
          </p>
        </div>
      )}

      <div
        style={{
          background: "#1e293b",
          borderRadius: "8px",
          padding: "12px",
          marginBottom: "12px",
        }}
      >
        <p
          style={{
            color: "#94a3b8",
            fontSize: "11px",
            fontWeight: 600,
            margin: "0 0 8px",
          }}
        >
          AI SUMMARY
        </p>
        <p
          style={{
            color: "#cbd5e1",
            fontSize: "13px",
            lineHeight: "1.6",
            margin: 0,
          }}
        >
          {selectedNode.summary || "No summary available."}
        </p>
      </div>

      {selectedNode.imports.length > 0 && (
        <div
          style={{
            background: "#1e293b",
            borderRadius: "8px",
            padding: "12px",
          }}
        >
          <p
            style={{
              color: "#94a3b8",
              fontSize: "11px",
              fontWeight: 600,
              margin: "0 0 8px",
            }}
          >
            IMPORTS ({selectedNode.imports.length})
          </p>
          <div style={{ maxHeight: "150px", overflowY: "auto" }}>
            {selectedNode.imports.map((imp, i) => (
              <div
                key={i}
                style={{
                  background: "#0f172a",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  marginBottom: "4px",
                  color: "#64748b",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                }}
              >
                {imp}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NodePanel;
