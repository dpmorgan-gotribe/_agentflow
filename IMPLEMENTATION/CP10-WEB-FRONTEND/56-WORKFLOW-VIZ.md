# Step 56: Workflow Visualization

> **Checkpoint:** CP10 - Web Frontend
> **Previous Step:** 55-DASHBOARD-UI.md
> **Next Step:** 57-AGENT-MONITORING.md
> **Architecture Reference:** `ARCHITECTURE.md` - Workflow Visualization

---

## Overview

**Workflow Visualization** provides an interactive graph view of LangGraph workflow execution, showing agent nodes, transitions, and current execution state in real-time.

---

## Deliverables

1. `apps/web/src/components/features/WorkflowGraph.tsx` - Main graph component
2. `apps/web/src/components/features/WorkflowNode.tsx` - Node rendering
3. `apps/web/src/components/features/WorkflowEdge.tsx` - Edge rendering
4. `apps/web/src/hooks/useWorkflowGraph.ts` - Graph state management

---

## 1. Workflow Graph Component

```typescript
// apps/web/src/components/features/WorkflowGraph.tsx

import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { WorkflowNode } from './WorkflowNode';
import { useWorkflowGraph } from '../../hooks/useWorkflowGraph';

interface WorkflowGraphProps {
  taskId: string;
}

const nodeTypes = {
  agent: WorkflowNode,
};

export function WorkflowGraph({ taskId }: WorkflowGraphProps) {
  const { graphData, currentNode, executedNodes } = useWorkflowGraph(taskId);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!graphData) return;

    const layoutedNodes = graphData.nodes.map((node, index) => ({
      id: node.id,
      type: 'agent',
      position: { x: 100 + (index % 3) * 200, y: 100 + Math.floor(index / 3) * 150 },
      data: {
        ...node,
        isActive: currentNode === node.id,
        isExecuted: executedNodes.includes(node.id),
      },
    }));

    const layoutedEdges = graphData.edges.map((edge) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      animated: currentNode === edge.source,
      style: { stroke: executedNodes.includes(edge.source) ? '#10b981' : '#94a3b8' },
    }));

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [graphData, currentNode, executedNodes]);

  return (
    <div className="w-full h-96 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

---

## Validation Checklist

```
□ Workflow Visualization (Step 56)
  □ Graph renders correctly
  □ Nodes show agent states
  □ Edges animate during execution
  □ Real-time updates work
  □ Zoom and pan work
  □ Tests pass
```

---

## Next Step

Proceed to **57-AGENT-MONITORING.md** to implement agent status monitoring.
