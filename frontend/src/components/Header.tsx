import React from "react";
import { useAppStore } from "../store";

const Header: React.FC = () => {
  const { repoData, reset } = useAppStore();

  return (
    <header
      style={{
        background: "#0f172a",
        borderBottom: "1px solid #1e293b",
        padding: "0 24px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
          }}
        >
          🔍
        </div>
        <div>
          <h1
            style={{
              color: "#f1f5f9",
              fontSize: "18px",
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.3px",
            }}
          >
            RepoLens
          </h1>
          <p
            style={{
              color: "#64748b",
              fontSize: "11px",
              margin: 0,
            }}
          >
            See through any codebase. Instantly.
          </p>
        </div>
      </div>

      {repoData && (
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              background: "#1e293b",
              borderRadius: "8px",
              padding: "6px 12px",
              display: "flex",
              gap: "16px",
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: "12px" }}>
              <span style={{ color: "#6366f1", fontWeight: 600 }}>
                {repoData.total_files}
              </span>{" "}
              files
            </span>
            <span style={{ color: "#94a3b8", fontSize: "12px" }}>
              <span style={{ color: "#8b5cf6", fontWeight: 600 }}>
                {repoData.total_edges}
              </span>{" "}
              dependencies
            </span>
            <span style={{ color: "#94a3b8", fontSize: "12px" }}>
              <span style={{ color: "#f59e0b", fontWeight: 600 }}>
                {repoData.orphan_files.length}
              </span>{" "}
              orphans
            </span>
          </div>
          <button
            onClick={reset}
            style={{
              background: "transparent",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#94a3b8",
              padding: "6px 12px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Analyse New Repo
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
