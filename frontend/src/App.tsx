import React from "react";
import { useAppStore } from "./store";
import Header from "./components/Header";
import LandingPage from "./components/LandingPage";
import GraphView from "./components/GraphView";
import NodePanel from "./components/NodePanel";
import Sidebar from "./components/Sidebar";

const App: React.FC = () => {
  const { repoData } = useAppStore();

  if (!repoData) {
    return (
      <>
        <Header />
        <LandingPage />
      </>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0f172a",
        overflow: "hidden",
      }}
    >
      <Header />
      <div
        style={{
          display: "flex",
          flex: 1,
          marginTop: "60px",
          overflow: "hidden",
        }}
      >
        <Sidebar />
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <GraphView />
        </div>
        <div
          style={{
            width: "280px",
            background: "#0a0f1e",
            borderLeft: "1px solid #1e293b",
            overflowY: "auto",
          }}
        >
          <NodePanel />
        </div>
      </div>
    </div>
  );
};

export default App;
