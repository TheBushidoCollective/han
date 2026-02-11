---
name: reactflow-custom-nodes
user-invocable: false
description: Use when creating custom React Flow nodes, edges, and handles. Covers custom node components, resizable nodes, toolbars, and advanced customization.
allowed-tools:
  - Bash
  - Read
---

# React Flow Custom Nodes and Edges

Create fully customized nodes and edges with React Flow. Build complex
node-based editors with custom styling, behaviors, and interactions.

## Custom Node Component

```tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

// Define custom node data type
type TextUpdaterNodeData = {
  label: string;
  onChange: (value: string) => void;
};

type TextUpdaterNode = Node<TextUpdaterNodeData>;

function TextUpdaterNode({ data, isConnectable }: NodeProps<TextUpdaterNode>) {
  const onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    data.onChange(evt.target.value);
  };

  return (
    <div className="text-updater-node">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      <div>
        <label htmlFor="text">Text:</label>
        <input
          id="text"
          name="text"
          onChange={onChange}
          className="nodrag"
          defaultValue={data.label}
        />
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="a"
        isConnectable={isConnectable}
      />
    </div>
  );
}

// Memoize for performance
export default memo(TextUpdaterNode);
```

## Registering Custom Nodes

```tsx
import { ReactFlow } from '@xyflow/react';
import TextUpdaterNode from './TextUpdaterNode';
import ColorPickerNode from './ColorPickerNode';

// Define node types outside component to prevent re-renders
const nodeTypes = {
  textUpdater: TextUpdaterNode,
  colorPicker: ColorPickerNode,
};

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([
    {
      id: '1',
      type: 'textUpdater',
      position: { x: 0, y: 0 },
      data: {
        label: 'Hello',
        onChange: (value) => console.log(value),
      },
    },
  ]);

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
    />
  );
}
```

## Styled Node with Tailwind

```tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

type StatusNodeData = {
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
};

const statusColors = {
  pending: 'bg-yellow-100 border-yellow-400',
  running: 'bg-blue-100 border-blue-400',
  completed: 'bg-green-100 border-green-400',
  error: 'bg-red-100 border-red-400',
};

const statusIcons = {
  pending: '⏳',
  running: '⚡',
  completed: '✅',
  error: '❌',
};

function StatusNode({ data }: NodeProps<Node<StatusNodeData>>) {
  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 shadow-sm ${statusColors[data.status]}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      <div className="flex items-center gap-2">
        <span className="text-xl">{statusIcons[data.status]}</span>
        <span className="font-medium">{data.label}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400"
      />
    </div>
  );
}

export default memo(StatusNode);
```

## Node with Multiple Handles

```tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

type SwitchNodeData = {
  label: string;
  cases: string[];
};

function SwitchNode({ data }: NodeProps<Node<SwitchNodeData>>) {
  return (
    <div className="switch-node bg-white rounded-lg shadow-lg p-3 min-w-[150px]">
      {/* Single input */}
      <Handle type="target" position={Position.Top} id="input" />

      <div className="font-bold text-center border-b pb-2 mb-2">
        {data.label}
      </div>

      {/* Multiple outputs - one per case */}
      <div className="space-y-2">
        {data.cases.map((caseLabel, index) => (
          <div key={index} className="relative text-sm text-right pr-4">
            {caseLabel}
            <Handle
              type="source"
              position={Position.Right}
              id={`case-${index}`}
              style={{ top: `${30 + index * 28}px` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(SwitchNode);
```

## Resizable Node

```tsx
import { memo } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';

type ResizableNodeData = {
  label: string;
  content: string;
};

function ResizableNode({ data, selected }: NodeProps<Node<ResizableNodeData>>) {
  return (
    <>
      <NodeResizer
        color="#ff0071"
        isVisible={selected}
        minWidth={100}
        minHeight={50}
        handleStyle={{ width: 8, height: 8 }}
      />
      <Handle type="target" position={Position.Top} />
      <div className="p-4 h-full">
        <div className="font-bold">{data.label}</div>
        <div className="text-sm text-gray-600">{data.content}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export default memo(ResizableNode);
```

## Node Toolbar

```tsx
import { memo, useState } from 'react';
import {
  Handle,
  Position,
  NodeToolbar,
  type NodeProps,
  useReactFlow,
} from '@xyflow/react';

type EditableNodeData = {
  label: string;
};

function EditableNode({
  id,
  data,
  selected,
}: NodeProps<Node<EditableNodeData>>) {
  const { setNodes, deleteElements } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);

  const handleSave = () => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label } } : node
      )
    );
    setIsEditing(false);
  };

  const handleDelete = () => {
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <button onClick={() => setIsEditing(true)} className="toolbar-btn">
          ✏️ Edit
        </button>
        <button onClick={handleDelete} className="toolbar-btn text-red-500">
          🗑️ Delete
        </button>
      </NodeToolbar>

      <Handle type="target" position={Position.Top} />

      <div className="px-4 py-2 bg-white rounded shadow">
        {isEditing ? (
          <div className="flex gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="border rounded px-2"
              autoFocus
            />
            <button onClick={handleSave}>Save</button>
          </div>
        ) : (
          <span>{data.label}</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export default memo(EditableNode);
```

## Custom Edge

```tsx
import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';

function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 bg-gray-200 rounded-full border border-gray-400 cursor-pointer hover:bg-red-200"
            onClick={onEdgeClick}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(ButtonEdge);
```

## Edge with Custom Path

```tsx
import { memo } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

function CustomPathEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) {
  // Create a custom S-curve path
  const midY = (sourceY + targetY) / 2;

  const path = `
    M ${sourceX} ${sourceY}
    C ${sourceX} ${midY},
      ${targetX} ${midY},
      ${targetX} ${targetY}
  `;

  return <BaseEdge path={path} style={{ stroke: '#b1b1b7', strokeWidth: 2 }} />;
}

export default memo(CustomPathEdge);
```

## Registering Custom Edges

```tsx
import { ReactFlow } from '@xyflow/react';
import ButtonEdge from './ButtonEdge';
import CustomPathEdge from './CustomPathEdge';

const edgeTypes = {
  buttonEdge: ButtonEdge,
  customPath: CustomPathEdge,
};

function Flow() {
  const [edges, setEdges, onEdgesChange] = useEdgesState([
    {
      id: 'e1-2',
      source: '1',
      target: '2',
      type: 'buttonEdge',
    },
  ]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      edgeTypes={edgeTypes}
      onEdgesChange={onEdgesChange}
    />
  );
}
```

## Connection Validation

```tsx
import { useCallback } from 'react';
import { ReactFlow, type IsValidConnection } from '@xyflow/react';

function Flow() {
  // Validate connections before they're made
  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      // Prevent self-connections
      if (connection.source === connection.target) {
        return false;
      }

      // Only allow connections between specific handle types
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      // Example: input nodes can't receive connections
      if (targetNode?.type === 'input') {
        return false;
      }

      // Example: output nodes can't send connections
      if (sourceNode?.type === 'output') {
        return false;
      }

      return true;
    },
    [nodes]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      isValidConnection={isValidConnection}
    />
  );
}
```

## Group Node (Parent Container)

```tsx
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';

type GroupNodeData = {
  label: string;
};

function GroupNode({ data }: NodeProps<Node<GroupNodeData>>) {
  return (
    <div className="p-2 border-2 border-dashed border-gray-400 rounded-lg bg-gray-50/50 min-w-[200px] min-h-[150px]">
      <div className="text-xs text-gray-500 font-medium mb-2">{data.label}</div>
    </div>
  );
}

export default memo(GroupNode);

// Usage - child nodes reference parent
const nodes = [
  {
    id: 'group-1',
    type: 'group',
    data: { label: 'Group A' },
    position: { x: 0, y: 0 },
    style: { width: 300, height: 200 },
  },
  {
    id: 'child-1',
    data: { label: 'Child Node' },
    position: { x: 50, y: 50 },
    parentId: 'group-1',
    extent: 'parent',
  },
];
```

## CSS Styling

```css
/* node.css */
.react-flow__node-custom {
  background: white;
  border: 1px solid #1a192b;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  width: 150px;
}

.react-flow__node-custom.selected {
  border-color: #ff0071;
  box-shadow: 0 0 0 2px #ff0071;
}

.react-flow__handle {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #555;
}

.react-flow__handle-connecting {
  background-color: #ff0071;
}

.react-flow__handle-valid {
  background-color: #55dd99;
}

/* Prevent drag on interactive elements */
.nodrag {
  pointer-events: all;
}

/* Edge styling */
.react-flow__edge-path {
  stroke: #b1b1b7;
  stroke-width: 2;
}

.react-flow__edge.selected .react-flow__edge-path {
  stroke: #ff0071;
}

.react-flow__edge.animated .react-flow__edge-path {
  stroke-dasharray: 5;
  animation: dashdraw 0.5s linear infinite;
}

@keyframes dashdraw {
  from {
    stroke-dashoffset: 10;
  }
}
```

## When to Use This Skill

Use reactflow-custom-nodes when you need to:

- Build nodes with interactive form elements
- Create visually distinct node types
- Add node toolbars and context menus
- Build resizable nodes
- Create group/container nodes
- Add custom edge interactions
- Validate connections between nodes
- Build complex workflow interfaces

## Best Practices

- Always memoize custom node components with `memo()`
- Define nodeTypes/edgeTypes outside the component
- Use the `nodrag` class on interactive elements
- Keep node components focused and reusable
- Use TypeScript for type-safe node data
- Test connection validation thoroughly
- Consider accessibility in custom nodes
- Use CSS modules or Tailwind for styling

## Resources

- [Custom Nodes Guide](https://reactflow.dev/learn/customization/custom-nodes)
- [Custom Edges Guide](https://reactflow.dev/learn/customization/custom-edges)
- [Node Toolbar](https://reactflow.dev/api-reference/components/node-toolbar)
- [Node Resizer](https://reactflow.dev/api-reference/components/node-resizer)
