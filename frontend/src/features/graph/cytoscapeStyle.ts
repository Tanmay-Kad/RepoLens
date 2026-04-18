import type { NodeSingular } from "cytoscape";

const LAYER_COLORS: Record<string, string> = {
  entry: "#D85A30",
  service: "#7F77DD",
  model: "#1D9E75",
  api: "#378ADD",
  util: "#888780",
  config: "#EF9F27",
  test: "#B4B2A9",
  worker: "#D4537E",
  ai: "#9FE1CB",
  module: "#D3D1C7",
};

export const cyStyle: any[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "background-color": (ele: NodeSingular) =>
        LAYER_COLORS[ele.data("layer")] ?? LAYER_COLORS.module,
      width: (ele: NodeSingular) => 30 + Number(ele.data("risk_score") ?? 0) * 40,
      height: (ele: NodeSingular) => 30 + Number(ele.data("risk_score") ?? 0) * 40,
      color: "#E6EDF6",
      "text-valign": "center",
      "text-halign": "center",
      "font-size": 10,
      "text-wrap": "wrap",
      "text-max-width": 88,
      "border-color": "#0F172A",
      "border-width": 1.5,
      "overlay-opacity": "0",
    },
  },
  {
    selector: "edge",
    style: {
      width: 1,
      "line-color": "#94A3B8",
      opacity: 0.4,
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#94A3B8",
      "curve-style": "straight",
    },
  },
  {
    selector: "node[is_orphan = true]",
    style: {
      "border-style": "dashed",
      opacity: 0.5,
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 3,
      "border-color": "#F8FAFC",
    },
  },
  {
    selector: "node.matched",
    style: {
      "border-width": 3,
      "border-color": "#FAC775",
    },
  },
];
