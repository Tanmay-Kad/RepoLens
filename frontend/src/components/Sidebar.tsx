import React, { useState } from "react";
import { useAppStore } from "../store";
import { queryRepo } from "../api";

const Sidebar: React.FC = () => {
  const {
    repoData,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    queryResult,
    setQueryResult,
  } = useAppStore();
  const [query, setQuery] = useState("");
  const [querying, setQuerying] = useState(false);

  if (!repoData) return null;

  const handleQuery = async () => {
    if (!query.trim()) return;
    setQuerying(true);
    try {
      const result = await queryRepo(repoData.repo_name, query);
      setQueryResult(result);
    } catch (e) {
      setQueryResult({ answer: "Query failed.", relevant_files: [] });
    } finally {
      setQuerying(false);
    }
  };

  const tabs = [
    { id: "graph", label: "🗺️ Graph" },
    { id: "onboarding", label: "🛣️ Onboarding" },
    { id: "orphans", label: "👻 Orphans" },
    { id: "commits", label: "📜 Commits" },
  ] as const;

  return (
    <div
      style={{
        width: "300px",
        background: "#0f172a",
        borderRight: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #1e293b",
          padding: "8px 8px 0",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              background: activeTab === tab.id ? "#1e293b" : "transparent",
              border: "none",
              borderRadius: "8px 8px 0 0",
              color: activeTab === tab.id ? "#f1f5f9" : "#475569",
              padding: "8px 4px",
              fontSize: "10px",
              cursor: "pointer",
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {activeTab === "graph" && (
          <div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files..."
              style={{
                width: "100%",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f1f5f9",
                padding: "8px 12px",
                fontSize: "13px",
                marginBottom: "12px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />

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
                  margin: "0 0 10px",
                }}
              >
                ASK ABOUT THE CODEBASE
              </p>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleQuery()}
                placeholder="Where is auth handled?"
                style={{
                  width: "100%",
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                  color: "#f1f5f9",
                  padding: "7px 10px",
                  fontSize: "12px",
                  marginBottom: "8px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <button
                onClick={handleQuery}
                disabled={querying || !query.trim()}
                style={{
                  width: "100%",
                  background: "#6366f1",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  padding: "7px",
                  fontSize: "12px",
                  cursor: querying ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {querying ? "Searching..." : "Ask →"}
              </button>

              {queryResult && (
                <div style={{ marginTop: "10px" }}>
                  <p
                    style={{
                      color: "#cbd5e1",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      margin: "0 0 8px",
                    }}
                  >
                    {queryResult.answer}
                  </p>
                  {queryResult.relevant_files.length > 0 && (
                    <div>
                      <p
                        style={{
                          color: "#475569",
                          fontSize: "10px",
                          margin: "0 0 4px",
                        }}
                      >
                        RELEVANT FILES:
                      </p>
                      {queryResult.relevant_files.map((f, i) => (
                        <div
                          key={i}
                          style={{
                            background: "#0f172a",
                            borderRadius: "4px",
                            padding: "3px 6px",
                            marginBottom: "3px",
                            color: "#6366f1",
                            fontSize: "10px",
                            fontFamily: "monospace",
                          }}
                        >
                          {f}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "onboarding" && (
          <div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: 600,
                margin: "0 0 8px",
              }}
            >
              RECOMMENDED READING ORDER
            </p>
            <p
              style={{
                color: "#475569",
                fontSize: "12px",
                lineHeight: "1.5",
                margin: "0 0 12px",
              }}
            >
              {repoData.onboarding_explanation}
            </p>
            {repoData.onboarding_path.map((file, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  marginBottom: "8px",
                  background: "#1e293b",
                  borderRadius: "8px",
                  padding: "10px",
                }}
              >
                <div
                  style={{
                    minWidth: "24px",
                    height: "24px",
                    background: "#6366f1",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <p
                  style={{
                    color: "#cbd5e1",
                    fontSize: "12px",
                    margin: 0,
                    wordBreak: "break-all",
                    lineHeight: "1.4",
                  }}
                >
                  {file}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "orphans" && (
          <div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: 600,
                margin: "0 0 8px",
              }}
            >
              ORPHAN / DEAD FILES ({repoData.orphan_files.length})
            </p>
            <p
              style={{
                color: "#475569",
                fontSize: "12px",
                lineHeight: "1.5",
                margin: "0 0 12px",
              }}
            >
              These files have no connections — they may be dead code or
              undocumented modules.
            </p>
            {repoData.orphan_files.length === 0 ? (
              <p style={{ color: "#22c55e", fontSize: "13px" }}>
                No orphan files found!
              </p>
            ) : (
              repoData.orphan_files.map((file, i) => (
                <div
                  key={i}
                  style={{
                    background: "#1e293b",
                    borderRadius: "8px",
                    padding: "10px",
                    marginBottom: "6px",
                    borderLeft: "3px solid #f59e0b",
                  }}
                >
                  <p
                    style={{
                      color: "#fbbf24",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      margin: 0,
                      wordBreak: "break-all",
                    }}
                  >
                    {file}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "commits" && (
          <div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: 600,
                margin: "0 0 8px",
              }}
            >
              COMMIT HISTORY (last 50)
            </p>
            {repoData.commit_history.length === 0 ? (
              <p style={{ color: "#475569", fontSize: "12px" }}>
                No commit history available.
              </p>
            ) : (
              repoData.commit_history.map((commit, i) => (
                <div
                  key={i}
                  style={{
                    background: "#1e293b",
                    borderRadius: "8px",
                    padding: "10px",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        color: "#6366f1",
                        fontSize: "10px",
                        fontFamily: "monospace",
                      }}
                    >
                      {commit.hash}
                    </span>
                    <span style={{ color: "#475569", fontSize: "10px" }}>
                      {new Date(commit.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p
                    style={{
                      color: "#cbd5e1",
                      fontSize: "12px",
                      margin: "0 0 4px",
                      lineHeight: "1.3",
                    }}
                  >
                    {commit.message.slice(0, 80)}
                    {commit.message.length > 80 ? "..." : ""}
                  </p>
                  <p style={{ color: "#475569", fontSize: "10px", margin: 0 }}>
                    by {commit.author} · {commit.files_changed.length} files
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
