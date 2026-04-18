import React, { useState } from "react";
import { useAppStore } from "../store";
import { analyzeRepo } from "../api";

const LandingPage: React.FC = () => {
  const [url, setUrl] = useState("");
  const { setRepoData, setLoading, setError, isLoading, error } = useAppStore();

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeRepo(url.trim());
      setRepoData(data);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Failed to analyze repository. Please check the URL and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAnalyze();
  };

  const exampleRepos = [
    "https://github.com/pallets/flask",
    "https://github.com/tiangolo/fastapi",
    "https://github.com/psf/requests",
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div
          style={{
            width: "72px",
            height: "72px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            borderRadius: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "36px",
            margin: "0 auto 24px",
          }}
        >
          🔍
        </div>
        <h1
          style={{
            color: "#f1f5f9",
            fontSize: "48px",
            fontWeight: 800,
            margin: "0 0 12px",
            letterSpacing: "-1px",
          }}
        >
          RepoLens
        </h1>
        <p
          style={{
            color: "#64748b",
            fontSize: "20px",
            margin: "0 0 8px",
          }}
        >
          See through any codebase. Instantly.
        </p>
        <p
          style={{
            color: "#475569",
            fontSize: "15px",
            maxWidth: "500px",
            lineHeight: "1.6",
          }}
        >
          Paste a GitHub URL and get an interactive architecture map, AI-powered
          file summaries, and a personalized onboarding path — in seconds.
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "12px",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "14px",
            padding: "8px",
          }}
        >
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="https://github.com/username/repository"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#f1f5f9",
              fontSize: "15px",
              padding: "8px 12px",
            }}
          />
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !url.trim()}
            style={{
              background: isLoading
                ? "#4338ca"
                : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
              borderRadius: "10px",
              color: "white",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isLoading ? "Analysing..." : "Analyse Repo →"}
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#450a0a",
              border: "1px solid #7f1d1d",
              borderRadius: "10px",
              padding: "12px 16px",
              marginTop: "12px",
              color: "#fca5a5",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {isLoading && (
          <div
            style={{
              background: "#1e1b4b",
              border: "1px solid #3730a3",
              borderRadius: "10px",
              padding: "16px",
              marginTop: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: "#a5b4fc",
                fontSize: "14px",
                marginBottom: "8px",
              }}
            >
              Cloning repository and analysing architecture...
            </div>
            <div style={{ color: "#6366f1", fontSize: "12px" }}>
              This may take 1-2 minutes for large repos
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#475569", fontSize: "12px", marginBottom: "12px" }}>
          Try an example:
        </p>
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {exampleRepos.map((repo) => (
            <button
              key={repo}
              onClick={() => setUrl(repo)}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#94a3b8",
                padding: "6px 12px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {repo.replace("https://github.com/", "")}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "32px",
          marginTop: "64px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {[
          {
            icon: "🗺️",
            title: "Visual Architecture Map",
            desc: "Interactive graph of every file and dependency",
          },
          {
            icon: "🤖",
            title: "AI File Summaries",
            desc: "Plain English explanation of every file",
          },
          {
            icon: "🛣️",
            title: "Onboarding Path",
            desc: "Ordered reading list for new developers",
          },
          {
            icon: "🔍",
            title: "Natural Language Search",
            desc: "Ask questions about the codebase",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            style={{
              textAlign: "center",
              maxWidth: "140px",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>
              {feature.icon}
            </div>
            <p
              style={{
                color: "#e2e8f0",
                fontSize: "13px",
                fontWeight: 600,
                margin: "0 0 4px",
              }}
            >
              {feature.title}
            </p>
            <p
              style={{
                color: "#475569",
                fontSize: "11px",
                margin: 0,
                lineHeight: "1.4",
              }}
            >
              {feature.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LandingPage;
