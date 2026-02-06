---
name: svelteflow-fundamentals
description: Use when building node-based UIs, flow diagrams, workflow editors, or interactive graphs with Svelte Flow. Covers setup, nodes, edges, controls, and interactivity.
allowed-tools:
  - Bash
  - Read
---

# Svelte Flow Fundamentals

Build customizable node-based editors and interactive diagrams with Svelte Flow.
This skill covers core concepts, setup, and common patterns for creating
flow-based interfaces in Svelte applications.

## Installation

```bash
# npm
npm install @xyflow/svelte

# pnpm
pnpm add @xyflow/svelte

# yarn
yarn add @xyflow/svelte
```

## Basic Setup

```svelte
<script lang="ts">
  import {
    SvelteFlow,
    Controls,
    Background,
    MiniMap,
    type Node,
    type Edge,
  } from '@xyflow/svelte';
  import { writable } from 'svelte/store';

  import '@xyflow/svelte/dist/style.css';

  const nodes = writable<Node[]>([
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
  ]);

  const edges = writable<Edge[]>([
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3' },
  ]);
</script>

<div style="height: 100vh; width: 100vw;">
  <SvelteFlow {nodes} {edges} fitView>
    <Controls />
    <Background />
    <MiniMap />
  </SvelteFlow>
</div>
```

## Using Stores for State

```svelte
<script lang="ts">
  import { SvelteFlow, type Node, type Edge } from '@xyflow/svelte';
  import { writable, derived } from 'svelte/store';

  // Writable stores for reactive state
  const nodes = writable<Node[]>([
    { id: '1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
    { id: '2', data: { label: 'Node 2' }, position: { x: 200, y: 100 } },
  ]);

  const edges = writable<Edge[]>([
    { id: 'e1-2', source: '1', target: '2' },
  ]);

  // Derived store for computed values
  const nodeCount = derived(nodes, ($nodes) => $nodes.length);
  const edgeCount = derived(edges, ($edges) => $edges.length);

  // Add a new node
  function addNode() {
    const id = `node-${Date.now()}`;
    nodes.update((n) => [
      ...n,
      {
        id,
        data: { label: `Node ${$nodeCount + 1}` },
        position: { x: Math.random() * 300, y: Math.random() * 300 },
      },
    ]);
  }

  // Update node data
  function updateNodeLabel(id: string, label: string) {
    nodes.update((n) =>
      n.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label } } : node
      )
    );
  }

  // Delete a node
  function deleteNode(id: string) {
    nodes.update((n) => n.filter((node) => node.id !== id));
    // Also remove connected edges
    edges.update((e) => e.filter((edge) => edge.source !== id && edge.target !== id));
  }
</script>

<div>
  <p>Nodes: {$nodeCount} | Edges: {$edgeCount}</p>
  <button on:click={addNode}>Add Node</button>
</div>

<SvelteFlow {nodes} {edges} fitView />
```

## Node Types

### Built-in Node Types

```svelte
<script lang="ts">
  import { SvelteFlow, type Node } from '@xyflow/svelte';
  import { writable } from 'svelte/store';

  const nodes = writable<Node[]>([
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
  ]);
</script>
```

### Node Configuration

```typescript
import { Position, type Node } from '@xyflow/svelte';

const node: Node = {
  id: 'unique-id',
  type: 'default',
  position: { x: 100, y: 100 },
  data: { label: 'My Node', customProp: 'value' },
  // Optional properties
  style: 'background-color: #f0f0f0;',
  class: 'custom-node',
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
  extent: 'parent',
  parentId: 'parent-node-id',
  expandParent: true,
};
```

## Edge Types and Configuration

```svelte
<script lang="ts">
  import { SvelteFlow, MarkerType, type Edge } from '@xyflow/svelte';
  import { writable } from 'svelte/store';

  const edges = writable<Edge[]>([
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
    // Styled edge with arrow
    {
      id: 'e5',
      source: '5',
      target: '6',
      label: 'Connection',
      style: 'stroke: #333; stroke-width: 2px;',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#333',
      },
    },
  ]);
</script>
```

## Event Handling

```svelte
<script lang="ts">
  import { SvelteFlow, type Node, type Edge } from '@xyflow/svelte';
  import { writable } from 'svelte/store';

  const nodes = writable<Node[]>([]);
  const edges = writable<Edge[]>([]);

  // Node events
  function handleNodeClick(event: CustomEvent<{ node: Node }>) {
    console.log('Node clicked:', event.detail.node);
  }

  function handleNodeDoubleClick(event: CustomEvent<{ node: Node }>) {
    console.log('Node double clicked:', event.detail.node);
  }

  function handleNodeDragStart(event: CustomEvent<{ node: Node }>) {
    console.log('Drag started:', event.detail.node.id);
  }

  function handleNodeDragStop(event: CustomEvent<{ node: Node }>) {
    console.log('Drag stopped:', event.detail.node.position);
  }

  // Edge events
  function handleEdgeClick(event: CustomEvent<{ edge: Edge }>) {
    console.log('Edge clicked:', event.detail.edge);
  }

  // Connection events
  function handleConnect(event: CustomEvent<{ connection: any }>) {
    const { connection } = event.detail;
    edges.update((e) => [
      ...e,
      {
        id: `${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
      },
    ]);
  }

  // Selection events
  function handleSelectionChange(
    event: CustomEvent<{ nodes: Node[]; edges: Edge[] }>
  ) {
    console.log('Selected nodes:', event.detail.nodes);
    console.log('Selected edges:', event.detail.edges);
  }
</script>

<SvelteFlow
  {nodes}
  {edges}
  on:nodeclick={handleNodeClick}
  on:nodedoubleclick={handleNodeDoubleClick}
  on:nodedragstart={handleNodeDragStart}
  on:nodedragstop={handleNodeDragStop}
  on:edgeclick={handleEdgeClick}
  on:connect={handleConnect}
  on:selectionchange={handleSelectionChange}
  fitView
/>
```

## Plugin Components

### Background

```svelte
<script>
  import { SvelteFlow, Background, BackgroundVariant } from '@xyflow/svelte';
</script>

<SvelteFlow {nodes} {edges}>
  <!-- Dots pattern -->
  <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

  <!-- Lines pattern -->
  <Background variant={BackgroundVariant.Lines} gap={20} />

  <!-- Cross pattern -->
  <Background variant={BackgroundVariant.Cross} gap={25} />

  <!-- Custom color -->
  <Background color="#aaa" gap={16} />
</SvelteFlow>
```

### Controls

```svelte
<script>
  import { SvelteFlow, Controls } from '@xyflow/svelte';
</script>

<SvelteFlow {nodes} {edges}>
  <Controls
    showZoom={true}
    showFitView={true}
    showInteractive={true}
    position="bottom-left"
  />
</SvelteFlow>
```

### MiniMap

```svelte
<script>
  import { SvelteFlow, MiniMap } from '@xyflow/svelte';
</script>

<SvelteFlow {nodes} {edges}>
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
</SvelteFlow>
```

### Panel

```svelte
<script>
  import { SvelteFlow, Panel } from '@xyflow/svelte';
</script>

<SvelteFlow {nodes} {edges}>
  <Panel position="top-left">
    <button on:click={saveFlow}>Save</button>
    <button on:click={restoreFlow}>Restore</button>
  </Panel>

  <Panel position="top-right">
    <p>Node count: {$nodes.length}</p>
  </Panel>
</SvelteFlow>
```

## Viewport Control with useSvelteFlow

```svelte
<script lang="ts">
  import { SvelteFlow, useSvelteFlow, Panel } from '@xyflow/svelte';

  const { zoomIn, zoomOut, fitView, setCenter, getViewport } = useSvelteFlow();

  function handleFitView() {
    fitView({ padding: 0.2 });
  }

  function handleCenter() {
    setCenter(0, 0, { zoom: 1 });
  }

  function logViewport() {
    const viewport = getViewport();
    console.log('Current viewport:', viewport);
  }
</script>

<SvelteFlow {nodes} {edges}>
  <Panel position="top-left">
    <button on:click={() => zoomIn()}>Zoom In</button>
    <button on:click={() => zoomOut()}>Zoom Out</button>
    <button on:click={handleFitView}>Fit View</button>
    <button on:click={handleCenter}>Center</button>
    <button on:click={logViewport}>Log Viewport</button>
  </Panel>
</SvelteFlow>
```

## Node Operations

```svelte
<script lang="ts">
  import { SvelteFlow, useSvelteFlow, type Node } from '@xyflow/svelte';
  import { writable } from 'svelte/store';

  const nodes = writable<Node[]>([]);
  const edges = writable<Edge[]>([]);

  const { getNodes, setNodes, addNodes, deleteElements } = useSvelteFlow();

  function addNewNode() {
    const id = `node-${Date.now()}`;
    addNodes([
      {
        id,
        data: { label: 'New Node' },
        position: { x: Math.random() * 300, y: Math.random() * 300 },
      },
    ]);
  }

  function deleteSelectedNodes() {
    const selectedNodes = getNodes().filter((node) => node.selected);
    deleteElements({ nodes: selectedNodes });
  }

  function updateAllLabels(prefix: string) {
    setNodes((nodes) =>
      nodes.map((node, index) => ({
        ...node,
        data: { ...node.data, label: `${prefix} ${index + 1}` },
      }))
    );
  }
</script>
```

## Saving and Restoring State

```svelte
<script lang="ts">
  import { SvelteFlow, useSvelteFlow, Panel, type Viewport } from '@xyflow/svelte';
  import { writable, get } from 'svelte/store';

  const nodes = writable<Node[]>([]);
  const edges = writable<Edge[]>([]);

  const { toObject, setViewport } = useSvelteFlow();

  function saveFlow() {
    const flow = toObject();
    localStorage.setItem('flow', JSON.stringify(flow));
    console.log('Flow saved');
  }

  function restoreFlow() {
    const saved = localStorage.getItem('flow');
    if (saved) {
      const flow = JSON.parse(saved);
      nodes.set(flow.nodes || []);
      edges.set(flow.edges || []);
      if (flow.viewport) {
        setViewport(flow.viewport);
      }
      console.log('Flow restored');
    }
  }
</script>

<SvelteFlow {nodes} {edges}>
  <Panel position="top-right">
    <button on:click={saveFlow}>Save</button>
    <button on:click={restoreFlow}>Restore</button>
  </Panel>
</SvelteFlow>
```

## Connection Validation

```svelte
<script lang="ts">
  import { SvelteFlow, type IsValidConnection } from '@xyflow/svelte';

  const isValidConnection: IsValidConnection = (connection) => {
    // Prevent self-connections
    if (connection.source === connection.target) {
      return false;
    }

    // Add custom validation logic
    return true;
  };
</script>

<SvelteFlow {nodes} {edges} {isValidConnection} />
```

## When to Use This Skill

Use svelteflow-fundamentals when you need to:

- Build workflow builders with Svelte
- Create data pipeline visualizations
- Design state machine diagrams
- Build chatbot conversation flows
- Create organizational charts
- Build ML pipeline visualizers
- Create interactive decision trees in Svelte apps

## Best Practices

- Use Svelte stores for reactive flow state
- Keep node components focused and reusable
- Use TypeScript for type safety
- Memoize expensive computations in derived stores
- Use CSS variables for theming
- Add keyboard shortcuts for power users
- Implement undo/redo for better UX
- Use fitView() on initial render

## Resources

- [Svelte Flow Documentation](https://svelteflow.dev/learn)
- [Svelte Flow Examples](https://svelteflow.dev/examples)
- [Svelte Flow API Reference](https://svelteflow.dev/api-reference)
- [xyflow GitHub](https://github.com/xyflow/xyflow)
