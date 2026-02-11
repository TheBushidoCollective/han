---
name: reactflow-fundamentals
user-invocable: false
description: Use when building node-based UIs, flow diagrams, workflow editors, or interactive graphs with React Flow. Covers setup, nodes, edges, controls, and interactivity.
allowed-tools:
  - Bash
  - Read
---

# React Flow Fundamentals

Build customizable node-based editors and interactive diagrams with React Flow.
This skill covers core concepts, setup, and common patterns for creating
flow-based interfaces.

## Installation

```bash
# npm
npm install @xyflow/react

# pnpm
pnpm add @xyflow/react

# yarn
yarn add @xyflow/react
```

## Basic Setup

```tsx
import { useCallback } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnConnect,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 250, y: 0 },
  },
  {
    id: '2',
    data: { label: 'Process' },
    position: { x: 250, y: 100 },
  },
  {
    id: '3',
    type: 'output',
    data: { label: 'End' },
    position: { x: 250, y: 200 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
];

export default function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

## Node Types

### Built-in Node Types

```tsx
const nodes: Node[] = [
  // Input node - only has source handles
  {
    id: '1',
    type: 'input',
    data: { label: 'Input Node' },
    position: { x: 0, y: 0 },
  },
  // Default node - has both source and target handles
  {
    id: '2',
    type: 'default',
    data: { label: 'Default Node' },
    position: { x: 0, y: 100 },
  },
  // Output node - only has target handles
  {
    id: '3',
    type: 'output',
    data: { label: 'Output Node' },
    position: { x: 0, y: 200 },
  },
];
```

### Node Configuration

```tsx
const node: Node = {
  id: 'unique-id',
  type: 'default',
  position: { x: 100, y: 100 },
  data: { label: 'My Node', customProp: 'value' },
  // Optional properties
  style: { backgroundColor: '#f0f0f0' },
  className: 'custom-node',
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  draggable: true,
  selectable: true,
  connectable: true,
  deletable: true,
  hidden: false,
  selected: false,
  dragging: false,
  zIndex: 0,
  extent: 'parent', // Constrain to parent node
  parentId: 'parent-node-id', // For nested nodes
  expandParent: true, // Expand parent when node is outside bounds
};
```

## Edge Types

### Built-in Edge Types

```tsx
import { MarkerType } from '@xyflow/react';

const edges: Edge[] = [
  // Default edge (bezier curve)
  {
    id: 'e1',
    source: '1',
    target: '2',
    type: 'default',
  },
  // Straight line
  {
    id: 'e2',
    source: '2',
    target: '3',
    type: 'straight',
  },
  // Step edge (right angles)
  {
    id: 'e3',
    source: '3',
    target: '4',
    type: 'step',
  },
  // Smoothstep edge (rounded corners)
  {
    id: 'e4',
    source: '4',
    target: '5',
    type: 'smoothstep',
  },
];
```

### Edge Configuration

```tsx
const edge: Edge = {
  id: 'edge-id',
  source: 'source-node-id',
  target: 'target-node-id',
  // Optional properties
  type: 'smoothstep',
  sourceHandle: 'handle-a',
  targetHandle: 'handle-b',
  label: 'Edge Label',
  labelStyle: { fill: '#333', fontWeight: 700 },
  labelBgStyle: { fill: '#fff' },
  labelBgPadding: [8, 4],
  labelBgBorderRadius: 4,
  style: { stroke: '#333', strokeWidth: 2 },
  animated: true,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#333',
  },
  markerStart: {
    type: MarkerType.Arrow,
  },
  interactionWidth: 20,
  deletable: true,
  selectable: true,
  selected: false,
  hidden: false,
  zIndex: 0,
  data: { customProp: 'value' },
};
```

## Handles

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';

function CustomNode({ data }: NodeProps) {
  return (
    <div className="custom-node">
      {/* Target handle (input) */}
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        style={{ background: '#555' }}
        isConnectable={true}
      />

      <div>{data.label}</div>

      {/* Multiple source handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output-a"
        style={{ left: '25%', background: '#555' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="output-b"
        style={{ left: '75%', background: '#555' }}
      />
    </div>
  );
}
```

## Plugin Components

### Background

```tsx
import { Background, BackgroundVariant } from '@xyflow/react';

<ReactFlow nodes={nodes} edges={edges}>
  {/* Dots pattern */}
  <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

  {/* Lines pattern */}
  <Background variant={BackgroundVariant.Lines} gap={20} />

  {/* Cross pattern */}
  <Background variant={BackgroundVariant.Cross} gap={25} />

  {/* Custom styling */}
  <Background
    color="#aaa"
    gap={16}
    size={1}
    variant={BackgroundVariant.Dots}
  />
</ReactFlow>
```

### Controls

```tsx
import { Controls } from '@xyflow/react';

<ReactFlow nodes={nodes} edges={edges}>
  <Controls
    showZoom={true}
    showFitView={true}
    showInteractive={true}
    position="bottom-left"
  />
</ReactFlow>
```

### MiniMap

```tsx
import { MiniMap } from '@xyflow/react';

<ReactFlow nodes={nodes} edges={edges}>
  <MiniMap
    nodeColor={(node) => {
      switch (node.type) {
        case 'input':
          return '#0041d0';
        case 'output':
          return '#ff0072';
        default:
          return '#1a192b';
      }
    }}
    nodeStrokeWidth={3}
    zoomable
    pannable
  />
</ReactFlow>
```

### Panel

```tsx
import { Panel } from '@xyflow/react';

<ReactFlow nodes={nodes} edges={edges}>
  <Panel position="top-left">
    <button onClick={onSave}>Save</button>
    <button onClick={onRestore}>Restore</button>
  </Panel>

  <Panel position="top-right">
    <div>Node count: {nodes.length}</div>
  </Panel>
</ReactFlow>
```

## Event Handling

```tsx
import {
  ReactFlow,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnSelectionChangeFunc,
} from '@xyflow/react';

function Flow() {
  // Node events
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    console.log('Node clicked:', node.id);
  }, []);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((event, node) => {
    console.log('Node double clicked:', node.id);
  }, []);

  const onNodeDragStart: NodeMouseHandler = useCallback((event, node) => {
    console.log('Drag started:', node.id);
  }, []);

  const onNodeDrag: NodeMouseHandler = useCallback((event, node) => {
    console.log('Dragging:', node.position);
  }, []);

  const onNodeDragStop: NodeMouseHandler = useCallback((event, node) => {
    console.log('Drag stopped:', node.position);
  }, []);

  // Edge events
  const onEdgeClick: EdgeMouseHandler = useCallback((event, edge) => {
    console.log('Edge clicked:', edge.id);
  }, []);

  // Selection changes
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes, edges }) => {
      console.log('Selected nodes:', nodes);
      console.log('Selected edges:', edges);
    },
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      onEdgeClick={onEdgeClick}
      onSelectionChange={onSelectionChange}
    />
  );
}
```

## Viewport Control

```tsx
import { useReactFlow } from '@xyflow/react';

function ViewportControls() {
  const { zoomIn, zoomOut, fitView, setCenter, setViewport, getViewport } =
    useReactFlow();

  return (
    <div>
      <button onClick={() => zoomIn()}>Zoom In</button>
      <button onClick={() => zoomOut()}>Zoom Out</button>
      <button onClick={() => fitView({ padding: 0.2 })}>Fit View</button>
      <button onClick={() => setCenter(0, 0, { zoom: 1 })}>Center</button>
      <button
        onClick={() => {
          const viewport = getViewport();
          console.log('Current viewport:', viewport);
        }}
      >
        Log Viewport
      </button>
    </div>
  );
}

// Must be used inside ReactFlowProvider
function App() {
  return (
    <ReactFlowProvider>
      <Flow />
      <ViewportControls />
    </ReactFlowProvider>
  );
}
```

## Node Operations with useReactFlow

```tsx
import { useReactFlow, type Node } from '@xyflow/react';

function NodeOperations() {
  const { getNodes, setNodes, getNode, addNodes, deleteElements } =
    useReactFlow();

  const addNewNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      data: { label: 'New Node' },
      position: { x: Math.random() * 300, y: Math.random() * 300 },
    };
    addNodes(newNode);
  };

  const updateNode = (id: string, data: object) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      )
    );
  };

  const deleteNode = (id: string) => {
    deleteElements({ nodes: [{ id }] });
  };

  const getAllNodes = () => {
    const nodes = getNodes();
    console.log('All nodes:', nodes);
  };

  return (
    <div>
      <button onClick={addNewNode}>Add Node</button>
      <button onClick={getAllNodes}>Log Nodes</button>
    </div>
  );
}
```

## Saving and Restoring State

```tsx
import { useReactFlow, type ReactFlowJsonObject } from '@xyflow/react';

function SaveRestore() {
  const { toObject, setNodes, setEdges, setViewport } = useReactFlow();

  const onSave = useCallback(() => {
    const flow = toObject();
    localStorage.setItem('flow', JSON.stringify(flow));
  }, [toObject]);

  const onRestore = useCallback(() => {
    const restoreFlow = async () => {
      const flow = JSON.parse(
        localStorage.getItem('flow') || '{}'
      ) as ReactFlowJsonObject;

      if (flow.nodes && flow.edges) {
        setNodes(flow.nodes);
        setEdges(flow.edges);
        if (flow.viewport) {
          setViewport(flow.viewport);
        }
      }
    };

    restoreFlow();
  }, [setNodes, setEdges, setViewport]);

  return (
    <Panel position="top-right">
      <button onClick={onSave}>Save</button>
      <button onClick={onRestore}>Restore</button>
    </Panel>
  );
}
```

## When to Use This Skill

Use reactflow-fundamentals when you need to:

- Build workflow builders or no-code editors
- Create data pipeline visualizations
- Design state machine diagrams
- Build chatbot conversation flows
- Create organizational charts
- Design electrical circuit diagrams
- Build ML pipeline visualizers
- Create interactive decision trees

## Best Practices

- Use unique IDs for nodes and edges
- Memoize callbacks with useCallback
- Use TypeScript for type safety
- Keep node components pure and performant
- Use CSS classes instead of inline styles for complex styling
- Store flow state in a central state manager for complex apps
- Use fitView() on initial render for better UX
- Add keyboard shortcuts for common operations
- Implement undo/redo for better user experience
- Use node validation before connections

## Resources

- [React Flow Documentation](https://reactflow.dev/docs)
- [React Flow Examples](https://reactflow.dev/examples)
- [React Flow API Reference](https://reactflow.dev/api-reference)
- [React Flow GitHub](https://github.com/xyflow/xyflow)
