import GraphCanvas from "./GraphCanvas";
import type { GraphEdge, GraphNode } from "../../types/graph";

interface CycloneGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  matchedNodeIds: string[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export default function CycloneGraph(props: CycloneGraphProps) {
  return <GraphCanvas {...props} />;
}
