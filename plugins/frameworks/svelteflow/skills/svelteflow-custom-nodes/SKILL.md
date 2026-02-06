---
name: svelteflow-custom-nodes
description: Use when creating custom Svelte Flow nodes, edges, and handles. Covers custom node components, resizable nodes, toolbars, and advanced customization.
allowed-tools:
  - Bash
  - Read
---

# Svelte Flow Custom Nodes and Edges

Create fully customized nodes and edges with Svelte Flow. Build complex
node-based editors with custom styling, behaviors, and interactions.

## Custom Node Component

```svelte
<!-- TextUpdaterNode.svelte -->
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  export let id: string;
  export let data: { label: string };
  export let isConnectable: boolean;

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    // Dispatch custom event or update store
    console.log('Value changed:', target.value);
  }
</script>

<div class="text-updater-node">
  <Handle type="target" position={Position.Top} {isConnectable} />

  <div class="content">
    <label for="text">Text:</label>
    <input
      id="text"
      name="text"
      on:input={handleChange}
      class="nodrag"
      value={data.label}
    />
  </div>

  <Handle type="source" position={Position.Bottom} id="a" {isConnectable} />
</div>

<style>
  .text-updater-node {
    background: white;
    border: 1px solid #1a192b;
    border-radius: 8px;
    padding: 10px;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  input {
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
</style>
```

## Registering Custom Nodes

```svelte
<!-- Flow.svelte -->
<script lang="ts">
  import { SvelteFlow, type Node, type NodeTypes } from '@xyflow/svelte';
  import { writable } from 'svelte/store';
  import TextUpdaterNode from './TextUpdaterNode.svelte';
  import ColorPickerNode from './ColorPickerNode.svelte';

  // Define node types
  const nodeTypes: NodeTypes = {
    textUpdater: TextUpdaterNode,
    colorPicker: ColorPickerNode,
  };

  const nodes = writable<Node[]>([
    {
      id: '1',
      type: 'textUpdater',
      position: { x: 0, y: 0 },
      data: { label: 'Hello' },
    },
    {
      id: '2',
      type: 'colorPicker',
      position: { x: 200, y: 100 },
      data: { color: '#ff0000' },
    },
  ]);

  const edges = writable([]);
</script>

<SvelteFlow {nodes} {edges} {nodeTypes} fitView />
```

## Styled Node with Tailwind

```svelte
<!-- StatusNode.svelte -->
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  export let data: {
    label: string;
    status: 'pending' | 'running' | 'completed' | 'error';
  };

  const statusConfig = {
    pending: { bg: 'bg-yellow-100', border: 'border-yellow-400', icon: '⏳' },
    running: { bg: 'bg-blue-100', border: 'border-blue-400', icon: '⚡' },
    completed: { bg: 'bg-green-100', border: 'border-green-400', icon: '✅' },
    error: { bg: 'bg-red-100', border: 'border-red-400', icon: '❌' },
  };

  $: config = statusConfig[data.status];
</script>

<div class="px-4 py-2 rounded-lg border-2 shadow-sm {config.bg} {config.border}">
  <Handle type="target" position={Position.Top} class="!bg-gray-400" />

  <div class="flex items-center gap-2">
    <span class="text-xl">{config.icon}</span>
    <span class="font-medium">{data.label}</span>
  </div>

  <Handle type="source" position={Position.Bottom} class="!bg-gray-400" />
</div>
```

## Node with Multiple Handles

```svelte
<!-- SwitchNode.svelte -->
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  export let data: {
    label: string;
    cases: string[];
  };
</script>

<div class="switch-node">
  <Handle type="target" position={Position.Top} id="input" />

  <div class="header">{data.label}</div>

  <div class="cases">
    {#each data.cases as caseLabel, index}
      <div class="case">
        {caseLabel}
        <Handle
          type="source"
          position={Position.Right}
          id="case-{index}"
          style="top: {30 + index * 28}px"
        />
      </div>
    {/each}
  </div>
</div>

<style>
  .switch-node {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    padding: 12px;
    min-width: 150px;
  }

  .header {
    font-weight: bold;
    text-align: center;
    border-bottom: 1px solid #eee;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }

  .cases {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .case {
    position: relative;
    font-size: 14px;
    text-align: right;
    padding-right: 16px;
  }
</style>
```

## Resizable Node

```svelte
<!-- ResizableNode.svelte -->
<script lang="ts">
  import { Handle, Position, NodeResizer } from '@xyflow/svelte';

  export let id: string;
  export let data: { label: string; content: string };
  export let selected: boolean;
</script>

<NodeResizer
  color="#ff0071"
  isVisible={selected}
  minWidth={100}
  minHeight={50}
  handleStyle={{ width: '8px', height: '8px' }}
/>

<Handle type="target" position={Position.Top} />

<div class="content">
  <div class="label">{data.label}</div>
  <div class="body">{data.content}</div>
</div>

<Handle type="source" position={Position.Bottom} />

<style>
  .content {
    padding: 16px;
    height: 100%;
    background: white;
    border: 1px solid #1a192b;
    border-radius: 8px;
  }

  .label {
    font-weight: bold;
    margin-bottom: 8px;
  }

  .body {
    font-size: 14px;
    color: #666;
  }
</style>
```

## Node with Toolbar

```svelte
<!-- EditableNode.svelte -->
<script lang="ts">
  import { Handle, Position, NodeToolbar, useSvelteFlow } from '@xyflow/svelte';
  import { createEventDispatcher } from 'svelte';

  export let id: string;
  export let data: { label: string };
  export let selected: boolean;

  const { setNodes, deleteElements } = useSvelteFlow();
  const dispatch = createEventDispatcher();

  let isEditing = false;
  let editValue = data.label;

  function handleEdit() {
    isEditing = true;
  }

  function handleSave() {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: editValue } }
          : node
      )
    );
    isEditing = false;
  }

  function handleDelete() {
    deleteElements({ nodes: [{ id }] });
  }
</script>

<NodeToolbar isVisible={selected} position={Position.Top}>
  <button on:click={handleEdit} class="toolbar-btn">✏️ Edit</button>
  <button on:click={handleDelete} class="toolbar-btn delete">🗑️ Delete</button>
</NodeToolbar>

<Handle type="target" position={Position.Top} />

<div class="node-content">
  {#if isEditing}
    <div class="edit-form">
      <input bind:value={editValue} class="nodrag" />
      <button on:click={handleSave}>Save</button>
    </div>
  {:else}
    <span>{data.label}</span>
  {/if}
</div>

<Handle type="source" position={Position.Bottom} />

<style>
  .node-content {
    padding: 12px 16px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .toolbar-btn {
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }

  .toolbar-btn.delete {
    color: #dc2626;
  }

  .edit-form {
    display: flex;
    gap: 8px;
  }

  input {
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
</style>
```

## Custom Edge

```svelte
<!-- ButtonEdge.svelte -->
<script lang="ts">
  import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    useSvelteFlow,
  } from '@xyflow/svelte';

  export let id: string;
  export let sourceX: number;
  export let sourceY: number;
  export let targetX: number;
  export let targetY: number;
  export let sourcePosition: Position;
  export let targetPosition: Position;
  export let style: string = '';
  export let markerEnd: string = '';

  const { setEdges } = useSvelteFlow();

  $: [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  function handleClick() {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  }
</script>

<BaseEdge path={edgePath} {markerEnd} {style} />
<EdgeLabelRenderer>
  <div
    style="
      position: absolute;
      transform: translate(-50%, -50%) translate({labelX}px, {labelY}px);
      pointer-events: all;
    "
    class="nodrag nopan"
  >
    <button class="delete-button" on:click={handleClick}>×</button>
  </div>
</EdgeLabelRenderer>

<style>
  .delete-button {
    width: 20px;
    height: 20px;
    background: #f0f0f0;
    border-radius: 50%;
    border: 1px solid #999;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-button:hover {
    background: #ffcccc;
  }
</style>
```

## Registering Custom Edges

```svelte
<script lang="ts">
  import { SvelteFlow, type EdgeTypes } from '@xyflow/svelte';
  import { writable } from 'svelte/store';
  import ButtonEdge from './ButtonEdge.svelte';
  import AnimatedEdge from './AnimatedEdge.svelte';

  const edgeTypes: EdgeTypes = {
    buttonEdge: ButtonEdge,
    animated: AnimatedEdge,
  };

  const edges = writable([
    {
      id: 'e1-2',
      source: '1',
      target: '2',
      type: 'buttonEdge',
    },
  ]);
</script>

<SvelteFlow {nodes} {edges} {edgeTypes} />
```

## Group Node (Parent Container)

```svelte
<!-- GroupNode.svelte -->
<script lang="ts">
  export let data: { label: string };
</script>

<div class="group-node">
  <div class="group-label">{data.label}</div>
</div>

<style>
  .group-node {
    padding: 8px;
    border: 2px dashed #999;
    border-radius: 8px;
    background: rgba(240, 240, 240, 0.5);
    min-width: 200px;
    min-height: 150px;
  }

  .group-label {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }
</style>
```

```svelte
<!-- Usage with child nodes -->
<script>
  const nodes = writable([
    {
      id: 'group-1',
      type: 'group',
      data: { label: 'Group A' },
      position: { x: 0, y: 0 },
      style: 'width: 300px; height: 200px;',
    },
    {
      id: 'child-1',
      data: { label: 'Child Node' },
      position: { x: 50, y: 50 },
      parentId: 'group-1',
      extent: 'parent',
    },
  ]);
</script>
```

## Custom Handle Component

```svelte
<!-- CustomHandle.svelte -->
<script lang="ts">
  import { Handle } from '@xyflow/svelte';

  export let type: 'source' | 'target';
  export let position: Position;
  export let id: string = '';
  export let isConnectable: boolean = true;
  export let color: string = '#555';
</script>

<Handle
  {type}
  {position}
  {id}
  {isConnectable}
  style="
    width: 12px;
    height: 12px;
    background: {color};
    border: 2px solid white;
  "
/>
```

## Interactive Node with State

```svelte
<!-- CounterNode.svelte -->
<script lang="ts">
  import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';

  export let id: string;
  export let data: { count: number };

  const { setNodes } = useSvelteFlow();

  function increment() {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, count: node.data.count + 1 } }
          : node
      )
    );
  }

  function decrement() {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, count: node.data.count - 1 } }
          : node
      )
    );
  }
</script>

<div class="counter-node">
  <Handle type="target" position={Position.Top} />

  <div class="display">{data.count}</div>

  <div class="buttons">
    <button on:click={decrement} class="nodrag">-</button>
    <button on:click={increment} class="nodrag">+</button>
  </div>

  <Handle type="source" position={Position.Bottom} />
</div>

<style>
  .counter-node {
    background: white;
    border: 2px solid #1a192b;
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }

  .display {
    font-size: 32px;
    font-weight: bold;
    margin: 8px 0;
  }

  .buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  button {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: #1a192b;
    color: white;
    font-size: 18px;
    cursor: pointer;
  }

  button:hover {
    background: #333;
  }
</style>
```

## CSS Styling

```css
/* Global flow styles */
:global(.svelte-flow__node-custom) {
  background: white;
  border: 1px solid #1a192b;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
}

:global(.svelte-flow__node-custom.selected) {
  border-color: #ff0071;
  box-shadow: 0 0 0 2px #ff0071;
}

:global(.svelte-flow__handle) {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #555;
}

:global(.svelte-flow__handle-connecting) {
  background-color: #ff0071;
}

:global(.svelte-flow__handle-valid) {
  background-color: #55dd99;
}

/* Prevent drag on interactive elements */
:global(.nodrag) {
  pointer-events: all;
}

/* Edge styling */
:global(.svelte-flow__edge-path) {
  stroke: #b1b1b7;
  stroke-width: 2;
}

:global(.svelte-flow__edge.selected .svelte-flow__edge-path) {
  stroke: #ff0071;
}
```

## When to Use This Skill

Use svelteflow-custom-nodes when you need to:

- Build nodes with interactive Svelte components
- Create visually distinct node types
- Add node toolbars and context menus
- Build resizable nodes
- Create group/container nodes
- Add custom edge interactions
- Build complex workflow interfaces in Svelte

## Best Practices

- Use Svelte's reactivity for state management
- Define nodeTypes/edgeTypes at component level
- Use the `nodrag` class on interactive elements
- Keep node components focused and reusable
- Use TypeScript for type-safe node data
- Use CSS scoping for node styles
- Test connection validation thoroughly

## Resources

- [Svelte Flow Custom Nodes](https://svelteflow.dev/learn/customization/custom-nodes)
- [Svelte Flow Custom Edges](https://svelteflow.dev/learn/customization/custom-edges)
- [Node Toolbar API](https://svelteflow.dev/api-reference/components/node-toolbar)
- [Node Resizer API](https://svelteflow.dev/api-reference/components/node-resizer)
